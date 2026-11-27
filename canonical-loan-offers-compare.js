/**
 * canonical-loan-offers-compare.js
 *
 * Deuda › Préstamo para saldar · «Comparar con otra oferta» (26/11/2026, petición urgente del hogar: «estimar el impacto positivo o
 * negativo de la solicitud de un crédito personal para afrontar las deudas actuales, pudiendo comparar dos ofertas»).
 *
 * No calcula nada de deuda por su cuenta: pasa cada oferta por el MISMO motor de la pestaña (canonical-loan-payoff-plan.js, que usa
 * el de «Camino a deuda cero»), con las mismas deudas y los mismos supuestos (qué se cancela, extra, plan agresivo, ingresos), y
 * compara. Lo que añade:
 *
 *   1. **Seguros o vinculaciones** (€/mes). La TAE de una oferta no incluye un seguro de protección de pagos o una vinculación que el
 *      banco exija, y en España son la diferencia típica entre dos ofertas. Se suman a la cuota y a lo que cuesta, y dan el «coste
 *      efectivo anual» (la misma TIR que la TAE, con el seguro dentro de cada cuota).
 *   2. **El impacto de cada oferta frente a no pedir nada**, con su signo: los euros de intereses, comisiones y seguros de más o de
 *      menos hasta la deuda cero pagando solo las cuotas, y lo que sube o baja lo que se paga en deudas cada mes.
 *   3. **Quién gana en cada criterio**, y una recomendación que dice su porqué. Si ninguna ahorra frente a no pedir nada, lo dice:
 *      entonces lo que compran es una cuota más baja, no un ahorro.
 *
 * Reglas de honestidad (las del motor): dato ausente no es cero; una cifra que no acaba dentro del horizonte no se compara; no pide,
 * firma ni escribe nada (A11-4). Motor puro: sin DOM, red ni almacenamiento.
 */
(function attachCanonicalLoanOffersCompare(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLoanOffersCompare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalLoanOffersCompareFactory(root) {
  "use strict";

  const SCHEMA_ID = "finance-loan-offers-compare/v1";
  const INSURANCE_MAX = 1000;
  const TIE_EUROS = 1;

  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  /** Euros enteros con punto de miles, como en el resto de la app: en una comparación, los céntimos no deciden nada. */
  const eur = (value) => `${Math.round(Number(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;

  function planEngine(engine) {
    if (engine) return engine;
    if (root && root.FinanceCanonicalLoanPayoffPlan) return root.FinanceCanonicalLoanPayoffPlan;
    if (typeof require === "function") return require("./canonical-loan-payoff-plan.js");
    return null;
  }

  /** El seguro, validado: vacío es 0 (no hay); negativo o desorbitado es un error en su campo. */
  function insuranceOf(offer) {
    if (!finite(offer?.insuranceMonthly)) return { ok: true, value: 0 };
    const value = Number(offer.insuranceMonthly);
    if (value < 0 || value > INSURANCE_MAX) return { ok: false, error: `Los seguros o vinculaciones tienen que estar entre 0 € y ${INSURANCE_MAX} € al mes.` };
    return { ok: true, value: round2(value) };
  }

  /** Coste efectivo anual con el seguro dentro de la cuota (misma TIR que la TAE del motor). */
  function effectiveAnnualPct(engine, terms, insurance) {
    if (!(insurance > 0)) return terms.taePct;
    const irr = engine.monthlyIrr(terms.netFunds, terms.payment + insurance, terms.months);
    return irr === null ? null : round2((Math.pow(1 + irr, 12) - 1) * 100);
  }

  /** Una oferta por el motor de la pestaña y su resumen comparable. */
  function evaluate(engine, contracts, baseOptions, offer, label) {
    const insurance = insuranceOf(offer);
    if (!insurance.ok) return { ok: false, label, field: "insuranceMonthly", error: insurance.error };
    const result = engine.plan(contracts, {
      ...baseOptions,
      loan: { capital: offer.capital, months: offer.months, tinPct: offer.tinPct, openingFeePct: offer.openingFeePct },
      earlyFeePct: offer.earlyFeePct,
    });
    if (!result.ok) return { ok: false, label, field: result.field, error: result.error };
    const t = result.terms;
    const seguro = insurance.value;
    const { today, withLoan, aggressive, sameEffort } = result.paths;
    const insuranceWithLoan = round2(seguro * t.months);
    // En el plan agresivo el préstamo puede acabar antes que su plazo; nunca después de la deuda cero.
    const aggressiveLoanMonths = aggressive && finite(aggressive.monthsToDebtFree) ? Math.min(t.months, aggressive.monthsToDebtFree) : t.months;
    const insuranceAggressive = round2(seguro * aggressiveLoanMonths);
    const comparable = (path) => Boolean(path) && !path.beyondHorizon && finite(path.monthsToDebtFree);
    const costWithLoan = withLoan ? round2(withLoan.totalCost + insuranceWithLoan) : null;
    const costAggressive = aggressive ? round2(aggressive.totalCost + insuranceAggressive) : null;
    const impactCost = comparable(today) && comparable(withLoan) ? round2(today.totalCost - costWithLoan) : null;
    const impactMonths = comparable(today) && comparable(withLoan) ? today.monthsToDebtFree - withLoan.monthsToDebtFree : null;
    const monthlyDebtWithLoan = round2(result.withLoanPayment + seguro);
    // Una deuda cancelada a medias conserva su cuota (el motor acorta su plazo): la cuota del primer mes la incluye, y dura lo que
    // tarde en acabarse lo que queda. Se dice, con lo que bastaría pedir para cancelarla entera, y se compara la cuota de después.
    const partialRow = result.allocations.find((row) => row.amount > 0 && !row.full) || null;
    const partial = partialRow
      ? {
        label: partialRow.label,
        remaining: round2(partialRow.principal - partialRow.amount),
        payment: partialRow.payment,
        months: partialRow.payment > 0 ? Math.ceil((partialRow.principal - partialRow.amount) / partialRow.payment) : null,
        capitalToFinish: round2((result.allocated + (partialRow.principal - partialRow.amount)) / (1 - (t.openingFeePct || 0) / 100)),
      }
      : null;
    const monthlyDebtSteady = round2(monthlyDebtWithLoan - (partial ? partial.payment : 0));
    const dti = result.checks.find((check) => check.id === "ratio");
    return {
      ok: true,
      label,
      result,
      terms: t,
      insuranceMonthly: seguro,
      effectiveAnnualPct: effectiveAnnualPct(engine, t, seguro),
      loanPayment: round2(t.payment + seguro),
      loanCost: round2(t.totalCost + insuranceWithLoan),
      cancelled: result.allocated,
      leftover: result.leftover,
      monthlyDebtToday: result.todayPayment,
      monthlyDebtWithLoan,
      monthlyDelta: round2(monthlyDebtWithLoan - result.todayPayment),
      partial,
      monthlyDebtSteady,
      monthlyDeltaSteady: round2(monthlyDebtSteady - result.todayPayment),
      costToday: today ? today.totalCost : null,
      costWithLoan,
      impactCost,
      impactMonths,
      monthsWithLoan: comparable(withLoan) ? withLoan.monthsToDebtFree : null,
      debtFreeWithLoan: comparable(withLoan) ? withLoan.debtFreeMonthKey : null,
      monthsAggressive: comparable(aggressive) ? aggressive.monthsToDebtFree : null,
      debtFreeAggressive: comparable(aggressive) ? aggressive.debtFreeMonthKey : null,
      costAggressive,
      costSameEffort: sameEffort ? sameEffort.totalCost : null,
      monthsSameEffort: comparable(sameEffort) ? sameEffort.monthsToDebtFree : null,
      dtiPct: dti ? dti.dtiPct : null,
      checksPassed: result.checksPassed,
      checksTotal: result.checks.length,
      failedChecks: result.checks.filter((check) => !check.pass).map((check) => check.title),
    };
  }

  /** Quién gana un criterio: «a», «b», «empate» o null si alguna cifra falta. `lower`: menos es mejor. */
  function winner(a, b, lower = true, tie = TIE_EUROS) {
    if (!finite(a) || !finite(b)) return null;
    if (Math.abs(a - b) < tie) return "empate";
    return (lower ? a < b : a > b) ? "a" : "b";
  }

  const CRITERIA = [
    { id: "costeConPrestamo", title: "Lo que pagáis en intereses, comisiones y seguros hasta la deuda cero (solo cuotas)", key: "costWithLoan", lower: true, unit: "€" },
    { id: "cuotaDeudas", title: "Lo que pagáis en deudas cada mes (acabado lo que quede a medias)", key: "monthlyDebtSteady", lower: true, unit: "€" },
    { id: "costePrestamo", title: "Lo que cuesta el préstamo (intereses, apertura y seguros)", key: "loanCost", lower: true, unit: "€" },
    { id: "costeEfectivo", title: "Coste efectivo anual (TAE con seguros)", key: "effectiveAnnualPct", lower: true, unit: "%", tie: 0.05 },
    { id: "deudaCero", title: "Tiempo hasta la deuda cero (solo cuotas)", key: "monthsWithLoan", lower: true, unit: "meses", tie: 1 },
    { id: "agresivo", title: "Tiempo hasta la deuda cero con el plan agresivo", key: "monthsAggressive", lower: true, unit: "meses", tie: 1 },
  ];

  /**
   * Compara dos ofertas sobre las mismas deudas y los mismos supuestos.
   * @param {Array<Record<string, any>>} contracts filas canónicas de contrato (las de la pestaña)
   * @param {Record<string, any>} baseOptions las opciones de `plan` salvo `loan` y `earlyFeePct` (mes, selección, extra, ingresos…)
   * @param {Array<{label?: string, capital: number, months: number, tinPct: number, openingFeePct?: number, earlyFeePct?: number,
   *          insuranceMonthly?: number}>} offers exactamente dos
   * @param {{engine?: object}} [deps]
   */
  function compare(contracts, baseOptions, offers, deps = {}) {
    const engine = planEngine(deps.engine);
    if (!engine) return { ok: false, error: "Falta el cálculo del préstamo." };
    if (!Array.isArray(offers) || offers.length !== 2) return { ok: false, error: "Hacen falta dos ofertas." };
    const labels = offers.map((offer, index) => String(offer?.label || "").trim().slice(0, 40) || (index === 0 ? "Oferta A" : "Oferta B"));
    const [a, b] = offers.map((offer, index) => evaluate(engine, contracts, baseOptions, offer || {}, labels[index]));
    if (!a.ok || !b.ok) {
      const bad = !a.ok ? a : b;
      return { ok: false, offer: !a.ok ? "a" : "b", field: bad.field, error: `${bad.label}: ${bad.error}` };
    }
    const criteria = CRITERIA.map((criterion) => {
      const va = a[criterion.key];
      const vb = b[criterion.key];
      const tie = criterion.tie ?? TIE_EUROS;
      const win = winner(va, vb, criterion.lower, tie);
      return { id: criterion.id, title: criterion.title, unit: criterion.unit, a: va, b: vb, winner: win, diff: finite(va) && finite(vb) ? round2(Math.abs(va - vb)) : null };
    });
    return { ok: true, schemaId: SCHEMA_ID, a, b, criteria, verdict: verdictOf(a, b, criteria) };
  }

  /** La recomendación, con su porqué. El criterio principal: lo que pagáis en total pagando solo las cuotas. */
  function verdictOf(a, b, criteria) {
    // Sin nada que cancelar, el préstamo es dinero por el que se pagan intereses y que no va a la deuda: no se compara como si sirviera.
    const noCancela = (offer) => `${offer.label} no cancela ninguna deuda${offer.result.selection === "manual" ? " de las elegidas" : ": ninguna de las vuestras es más cara que el préstamo"}.`;
    const usable = [a, b].filter((offer) => offer.cancelled > 0);
    if (!usable.length) {
      return {
        recommended: null,
        tone: "aviso",
        lines: [noCancela(a), noCancela(b), "Pedir cualquiera de las dos sería pagar intereses por un dinero que no se usa para la deuda. Si aun así queréis compararlas, elegid a mano en «Qué cancela» qué deudas pagar con el préstamo."],
      };
    }
    if (usable.length === 1) {
      const only = usable[0];
      const other = only === a ? b : a;
      const linesOne = [noCancela(other), `Solo ${only.label} cancela deuda (${eur(only.cancelled)}).`];
      if (finite(only.impactCost)) linesOne.push(only.impactCost > TIE_EUROS ? `Frente a no pedir nada, os ahorra ${eur(only.impactCost)} hasta la deuda cero.` : `Frente a no pedir nada, os cuesta ${eur(-only.impactCost)} más hasta la deuda cero: lo que compra es una cuota más baja.`);
      if (only.failedChecks.length) linesOne.push(`Ojo con ${only.label}: no cumple «${only.failedChecks.join("», «")}».`);
      return { recommended: only === a ? "a" : "b", tone: only.impactCost > TIE_EUROS && !only.failedChecks.length ? "ok" : "aviso", lines: linesOne };
    }
    const byId = Object.fromEntries(criteria.map((c) => [c.id, c]));
    const total = byId.costeConPrestamo;
    const monthly = byId.cuotaDeudas;
    const lines = [];
    const savers = [a, b].filter((offer) => finite(offer.impactCost) && offer.impactCost > TIE_EUROS);
    let recommended = null;
    let tone = "neutro";
    if (total.winner === "a" || total.winner === "b") {
      const best = total.winner === "a" ? a : b;
      const other = best === a ? b : a;
      recommended = total.winner;
      lines.push(`${best.label} es la más barata en total: ${eur(total.diff)} menos que ${other.label} hasta la deuda cero, con intereses, comisiones y seguros.`);
      if (monthly.winner && monthly.winner !== "empate" && monthly.winner !== total.winner) {
        const cheaperMonthly = monthly.winner === "a" ? a : b;
        lines.push(`${cheaperMonthly.label} deja la cuota de deudas más baja: ${eur(monthly.diff)} menos al mes. Es la que da más aire, pero cuesta más al final.`);
      }
    } else if (total.winner === "empate") {
      lines.push("Las dos cuestan casi lo mismo en total.");
      if (monthly.winner === "a" || monthly.winner === "b") {
        recommended = monthly.winner;
        const best = monthly.winner === "a" ? a : b;
        lines.push(`${best.label} deja la cuota de deudas más baja: ${eur(monthly.diff)} menos al mes.`);
      }
    } else {
      lines.push("Alguna de las dos no acaba dentro del horizonte: no se puede decir cuál cuesta menos en total.");
    }
    if (!savers.length) {
      tone = "aviso";
      lines.push("Ninguna de las dos os ahorra frente a no pedir nada: lo que compran es una cuota más baja, no un ahorro. Si la cuota de hoy se puede pagar, no pedir es lo más barato.");
    } else if (savers.length === 1) {
      lines.push(`Solo ${savers[0].label} os ahorra frente a no pedir nada.`);
      if (recommended && (recommended === "a" ? a : b) !== savers[0]) tone = "aviso";
      else tone = "ok";
    } else {
      tone = "ok";
    }
    [a, b].forEach((offer) => {
      if (offer.partial) lines.push(`${offer.label} deja ${offer.partial.label} a medias (quedan ${eur(offer.partial.remaining)} con su cuota de ${eur(offer.partial.payment)}${offer.partial.months ? ` durante ${offer.partial.months} ${offer.partial.months === 1 ? "mes" : "meses"}` : ""}): pidiendo unos ${eur(Math.ceil(offer.partial.capitalToFinish / 100) * 100)} la cancelaría entera.`);
    });
    const pick = recommended === "a" ? a : recommended === "b" ? b : null;
    if (pick && pick.failedChecks.length) {
      tone = "aviso";
      lines.push(`Ojo con ${pick.label}: no cumple «${pick.failedChecks.join("», «")}».`);
    }
    return { recommended, tone, lines };
  }

  return { SCHEMA_ID, INSURANCE_MAX, compare, evaluate, winner, eur };
});
