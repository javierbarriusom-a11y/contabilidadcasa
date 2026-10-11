(function attachCanonicalIndexValuation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalIndexValuation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalIndexValuationFactory() {
  "use strict";

  // WP-50 (CAR-04, docs/WP50_DISENO.md): la vivienda y el local revalorizados por un índice público. Dado el último valor DECLARADO de un inmueble (valor y fecha) y una serie trimestral de un índice
  // (los valores los teclea el hogar: la app no se conecta a ninguna fuente), estima el valor al último trimestre con índice:
  //     estimado = valor declarado × índice del último trimestre ÷ índice del trimestre de la declaración.
  // Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj (el «hoy» entra por parámetro). NUNCA cambia el valor declarado ni lo guarda: devuelve una ESTIMACIÓN aparte, y solo si el hogar lo
  // activa por inmueble sustituye al declarado en el patrimonio y en el LTV.
  //
  // Reglas de honestidad:
  //   · un índice agregado no es una tasación: toda cifra sale como «estimado por índice · T2 2026», nunca como valor;
  //   · sin el índice del trimestre de la declaración, o sin ningún trimestre posterior, el valor declarado se queda como está (no se interpola, ni se extrapola, ni se usa el trimestre más cercano);
  //   · «estimado» solo hasta el ÚLTIMO trimestre que el hogar ha tecleado: si ese trimestre queda lejos del actual, se dice (la estimación envejece);
  //   · un valor declarado que falta o es cero no se «revaloriza»: no hay nada que revalorizar.

  const SCHEMA_ID = "finance-index-valuation/v1";
  const MAX_SERIES = 6;
  const MAX_POINTS = 80;
  const STALE_QUARTERS = 2;

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();

  /** Trimestre «AAAA-Tn» de una fecha ISO (o de un «AAAA-MM»); cadena vacía si no es una fecha válida. */
  function quarterOf(value) {
    const match = text(value).match(/^(\d{4})-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/);
    return match ? `${match[1]}-T${Math.ceil(Number(match[2]) / 3)}` : "";
  }

  const validQuarter = (key) => /^\d{4}-T[1-4]$/.test(text(key));
  const quarterIndex = (key) => Number(key.slice(0, 4)) * 4 + Number(key.slice(6, 7)) - 1;
  /** «T2 2026» para «2026-T2». */
  const quarterLabel = (key) => (validQuarter(key) ? `${key.slice(5, 7)} ${key.slice(0, 4)}` : text(key));
  /** Trimestres de `from` a `to` (negativo si `to` es anterior). */
  const quartersBetween = (from, to) => (validQuarter(from) && validQuarter(to) ? quarterIndex(to) - quarterIndex(from) : 0);
  const compareQuarters = (a, b) => quarterIndex(a) - quarterIndex(b);

  function cleanPoints(raw) {
    const byQuarter = new Map();
    (Array.isArray(raw) ? raw : []).forEach((point) => {
      const quarter = text(point?.quarter);
      if (validQuarter(quarter) && known(point?.value) && number(point.value) > 0) byQuarter.set(quarter, { quarter, value: round2(point.value) });
    });
    return [...byQuarter.values()].sort((a, b) => compareQuarters(a.quarter, b.quarter)).slice(-MAX_POINTS);
  }

  /**
   * El almacén: series de índice con sus puntos y, por inmueble, qué serie usa y si su estimación sustituye al valor declarado. Todo lo que no encaja se descarta sin romper (copias antiguas, vacío).
   * @param {any} raw
   */
  function normalizeStore(raw) {
    const series = [];
    const seen = new Set();
    (Array.isArray(raw?.series) ? raw.series : []).forEach((item, index) => {
      const id = text(item?.id) || `serie-${index + 1}`;
      if (seen.has(id) || series.length >= MAX_SERIES) return;
      seen.add(id);
      series.push({ id, label: text(item?.label).slice(0, 60) || `Serie ${index + 1}`, points: cleanPoints(item?.points) });
    });
    const links = {};
    Object.entries(raw?.links && typeof raw.links === "object" ? raw.links : {}).forEach(([assetId, link]) => {
      const seriesId = text(link?.seriesId);
      if (text(assetId) && seen.has(seriesId)) links[text(assetId)] = { seriesId, useEstimate: link?.useEstimate === true };
    });
    return { series, links };
  }

  function nextSeriesId(store) {
    let n = store.series.length + 1;
    while (store.series.some((item) => item.id === `serie-${n}`)) n += 1;
    return `serie-${n}`;
  }

  /** Añade una serie (hasta 6). `ok: false` con motivo si no cabe o no tiene nombre. */
  function addSeries(store, label) {
    const current = normalizeStore(store);
    const name = text(label).slice(0, 60);
    if (!name) return { ok: false, reason: "Ponle un nombre a la serie (por ejemplo, «IPV vivienda · Cataluña»).", store: current };
    if (current.series.length >= MAX_SERIES) return { ok: false, reason: `Como máximo ${MAX_SERIES} series.`, store: current };
    if (current.series.some((item) => item.label.toLowerCase() === name.toLowerCase())) return { ok: false, reason: "Ya hay una serie con ese nombre.", store: current };
    const id = nextSeriesId(current);
    return { ok: true, id, store: { ...current, series: [...current.series, { id, label: name, points: [] }] } };
  }

  /** Quita una serie y los vínculos que la usaban (esos inmuebles vuelven a su valor declarado). */
  function removeSeries(store, seriesId) {
    const current = normalizeStore(store);
    const links = Object.fromEntries(Object.entries(current.links).filter(([, link]) => link.seriesId !== seriesId));
    return { ...current, series: current.series.filter((item) => item.id !== seriesId), links };
  }

  /** Teclea (o corrige) el índice de un trimestre. El valor debe ser un número positivo; el trimestre, «AAAA-Tn». */
  function setPoint(store, seriesId, quarter, value) {
    const current = normalizeStore(store);
    if (!current.series.some((item) => item.id === seriesId)) return { ok: false, reason: "Esa serie no existe.", store: current };
    if (!validQuarter(quarter)) return { ok: false, reason: "El trimestre no es válido.", store: current };
    if (!known(value) || !(number(value) > 0)) return { ok: false, reason: "El índice tiene que ser un número mayor que cero.", store: current };
    const series = current.series.map((item) => (item.id === seriesId ? { ...item, points: cleanPoints([...item.points.filter((p) => p.quarter !== quarter), { quarter, value }]) } : item));
    return { ok: true, store: { ...current, series } };
  }

  function removePoint(store, seriesId, quarter) {
    const current = normalizeStore(store);
    return { ...current, series: current.series.map((item) => (item.id === seriesId ? { ...item, points: item.points.filter((p) => p.quarter !== quarter) } : item)) };
  }

  /** Vincula un inmueble a una serie (o lo desvincula con `seriesId` vacío) y fija si su estimación sustituye al valor declarado. */
  function setLink(store, assetId, { seriesId = "", useEstimate = false } = {}) {
    const current = normalizeStore(store);
    const links = { ...current.links };
    if (!text(seriesId) || !current.series.some((item) => item.id === seriesId)) delete links[text(assetId)];
    else links[text(assetId)] = { seriesId, useEstimate: useEstimate === true };
    return { ...current, links };
  }

  /**
   * La estimación de un inmueble. `status`: «estimated» (hay valor nuevo), «declared-current» (el último índice es del trimestre de la declaración o anterior: no hay nada que mover), «no-series»,
   * «no-value» (sin valor declarado), «no-date» (sin fecha de la declaración), «no-index-base» (falta el índice del trimestre de la declaración) o «no-index-later» (no hay ningún trimestre posterior).
   * `value` es siempre un número útil: la estimación si «estimated» y el valor declarado en cualquier otro caso. `stale` avisa de que el último índice queda a más de dos trimestres de `todayQuarter`.
   * @param {{declaredValue?: number|string|null, declaredDate?: string, series?: {label?: string, points?: Array<{quarter: string, value: number}>}|null, todayQuarter?: string}} [params]
   * @returns {Record<string, any>}
   */
  function estimate({ declaredValue = null, declaredDate = "", series = null, todayQuarter = "" } = {}) {
    const declared = known(declaredValue) ? round2(declaredValue) : null;
    const base = { schemaId: SCHEMA_ID, declaredValue: declared, value: declared, estimated: false };
    if (!series) return { ...base, status: "no-series" };
    if (declared === null || !(declared > 0)) return { ...base, status: "no-value" };
    const baseQuarter = quarterOf(declaredDate);
    if (!baseQuarter) return { ...base, status: "no-date" };
    const points = cleanPoints(series.points);
    const basePoint = points.find((p) => p.quarter === baseQuarter);
    if (!basePoint) return { ...base, status: "no-index-base", baseQuarter };
    const latest = points[points.length - 1];
    if (compareQuarters(latest.quarter, baseQuarter) <= 0) return { ...base, status: "declared-current", baseQuarter, latestQuarter: latest.quarter };
    const value = round2((declared * latest.value) / basePoint.value);
    const lag = validQuarter(todayQuarter) ? quartersBetween(latest.quarter, todayQuarter) : 0;
    return {
      ...base, status: "estimated", estimated: true, value, delta: round2(value - declared), changePct: round2((latest.value / basePoint.value - 1) * 100),
      baseQuarter, baseIndex: basePoint.value, latestQuarter: latest.quarter, latestIndex: latest.value, stale: lag > STALE_QUARTERS, quartersBehind: Math.max(0, lag),
      chip: `estimado por índice · ${quarterLabel(latest.quarter)}`,
    };
  }

  /**
   * Los activos tal como se leen para el patrimonio y el LTV: los inmuebles con la estimación ACTIVADA y calculable llevan su valor estimado (y procedencia «estimated»); el resto, tal cual.
   * Devuelve una copia (nada se modifica) y la lista de lo aplicado.
   * @param {Array<any>} assets
   * @param {any} store
   * @param {string} [todayQuarter]
   */
  function effectiveAssets(assets, store, todayQuarter = "") {
    const current = normalizeStore(store);
    const applied = [];
    const list = (Array.isArray(assets) ? assets : []).map((asset) => {
      const link = current.links[text(asset?.id)];
      if (!link || !link.useEstimate || asset?.type !== "inmueble") return asset;
      const series = current.series.find((item) => item.id === link.seriesId) || null;
      const result = estimate({ declaredValue: asset.value, declaredDate: asset.asOf, series, todayQuarter });
      if (!result.estimated) return asset;
      applied.push({ assetId: text(asset.id), label: text(asset.label), declared: result.declaredValue, estimated: result.value, delta: result.delta, chip: result.chip });
      return { ...asset, value: result.value, provenance: "estimated" };
    });
    return { assets: list, applied };
  }

  /** LTV = deuda hipotecaria ÷ valor del inmueble, en %. Sin deuda conocida o sin valor positivo, no se calcula (null), nunca 0. */
  function ltvPct(debt, value) {
    return known(debt) && known(value) && number(value) > 0 && number(debt) >= 0 ? round2((number(debt) / number(value)) * 100) : null;
  }

  /** La frase de una estimación, en lenguaje del hogar. */
  function describe(result, { euros = (value) => `${value} €`, labelOf = quarterLabel } = {}) {
    switch (result?.status) {
      case "estimated": {
        const direction = result.changePct >= 0 ? "sube" : "baja";
        const lag = result.stale ? ` El último índice tecleado es de ${labelOf(result.latestQuarter)}, ${result.quartersBehind} trimestres atrás: la estimación envejece.` : "";
        return `Con el índice, el valor ${direction} un ${String(Math.abs(result.changePct)).replace(".", ",")} % desde ${labelOf(result.baseQuarter)}: de ${euros(result.declaredValue)} a ${euros(result.value)} (${labelOf(result.latestQuarter)}).${lag}`;
      }
      case "declared-current": return `El último índice tecleado (${labelOf(result.latestQuarter)}) no es posterior al de la declaración (${labelOf(result.baseQuarter)}): se queda el valor declarado.`;
      case "no-index-base": return `Falta el índice de ${labelOf(result.baseQuarter)}, el trimestre del último valor declarado: sin él no se puede revalorizar y se queda el valor declarado.`;
      case "no-date": return "El valor declarado no tiene fecha: sin ella no se sabe desde qué trimestre revalorizar. Se queda el valor declarado.";
      case "no-value": return "No hay un valor declarado que revalorizar.";
      case "no-series": return "Sin serie de índice elegida: se queda el valor declarado.";
      default: return "";
    }
  }

  return {
    SCHEMA_ID, MAX_SERIES, MAX_POINTS, STALE_QUARTERS,
    quarterOf, validQuarter, quarterLabel, quartersBetween, compareQuarters,
    normalizeStore, addSeries, removeSeries, setPoint, removePoint, setLink, estimate, effectiveAssets, ltvPct, describe,
  };
});
