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
 *    más pequeña). Por defecto, la avalancha. Si la bola de nieve cuesta muy poco más (de entrada ≤ 3 % de los intereses o
 *    ≤ 150 €, lo que sea mayor; el hogar puede cambiar ese margen) y salda antes la primera deuda, NO la elige solo: lo pregunta
 *    (`sugerencia`), porque una cuota menos pronto ayuda a sostener el plan y eso puede valer esa diferencia, pero lo decide el
 *    hogar (D-N27, 21/11/2026: «ok, pero me preguntas antes y poder modificar»). El orden elegido (`options.strategy`) manda
 *    siempre y se puede cambiar cuando se quiera;
 *  - el calendario por tramos: hasta qué mes va cuánto a qué deuda.
 *
 * v2 (UND-11 y UND-12, 22/11/2026; desbloqueada por D-N23):
 *  - **Quitas dentro del cálculo** (`options.settlements`): una oferta de «pagad X y cancelamos la deuda» es un destino más del extra,
 *    ordenado por su rendimiento equivalente (lo que rinde cada euro puesto en ella, como una TAE) frente a las TAE de las demás. Lo
 *    que se perdona cuenta en el ahorro. El pago inicial también puede ir a una quita. No se acepta ni se propone nada desde aquí: eso
 *    se hace en el simulador, con su «Qué ocurrirá» (decisión 6).
 *  - **La liquidez mes a mes** (`liquidityPlan` + `options.monthlyByMonth`): el extra de cada mes sale de la previsión, sin bajar nunca
 *    del suelo: menos en los meses de recibos fuertes y más con las pagas extra. Se compara con el importe fijo más alto que tampoco
 *    baja del suelo (`fixedSafe`), que es la v1 con la misma liquidez mínima.
 *
 * Motor puro: sin DOM, sin red ni almacenamiento. No ejecuta ninguna operación ni cambia ningún contrato (A11-4).
 */

(function attachDebtOptimalPlan(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDebtOptimalPlan = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function debtOptimalPlanFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-debt-optimal-plan/v2";
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
  // UND-11: si la deuda tiene oferta de quita, el pago inicial va a esa quita (se adelanta parte o todo lo ofrecido), no al capital.
  function applyLump(contracts, attackRows, lump, settlements = []) {
    let left = amount(lump);
    const byId = new Map(attackRows.map((row) => [row.id, row]));
    const applied = [];
    const reduced = new Map();
    const prepaid = new Map();
    for (const row of attackRows) {
      if (left <= 0) break;
      if (row.agreement) continue;
      if (row.settlement) {
        const need = round2(Math.min(row.settlement.amount, row.principal));
        const take = round2(Math.min(left, need));
        if (take <= 0) continue;
        prepaid.set(row.id, take);
        applied.push({ id: row.id, label: row.label, amount: take, settles: take >= need, quita: true });
        left = round2(left - take);
        continue;
      }
      const take = round2(Math.min(left, row.principal));
      if (take <= 0) continue;
      reduced.set(row.id, take);
      applied.push({ id: row.id, label: row.label, amount: take, settles: take >= row.principal });
      left = round2(left - take);
    }
    const offers = (Array.isArray(settlements) ? settlements : []).map((item) => (prepaid.has(String(item.id)) ? { ...item, prepaid: prepaid.get(String(item.id)) } : item));
    const next = (Array.isArray(contracts) ? contracts : []).map((contract) => {
      const id = String(contract?.id || "");
      const take = reduced.get(id);
      if (!take) return contract;
      const row = byId.get(id);
      return { ...contract, currentPrincipal: round2(Number(contract.currentPrincipal) - take), apr: row.aprPct };
    });
    return { contracts: next, applied, unused: left, settlements: offers };
  }

  // Tramos: entre una deuda saldada y la siguiente, lo que se pone al mes (extra + cuotas ya liberadas) va a la siguiente del orden.
  // UND-12: con `byMonth`, lo de cada mes es lo suyo; el tramo dice lo del primer mes (`extra`) y el mínimo y el máximo del tramo.
  function periods(result, monthly, byMonth = null) {
    const extraAt = (index) => (Array.isArray(byMonth) && index < byMonth.length ? byMonth[index] : monthly);
    const rows = result.included.filter((row) => !row.agreement);
    const paid = rows.filter((row) => row.payoffIndex !== null).sort((a, b) => a.payoffIndex - b.payoffIndex);
    const out = [];
    let freed = 0;
    let from = 0;
    const done = new Set();
    for (const row of paid) {
      const target = rows.find((candidate) => !done.has(candidate.id));
      if (!target) break;
      // UND-11: una quita pagada entera con el pago inicial no recibe extra: el tramo empieza ya con la siguiente.
      if (row.settlement && row.extraApplied === 0) {
        done.add(row.id);
        freed = round2(freed + row.payment);
        continue;
      }
      const pools = [];
      for (let index = from; index <= row.payoffIndex; index += 1) pools.push(round2(extraAt(index) + freed));
      const pool = pools.length ? pools[0] : 0;
      const top = pools.length ? Math.max(...pools) : 0;
      if (row.payoffIndex >= from && top > 0) {
        out.push({
          fromIndex: from, toIndex: row.payoffIndex, targetId: target.id, targetLabel: target.label, extra: pool, extraMin: pools.length ? Math.min(...pools) : 0, extraMax: top,
          extraTotal: round2(pools.reduce((sum, value) => sum + value, 0)), payoffMonthKey: row.payoffMonthKey, settledId: row.id, settledLabel: row.label,
          ...(target.settlement ? { quita: { amount: target.settlement.amount, paid: target.extraApplied, forgiven: target.settlement.forgiven, settled: target.settlement.settled, yieldPct: target.settlement.yieldPct } } : {}),
        });
      }
      done.add(row.id);
      freed = round2(freed + row.payment);
      from = row.payoffIndex + 1;
    }
    return out;
  }

  // El margen que pone el hogar (D-N27): un porcentaje de los intereses de la avalancha (0 a 50 %) y un importe (0 a 100.000 €).
  function tolerance(value) {
    const pct = Number(value?.pct);
    const abs = Number(value?.abs);
    return {
      pct: Number.isFinite(pct) && pct >= 0 && pct <= 0.5 ? pct : SNOWBALL_TOLERANCE.pct,
      abs: Number.isFinite(abs) && abs >= 0 && abs <= 100000 ? round2(abs) : SNOWBALL_TOLERANCE.abs,
    };
  }

  /**
   * UND-12: el extra de cada mes que permite la previsión sin bajar nunca del suelo.
   * @param {Array<{monthKey?: string, detailMonthKey?: string, totalLiquidity: number, startLiquidity?: number}>} rows previsión mensual
   *   (la del motor mensual: liquidez a fin de mes, con las cuotas de hoy ya restadas)
   * @param {{startMonthKey?: string, floor?: number, lump?: number}} [options] `floor`: el suelo de Hoy; `lump`: el pago inicial, que sale
   *   de la liquidez de hoy y ya no está para los meses siguientes.
   * Regla: cada mes se pone lo que sobra ese mes (lo que sube la liquidez; un mes en negativo pone 0 y no resta), siempre que lo puesto
   * hasta entonces (E) no haga bajar del suelo ningún mes, ni ese ni los siguientes. La liquidez de hoy no se toca: es la del pago
   * inicial. Cada mes pone E(mes) − E(anterior), a euros enteros.
   */
  function liquidityPlan(rows, options = {}) {
    const start = String(options.startMonthKey || "");
    const floor = Number.isFinite(Number(options.floor)) ? Math.max(0, Number(options.floor)) : 0;
    const lump = amount(options.lump);
    const list = (Array.isArray(rows) ? rows : [])
      .map((row) => ({ monthKey: String(row?.monthKey || row?.detailMonthKey || ""), end: Number(row?.totalLiquidity), begin: Number(row?.startLiquidity) }))
      .filter((row) => /^\d{4}-\d{2}$/.test(row.monthKey) && row.monthKey >= start && Number.isFinite(row.end))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    if (!list.length || list[0].monthKey !== start) return { ok: false, reason: "sin-prevision" };
    const opening = Number.isFinite(list[0].begin) ? list[0].begin : list[0].end;
    const room = list.map((row) => row.end - lump - floor);
    const cap = room.slice();
    for (let index = cap.length - 2; index >= 0; index -= 1) cap[index] = Math.min(cap[index], cap[index + 1]);
    const byMonth = [];
    let committed = 0;
    let surplus = 0;
    let previous = opening;
    list.forEach((row, index) => {
      // Lo que sobra cada mes (los meses en negativo no restan aquí: los cubre la liquidez de hoy, y el suelo lo vigila `cap`).
      surplus += Math.max(0, row.end - previous);
      previous = row.end;
      const limit = Math.min(surplus, cap[index]);
      const next = Math.max(committed, Math.floor(limit));
      byMonth.push(Math.max(0, next - committed));
      committed = Math.max(committed, next);
    });
    const firstBelow = list.findIndex((row, index) => room[index] < 0);
    // La v1 con la misma liquidez mínima: el importe fijo más alto que tampoco baja del suelo ningún mes.
    const fixedSafe = Math.max(0, Math.floor(Math.min(...cap.map((limit, index) => limit / (index + 1))) / 10) * 10);
    const tail = byMonth.slice(-12);
    const after = tail.length ? Math.max(0, Math.floor(tail.reduce((sum, value) => sum + value, 0) / tail.length / 10) * 10) : 0;
    return {
      ok: true, startMonthKey: start, floor, lump, byMonth, monthKeys: list.map((row) => row.monthKey), after, fixedSafe,
      belowFloor: firstBelow === -1 ? null : { monthKey: list[firstBelow].monthKey, index: firstBelow },
      lumpBreaksFloor: lump > 0 && Math.min(...room) < 0 && Math.min(...room) + lump >= 0,
      total12: byMonth.slice(0, 12).reduce((sum, value) => sum + value, 0),
    };
  }

  function summary(result, baseline) {
    const finishes = result.ok && !result.beyondHorizon && result.debtFreeMonthKey;
    const baseFinishes = baseline.ok && !baseline.beyondHorizon && baseline.debtFreeMonthKey;
    const interestSaved = finishes && baseFinishes ? round2(Math.max(0, baseline.totalInterest - result.totalInterest)) : null;
    const forgiven = round2(result.totalForgiven || 0);
    return {
      forgiven,
      // Intereses que no se pagan más lo que perdonan las quitas: lo que de verdad os ahorráis frente al calendario de hoy.
      totalSaved: interestSaved === null ? (forgiven > 0 && finishes ? forgiven : null) : round2(interestSaved + forgiven),
      debtFreeMonthKey: result.debtFreeMonthKey,
      monthsToDebtFree: result.monthsToDebtFree,
      totalInterest: result.beyondHorizon ? null : result.totalInterest,
      interestSaved,
      monthsSaved: finishes && baseFinishes ? baseline.monthsToDebtFree - result.monthsToDebtFree : null,
      firstPayoff: result.milestones[0] || null,
    };
  }

  /**
   * @param {{project: Function}} payoffEngine FinanceCanonicalDebtPayoffPath
   * @param {Array<Record<string, any>>} contracts filas de contrato canónico (las mismas de «Camino a deuda cero»)
   * @param {{startMonthKey?: string, monthly?: number, lump?: number, order?: string[], capacity?: number|null, available?: number|null, strategy?: string|null, tolerance?: {pct?: number, abs?: number}|null, settlements?: Array<{id: string, amount: number}>|null, monthlyByMonth?: number[]|null}} options
   *   `monthly`: lo que se pone al mes además de las cuotas; `lump`: pago inicial; `order`: orden de la avalancha (DEB5, TAE tras
   *   deducción fiscal); `capacity` y `available`: la capacidad libre al mes y el dinero por encima del suelo del colchón, solo para avisar;
   *   `strategy`: el orden que ha elegido el hogar («avalancha» o «bola-nieve»; sin elegir, la avalancha y, si procede, la pregunta);
   *   `tolerance`: el margen para preguntar por la bola de nieve ({pct, abs}; sin él, SNOWBALL_TOLERANCE).
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

    const settlements = Array.isArray(options.settlements) ? options.settlements.filter((item) => item && amount(item.amount) > 0).map((item) => ({ id: String(item.id), amount: amount(item.amount) })) : [];
    const byMonth = Array.isArray(options.monthlyByMonth) ? options.monthlyByMonth.map(amount) : null;
    const camino = (strategy) => {
      const order = strategy === "avalancha" ? options.order || [] : [];
      const attack = payoffEngine.project(contracts, { startMonthKey, extraMonthly: 0, strategy, order, settlements });
      const withLump = applyLump(contracts, attack.included, lump, settlements);
      const result = payoffEngine.project(withLump.contracts, { startMonthKey, extraMonthly: monthly, extraByMonth: byMonth, strategy, order, redirectFreed: true, settlements: withLump.settlements });
      return { strategy, result, lumpApplied: withLump.applied, lumpUnused: withLump.unused, periods: result.ok ? periods(result, monthly, byMonth) : [], summary: summary(result, baseline) };
    };
    const avalancha = camino("avalancha");
    const bola = camino("bola-nieve");

    // D-N27: la bola de nieve se sugiere (no se elige sola) si cuesta como mucho el margen más y salda antes la primera deuda.
    const a = avalancha.summary;
    const b = bola.summary;
    const margen = tolerance(options.tolerance);
    let sugerencia = null;
    if (a.totalInterest !== null && b.totalInterest !== null && a.firstPayoff && b.firstPayoff) {
      const extraCost = round2(b.totalInterest - a.totalInterest);
      const limit = round2(Math.max(margen.abs, a.totalInterest * margen.pct));
      if (extraCost <= limit && b.firstPayoff.payoffIndex < a.firstPayoff.payoffIndex) {
        sugerencia = { strategy: "bola-nieve", extraCost: Math.max(0, extraCost), monthsEarlier: a.firstPayoff.payoffIndex - b.firstPayoff.payoffIndex, firstPayoff: b.firstPayoff, limit };
      }
    }
    const chosen = options.strategy === "avalancha" || options.strategy === "bola-nieve" ? options.strategy : null;
    const recommended = chosen === "bola-nieve" ? bola : avalancha;
    const reason = chosen ? `elegida-${chosen}` : "avalancha";
    const alternative = recommended === avalancha ? bola : avalancha;
    const warnings = [];
    const capacity = options.capacity === null || options.capacity === undefined ? null : Number(options.capacity);
    const available = options.available === null || options.available === undefined ? null : Number(options.available);
    if (Number.isFinite(capacity) && monthly > Math.max(0, capacity)) warnings.push({ id: "por-encima-capacidad", capacity: round2(Math.max(0, capacity)) });
    if (Number.isFinite(available) && lump > Math.max(0, available)) warnings.push({ id: "por-encima-disponible", available: round2(Math.max(0, available)) });
    if (recommended.lumpUnused > 0) warnings.push({ id: "pago-inicial-sobra", amount: recommended.lumpUnused });
    // Lo que sigue fuera con el plan (una deuda sin cuota con su oferta de quita sí entra).
    const fuera = recommended.result.ok ? recommended.result : baseline;
    if (fuera.excluded.length) warnings.push({ id: "fuera", count: fuera.excluded.length, principal: fuera.excludedPrincipal });

    return {
      ok: true,
      schemaId: SCHEMA_ID,
      startMonthKey,
      monthly,
      monthlyByMonth: byMonth,
      lump,
      quitas: (recommended.result.included || []).filter((row) => row.settlement).map((row) => ({ id: row.id, label: row.label, principal: row.principal, ...row.settlement, payoffMonthKey: row.payoffMonthKey })),
      quitasIgnoradas: settlements.filter((item) => !(recommended.result.included || []).some((row) => row.id === item.id && row.settlement)).map((item) => item.id),
      baseline: { debtFreeMonthKey: baseline.debtFreeMonthKey, monthsToDebtFree: baseline.monthsToDebtFree, totalInterest: baseline.beyondHorizon ? null : baseline.totalInterest, beyondHorizon: baseline.beyondHorizon, excluded: baseline.excluded },
      recommended: { ...recommended, reason },
      alternative,
      chosen,
      sugerencia,
      pregunta: Boolean(sugerencia) && !chosen,
      tolerance: margen,
      diferenciaAlternativa: a.totalInterest !== null && b.totalInterest !== null ? round2(alternative.summary.totalInterest - recommended.summary.totalInterest) : null,
      warnings,
    };
  }

  return { SCHEMA_ID, SNOWBALL_TOLERANCE, plan, applyLump, periods, tolerance, liquidityPlan };
});
