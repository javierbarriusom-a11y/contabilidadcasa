// T14 (tercer incremento, sesión 207): pantalla legada "Plan deuda óptimo" (`#debt-liquidation-plan`,
// agrupada como "legacy" en la navegación de Ajustes), extraída de app.js con el mismo patrón
// `views/*.js` ya usado por Escenario y Deuda. Antes de mover nada se auditaron los 23 identificadores
// de nivel superior del bloque candidato uno a uno contra el archivo completo — la lección de los dos
// incrementos anteriores: no basta con mirar qué necesita `app.js` eager de este bloque, también hace
// falta comprobar qué necesitan de él las pantallas OTRAS ya lazy (ninguna, en este caso) y qué
// necesita este bloque de ellas (tampoco nada: la pantalla usa el mismo `DEBT_LIQUIDATION_ASSUMPTIONS`
// heredado, no el motor de escenarios ni nada de Deuda/Escenarios). Tres funciones del mismo bloque
// candidato se quedan en app.js porque Visual Detail (`#visual-detail`, otra pantalla pesada aún sin
// lazy) las llama en caliente a través de `rowsForVisualBudget`/`renderMonthlyBudgetPanel`:
// `carSavingsTargetAmount`, `acceleratedDebtTargets` y `buildAcceleratedDebtCarScenario`.
//
// `scheduleHeavyAdvisorRefresh` (app.js) referencia `renderDebtLiquidationPlan` dentro de un
// `setTimeout`, pero solo se dispara 650ms después de que la propia `renderDebtLiquidationPlan` ya
// se haya ejecutado una vez (es ella quien programa ese refresco) — para entonces este fragmento ya
// está cargado, así que no hay riesgo de `ReferenceError` por orden de carga, a diferencia del caso
// de `views/deuda.js`/`views/escenarios.js` corregido en el incremento anterior.
function liquidationSettlementCost(item, discountPenalty = 0) {
  const discount = Math.max(0, Number(item.discount || 0) - discountPenalty);
  return round2(Number(item.principal || 0) * (1 - discount));
}

function liquidationGroupCost(wave, discountPenalty = 0) {
  return round2(
    sumRows(
      DEBT_LIQUIDATION_ASSUMPTIONS.settlements.filter((item) => item.wave === wave),
      (item) => liquidationSettlementCost(item, discountPenalty),
    ),
  );
}

function liquidationMonthDate(key) {
  const [year, month] = String(key).split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

function liquidationShiftMonth(key, months) {
  return monthKey(addMonths(liquidationMonthDate(key), months));
}

function liquidationComparableMonth(row) {
  return row?.detailMonthKey || monthKey(addMonths(modelStartDate(), Number(row?.index || 1) - 1));
}

function liquidationPlanRows() {
  const openRows = openSimulationRows(lastSimulation);
  const rows = openRows.length ? openRows : lastSimulation;
  return rows.filter((row) => liquidationComparableMonth(row) >= "2026-07").slice(0, 24);
}

function liquidationFreeCapacity(row, key) {
  const modelFree = Math.max(0, Number(row.netBeforeSaving || 0));
  const defaultFree =
    key === "2026-07" ? 2167 :
    key === "2026-12" || key === "2027-12" ? 5963 :
    key === "2027-04" ? 9963 :
    key >= "2028-01" ? 3181 :
    2963;
  return round2(Math.max(modelFree, defaultFree));
}

function buildLiquidationScenario({ label, demandDelay = 0, demandAmount = DEBT_LIQUIDATION_ASSUMPTIONS.demandAmount, discountPenalty = 0 } = {}) {
  const assumptions = DEBT_LIQUIDATION_ASSUMPTIONS;
  const balances = accountBalancesFromState();
  const pendingImmediateCash = Math.max(0, round2(assumptions.baseStartingLiquidity - balances.total));
  const startingLiquidity = round2(balances.total + Math.min(pendingImmediateCash, 3450));
  const g1Cost = liquidationGroupCost("g1", discountPenalty);
  const g2Cost = liquidationGroupCost("g2", discountPenalty);
  const demandMonth = demandAmount > 0 ? liquidationShiftMonth(assumptions.demandMonth, demandDelay) : "";
  const rows = liquidationPlanRows();
  let fund = Math.max(0, round2(startingLiquidity - assumptions.targetReserve));
  let reserve = Math.min(startingLiquidity, assumptions.targetReserve);
  let g1Month = "";
  let g2Month = "";
  let g1Done = false;
  let g2Done = false;
  let minReserve = reserve;
  const timeline = [];

  rows.forEach((row) => {
    const key = liquidationComparableMonth(row);
    const free = liquidationFreeCapacity(row, key);
    const fundContribution = g2Done ? 0 : Math.min(assumptions.monthlyFundTarget, Math.max(0, free - assumptions.monthlyReserveTarget));
    const reserveContribution = Math.max(0, Math.min(assumptions.monthlyReserveTarget, free - fundContribution));
    fund = round2(fund + fundContribution);
    reserve = round2(reserve + reserveContribution);
    const events = [];

    if (key === demandMonth) {
      fund = round2(fund + demandAmount);
      events.push(`Demanda +${money(demandAmount)}`);
    }

    if (!g1Done && key >= "2026-11" && fund >= g1Cost) {
      fund = round2(fund - g1Cost);
      g1Done = true;
      g1Month = row.month;
      events.push(`Golpe 1 ${money(g1Cost)}`);
    }

    if (g1Done && !g2Done && fund >= g2Cost) {
      fund = round2(fund - g2Cost);
      g2Done = true;
      g2Month = row.month;
      reserve = round2(reserve + fund);
      fund = 0;
      events.push(`Golpe 2 ${money(g2Cost)}`);
    }

    if (g2Done && free > 0) {
      reserve = round2(reserve + Math.max(0, free - reserveContribution - fundContribution));
    }

    minReserve = Math.min(minReserve, reserve);
    timeline.push({
      key,
      month: row.month,
      income: row.income,
      outflows: Number(row.outflowsBeforeSaving || row.coreSpend + row.car + row.refi || 0),
      free,
      fundContribution,
      reserveContribution,
      fund,
      reserve,
      total: round2(fund + reserve),
      events,
    });
  });

  return {
    label,
    startingLiquidity,
    pendingImmediateCash,
    g1Cost,
    g2Cost,
    demandMonth,
    demandAmount,
    g1Month,
    g2Month,
    minReserve,
    finalReserve: reserve,
    finalLiquidity: round2(fund + reserve),
    timeline,
    complete: g1Done && g2Done,
  };
}

function renderLiquidationMetric({ label, value, note, tone = "" }) {
  return `<article class="debt-plan-kpi ${tone}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <p>${escapeHtml(note)}</p>
  </article>`;
}

function liquidationConnectedDebtDecisions() {
  const decisions = (projectPlan?.placements || [])
    .filter((item) => item.source === "debt")
    .map((item) => ({
      ...item,
      grossCost: decisionGrossCost(item),
      netCost: decisionNetCashCost(item),
      fixed: Boolean(item.locked),
      startLabel: item.monthLabel || forecastMonths()[Number(item.startIndex || 0)]?.label || "",
    }))
    .sort((a, b) => Number(a.startIndex || 0) - Number(b.startIndex || 0));
  const fixed = decisions.filter((item) => item.fixed);
  const pending = decisions.filter((item) => !item.fixed);
  const grossCost = round2(sumRows(decisions, (item) => item.grossCost));
  const fixedCost = round2(sumRows(fixed, (item) => item.grossCost));
  const next = decisions[0] || null;
  return {
    decisions,
    fixed,
    pending,
    grossCost,
    fixedCost,
    next,
  };
}

function renderLiquidationConnectedDecisions(info) {
  const items = info.decisions.slice(0, 5);
  const nextText = info.next
    ? `${info.next.startLabel}: ${money(info.next.grossCost, true)}`
    : "Sin impactos de deuda cargados";
  return `<section class="debt-connected-decisions">
    <div class="debt-connected-head">
      <div>
        <p class="panel-kicker">Conexión con simulador</p>
        <h4>Deuda ya considerada en el flujo</h4>
      </div>
      <span class="status-pill ${info.decisions.length ? "good" : "warn"}">${info.pending.length} pend. · ${info.fixed.length} fijo(s)</span>
    </div>
    <div class="debt-connected-metrics">
      <div><span>Impacto cargado</span><strong>${money(info.grossCost, true)}</strong></div>
      <div><span>Fijo en plan</span><strong>${money(info.fixedCost, true)}</strong></div>
      <div><span>Próximo impacto</span><strong>${escapeHtml(nextText)}</strong></div>
    </div>
    ${
      items.length
        ? `<div class="debt-connected-list">
            ${items
              .map(
                (item) => `<article>
                  <strong>${escapeHtml(item.name || item.label || "Decisión de deuda")}</strong>
                  <span>${escapeHtml(item.fixed ? "Fijo en plan" : "Pendiente de decisión")} · ${escapeHtml(item.startLabel || "sin mes")} · ${money(item.grossCost, true)}</span>
                </article>`,
              )
              .join("")}
          </div>`
        : `<p class="debt-connected-empty">Todavía no hay amortizaciones o reunificaciones cargadas desde el simulador. La ruta usa solo los supuestos CIRBE/ASNEF y el flujo mensual base.</p>`
    }
  </section>`;
}

function renderDebtPlanStrategyFrame(optimization, agentPlan, connectedDebt) {
  const steps = optimization?.steps || [];
  const nextStep = steps[0] || null;
  const summary = routeSimulationSummaryFromActive(agentPlan) || routeSimulationSummaryFromOptimization(optimization);
  const connectedText = connectedDebt.decisions.length
    ? `${connectedDebt.pending.length} pendiente(s), ${connectedDebt.fixed.length} fijo(s), ${money(connectedDebt.grossCost, true)} ya reflejados.`
    : "Sin decisiones de deuda cargadas todavía.";
  return `<section class="debt-plan-strategy">
    <div class="debt-plan-strategy-head">
      <div>
        <p class="panel-kicker">Criterio maestro</p>
        <h4>Cómo decide esta ruta</h4>
      </div>
      <span class="status-pill ${summary?.active ? "warn" : "good"}">${summary?.active ? "Ruta simulada en el dashboard" : "Lista para simular"}</span>
    </div>
    <div class="debt-plan-strategy-grid">
      <article>
        <span>1</span>
        <strong>Proteger caja operativa</strong>
        <p>CaixaBank no debe bajar de ${money(agentPlan.caixaFloor, true)} ni dejar sin cubrir pagos del mes siguiente.</p>
      </article>
      <article>
        <span>2</span>
        <strong>Priorizar quitas reales</strong>
        <p>${nextStep ? `Primer paso: ${debtTargetDisplayName(nextStep.candidate)} en ${nextStep.monthLabel}, ${money(nextStep.candidate.principal, true)}.` : "No hay siguiente deuda optimizable en el horizonte."}</p>
      </article>
      <article>
        <span>3</span>
        <strong>No inventar caja</strong>
        <p>Las cuotas suspendidas no se suman como ingreso; liquidar reduce deuda y riesgo, no crea salario.</p>
      </article>
      <article>
        <span>4</span>
        <strong>Coche solo con estabilidad</strong>
        <p>La compra debe esperar a que deuda y colchón sean compatibles con el flujo mensual.</p>
      </article>
    </div>
    <div class="debt-plan-strategy-actions">
      <p>${escapeHtml(connectedText)}</p>
      <div>
        ${summary?.active
          ? `<button type="button" class="secondary-button" data-debt-plan-action="clear-route">Retirar ruta simulada</button>`
          : `<button type="button" class="secondary-button" data-debt-plan-action="simulate-route">Simular ruta en todo el dashboard</button>`}
        <button type="button" class="secondary-button" data-home-nav="new-life-simulation">Ver Simulación nueva vida</button>
      </div>
    </div>
  </section>`;
}

function debtPlanSafeMoney(value, fallback = "Pendiente") {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? money(numeric, true) : fallback;
}

function debtPlanCarProject(agentPlan) {
  const projectsToReview = agentLifeProjectRecommendations(agentPlan, { allowEvaluation: false });
  return projectsToReview.find((project) => /coche|veh[ií]culo|auto/i.test(`${project.name || ""} ${project.label || ""}`)) || null;
}

function debtPlanStrategicContext({ best, optimization, agentPlan, connectedDebt, consumerDebt, pendingStrategicCost }) {
  const activeSummary = routeSimulationSummaryFromActive(agentPlan);
  const optimizationSummary = routeSimulationSummaryFromOptimization(optimization);
  const summary = activeSummary || optimizationSummary;
  const steps = optimization?.steps || [];
  const firstStep = steps[0] || null;
  const transfer = immediateSavingsTransfer(agentPlan);
  const carProject = debtPlanCarProject(agentPlan);
  const carProgress = carProject ? projectSavingsProgress(carProject, agentPlan) : null;
  const finalPlan = optimization?.finalPlan || agentPlan;
  const baselinePlan = optimization?.baselinePlan || agentPlan;
  const routeCost = summary?.total ?? optimization?.totalPrincipal ?? 0;
  const debtReduced = summary?.debtReduced ?? optimization?.totalOriginalPrincipal ?? 0;
  const finalDebt = optimization?.optimizedRemainingDebt ?? agentPlan.remainingDebt ?? 0;
  const reserveOk = Number(finalPlan.minReserveCoverage || 0) >= -0.01;
  const carReadyAfterDebt = carProgress
    ? Number(finalPlan.finalMediolanum || 0) >= Number(carProgress.amount || 0) + Number(agentPlan.caixaFloor || 0)
    : false;
  return {
    activeSummary,
    summary,
    steps,
    firstStep,
    transfer,
    carProject,
    carProgress,
    finalPlan,
    baselinePlan,
    routeCost,
    debtReduced,
    finalDebt,
    pendingStrategicCost,
    consumerDebt,
    reserveOk,
    carReadyAfterDebt,
    routeMonth: summary?.lastMonth || optimization?.lastMonth || best.g2Month || "Sin fecha",
  };
}

function renderDebtPlanExecutiveHero(context) {
  const first = context.firstStep;
  const firstName = first?.candidate ? debtTargetDisplayName(first.candidate) : "sin deuda candidata";
  const active = Boolean(context.activeSummary);
  const actionTitle = active
    ? "Ruta óptima aplicada en simulación"
    : first
      ? `Siguiente decisión: ${firstName}`
      : "Mantener caja y revisar deuda";
  const actionText = active
    ? `${context.activeSummary.count} paso(s) ya impactan en cuadro de mandos y flujo mensual. Último paso: ${escapeHtml(context.activeSummary.lastMonth || "sin fecha")}.`
    : first
      ? `Preparar ${money(first.candidate.principal, true)} en ${escapeHtml(first.monthLabel || "mes óptimo")}; no cuenta como ingreso porque los pagos están suspendidos.`
      : "No hay deuda optimizable con el criterio actual. Mantén la reserva y revisa nuevos acuerdos.";
  return `<section class="debt-executive-hero ${active ? "active" : ""}">
    <div>
      <p class="panel-kicker">Decisión ejecutiva</p>
      <h3>${escapeHtml(actionTitle)}</h3>
      <p>${actionText}</p>
    </div>
    <div class="debt-executive-stats">
      <article><span>Coste ruta</span><strong>${debtPlanSafeMoney(context.routeCost)}</strong></article>
      <article><span>Deuda reducida</span><strong>${debtPlanSafeMoney(context.debtReduced)}</strong></article>
      <article><span>Fin estimado</span><strong>${escapeHtml(context.routeMonth)}</strong></article>
      <article><span>Caja mínima</span><strong>${debtPlanSafeMoney(context.finalPlan.minCaixa)}</strong></article>
    </div>
  </section>`;
}

function renderDebtPlanActionBoard(context) {
  const first = context.firstStep;
  const routeButton = context.activeSummary
    ? `<button type="button" class="secondary-button" data-debt-plan-action="clear-route">Retirar ruta simulada</button>`
    : `<button type="button" class="secondary-button emphasis" data-debt-plan-action="simulate-route">Aplicar ruta óptima temporal</button>`;
  const firstButton = first?.candidate
    ? `<button type="button" class="secondary-button" data-debt-plan-target="${escapeHtml(first.candidate.id)}" data-debt-plan-month="${Number(first.monthIndex || 0)}" data-debt-plan-amount="${Number(first.candidate.principal || 0)}">Preparar primera deuda</button>`
    : `<button type="button" class="secondary-button" data-home-nav="debt-control">Revisar deuda</button>`;
  const transferLine = context.transfer.needsReview
    ? `Traspaso en revisión: ${escapeHtml(context.transfer.reviewReason)}`
    : `${money(context.transfer.amount, true)} traspasables ahora, dejando CaixaBank con ${money(context.transfer.caixaAfter, true)}.`;
  const items = [
    {
      label: "1",
      title: "Proteger caja antes de decidir",
      text: `Reserva operativa ${money(context.transfer.reserve, true)}. ${transferLine}`,
      action: `<button type="button" class="secondary-button" data-home-nav="executive-advisor">Ver caja</button>`,
      tone: context.transfer.needsReview ? "warn" : "good",
    },
    {
      label: "2",
      title: first?.candidate ? `Negociar ${debtTargetDisplayName(first.candidate)}` : "No fijar deuda nueva todavía",
      text: first?.candidate
        ? `${money(first.candidate.principal, true)} en ${escapeHtml(first.monthLabel || "mes óptimo")}; mejora ${money(first.candidate.agreementSavings || 0, true)} frente a deuda original.`
        : "Sin candidato claro con los datos actuales.",
      action: firstButton,
      tone: first?.candidate?.agreementSavings > 0 ? "good" : "warn",
    },
    {
      label: "3",
      title: context.carProject ? `Coche: esperar a ${context.carProgress?.targetLabel || "fecha objetivo"}` : "Crear objetivo coche",
      text: context.carProject
        ? `Hucha proyectada ${money(context.carProgress?.projected || 0, true)} de ${money(context.carProgress?.amount || 0, true)}. Prioridad: no adelantar si rompe la ruta de deuda.`
        : "No hay proyecto de coche identificado. Crea un proyecto para que el plan lo compare contra deuda y caja.",
      action: `<button type="button" class="secondary-button" data-home-nav="new-life-simulation">${context.carProject ? "Ver coche" : "Crear escenario"}</button>`,
      tone: context.carReadyAfterDebt ? "good" : "warn",
    },
  ];
  return `<section class="debt-action-board">
    <div class="module-heading">
      <div>
        <p class="panel-kicker">Qué hacer ahora</p>
        <h3>Acciones en orden</h3>
      </div>
      ${routeButton}
    </div>
    <div class="debt-action-list">
      ${items
        .map(
          (item) => `<article class="${item.tone}">
            <span>${escapeHtml(item.label)}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${item.text}</p>
            </div>
            ${item.action}
          </article>`,
        )
        .join("")}
    </div>
  </section>`;
}

function renderDebtPlanPolicyCards(context, scenarios) {
  const aggressive = {
    title: "Deuda rápida",
    badge: "Máxima limpieza",
    body: `${context.steps.length || 0} amortización(es), fin ${context.routeMonth}. Coche solo cuando Mediolanum mantenga hucha y reserva.`,
    kpis: [
      ["Coste", debtPlanSafeMoney(context.routeCost)],
      ["Deuda final", debtPlanSafeMoney(context.finalDebt)],
      ["Caja mínima", debtPlanSafeMoney(context.finalPlan.minCaixa)],
    ],
    tone: "good",
  };
  const balanced = {
    title: "Equilibrada",
    badge: "Recomendada",
    body: "Aplicar quitas con mejor relación mejora/caja y reservar hucha de coche sin bajar CaixaBank del umbral.",
    kpis: [
      ["Coche", context.carProgress?.targetLabel || "por definir"],
      ["Mediolanum final", debtPlanSafeMoney(context.finalPlan.finalMediolanum)],
      ["Reserva OK", context.reserveOk ? "Sí" : "Revisar"],
    ],
    tone: context.reserveOk ? "good" : "warn",
  };
  const stability = {
    title: "Estabilidad primero",
    badge: "Más prudente",
    body: `Usar el plan CIRBE/ASNEF por golpes y retrasar decisiones si una entrada prevista no llega.`,
    kpis: [
      ["Golpe 1", scenarios[0]?.g1Month || "pend."],
      ["Golpe 2", scenarios[0]?.g2Month || "pend."],
      ["Colchón mín.", debtPlanSafeMoney(scenarios[0]?.minReserve)],
    ],
    tone: "warn",
  };
  return [aggressive, balanced, stability]
    .map(
      (item) => `<article class="debt-policy-card ${item.tone}">
        <div>
          <span>${escapeHtml(item.badge)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.body)}</p>
        </div>
        <dl>
          ${item.kpis.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
        </dl>
      </article>`,
    )
    .join("");
}

function renderAcceleratedDebtPlan() {
  const panel = qs("acceleratedDebtPlan");
  if (!panel) return;
  const fast = buildAcceleratedDebtCarScenario("fast");
  const balanced = buildAcceleratedDebtCarScenario("balanced");
  const recommended = fast.remainingVisibleRisk <= balanced.remainingVisibleRisk ? fast : balanced;
  const operativeEquifax = round2(sumRows(acceleratedDebtTargets().filter((item) => item.visibleDefault), (item) => item.amount));
  const sourceTotals = {
    cirbeDecember: DEBT_LIQUIDATION_ASSUMPTIONS.cirbe.december2025.total,
    cirbeMay: DEBT_LIQUIDATION_ASSUMPTIONS.cirbe.may2026.total,
    overdue: DEBT_LIQUIDATION_ASSUMPTIONS.cirbe.may2026.overdue,
    interest: DEBT_LIQUIDATION_ASSUMPTIONS.cirbe.may2026.interest,
    equifax: operativeEquifax,
  };
  const compareCards = [fast, balanced]
    .map(
      (item) => `<article class="debt-accel-card ${item.profile === recommended.profile ? "good" : "warn"}">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.visibleClearMonth)}</strong>
        <p>Riesgo visible limpio. Coche: ${money(item.finalCarBuffer, true)} / ${money(item.carTarget, true)}. Deuda pendiente estimada: ${money(item.remainingDebt, true)}.</p>
      </article>`,
    )
    .join("");
  panel.innerHTML = `<div class="module-heading">
      <div>
        <p class="panel-kicker">Plan amortización acelerada + Coche</p>
        <h3>Comparativa para decidir qué ruta mantener</h3>
        <p>Usa el excedente protegido por el agente: primero limpia impagos visibles, mientras crea una hucha Coche paralela.</p>
      </div>
      <span class="status-pill good">${escapeHtml(recommended.label)}</span>
    </div>
    <div class="debt-accel-source-grid">
      <div><span>CIRBE dic 2025</span><strong>${money(sourceTotals.cirbeDecember, true)}</strong></div>
      <div><span>CIRBE mayo 2026</span><strong>${money(sourceTotals.cirbeMay, true)}</strong></div>
      <div><span>Vencido + demora</span><strong>${money(sourceTotals.overdue + sourceTotals.interest, true)}</strong></div>
      <div><span>Equifax operativo</span><strong>${money(sourceTotals.equifax, true)}</strong></div>
    </div>
    <div class="debt-accel-compare">${compareCards}</div>
    <div class="debt-accel-rule">
      <strong>Regla propuesta</strong>
      <p>Hasta limpiar CaixaBank Payments y Bankinter: ${Math.round(fast.earlyDebtShare * 100)}% del excedente protegido a colchón deuda y el resto a Coche. Wizink queda fuera porque ya está pactado a ${money(round2((DEBT_LIQUIDATION_ASSUMPTIONS.wizink.principal * (1 - DEBT_LIQUIDATION_ASSUMPTIONS.wizink.discount)) / DEBT_LIQUIDATION_ASSUMPTIONS.wizink.months), true)}/mes; Carrefour queda fuera por ser medio de pago actual.</p>
    </div>
    <div class="table-wrap debt-plan-table-wrap">
      <table class="debt-plan-table debt-accel-table">
        <thead><tr>
          <th>Mes</th>
          <th>Libre protegido</th>
          <th>Colchón deuda</th>
          <th>Hucha Coche</th>
          <th>Riesgo pendiente</th>
          <th>Deuda pendiente</th>
          <th>Acción</th>
        </tr></thead>
        <tbody>
          ${recommended.rows
            .slice(0, 24)
            .map((row) => `<tr class="${row.events.length ? "highlight" : ""}">
              <td>${escapeHtml(row.month)}</td>
              <td>${money(row.available, true)}</td>
              <td>${money(row.debtContribution, true)}</td>
              <td>${money(row.carContribution, true)}</td>
              <td>${money(row.remainingVisibleRisk, true)}</td>
              <td>${money(row.remainingDebt, true)}</td>
              <td>${escapeHtml(row.monthNote)}</td>
            </tr>`)
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function renderDebtLiquidationPlan() {
  if (!qs("debtPlanKpis")) return;
  const assumptions = DEBT_LIQUIDATION_ASSUMPTIONS;
  const best = buildLiquidationScenario({ label: "Óptimo base" });
  const delayed = buildLiquidationScenario({ label: "Demanda +2 meses", demandDelay: 2 });
  const noDemand = buildLiquidationScenario({ label: "Sin demanda", demandAmount: 0 });
  const worseDiscounts = buildLiquidationScenario({ label: "Quitas 10 pp peores", discountPenalty: 0.1 });
  const scenarios = [best, delayed, noDemand, worseDiscounts];
  const operativeAsnef = assumptions.asnef.filter((item) => !normalizedText(item.entity).includes("wizink"));
  const asnefTotal = round2(sumRows(operativeAsnef, (item) => item.amount));
  const wizinkPrincipal = round2(assumptions.wizink.principal * (1 - assumptions.wizink.discount));
  const wizinkMonthly = round2(wizinkPrincipal / assumptions.wizink.months);
  const cirbeReduction = round2(assumptions.cirbe.december2025.total - assumptions.cirbe.may2026.total);
  const consumerDebt = round2(best.g1Cost + best.g2Cost);
  const connectedDebt = liquidationConnectedDebtDecisions();
  const agentPlan = buildSavingsAgentPlan();
  const hasOptimization = Boolean(cachedAgentDebtOptimization());
  const optimization = cachedAgentDebtOptimization() || emptyAgentDebtOptimization(agentPlan);
  const pendingStrategicCost = Math.max(0, round2(consumerDebt - connectedDebt.grossCost));
  const strategicContext = debtPlanStrategicContext({ best, optimization, agentPlan, connectedDebt, consumerDebt, pendingStrategicCost });

  qs("debtPlanKpis").innerHTML = [
    renderLiquidationMetric({
      label: "Ruta óptima calculada",
      value: strategicContext.routeMonth,
      note: `${strategicContext.steps.length || 0} paso(s), coste ${money(strategicContext.routeCost, true)} y deuda reducida ${money(strategicContext.debtReduced, true)}.`,
      tone: "good",
    }),
    renderLiquidationMetric({
      label: "Caja mínima con ruta",
      value: money(strategicContext.finalPlan.minCaixa || 0, true),
      note: `Umbral operativo ${money(agentPlan.caixaFloor, true)}; reserva ${strategicContext.reserveOk ? "respetada" : "a revisar"}.`,
      tone: strategicContext.reserveOk ? "good" : "warn",
    }),
    renderLiquidationMetric({
      label: "Coche y estabilidad",
      value: strategicContext.carProject ? strategicContext.carProgress?.targetLabel || "Objetivo activo" : "Sin proyecto",
      note: strategicContext.carProject
        ? `Hucha ${money(strategicContext.carProgress?.projected || 0, true)} / ${money(strategicContext.carProgress?.amount || 0, true)}.`
        : "Crea el proyecto coche para cruzarlo con la ruta de deuda.",
      tone: "warn",
    }),
    renderLiquidationMetric({
      label: "Presión externa",
      value: money(asnefTotal, true),
      note: `ASNEF operativo; CIRBE mayo ${money(assumptions.cirbe.may2026.total, true)}. Wizink ya pactado: ${money(wizinkMonthly, true)}/mes.`,
      tone: "warn",
    }),
  ].join("");

  qs("debtPlanBestRoute").innerHTML = `${renderDebtPlanExecutiveHero(strategicContext)}
    ${renderDebtPlanActionBoard(strategicContext)}
    <div class="module-heading debt-route-heading">
      <div>
        <p class="panel-kicker">Marco de negociación</p>
        <h3>${best.complete ? "Ruta por golpes para CIRBE/ASNEF" : "Acumular antes de ejecutar"}</h3>
      </div>
      <span class="status-pill ${best.complete ? "good" : "warn"}">${best.complete ? "Viable" : "Vigilar"}</span>
    </div>
    <div class="debt-route-steps">
      <div><span>Ahora</span><strong>Separar fondo</strong><p>${money(Math.max(0, best.startingLiquidity - assumptions.targetReserve), true)} a liquidación y ${money(Math.min(best.startingLiquidity, assumptions.targetReserve), true)} de colchón.</p></div>
      <div><span>Golpe 1</span><strong>${best.g1Month || "Pendiente"}</strong><p>CaixaBank Payments: ${money(best.g1Cost, true)} estimados. Carrefour queda fuera por uso operativo.</p></div>
    <div><span>Demanda</span><strong>${best.demandMonth ? formatIsoDate(`${best.demandMonth}-01`) : "Sin ingreso"}</strong><p>Si entran ${money(best.demandAmount, true)}, 100% al fondo de liquidación.</p></div>
    <div><span>Golpe 2</span><strong>${best.g2Month || "Pendiente"}</strong><p>Bankinter completo: ${money(best.g2Cost, true)} estimados. Después, mantener hipotecas + Wizink pactado.</p></div>
    </div>
    ${renderDebtPlanStrategyFrame(optimization, agentPlan, connectedDebt)}
    ${renderLiquidationConnectedDecisions(connectedDebt)}`;

  qs("debtPlanSources").innerHTML = `<div class="module-heading">
      <div>
        <p class="panel-kicker">Fuentes y presión</p>
        <h3>Deuda externa y riesgos</h3>
      </div>
    </div>
    <div class="debt-source-list">
      <div><span>CIRBE dic 2025</span><strong>${money(assumptions.cirbe.december2025.total, true)}</strong><small>Riesgo dispuesto total.</small></div>
      <div><span>CIRBE mayo 2026</span><strong>${money(assumptions.cirbe.may2026.total, true)}</strong><small>Vencidos ${money(assumptions.cirbe.may2026.overdue, true)} + demora/gastos ${money(assumptions.cirbe.may2026.interest, true)}.</small></div>
      ${operativeAsnef
        .map((item) => `<div><span>${escapeHtml(item.entity)}</span><strong>${money(item.amount, true)}</strong><small>${item.rows} apunte(s) visibles en ASNEF.</small></div>`)
        .join("")}
      <div><span>Wizink</span><strong>${money(wizinkMonthly, true)}/mes</strong><small>Fuera del objetivo: ya pactado en cuota mensual.</small></div>
    </div>`;

  qs("debtPlanScenarios").innerHTML = renderDebtPlanPolicyCards(strategicContext, scenarios);

  qs("debtPlanTable").innerHTML = `<thead><tr>
      <th>Mes</th>
      <th>Libre</th>
      <th>Fondo</th>
      <th>Colchón</th>
      <th>Total</th>
      <th>Evento</th>
    </tr></thead>
    <tbody>
      ${best.timeline
        .slice(0, 18)
        .map((row) => `<tr class="${row.events.length ? "highlight" : ""}">
          <td>${escapeHtml(row.month)}</td>
          <td class="${row.free > 0 ? "positive" : "negative"}">${money(row.free, true)}</td>
          <td>${money(row.fund, true)}</td>
          <td>${money(row.reserve, true)}</td>
          <td><strong>${money(row.total, true)}</strong></td>
          <td>${row.events.length ? row.events.map(escapeHtml).join(" · ") : "-"}</td>
        </tr>`)
        .join("")}
    </tbody>`;
  if (!hasOptimization) scheduleHeavyAdvisorRefresh("debt-liquidation-plan");
  renderAcceleratedDebtPlan();
}
