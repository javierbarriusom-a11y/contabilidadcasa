// PERF-1 (FASE 6, piloto de carga diferida): código exclusivo de la vista "presupuesto-mes",
// extraído de app.js. Se carga bajo demanda (ver loadViewChunk() en app.js) la primera vez que se
// visita la pantalla — no es un módulo ES: al ser <script> clásico, sus declaraciones de nivel
// superior aterrizan en el mismo scope global que antes, así que puede seguir usando en tiempo de
// ejecución todo lo que ya vive en app.js (baseData, budgets, budgetSurplusChoices, euro(), etc.)
// sin necesidad de importar nada. Solo se extrajo lo que NINGUNA otra vista usa; lo que Hoy (U-2)
// necesita (budgetAlertForRow, budgetComplianceStreak, homeBudgetSummary...) se quedó en app.js.

function budgetableCategories() {
  const set = new Set();
  (baseData?.transactions || []).forEach((row) => {
    if (Number(row.amount || 0) < 0 && row.category) set.add(row.category);
  });
  const monthKey = currentBudgetMonthKey();
  manualPartidaEntriesForMonth(monthKey).forEach((entry) => set.add(categoryForPartidaEntry(entry)));
  return [...set].sort();
}

// F-1: forecast por categoría con estacionalidad (canonical-budget-forecast-category.js, FASE 0,
// cargado desde index.html pero sin usar hasta ahora). suggestedBudget() ya decide internamente
// si usar el forecast (confianza alta) o caer al p75 histórico — no se reimplementa ese criterio.
function budgetForecastForCategory(category, monthKey) {
  const forecastApi = window.FinanceCanonicalBudgetForecastCategory?.CanonicalBudgetForecastCategory;
  if (!forecastApi) return null;
  const historical = budgetHistoricalExpenseTransactions(category, monthKey);
  const manual = syntheticManualMovements(category, recentBudgetMonthKeys(monthKey, 12));
  return forecastApi.forecast([...historical, ...manual], { months: 12, forecastMonths: 3 });
}


// P-3: si el mes anterior se decidió "llevar al mes siguiente" para esta categoría, el sobrante
// se suma al presupuesto sugerido — la holgura real, no solo un aviso informativo.
function budgetCarryoverForCategory(category, monthKey) {
  const choice = budgetSurplusChoices[previousBudgetMonthKey(monthKey)]?.[category];
  return choice?.choice === "holgura" ? round2(Number(choice.amount || 0)) : 0;
}

function suggestedAmountForCategory(category, monthKey) {
  const analysis = budgetAnalysisForCategory(category, monthKey);
  if (!analysis) return null;
  const forecastApi = window.FinanceCanonicalBudgetForecastCategory?.CanonicalBudgetForecastCategory;
  const base = forecastApi ? forecastApi.suggestedBudget(analysis, budgetForecastForCategory(category, monthKey)) : analysis.recommendation;
  const carryover = budgetCarryoverForCategory(category, monthKey);
  return carryover > 0 ? round2(base + carryover) : base;
}

// P-3: gestión de hucha — qué hacer con lo no gastado. Tres opciones, todas persistidas; solo
// "holgura" tiene efecto automático (ver budgetCarryoverForCategory). "ahorro-fijo" y "flexible"
// registran la decisión para el histórico, sin mover saldos de cuentas todavía (fuera de alcance
// de esta fase: requeriría enlazar con el plan de ahorro del hogar, no solo con presupuestos).
const BUDGET_SURPLUS_CHOICES = Object.freeze({
  "ahorro-fijo": "Guardar como ahorro",
  holgura: "Llevar al mes siguiente",
  flexible: "Gasto flexible esta semana",
});

function budgetSurplusForRow(budget, monthKey) {
  const alert = budgetAlertForRow(budget, monthKey);
  return round2(Math.max(0, budget.amountCap - alert.metrics.spent));
}

function budgetSurplusEntries(monthKey) {
  const monthBudgets = categoryBudgetsForMonth(monthKey);
  return monthBudgets
    .map((budget) => ({ budget, surplus: budgetSurplusForRow(budget, monthKey) }))
    .filter(({ surplus }) => surplus > 0);
}

function handleBudgetSurplusChoice(select) {
  const category = select.dataset.presupuestoMesSurplus;
  const monthKey = select.dataset.presupuestoMesSurplusMonth;
  const surplus = Number(select.dataset.presupuestoMesSurplusAmount);
  const choice = select.value;
  if (!category || !monthKey) return;
  const monthChoices = { ...(budgetSurplusChoices[monthKey] || {}) };
  if (choice) {
    monthChoices[category] = { choice, amount: surplus, appliedAt: new Date().toISOString() };
  } else {
    delete monthChoices[category];
  }
  budgetSurplusChoices = { ...budgetSurplusChoices, [monthKey]: monthChoices };
  saveBudgetSurplusChoices();
  renderPresupuestoMes();
}

// S-3: histórico visual de 12 meses, presupuesto vs. real, por categoría.
function budgetHistoryMonthKeys(monthKey, count = 12) {
  return [...recentBudgetMonthKeys(monthKey, count - 1), monthKey];
}

function budgetHistoryCellHtml(category, monthKeyForCell) {
  const budget = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForCategoryMonth(budgets, category, monthKeyForCell);
  const monthLabel = escapeHtml(ledgerMonthLabel(monthKeyForCell));
  if (!budget) return `<td class="registrar-mes-empty" title="${monthLabel}: sin presupuesto">—</td>`;
  const alert = budgetAlertForRow(budget, monthKeyForCell);
  const pct = budget.amountCap > 0 ? Math.round((alert.metrics.spent / budget.amountCap) * 100) : 0;
  const badgeClass = pct > 100 ? "e19-badge-danger" : pct >= 80 ? "e19-badge-warning" : "e19-badge-success";
  const title = `${monthLabel}: ${money(alert.metrics.spent, true)} de ${money(budget.amountCap, true)} (${pct}%)`;
  return `<td><span class="e19-badge ${badgeClass}" title="${escapeHtml(title)}">${pct}%</span></td>`;
}

function presupuestoMesHistoryHtml(monthKey) {
  const monthBudgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForMonth(budgets, monthKey) || [];
  if (!monthBudgets.length) return "";
  const months = budgetHistoryMonthKeys(monthKey, 12);
  const header = months.map((m) => `<th>${escapeHtml(ledgerMonthLabel(m))}</th>`).join("");
  const rows = monthBudgets
    .map(
      (budget) =>
        `<tr><td class="t">${escapeHtml(budgetRowDisplayLabel(budget.categoryId))}</td>${months.map((m) => budgetHistoryCellHtml(budget.categoryId, m)).join("")}</tr>`,
    )
    .join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Histórico de 12 meses</h3>
        <p class="e19-subtitle">% de presupuesto gastado por categoría, mes a mes. Verde: por debajo del 80%. Ámbar: 80-100%. Rojo: por encima del presupuesto.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Categoría</th>${header}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </article>`;
}

// LINK-1: conecta el margen libre del mes con la ruta de deuda ya existente (E13), reutilizando
// debtPriorityCandidates()/debtReliefMonthsForItem() tal cual — no se reimplementa el cálculo de
// alivio de deuda, solo se le da como "monthlyRelief" la suma del margen de presupuesto libre.
function presupuestoMesDebtLinkHtml(monthKey) {
  if (typeof debtPriorityCandidates !== "function" || typeof debtReliefMonthsForItem !== "function") return "";
  const totalMargin = round2(budgetSurplusEntries(monthKey).reduce((sum, { surplus }) => sum + surplus, 0));
  if (totalMargin <= 0) return "";
  const top = debtPriorityCandidates()[0];
  if (!top?.target?.id) return "";
  const reliefMonths = debtReliefMonthsForItem({ targetId: top.target.id, monthlyRelief: totalMargin }, 0);
  if (!reliefMonths) return "";
  const debtName = typeof debtTargetDisplayName === "function" ? debtTargetDisplayName(top.target) : "tu deuda principal";
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Impacto en tu deuda</h3>
        <p class="e19-subtitle">Si el margen libre de este mes se destina a amortizar deuda extra, en vez de gastarlo o guardarlo.</p>
      </div>
    </div>
    <div class="registrar-mes-card-foot">
      <p class="e19-kpi-note">Margen libre: ${money(totalMargin, true)}. Como pago extra a «${escapeHtml(debtName)}», adelantaría su pago unos <strong>${reliefMonths}</strong> mes${reliefMonths === 1 ? "" : "es"}. Estimación aproximada; no se aplica nada automáticamente — usa «Deuda · ruta» para decidirlo de verdad.</p>
    </div>
  </article>`;
}

// SIM-1: motor "¿y si...?" — simulación efímera en memoria, como el laboratorio de escenarios de
// E13 (no persistida, no toca budgets[]): cambia el presupuesto de una categoría por un delta
// mensual constante y las tarjetas SIM-2/SIM-3/LINK-2 recalculan a partir de este único estado.
let budgetSimulation = { category: "", delta: 0 };

function budgetSimulationCategory(monthKey) {
  const categories = budgetableCategories();
  if (budgetSimulation.category && categories.includes(budgetSimulation.category)) return budgetSimulation.category;
  const monthBudgets = categoryBudgetsForMonth(monthKey);
  return monthBudgets[0]?.categoryId || categories[0] || "";
}

function budgetSimulationBaseline(category, monthKey) {
  if (!category) return 0;
  const existing = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForCategoryMonth(budgets, category, monthKey);
  return existing ? existing.amountCap : suggestedAmountForCategory(category, monthKey) || 0;
}

function handleBudgetSimulationCategoryChange(select) {
  budgetSimulation = { ...budgetSimulation, category: select.value };
  renderPresupuestoMes();
}

function handleBudgetSimulationDeltaChange(input) {
  const delta = Number(input.value);
  budgetSimulation = { ...budgetSimulation, delta: Number.isFinite(delta) ? delta : 0 };
  renderPresupuestoMes();
}

function presupuestoMesSimulatorHtml(monthKey) {
  const categories = budgetableCategories();
  if (!categories.length) return "";
  const category = budgetSimulationCategory(monthKey);
  const baseline = budgetSimulationBaseline(category, monthKey);
  const delta = budgetSimulation.delta || 0;
  const simulated = round2(Math.max(0, baseline + delta));
  const options = categories
    .map((cat) => `<option value="${escapeHtml(cat)}"${cat === category ? " selected" : ""}>${escapeHtml(cat)}</option>`)
    .join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Simulador «¿y si...?»</h3>
        <p class="e19-subtitle">Cambia el presupuesto de una categoría y mira el impacto en caja, cobertura y deuda de las tarjetas de abajo. Nada se guarda: es una simulación, no un cambio real.</p>
      </div>
    </div>
    <div class="alert-rule-form">
      <label><span>Categoría</span><select data-presupuesto-mes-sim-category aria-label="Categoría a simular">${options}</select></label>
      <label><span>Cambio mensual (€)</span><input type="number" step="1" data-presupuesto-mes-sim-delta value="${delta}" aria-label="Cambio mensual en euros (negativo para recortar)" /></label>
    </div>
    <div class="registrar-mes-card-foot">
      <p class="e19-kpi-note">Presupuesto actual de ${escapeHtml(category)}: ${money(baseline, true)}. Simulado: <strong>${money(simulated, true)}</strong> (${delta >= 0 ? "+" : ""}${money(delta, true)}/mes).</p>
    </div>
  </article>`;
}

// SIM-2/LINK-2: impacto compartido de la simulación a 3/6/12 meses. Aproximación declarada (el
// delta se asume constante cada mes, no un forecast completo de caja): ahorro acumulado = delta ×
// horizonte; cobertura reutiliza safeCoverageMonths() con el total presupuestado del mes como
// salida mensual de referencia (mismo agregado que ya calcula homeBudgetSummary() para U-1); deuda
// reutiliza debtPriorityCandidates()/debtReliefMonthsForItem() tal cual, como en LINK-1 — solo
// cambia qué importe mensual se le pasa como alivio.
function budgetSimulationHorizons() {
  return [3, 6, 12];
}

function budgetSimulationImpact(monthKey) {
  const category = budgetSimulationCategory(monthKey);
  const delta = round2(budgetSimulation.delta || 0);
  if (!category || !delta) return null;
  const baseline = budgetSimulationBaseline(category, monthKey);
  // Un delta negativo (recorte de presupuesto) libera caja; uno positivo (subida) la consume — el
  // impacto en caja/cobertura/deuda va en el sentido contrario al del cambio de presupuesto.
  const cashDelta = round2(-delta);
  const currentCash = accountBalancesFromState().total;
  const monthlyOutflow = homeBudgetSummary()?.totalBudgeted || 0;
  const horizons = budgetSimulationHorizons().map((months) => {
    const savings = round2(cashDelta * months);
    const cash = round2(currentCash + savings);
    return { months, savings, cash, coverage: safeCoverageMonths(cash, monthlyOutflow) };
  });
  let debt = null;
  if (cashDelta > 0 && typeof debtPriorityCandidates === "function" && typeof debtReliefMonthsForItem === "function") {
    const top = debtPriorityCandidates()[0];
    const reliefMonths = top?.target?.id ? debtReliefMonthsForItem({ targetId: top.target.id, monthlyRelief: cashDelta }, 0) : 0;
    if (reliefMonths) {
      debt = {
        reliefMonths,
        cashDelta,
        debtName: typeof debtTargetDisplayName === "function" ? debtTargetDisplayName(top.target) : "tu deuda principal",
      };
    }
  }
  return { category, delta, baseline, horizons, debt };
}

function presupuestoMesSimulationImpactHtml(monthKey) {
  const impact = budgetSimulationImpact(monthKey);
  if (!impact) return "";
  const rows = impact.horizons
    .map(
      ({ months, savings, cash, coverage }) => `<tr>
        <td class="t">${months} meses</td>
        <td class="${savings >= 0 ? "positive" : "negative"}">${savings >= 0 ? "+" : ""}${money(savings, true)}</td>
        <td>${money(cash, true)}</td>
        <td>${coverage === null ? "N/D" : `${coverageMonthsText(coverage)} meses`}</td>
      </tr>`,
    )
    .join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Impacto de la simulación</h3>
        <p class="e19-subtitle">Si mantienes el cambio simulado en ${escapeHtml(impact.category)} de forma constante cada mes. Cobertura = caja proyectada ÷ total presupuestado del mes actual — aproximación, no sustituye a la previsión completa de caja.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Horizonte</th><th>Ahorro acumulado</th><th>Caja proyectada</th><th>Cobertura</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </article>`;
}

// SIM-3: comparador presupuesto actual vs. simulado sobre el histórico de 12 meses. Reutiliza
// budgetAlertForRow() con un presupuesto sintético (mismo "Gastado" fusionado banco + partidas a
// mano que ya usa S-3) para no duplicar esa lógica; solo cambia el importe contra el que se mide.
function presupuestoMesComparatorHtml(monthKey) {
  const impact = budgetSimulationImpact(monthKey);
  if (!impact) return "";
  const { category, baseline, delta } = impact;
  const simulatedAmount = round2(Math.max(0, baseline + delta));
  const months = budgetHistoryMonthKeys(monthKey, 12);
  let actualOnTrack = 0;
  let simulatedOnTrack = 0;
  const rows = months
    .map((m) => {
      const spent = budgetAlertForRow({ categoryId: category, amountCap: baseline || 1 }, m).metrics.spent;
      const actualPct = baseline > 0 ? Math.round((spent / baseline) * 100) : 0;
      const simulatedPct = simulatedAmount > 0 ? Math.round((spent / simulatedAmount) * 100) : 0;
      if (actualPct <= 100) actualOnTrack += 1;
      if (simulatedPct <= 100) simulatedOnTrack += 1;
      return `<tr><td class="t">${escapeHtml(ledgerMonthLabel(m))}</td><td>${money(spent, true)}</td><td>${actualPct}%</td><td>${simulatedPct}%</td></tr>`;
    })
    .join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Comparador: actual vs. simulado</h3>
        <p class="e19-subtitle">${escapeHtml(category)}: con el presupuesto actual (${money(baseline, true)}) habrías ido en ritmo ${actualOnTrack}/${months.length} meses del histórico; con el simulado (${money(simulatedAmount, true)}), ${simulatedOnTrack}/${months.length}.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Mes</th><th>Gastado</th><th>% actual</th><th>% simulado</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </article>`;
}

// LINK-2: misma mecánica que LINK-1 (E13, tal cual: debtPriorityCandidates()/
// debtReliefMonthsForItem()), pero disparada por el delta simulado en SIM-1 en vez del margen
// libre real del mes — es una simulación, no dinero ya ahorrado.
function presupuestoMesSimulationDebtLinkHtml(monthKey) {
  const impact = budgetSimulationImpact(monthKey);
  if (!impact?.debt) return "";
  const { reliefMonths, debtName, cashDelta } = impact.debt;
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Impacto simulado en tu deuda</h3>
        <p class="e19-subtitle">Si el cambio simulado se destinara íntegro a amortizar deuda extra cada mes.</p>
      </div>
    </div>
    <div class="registrar-mes-card-foot">
      <p class="e19-kpi-note">Si ahorras ${money(cashDelta, true)}/mes en ${escapeHtml(impact.category)}, «${escapeHtml(debtName)}» se pagaría unos <strong>${reliefMonths}</strong> mes${reliefMonths === 1 ? "" : "es"} antes. Estimación de la simulación; no se aplica nada automáticamente.</p>
    </div>
  </article>`;
}


// Igual que budgetComplianceStreak(), pero exige además que el gasto quede en la banda 80-100% del
// presupuesto (ni gran holgura ni sobregasto) — la misma banda que ya usan los badges de S-3
// (verde <80%, ámbar 80-100%, rojo >100%) para "en ritmo, sin margen de sobra".
function budgetBalancedStreak(category, monthKey, maxMonths = 24) {
  let streak = 0;
  let cursor = monthKey;
  for (let i = 0; i < maxMonths; i += 1) {
    const budget = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForCategoryMonth(budgets, category, cursor);
    if (!budget || budget.amountCap <= 0) break;
    const pct = (budgetAlertForRow(budget, cursor).metrics.spent / budget.amountCap) * 100;
    if (pct < 80 || pct > 100) break;
    streak += 1;
    cursor = previousBudgetMonthKey(cursor);
  }
  return streak;
}

// TRACK-2 (FASE 7): además de la racha ACTUAL (GAME-1, budgetComplianceStreak — se corta en el
// primer sobregasto), la mejor racha histórica: un récord que no se pierde solo porque el mes en
// curso rompa la racha viva. Mismo criterio de parada que GAME-1 (se detiene en el primer mes sin
// presupuesto, sin datos que clasificar) pero, a diferencia de la actual, sigue recorriendo el
// historial tras un sobregasto en vez de detenerse ahí — solo reinicia el contador.
function budgetLongestComplianceStreak(category, monthKey, maxMonths = 24) {
  let best = 0;
  let current = 0;
  let cursor = monthKey;
  for (let i = 0; i < maxMonths; i += 1) {
    const budget = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForCategoryMonth(budgets, category, cursor);
    if (!budget) break;
    if (budgetAlertForRow(budget, cursor).metrics.spent > budget.amountCap) {
      current = 0;
    } else {
      current += 1;
      if (current > best) best = current;
    }
    cursor = previousBudgetMonthKey(cursor);
  }
  return best;
}

// TRACK-2: secuencia de cumplimiento (dentro de presupuesto / sobregasto) de los últimos meses, la
// misma clasificación binaria que ya cuentan las rachas — más legible de un vistazo que la tabla
// completa de "Histórico de 12 meses" (S-3), que muestra el % exacto de cada mes en vez de si ese
// mes rompió o no la racha. Reutiliza budgetHistoryMonthKeys() (S-3) para la ventana de meses.
function budgetComplianceHistorySequenceHtml(category, monthKey, count = 6) {
  return budgetHistoryMonthKeys(monthKey, count)
    .map((cursorMonthKey) => {
      const label = escapeHtml(ledgerMonthLabel(cursorMonthKey));
      const budget = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForCategoryMonth(budgets, category, cursorMonthKey);
      if (!budget) return `<span class="e19-badge" title="${label}: sin presupuesto">·</span>`;
      const compliant = budgetAlertForRow(budget, cursorMonthKey).metrics.spent <= budget.amountCap;
      const cls = compliant ? "e19-badge-success" : "e19-badge-danger";
      const title = `${label}: ${compliant ? "dentro de presupuesto" : "sobregasto"}`;
      return `<span class="e19-badge ${cls}" title="${escapeHtml(title)}">${compliant ? "✓" : "✗"}</span>`;
    })
    .join(" ");
}

function presupuestoMesGoalsHtml(monthKey) {
  const monthBudgets = categoryBudgetsForMonth(monthKey);
  if (!monthBudgets.length) return "";
  const rows = monthBudgets
    .map((budget) => {
      const streak = budgetComplianceStreak(budget.categoryId, monthKey);
      const best = budgetLongestComplianceStreak(budget.categoryId, monthKey);
      const history = budgetComplianceHistorySequenceHtml(budget.categoryId, monthKey);
      return `<tr>
        <td class="t">${escapeHtml(budget.categoryId)}</td>
        <td>${streak} mes${streak === 1 ? "" : "es"} seguido${streak === 1 ? "" : "s"}</td>
        <td>${best} mes${best === 1 ? "" : "es"}</td>
        <td>${history}</td>
      </tr>`;
    })
    .join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Objetivos: meses seguidos dentro de presupuesto</h3>
        <p class="e19-subtitle">La meta de cada categoría es el propio presupuesto del mes (P-2). La racha actual cuenta meses consecutivos hasta hoy sin sobregasto y se corta en el primero por encima de él; la mejor racha es el récord histórico, que no se pierde al romperse la actual. Los últimos 6 meses: ✓ dentro de presupuesto, ✗ sobregasto, · sin presupuesto ese mes.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Categoría</th><th>Racha actual</th><th>Mejor racha</th><th>Últimos 6 meses</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </article>`;
}

// GAME-2: badges/logros, derivados de las rachas de GAME-1. "Ahorrista" premia la constancia
// (dentro de presupuesto); "Equilibrador" premia además la precisión (ni gran holgura ni
// sobregasto, banda 80-100%) — son criterios distintos y complementarios, no el mismo umbral dos
// veces.
const BUDGET_BADGES = Object.freeze([
  {
    id: "ahorrista",
    icon: "🏅",
    label: "Ahorrista",
    description: "3 meses seguidos dentro de presupuesto",
    streak: (category, monthKey) => budgetComplianceStreak(category, monthKey),
  },
  {
    id: "equilibrador",
    icon: "⚖️",
    label: "Equilibrador",
    description: "3 meses seguidos gastando entre el 80% y el 100% del presupuesto",
    streak: (category, monthKey) => budgetBalancedStreak(category, monthKey),
  },
]);

function budgetBadgesForCategory(category, monthKey) {
  return BUDGET_BADGES.filter((badge) => badge.streak(category, monthKey) >= 3);
}

function presupuestoMesBadgesHtml(monthKey) {
  const monthBudgets = categoryBudgetsForMonth(monthKey);
  const earned = monthBudgets.flatMap((budget) =>
    budgetBadgesForCategory(budget.categoryId, monthKey).map((badge) => ({ budget, badge })),
  );
  if (!earned.length) return "";
  const items = earned
    .map(
      ({ budget, badge }) =>
        `<li><strong>${badge.icon} ${escapeHtml(badge.label)}</strong> — ${escapeHtml(budget.categoryId)}: ${escapeHtml(badge.description)}.</li>`,
    )
    .join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Logros</h3>
        <p class="e19-subtitle">Insignias ganadas por categoría según su racha actual (GAME-1). Se pierden si el mes en curso rompe la racha.</p>
      </div>
    </div>
    <ul class="commit-barrier-list">${items}</ul>
  </article>`;
}

// GAME-3: reto "el mes que menos gastamos" — compara la proyección de fin de mes (S-2) con el
// mínimo histórico real de los últimos 12 meses para esa categoría (excluyendo el mes en curso).
// Reutiliza budgetAlertForRow()/budgetProjection() mes a mes, sin nueva lógica de cálculo.
function budgetHistoricalMinimumSpend(category, monthKey) {
  const spentValues = recentBudgetMonthKeys(monthKey, 12)
    .map((m) => budgetAlertForRow({ categoryId: category, amountCap: 1 }, m).metrics.spent)
    .filter((spent) => spent > 0);
  return spentValues.length ? Math.min(...spentValues) : null;
}

function presupuestoMesChallengeHtml(monthKey) {
  const monthBudgets = categoryBudgetsForMonth(monthKey);
  const rows = monthBudgets
    .map((budget) => {
      const recordMin = budgetHistoricalMinimumSpend(budget.categoryId, monthKey);
      if (recordMin === null) return null;
      const projection = budgetProjection(budgetAlertForRow(budget, monthKey), monthKey);
      const onTrack = projection.projected <= recordMin;
      return { category: budget.categoryId, recordMin, projected: projection.projected, onTrack };
    })
    .filter(Boolean);
  if (!rows.length) return "";
  const items = rows
    .map(
      ({ category, recordMin, projected, onTrack }) => `<tr class="${onTrack ? "" : ""}">
        <td class="t">${escapeHtml(category)}</td>
        <td>${money(recordMin, true)}</td>
        <td>${money(projected, true)}</td>
        <td>${onTrack ? `<span class="e19-pill e19-pill-safe">Camino de récord</span>` : `<span class="e19-pill e19-pill-warn">Por encima del récord</span>`}</td>
      </tr>`,
    )
    .join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Reto: el mes que menos gastas</h3>
        <p class="e19-subtitle">Compara la proyección de fin de mes con el mes de menor gasto real de los últimos 12 meses, por categoría.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Categoría</th><th>Récord (mínimo histórico)</th><th>Proyección este mes</th><th>Estado</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
    </div>
  </article>`;
}

// NOTIF-1: notificaciones inteligentes. Sin canal de push real todavía (A5-5 sigue pendiente en
// BACKLOG_STATUS), así que es un centro de avisos en pantalla que consolida tres señales ya
// calculadas en otras tareas de esta iniciativa — no inventa datos nuevos, solo los reúne:
// desviación (alertas de sobregasto de S-1), hito (badges recién ganados de GAME-2) y hucha
// disponible (sobrante sin decidir de P-3).
function budgetSmartNotifications(monthKey) {
  const monthBudgets = categoryBudgetsForMonth(monthKey);
  const notifications = [];
  monthBudgets.forEach((budget) => {
    const alert = budgetAlertForRow(budget, monthKey);
    if (alert.status === "overspend") {
      notifications.push({ icon: "⚠️", text: `${budget.categoryId}: por encima del ritmo — ${alert.message}` });
    }
  });
  monthBudgets.forEach((budget) => {
    budgetBadgesForCategory(budget.categoryId, monthKey).forEach((badge) => {
      notifications.push({ icon: badge.icon, text: `${budget.categoryId}: logro «${badge.label}» — ${badge.description}.` });
    });
  });
  budgetSurplusEntries(monthKey).forEach(({ budget, surplus }) => {
    if (!budgetSurplusChoices[monthKey]?.[budget.categoryId]) {
      notifications.push({ icon: "🐷", text: `Hucha disponible en ${budget.categoryId}: ${money(surplus, true)} sin decidir todavía.` });
    }
  });
  return notifications;
}

function presupuestoMesNotificationsHtml(monthKey) {
  const notifications = budgetSmartNotifications(monthKey);
  if (!notifications.length) return "";
  const items = notifications.map((n) => `<li>${n.icon} ${escapeHtml(n.text)}</li>`).join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Notificaciones inteligentes</h3>
        <p class="e19-subtitle">Resumen de lo que necesita tu atención este mes: desviaciones, logros y hucha por decidir. Sin canal de push todavía; se consulta aquí.</p>
      </div>
    </div>
    <ul class="commit-barrier-list">${items}</ul>
  </article>`;
}

// ML-1: análisis de cohortes estacionales — "tus meses de julio gastan un 15% más". Agrupa el
// gasto real histórico (24 meses) por mes del calendario y compara la media de cada uno contra la
// media global de la categoría; solo informa de meses con al menos 2 observaciones y una
// desviación de 10% o más, para no señalar ruido con muestras pequeñas.
function budgetCalendarMonthName(monthNumber) {
  return new Date(2000, monthNumber - 1, 1).toLocaleDateString("es-ES", { month: "long" });
}

function budgetSeasonalPatterns(category, monthKey, monthsBack = 24) {
  const spendByCalendarMonth = {};
  recentBudgetMonthKeys(monthKey, monthsBack)
    .concat(monthKey)
    .forEach((m) => {
      const spent = budgetAlertForRow({ categoryId: category, amountCap: 1 }, m).metrics.spent;
      if (spent <= 0) return;
      const calendarMonth = Number(m.split("-")[1]);
      (spendByCalendarMonth[calendarMonth] ||= []).push(spent);
    });
  const allValues = Object.values(spendByCalendarMonth).flat();
  if (allValues.length < 6) return [];
  const overallAvg = allValues.reduce((a, b) => a + b, 0) / allValues.length;
  if (overallAvg <= 0) return [];
  return Object.entries(spendByCalendarMonth)
    .filter(([, values]) => values.length >= 2)
    .map(([calendarMonth, values]) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return { calendarMonth: Number(calendarMonth), avg, samples: values.length, deviationPct: Math.round(((avg - overallAvg) / overallAvg) * 100) };
    })
    .filter((pattern) => Math.abs(pattern.deviationPct) >= 10)
    .sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));
}

function presupuestoMesSeasonalHtml(monthKey) {
  const categories = budgetableCategories();
  const items = categories
    .flatMap((category) => budgetSeasonalPatterns(category, monthKey).slice(0, 1).map((pattern) => ({ category, pattern })))
    .sort((a, b) => Math.abs(b.pattern.deviationPct) - Math.abs(a.pattern.deviationPct))
    .slice(0, 8);
  if (!items.length) return "";
  const rows = items
    .map(
      ({ category, pattern }) => `<li>${escapeHtml(category)}: los meses de <strong>${escapeHtml(budgetCalendarMonthName(pattern.calendarMonth))}</strong> gastan un ${pattern.deviationPct > 0 ? "+" : ""}${pattern.deviationPct}% ${pattern.deviationPct > 0 ? "más" : "menos"} que la media (${pattern.samples} observaciones, media ${money(pattern.avg, true)}).</li>`,
    )
    .join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Patrones estacionales</h3>
        <p class="e19-subtitle">Meses del calendario con gasto real significativamente distinto a la media de cada categoría (24 meses de histórico, mínimo 2 observaciones, desviación ≥10%).</p>
      </div>
    </div>
    <ul class="commit-barrier-list">${rows}</ul>
  </article>`;
}

// FCST-1 (FASE 7): forecast por categoría a 3 horizontes (semana, cierre de mes, +3 meses). Sin
// motor nuevo: `canonical-budget-forecast-category.js` ya calculaba predicted/±range/confidence por
// mes, pero solo se usaba internamente para "Sugerir presupuestos" (suggestedBudget) — la banda de
// confianza en sí nunca se mostraba. Cierre de mes reutiliza tal cual budgetProjection() (S-2, ya
// visible en la tabla de arriba); lo único nuevo es el horizonte semanal (el forecast del mes en
// curso ÷ 4,345 semanas/mes, mismo criterio ya usado en presupuestoMesGoalOptionLabel) y exponer la
// banda de +3 meses que hasta ahora se calculaba y se descartaba.
function budgetForecastHorizons(category, monthKey) {
  const forecastApi = window.FinanceCanonicalBudgetForecastCategory?.CanonicalBudgetForecastCategory;
  if (!forecastApi) return null;
  const historical = budgetHistoricalExpenseTransactions(category, monthKey);
  const manual = syntheticManualMovements(category, recentBudgetMonthKeys(monthKey, 12));
  // forecastMonths: 4 → el mes en curso (índice 0) y los tres siguientes, para que el índice 3 sea
  // de verdad "+3 meses" desde hoy (budgetForecastForCategory usa 3 para otro propósito: sugerir
  // presupuesto con los 3 primeros meses del forecast, no necesita el cuarto).
  const forecast = forecastApi.forecast([...historical, ...manual], { months: 12, forecastMonths: 4 });
  if (!forecast) return null;
  const monthKeys = Object.keys(forecast.monthlyForecast);
  const weekMonthKey = monthKeys[0];
  const threeMonthsOutMonthKey = monthKeys[3];
  const currentMonthForecast = forecast.monthlyForecast[weekMonthKey] || null;
  const threeMonthsOut = forecast.monthlyForecast[threeMonthsOutMonthKey] || null;
  const week = currentMonthForecast
    ? {
        predicted: round2(currentMonthForecast.predicted / 4.345),
        range: `±${round2(Number(currentMonthForecast.range.replace("±", "")) / 4.345)}`,
        confidence: currentMonthForecast.confidence,
      }
    : null;
  return { week, threeMonthsOut, weekMonthKey, threeMonthsOutMonthKey };
}

function budgetForecastConfidenceLabel(confidence) {
  return confidence === "high" ? "alta" : confidence === "medium" ? "media" : "baja";
}

// FCST-2 (FASE 7): conecta el laboratorio de Escenarios (E13, en app.js) con el forecast por
// categoría de FCST-1 — sin recalcular ninguno de los dos motores. Un evento de E13 solo participa
// aquí si se etiquetó con una categoría al crearlo (categoryId, ver e13BudgetCategoryOptions en
// app.js); "pérdida de ingreso" no aplica a una categoría de gasto y se excluye. e13ScenarioEvents
// es el mismo estado global que ya usa renderE13ScenarioLab (declarado con let en app.js, visible
// aquí igual que budgets/budgetSurplusChoices, ver cabecera del archivo).
function e13EventCoversMonth(event, targetMonthKey) {
  if (!event?.monthKey || !targetMonthKey) return false;
  const start = dateFromMonthKey(event.monthKey);
  const duration = Math.max(1, Math.round(Number(event.duration) || 1));
  for (let i = 0; i < duration; i += 1) {
    if (monthKey(addMonths(start, i)) === targetMonthKey) return true;
  }
  return false;
}

function budgetScenarioImpactForMonth(category, targetMonthKey) {
  if (!category || !targetMonthKey || !Array.isArray(e13ScenarioEvents)) return null;
  const events = e13ScenarioEvents.filter(
    (event) => event.categoryId === category && event.type !== "income-loss" && e13EventCoversMonth(event, targetMonthKey),
  );
  if (!events.length) return null;
  return {
    amount: round2(events.reduce((total, event) => total + Number(event.amount || 0), 0)),
    labels: events.map((event) => event.label).join(", "),
  };
}

function presupuestoMesForecastHorizonsRowHtml(budget, monthKey) {
  const horizons = budgetForecastHorizons(budget.categoryId, monthKey);
  if (!horizons) {
    return `<tr><td class="t">${escapeHtml(budgetRowDisplayLabel(budget.categoryId))}</td><td colspan="3" class="registrar-mes-empty">Histórico insuficiente para forecast (hacen falta 6+ meses de datos).</td></tr>`;
  }
  const alert = budgetAlertForRow(budget, monthKey);
  const projection = budgetProjection(alert, monthKey);
  const weekImpact = budgetScenarioImpactForMonth(budget.categoryId, horizons.weekMonthKey);
  const threeMonthsImpact = budgetScenarioImpactForMonth(budget.categoryId, horizons.threeMonthsOutMonthKey);
  const weekCell = horizons.week
    ? `${money(round2(horizons.week.predicted + (weekImpact ? weekImpact.amount / 4.345 : 0)), true)} <small class="note">${horizons.week.range}, confianza ${budgetForecastConfidenceLabel(horizons.week.confidence)}</small>${weekImpact ? `<br><small class="note">+${money(round2(weekImpact.amount / 4.345), true)} por escenario «${escapeHtml(weekImpact.labels)}»</small>` : ""}`
    : `<span class="registrar-mes-empty">—</span>`;
  const monthCloseCell = `${money(projection.projected, true)}<br><small class="note">${projection.diff > 0 ? `+${money(projection.diff, true)} sobre` : `${money(Math.abs(projection.diff), true)} margen`}</small>`;
  const threeMonthsCell = horizons.threeMonthsOut
    ? `${money(round2(horizons.threeMonthsOut.predicted + (threeMonthsImpact ? threeMonthsImpact.amount : 0)), true)} <small class="note">${horizons.threeMonthsOut.range}, confianza ${budgetForecastConfidenceLabel(horizons.threeMonthsOut.confidence)}</small>${threeMonthsImpact ? `<br><small class="note">+${money(threeMonthsImpact.amount, true)} por escenario «${escapeHtml(threeMonthsImpact.labels)}»</small>` : ""}`
    : `<span class="registrar-mes-empty">—</span>`;
  return `<tr>
    <td class="t">${escapeHtml(budgetRowDisplayLabel(budget.categoryId))}</td>
    <td>${weekCell}</td>
    <td>${monthCloseCell}</td>
    <td>${threeMonthsCell}</td>
  </tr>`;
}

function presupuestoMesForecastHorizonsHtml(monthKey) {
  const monthBudgets = categoryBudgetsForMonth(monthKey);
  if (!monthBudgets.length) return "";
  const rows = monthBudgets.map((budget) => presupuestoMesForecastHorizonsRowHtml(budget, monthKey)).join("");
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Forecast por categoría: 3 horizontes</h3>
        <p class="e19-subtitle">Semana: media semanal estimada a partir del forecast de este mes. Cierre de mes: la misma proyección de la tabla de arriba (gasto acumulado ÷ día transcurrido × días del mes). +3 meses: la banda de confianza (± desviación, alta/media/baja) que ya calcula el motor de forecast por categoría — hasta ahora solo se usaba para "Sugerir presupuestos", nunca se mostraba directamente. Si en el laboratorio de Escenarios (E13) hay un evento etiquetado con esta categoría y activo en ese mes, su importe se suma aquí — así ves cómo cambia tu proyección si aplicas esa decisión.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Categoría</th><th>Semana</th><th>Cierre de mes</th><th>+3 meses</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </article>`;
}

function handleSuggestBudgets() {
  if (!window.FinanceCanonicalBudgetAnalyzer?.CanonicalBudgetAnalyzer || !window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema) return;
  const monthKey = currentBudgetMonthKey();
  let created = 0;
  budgetableCategories().forEach((category) => {
    if (window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForCategoryMonth(budgets, category, monthKey)) return;
    const amountCap = suggestedAmountForCategory(category, monthKey);
    if (!amountCap) return;
    budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.upsert(budgets, {
      categoryId: category,
      monthYear: monthKey,
      amountCap,
      source: "suggested",
    });
    created += 1;
  });
  if (created) saveBudgets();
  renderPresupuestoMes();
}

// BUD-4: plantilla "repetir presupuesto del mes anterior ± X%" — evita tener que pulsar "Sugerir
// presupuestos" (que recalcula desde cero contra el histórico) cada mes cuando lo único que se
// quiere es partir de lo ya presupuestado. Reutiliza categoryBudgetsForMonth() (BUD-2, ya excluye
// los presupuestos de objetivo: repetirlos no tendría sentido, se presupuestan desde su propia fila
// mientras el objetivo siga activo) y el mismo upsert/saveBudgets que el resto de altas.
function handleRepeatPreviousMonthBudgets(button) {
  if (!window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema) return;
  const monthKey = currentBudgetMonthKey();
  const pctInput = button.closest(".cuadro-mandos-controls")?.querySelector("[data-presupuesto-mes-repeat-pct]");
  const pct = Number(pctInput?.value || 0);
  const factor = 1 + (Number.isFinite(pct) ? pct : 0) / 100;
  let created = 0;
  categoryBudgetsForMonth(previousBudgetMonthKey(monthKey)).forEach((previous) => {
    if (window.FinanceCanonicalBudgetSchema.CanonicalBudgetSchema.findForCategoryMonth(budgets, previous.categoryId, monthKey)) return;
    const amountCap = round2(previous.amountCap * factor);
    if (!(amountCap > 0)) return;
    budgets = window.FinanceCanonicalBudgetSchema.CanonicalBudgetSchema.upsert(budgets, {
      categoryId: previous.categoryId,
      monthYear: monthKey,
      amountCap,
      source: "repeated",
    });
    created += 1;
  });
  if (created) saveBudgets();
  renderPresupuestoMes();
}

// BUD-3: clave de periodo que sirve tanto para ordenar como para mostrar en la exportación,
// cualquiera que sea la cadencia — evita que el `sort`/`mes` de abajo dependan de `monthYear`, que
// es null para un presupuesto anual o trimestral.
function budgetExportPeriodKey(budget) {
  if (budget.period === "weekly") return budget.weekKey;
  if (budget.period === "annual") return budget.year;
  if (budget.period === "quarterly") return budget.quarterKey;
  return budget.monthYear;
}

// INTEG-1: todos los presupuestos guardados (todas las categorías y meses, no solo el mes abierto),
// con el gasto real y la desviación de cada uno vía budgetAlertForRow — para análisis externo (hoja
// de cálculo, script propio), no solo lo que ya se ve en la tabla del mes actual.
function budgetsExportRows() {
  return [...budgets]
    .sort((a, b) => {
      const ka = budgetExportPeriodKey(a) || "";
      const kb = budgetExportPeriodKey(b) || "";
      return ka === kb ? a.categoryId.localeCompare(b.categoryId) : ka.localeCompare(kb);
    })
    .map((budget) => {
      const periodKey = budgetExportPeriodKey(budget);
      // BUD-2: un presupuesto semanal se mide sobre su semana (weekKey), no sobre el mes al que se
      // agrupa (monthYear es solo agrupación para vistas mensuales) — de lo contrario "gastado"
      // saldría del mes completo en vez de los 7 días reales del presupuesto. BUD-3: uno anual o
      // trimestral se mide sobre su propio año/trimestre, no sobre un mes.
      const alert =
        budget.period === "weekly"
          ? budgetWeekAlertForRow(budget, budget.weekKey)
          : budget.period === "annual" || budget.period === "quarterly"
            ? budgetLongPeriodAlertForRow(budget, budget.period, periodKey)
            : budgetAlertForRow(budget, budget.monthYear);
      return {
        mes: periodKey,
        categoria: budgetRowDisplayLabel(budget.categoryId),
        presupuesto: budget.amountCap,
        gastado: alert.metrics.spent,
        desviacion_pct: alert.metrics.deviationPercent,
        estado: alert.status,
        origen: budget.source,
        moneda: budget.currency,
      };
    });
}

function downloadBudgetsCsv() {
  const rows = budgetsExportRows();
  const header = ["Mes", "Categoria", "Presupuesto", "Gastado", "Desviacion (%)", "Estado", "Origen", "Moneda"];
  const lines = rows.map((row) =>
    [row.mes, row.categoria, row.presupuesto, row.gastado, row.desviacion_pct, row.estado, row.origen, row.moneda].map(csvValue).join(";"),
  );
  const csvContent = `\uFEFF${[header.map(csvValue).join(";"), ...lines].join("\r\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "presupuestos.csv";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
  announceStatus(`Presupuestos exportados a CSV (${rows.length} fila${rows.length === 1 ? "" : "s"}).`);
}

function downloadBudgetsJson() {
  const rows = budgetsExportRows();
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "presupuestos.json";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
  announceStatus(`Presupuestos exportados a JSON (${rows.length} fila${rows.length === 1 ? "" : "s"}).`);
}

// BUD-1 (FASE 7): selector de cadencia mensual/semanal. Estado de vista pura, no persistido (igual
// que budgetSimulation más arriba) — se reinicia al recargar, mismo patrón ya usado en esta vista.
let presupuestoMesCadence = "monthly";
let presupuestoMesActiveWeekKey = null;

function currentPresupuestoMesWeekKey() {
  if (!presupuestoMesActiveWeekKey) presupuestoMesActiveWeekKey = currentBudgetWeekKey();
  return presupuestoMesActiveWeekKey;
}

function handlePresupuestoMesCadenceChange(cadence) {
  if (cadence !== "monthly" && cadence !== "weekly" && cadence !== "longperiod") return;
  presupuestoMesCadence = cadence;
  renderPresupuestoMes();
}

function shiftPresupuestoMesWeek(deltaWeeks) {
  const schema = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema;
  const range = schema?.weekRange(currentPresupuestoMesWeekKey());
  if (!range) return;
  const [y, m, d] = range.start.split("-").map(Number);
  const shifted = new Date(y, m - 1, d + deltaWeeks * 7);
  presupuestoMesActiveWeekKey = currentBudgetWeekKey(shifted);
  renderPresupuestoMes();
}

function budgetWeekLabel(weekKey) {
  const range = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.weekRange(weekKey);
  if (!range) return weekKey;
  const fmt = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}

function handleWeekBudgetAmountChange(input) {
  const category = input.dataset.presupuestoSemanaCategory;
  const weekKey = input.dataset.presupuestoSemanaWeek;
  const amount = Number(input.value);
  if (!category || !weekKey || !Number.isFinite(amount) || amount <= 0) return;
  budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.upsert(budgets, {
    categoryId: category,
    period: "weekly",
    weekKey,
    amountCap: amount,
    source: "manual",
  });
  saveBudgets();
  renderPresupuestoMes();
}

function handleRemoveWeekBudget(category, weekKey) {
  budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.delete(budgets, category, weekKey, "weekly");
  saveBudgets();
  renderPresupuestoMes();
}

function handleAddWeekBudget(button) {
  const weekKey = button.dataset.presupuestoSemanaAddWeek;
  const row = button.closest("tr");
  const category = row?.querySelector("[data-presupuesto-semana-new-category]")?.value;
  const amount = Number(row?.querySelector("[data-presupuesto-semana-new-amount]")?.value);
  if (!category || !weekKey || !Number.isFinite(amount) || amount <= 0) return;
  budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.upsert(budgets, {
    categoryId: category,
    period: "weekly",
    weekKey,
    amountCap: amount,
    source: "manual",
  });
  saveBudgets();
  renderPresupuestoMes();
}

function presupuestoMesWeekRowHtml(budget, weekKey) {
  const alert = budgetWeekAlertForRow(budget, weekKey);
  const projection = budgetWeekProjection(alert);
  const pct = budget.amountCap > 0 ? Math.min(100, Math.round((alert.metrics.spent / budget.amountCap) * 100)) : 0;
  const barClass = alert.status === "overspend" ? "is-danger" : pct >= 80 ? "is-warn" : "";
  const projectedClass = projection.diff > 0 ? "negative" : "positive";
  return `<tr class="${alert.status === "overspend" ? "is-danger" : ""}">
    <td class="t">${escapeHtml(budgetRowDisplayLabel(budget.categoryId))}</td>
    <td><input type="number" step="1" min="1" inputmode="decimal" data-presupuesto-semana-category="${escapeHtml(budget.categoryId)}" data-presupuesto-semana-week="${escapeHtml(weekKey)}" aria-label="Presupuesto semanal de ${escapeHtml(budgetRowDisplayLabel(budget.categoryId))}" value="${budget.amountCap}" /></td>
    <td>${money(alert.metrics.spent, true)}</td>
    <td>
      <span class="registrar-mes-progress ${barClass}"><span style="width:${pct}%"></span></span>
      <small>${pct}%</small>
    </td>
    <td>${presupuestoMesStatusPill(alert)}</td>
    <td class="${projectedClass}">${money(projection.projected, true)}<br><small class="note">${projection.diff > 0 ? `+${money(projection.diff, true)} sobre` : `${money(Math.abs(projection.diff), true)} margen`}</small></td>
    <td><button type="button" class="registrar-actuals-plan-link" data-presupuesto-semana-remove="${escapeHtml(budget.categoryId)}" data-presupuesto-semana-remove-week="${escapeHtml(weekKey)}">Quitar</button></td>
  </tr>`;
}

function presupuestoMesAddWeeklyRowHtml(weekKey) {
  const existing = new Set((window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForWeek(budgets, weekKey) || []).map((b) => b.categoryId));
  const available = budgetableCategories().filter((cat) => !existing.has(cat));
  if (!available.length) return "";
  const options = available.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
  return `<tr>
    <td class="t"><select data-presupuesto-semana-new-category aria-label="Categoría del nuevo presupuesto semanal">${options}</select></td>
    <td><input type="number" step="1" min="1" inputmode="decimal" data-presupuesto-semana-new-amount aria-label="Importe del nuevo presupuesto semanal" placeholder="Importe" /></td>
    <td colspan="5"><button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-semana-add data-presupuesto-semana-add-week="${escapeHtml(weekKey)}">Añadir</button></td>
  </tr>`;
}

// BUD-2 (FASE 7): fila de alta para presupuestar un objetivo (E15/P2), en la misma tabla que las
// categorías bancarias — mismo patrón que presupuestoMesAddWeeklyRowHtml, sirve tanto al mes como a
// la semana según `period`. La etiqueta de cada opción muestra la aportación mensual que ya propone
// el plan E15 (contributionPlan), como referencia, sin obligar a usarla.
function presupuestoMesGoalOptionLabel(goal, period) {
  const monthly = goalProposedMonthlyContribution(goal.id);
  if (!monthly) return goal.name;
  if (period === "weekly") return `${goal.name} (E15 sugiere ≈${round2(monthly / 4.345)} €/semana)`;
  return `${goal.name} (E15 sugiere ${money(monthly, true)}/mes)`;
}

function presupuestoMesAddGoalRowHtml(periodKey, period) {
  const schema = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema;
  const periodBudgets = period === "weekly" ? (schema?.findForWeek(budgets, periodKey) || []) : (schema?.findForMonth(budgets, periodKey) || []);
  const budgeted = new Set(
    periodBudgets.filter((b) => isGoalBudgetCategoryId(b.categoryId)).map((b) => goalIdFromBudgetCategoryId(b.categoryId)),
  );
  const available = activeGoalsForBudget().filter((goal) => !budgeted.has(goal.id));
  if (!available.length) return "";
  const options = available
    .map((goal) => `<option value="${escapeHtml(goal.id)}">${escapeHtml(presupuestoMesGoalOptionLabel(goal, period))}</option>`)
    .join("");
  return `<tr>
    <td class="t" data-label="Objetivo">🎯 <select data-presupuesto-mes-goal-new-id aria-label="Objetivo a presupuestar">${options}</select></td>
    <td data-label="Importe"><input type="number" step="1" min="1" inputmode="decimal" data-presupuesto-mes-goal-new-amount aria-label="Aportación a presupuestar" placeholder="Importe" /></td>
    <td colspan="5"><button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-mes-goal-add data-presupuesto-mes-goal-add-period="${period}" data-presupuesto-mes-goal-add-key="${escapeHtml(periodKey)}">Presupuestar objetivo</button></td>
  </tr>`;
}

function handleAddGoalBudget(button) {
  const period = button.dataset.presupuestoMesGoalAddPeriod;
  const periodKey = button.dataset.presupuestoMesGoalAddKey;
  const row = button.closest("tr");
  const goalId = row?.querySelector("[data-presupuesto-mes-goal-new-id]")?.value;
  const amount = Number(row?.querySelector("[data-presupuesto-mes-goal-new-amount]")?.value);
  if (!goalId || !periodKey || !Number.isFinite(amount) || amount <= 0) return;
  const payload = { categoryId: goalBudgetCategoryId(goalId), amountCap: amount, source: "goal" };
  if (period === "weekly") {
    payload.period = "weekly";
    payload.weekKey = periodKey;
  } else {
    payload.monthYear = periodKey;
  }
  budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.upsert(budgets, payload);
  saveBudgets();
  renderPresupuestoMes();
}

function presupuestoMesWeeklyHtml() {
  const weekKey = currentPresupuestoMesWeekKey();
  const weekBudgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForWeek(budgets, weekKey) || [];
  const label = budgetWeekLabel(weekKey);
  const rows = weekBudgets.length
    ? weekBudgets.map((budget) => presupuestoMesWeekRowHtml(budget, weekKey)).join("")
    : `<tr><td colspan="6" class="registrar-mes-empty">Todavía no hay presupuestos semanales para ${escapeHtml(label)}.</td></tr>`;
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Presupuesto semanal · ${escapeHtml(label)}</h3>
        <p class="e19-subtitle">Ritmo diario = presupuesto ÷ 7. Solo cuenta el gasto bancario clasificado de esta categoría en la semana; las partidas registradas a mano (sin fecha diaria) siguen sumándose solo al presupuesto mensual.</p>
      </div>
      <div class="cuadro-mandos-controls">
        <button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-semana-prev>← Semana anterior</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-semana-next>Semana siguiente →</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Categoría</th><th>Presupuesto</th><th>Gastado</th><th>Ritmo</th><th>Estado</th><th>Proyección fin de semana</th><th></th></tr></thead>
        <tbody>${rows}${presupuestoMesAddWeeklyRowHtml(weekKey)}${presupuestoMesAddGoalRowHtml(weekKey, "weekly")}</tbody>
      </table>
    </div>
  </article>`;
}

// BUD-3 (FASE 7): tercera cadencia — anual/trimestral. Mismo patrón de estado de vista pura que la
// semanal (no persistido); `presupuestoMesLongPeriodType` decide si la clave activa es un año o un
// trimestre natural.
let presupuestoMesLongPeriodType = "annual"; // "annual" | "quarterly"
let presupuestoMesActiveLongPeriodKey = null;

function currentPresupuestoMesLongPeriodKey() {
  if (!presupuestoMesActiveLongPeriodKey) presupuestoMesActiveLongPeriodKey = currentBudgetLongPeriodKey(presupuestoMesLongPeriodType);
  return presupuestoMesActiveLongPeriodKey;
}

function handlePresupuestoMesLongPeriodTypeChange(periodType) {
  if (periodType !== "annual" && periodType !== "quarterly") return;
  presupuestoMesLongPeriodType = periodType;
  presupuestoMesActiveLongPeriodKey = currentBudgetLongPeriodKey(periodType);
  renderPresupuestoMes();
}

function shiftPresupuestoMesLongPeriod(delta) {
  const key = currentPresupuestoMesLongPeriodKey();
  if (presupuestoMesLongPeriodType === "annual") {
    presupuestoMesActiveLongPeriodKey = `${Number(key) + delta}`;
  } else {
    const match = /^(\d{4})-Q([1-4])$/.exec(key);
    if (!match) return;
    let year = Number(match[1]);
    let quarter = Number(match[2]) + delta;
    while (quarter < 1) {
      quarter += 4;
      year -= 1;
    }
    while (quarter > 4) {
      quarter -= 4;
      year += 1;
    }
    presupuestoMesActiveLongPeriodKey = `${year}-Q${quarter}`;
  }
  renderPresupuestoMes();
}

function budgetLongPeriodLabel(periodType, periodKey) {
  if (periodType === "annual") return `Año ${periodKey}`;
  const range = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.quarterRange(periodKey);
  if (!range) return periodKey;
  const fmt = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };
  return `${periodKey} (${fmt(range.start)} – ${fmt(range.end)})`;
}

function handleLongPeriodBudgetAmountChange(input) {
  const category = input.dataset.presupuestoLargoCategory;
  const periodType = input.dataset.presupuestoLargoType;
  const periodKey = input.dataset.presupuestoLargoKey;
  const amount = Number(input.value);
  if (!category || !periodKey || !Number.isFinite(amount) || amount <= 0) return;
  const payload = { categoryId: category, period: periodType, amountCap: amount, source: "manual" };
  if (periodType === "annual") payload.year = periodKey;
  else payload.quarterKey = periodKey;
  budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.upsert(budgets, payload);
  saveBudgets();
  renderPresupuestoMes();
}

function handleRemoveLongPeriodBudget(category, periodType, periodKey) {
  budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.delete(budgets, category, periodKey, periodType);
  saveBudgets();
  renderPresupuestoMes();
}

function handleAddLongPeriodBudget(button) {
  const periodType = button.dataset.presupuestoLargoAddType;
  const periodKey = button.dataset.presupuestoLargoAddKey;
  const row = button.closest("tr");
  const category = row?.querySelector("[data-presupuesto-largo-new-category]")?.value;
  const amount = Number(row?.querySelector("[data-presupuesto-largo-new-amount]")?.value);
  if (!category || !periodKey || !Number.isFinite(amount) || amount <= 0) return;
  const payload = { categoryId: category, period: periodType, amountCap: amount, source: "manual" };
  if (periodType === "annual") payload.year = periodKey;
  else payload.quarterKey = periodKey;
  budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.upsert(budgets, payload);
  saveBudgets();
  renderPresupuestoMes();
}

function presupuestoLargoRowHtml(budget, periodType, periodKey) {
  const alert = budgetLongPeriodAlertForRow(budget, periodType, periodKey);
  // budgetWeekProjection() es genérica pese a su nombre: la misma fórmula lineal (gastado / unidad
  // transcurrida × unidades totales) vale para cualquier periodo explícito, no solo una semana —
  // calculateAlert ya devuelve dayOfMonth/daysInMonth equivalentes para el año/trimestre.
  const projection = budgetWeekProjection(alert);
  const pct = budget.amountCap > 0 ? Math.min(100, Math.round((alert.metrics.spent / budget.amountCap) * 100)) : 0;
  const barClass = alert.status === "overspend" ? "is-danger" : pct >= 80 ? "is-warn" : "";
  const projectedClass = projection.diff > 0 ? "negative" : "positive";
  const monthlyShare = budgetLongPeriodMonthlyShare(budget.amountCap, periodType);
  const periodLabel = periodType === "annual" ? "anual" : "trimestral";
  return `<tr class="${alert.status === "overspend" ? "is-danger" : ""}">
    <td class="t">${escapeHtml(budgetRowDisplayLabel(budget.categoryId))}</td>
    <td><input type="number" step="1" min="1" inputmode="decimal" data-presupuesto-largo-category="${escapeHtml(budget.categoryId)}" data-presupuesto-largo-type="${periodType}" data-presupuesto-largo-key="${escapeHtml(periodKey)}" aria-label="Presupuesto ${periodLabel} de ${escapeHtml(budgetRowDisplayLabel(budget.categoryId))}" value="${budget.amountCap}" /></td>
    <td>${money(alert.metrics.spent, true)}</td>
    <td>
      <span class="registrar-mes-progress ${barClass}"><span style="width:${pct}%"></span></span>
      <small>${pct}%</small>
    </td>
    <td>${presupuestoMesStatusPill(alert)}</td>
    <td class="${projectedClass}">${money(projection.projected, true)}<br><small class="note">${projection.diff > 0 ? `+${money(projection.diff, true)} sobre` : `${money(Math.abs(projection.diff), true)} margen`}</small></td>
    <td><small class="note">≈${money(monthlyShare, true)}/mes</small></td>
    <td><button type="button" class="registrar-actuals-plan-link" data-presupuesto-largo-remove="${escapeHtml(budget.categoryId)}" data-presupuesto-largo-remove-type="${periodType}" data-presupuesto-largo-remove-key="${escapeHtml(periodKey)}">Quitar</button></td>
  </tr>`;
}

function presupuestoLargoAddRowHtml(periodType, periodKey) {
  const schema = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema;
  const periodBudgets =
    periodType === "annual" ? schema?.findForYear(budgets, periodKey) || [] : schema?.findForQuarter(budgets, periodKey) || [];
  const existing = new Set(periodBudgets.map((b) => b.categoryId));
  const available = budgetableCategories().filter((cat) => !existing.has(cat));
  if (!available.length) return "";
  const options = available.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
  const periodLabel = periodType === "annual" ? "anual" : "trimestral";
  return `<tr>
    <td class="t"><select data-presupuesto-largo-new-category aria-label="Categoría del nuevo presupuesto ${periodLabel}">${options}</select></td>
    <td><input type="number" step="1" min="1" inputmode="decimal" data-presupuesto-largo-new-amount aria-label="Importe del nuevo presupuesto ${periodLabel}" placeholder="Importe" /></td>
    <td colspan="6"><button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-largo-add data-presupuesto-largo-add-type="${periodType}" data-presupuesto-largo-add-key="${escapeHtml(periodKey)}">Añadir</button></td>
  </tr>`;
}

function presupuestoLargoHtml() {
  const periodType = presupuestoMesLongPeriodType;
  const periodKey = currentPresupuestoMesLongPeriodKey();
  const schema = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema;
  const periodBudgets =
    periodType === "annual" ? schema?.findForYear(budgets, periodKey) || [] : schema?.findForQuarter(budgets, periodKey) || [];
  const label = budgetLongPeriodLabel(periodType, periodKey);
  const periodLabel = periodType === "annual" ? "anuales" : "trimestrales";
  const rows = periodBudgets.length
    ? periodBudgets.map((budget) => presupuestoLargoRowHtml(budget, periodType, periodKey)).join("")
    : `<tr><td colspan="8" class="registrar-mes-empty">Todavía no hay presupuestos ${periodLabel} para ${escapeHtml(label)}.</td></tr>`;
  const typeToggleHtml = `<div class="cuadro-mandos-controls" role="group" aria-label="Tipo de periodo largo">
    <button type="button" class="e19-btn ${periodType === "annual" ? "e19-btn-primary" : "e19-btn-secondary"}" data-presupuesto-largo-type-toggle="annual" aria-pressed="${periodType === "annual"}">Año completo</button>
    <button type="button" class="e19-btn ${periodType === "quarterly" ? "e19-btn-primary" : "e19-btn-secondary"}" data-presupuesto-largo-type-toggle="quarterly" aria-pressed="${periodType === "quarterly"}">Trimestre</button>
  </div>`;
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Presupuesto ${periodType === "annual" ? "anual" : "trimestral"} · ${escapeHtml(label)}</h3>
        <p class="e19-subtitle">Para gastos estacionales (seguros, impuestos) que de otro modo aparecen como "sobregasto" puntual en un mes concreto: el ritmo se mide sobre todo el año/trimestre, sumando el gasto bancario y las partidas registradas a mano de cada mes del periodo. La columna "Reparto mensual" es solo informativa — el importe medio por mes si se repartiera a partes iguales — y no crea presupuestos mensuales nuevos.</p>
      </div>
      <div class="cuadro-mandos-controls">
        ${typeToggleHtml}
        <button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-largo-prev>← Anterior</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-largo-next>Siguiente →</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Categoría</th><th>Presupuesto</th><th>Gastado</th><th>Ritmo</th><th>Estado</th><th>Proyección fin de periodo</th><th>Reparto mensual</th><th></th></tr></thead>
        <tbody>${rows}${presupuestoLargoAddRowHtml(periodType, periodKey)}</tbody>
      </table>
    </div>
  </article>`;
}

function handleBudgetAmountChange(input) {
  const category = input.dataset.presupuestoMesCategory;
  const monthKey = input.dataset.presupuestoMesMonth;
  const amount = Number(input.value);
  if (!category || !monthKey || !Number.isFinite(amount) || amount <= 0) return;
  budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.upsert(budgets, {
    categoryId: category,
    monthYear: monthKey,
    amountCap: amount,
    source: "manual",
  });
  saveBudgets();
  renderPresupuestoMes();
}

function handleRemoveBudget(category, monthKey) {
  budgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.delete(budgets, category, monthKey);
  saveBudgets();
  renderPresupuestoMes();
}

function presupuestoMesStatusPill(alert) {
  if (alert.status === "overspend") {
    return `<span class="e19-pill e19-pill-warn">Por encima del ritmo</span>`;
  }
  if (alert.status === "underspend") {
    return `<span class="e19-pill e19-pill-safe">Por debajo del ritmo</span>`;
  }
  return `<span class="e19-pill e19-pill-safe">En ritmo</span>`;
}

function presupuestoMesRowHtml(budget, monthKey) {
  const alert = budgetAlertForRow(budget, monthKey);
  const projection = budgetProjection(alert, monthKey);
  const pct = budget.amountCap > 0 ? Math.min(100, Math.round((alert.metrics.spent / budget.amountCap) * 100)) : 0;
  const barClass = alert.status === "overspend" ? "is-danger" : pct >= 80 ? "is-warn" : "";
  const projectedClass = projection.diff > 0 ? "negative" : "positive";
  const sourceNote =
    budget.source === "suggested" ? ` <small class="note">sugerido</small>` : budget.source === "repeated" ? ` <small class="note">repetido</small>` : "";
  return `<tr class="${alert.status === "overspend" ? "is-danger" : ""}">
    <td class="t" data-label="Categoría">${escapeHtml(budgetRowDisplayLabel(budget.categoryId))}${sourceNote}</td>
    <td data-label="Presupuesto"><input type="number" step="1" min="1" inputmode="decimal" data-presupuesto-mes-category="${escapeHtml(budget.categoryId)}" data-presupuesto-mes-month="${escapeHtml(monthKey)}" aria-label="Presupuesto de ${escapeHtml(budgetRowDisplayLabel(budget.categoryId))}" value="${budget.amountCap}" /></td>
    <td data-label="Gastado">${money(alert.metrics.spent, true)}</td>
    <td data-label="Ritmo">
      <span class="registrar-mes-progress ${barClass}"><span style="width:${pct}%"></span></span>
      <small>${pct}%</small>
    </td>
    <td data-label="Estado">${presupuestoMesStatusPill(alert)}</td>
    <td class="${projectedClass}" data-label="Proyección fin de mes">${money(projection.projected, true)}<br><small class="note">${projection.diff > 0 ? `+${money(projection.diff, true)} sobre` : `${money(Math.abs(projection.diff), true)} margen`}</small></td>
    <td><button type="button" class="registrar-actuals-plan-link" data-presupuesto-mes-remove="${escapeHtml(budget.categoryId)}" data-presupuesto-mes-remove-month="${escapeHtml(monthKey)}">Quitar</button></td>
  </tr>`;
}

function presupuestoMesManualPartidaRowHtml(entry, monthKey) {
  const rowKey = seriesKeyForRow(entry.row);
  const current = categoryForPartidaEntry(entry);
  const options = BUDGET_EXPENSE_CATEGORIES.map(
    (cat) => `<option value="${escapeHtml(cat)}"${cat === current ? " selected" : ""}>${escapeHtml(cat)}</option>`,
  ).join("");
  return `<tr>
    <td class="t">${escapeHtml(entry.label)}</td>
    <td>${escapeHtml(entry.sectionName)}</td>
    <td>${money(entry.usado, true)}</td>
    <td><select data-presupuesto-mes-partida-category="${escapeHtml(rowKey)}" aria-label="Categoría de ${escapeHtml(entry.label)}">${options}</select></td>
  </tr>`;
}

function presupuestoMesManualPartidasHtml(monthKey) {
  const entries = manualPartidaEntriesForMonth(monthKey);
  if (!entries.length) return "";
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Partidas registradas a mano este mes</h3>
        <p class="e19-subtitle">Se suman al «Gastado» de su categoría (sin duplicar movimientos ya importados del banco). Si la categoría asignada no es la correcta, cámbiala aquí.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Partida</th><th>Sección</th><th>Importe</th><th>Categoría</th></tr></thead>
        <tbody>${entries.map((entry) => presupuestoMesManualPartidaRowHtml(entry, monthKey)).join("")}</tbody>
      </table>
    </div>
  </article>`;
}

function presupuestoMesSurplusRowHtml({ budget, surplus }, monthKey) {
  const current = budgetSurplusChoices[monthKey]?.[budget.categoryId]?.choice || "";
  const options = [["", "Sin decidir"], ...Object.entries(BUDGET_SURPLUS_CHOICES)]
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
  return `<tr>
    <td class="t">${escapeHtml(budget.categoryId)}</td>
    <td>${money(surplus, true)}</td>
    <td>
      <select data-presupuesto-mes-surplus="${escapeHtml(budget.categoryId)}" data-presupuesto-mes-surplus-month="${escapeHtml(monthKey)}" data-presupuesto-mes-surplus-amount="${surplus}" aria-label="Qué hacer con lo no gastado de ${escapeHtml(budget.categoryId)}">${options}</select>
    </td>
  </tr>`;
}

function presupuestoMesSurplusHtml(monthKey) {
  const entries = budgetSurplusEntries(monthKey);
  if (!entries.length) return "";
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Hucha: lo no gastado este mes</h3>
        <p class="e19-subtitle">"Llevar al mes siguiente" se suma automáticamente al presupuesto sugerido de esa categoría. "Guardar como ahorro" y "gasto flexible" quedan registrados; moverlos de cuenta es manual por ahora.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Categoría</th><th>No gastado</th><th>Decisión</th></tr></thead>
        <tbody>${entries.map((entry) => presupuestoMesSurplusRowHtml(entry, monthKey)).join("")}</tbody>
      </table>
    </div>
  </article>`;
}

function handleBudgetPartidaCategoryChange(select) {
  const rowKey = select.dataset.presupuestoMesPartidaCategory;
  const category = select.value;
  if (!rowKey || !BUDGET_EXPENSE_CATEGORIES.includes(category)) return;
  budgetPartidaOverrides = { ...budgetPartidaOverrides, [rowKey]: category };
  saveBudgetPartidaOverrides();
  renderPresupuestoMes();
}

function renderPresupuestoMes() {
  const root = qs("presupuestoMesRoot");
  if (!root) return;
  if (!window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema || !window.FinanceCanonicalBudgetAlerts?.CanonicalBudgetAlerts || !window.FinanceCanonicalBudgetAnalyzer?.CanonicalBudgetAnalyzer) {
    root.innerHTML = `<p class="e19-subtitle">Los motores de presupuesto no están disponibles.</p>`;
    return;
  }
  const monthKey = currentBudgetMonthKey();
  const monthLabel = ledgerMonthLabel ? ledgerMonthLabel(monthKey) : monthKey;

  // BUD-1 (FASE 7): selector de cadencia. Siempre visible, encima de todo lo demás.
  const cadenceToggleHtml = `<div class="cuadro-mandos-controls" role="group" aria-label="Cadencia del presupuesto">
    <button type="button" class="e19-btn ${presupuestoMesCadence === "monthly" ? "e19-btn-primary" : "e19-btn-secondary"}" data-presupuesto-mes-cadence="monthly" aria-pressed="${presupuestoMesCadence === "monthly"}">Mensual</button>
    <button type="button" class="e19-btn ${presupuestoMesCadence === "weekly" ? "e19-btn-primary" : "e19-btn-secondary"}" data-presupuesto-mes-cadence="weekly" aria-pressed="${presupuestoMesCadence === "weekly"}">Semanal</button>
    <button type="button" class="e19-btn ${presupuestoMesCadence === "longperiod" ? "e19-btn-primary" : "e19-btn-secondary"}" data-presupuesto-mes-cadence="longperiod" aria-pressed="${presupuestoMesCadence === "longperiod"}">Anual/Trim.</button>
  </div>`;

  if (presupuestoMesCadence === "weekly") {
    root.innerHTML = `${cadenceToggleHtml}${presupuestoMesWeeklyHtml()}`;
    return;
  }

  // BUD-3 (FASE 7): tercera cadencia — anual/trimestral, para gastos estacionales.
  if (presupuestoMesCadence === "longperiod") {
    root.innerHTML = `${cadenceToggleHtml}${presupuestoLargoHtml()}`;
    return;
  }

  const monthBudgets = window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema.findForMonth(budgets, monthKey);
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const summary = homeBudgetSummary();
  const summaryHtml = summary
    ? `<div class="registrar-mes-card-foot"><p class="e19-kpi-note">Total presupuestado ${money(summary.totalBudgeted, true)} · gastado ${money(summary.totalSpent, true)} · día ${today.getDate()}/${daysInMonth} del mes (${Math.round((today.getDate() / daysInMonth) * 100)}%).</p></div>`
    : "";

  const rows = monthBudgets.length
    ? monthBudgets.map((budget) => presupuestoMesRowHtml(budget, monthKey)).join("")
    : `<tr><td colspan="7" class="registrar-mes-empty">Todavía no hay presupuestos para ${escapeHtml(monthLabel)}. Pulsa «Sugerir presupuestos» para generarlos a partir de los últimos 6 meses, o «Repetir mes anterior» para partir de lo ya presupuestado.</td></tr>`;

  root.innerHTML = `${cadenceToggleHtml}
  <article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Presupuesto de ${escapeHtml(monthLabel)}</h3>
        <p class="e19-subtitle">Ritmo diario = presupuesto ÷ días del mes. Editable por categoría; la sugerencia usa los últimos 6 meses de gasto real, o «Repetir mes anterior» copia lo ya presupuestado con el ajuste ± % indicado.</p>
      </div>
      <div class="cuadro-mandos-controls">
        <button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-mes-suggest>Sugerir presupuestos</button>
        <input type="number" step="1" value="0" size="3" data-presupuesto-mes-repeat-pct aria-label="Ajuste porcentual al repetir el presupuesto del mes anterior" />
        <button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-mes-repeat>Repetir mes anterior ± %</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-mes-export-csv>Exportar CSV</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-mes-export-json>Exportar JSON</button>
      </div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table presupuesto-mes-primary-table">
        <thead><tr><th>Categoría</th><th>Presupuesto</th><th>Gastado</th><th>Ritmo</th><th>Estado</th><th>Proyección fin de mes</th><th></th></tr></thead>
        <tbody>${rows}${presupuestoMesAddGoalRowHtml(monthKey, "monthly")}</tbody>
      </table>
    </div>
    ${summaryHtml}
  </article>
  ${presupuestoMesManualPartidasHtml(monthKey)}
  ${presupuestoMesSurplusHtml(monthKey)}
  ${presupuestoMesDebtLinkHtml(monthKey)}
  ${presupuestoMesHistoryHtml(monthKey)}
  ${presupuestoMesSimulatorHtml(monthKey)}
  ${presupuestoMesSimulationImpactHtml(monthKey)}
  ${presupuestoMesComparatorHtml(monthKey)}
  ${presupuestoMesSimulationDebtLinkHtml(monthKey)}
  ${presupuestoMesNotificationsHtml(monthKey)}
  ${presupuestoMesGoalsHtml(monthKey)}
  ${presupuestoMesBadgesHtml(monthKey)}
  ${presupuestoMesChallengeHtml(monthKey)}
  ${presupuestoMesSeasonalHtml(monthKey)}
  ${presupuestoMesForecastHorizonsHtml(monthKey)}`;
}
