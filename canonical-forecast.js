(function attachCanonicalForecast(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecast = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalForecastFactory() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-forecast/v1";
  const ASSUMPTIONS_SCHEMA_ID = "finance-forecast-assumptions/v1";
  const LEARNING_SCHEMA_ID = "finance-forecast-learning/v1";
  const CAUSAL_TREE_SCHEMA_ID = "finance-forecast-causal-tree/v1";
  const TOLERANCE = 0.02;
  const CAUSAL_TREE_COMPONENT_LABELS = {
    real: "Real (fuera de recurrencia)",
    recurrence: "Recurrente",
    event: "Evento puntual",
    debt: "Deuda (coche + refinanciación)",
    project: "Proyecto",
    manualAdjustment: "Ajuste manual",
  };

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
    // A15-1: los cinco supuestos fiscales del hogar entran en el mismo registro central que ya
    // versionaba los ocho anteriores (A7-2, hasta ahora sin ningún sitio que lo llamara) — un único
    // sitio editable, no uno nuevo en paralelo.
    ["fiscalJointTaxation", "Tributación conjunta", "boolean", "fiscal.jointTaxation"],
    ["fiscalWithholdingRate", "Retenciones aplicadas", "percent", "fiscal.withholdingRate"],
    ["fiscalDeductibleContributions", "Aportaciones deducibles anuales", "EUR", "fiscal.deductibleContributions"],
    ["fiscalDeductibleRent", "Alquiler deducible anual", "EUR", "fiscal.deductibleRent"],
    ["fiscalLargeFamily", "Familia numerosa", "boolean", "fiscal.largeFamily"],
  ];

  function valueAt(input, path) {
    return path.split(".").reduce((value, key) => value?.[key], input);
  }

  function buildAssumptionRegistry(input = {}, previous = {}, metadata = {}) {
    const previousItems = new Map((Array.isArray(previous?.items) ? previous.items : []).map((item) => [item.id, item]));
    const generatedAt = metadata.generatedAt || new Date().toISOString();
    const items = ASSUMPTION_DEFINITIONS.map(([id, label, unit, path]) => {
      const raw = valueAt(input, path);
      // A15-1: `raw !== false` daba `true` para un booleano sin configurar todavía (undefined) — un
      // sesgo silencioso hacia "sí" que nadie eligió. `=== true` exige un `true` explícito; ausencia
      // de dato es `false`, no una suposición.
      const value = unit === "boolean" ? raw === true : number(raw);
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

  function confidence(sample) {
    return sample >= 12 ? "high" : sample >= 6 ? "medium" : "low";
  }

  // PV2: la desviación media en euros (averageDelta) no dice por sí sola si una partida va "algo
  // desviada" o "muy desviada" — 50 € es ruido en una hipoteca de 900 € y una alarma en una cuota de
  // gimnasio de 40 €. deviationSeverity normaliza contra lo previsto medio (averagePlanned) para dar
  // tres bandas comparables entre partidas de tamaños muy distintos, mismo criterio de tres bandas
  // que cashSeverityBand (E16/CP5).
  const DEVIATION_SEVERITY_THRESHOLDS = { medium: 0.1, high: 0.25 };

  function deviationSeverity(averageDelta, averagePlanned) {
    const delta = Math.abs(number(averageDelta));
    const planned = Math.abs(number(averagePlanned));
    if (planned < 0.005) return delta < 0.005 ? "low" : "high";
    const ratio = delta / planned;
    if (ratio >= DEVIATION_SEVERITY_THRESHOLDS.high) return "high";
    if (ratio >= DEVIATION_SEVERITY_THRESHOLDS.medium) return "medium";
    return "low";
  }

  function learnFromHistory(records = [], metadata = {}) {
    const usable = records.filter((record) => record?.reconciled === true && /^\d{4}-\d{2}$/.test(text(record.monthKey)));
    const concepts = new Map();
    usable.forEach((record) => {
      const conceptId = text(record.conceptId || record.rowKey || record.label || "unclassified");
      if (!concepts.has(conceptId)) concepts.set(conceptId, { conceptId, label: text(record.label || conceptId), rows: [] });
      concepts.get(conceptId).rows.push(record);
    });
    const deviations = [...concepts.values()].map((concept) => {
      const comparable = concept.rows.filter((row) => Number.isFinite(Number(row.planned)) && Number.isFinite(Number(row.actual)));
      const deltas = comparable.map((row) => number(row.actual) - number(row.planned));
      const averageDelta = deltas.length ? round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length) : 0;
      const averagePlanned = comparable.length ? round(comparable.reduce((sum, row) => sum + number(row.planned), 0) / comparable.length) : 0;
      return {
        conceptId: concept.conceptId, label: concept.label, sampleMonths: comparable.length,
        averageDelta, averagePlanned, severity: deviationSeverity(averageDelta, averagePlanned),
        suggestedAdjustment: averageDelta, confidence: confidence(comparable.length),
        confirmRequired: true, applied: false,
      };
    }).filter((item) => item.sampleMonths > 0);
    const monthly = Array.from({ length: 12 }, (_, month) => ({ month: month + 1, values: [] }));
    usable.forEach((record) => monthly[Number(record.monthKey.slice(5, 7)) - 1]?.values.push(Math.abs(number(record.actual ?? record.amount))));
    const allValues = monthly.flatMap((item) => item.values);
    const overall = allValues.length ? allValues.reduce((sum, value) => sum + value, 0) / allValues.length : 0;
    const seasonality = monthly.map((item) => ({
      month: item.month, sampleSize: item.values.length,
      factor: overall && item.values.length ? round((item.values.reduce((sum, value) => sum + value, 0) / item.values.length) / overall) : 1,
      confidence: confidence(item.values.length),
    }));
    return {
      schemaId: LEARNING_SCHEMA_ID, generatedAt: metadata.generatedAt || new Date().toISOString(),
      source: "reconciled-ledger-only", includedRecords: usable.length, excludedRecords: records.length - usable.length,
      deviations, seasonality, warning: usable.length < 6 ? "Muestra insuficiente: no apliques ajustes sin revisión manual." : "",
    };
  }

  // PV4: bandas de confianza sobre la liquidez proyectada — no recalcula ninguna desviación, usa
  // las que ya calculó learnFromHistory().deviations (mismo aprendizaje de E12b que reutilizó PV2).
  // El margen base es la desviación media absoluta de las partidas con historial suficiente; crece
  // con la raíz del número de meses hacia delante (un mes 9 es más incierto que el mes 1: mismo
  // criterio de acumulación de error de un paseo aleatorio, no una suposición nueva por mes) y se
  // limita a MAX_WIDENING veces el margen base para que un forecast de varios años no termine con
  // una banda absurdamente ancha. Sin historial suficiente (deviations vacío), el margen es 0 en
  // toda la serie — una banda de ancho cero es honesta: "no hay suficiente aprendizaje para estimar
  // la incertidumbre todavía", no una anchura inventada.
  const CONFIDENCE_BAND_MAX_WIDENING = 3;

  function confidenceBands(series = [], learning = {}, options = {}) {
    const deviations = (Array.isArray(learning.deviations) ? learning.deviations : []).filter((item) => item.sampleMonths > 0);
    const baseMargin = deviations.length
      ? round(deviations.reduce((sum, item) => sum + Math.abs(number(item.averageDelta)), 0) / deviations.length)
      : 0;
    const bandConfidence = !deviations.length ? "low"
      : deviations.every((item) => item.confidence === "high") ? "high"
        : deviations.some((item) => item.confidence === "low") ? "low" : "medium";
    return series.map((row, index) => {
      const center = round(number(row.totals?.closingLiquidity ?? row.closingLiquidity));
      const widening = Math.min(CONFIDENCE_BAND_MAX_WIDENING, Math.sqrt(index + 1));
      const margin = round(baseMargin * widening);
      return {
        monthKey: text(row.monthKey), label: text(row.label),
        center, low: round(center - margin), high: round(center + margin), margin,
      };
    }).map((band) => ({ ...band, confidence: bandConfidence, sampleConcepts: deviations.length }));
  }

  // A16-3: detección de recurrentes/suscripciones. Reutiliza confidence() tal cual (mismo criterio
  // de confianza por tamaño de muestra que learnFromHistory) — mismo "aprendizaje de estacionalidad
  // de E12b" que pide la tarea, no un cálculo nuevo. Motor agnóstico de cómo se calculó el patrón:
  // recibe `pattern`/`label` ya resueltos (quien llama pasa movementMappingKey()/movementDisplayName(),
  // la misma clave de concepto que ya usan A-9/M-7/M-8 en vez de una segunda normalización de texto
  // en paralelo) y el importe exacto: dos cargos con el mismo concepto pero precio distinto (una
  // subida de tarifa) cuentan como grupos separados a propósito, para no fusionar un cambio de
  // precio real con el histórico anterior. Nunca escribe nada — cada resultado sale con
  // confirmRequired/confirmed, igual que las deviations de learnFromHistory, para que clasificar un
  // cargo como suscripción sea siempre una confirmación manual.
  function detectRecurringSubscriptions(movements = [], options = {}) {
    const minMonths = Math.max(2, Math.round(number(options.minMonths) || 3));
    const expenses = movements.filter((row) => number(row.amount) < 0 && text(row.pattern) && /^\d{4}-\d{2}/.test(text(row.month)));
    const groups = new Map();
    expenses.forEach((row) => {
      const amount = round(Math.abs(number(row.amount)));
      const key = `${text(row.pattern)}|${amount}`;
      if (!groups.has(key)) {
        groups.set(key, { pattern: text(row.pattern), label: text(row.label || row.pattern), category: text(row.category), amount, months: new Set() });
      }
      groups.get(key).months.add(text(row.month).slice(0, 7));
    });
    const detected = [...groups.values()]
      .filter((group) => group.months.size >= minMonths)
      .map((group) => ({
        pattern: group.pattern, label: group.label, category: group.category,
        monthlyCost: group.amount, annualCost: round(group.amount * 12),
        sampleMonths: group.months.size, confidence: confidence(group.months.size),
        // A16-4: los meses reales en que se vio el cargo, ordenados — hace falta para estimar cuándo
        // vuelve a cobrarse (A16-3 solo exponía el recuento, no las fechas).
        monthsSeen: [...group.months].sort(),
        confirmRequired: true, confirmed: false,
      }))
      .sort((a, b) => b.annualCost - a.annualCost);
    return {
      schemaId: `${LEARNING_SCHEMA_ID}/recurring-subscriptions/v1`,
      generatedAt: options.generatedAt || new Date().toISOString(),
      minMonths, detected,
      totalMonthlyCost: round(detected.reduce((sum, item) => sum + item.monthlyCost, 0)),
      totalAnnualCost: round(detected.reduce((sum, item) => sum + item.annualCost, 0)),
    };
  }

  function adaptiveHorizon(series = [], options = {}) {
    const monthlyUntil = Math.max(1, Math.round(number(options.monthlyUntil) || 12));
    const quarterlyUntil = Math.max(monthlyUntil, Math.round(number(options.quarterlyUntil) || 36));
    const groups = [];
    series.forEach((row, index) => {
      const period = index < monthlyUntil ? row.monthKey
        : index < quarterlyUntil ? `${text(row.monthKey).slice(0, 4)}-T${Math.floor((Number(text(row.monthKey).slice(5, 7)) - 1) / 3) + 1}`
          : text(row.monthKey).slice(0, 4);
      let group = groups.find((item) => item.period === period);
      if (!group) { group = { period, resolution: index < monthlyUntil ? "month" : index < quarterlyUntil ? "quarter" : "year", rows: [] }; groups.push(group); }
      group.rows.push(row);
    });
    return groups.map((group) => {
      const liquidity = group.rows.map((row) => number(row.totals?.closingLiquidity));
      return { period: group.period, resolution: group.resolution, sampleMonths: group.rows.length,
        minLiquidity: liquidity.length ? round(Math.min(...liquidity)) : 0,
        maxLiquidity: liquidity.length ? round(Math.max(...liquidity)) : 0,
        closingLiquidity: liquidity.length ? round(liquidity.at(-1)) : 0,
        display: group.resolution === "month" ? "point" : "range" };
    });
  }

  // PV1: autoajuste de la previsión por niveles de confianza — depende de PV5 y reutiliza
  // learnFromHistory() (E12b) tal cual. Antes de esto, cada desviación salía siempre con
  // `confirmRequired: true`/`applied: false`, a propósito (regla transversal: ninguna previsión se
  // ajusta sola sin que alguien lo confirme) — learnFromHistory() no cambia, sigue sin aplicar
  // nada. PV1 abre un canal nuevo y explícito, separado de esa marca, que solo actúa cuando la
  // muestra es lo bastante grande para llamarla evidencia (confianza "alta", el mismo umbral de
  // ≥12 meses que ya usa confidence()): con confianza media o baja, o con el interruptor
  // desactivado, no cambia nada — sigue siendo una sugerencia sin aplicar, igual que antes. Y solo
  // desplaza el cierre de caja proyectado (`closingChecking`/`closingLiquidity`), acumulado mes a
  // mes porque cada mes futuro hereda el saldo del anterior; nunca reescribe el desglose de
  // ingreso/gasto ni el ahorro aplicado, y cada mes lleva su propia marca `learnedBias` explícita —
  // la previsión sigue pareciendo previsión, nunca un dato real disfrazado.
  function applyLearnedBias(series = [], learning = {}, options = {}) {
    const enabled = options.enabled !== false;
    const conceptId = text(options.conceptId || "monthly-net");
    const deviations = Array.isArray(learning.deviations) ? learning.deviations : [];
    const deviation = deviations.find((item) => item.conceptId === conceptId) || null;
    const eligible = Boolean(enabled && deviation && deviation.confidence === "high");
    const monthlyAmount = eligible ? round(deviation.averageDelta) : 0;
    return series.map((month, index) => {
      const cumulativeAmount = eligible ? round(monthlyAmount * (index + 1)) : 0;
      const totals = eligible
        ? {
            ...month.totals,
            closingChecking: round(number(month.totals.closingChecking) + cumulativeAmount),
            closingLiquidity: round(number(month.totals.closingLiquidity) + cumulativeAmount),
          }
        : month.totals;
      return {
        ...month,
        totals,
        learnedBias: {
          conceptId, enabled, applied: eligible,
          confidence: deviation ? deviation.confidence : "low",
          sampleMonths: deviation ? deviation.sampleMonths : 0,
          monthlyAmount, cumulativeAmount,
        },
      };
    });
  }

  // PVX5 (Oleada 2 Bloque 5): árbol causal navegable de una cifra. Depende de A7-3
  // (decomposeMonth, ya en la serie del forecast) y de PV5 (el diario de por qué cambió cada
  // cifra) — no es un motor nuevo, es una vista combinada de los dos: la raíz es el flujo neto del
  // mes (ingresos menos salidas antes de ahorro), las ramas son ingresos/salidas y las hojas son el
  // mismo desglose real/recurrencia/evento/deuda/proyecto/ajuste manual que ya calcula
  // decomposeMonth. "event" hoy siempre sale a 0: el motor mensual no distingue todavía un evento
  // puntual de un ajuste manual, así que se declara la hoja igualmente en vez de omitirla, para que
  // no parezca un hueco de datos en lugar de una categoría del esquema sin uso real todavía. La
  // explicación causal de la raíz (por qué cambió el flujo neto de un cierre a otro) viene del
  // diario de PV5 cuando existe una entrada para ese mes exacto — PV5 solo aprende sobre el
  // concepto agregado "monthly-net", nunca por partida, así que esa explicación no baja a las
  // ramas ni a las hojas: fingir un desglose causal que el aprendizaje no reconstruye sería más
  // engañoso que no darlo.
  function causalTreeForMonth(monthKey, { series, diary } = {}) {
    const key = text(monthKey);
    const month = (Array.isArray(series) ? series : []).find((item) => item.monthKey === key);
    if (!key || !month) return { schemaId: CAUSAL_TREE_SCHEMA_ID, calculable: false };
    const income = round(number(month.totals?.income));
    const outflow = round(number(month.totals?.outflowsBeforeSaving));
    const leavesOf = (components = {}) => Object.keys(CAUSAL_TREE_COMPONENT_LABELS).map((id) => ({
      id, label: CAUSAL_TREE_COMPONENT_LABELS[id], amount: round(number(components[id])),
    }));
    const diaryEntries = (Array.isArray(diary) ? diary : [])
      .filter((entry) => entry.conceptId === "monthly-net" && entry.monthKey === key)
      .map((entry) => ({ reason: text(entry.reason), at: text(entry.at) }));
    return {
      schemaId: CAUSAL_TREE_SCHEMA_ID,
      calculable: true,
      monthKey: key,
      label: text(month.label),
      root: { id: "monthly-net", label: "Flujo neto del mes", amount: round(income - outflow), explanation: month.explanation || null, diary: diaryEntries },
      branches: [
        { id: "income", label: "Ingresos", amount: income, leaves: leavesOf(month.components?.income) },
        { id: "outflow", label: "Salidas (antes de ahorro)", amount: outflow, leaves: leavesOf(month.components?.outflow) },
      ],
    };
  }

  return { SCHEMA_ID, ASSUMPTIONS_SCHEMA_ID, LEARNING_SCHEMA_ID, CAUSAL_TREE_SCHEMA_ID, TOLERANCE, DEVIATION_SEVERITY_THRESHOLDS, CONFIDENCE_BAND_MAX_WIDENING, buildAssumptionRegistry, buildForecast, validateParity, learnFromHistory, adaptiveHorizon, deviationSeverity, detectRecurringSubscriptions, confidenceBands, applyLearnedBias, causalTreeForMonth };
});
