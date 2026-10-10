(function attachCanonicalNextEuro(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalNextEuro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalNextEuroFactory() {
  "use strict";

  // WP-42 (CAR-03 + NIN-05 + NIN-08, docs/WP42_DISENO.md): la escalera del próximo euro. Dado un importe, dice en qué orden se llena cada peldaño y qué beneficio
  // esperado y qué coste de liquidez tiene cada uno:
  //   1 colchón → 2 deuda con coste neto alto → 3 plan de pensiones (si el tipo marginal lo justifica) → 4 amortizar o invertir lo que sobra.
  // Dentro de invertir, `contributionRebalance` reparte por APORTACIONES (sin vender nada) hacia lo que está por debajo de su objetivo.
  // Motor puro: ni DOM, ni red, ni almacenamiento; recibe cifras ya calculadas por los motores que existen (colchón, contratos, simulador de pensiones, cartera).
  // NUNCA mueve dinero (A11-4): propone un reparto.
  //
  // Reglas de honestidad:
  //   · dato ausente no es cero: sin liquidez o sin suelo del colchón no se sabe si hay hueco → el peldaño 1 dice «no sé» y el resultado queda «parcial».
  //   · sin rentabilidad esperada declarada no hay veredicto entre amortizar e invertir: lo que sobra queda «sin reparto», nunca un 50/50 inventado.
  //   · el beneficio de amortizar es CIERTO (intereses que no pagas); el de invertir es ESPERADO (puede salir negativo) y el de la pensión es un ahorro fiscal DE UNA VEZ
  //     que difiere el impuesto, no lo elimina. Se guardan en campos distintos y no se suman como si fueran lo mismo.
  //   · el orden es el del plan; si un peldaño posterior rinde más el primer año que uno anterior, se AVISA, no se reordena en silencio.

  const SCHEMA_ID = "finance-next-euro/v1";
  // Decisiones mías, declaradas y sobrescribibles por parámetro (docs/WP42_DISENO.md §3).
  const DEFAULT_RISK_PREMIUM_PCT = 2; // invertir solo gana a amortizar si rinde al menos 2 puntos más (neto) que la deuda: lo uno es cierto y lo otro no.
  const DEFAULT_HIGH_COST_APR_PCT = 6; // «coste alto» cuando no hay rentabilidad esperada con la que comparar.
  const DEFAULT_MIN_MARGINAL_PCT = 30; // por debajo de este tipo marginal, el ahorro fiscal de la pensión no compensa inmovilizar el dinero.
  // Límite general de aportación individual deducible a planes de pensiones, por año fiscal (el mismo criterio que canonical-pension-simulator.js; verificable en la AEAT).
  const PENSION_LIMITS = Object.freeze([{ year: 2022, limit: 1500 }]);

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();

  /** @param {number} year */
  function pensionLimitForYear(year) {
    const rows = PENSION_LIMITS.filter((row) => row.year <= number(year));
    return rows.length ? rows[rows.length - 1].limit : null;
  }

  /**
   * Reparto de una aportación SIN vender: hacia los tipos que están por debajo de su objetivo, en proporción a lo que les falta. Si lo que falta suma menos que lo que
   * se aporta, el resto se reparte según el objetivo para no desviar más la cartera. Sin objetivos (o que no suman nada) no hay reparto.
   * @param {{totalsByType?: Record<string, number>, targets?: Record<string, number>, amount?: number}} [params]
   */
  function contributionRebalance({ totalsByType = {}, targets = {}, amount = 0 } = {}) {
    const add = Math.max(0, round2(amount));
    /** @type {Array<[string, number]>} */
    const entries = Object.entries(targets || {}).filter(([, pct]) => known(pct) && number(pct) > 0).map(([type, pct]) => /** @type {[string, number]} */ ([type, number(pct)]));
    const targetSum = entries.reduce((sum, [, pct]) => sum + pct, 0);
    if (!(add > 0) || !entries.length || !(targetSum > 0)) return { calculable: false, reason: !(add > 0) ? "missing-amount" : "missing-targets", rows: [] };
    const current = (type) => Math.max(0, number(totalsByType[type]));
    const total = Object.values(totalsByType || {}).reduce((sum, value) => sum + Math.max(0, number(value)), 0);
    const after = total + add;
    const deficits = entries.map(([type, pct]) => ({ type, pct, deficit: Math.max(0, ((pct / targetSum) * after) - current(type)) }));
    const deficitSum = deficits.reduce((sum, row) => sum + row.deficit, 0);
    let rows;
    if (deficitSum <= 0) {
      rows = deficits.map((row) => ({ type: row.type, amount: add * (row.pct / targetSum) }));
    } else if (deficitSum >= add) {
      rows = deficits.map((row) => ({ type: row.type, amount: add * (row.deficit / deficitSum) }));
    } else {
      const left = add - deficitSum;
      rows = deficits.map((row) => ({ type: row.type, amount: row.deficit + left * (row.pct / targetSum) }));
    }
    const out = rows.map((row) => {
      const pct = entries.find(([type]) => type === row.type)?.[1] ?? 0;
      return {
        type: row.type,
        amount: round2(row.amount),
        targetPct: round2((pct / targetSum) * 100),
        currentPct: after > 0 ? round2((current(row.type) / (total || 1)) * 100) : 0,
        afterPct: after > 0 ? round2(((current(row.type) + row.amount) / after) * 100) : 0,
      };
    }).filter((row) => row.amount > 0);
    // El redondeo no puede perder ni inventar céntimos: la diferencia va al peldaño mayor.
    const drift = round2(add - out.reduce((sum, row) => sum + row.amount, 0));
    if (out.length && drift !== 0) {
      const biggest = out.reduce((best, row) => (row.amount > best.amount ? row : best), out[0]);
      biggest.amount = round2(biggest.amount + drift);
    }
    return { calculable: true, rows: out, untargeted: Object.keys(totalsByType || {}).filter((type) => !entries.some(([t]) => t === type) && current(type) > 0) };
  }

  /**
   * @param {{
   *   amount?: number, amountInAccounts?: boolean, liquidity?: number|null, floor?: number|null,
   *   debts?: Array<{id?: string, entity?: string, currentPrincipal?: number, effectiveAprPct?: number|null, rateSource?: string}>,
   *   investment?: {expectedReturnPct?: number|null, savingsTaxPct?: number|null, source?: string|null, riskPremiumPct?: number},
   *   pension?: {year?: number, alreadyContributed?: number|null, marginalRatePct?: number|null, minMarginalPct?: number},
   *   portfolio?: {totalsByType?: Record<string, number>, targets?: Record<string, number>}|null,
   *   highCostAprPct?: number
   * }} [params]
   */
  function buildLadder({ amount = 0, amountInAccounts = false, liquidity = null, floor = null, debts = [], investment = {}, pension = {}, portfolio = null, highCostAprPct = DEFAULT_HIGH_COST_APR_PCT } = {}) {
    const total = Math.max(0, round2(amount));
    if (!(total > 0)) return { schemaId: SCHEMA_ID, status: "invalid", reason: "Falta el importe: escribe cuánto dinero hay que colocar.", rungs: [], allocated: 0, unassigned: 0 };
    const notes = [];
    const missing = [];
    let remaining = total;
    /** @type {Array<Record<string, any>>} */
    const rungs = [];

    // ── Peldaño 1 · colchón ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const haveCushion = known(liquidity) && known(floor);
    let toCushion = 0;
    if (!haveCushion) {
      missing.push(!known(liquidity) ? "la liquidez de las cuentas" : "el suelo del colchón");
      rungs.push({ id: "cushion", label: "Colchón", status: "no-data", amount: 0, reasons: ["No sé si el colchón está completo: faltan " + missing.join(" y ") + ". El resto del reparto asume que sí lo está y puede equivocarse."], liquidity: "Siempre disponible", certainty: "cierto" });
    } else {
      const liq = number(liquidity);
      const flr = number(floor);
      toCushion = amountInAccounts
        ? total - Math.min(total, Math.max(0, liq - flr))
        : Math.min(total, Math.max(0, flr - liq));
      toCushion = round2(toCushion);
      const gap = round2(Math.max(0, flr - liq));
      rungs.push({
        id: "cushion", label: "Colchón", status: toCushion > 0 ? "ok" : "skipped", amount: toCushion,
        reasons: toCushion > 0
          ? [amountInAccounts
            ? `La liquidez (${round2(liq)} €) deja libres solo ${round2(total - toCushion)} € por encima del suelo (${round2(flr)} €): el resto se queda donde está.`
            : `Faltan ${round2(Math.max(0, flr - liq))} € para el suelo del colchón (${round2(flr)} €): lo primero es llegar ahí.`]
          : ["El colchón ya está por encima de su suelo: no hace falta reforzarlo con este dinero."],
        liquidity: "Siempre disponible", certainty: "cierto", gap,
      });
      remaining = round2(total - toCushion);
    }

    // ── Rentabilidad neta esperada de invertir (referencia para los peldaños 2 y 4) ─────────────────────────────────────────────────────────────────
    const expected = investment && known(investment.expectedReturnPct) ? number(investment.expectedReturnPct) : null;
    const taxKnown = investment && known(investment.savingsTaxPct) && number(investment.savingsTaxPct) > 0 && number(investment.savingsTaxPct) < 100;
    const netInvest = expected === null ? null : round2(taxKnown ? expected * (1 - number(investment.savingsTaxPct) / 100) : expected);
    if (expected !== null && !taxKnown) notes.push("Sin el tipo del ahorro, la rentabilidad esperada se compara ANTES de impuestos: invertir queda mejor parado de lo que estará.");
    if (expected !== null && investment && investment.source === "historical") notes.push("La rentabilidad esperada sale de lo que ya rindió vuestra cartera: es pasado, no una promesa.");
    const premium = investment && known(investment.riskPremiumPct) ? Math.max(0, number(investment.riskPremiumPct)) : DEFAULT_RISK_PREMIUM_PCT;
    const hurdle = netInvest === null ? number(highCostAprPct, DEFAULT_HIGH_COST_APR_PCT) : Math.max(0, round2(netInvest - premium));

    // ── Peldaño 2 · deuda con coste neto alto ──────────────────────────────────────────────────────────────────────────────────────────────────────
    const owed = (Array.isArray(debts) ? debts : []).filter((debt) => number(debt.currentPrincipal) > 0);
    // Una deuda SIN coste declarado no es una deuda gratis: se aparta y se dice (dato ausente no es cero). Un 0 % declarado sí es un coste conocido.
    const unknownRate = owed.filter((debt) => !known(debt.effectiveAprPct)).map((debt) => ({ id: text(debt.id), entity: text(debt.entity) || "Deuda", principal: round2(number(debt.currentPrincipal)) }));
    if (unknownRate.length) missing.push(`el interés de ${unknownRate.map((debt) => debt.entity).join(", ")}`);
    const activeDebts = owed.filter((debt) => known(debt.effectiveAprPct) && number(debt.effectiveAprPct) > 0)
      .map((debt) => ({ id: text(debt.id), entity: text(debt.entity) || "Deuda", principal: number(debt.currentPrincipal), apr: number(debt.effectiveAprPct), implied: debt.rateSource === "implied" }))
      .sort((a, b) => b.apr - a.apr);
    const debtLines = [];
    let debtTotal = 0;
    let debtBenefit = 0;
    activeDebts.filter((debt) => debt.apr > hurdle).forEach((debt) => {
      if (remaining <= 0) return;
      const paid = round2(Math.min(remaining, debt.principal));
      debtLines.push({ id: debt.id, entity: debt.entity, amount: paid, aprPct: debt.apr, rateImplied: debt.implied, liquidatesIt: paid >= debt.principal, interestSavedPerYear: round2(paid * debt.apr / 100) });
      remaining = round2(remaining - paid);
      debtTotal = round2(debtTotal + paid);
      debtBenefit = round2(debtBenefit + paid * debt.apr / 100);
    });
    const debtReason = [];
    if (!owed.length) debtReason.push("No hay deudas con saldo pendiente en Contratos.");
    else if (!activeDebts.length && !unknownRate.length) debtReason.push("Las deudas que hay no cobran interés: no hay ahorro en amortizarlas antes.");
    else if (!debtLines.length) debtReason.push(netInvest === null
      ? `Ninguna deuda pasa del ${hurdle} % de coste efectivo (umbral que uso mientras no declares una rentabilidad esperada).`
      : `Ninguna deuda cuesta más que el ${hurdle} % (la rentabilidad neta esperada de invertir, ${netInvest} %, menos ${premium} puntos de prima por riesgo).`);
    else debtReason.push(`Se paga primero la de mayor coste efectivo (después de la deducción fiscal), hasta liquidarla.`);
    if (unknownRate.length) debtReason.push(`${unknownRate.length === 1 ? "Una deuda" : `${unknownRate.length} deudas`} sin interés declarado (${unknownRate.map((debt) => `${debt.entity}: ${debt.principal} €`).join("; ")}): no puedo decir si compensan amortizarlas antes que invertir. Declara su TAE en Deuda › Contratos.`);
    if (debtLines.some((line) => line.rateImplied)) debtReason.push("Para alguna deuda el coste es el IMPLÍCITO en su cuota y sus plazos (no un TIN declarado): es una estimación.");
    if (debtLines.length) debtReason.push("Amortizar es un rendimiento CIERTO: son intereses que dejas de pagar. No se descuenta ninguna comisión de amortización anticipada porque no la conozco por contrato: compruébala antes.");
    rungs.push({ id: "debt", label: "Deuda con coste alto", status: debtLines.length ? "ok" : unknownRate.length ? "no-data" : "skipped", amount: debtTotal, lines: debtLines, unknownRate, reasons: debtReason, liquidity: "Pierdes liquidez: el dinero amortizado solo vuelve pidiendo crédito de nuevo.", certainty: "cierto", annualBenefit: debtBenefit });

    // ── Peldaño 3 · plan de pensiones ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const year = known(pension?.year) ? number(pension.year) : null;
    const limit = year === null ? null : pensionLimitForYear(year);
    const marginal = known(pension?.marginalRatePct) && number(pension.marginalRatePct) > 0 ? number(pension.marginalRatePct) : null;
    const minMarginal = known(pension?.minMarginalPct) ? number(pension.minMarginalPct) : DEFAULT_MIN_MARGINAL_PCT;
    const already = known(pension?.alreadyContributed) ? Math.max(0, number(pension.alreadyContributed)) : null;
    const room = limit === null ? null : round2(Math.max(0, limit - (already ?? 0)));
    let pensionAmount = 0;
    let pensionStatus = "skipped";
    const pensionReasons = [];
    if (limit === null) { pensionStatus = "no-data"; pensionReasons.push(year === null ? "No sé en qué año fiscal estamos." : `No tengo el límite de aportación del año ${year}.`); }
    else if (marginal === null) { pensionStatus = "no-data"; pensionReasons.push("No sé vuestro tipo marginal (la retención declarada en Ajustes › Fiscal): sin él no puedo decir si el ahorro fiscal compensa."); missing.push("el tipo marginal"); }
    else if (marginal < minMarginal) pensionReasons.push(`Con un tipo marginal del ${marginal} % (por debajo del ${minMarginal} % que uso como mínimo) el ahorro fiscal no compensa inmovilizar el dinero hasta la jubilación.`);
    else if (room <= 0) pensionReasons.push(`El límite de ${limit} € de ${year} ya está aprovechado.`);
    else if (remaining <= 0) pensionReasons.push("No queda dinero tras los peldaños anteriores.");
    else {
      pensionAmount = round2(Math.min(remaining, room));
      pensionStatus = "ok";
      remaining = round2(remaining - pensionAmount);
      pensionReasons.push(`Tipo marginal ${marginal} % ≥ ${minMarginal} %. Cabe hasta ${room} € este año (límite ${limit} €${already === null ? ", sin descontar lo que ya hayáis aportado: no lo sé" : `, ya aportado ${already} €`}).`);
      if (already === null) notes.push("No sé cuánto habéis aportado ya este año a planes de pensiones: si ya llegasteis al límite, este peldaño sobra.");
    }
    const taxSaving = pensionAmount > 0 && marginal !== null ? round2(pensionAmount * marginal / 100) : 0;
    if (pensionAmount > 0) pensionReasons.push("El ahorro fiscal es DE UNA VEZ y difiere el impuesto, no lo elimina: el rescate tributa como rendimiento del trabajo. El plan límite es el general individual; las aportaciones de empresa tienen su propio margen.");
    rungs.push({ id: "pension", label: "Plan de pensiones", status: pensionStatus, amount: pensionAmount, reasons: pensionReasons, liquidity: "Inmovilizado hasta la jubilación (salvo supuestos tasados de rescate).", certainty: "fiscal", oneOffTaxSaving: taxSaving, limit, room });

    // ── Peldaño 4 · amortizar o invertir lo que sobra ────────────────────────────────────────────────────────────────────────────────────────────
    let toInvest = 0;
    let unassigned = 0;
    const lastReasons = [];
    let split = null;
    if (remaining > 0) {
      if (netInvest === null) {
        unassigned = remaining;
        lastReasons.push(`Quedan ${remaining} € sin reparto: sin una rentabilidad esperada de invertir no hay veredicto entre amortizar el resto de la deuda e invertir, y no voy a inventar un 50/50. Escríbela abajo.`);
      } else {
        toInvest = remaining;
        const cheapest = activeDebts.filter((debt) => debt.apr <= hurdle).sort((a, b) => b.apr - a.apr)[0];
        lastReasons.push(cheapest
          ? `Invertir (esperado ${netInvest} % neto) supera con margen a la deuda más cara que queda (${cheapest.entity}, ${cheapest.apr} %): ${premium} puntos de prima por riesgo exigidos.`
          : `No queda deuda con interés conocido a la que destinarlo: se invierte (rentabilidad esperada ${netInvest} % neta, no garantizada).`);
        if (unknownRate.length) lastReasons.push("Ojo: antes de invertir, mira las deudas sin interés declarado de arriba; si alguna es cara, amortizarla puede rendir más que esto.");
        if (portfolio && portfolio.targets) {
          split = contributionRebalance({ totalsByType: portfolio.totalsByType || {}, targets: portfolio.targets, amount: toInvest });
          if (!split.calculable) lastReasons.push("Sin objetivos por tipo de activo no puedo repartirlo entre fondos o renta fija: fíjalos en Rebalanceo.");
        } else lastReasons.push("Sin objetivos por tipo de activo no puedo repartirlo entre fondos o renta fija: fíjalos en Rebalanceo.");
      }
    } else lastReasons.push("No queda dinero tras los peldaños anteriores.");
    rungs.push({
      id: "invest", label: "Invertir lo que sobra", status: toInvest > 0 ? "ok" : unassigned > 0 ? "no-verdict" : "skipped", amount: toInvest, unassigned, reasons: lastReasons, split,
      liquidity: "Depende del producto; se puede vender, con impuestos sobre la plusvalía.", certainty: "esperado", expectedAnnualBenefit: netInvest === null ? null : round2(toInvest * netInvest / 100),
    });

    // Aviso, sin reordenar: un peldaño posterior que rinde más el primer año que uno anterior.
    if (pensionAmount > 0 && debtLines.length) {
      const worstDebt = debtLines[debtLines.length - 1];
      if (marginal !== null && marginal > worstDebt.aprPct) notes.push(`Ojo: la pensión ahorra un ${marginal} % de impuestos el primer año, más que el ${worstDebt.aprPct} % de ${worstDebt.entity}. Se sigue el orden del plan (deuda antes), pero la pensión inmoviliza el dinero y tributa al rescatarlo: es una decisión, no un error.`);
    }

    const allocated = round2(rungs.reduce((sum, rung) => sum + number(rung.amount), 0));
    return {
      schemaId: SCHEMA_ID,
      status: missing.length ? "partial" : "ok",
      missing,
      amount: total,
      allocated,
      unassigned: round2(unassigned),
      hurdlePct: hurdle,
      netInvestPct: netInvest,
      rungs,
      notes,
      certainAnnualBenefit: debtBenefit,
      expectedAnnualBenefit: rungs[3].expectedAnnualBenefit,
      oneOffTaxSaving: taxSaving,
    };
  }

  return { SCHEMA_ID, DEFAULT_RISK_PREMIUM_PCT, DEFAULT_HIGH_COST_APR_PCT, DEFAULT_MIN_MARGINAL_PCT, PENSION_LIMITS, pensionLimitForYear, contributionRebalance, buildLadder };
});
