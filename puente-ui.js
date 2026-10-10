// WP-43 (PRV-01, docs/WP43_DISENO.md): la tarjeta «Puente de previsión» de Plan › Previsión. El cálculo vive en canonical-forecast-bridge.js (puro); aquí se congela, en cada
// cierre firmado, la previsión de liquidez a 31/12 (almacén `forecast-bridge-snapshots`, en la copia) y se pinta la cascada entre dos cierres con las barras de A-4
// (`analisisCascadaHtml`) y una tabla equivalente. NO modifica la previsión (A11-4): solo la explica. Tampoco va a Hoy (congelado hasta H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, money, storageGet, storageSet, storageKey, queueRemoteSave, announceStatus, estadoHtml,
// analisisCascadaHtml, analisisBlockSums, cuadroMandosAllMonths, dateFromMonthKey, canonicalScenarioResults…). Sin llamadas al DOM ni escuchas al cargarse: app.js llama a
// `recordPuenteSnapshot` al firmar un cierre y a `renderPuentePrevision` al pintar Plan › Previsión.

const PUENTE_STORE = "forecast-bridge-snapshots"; // en la copia (BACKUP_LOCAL_STORES)
let puenteCompareKey = ""; // el cierre contra el que se compara (vale solo en esta sesión)
let puenteCompareFor = ""; // el último cierre al que corresponde esa elección: si llega uno nuevo, se vuelve a comparar con el inmediatamente anterior

function puenteEngine() {
  return globalThis.FinanceCanonicalForecastBridge;
}

function puenteLoad() {
  let saved = [];
  try { saved = JSON.parse(storageGet(storageKey(PUENTE_STORE), "[]")); } catch { saved = []; }
  return puenteEngine().normalizeStore(saved);
}

function puenteSave(list) {
  storageSet(storageKey(PUENTE_STORE), JSON.stringify(list));
  queueRemoteSave();
}

function puenteEuros(value) {
  return money(value, true);
}

function puenteMonthName(key) {
  const date = typeof dateFromMonthKey === "function" ? dateFromMonthKey(key) : null;
  return date ? date.toLocaleDateString("es-ES", { month: "long" }) : String(key || "");
}

// Lo REAL del mes que se cierra, por bloque del plan (real si existe, previsto si no: el mismo criterio que «Usado» en Plan · Mes). `partial` si algún bloque tiene partidas sin real.
function puenteActuals(monthKey) {
  try {
    const month = cuadroMandosAllMonths().find((item) => item.key === monthKey);
    if (!month) return null;
    const blocks = analisisBlockSums([month]);
    const pick = (...names) => {
      const found = names.map((name) => blocks.get(name)).filter(Boolean);
      return found.length ? { sum: found.reduce((total, block) => total + block.sum, 0), hasActual: found.reduce((total, block) => total + block.hasActual, 0), total: found.reduce((total, block) => total + block.total, 0) } : null;
    };
    const income = pick("Ingresos");
    const recurring = pick("Gastos fijos", "Gastos variables");
    const debt = pick("Financiaciones");
    const used = [income, recurring, debt].filter(Boolean);
    return {
      income: income && income.hasActual > 0 ? income.sum : null,
      recurring: recurring && recurring.hasActual > 0 ? recurring.sum : null,
      debt: debt && debt.hasActual > 0 ? debt.sum : null,
      partial: used.some((block) => block.hasActual < block.total),
    };
  } catch {
    return null;
  }
}

// Al firmar un cierre: congela la previsión a 31/12 con lo que ya hay. Si algo falta, no congela y no rompe el cierre.
function recordPuenteSnapshot(monthKey, closedAt) {
  try {
    const engine = puenteEngine();
    const series = canonicalScenarioResults?.base?.forecast?.series;
    if (!engine || !Array.isArray(series)) return false;
    const frozen = engine.freezeYearEnd({ monthKey, closedAt, series, actuals: puenteActuals(monthKey) });
    if (!frozen.calculable) return false;
    puenteSave(engine.upsert(puenteLoad(), frozen.snapshot));
    return true;
  } catch {
    return false;
  }
}

function puenteBodyHtml(engine) {
  const store = puenteLoad();
  if (!store.length) {
    return estadoHtml({ kind: "vacio", titulo: "Todavía no hay ninguna previsión congelada", texto: "Al firmar el cierre del mes, la app guarda cuánto preveía para el 31/12. Con dos cierres verás, en barras, por qué cambia el fin de año." });
  }
  const latest = store[0];
  const earlier = store.filter((item) => item.monthKey < latest.monthKey && item.targetYear === latest.targetYear);
  const frozenLine = `<p class="e19-kpi-note">Al cerrar ${escapeHtml(puenteMonthName(latest.monthKey))} preveíais acabar ${latest.targetYear} con <strong>${puenteEuros(latest.yearEndLiquidity)}</strong> de liquidez.</p>`;
  if (!earlier.length) {
    return `${frozenLine}${estadoHtml({ kind: "vacio", titulo: "Falta un segundo cierre", texto: `El puente necesita dos cierres de un mismo año. Con el del mes que viene verás por qué cambia el fin de ${latest.targetYear}.` })}`;
  }
  if (puenteCompareFor !== latest.monthKey || !earlier.some((item) => item.monthKey === puenteCompareKey)) { puenteCompareKey = earlier[0].monthKey; puenteCompareFor = latest.monthKey; }
  const previous = earlier.find((item) => item.monthKey === puenteCompareKey) || earlier[0];
  const result = engine.bridge(previous, latest);
  const options = earlier.map((item) => `<option value="${escapeHtml(item.monthKey)}"${item.monthKey === previous.monthKey ? " selected" : ""}>${escapeHtml(puenteMonthName(item.monthKey))}</option>`).join("");
  const select = earlier.length > 1
    ? `<label class="month-picker pte-comparar"><span>Comparar con el cierre de</span><select id="puenteComparar">${options}</select></label>`
    : "";
  if (!result.calculable) return `${frozenLine}${select}<p class="e19-kpi-note">${escapeHtml(result.reason)}</p>`;
  const sentence = engine.describe(result, { labelOf: puenteMonthName, euros: puenteEuros });
  const relevance = result.relevant
    ? `<p class="pte-aviso" role="note"><strong>Cambio relevante:</strong> mueve ${String(result.relativePct).replace(".", ",")} % de lo que se preveía.</p>`
    : `<p class="e19-kpi-note">Cambio pequeño: ${result.relativePct === null ? "sin base para compararlo" : `${String(result.relativePct).replace(".", ",")} % de lo que se preveía`}.</p>`;
  const cascade = analisisCascadaHtml({
    rows: result.rows.map((row) => ({ label: row.label, value: row.value, tone: row.tone })),
    resultado: result.delta,
  });
  const table = `<details class="pte-tabla"><summary>Ver como tabla</summary><div class="table-wrap"><table class="e19-table"><thead><tr><th>Causa</th><th>Efecto en el fin de año</th></tr></thead><tbody>${
    result.rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${row.value > 0 ? "+" : row.value < 0 ? "−" : ""}${puenteEuros(Math.abs(row.value))}</td></tr>`).join("")
  }<tr><td><strong>Total</strong></td><td><strong>${result.delta > 0 ? "+" : result.delta < 0 ? "−" : ""}${puenteEuros(Math.abs(result.delta))}</strong></td></tr></tbody></table></div></details>`;
  const notes = `<ul class="pte-notas">${result.notes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  return `${select}<p class="pte-frase"><strong>${escapeHtml(sentence)}</strong></p>${relevance}
    <div class="pte-cascada" role="group" aria-label="Qué mueve el fin de año, por causa">${cascade}</div>${table}${notes}`;
}

function renderPuentePrevision(engine) {
  const box = qs("puenteCuerpo");
  if (!box || !engine) return;
  attachPuente(document); // idempotente: un cambio temprano no puede perderse
  try {
    const html = puenteBodyHtml(engine);
    if (box.__puenteHtml !== html) {
      box.innerHTML = html;
      box.__puenteHtml = html;
    }
  } catch {
    box.textContent = "No se pudo pintar el puente con los datos actuales.";
  }
}

// Una sola vez, por delegación.
function attachPuente(doc) {
  if (!doc || doc.__puenteAttached) return false;
  doc.__puenteAttached = true;
  doc.addEventListener("change", (event) => {
    if (event.target?.id !== "puenteComparar") return;
    puenteCompareKey = event.target.value;
    renderPuentePrevision(puenteEngine());
    announceStatus("Puente recalculado.");
  });
  return true;
}
