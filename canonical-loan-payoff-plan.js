/**
 * canonical-loan-payoff-plan.js
 *
 * Deuda › Préstamo para saldar (14/11/2026, petición del hogar): pedir un préstamo personal (lo solicitaría un miembro del hogar)
 * para cancelar las deudas más caras y, con lo que se libera, saldarlo todo a un ritmo agresivo. Responde a tres preguntas:
 *
 *   1. ¿Qué préstamo es? Cuota francesa, intereses, total adeudado y TAE (con la comisión de apertura, como TIR mensual anualizada:
 *      16.500 € a 72 meses al 8,50 % TIN sin comisión → 293,34 €, 4.620,48 € de intereses, TAE 8,84 %, igual que el simulador del banco).
 *   2. ¿Qué cancela? Con la selección automática, las deudas MÁS CARAS QUE EL PRÉSTAMO, de la TAE más alta a la más baja, hasta agotar
 *      el dinero neto (capital menos comisión); la última puede quedar cancelada en parte (se conserva su cuota y se acorta su plazo).
 *      Con la selección a mano, las elegidas, en el mismo orden. Lo que sobra se dice (y cuánto bastaría pedir).
 *   3. ¿Merece la pena? Cuatro caminos con el MISMO motor que «Camino a deuda cero» (canonical-debt-payoff-path.js):
 *        · hoy: las deudas como están, sin extra;
 *        · con préstamo: la cartera tras cancelar, con la cuota nueva, sin extra;
 *        · plan agresivo: la cartera tras cancelar pagando lo mismo que hoy (si se pide) + el extra, con las cuotas que se liberan
 *          redirigidas a la siguiente deuda (bola de nieve, en orden de TAE);
 *        · mismo esfuerzo sin préstamo: las deudas de hoy con el mismo dinero al mes que el plan agresivo, también en bola de nieve.
 *      El último es la comparación honesta: si el préstamo no adelanta la deuda cero ni ahorra intereses frente a pagar lo mismo sin
 *      pedirlo, lo que aporta es solo una cuota más baja, y se dice.
 *
 * Reglas de honestidad: dato ausente no es cero (sin ingresos no se juzga el ratio de deuda; una deuda sin cuota activa no entra en
 * «hoy» y se lista), la comisión de amortización anticipada solo se cuenta si se declara, y nada de esto pide, firma ni escribe
 * nada (A11-4). Motor puro: sin DOM, red ni almacenamiento.
 */
(function attachCanonicalLoanPayoffPlan(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLoanPayoffPlan = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalLoanPayoffPlanFactory(root) {
  "use strict";

  const SCHEMA_ID = "finance-loan-payoff-plan/v1";
  const LOAN_ID = "prestamo-nuevo";
  const DEFAULTS = Object.freeze({ capital: 16500, months: 72, tinPct: 8.5, openingFeePct: 0, earlyFeePct: 0, extraMonthly: 0, keepPaying: true, maxTermMonths: 60, maxDebtToIncomePct: 35 });
  const LIMITS = Object.freeze({ capitalMin: 500, capitalMax: 200000, monthsMin: 3, monthsMax: 120, tinMax: 30, feeMax: 10, earlyFeeMax: 5, extraMax: 100000 });
  const FULL_TOLERANCE = 0.5;
  const MORTGAGE = /hipotec|mortgage|vivienda/i;
  const REVOLVING = /tarjeta|revolving|cr[eé]dito\s*(?:al\s*)?consumo|l[ií]nea|visa|mastercard|aplazad/i;

  function payoffEngine() {
    if (root && root.FinanceCanonicalDebtPayoffPath) return root.FinanceCanonicalDebtPayoffPath;
    if (typeof require === "function") return require("./canonical-debt-payoff-path.js");
    return null;
  }

  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

  /** Cuota francesa con el TIN mensual; con TIN 0 %, capital entre plazo. */
  function frenchPayment(capital, months, tinPct) {
    const rate = tinPct / 100 / 12;
    if (rate === 0) return capital / months;
    return (capital * rate) / (1 - Math.pow(1 + rate, -months));
  }

  /** TIR mensual que iguala lo recibido (`net`) con `months` cuotas de `payment`. Bisección. */
  function monthlyIrr(net, payment, months) {
    if (!(net > 0) || !(payment > 0) || !(months > 0)) return null;
    if (payment * months <= net) return 0;
    const pv = (rate) => (rate === 0 ? payment * months : (payment * (1 - Math.pow(1 + rate, -months))) / rate);
    let low = 0;
    let high = 1;
    for (let step = 0; step < 200; step += 1) {
      const mid = (low + high) / 2;
      if (pv(mid) > net) low = mid; else high = mid;
    }
    return (low + high) / 2;
  }

  /**
   * Las condiciones del préstamo, como las da un simulador bancario (cuota redondeada al céntimo, intereses = cuota × plazo − capital).
   * @param {{capital?: number, months?: number, tinPct?: number, openingFeePct?: number}} input
   */
  function loanTerms(input = {}) {
    const capital = Number(input.capital);
    const months = Number(input.months);
    const tinPct = Number(input.tinPct);
    const openingFeePct = finite(input.openingFeePct) ? Number(input.openingFeePct) : 0;
    if (!Number.isFinite(capital) || capital < LIMITS.capitalMin || capital > LIMITS.capitalMax) {
      return { ok: false, field: "capital", error: `El capital tiene que estar entre ${LIMITS.capitalMin} € y ${LIMITS.capitalMax} €.` };
    }
    if (!Number.isInteger(months) || months < LIMITS.monthsMin || months > LIMITS.monthsMax) {
      return { ok: false, field: "months", error: `El plazo tiene que ser un número entero de meses entre ${LIMITS.monthsMin} y ${LIMITS.monthsMax}.` };
    }
    if (!Number.isFinite(tinPct) || tinPct < 0 || tinPct > LIMITS.tinMax) {
      return { ok: false, field: "tinPct", error: `El TIN tiene que estar entre 0 % y ${LIMITS.tinMax} %.` };
    }
    if (!Number.isFinite(openingFeePct) || openingFeePct < 0 || openingFeePct > LIMITS.feeMax) {
      return { ok: false, field: "openingFeePct", error: `La comisión de apertura tiene que estar entre 0 % y ${LIMITS.feeMax} %.` };
    }
    const payment = round2(frenchPayment(capital, months, tinPct));
    const totalOwed = round2(payment * months);
    const totalInterest = round2(totalOwed - capital);
    const openingFee = round2((capital * openingFeePct) / 100);
    const netFunds = round2(capital - openingFee);
    const irr = monthlyIrr(netFunds, payment, months);
    const taePct = irr === null ? null : round2((Math.pow(1 + irr, 12) - 1) * 100);
    return {
      ok: true,
      capital: round2(capital),
      months,
      tinPct,
      openingFeePct,
      payment,
      totalInterest,
      openingFee,
      totalCost: round2(totalInterest + openingFee),
      totalOwed,
      netFunds,
      taePct,
    };
  }

  function contractLabel(contract) {
    const named = [contract.entity, contract.type].filter(Boolean).join(" ").trim();
    return named || contract.label || contract.id || "Deuda";
  }

  /** Las deudas que se podrían cancelar: las que el motor de «Camino» proyecta (con TAE) y las que tienen capital pero no cuota activa. */
  function candidatesOf(contracts, startMonthKey) {
    const engine = payoffEngine();
    const base = engine.project(contracts, { startMonthKey, extraMonthly: 0 });
    if (!base.ok) return { base, rows: [] };
    const byId = new Map((Array.isArray(contracts) ? contracts : []).map((contract) => [String(contract.id || ""), contract]));
    const rows = base.included.map((row) => ({
      id: row.id,
      label: row.label,
      principal: row.principal,
      payment: row.payment,
      aprPct: row.aprPct,
      rateSource: row.rateSource,
      projected: true,
      revolving: REVOLVING.test(`${byId.get(row.id)?.type || ""} ${byId.get(row.id)?.entity || ""}`),
    }));
    base.excluded.forEach((row) => {
      const contract = byId.get(row.id) || {};
      const apr = finite(contract.apr) ? Number(contract.apr) : null;
      rows.push({ id: row.id, label: row.label, principal: row.principal, payment: 0, aprPct: apr, rateSource: apr === null ? null : "declared", projected: false, reason: row.reason, revolving: REVOLVING.test(`${contract.type || ""} ${contract.entity || ""}`) });
    });
    rows.sort((a, b) => (b.aprPct ?? -1) - (a.aprPct ?? -1) || a.principal - b.principal || a.id.localeCompare(b.id));
    return { base, rows };
  }

  /** Reparte el dinero neto entre las deudas elegidas, de la TAE más alta a la más baja. */
  function allocate(candidates, selection, netFunds, loanTaePct) {
    const manual = Array.isArray(selection);
    const chosen = manual
      ? candidates.filter((row) => selection.map(String).includes(row.id))
      : candidates.filter((row) => row.projected && row.aprPct !== null && loanTaePct !== null && row.aprPct > loanTaePct);
    let remaining = netFunds;
    const allocations = [];
    chosen.forEach((row) => {
      if (remaining <= 0) {
        allocations.push({ ...row, amount: 0, full: false, freedPayment: 0, unfunded: true });
        return;
      }
      const amount = round2(Math.min(remaining, row.principal));
      const full = amount >= row.principal - FULL_TOLERANCE;
      remaining = round2(remaining - amount);
      allocations.push({ ...row, amount, full, freedPayment: full ? row.payment : 0, unfunded: false, cheaperThanLoan: row.aprPct !== null && loanTaePct !== null && row.aprPct <= loanTaePct });
    });
    return { manual, allocations, leftover: Math.max(0, round2(remaining)) };
  }

  /** La cartera tras cancelar: sin las canceladas, con las parciales rebajadas (misma cuota, TAE fija) y con el préstamo nuevo. */
  function portfolioAfter(contracts, allocations, terms, holder) {
    const byId = new Map(allocations.filter((row) => row.amount > 0).map((row) => [row.id, row]));
    const after = [];
    (Array.isArray(contracts) ? contracts : []).forEach((contract) => {
      const allocation = byId.get(String(contract.id || ""));
      if (!allocation) {
        after.push(contract);
        return;
      }
      if (allocation.full) return;
      after.push({
        ...contract,
        currentPrincipal: round2(Number(contract.currentPrincipal) - allocation.amount),
        apr: allocation.aprPct,
        remainingInstallments: 0,
      });
    });
    after.push({
      id: LOAN_ID,
      entity: "Préstamo nuevo",
      type: holder ? `a nombre de ${holder}` : "personal",
      paymentStatus: "active",
      currentPrincipal: terms.capital,
      initialPrincipal: terms.capital,
      currentPayment: terms.payment,
      apr: terms.tinPct,
      remainingInstallments: terms.months,
    });
    return after;
  }

  function pathSummary(result, extraCosts = 0) {
    if (!result || !result.ok) return null;
    return {
      monthlyPayment: result.monthlyPayment,
      debtFreeMonthKey: result.debtFreeMonthKey,
      monthsToDebtFree: result.monthsToDebtFree,
      totalInterest: result.totalInterest,
      totalCost: round2(result.totalInterest + extraCosts),
      beyondHorizon: result.beyondHorizon,
      complete: result.complete,
      excludedPrincipal: result.excludedPrincipal,
      milestones: result.milestones,
      series: result.series,
    };
  }

  /**
   * @param {Array<Record<string, any>>} allContracts filas canónicas de contrato (las mismas que lee «Camino a deuda cero»)
   * @param {{loan?: Record<string, any>, startMonthKey?: string, selection?: "auto"|string[], extraMonthly?: number, keepPaying?: boolean,
   *          earlyFeePct?: number, monthlyIncome?: number|null, maxTermMonths?: number, maxDebtToIncomePct?: number, holder?: string,
   *          includeMortgage?: boolean}} [options]
   */
  function plan(allContracts, options = {}) {
    const engine = payoffEngine();
    if (!engine) return { ok: false, error: "Falta el motor de «Camino a deuda cero»." };
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(options.startMonthKey || ""))) return { ok: false, error: "Falta el mes de partida." };
    const terms = loanTerms(options.loan || {});
    if (!terms.ok) return { ok: false, field: terms.field, error: terms.error };
    const extra = finite(options.extraMonthly) ? Number(options.extraMonthly) : 0;
    if (!(extra >= 0) || extra > LIMITS.extraMax) return { ok: false, field: "extraMonthly", error: "El extra al mes tiene que ser un importe de 0 € o más." };
    const earlyFeePct = finite(options.earlyFeePct) ? Number(options.earlyFeePct) : 0;
    if (!(earlyFeePct >= 0) || earlyFeePct > LIMITS.earlyFeeMax) return { ok: false, field: "earlyFeePct", error: `La comisión por amortizar antes tiene que estar entre 0 % y ${LIMITS.earlyFeeMax} %.` };
    const keepPaying = options.keepPaying !== false;
    const holder = String(options.holder || "").trim().slice(0, 40);
    const startMonthKey = options.startMonthKey;
    // La hipoteca, fuera por defecto: un préstamo personal no la cancela y, dentro, «deuda cero» sería su último recibo. Se dice.
    const includeMortgage = options.includeMortgage === true;
    const list = Array.isArray(allContracts) ? allContracts : [];
    const isMortgage = (contract) => MORTGAGE.test(`${contract?.type || ""} ${contract?.entity || ""} ${contract?.label || ""}`);
    const contracts = includeMortgage ? list : list.filter((contract) => !isMortgage(contract));
    const mortgagesLeftOut = includeMortgage ? [] : list.filter(isMortgage).map((contract) => ({ id: String(contract.id || ""), label: contractLabel(contract), principal: round2(Number(contract.currentPrincipal) || 0) }));

    const { base, rows: candidates } = candidatesOf(contracts, startMonthKey);
    if (!base.ok) return { ok: false, error: base.error };
    const selection = Array.isArray(options.selection) ? options.selection : "auto";
    const { manual, allocations, leftover } = allocate(candidates, selection, terms.netFunds, terms.taePct);
    const cancelled = allocations.filter((row) => row.amount > 0);
    const allocated = round2(cancelled.reduce((sum, row) => sum + row.amount, 0));
    const weightedAprPct = allocated > 0 && cancelled.every((row) => row.aprPct !== null)
      ? round2(cancelled.reduce((sum, row) => sum + row.aprPct * row.amount, 0) / allocated)
      : null;
    const freedPayments = round2(cancelled.reduce((sum, row) => sum + row.freedPayment, 0));
    // Lo que bastaría pedir para cancelar lo mismo: lo asignado más la comisión de apertura sobre ese capital.
    const capitalNeeded = leftover > 0 ? round2(allocated / (1 - terms.openingFeePct / 100)) : null;

    const after = portfolioAfter(contracts, allocations, terms, holder);
    const today = engine.project(contracts, { startMonthKey, extraMonthly: 0 });
    const withLoan = engine.project(after, { startMonthKey, extraMonthly: 0 });
    const todayPayment = today.ok ? today.monthlyPayment : 0;
    const withLoanPayment = withLoan.ok ? withLoan.monthlyPayment : 0;
    const keepExtra = keepPaying ? Math.max(0, round2(todayPayment - withLoanPayment)) : 0;
    const aggressiveExtra = round2(keepExtra + extra);
    const aggressive = engine.project(after, { startMonthKey, extraMonthly: aggressiveExtra, redirectFreed: true, strategy: "avalancha" });
    // Mismo dinero al mes que el plan agresivo, sin préstamo: lo de hoy más (lo que el agresivo paga por encima de lo de hoy).
    const sameEffortExtra = Math.max(0, round2(withLoanPayment + aggressiveExtra - todayPayment));
    const sameEffort = engine.project(contracts, { startMonthKey, extraMonthly: sameEffortExtra, redirectFreed: true, strategy: "avalancha" });

    const loanRow = aggressive.ok ? aggressive.included.find((row) => row.id === LOAN_ID) : null;
    const earlyRepaid = loanRow ? loanRow.extraApplied : 0;
    const earlyFee = round2((earlyRepaid * earlyFeePct) / 100);

    const paths = {
      today: pathSummary(today),
      withLoan: pathSummary(withLoan, terms.openingFee),
      aggressive: pathSummary(aggressive, terms.openingFee + earlyFee),
      sameEffort: pathSummary(sameEffort),
    };

    // Política de deuda: solo lo que se puede juzgar con datos. Lo que no, no se marca ni como cumplido ni como fallado.
    const checks = [];
    if (weightedAprPct !== null && terms.taePct !== null) {
      checks.push({
        id: "mas-barato",
        title: "El préstamo es más barato que lo que cancela",
        pass: weightedAprPct > terms.taePct,
        detail: `TAE ${String(terms.taePct).replace(".", ",")} % frente a ${String(weightedAprPct).replace(".", ",")} % de media en lo cancelado`,
      });
    }
    const maxTerm = finite(options.maxTermMonths) ? Number(options.maxTermMonths) : DEFAULTS.maxTermMonths;
    const shortTerms = terms.months > maxTerm ? loanTerms({ ...options.loan, months: maxTerm }) : null;
    checks.push({
      id: "plazo",
      title: `Plazo ≤ ${maxTerm / 12 === Math.round(maxTerm / 12) ? `${maxTerm / 12} años` : `${maxTerm} meses`} para consumo`,
      pass: terms.months <= maxTerm,
      detail: terms.months <= maxTerm ? `${terms.months} meses` : `${terms.months} meses · a ${maxTerm} la cuota sería ${shortTerms && shortTerms.ok ? shortTerms.payment : "—"} €`,
      fixMonths: terms.months > maxTerm ? maxTerm : null,
      fixPayment: shortTerms && shortTerms.ok ? shortTerms.payment : null,
    });
    if (paths.today && paths.withLoan && !paths.today.beyondHorizon && !paths.withLoan.beyondHorizon) {
      checks.push({
        id: "intereses",
        title: "Sin plan agresivo, no paga más intereses que hoy",
        pass: paths.withLoan.totalCost <= paths.today.totalCost,
        detail: `${paths.withLoan.totalCost} € con préstamo frente a ${paths.today.totalCost} € hoy`,
        diff: round2(paths.withLoan.totalCost - paths.today.totalCost),
      });
    }
    const income = finite(options.monthlyIncome) && Number(options.monthlyIncome) > 0 ? Number(options.monthlyIncome) : null;
    const maxDti = finite(options.maxDebtToIncomePct) ? Number(options.maxDebtToIncomePct) : DEFAULTS.maxDebtToIncomePct;
    if (income !== null && withLoan.ok) {
      const dtiPct = round2((withLoanPayment / income) * 100);
      checks.push({ id: "ratio", title: `Cuota total de deuda ≤ ${maxDti} % de los ingresos`, pass: dtiPct <= maxDti, detail: `quedaría en ${String(dtiPct).replace(".", ",")} %`, dtiPct });
    }
    if (paths.aggressive && paths.sameEffort && !paths.aggressive.beyondHorizon && !paths.sameEffort.beyondHorizon) {
      checks.push({
        id: "aporta",
        title: "Aporta frente a pagar lo mismo sin préstamo",
        pass: paths.aggressive.totalCost < paths.sameEffort.totalCost || paths.aggressive.monthsToDebtFree < paths.sameEffort.monthsToDebtFree,
        detail: `${paths.aggressive.totalCost} € y ${paths.aggressive.monthsToDebtFree} meses frente a ${paths.sameEffort.totalCost} € y ${paths.sameEffort.monthsToDebtFree} meses`,
      });
    }

    const warnings = [];
    if (!cancelled.length) warnings.push(manual ? "No has elegido ninguna deuda que cancelar." : "Ninguna deuda es más cara que el préstamo: con la selección automática no se cancela nada.");
    if (cancelled.some((row) => row.cheaperThanLoan)) warnings.push("Alguna deuda elegida es más barata que el préstamo: cancelarla con él encarece su coste.");
    if (cancelled.some((row) => row.revolving && row.full)) warnings.push("Cancelar una tarjeta o línea de crédito solo funciona si después no se vuelve a usar: bajad su límite o cerradla al cancelarla.");
    if (cancelled.some((row) => !row.projected)) warnings.push("Alguna deuda cancelada no tenía cuota activa: no estaba en «hoy», así que la comparación no cuenta lo que os ahorra.");
    if (allocations.some((row) => row.unfunded)) warnings.push("El dinero no llega para todas las deudas elegidas: las últimas no se cancelan.");
    if (leftover > 0) warnings.push(`Sobran ${leftover} € del préstamo: bastaría pedir unos ${capitalNeeded} € para cancelar lo mismo.`);
    if (earlyRepaid > 0 && !(earlyFeePct > 0)) warnings.push("El plan agresivo amortiza el préstamo antes de tiempo: preguntad su comisión (por ley, como mucho el 1 %, o el 0,5 % en el último año).");

    return {
      ok: true,
      schemaId: SCHEMA_ID,
      startMonthKey,
      holder,
      includeMortgage,
      keepPaying,
      mortgagesLeftOut,
      terms,
      selection: manual ? "manual" : "auto",
      candidates,
      allocations,
      cancelled,
      allocated,
      leftover,
      capitalNeeded,
      weightedAprPct,
      freedPayments,
      todayPayment,
      withLoanPayment,
      aggressiveMonthly: round2(withLoanPayment + aggressiveExtra),
      aggressiveExtra,
      sameEffortExtra,
      earlyRepaid,
      earlyFee,
      paths,
      checks,
      checksPassed: checks.filter((check) => check.pass).length,
      warnings,
    };
  }

  return { SCHEMA_ID, LOAN_ID, DEFAULTS, LIMITS, frenchPayment, monthlyIrr, loanTerms, plan };
});
