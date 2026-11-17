(function attachLegacyDebtRoadmapEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceLegacyDebtRoadmapEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function legacyDebtRoadmapEngineFactory() {
  "use strict";

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function paymentFor(principal, annualRate, months) {
    const balance = Math.max(0, number(principal));
    const term = Math.max(1, Math.round(number(months) || 1));
    const rate = Math.max(0, number(annualRate));
    if (!balance) return 0;
    if (!rate) return balance / term;
    const monthly = rate / 100 / 12;
    return balance * monthly / (1 - Math.pow(1 + monthly, -term));
  }

  function buildAccount(raw = {}) {
    const amount = Math.max(0, number(raw.amount));
    const strategy = String(raw.strategy || "hold").trim().toLowerCase();
    const discount = clamp(number(raw.discount), 0, 100);
    const start = Math.max(1, Math.round(number(raw.start) || 1));
    const requestedLump = Math.max(0, number(raw.lump));
    const apr = Math.max(0, number(raw.apr));
    const term = Math.max(1, Math.round(number(raw.term) || 1));
    const financePct = clamp(number(raw.financePct ?? 100), 0, 100);
    // D1 (Fase 1): aportación extra puntual, independiente de la estrategia — un ingreso
    // extraordinario que reduce el saldo vivo en un mes concreto, además de lo que ya paga la
    // estrategia elegida. Por defecto es 0, así que no cambia ningún resultado existente.
    const extra = Math.max(0, number(raw.extra));
    const extraMonth = Math.max(1, Math.round(number(raw.extraMonth) || 1));
    // SVD-2b (17/11/2026): la cuota de hoy del contrato, con su tipo mensual y la tolerancia de cierre que usa «Camino a
    // deuda cero» (canonical-debt-payoff-path.js). Solo llega para los contratos que Ruta incluye (activos, con cuota y con
    // TAE declarada o deducible): con ella, «Esperar» sigue pagando la cuota y las demás estrategias la pagan hasta su mes.
    const keepPayment = Math.max(0, number(raw.keepPayment));
    const keepRate = raw.keepRate === null || raw.keepRate === undefined || raw.keepRate === "" ? null : Math.max(0, number(raw.keepRate));
    const keep = keepPayment > 0 && keepRate !== null;
    const keepTolerance = keep ? Math.max(0, number(raw.keepTolerance)) : 0;
    const discountAmount = amount * discount / 100;
    const afterDiscount = Math.max(0, amount - discountAmount);
    let lump = 0;
    let financed = 0;
    let monthly = 0;
    if (strategy === "settlement") lump = requestedLump > 0 ? requestedLump : afterDiscount;
    if (strategy === "refi") { lump = requestedLump; financed = afterDiscount * financePct / 100; monthly = paymentFor(financed, apr, term); }
    if (strategy === "hybrid") { lump = requestedLump; financed = Math.max(0, afterDiscount - lump) * financePct / 100; monthly = paymentFor(financed, apr, term); }
    return { amount, strategy, discount, discountAmount, afterDiscount, start, lump, apr, term, financePct, financed, monthly, extra, extraMonth, keep, keepPayment, keepRate, keepTolerance };
  }

  // SVD-2b: un mes de la cuota de hoy, con la misma cuenta que «Camino a deuda cero»: interés sobre el saldo, la cuota (o lo
  // que quede), y si lo que queda no pasa de la tolerancia se salda ese mismo mes.
  function keepMonth(balance, account) {
    if (!(balance > 0)) return { due: 0, balance: 0, interest: 0 };
    const interest = round2(balance * account.keepRate);
    const due = Math.min(account.keepPayment, round2(balance + interest));
    let next = round2(balance + interest - due);
    let paid = due;
    if (next <= account.keepTolerance) { paid = round2(paid + next); next = 0; }
    return { due: paid, balance: next, interest };
  }

  // El saldo con el que llega el contrato al mes de inicio de la estrategia, pagando la cuota de hoy hasta entonces.
  function balanceAtStart(account) {
    let balance = account.amount;
    for (let month = 1; month < account.start; month += 1) balance = keepMonth(balance, account).balance;
    return balance;
  }

  function monthKey(baseMonth, offset) {
    const found = String(baseMonth || "").match(/^(\d{4})-(\d{1,2})/);
    if (!found) return "";
    const date = new Date(Date.UTC(Number(found[1]), Number(found[2]) - 1 + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function simulate(config = {}) {
    const months = Math.max(12, Math.round(number(config.months) || 60));
    const capacity = number(config.capacity);
    // SVD-2b: con la cuota de hoy, la estrategia se calcula sobre lo que quede el mes en que empieza, no sobre el saldo de hoy.
    const accounts = Array.isArray(config.accounts) ? config.accounts.map((raw) => {
      const first = buildAccount(raw);
      if (!first.keep || first.strategy === "hold" || first.start <= 1) return first;
      return { ...buildAccount({ ...raw, amount: balanceAtStart(first) }), amountToday: first.amount };
    }) : [];
    // Margen: con `cuotasEnPlan`, las cuotas de hoy ya están en lo que el plan gasta, así que no se restan otra vez.
    const cuotasEnPlan = config.cuotasEnPlan === true;
    const keepBalances = accounts.map((account) => (account.keep ? (account.amountToday ?? account.amount) : 0));
    const balances = accounts.map((account) => account.financed);
    const rows = [];
    for (let index = 0; index < months; index += 1) {
      const month = index + 1;
      let cuotas = 0;
      const payments = accounts.map((account, accountIndex) => {
        // SVD-2b: la cuota de hoy, en «Esperar» todos los meses y en las demás estrategias hasta su mes de inicio.
        if (account.keep && (account.strategy === "hold" || month < account.start)) {
          const step = keepMonth(keepBalances[accountIndex], account);
          keepBalances[accountIndex] = step.balance;
          let value = step.due;
          if (account.extra > 0 && month === account.extraMonth && keepBalances[accountIndex] > 0) {
            const applied = Math.min(keepBalances[accountIndex], account.extra);
            keepBalances[accountIndex] = round2(keepBalances[accountIndex] - applied);
            value += applied;
          }
          cuotas += step.due;
          return round2(value);
        }
        if (account.keep) keepBalances[accountIndex] = 0;
        if (account.strategy === "hold") return 0;
        let value = month === account.start ? account.lump : 0;
        if (["refi", "hybrid"].includes(account.strategy) && month >= account.start && month < account.start + account.term && balances[accountIndex] > 0) {
          const interest = balances[accountIndex] * account.apr / 100 / 12;
          const principal = Math.min(balances[accountIndex], account.monthly - interest);
          value += principal + interest;
          balances[accountIndex] = Math.max(0, balances[accountIndex] - principal);
        }
        if (account.strategy === "settlement" && month >= account.start) balances[accountIndex] = 0;
        if (account.extra > 0 && month === account.extraMonth && balances[accountIndex] > 0) {
          const applied = Math.min(balances[accountIndex], account.extra);
          balances[accountIndex] = Math.max(0, balances[accountIndex] - applied);
          value += applied;
        }
        return round2(value);
      });
      const total = round2(payments.reduce((sum, value) => sum + value, 0));
      cuotas = round2(cuotas);
      // El saldo de cada cuenta: el de la cuota de hoy mientras la paga, y el de la estrategia desde que empieza.
      const rowBalances = accounts.map((account, accountIndex) => round2(account.keep && (account.strategy === "hold" || month < account.start) ? keepBalances[accountIndex] : balances[accountIndex]));
      rows.push({ monthKey: monthKey(config.baseMonth, index), payments, balances: rowBalances, total, cuotas, margin: round2(capacity - (total - (cuotasEnPlan ? cuotas : 0))) });
    }
    const totalPaid = round2(rows.reduce((sum, row) => sum + row.total, 0));
    const totalLump = round2(accounts.reduce((sum, account) => sum + account.lump, 0));
    const peak = round2(Math.max(0, ...rows.map((row) => row.total)));
    // Usa el saldo de cada fila (`row.balances`, congelado en el momento de esa fila), no el
    // array `balances` mutable de más arriba: por construcción, al terminar el bucle ese array
    // refleja el saldo del ÚLTIMO mes simulado para cualquier índice de fila, así que una deuda
    // ya liquidada podía parecer viva durante todo el resto del horizonte si un residuo de coma
    // flotante dejaba el saldo final en un valor positivo ínfimo en vez de exactamente cero.
    const durationMonths = rows.reduce((last, row, index) => row.total > 0 || row.balances.some((value) => value > 0) ? index + 1 : last, 0);
    return { schemaId: "finance-legacy-debt-roadmap/v1", readOnly: true, accounts, rows, totalPaid, totalLump, peak, durationMonths };
  }

  return { buildAccount, paymentFor, simulate, keepMonth };
});
