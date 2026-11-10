/**
 * canonical-debt-horizon.js
 *
 * FX-20, versión completa (10/11/2026, «haz la mejor versión y más completa»): la deuda viva y el patrimonio a una fecha (24 meses en
 * la tabla de impacto de la Previsión), en el plan y en una prueba o escenario. La tabla medía solo liquidez, y eso engaña en dos
 * casos: el Euribor (la cuota sube y además se amortiza menos capital, así que se debe más) y las decisiones de deuda de un
 * escenario guardado (amortizar baja la caja, pero baja la deuda lo mismo: el patrimonio apenas se mueve).
 *
 * Cómo se calcula, mes a mes y con el calendario francés de siempre (el de Deuda › Ruta y «Camino a deuda cero»):
 *  - Cada contrato activo, con su TAE declarada o, si falta, el tipo que explican su cuota y sus plazos. Sin ninguna de las dos no se
 *    inventa: se lista aparte («sin TAE ni plazo») y no suma. Una deuda con los pagos suspendidos no baja.
 *  - Las decisiones de un escenario (el estado final que da canonical-scenario-engine.js): amortización (de golpe en su mes; si cierra,
 *    a cero), fraccionada (lo de cada mes), refinanciación y retomar pagos (condiciones nuevas desde el mes siguiente), quita y
 *    reunificación (a cero; la reunificada nace con su capital).
 *  - Lo que el escenario crea fuera de los contratos: un préstamo nuevo (capital, cuota y plazo), una compra financiada (el importe con
 *    su cuota y plazo) y un préstamo de la familia («nos prestan»: deuda sin interés que baja con la devolución; «prestamos»: dinero
 *    que os deben, que suma al patrimonio).
 *  - Lo que el plan ya amortiza (las decisiones de deuda aprobadas, en su mes): cuenta igual en el plan y en la prueba.
 *  - El Euribor: desde la revisión, el capital que queda con la cuota nueva frente a la cuota de siempre (al tipo que la explica).
 *
 * Patrimonio = liquidez − deudas + lo que os deben. La cartera y la vivienda no cambian entre el plan y la prueba, así que la diferencia
 * es exacta aunque el nivel no las incluya (la pantalla lo dice). Motor puro: sin DOM, red ni almacenamiento. No ejecuta nada (A11-4).
 */

(function attachCanonicalDebtHorizon(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDebtHorizon = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalDebtHorizonFactory() {
  "use strict";

  const SCHEMA_ID = "finance-debt-horizon/v1";
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const finite = (value) => (value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null);

  function monthIndex(monthKey) {
    const match = String(monthKey || "").match(/^(\d{4})-(\d{2})/);
    return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
  }

  /** Meses de `from` a `to` (AAAA-MM); null si alguno no es un mes. */
  function monthsBetween(from, to) {
    const a = monthIndex(from);
    const b = monthIndex(to);
    return a === null || b === null ? null : b - a;
  }

  /**
   * El tipo mensual que hace que `payment` durante `months` cuotas amortice `principal` (la misma bisección que «Camino a deuda cero»).
   * null si cuota × plazo no llega al capital.
   */
  function impliedMonthlyRate(principal, payment, months) {
    if (!(principal > 0) || !(payment > 0) || !(months > 0)) return null;
    if (payment * months < principal - 0.5) return null;
    const pv = (rate) => (rate === 0 ? payment * months : (payment * (1 - Math.pow(1 + rate, -months))) / rate);
    if (pv(0) <= principal) return 0;
    let low = 0;
    let high = 1;
    for (let step = 0; step < 100; step += 1) {
      const mid = (low + high) / 2;
      if (pv(mid) > principal) low = mid; else high = mid;
    }
    return (low + high) / 2;
  }

  /** El tipo mensual de un contrato: la TAE declarada o el implícito de cuota y plazos. null si no se puede saber. */
  function monthlyRateOf(contract) {
    const apr = finite(contract?.apr);
    if (apr !== null && apr >= 0) return apr / 100 / 12;
    return impliedMonthlyRate(Number(contract?.currentPrincipal), Number(contract?.currentPayment), Math.floor(Number(contract?.remainingInstallments) || 0));
  }

  function labelOf(contract) {
    const named = [contract?.entity, contract?.type].filter(Boolean).join(" ").trim();
    return named || contract?.label || contract?.id || "Deuda";
  }

  /** Un mes de cuota: interés del saldo, la cuota (nunca más de lo que se debe) y lo que queda. */
  function pay(state) {
    if (!state.active || state.balance <= 0.005 || state.left <= 0) return;
    const interest = state.balance * state.rate;
    const due = Math.min(state.payment, state.balance + interest);
    state.balance = Math.max(0, state.balance + interest - due);
    state.left -= 1;
  }

  /**
   * El saldo de un contrato tras `months` meses, con los cambios de un escenario: `events` es una lista de { at (índice de mes desde
   * el inicio), kind: "lump"|"zero"|"terms"|"monthly", amount, payment, rate, left, months }. Sin eventos, el calendario de siempre.
   */
  function simulate({ balance, rate, payment, left, active = true }, months, events = []) {
    const state = { balance: Math.max(0, Number(balance) || 0), rate, payment: Number(payment) || 0, left: Math.max(0, Math.floor(Number(left) || 0)) || Infinity, active };
    const monthly = [];
    for (let index = 0; index < months; index += 1) {
      events.filter((event) => event.at === index).forEach((event) => {
        if (event.kind === "lump") state.balance = Math.max(0, state.balance - event.amount);
        if (event.kind === "zero") { state.balance = 0; state.active = false; }
        if (event.kind === "terms") Object.assign(state, { balance: event.balance ?? state.balance, rate: event.rate ?? state.rate, payment: event.payment, left: event.left || Infinity, active: true });
        if (event.kind === "monthly") monthly.push({ amount: event.amount, until: index + event.months });
      });
      monthly.filter((item) => index < item.until).forEach((item) => { state.balance = Math.max(0, state.balance - item.amount); });
      pay(state);
    }
    return round2(state.balance);
  }

  /** Lo que el contrato aporta sin decisiones, o por qué no se puede calcular. */
  function baseOf(contract) {
    const principal = Number(contract?.currentPrincipal) || 0;
    if (!(principal > 0) || ["settled", "reunified"].includes(contract?.paymentStatus)) return null;
    const active = contract.paymentStatus === "active" && Number(contract.currentPayment) > 0;
    const rate = active ? monthlyRateOf(contract) : 0;
    if (active && rate === null) return { excluded: { id: String(contract.id || ""), label: labelOf(contract), principal, reason: "sin-tae-ni-plazo" } };
    return { id: String(contract.id || ""), label: labelOf(contract), start: { balance: principal, rate, payment: Number(contract.currentPayment) || 0, left: contract.remainingInstallments, active } };
  }

  /**
   * Las amortizaciones que el plan ya lleva (las decisiones de deuda aprobadas de projectPlan): de golpe en su mes o, si se reparten,
   * lo de cada mes. Sin ellas, la caja del plan bajaría por la amortización y la deuda del plan no: el patrimonio del plan saldría corto.
   * @param {{ id: string, monthKey: string, amount: number, months?: number }[]} planned
   */
  function plannedEvents(planned, id, startMonthKey) {
    return (planned || []).filter((item) => String(item?.id) === id && Number(item.amount) > 0).flatMap((item) => {
      const at = monthsBetween(startMonthKey, item.monthKey);
      if (at === null) return [];
      const months = Math.max(1, Math.floor(Number(item.months) || 1));
      return months > 1
        ? [{ at: Math.max(0, at), kind: "monthly", amount: round2(Number(item.amount) / months), months }]
        : [{ at: Math.max(0, at), kind: "lump", amount: Number(item.amount) }];
    });
  }

  /**
   * La deuda del plan a `targetMonthKey`, contrato a contrato.
   * @param {any[]} contracts filas de contrato canónico (canonicalDebtContractRows)
   * @param {{ startMonthKey: string, targetMonthKey: string, planned?: any[] }} options `planned`: las amortizaciones del plan
   */
  function planDebt(contracts, { startMonthKey, targetMonthKey, planned = [] }) {
    const months = monthsBetween(startMonthKey, targetMonthKey);
    if (months === null || months < 0) return null;
    const items = [];
    const excluded = [];
    (contracts || []).forEach((contract) => {
      const base = baseOf(contract);
      if (!base) return;
      if (base.excluded) { excluded.push(base.excluded); return; }
      items.push({ id: base.id, label: base.label, balance: simulate(base.start, months, plannedEvents(planned, base.id, startMonthKey)) });
    });
    return { total: round2(items.reduce((sum, item) => sum + item.balance, 0)), receivables: 0, items, excluded };
  }

  /** Los eventos de un contrato según su estado final en el escenario (canonical-scenario-engine.js resolveEscenario). */
  function eventsOf(final, startMonthKey) {
    const at = (monthKey) => monthsBetween(startMonthKey, monthKey);
    const events = [];
    if (final.lumpSumAt?.monthKey && at(final.lumpSumAt.monthKey) !== null) events.push({ at: Math.max(0, at(final.lumpSumAt.monthKey)), kind: "lump", amount: Number(final.lumpSumAt.amount) || 0 });
    if (final.fraccionadaAt?.startMonth) events.push({ at: Math.max(0, at(final.fraccionadaAt.startMonth)), kind: "monthly", amount: Number(final.fraccionadaAt.monthlyAmount) || 0, months: Number(final.fraccionadaAt.meses) || 0 });
    const closed = ["settled", "reunified"].includes(final.paymentStatus) && final.closedByDecisionId;
    if (closed && final.scheduleEffectiveFrom) events.push({ at: Math.max(0, at(final.scheduleEffectiveFrom) + 1), kind: "zero" });
    else if (!closed && final.scheduleEffectiveFrom && !final.lumpSumAt) {
      const rate = monthlyRateOf(final);
      events.push({ at: Math.max(0, at(final.scheduleEffectiveFrom) + 1), kind: "terms", balance: Number(final.currentPrincipal) || undefined, payment: Number(final.currentPayment) || 0, rate: rate ?? 0, left: final.remainingInstallments });
    }
    return events;
  }

  /** Las deudas (y lo que os deben) que el escenario crea fuera de los contratos. */
  function createdByDecisions(decisiones, { startMonthKey, months }) {
    let debt = 0;
    let receivables = 0;
    const items = [];
    (decisiones || []).filter((decision) => decision && decision.activa !== false).forEach((decision) => {
      const params = decision.params || {};
      const mes = decision.tipo === "deuda_nueva" || decision.tipo === "compra" ? decision.planificacion?.mesResuelto || decision.planificacion?.mesManual || params.mes : params.mes;
      const at = monthsBetween(startMonthKey, mes);
      if (at === null || at >= months) return;
      const remaining = months - Math.max(0, at);
      if (decision.tipo === "deuda_nueva") {
        const rate = impliedMonthlyRate(Number(params.principal), Number(params.cuota), Number(params.plazo));
        const balance = simulate({ balance: Number(params.principal), rate: rate ?? 0, payment: Number(params.cuota), left: params.plazo }, remaining - 1);
        debt += balance;
        items.push({ id: decision.id, label: params.nombre || decision.titulo || "Préstamo nuevo", balance });
      } else if (decision.tipo === "compra" && params.financiacion) {
        const plazo = Number(params.financiacion.plazo);
        const cuota = Number(params.financiacion.cuota);
        const rate = impliedMonthlyRate(Number(params.importe), cuota, plazo);
        const balance = simulate({ balance: Number(params.importe), rate: rate ?? 0, payment: cuota, left: plazo }, remaining);
        debt += balance;
        items.push({ id: decision.id, label: decision.titulo || "Compra financiada", balance });
      } else if (decision.tipo === "prestamo_familiar") {
        const devueltos = params.devolucionMensual !== undefined && params.meses !== undefined ? Math.min(Number(params.meses), Math.max(0, remaining - 1)) * Number(params.devolucionMensual) : 0;
        const pendiente = round2(Math.max(0, Number(params.importe) - devueltos));
        if (params.direccion === "nos_prestan") {
          debt += pendiente;
          items.push({ id: decision.id, label: decision.titulo || "Préstamo de la familia", balance: pendiente });
        } else {
          receivables += pendiente;
        }
      }
    });
    return { debt: round2(debt), receivables: round2(receivables), items };
  }

  /**
   * La deuda a `targetMonthKey` con las decisiones de un escenario: los contratos con su estado final y lo que el escenario crea.
   * @param {any[]} contracts los contratos del plan
   * @param {any[]} finalState `debtStateFinal` de resolveEscenario
   * @param {any[]} decisiones las decisiones del escenario
   * @param {{ startMonthKey: string, targetMonthKey: string, planned?: any[] }} options `planned`: las amortizaciones del plan, que
   *   el escenario conserva (se superpone al plan)
   */
  function scenarioDebt(contracts, finalState, decisiones, { startMonthKey, targetMonthKey, planned = [] }) {
    const months = monthsBetween(startMonthKey, targetMonthKey);
    if (months === null || months < 0) return null;
    const finals = new Map((finalState || []).map((item) => [String(item.id), item]));
    const items = [];
    const excluded = [];
    (contracts || []).forEach((contract) => {
      const base = baseOf(contract);
      if (!base) return;
      if (base.excluded) { excluded.push(base.excluded); return; }
      const final = finals.get(base.id);
      const events = [...plannedEvents(planned, base.id, startMonthKey), ...(final ? eventsOf(final, startMonthKey) : [])];
      items.push({ id: base.id, label: base.label, balance: simulate(base.start, months, events) });
    });
    // La reunificada (cuenta nueva del escenario): nace en su mes con su capital, su cuota y su plazo.
    (finalState || []).filter((item) => item.__synthetic && item.paymentStatus === "active").forEach((item) => {
      const at = monthsBetween(startMonthKey, item.scheduleEffectiveFrom);
      if (at === null || at >= months) return;
      const balance = simulate({ balance: item.currentPrincipal, rate: monthlyRateOf(item) ?? 0, payment: item.currentPayment, left: item.remainingInstallments }, months - Math.max(0, at) - 1);
      items.push({ id: String(item.id), label: "Deuda reunificada", balance });
    });
    const created = createdByDecisions(decisiones, { startMonthKey, months });
    return {
      total: round2(items.reduce((sum, item) => sum + item.balance, 0) + created.debt),
      receivables: created.receivables,
      items: [...items, ...created.items],
      excluded,
    };
  }

  /**
   * Euribor: lo que se debe de más (o de menos) a `targetMonthKey` por la cuota nueva desde la revisión. Con la cuota de siempre, el
   * capital de la revisión baja al tipo que la explica; con la nueva, al tipo nuevo. Cada `shock` es el de canonical-stress-scenarios.js
   * euriborShocks (con `principal`, el capital en la revisión).
   * @param {any[]} shocks
   * @param {{ targetMonthKey: string }} options
   */
  function euriborDelta(shocks, { targetMonthKey }) {
    let delta = 0;
    (shocks || []).forEach((shock) => {
      if (!(Number(shock?.extra) > 0) || !(Number(shock?.principal) > 0)) return;
      const months = monthsBetween(String(shock.date || "").slice(0, 7), targetMonthKey);
      if (months === null || months < 0) return;
      const baseRate = impliedMonthlyRate(Number(shock.principal), Number(shock.from), Number(shock.months));
      if (baseRate === null) return;
      const plan = simulate({ balance: shock.principal, rate: baseRate, payment: shock.from, left: shock.months }, months + 1);
      const prueba = simulate({ balance: shock.principal, rate: Number(shock.rate) / 100 / 12, payment: shock.to, left: shock.months }, months + 1);
      delta += prueba - plan;
    });
    return round2(delta);
  }

  /**
   * Patrimonio (liquidez − deudas + lo que os deben) en el plan y en la prueba, y la diferencia.
   * @param {{ planLiquidity: number, testLiquidity: number, plan: {total: number, receivables?: number}, test: {total: number, receivables?: number} }} input
   */
  function netWorth({ planLiquidity, testLiquidity, plan, test }) {
    if (!plan || !test || !Number.isFinite(Number(planLiquidity)) || !Number.isFinite(Number(testLiquidity))) return null;
    const planValue = round2(Number(planLiquidity) - plan.total + (plan.receivables || 0));
    const testValue = round2(Number(testLiquidity) - test.total + (test.receivables || 0));
    return { plan: planValue, test: testValue, diff: round2(testValue - planValue), debtDiff: round2(test.total - plan.total), liquidityDiff: round2(Number(testLiquidity) - Number(planLiquidity)) };
  }

  return Object.freeze({ SCHEMA_ID, monthsBetween, impliedMonthlyRate, monthlyRateOf, simulate, planDebt, scenarioDebt, euriborDelta, netWorth });
});
