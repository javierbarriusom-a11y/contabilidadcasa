import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const start = new Date(2026, 6, 1);
const months = Array.from({ length: 126 }, (_, index) => {
  const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    label: date.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
  };
});

const series = (amount, annualExtra = 0) =>
  months.map((month) => (annualExtra && month.key.endsWith("-12") ? amount + annualExtra : amount));

const row = (id, label, rowNumber, kind, amount, annualExtra = 0) => ({
  id,
  label,
  row: rowNumber,
  kind,
  planned: series(amount, annualExtra),
});

const data = {
  metadata: {
    generatedAt: "2026-07-31T00:00:00.000Z",
    sourceWorkbook: "demo-publico-anonimizado",
    sourceWorkbookStatus: "Demostración anonimizada · importa o sincroniza tus datos para trabajar",
    forecastStart: "2026-07-01",
    forecastMonths: months.length,
    currency: "EUR",
    publicDemo: true,
  },
  assumptions: {
    initialCash: 9000,
    caixaBalanceBeforeCar: 7200,
    newAccountBalance: 1800,
    currentCarAdjustment: 0,
    monthlyIncome: 5000,
    baseHouseholdIncome: 5000,
    coreSpend: 2800,
    otherFixedNonDebt: 850,
    variableSpendTarget: 700,
    mortgagePayment: 750,
    carPayment: 0,
    carEndDate: "",
    refiFirstPayment: 300,
    remainingHighRefiPayments: 0,
    refiPlanBase: 300,
    refiExtra: 0,
    refiLaterPayment: 300,
    refiTermYearsApprox: 4,
    extraDebts: [],
    recommendedSavings: 800,
    emergencyBufferMonths: 4,
    annualInflation: 0,
    annualIncomeGrowth: 0,
  },
  sourcePlan: {
    baseHouseholdIncome: 5000,
    incomeWithExtrasProrated: 5200,
    extraApril: 0,
    extraDecember: 2400,
    mortgagePayment: 750,
    bmwPayment: 0,
    unifiedCreditPayment: 300,
    otherFixedNonDebt: 850,
    variableSpendTarget: 700,
    initialEmergencyFund: 1800,
    emergencyBufferMonths: 4,
    debtServiceMonthlyTotal: 1050,
    debtToIncomeRatio: 0.21,
    totalSpendTarget: 3850,
    monthlySavingPotential: 1150,
    savingsRate: 0.23,
    emergencyFundTarget: 15400,
    emergencyFundGap: 13600,
    recommendedSaving: 800,
    suggestedAmortization: 0,
    bankinterOutsidePlanPayment: 0,
    cetelemOutsidePlanPayment: 0,
    carEndDate: "",
    bankinterEndDate: "",
    cetelemEndDate: "",
    monthWithoutBmwCetelem: "2026-07-31",
    oldDebtPrincipal: 12000,
    oldDebtMonthlyPayments: 300,
  },
  sourceBalances: {
    valuationDate: "2026-07-31",
    caixaBalance: 7200,
    mediolanumBalance: 1800,
    totalBalance: 9000,
  },
  monthlyPlanning: {
    months,
    sections: [
      {
        name: "Ingresos",
        kind: "income",
        rows: [
          row("income-a", "Ingreso Persona A", 6, "income", 3000, 1800),
          row("income-b", "Ingreso Persona B", 7, "income", 2000, 600),
        ],
      },
      {
        name: "Gastos fijos",
        kind: "expense",
        rows: [
          row("expense-home", "Vivienda", 20, "expense", 750),
          row("expense-living", "Gastos del hogar", 21, "expense", 1350),
          row("expense-services", "Servicios", 22, "expense", 400),
        ],
      },
      {
        name: "Gastos variables",
        kind: "expense",
        rows: [row("variable-operational-spend", "Gasto variable estimado", 40, "expense", 700)],
      },
      {
        name: "Financiaciones",
        kind: "expense",
        rows: [row("demo-financing", "Entidad de ejemplo · acuerdo", 61, "expense", 300)],
      },
    ],
  },
  derived: {
    coreMonthlyAverageJanMar2026: 2800,
    incomeMonthlyAverageJanMar2026: 5000,
    monthlySurplusAfterRefiAndCar: 1150,
    oldCreditMonthlyAverageJanMar2026: 300,
    oldCreditPrincipal: 12000,
    debtToIncomeRatio: 0.21,
    planSavingsRate: 0.23,
    emergencyFundTarget: 15400,
    emergencyFundGap: 13600,
  },
  categoryMonthly: [],
  topMerchants: [],
  transactions: [],
};

const output = `window.FINANCE_DATA = ${JSON.stringify(data)};\n`;
fs.writeFileSync(path.join(root, "data.js"), output);
