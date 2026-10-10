(function attachCanonicalShadowDebt(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalShadowDebt = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalShadowDebtFactory() {
  "use strict";

  // WP-41 (DAC-04 + DNU-03, docs/WP41_DISENO.md): la deuda que no figura como deuda y la TAE real de lo que se financia.
  //   · detectShadowDebt: busca en los movimientos importados compromisos que SE COMPORTAN como deuda aunque no sean préstamos (móvil financiado en la factura,
  //     compras aplazadas, «paga en 3 plazos») y propone darlos de alta como deuda corta, con su fecha de fin cuando el propio extracto la dice.
  //   · effectiveApr: función pura de la TAE efectiva (TIR con comisión de apertura y seguro) de una financiación u oferta «sin intereses».
  //   · cashVsFinance: compara esa TAE con pagar al contado y con lo que dejaría en el colchón.
  // Motor puro: ni DOM, ni red, ni almacenamiento. NUNCA da de alta nada ni mueve dinero (A11-4): propone.
  //
  // Reglas de honestidad:
  //   · un recurrente sin pista de plazos o de financiación NO se marca (sería una suscripción): sin fecha de fin ni palabra que lo delate, no es «deuda en la sombra».
  //   · la fecha de fin solo sale de un contador «cuota 3 de 12» del propio extracto; sin él se dice «no se sabe cuándo acaba».
  //   · el capital de la propuesta es lo que queda por pagar (cuotas × importe): NO incluye intereses desconocidos y se dice.
  //   · la TAE solo es calculable si se sabe el precio al contado; un campo en blanco no se presume «sin comisión».

  const SCHEMA_ID = "finance-shadow-debt/v1";
  const RESPONSES = Object.freeze(["not-debt", "added"]);
  const RECENT_DAYS = 45;
  const AMOUNT_TOLERANCE = 0.02;
  const MIN_KEYWORD_CHARGES = 2;
  const MAX_ITEMS = 8;
  const MIN_ANSWERED = 10;

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const isIso = (value) => /^\d{4}-\d{2}-\d{2}/.test(text(value));

  const plain = (value) => text(value).toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const daysBetween = (fromIso, toIso) => {
    const parse = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
  };
  const addMonths = (monthKey, months) => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + months, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  // «cuota 3 de 12», «plazo 4/10», «pago 2 de 6», «mensualidad 5/24», «3 de 12 cuotas».
  const COUNTER_AFTER_WORD = /\b(?:cuota|plazo|pago|mensualidad|recibo|cargo|financiacion)\s*(?:n[ºo.]?\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/;
  const COUNTER_BEFORE_WORD = /\b(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*(?:cuotas|plazos|pagos|mensualidades)\b/;
  // Palabras que delatan financiación. Se evita «plazo fijo» (depósito) y «cuota» a secas (comunidad, colegio, gimnasio).
  /** @type {Array<[RegExp, string]>} */
  const KEYWORDS = [
    [/\bfinanciacion\b|\bfinanciado\b|\bfinanciada\b|\bfinanciero\b|\bfinanciera\b/, "dice «financiación»"],
    [/\baplaz(?:amiento|ado|ada|o)\b/, "dice «aplazado»"],
    [/\bfracciona(?:do|da|miento)\b/, "dice «fraccionado»"],
    [/\b(?:pago|compra)\s+a\s+plazos\b|\ba\s+plazos\b/, "dice «a plazos»"],
    [/\bcuota\s+(?:de\s+)?terminal\b|\bterminal\s+movil\b|\bcuota\s+movil\b/, "es la cuota de un terminal"],
    [/\b(?:klarna|sequra|aplazame|pagantis|oney|scalapay|clearpay|afterpay)\b/, "es un servicio de pago aplazado"],
  ];
  const NOT_DEBT = /\bplazo\s+fijo\b|\bdeposito\b|\bfondo\s+de\s+pensiones\b|\bhipoteca\b|\bprestamo\b/;
  const STOP_TOKENS = new Set(["cuota", "cuotas", "plazo", "plazos", "pago", "pagos", "mensualidad", "recibo", "cargo", "de", "del", "la", "el", "los", "las", "num", "numero"]);

  function conceptKey(row) {
    const tokens = plain(`${row.movement || ""} ${row.details || ""}`).split(/[^a-z]+/).filter((token) => token.length >= 3 && !STOP_TOKENS.has(token));
    return tokens.slice(0, 4).join(" ");
  }

  // Con una palabra de financiación en el concepto se admite alguna palabra entre «cuota» y el contador («cuota terminal 3 de 24»); sin ella, el contador
  // tiene que ir pegado («cuota 3 de 12»): «cuota comunidad 3/12» podría ser una fecha.
  const COUNTER_WITH_GAP = /\b(?:cuota|plazo|pago|mensualidad|recibo|cargo|financiacion|compra)\s+(?:[a-z]+\s+){1,2}(?:n[ºo.]?\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/;

  function counterOf(raw, allowGap = false) {
    const match = raw.match(COUNTER_AFTER_WORD) || raw.match(COUNTER_BEFORE_WORD) || (allowGap ? raw.match(COUNTER_WITH_GAP) : null);
    if (!match) return null;
    const n = Number(match[1]);
    const m = Number(match[2]);
    return n >= 1 && m >= 2 && m <= 120 && n <= m ? { n, m } : null;
  }

  function keywordsOf(raw) {
    if (NOT_DEBT.test(raw)) return [];
    return KEYWORDS.filter(([pattern]) => pattern.test(raw)).map(([, label]) => label);
  }

  function normalizeAnswers(raw) {
    const byId = {};
    if (raw && typeof raw === "object") {
      Object.entries(raw.byId && typeof raw.byId === "object" ? raw.byId : {}).forEach(([id, value]) => {
        if (value && RESPONSES.includes(value.response) && typeof value.at === "string") byId[id] = { response: value.response, at: value.at };
      });
    }
    return { byId };
  }

  function applyAnswer(answers, item, response, at) {
    const next = normalizeAnswers(answers);
    if (RESPONSES.includes(response) && item?.id) next.byId[item.id] = { response, at };
    return next;
  }

  function stats(answers) {
    const answered = Object.values(normalizeAnswers(answers).byId);
    const notDebt = answered.filter((a) => a.response === "not-debt").length;
    return { answered: answered.length, notDebt, minAnswered: MIN_ANSWERED, falsePositiveRate: answered.length >= MIN_ANSWERED ? Math.round((notDebt / answered.length) * 1000) / 1000 : null };
  }

  const entityTokens = (name) => plain(name).split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !["banco", "bank", "caja", "cuota", "pago", "financiacion"].includes(token));

  // ¿Ya está esto en la app? Mismo nombre (términos del corto dentro del largo) y cuota parecida.
  function alreadyInApp(item, contracts) {
    return (Array.isArray(contracts) ? contracts : []).some((contract) => {
      const a = entityTokens(item.label);
      const b = entityTokens(contract.entity);
      const sameName = a.length && b.length && (a.length <= b.length ? a.every((t) => b.includes(t)) : b.every((t) => a.includes(t)));
      const payment = number(contract.currentPayment ?? contract.originalPayment ?? contract.payment);
      const similarPayment = payment > 0 && Math.abs(payment - item.monthlyAmount) <= Math.max(2, item.monthlyAmount * 0.05);
      return sameName && similarPayment && contract.paymentStatus !== "settled";
    });
  }

  /**
   * @param {{today?: string, transactions?: Array<Object>, contracts?: Array<Object>, answers?: *, limit?: number}} [input]
   */
  function detectShadowDebt({ today = "", transactions = [], contracts = [], answers = null, limit = MAX_ITEMS } = {}) {
    if (!isIso(today)) return { schemaId: SCHEMA_ID, status: "missing", missing: ["la fecha de hoy"], items: [], suppressed: 0, overflow: 0, stats: stats(answers) };
    const rows = (Array.isArray(transactions) ? transactions : []).filter((row) => row && isIso(row.date) && number(row.amount) < 0);
    const coveredUntil = rows.length ? rows.map((row) => text(row.date).slice(0, 10)).sort().at(-1) : "";
    if (!coveredUntil || daysBetween(coveredUntil, today) > RECENT_DAYS) {
      return { schemaId: SCHEMA_ID, status: "stale", coveredUntil, items: [], suppressed: 0, overflow: 0, stats: stats(answers) };
    }
    const groups = new Map();
    rows.forEach((row) => {
      const raw = plain(`${row.movement || ""} ${row.details || ""}`);
      const key = conceptKey(row);
      if (!key || NOT_DEBT.test(raw)) return; // préstamos e hipotecas ya son contratos: se concilian en Contratos y con la CIRBE (WP-40)
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ date: text(row.date).slice(0, 10), amount: Math.abs(round2(row.amount)), raw, label: text(row.movement || row.details) });
    });
    const answered = normalizeAnswers(answers).byId;
    const found = [];
    let suppressed = 0;
    groups.forEach((charges, key) => {
      charges.sort((a, b) => a.date.localeCompare(b.date));
      const last = charges.at(-1);
      if (daysBetween(last.date, today) > RECENT_DAYS) return; // ya no se cobra
      const counter = charges.map((c) => counterOf(c.raw, keywordsOf(c.raw).length > 0)).filter(Boolean).at(-1) || null;
      const words = [...new Set(charges.flatMap((c) => keywordsOf(c.raw)))];
      if (!counter && !words.length) return; // sin pista de plazos ni de financiación: es un recurrente, no deuda
      // Mismo importe (±2 %) en los cargos que se tienen en cuenta: el último y los que lo igualan.
      const same = charges.filter((c) => Math.abs(c.amount - last.amount) <= last.amount * AMOUNT_TOLERANCE);
      if (!counter && same.length < MIN_KEYWORD_CHARGES) return;
      const months = new Set(same.map((c) => c.date.slice(0, 7)));
      if (!counter && months.size < MIN_KEYWORD_CHARGES) return;
      const gaps = same.slice(1).map((c, i) => daysBetween(same[i].date, c.date));
      if (gaps.length && !gaps.every((gap) => gap >= 24 && gap <= 38)) return; // no es mensual
      const id = `${key}|${last.amount}`;
      if (answered[id]) { suppressed += 1; return; }
      const monthly = last.amount;
      const remaining = counter ? counter.m - counter.n : null;
      const endMonth = remaining === null ? null : addMonths(last.date.slice(0, 7), remaining);
      const evidence = [];
      if (counter) evidence.push(`El propio extracto dice «cuota ${counter.n} de ${counter.m}»: ${remaining === 0 ? "es la última" : `quedan ${remaining}`}.`);
      words.forEach((word) => evidence.push(`El concepto ${word}.`));
      evidence.push(`${same.length === 1 ? "Un cargo" : `${same.length} cargos mensuales`} de ${monthly} €, el último el ${last.date}.`);
      const item = {
        id, key, label: last.label, monthlyAmount: monthly, chargesSeen: same.length, lastDate: last.date, firstDate: same[0].date,
        remaining, installmentsTotal: counter ? counter.m : null, endMonth, remainingTotal: remaining === null ? null : round2(remaining * monthly),
        confidence: counter ? "alta" : "media", signals: counter ? ["counter", ...(words.length ? ["keyword"] : [])] : ["keyword"], evidence,
      };
      if (alreadyInApp(item, contracts)) { suppressed += 1; return; }
      found.push(item);
    });
    // Primero lo que tiene fecha de fin conocida y más cuota; después lo demás.
    found.sort((a, b) => (a.confidence === b.confidence ? b.monthlyAmount - a.monthlyAmount : a.confidence === "alta" ? -1 : 1));
    const items = found.slice(0, Math.max(1, number(limit, MAX_ITEMS)));
    const monthlyTotal = round2(items.reduce((sum, item) => sum + item.monthlyAmount, 0));
    const withEnd = items.filter((item) => item.endMonth);
    return {
      schemaId: SCHEMA_ID, status: "ok", coveredUntil, items, suppressed, overflow: Math.max(0, found.length - items.length), stats: stats(answers),
      monthlyTotal, latestEnd: withEnd.length ? withEnd.map((item) => item.endMonth).sort().at(-1) : null, withoutEnd: items.filter((item) => !item.endMonth).length,
    };
  }

  /** Lo que se rellena en el alta de un contrato: capital = lo que queda por pagar (sin intereses que se desconocen), cuota y plazos si se saben. */
  function proposal(item) {
    return {
      entity: text(item.label).slice(0, 80), type: "Préstamo", principal: item.remainingTotal === null ? round2(item.monthlyAmount) : item.remainingTotal,
      payment: item.monthlyAmount, remainingInstallments: item.remaining,
      note: item.remainingTotal === null
        ? "No se sabe cuándo acaba: el capital es solo la cuota de un mes. Corrígelo cuando lo sepas."
        : "El capital es lo que queda por pagar (cuotas × importe): no incluye intereses, que el extracto no dice.",
    };
  }

  // TIR mensual por bisección sobre los flujos [t0, t1, …]. Sin cambio de signo no hay TIR.
  function monthlyIrr(flows) {
    const f = (r) => flows.reduce((sum, flow, t) => sum + flow / (1 + r) ** t, 0);
    let low = -0.5;
    let high = 5;
    let fLow = f(low);
    const fHigh = f(high);
    if (!Number.isFinite(fLow) || !Number.isFinite(fHigh) || fLow * fHigh > 0) return null;
    for (let i = 0; i < 200; i += 1) {
      const mid = (low + high) / 2;
      const fMid = f(mid);
      if (Math.abs(fMid) < 1e-9) return mid;
      if (fLow * fMid < 0) high = mid; else { low = mid; fLow = fMid; }
    }
    return (low + high) / 2;
  }

  /**
   * TAE efectiva de una financiación: lo que se recibe al principio (el bien al precio de contado, menos la comisión) frente a lo que se paga después.
   * `firstPaymentAtStart`: el primer plazo se paga en el acto (típico de «paga en 3 veces»).
   * @param {{cashPrice?: number, installments?: number, installmentAmount?: number, upfrontFee?: number, monthlyInsurance?: number, finalPayment?: number, firstPaymentAtStart?: boolean}} [input]
   */
  function effectiveApr({ cashPrice, installments, installmentAmount, upfrontFee = 0, monthlyInsurance = 0, finalPayment = 0, firstPaymentAtStart = false } = {}) {
    const price = number(cashPrice, NaN);
    const n = Math.round(number(installments, NaN));
    const amount = number(installmentAmount, NaN);
    if (!(price > 0)) return { calculable: false, reason: "Falta el precio al contado: sin él no se puede saber cuánto cuesta financiar." };
    if (!(n >= 1) || !(amount > 0)) return { calculable: false, reason: "Faltan el número de plazos y el importe de cada uno." };
    const fee = Math.max(0, number(upfrontFee));
    const insurance = Math.max(0, number(monthlyInsurance));
    const last = Math.max(0, number(finalPayment));
    const startOffset = firstPaymentAtStart ? 0 : 1;
    const horizon = n - 1 + startOffset + (last > 0 ? 1 : 0);
    const flows = Array.from({ length: horizon + 1 }, () => 0);
    flows[0] += price - fee;
    for (let k = 0; k < n; k += 1) flows[k + startOffset] -= amount + insurance;
    if (last > 0) flows[horizon] -= last;
    const totalPaid = round2(n * (amount + insurance) + last + fee);
    const extraCost = round2(totalPaid - price);
    const base = { totalPaid, extraCost, extraCostPct: round2((extraCost / price) * 100), installments: n };
    if (extraCost === 0) return { calculable: true, aprPct: 0, monthlyRatePct: 0, nominalPct: 0, ...base };
    const r = monthlyIrr(flows);
    if (r === null) return { calculable: false, reason: "Con estas cifras no sale una TAE: revisa el precio al contado y los plazos.", ...base };
    const aprPct = Math.round(((1 + r) ** 12 - 1) * 10000) / 100;
    return { calculable: true, aprPct, monthlyRatePct: Math.round(r * 1000000) / 10000, nominalPct: Math.round(r * 12 * 10000) / 100, ...base };
  }

  /**
   * ¿Financiar o pagar al contado? Con lo que cuesta, con lo que dejaría en el colchón y, si se sabe, con lo que rinde el dinero parado.
   * `yieldPct`/`liquidity`/`floor` ausentes (null) no se rellenan: la parte que depende de ellos se omite y se dice.
   * @param {{apr?: Object, cashPrice?: number, liquidity?: number|null, floor?: number|null, yieldPct?: number|null}} [input]
   */
  function cashVsFinance({ apr, cashPrice, liquidity = null, floor = null, yieldPct = null } = {}) {
    if (!apr || !apr.calculable) return { verdict: "no-data", notes: ["Sin TAE no hay comparación."] };
    const notes = [];
    const price = number(cashPrice);
    const hasLiquidity = liquidity !== null && liquidity !== undefined && Number.isFinite(Number(liquidity));
    const hasFloor = floor !== null && floor !== undefined && Number.isFinite(Number(floor)) && Number(floor) > 0;
    const hasYield = yieldPct !== null && yieldPct !== undefined && Number.isFinite(Number(yieldPct));
    const afterCash = hasLiquidity ? round2(Number(liquidity) - price) : null;
    const belowFloor = hasLiquidity && hasFloor ? afterCash < Number(floor) : null;
    if (!hasLiquidity) notes.push("No se sabe cuánta liquidez hay: no se puede decir qué dejaría pagar al contado.");
    else if (!hasFloor) notes.push("No hay colchón fijado en Ajustes: no se puede decir si pagar al contado lo toca.");
    if (!hasYield) notes.push("No has dicho cuánto rinde el dinero parado: no se compara la TAE con eso.");
    let verdict;
    if (apr.aprPct <= 0) {
      verdict = hasYield && Number(yieldPct) > 0 ? "free-keep-cash" : "free";
    } else if (hasYield && apr.aprPct <= Number(yieldPct)) {
      verdict = "finance-pays";
    } else if (belowFloor === true) {
      verdict = "cash-breaks-floor";
    } else {
      verdict = "cash-cheaper";
    }
    return { verdict, extraCost: apr.extraCost, aprPct: apr.aprPct, afterCash, belowFloor, notes };
  }

  return { SCHEMA_ID, RESPONSES, RECENT_DAYS, MIN_ANSWERED, conceptKey, normalizeAnswers, applyAnswer, stats, detectShadowDebt, proposal, effectiveApr, cashVsFinance };
});
