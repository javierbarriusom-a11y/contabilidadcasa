/**
 * canonical-debt-optimal-plan.js
 *
 * Plan óptimo de saldo de deuda (21/11/2026, petición del hogar: «quiero seguir con un plan optimizado de saldo de deuda»).
 * Responde a «con lo que podemos poner al mes y, si queremos, un pago inicial, ¿en qué orden atacamos las deudas, cuándo acabamos y
 * cuánto nos ahorramos frente a seguir como hasta ahora?».
 *
 * No es un motor de deuda nuevo (NTC-05): cada camino lo calcula «Camino a deuda cero» (canonical-debt-payoff-path.js, `project`),
 * con las mismas convenciones (cuota francesa, sin comisiones de amortización anticipada ni cambios de tipo, lo que no tiene cuota
 * o TAE no entra y se lista, los acuerdos aceptados no se adelantan). Lo que añade este módulo:
 *  - las cuotas que se liberan al saldar una deuda SÍ se redirigen a la siguiente (bola de nieve de cuotas, `redirectFreed`): es lo
 *    que hace «óptimo» el plan, y por eso el ahorro sale mayor que en «Camino a deuda cero» con el mismo extra;
 *  - un pago inicial opcional, que se aplica en el orden de ataque (rebaja el capital de la primera deuda y, si sobra, de la
 *    siguiente; cuota y TAE no cambian, así que el plazo se acorta);
 *  - compara los dos órdenes (avalancha: primero la TAE más alta, que es el que menos intereses paga; bola de nieve: primero la
 *    más pequeña) y recomienda la avalancha salvo que la bola de nieve cueste muy poco más (≤ 3 % de los intereses o ≤ 150 €) y
 *    salde la primera deuda antes: una cuota menos pronto ayuda a sostener el plan, y eso vale esa diferencia;
 *  - el calendario por tramos: hasta qué mes va cuánto a qué deuda.
 *
 * Motor puro: sin DOM, sin red ni almacenamiento. No ejecuta ninguna operación ni cambia ningún contrato (A11-4).
 */

(function attachDebtOptimalPlan(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDebtOptimalPlan = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function debtOptimalPlanFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-debt-optimal-plan/v1";
  // La bola de nieve se recomienda si cuesta como mucho esto más que la avalancha (lo que sea mayor) y salda antes la primera deuda.
  const SNOWBALL_TOLERANCE = Object.freeze({ pct: 0.03, abs: 150 });

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function amount(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : 0;
  }

  // Rebaja el capital de las deudas, en el orden de ataque, con el pago inicial. La TAE se fija a la que usó la proyección (también
  // la deducida de cuota y plazo): con menos capital, la deducción daría otra TAE y no sería el mismo contrato.
  function applyLump(contracts, attackRows, lump) {
    let left = amount(lump);
    const byId = new Map(attackRows.map((row) => [row.id, row]));
    const applied = [];
    const reduced = new Map();
    for (const row of attackRows) {
      if (left <= 0) break;
      if (row.agreement) continue;
      const take = round2(Math.min(left, row.principal));
      if (take <= 0) continue;
      reduced.set(row.id, take);
      applied.push({ id: row.id, label: row.label, amount: take, settles: take >= row.principal });
      left = round2(left - take);
    }
    const next = (Array.isArray(contracts) ? contracts : []).map((contract) => {
      const id = String(contract?.id || "");
      const take = reduced.get(id);
      if (!take) return contract;
      const row = byId.get(id);
      return { ...contract, currentPrincipal: round2(Number(contract.currentPrincipal) - take), apr: row.aprPct };
    });
    return { contracts: next, applied, unused: left };
  }

  // Tramos: entre una deuda saldada y la siguiente, lo que se pone al mes (extra + cuotas ya liberadas) va a la siguiente del orden.
  function periods(result, monthly) {
    const rows = result.included.filter((row) => !row.agreement);
    const paid = rows.filter((row) => row.payoffIndex !== null).sort((a, b) => a.payoffIndex - b.payoffIndex);
    const out = [];
    let freed = 0;
    let from = 0;
    const done = new Set();
    for (const row of paid) {
      const target = rows.find((candidate) => !done.has(candidate.id));
      if (!target) break;
      const pool = round2(monthly + freed);
      if (row.payoffIndex >= from && pool > 0) {
        out.push({ fromIndex: from, toIndex: row.payoffIndex, targetId: target.id, targetLabel: target.label, extra: pool, payoffMonthKey: row.payoffMonthKey, settledId: row.id, settledLabel: row.label });
      }
      done.add(row.id);
      freed = round2(freed + row.payment);
      from = row.payoffIndex + 1;
    }
    return out;
  }

  function summary(result, baseline) {
    const finishes = result.ok && !result.beyondHorizon && result.debtFreeMonthKey;
    const baseFinishes = baseline.ok && !baseline.beyondHorizon && baseline.debtFreeMonthKey;
    return {
      debtFreeMonthKey: result.debtFreeMonthKey,
      monthsToDebtFree: result.monthsToDebtFree,
      totalInterest: result.beyondHorizon ? null : result.totalInterest,
      interestSaved: finishes && baseFinishes ? round2(Math.max(0, baseline.totalInterest - result.totalInterest)) : null,
      monthsSaved: finishes && baseFinishes ? baseline.monthsToDebtFree - result.monthsToDebtFree : null,
      firstPayoff: result.milestones[0] || null,
    };
  }

  /**
   * @param {{project: Function}} payoffEngine FinanceCanonicalDebtPayoffPath
   * @param {Array<Record<string, any>>} contracts filas de contrato canónico (las mismas de «Camino a deuda cero»)
   * @param {{startMonthKey?: string, monthly?: number, lump?: number, order?: string[], capacity?: number|null, available?: number|null}} options
   *   `monthly`: lo que se pone al mes además de las cuotas; `lump`: pago inicial; `order`: orden de la avalancha (DEB5, TAE tras
   *   deducción fiscal); `capacity` y `available`: la capacidad libre al mes y el dinero por encima del suelo del colchón, solo para avisar.
   */
  function plan(payoffEngine, contracts, options = {}) {
    if (!payoffEngine || typeof payoffEngine.project !== "function") return { ok: false, error: "Falta el cálculo de «Camino a deuda cero»." };
    const monthly = amount(options.monthly);
    const lump = amount(options.lump);
    const startMonthKey = options.startMonthKey;
    const baseline = payoffEngine.project(contracts, { startMonthKey, extraMonthly: 0 });
    if (!baseline.ok) return { ok: false, error: baseline.error };
    if (baseline.nothingToProject) return { ok: true, nothing: true, baseline };
    if (!baseline.included.length) return { ok: true, nothing: false, sinDatos: true, baseline };

    const camino = (strategy) => {
      const order = strategy === "avalancha" ? options.order || [] : [];
      const attack = payoffEngine.project(contracts, { startMonthKey, extraMonthly: 0, strategy, order });
      const withLump = applyLump(contracts, attack.included, lump);
      const result = payoffEngine.project(withLump.contracts, { startMonthKey, extraMonthly: monthly, strategy, order, redirectFreed: true });
      return { strategy, result, lumpApplied: withLump.applied, lumpUnused: withLump.unused, periods: result.ok ? periods(result, monthly) : [], summary: summary(result, baseline) };
    };
    const avalancha = camino("avalancha");
    const bola = camino("bola-nieve");

    let recommended = avalancha;
    let reason = "avalancha";
    const a = avalancha.summary;
    const b = bola.summary;
    if (a.totalInterest !== null && b.totalInterest !== null && a.firstPayoff && b.firstPayoff) {
      const extraCost = round2(b.totalInterest - a.totalInterest);
      const tolerance = Math.max(SNOWBALL_TOLERANCE.abs, a.totalInterest * SNOWBALL_TOLERANCE.pct);
      if (extraCost <= tolerance && b.firstPayoff.payoffIndex < a.firstPayoff.payoffIndex) {
        recommended = bola;
        reason = extraCost <= 0 ? "bola-gratis" : "bola-motiva";
      }
    }
    const alternative = recommended === avalancha ? bola : avalancha;
    const warnings = [];
    const capacity = options.capacity === null || options.capacity === undefined ? null : Number(options.capacity);
    const available = options.available === null || options.available === undefined ? null : Number(options.available);
    if (Number.isFinite(capacity) && monthly > Math.max(0, capacity)) warnings.push({ id: "por-encima-capacidad", capacity: round2(Math.max(0, capacity)) });
    if (Number.isFinite(available) && lump > Math.max(0, available)) warnings.push({ id: "por-encima-disponible", available: round2(Math.max(0, available)) });
    if (recommended.lumpUnused > 0) warnings.push({ id: "pago-inicial-sobra", amount: recommended.lumpUnused });
    if (baseline.excluded.length) warnings.push({ id: "fuera", count: baseline.excluded.length, principal: baseline.excludedPrincipal });

    return {
      ok: true,
      schemaId: SCHEMA_ID,
      startMonthKey,
      monthly,
      lump,
      baseline: { debtFreeMonthKey: baseline.debtFreeMonthKey, monthsToDebtFree: baseline.monthsToDebtFree, totalInterest: baseline.beyondHorizon ? null : baseline.totalInterest, beyondHorizon: baseline.beyondHorizon, excluded: baseline.excluded },
      recommended: { ...recommended, reason },
      alternative,
      diferenciaAlternativa: a.totalInterest !== null && b.totalInterest !== null ? round2(alternative.summary.totalInterest - recommended.summary.totalInterest) : null,
      warnings,
    };
  }

  return { SCHEMA_ID, SNOWBALL_TOLERANCE, plan, applyLump, periods };
});
