// SVD-1 (17/11/2026): el puente entre la app y el simulador visual de deuda (debt-roadmap.html, en el iframe de
// Deuda › Simulador visual), sacado de app.js tal cual, sin cambiar una coma, para que el bloque SVD (docs/SVD_DISENO.md)
// crezca aquí y no en app.js (ARQ-4). Solo funciones: el estado (`debtRoadmapState`) sigue declarado en app.js. Se carga con
// defer antes que app.js; las llamadas (`setupDebtRoadmapBridge`, `sendDebtRoadmapState`) siguen saliendo de app.js y de
// views/deuda.js, después de que todo esté cargado.

function debtRoadmapCanonicalReadModel() {
  return E14DebtAdapter?.buildReadModel({
    roadmapState: debtRoadmapState,
    contracts: canonicalDebtContractRows(),
    forecast: canonicalScenarioResults.active?.forecast,
    // SVD-2 (17/11/2026): el suelo del hogar (la reserva operativa de la cuenta), para que el simulador avise si su
    // colchón queda por debajo.
    floor: typeof agentCaixaFloor === "function" ? agentCaixaFloor() : null,
    // SVD-2b (17/11/2026): el motor de «Camino a deuda cero», para que la cuota de hoy y su comparación con Ruta salgan
    // con la misma cuenta que Deuda › Ruta.
    payoffPath: window.FinanceCanonicalDebtPayoffPath || null,
    startMonthKey: typeof isoLocalDate === "function" ? isoLocalDate(new Date()).slice(0, 7) : undefined,
  }) || null;
}

function sendDebtRoadmapState() {
  const frame = qs("debtRoadmapFrame");
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage({
    type: "finance-debt-roadmap-hydrate",
    payload: { state: debtRoadmapState, canonical: debtRoadmapCanonicalReadModel() },
  }, window.location.origin);
}

// D1 (Fase 3): puente sandbox → plan real, versión segura confirmada por el hogar — solo crea o
// actualiza una oferta borrador (E14b); lógica pura en canonical-e14-debt-adapter.js por ARQ-4.
function receiveDebtRoadmapOffer(payload) {
  const frame = qs("debtRoadmapFrame");
  const ack = (accountKey, ok, message) => frame?.contentWindow?.postMessage({ type: "finance-debt-roadmap-offer-result", accountKey, ok, message }, window.location.origin);
  if (!E14DebtOperations || !E14DebtAdapter?.buildDraftOffer) return;
  const workspace = e14bWorkspace();
  const result = E14DebtAdapter.buildDraftOffer({
    accountKey: payload?.accountKey, account: payload?.account, canonical: debtRoadmapCanonicalReadModel(),
    existingOffers: workspace.offers, normalizeOffer: E14DebtOperations.normalizeOffer,
  });
  if (!result.ok) return ack(result.accountKey, false, result.message);
  if (result.replaceIndex >= 0) workspace.offers[result.replaceIndex] = result.offer;
  else workspace.offers.push(result.offer);
  workspace.selectedOfferId = result.offer.id;
  queueRemoteSave(); renderE14bPanel();
  ack(result.accountKey, true, result.message);
}

function debtRoadmapStatesMatch(left, right) {
  const stringify = window.FinanceStateContract?.stableStringify;
  try {
    return stringify ? stringify(left || {}) === stringify(right || {}) : JSON.stringify(left || {}) === JSON.stringify(right || {});
  } catch {
    return false;
  }
}

function setupDebtRoadmapBridge() {
  const frame = qs("debtRoadmapFrame");
  if (!frame) return;
  frame.addEventListener("load", sendDebtRoadmapState);
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === "finance-debt-roadmap-ready") {
      sendDebtRoadmapState();
      return;
    }
    if (event.data?.type === "finance-debt-roadmap-height") {
      const height = Math.min(12000, Math.max(900, Number(event.data.height || 0)));
      frame.style.height = `${height}px`;
      return;
    }
    if (event.data?.type === "finance-debt-roadmap-send-offer") { receiveDebtRoadmapOffer(event.data.payload); return; }
    if (event.data?.type !== "finance-debt-roadmap-state" || !event.data.payload || typeof event.data.payload !== "object") return;
    const nextState = JSON.parse(JSON.stringify(event.data.payload));
    if (debtRoadmapStatesMatch(debtRoadmapState, nextState)) return;
    debtRoadmapState = nextState;
    queueRemoteSave();
  });
}
