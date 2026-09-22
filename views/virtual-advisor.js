// T14 (cuarto incremento, sesión 207): pantalla "Asesor virtual" (`#virtual-advisor`), extraída de
// app.js con el mismo patrón `views/*.js`. Vivía dentro de un cluster mucho más grande y entrelazado
// (Ejecutivo/Nueva vida/Nueva vida definitiva/Asesor virtual/Agente de ahorro, ~2.470 líneas), del
// que este incremento solo saca la porción de Asesor virtual porque resultó ser la única
// completamente autocontenida: sus 23 identificadores de nivel superior no llaman a nada exclusivo
// de Ejecutivo/Nueva vida/Nueva vida definitiva, y nada de fuera de este bloque los llama salvo el
// despachador del `switch` y manejadores de evento ya envueltos en función anónima (arrow function),
// nunca referencias directas — no hizo falta ningún envoltorio nuevo tipo PERF-1.
//
// Solo llama al "motor" compartido del agente de ahorro (`buildSavingsAgentPlan`,
// `agentDebtRecommendations`, `agentOptimalDebtPayoffPlan`, `agentVisibleRows`...), que se queda en
// app.js porque Visual Detail (`#visual-detail`, todavía sin lazy-load) lo llama en caliente. El
// resto del cluster (Ejecutivo, Nueva vida, Nueva vida definitiva, el render de Agente de ahorro,
// más los widgets E13/PVC/ESX intercalados entre ellos) queda pendiente — está más entrelazado y
// necesitará una auditoría más cara, posiblemente su propia sesión dedicada.
function virtualAdvisorContext({ allowHeavy = true } = {}) {
  const plan = buildSavingsAgentPlan();
  const debtRecs = agentDebtRecommendations(plan);
  const projectRecs = agentLifeProjectRecommendations(plan, { allowEvaluation: allowHeavy });
  const debtOptimization = allowHeavy ? agentOptimalDebtPayoffPlan() : (cachedAgentDebtOptimization() || emptyAgentDebtOptimization(plan));
  const routeSummary = routeSimulationSummaryFromActive(plan) || routeSimulationSummaryFromOptimization(debtOptimization);
  const summary = agentPlanSummary(plan);
  const capacity = agentTwelveMonthCapacity(plan);
  const visibleRows = agentVisibleRows(plan);
  const today = visibleRows[0] || {};
  const next = visibleRows[1] || {};
  const immediateTransfer = immediateSavingsTransfer(plan, visibleRows);
  const bestStep = debtOptimization?.steps?.[0] || null;
  const bestDebt = bestStep?.candidate || debtRecs[0] || null;
  const bestProject = projectRecs[0] || null;
  return {
    plan,
    debtRecs,
    projectRecs,
    debtOptimization,
    routeSummary,
    summary,
    capacity,
    today,
    next,
    immediateTransfer,
    bestStep,
    bestDebt,
    bestProject,
  };
}

function advisorStatusLabel(tone) {
  if (tone === "danger") return "Bloqueado";
  if (tone === "warn") return "Revisar";
  return "Listo";
}

function advisorMainRecommendation(ctx) {
  const { plan, today, bestStep, bestDebt, bestProject, routeSummary, debtOptimization, immediateTransfer } = ctx;
  if (Number(today.shortage || 0) > 0) {
    return {
      tone: "danger",
      label: "Caja primero",
      title: "No fijaría nuevas decisiones hoy",
      text: `${today.month}: faltan ${money(today.shortage, true)} para proteger CaixaBank y los pagos del mes siguiente. Antes de aplicar deuda o proyectos, revisa flujo y baja impactos.`,
      metric: money(today.shortage, true),
      metricLabel: "déficit",
      action: "Ver flujo mensual",
      target: "cashflow",
    };
  }
  if (routeSummary?.active) {
    return {
      tone: "good",
      label: "Ruta simulada",
      title: "La ruta óptima ya impacta el modelo",
      text: `${routeSummary.count} amortización(es) entre ${routeSummary.firstMonth} y ${routeSummary.lastMonth}. Revisa cuadro de mandos y flujo antes de fijar definitivamente cada decisión.`,
      metric: money(routeSummary.netWorthDelta, true),
      metricLabel: "patrimonio vs base",
      action: "Ver cuadro de mandos",
      target: "visual-detail",
      secondaryAction: "Quitar simulación",
      advisorAction: "clear-route",
    };
  }
  if (debtOptimization?.steps?.length) {
    return {
      tone: "warn",
      label: "Mejor siguiente paso",
      title: "Simular ruta óptima completa de deuda",
      text: `${debtOptimization.steps.length} paso(s), ${money(debtOptimization.totalPrincipal, true)} pactados hasta ${debtOptimization.lastMonth}. Esto permite comparar el cuadro de mandos y el flujo con toda la estrategia cargada.`,
      metric: money(debtOptimization.netWorthDelta, true),
      metricLabel: "mejora patrimonial",
      action: "Simular ruta completa",
      advisorAction: "simulate-route",
    };
  }
  if (bestDebt) {
    return {
      tone: "warn",
      label: "Deuda candidata",
      title: `Preparar ${bestDebt.entity} ${bestDebt.type}`,
      text: `${money(bestDebt.principal, true)} en ${bestStep?.monthLabel || bestDebt.monthLabel}. El asesor la prepara en Control de deuda para comparar pago único, fraccionado, reunificación o retomar.`,
      metric: money(bestDebt.principal, true),
      metricLabel: "importe",
      action: "Preparar deuda",
      debtId: bestDebt.id,
      monthIndex: bestStep?.monthIndex ?? bestDebt.affordability?.agentIndex,
      amount: bestStep?.candidate?.principal ?? bestDebt.principal,
    };
  }
  if (bestProject) {
    return {
      tone: "good",
      label: "Proyecto preparado",
      title: `Revisar ${bestProject.name}`,
      text: `Hucha sugerida de ${money(bestProject.pot, true)}/mes y objetivo ${bestProject.monthLabel}. Puedes comparar pago único, reparto o financiación antes de fijarlo.`,
      metric: money(bestProject.amount, true),
      metricLabel: "coste",
      action: "Revisar proyecto",
      projectId: bestProject.id,
    };
  }
  return {
    tone: immediateTransfer?.needsReview ? "danger" : Number(immediateTransfer?.amount || 0) > 0 ? "good" : "neutral",
    label: "Sin bloqueo",
    title: immediateTransfer?.needsReview ? "Revisar saldo antes de actuar" : Number(immediateTransfer?.amount || 0) > 0 ? "Priorizar traspaso prudente" : "Esperar al siguiente ingreso",
    text: immediateTransfer?.needsReview
      ? `${immediateTransfer.reviewReason} No lo convertiría en acción hasta corregir el saldo.`
      : Number(immediateTransfer?.amount || 0) > 0
        ? `Puedes mover ${money(immediateTransfer.amount, true)} a Mediolanum dejando CaixaBank con ${money(immediateTransfer.reserve, true)} para operar.`
      : `Mantén CaixaBank cubierto en ${money(today.requiredReserve || plan.caixaFloor, true)} y revisa nuevos acuerdos cuando entre más caja.`,
    metric: money(immediateTransfer?.needsReview ? 0 : immediateTransfer?.amount || 0, true),
    metricLabel: "traspaso seguro",
    action: "Ver evolución",
    target: "savings-agent",
  };
}

function advisorActionButton(item) {
  if (item.advisorAction) {
    return `<button type="button" data-advisor-action="${escapeHtml(item.advisorAction)}">${escapeHtml(item.action)}</button>`;
  }
  if (item.debtId) {
    return `<button type="button" data-advisor-debt-target="${escapeHtml(item.debtId)}" data-advisor-debt-month="${escapeHtml(String(item.monthIndex ?? ""))}" data-advisor-debt-amount="${escapeHtml(String(item.amount ?? ""))}">${escapeHtml(item.action)}</button>`;
  }
  if (item.projectId) {
    return `<button type="button" data-advisor-project-id="${escapeHtml(item.projectId)}">${escapeHtml(item.action)}</button>`;
  }
  return `<button type="button" data-home-nav="${escapeHtml(item.target || "savings-agent")}">${escapeHtml(item.action)}</button>`;
}

function advisorDebtTargetOptions() {
  return debtTargetOptions({ includePlanned: false })
    .filter((item) => Number(item.currentPrincipal ?? item.principal ?? 0) > 0)
    .filter((item) => !debtLiquidations.some((decision) => decision.targetId === item.id && decision.locked));
}

function advisorDebtInitialTargetId(ctx) {
  const preferred = ctx?.bestDebt?.id;
  const options = advisorDebtTargetOptions();
  if (preferred && options.some((item) => item.id === preferred)) return preferred;
  return options[0]?.id || "";
}

function advisorDebtControlValues(ctx) {
  const options = advisorDebtTargetOptions();
  const targetSelect = qs("advisorDebtTarget");
  const currentTargetId = targetSelect?.value && options.some((item) => item.id === targetSelect.value)
    ? targetSelect.value
    : advisorDebtInitialTargetId(ctx);
  const target = debtTargetById(currentTargetId, { includePlanned: true }) || options[0] || null;
  const amountInput = qs("advisorDebtAmount");
  const amount = parseAmount(amountInput?.value) ?? Number(target?.currentPrincipal ?? target?.principal ?? 0);
  const rawMode = qs("advisorDebtMode")?.value || "optimize";
  const duration = Math.max(1, Number(qs("advisorDebtDuration")?.value || (isDebtMultiMonthMode(rawMode) ? 6 : 1)));
  const monthIndex = Number(qs("advisorDebtMonth")?.value || 0);
  return { target, targetId: target?.id || "", amount, rawMode, duration, monthIndex };
}

function populateAdvisorDebtControls(ctx) {
  const targetSelect = qs("advisorDebtTarget");
  const monthSelect = qs("advisorDebtMonth");
  if (!targetSelect || !monthSelect) return;
  const options = advisorDebtTargetOptions();
  const previousTarget = targetSelect.value;
  const selectedId = previousTarget && options.some((item) => item.id === previousTarget)
    ? previousTarget
    : advisorDebtInitialTargetId(ctx);
  targetSelect.innerHTML = options
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.entity)} · ${escapeHtml(item.type)} · ${escapeHtml(item.number || "")} · ${money(item.currentPrincipal ?? item.principal, true)}</option>`)
    .join("");
  targetSelect.value = selectedId;
  const previousMonth = monthSelect.value;
  monthSelect.innerHTML = forecastMonths()
    .map((month) => `<option value="${month.index}">${escapeHtml(month.label)}</option>`)
    .join("");
  monthSelect.value = previousMonth && [...monthSelect.options].some((option) => option.value === previousMonth) ? previousMonth : "0";
  const target = debtTargetById(selectedId, { includePlanned: true });
  if (qs("advisorDebtAmount") && !qs("advisorDebtAmount").value) {
    qs("advisorDebtAmount").value = amountInputValue(Number(target?.currentPrincipal ?? target?.principal ?? 0));
  }
  const mode = qs("advisorDebtMode")?.value || "optimize";
  const optimizes = ["optimize", "spread-optimize", "refinance-optimize", "retomar-optimize"].includes(mode);
  const multi = isDebtMultiMonthMode(mode);
  if (qs("advisorDebtMonth")) qs("advisorDebtMonth").disabled = optimizes;
  if (qs("advisorDebtDuration")) {
    qs("advisorDebtDuration").disabled = isDebtResumeMode(mode) || !multi;
    if (!multi) qs("advisorDebtDuration").value = 1;
    if (multi && !Number(qs("advisorDebtDuration").value)) qs("advisorDebtDuration").value = 6;
  }
}

function advisorDebtDecisionFromCurrent({ rawModeOverride, durationOverride, forceOptimize } = {}) {
  const values = advisorDebtControlValues();
  const rawMode = rawModeOverride || values.rawMode;
  const target = values.target;
  const amount = isDebtResumeMode(rawMode) ? Number(target?.currentPrincipal ?? target?.principal ?? 0) : values.amount;
  return debtDecisionFromValues({
    targetId: values.targetId,
    name: debtTargetDisplayName(target),
    amount,
    relief: debtMonthlyReliefForMode(target, rawMode),
    rawMode,
    monthIndex: values.monthIndex,
    duration: durationOverride || (isDebtMultiMonthMode(rawMode) ? values.duration : 1),
    forceOptimize,
  });
}

function advisorDebtOption(rawMode, duration, title, detail) {
  const decision = advisorDebtDecisionFromCurrent({ rawModeOverride: rawMode, durationOverride: duration, forceOptimize: true });
  if (!decision) return null;
  const evaluated = evaluateDebtDecisionItem(decision);
  return {
    rawMode,
    duration,
    title,
    detail,
    decision,
    monthly: evaluated.monthly,
    minChecking: evaluated.evaluation.minChecking,
    netGain: evaluated.netGain,
    monthLabel: forecastMonths()[decision.monthIndex]?.label || "-",
    feasible: evaluated.evaluation.minChecking >= 0,
  };
}

function advisorDebtReviewCard(option, selected = false) {
  return `<article class="advisor-debt-option ${option.feasible ? "good" : "warn"} ${selected ? "selected" : ""}">
    <div>
      <span>${escapeHtml(option.title)}</span>
      <strong>${escapeHtml(option.monthLabel)} · ${money(option.monthly, true)}/mes</strong>
      <p>${escapeHtml(option.detail)}</p>
    </div>
    <dl>
      <div><dt>Caja mínima</dt><dd>${money(option.minChecking, true)}</dd></div>
      <div><dt>Liquidez final</dt><dd class="${option.netGain >= 0 ? "positive" : "negative"}">${option.netGain >= 0 ? "+" : ""}${money(option.netGain, true)}</dd></div>
    </dl>
    <button type="button" data-advisor-apply-debt-option="${selected ? "current" : "suggested"}" data-raw-mode="${escapeHtml(option.rawMode)}" data-duration="${escapeHtml(String(option.duration))}">
      ${selected ? "Aplicar esta configuración" : "Aplicar sugerencia"}
    </button>
  </article>`;
}

function quickVirtualAdvisorContext() {
  return virtualAdvisorContext({ allowHeavy: Boolean(cachedAgentDebtOptimization()) });
}

function renderAdvisorDebtSandbox(ctx = quickVirtualAdvisorContext(), { allowEvaluation = false } = {}) {
  populateAdvisorDebtControls(ctx);
  const panel = qs("advisorDebtReview");
  if (!panel) return;
  const values = advisorDebtControlValues(ctx);
  const target = values.target;
  if (!target) {
    panel.innerHTML = `<div class="empty-state compact">No hay deudas pendientes disponibles para simular.</div>`;
    return;
  }
  const current = advisorDebtDecisionFromCurrent();
  if (!current) {
    panel.innerHTML = `<div class="advisor-debt-empty">
      <strong>Introduce un importe pactado</strong>
      <p>El asesor comparará opciones sin tocar el cuadro de mandos hasta que apliques una.</p>
    </div>`;
    return;
  }
  if (!allowEvaluation) {
    const suspended = debtTargetIsSuspended(target);
    const discount = Math.max(0, Number(current.originalPrincipal || 0) - Number(current.amount || 0));
    panel.innerHTML = `<div class="advisor-debt-head">
        <div>
          <span>Deuda seleccionada</span>
          <strong>${escapeHtml(target.entity)} · ${escapeHtml(target.type)}</strong>
          <p>${escapeHtml(target.number || "")}${suspended ? " · pagos suspendidos: no se cuenta como ingreso al liquidar" : ""}</p>
        </div>
        <div><span>Mejora pactada</span><strong class="${discount ? "positive" : ""}">${money(discount, true)}</strong></div>
        <div><span>Modalidad</span><strong>${escapeHtml(debtModeLabel(current.payoffMode))}</strong></div>
      </div>
      <div class="advisor-debt-empty compact">
        <strong>Compara cuando quieras aplicar</strong>
        <p>Para mantener la navegación fluida, las alternativas de mes óptimo, fraccionamiento, reunificación y retomar pagos se calculan al pulsar comparar.</p>
        <button type="button" id="advisorDebtCompare">Comparar opciones</button>
      </div>`;
    return;
  }
  const evaluated = evaluateDebtDecisionItem(current);
  const original = {
    rawMode: values.rawMode,
    duration: values.duration,
    title: "Configuración actual",
    detail: debtModeHelpText(values.rawMode),
    decision: current,
    monthly: evaluated.monthly,
    minChecking: evaluated.evaluation.minChecking,
    netGain: evaluated.netGain,
    monthLabel: forecastMonths()[current.monthIndex]?.label || "-",
    feasible: evaluated.evaluation.minChecking >= 0,
  };
  const suspended = debtTargetIsSuspended(target);
  const options = [
    advisorDebtOption("optimize", 1, "Pago único óptimo", suspended ? "Liquida deuda suspendida sin sumar cuota liberada ficticia." : "Cierra o reduce deuda y libera cuota después."),
    advisorDebtOption("spread-optimize", 6, "Fraccionar 6 meses", "Reparte el pacto y busca inicio óptimo."),
    advisorDebtOption("refinance-optimize", 12, "Reunificar 12 meses", "Cuota más suave a cambio de más plazo."),
    advisorDebtOption("refinance-optimize", 24, "Reunificar 24 meses", "Menor presión mensual y más tiempo."),
    suspended ? advisorDebtOption("retomar-optimize", 1, "Retomar pagos", "Calcula atrasos desde enero 2026 y retoma vencimiento original.") : null,
  ].filter(Boolean);
  const discount = Math.max(0, Number(current.originalPrincipal || 0) - Number(current.amount || 0));
  panel.innerHTML = `<div class="advisor-debt-head">
      <div>
        <span>Deuda seleccionada</span>
        <strong>${escapeHtml(target.entity)} · ${escapeHtml(target.type)}</strong>
        <p>${escapeHtml(target.number || "")}${suspended ? " · pagos suspendidos: no se cuenta como ingreso al liquidar" : ""}</p>
      </div>
      <div><span>Mejora pactada</span><strong class="${discount ? "positive" : ""}">${money(discount, true)}</strong></div>
      <div><span>Ratio deuda</span><strong>${escapeHtml(renderDebtRatioText(current))}</strong></div>
    </div>
    <div class="advisor-debt-options">
      ${advisorDebtReviewCard(original, true)}
      ${options.map((option) => advisorDebtReviewCard(option)).join("")}
    </div>`;
}

function renderDebtRatioText(decision) {
  const rows = firstOpenRows(lastSimulation, 12);
  const income12 = rows.length ? averageRows(rows, (row) => row.income) : 0;
  const debt12 = rows.length ? averageRows(rows, (row) => row.car + row.refi) : 0;
  const relief = Number(decision?.monthlyRelief || 0);
  const before = income12 ? (debt12 / income12) * 100 : 0;
  const after = income12 ? (Math.max(0, debt12 - relief) / income12) * 100 : 0;
  return `${before.toFixed(1)}% -> ${after.toFixed(1)}%`;
}

function applyAdvisorDebtOption(button) {
  const rawMode = button.dataset.rawMode || qs("advisorDebtMode")?.value || "optimize";
  const duration = Number(button.dataset.duration || qs("advisorDebtDuration")?.value || 1);
  const forceOptimize = button.dataset.advisorApplyDebtOption !== "current" || rawMode.includes("optimize");
  const decision = advisorDebtDecisionFromCurrent({ rawModeOverride: rawMode, durationOverride: duration, forceOptimize });
  applyDebtDecision(decision);
}

function virtualAdvisorActions(ctx) {
  const { today, routeSummary, debtOptimization, bestStep, bestDebt, bestProject, summary, capacity } = ctx;
  const actions = [];
  if (Number(today.shortage || 0) > 0) {
    actions.push({
      tone: "danger",
      title: "Recortar o aplazar impactos",
      text: `${today.month}: déficit de ${money(today.shortage, true)} frente a la reserva. No fijes deuda/proyectos hasta corregirlo.`,
      action: "Ver simulador",
      target: "simulator",
    });
  }
  if (routeSummary?.active) {
    actions.push({
      tone: "good",
      title: "Validar ruta simulada",
      text: `${routeSummary.count} amortización(es) ya impactan cuadro de mandos y flujo. Si no te convence, retírala y vuelve a simular.`,
      action: "Ver flujo",
      target: "cashflow",
    });
    actions.push({
      tone: "warn",
      title: "Retirar simulación completa",
      text: "Devuelve la ruta de deuda al simulador sin borrar decisiones fijas.",
      action: "Quitar simulación",
      advisorAction: "clear-route",
    });
  } else if (debtOptimization?.steps?.length) {
    actions.push({
      tone: "warn",
      title: "Cargar ruta óptima de deuda",
      text: `${debtOptimization.steps.length} paso(s) hasta ${debtOptimization.lastMonth}. Se aplica como simulación temporal para ver impacto completo.`,
      action: "Simular ruta completa",
      advisorAction: "simulate-route",
    });
  }
  if (bestDebt) {
    const amount = bestStep?.candidate?.principal ?? bestDebt.principal;
    const monthIndex = bestStep?.monthIndex ?? bestDebt.affordability?.agentIndex;
    actions.push({
      tone: "warn",
      title: `Preparar ${bestDebt.entity} ${bestDebt.type}`,
      text: `${money(amount, true)} en ${bestStep?.monthLabel || bestDebt.monthLabel}. Compara amortización, fraccionado, reunificación o retomar antes de fijar.`,
      action: "Preparar deuda",
      debtId: bestDebt.id,
      monthIndex,
      amount,
    });
  }
  if (bestProject) {
    actions.push({
      tone: "good",
      title: `Preparar proyecto: ${bestProject.name}`,
      text: `${money(bestProject.pot, true)}/mes de hucha sugerida; objetivo ${bestProject.monthLabel}. Revisa alternativas antes de fijar.`,
      action: "Revisar proyecto",
      projectId: bestProject.id,
    });
  }
  if (ctx.immediateTransfer?.needsReview) {
    actions.push({
      tone: "danger",
      title: "Revisar saldo antes de traspasar",
      text: ctx.immediateTransfer.reviewReason,
      action: "Ver saldos",
      target: "visual-detail",
    });
  } else if (Number(ctx.immediateTransfer?.amount || 0) > 0) {
    actions.push({
      tone: "good",
      title: "Traspaso prudente a Mediolanum",
      text: `${money(ctx.immediateTransfer.amount, true)} ahora, manteniendo reserva de ${money(ctx.immediateTransfer.reserve, true)}.`,
      action: "Ver evolución",
      target: "savings-agent",
    });
  }
  actions.push({
    tone: summary.pending ? "warn" : "neutral",
    title: "Auditar planes cargados",
    text: `${summary.pending} pendiente(s), ${summary.locked} fijo(s). Próximo impacto: ${summary.nextImpactAmount ? `${money(summary.nextImpactAmount, true)} en ${summary.nextImpactMonth}` : "sin impacto próximo"}.`,
    action: "Ver cuadro",
    target: "visual-detail",
  });
  if (capacity.firstShortage) {
    actions.push({
      tone: "danger",
      title: "Mes con tensión detectado",
      text: `${capacity.firstShortage.month}: faltan ${money(capacity.firstShortage.shortage, true)}. Prioridad: aplazar proyectos o reducir ahorro automático.`,
      action: "Ver previsión",
      target: "prevision",
    });
  }
  return actions.slice(0, 7);
}

function renderAdvisorPriority(ctx) {
  const target = qs("virtualAdvisorPriority");
  if (!target) return;
  const main = advisorMainRecommendation(ctx);
  target.innerHTML = `<div class="advisor-priority-card ${main.tone}">
    <div>
      <span>${escapeHtml(main.label)}</span>
      <h3>${escapeHtml(main.title)}</h3>
      <p>${escapeHtml(main.text)}</p>
    </div>
    <aside>
      <small>${escapeHtml(main.metricLabel)}</small>
      <strong>${main.metric}</strong>
      ${advisorActionButton(main)}
      ${main.secondaryAction ? `<button type="button" class="secondary" data-advisor-action="${escapeHtml(main.advisorAction)}">${escapeHtml(main.secondaryAction)}</button>` : ""}
    </aside>
  </div>`;
}

function renderAdvisorKpis(ctx) {
  const target = qs("virtualAdvisorKpis");
  if (!target) return;
  const { plan, today, summary, routeSummary, debtOptimization, immediateTransfer } = ctx;
  const routeText = routeSummary?.active
    ? `${routeSummary.count} simulada(s)`
    : debtOptimization?.steps?.length
      ? `${debtOptimization.steps.length} sugerida(s)`
      : "Sin ruta";
  const cards = [
    ["Caja protegida", money(plan.minCaixa, true), `Mínimo con reserva: ${money(plan.minReserveCoverage, true)}.`, plan.minReserveCoverage >= 0 ? "good" : "danger"],
    ["Capacidad libre real", money(monthlyFreeCapacity(plan.rows || []), true), "Media 12m tras ahorro objetivo y decisiones cargadas.", executiveToneForAmount(monthlyFreeCapacity(plan.rows || []))],
    ["Planes en cálculo", `${summary.pending} pend. · ${summary.locked} fijo(s)`, summary.nextImpactAmount ? `Próximo: ${money(summary.nextImpactAmount, true)} en ${summary.nextImpactMonth}.` : "Sin impacto próximo.", summary.pending ? "warn" : "good"],
    ["Ruta deuda", routeText, routeSummary ? `Impacto patrimonio: ${money(routeSummary.netWorthDelta, true)}.` : "Sin deuda optimizable.", routeSummary ? "warn" : "neutral"],
    ["Traspaso seguro", money(immediateTransfer?.needsReview ? 0 : immediateTransfer?.amount || 0, true), immediateTransfer?.needsReview ? immediateTransfer.reviewReason : `Reserva actual: ${money(immediateTransfer?.reserve || today.requiredReserve || plan.caixaFloor, true)}.`, immediateTransfer?.needsReview ? "danger" : Number(immediateTransfer?.amount || 0) > 0 ? "good" : "warn"],
  ];
  target.innerHTML = cards
    .map(([label, value, note, tone]) => `<article class="advisor-kpi ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${typeof value === "string" ? escapeHtml(value) : value}</strong>
      <p>${escapeHtml(note)}</p>
    </article>`)
    .join("");
}

function renderAdvisorStatus(ctx) {
  const target = qs("virtualAdvisorStatus");
  if (!target) return;
  const { plan, today, next, summary, capacity, routeSummary } = ctx;
  const checks = [
    {
      label: "Caja operativa",
      value: money(today.agentCaixa || 0, true),
      note: `Reserva requerida: ${money(today.requiredReserve || plan.caixaFloor, true)}.`,
      tone: Number(today.shortage || 0) > 0 ? "danger" : "good",
    },
    {
      label: "Mes siguiente cubierto",
      value: money(Math.max(0, Number(next.outflowsBeforeSaving || 0)), true),
      note: next.month ? `Pagos previstos para ${next.month}.` : "Sin mes posterior.",
      tone: "neutral",
    },
    {
      label: "Simulaciones activas",
      value: routeSummary?.active ? `${routeSummary.count} deuda(s)` : `${summary.pending} pendiente(s)`,
      note: routeSummary?.active ? "Ya impactan el modelo." : "Pendientes de fijar o descartar.",
      tone: routeSummary?.active || summary.pending ? "warn" : "good",
    },
    {
      label: "Primer riesgo",
      value: capacity.firstShortage?.month || "Sin déficit",
      note: capacity.firstShortage ? money(capacity.firstShortage.shortage, true) : "No hay faltas de caja en el horizonte.",
      tone: capacity.firstShortage ? "danger" : "good",
    },
  ];
  target.innerHTML = `<div class="advisor-status-head">
    <span>Semáforo operativo</span>
    <strong>${escapeHtml(advisorStatusLabel(checks.some((item) => item.tone === "danger") ? "danger" : checks.some((item) => item.tone === "warn") ? "warn" : "good"))}</strong>
    <p>El asesor usa las simulaciones pendientes, los planes fijos y los datos del cuadro de mandos.</p>
  </div>
  <div class="advisor-status-grid">
    ${checks
      .map((item) => `<div class="${item.tone}">
        <span>${escapeHtml(item.label)}</span>
        <strong>${typeof item.value === "string" ? escapeHtml(item.value) : item.value}</strong>
        <small>${escapeHtml(item.note)}</small>
      </div>`)
      .join("")}
  </div>`;
}

function renderAdvisorActions(ctx) {
  const target = qs("virtualAdvisorActions");
  if (!target) return;
  const actions = unifiedActionCenterModel().actions;
  target.classList.add("unified-action-list");
  target.innerHTML = actions.length
    ? actions.map(renderUnifiedAction).join("")
    : `<div class="empty-state compact">Sin acciones necesarias ahora mismo.</div>`;
  bindUnifiedActionButtons(target);
}

function renderAdvisorMonths(ctx) {
  const target = qs("virtualAdvisorMonths");
  if (!target) return;
  const rows = agentVisibleRows(ctx.plan).slice(0, 6);
  target.innerHTML = rows
    .map((row) => {
      const status = agentStatusForRow(row);
      return `<article class="advisor-month ${status.tone}">
        <div>
          <span>${escapeHtml(row.month)}</span>
          <strong>${escapeHtml(status.label)}</strong>
        </div>
        <dl>
          <div><dt>Resultado</dt><dd class="${row.operatingResult < 0 ? "negative" : "positive"}">${money(row.operatingResult, true)}</dd></div>
          <div><dt>Proyectos/deuda</dt><dd>${money(row.projectOutflow, true)}</dd></div>
          <div><dt>Traspaso</dt><dd class="positive">${money(row.transferToSavings, true)}<small>${escapeHtml(row.transferDateLabel || "cierre de mes")}</small></dd></div>
          <div><dt>Caja cierre</dt><dd>${money(row.agentCaixa, true)}</dd></div>
        </dl>
      </article>`;
    })
    .join("");
}

function renderAdvisorModel(ctx) {
  const target = qs("virtualAdvisorModel");
  if (!target) return;
  const { summary, routeSummary, debtOptimization, bestDebt, bestProject, plan } = ctx;
  const visibleRows = agentVisibleRows(plan);
  const modelItems = [
    ["Datos usados", "Cuadro de mandos + simulador + control de deuda + saldos", "Se recalcula al entrar en la sección o al aplicar una acción."],
    ["Planes considerados", `${summary.pending} pendientes, ${summary.locked} fijos`, summary.nextImpactAmount ? `${money(summary.nextImpactAmount, true)} en ${summary.nextImpactMonth}` : "Sin impacto próximo."],
    ["Deuda prioritaria", bestDebt ? `${bestDebt.entity} ${bestDebt.type}` : "Sin deuda viva", bestDebt ? `${money(bestDebt.principal, true)} · ${debtOptimization?.steps?.[0]?.monthLabel || bestDebt.monthLabel}` : "No hay objetivo optimizable."],
    ["Proyecto prioritario", bestProject ? bestProject.name : "Sin proyecto pendiente", bestProject ? `${money(bestProject.pot, true)}/mes · objetivo ${bestProject.monthLabel}` : "Añade proyectos para crear huchas."],
    ["Ruta completa", routeSummary ? `${routeSummary.count} paso(s)` : "Sin ruta", routeSummary ? `${routeSummary.firstMonth} - ${routeSummary.lastMonth}; caja mínima ${money(routeSummary.minCaixa, true)}` : "No aplicada ni sugerida."],
    ["Horizonte", `${visibleRows[0]?.month || ""} - ${visibleRows.at(-1)?.month || ""}`, `Patrimonio neto final: ${money(plan.netWorth, true)}.`],
  ];
  target.innerHTML = modelItems
    .map(([label, value, note]) => `<div>
      <span>${escapeHtml(label)}</span>
      <strong>${typeof value === "string" ? escapeHtml(value) : value}</strong>
      <p>${escapeHtml(note)}</p>
    </div>`)
    .join("");
}

function renderVirtualAdvisor({ forceHeavy = false } = {}) {
  if (!qs("virtualAdvisorKpis")) return;
  const hasOptimization = Boolean(cachedAgentDebtOptimization());
  const ctx = virtualAdvisorContext({ allowHeavy: forceHeavy || hasOptimization });
  renderAdvisorKpis(ctx);
  renderAdvisorPriority(ctx);
  renderAdvisorStatus(ctx);
  renderAdvisorDebtSandbox(ctx, { allowEvaluation: forceHeavy || hasOptimization });
  renderAdvisorActions(ctx);
  renderAdvisorMonths(ctx);
  renderAdvisorModel(ctx);
  if (!hasOptimization && !forceHeavy) scheduleHeavyAdvisorRefresh("virtual-advisor");
}
