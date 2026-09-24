// ARQ-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2, tercer incremento, sesión 237; continúa T14 de
// BACKLOG_CONTABILIDADCASA_2_0.md): pantalla «Agente de ahorro» (`#savings-agent`), extraída de app.js
// con el mismo patrón `views/*.js` de carga diferida.
//
// T14 la dio por bloqueada (sesión 207): renderSavingsAgent() se llamaba sin guarda desde
// applyAgentRouteSimulation(), que se dispara desde Hoy (centro de acciones unificado, «simular ruta»)
// y desde Ejecutivo, Nueva vida, Plan de deuda y Asesor virtual — en sus dos salidas «no hay nada que
// aplicar» repintaba esta pantalla aunque no estuviera abierta. El bloqueo era real, pero del patrón de
// refresco, igual que en Conciliación (sesión 233): las cuatro llamadas de app.js llevan ahora la guarda
// `viewChunkLoaded("savings-agent")`. Sin el fichero cargado la pantalla no está a la vista, así que no
// hay nada que repintar; y renderSavingsAgent() no tiene efectos de estado que conservar — solo pinta
// nodos de su sección y calienta cachés (plan del agente, optimización) que se recalculan por firma al
// entrar. El `change` de `#agentYear` pasa a una función flecha para no leer el global al cablear.
//
// Lo que se movió: renderSavingsAgent() y los 17 auxiliares que solo usa esta pantalla (selector de
// año, filas por año, tarjetas «hoy», plan trimestral, cola de prioridades, tablero de decisiones,
// resumen ejecutivo, controles del optimizador, panel de ruta simulada, tabla anual, tarjetas de
// recomendación...). Todos sus nodos de destino viven dentro de `<section id="savings-agent">`.
//
// Lo que NO se movió, porque lo comparten otras pantallas o Hoy: el motor del agente
// (buildSavingsAgentPlan, agentOptimalDebtPayoffPlan y su caché, agentDebtRecommendations,
// agentLifeProjectRecommendations, la ruta simulada, prepareAgentDebtDecision...), sus ajustes
// (agentCaixaFloor & cía., que leen Hoy, Registrar y el Laboratorio) y executiveToneForAmount (lo usa
// views/virtual-advisor.js). El núcleo puro del motor — la regla mensual de traspaso y rescate entre
// CaixaBank y Mediolanum — vive desde esta misma sesión en canonical-savings-agent.js, con sus tests.

function agentYears(plan) {
  return [...new Set(agentVisibleRows(plan).map((row) => String(cashflowYear(row))))].filter(Boolean);
}

function populateAgentYearSelect(plan) {
  const select = qs("agentYear");
  if (!select) return;
  const years = agentYears(plan);
  const previous = select.value;
  select.innerHTML = years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join("");
  select.value = years.includes(previous) ? previous : years[0] || "";
}

function agentRowsForYear(plan, year) {
  return agentVisibleRows(plan).filter((row) => String(cashflowYear(row)) === String(year));
}

function agentInsightCards(plan, debtRecs, projectRecs) {
  const rows = agentVisibleRows(plan);
  const firstShortage = rows.find((row) => row.shortage > 0);
  const nextTransfer = rows.find((row) => row.transferToSavings > 0);
  const topDebt = debtRecs[0];
  const topProject = projectRecs[0];
  const cards = [];
  cards.push({
    title: firstShortage ? "Hay meses sin caja suficiente" : "Regla de caja viable",
    text: firstShortage
      ? `${firstShortage.month}: faltarían ${money(firstShortage.shortage, true)} para cubrir la reserva operativa del mes siguiente. Revisa proyectos o ahorro antes de fijar más decisiones.`
      : `CaixaBank retiene ${money(plan.caixaFloor, true)} más los pagos previstos del mes siguiente. Primer traspaso posible: ${nextTransfer ? `${money(nextTransfer.transferToSavings, true)} en ${nextTransfer.month} (${nextTransfer.transferDateLabel || "fin de mes"})` : "sin excedente próximo"}.`,
    tone: firstShortage ? "danger" : "good",
  });
  cards.push({
    title: topDebt ? "Mejor deuda candidata" : "Sin deuda candidata",
    text: topDebt
      ? `${topDebt.entity} ${topDebt.type}: ${money(topDebt.principal, true)}. El ahorro la cubriría en ${topDebt.monthLabel}; cuota liberable ${money(topDebt.payment, true)}.`
      : "No hay deuda viva sin plan cargado. El agente priorizará proyectos o colchón.",
    tone: topDebt ? "warn" : "good",
  });
  cards.push({
    title: topProject ? "Proyecto de vida más cercano" : "Sin proyectos pendientes",
    text: topProject
      ? `${topProject.name}: hucha sugerida ${money(topProject.pot, true)}/mes; objetivo alcanzable en ${topProject.monthLabel}.`
      : "Añade proyectos en el simulador para que el agente calcule huchas, fecha objetivo y modalidad.",
    tone: topProject ? "good" : "neutral",
  });
  return cards;
}

function agentTodayCards(plan) {
  const rows = agentVisibleRows(plan);
  const today = rows[0] || {};
  const next = rows[1] || {};
  const immediate = immediateSavingsTransfer(plan, rows);
  const transferableNow = immediate.needsReview ? 0 : Math.max(0, Number(immediate.amount || 0));
  const reserveGap = Math.max(0, round2(Number(today.requiredReserve || plan.caixaFloor) - Number(today.agentCaixa || 0)));
  const nextOutflows = Number(next.outflowsBeforeSaving || 0);
  return [
    {
      label: immediate.needsReview ? "Revisar saldo antes de traspasar" : "Puedes traspasar hoy",
      value: money(transferableNow, true),
      detail: immediate.needsReview
        ? immediate.reviewReason
        : transferableNow
          ? `Saldo actual CaixaBank menos reserva ${money(immediate.reserve, true)}; cubre ${money(nextOutflows, true)} del mes siguiente.`
          : "No hay excedente seguro; conserva la caja operativa.",
      tone: immediate.needsReview ? "danger" : transferableNow ? "good" : "warn",
    },
    {
      label: "Reserva protegida",
      value: money(today.requiredReserve || plan.caixaFloor, true),
      detail: `Saldo operativo ${money(plan.caixaFloor, true)} + pagos previstos del próximo mes.`,
      tone: reserveGap ? "danger" : "good",
    },
    {
      label: "Resultado del mes",
      value: money(today.operatingResult || 0, true),
      detail: `${escapeHtml(today.month || "Mes actual")} · cobros hasta ${today.lastIncomeDateLabel || today.mainPayrollDateLabel || "fin de mes"}; antes del traspaso automático.`,
      tone: Number(today.operatingResult || 0) >= 0 ? "good" : "danger",
    },
    {
      label: "Ahorro disponible",
      value: money(today.agentMediolanum || 0, true),
      detail: "Mediolanum tras aplicar traspasos/rescates del mes.",
      tone: "neutral",
    },
  ];
}

function renderAgentToday(plan) {
  const target = qs("agentToday");
  if (!target) return;
  target.innerHTML = agentTodayCards(plan)
    .map(
      (card) => `<article class="agent-today-card ${card.tone}">
        <span>${escapeHtml(card.label)}</span>
        <strong>${card.value}</strong>
        <p>${escapeHtml(card.detail)}</p>
      </article>`,
    )
    .join("");
}

function renderAgentQuarterPlan(plan) {
  const target = qs("agentQuarterPlan");
  if (!target) return;
  const rows = agentVisibleRows(plan).slice(0, 3);
  target.innerHTML = rows.length
    ? rows
        .map((row) => {
          const status = agentStatusForRow(row);
          return `<article class="agent-month-card ${status.tone}">
            <div>
              <span>${escapeHtml(row.month)}</span>
              <strong>${escapeHtml(status.label)}</strong>
            </div>
            <dl>
              <div><dt>Resultado</dt><dd class="${row.operatingResult < 0 ? "negative" : "positive"}">${money(row.operatingResult, true)}</dd></div>
              <div><dt>Reserva</dt><dd>${money(row.requiredReserve, true)}</dd></div>
              <div><dt>Traspaso</dt><dd class="positive">${money(row.transferToSavings, true)}<small>${escapeHtml(row.transferDateLabel || "cierre de mes")}</small></dd></div>
              <div><dt>Mediolanum</dt><dd>${money(row.agentMediolanum, true)}</dd></div>
            </dl>
          </article>`;
        })
        .join("")
    : `<div class="empty-state compact">Sin meses suficientes para agenda.</div>`;
}

function agentPriorityQueue(plan, debtRecs, projectRecs) {
  const queue = [];
  const rows = agentVisibleRows(plan);
  const firstShortage = rows.find((row) => row.shortage > 0);
  const firstTransfer = rows.find((row) => row.transferToSavings > 0);
  if (firstShortage) {
    queue.push({
      tone: "danger",
      title: "Proteger caja antes de decidir",
      meta: `${firstShortage.month}: faltan ${money(firstShortage.shortage, true)} frente a la reserva del mes siguiente.`,
      action: "Revisar simulador",
      target: "simulator",
      score: 10000,
    });
  } else {
    queue.push({
      tone: "good",
      title: "Traspaso prudente a Mediolanum",
      meta: firstTransfer
        ? `${money(firstTransfer.transferToSavings, true)} el ${firstTransfer.transferDateLabel || firstTransfer.month}, manteniendo pagos del mes siguiente cubiertos.`
        : "Sin excedente inmediato: esperar al próximo ingreso antes de mover ahorro.",
      action: "Ver evolución",
      target: "savings-agent",
      score: 9000,
    });
  }
  debtRecs.slice(0, 3).forEach((item, index) => {
    const suspended = debtTargetIsSuspended(item);
    queue.push({
      tone: suspended ? "warn" : item.affordability ? "good" : "warn",
      title: `${suspended ? "Negociar" : "Liquidar"} ${item.entity} ${item.type}`,
      meta: suspended
        ? `${money(item.principal, true)} pendiente y pagos suspendidos: buscar quita/reunificación; no cuenta como cuota liberable.`
        : `${money(item.principal, true)}; mes sugerido ${item.monthLabel}; cuota liberable ${money(item.payment, true)}.`,
      action: "Preparar deuda",
      debtId: item.id,
      score: 7000 - index * 100 + item.score,
    });
  });
  projectRecs.slice(0, 3).forEach((item, index) => {
    queue.push({
      tone: item.affordability ? "good" : "warn",
      title: `Hucha ${item.name}`,
      meta: `${money(item.pot, true)}/mes hasta ${item.monthLabel}; acumulado previsto ${money(item.progress?.projected || 0, true)}; faltan ${money(item.progress?.remainingAtTarget || 0, true)}.`,
      action: "Revisar proyecto",
      projectId: item.id,
      score: 6200 - index * 100 - Number(item.targetIndex || 0),
    });
  });
  return queue.sort((a, b) => b.score - a.score).slice(0, 7);
}

function renderAgentPriorityQueue(plan, debtRecs, projectRecs) {
  const target = qs("agentPriorityQueue");
  if (!target) return;
  const queue = agentPriorityQueue(plan, debtRecs, projectRecs);
  target.innerHTML = queue.length
    ? queue
        .map(
          (item, index) => `<article class="agent-priority-card ${item.tone}">
            <span>${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.meta)}</p>
            </div>
            ${
              item.debtId
                ? `<button type="button" data-agent-debt-target="${escapeHtml(item.debtId)}">${escapeHtml(item.action)}</button>`
                : item.projectId
                  ? `<button type="button" data-agent-project-id="${escapeHtml(item.projectId)}">${escapeHtml(item.action)}</button>`
                  : `<button type="button" data-home-nav="${escapeHtml(item.target || "savings-agent")}">${escapeHtml(item.action)}</button>`
            }
          </article>`,
        )
        .join("")
    : `<div class="empty-state compact">Sin acciones recomendadas ahora mismo.</div>`;
}

function renderAgentDecisionBoard(plan, debtRecs, projectRecs) {
  const target = qs("agentDecisionBoard");
  if (!target) return;
  const capacity = agentTwelveMonthCapacity(plan);
  const rows = agentVisibleRows(plan);
  const immediate = immediateSavingsTransfer(plan, rows);
  const topDebt = debtRecs[0];
  const topProject = projectRecs[0];
  const nextDecision = topDebt && (!topProject || topDebt.score > 7200)
    ? {
        title: `Preparar deuda: ${topDebt.entity}`,
        value: money(topDebt.principal, true),
        detail: `${topDebt.monthLabel}. ${debtTargetIsSuspended(topDebt) ? "Negociar quita/reunificación; no imputar ahorro ficticio." : `Cuota liberable ${money(topDebt.payment, true)}.`}`,
        tone: "warn",
        action: "Preparar deuda",
        debtId: topDebt.id,
      }
    : topProject
      ? {
          title: `Hucha: ${topProject.name}`,
          value: money(topProject.progress?.remainingAtTarget ?? topProject.amount, true),
          detail: `${money(topProject.pot, true)}/mes hasta ${topProject.monthLabel}. Acumulado previsto ${money(topProject.progress?.projected || 0, true)}.`,
          tone: "good",
          action: "Revisar proyecto",
          projectId: topProject.id,
        }
      : {
          title: "Sin decisión urgente",
          value: "Esperar",
          detail: "No hay deuda o proyecto pendiente con mejor prioridad que proteger caja y transferir ahorro.",
          tone: "neutral",
          action: "Ver plan",
          target: "savings-agent",
        };
  const cards = [
    {
      title: immediate.needsReview ? "Revisar saldo" : "Traspaso prudente ahora",
      value: money(immediate.needsReview ? 0 : immediate.amount || 0, true),
      detail: immediate.needsReview
        ? immediate.reviewReason
        : `Después de reservar ${money(immediate.reserve, true)} para CaixaBank.`,
      tone: immediate.needsReview ? "danger" : Number(immediate.amount || 0) > 0 ? "good" : "warn",
    },
    {
      title: nextDecision.title,
      value: nextDecision.value,
      detail: nextDecision.detail,
      tone: nextDecision.tone,
      action: nextDecision.action,
      debtId: nextDecision.debtId,
      projectId: nextDecision.projectId,
      target: nextDecision.target,
    },
    {
      title: "Capacidad 12 meses",
      value: money(capacity.totalTransfer12m, true),
      detail: `Media mensual transferible ${money(capacity.avgTransfer12m, true)}; resultado acumulado ${money(capacity.totalResult12m, true)}.`,
      tone: capacity.totalTransfer12m > 0 ? "good" : "warn",
    },
    {
      title: capacity.firstShortage ? "Riesgo de caja" : "Margen mínimo de caja",
      value: capacity.firstShortage ? money(capacity.firstShortage.shortage, true) : money((capacity.lowestReserveRow?.agentCaixa || 0) - (capacity.lowestReserveRow?.requiredReserve || 0), true),
      detail: capacity.firstShortage
        ? `${capacity.firstShortage.month}: falta frente a la reserva del mes siguiente.`
        : `${capacity.lowestReserveRow?.month || "Plan"} mantiene CaixaBank sobre la reserva definida.`,
      tone: capacity.firstShortage ? "danger" : "good",
    },
  ];
  target.innerHTML = cards
    .map(
      (card) => `<article class="agent-decision-card ${card.tone}">
        <span>${escapeHtml(card.title)}</span>
        <strong>${card.value}</strong>
        <p>${escapeHtml(card.detail)}</p>
        ${
          card.debtId
            ? `<button type="button" data-agent-debt-target="${escapeHtml(card.debtId)}">${escapeHtml(card.action)}</button>`
            : card.projectId
              ? `<button type="button" data-agent-project-id="${escapeHtml(card.projectId)}">${escapeHtml(card.action)}</button>`
              : card.target
                ? `<button type="button" data-home-nav="${escapeHtml(card.target)}">${escapeHtml(card.action)}</button>`
                : ""
        }
      </article>`,
    )
    .join("");
}

function renderAgentExecutive(plan, debtRecs, projectRecs, debtOptimization) {
  const target = qs("agentExecutive");
  if (!target) return;
  const rows = agentVisibleRows(plan);
  const today = rows[0] || {};
  const nextMonth = rows[1] || {};
  const immediate = immediateSavingsTransfer(plan, rows);
  const planSummary = agentPlanSummary(plan);
  const capacity = agentTwelveMonthCapacity(plan);
  const firstDebtStep = debtOptimization?.steps?.[0] || null;
  const bestDebt = firstDebtStep?.candidate || debtRecs[0] || null;
  const bestProject = projectRecs[0] || null;
  const marginNow = round2(Number(immediate.caixaNow || 0) - Number(immediate.reserve || plan.caixaFloor));
  const nextImpactText = planSummary.nextImpactAmount
    ? `${money(planSummary.nextImpactAmount, true)} en ${planSummary.nextImpactMonth}`
    : "Sin impactos próximos cargados";
  const immediateActions = [];

  if (today.shortage > 0) {
    immediateActions.push({
      tone: "danger",
      title: "No traspasar todavía",
      meta: `${today.month}: faltan ${money(today.shortage, true)} frente a la reserva operativa. Revisa gastos/proyectos antes de fijar más decisiones.`,
      action: "Ver simulador",
      target: "simulator",
    });
  } else if (immediate.needsReview) {
    immediateActions.push({
      tone: "danger",
      title: "Revisar saldo antes de traspasar",
      meta: immediate.reviewReason,
      action: "Ver saldos",
      target: "visual-detail",
    });
  } else if (immediate.amount > 0) {
    immediateActions.push({
      tone: "good",
      title: "Traspaso seguro a Mediolanum",
      meta: `Mover ${money(immediate.amount, true)} hoy y dejar CaixaBank cubriendo ${money(immediate.reserve, true)}.`,
      action: "Ver flujo",
      target: "cashflow",
    });
  } else {
    immediateActions.push({
      tone: "warn",
      title: "Esperar a próximo ingreso",
      meta: `Hoy la caja queda justa. Próximo cierre de cobros: ${today.lastIncomeDateLabel || today.mainPayrollDateLabel || today.month}. Mantén CaixaBank en ${money(today.requiredReserve || plan.caixaFloor, true)} antes de transferir ahorro.`,
      action: "Ver previsión",
      target: "forecast",
    });
  }

  if (bestDebt) {
    const monthLabel = firstDebtStep?.monthLabel || bestDebt.monthLabel || "mes por calcular";
    const pactado = firstDebtStep?.candidate?.principal ?? bestDebt.principal;
    const original = firstDebtStep?.candidate?.originalPrincipal ?? bestDebt.originalPrincipal ?? bestDebt.principal;
    const agreementText = original && original > pactado ? ` · quita ${money(original - pactado, true)}` : "";
    immediateActions.push({
      tone: "warn",
      title: `Preparar deuda: ${bestDebt.entity} ${bestDebt.type}`,
      meta: `${money(pactado, true)} en ${monthLabel}${agreementText}. Pagos suspendidos: no sumar cuota liberada como ingreso si no se paga ahora.`,
      action: "Preparar deuda",
      debtId: bestDebt.id,
    });
  }

  if (bestProject) {
    immediateActions.push({
      tone: "good",
      title: `Hucha/proyecto: ${bestProject.name}`,
      meta: `${money(bestProject.pot, true)}/mes hasta ${bestProject.monthLabel}. Acumulado previsto ${money(bestProject.progress?.projected || 0, true)}.`,
      action: "Revisar proyecto",
      projectId: bestProject.id,
    });
  }

  if (!bestDebt && !bestProject && today.shortage <= 0) {
    immediateActions.push({
      tone: "neutral",
      title: "Sin decisión nueva urgente",
      meta: "Prioriza traspaso automático y mantenimiento de colchón. Añade proyectos o acuerdos para que el agente proponga ruta.",
      action: "Añadir proyecto",
      target: "simulator",
    });
  }
  const mergedActions = immediateActions.slice();
  agentPriorityQueue(plan, debtRecs, projectRecs).forEach((item) => {
    const duplicate = mergedActions.some((existing) =>
      (item.debtId && existing.debtId === item.debtId) ||
      (item.projectId && existing.projectId === item.projectId) ||
      (normalizedText(item.title).includes("traspaso") && normalizedText(existing.title).includes("traspaso")) ||
      (!item.debtId && !item.projectId && existing.target === item.target && existing.action === item.action),
    );
    if (!duplicate) mergedActions.push(item);
  });

  const guardrails = [
    {
      label: "Margen caja hoy",
      value: money(marginNow, true),
      tone: marginNow >= 0 ? "good" : "danger",
      note: `Sobre reserva de ${money(immediate.reserve || plan.caixaFloor, true)}.`,
    },
    {
      label: "Pagos mes siguiente",
      value: money(Math.max(0, Number(nextMonth.outflowsBeforeSaving || 0)), true),
      tone: "neutral",
      note: nextMonth.month ? `Reserva previa para ${nextMonth.month}.` : "Sin mes posterior.",
    },
    {
      label: "Capacidad libre real",
      value: money(monthlyFreeCapacity(plan.rows || []), true),
      tone: executiveToneForAmount(monthlyFreeCapacity(plan.rows || [])),
      note: "Media mensual tras gastos, deuda, proyectos y ahorro objetivo.",
    },
    {
      label: "Planes considerados",
      value: `${planSummary.pending} pend. · ${planSummary.locked} fijo(s)`,
      tone: planSummary.pending ? "warn" : "good",
      note: `Próximo impacto: ${nextImpactText}.`,
    },
    {
      label: "Ruta deuda",
      value: debtOptimization?.lastMonth || "Sin ruta",
      tone: debtOptimization?.steps?.length ? "warn" : "neutral",
      note: debtOptimization?.steps?.length
        ? `${debtOptimization.steps.length} paso(s), ${money(debtOptimization.totalPrincipal, true)} pactados.`
        : "No hay deudas vivas optimizables.",
    },
  ];

  const alerts = [];
  if (capacity.firstShortage) {
    alerts.push(`Caja: ${capacity.firstShortage.month} tiene déficit de ${money(capacity.firstShortage.shortage, true)}.`);
  }
  if (planSummary.nextImpactAmount > 0) {
    alerts.push(`Proyecto/deuda cargada: impacto próximo de ${money(planSummary.nextImpactAmount, true)} en ${planSummary.nextImpactMonth}.`);
  }
  if (debtOptimization?.steps?.[0]?.candidate?.agreementSavings > 0) {
    alerts.push(`Acuerdo interesante: primera deuda con mejora de ${money(debtOptimization.steps[0].candidate.agreementSavings, true)}.`);
  }
  if (!alerts.length) alerts.push("Sin alertas críticas: mantener traspaso prudente y revisar acuerdos antes de fijarlos.");

  target.innerHTML = `<div class="agent-executive-grid">
    <div class="agent-executive-actions">
      ${mergedActions
        .slice(0, 6)
        .map(
          (item, index) => `<article class="agent-executive-action ${item.tone}">
            <span>${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.meta)}</p>
            </div>
            ${
              item.debtId
                ? `<button type="button" data-agent-debt-target="${escapeHtml(item.debtId)}">${escapeHtml(item.action)}</button>`
                : item.projectId
                  ? `<button type="button" data-agent-project-id="${escapeHtml(item.projectId)}">${escapeHtml(item.action)}</button>`
                  : `<button type="button" data-home-nav="${escapeHtml(item.target || "savings-agent")}">${escapeHtml(item.action)}</button>`
            }
          </article>`,
        )
        .join("")}
    </div>
    <aside class="agent-executive-side">
      <div class="agent-executive-metrics">
        ${guardrails
          .map(
            (item) => `<div class="${item.tone}">
              <span>${escapeHtml(item.label)}</span>
              <strong>${typeof item.value === "string" ? escapeHtml(item.value) : item.value}</strong>
              <small>${escapeHtml(item.note)}</small>
            </div>`,
          )
          .join("")}
      </div>
      <div class="agent-executive-alerts">
        <span>Checklist de control</span>
        <ul>${alerts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </aside>
  </div>`;
}

function renderAgentDebtOptimizerControls() {
  const settings = agentDebtOptimizerSettings();
  const candidates = agentDebtPayoffCandidates();
  if (!candidates.length) return "";
  const usedOrders = new Map();
  candidates.forEach((item, index) => {
    const value = settings.order[item.id] ?? index + 1;
    const key = String(value);
    usedOrders.set(key, (usedOrders.get(key) || 0) + 1);
  });
  const hasDuplicateOrders = [...usedOrders.values()].some((count) => count > 1);
  return `<div class="agent-debt-controls">
    <div class="agent-debt-control-head">
      <div>
        <span class="panel-kicker">Criterio de ruta</span>
        <strong>Orden y acuerdos</strong>
        <p>Define el orden y los importes pactados que usará el agente para calcular la ruta. No aplica ninguna deuda al cuadro de mandos hasta que prepares o simules una decisión.</p>
        ${hasDuplicateOrders ? `<p class="agent-debt-order-warning">Hay órdenes repetidas. Al aplicar el criterio se normalizarán automáticamente para que no haya duplicados.</p>` : ""}
      </div>
      <label>
        <span>Modo</span>
        <select id="agentDebtOptimizerMode">
          <option value="optimized" ${settings.mode === "optimized" ? "selected" : ""}>Optimizado automático</option>
          <option value="manual" ${settings.mode === "manual" ? "selected" : ""}>Orden manual</option>
          <option value="agreements" ${settings.mode === "agreements" ? "selected" : ""}>Priorizar acuerdos pactados</option>
        </select>
      </label>
    </div>
    <div class="agent-debt-control-list">
      ${candidates
        .map((item, index) => {
          const order = settings.order[item.id] ?? index + 1;
          const agreement = settings.agreements[item.id] ?? "";
          return `<div class="agent-debt-control-row">
            <span>${escapeHtml(item.entity)} · ${escapeHtml(item.type)} <small>${escapeHtml(item.number || "")}</small></span>
            <label><small>Orden</small><input data-agent-debt-order="${escapeHtml(item.id)}" type="number" min="1" step="1" value="${escapeHtml(order)}" /></label>
            <label><small>Pactado</small><input data-agent-debt-agreement="${escapeHtml(item.id)}" type="number" min="0" step="0.01" placeholder="${amountInputValue(item.originalPrincipal || item.principal)}" value="${agreement === "" ? "" : amountInputValue(agreement)}" /></label>
          </div>`;
        })
        .join("")}
    </div>
    <div class="agent-debt-save-row">
      <p>Guarda este criterio y recalcula la ruta sugerida. Sirve para que el agente respete tus prioridades, pero no mueve dinero ni crea amortizaciones por sí solo.</p>
      <button type="button" class="secondary-button agent-debt-save" data-agent-debt-settings-save>Guardar criterio y recalcular ruta</button>
    </div>
  </div>`;
}

function renderAgentRouteSimulationPanel(optimization) {
  const activeSummary = routeSimulationSummaryFromActive();
  const summary = activeSummary || routeSimulationSummaryFromOptimization(optimization);
  if (!summary) return "";
  const statusText = summary.active
    ? "Ruta simulada en el modelo"
    : "Ruta lista para simular";
  const note = summary.active
    ? "Estas amortizaciones ya están entrando temporalmente en cuadro de mandos, previsión y flujo mensual. Puedes retirarlas sin tocar decisiones fijas."
    : "Añade toda la ruta óptima como decisiones simuladas para comparar el impacto completo antes de fijar nada.";
  return `<section class="agent-route-simulation ${summary.active ? "active" : ""}">
    <div class="agent-route-copy">
      <span>Simulación global</span>
      <h3>${escapeHtml(statusText)}</h3>
      <p>${escapeHtml(note)}</p>
    </div>
    <div class="agent-route-metrics">
      <div><small>Amortizaciones</small><strong>${summary.count}</strong><span>${escapeHtml(summary.firstMonth)} - ${escapeHtml(summary.lastMonth)}</span></div>
      <div><small>Total aplicado</small><strong>${money(summary.total, true)}</strong><span>${money(summary.debtReduced, true)} deuda baja</span></div>
      <div><small>Liquidez vs base</small><strong class="${summary.liquidityDelta >= 0 ? "positive" : "negative"}">${money(summary.liquidityDelta, true)}</strong><span>efecto caja</span></div>
      <div><small>Patrimonio vs base</small><strong class="${summary.netWorthDelta >= 0 ? "positive" : "negative"}">${money(summary.netWorthDelta, true)}</strong><span>incluye quitas</span></div>
      <div><small>Caja mínima</small><strong>${money(summary.minCaixa, true)}</strong><span>margen ${money(summary.minReserveCoverage, true)}</span></div>
    </div>
    <div class="agent-route-actions">
      <button type="button" data-agent-route-simulate>${summary.active ? "Recalcular ruta completa" : "Simular ruta completa"}</button>
      ${summary.active ? `<button type="button" class="secondary" data-agent-route-clear>Quitar simulación</button>` : ""}
      <button type="button" class="secondary" data-home-nav="visual-detail">Ver cuadro de mandos</button>
      <button type="button" class="secondary" data-home-nav="cashflow">Ver flujo mensual</button>
    </div>
  </section>`;
}

function renderAgentDebtOptimization(optimization) {
  const target = qs("agentDebtOptimization");
  if (!target) return;
  const controls = renderAgentDebtOptimizerControls();
  const routePanel = renderAgentRouteSimulationPanel(optimization);
  const steps = optimization?.steps || [];
  if (!steps.length) {
    const remaining = optimization?.remaining?.length || 0;
    target.innerHTML = `${controls}${routePanel}<div class="empty-state compact">
      ${remaining ? "No hay una amortización viable manteniendo la reserva operativa actual. Prueba a subir plazo, reducir importe pactado o esperar a más ahorro." : "No quedan deudas vivas sin decisión cargada para optimizar."}
    </div>`;
    return;
  }
  const finalDelta = round2((optimization.finalPlan?.finalMediolanum || 0) - (optimization.baselinePlan?.finalMediolanum || 0));
  const summaryCards = [
    ["Deuda liquidada", money(optimization.totalPrincipal, true), `${steps.length} deuda(s) en ruta`],
    ["Fin de ruta", optimization.lastMonth, "Última amortización sugerida"],
    ["Cuota liberable real", money(optimization.totalRelief, true), "No suma cuotas suspendidas como ingreso"],
    ["Patrimonio vs base", money(optimization.netWorthDelta, true), `Mediolanum final: ${money(finalDelta, true)} frente a no amortizar`],
  ];
  target.innerHTML = `${controls}<div class="agent-optimization-summary">
      ${summaryCards
        .map(
          ([label, value, note]) => `<div>
            <span>${escapeHtml(label)}</span>
            <strong>${typeof value === "string" ? escapeHtml(value) : value}</strong>
            <small>${escapeHtml(note)}</small>
          </div>`,
        )
        .join("")}
    </div>
    ${routePanel}
    <div class="agent-optimization-steps">
      ${steps
        .map((step) => {
          const item = step.candidate;
          const suspendedNote = item.suspended
            ? "Pagos suspendidos: liquidar reduce deuda, pero no genera una cuota liberable adicional en caja."
            : `Libera ${money(item.effectiveRelief, true)}/mes desde el mes posterior, hasta vencimiento o límite prudente.`;
          return `<article class="agent-optimization-step ${item.suspended ? "warn" : "good"}">
            <span class="agent-step-number">${step.order}</span>
            <div class="agent-step-main">
              <strong>${escapeHtml(item.entity)} · ${escapeHtml(item.type)}</strong>
              <p>${escapeHtml(item.number || "")} · ${escapeHtml(suspendedNote)}</p>
              ${item.agreementSavings > 0 ? `<p class="agent-agreement-note">Acuerdo pactado: ${money(item.principal, true)} frente a ${money(item.originalPrincipal, true)} (${money(item.agreementSavings, true)} de mejora).</p>` : ""}
            </div>
            <div class="agent-step-metrics">
              <div><small>Mes óptimo</small><b>${escapeHtml(step.monthLabel)}</b></div>
              <div><small>Amortización</small><b>${money(item.principal, true)}</b></div>
              <div><small>Caja mínima</small><b>${money(step.plan.minCaixa, true)}</b></div>
              <div><small>Margen reserva</small><b>${money(step.minReserveCoverage, true)}</b></div>
            </div>
            <button type="button" data-agent-debt-target="${escapeHtml(item.id)}" data-agent-debt-month="${escapeHtml(String(step.monthIndex))}" data-agent-debt-amount="${escapeHtml(String(item.principal))}">Preparar esta amortización</button>
          </article>`;
        })
        .join("")}
    </div>`;
}

function renderAgentPlanSummary(plan) {
  const target = qs("agentPlanSummary");
  if (!target) return;
  const summary = agentPlanSummary(plan);
  const hasPlans = summary.total > 0;
  target.innerHTML = `<div>
      <p class="panel-kicker">Planes en cálculo</p>
      <h3>${hasPlans ? `${summary.total} plan(es) considerados` : "Sin planes cargados"}</h3>
      <p>${hasPlans ? "El agente ya los incorpora al flujo hasta que los elimines o los fijes definitivamente." : "Añade proyectos o decisiones de deuda para que el agente calcule impacto, hucha y prioridad."}</p>
    </div>
    <div class="agent-plan-summary-grid">
      <div><span>Pendientes</span><strong>${summary.pending}</strong><small>${money(summary.pendingAmount, true)}</small></div>
      <div><span>Fijos</span><strong>${summary.locked}</strong><small>${money(summary.fixedAmount, true)}</small></div>
      <div><span>Deuda / vida</span><strong>${summary.debtCount} / ${summary.projectCount}</strong><small>decisiones activas</small></div>
      <div><span>Próximo impacto</span><strong class="${summary.nextImpactAmount < 0 ? "positive" : summary.nextImpactAmount > 0 ? "negative" : ""}">${money(summary.nextImpactAmount, true)}</strong><small>${escapeHtml(summary.nextImpactMonth)}</small></div>
    </div>`;
}

function renderAgentRecommendationCard(item, type) {
  if (type === "debt") {
    const canPay = Boolean(item.affordability);
    const suspended = debtTargetIsSuspended(item);
    return `<article class="agent-rec-card ${canPay ? "good" : "warn"}">
      <div>
        <span>Deuda</span>
        <strong>${escapeHtml(item.entity)} · ${escapeHtml(item.type)}</strong>
        <p>${escapeHtml(item.number || "")}${suspended ? " · pagos suspendidos" : ""}</p>
      </div>
      <div class="agent-rec-metrics">
        <div><small>Pendiente</small><b>${money(item.principal, true)}</b></div>
        <div><small>${suspended ? "Cuota original" : "Cuota liberable"}</small><b>${money(suspended ? item.originalPayment : item.payment, true)}</b></div>
        <div><small>Mes sugerido</small><b>${escapeHtml(item.monthLabel)}</b></div>
        <div><small>${suspended ? "Flujo liberable" : "Eficiencia"}</small><b>${suspended ? "0,0%" : `${(item.efficiency * 100).toFixed(1)}%`}</b></div>
      </div>
      <button type="button" data-agent-debt-target="${escapeHtml(item.id)}" data-agent-debt-month="${escapeHtml(String(item.affordability?.agentIndex ?? ""))}" data-agent-debt-amount="${escapeHtml(String(item.principal || ""))}">Preparar en control de deuda</button>
    </article>`;
  }
  const canPay = Boolean(item.affordability);
  const creditCapital = decisionCreditCapital(item);
  return `<article class="agent-rec-card ${canPay ? "good" : "warn"}">
    <div>
      <span>${creditCapital ? "Proyecto financiado" : "Proyecto"}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <p>${item.locked ? "Fijo en plan" : "Pendiente de decisión final"}${creditCapital ? ` · capital externo ${money(creditCapital, true)}` : ""}</p>
      ${renderProjectSavingsProgress(item, false, item.progress)}
    </div>
    <div class="agent-rec-metrics">
      <div><small>Coste</small><b>${money(item.amount, true)}</b></div>
      ${creditCapital ? `<div><small>Capital prestado</small><b>${money(creditCapital, true)}</b></div>` : ""}
      <div><small>Hucha sugerida</small><b>${money(item.pot, true)}/mes</b></div>
      <div><small>Mes objetivo</small><b>${escapeHtml(item.monthLabel)}</b></div>
      <div><small>Caja mínima plan</small><b>${money(item.minChecking, true)}</b></div>
    </div>
    <button type="button" data-agent-project-id="${escapeHtml(item.id)}">Revisar en simulador</button>
  </article>`;
}

function renderAgentTable(plan, year) {
  const rows = agentRowsForYear(plan, year);
  if (!qs("agentTable")) return;
  if (!rows.length) {
    qs("agentTable").innerHTML = "";
    return;
  }
  const headers = rows.map((row) => `<th>${escapeHtml(row.month)}</th>`).join("");
  const line = (label, getter, klass = "") =>
    `<tr><td>${escapeHtml(label)}</td>${rows.map((row) => `<td class="${klass || (getter(row) < 0 ? "negative" : getter(row) > 0 ? "positive" : "")}">${typeof getter(row) === "string" ? escapeHtml(getter(row)) : money(getter(row), true)}</td>`).join("")}</tr>`;
  qs("agentTable").innerHTML = `<thead><tr><th>Indicador</th>${headers}</tr></thead><tbody>
    <tr class="prevision-group-row"><td colspan="${rows.length + 1}">Caja operativa</td></tr>
    ${line("Resultado del mes", (row) => row.operatingResult)}
    ${line("Pagos mes siguiente", (row) => Math.max(0, Number(row.requiredReserve || 0) - plan.caixaFloor))}
    ${line("Margen sobre reserva", (row) => round2(Number(row.agentCaixa || 0) - Number(row.requiredReserve || 0)))}
    ${line("Reserva mes siguiente", (row) => row.requiredReserve)}
    ${line("Traspaso a Mediolanum", (row) => row.transferToSavings, "positive")}
    ${line("Rescate desde Mediolanum", (row) => row.rescueFromSavings, "negative")}
    ${line("CaixaBank cierre", (row) => row.agentCaixa)}
    ${line("Mediolanum cierre", (row) => row.agentMediolanum, "positive")}
    ${line("Patrimonio total", (row) => row.agentTotal, "positive")}
    <tr class="prevision-group-row comparison"><td colspan="${rows.length + 1}">Control</td></tr>
    ${line("Impacto proyectos/deuda", (row) => row.projectOutflow)}
    ${line("Estado", (row) => agentStatusForRow(row).label)}
  </tbody>`;
}

function renderSavingsAgent({ forceHeavy = false } = {}) {
  if (!qs("agentKpis")) return;
  const plan = buildSavingsAgentPlan();
  if (qs("agentCaixaFloor")) qs("agentCaixaFloor").value = amountInputValue(plan.caixaFloor);
  populateAgentYearSelect(plan);
  const selectedYear = qs("agentYear")?.value || agentYears(plan)[0];
  const debtRecs = agentDebtRecommendations(plan);
  const hasOptimization = Boolean(cachedAgentDebtOptimization());
  const projectRecs = agentLifeProjectRecommendations(plan, { allowEvaluation: forceHeavy || hasOptimization });
  const debtOptimization = forceHeavy || hasOptimization
    ? agentOptimalDebtPayoffPlan()
    : emptyAgentDebtOptimization(plan);
  const firstYearRows = agentRowsForYear(plan, selectedYear);
  const yearTransferred = sumRows(firstYearRows, (row) => row.transferToSavings);
  const yearResult = sumRows(firstYearRows, (row) => row.operatingResult);
  renderAgentToday(plan);
  renderAgentQuarterPlan(plan);
  renderAgentPriorityQueue(plan, debtRecs, projectRecs);
  qs("agentKpis").innerHTML = [
    ["Patrimonio neto final", money(plan.netWorth, true), `Liquidez final menos deuda viva no planificada (${money(plan.remainingDebt, true)}).`, plan.netWorth >= 0 ? "good" : "danger"],
    ["Ahorrado en Mediolanum", money(plan.finalMediolanum, true), `Traspasos acumulados: ${money(plan.totalTransferred, true)}.`, "good"],
    ["Caja mínima protegida", money(plan.minCaixa, true), `Reserva: ${money(plan.caixaFloor, true)} + pagos del mes siguiente. Margen mínimo: ${money(plan.minReserveCoverage, true)}.`, plan.minReserveCoverage >= 0 ? "good" : "danger"],
    ["Proyectos y deuda cargados", money(plan.projectSpend, true), `Deuda planificada: ${money(plan.plannedDebtPrincipal, true)}.`, plan.projectSpend > 0 ? "warn" : "neutral"],
  ]
    .map(([label, value, note, tone]) => `<article class="agent-kpi-card ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
      <p>${escapeHtml(note)}</p>
    </article>`)
    .join("");
  renderAgentExecutive(plan, debtRecs, projectRecs, debtOptimization);
  renderAgentPlanSummary(plan);
  renderAgentDecisionBoard(plan, debtRecs, projectRecs);
  renderAgentDebtOptimization(debtOptimization);

  qs("agentRules").innerHTML = [
    ["Regla de traspaso", `Cada mes mueve a Mediolanum solo lo que exceda ${money(plan.caixaFloor, true)} más los pagos previstos del mes siguiente.`],
    ["Año seleccionado", `${selectedYear}: resultado acumulado ${money(yearResult, true)} y traspaso estimado ${money(yearTransferred, true)}.`],
    ["Uso del ahorro", "Primero protege caja, después calcula deudas y proyectos financiables con Mediolanum."],
    ["Decisiones definitivas", "Nada se aplica al cuadro de mandos hasta preparar la decisión y fijarla en su simulador."],
  ]
    .map(([title, text]) => `<div><span>${escapeHtml(title)}</span><strong>${escapeHtml(text)}</strong></div>`)
    .join("");

  qs("agentInsights").innerHTML = agentInsightCards(plan, debtRecs, projectRecs)
    .map((item) => `<article class="agent-insight ${item.tone}">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
    </article>`)
    .join("");

  qs("agentDebtList").innerHTML = debtRecs.length
    ? debtRecs.map((item) => renderAgentRecommendationCard(item, "debt")).join("")
    : `<div class="empty-state compact">No hay deudas vivas sin plan pendiente de simular.</div>`;
  qs("agentProjectList").innerHTML = projectRecs.length
    ? projectRecs.map((item) => renderAgentRecommendationCard(item, "project")).join("")
    : `<div class="empty-state compact">No hay proyectos de vida pendientes. Añade uno en el simulador para que el agente calcule hucha y mes objetivo.</div>`;
  renderAgentTable(plan, selectedYear);
  if (!hasOptimization && !forceHeavy) scheduleHeavyAdvisorRefresh("savings-agent");
}
