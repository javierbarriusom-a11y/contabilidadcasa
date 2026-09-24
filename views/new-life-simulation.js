// ARQ-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2, segundo incremento, sesión 236; continúa T14 de
// BACKLOG_CONTABILIDADCASA_2_0.md): pantalla «Nueva vida» en modo simulación (`#new-life-simulation`),
// extraída de app.js con el mismo patrón `views/*.js` de carga diferida.
//
// T14 la dio por bloqueada de forma permanente (sesión 207, ver views/executive-advisor.js): decía que
// renderNewLifeSimulation() se llamaba sin guarda «desde varios manejadores de Plan/Ajustes»
// (addGob20IncomeAdjustment, removeGob20IncomeAdjustment, gob12ApplyPackageToReal). El cruce contra el
// código de hoy dice otra cosa: los tres manejadores cuelgan de controles que viven DENTRO de esta
// misma sección (`#gob20AdjustmentAdd`, el delegado `[data-gob20-remove]` sobre
// `qs("new-life-simulation")` y `#gob12ApplyRealBtn`; tests/gob20-ajuste-real-ingreso.test.cjs ya
// exige que GOB20 viva en new-life-simulation). Solo se pueden pulsar con la pantalla visible, y
// para entonces renderActiveSection() ya ha cargado este fichero. Aun así, las tres llamadas llevan
// ahora la guarda `viewChunkLoaded("new-life-simulation")`, por si algún día se cablean desde otro
// sitio: sin el fichero cargado la pantalla no está a la vista, y su DOM se pinta al entrar.
// renderNewLifeSimulation() no tiene efectos de estado que conservar (solo pinta su sección y, con
// la pantalla activa, programa scheduleHeavyAdvisorRefresh, que ya comprueba la vista activa).
//
// Lo que se movió: renderNewLifeSimulation(), su contexto newLifeContext(), los dos auxiliares que
// solo usa esta pantalla (newLifeActionButton, newLifePriorityDecision) y sus ocho renderizadores
// (héroe, KPI, acciones, historia familiar, escenarios, ruta de deuda, calendario, notas). Todos sus
// nodos de destino viven dentro de `<section id="new-life-simulation">`.
//
// Lo que NO se movió: el Laboratorio de escenarios E13 (renderE13ScenarioLab, sus eventos y sus
// widgets PVC/ESX) y los paneles GOB20/GOB12 (renderGob20IncomeAdjustments, addGob20IncomeAdjustment,
// gob12ApplyPackageToReal...). Pintan dentro de esta sección, pero son un sistema propio: comparten
// estado con Presupuesto del mes (e13ScenarioEvents, FCST-2 en views/presupuesto-mes.js), alimentan
// la calidad de predicción (PVC13/PVC17) y 21 ficheros de tests los extraen de app.js. Moverlos es
// otro incremento, con su propio cruce. Tampoco el motor compartido del cluster
// (executiveAdvisorContext, cachedAgentDebtOptimization, scheduleHeavyAdvisorRefresh...).

function newLifeContext({ allowHeavy = true } = {}) {
  const ctx = executiveAdvisorContext({ allowHeavy });
  const projectRecs = agentLifeProjectRecommendations(ctx.plan, { allowEvaluation: false });
  const debtSummary = routeSimulationSummaryFromActive(ctx.plan) || routeSimulationSummaryFromOptimization(ctx.debtOptimization);
  const first12 = ctx.rows.slice(0, 12);
  const minCaixaRow = first12.length
    ? first12.reduce((best, row) => (Number(row.agentCaixa || 0) < Number(best.agentCaixa || 0) ? row : best), first12[0])
    : null;
  const fixedPlans = (projectPlan?.placements || []).filter((item) => item.locked);
  const pendingPlans = (projectPlan?.placements || []).filter((item) => !item.locked);
  return {
    ...ctx,
    projectRecs,
    debtSummary,
    minCaixaRow,
    fixedPlans,
    pendingPlans,
  };
}

function newLifeActionButton(item) {
  if (item.action === "simulate-route") {
    return `<button type="button" data-new-life-action="simulate-route">${escapeHtml(item.label || "Simular")}</button>`;
  }
  if (item.action === "clear-route") {
    return `<button type="button" class="secondary" data-new-life-action="clear-route">${escapeHtml(item.label || "Retirar")}</button>`;
  }
  if (item.action === "car-project") {
    return `<button type="button" data-new-life-action="prepare-car-project">${escapeHtml(item.label || "Preparar coche")}</button>`;
  }
  if (item.action === "tere-credit") {
    return `<button type="button" data-new-life-action="prepare-tere-credit">${escapeHtml(item.label || "Simular crédito")}</button>`;
  }
  if (item.debtId) {
    return `<button type="button" data-new-life-debt-target="${escapeHtml(item.debtId)}" data-new-life-debt-month="${escapeHtml(String(item.monthIndex ?? ""))}" data-new-life-debt-amount="${escapeHtml(String(item.amount ?? ""))}">${escapeHtml(item.label || "Preparar")}</button>`;
  }
  return `<button type="button" data-home-nav="${escapeHtml(item.target || "visual-detail")}">${escapeHtml(item.label || "Abrir")}</button>`;
}

function newLifePriorityDecision(ctx) {
  if (Number(ctx.today.shortage || 0) > 0 || ctx.immediateTransfer?.needsReview) {
    return {
      tone: "danger",
      eyebrow: "Primero caja",
      title: "Bloquear decisiones nuevas hasta revisar saldo",
      text: ctx.immediateTransfer?.needsReview
        ? ctx.immediateTransfer.reviewReason
        : `Faltan ${money(ctx.today.shortage, true)} para cubrir reserva y pagos próximos. No compraría coche ni fijaría deuda hasta corregirlo.`,
      target: "cashflow",
      label: "Ver flujo",
    };
  }
  if (Number(ctx.immediateTransfer?.amount || 0) > 0) {
    return {
      tone: "good",
      eyebrow: "Acción de hoy",
      title: `Traspasar ${money(ctx.immediateTransfer.amount, true)} a Mediolanum`,
      text: `Después del traspaso CaixaBank quedaría en ${money(ctx.immediateTransfer.caixaAfter, true)} y Mediolanum en ${money(ctx.immediateTransfer.mediolanumAfter, true)}. Reserva protegida: ${money(ctx.immediateTransfer.reserve, true)}.`,
      target: "savings-agent",
      label: "Ver detalle",
    };
  }
  if (ctx.debtSummary?.active) {
    return {
      tone: "warn",
      eyebrow: "Ruta ya simulada",
      title: `Revisar ${ctx.debtSummary.count} paso(s) de deuda antes de fijar`,
      text: `La ruta cargada impacta cuadro de mandos y flujo hasta ${ctx.debtSummary.lastMonth}. Fija solo los acuerdos cerrados; retira lo que sea prueba.`,
      target: "visual-detail",
      label: "Ver impacto",
    };
  }
  if (ctx.debtOptimization?.steps?.length) {
    return {
      tone: "warn",
      eyebrow: "Siguiente decisión",
      title: "Simular la ruta completa de deuda",
      text: `${ctx.debtOptimization.steps.length} paso(s), ${money(ctx.debtOptimization.totalPrincipal, true)} pactados hasta ${ctx.debtOptimization.lastMonth}. Es el criterio maestro antes de decidir coche.`,
      action: "simulate-route",
      label: "Simular ruta",
    };
  }
  if (ctx.carReserveGap > 0) {
    return {
      tone: "good",
      eyebrow: "Coche",
      title: "Crear colchón específico antes de comprar",
      text: `Faltan ${money(ctx.carReserveGap, true)} para el colchón coche de ${money(ctx.settings.carReserve, true)}. Hucha sugerida: ${money(ctx.carMonthlyPot, true)}/mes.`,
      action: "car-project",
      label: "Preparar hucha",
    };
  }
  return {
    tone: "good",
    eyebrow: "Plan estable",
    title: "Mantener disciplina y negociar deudas pendientes",
    text: "El tablero no detecta una urgencia de caja. Prioridad: cerrar acuerdos con quita sin comprometer la reserva operativa.",
    target: "debt-control",
    label: "Ver deudas",
  };
}

function renderNewLifeHero(ctx) {
  const target = qs("newLifeHero");
  if (!target) return;
  const decision = newLifePriorityDecision(ctx);
  target.className = `new-life-hero ${decision.tone}`;
  target.innerHTML = `<div class="new-life-hero-main">
      <span>${escapeHtml(decision.eyebrow)}</span>
      <h2>${escapeHtml(decision.title)}</h2>
      <p>${escapeHtml(decision.text)}</p>
      ${newLifeActionButton(decision)}
    </div>
    <div class="new-life-hero-metrics">
      <div><span>CaixaBank protegido</span><strong>${money(ctx.immediateTransfer?.caixaAfter ?? ctx.balances.caixa, true)}</strong><small>${state.balanceDate || defaultBalanceDate()}</small></div>
      <div><span>Mediolanum objetivo</span><strong>${money(ctx.immediateTransfer?.mediolanumAfter ?? ctx.balances.mediolanum, true)}</strong><small>ahorro + huchas</small></div>
      <div><span>Deuda en ruta</span><strong>${ctx.debtSummary ? money(ctx.debtSummary.total, true) : money(0, true)}</strong><small>${ctx.debtSummary?.active ? "simulada" : "sugerida"}</small></div>
    </div>`;
}

function renderNewLifeKpis(ctx) {
  const target = qs("newLifeKpis");
  if (!target) return;
  const minLabel = ctx.minCaixaRow ? `${ctx.minCaixaRow.month} · ${ctx.minCaixaRow.transferDateLabel || "cierre"}` : "sin fecha";
  const routeDebt = ctx.debtSummary?.total || ctx.debtOptimization?.totalPrincipal || 0;
  const cards = [
    ["Reserva CaixaBank", money(ctx.plan.caixaFloor, true), "Límite mínimo configurable antes de traspasar o ejecutar decisiones."],
    ["Traspaso prudente hoy", money(ctx.immediateTransfer?.amount || 0, true), ctx.immediateTransfer?.needsReview ? "Pendiente de confirmar saldo real." : "Solo si cubre pagos del mes siguiente."],
    ["Coche: colchón pendiente", money(ctx.carReserveGap, true), ctx.carReserveMonth?.month ? `Objetivo alcanzable en ${ctx.carReserveMonth.month}.` : "Aún no alcanzado en el horizonte."],
    ["Deuda potencial a atacar", money(routeDebt, true), ctx.debtSummary ? `${ctx.debtSummary.count} paso(s), hasta ${ctx.debtSummary.lastMonth}.` : "Sin ruta calculada."],
    ["Caja mínima 12m", money(ctx.minCaixaRow?.agentCaixa || 0, true), minLabel],
    ["Capacidad libre media", money(ctx.capacity.avgTransfer12m || 0, true), "Media 12m tras gastos, deuda, proyectos y ahorro objetivo."],
  ];
  target.innerHTML = cards
    .map(([label, value, note]) => `<article class="new-life-kpi">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(note)}</p>
    </article>`)
    .join("");
}

function renderNewLifeActions(ctx) {
  const target = qs("newLifeActions");
  if (!target) return;
  const actions = [];
  const primary = newLifePriorityDecision(ctx);
  actions.push({ ...primary, rank: 1, label: primary.label || "Abrir" });
  if (ctx.debtSummary?.active) {
    actions.push({
      rank: 2,
      tone: "warn",
      title: "Ruta de deuda en modo prueba",
      text: `${ctx.debtSummary.count} impacto(s) están incluidos en saldos. Fija acuerdos cerrados o retira la simulación antes de presentar el plan.`,
      action: "clear-route",
      label: "Retirar prueba",
    });
  } else if (ctx.debtOptimization?.steps?.length) {
    actions.push({
      rank: 2,
      tone: "warn",
      title: "Aplicar criterio Plan deuda óptimo",
      text: `${money(ctx.debtOptimization.totalPrincipal, true)} pactados, ${money(ctx.debtOptimization.totalRelief, true)} de mejora por quitas, cierre ${ctx.debtOptimization.lastMonth}.`,
      action: "simulate-route",
      label: "Ver impacto",
    });
  }
  actions.push({
    rank: 3,
    tone: ctx.safeCredit ? "good" : "danger",
    title: "Decidir coche sin romper caja",
    text: ctx.safeCredit
      ? `La financiación de Tere parece prudente con cuota ${money(ctx.settings.tereCreditPayment, true)}: ratio ${ctx.debtRatio.toFixed(1)}% -> ${ctx.debtRatioWithTere.toFixed(1)}%.`
      : `Antes del crédito, revisa cuota: ratio estimado ${ctx.debtRatioWithTere.toFixed(1)}% y límite prudente 32%.`,
    action: ctx.safeCredit ? "tere-credit" : "car-project",
    label: ctx.safeCredit ? "Simular crédito" : "Preparar hucha",
  });
  actions.push({
    rank: 4,
    tone: "neutral",
    title: "Explicar el plan familiar",
    text: "Primero caja operativa, después acuerdos de deuda con quita, y coche cuando Mediolanum soporte entrada o financiación segura.",
    target: "executive-advisor",
    label: "Ver asesor",
  });
  target.innerHTML = actions
    .map((item) => `<article class="new-life-action ${item.tone}">
      <span>${item.rank}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.text)}</p>
      </div>
      ${newLifeActionButton(item)}
    </article>`)
    .join("");
}

function renderNewLifeFamilyStory(ctx) {
  const target = qs("newLifeFamilyStory");
  if (!target) return;
  const nextDebt = ctx.debtOptimization?.steps?.[0];
  const project = ctx.projectRecs?.[0];
  const lines = [
    `Hoy la cuenta operativa debe conservar ${money(ctx.immediateTransfer?.reserve || ctx.plan.caixaFloor, true)} antes de mover dinero a Mediolanum.`,
    nextDebt
      ? `La primera deuda sugerida por el criterio óptimo es ${debtTargetDisplayName(nextDebt.candidate)} en ${nextDebt.monthLabel}, por ${money(nextDebt.candidate.principal, true)}.`
      : "No hay una deuda prioritaria pendiente dentro del plan calculado.",
    project
      ? `El primer proyecto de vida pendiente es ${project.name}, con hucha aproximada de ${money(project.pot, true)}/mes y objetivo ${project.monthLabel}.`
      : "No hay proyectos de vida pendientes; el coche queda como objetivo principal de hucha.",
    ctx.safeCredit
      ? "El crédito de Tere se puede usar como palanca si se mantiene el ratio de deuda por debajo del umbral y no sustituye el colchón."
      : "La financiación externa para coche debe ajustarse o esperar: ahora no es la opción más prudente con los parámetros actuales.",
  ];
  target.innerHTML = `<ol>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol>`;
}

function renderNewLifeScenarios(ctx) {
  const target = qs("newLifeScenarios");
  if (!target) return;
  const base = ctx.debtOptimization?.baselinePlan || ctx.plan;
  const debtPlan = ctx.debtOptimization?.finalPlan || ctx.plan;
  const scenarioCards = [
    {
      title: "Base sin decisiones nuevas",
      badge: "referencia",
      main: money(base.finalTotal || ctx.plan.finalTotal || 0, true),
      rows: [
        ["Caja mínima", money(base.minCaixa || 0, true)],
        ["Deuda pendiente", money(base.remainingDebt || 0, true)],
        ["Mediolanum final", money(base.finalMediolanum || 0, true)],
      ],
    },
    {
      title: "Deuda óptima",
      badge: ctx.debtSummary?.active ? "simulada" : "sugerida",
      main: money(debtPlan.finalTotal || 0, true),
      rows: [
        ["Último pago", ctx.debtOptimization?.lastMonth || "-"],
        ["Deuda reducida", money(ctx.debtSummary?.debtReduced || ctx.debtOptimization?.totalOriginalPrincipal || 0, true)],
        ["Mejora neta", money(ctx.debtSummary?.netWorthDelta ?? ctx.debtOptimization?.netWorthDelta ?? 0, true)],
      ],
    },
    {
      title: "Coche con hucha",
      badge: "prudente",
      main: ctx.carReserveMonth?.month || "No alcanzado",
      rows: [
        ["Coste coche", money(ctx.settings.carCost, true)],
        ["Colchón coche", money(ctx.settings.carReserve, true)],
        ["Hucha sugerida", `${money(ctx.carMonthlyPot, true)}/mes`],
      ],
    },
    {
      title: "Coche con crédito Tere",
      badge: ctx.safeCredit ? "viable" : "vigilar",
      main: money(ctx.settings.tereCreditCapital, true),
      rows: [
        ["Cuota", `${money(ctx.settings.tereCreditPayment, true)}/mes`],
        ["Ratio deuda", `${ctx.debtRatio.toFixed(1)}% -> ${ctx.debtRatioWithTere.toFixed(1)}%`],
        ["Mes coche", ctx.carWithCreditMonth?.month || "No alcanzado"],
      ],
    },
  ];
  target.innerHTML = scenarioCards
    .map((card) => `<article class="new-life-scenario-card">
      <div><span>${escapeHtml(card.badge)}</span><strong>${escapeHtml(card.title)}</strong></div>
      <h4>${escapeHtml(card.main)}</h4>
      ${card.rows.map(([label, value]) => `<p><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></p>`).join("")}
    </article>`)
    .join("");
}

function renderNewLifeDebtRoute(ctx) {
  const target = qs("newLifeDebtRoute");
  if (!target) return;
  const steps = ctx.debtOptimization?.steps || [];
  if (!steps.length) {
    target.innerHTML = `<div class="empty-state compact">No hay deudas optimizables pendientes. Mantén la reserva y usa Mediolanum para proyectos.</div>`;
    return;
  }
  target.innerHTML = steps.slice(0, 7)
    .map((step) => `<article class="new-life-debt-step">
      <span>${step.order}</span>
      <div>
        <strong>${escapeHtml(debtTargetDisplayName(step.candidate))}</strong>
        <p>${escapeHtml(step.candidate.number || "")} · ${escapeHtml(debtTargetIsSuspended(step.candidate) ? "pagos suspendidos: reduce deuda, no crea ingreso" : `libera ${money(step.candidate.effectiveRelief || 0, true)}/mes`)}</p>
      </div>
      <dl>
        <div><dt>Mes</dt><dd>${escapeHtml(step.monthLabel)}</dd></div>
        <div><dt>Pactado</dt><dd>${money(step.candidate.principal, true)}</dd></div>
      </dl>
      <button type="button" data-new-life-debt-target="${escapeHtml(step.candidate.id)}" data-new-life-debt-month="${escapeHtml(String(step.monthIndex))}" data-new-life-debt-amount="${escapeHtml(String(step.candidate.principal))}">Preparar</button>
    </article>`)
    .join("");
}

function renderNewLifeTimeline(ctx) {
  const target = qs("newLifeTimeline");
  if (!target) return;
  const debtByMonth = new Map();
  (ctx.debtOptimization?.steps || []).forEach((step) => {
    if (!debtByMonth.has(step.monthIndex)) debtByMonth.set(step.monthIndex, []);
    debtByMonth.get(step.monthIndex).push(`Deuda: ${debtTargetDisplayName(step.candidate)} (${money(step.candidate.principal, true)})`);
  });
  const projectByMonth = new Map();
  (ctx.projectRecs || []).forEach((project) => {
    if (!projectByMonth.has(project.targetIndex)) projectByMonth.set(project.targetIndex, []);
    projectByMonth.get(project.targetIndex).push(`Proyecto: ${project.name} (${money(project.amount, true)})`);
  });
  target.innerHTML = `<thead><tr>
    <th>Mes</th>
    <th>Resultado</th>
    <th>Traspaso</th>
    <th>CaixaBank</th>
    <th>Mediolanum</th>
    <th>Decisión</th>
  </tr></thead>
  <tbody>
    ${ctx.rows.slice(0, 12)
      .map((row, index) => {
        const events = [...(debtByMonth.get(index) || []), ...(projectByMonth.get(index) || [])];
        return `<tr class="${events.length ? "highlight" : ""}">
          <td><strong>${escapeHtml(row.month)}</strong><small>${escapeHtml(row.transferDateLabel || "")}</small></td>
          <td class="${Number(row.operatingResult || 0) >= 0 ? "positive" : "negative"}">${money(row.operatingResult || 0, true)}</td>
          <td>${money(row.transferToSavings || 0, true)}</td>
          <td>${money(row.agentCaixa || 0, true)}</td>
          <td>${money(row.agentMediolanum || 0, true)}</td>
          <td>${events.length ? events.map(escapeHtml).join(" · ") : "-"}</td>
        </tr>`;
      })
      .join("")}
  </tbody>`;
}

function renderNewLifeDecisionNotes(ctx) {
  const target = qs("newLifeDecisionNotes");
  if (!target) return;
  const notes = [
    `El criterio de deuda usado aquí es el de Plan deuda óptimo: prioriza quitas, limpieza de ASNEF/CIRBE y caja mínima de ${money(ctx.plan.caixaFloor, true)}.`,
    "Las deudas con pagos suspendidos reducen deuda al liquidarlas, pero no se tratan como ingreso mensual adicional si no se estaban pagando.",
    `El coche no debería ejecutarse si deja CaixaBank por debajo de la reserva o si Mediolanum no puede sostener el colchón de ${money(ctx.settings.carReserve, true)}.`,
    "Toda decisión permanece como simulación hasta fijarla. Así puedes explicar el plan, compararlo y confirmar solo lo que esté acordado.",
  ];
  target.innerHTML = notes.map((note) => `<article>${escapeHtml(note)}</article>`).join("");
}

function renderNewLifeSimulation({ forceHeavy = false } = {}) {
  if (!qs("newLifeHero")) return;
  const hasOptimization = Boolean(cachedAgentDebtOptimization());
  const ctx = newLifeContext({ allowHeavy: forceHeavy || hasOptimization });
  renderNewLifeHero(ctx);
  renderNewLifeKpis(ctx);
  renderNewLifeActions(ctx);
  renderNewLifeFamilyStory(ctx);
  renderNewLifeScenarios(ctx);
  renderNewLifeDebtRoute(ctx);
  renderNewLifeTimeline(ctx);
  renderNewLifeDecisionNotes(ctx);
  renderE13ScenarioLab();
  renderGob20IncomeAdjustments();
  if (!hasOptimization && !forceHeavy) scheduleHeavyAdvisorRefresh("new-life-simulation");
}
