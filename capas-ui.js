// WP-35 (PRV-02 + PRV-04, docs/WP35_DISENO.md): la tarjeta «Previsión en capas e ingresos con certeza» de Plan › Previsión. El cálculo vive en canonical-forecast-layers.js (puro); aquí se leen las partidas de un
// mes (previsto y lo que cuenta), se guarda lo que DECLARA el hogar (la capa de cada partida y la certeza de cada ingreso) en un almacén propio (`forecast-layers-data`, en la copia) y se pinta una barra
// apilada con patrón y su tabla. NO cambia ninguna cifra de la previsión ni de Hoy: solo lee. Sin red.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, money, storageGet, storageSet, storageKey, queueRemoteSave, announceStatus, isoLocalDate, cuadroMandosAllMonths, planMesCollect,
// actualAwareInfo, openMonthCutoffKey, isClosedMonthKey, registrarMesLongMonth…). Sin llamadas al DOM ni escuchas al cargarse: app.js llama a `renderCapasPrevision` al pintar Previsión, y esa función engancha su escucha una vez.

const CAPAS_STORE = "forecast-layers-data"; // en la copia (BACKUP_LOCAL_STORES): { layers: { clave: capa }, incomes: { clave: { level, probability } } }
let capasState = { monthKey: "", attached: false, focus: "" };

function capasEngine() {
  return globalThis.FinanceCanonicalForecastLayers;
}

function capasLoad() {
  let raw = {};
  try { raw = JSON.parse(storageGet(storageKey(CAPAS_STORE), "{}")); } catch { raw = {}; }
  return capasEngine().normalizeStore(raw);
}

function capasSave(store) {
  storageSet(storageKey(CAPAS_STORE), JSON.stringify(store));
  queueRemoteSave();
}

// Las partidas de un mes con su previsto y lo que cuenta (el real si lo hay). Una cancelada cuenta 0.
function capasItems(month) {
  const collected = planMesCollect(month);
  const items = [];
  ["income", "expense"].forEach((kind) => collected[kind].forEach((entry) => {
    const cancelled = actualAwareInfo(entry.row, month).status === "cancelled";
    items.push({ key: entry.key, kind, label: entry.label, section: entry.sectionName, planned: Number(entry.planned) || 0, used: cancelled ? 0 : Number(entry.usado) || 0, settled: Boolean(entry.hasActual) || cancelled });
  }));
  return items;
}

// Lo que de verdad se desvió lo PROBABLE en los meses ya cerrados: un número por mes (real − previsto de las partidas probables con real).
function capasGaps(store, beforeKey) {
  const engine = capasEngine();
  return cuadroMandosAllMonths().filter((month) => month.key < beforeKey).map((month) => {
    const probable = capasItems(month).filter((item) => item.kind === "expense" && item.settled && (store.layers[item.key] || engine.defaultLayer(item.section)) === "probable");
    return probable.length ? probable.reduce((sum, item) => sum + (item.used - item.planned), 0) : null;
  }).filter((gap) => gap !== null);
}

function capasMonthOptions(selected) {
  const open = openMonthCutoffKey();
  const months = cuadroMandosAllMonths();
  const index = Math.max(0, months.findIndex((month) => month.key >= open));
  return months.slice(Math.max(0, index - 6), index + 13).map((month) => `<option value="${escapeHtml(month.key)}"${month.key === selected ? " selected" : ""}>${escapeHtml(registrarMesLongMonth(month.key))}</option>`).join("");
}

function capasBarHtml(reading, ariaLabel) {
  const segments = reading.layers.filter((layer) => layer.amount > 0.005).map((layer) => `<span class="cp-seg cp-${layer.id}" style="flex-grow:${layer.amount}"></span>`).join("");
  return segments ? `<div class="cp-barra" role="img" aria-label="${escapeHtml(ariaLabel)}">${segments}</div>` : "";
}

function capasLegendHtml(engine, reading) {
  return `<ul class="cp-leyenda">${reading.layers.map((layer) => `<li><span class="cp-muestra cp-${layer.id}" aria-hidden="true"></span><span><strong>${escapeHtml(layer.label)}: ${escapeHtml(engine.euros(layer.amount))}</strong> · ${layer.items.length} ${layer.items.length === 1 ? "partida" : "partidas"}${layer.id === "probable" && reading.band.calculable ? ` · ± ${escapeHtml(engine.euros(reading.band.spread))} (${reading.band.months} meses cerrados)` : ""}<br><span class="cp-pista">${escapeHtml(layer.hint)}</span></span></li>`).join("")}</ul>`;
}

function capasLayerSelect(engine, item, layerId) {
  const options = engine.LAYERS.map((layer) => `<option value="${layer.id}"${layer.id === layerId ? " selected" : ""}>${escapeHtml(layer.label)}</option>`).join("");
  return `<label class="cp-campo"><span class="cp-nombre">${escapeHtml(item.label)}${item.declared ? "" : " <em>(sugerida)</em>"}</span><span class="cp-importe">${escapeHtml(money(item.amount, true))}</span><select data-capa-layer="${escapeHtml(item.key)}" aria-label="Capa de ${escapeHtml(item.label)}">${options}</select></label>`;
}

function capasIncomeRow(engine, item) {
  const levels = engine.LEVELS.map((level) => `<option value="${level.id}"${level.id === item.level ? " selected" : ""}>${escapeHtml(level.label)}</option>`).join("");
  const probability = item.level === "confirmado" ? "" : `<label class="cp-prob">Probabilidad <input type="number" inputmode="numeric" min="1" max="99" step="1" value="${item.probability}" data-capa-prob="${escapeHtml(item.key)}" aria-label="Probabilidad de ${escapeHtml(item.label)} en %"> %</label>`;
  return `<li class="cp-ingreso"><span class="cp-nombre">${escapeHtml(item.label)}</span><span class="cp-importe">${escapeHtml(money(item.amount, true))}</span><span class="cp-chip cp-nivel-${item.level}">${escapeHtml(engine.chipText(item))}</span><select data-capa-nivel="${escapeHtml(item.key)}" aria-label="Certeza de ${escapeHtml(item.label)}">${levels}</select>${probability}</li>`;
}

function capasBodyHtml(engine, reading, monthKey) {
  if (!reading.calculable) return `<p class="e19-kpi-note">${escapeHtml(reading.reason)}</p>`;
  const phrases = engine.sentences(reading);
  const incomeRows = reading.incomes.items.map((item) => capasIncomeRow(engine, item)).join("");
  const layerGroups = reading.layers.filter((layer) => layer.items.length).map((layer) => `<fieldset class="cp-grupo"><legend>${escapeHtml(layer.label)}</legend>${layer.items.map((item) => capasLayerSelect(engine, item, layer.id)).join("")}</fieldset>`).join("");
  const band = reading.band.calculable ? "" : `<p class="e19-kpi-note">Sin banda para lo probable: hacen falta ${reading.band.need} meses cerrados con real en esas partidas y hay ${reading.band.months}. No invento una incertidumbre.</p>`;
  const realNote = reading.withReal === 0 ? `<p class="e19-kpi-note">Ninguna de las ${reading.count} partidas de este mes tiene real anotado: todo lo que ves es <strong>lo previsto</strong>.</p>` : reading.withReal < reading.count ? `<p class="e19-kpi-note">${reading.withReal} de ${reading.count} partidas de este mes tienen real; el resto cuenta como previsto.</p>` : "";
  const suggested = reading.suggested ? `<p class="e19-kpi-note">${reading.suggested} de ${reading.expenseCount} partidas tienen la capa <strong>sugerida</strong> por su bloque (fijos y financiaciones: comprometido; el resto: probable). Cámbiala abajo donde no sea así.</p>` : "";
  return `<label class="cp-mes">Mes <select data-capa-mes aria-label="Mes de la lectura">${capasMonthOptions(monthKey)}</select></label>
    ${phrases.map((phrase) => `<p class="cp-frase">${escapeHtml(phrase)}</p>`).join("")}
    ${capasBarHtml(reading, phrases[0])}${capasLegendHtml(engine, reading)}${realNote}${band}${suggested}
    <details class="cp-detalle"><summary>Ingresos: certeza de cada uno</summary><p class="e19-kpi-note">Hoy todos cuentan como seguros. Si un ingreso puede no llegar (paga extra, variable, devolución de la Renta, el alquiler del local con su riesgo de vacío), decid cuánta probabilidad le dais: <strong>no cambia la previsión ni Hoy</strong>, solo lo que se lee aquí.</p><ul class="cp-lista">${incomeRows || "<li>Este mes no tiene ingresos con importe.</li>"}</ul></details>
    <details class="cp-detalle"><summary>Gastos: en qué capa está cada partida</summary>${layerGroups || "<p class=\"e19-kpi-note\">Este mes no tiene gastos con importe.</p>"}</details>`;
}

function capasMonthKeyShown() {
  const months = cuadroMandosAllMonths();
  if (capasState.monthKey && months.some((month) => month.key === capasState.monthKey)) return capasState.monthKey;
  const open = openMonthCutoffKey();
  return (months.find((month) => month.key >= open) || months[0] || {}).key || "";
}

// Pinta la tarjeta. Cerrada, no calcula nada.
function renderCapasPrevision(engine) {
  const card = qs("capasCard");
  const body = qs("capas");
  if (!card || !body || !engine) return;
  attachCapas(card, body);
  if (!card.open) { if (body.__cpHtml) { body.innerHTML = ""; body.__cpHtml = ""; } return; }
  try {
    const monthKey = capasMonthKeyShown();
    const month = cuadroMandosAllMonths().find((item) => item.key === monthKey);
    const store = capasLoad();
    const reading = month ? engine.buildReading({ monthKey, partidas: capasItems(month), store, gaps: capasGaps(store, monthKey) }) : { calculable: false, reason: "No hay meses en el plan." };
    const html = capasBodyHtml(engine, reading, monthKey);
    if (body.__cpHtml !== html) {
      // Repintar no puede cerrar las listas que se estaban usando: se recuerda cuáles estaban abiertas.
      const wasOpen = [...body.querySelectorAll("details.cp-detalle")].map((details) => details.open);
      body.innerHTML = html;
      body.__cpHtml = html;
      [...body.querySelectorAll("details.cp-detalle")].forEach((details, index) => { details.open = Boolean(wasOpen[index]); });
      if (capasState.focus) { [...body.querySelectorAll("select, input")].find((control) => capasControlKey(control) === capasState.focus)?.focus?.(); capasState.focus = ""; }
    }
  } catch (error) {
    console.error(`renderCapasPrevision: ${error.message}`);
    body.innerHTML = '<p class="e19-kpi-note">No se pudo calcular con los datos actuales.</p>';
    body.__cpHtml = "";
  }
}

function capasControlKey(control) {
  const d = control.dataset;
  if ("capaLayer" in d) return `layer|${d.capaLayer}`;
  if ("capaNivel" in d) return `nivel|${d.capaNivel}`;
  if ("capaProb" in d) return `prob|${d.capaProb}`;
  return "capaMes" in d ? "mes" : "";
}

// Los cambios de la tarjeta, por delegación. Cada uno se guarda al momento y vuelve a pintar manteniendo el foco.
function handleCapasChange(event) {
  const engine = capasEngine();
  const control = event.target.closest("[data-capa-mes], [data-capa-layer], [data-capa-nivel], [data-capa-prob]");
  if (!control) return;
  const d = control.dataset;
  capasState.focus = capasControlKey(control);
  if ("capaMes" in d) capasState.monthKey = control.value;
  else if ("capaLayer" in d) { capasSave(engine.setLayer(capasLoad(), d.capaLayer, control.value)); announceStatus("Capa guardada."); }
  else if ("capaNivel" in d) {
    const store = capasLoad();
    const fallback = engine.LEVELS.find((level) => level.id === control.value)?.defaultProbability;
    capasSave(engine.setIncome(store, d.capaNivel, control.value, store.incomes[d.capaNivel]?.probability ?? fallback));
    announceStatus(control.value === "confirmado" ? "Ingreso confirmado: cuenta como seguro, como siempre." : "Certeza del ingreso guardada.");
  } else if ("capaProb" in d) {
    const store = capasLoad();
    const level = store.incomes[d.capaProb]?.level || "probable";
    capasSave(engine.setIncome(store, d.capaProb, level, Number(control.value)));
    announceStatus("Probabilidad guardada.");
  }
  renderCapasPrevision(engine);
}

function attachCapas(card, body) {
  if (capasState.attached) return;
  capasState.attached = true;
  body.addEventListener("change", handleCapasChange);
  card.addEventListener("toggle", () => renderCapasPrevision(capasEngine()));
}
