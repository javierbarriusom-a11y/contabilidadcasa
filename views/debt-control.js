// T14 (séptimo incremento, sesión 207): pantalla "Control de deuda" (`#debt-control`), extraída de
// app.js con el mismo patrón `views/*.js`. A diferencia de los seis incrementos anteriores, esta
// pantalla no era un bloque contiguo autocontenido — está entrelazada línea a línea con el motor de
// deuda compartido (que se queda en app.js porque otras pantallas ya migradas lo llaman:
// `views/virtual-advisor.js`, `views/new-life-definitive.js`, `views/presupuesto-mes.js`,
// `views/debt-liquidation-plan.js`, `views/executive-advisor.js` usan `evaluateDebtCandidate`,
// `debtDecisionFromValues`, `evaluateDebtDecisionItem`, `debtTargetDisplayName`, `debtCandidateMonths`,
// `debtPriorityCandidates`... directamente). Además `updateDebtModeUi` se llama sin guarda en el
// arranque de la app (antes de cualquier enrutado), y arrastra a `renderDebtAgreementPreview`,
// `updateDebtConfirmState` y `defaultDebtTargetId` con ella — las tres se quedan en app.js aunque a
// primera vista parecían exclusivas de esta pantalla. `resetDebtDecisionForm` también se queda: la
// llama `applyDebtDecision` (el guardarraíl real de escritura, usado también desde
// `views/virtual-advisor.js`), y si viviera aquí rompería esa llamada la primera vez que se
// disparara sin haber visitado antes Control de deuda.
//
// Lo que sí se movió (16 funciones, recortadas una a una del bloque 9105-10005 de app.js, no un
// rango contiguo): la pintura de la pantalla (`renderDebtControl`, `renderDebtPayoffChart`,
// `populateDebtTargetSelect`) y todo el flujo de "revisar antes de aplicar" — comparación de
// alternativas (`buildDebtReviewComparison`, `debtReviewOptionCard`,
// `debtDecisionComparisonAlternative`, `debtDecisionCloseIndex`, `debtComparisonStrategy`), la
// decisión en borrador (`renderDebtDecisionReview`, `stageDebtDecision`, `applyDebtReviewOption`,
// `debtDecisionFromForm`, `debtDecisionDurationFromMode`, `recommendedDebtDecision`,
// `handleAddDebtLiquidation`, `saveDebtDecisionAsPending`). Ninguna de estas 16 se llama desde
// fuera de su propio cableado (el `case "debt-control"` de `renderActiveSection`, los
// `addEventListener` sobre los propios controles de `#debt-control` en el cableado central, y la
// llamada con guarda de `setActiveView` primero desde `prepareAgentDebtDecision`) — mismo patrón ya
// validado en los seis incrementos anteriores.
function populateDebtTargetSelect() {
  const select = qs("debtTargetSelect");
  if (!select) return;
  const previous = select.value;
  const hadOptions = select.options.length > 0;
  select.innerHTML = debtTargetOptions()
    .map((item) => {
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.entity)} · ${escapeHtml(item.type)} · ${escapeHtml(item.number || "")} · ${money(item.currentPrincipal ?? item.principal, true)}</option>`;
    })
    .join("");
  select.value = [...select.options].some((option) => option.value === previous) ? previous : defaultDebtTargetId();
  if (!hadOptions) updateDebtTargetDefaults(false);
}

function debtDecisionDurationFromMode(rawMode) {
  return isDebtMultiMonthMode(rawMode) ? Math.max(1, Number(qs("debtPayoffDuration")?.value || 1)) : 1;
}

function debtDecisionFromForm({ rawModeOverride, durationOverride, forceOptimize } = {}) {
  const rawMode = rawModeOverride || qs("debtPayoffMode")?.value || "optimize";
  return debtDecisionFromValues({
    targetId: qs("debtTargetSelect")?.value,
    name: qs("debtPayoffName")?.value,
    amount: parseAmount(qs("debtPayoffAmount")?.value),
    relief: parseAmount(qs("debtPayoffRelief")?.value),
    rawMode,
    monthIndex: Number(qs("debtPayoffMonth")?.value || 0),
    duration: durationOverride || debtDecisionDurationFromMode(rawMode),
    forceOptimize,
  });
}

function debtComparisonStrategy(rawMode = "optimize") {
  if (!DebtComparator) return rawMode;
  if (isDebtResumeMode(rawMode)) return DebtComparator.STRATEGIES.RESUME;
  if (isDebtRefinanceMode(rawMode)) return DebtComparator.STRATEGIES.REFINANCE;
  if (rawMode === "spread" || rawMode === "spread-optimize") return DebtComparator.STRATEGIES.INSTALLMENTS;
  return DebtComparator.STRATEGIES.SINGLE;
}

function debtDecisionCloseIndex(item) {
  const months = forecastMonths();
  if (!months.length || !item) return null;
  return Math.min(months.length - 1, Math.max(0, Number(item.monthIndex || 0)) + decisionWindowMonths(item) - 1);
}

function debtDecisionComparisonAlternative(id, label, detail, decision, targetPrincipal) {
  if (!decision) return null;
  const result = evaluateDebtDecisionItem(decision);
  const closeIndex = debtDecisionCloseIndex(decision);
  return {
    id,
    strategy: debtComparisonStrategy(decision.payoffMode),
    label,
    detail,
    startIndex: Number(decision.monthIndex || 0),
    startLabel: forecastMonths()[decision.monthIndex || 0]?.label || "-",
    duration: decisionWindowMonths(decision),
    closeIndex,
    closeLabel: closeIndex === null ? "-" : (forecastMonths()[closeIndex]?.label || "-"),
    monthlyPayment: result.monthly,
    totalCost: decisionGrossCost(decision),
    remainingDebt: 0,
    minChecking: result.evaluation.minChecking,
    minLiquidity: result.evaluation.minLiquidity,
    finalLiquidityImpact: result.netGain,
    payload: decision,
    principal: targetPrincipal,
  };
}

function buildDebtReviewComparison(decision, target) {
  if (!DebtComparator || !decision || !target) return null;
  const months = forecastMonths();
  const baselineOutflows = projectPlan?.outflows?.length === months.length
    ? projectPlan.outflows.slice()
    : Array(months.length).fill(0);
  const baseline = evaluateOutflows(baselineOutflows);
  const targetPrincipal = round2(Number(target.currentPrincipal ?? target.principal ?? decision.originalPrincipal ?? decision.amount));
  const suspended = debtTargetIsSuspended(target);
  const alternatives = [{
    id: "no-action",
    strategy: DebtComparator.STRATEGIES.NO_ACTION,
    label: "No actuar por ahora",
    detail: "Mantiene la deuda pendiente y no compromete caja. Es la referencia para comparar todas las modalidades.",
    startIndex: 0,
    startLabel: "Ahora",
    duration: 0,
    closeIndex: null,
    closeLabel: "Sin cierre",
    monthlyPayment: 0,
    totalCost: 0,
    remainingDebt: targetPrincipal,
    minChecking: baseline.minChecking,
    minLiquidity: baseline.minLiquidity,
    finalLiquidityImpact: 0,
    payload: null,
  }];
  const configured = debtDecisionComparisonAlternative(
    "configured",
    `Opción configurada · ${debtModeLabel(decision.payoffMode)}`,
    "Respeta exactamente el importe, modalidad y mes elegidos en el formulario.",
    decision,
    targetPrincipal,
  );
  if (configured) alternatives.push(configured);

  const definitions = [
    {
      id: "single-optimal",
      label: "Pago único óptimo",
      rawMode: "optimize",
      duration: 1,
      detail: suspended
        ? "Liquida la deuda suspendida sin inventar un ingreso por la cuota que hoy no se paga."
        : "Liquida la deuda en un mes y elimina la cuota posterior dentro de su vigencia real.",
    },
    {
      id: "installments-6",
      label: "Fraccionar en 6 meses",
      rawMode: "spread-optimize",
      duration: 6,
      detail: "Reparte el importe pactado en seis cargos y busca el inicio que mejor protege la reserva.",
    },
    {
      id: "refinance-12",
      label: "Reunificar a 12 meses",
      rawMode: "refinance-optimize",
      duration: 12,
      detail: "Reduce la presión mensual y cierra el acuerdo en un año, sin tratar cuotas suspendidas como ingreso.",
    },
    {
      id: "refinance-24",
      label: "Reunificar a 24 meses",
      rawMode: "refinance-optimize",
      duration: 24,
      detail: "Minimiza el cargo mensual a cambio de mantener el compromiso durante dos años.",
    },
    suspended
      ? {
          id: "resume-optimal",
          label: "Retomar pagos",
          rawMode: "retomar-optimize",
          duration: 1,
          detail: "Paga atrasos desde enero de 2026 y retoma la cuota original hasta el vencimiento contractual.",
        }
      : null,
  ].filter(Boolean);

  const configuredSignature = configured
    ? `${configured.strategy}|${configured.startIndex}|${configured.duration}|${configured.totalCost}`
    : "";
  definitions.forEach((definition) => {
    const candidate = debtDecisionFromValues({
      targetId: target.id,
      name: decision.name,
      amount: decision.amount,
      relief: decision.monthlyRelief,
      rawMode: definition.rawMode,
      monthIndex: decision.monthIndex,
      duration: definition.duration,
      forceOptimize: true,
    });
    const alternative = debtDecisionComparisonAlternative(
      definition.id,
      definition.label,
      definition.detail,
      candidate,
      targetPrincipal,
    );
    if (!alternative) return;
    const signature = `${alternative.strategy}|${alternative.startIndex}|${alternative.duration}|${alternative.totalCost}`;
    if (signature !== configuredSignature) alternatives.push(alternative);
  });

  const comparison = DebtComparator.compareAgreements({
    contractId: target.id,
    principal: targetPrincipal,
    reserve: agentCaixaFloor(),
    alternatives,
  });
  if (E7Analysis) {
    comparison.frontier = E7Analysis.paretoFrontier(comparison.alternatives.map((option) => ({
      ...option,
      carFund: Number(option.payload?.carFund || 0),
    })), { reserve: comparison.reserve });
    comparison.legalEffects = E7Analysis.buildAgreementEffects(decision.payoffMode === "fixed" ? "single-payment" : debtComparisonStrategy(decision.payoffMode), {
      debtReduction: decision.discount,
    });
  }
  pendingDebtReviewOptions = new Map(
    comparison.alternatives.map((option) => [option.id, { strategy: option.strategy, decision: option.payload }]),
  );
  return comparison;
}

function debtReviewOptionCard(option, selected = false, recommended = false) {
  const klass = option.reserveSafe ? "good" : "warn";
  const reference = option.isReference ? "reference" : "";
  const actionLabel = option.isReference
    ? "No comprometer caja"
    : recommended
      ? "Aplicar recomendación"
      : selected
        ? "Aplicar opción configurada"
        : "Aplicar esta alternativa";
  const frontier = pendingDebtComparisonFrontier?.includes(option.id);
  return `<article class="debt-review-card ${klass} ${selected ? "selected" : ""} ${recommended ? "recommended" : ""} ${reference}">
    <span>${escapeHtml(option.label)}${recommended ? " · recomendada" : ""}${frontier ? " · frontera eficiente" : ""}</span>
    <strong>${escapeHtml(option.startLabel)}${option.duration ? ` · ${money(option.monthlyPayment, true)}/mes` : ""}</strong>
    <p>${escapeHtml(option.detail)}</p>
    <div class="debt-review-metrics">
      <div><small>Coste total</small><b>${money(option.totalCost, true)}</b></div>
      <div><small>Cierre deuda</small><b>${escapeHtml(option.closeLabel)}</b></div>
      <div><small>Caja mínima</small><b>${money(option.minChecking, true)}</b></div>
      <div><small>Margen reserva</small><b class="${option.reserveMargin < 0 ? "negative" : "positive"}">${option.reserveMargin >= 0 ? "+" : ""}${money(option.reserveMargin, true)}</b></div>
      <div><small>Impacto final</small><b>${option.finalLiquidityImpact >= 0 ? "+" : ""}${money(option.finalLiquidityImpact, true)}</b></div>
    </div>
    <button type="button" data-apply-debt-option="${escapeHtml(option.id)}">${actionLabel}</button>
  </article>`;
}

// Guarda la decisión comparada como borrador ("pending"): queda visible en Planificación de
// partidas como provisional, pero no entra en scheduleEligible ni mueve el forecast real hasta
// promoverla (transitionDecisionLifecycle a "approved") desde su propio origen.
function saveDebtDecisionAsPending() {
  const decision = pendingDebtDecision;
  if (!decision) return;
  if (laboratorioWriteGuard("Guardar decisión de deuda pendiente")) return;
  if (decision.targetId && debtLiquidations.some((item) => item.targetId === decision.targetId)) {
    if (qs("debtDecisionReview")) {
      qs("debtDecisionReview").innerHTML = `<div class="debt-review-empty">
        <strong>Decisión ya incorporada</strong>
        <p>Esta deuda ya tiene una decisión cargada. Elimínala o desbloquéala antes de volver a simularla.</p>
      </div>`;
    }
    updateDebtConfirmState();
    return;
  }
  const { preview, ...cleanDecision } = decision;
  const nextDecision = {
    ...cleanDecision,
    id: `debt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    lifecycleState: "pending",
    locked: false,
  };
  debtLiquidations.push(nextDecision);
  transitionDecisionLifecycle("debt", nextDecision.id, "pending", "Decisión guardada como pendiente, sin aplicar todavía.", { render: false });
  resetDebtDecisionForm();
  render();
}

function applyDebtReviewOption(button) {
  const choice = pendingDebtReviewOptions.get(button.dataset.applyDebtOption);
  if (!choice) return;
  if (choice.strategy === DebtComparator?.STRATEGIES.NO_ACTION) {
    resetDebtDecisionForm();
    renderDebtDecisionReview(null);
    return;
  }
  applyDebtDecision(choice.decision);
}

function renderDebtDecisionReview(decision = pendingDebtDecision) {
  const panel = qs("debtDecisionReview");
  if (!panel) return;
  if (!decision) {
    pendingDebtReviewOptions = new Map();
    panel.innerHTML = `<div class="debt-review-empty">
      <strong>Compara antes de aplicar</strong>
      <p>Elige deuda, importe pactado y modalidad. La decisión no afectará al resto de secciones hasta que confirmes.</p>
    </div>`;
    updateDebtConfirmState();
    return;
  }
  const target = debtTargetById(decision.targetId) || selectedDebtTarget();
  const comparison = buildDebtReviewComparison(decision, target);
  if (!comparison) {
    panel.innerHTML = `<div class="debt-review-empty"><strong>Comparador no disponible</strong><p>Recarga la aplicación para activar el motor canónico de acuerdos.</p></div>`;
    updateDebtConfirmState();
    return;
  }
  const currentOption = comparison.alternatives.find((option) => option.id === "configured") || comparison.recommended;
  pendingDebtComparisonFrontier = comparison.frontier?.frontierIds || [];
  const suspended = debtTargetIsSuspended(target);
  const currentMonth = forecastMonths()[decision.monthIndex]?.label || "-";
  const discountPct = decision.originalPrincipal ? decision.discount / decision.originalPrincipal : 0;
  const resumeText = isDebtResumeMode(decision.payoffMode)
    ? `<p class="debt-review-note">Retomar no amortiza con quita: añade ${money(decision.amount, true)} de atrasos (${decision.resumeArrearsMonths || 0} mes(es)) y después ${money(decision.recurringAmount || 0, true)}/mes durante ${decision.recurringDuration || 0} mes(es), según el vencimiento inicial si existe.</p>`
    : suspended
      ? `<p class="debt-review-note">Pagos suspendidos: esta liquidación no crea flujo positivo posterior. La cuota original solo se usa si eliges “retomar”.</p>`
      : "";
  panel.innerHTML = `<div class="debt-review-head">
      <div>
        <p class="panel-kicker">Revisión previa</p>
        <h4>${escapeHtml(decision.name)}</h4>
        <p>Se aplicará al dashboard solo al confirmar. Objetivo: evitar duplicados y validar caja antes de comprometer la decisión.</p>
      </div>
      <div class="debt-review-badge">${debtModeLabel(decision.payoffMode)} · ${currentMonth}</div>
    </div>
    <div class="debt-review-summary">
      <div><span>Deuda original</span><strong>${money(decision.originalPrincipal, true)}</strong></div>
      <div><span>Importe pactado</span><strong>${money(decision.amount, true)}</strong></div>
      <div><span>Mejora</span><strong class="${decision.discount ? "positive" : ""}">${money(decision.discount, true)} · ${(discountPct * 100).toFixed(1)}%</strong></div>
      <div><span>Opción seleccionada</span><strong>${money(currentOption.monthlyPayment, true)}/mes</strong></div>
      <div><span>Caja mínima</span><strong class="${currentOption.reserveSafe ? "positive" : "negative"}">${money(currentOption.minChecking, true)}</strong></div>
      <div><span>Reserva común</span><strong>${money(comparison.reserve, true)}</strong></div>
    </div>
    ${resumeText}
    <div class="debt-review-rule ${comparison.recommended.isReference ? "warn" : "good"}">
      <div><span>Recomendación canónica</span><strong>${escapeHtml(comparison.recommended.label)}</strong></div>
      <p>${escapeHtml(comparison.reason)}</p>
      ${comparison.frontier ? `<p>${escapeHtml(comparison.frontier.reason)} “Frontera eficiente” significa que ninguna opción viable mejora todos los objetivos a la vez.</p>` : ""}
    </div>
    <div class="debt-review-options">
      ${comparison.alternatives
        .map((option) => debtReviewOptionCard(option, option.id === "configured", option.id === comparison.recommendedId))
        .join("")}
    </div>
    ${comparison.legalEffects?.length ? `<div class="e7-effects" aria-label="Efectos legales y fiscales por revisar">
      <strong>Efectos legales y fiscales</strong>
      ${comparison.legalEffects.map((effect) => `<article><span>${escapeHtml(effect.title)}</span><p>${escapeHtml(effect.summary)}</p>${effect.source ? `<a href="${escapeHtml(effect.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(effect.source.authority)} · consultado ${escapeHtml(effect.source.checkedAt)}</a>` : ""}</article>`).join("")}
      <p class="debt-review-note">${escapeHtml(E7Analysis.PROFESSIONAL_WARNING)}</p>
    </div>` : ""}`;
  panel.querySelectorAll("[data-apply-debt-option]").forEach((button) => {
    button.addEventListener("click", () => applyDebtReviewOption(button));
  });
  updateDebtConfirmState();
}

function stageDebtDecision() {
  pendingDebtDecision = debtDecisionFromForm();
  renderDebtDecisionReview(pendingDebtDecision);
}

function recommendedDebtDecision() {
  const target = selectedDebtTarget();
  const amount = parseAmount(qs("debtPayoffAmount")?.value) ?? Number(target?.principal || 0);
  const mode = qs("debtPayoffMode")?.value || "optimize";
  const relief = debtTargetIsSuspended(target) || isDebtResumeMode(mode)
    ? 0
    : (parseAmount(qs("debtPayoffRelief")?.value) ?? debtMonthlyReliefForMode(target, mode));
  const duration = isDebtMultiMonthMode(mode) ? Math.max(1, Number(qs("debtPayoffDuration")?.value || 1)) : 1;
  return evaluateDebtCandidate(target, amount, relief, duration, "full", { resume: isDebtResumeMode(mode) });
}

function handleAddDebtLiquidation() {
  if (!pendingDebtDecision) {
    stageDebtDecision();
    return;
  }
  applyDebtDecision(pendingDebtDecision);
}

function renderDebtPayoffChart() {
  const svg = qs("debtPayoffChart");
  if (!svg) return;
  const months = openForecastMonths(forecastMonths()).slice(0, 36);
  const values = months.map((month) =>
    projectPlan.placements
      .filter((item) => item.source === "debt")
      .reduce((sum, item) => sum + scheduledDecisionMonthlyImpact(item, month.index), 0),
  );
  const width = svg.clientWidth || 520;
  const height = 180;
  const pad = { left: 42, right: 12, top: 14, bottom: 34 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const zeroY = height - pad.bottom - (height - pad.top - pad.bottom) * 0.5;
  const barW = (width - pad.left - pad.right) / Math.max(values.length, 1);
  svg.innerHTML = values
    .map((value, index) => {
      const h = (((height - pad.top - pad.bottom) * 0.48) * Math.abs(value)) / max;
      const x = pad.left + index * barW + 2;
      const y = value >= 0 ? zeroY - h : zeroY;
      const label = index % 6 === 0 ? `<text class="chart-label" x="${x}" y="${height - 10}">${months[index].label}</text>` : "";
      return `<rect class="bar debt-bar ${value < 0 ? "saving" : ""}" x="${x}" y="${y}" width="${Math.max(3, barW - 4)}" height="${h}" rx="3"></rect>${label}`;
    })
    .join("") + `<line class="chart-grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${zeroY}" y2="${zeroY}"></line>`;
}

function renderDebtControl() {
  if (!qs("debtControlSummary")) return;
  populateDebtTargetSelect();
  updateDebtModeUi();
  const stats = debtControlStats();
  qs("debtControlSummary").innerHTML = [
    ["Capital inicial", money(stats.oldDebt, true), ""],
    ["Capital actual", money(stats.portfolioTotals.currentPrincipal, true), ""],
    ["Pago mensual anterior", money(stats.oldMonthly, true), "negative"],
    ["Pago mensual actual", money(stats.currentPayment.total, true), ""],
    ["Capital tras acuerdos", money(stats.principalAfterAgreements, true), stats.principalAfterAgreements < stats.portfolioTotals.currentPrincipal ? "positive" : ""],
    ["Tras decisiones", money(stats.monthlyAfterDecisions, true), stats.monthlyAfterDecisions < stats.currentPayment.total ? "positive" : ""],
  ]
    .map(([label, value, klass]) => `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`)
    .join("");

  if (qs("debtBreakdownCards")) {
    qs("debtBreakdownCards").innerHTML = [
      ["Reunificado", money(stats.portfolioTotals.reunifiedPrincipal, true), `${money(stats.currentPayment.unified, true)}/mes · ${CURRENT_REUNIFIED_DEBT_INSTALLMENTS} cuotas`],
      ["Capital actual", money(stats.portfolioTotals.currentPrincipal, true), "No reunificado pendiente"],
      ["Amortizado", money(stats.portfolioTotals.amortized, true), "Acuerdos ya aplicados"],
      ["Pago mensual actual", money(stats.currentPayment.total, true), "Desde mayo 2026"],
    ]
      .map(([label, value, detail]) => `<div class="debt-mini-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`)
      .join("");
  }

  if (qs("debtPortfolioTable")) {
    const rows = debtPortfolioRows();
    const grouped = new Map();
    rows.forEach((row) => {
      const displayType = row.reunified ? "Reunificado" : row.type;
      const key = `${row.entity}|${displayType}`;
      const current = grouped.get(key) || { entity: row.entity, type: displayType, initialPrincipal: 0, originalPayment: 0, currentPayment: 0, amortized: 0, currentPrincipal: 0, reunified: false, lines: [] };
      current.initialPrincipal += Number(row.initialPrincipal || 0);
      current.originalPayment += Number(row.originalPayment || 0);
      current.currentPayment = row.reunified ? Math.max(current.currentPayment, Number(row.currentPayment || 0)) : current.currentPayment + Number(row.currentPayment || 0);
      current.amortized += Number(row.amortized || 0);
      current.currentPrincipal += Number(row.currentPrincipal || 0);
      current.reunified = current.reunified || Boolean(row.reunified);
      current.lines.push(row);
      grouped.set(key, current);
    });
    qs("debtPortfolioTable").innerHTML = `<thead>
      <tr><th>Entidad / tipo</th><th>Capital inicial</th><th>Mensualidad original</th><th>Desde mayo 2026</th><th>Amortizado</th><th>Capital actual</th><th>Productos</th></tr>
    </thead><tbody>
      ${[...grouped.values()]
        .map((group) => {
          const details = group.lines
            .map((line) => `${line.number}${line.reunified ? " · reunificado" : ""}${installmentLabel(line)}`)
            .join("<br>");
          return `<tr>
            <td><strong>${escapeHtml(group.entity)}</strong><small>${escapeHtml(group.type)}</small></td>
            <td>${money(group.initialPrincipal, true)}</td>
            <td class="negative">${money(group.originalPayment, true)}</td>
            <td class="${group.currentPayment ? "negative" : ""}">${money(group.currentPayment, true)}</td>
            <td>${money(group.amortized, true)}</td>
            <td>${money(group.currentPrincipal, true)}</td>
            <td>${details}</td>
          </tr>`;
        })
        .join("")}
    </tbody>`;
  }

  if (qs("debtProductGrid")) {
    const activeRows = debtPortfolioRows().filter((row) => Number(row.currentPrincipal || 0) > 0 || row.reunified || row.plannedInDashboard);
    qs("debtProductGrid").innerHTML = activeRows
      .map((row) => {
        const discount = Math.max(0, Number(row.initialPrincipal || 0) - Number(row.currentPrincipal || 0) - Number(row.amortized || 0));
        const suspended = debtTargetIsSuspended(row);
        const status = row.plannedCovered
          ? "Incorporada al cuadro / liberada"
          : row.plannedInDashboard
            ? "Incorporada parcialmente al cuadro"
            : row.reunified
              ? "Reunificada"
              : suspended
                ? "Suspendida / pendiente de acuerdo"
                : Number(row.currentPrincipal || 0) > 0
                  ? "Viva"
                  : "Saldada";
        const currentPaymentLabel = row.reunified
          ? `Incluida en ${money(CURRENT_REUNIFIED_DEBT_PAYMENT, true)}`
          : row.plannedCovered
            ? "Liberada en cuadro"
          : suspended
            ? "0,00 € suspendida"
            : money(row.currentPayment, true);
        return `<article class="debt-product-card ${row.reunified ? "reunified" : ""} ${row.plannedCovered ? "covered" : row.plannedInDashboard ? "planned" : ""}">
          <div class="debt-product-title">
            <strong>${escapeHtml(row.entity)}</strong>
            <span>${escapeHtml(row.type)} · ${escapeHtml(row.number)}</span>
          </div>
          <div class="debt-product-metrics">
            <div><span>Inicial</span><strong>${money(row.initialPrincipal, true)}</strong></div>
            <div><span>Actual</span><strong>${money(row.currentPrincipal, true)}</strong></div>
            <div><span>Cuota antes</span><strong class="negative">${money(row.originalPayment, true)}</strong></div>
            <div><span>Cuota ahora</span><strong>${escapeHtml(currentPaymentLabel)}</strong></div>
          </div>
          <p><b>${escapeHtml(status)}</b>${installmentLabel(row)}${row.plannedInDashboard ? ` · cargado ${money(row.plannedPrincipal, true)}` : ""}${discount ? ` · mejora ${money(discount, true)}` : ""}</p>
        </article>`;
      })
      .join("");
  }

  if (qs("debtRecommendation")) {
    const recommendation = recommendedDebtDecision();
    qs("debtRecommendation").innerHTML = recommendation
      ? `<strong>${recommendation.feasible ? "Mejor hueco sugerido" : "Hueco menos malo"}</strong>
        <span>${escapeHtml(recommendation.month.label)} · calcula con proyectos cargados · impacto final ${money(recommendation.netGain, true)} · caja mínima ${money(recommendation.evaluation.minChecking, true)}</span>`
      : "<strong>Introduce una deuda</strong><span>El simulador propondrá mes y modalidad con impacto en caja.</span>";
  }
  renderDebtAgreementPreview();
  renderDebtDecisionReview();

  if (qs("debtPriorityPlan")) {
    const candidates = debtPriorityCandidates().slice(0, 5);
    qs("debtPriorityPlan").innerHTML = candidates.length
      ? `<div class="debt-priority-header"><strong>Prioridad recomendada</strong><span>Orden optimizado con proyectos ya cargados</span></div>${candidates
          .map((item, index) => `<div class="debt-priority-item">
            <span>${index + 1}</span>
            <div><strong>${escapeHtml(item.target.entity)} · ${escapeHtml(item.target.type)}</strong><small>${escapeHtml(item.target.number || "")} · ${money(item.principal, true)} · cuota ${money(item.payment, true)} · mes sugerido ${escapeHtml(item.best?.month?.label || "-")}</small></div>
          </div>`)
          .join("")}`
      : `<div class="debt-priority-header"><strong>Sin deuda viva fuera del plan</strong><span>No hay productos pendientes para priorizar.</span></div>`;
  }

  qs("debtPayoffList").innerHTML = debtLiquidations.length
    ? debtLiquidations
        .map((item) => {
          const monthly = decisionPeakMonthlyImpact(item);
          const placement = projectPlan.placements.find((candidate) => candidate.source === "debt" && candidate.id === item.id);
          const month = placement
            ? forecastMonths()[placement.startIndex]
            : forecastMonths().find((candidate) => candidate.key === item.monthKey) || forecastMonths()[item.monthIndex || 0];
          const resolvedItem = placement || resolvedDebtDecisionForStart(item, item.monthIndex || 0);
          const relief = effectiveDebtDecisionMonthlyRelief(item);
          const reliefMonths = debtReliefMonthsForItem(item, (placement?.startIndex ?? item.monthIndex ?? 0) + Math.max(1, Number(item.duration || 1)));
          const detail = isDebtResumeMode(item.payoffMode || item.mode)
            ? `${debtModeLabel(item.payoffMode || item.mode)} · atrasos ${money(resolvedItem.amount || 0, true)} (${resolvedItem.resumeArrearsMonths || 0} mes(es)) · retoma ${money(resolvedItem.recurringAmount || 0, true)}/mes durante ${resolvedItem.recurringDuration || 0} mes(es) · desde ${escapeHtml(placement?.monthLabel || month?.label || "")}.`
            : `${debtModeLabel(item.payoffMode || item.mode)} · pactado ${money(item.amount, true)} vs deuda ${money(item.originalPrincipal || item.targetPrincipal || item.amount, true)} · mejora ${money(item.discount || 0, true)} · desde ${escapeHtml(placement?.monthLabel || month?.label || "")}, ${item.duration} mes(es). Pago mensual: ${money(monthly, true)}. Cuota eliminada posterior: ${money(relief, true)} durante ${reliefMonths} mes(es).`;
          const lifecycleState = decisionLifecycleStatus(item);
          const actions = lifecycleState === "fixed"
            ? `<button class="lock-action" data-lock-debt-liquidation="${escapeHtml(item.id)}" data-lock-value="false">Desbloquear</button><button data-execute-debt-liquidation="${escapeHtml(item.id)}">Marcar ejecutada</button><button data-remove-debt-liquidation="${escapeHtml(item.id)}">Cancelar</button>`
            : `<button class="lock-action" data-lock-debt-liquidation="${escapeHtml(item.id)}" data-lock-value="true">Fijar en plan</button><button data-remove-debt-liquidation="${escapeHtml(item.id)}">Cancelar</button>`;
          return `<div class="project-item debt-item ${lifecycleState === "fixed" ? "locked" : ""}">
            <div>
              <strong>${escapeHtml(item.name)} ${decisionLockedBadge(item)}</strong>
              <p>${detail}</p>
            </div>
            <div class="project-item-actions">${actions}</div>
          </div>`;
        })
        .join("")
    : '<div class="project-item"><div><strong>Sin liquidaciones cargadas</strong><p>Añade una liquidación para ver el impacto mensual y en el resto de secciones.</p></div></div>';

  document.querySelectorAll("[data-remove-debt-liquidation]").forEach((button) => {
    button.addEventListener("click", () => removeDebtLiquidation(button.dataset.removeDebtLiquidation));
  });
  document.querySelectorAll("[data-lock-debt-liquidation]").forEach((button) => {
    button.addEventListener("click", () =>
      setDecisionLocked("debt", button.dataset.lockDebtLiquidation, button.dataset.lockValue === "true"),
    );
  });
  document.querySelectorAll("[data-execute-debt-liquidation]").forEach((button) => {
    button.addEventListener("click", () =>
      transitionDecisionLifecycle("debt", button.dataset.executeDebtLiquidation, "executed", "Decisión de deuda marcada como ejecutada."),
    );
  });
  renderDebtPayoffChart();
}
