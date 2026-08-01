(function attachCanonicalForecast(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecast = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalForecastFactory() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-forecast/v1";
  const ASSUMPTIONS_SCHEMA_ID = "finance-forecast-assumptions/v1";
  const TOLERANCE = 0.02;

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function hash(value) {
    let result = 2166136261;
    const source = typeof value === "string" ? value : stableStringify(value);
    for (let index = 0; index < source.length; index += 1) {
      result ^= source.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  const ASSUMPTION_DEFINITIONS = [
    ["openingChecking", "Saldo inicial de la cuenta operativa", "EUR", "openingBalances.checking"],
    ["openingSavings", "Saldo inicial de ahorro", "EUR", "openingBalances.savings"],
    ["incomeFactor", "Factor general de ingresos", "ratio", "policy.incomeFactor"],
    ["annualIncomeGrowth", "Crecimiento anual de ingresos", "percent", "policy.annualIncomeGrowth"],
    ["expenseFactor", "Factor general de gastos", "ratio", "policy.expenseFactor"],
    ["annualInflation", "Inflación anual de gastos", "percent", "policy.annualInflation"],
    ["plannedMonthlySaving", "Ahorro mensual objetivo", "EUR", "policy.plannedMonthlySaving"],
    ["autoCapSavings", "Ajuste automático del ahorro", "boolean", "policy.autoCapSavings"],
  ];

  function valueAt(input, path) {
    return path.split(".").reduce((value, key) => value?.[key], input);
  }

  function buildAssumptionRegistry(input = {}, previous = {}, metadata = {}) {
    const previousItems = new Map((Array.isArray(previous?.items) ? previous.items : []).map((item) => [item.id, item]));
    const generatedAt = metadata.generatedAt || new Date().toISOString();
    const items = ASSUMPTION_DEFINITIONS.map(([id, label, unit, path]) => {
      const raw = valueAt(input, path);
      const value = unit === "boolean" ? raw !== false : number(raw);
      const prior = previousItems.get(id);
      const unchanged = prior && prior.value === value;
      return {
        id, label, unit, value,
        source: text(metadata.source || prior?.source || "configuración del plan"),
        method: "user-setting",
        updatedAt: unchanged ? prior.updatedAt : generatedAt,
      };
    });
    const fingerprint = hash(items.map(({ updatedAt, ...item }) => item));
    return { schemaId: ASSUMPTIONS_SCHEMA_ID, version: 1, generatedAt, fingerprint, items };
  }

  function decomposeMonth(month = {}, row = {}, index = 0) {
    const incomeRecurring = round(month.income ?? month.baseIncome);
    const incomeAdjustment = round(number(row.income) - incomeRecurring);
    const fixedRecurring = round(Math.max(0, number(month.coreSpend ?? month.baseCoreSpend) - number(month.variableOperationalSpend ?? month.baseVariableOperationalSpend)));
    const variableRecurring = round(month.variableOperationalSpend ?? month.baseVariableOperationalSpend);
    const coreAdjustment = round(number(row.coreSpend) - fixedRecurring - variableRecurring);
    const debt = round(number(row.car) + number(row.refi));
    const project = round(row.projectOutflow);
    return {
      index: number(row.index) || index + 1,
      monthKey: text(row.detailMonthKey || month.monthKey),
      label: text(row.month || month.month),
      totals: {
        income: round(row.income),
        outflowsBeforeSaving: round(row.outflowsBeforeSaving),
        saving: round(row.saving),
        closingChecking: round(row.checking),
        closingSavings: round(row.savings),
        closingLiquidity: round(row.totalLiquidity),
      },
      components: {
        income: { real: 0, recurrence: incomeRecurring, event: 0, debt: 0, project: 0, manualAdjustment: incomeAdjustment },
        outflow: { real: 0, recurrence: round(fixedRecurring + variableRecurring), event: 0, debt, project, manualAdjustment: coreAdjustment },
      },
      explanation: {
        origin: "planificación mensual canónica",
        method: "motor mensual + supuestos versionados",
        confidence: "rule",
      },
    };
  }

  function validateParity(series = [], rows = [], tolerance = TOLERANCE) {
    const differences = [];
    const fields = ["income", "outflowsBeforeSaving", "saving", "closingChecking", "closingSavings", "closingLiquidity"];
    const rowFields = { income: "income", outflowsBeforeSaving: "outflowsBeforeSaving", saving: "saving", closingChecking: "checking", closingSavings: "savings", closingLiquidity: "totalLiquidity" };
    const count = Math.max(series.length, rows.length);
    for (let index = 0; index < count; index += 1) {
      const month = series[index];
      const row = rows[index];
      if (!month || !row) {
        differences.push({ index, field: "row", forecast: Boolean(month), canonical: Boolean(row) });
        continue;
      }
      fields.forEach((field) => {
        const forecastValue = number(month.totals[field]);
        const canonicalValue = number(row[rowFields[field]]);
        const delta = Math.abs(forecastValue - canonicalValue);
        if (delta > tolerance) differences.push({ index, monthKey: month.monthKey, field, forecast: forecastValue, canonical: canonicalValue, delta: round(delta) });
      });
    }
    return { matched: differences.length === 0, tolerance, checkedMonths: Math.min(series.length, rows.length), differences };
  }

  function buildForecast(input = {}, canonicalScenario = {}, previousAssumptions = {}, metadata = {}) {
    const rows = Array.isArray(canonicalScenario?.rows) ? canonicalScenario.rows : [];
    const months = Array.isArray(input?.months) ? input.months : [];
    const assumptions = buildAssumptionRegistry(input, previousAssumptions, metadata);
    const series = rows.map((row, index) => decomposeMonth(months[index], row, index));
    const parity = validateParity(series, rows, metadata.tolerance ?? TOLERANCE);
    const fingerprint = hash({ engineFingerprint: canonicalScenario?.fingerprint || canonicalScenario?.snapshot?.fingerprint || "", assumptions: assumptions.fingerprint, series });
    return {
      schemaId: SCHEMA_ID,
      version: 1,
      generatedAt: metadata.generatedAt || canonicalScenario?.generatedAt || new Date().toISOString(),
      source: "canonical-engine",
      method: "deterministic-baseline",
      engineFingerprint: canonicalScenario?.fingerprint || canonicalScenario?.snapshot?.fingerprint || "",
      assumptions,
      assumptionsFingerprint: assumptions.fingerprint,
      fingerprint,
      series,
      parity,
      valid: Boolean(canonicalScenario?.invariants?.valid) && parity.matched,
    };
  }

  return { SCHEMA_ID, ASSUMPTIONS_SCHEMA_ID, TOLERANCE, buildAssumptionRegistry, buildForecast, validateParity };
});
