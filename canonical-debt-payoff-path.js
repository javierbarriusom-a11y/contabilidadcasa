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
 *  - Con `redirectFreed: true` (14/11, plan agresivo de Deuda › Préstamo) sí se redirigen: desde el mes siguiente al de saldar una
 *    deuda, su cuota se suma al extra y va a la siguiente del orden (bola de nieve). Sin la opción, el resultado no cambia.
 *  - No incluye comisiones de amortización anticipada ni cambios de tipo en deudas variables.
 *  - Una deuda sin cuota activa, o sin TAE ni plazo del que deducirlo, NO entra en la cuenta (dato ausente no es cero) y se lista.
 *  - UND-11 (plan óptimo v2, 22/11/2026): con `settlements` ([{id, amount, prepaid}]), una oferta de quita («pagad X y cancelamos la
 *    deuda») es un destino más del extra. Lo que se pone de más se va juntando para esa quita y, el mes en que llega a X (o al saldo,
 *    si con las cuotas baja de X), la deuda se cancela: lo que faltaba es lo que se perdona (`forgiven`). Mientras tanto la deuda sigue
 *    con su cuota y su interés; una deuda sin cuota activa entra con el saldo quieto (la convención de los acuerdos de SVD-3: no se
 *    proyectan intereses de demora). En el orden, cuenta su rendimiento equivalente (`settlementYield`), no su TAE.
 *  - UND-12 (22/11/2026): con `extraByMonth`, el extra de cada mes es el de esa posición (y `extraMonthly` pasado el último).
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

  // SVD-3 (17/11/2026): un acuerdo aceptado con la entidad (Deuda › Contratos, desde el simulador visual de deuda) sustituye al
  // calendario del contrato desde su mes: ese mes se paga el pago único pactado (si lo hay) y, si el acuerdo tiene cuotas,
  // esas cuotas fijas durante su plazo; al acabar, la deuda queda saldada (la quita es la diferencia). Antes de ese mes, el
  // contrato sigue con su cuota de hoy si la tiene, y si está suspendido su saldo se queda quieto (no se proyectan intereses de
  // demora: el acuerdo es lo que fija lo que se paga). Sin acuerdo aceptado, nada de esto cambia ninguna cifra.
  function acceptedAgreement(contract) {
    const agreement = contract?.agreement;
    if (!agreement || typeof agreement !== "object") return null;
    if (String(agreement.status || "").toLowerCase() !== "accepted" || !monthKeyOk(agreement.startMonth)) return null;
    const lump = Math.max(0, round2(finite(agreement.settlementAmount) ?? 0));
    const payment = Math.max(0, round2(finite(agreement.payment) ?? 0));
    const duration = Math.max(0, Math.floor(finite(agreement.duration) ?? 0));
    const schedule = payment > 0 && duration > 0;
    if (!(lump > 0) && !schedule) return null;
    return { startMonthKey: agreement.startMonth, lump, payment: schedule ? payment : 0, duration: schedule ? duration : 0 };
  }

  function monthIndexOf(key) {
    const [year, month] = key.split("-").map(Number);
    return year * 12 + (month - 1);
  }

  function classify(contract) {
    const plain = classifyPlain(contract);
    const agreement = plain ? acceptedAgreement(contract) : null;
    if (!agreement) return plain;
    if (plain.included) return { included: { ...plain.included, agreement } };
    const base = plain.excluded;
    const payment = contract.paymentStatus === "active" ? Math.max(0, round2(finite(contract.currentPayment) ?? 0)) : 0;
    return { included: { id: base.id, label: base.label, principal: base.principal, payment, aprPct: 0, monthlyRate: 0, rateSource: "acuerdo", tolerance: DECLARED_TOLERANCE, installments: 0, agreement } };
  }

  /**
   * UND-11: lo que rinde cada euro puesto en una quita, como una TAE para poder ordenarla con las demás deudas.
   *  - Con cuota activa y TAE: la TAE a la que el pago de la quita vale lo mismo que las cuotas que quedan (la tasa interna: pagar X hoy
   *    en vez de esas cuotas). Es exacta.
   *  - Sin cuota activa (la deuda está parada o en impago, que es cuando suele haber quita): lo perdonado entre lo pagado, como si se
   *    pagara en un año (40 % de quita sobre 1.000 €: 400 € de ahorro por 600 € puestos, un 66,7 %). Es una convención y se dice.
   * null si no es quita (pagar X no baja de lo que se debe).
   */
  function settlementYield(row, amount) {
    const offer = round2(finite(amount) ?? 0);
    if (!(offer > 0) || !(row?.principal > 0) || offer >= row.principal - DECLARED_TOLERANCE) return null;
    if (row.payment > 0 && Number.isFinite(row.monthlyRate) && row.rateSource !== "quita") {
      let balance = row.principal;
      let months = 0;
      while (balance > DECLARED_TOLERANCE && months < MAX_MONTHS) {
        const interest = balance * row.monthlyRate;
        if (row.payment <= interest) return { aprPct: 100, method: "cuotas", forgiven: round2(row.principal - offer) };
        balance = balance + interest - row.payment;
        months += 1;
      }
      const lastPayment = row.payment + Math.min(0, balance);
      const payments = row.payment * (months - 1) + lastPayment;
      const rate = impliedMonthlyRate(offer, payments / months, months);
      return { aprPct: rate === null ? 0 : round2(rate * 1200), method: "cuotas", forgiven: round2(row.principal - offer) };
    }
    return { aprPct: round2(((row.principal - offer) / offer) * 100), method: "un-ano", forgiven: round2(row.principal - offer) };
  }

  // UND-11: una deuda con oferta de quita entra en la cuenta aunque hoy no tenga cuota activa (con el saldo quieto).
  function withSettlement(contract, classified, offer) {
    if (!offer || !(offer.amount > 0)) return classified;
    if (classified?.included?.agreement) return classified;
    const plainRow = classified?.included || (() => {
      const base = classified.excluded;
      const payment = contract.paymentStatus === "active" ? Math.max(0, round2(finite(contract.currentPayment) ?? 0)) : 0;
      return { id: base.id, label: base.label, principal: base.principal, payment, aprPct: 0, monthlyRate: 0, rateSource: "quita", tolerance: DECLARED_TOLERANCE, installments: 0 };
    })();
    const yieldInfo = settlementYield(plainRow, offer.amount);
    if (!yieldInfo) return classified;
    return { included: { ...plainRow, settlement: { amount: round2(offer.amount), prepaid: Math.min(round2(offer.amount), Math.max(0, round2(finite(offer.prepaid) ?? 0))), yieldPct: yieldInfo.aprPct, method: yieldInfo.method } } };
  }

  function settlementMap(list) {
    const map = new Map();
    (Array.isArray(list) ? list : []).forEach((item) => {
      const amount = finite(item?.amount);
      if (item && item.id !== undefined && amount !== null && amount > 0) map.set(String(item.id), { amount: round2(amount), prepaid: finite(item.prepaid) ?? 0 });
    });
    return map;
  }

  function classifyPlain(contract) {
    const principal = round2(finite(contract?.currentPrincipal) ?? 0);
    if (!(principal > 0)) return null;
    const base = { id: String(contract.id || ""), label: labelOf(contract), principal };
    const payment = round2(finite(contract.currentPayment) ?? 0);
    // DUO-D9: con los pagos suspendidos (lo que la app trata como impago) no hay cuota que completar; se marca para decirlo así.
    if (contract.paymentStatus === "suspended") return { excluded: { ...base, reason: "sin-cuota-activa", suspended: true } };
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

  // UND-11: una quita se ordena por su rendimiento equivalente (avalancha) o por lo que hay que pagar (bola de nieve).
  function orderApr(row) {
    return row.settlement ? row.settlement.yieldPct : row.aprPct;
  }

  function orderPrincipal(row) {
    return row.settlement ? row.settlement.amount - row.settlement.prepaid : row.principal;
  }

  function orderOf(included, strategy, order) {
    const byStrategy = included.slice().sort((a, b) => (strategy === "bola-nieve"
      ? orderPrincipal(a) - orderPrincipal(b) || orderApr(b) - orderApr(a)
      : orderApr(b) - orderApr(a) || orderPrincipal(a) - orderPrincipal(b)) || a.id.localeCompare(b.id));
    if (!Array.isArray(order) || !order.length) return byStrategy;
    const rank = new Map(order.map((id, index) => [String(id), index]));
    const ranked = byStrategy.filter((row) => !row.settlement).sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
      if (ra === rb) return byStrategy.indexOf(a) - byStrategy.indexOf(b);
      return ra - rb;
    });
    // Las quitas no están en el orden de DEB5: entran delante de la primera deuda que rinda menos que ellas.
    byStrategy.filter((row) => row.settlement).forEach((row) => {
      const at = ranked.findIndex((other) => !other.settlement && other.aprPct < row.settlement.yieldPct);
      ranked.splice(at === -1 ? ranked.length : at, 0, row);
    });
    return ranked;
  }

  // SVD-3: un mes de una deuda con acuerdo aceptado, desde el mes del acuerdo. El primer mes, lo que quede de deuda pasa a ser
  // lo pactado: el pago único (que se paga ese mes) y las cuotas que falten. Si el acuerdo empezó antes del mes de partida, el
  // pago único y las cuotas ya vencidas se dan por pagados.
  function agreementMonth(entry) {
    const agreement = entry.agreement;
    if (!agreement.started) {
      agreement.started = true;
      const elapsed = Math.max(0, -agreement.startIndex);
      const remaining = Math.max(0, agreement.duration - elapsed);
      if (elapsed === 0) entry.paid = round2(entry.paid + agreement.lump);
      entry.balance = round2(agreement.payment * remaining);
    }
    const due = Math.min(agreement.payment, entry.balance);
    entry.balance = round2(entry.balance - due);
    entry.paid = round2(entry.paid + due);
  }

  /**
   * @param {Array<Record<string, any>>} contracts filas de contrato canónico (id, entity, type, paymentStatus, currentPrincipal, currentPayment, apr, remainingInstallments)
   * @param {{startMonthKey?: string, extraMonthly?: number, strategy?: string, order?: string[], redirectFreed?: boolean, extraByMonth?: number[], settlements?: Array<{id: string, amount: number, prepaid?: number}>}} [options]
   */
  function project(contracts, options = {}) {
    const extra = options.extraMonthly === undefined ? 0 : (typeof options.extraMonthly === "number" ? options.extraMonthly : NaN);
    if (!Number.isFinite(extra) || extra < 0) return { ok: false, error: "El extra al mes tiene que ser un importe de 0 € o más." };
    if (!monthKeyOk(options.startMonthKey)) return { ok: false, error: "Falta el mes de partida." };
    const startMonthKey = options.startMonthKey;
    const strategy = STRATEGIES.includes(options.strategy) ? options.strategy : "avalancha";
    const redirectFreed = options.redirectFreed === true;
    const byMonth = Array.isArray(options.extraByMonth) ? options.extraByMonth.map((value) => Math.max(0, finite(value) ?? 0)) : null;
    const extraFor = (index) => (byMonth && index < byMonth.length ? byMonth[index] : extra);
    const offers = settlementMap(options.settlements);

    const included = [];
    const excluded = [];
    (Array.isArray(contracts) ? contracts : []).forEach((contract) => {
      const offer = offers.get(String(contract?.id || ""));
      const result = offer ? withSettlement(contract, classify(contract), offer) : classify(contract);
      if (!result) return;
      if (result.excluded) excluded.push(result.excluded);
      else included.push(result.included);
    });
    const ordered = orderOf(included, strategy, options.order);
    const excludedPrincipal = round2(excluded.reduce((sum, row) => sum + row.principal, 0));

    const state = ordered.map((row) => ({
      row, balance: row.principal, interest: 0, paid: 0, extraApplied: 0, payoffIndex: null, stalled: false,
      fund: row.settlement ? row.settlement.prepaid : 0, forgiven: 0, settledByOffer: false,
      agreement: row.agreement ? { ...row.agreement, startIndex: monthIndexOf(row.agreement.startMonthKey) - monthIndexOf(startMonthKey), started: false } : null,
    }));
    const series = [];
    let firstTarget = null;
    let month = 0;
    for (; month < MAX_MONTHS; month += 1) {
      if (!state.some((entry) => entry.payoffIndex === null)) break;
      const freed = redirectFreed ? state.reduce((sum, entry) => sum + (entry.payoffIndex !== null && entry.payoffIndex < month ? (entry.agreement ? entry.agreement.payment : entry.row.payment) : 0), 0) : 0;
      let pool = round2(extraFor(month) + freed);
      state.forEach((entry) => {
        if (entry.payoffIndex !== null) return;
        if (entry.agreement && month >= Math.max(0, entry.agreement.startIndex)) {
          agreementMonth(entry);
          return;
        }
        const interest = round2(entry.balance * entry.row.monthlyRate);
        entry.interest = round2(entry.interest + interest);
        const due = Math.min(entry.row.payment, round2(entry.balance + interest));
        if (!entry.agreement && entry.row.payment - interest <= 0 && !(due >= entry.balance + interest)) entry.stalled = true;
        entry.balance = round2(entry.balance + interest - due);
        entry.paid = round2(entry.paid + due);
      });
      state.forEach((entry) => {
        // SVD-3: a una deuda con acuerdo aceptado no se le adelanta nada: lo que se paga ya está pactado.
        if (entry.agreement || entry.payoffIndex !== null || entry.balance <= entry.row.tolerance) return;
        if (entry.row.settlement) {
          // UND-11: lo de más se junta para la quita; el mes que llega (a lo ofrecido o al saldo, si es menos), se cancela.
          const target = round2(Math.min(entry.row.settlement.amount, entry.balance));
          const put = round2(Math.max(0, Math.min(pool, target - entry.fund)));
          if (put > 0 && !firstTarget) firstTarget = { id: entry.row.id, label: entry.row.label, aprPct: entry.row.settlement.yieldPct };
          entry.fund = round2(entry.fund + put);
          entry.extraApplied = round2(entry.extraApplied + put);
          pool = round2(pool - put);
          if (entry.fund >= target - entry.row.tolerance) {
            entry.forgiven = round2(Math.max(0, entry.balance - entry.fund));
            entry.paid = round2(entry.paid + entry.fund);
            entry.balance = 0;
            entry.settledByOffer = true;
          }
          return;
        }
        if (pool <= 0) return;
        const applied = Math.min(pool, entry.balance);
        if (!firstTarget && applied > 0) firstTarget = { id: entry.row.id, label: entry.row.label, aprPct: entry.row.aprPct };
        entry.balance = round2(entry.balance - applied);
        entry.paid = round2(entry.paid + applied);
        entry.extraApplied = round2(entry.extraApplied + applied);
        pool = round2(pool - applied);
      });
      state.forEach((entry) => {
        if (entry.payoffIndex === null && entry.balance <= entry.row.tolerance) {
          entry.paid = round2(entry.paid + entry.balance);
          entry.balance = 0;
          entry.payoffIndex = month;
        }
      });
      series.push({ monthKey: addMonths(startMonthKey, month), balance: round2(state.reduce((sum, entry) => sum + entry.balance, 0)), extra: round2(extraFor(month)) });
    }
    if (!firstTarget && ordered.length) firstTarget = { id: ordered[0].id, label: ordered[0].label, aprPct: ordered[0].aprPct };

    // El plazo declarado se compara siempre con el calendario SIN extra: con extra el plazo se acorta a propósito y no es un desajuste.
    const varies = Boolean(byMonth && byMonth.some((value) => value > 0)) || offers.size > 0;
    const baseline = extra > 0 || redirectFreed || varies ? project(contracts, { ...options, extraMonthly: 0, redirectFreed: false, extraByMonth: null, settlements: null }) : null;
    const baselineRows = new Map((baseline ? baseline.included : []).map((row) => [row.id, row]));
    const rows = state.map((entry) => {
      const own = baseline ? null : entry.payoffIndex;
      const gapIndex = baseline ? baselineRows.get(entry.row.id)?.payoffIndex ?? null : own;
      const declaredGapMonths = entry.agreement ? null : entry.row.rateSource === "declared" && entry.row.installments > 0 && gapIndex !== null ? gapIndex + 1 - entry.row.installments : (entry.row.installments > 0 && entry.row.rateSource === "implied" ? 0 : null);
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
        extraApplied: entry.extraApplied,
        stalled: entry.stalled && entry.payoffIndex === null,
        declaredInstallments: entry.row.installments || null,
        declaredGapMonths,
        ...(entry.row.settlement ? { settlement: { amount: entry.row.settlement.amount, prepaid: entry.row.settlement.prepaid, yieldPct: entry.row.settlement.yieldPct, method: entry.row.settlement.method, settled: entry.settledByOffer, forgiven: entry.forgiven } } : {}),
        ...(entry.agreement ? { agreement: { startMonthKey: entry.agreement.startMonthKey, lump: entry.agreement.lump, payment: entry.agreement.payment, duration: entry.agreement.duration } } : {}),
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
      redirectFreed,
      included: rows,
      excluded,
      excludedPrincipal,
      complete: excluded.length === 0,
      nothingToProject: rows.length === 0 && excluded.length === 0,
      beyondHorizon,
      debtFreeMonthKey: latest === null ? null : addMonths(startMonthKey, latest),
      monthsToDebtFree: latest === null ? null : latest + 1,
      totalInterest: round2(rows.reduce((sum, row) => sum + row.interest, 0)),
      totalForgiven: round2(state.reduce((sum, entry) => sum + entry.forgiven, 0)),
      totalPaid: round2(state.reduce((sum, entry) => sum + entry.paid, 0)),
      monthlyPayment: round2(rows.reduce((sum, row) => sum + row.payment, 0) + extra),
      milestones: rows.filter((row) => row.payoffIndex !== null).sort((a, b) => a.payoffIndex - b.payoffIndex || a.id.localeCompare(b.id))
        .map((row) => ({ id: row.id, label: row.label, payoffMonthKey: row.payoffMonthKey, payoffIndex: row.payoffIndex, ...(row.settlement?.settled ? { quita: true } : {}) })),
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

  return { SCHEMA_ID, MAX_MONTHS, LARGE_GAP_MONTHS, STRATEGIES, project, perHundred, impliedMonthlyRate, addMonths, settlementYield };
});
