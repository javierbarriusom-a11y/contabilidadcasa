// T14 (quinto incremento, sesión 207): pantalla "Ejecutivo" (`#executive-advisor`), extraída de
// app.js con el mismo patrón `views/*.js`. Es la segunda porción autocontenida del cluster grande
// identificado al cerrar el cuarto incremento (Ejecutivo/Nueva vida/Nueva vida definitiva/Agente de
// ahorro) — la primera fue `views/virtual-advisor.js`.
//
// Solo llama al "motor" compartido — `executiveAdvisorContext`, `executivePrimaryDecision`,
// `unifiedActionCenterModel`, `renderUnifiedAction`, `bindUnifiedActionButtons`... — que se queda
// en app.js porque Hoy (`renderHomeDashboard`, eager) lo llama en caliente para pintar sus propias
// tarjetas de decisión (`unifiedActionCenterModel()`/`bindUnifiedActionButtons()`) y
// `renderHomeDecision` reutiliza `renderUnifiedAction` para las decisiones marcadas
// `isUnifiedAction`. Ninguna de las 9 funciones de este fragmento (las que solo pintan la pantalla
// Ejecutivo en sí: héroe, acciones, cuentas, ruta de deuda, plan de coche, metas de compra grande,
// agenda del mes) se llama desde fuera de `renderExecutiveAdvisor` ni desde Hoy.
//
// `new-life-simulation` (screen hermana en el mismo cluster) NO se movió: `renderNewLifeSimulation`
// se llama sin ninguna guarda de pantalla activa desde varios manejadores de Plan/Ajustes
// (`addGob20IncomeAdjustment`/`removeGob20IncomeAdjustment`, `gob12ApplyExpenseToReal` y hermanas) —
// para refrescar la pantalla si el hogar la tiene abierta al cambiar un supuesto en otro sitio. Si
// esa función viviera en un fragmento lazy, cualquiera de esas acciones (en Plan, no en Nueva vida)
// rompería con `ReferenceError` la primera vez que se ejecutara sin haber visitado antes Nueva vida.
// Queda en app.js entera, con sus widgets E13/PVC/ESX, hasta que ese acoplamiento se resuelva
// (añadir la guarda de pantalla activa sería un cambio de comportamiento, no una reubicación pura).
function renderExecutiveHero(ctx) {
  const target = qs("executiveAdvisorHero");
  if (!target) return;
  const decision = executivePrimaryDecision(ctx);
  target.className = `executive-hero ${decision.tone}`;
  target.innerHTML = `<div class="executive-hero-main">
      <span>${decision.tone === "danger" ? "Prioridad: proteger caja" : decision.tone === "warn" ? "Prioridad: decidir deuda" : "Prioridad: ejecutar"}</span>
      <h2>${escapeHtml(decision.title)}</h2>
      <p>${escapeHtml(decision.text)}</p>
    </div>
    <div class="executive-hero-metrics">
      <div><span>CaixaBank tras acción</span><strong>${money(ctx.immediateTransfer?.caixaAfter ?? ctx.balances.caixa, true)}</strong></div>
      <div><span>Mediolanum tras acción</span><strong>${money(ctx.immediateTransfer?.mediolanumAfter ?? ctx.balances.mediolanum, true)}</strong></div>
      <div><span>Reserva inmediata</span><strong>${money(ctx.immediateTransfer?.reserve || ctx.today.requiredReserve || ctx.plan.caixaFloor, true)}</strong></div>
    </div>`;
}

function renderExecutiveActions(ctx) {
  const target = qs("executiveActionPlan");
  if (!target) return;
  target.classList.add("unified-action-list");
  target.innerHTML = unifiedActionCenterModel({ context: ctx }).actions.map(renderUnifiedAction).join("");
  bindUnifiedActionButtons(target);
}

function renderExecutiveAccounts(ctx) {
  const target = qs("executiveAccounts");
  if (!target) return;
  const rows = ctx.rows;
  const first12 = rows.slice(0, 12);
  const minCaixaRow = first12.length
    ? first12.reduce((best, row) => (Number(row.agentCaixa || 0) < Number(best.agentCaixa || 0) ? row : best), first12[0])
    : null;
  const minCaixa12 = minCaixaRow ? Number(minCaixaRow.agentCaixa || 0) : Number(ctx.balances.caixa || 0);
  const nextDebt = ctx.debtOptimization?.steps?.[0];
  const balanceDateText = state.balanceDate || defaultBalanceDate();
  const cards = [
    ["CaixaBank ahora", money(ctx.balances.caixa, true), `Saldo a ${balanceDateText}. Reserva operativa: ${money(ctx.plan.caixaFloor, true)}.`],
    ["Mediolanum ahora", money(ctx.balances.mediolanum, true), `Saldo a ${balanceDateText}. Cuenta de ahorro y huchas.`],
    ["CaixaBank tras decisión", money(ctx.immediateTransfer?.caixaAfter ?? ctx.balances.caixa, true), `Reserva inmediata: ${money(ctx.immediateTransfer?.reserve || ctx.plan.caixaFloor, true)}.`],
    ["Mediolanum tras decisión", money(ctx.immediateTransfer?.mediolanumAfter ?? ctx.balances.mediolanum, true), ctx.immediateTransfer?.needsReview ? "Pendiente de confirmar saldos antes de ejecutar." : ctx.immediateTransfer?.amount ? `Incluye traspaso ejecutable ${money(ctx.immediateTransfer.amount, true)}.` : "Sin traspaso seguro hoy."],
    ["Peor caja 12m", money(minCaixa12, true), minCaixaRow ? `${minCaixaRow.month} · ${minCaixaRow.transferDateLabel || "cierre de mes"}. Debe quedar sobre reserva.` : "Debe quedar por encima de la reserva."],
    ["Siguiente deuda", nextDebt ? `${nextDebt.monthLabel} · ${money(nextDebt.candidate.principal, true)}` : "Sin paso", nextDebt ? debtTargetDisplayName(nextDebt.candidate) : "No hay ruta pendiente."],
  ];
  target.innerHTML = cards
    .map(([label, value, note]) => `<div class="executive-mini-card">
      <span>${escapeHtml(label)}</span>
      <strong>${typeof value === "string" ? escapeHtml(value) : value}</strong>
      <p>${escapeHtml(note)}</p>
    </div>`)
    .join("");
}

function renderExecutiveDebtRoute(ctx) {
  const target = qs("executiveDebtRoute");
  if (!target) return;
  const steps = ctx.debtOptimization?.steps || [];
  const summary = ctx.routeSummary;
  const header = `<div class="executive-route-summary ${summary?.active ? "active" : ""}">
    <div><span>${summary?.active ? "Ruta simulada" : "Ruta sugerida"}</span><strong>${summary ? `${summary.count} paso(s)` : "Sin ruta"}</strong></div>
    <div><span>Importe pactado</span><strong>${summary ? money(summary.total, true) : money(0, true)}</strong></div>
    <div><span>Último paso</span><strong>${escapeHtml(summary?.lastMonth || "-")}</strong></div>
    <div><span>Patrimonio vs base</span><strong class="${(summary?.netWorthDelta || 0) >= 0 ? "positive" : "negative"}">${summary ? money(summary.netWorthDelta, true) : money(0, true)}</strong></div>
  </div>`;
  const controls = summary?.active
    ? `<button type="button" class="secondary" data-executive-action="clear-route">Retirar ruta simulada</button>`
    : steps.length
      ? `<button type="button" data-executive-action="simulate-route">Simular ruta completa en el dashboard</button>`
      : "";
  const rows = steps.slice(0, 6).map((step) => `<article class="executive-debt-step">
    <span>${step.order}</span>
    <div>
      <strong>${escapeHtml(debtTargetDisplayName(step.candidate))}</strong>
      <p>${escapeHtml(step.candidate.number || "")} · ${debtTargetIsSuspended(step.candidate) ? "pagos suspendidos; no suma ingreso ficticio" : `libera ${money(step.candidate.effectiveRelief || 0, true)}/mes`}</p>
    </div>
    <dl>
      <div><dt>Mes</dt><dd>${escapeHtml(step.monthLabel)}</dd></div>
      <div><dt>Pactado</dt><dd>${money(step.candidate.principal, true)}</dd></div>
      <div><dt>Mejora</dt><dd class="positive">${money(step.candidate.agreementSavings || 0, true)}</dd></div>
    </dl>
    <button type="button" data-executive-debt-target="${escapeHtml(step.candidate.id)}" data-executive-debt-month="${escapeHtml(String(step.monthIndex))}" data-executive-debt-amount="${escapeHtml(String(step.candidate.principal))}">Preparar</button>
  </article>`).join("");
  target.innerHTML = `${header}${controls ? `<div class="executive-route-actions">${controls}</div>` : ""}${rows || `<div class="empty-state compact">No hay deuda optimizable pendiente.</div>`}`;
}

function renderExecutiveCarPlan(ctx) {
  const target = qs("executiveCarPlan");
  if (!target) return;
  const monthNoCredit = ctx.carReserveMonth?.month || "No alcanzado";
  const monthWithCredit = ctx.carWithCreditMonth?.month || "No alcanzado";
  target.innerHTML = `<div class="executive-car-kpis">
      <div><span>Coste objetivo</span><strong>${money(ctx.settings.carCost, true)}</strong></div>
      <div><span>Colchón mínimo</span><strong>${money(ctx.settings.carReserve, true)}</strong></div>
      <div><span>Falta de hucha</span><strong>${money(ctx.carReserveGap, true)}</strong></div>
      <div><span>Hucha sugerida</span><strong>${money(ctx.carMonthlyPot, true)}/mes</strong></div>
    </div>
    <div class="executive-car-options">
      <article class="executive-car-option good">
        <span>Opción conservadora</span>
        <strong>Comprar cuando Mediolanum cubra colchón</strong>
        <p>Mes estimado: ${escapeHtml(monthNoCredit)}. Mantiene deuda baja y prioriza acuerdos pendientes.</p>
        <button type="button" data-executive-action="prepare-car-project">Preparar hucha coche</button>
      </article>
      <article class="executive-car-option ${ctx.safeCredit ? "good" : "danger"}">
        <span>Financiación Tere</span>
        <strong>${money(ctx.settings.tereCreditCapital, true)} ahora · ${money(ctx.settings.tereCreditPayment, true)}/mes</strong>
        <p>Mes estimado con crédito: ${escapeHtml(monthWithCredit)}. Ratio deuda: ${ctx.debtRatio.toFixed(1)}% -> ${ctx.debtRatioWithTere.toFixed(1)}%. Cuota máxima prudente: ${money(ctx.maxSafeTerePayment, true)}.</p>
        <button type="button" data-executive-action="prepare-tere-credit">Simular financiación</button>
      </article>
    </div>`;
}

function renderBigPurchaseGoals(ctx) {
  const target = qs("executiveBigPurchaseGoals");
  if (!target) return;
  const goals = bigPurchaseGoals();
  if (!goals.length) {
    target.innerHTML = `<div class="empty-state compact">Sin otros objetivos todavía. Añade uno (reforma, mudanza, etc.) para ver cuándo será viable.</div>`;
    return;
  }
  target.innerHTML = goals.map((goal) => {
    const result = bigPurchaseAffordability(ctx.plan, {
      costeObjetivo: goal.costeObjetivo,
      colchonObjetivo: goal.colchonObjetivo,
      capitalFinanciacion: goal.capitalFinanciacion,
      cuotaFinanciacion: goal.cuotaFinanciacion,
      avgIncome: ctx.avgIncome,
      avgDebt: ctx.avgDebt,
    });
    const monthCash = result.monthCashOnly?.month || "No alcanzado";
    const creditLine = goal.capitalFinanciacion > 0
      ? `Con financiación (${money(goal.capitalFinanciacion, true)} ahora, ${money(goal.cuotaFinanciacion, true)}/mes): ${result.monthWithCredit?.month || "No alcanzado"}. Ratio deuda: ${result.debtRatio.toFixed(1)}% -> ${result.debtRatioWithCredit.toFixed(1)}%.`
      : "";
    const tone = !goal.capitalFinanciacion || result.safeCredit ? "good" : "danger";
    return `<article class="executive-car-option ${tone}">
      <span>${escapeHtml(goal.label)}</span>
      <strong>${money(goal.costeObjetivo, true)}</strong>
      <p>Al contado / colchón: ${escapeHtml(monthCash)}. ${escapeHtml(creditLine)}</p>
      <button type="button" class="secondary" data-big-purchase-remove="${escapeHtml(goal.id)}">Quitar</button>
    </article>`;
  }).join("");
}

function addBigPurchaseGoalFromControls() {
  const costeObjetivo = parseAmount(qs("executiveBigPurchaseCoste")?.value);
  if (!costeObjetivo || costeObjetivo <= 0) return;
  addBigPurchaseGoal({
    label: qs("executiveBigPurchaseLabel")?.value,
    costeObjetivo,
    colchonObjetivo: parseAmount(qs("executiveBigPurchaseColchon")?.value) || 0,
    capitalFinanciacion: parseAmount(qs("executiveBigPurchaseCapital")?.value) || 0,
    cuotaFinanciacion: parseAmount(qs("executiveBigPurchaseCuota")?.value) || 0,
  });
  ["executiveBigPurchaseLabel", "executiveBigPurchaseCoste", "executiveBigPurchaseColchon", "executiveBigPurchaseCapital", "executiveBigPurchaseCuota"].forEach((id) => {
    if (qs(id)) qs(id).value = "";
  });
  scheduleExecutiveAdvisorRender();
}

function renderExecutiveMonthAgenda(ctx) {
  const target = qs("executiveMonthAgenda");
  if (!target) return;
  target.innerHTML = ctx.rows.slice(0, 6)
    .map((row) => {
      const status = agentStatusForRow(row);
      return `<article class="executive-month ${status.tone}">
        <div><span>${escapeHtml(row.month)}</span><strong>${escapeHtml(status.label)}</strong></div>
        <dl>
          <div><dt>Resultado</dt><dd class="${row.operatingResult >= 0 ? "positive" : "negative"}">${money(row.operatingResult, true)}</dd></div>
          <div><dt>Traspaso</dt><dd>${money(row.transferToSavings, true)}<small>${escapeHtml(row.transferDateLabel || "cierre de mes")}</small></dd></div>
          <div><dt>Caixa</dt><dd>${money(row.agentCaixa, true)}</dd></div>
          <div><dt>Mediolanum</dt><dd>${money(row.agentMediolanum, true)}</dd></div>
        </dl>
      </article>`;
    })
    .join("");
}

function renderExecutiveAdvisor({ forceHeavy = false } = {}) {
  if (!qs("executiveAdvisorHero")) return;
  const hasOptimization = Boolean(cachedAgentDebtOptimization());
  const ctx = executiveAdvisorContext({ allowHeavy: forceHeavy || hasOptimization });
  if (qs("executiveCaixaFloor")) qs("executiveCaixaFloor").value = amountInputValue(ctx.plan.caixaFloor);
  if (qs("executiveCarReserve")) qs("executiveCarReserve").value = amountInputValue(ctx.settings.carReserve);
  if (qs("executiveCarCost")) qs("executiveCarCost").value = amountInputValue(ctx.settings.carCost);
  if (qs("executiveTereCreditCapital")) qs("executiveTereCreditCapital").value = amountInputValue(ctx.settings.tereCreditCapital);
  if (qs("executiveTereCreditPayment")) qs("executiveTereCreditPayment").value = amountInputValue(ctx.settings.tereCreditPayment);
  renderExecutiveHero(ctx);
  renderExecutiveActions(ctx);
  renderExecutiveAccounts(ctx);
  renderExecutiveDebtRoute(ctx);
  renderExecutiveCarPlan(ctx);
  renderBigPurchaseGoals(ctx);
  renderExecutiveMonthAgenda(ctx);
  if (!hasOptimization && !forceHeavy) scheduleHeavyAdvisorRefresh("executive-advisor");
}
