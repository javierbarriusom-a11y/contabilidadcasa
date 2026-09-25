// I1 (Contabilidadcasa 2.0): código exclusivo de las vistas "inversion-cartera", "inversion-
// rebalanceo", "inversion-fiscal", "inversion-jubilacion" e "inversion-apalancamiento", extraído de
// app.js y de views/deuda.js — mismo patrón que ya usa Deuda (OPT-24, PERF-1): un hub con varias
// pestañas que comparten una misma barra de navegación, cargadas como un solo fragmento bajo
// demanda porque comparten esa cabecera entre sí. <script> clásico, no módulo ES: sus
// declaraciones de nivel superior aterrizan en el mismo scope global de siempre. Ningún motor de
// cálculo se movió — IV1/IV6/INV*/FC3/FC4/GOB11/LEV*/AP*... siguen definidos donde ya estaban
// (sobre todo app.js); lo único que cambia es quién dispara su repintado y dónde vive su HTML.

// I1 · Cartera/Rebalanceo/Fiscal/Apalancamiento/Jubilación comparten una misma barra de pestañas
// de pantalla, igual que Ruta/Comparar/Contratos/Simulador/Apalancamiento la compartían en Deuda
// antes de esta tarea (DEUDA_SCREEN_TABS, views/deuda.js). Cada una sigue siendo su propio
// `view-section` con su propio hash — no se fusionan, solo se enlazan visualmente.
const INVERSION_SCREEN_TABS = [
  { id: "inversion-cartera", label: "Cartera" },
  { id: "inversion-rebalanceo", label: "Rebalanceo" },
  { id: "inversion-fiscal", label: "Fiscal" },
  { id: "inversion-jubilacion", label: "Jubilación" },
  { id: "inversion-apalancamiento", label: "Apalancamiento" },
];
const INVERSION_SCREEN_TAB_NAV_IDS = {
  "inversion-cartera": "inversionCarteraScreenTabs",
  "inversion-rebalanceo": "inversionRebalanceoScreenTabs",
  "inversion-fiscal": "inversionFiscalScreenTabs",
  "inversion-jubilacion": "inversionJubilacionScreenTabs",
  "inversion-apalancamiento": "inversionApalancamientoScreenTabs",
};

function inversionScreenTabsHtml(activeId) {
  return INVERSION_SCREEN_TABS.map(
    (tab) =>
      `<a class="e19-registrar-tab${tab.id === activeId ? " is-active" : ""}" href="#${tab.id}"${tab.id === activeId ? ' aria-current="page"' : ""}>${escapeHtml(tab.label)}</a>`
  ).join("");
}

function renderInversionScreenTabs(activeId) {
  const nav = qs(INVERSION_SCREEN_TAB_NAV_IDS[activeId]);
  if (nav) nav.innerHTML = inversionScreenTabsHtml(activeId);
}

// I1 · Cartera: registro de posiciones (IV1) y su análisis (XIRR/benchmark, comisiones,
// concentración, glide path, divisa/geografía, correlación declarada, coste de no tocar, escalera
// de liquidez, DCA) — antes repartidos entre Ajustes → Patrimonio e inversión y Herramientas
// avanzadas → Patrimonio e inversión. Mismas funciones que ya rellenaba renderAjustes(); solo
// cambia quién las llama y dónde vive el HTML que rellenan.
function renderInversionCartera() {
  renderInversionScreenTabs("inversion-cartera");
  renderIv1PositionList();
  renderIv1PositionChart();
  renderIv1ValuationHistoryNote();
  renderIv1TransferOptions();
  renderIv1ContributionOptions();
  renderIv1DisposalOptions();
  renderIv1ScheduledContributionOptions();
  renderIv1GoalOptions();
  renderIv1PositionSummary();
  renderIv1PositionConcentration();
  renderInv16ConcentrationWarnings();
  renderInv14CurrencyGeographyExposure();
  renderInv19FeeCostTrajectory();
  renderInv7LiquidityLadder();
  renderInv8DcaTracking();
  renderInv13DcaTaxProjection();
  syncInv16CorrelationControls();
  renderIvx6GlidePath();
}

// I1 · Rebalanceo: objetivo de reparto por tipo de activo (IV6), revisión por calendario (INV17) y
// prioridad de venta al desapalancar (LEV6) — antes en Ajustes → Patrimonio e inversión y
// Herramientas avanzadas → Patrimonio e inversión.
function renderInversionRebalanceo() {
  renderInversionScreenTabs("inversion-rebalanceo");
  syncIv6TargetControls();
  renderIv6Rebalance();
  renderLev6DeleveragingPriority();
  renderInv17RebalanceCalendarReview();
}

// I1 · Fiscal: solo el subconjunto de FISCALIDAD DE INVERSIÓN (FC4 dividendos, FC3 pérdidas
// arrastradas y su compensación, INV18 "de qué posición y cuándo saco X€ más barato", INV6
// pérdidas latentes candidatas) — la fiscalidad general del hogar (escalas de IRPF/sucesiones,
// registro de supuestos, estimador general de IRPF, borrador de la Renta) se queda en
// Ajustes/Herramientas avanzadas → Fiscal, decisión explícita al construir esta tarea.
function renderInversionFiscal() {
  renderInversionScreenTabs("inversion-fiscal");
  syncDividendTaxControls();
  renderAjustesDividendTaxNote();
  renderFc3PriorLossList();
  renderInv18GoalOptions();
  renderInv6LatentLossCandidates();
}

// I1 · Jubilación: proyección unificada (GOB11, cartera + gasto + fecha objetivo), aportación a
// plan de pensiones (A15-4) y rescate (FCX1) — antes repartidos entre Herramientas avanzadas →
// Fiscal y → Patrimonio e inversión, sin ninguna pantalla que las juntara.
function renderInversionJubilacion() {
  renderInversionScreenTabs("inversion-jubilacion");
  renderGob11Panel();
}

// I1 · Apalancamiento: «Deuda y apalancamiento» (OPT-24) sale de Deuda hacia el hub Inversión —
// decisión explícita del hogar (sesión 201): las 5 áreas de inversión quedan juntas en un solo
// sitio, en vez de dejar Apalancamiento repartido entre Deuda y las otras 4. Idéntica a la antigua
// renderDeudaApalancamiento() de views/deuda.js, solo renombrada — ningún motor ni id cambiaron.
function renderInversionApalancamiento() {
  renderInversionScreenTabs("inversion-apalancamiento");
  renderAp3BarrierStatus();
  renderAp3ScenarioList();
  renderAp6Alert();
  renderAp1DebtOptions();
  renderAp5Queue();
  renderAp1SavingsGoalOptions();
  syncDeb7PreferenceControl();
  renderDeb7PreferenceReading();
  syncDeb11PreferenceControl();
  syncLev1PolicyControls();
  renderLev1PolicyStatus();
  renderDeb1VerdictChangeAlert();
  syncLoanGuaranteeControl();
  renderAjustesLoanGuaranteeNote();
  renderLev4LombardComparison();
  syncDeb4RadarControls();
  renderDeb4RefinancingRadar();
  syncLev5VolatilityControls();
  renderLev5DynamicStress();
  syncApx3LombardDeclarationControls();
  renderLev12ProactiveMarginCallAlert();
  renderLev11PreventiveDeleveragingAlert();
  renderDlx3Retrospective();
  renderLev10DebtCostCurve();
  renderLev16IdleLiquidityCost();
  renderDeb12WaitingCostSoFar();
  syncDeb14MaxMonthsControl();
  renderDeb14MarketCheckAlert();
}

// I13 (BACKLOG_CONTABILIDADCASA_2_0.md §2): comparador de destino para un ingreso extraordinario
// ajeno a la cartera (herencia, bonus, venta fuera de cartera) — la otra mitad de lo que describió
// el hogar sobre I8 (sesión 217, PROJECT_STATE.md). AP1 ya compara amortizar/invertir para
// cualquier importe declarado y DLX2 ya reparte ese importe entre colchón/deuda/inversión según el
// veredicto de AP1 — la única pata que pedía el hogar y no existía era "objetivo de ahorro"
// (Plan › Ahorro y objetivos, P-13). Sin motor nuevo ni supuesto de rentabilidad: resta el
// acumulado real del objetivo (P-16, nunca una previsión) del importe objetivo declarado. P-13 no
// guarda ningún ritmo mensual de aportación, así que no se promete "cuántos meses se adelanta" —
// solo cuánto quedaría antes y después de destinarle el importe, mismo criterio que dlx1GuardrailHtml
// (informa, nunca decide). Vive aquí y no en app.js (ARQ-4): es código de esta pantalla, no un
// motor compartido por varias.
function i13SavingsGoalImpact({ amount, targetAmount, accumulated } = {}) {
  const amountSafe = round2(Math.max(0, Number(amount) || 0));
  const target = round2(Math.max(0, Number(targetAmount) || 0));
  const accumulatedSafe = round2(Math.max(0, Number(accumulated) || 0));
  if (amountSafe <= 0 || target <= 0) return { calculable: false };
  const remainingBefore = round2(Math.max(0, target - accumulatedSafe));
  const remainingAfter = round2(Math.max(0, remainingBefore - amountSafe));
  return {
    calculable: true,
    amount: amountSafe,
    targetAmount: target,
    accumulated: accumulatedSafe,
    remainingBefore,
    remainingAfter,
    completed: remainingBefore > 0 && remainingAfter === 0,
    leftover: round2(Math.max(0, amountSafe - remainingBefore)),
  };
}

function i13SavingsGoalImpactHtml(result, goalLabel) {
  if (!result || !result.calculable) return "";
  if (result.completed) {
    const leftoverNote = result.leftover > 0 ? ` Sobran ${money(result.leftover, true)} para otro destino.` : "";
    return `<p class="e19-kpi-note"><strong>Objetivo «${escapeHtml(goalLabel)}» (I13)</strong>: quedaba ${money(result.remainingBefore, true)} — con ${money(result.amount, true)} lo completas.${leftoverNote}</p>`;
  }
  return `<p class="e19-kpi-note"><strong>Objetivo «${escapeHtml(goalLabel)}» (I13)</strong>: quedaba ${money(result.remainingBefore, true)} — con ${money(result.amount, true)} pasaría a faltar ${money(result.remainingAfter, true)}.</p>`;
}

// I13: mismo criterio que sobresGoalDestinoOptions (P-16, views/cierre.js) — solo objetivos con
// importe declarado y todavía sin completar tienen sentido como destino de este importe.
function ap1SavingsGoalOptionsHtml() {
  const contributions = savingsGoalsContributions();
  const goals = savingsGoalsList().filter((goal) => {
    const target = Number(goal.targetAmount || 0);
    return target > 0 && Number(contributions[goal.id] || 0) < target;
  });
  const options = [`<option value="">Sin objetivo</option>`];
  goals.forEach((goal) => options.push(`<option value="${escapeHtml(goal.id)}">${escapeHtml(goal.label)}</option>`));
  return options.join("");
}

function renderAp1SavingsGoalOptions() {
  const select = qs("ap1SavingsGoalSelect");
  if (!select) return;
  const current = select.value;
  select.innerHTML = ap1SavingsGoalOptionsHtml();
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}
