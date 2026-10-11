// WP-50 (CAR-04, docs/WP50_DISENO.md): la tarjeta «Vivienda y local por índice» de Inversión › Cartera, sobre el patrimonio neto. El cálculo vive en canonical-index-valuation.js (puro); aquí se guardan las
// series de índice que teclea el hogar (almacén `housing-index-data`, en la copia), se enseña la estimación de cada inmueble con su chip «estimado por índice · T2 2026» y el LTV con el valor declarado y
// con el estimado, y se ofrece un interruptor POR INMUEBLE (apagado por defecto) para que la estimación sustituya al valor declarado en el patrimonio. NO se conecta a ninguna fuente (la conexión externa
// exige la revisión de WP-05) y NO modifica el valor declarado de ningún activo: la estimación se aplica al LEER (`assetsEffectiveList`), nunca al guardar.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, storageSet, storageKey, queueRemoteSave, announceStatus, showUndoToast, estadoHtml, isoLocalDate,
// formatIsoDate, parseAmountField, assetsList, canonicalDebtContractRows, refreshAllSectionsAfterDataChange…). Sin llamadas al DOM ni escuchas al cargarse: views/inversion.js llama a `renderIndiceVivienda`
// al pintar Inversión › Cartera; app.js, patrimonio-ui.js y la exposición a vivienda leen los activos con `assetsEffectiveList`.

const INDICE_VIVIENDA_STORE = "housing-index-data"; // en la copia (BACKUP_LOCAL_STORES): { series: [...], links: {...} }

function indiceViviendaEngine() {
  return globalThis.FinanceCanonicalIndexValuation;
}

function indiceViviendaLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(INDICE_VIVIENDA_STORE), "{}")) || {}; } catch { saved = {}; }
  return indiceViviendaEngine().normalizeStore(saved);
}

function indiceViviendaSave(store) {
  storageSet(storageKey(INDICE_VIVIENDA_STORE), JSON.stringify(store));
  queueRemoteSave();
}

function indiceViviendaEuros(value) {
  return money(value, true);
}

function indiceViviendaToday() {
  return isoLocalDate(new Date());
}

// Los activos tal como los leen el patrimonio y el LTV: los inmuebles con la estimación activada y calculable llevan el valor estimado. Es una copia: lo declarado no cambia. Sin motor o ante cualquier fallo, los declarados.
function assetsEffectiveList() {
  try {
    const engine = indiceViviendaEngine();
    if (!engine) return assetsList();
    return engine.effectiveAssets(assetsList(), indiceViviendaLoad(), engine.quarterOf(indiceViviendaToday())).assets;
  } catch {
    return assetsList();
  }
}

// Lo que la estimación cambia ahora mismo en el patrimonio (para decirlo donde se lee el patrimonio).
function indiceViviendaApplied() {
  try {
    const engine = indiceViviendaEngine();
    return engine ? engine.effectiveAssets(assetsList(), indiceViviendaLoad(), engine.quarterOf(indiceViviendaToday())).applied : [];
  } catch {
    return [];
  }
}

// La hipoteca pendiente: los contratos de Deuda cuyo tipo o entidad dice «hipoteca». No sé qué hipoteca es de qué inmueble: se compara el total con el total.
function indiceViviendaMortgage() {
  try {
    const rows = canonicalDebtContractRows().filter((row) => /hipotec/i.test(`${row.type || ""} ${row.entity || ""}`));
    const known = rows.filter((row) => Number.isFinite(Number(row.currentPrincipal)));
    return rows.length ? { count: rows.length, total: known.reduce((sum, row) => sum + Number(row.currentPrincipal), 0), complete: known.length === rows.length } : null;
  } catch {
    return null;
  }
}

function indiceViviendaDate(iso) {
  return iso ? (typeof formatIsoDate === "function" ? formatIsoDate(iso) : iso) : "sin fecha";
}

function indiceViviendaHomeHtml(engine, home, store, todayQuarter) {
  const link = store.links[home.id] || { seriesId: "", useEstimate: false };
  const series = store.series.find((item) => item.id === link.seriesId) || null;
  const result = engine.estimate({ declaredValue: home.value, declaredDate: home.asOf, series, todayQuarter });
  const options = [`<option value="">Ninguno (se queda el valor declarado)</option>`, ...store.series.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === link.seriesId ? " selected" : ""}>${escapeHtml(item.label)}</option>`)].join("");
  const chip = result.estimated
    ? `<p class="ivi-estimado"><span class="ivi-chip">${escapeHtml(result.chip)}</span> <strong>${indiceViviendaEuros(result.value)}</strong> <span class="ivi-delta">(${result.delta >= 0 ? "+" : "−"}${indiceViviendaEuros(Math.abs(result.delta))} frente a lo declarado)</span></p>`
    : "";
  const sentence = series ? engine.describe(result, { euros: indiceViviendaEuros }) : "";
  const using = link.useEstimate && result.estimated;
  const idle = link.useEstimate && !result.estimated ? `<p class="e19-kpi-note">Activada, pero ahora no se puede calcular: el patrimonio usa el valor declarado.</p>` : "";
  const provenance = home.provenance === "declared" ? "declarado" : home.provenance === "estimated" ? "estimado" : "sin procedencia";
  return `<li class="ivi-inmueble${using ? " ivi-usa" : ""}" data-ivi-asset="${escapeHtml(home.id)}">
      <h4 class="ivi-nombre">${escapeHtml(home.label)}</h4>
      <p class="ivi-declarado">Declarado: <strong>${home.value === null || home.value === undefined || home.value === "" ? "sin valor" : indiceViviendaEuros(Number(home.value))}</strong> · ${escapeHtml(indiceViviendaDate(home.asOf))} · ${provenance}</p>
      <label class="month-picker ivi-serie-pick"><span>Índice a usar</span><select data-ivi-link="${escapeHtml(home.id)}">${options}</select></label>
      ${chip}${sentence ? `<p class="e19-kpi-note ivi-frase">${escapeHtml(sentence)}</p>` : ""}
      <label class="ivi-usar"><input type="checkbox" data-ivi-use="${escapeHtml(home.id)}"${link.useEstimate ? " checked" : ""}${series ? "" : " disabled"} /> <span>Usar la estimación en el patrimonio y en el LTV${using ? " (activada)" : ""}</span></label>${idle}
    </li>`;
}

function indiceViviendaSeriesHtml(engine, serie, todayQuarter) {
  const [year, quarter] = [Number(todayQuarter.slice(0, 4)), Number(todayQuarter.slice(6, 7))];
  const points = serie.points.length
    ? `<ul class="ivi-puntos">${[...serie.points].reverse().map((point) => `<li><span>${escapeHtml(engine.quarterLabel(point.quarter))}: <strong>${String(point.value).replace(".", ",")}</strong></span> <button type="button" class="ivi-boton" data-ivi-remove-point="${escapeHtml(serie.id)}" data-ivi-quarter="${escapeHtml(point.quarter)}" aria-label="Quitar el índice de ${escapeHtml(engine.quarterLabel(point.quarter))} de ${escapeHtml(serie.label)}">Quitar</button></li>`).join("")}</ul>`
    : `<p class="e19-kpi-note">Sin ningún índice tecleado todavía.</p>`;
  const quarters = [1, 2, 3, 4].map((n) => `<option value="T${n}"${n === quarter ? " selected" : ""}>T${n}</option>`).join("");
  return `<section class="ivi-serie" data-ivi-series="${escapeHtml(serie.id)}" aria-label="${escapeHtml(serie.label)}">
      <div class="ivi-serie-cab"><h4 class="ivi-nombre">${escapeHtml(serie.label)}</h4><button type="button" class="ivi-boton" data-ivi-remove-series="${escapeHtml(serie.id)}" aria-label="Quitar la serie ${escapeHtml(serie.label)}">Quitar serie</button></div>
      ${points}
      <form class="ivi-form" data-ivi-point-form="${escapeHtml(serie.id)}" novalidate>
        <label><span>Trimestre</span><select name="t">${quarters}</select></label>
        <label><span>Año</span><input name="y" type="number" inputmode="numeric" min="2000" max="2100" value="${year}" /></label>
        <label><span>Valor del índice</span><input name="v" type="text" inputmode="decimal" placeholder="Ej.: 187,4" autocomplete="off" /></label>
        <button type="submit" class="e19-btn e19-btn-secondary ivi-guardar">Guardar índice</button>
        <p class="ivi-error" role="alert" data-ivi-error></p>
      </form>
    </section>`;
}

function indiceViviendaLtvHtml(engine, homes, store, todayQuarter) {
  const mortgage = indiceViviendaMortgage();
  if (!homes.length) return "";
  if (!mortgage) return `<p class="e19-kpi-note">No hay ninguna hipoteca en Deuda › Contratos (un contrato cuyo tipo o entidad diga «hipoteca»): no calculo el LTV.</p>`;
  const declared = homes.reduce((sum, home) => sum + (Number(home.value) || 0), 0);
  let anyEstimated = false;
  const estimatedTotal = homes.reduce((sum, home) => {
    const link = store.links[home.id];
    const result = engine.estimate({ declaredValue: home.value, declaredDate: home.asOf, series: store.series.find((item) => item.id === link?.seriesId) || null, todayQuarter });
    if (result.estimated) anyEstimated = true;
    return sum + (Number(result.value) || 0);
  }, 0);
  const ltvDeclared = engine.ltvPct(mortgage.total, declared);
  const ltvEstimated = engine.ltvPct(mortgage.total, estimatedTotal);
  const pct = (value) => (value === null ? "no calculable" : `${String(value).replace(".", ",")} %`);
  const partial = mortgage.complete ? "" : ` Algún contrato de hipoteca no tiene saldo pendiente declarado: el LTV queda corto.`;
  return `<p class="ivi-ltv"><strong>LTV</strong> (hipoteca pendiente ${indiceViviendaEuros(mortgage.total)} ÷ valor de los inmuebles): <strong>${pct(ltvDeclared)}</strong> con el valor declarado${anyEstimated ? ` y <strong>${pct(ltvEstimated)}</strong> con el estimado por índice` : ""}.</p>
    <p class="e19-kpi-note">La hipoteca sale de Deuda › Contratos (${mortgage.count} contrato${mortgage.count === 1 ? "" : "s"} con «hipoteca» en su tipo o entidad) y se compara con la suma de los inmuebles: no sé qué hipoteca es de qué inmueble.${anyEstimated ? " Con el estimado, el inmueble que no se puede revalorizar cuenta con su valor declarado." : ""}${partial} El LTV que un banco usa parte de SU tasación, no de este índice.</p>`;
}

function indiceViviendaBodyHtml(engine) {
  const store = indiceViviendaLoad();
  const todayQuarter = engine.quarterOf(indiceViviendaToday());
  const homes = assetsList().filter((asset) => asset.type === "inmueble");
  const intro = `<p class="e19-kpi-note ivi-fuente">Los valores del índice los <strong>tecleáis vosotros</strong>: la app no se conecta a ninguna fuente. Una opción es el <strong>Índice de Precios de Vivienda (IPV) del INE, por comunidad autónoma</strong> (<em>a verificar en la web del INE</em>): copiad el valor del trimestre de vuestro último valor declarado y el del último trimestre publicado.</p>`;
  const list = homes.length
    ? `<ul class="ivi-lista">${homes.map((home) => indiceViviendaHomeHtml(engine, home, store, todayQuarter)).join("")}</ul>`
    : estadoHtml({ kind: "vacio", titulo: "No hay ninguna vivienda ni local registrado", texto: "Regístralos como activos de tipo «inmueble», con su valor y la fecha de ese valor, en Ajustes › Patrimonio. Después elige aquí el índice con el que revalorizarlos." });
  const series = store.series.map((serie) => indiceViviendaSeriesHtml(engine, serie, todayQuarter)).join("");
  const addSeries = `<form class="ivi-form ivi-alta" data-ivi-add-series novalidate>
      <label><span>Nueva serie de índice</span><input name="label" type="text" maxlength="60" placeholder="Ej.: IPV vivienda · Cataluña" autocomplete="off" /></label>
      <button type="submit" class="e19-btn e19-btn-secondary ivi-guardar"${store.series.length >= engine.MAX_SERIES ? " disabled" : ""}>Añadir serie</button>
      <p class="ivi-error" role="alert" data-ivi-error></p>
    </form>`;
  return `${intro}<h4 class="ivi-subtitulo">Inmuebles</h4>${list}${indiceViviendaLtvHtml(engine, homes, store, todayQuarter)}
    <h4 class="ivi-subtitulo">Series de índice</h4>${series}${addSeries}
    <ul class="ivi-notas"><li>Un índice agregado <strong>no es una tasación</strong>: la cifra sale siempre como «estimado», y el valor declarado no se toca.</li><li>No se interpola ni se extrapola: sin el índice del trimestre de la última declaración, o sin ningún trimestre posterior, se queda el valor declarado.</li><li>Al <strong>firmar un cierre</strong>, la foto del patrimonio guarda el valor que estuviera activo en ese momento (declarado o estimado).</li></ul>`;
}

function renderIndiceVivienda(engine) {
  const box = qs("indiceViviendaCuerpo");
  if (!box || !engine) return;
  attachIndiceVivienda(document); // idempotente: un cambio temprano no puede perderse
  try {
    const html = indiceViviendaBodyHtml(engine);
    if (box.__indiceViviendaHtml !== html) {
      box.innerHTML = html;
      box.__indiceViviendaHtml = html;
    }
  } catch {
    box.textContent = "No se pudo pintar la revalorización por índice con los datos actuales.";
  }
}

function indiceViviendaCommit(next, message) {
  indiceViviendaSave(next);
  announceStatus(message);
  refreshAllSectionsAfterDataChange(); // el patrimonio, el LTV y la exposición a vivienda leen el valor efectivo
  renderIndiceVivienda(indiceViviendaEngine());
}

function indiceViviendaShowError(form, message) {
  const el = form?.querySelector?.("[data-ivi-error]");
  if (el) el.textContent = message || "";
  if (message) announceStatus(message);
}

// Una sola vez, por delegación.
function attachIndiceVivienda(doc) {
  if (!doc || doc.__indiceViviendaAttached) return false;
  doc.__indiceViviendaAttached = true;
  doc.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form?.matches?.("[data-ivi-point-form],[data-ivi-add-series]")) return;
    event.preventDefault();
    const engine = indiceViviendaEngine();
    const store = indiceViviendaLoad();
    if (form.matches("[data-ivi-add-series]")) {
      const result = engine.addSeries(store, form.elements.label.value);
      if (!result.ok) return indiceViviendaShowError(form, result.reason);
      return indiceViviendaCommit(result.store, "Serie añadida.");
    }
    const seriesId = form.getAttribute("data-ivi-point-form");
    const value = parseAmountField(form.elements.v.value);
    const year = Number(form.elements.y.value);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return indiceViviendaShowError(form, "El año no es válido.");
    const result = engine.setPoint(store, seriesId, `${year}-${form.elements.t.value}`, value === null ? "" : value);
    if (!result.ok) return indiceViviendaShowError(form, result.reason === "El índice tiene que ser un número mayor que cero." ? `${result.reason} Escríbelo como en España: «187,4».` : result.reason);
    indiceViviendaCommit(result.store, "Índice guardado.");
  });
  doc.addEventListener("change", (event) => {
    const target = event.target;
    const engine = indiceViviendaEngine();
    if (target?.matches?.("[data-ivi-link]")) {
      const id = target.getAttribute("data-ivi-link");
      const store = indiceViviendaLoad();
      const keep = store.links[id]?.useEstimate === true && target.value !== "";
      indiceViviendaCommit(engine.setLink(store, id, { seriesId: target.value, useEstimate: keep }), target.value ? "Índice elegido." : "Sin índice: se queda el valor declarado.");
    } else if (target?.matches?.("[data-ivi-use]")) {
      const id = target.getAttribute("data-ivi-use");
      const store = indiceViviendaLoad();
      const link = store.links[id];
      if (!link) return;
      indiceViviendaCommit(engine.setLink(store, id, { seriesId: link.seriesId, useEstimate: target.checked }), target.checked ? "Estimación activada en el patrimonio." : "Estimación desactivada: vuelve el valor declarado.");
    }
  });
  doc.addEventListener("click", (event) => {
    const point = event.target?.closest?.("[data-ivi-remove-point]");
    const serie = event.target?.closest?.("[data-ivi-remove-series]");
    if (!point && !serie) return;
    const engine = indiceViviendaEngine();
    const before = indiceViviendaLoad();
    const undo = (message) => showUndoToast(message, () => { indiceViviendaCommit(before, "Cambio deshecho."); });
    if (point) {
      const quarter = point.getAttribute("data-ivi-quarter");
      indiceViviendaCommit(engine.removePoint(before, point.getAttribute("data-ivi-remove-point"), quarter), "Índice quitado.");
      undo(`Índice de ${engine.quarterLabel(quarter)} quitado.`);
    } else {
      const id = serie.getAttribute("data-ivi-remove-series");
      const label = before.series.find((item) => item.id === id)?.label || "la serie";
      indiceViviendaCommit(engine.removeSeries(before, id), "Serie quitada.");
      undo(`Serie «${label}» quitada.`);
    }
  });
  return true;
}
