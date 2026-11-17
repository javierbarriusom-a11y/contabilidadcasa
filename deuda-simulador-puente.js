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
    // SVD-R1: qué cuotas de Contratos están en el plan, para que el simulador lo diga junto a su casilla.
    planInstallments: typeof svdCuotasPlanModelo === "function" ? svdCuotasPlanModelo() : null,
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
  setupSvdAcuerdoActions();
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
    if (event.data?.type === "finance-debt-roadmap-agreement") { receiveDebtRoadmapAgreement(event.data.payload); return; }
    if (event.data?.type !== "finance-debt-roadmap-state" || !event.data.payload || typeof event.data.payload !== "object") return;
    const nextState = JSON.parse(JSON.stringify(event.data.payload));
    if (debtRoadmapStatesMatch(debtRoadmapState, nextState)) return;
    debtRoadmapState = nextState;
    queueRemoteSave();
  });
}

// SVD-3 (17/11/2026): «La entidad lo ha aceptado» → «Aplicar el acuerdo». El hogar marca a mano lo aceptado y sube el
// justificante (D-N21). La hoja «Qué ocurrirá» dice qué cambia antes de tocar nada y, al confirmar, en una sola operación:
//  - el contrato guarda el acuerdo (Deuda › Contratos; Ruta y Préstamo lo respetan desde su mes, canonical-debt-payoff-path.js);
//  - el plan guarda el dinero que sale (la decisión de siempre, applyDebtDecision), con su entrada en el acta;
//  - el justificante queda en el dispositivo (o cifrado en la nube), P2PrivateStore.
// Regla para no contar dos veces (docs/SVD_DISENO.md §4): el contrato guarda la deuda que queda y el plan, el dinero que sale.
// Un solo «Deshacer» lo devuelve todo como estaba. Lo pendiente de confirmar viaja en la propia hoja (`dialog.__svdPendiente`):
// este fichero es solo de funciones y el estado de la app sigue en app.js.
function svdPendiente() {
  return qs("svdAcuerdoDialog")?.__svdPendiente || null;
}

function svdTodayKey() {
  return typeof isoLocalDate === "function" ? isoLocalDate(new Date()).slice(0, 7) : "";
}

function svdAcuerdoAck(accountKey, ok, message) {
  qs("debtRoadmapFrame")?.contentWindow?.postMessage({ type: "finance-debt-roadmap-agreement-result", accountKey, ok, message }, window.location.origin);
}

function svdMesTexto(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "sin fecha";
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

// SVD-R1: la cuota que deja de pagarse en el plan es la de la partida del plan que lleva el nombre de la entidad (con su importe,
// que es el que resta la previsión). Sin esa partida, nada: restar una cuota que el plan no tiene inventaría liquidez. Solo si el
// plan no se puede leer se usa la casilla del simulador, como en SVD-3.
function svdCuotaEnPlan(contractId) {
  const modelo = svdCuotasPlanModelo();
  if (!modelo) return null;
  return modelo.items.find((item) => item.id === contractId) || { status: "fuera-del-plan", row: null };
}

function svdAcuerdoDecision(pending) {
  const enPlan = svdCuotaEnPlan(pending.built.contractId);
  const named = enPlan && (enPlan.status === "en-plan" || enPlan.status === "importe-distinto");
  const decision = E14DebtAdapter.agreementPlanDecision({
    agreement: pending.built.agreement, contract: pending.built.contract, monthIndex: pending.monthIndex, cuotasEnPlan: pending.cuotasEnPlan,
    ...(enPlan ? { relief: named && pending.built.contract.paymentStatus === "active" ? enPlan.row.amount : 0 } : {}),
  });
  const month = forecastMonths()[pending.monthIndex];
  return {
    ...decision,
    monthLabel: month?.label || "",
    reliefMonths: decision.monthlyRelief > 0 && typeof debtReliefMonthsForItem === "function"
      ? debtReliefMonthsForItem({ ...decision, reliefMonths: undefined, remainingInstallments: pending.built.contract.remainingInstallments }, pending.monthIndex + 1)
      : 0,
  };
}

function svdRutaFecha(contracts) {
  const engine = window.FinanceCanonicalDebtPayoffPath;
  const todayKey = svdTodayKey();
  if (!engine || !todayKey) return null;
  const result = engine.project(contracts, { startMonthKey: todayKey, extraMonthly: 0 });
  if (!result?.ok || !result.included.length) return null;
  return { monthKey: result.debtFreeMonthKey, complete: result.complete, beyondHorizon: result.beyondHorizon };
}

function svdPuntoMasBajo(evaluation) {
  const rows = evaluation?.rows || [];
  if (!rows.length) return null;
  let index = 0;
  rows.forEach((row, i) => { if (row.checking < rows[index].checking) index = i; });
  return { amount: round2(rows[index].checking), label: forecastMonths()[index]?.label || "" };
}

// Lo que dirá la hoja, calculado con las mismas funciones que Plan › Decisiones y Deuda › Ruta.
function svdAcuerdoImpacto(pending) {
  const decision = svdAcuerdoDecision(pending);
  const months = forecastMonths();
  const baselineOutflows = projectPlan?.outflows?.length === months.length ? projectPlan.outflows : Array(months.length).fill(0);
  const before = evaluateOutflows(baselineOutflows);
  const after = evaluateDebtDecisionItem(decision).evaluation;
  const rows = canonicalDebtContractRows().filter((row) => row.paymentStatus !== "settled" && row.paymentStatus !== "reunified" && Number(row.currentPrincipal) > 0);
  const withAgreement = rows.map((row) => (row.id === pending.built.contractId ? { ...row, agreement: pending.built.agreement } : row));
  return {
    decision,
    lowBefore: svdPuntoMasBajo(before),
    lowAfter: svdPuntoMasBajo(after),
    endBefore: round2(before.ending),
    endAfter: round2(after.ending),
    endLabel: months[months.length - 1]?.label || "",
    floor: typeof agentCaixaFloor === "function" ? round2(agentCaixaFloor()) : null,
    freeBefore: svdRutaFecha(rows),
    freeAfter: svdRutaFecha(withAgreement),
  };
}

function svdAcuerdoTerminos(agreement) {
  const parts = [];
  if (agreement.settlementAmount > 0) parts.push(`un pago de ${money(agreement.settlementAmount, true)} en ${svdMesTexto(agreement.startMonth)}`);
  if (agreement.payment > 0 && agreement.duration > 0) parts.push(`${agreement.duration} ${agreement.duration === 1 ? "cuota" : "cuotas"} de ${money(agreement.payment, true)} al mes desde ${svdMesTexto(agreement.startMonth)}`);
  return parts.join(" y ");
}

function svdFechaTexto(free) {
  if (!free) return "sin fecha calculable";
  if (free.beyondHorizon || !free.monthKey) return "alguna deuda no acaba en 50 años";
  return `${svdMesTexto(free.monthKey)}${free.complete ? "" : " (solo las deudas con datos)"}`;
}

function svdAcuerdoHojaHtml(pending, impact) {
  const { built } = pending;
  const contract = built.contract;
  const label = escapeHtml([contract.entity, contract.type].filter(Boolean).join(" · ") || "Deuda");
  const estado = { active: "activa", suspended: "con los pagos suspendidos" }[contract.paymentStatus] || "activa";
  const cuota = Number(contract.currentPayment) > 0 ? ` · cuota ${money(contract.currentPayment, true)} al mes` : "";
  const saving = built.saving >= 0
    ? `${money(built.saving, true)} menos que la deuda de hoy`
    : `${money(-built.saving, true)} más que la deuda de hoy (el coste de financiarla)`;
  const enPlan = svdCuotaEnPlan(built.contractId);
  const relief = (() => {
    if (!enPlan) {
      return impact.decision.monthlyRelief > 0
        ? `La cuota de hoy (${money(impact.decision.monthlyRelief, true)}) deja de restarse en el plan desde el mes siguiente al del acuerdo, porque en el simulador está marcado que ya está en el plan.`
        : "La cuota de hoy no se toca en el plan: en el simulador no está marcado que esté en el plan (o el contrato no la paga).";
    }
    if (impact.decision.monthlyRelief > 0) return `La partida del plan «${enPlan.row.label}» (${money(impact.decision.monthlyRelief, true)} al mes) deja de restarse desde el mes siguiente al del acuerdo.`;
    if (enPlan.status === "por-importe") return `En el plan hay una partida del mismo importe («${enPlan.row.label}»), pero no lleva el nombre de la entidad: no se toca. Si es esta cuota, ponle el nombre en Plan › Mes.`;
    if (enPlan.status === "suspendido-en-plan") return `El contrato no paga cuota, pero el plan sí tiene una partida con su nombre («${enPlan.row.label}»): no se toca; revísala en Plan › Mes.`;
    return "La cuota de hoy no está en el plan: no hay ninguna partida que dejar de restar.";
  })();
  const low = (point) => (point ? `${money(point.amount, true)} (${escapeHtml(point.label)})` : "sin dato");
  const underFloor = impact.floor !== null && impact.lowAfter && impact.lowAfter.amount < impact.floor;
  return `<span class="action-review-rank">Qué ocurrirá</span>
    <h3 id="svdAcuerdoTitulo">Aplicar el acuerdo aceptado · ${label}</h3>
    <p class="e19-kpi-note">Qué ocurrirá al confirmar. Nada cambia hasta entonces, y después se puede deshacer.</p>
    <div class="action-review-impact" role="group" aria-label="El contrato">
      <strong>El contrato (Deuda › Contratos)</strong>
      <p><strong>Hoy:</strong> ${money(contract.currentPrincipal, true)} pendientes${cuota}, ${estado}.</p>
      <p><strong>Con el acuerdo:</strong> ${escapeHtml(svdAcuerdoTerminos(built.agreement))}. En total, ${money(built.totalAgreed, true)}: ${saving}.</p>
      <p class="e19-kpi-note">El capital del contrato no se toca: la deuda sigue ahí hasta que se pague. Ruta y Préstamo siguen el acuerdo desde su mes, y Hoy la da por cubierta por el plan.</p>
    </div>
    <div class="action-review-impact" role="group" aria-label="El dinero que sale">
      <strong>El dinero que sale (Plan › Decisiones)</strong>
      <p>Una decisión aprobada con ${escapeHtml(svdAcuerdoTerminos(built.agreement))}, anotada en el acta.</p>
      <p class="e19-kpi-note">${escapeHtml(relief)}</p>
    </div>
    <div class="action-review-impact" role="group" aria-label="La previsión">
      <strong>La previsión</strong>
      <p>Punto más bajo de la cuenta: <strong>${low(impact.lowBefore)}</strong> antes → <strong>${low(impact.lowAfter)}</strong> después${impact.floor !== null ? `. Suelo del hogar: ${money(impact.floor, true)}` : ""}.</p>
      <p>Al final de la previsión${impact.endLabel ? ` (${escapeHtml(impact.endLabel)})` : ""}: <strong>${money(impact.endBefore, true)}</strong> antes → <strong>${money(impact.endAfter, true)}</strong> después.</p>
      ${underFloor ? `<p class="svd-acuerdo-aviso" role="alert"><strong>Aviso:</strong> con el acuerdo, la cuenta baja del suelo del hogar. Se puede aplicar igualmente, pero conviene revisarlo.</p>` : ""}
    </div>
    <div class="action-review-impact" role="group" aria-label="Deuda cero">
      <strong>Deuda cero (Deuda › Ruta, sin extra)</strong>
      <p><strong>${escapeHtml(svdFechaTexto(impact.freeBefore))}</strong> antes → <strong>${escapeHtml(svdFechaTexto(impact.freeAfter))}</strong> después.</p>
    </div>
    <div class="action-review-impact" role="group" aria-label="Justificante">
      <strong>Justificante de la entidad</strong>
      <label for="svdAcuerdoJustificante">La carta, el correo o la captura donde la entidad acepta el acuerdo (obligatorio)</label>
      <input type="file" id="svdAcuerdoJustificante" accept="image/*,application/pdf" />
      <p class="e19-kpi-note">Se guarda en este dispositivo (o cifrado en la nube si tenéis la clave de sesión), nunca en el repositorio.</p>
    </div>
    <p class="e19-kpi-note" id="svdAcuerdoEstado" role="status"></p>
    <div class="action-review-buttons">
      <button type="button" class="secondary-button" data-svd-acuerdo="cancelar">Cancelar</button>
      <button type="button" data-svd-acuerdo="aplicar" disabled>Aplicar el acuerdo</button>
    </div>`;
}

function svdAcuerdoDialog() {
  let dialog = qs("svdAcuerdoDialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "svdAcuerdoDialog";
  dialog.className = "action-review-dialog svd-acuerdo-dialog";
  dialog.setAttribute("aria-labelledby", "svdAcuerdoTitulo");
  dialog.innerHTML = `<button class="action-review-close" type="button" data-svd-acuerdo="cancelar" aria-label="Cerrar sin aplicar">×</button><div class="svd-acuerdo-body" id="svdAcuerdoBody"></div>`;
  dialog.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-svd-acuerdo]")?.dataset.svdAcuerdo;
    if (action === "cancelar") closeSvdAcuerdo();
    if (action === "aplicar") confirmSvdAcuerdo();
  });
  dialog.addEventListener("change", (event) => {
    if (event.target.id !== "svdAcuerdoJustificante") return;
    const apply = dialog.querySelector("[data-svd-acuerdo='aplicar']");
    if (apply) apply.disabled = !event.target.files?.length;
  });
  dialog.addEventListener("close", () => { dialog.__svdPendiente = null; });
  document.body.appendChild(dialog);
  return dialog;
}

function closeSvdAcuerdo() {
  const dialog = qs("svdAcuerdoDialog");
  if (dialog) dialog.__svdPendiente = null;
  if (dialog?.open && typeof dialog.close === "function") dialog.close();
  else dialog?.removeAttribute("open");
}

function receiveDebtRoadmapAgreement(payload) {
  const accountKey = String(payload?.accountKey || "");
  if (!E14DebtAdapter?.buildAcceptedAgreement) return;
  const built = E14DebtAdapter.buildAcceptedAgreement({
    accountKey, account: payload?.account, canonical: debtRoadmapCanonicalReadModel(), baseMonthKey: payload?.baseMonth, todayKey: svdTodayKey(),
  });
  if (!built.ok) return svdAcuerdoAck(accountKey, false, built.message);
  if (debtLiquidations.some((item) => item.targetId === built.contractId)) {
    return svdAcuerdoAck(accountKey, false, "Esta deuda ya tiene una decisión en el plan. Quítala en Plan › Decisiones antes de aplicar el acuerdo.");
  }
  const monthIndex = forecastMonths().findIndex((month) => month.key === built.agreement.startMonth);
  if (monthIndex < 0) return svdAcuerdoAck(accountKey, false, `El mes del acuerdo (${svdMesTexto(built.agreement.startMonth)}) queda fuera de la previsión.`);
  const pending = { accountKey, built, monthIndex, cuotasEnPlan: payload?.cuotasEnPlan === true };
  const impact = svdAcuerdoImpacto(pending);
  const dialog = svdAcuerdoDialog();
  dialog.__svdPendiente = pending;
  qs("svdAcuerdoBody").innerHTML = svdAcuerdoHojaHtml(pending, impact);
  try {
    if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  } catch {
    dialog.setAttribute("open", "");
  }
  svdAcuerdoAck(accountKey, true, "Revisa «Qué ocurrirá» y adjunta el justificante para aplicarlo.");
}

function svdAcuerdoSnapshot() {
  return JSON.parse(JSON.stringify({ debtContractOverrides, debtLiquidations, decisionEvents, decisionWorkflow }));
}

function svdRestaurar(snapshot) {
  debtContractOverrides = snapshot.debtContractOverrides || {};
  saveDebtContractOverrides();
  debtLiquidations = snapshot.debtLiquidations || [];
  saveDebtLiquidations();
  decisionEvents = snapshot.decisionEvents || [];
  saveDecisionEvents();
  decisionWorkflow = snapshot.decisionWorkflow;
  saveDecisionWorkflow();
}

function svdEstado(message) {
  const status = qs("svdAcuerdoEstado");
  if (status) status.textContent = message;
}

async function confirmSvdAcuerdo() {
  const pending = svdPendiente();
  const file = qs("svdAcuerdoJustificante")?.files?.[0];
  const apply = qs("svdAcuerdoDialog")?.querySelector("[data-svd-acuerdo='aplicar']");
  if (!pending || !file) return svdEstado("Falta el justificante de la entidad.");
  if (typeof laboratorioWriteGuard === "function" && laboratorioWriteGuard("Aplicar el acuerdo")) return;
  if (typeof P2PrivateStore === "undefined") return svdEstado("Este navegador no permite guardar el justificante: no se ha aplicado nada.");
  const current = canonicalDebtContractRows().find((row) => row.id === pending.built.contractId);
  if (!current || round2(current.currentPrincipal) !== round2(pending.built.agreement.principalAtAcceptance)) {
    return svdEstado("El contrato ha cambiado en Contratos desde que abriste la hoja: ciérrala y vuelve a marcar el acuerdo.");
  }
  if (apply) apply.disabled = true;
  svdEstado("Guardando el justificante…");
  const contractId = pending.built.contractId;
  const documentId = `svd-acuerdo-${contractId}-${Date.now()}`;
  let meta;
  try {
    meta = await P2PrivateStore.saveAttachment(documentId, file);
  } catch {
    if (apply) apply.disabled = false;
    return svdEstado("No se ha podido guardar el justificante en este dispositivo: no se ha aplicado nada.");
  }
  const snapshot = svdAcuerdoSnapshot();
  const known = new Set(debtLiquidations.map((item) => item.id));
  applyDebtDecision(svdAcuerdoDecision(pending));
  const applied = debtLiquidations.find((item) => item.svdAcuerdo && item.targetId === contractId && !known.has(item.id));
  if (!applied) {
    svdRestaurar(snapshot);
    P2PrivateStore.remove(documentId).catch(() => {});
    if (apply) apply.disabled = false;
    return svdEstado("No se ha podido apuntar la decisión en el plan: no se ha aplicado nada.");
  }
  const agreement = {
    ...pending.built.agreement,
    acceptedAt: new Date().toISOString(),
    documentId,
    documentName: String(file.name || "justificante").slice(0, 120),
    documentStorage: meta?.storage || "local",
    decisionId: applied.id,
  };
  debtContractOverrides = { ...debtContractOverrides, [contractId]: { ...(debtContractOverrides[contractId] || {}), agreement } };
  saveDebtContractOverrides();
  closeSvdAcuerdo();
  render();
  sendDebtRoadmapState();
  showUndoToast("Acuerdo aplicado: Contratos, plan y acta.", () => {
    svdRestaurar(snapshot);
    P2PrivateStore.remove(documentId).catch(() => {});
    render();
    sendDebtRoadmapState();
    announceStatus("Acuerdo deshecho: el contrato, el plan y el acta vuelven a como estaban.");
  }, 30000);
}

// Quitar un acuerdo ya aplicado (pasado el «Deshacer»): el contrato pierde el acuerdo y su decisión del plan se cancela, con su
// entrada en el acta. El justificante se conserva en el dispositivo por si hace falta; también tiene «Deshacer».
function svdQuitarAcuerdo(contractId) {
  const override = debtContractOverrides[contractId];
  if (!override?.agreement) return;
  if (typeof laboratorioWriteGuard === "function" && laboratorioWriteGuard("Quitar el acuerdo")) return;
  const snapshot = svdAcuerdoSnapshot();
  const decision = debtLiquidations.find((item) => item.id === override.agreement.decisionId || (item.svdAcuerdo && item.targetId === contractId));
  const note = "Acuerdo quitado del contrato desde Deuda › Contratos.";
  const cancelled = decision && typeof transitionDecisionLifecycle === "function"
    ? transitionDecisionLifecycle("debt", decision.id, "cancelled", note, { render: false })
    : false;
  if (decision && !cancelled) recordDecisionEvent("Cancelada", { ...decision, source: "debt" }, note);
  debtLiquidations = debtLiquidations.filter((item) => !(item.svdAcuerdo && item.targetId === contractId));
  saveDebtLiquidations();
  const { agreement, ...rest } = override;
  const nextOverrides = { ...debtContractOverrides };
  if (Object.keys(rest).length) nextOverrides[contractId] = rest;
  else delete nextOverrides[contractId];
  debtContractOverrides = nextOverrides;
  saveDebtContractOverrides();
  render();
  sendDebtRoadmapState();
  showUndoToast("Acuerdo quitado del contrato y del plan.", () => {
    svdRestaurar(snapshot);
    render();
    sendDebtRoadmapState();
  }, 30000);
}

async function svdVerJustificante(contractId) {
  const agreement = debtContractOverrides[contractId]?.agreement;
  if (!agreement?.documentId || typeof P2PrivateStore === "undefined") return announceStatus("No hay justificante guardado en este dispositivo.");
  try {
    const blob = await P2PrivateStore.get(agreement.documentId);
    if (!blob) return announceStatus("El justificante no está en este dispositivo.");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    announceStatus("No se ha podido abrir el justificante.");
  }
}

function setupSvdAcuerdoActions() {
  if (window.__svdAcuerdoActionsBound) return;
  window.__svdAcuerdoActionsBound = true;
  document.addEventListener("click", (event) => {
    const quitar = event.target.closest?.("[data-svd-quitar-acuerdo]");
    if (quitar) { event.preventDefault(); svdQuitarAcuerdo(quitar.dataset.svdQuitarAcuerdo); return; }
    const ver = event.target.closest?.("[data-svd-ver-justificante]");
    if (ver) { event.preventDefault(); svdVerJustificante(ver.dataset.svdVerJustificante); }
  });
}

// SVD-R1 (17/11/2026, «ponerlos realistas»): las cuotas de Contratos frente a las partidas de financiación del plan del mes
// que viene, que son lo que la previsión cuenta como deuda (`refi`, isFinancingPlanningRow). Si el mes que viene no existe en
// la previsión, el de hoy. Lo mismo que lee la previsión: planningBreakdownMemoized → expenseEvents con field "refi".
function svdCuotasPlanModelo() {
  if (!DebtContracts?.matchPlanInstallments || typeof planningBreakdownMemoized !== "function") return null;
  const months = forecastMonths();
  const month = months[1] || months[0];
  if (!month) return null;
  const detail = planningBreakdownMemoized(month.index, addMonths(modelStartDate(), month.index));
  const byConcept = new Map();
  (detail?.expenseEvents || []).filter((event) => event.field === "refi").forEach((event) => {
    byConcept.set(event.concept, round2((byConcept.get(event.concept) || 0) + Number(event.amount || 0)));
  });
  const rows = [...byConcept.entries()].map(([label, amount]) => ({ label, amount }));
  return { monthKey: month.key, monthLabel: month.label, ...DebtContracts.matchPlanInstallments(debtContractSourceRows(), rows) };
}
