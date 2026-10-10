(function attachCanonicalCalmCoverage(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalCalmCoverage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalCalmCoverageFactory() {
  "use strict";

  // WP-44 (CAR-02 + CAR-05 + CAR-06, docs/WP44_DISENO.md): tres lecturas de la cartera y del patrimonio, hechas para mirar con calma y no para actuar:
  //   · calmDrawdown: la caída de la cartera desde su máximo, medida en MERCADO (sin contar lo que habéis aportado o vendido), en € y en meses de aportación.
  //   · coverage: qué parte del gasto pagan ya los activos (alquiler neto del local + retirada sostenible de la cartera líquida).
  //   · depositExposure: lo que hay en depósitos por entidad frente al límite de garantía por titular.
  // Motor puro: ni DOM, ni red, ni almacenamiento. NUNCA recomienda vender ni comprar (A11-4): enseña la cifra y lo que dice vuestra política.
  //
  // Reglas de honestidad:
  //   · dato ausente no es cero: sin 3 valoraciones completas no hay «caída»; sin tasa de retirada o sin alquiler declarado, esa parte NO suma (y se dice).
  //   · una aportación no es una subida y una venta no es una caída: la caída se mide con lo que el mercado hizo, descontando los flujos fechados.
  //   · los dividendos NO se suman aparte: ya forman parte de lo que una tasa de retirada sostenible da por supuesto; sumarlos sería contarlos dos veces.
  //   · cuántos titulares tiene una cuenta no se supone: sin él, un saldo por encima del límite individual no se declara «cubierto» ni «descubierto».

  const SCHEMA_ID = "finance-calm-coverage/v1";
  const MIN_VALUATIONS = 3;
  const STALE_DAYS = 35;
  const DEFAULT_LEVELS = Object.freeze([20, 35]); // los mismos niveles de caída que la política de inversión (WP-39)
  const DEPOSIT_LIMIT = 100000; // Fondo de Garantía de Depósitos, por titular y entidad (verificar el vigente)
  const MAX_WITHDRAWAL_PCT = 15;
  const MILESTONES = Object.freeze([25, 50, 100]);
  const LIQUID_TYPES = Object.freeze(["fondo", "accion", "etf"]); // sin plan de pensiones (inmovilizado), ni cripto, ni «otro» (no se sabe)

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const round1 = (value) => Math.round((number(value) + Number.EPSILON) * 10) / 10;
  const text = (value) => String(value ?? "").trim();
  const isIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value));

  function daysBetween(fromIso, toIso) {
    const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
  }

  /** Aportaciones menos ventas fechadas en (desde, hasta]: lo que entró o salió sin ser mercado. */
  function netFlows(position, fromDate, toDate) {
    const inRange = (date) => isIso(date) && date > fromDate && date <= toDate;
    const contributed = (Array.isArray(position && position.contributions) ? position.contributions : []).filter((item) => inRange(text(item && item.date))).reduce((sum, item) => sum + number(item.amount), 0);
    const sold = (Array.isArray(position && position.disposals) ? position.disposals : []).filter((item) => inRange(text(item && item.date))).reduce((sum, item) => sum + number(item.saleProceeds), 0);
    return round2(contributed - sold);
  }

  /**
   * El valor de la cartera en cada fecha en la que TODAS las posiciones con valor tienen alguna valoración (la última conocida hasta esa fecha). Una fecha con posiciones
   * sin valorar no se usa: el total saltaría solo por faltar una.
   * @param {{valuations?: Array<{date?: string, points?: Array<{id?: string, value?: number}>}>, positions?: Array<any>}} [params]
   */
  function portfolioSeries({ valuations = [], positions = [] } = {}) {
    const held = (Array.isArray(positions) ? positions : []).filter((position) => position && text(position.id) && number(position.currentValue) > 0);
    const byPosition = new Map(held.map((position) => [text(position.id), []]));
    const dates = new Set();
    (Array.isArray(valuations) ? valuations : []).forEach((item) => {
      if (!item || !isIso(item.date)) return;
      (Array.isArray(item.points) ? item.points : []).forEach((point) => {
        const list = byPosition.get(text(point && point.id));
        if (list && known(point.value)) { list.push({ date: item.date, value: number(point.value) }); dates.add(item.date); }
      });
    });
    byPosition.forEach((list) => list.sort((a, b) => (a.date < b.date ? -1 : 1)));
    const points = [];
    [...dates].sort().forEach((date) => {
      let total = 0;
      let complete = true;
      byPosition.forEach((list) => {
        const upTo = list.filter((entry) => entry.date <= date);
        if (!upTo.length) { complete = false; return; }
        total += upTo[upTo.length - 1].value;
      });
      if (complete && held.length) points.push({ date, total: round2(total) });
    });
    const neverValued = held.filter((position) => !(byPosition.get(text(position.id)) || []).length).map((position) => text(position.label) || text(position.id));
    return { points, held: held.length, neverValued };
  }

  /**
   * La caída de la cartera desde su máximo, en mercado: se acumula lo que hizo el mercado entre valoraciones sucesivas (variación de valor menos aportaciones netas) y se mide
   * cuánto hay desde el máximo de ese acumulado hasta hoy.
   * @param {{series?: {points?: Array<{date: string, total: number}>, neverValued?: string[]}, positions?: Array<any>, monthlyContribution?: number|null, levels?: ReadonlyArray<number>, today?: string, contributed?: number|null, value?: number|null}} [params]
   */
  function calmDrawdown({ series = { points: [] }, positions = [], monthlyContribution = null, levels = DEFAULT_LEVELS, today = "", contributed = null, value = null } = {}) {
    const points = Array.isArray(series.points) ? series.points : [];
    if (points.length < MIN_VALUATIONS) {
      return { status: "not-enough", have: points.length, need: MIN_VALUATIONS, neverValued: Array.isArray(series.neverValued) ? series.neverValued : [] };
    }
    const held = Array.isArray(positions) ? positions : [];
    const cumulative = [0];
    for (let index = 1; index < points.length; index += 1) {
      const flows = held.reduce((sum, position) => sum + netFlows(position, points[index - 1].date, points[index].date), 0);
      cumulative.push(cumulative[index - 1] + (points[index].total - points[index - 1].total - flows));
    }
    let peak = 0;
    cumulative.forEach((item, index) => { if (item >= cumulative[peak]) peak = index; });
    const last = points.length - 1;
    const amount = round2(cumulative[last] - cumulative[peak]); // ≤ 0
    const base = points[peak].total;
    const pct = base > 0 ? round1((amount / base) * 100) : 0;
    const depth = -pct;
    const sorted = [...levels].filter((level) => known(level)).map(Number).sort((a, b) => a - b);
    const level = sorted.reduce((reached, threshold, index) => (depth >= threshold ? index + 1 : reached), 0);
    const monthly = known(monthlyContribution) && number(monthlyContribution) > 0 ? number(monthlyContribution) : null;
    const age = isIso(today) ? daysBetween(points[last].date, today) : null;
    return {
      status: "ok", firstDate: points[0].date, lastDate: points[last].date, peakDate: points[peak].date, valuationCount: points.length,
      drawdownAmount: amount, drawdownPct: pct, level, levels: sorted, valueNow: points[last].total, valuePeak: points[peak].total,
      monthsOfContribution: monthly && amount < 0 ? round1(Math.abs(amount) / monthly) : null, monthlyContribution: monthly,
      stale: age !== null && age > STALE_DAYS, ageDays: age,
      contributed: known(contributed) ? round2(contributed) : null, value: known(value) ? round2(value) : null,
    };
  }

  /**
   * Qué parte del gasto pagan ya los activos. Solo suman las partes que se conocen; las que faltan se nombran.
   * @param {{monthlyExpense?: number|null, rentNetMonthly?: number|null, withdrawalRatePct?: number|null, liquidPortfolioValue?: number|null}} [params]
   */
  function coverage({ monthlyExpense = null, rentNetMonthly = null, withdrawalRatePct = null, liquidPortfolioValue = null } = {}) {
    if (!(known(monthlyExpense) && number(monthlyExpense) > 0)) return { status: "no-expense", reason: "No hay un gasto medio de la previsión con el que comparar." };
    const annualExpense = round2(number(monthlyExpense) * 12);
    const parts = [];
    const missing = [];
    if (known(rentNetMonthly) && number(rentNetMonthly) > 0) parts.push({ id: "rent", label: "Alquiler neto", annual: round2(number(rentNetMonthly) * 12) });
    else missing.push("el alquiler neto (ningún activo lo declara)");
    const rate = known(withdrawalRatePct) ? number(withdrawalRatePct) : null;
    if (rate !== null && rate > 0 && rate <= MAX_WITHDRAWAL_PCT && known(liquidPortfolioValue) && number(liquidPortfolioValue) > 0) {
      parts.push({ id: "withdrawal", label: "Retirada sostenible de la cartera líquida", annual: round2(number(liquidPortfolioValue) * rate / 100), ratePct: rate });
    } else if (rate === null || rate <= 0) missing.push("la tasa de retirada (no la habéis declarado)");
    else if (rate > MAX_WITHDRAWAL_PCT) missing.push(`la tasa de retirada (un ${rate} % no es sostenible: tope ${MAX_WITHDRAWAL_PCT} %)`);
    else missing.push("el valor de la cartera líquida (no hay fondos, acciones ni ETF valorados)");
    const annualIncome = round2(parts.reduce((sum, part) => sum + part.annual, 0));
    const coveragePct = round1((annualIncome / annualExpense) * 100);
    const reached = MILESTONES.filter((milestone) => coveragePct >= milestone);
    const next = MILESTONES.find((milestone) => coveragePct < milestone) || null;
    return {
      status: parts.length ? "ok" : "no-income", annualExpense, annualIncome, coveragePct, parts, missing, reached, nextMilestone: next,
      neededForNext: next === null ? 0 : round2(Math.max(0, (annualExpense * next) / 100 - annualIncome)),
    };
  }

  /**
   * Depósitos por entidad frente al límite de garantía por titular. «Titulares» sin declarar → no se supone.
   * @param {{accounts?: Array<{id?: string, entity?: string, balance?: number|null, holders?: number|null}>, limit?: number}} [params]
   */
  function depositExposure({ accounts = [], limit = DEPOSIT_LIMIT } = {}) {
    const rows = (Array.isArray(accounts) ? accounts : []).filter((account) => account && known(account.balance)).map((account) => {
      const balance = round2(number(account.balance));
      const holders = known(account.holders) && number(account.holders) >= 1 ? Math.floor(number(account.holders)) : null;
      let status;
      let overBy = 0;
      if (balance <= limit) status = "within";
      else if (holders === null) status = "unknown-holders";
      else if (balance <= limit * holders) status = "within";
      else { status = "over"; overBy = round2(balance - limit * holders); }
      return { id: text(account.id), entity: text(account.entity) || "Entidad", balance, holders, covered: holders === null ? null : limit * holders, status, overBy };
    });
    return { limit, rows, total: round2(rows.reduce((sum, row) => sum + row.balance, 0)), anyOver: rows.some((row) => row.status === "over"), anyUnknown: rows.some((row) => row.status === "unknown-holders") };
  }

  return { SCHEMA_ID, MIN_VALUATIONS, STALE_DAYS, DEFAULT_LEVELS, DEPOSIT_LIMIT, MAX_WITHDRAWAL_PCT, MILESTONES, LIQUID_TYPES, netFlows, portfolioSeries, calmDrawdown, coverage, depositExposure };
});
