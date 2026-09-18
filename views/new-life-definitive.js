// T14 (sexto incremento, sesión 207): pantalla "Nueva vida definitiva" (`#new-life-definitive`),
// extraída de app.js con el mismo patrón `views/*.js`. Es la tercera porción autocontenida del
// cluster grande identificado al cerrar el cuarto incremento (Ejecutivo/Nueva vida/Nueva vida
// definitiva/Agente de ahorro) — las dos primeras fueron `views/virtual-advisor.js` y
// `views/executive-advisor.js`.
//
// Las 32 funciones de este fragmento (estado por defecto/carga/guardado, lectura y volcado de
// controles, resolución de proyecto/deuda origen, el propio flujo `buildNewLifeDefinitiveFlow` y
// sus resúmenes, los ocho `renderLifeDef*`, `renderNewLifeDefinitive` y sus manejadores de
// refrescar/resetear/confirmar/preparar) solo se llaman entre sí o desde el cableado propio de la
// pantalla (los `addEventListener` sobre `qs("new-life-definitive")` en el bloque de cableado
// central, y el `case "new-life-definitive"` de `renderActiveSection`) — nunca desde fuera de un
// callback o de una guarda de hash (`viewFromHash() === "new-life-definitive"` en
// `handleAgentCaixaFloorChange`, y el `viewId === "new-life-definitive"` dentro del `setTimeout` de
// `scheduleHeavyAdvisorRefresh`), así que no hay ninguna llamada eager que se resuelva antes de que
// este fragmento esté cargado.
//
// `new-life-simulation` (screen hermana en el mismo cluster) sigue sin moverse por el motivo ya
// documentado en `views/executive-advisor.js`: `renderNewLifeSimulation` se llama sin guarda de
// pantalla activa desde varios manejadores de Plan/Ajustes. El agente de ahorro (`renderSavingsAgent`
// y su motor) tampoco se ha auditado todavía para el mismo patrón.
function defaultNewLifeDefinitiveState() {
  const settings = executiveAdvisorSettings();
  return {
    horizon: 24,
    caixaFloor: agentCaixaFloor() || 2500,
    transferMode: "prudent",
    projectName: "Coche familiar",
    projectAmount: settings.carCost || DEFAULT_EXECUTIVE_CAR_COST,
    projectMode: "savings",
    projectMonthIndex: 6,
    loanCapital: settings.tereCreditCapital || DEFAULT_EXECUTIVE_TERE_CREDIT_CAPITAL,
    loanPayment: settings.tereCreditPayment || DEFAULT_EXECUTIVE_TERE_CREDIT_PAYMENT,
    loanMonths: settings.tereCreditMonths || DEFAULT_EXECUTIVE_TERE_CREDIT_MONTHS,
    projectSourceId: "custom",
    debtStrategy: "optimal",
    debtMode: "route-full",
    debtTargetId: "",
    debtAmount: 0,
    debtRelief: 0,
    debtDuration: 1,
    debtMonthIndex: 0,
    confirmedFlow: false,
  };
}

function loadNewLifeDefinitiveState() {
  const defaults = defaultNewLifeDefinitiveState();
  try {
    const saved = JSON.parse(storageGet(storageKey("new-life-definitive"), "{}"));
    return {
      ...defaults,
      ...(saved && typeof saved === "object" ? saved : {}),
      caixaFloor: agentCaixaFloor() || defaults.caixaFloor,
    };
  } catch {
    return defaults;
  }
}

function saveNewLifeDefinitiveState(state) {
  storageSet(storageKey("new-life-definitive"), JSON.stringify({
    ...state,
    caixaFloor: agentCaixaFloor(),
  }));
}

function readNewLifeDefinitiveControls() {
  const current = loadNewLifeDefinitiveState();
  const selectedDebtMode = qs("lifeDefDebtMode")?.value || current.debtMode || lifeDefDebtModeFromLegacy(current.debtStrategy);
  return {
    ...current,
    horizon: Math.max(6, Number(qs("lifeDefHorizon")?.value || current.horizon || 24)),
    caixaFloor: agentCaixaFloor() || current.caixaFloor || 2500,
    transferMode: qs("lifeDefTransferMode")?.value || current.transferMode || "prudent",
    projectSourceId: qs("lifeDefProjectSource")?.value || current.projectSourceId || "custom",
    projectName: qs("lifeDefProjectName")?.value?.trim() || current.projectName || "Proyecto principal",
    projectAmount: Math.max(0, parseAmount(qs("lifeDefProjectAmount")?.value) ?? current.projectAmount ?? 0),
    projectMode: qs("lifeDefProjectMode")?.value || current.projectMode || "savings",
    projectMonthIndex: Math.max(0, Number(qs("lifeDefProjectMonth")?.value ?? current.projectMonthIndex ?? 0)),
    loanCapital: Math.max(0, parseAmount(qs("lifeDefLoanCapital")?.value) ?? current.loanCapital ?? 0),
    loanPayment: Math.max(0, parseAmount(qs("lifeDefLoanPayment")?.value) ?? current.loanPayment ?? 0),
    loanMonths: Math.max(0, Number(qs("lifeDefLoanMonths")?.value || current.loanMonths || 0)),
    debtStrategy: qs("lifeDefDebtStrategy")?.value || lifeDefLegacyStrategyFromMode(selectedDebtMode),
    debtMode: selectedDebtMode,
    debtTargetId: qs("lifeDefDebtTarget")?.value || current.debtTargetId || "",
    debtAmount: Math.max(0, parseAmount(qs("lifeDefDebtAmount")?.value) ?? current.debtAmount ?? 0),
    debtRelief: Math.max(0, parseAmount(qs("lifeDefDebtRelief")?.value) ?? current.debtRelief ?? 0),
    debtDuration: Math.max(1, Number(qs("lifeDefDebtDuration")?.value || current.debtDuration || 1)),
    debtMonthIndex: Math.max(0, Number(qs("lifeDefDebtMonth")?.value ?? current.debtMonthIndex ?? 0)),
  };
}

function populateNewLifeDefinitiveControls(state, ctx = null) {
  const months = openForecastMonths();
  const monthSelect = qs("lifeDefProjectMonth");
  if (monthSelect) {
    const previous = String(state.projectMonthIndex ?? monthSelect.value ?? 0);
    monthSelect.innerHTML = months
      .slice(0, 72)
      .map((month) => `<option value="${month.index}">${escapeHtml(month.label)}</option>`)
      .join("");
    const valid = [...monthSelect.options].some((option) => option.value === previous);
    monthSelect.value = valid ? previous : monthSelect.options[0]?.value || "0";
  }
  const debtMonthSelect = qs("lifeDefDebtMonth");
  if (debtMonthSelect) {
    const previous = String(state.debtMonthIndex ?? debtMonthSelect.value ?? 0);
    debtMonthSelect.innerHTML = months
      .slice(0, 72)
      .map((month) => `<option value="${month.index}">${escapeHtml(month.label)}</option>`)
      .join("");
    const valid = [...debtMonthSelect.options].some((option) => option.value === previous);
    debtMonthSelect.value = valid ? previous : debtMonthSelect.options[0]?.value || "0";
  }
  if (qs("lifeDefHorizon")) qs("lifeDefHorizon").value = String(state.horizon || 24);
  const lifeDefCaixaFloor = qs("lifeDefCaixaFloor");
  if (lifeDefCaixaFloor) {
    lifeDefCaixaFloor.value = amountInputValue(agentCaixaFloor() || state.caixaFloor);
    lifeDefCaixaFloor.readOnly = true;
    lifeDefCaixaFloor.setAttribute("aria-readonly", "true");
  }
  if (qs("lifeDefTransferMode")) qs("lifeDefTransferMode").value = state.transferMode || "prudent";
  const pendingProjects = lifeDefPendingProjectOptions();
  const projectSourceSelect = qs("lifeDefProjectSource");
  if (projectSourceSelect) {
    const previous = state.projectSourceId || projectSourceSelect.value || "custom";
    projectSourceSelect.innerHTML = [
      `<option value="custom">Proyecto nuevo / coche familiar</option>`,
      ...pendingProjects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name || "Proyecto")} · ${money(decisionGrossCost(project), true)}${project.monthLabel ? ` · ${escapeHtml(project.monthLabel)}` : ""}</option>`),
    ].join("");
    const valid = [...projectSourceSelect.options].some((option) => option.value === previous);
    projectSourceSelect.value = valid ? previous : "custom";
  }
  const selectedProject = lifeDefProjectById(projectSourceSelect?.value || state.projectSourceId);
  const projectValues = selectedProject ? lifeDefStateFromProject(selectedProject, state) : state;
  if (monthSelect && projectValues.projectMonthIndex !== undefined) {
    const projectMonthValue = String(projectValues.projectMonthIndex);
    if ([...monthSelect.options].some((option) => option.value === projectMonthValue)) {
      monthSelect.value = projectMonthValue;
    }
  }
  if (qs("lifeDefProjectName")) qs("lifeDefProjectName").value = projectValues.projectName || "";
  if (qs("lifeDefProjectAmount")) qs("lifeDefProjectAmount").value = amountInputValue(projectValues.projectAmount);
  if (qs("lifeDefProjectMode")) qs("lifeDefProjectMode").value = projectValues.projectMode || "savings";
  if (qs("lifeDefLoanCapital")) qs("lifeDefLoanCapital").value = amountInputValue(projectValues.loanCapital);
  if (qs("lifeDefLoanPayment")) qs("lifeDefLoanPayment").value = amountInputValue(projectValues.loanPayment);
  if (qs("lifeDefLoanMonths")) qs("lifeDefLoanMonths").value = String(projectValues.loanMonths || 0);
  const debtTargets = lifeDefAvailableDebtTargets(ctx);
  const debtTargetSelect = qs("lifeDefDebtTarget");
  if (debtTargetSelect) {
    const previous = state.debtTargetId || debtTargetSelect.value || debtTargets[0]?.id || "";
    debtTargetSelect.innerHTML = debtTargets.length
      ? debtTargets
          .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.entity)} · ${escapeHtml(item.type)} · ${escapeHtml(item.number || "")} · ${money(item.currentPrincipal ?? item.principal, true)}</option>`)
          .join("")
      : `<option value="">Sin deudas pendientes no fijadas</option>`;
    const valid = [...debtTargetSelect.options].some((option) => option.value === previous);
    debtTargetSelect.value = valid ? previous : debtTargetSelect.options[0]?.value || "";
  }
  const selectedDebt = lifeDefDebtTargetById(ctx, debtTargetSelect?.value || state.debtTargetId);
  if (qs("lifeDefDebtMode")) qs("lifeDefDebtMode").value = state.debtMode || lifeDefDebtModeFromLegacy(state.debtStrategy);
  if (qs("lifeDefDebtAmount")) {
    const amount = Number(state.debtAmount || 0) > 0 ? state.debtAmount : Number(selectedDebt?.currentPrincipal ?? selectedDebt?.principal ?? 0);
    qs("lifeDefDebtAmount").value = amountInputValue(amount);
  }
  if (qs("lifeDefDebtRelief")) {
    const relief = Number(state.debtRelief || 0) > 0 ? state.debtRelief : debtMonthlyReliefForMode(selectedDebt, state.debtMode || "optimize");
    qs("lifeDefDebtRelief").value = amountInputValue(relief);
  }
  if (qs("lifeDefDebtDuration")) qs("lifeDefDebtDuration").value = String(Math.max(1, Number(state.debtDuration || 1)));
}

function lifeDefPendingProjectOptions() {
  return projects
    .filter((project) => !project.locked)
    .filter((project) => Number(decisionGrossCost(project)) > 0 || Number(project.creditCapital || 0) > 0)
    .filter((project) => project.source !== "debt");
}

function lifeDefProjectById(projectId) {
  if (!projectId || projectId === "custom") return null;
  return lifeDefPendingProjectOptions().find((project) => project.id === projectId) || null;
}

function lifeDefStateFromProject(project, fallback = {}) {
  const monthIndex = Math.max(0, Number(project.monthIndex ?? fallback.projectMonthIndex ?? 0));
  const projectMode =
    project.projectKind === "external-credit" || Number(project.creditCapital || 0) > 0
      ? "credit"
      : project.mode === "fixed"
        ? "payment"
        : fallback.projectMode || "savings";
  return {
    ...fallback,
    projectSourceId: project.id,
    projectName: project.name || fallback.projectName || "Proyecto",
    projectAmount: round2(Number(project.amount || 0)),
    projectMode,
    projectMonthIndex: monthIndex,
    loanCapital: round2(Number(project.creditCapital || 0)),
    loanPayment: round2(Number(project.recurringAmount || 0)),
    loanMonths: Math.max(0, Number(project.recurringDuration || 0)),
  };
}

function lifeDefDebtModeFromLegacy(strategy) {
  if (strategy === "none") return "none";
  if (strategy === "next") return "route-next";
  return "route-full";
}

function lifeDefLegacyStrategyFromMode(mode) {
  if (mode === "none") return "none";
  if (mode === "route-next") return "next";
  return mode === "route-full" ? "optimal" : "custom";
}

function lifeDefDebtModeIsRoute(mode) {
  return mode === "route-next" || mode === "route-full";
}

function lifeDefAvailableDebtTargets(ctx = null) {
  const lockedTargets = new Set(debtLiquidations.filter((item) => item.locked && item.targetId).map((item) => item.targetId));
  const targets = debtTargetOptions({ includePlanned: true })
    .filter(isDebtPayoffPlanningTarget)
    .filter((item) => item.id !== "plan-unificado")
    .filter((item) => !lockedTargets.has(item.id))
    .filter((item) => Number(item.currentPrincipal ?? item.principal ?? 0) > 0);
  if (targets.length) return targets;
  const seen = new Set();
  return (ctx?.debtOptimization?.steps || [])
    .map((step) => step?.candidate)
    .filter((item) => item && isDebtPayoffPlanningTarget(item) && item.id !== "plan-unificado" && !lockedTargets.has(item.id) && debtPayoffPactAmount(item) > 0)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function lifeDefDebtTargetById(ctx, targetId) {
  const targets = lifeDefAvailableDebtTargets(ctx);
  return targets.find((item) => item.id === targetId) || targets[0] || null;
}

function lifeDefRouteDebtSteps(ctx, state) {
  const lockedTargets = new Set(debtLiquidations.filter((item) => item.locked && item.targetId).map((item) => item.targetId));
  const steps = (ctx.debtOptimization?.steps || [])
    .filter((step) => step?.candidate && step.candidate.id !== "plan-unificado")
    .filter((step) => isDebtPayoffPlanningTarget(step.candidate))
    .filter((step) => !lockedTargets.has(step.candidate.id))
    .filter((step) => debtPayoffPactAmount(step.candidate) > 0);
  const usable = (state.debtMode || lifeDefDebtModeFromLegacy(state.debtStrategy)) === "route-next" ? steps.slice(0, 1) : steps;
  return usable.map((step) => ({
    monthIndex: Number(step.monthIndex || 0),
    label: `Deuda: ${debtTargetDisplayName(step.candidate)}`,
    amount: debtPayoffPactAmount(step.candidate),
    candidate: step.candidate,
    mode: "route",
  }));
}

function lifeDefCustomDebtSteps(ctx, state) {
  const mode = state.debtMode || "optimize";
  const target = lifeDefDebtTargetById(ctx, state.debtTargetId);
  if (!target) return [];
  const targetPrincipal = Math.max(0, Number(target.currentPrincipal ?? target.principal ?? 0));
  const amount = Math.max(0, Number(state.debtAmount || targetPrincipal));
  if (!isDebtResumeMode(mode) && amount <= 0) return [];
  const relief = debtMonthlyReliefForMode(target, mode) || Number(state.debtRelief || 0);
  const duration = Math.max(1, Number(state.debtDuration || 1));
  const optimized = mode.endsWith("-optimize") || mode === "optimize";
  const best = optimized ? evaluateDebtCandidate(target, amount || targetPrincipal, relief, duration, "full", { resume: isDebtResumeMode(mode) }) : null;
  const startIndex = Math.max(0, Number(best?.month?.index ?? state.debtMonthIndex ?? 0));
  const labelBase = `Deuda: ${debtTargetDisplayName(target)}`;
  if (isDebtResumeMode(mode)) {
    const resume = debtResumePlan(target, startIndex);
    const steps = [];
    if (resume.arrears > 0) {
      steps.push({
        monthIndex: startIndex,
        label: `${labelBase} · atrasos`,
        amount: resume.arrears,
        candidate: target,
        mode,
      });
    }
    const recurringMonths = Math.min(resume.recurringDuration || duration, Math.max(1, Number(state.horizon || 24)));
    for (let offset = 0; offset < recurringMonths; offset += 1) {
      steps.push({
        monthIndex: startIndex + offset,
        label: `${labelBase} · retomar cuota`,
        amount: resume.recurringAmount,
        candidate: target,
        mode,
      });
    }
    return steps;
  }
  const isMulti = isDebtMultiMonthMode(mode);
  const months = isMulti ? duration : 1;
  const monthlyAmount = round2(amount / months);
  return Array.from({ length: months }, (_, offset) => ({
    monthIndex: startIndex + offset,
    label: `${labelBase}${isMulti ? ` · ${offset + 1}/${months}` : ""}`,
    amount: offset === months - 1 ? round2(amount - monthlyAmount * (months - 1)) : monthlyAmount,
    candidate: target,
    mode,
  }));
}

function newLifeDefinitiveContext({ allowHeavy = true } = {}) {
  const base = executiveAdvisorContext({ allowHeavy });
  const state = loadNewLifeDefinitiveState();
  const debtOptimization = allowHeavy ? base.debtOptimization : (cachedAgentDebtOptimization() || emptyAgentDebtOptimization(base.plan));
  return {
    ...base,
    state,
    debtOptimization,
  };
}

function newLifeDefinitiveDebtSteps(ctx, state) {
  const mode = state.debtMode || lifeDefDebtModeFromLegacy(state.debtStrategy);
  if (mode === "none") return [];
  return lifeDefDebtModeIsRoute(mode) ? lifeDefRouteDebtSteps(ctx, state) : lifeDefCustomDebtSteps(ctx, state);
}

function buildNewLifeDefinitiveFlow(ctx, override = {}) {
  const state = { ...ctx.state, ...override };
  const applyLocalDecisions = state.confirmedFlow === true;
  const sourceRows = agentVisibleRows(ctx.plan).slice(0, Math.max(6, Number(state.horizon || 24)));
  const balances = ctx.balances || accountBalancesFromState();
  const startBalances = {
    caixa: Number(balances.caixa || 0),
    mediolanum: Number(balances.mediolanum || 0),
  };
  const caixaFloor = Math.max(0, Number(state.caixaFloor || ctx.plan.caixaFloor || 2500));
  const selectedMonthKey = forecastMonths()[state.projectMonthIndex]?.key;
  const matchedProjectIndex = sourceRows.findIndex((row) => row.detailMonthKey === selectedMonthKey);
  const targetProjectIndex = matchedProjectIndex >= 0
    ? matchedProjectIndex
    : Math.max(0, Math.min(sourceRows.length - 1, Number(state.projectMonthIndex || 0)));
  const debtSteps = applyLocalDecisions ? newLifeDefinitiveDebtSteps(ctx, state) : [];
  let caixa = startBalances.caixa;
  let mediolanum = startBalances.mediolanum;
  let totalTransfer = 0;
  let projectExecuted = false;
  let debtPaid = 0;
  let loanCapitalUsed = 0;
  const rows = sourceRows.map((row, index) => {
    const events = [];
    const income = Number(row.income || 0);
    const outflows = Number(row.outflowsBeforeSaving || row.coreSpend + row.car + row.refi + row.projectOutflow || 0);
    let localOutflow = 0;
    let mediolanumOutflow = 0;
    let loanIncome = 0;
    let loanPayment = 0;

    if (applyLocalDecisions && state.projectMode === "credit" && index === targetProjectIndex && Number(state.loanCapital || 0) > 0) {
      loanIncome = Number(state.loanCapital || 0);
      loanCapitalUsed = round2(loanCapitalUsed + loanIncome);
      events.push(`Crédito Tere +${money(loanIncome, true)}`);
    }
    if (applyLocalDecisions && state.projectMode === "credit" && index >= targetProjectIndex && index < targetProjectIndex + Number(state.loanMonths || 0)) {
      loanPayment = Number(state.loanPayment || 0);
    }
    if (applyLocalDecisions && (state.projectMode === "payment" || state.projectMode === "credit") && index === targetProjectIndex && Number(state.projectAmount || 0) > 0) {
      localOutflow += Number(state.projectAmount || 0);
      projectExecuted = true;
      events.push(`${state.projectName}: ${money(state.projectAmount, true)}`);
    }
    if (applyLocalDecisions && state.projectMode === "savings" && index === targetProjectIndex && Number(state.projectAmount || 0) > 0) {
      mediolanumOutflow += Number(state.projectAmount || 0);
      projectExecuted = true;
      events.push(`${state.projectName} desde Mediolanum`);
    }
    debtSteps
      .filter((step) => Number(step.monthIndex || 0) === index)
      .forEach((step) => {
        mediolanumOutflow += Number(step.amount || 0);
        debtPaid = round2(debtPaid + Number(step.amount || 0));
        events.push(step.label);
      });

    caixa = round2(caixa + income + loanIncome - outflows - localOutflow - loanPayment);
    const next = sourceRows[index + 1] || {};
    const nextOutflows = Math.max(0, Number(next.outflowsBeforeSaving || next.coreSpend + next.car + next.refi + next.projectOutflow || 0));
    const fallbackRequiredReserve = state.transferMode === "floor" ? caixaFloor : Math.max(caixaFloor, round2(caixaFloor + nextOutflows));
    const transferPolicy = window.FinanceCanonicalDecisions?.transferForMonth({
      checkingBeforeTransfer: caixa,
      savingsBeforeTransfer: mediolanum,
      reserveFloor: caixaFloor,
      nextMonthOutflows: nextOutflows,
      protectNextMonth: state.transferMode !== "floor",
    });
    const requiredReserve = Number(transferPolicy?.requiredReserve ?? fallbackRequiredReserve);
    const transfer = Number(transferPolicy?.transfer ?? Math.max(0, round2(caixa - requiredReserve)));
    caixa = round2(caixa - transfer);
    mediolanum = round2(mediolanum + transfer - mediolanumOutflow);
    totalTransfer = round2(totalTransfer + transfer);
    const shortage = Math.max(0, round2(requiredReserve - caixa));
    return {
      ...row,
      index,
      income,
      baseOutflows: outflows,
      localOutflow: round2(localOutflow),
      mediolanumOutflow: round2(mediolanumOutflow),
      loanIncome: round2(loanIncome),
      loanPayment: round2(loanPayment),
      transfer,
      requiredReserve,
      caixa,
      mediolanum,
      total: round2(caixa + mediolanum),
      shortage,
      events,
    };
  });
  const final = rows.at(-1) || {};
  const minCaixaRow = rows.reduce((best, row) => (Number(row.caixa || 0) < Number(best.caixa || 0) ? row : best), rows[0] || {});
  const maxMediolanumRow = rows.reduce((best, row) => (Number(row.mediolanum || 0) > Number(best.mediolanum || 0) ? row : best), rows[0] || {});
  const projectMonthRow = rows[targetProjectIndex] || {};
  const projectSavingsBeforeTarget = rows
    .slice(0, targetProjectIndex + 1)
    .reduce((sum, row) => sum + Number(row.transfer || 0), Number(balances.mediolanum || 0));
  return {
    state,
    startBalances,
    rows,
    final,
    minCaixaRow,
    maxMediolanumRow,
    totalTransfer,
    debtPaid,
    loanCapitalUsed,
    projectExecuted,
    projectMonthRow,
    projectSavingsBeforeTarget: round2(projectSavingsBeforeTarget),
  };
}

function newLifeDefScenarioSummaries(ctx, state) {
  const noDebt = { debtStrategy: "none", debtMode: "none" };
  const base = buildNewLifeDefinitiveFlow(ctx, { ...state, confirmedFlow: true, projectAmount: 0, ...noDebt, loanCapital: 0, loanPayment: 0 });
  const savings = buildNewLifeDefinitiveFlow(ctx, { ...state, confirmedFlow: true, projectMode: "savings", ...noDebt });
  const credit = buildNewLifeDefinitiveFlow(ctx, { ...state, confirmedFlow: true, projectMode: "credit", ...noDebt });
  const combined = buildNewLifeDefinitiveFlow(ctx, { ...state, confirmedFlow: true });
  return [
    { key: "base", title: "Sin decisiones nuevas", flow: base, note: "Sirve como suelo para comparar." },
    { key: "savings", title: "Proyecto con hucha", flow: savings, note: "Compra desde Mediolanum cuando llegue el mes." },
    { key: "credit", title: "Crédito Tere + proyecto", flow: credit, note: "Recibe capital y añade cuota mensual." },
    { key: "combined", title: "Deuda + proyecto", flow: combined, note: "Aplica la configuración actual." },
  ];
}

function renderLifeDefHero(ctx, flow) {
  const firstDebt = newLifeDefinitiveDebtSteps(ctx, flow.state)[0];
  const transferRow = flow.rows.find((row) => row.transfer > 0);
  const isConfirmed = flow.displayConfirmed === true;
  const decision = firstDebt
    ? `Preparar ${debtTargetDisplayName(firstDebt.candidate)} en ${forecastMonths()[firstDebt.monthIndex]?.label || firstDebt.monthIndex}`
    : flow.state.projectAmount > 0
      ? `Reservar ${money(flow.state.projectAmount, true)} para ${flow.state.projectName}`
      : "Mantener caja y seguir acumulando ahorro";
  qs("lifeDefHero").innerHTML = `
    <div class="life-def-hero-main">
      <span>Decisión ejecutiva · ${isConfirmed ? "confirmada en flujo local" : "pendiente de confirmar"}</span>
      <h2>${escapeHtml(decision)}</h2>
      <p>${isConfirmed ? "Ya está reflejado en el flujo de esta sección." : "Todavía no se mete en el flujo de caja local."} Si lo confirmas, CaixaBank no baja de ${money(flow.minCaixaRow?.caixa || 0, true)} y Mediolanum termina en ${money(flow.final?.mediolanum || 0, true)}. ${transferRow ? `Primer traspaso: ${money(transferRow.transfer, true)} en ${escapeHtml(transferRow.month)}.` : "No hay traspaso inmediato recomendable."}</p>
      <div class="life-def-hero-actions">
        <button type="button" data-life-def-action="${isConfirmed ? "unconfirm-flow" : "confirm-flow"}">${isConfirmed ? "Quitar del flujo local" : "Confirmar en flujo local"}</button>
        <button type="button" data-life-def-action="prepare-project">Llevar proyecto al simulador</button>
        <button type="button" class="secondary" data-life-def-action="prepare-debt">Preparar deuda sugerida</button>
      </div>
    </div>
    <div class="life-def-hero-metrics">
      <div><span>CaixaBank final</span><strong>${money(flow.final?.caixa || 0, true)}</strong><small>Reserva configurada ${money(flow.state.caixaFloor, true)}</small></div>
      <div><span>Mediolanum final</span><strong>${money(flow.final?.mediolanum || 0, true)}</strong><small>Ahorro separado tras decisiones</small></div>
      <div><span>Liquidez total</span><strong>${money(flow.final?.total || 0, true)}</strong><small>${flow.debtPaid ? `${money(flow.debtPaid, true)} a deuda` : "Sin deuda simulada"}</small></div>
    </div>`;
}

function renderLifeDefStory(ctx, previewFlow, committedFlow) {
  const state = previewFlow.state || {};
  const firstDebt = newLifeDefinitiveDebtSteps(ctx, state)[0];
  const reserveRow = committedFlow.rows[0] || previewFlow.rows[0] || {};
  const transferRow = previewFlow.rows.find((row) => row.transfer > 0);
  const projectMonth = previewFlow.projectMonthRow?.month || forecastMonths()[state.projectMonthIndex]?.label || "mes elegido";
  const hasProject = Number(state.projectAmount || 0) > 0;
  const isConfirmed = state.confirmedFlow === true;
  const steps = [
    {
      title: "Primero protegemos la cuenta operativa",
      text: `CaixaBank debe conservar ${money(reserveRow.requiredReserve || state.caixaFloor || 0, true)} antes de mover dinero a Mediolanum. ${transferRow ? `La primera transferencia prudente sería ${money(transferRow.transfer, true)} en ${transferRow.month}.` : "De momento no aparece un traspaso claro con la reserva elegida."}`,
    },
    {
      title: firstDebt ? "Después atacamos la deuda con mejor hueco" : "Deuda en pausa",
      text: firstDebt
        ? `La primera deuda sugerida por el criterio óptimo es ${debtTargetDisplayName(firstDebt.candidate)} en ${forecastMonths()[firstDebt.monthIndex]?.label || "mes óptimo"}, por ${money(firstDebt.amount, true)}.`
        : "No hay deuda seleccionada para esta simulación local.",
    },
    {
      title: hasProject ? "El proyecto se convierte en objetivo familiar" : "Sin proyecto de vida cargado",
      text: hasProject
        ? `${state.projectName || "Proyecto"} necesita ${money(state.projectAmount, true)}. Modalidad: ${state.projectMode === "credit" ? `financiación de Tere con cuota ${money(state.loanPayment, true)}/mes` : state.projectMode === "payment" ? "pago único" : "hucha en Mediolanum"}; mes objetivo ${projectMonth}.`
        : "Añade coche, reforma, vacaciones o cualquier objetivo para ver cuándo encaja sin romper caja.",
    },
    {
      title: isConfirmed ? "Esto ya impacta el flujo local" : "Nada se incorpora hasta confirmar",
      text: isConfirmed
        ? "Los eventos de esta simulación ya se muestran en el flujo de caja local. Puedes quitarlos sin tocar el dashboard real."
        : "La tabla inferior sigue limpia: no incluye deuda, coche ni financiación hasta que pulses Confirmar en flujo local.",
    },
  ];
  qs("lifeDefStory").innerHTML = `
    <div class="life-def-story-head">
      <div>
        <p class="panel-kicker">Historia para casa</p>
        <h3>Explicación familiar</h3>
        <p>Lectura sencilla para alinear deuda, coche y colchón sin mezclar simulación con decisión tomada.</p>
      </div>
      <span class="life-def-status ${isConfirmed ? "is-confirmed" : "is-pending"}">${isConfirmed ? "Confirmado en flujo" : "Pendiente de confirmar"}</span>
    </div>
    <div class="life-def-story-grid">
      ${steps
        .map(
          (item, index) => `
            <article>
              <strong>${index + 1}</strong>
              <div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.text)}</p>
              </div>
            </article>`,
        )
        .join("")}
    </div>`;
}

function renderLifeDefKpis(ctx, flow) {
  const projectReady = flow.state.projectMode === "savings" ? flow.projectSavingsBeforeTarget >= Number(flow.state.projectAmount || 0) : true;
  const alerts = flow.rows.filter((row) => row.shortage > 0 || row.mediolanum < 0).length;
  const debtMode = flow.state.debtMode || lifeDefDebtModeFromLegacy(flow.state.debtStrategy);
  const kpis = [
    ["Mínimo CaixaBank", money(flow.minCaixaRow?.caixa || 0, true), flow.minCaixaRow?.month || "Sin dato"],
    ["Máximo Mediolanum", money(flow.maxMediolanumRow?.mediolanum || 0, true), flow.maxMediolanumRow?.month || "Sin dato"],
    ["Traspasos acumulados", money(flow.totalTransfer, true), "De CaixaBank a Mediolanum"],
    ["Proyecto", projectReady ? "Viable" : "Falta hucha", flow.projectMonthRow?.month || "Sin mes"],
    ["Deuda simulada", money(flow.debtPaid, true), debtMode === "none" ? "Sin deuda" : "Ruta local"],
    ["Alertas", String(alerts), alerts ? "Revisar meses rojos" : "Sin roturas de caja"],
  ];
  qs("lifeDefKpis").innerHTML = kpis
    .map(([label, value, detail]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`)
    .join("");
}

function renderLifeDefDecisions(ctx, flow) {
  const transfer = flow.rows.find((row) => row.transfer > 0);
  const firstDebt = newLifeDefinitiveDebtSteps(ctx, flow.state)[0];
  const projectGap = Math.max(0, round2(Number(flow.state.projectAmount || 0) - flow.projectSavingsBeforeTarget));
  const items = [
    {
      tone: "good",
      title: transfer ? `Traspasar ${money(transfer.transfer, true)} en ${transfer.month}` : "No traspasar todavía",
      text: transfer
        ? `CaixaBank queda con ${money(transfer.caixa, true)} y cubre la reserva de ${money(transfer.requiredReserve, true)}.`
        : "La caja no genera excedente claro con el criterio de reserva seleccionado.",
      action: "Ver flujo",
      nav: "lifeDefCashflow",
    },
    {
      tone: projectGap ? "warn" : "good",
      title: projectGap ? `Faltan ${money(projectGap, true)} para ${flow.state.projectName}` : `${flow.state.projectName} encaja`,
      text: flow.state.projectMode === "credit"
        ? `Con financiación: entra ${money(flow.state.loanCapital, true)} y pagas ${money(flow.state.loanPayment, true)}/mes.`
        : `Objetivo ${money(flow.state.projectAmount, true)} en ${flow.projectMonthRow?.month || "mes elegido"}.`,
      action: "Preparar proyecto",
      lifeAction: "prepare-project",
    },
    {
      tone: firstDebt ? "warn" : "good",
      title: firstDebt ? `Preparar deuda: ${debtTargetDisplayName(firstDebt.candidate)}` : "Sin deuda nueva en esta simulación",
      text: firstDebt
        ? `${money(firstDebt.amount, true)} en ${forecastMonths()[firstDebt.monthIndex]?.label || "mes óptimo"}. No se fija en el plan hasta confirmarlo.`
        : "Puedes activar una deuda en el selector para ver impacto en cuentas.",
      action: firstDebt ? "Preparar deuda" : "Abrir deuda",
      lifeAction: "prepare-debt",
    },
  ];
  qs("lifeDefDecisions").innerHTML = items
    .map(
      (item, index) => `
        <article class="life-def-decision ${item.tone}">
          <div class="life-def-rank">${index + 1}</div>
          <div>
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(item.text)}</p>
          </div>
          <button type="button" ${item.lifeAction ? `data-life-def-action="${escapeHtml(item.lifeAction)}"` : `data-life-def-scroll="${escapeHtml(item.nav)}"`}>${escapeHtml(item.action)}</button>
        </article>`,
    )
    .join("");
}

function renderLifeDefScenarios(ctx, state) {
  const scenarios = newLifeDefScenarioSummaries(ctx, state);
  qs("lifeDefScenarios").innerHTML = scenarios
    .map(
      (item) => `
        <article>
          <span>${escapeHtml(item.title)}</span>
          <strong>${money(item.flow.final?.total || 0, true)}</strong>
          <dl>
            <div><dt>Caixa mín.</dt><dd>${money(item.flow.minCaixaRow?.caixa || 0, true)}</dd></div>
            <div><dt>Mediolanum</dt><dd>${money(item.flow.final?.mediolanum || 0, true)}</dd></div>
            <div><dt>Deuda</dt><dd>${money(item.flow.debtPaid || 0, true)}</dd></div>
          </dl>
          <p>${escapeHtml(item.note)}</p>
        </article>`,
    )
    .join("");
}

function renderLifeDefAccounts(flow) {
  const transferRows = flow.rows.filter((row) => row.transfer > 0).slice(0, 4);
  qs("lifeDefAccounts").innerHTML = `
    <div class="life-def-account-pair">
      <article><span>CaixaBank inicio</span><strong>${money(flow.startBalances?.caixa || 0, true)}</strong><small>Cuenta operativa</small></article>
      <article><span>Mediolanum inicio</span><strong>${money(flow.startBalances?.mediolanum || 0, true)}</strong><small>Ahorro separado</small></article>
      <article><span>CaixaBank final</span><strong>${money(flow.final?.caixa || 0, true)}</strong><small>Tras reservas</small></article>
      <article><span>Mediolanum final</span><strong>${money(flow.final?.mediolanum || 0, true)}</strong><small>Tras huchas/deuda</small></article>
    </div>
    <div class="life-def-transfer-list">
      ${transferRows.length ? transferRows.map((row) => `<div><strong>${escapeHtml(row.month)}</strong><span>${money(row.transfer, true)} → Mediolanum</span></div>`).join("") : "<p>Sin traspasos recomendados en el horizonte.</p>"}
    </div>`;
}

function renderLifeDefCashflow(flow) {
  const confirmed = flow.state?.confirmedFlow === true;
  qs("lifeDefCashflow").innerHTML = `
    <caption>${confirmed ? "Flujo local con decisiones confirmadas en esta pantalla." : "Flujo base local: las decisiones simuladas no se aplican hasta confirmar."}</caption>
    <thead>
      <tr>
        <th>Mes</th>
        <th>Ingresos</th>
        <th>Gastos base</th>
        <th>Decisiones</th>
        <th>Traspaso</th>
        <th>CaixaBank</th>
        <th>Mediolanum</th>
        <th>Total</th>
        <th>Evento</th>
      </tr>
    </thead>
    <tbody>
      ${flow.rows
        .map((row) => {
          const decisions = round2(row.localOutflow + row.mediolanumOutflow + row.loanPayment - row.loanIncome);
          return `<tr class="${row.shortage || row.mediolanum < 0 ? "is-alert" : ""}">
            <td>${escapeHtml(row.month)}</td>
            <td class="positive">${money(row.income + row.loanIncome, true)}</td>
            <td class="negative">${money(row.baseOutflows, true)}</td>
            <td class="${decisions > 0 ? "negative" : decisions < 0 ? "positive" : ""}">${money(decisions, true)}</td>
            <td>${money(row.transfer, true)}</td>
            <td>${money(row.caixa, true)}</td>
            <td>${money(row.mediolanum, true)}</td>
            <td>${money(row.total, true)}</td>
            <td>${row.events.length ? row.events.map(escapeHtml).join(" · ") : "-"}</td>
          </tr>`;
        })
        .join("")}
    </tbody>`;
}

function renderNewLifeDefinitive({ forceHeavy = false, preserveControls = false } = {}) {
  if (!qs("lifeDefHero")) return;
  const hasOptimization = Boolean(cachedAgentDebtOptimization());
  const ctx = newLifeDefinitiveContext({ allowHeavy: forceHeavy || hasOptimization });
  const state = loadNewLifeDefinitiveState();
  if (!preserveControls) populateNewLifeDefinitiveControls(state, ctx);
  const freshState = readNewLifeDefinitiveControls();
  const previewFlow = buildNewLifeDefinitiveFlow(ctx, { ...freshState, confirmedFlow: true });
  previewFlow.state = freshState;
  previewFlow.displayConfirmed = freshState.confirmedFlow === true;
  const committedFlow = buildNewLifeDefinitiveFlow(ctx, freshState);
  renderLifeDefHero(ctx, previewFlow);
  renderLifeDefKpis(ctx, previewFlow);
  renderLifeDefStory(ctx, previewFlow, committedFlow);
  renderLifeDefDecisions(ctx, previewFlow);
  renderLifeDefScenarios(ctx, freshState);
  renderLifeDefAccounts(previewFlow);
  renderLifeDefCashflow(committedFlow);
  if (!hasOptimization && !forceHeavy) scheduleHeavyAdvisorRefresh("new-life-definitive");
}

function refreshNewLifeDefinitiveFromControls({ keepConfirmation = false } = {}) {
  const state = readNewLifeDefinitiveControls();
  saveNewLifeDefinitiveState(keepConfirmation ? state : { ...state, confirmedFlow: false });
  renderNewLifeDefinitive({ forceHeavy: Boolean(cachedAgentDebtOptimization()), preserveControls: true });
}

function resetNewLifeDefinitive() {
  const state = defaultNewLifeDefinitiveState();
  saveNewLifeDefinitiveState(state);
  renderNewLifeDefinitive({ forceHeavy: Boolean(cachedAgentDebtOptimization()) });
}

function setNewLifeDefinitiveFlowConfirmed(confirmed) {
  const state = readNewLifeDefinitiveControls();
  saveNewLifeDefinitiveState({ ...state, confirmedFlow: Boolean(confirmed) });
  renderNewLifeDefinitive({ forceHeavy: Boolean(cachedAgentDebtOptimization()) });
}

function prepareNewLifeDefinitiveProject() {
  const state = readNewLifeDefinitiveControls();
  history.pushState(null, "", "#simulator");
  setActiveView("simulator");
  window.requestAnimationFrame(() => {
    clearProjectForm();
    if (qs("projectKind")) qs("projectKind").value = state.projectMode === "credit" ? "external-credit" : "standard";
    if (qs("projectCreditOwner")) qs("projectCreditOwner").value = "Tere";
    if (qs("projectName")) qs("projectName").value = state.projectName;
    if (qs("projectAmount")) qs("projectAmount").value = amountInputValue(state.projectAmount);
    if (qs("projectDuration")) qs("projectDuration").value = "1";
    if (qs("projectCreditCapital")) qs("projectCreditCapital").value = state.projectMode === "credit" ? amountInputValue(state.loanCapital) : "";
    if (qs("projectRecurringAmount")) qs("projectRecurringAmount").value = state.projectMode === "credit" ? amountInputValue(state.loanPayment) : "";
    if (qs("projectRecurringDuration")) qs("projectRecurringDuration").value = state.projectMode === "credit" ? String(state.loanMonths || 0) : "0";
    if (qs("projectRecurringDelay")) qs("projectRecurringDelay").value = "same";
    if (state.projectMode === "payment" && qs("projectModeManual")) qs("projectModeManual").click();
    else setProjectMode("optimize");
    if (qs("projectMonth")) qs("projectMonth").value = String(state.projectMonthIndex || 0);
    updateProjectKindUi();
    updateProjectModeUi();
    pendingProjectDecision = projectDecisionFromForm({ forceOptimize: state.projectMode !== "payment" });
    renderProjectPlanPreview();
    renderProjectDecisionReview(pendingProjectDecision);
  });
}

function prepareNewLifeDefinitiveDebt(ctx = newLifeDefinitiveContext({ allowHeavy: Boolean(cachedAgentDebtOptimization()) })) {
  const state = readNewLifeDefinitiveControls();
  const firstDebt = newLifeDefinitiveDebtSteps(ctx, state)[0];
  if (!firstDebt?.candidate) {
    history.pushState(null, "", "#debt-control");
    setActiveView("debt-control");
    return;
  }
  const selectedMode = state.debtMode || lifeDefDebtModeFromLegacy(state.debtStrategy);
  const handoffMode = lifeDefDebtModeIsRoute(selectedMode) || selectedMode === "fixed" ? "fixed" : selectedMode;
  prepareAgentDebtDecision(firstDebt.candidate.id, {
    monthIndex: firstDebt.monthIndex,
    amount: firstDebt.amount,
    rawMode: handoffMode,
    duration: state.debtDuration,
  });
}
