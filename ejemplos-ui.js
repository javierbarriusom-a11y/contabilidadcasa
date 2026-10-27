// XUX-02 · PR-1 «Ver cada pantalla con datos de ejemplo» (ficha XUX-02 de docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md). Una tarjeta vacía
// que pide un alta (el plan B, la política de inversión) ofrece «Ver cómo quedaría»: una hoja con la tarjeta pintada por su propio código
// con un hogar INVENTADO, una banda «EJEMPLO» fija y, al pie, qué hace falta para verla con lo vuestro y cuánto se tarda (el registro de
// altas de canonical-data-contracts.js, XDA-01).
//
// Reglas:
//   · nunca se mezcla con cifras reales: cada ejemplo pasa sus propios datos a la vista (las vistas aceptan entradas desde XUX-02) y no lee
//     nada del hogar;
//   · dentro del ejemplo no se puede pulsar nada: se quitan botones, enlaces y campos, y los clics no salen de la hoja (las escuchas de las
//     tarjetas viven en el documento y editarían el plan de verdad);
//   · nace apagada en Funciones en prueba (XGO-03): sin encenderla, el estado vacío es el de siempre.
// El medidor (XGO-02) cuenta la vista al abrir un ejemplo y, como acción, «Empezar» (la métrica de la ficha: altas tras ver el ejemplo).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, planBViewHtml, politicaViewHtml…). Sin llamadas
// al DOM al cargarse: estados-ui.js pide el botón al pintar un estado vacío con `ejemplo`, y la primera vez se enganchan las escuchas.

const EJEMPLO_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function ejemploOn() {
  return globalThis.FinanceFuncionesEnPrueba?.encendida?.("ver-ejemplo") === true;
}

// Los seis meses que siguen al de hoy, para que el ejemplo hable de fechas creíbles (las cifras siguen siendo inventadas).
function ejemploMeses(count = 6) {
  const today = new Date();
  return Array.from({ length: count }, (_, at) => {
    const date = new Date(today.getFullYear(), today.getMonth() + 1 + at, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: `${EJEMPLO_MESES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}` };
  });
}

function ejemploPlanBHtml() {
  const engine = globalThis.FinanceCanonicalContingencyPlan;
  const meses = ejemploMeses();
  const flat = (value) => Object.fromEntries(meses.map((month) => [month.key, value]));
  const ctx = {
    series: meses.map((month, at) => ({ monthKey: month.key, label: month.label, liquidity: [5200, 4100, 2600, 2300, 2900, 3400][at] })),
    saving: flat(300), discretionary: flat(600), floor: 3000, floorBasis: "operating-reserve", creditLimit: 5000, creditRate: 9,
    liquidity: 5200, monthlyOutflow: 2400, fmt: (value) => money(value, true),
  };
  const draft = engine.normalizePlan({
    trigger: { mode: "amount", amount: 3000, consecutive: 2, horizon: 6 },
    actions: [{ kind: "pause-saving", months: 3, outside: true }, { kind: "cut-discretionary", pct: 20, months: 3 }, { kind: "credit-line", amount: 2000 }],
  });
  const plan = engine.sign(draft, { signers: ["Persona A", "Persona B"], today: isoLocalDate(new Date()) }).plan || draft;
  return planBViewHtml(plan, engine.evaluate({ plan, ...ctx }), ctx);
}

function ejemploPoliticaHtml() {
  const engine = globalThis.FinanceCanonicalInvestmentPolicy;
  const draft = engine.normalizePolicy({
    purpose: { text: "jubilación", horizonYears: 20 },
    allocation: { targets: { etf: 70, fondo: 20, accion: 10 }, bandPct: 5 },
    contribution: { mode: "fixed", monthly: 300 },
    exclusions: { noCrypto: true, noLeverage: true },
    drawdown: { at20: "keep-contributing", at35: "hold" },
    review: { everyMonths: 12 },
  });
  const today = isoLocalDate(new Date());
  const policy = engine.sign(draft, { signers: ["Persona A", "Persona B"], today }).policy || draft;
  return politicaViewHtml(policy, { portfolio: { totalsByType: { etf: 8100, fondo: 1500, accion: 400 }, totalValue: 10000, loanAmount: 0 }, today, reasonsHtml: "" });
}

const EJEMPLOS = {
  "plan-b": { html: ejemploPlanBHtml, empezar: "planb-empezar" },
  politica: { html: ejemploPoliticaHtml, empezar: "politica-empezar" },
};

/** El botón «Ver cómo quedaría» de un estado vacío; vacío si el ejemplo no existe o la función está apagada. */
function ejemploBotonHtml(id) {
  if (!EJEMPLOS[id] || !ejemploOn()) return "";
  ejemploBindOnce();
  return `<button type="button" class="e19-btn e19-btn-secondary" data-ejemplo-abrir="${escapeHtml(id)}">Ver cómo quedaría</button>`;
}

function ejemploAltaHtml(id) {
  const alta = globalThis.FinanceCanonicalDataContracts?.alta?.(id);
  if (!alta) return "";
  return `<div class="ej-alta"><p><strong>Para verlo con lo vuestro hace falta:</strong></p>
      <ul>${alta.datos.map((dato) => `<li>${escapeHtml(dato)}</li>`).join("")}</ul>
      <p class="e19-kpi-note">Unos ${alta.minutes} minutos, una sola vez (supuesto: aún no está medido).</p></div>`;
}

let ejemploOpener = null;

function ejemploAbrir(id, opener) {
  const dialog = qs("ejemploDialog");
  const ejemplo = EJEMPLOS[id];
  if (!dialog || !ejemplo) return;
  const alta = globalThis.FinanceCanonicalDataContracts?.alta?.(id);
  qs("ejemploContenido").innerHTML = `<h2 id="ejemploTitulo">Cómo quedaría: ${escapeHtml(alta?.label || "ejemplo")}</h2>
    <p class="ej-banda" role="note"><strong>EJEMPLO</strong> · cifras y nombres inventados, no son los vuestros</p>
    <div class="ej-cuerpo">${ejemplo.html()}</div>
    ${ejemploAltaHtml(id)}
    <div class="est-acciones"><button type="button" class="e19-btn e19-btn-primary" data-ejemplo-empezar="${escapeHtml(id)}">Empezar con lo vuestro</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-ejemplo-cerrar>Cerrar</button></div>`;
  // Nada que pulsar dentro del ejemplo: lo que hace algo en la tarjeta de verdad no puede hacerlo desde aquí.
  qs("ejemploContenido").querySelectorAll(".ej-cuerpo button, .ej-cuerpo a, .ej-cuerpo input, .ej-cuerpo select, .ej-cuerpo textarea").forEach((el) => el.remove());
  qs("ejemploContenido").querySelectorAll(".ej-cuerpo [id]").forEach((el) => el.removeAttribute("id")); // sin ids repetidos con la tarjeta
  ejemploOpener = opener || null;
  globalThis.FinanceMedidor?.anotar("ver-ejemplo", "vista"); // XGO-02
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  dialog.querySelector("[data-ejemplo-empezar]")?.focus();
}

function ejemploCerrar() {
  qs("ejemploDialog")?.close?.();
  ejemploOpener?.focus?.();
}

let ejemploBound = false;
function ejemploBindOnce() {
  if (ejemploBound || typeof document === "undefined") return;
  ejemploBound = true;
  document.addEventListener("click", (event) => {
    const abrir = event.target.closest?.("[data-ejemplo-abrir]");
    if (abrir) return ejemploAbrir(abrir.dataset.ejemploAbrir, abrir);
  });
  const dialog = qs("ejemploDialog");
  // Los clics dentro de la hoja no llegan al documento (allí escuchan las tarjetas de verdad); los botones de la hoja se atienden aquí.
  dialog?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target === dialog || event.target.closest("[data-ejemplo-cerrar], #ejemploCerrar")) return ejemploCerrar();
    const empezar = event.target.closest("[data-ejemplo-empezar]");
    if (!empezar) return;
    const id = empezar.dataset.ejemploEmpezar;
    globalThis.FinanceMedidor?.anotar("ver-ejemplo", "accion"); // la métrica de la ficha: un alta empezada tras ver el ejemplo
    dialog.close();
    document.querySelector(`[data-estado-accion="${EJEMPLOS[id]?.empezar}"]`)?.click();
  });
}
