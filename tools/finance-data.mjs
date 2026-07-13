import fs from "node:fs";
import vm from "node:vm";

export function loadPackagedFinanceData(filePath = new URL("../data.js", import.meta.url)) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), context, { filename: String(filePath) });
  const data = context.window.FINANCE_DATA || context.FINANCE_DATA;
  if (!data) throw new Error("data.js no expone FINANCE_DATA");
  return JSON.parse(JSON.stringify(data));
}

export function financeDataSummary(data) {
  const months = data.monthlyPlanning?.months || [];
  const sections = data.monthlyPlanning?.sections || [];
  const transactions = data.transactions || [];
  const plannedTotals = sections.reduce(
    (totals, section) => {
      const key = section.kind === "income" ? "income" : "expense";
      section.rows.forEach((row) => {
        (row.planned || []).forEach((value) => {
          totals[key] += Number(value || 0);
        });
      });
      return totals;
    },
    { income: 0, expense: 0 },
  );
  return {
    sourceWorkbook: data.metadata?.sourceWorkbook || "",
    valuationDate: data.sourceBalances?.valuationDate || "",
    balances: {
      caixa: Number(data.sourceBalances?.caixaBalance || 0),
      mediolanum: Number(data.sourceBalances?.mediolanumBalance || 0),
      total: Number(data.sourceBalances?.totalBalance || 0),
    },
    assumptions: {
      initialCash: Number(data.assumptions?.initialCash || 0),
      monthlyIncome: Number(data.assumptions?.monthlyIncome || 0),
      coreSpend: Number(data.assumptions?.coreSpend || 0),
      recommendedSavings: Number(data.assumptions?.recommendedSavings || 0),
    },
    counts: {
      months: months.length,
      sections: sections.length,
      planningRows: sections.reduce((sum, section) => sum + section.rows.length, 0),
      transactions: transactions.length,
      categories: data.categoryMonthly?.length || 0,
      merchants: data.topMerchants?.length || 0,
    },
    range: {
      firstMonth: months[0]?.key || "",
      lastMonth: months.at(-1)?.key || "",
      firstTransaction: transactions[0]?.date || "",
      lastTransaction: transactions.at(-1)?.date || "",
    },
    plannedTotals: {
      income: Number(plannedTotals.income.toFixed(2)),
      expense: Number(plannedTotals.expense.toFixed(2)),
    },
  };
}

export function findNonFinite(value, path = "FINANCE_DATA", findings = []) {
  if (typeof value === "number" && !Number.isFinite(value)) findings.push(path);
  if (Array.isArray(value)) value.forEach((child, index) => findNonFinite(child, `${path}[${index}]`, findings));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => findNonFinite(child, `${path}.${key}`, findings));
  }
  return findings;
}
