/**
 * canonical-debt-payoff-path.js
 *
 * WP-19 · NDB-01 (docs/WP19_DISENO.md): «Camino a deuda cero». Responde a «¿cuándo acabamos y qué cambia con X € más al mes?»
 * proyectando, mes a mes, el calendario francés de cada deuda activa (capital, cuota y TAE declarados — el mismo cálculo que el
 * calendario de Deuda › Ruta) con un EXTRA fijo al mes que va a una deuda cada vez, en el orden de ataque.
 *
 * Convenciones que la tarjeta dice en voz alta:
 *  - Las cuotas que se liberan al saldar una deuda NO se redirigen: solo el extra pasa de una deuda a la siguiente. Es la lectura
 *    conservadora y la que hace que «extra 0» sea exactamente el calendario actual.
 *  - No incluye comisiones de amortización anticipada ni cambios de tipo en deudas variables.
 *  - Una deuda sin cuota activa, o sin TAE ni plazo del que deducirlo, NO entra en la cuenta (dato ausente no es cero) y se lista.
 *
 * Motor puro: sin DOM, sin red ni almacenamiento. Nada de esto ejecuta ninguna operación (A11-4).
 */

(function attachDebtPayoffPath(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDebtPayoffPath = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function debtPayoffPathFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-debt-payoff-path/v1";
  const MAX_MONTHS = 600;
  const DECLARED_TOLERANCE = 0.005;
  const IMPLIED_TOLERANCE = 0.5;
  const LARGE_GAP_MONTHS = 2;
  const STRATEGIES = Object.freeze(["avalancha", "bola-nieve"]);

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function finite(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function monthKeyOk(value) {
    return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  }

  function addMonths(key, offset) {
    const [year, month] = key.split("-").map(Number);
    const index = year * 12 + (month - 1) + offset;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  }

  function labelOf(contract) {
    const named = [contract.entity, contract.type].filter(Boolean).join(" ").trim();
    return named || contract.label || contract.id || "Deuda";
  }

  // TIN mensual que hace que `payment` durante `months` cuotas amortice `principal` (anualidad). Bisección: es la misma cuota
  // francesa que usan DI1 y WP-20, resuelta al revés. null si cuota × plazo no llega al capital (no hay tipo que lo explique).
  function impliedMonthlyRate(principal, payment, months) {
    if (!(principal > 0) || !(payment > 0) || !(months > 0)) return null;
    if (payment * months < principal - IMPLIED_TOLERANCE) return null;
    const pv = (rate) => (rate === 0 ? payment * months : (payment * (1 - Math.pow(1 + rate, -months))) / rate);
    let low = 0;
    let high = 1;
    if (pv(0) <= principal) return 0;
    for (let step = 0; step < 100; step += 1) {
      const mid = (low + high) / 2;
      if (pv(mid) > principal) low = mid; else high = mid;
    }
    return (low + high) / 2;
  }

  function classify(contract) {
    const principal = round2(finite(contract?.currentPrincipal) ?? 0);
    if (!(principal > 0)) return null;
    const base = { id: String(contract.id || ""), label: labelOf(contract), principal };
    const payment = round2(finite(contract.currentPayment) ?? 0);
    if (contract.paymentStatus !== "active") return { excluded: { ...base, reason: "sin-cuota-activa" } };
    if (!(payment > 0)) return { excluded: { ...base, reason: "sin-cuota-activa" } };
    const apr = contract.apr === null || contract.apr === undefined || contract.apr === "" ? null : finite(contract.apr);
    const installments = Math.max(0, Math.floor(finite(contract.remainingInstallments) ?? 0));
    if (apr !== null && apr >= 0) {
      return { included: { ...base, payment, aprPct: apr, monthlyRate: apr / 100 / 12, rateSource: "declared", tolerance: DECLARED_TOLERANCE, installments } };
    }
    if (!(installments > 0)) return { excluded: { ...base, reason: "sin-tae-ni-plazo" } };
    const monthlyRate = impliedMonthlyRate(principal, payment, installments);
    if (monthlyRate === null) return { excluded: { ...base, reason: "plazo-incoherente" } };
    return { included: { ...base, payment, aprPct: round2(monthlyRate * 1200), monthlyRate, rateSource: "implied", tolerance: IMPLIED_TOLERANCE, installments } };
  }

  function orderOf(included, strategy, order) {
    const byStrategy = included.slice().sort((a, b) => (strategy === "bola-nieve"
      ? a.principal - b.principal || b.aprPct - a.aprPct
      : b.aprPct - a.aprPct || a.principal - b.principal) || a.id.localeCompare(b.id));
    if (!Array.isArray(order) || !order.length) return byStrategy;
    const rank = new Map(order.map((id, index) => [String(id), index]));
    return byStrategy.slice().sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
      if (ra === rb) return byStrategy.indexOf(a) - byStrategy.indexOf(b);
      return ra - rb;
    });
  }

  /**
   * @param {Array<Record<string, any>>} contracts filas de contrato canónico (id, entity, type, paymentStatus, currentPrincipal, currentPayment, apr, remainingInstallments)
   * @param {{startMonthKey?: string, extraMonthly?: number, strategy?: string, order?: string[]}} [options]
   */
  function project(contracts, options = {}) {
    const extra = options.extraMonthly === undefined ? 0 : (typeof options.extraMonthly === "number" ? options.extraMonthly : NaN);
    if (!Number.isFinite(extra) || extra < 0) return { ok: false, error: "El extra al mes tiene que ser un importe de 0 € o más." };
    if (!monthKeyOk(options.startMonthKey)) return { ok: false, error: "Falta el mes de partida." };
    const startMonthKey = options.startMonthKey;
    const strategy = STRATEGIES.includes(options.strategy) ? options.strategy : "avalancha";

    const included = [];
    const excluded = [];
    (Array.isArray(contracts) ? contracts : []).forEach((contract) => {
      const result = classify(contract);
      if (!result) return;
      if (result.excluded) excluded.push(result.excluded);
      else included.push(result.included);
    });
    const ordered = orderOf(included, strategy, options.order);
    const excludedPrincipal = round2(excluded.reduce((sum, row) => sum + row.principal, 0));

    const state = ordered.map((row) => ({ row, balance: row.principal, interest: 0, paid: 0, payoffIndex: null, stalled: false }));
    const series = [];
    let firstTarget = null;
    let month = 0;
    for (; month < MAX_MONTHS; month += 1) {
      if (!state.some((entry) => entry.payoffIndex === null)) break;
      let pool = extra;
      state.forEach((entry) => {
        if (entry.payoffIndex !== null) return;
        const interest = round2(entry.balance * entry.row.monthlyRate);
        entry.interest = round2(entry.interest + interest);
        const due = Math.min(entry.row.payment, round2(entry.balance + interest));
        if (entry.row.payment - interest <= 0 && !(due >= entry.balance + interest)) entry.stalled = true;
        entry.balance = round2(entry.balance + interest - due);
        entry.paid = round2(entry.paid + due);
      });
      state.forEach((entry) => {
        if (entry.payoffIndex !== null || pool <= 0 || entry.balance <= entry.row.tolerance) return;
        const applied = Math.min(pool, entry.balance);
        if (!firstTarget && applied > 0) firstTarget = { id: entry.row.id, label: entry.row.label, aprPct: entry.row.aprPct };
        entry.balance = round2(entry.balance - applied);
        entry.paid = round2(entry.paid + applied);
        pool = round2(pool - applied);
      });
      state.forEach((entry) => {
        if (entry.payoffIndex === null && entry.balance <= entry.row.tolerance) {
          entry.paid = round2(entry.paid + entry.balance);
          entry.balance = 0;
          entry.payoffIndex = month;
        }
      });
      series.push({ monthKey: addMonths(startMonthKey, month), balance: round2(state.reduce((sum, entry) => sum + entry.balance, 0)) });
    }
    if (!firstTarget && ordered.length) firstTarget = { id: ordered[0].id, label: ordered[0].label, aprPct: ordered[0].aprPct };

    // El plazo declarado se compara siempre con el calendario SIN extra: con extra el plazo se acorta a propósito y no es un desajuste.
    const baseline = extra > 0 ? project(contracts, { ...options, extraMonthly: 0 }) : null;
    const baselineRows = new Map((baseline ? baseline.included : []).map((row) => [row.id, row]));
    const rows = state.map((entry) => {
      const own = baseline ? null : entry.payoffIndex;
      const gapIndex = baseline ? baselineRows.get(entry.row.id)?.payoffIndex ?? null : own;
      const declaredGapMonths = entry.row.rateSource === "declared" && entry.row.installments > 0 && gapIndex !== null ? gapIndex + 1 - entry.row.installments : (entry.row.installments > 0 && entry.row.rateSource === "implied" ? 0 : null);
      return {
        id: entry.row.id,
        label: entry.row.label,
        principal: entry.row.principal,
        payment: entry.row.payment,
        aprPct: entry.row.aprPct,
        rateSource: entry.row.rateSource,
        payoffIndex: entry.payoffIndex,
        payoffMonthKey: entry.payoffIndex === null ? null : addMonths(startMonthKey, entry.payoffIndex),
        interest: entry.interest,
        stalled: entry.stalled && entry.payoffIndex === null,
        declaredInstallments: entry.row.installments || null,
        declaredGapMonths,
      };
    });
    const beyondHorizon = rows.some((row) => row.payoffIndex === null);
    const latest = rows.length && !beyondHorizon ? Math.max(...rows.map((row) => row.payoffIndex)) : null;
    const trimmed = (() => {
      let last = series.length - 1;
      while (last > 0 && series[last].balance <= 0) last -= 1;
      return series.slice(0, Math.min(series.length, last + 2));
    })();
    return {
      ok: true,
      schemaId: SCHEMA_ID,
      startMonthKey,
      extraMonthly: round2(extra),
      strategy,
      included: rows,
      excluded,
      excludedPrincipal,
      complete: excluded.length === 0,
      nothingToProject: rows.length === 0 && excluded.length === 0,
      beyondHorizon,
      debtFreeMonthKey: latest === null ? null : addMonths(startMonthKey, latest),
      monthsToDebtFree: latest === null ? null : latest + 1,
      totalInterest: round2(rows.reduce((sum, row) => sum + row.interest, 0)),
      totalPaid: round2(state.reduce((sum, entry) => sum + entry.paid, 0)),
      monthlyPayment: round2(rows.reduce((sum, row) => sum + row.payment, 0) + extra),
      milestones: rows.filter((row) => row.payoffIndex !== null).sort((a, b) => a.payoffIndex - b.payoffIndex || a.id.localeCompare(b.id))
        .map((row) => ({ id: row.id, label: row.label, payoffMonthKey: row.payoffMonthKey, payoffIndex: row.payoffIndex })),
      firstTarget,
      baseline: baseline && baseline.ok ? { debtFreeMonthKey: baseline.debtFreeMonthKey, monthsToDebtFree: baseline.monthsToDebtFree, totalInterest: baseline.totalInterest, beyondHorizon: baseline.beyondHorizon } : null,
      hasLargeGap: rows.some((row) => row.declaredGapMonths !== null && Math.abs(row.declaredGapMonths) > LARGE_GAP_MONTHS),
      series: trimmed,
    };
  }

  // «Por cada 100 € extra al mes»: meses menos e intereses menos frente al calendario actual, y a qué deuda iría.
  function perHundred(contracts, options = {}) {
    const base = project(contracts, { ...options, extraMonthly: 0 });
    const more = project(contracts, { ...options, extraMonthly: 100 });
    if (!base.ok || !more.ok || !base.included.length) return { monthsSaved: null, interestSaved: null, targetId: null, targetLabel: null };
    return {
      monthsSaved: base.monthsToDebtFree === null || more.monthsToDebtFree === null ? null : base.monthsToDebtFree - more.monthsToDebtFree,
      interestSaved: base.beyondHorizon ? null : round2(base.totalInterest - more.totalInterest),
      targetId: more.firstTarget?.id ?? null,
      targetLabel: more.firstTarget?.label ?? null,
    };
  }

  return { SCHEMA_ID, MAX_MONTHS, LARGE_GAP_MONTHS, STRATEGIES, project, perHundred, impliedMonthlyRate, addMonths };
});
