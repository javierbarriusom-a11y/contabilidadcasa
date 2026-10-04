// Registrar › Saldo de cuentas: «Pulso de saldos» (WP-26 · ND-01, canonical-balance-pulse.js). Script clásico cargado
// antes de app.js (comparte su ámbito global: qs, state, render, money…), fuera de app.js por su techo de líneas
// (ARQ-4). La lógica vive en el motor puro; aquí solo se pinta, se responde a «Coincide»/«Corregir» y se mide el tiempo.
//
// «Saldos al día» y la fecha de hoy llegan cuando las dos cuentas tienen respuesta. Un «Corregir» es el mismo campo de
// siempre: guarda al salir y, como desde R-3, ya fecha hoy los saldos (es el dato más reciente que hay); por eso el pulso
// dice qué cuenta falta por confirmar en vez de dar los saldos por mirados. No se cambia esa fecha a mano hacia atrás:
// la previsión colocaría el saldo recién escrito en un día pasado.

const BALANCE_PULSE_TIMES_KEY = "balance-pulse-times"; // solo este móvil, como el panel de uso: segundos, ni importes
let balancePulse = { answers: {}, startedAt: 0, status: "" };

// Tiempos del pulso, en este navegador: el «Hecho cuando» de WP-26 (actualizar las cuentas en ≤ 20 s).
function readBalancePulseTimes() {
  try {
    return window.FinanceCanonicalBalancePulse.normalizeTimings(JSON.parse(window.localStorage.getItem(BALANCE_PULSE_TIMES_KEY) || "null"));
  } catch {
    return { times: [] };
  }
}

function writeBalancePulseTimes(store) {
  try {
    window.localStorage.setItem(BALANCE_PULSE_TIMES_KEY, JSON.stringify(store));
  } catch {
    /* sin almacenamiento: no se mide, la app sigue igual */
  }
}

window.FinanceBalancePulseUi = { summary: () => window.FinanceCanonicalBalancePulse?.summarizeTimings(readBalancePulseTimes()) || null };

function balancePulseModel() {
  return window.FinanceCanonicalBalancePulse.buildModel({ accounts: balancePulseAccounts(), answers: balancePulse.answers, mode: state?.balanceMode, today: isoLocalDate(new Date()) });
}

function renderBalancePulse() {
  const engine = window.FinanceCanonicalBalancePulse;
  const target = qs("pulsoSaldos");
  // Solo con la pestaña a la vista: render() pasa por aquí muchas veces y el extracto puede tener miles de filas.
  if (!engine || !target || !state || target.closest("[hidden]")) return;
  const model = balancePulseModel();
  // El reloj arranca la primera vez que se ve el pulso con algo por responder en esta visita a Saldos, y se para al salir.
  if (registrarActiveTab !== "balances") balancePulse.startedAt = 0;
  else if (!balancePulse.startedAt && model.mode === "manual" && !model.complete) balancePulse.startedAt = performance.now();
  // Con separador de miles («5.610,00 €»), como el campo de importe de WP-11; money() no lo pone en 4 cifras.
  const html = engine.renderHtml(model, { money: (value) => `${formatAmountField(value)} €`, status: balancePulse.status });
  if (target.innerHTML !== html) target.innerHTML = html;
}

// Con las dos respuestas: «Coincide» toma lo último que se sabía (puede ser el saldo del extracto), los saldos pasan a
// fecha de hoy y se puede deshacer durante 8 s, como pide ND-01.
function completeBalancePulse(model) {
  const engine = window.FinanceCanonicalBalancePulse;
  const before = { balances: accountBalancesFromState(), date: state.balanceDate };
  const next = engine.resultingBalances(model, { caixa: before.balances.caixa, mediolanum: before.balances.mediolanum });
  const seconds = balancePulse.startedAt ? (performance.now() - balancePulse.startedAt) / 1000 : 0;
  const counts = { coincided: model.items.filter((item) => item.answer === "coincide").length, corrected: model.items.filter((item) => item.answer === "corregido").length };
  // Más de 10 minutos no es actualizar los saldos: es dejar la pantalla abierta. No se mide.
  if (seconds > 0 && seconds <= 600) writeBalancePulseTimes(engine.recordTiming(readBalancePulseTimes(), { date: isoLocalDate(new Date()), seconds, ...counts }));
  setBalancePulseState(next, isoLocalDate(new Date()));
  const time = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  balancePulse = { answers: {}, startedAt: 0, status: `Saldos al día · hoy ${time}.` };
  renderBalancePulse();
  showUndoToast("Saldos al día.", () => {
    setBalancePulseState({ caixa: before.balances.caixa, mediolanum: before.balances.mediolanum }, before.date);
    balancePulse.status = "Deshecho: los saldos vuelven a como estaban.";
    renderBalancePulse();
  }, 8000);
}

function setBalancePulseState(balances, date) {
  state.balanceMode = "manual";
  state.balanceDate = date;
  ["balanceDate", "registrarBalanceDate", "visualBalanceDate"].forEach((id) => { if (qs(id)) qs(id).value = date; });
  setStateAccountBalances(balances);
  renderAccountBalancePanels();
  saveBalanceSettings();
  render();
}

function answerBalancePulse(accountId, answer) {
  balancePulse.answers = { ...balancePulse.answers, [accountId]: answer };
  balancePulse.status = "";
  const model = balancePulseModel();
  if (model.complete) completeBalancePulse(model);
  else renderBalancePulse();
}

function handleBalancePulseClick(event) {
  const coincide = event.target.closest("[data-pulso-coincide]");
  const corregir = event.target.closest("[data-pulso-corregir]");
  if (coincide) answerBalancePulse(coincide.dataset.pulsoCoincide, "coincide");
  else if (corregir) {
    const account = window.FinanceCanonicalBalancePulse.ACCOUNTS.find((item) => item.id === corregir.dataset.pulsoCorregir);
    const input = account && qs(account.inputId);
    if (input) {
      input.focus();
      input.select?.();
    }
  } else if (event.target.closest("[data-pulso-manual]")) {
    qs("registrarBalanceMode").value = "manual";
    qs("registrarBalanceMode").dispatchEvent(new Event("change", { bubbles: true }));
    renderBalancePulse();
  }
}

// Escribir un saldo y salir del campo es «Corregir» (aunque no se pulsara el botón). Un texto que no es un importe no
// se guarda (WP-11) y tampoco cuenta como respuesta.
function handleBalancePulseCorrection(event) {
  const account = window.FinanceCanonicalBalancePulse?.ACCOUNTS.find((item) => item.inputId === event.target.id);
  if (!account || parseAmountField(event.target.value) === null) return;
  answerBalancePulse(account.id, "corregido");
}
