(function attachCanonicalE14Parity(root, factory) {
  const legacy = typeof module === "object" && module.exports ? require("./legacy-debt-roadmap-engine.js") : root?.FinanceLegacyDebtRoadmapEngine;
  const operations = typeof module === "object" && module.exports ? require("./canonical-e14-operations.js") : root?.FinanceCanonicalE14Operations;
  const api = factory(legacy, operations);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalE14Parity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalE14ParityFactory(Legacy, Operations) {
  "use strict";

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;

  function toCanonicalStrategies(config = {}) {
    if (!Legacy) return [];
    return (Array.isArray(config.accounts) ? config.accounts : []).map((raw, index) => {
      const account = Legacy.buildAccount(raw);
      const type = account.strategy === "settlement" ? "single-payment" : account.strategy === "hold" ? "hold" : "refinancing";
      return {
        id: `legacy-${index + 1}`,
        label: `Plan heredado ${index + 1}`,
        type,
        startMonth: Legacy.simulate({ ...config, accounts: [] }).rows[account.start - 1]?.monthKey || "",
        settlementAmount: account.strategy === "settlement" ? account.lump : account.afterDiscount,
        installment: account.monthly,
        termMonths: account.term,
        upfrontAmount: account.lump,
      };
    });
  }

  function parityForecast(config = {}) {
    const legacy = Legacy?.simulate(config);
    return { series: (legacy?.rows || []).map((row) => ({ monthKey: row.monthKey, totals: { closingLiquidity: 0 } })) };
  }

  function compare(config = {}, tolerance = 0.01) {
    if (!Legacy || !Operations) return { valid: false, reason: "missing-parity-dependencies", differences: ["missing-parity-dependencies"] };
    const legacy = Legacy.simulate(config);
    const canonical = Operations.simulatePortfolio(toCanonicalStrategies(config), parityForecast(config));
    const differences = [];
    const compareNumber = (label, left, right) => { if (Math.abs(number(left) - number(right)) > tolerance) differences.push(`${label}:${round2(left)}!=${round2(right)}`); };
    compareNumber("total-paid", legacy.totalPaid, canonical.totalCost);
    compareNumber("peak", legacy.peak, canonical.peakPayment);
    compareNumber("duration", legacy.durationMonths, canonical.durationMonths);
    legacy.rows.forEach((row, index) => compareNumber(`month-${row.monthKey}`, row.total, canonical.rows[index]?.payment));
    return { schemaId: "finance-e14-debt-parity/v1", tolerance, legacy, canonical, valid: differences.length === 0, differences };
  }

  return { toCanonicalStrategies, compare };
});
