// WP-44 (CAR-02 + CAR-05 + CAR-06, docs/WP44_DISENO.md): la tarjeta «Calma, cobertura y exposición» de Inversión › Cartera. El cálculo vive en canonical-calm-coverage.js (puro); aquí se
// leen las cifras que ya existen (serie de valoraciones y posiciones, política firmada, previsión, activos con alquiler, saldos de las cuentas) y se guardan en `calm-coverage-inputs`
// (en la copia) la tasa de retirada y los titulares de cada cuenta. NO recomienda vender ni comprar (A11-4): enseña la cifra y lo que dice la política. Tampoco va a Hoy (congelado hasta H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, storageSet, storageKey, queueRemoteSave, announceStatus, estadoHtml, isoLocalDate,
// parseAmount, iv1PositionsList, loadPortfolioValuations, politicaLoad, assetsList, accountBalancesFromState, canonicalScenarioResults…). Sin llamadas al DOM ni escuchas al cargarse:
// views/inversion.js llama a `renderCalmaCobertura` al pintar Inversión › Cartera, que engancha las escuchas la primera vez.

const CALMA_STORE = "calm-coverage-inputs"; // en la copia (BACKUP_LOCAL_STORES)
const CALMA_ACCOUNTS = [{ id: "caixa", entity: "CaixaBank" }, { id: "mediolanum", entity: "Banca Mediolanum" }];

function calmaEngine() {
  return globalThis.FinanceCanonicalCalmCoverage;
}

function calmaLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(CALMA_STORE), "{}")) || {}; } catch { saved = {}; }
  const num = (value) => (value === "" || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value));
  const holders = saved.holders && typeof saved.holders === "object" ? saved.holders : {};
  return { withdrawalRatePct: num(saved.withdrawalRatePct), holders: Object.fromEntries(CALMA_ACCOUNTS.map((account) => [account.id, num(holders[account.id])])) };
}

function calmaSave(inputs) {
  storageSet(storageKey(CALMA_STORE), JSON.stringify(inputs));
  queueRemoteSave();
}

function calmaEuros(value) {
  return money(value, true);
}

function calmaPct(value) {
  return `${String(value).replace(".", ",")} %`;
}

function calmaDate(iso) {
  return String(iso || "").split("-").reverse().map(Number).join("/");
}

function calmaGuard(fn, fallback = null) {
  try { const value = fn(); return value === undefined ? fallback : value; } catch { return fallback; }
}

// Aportación mensual de referencia: la cantidad fija de la política FIRMADA; si no, la media de las aportaciones registradas en los últimos 6 meses (nada si no hay ninguna).
function calmaMonthlyContribution(positions, today) {
  const policyEngine = globalThis.FinanceCanonicalInvestmentPolicy;
  const policy = calmaGuard(() => politicaLoad());
  if (policy && policyEngine && policyEngine.signatureState(policy) === "signed" && policy.contribution.mode === "fixed" && policy.contribution.monthly > 0) {
    return { monthly: policy.contribution.monthly, source: "la política firmada" };
  }
  const since = new Date(`${today}T00:00:00Z`);
  since.setUTCMonth(since.getUTCMonth() - 6);
  const from = since.toISOString().slice(0, 10);
  const total = positions.reduce((sum, position) => sum + (position.contributions || []).filter((item) => item.date > from && item.date <= today).reduce((inner, item) => inner + Number(item.amount || 0), 0), 0);
  return total > 0 ? { monthly: Math.round((total / 6) * 100) / 100, source: "la media de lo aportado en los últimos 6 meses" } : { monthly: null, source: "" };
}

function calmaDrawdownHtml(engine, positions, normalized, today) {
  const store = loadPortfolioValuations();
  const series = engine.portfolioSeries({ valuations: store.valuations, positions });
  const policyEngine = globalThis.FinanceCanonicalInvestmentPolicy;
  const policy = calmaGuard(() => politicaLoad());
  const signed = Boolean(policy && policyEngine && policyEngine.signatureState(policy) === "signed");
  const contribution = calmaMonthlyContribution(positions, today);
  const result = engine.calmDrawdown({
    series, positions, today, monthlyContribution: contribution.monthly, levels: engine.DEFAULT_LEVELS,
    contributed: normalized.summary.totalCost, value: normalized.summary.totalValue,
  });
  if (result.status === "not-enough") {
    const missing = result.neverValued.length ? ` Faltan por valorar: ${result.neverValued.map((name) => escapeHtml(name)).join(", ")}.` : "";
    return estadoHtml({
      kind: "vacio", titulo: "Todavía no hay serie para medir una caída",
      texto: `Hacen falta ${result.need} valoraciones de toda la cartera y llevas ${result.have}.${missing} Cada valoración nueva (Actualizar valoración, arriba) acerca el día en que esto se pueda leer.`,
    });
  }
  const fall = result.drawdownAmount < 0
    ? `<p class="cal-cifra"><strong>Desde el máximo (${calmaDate(result.peakDate)}) el mercado ha restado ${calmaEuros(Math.abs(result.drawdownAmount))} (${calmaPct(Math.abs(result.drawdownPct))})</strong>, sin contar lo que habéis aportado o vendido.</p>`
    : `<p class="cal-cifra"><strong>La cartera está en su máximo</strong> (medido en mercado, sin contar aportaciones ni ventas).</p>`;
  const months = result.monthsOfContribution === null
    ? (result.drawdownAmount < 0 ? `<p class="e19-kpi-note">No puedo decir a cuántos meses de aportación equivale: no hay una aportación mensual (ni en una política firmada ni en las aportaciones registradas).</p>` : "")
    : `<p>Equivale a <strong>${String(result.monthsOfContribution).replace(".", ",")} meses de aportación</strong> (${calmaEuros(result.monthlyContribution)} al mes, según ${escapeHtml(contribution.source)}).</p>`;
  const stale = result.stale ? `<p class="cal-aviso" role="note"><strong>La última valoración es del ${calmaDate(result.lastDate)} (hace ${result.ageDays} días).</strong> Si el mercado se ha movido desde entonces, esta cifra no es la de hoy.</p>` : "";
  let policyLine;
  if (!signed) policyLine = `<p class="e19-kpi-note">No hay una política de inversión firmada: miro los niveles de ${engine.DEFAULT_LEVELS.join(" % y ")} % por defecto. Acordarla en frío está en Inversión › Rebalanceo.</p>`;
  else {
    const actions = policyEngine.DRAWDOWN_ACTIONS;
    const at = result.level >= 2 ? `at${engine.DEFAULT_LEVELS[1]}` : result.level === 1 ? `at${engine.DEFAULT_LEVELS[0]}` : "";
    policyLine = at
      ? `<p class="cal-aviso" role="note"><strong>Habéis superado el nivel del ${engine.DEFAULT_LEVELS[result.level - 1]} %. Lo que acordasteis en la política:</strong> ${escapeHtml(actions[policy.drawdown[at]] || "")}.</p>`
      : `<p class="e19-kpi-note">Por debajo del primer nivel de vuestra política (${engine.DEFAULT_LEVELS[0]} %).</p>`;
  }
  if (!signed && result.level >= 1) policyLine += `<p class="cal-aviso" role="note"><strong>La caída pasa del ${engine.DEFAULT_LEVELS[result.level - 1]} %.</strong> Antes de tocar nada, hablarlo las dos personas.</p>`;
  const paid = result.contributed !== null && result.value !== null
    ? `<p>Habéis aportado <strong>${calmaEuros(result.contributed)}</strong> y hoy vale <strong>${calmaEuros(result.value)}</strong> (${result.value - result.contributed >= 0 ? "+" : "−"}${calmaEuros(Math.abs(result.value - result.contributed))}).</p>`
    : "";
  return `${fall}${months}${stale}${policyLine}${paid}<p class="e19-kpi-note">Con ${result.valuationCount} valoraciones, entre el ${calmaDate(result.firstDate)} y el ${calmaDate(result.lastDate)}. No incluyo cuánto tardaron en recuperarse caídas parecidas: no tengo una fuente histórica verificada y no voy a inventarla.</p>`;
}

function calmaCoverageHtml(engine, normalized, inputs) {
  const expenses = (canonicalScenarioResults?.base?.forecast?.series || []).slice(0, 12).map((row) => Number(row.totals?.outflowsBeforeSaving)).filter(Number.isFinite);
  const monthlyExpense = expenses.length ? expenses.reduce((sum, value) => sum + value, 0) / expenses.length : null;
  const rent = (assetsList() || []).reduce((sum, asset) => sum + (Number(asset.monthlyRentIncome) > 0 ? Number(asset.monthlyRentIncome) : 0), 0);
  const liquid = normalized.positions.filter((position) => engine.LIQUID_TYPES.includes(position.type)).reduce((sum, position) => sum + position.currentValue, 0);
  const result = engine.coverage({ monthlyExpense, rentNetMonthly: rent > 0 ? rent : null, withdrawalRatePct: inputs.withdrawalRatePct, liquidPortfolioValue: liquid });
  if (result.status === "no-expense") return `<p class="e19-kpi-note">${escapeHtml(result.reason)}</p>`;
  const parts = result.parts.map((part) => `<li>${escapeHtml(part.label)}${part.ratePct ? ` (${calmaPct(part.ratePct)} de ${calmaEuros(liquid)})` : ""}: <strong>${calmaEuros(part.annual)}</strong> al año</li>`).join("");
  const missing = result.missing.length ? `<p class="e19-kpi-note"><strong>No suma:</strong> ${result.missing.map((line) => escapeHtml(line)).join("; ")}.</p>` : "";
  const headline = result.status === "ok"
    ? `<p class="cal-cifra"><strong>Vuestros activos pagan ya el ${calmaPct(result.coveragePct)} de vuestros gastos</strong> (${calmaEuros(result.annualIncome)} de ${calmaEuros(result.annualExpense)} al año).</p>`
    : `<p class="cal-cifra"><strong>Todavía no puedo calcular qué parte del gasto pagan los activos.</strong></p>`;
  const next = result.status === "ok" && result.nextMilestone
    ? `<p class="e19-kpi-note">Para el ${result.nextMilestone} % faltan ${calmaEuros(result.neededForNext)} al año de renta. El gasto medio sale de los próximos 12 meses de la previsión, con las cuotas de deuda que aún quedan: cuando terminen, el porcentaje sube sin que los activos hagan nada.</p>`
    : result.status === "ok" ? `<p class="e19-kpi-note">Está cubierto el 100 % del gasto medio de la previsión.</p>` : "";
  return `${headline}${parts ? `<ul class="cal-lista">${parts}</ul>` : ""}${missing}${next}<p class="e19-kpi-note">La cartera líquida son fondos, acciones y ETF (sin plan de pensiones, cripto ni «otro»). Los dividendos no se suman aparte: ya van dentro de una tasa de retirada sostenible.</p>`;
}

function calmaDepositsHtml(engine, inputs) {
  const balances = calmaGuard(() => accountBalancesFromState());
  const accounts = CALMA_ACCOUNTS.map((account) => ({ ...account, balance: balances && balances[account.id] !== undefined && balances[account.id] !== null ? Number(balances[account.id]) : null, holders: inputs.holders[account.id] }));
  const result = engine.depositExposure({ accounts });
  if (!result.rows.length) return `<p class="e19-kpi-note">No hay saldos de cuentas con los que calcular.</p>`;
  const line = (row) => {
    const verdict = row.status === "within"
      ? (row.balance <= result.limit ? "por debajo del límite individual" : `dentro de lo cubierto para ${row.holders} titulares`)
      : row.status === "over" ? `<strong>${calmaEuros(row.overBy)} por encima de lo cubierto</strong>` : "<strong>por encima del límite individual: no sé cuántos titulares tiene</strong>";
    return `<li>${escapeHtml(row.entity)}: <strong>${calmaEuros(row.balance)}</strong> en cuentas, ${verdict}.</li>`;
  };
  const notices = [
    result.anyOver ? `<p class="cal-aviso" role="note"><strong>Hay una entidad con más depósitos de los que cubre la garantía.</strong> Es una cifra para hablarla, no una orden de mover dinero.</p>` : "",
    result.anyUnknown ? `<p class="cal-aviso" role="note">Indica abajo cuántos titulares tiene cada cuenta que supera ${calmaEuros(result.limit)}: sin eso no puedo decir si está cubierta.</p>` : "",
  ].join("");
  return `<ul class="cal-lista">${result.rows.map(line).join("")}</ul>${notices}<p class="e19-kpi-note">Límite de ${calmaEuros(result.limit)} por titular y entidad (Fondo de Garantía de Depósitos; <strong>verifica el vigente</strong>). Solo miro las cuentas: los fondos son patrimonio separado de la gestora y los seguros de ahorro tienen otro régimen, y no se calculan aquí porque las posiciones no guardan en qué entidad están.</p>`;
}

function renderCalmaCobertura(engine) {
  const box = qs("calmaCuerpo");
  if (!box || !engine) return;
  attachCalma(document); // idempotente: un envío temprano no puede perderse
  try {
    const inputs = calmaLoad();
    const set = (id, value) => { const field = qs(id); if (field && document.activeElement !== field) field.value = value === null || value === undefined ? "" : String(value); };
    set("calmaTasa", inputs.withdrawalRatePct);
    CALMA_ACCOUNTS.forEach((account) => set(`calmaTitulares-${account.id}`, inputs.holders[account.id]));
    const today = isoLocalDate(new Date());
    const positions = iv1PositionsList();
    const normalized = globalThis.FinanceCanonicalPortfolio.normalizePositions(positions);
    const sections = {
      calmaCaida: calmaDrawdownHtml(engine, normalized.positions, normalized, today),
      calmaCobertura: calmaCoverageHtml(engine, normalized, inputs),
      calmaDepositos: calmaDepositsHtml(engine, inputs),
    };
    Object.entries(sections).forEach(([id, html]) => {
      const target = qs(id);
      if (target && target.__calmaHtml !== html) { target.innerHTML = html; target.__calmaHtml = html; }
    });
  } catch {
    box.insertAdjacentHTML("beforeend", "<p class=\"e19-kpi-note\">No se pudo calcular con los datos actuales.</p>");
  }
}

function calmaSubmit(event) {
  event.preventDefault();
  const read = (id) => { const raw = qs(id)?.value; return raw === undefined || raw === "" ? null : parseAmount(raw); };
  const rate = read("calmaTasa");
  const error = qs("calmaError");
  if (rate !== null && !(rate > 0 && rate <= calmaEngine().MAX_WITHDRAWAL_PCT)) {
    if (error) { error.textContent = `La tasa de retirada tiene que estar entre 0 y ${calmaEngine().MAX_WITHDRAWAL_PCT} %.`; error.hidden = false; }
    announceStatus("La tasa de retirada no es válida.");
    return;
  }
  if (error) error.hidden = true;
  const holders = Object.fromEntries(CALMA_ACCOUNTS.map((account) => { const value = read(`calmaTitulares-${account.id}`); return [account.id, value !== null && value >= 1 ? Math.floor(value) : null]; }));
  calmaSave({ withdrawalRatePct: rate, holders });
  renderCalmaCobertura(calmaEngine());
  announceStatus("Datos guardados.");
}

// Una sola vez, por delegación.
function attachCalma(doc) {
  if (!doc || doc.__calmaAttached) return false;
  doc.__calmaAttached = true;
  doc.addEventListener("submit", (event) => { if (event.target?.id === "calmaForm") calmaSubmit(event); });
  return true;
}
