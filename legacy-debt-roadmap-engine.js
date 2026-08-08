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
    const discountAmount = amount * discount / 100;
    const afterDiscount = Math.max(0, amount - discountAmount);
    let lump = 0;
    let financed = 0;
    let monthly = 0;
    if (strategy === "settlement") lump = requestedLump > 0 ? requestedLump : afterDiscount;
    if (strategy === "refi") { lump = requestedLump; financed = afterDiscount * financePct / 100; monthly = paymentFor(financed, apr, term); }
    if (strategy === "hybrid") { lump = requestedLump; financed = Math.max(0, afterDiscount - lump) * financePct / 100; monthly = paymentFor(financed, apr, term); }
    return { amount, strategy, discount, discountAmount, afterDiscount, start, lump, apr, term, financePct, financed, monthly };
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
    const accounts = Array.isArray(config.accounts) ? config.accounts.map(buildAccount) : [];
    const balances = accounts.map((account) => account.financed);
    const rows = [];
    for (let index = 0; index < months; index += 1) {
      const month = index + 1;
      const payments = accounts.map((account, accountIndex) => {
        if (account.strategy === "hold") return 0;
        let value = month === account.start ? account.lump : 0;
        if (["refi", "hybrid"].includes(account.strategy) && month >= account.start && month < account.start + account.term && balances[accountIndex] > 0) {
          const interest = balances[accountIndex] * account.apr / 100 / 12;
          const principal = Math.min(balances[accountIndex], account.monthly - interest);
          value += principal + interest;
          balances[accountIndex] = Math.max(0, balances[accountIndex] - principal);
        }
        if (account.strategy === "settlement" && month >= account.start) balances[accountIndex] = 0;
        return round2(value);
      });
      const total = round2(payments.reduce((sum, value) => sum + value, 0));
      rows.push({ monthKey: monthKey(config.baseMonth, index), payments, balances: balances.map(round2), total, margin: round2(capacity - total) });
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

  return { buildAccount, paymentFor, simulate };
});
