(function attachCanonicalZeroBase(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalZeroBase = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalZeroBaseFactory() {
  "use strict";

  // WP-34 (PRV-08, docs/WP34_DISENO.md): la revisión base cero del plan. Una vez al año el hogar mira CADA partida con lo que de verdad pasó en los últimos 12 meses y decide:
  // mantener, ajustar a lo real o quitar. Este motor es la parte que piensa; no escribe nada.
  //   · buildModel: la cola de partidas ordenada por lo que pesan, con su evidencia (reales por mes, mediana, hueco frente a lo previsto) y lo que se PUEDE proponer;
  //   · decide / normalizeStore: la marca «revisada (fecha)» de cada partida, en un almacén propio (no toca el contrato de estado);
  //   · summaryText / progress: cuántas van.
  // Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj (la fecha de hoy entra como dato).
  //
  // Reglas de honestidad:
  //   · «ajustar a lo real» solo se propone con ≥ 3 meses con real en la ventana, con una cifra única (mediana, no media: un mes raro no manda) y solo si la partida tiene el MISMO importe
  //     todos los meses futuros: una partida que cambia de un mes a otro (un pago anual) no se aplana a un solo importe;
  //   · «¿sigue existiendo?» solo se pregunta con evidencia: la partida no tiene ningún real en ≥ 3 meses en los que el hogar SÍ anotó otras partidas;
  //   · una partida sin importe previsto y sin ningún real no entra en la cola (no hay nada que revisar); se cuenta aparte;
  //   · sin reales anotados no se inventa «lo real»: se puede mantener o quitar, y se dice por qué no hay propuesta;
  //   · una partida cuyo importe lo manda otra cosa (fórmula, contrato de deuda, tarjeta, asignación personal) solo se puede marcar como revisada: se dice quién la manda.

  const SCHEMA_ID = "finance-zero-base/v1";
  const WINDOW_MONTHS = 12;
  const MIN_REAL_MONTHS = 3;
  const MIN_GAP_PCT = 10;
  const MIN_GAP_EUR = 10;
  const MIN_COVERED_MONTHS = 3;
  const REVIEW_VALID_DAYS = 365;
  const MAX_REVIEWS = 400;
  const DECISIONS = Object.freeze(["mantener", "ajustar", "quitar"]);

  const text = (value) => String(value ?? "").trim();
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const num = (value, fallback = 0) => (known(value) ? Number(value) : fallback);
  const round2 = (value) => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const isMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(text(value));
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) && !Number.isNaN(Date.parse(`${text(value)}T12:00:00Z`));

  function daysBetween(fromIso, toIso) {
    return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86400000);
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // ---- La marca «revisada (fecha)» ----

  /** @param {any} raw */
  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" && raw.reviews && typeof raw.reviews === "object" ? raw.reviews : {};
    const reviews = {};
    Object.entries(source)
      .filter(([key, review]) => text(key) && review && DECISIONS.includes(review.decision) && isDate(review.reviewedAt))
      .sort(([, a], [, b]) => (a.reviewedAt < b.reviewedAt ? 1 : -1))
      .slice(0, MAX_REVIEWS)
      .forEach(([key, review]) => {
        reviews[key] = { decision: review.decision, reviewedAt: review.reviewedAt, from: known(review.from) ? round2(review.from) : null, to: known(review.to) ? round2(review.to) : null };
      });
    return { schemaId: SCHEMA_ID, reviews };
  }

  /**
   * Anota la decisión sobre una partida. `from`/`to` (importe mensual antes y después) solo para «ajustar».
   * @param {any} store @param {string} key @param {string} decision @param {{today: string, from?: number|null, to?: number|null}} meta
   */
  function decide(store, key, decision, meta) {
    const current = normalizeStore(store);
    if (!text(key) || !DECISIONS.includes(decision) || !isDate(meta && meta.today)) return current;
    return normalizeStore({ reviews: { ...current.reviews, [key]: { decision, reviewedAt: meta.today, from: decision === "ajustar" && known(meta.from) ? meta.from : null, to: decision === "ajustar" && known(meta.to) ? meta.to : null } } });
  }

  /** Quita la marca (para volver a revisarla). */
  function clear(store, key) {
    const current = normalizeStore(store);
    const { [key]: _removed, ...rest } = current.reviews;
    return { schemaId: SCHEMA_ID, reviews: rest };
  }

  /** «revisada» dentro de los últimos 365 días; «toca» pasado ese plazo; «pendiente» sin marca. */
  function reviewState(review, today) {
    if (!review) return "pendiente";
    return daysBetween(review.reviewedAt, today) <= REVIEW_VALID_DAYS ? "revisada" : "toca";
  }

  // ---- La evidencia de cada partida ----

  function evidenceOf(partida, windowKeys) {
    const real = [];
    windowKeys.forEach((monthKey) => {
      const value = partida.real ? partida.real[monthKey] : undefined;
      if (known(value)) real.push({ monthKey, value: round2(value) });
    });
    const values = real.map((item) => item.value);
    const mean = values.length ? round2(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    const mid = median(values);
    return { months: real, n: real.length, median: mid === null ? null : round2(mid), mean, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null };
  }

  // Los meses futuros de ESTA partida: si la partida solo existe en algunos (una partida de un solo mes), solo cuentan esos.
  function plannedShape(partida, globalFutureKeys) {
    const futureKeys = Array.isArray(partida.futureMonths) ? partida.futureMonths.filter(isMonth) : globalFutureKeys;
    const values = futureKeys.map((monthKey) => round2(partida.planned ? partida.planned[monthKey] : 0));
    const first = values.length ? values[0] : 0;
    return { values, now: first, flat: values.length > 0 && values.every((value) => value === first), annual: round2(values.slice(0, 12).reduce((sum, value) => sum + Math.abs(value), 0)) };
  }

  function suggestionOf(partida, evidence, shape, windowLen) {
    if (partida.locked) return { type: null, why: `Su importe lo manda otra cosa: ${text(partida.locked)}. Solo se puede marcar como revisada.` };
    if (evidence.n < MIN_REAL_MONTHS) return { type: null, why: evidence.n === 0 ? `Sin reales anotados en los últimos ${windowLen} meses: no hay «lo real» con lo que ajustar.` : `Solo ${evidence.n} ${evidence.n === 1 ? "mes" : "meses"} con real: hacen falta ${MIN_REAL_MONTHS} para proponer un importe.` };
    if (!shape.flat) return { type: null, why: "Su importe cambia de un mes a otro (¿un pago anual o estacional?): no se aplana a un solo importe. Edítala mes a mes en la tabla." };
    const amount = Math.round(evidence.median);
    const gap = amount - shape.now;
    const gapPct = Math.abs(shape.now) >= 0.005 ? Math.round((Math.abs(gap) / Math.abs(shape.now)) * 100) : null;
    if (Math.abs(gap) < MIN_GAP_EUR || (gapPct !== null && gapPct < MIN_GAP_PCT)) return { type: null, why: "Ya está en línea con lo real (menos de un 10 % o de 10 € de diferencia)." };
    return { type: "ajustar", amount, gap, gapPct };
  }

  function flagOf(partida, evidence, shape, coveredMonths) {
    if (partida.locked || shape.now <= 0 || evidence.n > 0 || coveredMonths < MIN_COVERED_MONTHS) return null;
    return { id: "sin-real", text: `No tiene ningún real en ${coveredMonths} meses en los que sí anotaste otras partidas: ¿sigue existiendo?` };
  }

  /**
   * La cola de la revisión.
   * @param {{partidas?: Array<{key: string, kind: "income"|"expense", label?: string, section?: string, locked?: string, planned?: Record<string, number>, real?: Record<string, number|null>, futureMonths?: string[]}>,
   *   store?: any, today?: string, windowMonths?: string[], futureMonths?: string[]}} input
   */
  function buildModel({ partidas = [], store = null, today = "", windowMonths = [], futureMonths = [] } = {}) {
    if (!isDate(today)) return { calculable: false, reason: "Falta la fecha de hoy." };
    const reviews = normalizeStore(store).reviews;
    const windowKeys = windowMonths.filter(isMonth).slice(-WINDOW_MONTHS);
    const futureKeys = futureMonths.filter(isMonth);
    const list = (Array.isArray(partidas) ? partidas : []).filter((item) => item && text(item.key) && (item.kind === "income" || item.kind === "expense"));
    // Meses «cubiertos»: aquellos en los que el hogar anotó al menos un real. Sin ellos no se sabe si una partida sin real es que no pasó o que no se anotó.
    const covered = windowKeys.filter((monthKey) => list.some((item) => item.real && known(item.real[monthKey])));
    const all = list.map((partida) => {
      const evidence = evidenceOf(partida, windowKeys);
      const shape = plannedShape(partida, futureKeys);
      const review = reviews[partida.key] || null;
      const coveredWithout = covered.filter((monthKey) => !(partida.real && known(partida.real[monthKey]))).length;
      return {
        key: partida.key, kind: partida.kind, label: text(partida.label) || "Sin nombre", section: text(partida.section), locked: text(partida.locked),
        plannedNow: shape.now, plannedFlat: shape.flat, annualPlanned: shape.annual, evidence,
        windowLen: windowKeys.length, suggestion: suggestionOf(partida, evidence, shape, windowKeys.length), flag: flagOf(partida, evidence, shape, coveredWithout),
        review, state: reviewState(review, today),
      };
    });
    // Una partida sin importe previsto en ningún mes por venir y sin ningún real no tiene nada que revisar: no entra en la cola (se cuenta aparte).
    const items = all.filter((item) => item.annualPlanned >= 0.005 || item.evidence.n > 0);
    const dormant = all.length - items.length;
    // Primero lo pendiente y lo que toca de nuevo, lo más pesado antes; las ya revisadas al final.
    const rank = { pendiente: 0, toca: 0, revisada: 1 };
    items.sort((a, b) => rank[a.state] - rank[b.state] || b.annualPlanned - a.annualPlanned || a.label.localeCompare(b.label, "es") || a.key.localeCompare(b.key));
    const reviewed = items.filter((item) => item.state === "revisada").length;
    return {
      calculable: true, today, windowMonths: windowKeys, coveredMonths: covered.length, items, dormant,
      progress: { total: items.length, reviewed, pending: items.length - reviewed, due: items.filter((item) => item.state === "toca").length },
      canSuggest: items.some((item) => item.suggestion.type === "ajustar"),
    };
  }

  function summaryText(model) {
    if (!model || !model.calculable) return "Revisión base cero del plan";
    const { total, reviewed } = model.progress;
    if (!total) return "Revisión base cero del plan: no hay partidas";
    return reviewed === total ? `Revisión base cero del plan: las ${total} partidas revisadas` : `Revisión base cero del plan: ${reviewed} de ${total} partidas revisadas`;
  }

  /** Una frase con la evidencia de una partida, para quien no quiere leer la tabla. */
  function evidenceText(item) {
    const { evidence } = item;
    if (!evidence.n) return `Sin reales anotados en los últimos ${item.windowLen} meses.`;
    const range = evidence.min === evidence.max ? "" : `, entre ${Math.round(evidence.min)} € y ${Math.round(evidence.max)} €`;
    return `${evidence.n} de los últimos ${item.windowLen} meses con real: mediana de ${Math.round(evidence.median)} € al mes${range}. Lo previsto hoy: ${Math.round(item.plannedNow)} € al mes.`;
  }

  return { SCHEMA_ID, WINDOW_MONTHS, MIN_REAL_MONTHS, MIN_GAP_PCT, MIN_GAP_EUR, MIN_COVERED_MONTHS, REVIEW_VALID_DAYS, MAX_REVIEWS, DECISIONS, median, normalizeStore, decide, clear, reviewState, buildModel, summaryText, evidenceText };
});
