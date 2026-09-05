(function attachCanonicalE13(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalE13 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalE13Factory() {
  "use strict";

  const SCHEMA_ID = "finance-e13-scenario-lab/v1";
  const SAVED_SCHEMA_ID = "finance-e13-saved-scenario/v1";
  // A14-5: dos eventos que no tocan la caja (a diferencia de los cinco de arriba) sino el valor de
  // los activos declarados (A14-1) — "amount" pasa a ser un porcentaje (0-100), no un importe en
  // euros. Reutilizan este mismo motor, sin motor nuevo: cada uno tiene un tipo de activo objetivo y
  // un signo fijo (una caída de mercado siempre resta, una revalorización siempre suma).
  const EVENT_TYPES = Object.freeze(["income-loss", "expense", "car", "move", "debt", "market-crash", "property-revaluation"]);
  const ASSET_SHOCK_TARGET_TYPE = Object.freeze({ "market-crash": "inversion", "property-revaluation": "inmueble" });
  const PROFILES = Object.freeze([
    { id: "base", label: "Base", incomeFactor: 1, expenseFactor: 1 },
    { id: "favorable", label: "Favorable", incomeFactor: 1.03, expenseFactor: 0.97 },
    { id: "stress", label: "Tensión", incomeFactor: 0.9, expenseFactor: 1.1 },
  ]);

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

  function quantile(values, position) {
    if (!values.length) return 0;
    const ordered = values.slice().sort((a, b) => a - b);
    const index = (ordered.length - 1) * position;
    const lower = Math.floor(index); const upper = Math.ceil(index);
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower));
  }

  function assumptionValue(forecast, id, fallback = 0) {
    const item = (forecast?.assumptions?.items || []).find((candidate) => candidate.id === id);
    return item ? item.value : fallback;
  }

  function normalizeEvent(raw = {}, index = 0) {
    const type = EVENT_TYPES.includes(raw.type) ? raw.type : "expense";
    return {
      id: text(raw.id || `event-${index + 1}`),
      type,
      label: text(raw.label || type),
      monthKey: text(raw.monthKey),
      amount: Math.max(0, round(raw.amount)),
      duration: Math.max(1, Math.round(number(raw.duration) || 1)),
      // FCST-2 (FASE 7): etiqueta opcional a una categoría de presupuesto ("" = sin categoría,
      // comportamiento idéntico al de siempre: el evento solo afecta a la caja agregada). No
      // participa en simulate() — es metadato que Presupuesto del mes lee para sumar este importe
      // al forecast por categoría en los meses que el evento cubre, sin tocar este motor.
      categoryId: text(raw.categoryId || ""),
    };
  }

  function eventImpact(event, monthIndex, startIndex) {
    // A14-5: una caída de mercado o una revalorización del inmueble no son un gasto ni un ingreso —
    // no deben sumar ni restar de la caja proyectada, solo del patrimonio (assetImpact() más abajo).
    if (ASSET_SHOCK_TARGET_TYPE[event.type]) return { income: 0, outflow: 0, debt: 0 };
    if (startIndex < 0 || monthIndex < startIndex || monthIndex >= startIndex + event.duration) return { income: 0, outflow: 0, debt: 0 };
    if (event.type === "income-loss") return { income: -event.amount, outflow: 0, debt: 0 };
    return { income: 0, outflow: event.amount, debt: event.type === "debt" ? event.amount : 0 };
  }

  // A14-5: impacto de los eventos de patrimonio (caída de mercado / revalorización del inmueble)
  // sobre los activos declarados (A14-1) — independiente del perfil (Base/Favorable/Tensión), porque
  // esos factores solo afectan a ingresos y gastos, no al valor de un activo. Varios eventos sobre el
  // mismo tipo de activo se componen (encadenan), no se suman: dos caídas del 20% dejan un 64% del
  // valor original, no un 60%. Sin activos declarados o sin ningún evento de este tipo, no hay
  // patrimonio que simular — null, nunca un 0 inventado.
  function assetImpact(assets = [], events = []) {
    const shocks = events.filter((event) => ASSET_SHOCK_TARGET_TYPE[event.type]);
    if (!assets.length || !shocks.length) return null;
    const netWorthBefore = round(assets.reduce((sum, asset) => sum + number(asset.value), 0));
    const adjusted = assets.map((asset) => {
      const factor = shocks
        .filter((event) => ASSET_SHOCK_TARGET_TYPE[event.type] === asset.type)
        .reduce((acc, event) => acc * (1 + (event.type === "market-crash" ? -1 : 1) * (event.amount / 100)), 1);
      return factor === 1 ? asset : { ...asset, value: round(Math.max(0, number(asset.value) * factor)) };
    });
    const netWorthAfter = round(adjusted.reduce((sum, asset) => sum + number(asset.value), 0));
    return {
      schemaId: `${SCHEMA_ID}/asset-impact-v1`,
      netWorthBefore,
      netWorthAfter,
      delta: round(netWorthAfter - netWorthBefore),
      shocks: shocks.map((event) => ({ id: event.id, type: event.type, label: event.label, pct: event.amount, targetType: ASSET_SHOCK_TARGET_TYPE[event.type] })),
    };
  }

  function recoveryMonth(rows) {
    const firstNegative = rows.findIndex((row) => row.closingChecking < 0);
    if (firstNegative < 0) return null;
    const recovered = rows.find((row, index) => index > firstNegative && row.closingChecking >= 0);
    return recovered?.monthKey || "not-recovered";
  }

  function simulate(forecast = {}, profile = PROFILES[0], rawEvents = []) {
    const source = Array.isArray(forecast?.series) ? forecast.series : [];
    const events = rawEvents.map(normalizeEvent);
    let checking = number(assumptionValue(forecast, "openingChecking"));
    let savings = number(assumptionValue(forecast, "openingSavings"));
    const autoCapSavings = assumptionValue(forecast, "autoCapSavings", true) !== false;
    let debtImpact = 0;
    const rows = source.map((month, index) => {
      const impacts = events.reduce((total, event) => {
        const impact = eventImpact(event, index, source.findIndex((item) => item.monthKey === event.monthKey));
        total.income += impact.income;
        total.outflow += impact.outflow;
        total.debt += impact.debt;
        return total;
      }, { income: 0, outflow: 0, debt: 0 });
      // ESX3: `|| 1` trataba un incomeFactor/expenseFactor de 0 (pérdida total de ingreso, motor
      // inverso probando ese extremo) como "no viene dato" y lo sustituía por 1 — 0 es un valor
      // válido, no una ausencia. `Number.isFinite` distingue las dos cosas de verdad.
      const income = round(number(month.totals?.income) * (Number.isFinite(profile.incomeFactor) ? profile.incomeFactor : 1) + impacts.income);
      const outflows = round(number(month.totals?.outflowsBeforeSaving) * (Number.isFinite(profile.expenseFactor) ? profile.expenseFactor : 1) + impacts.outflow);
      const targetSaving = number(month.totals?.saving);
      const available = checking + income - outflows;
      const saving = autoCapSavings ? round(Math.max(0, Math.min(targetSaving, available - outflows))) : round(targetSaving);
      checking = round(available - saving);
      savings = round(savings + saving);
      debtImpact = round(debtImpact + impacts.debt);
      return {
        monthKey: month.monthKey,
        label: month.label,
        income,
        outflows,
        saving,
        closingChecking: checking,
        closingSavings: savings,
        closingLiquidity: round(checking + savings),
        eventIncome: round(impacts.income),
        eventOutflow: round(impacts.outflow),
        debtImpact: round(impacts.debt),
      };
    });
    const negativeMonths = rows.filter((row) => row.closingChecking < 0).length;
    return {
      id: profile.id,
      label: profile.label,
      profile: { incomeFactor: profile.incomeFactor, expenseFactor: profile.expenseFactor },
      rows,
      metrics: {
        minChecking: rows.length ? Math.min(...rows.map((row) => row.closingChecking)) : 0,
        negativeMonths,
        finalSavings: rows.at(-1)?.closingSavings || savings,
        finalLiquidity: rows.at(-1)?.closingLiquidity || checking + savings,
        debtImpact,
        recoveryMonth: recoveryMonth(rows),
      },
    };
  }

  function buildLab(forecast = {}, events = [], metadata = {}) {
    if (forecast?.schemaId !== "finance-canonical-forecast/v1" || forecast?.valid !== true) {
      throw new Error("E13a requiere un forecast canónico válido.");
    }
    const normalizedEvents = events.map(normalizeEvent);
    return {
      schemaId: SCHEMA_ID,
      generatedAt: metadata.generatedAt || new Date().toISOString(),
      sourceForecastFingerprint: forecast.fingerprint,
      readOnly: true,
      writesPlan: false,
      events: normalizedEvents,
      scenarios: PROFILES.map((profile) => simulate(forecast, profile, normalizedEvents)),
      // A14-5: sin `metadata.assets` (llamadas de antes de A14-5, o un hogar sin activos
      // registrados), assetImpact queda exactamente igual que sin esta tarea — null.
      assetImpact: assetImpact(Array.isArray(metadata.assets) ? metadata.assets : [], normalizedEvents),
    };
  }

  function prudentSimulation(forecast = {}, events = [], options = {}) {
    const observations = (options.history || []).filter((item) => item?.reconciled === true && Number.isFinite(Number(item.amount))).map((item) => number(item.amount));
    const manualRange = options.manualRange || {};
    const enoughHistory = observations.length >= 6;
    const range = enoughHistory
      ? { p10: quantile(observations, 0.1), p50: quantile(observations, 0.5), p90: quantile(observations, 0.9) }
      : { p10: number(manualRange.min), p50: number(manualRange.base), p90: number(manualRange.max) };
    return { schemaId: `${SCHEMA_ID}/prudent-v1`, source: enoughHistory ? "reconciled-history" : "manual-range",
      sampleSize: observations.length, percentiles: range, calibrated: enoughHistory,
      warning: enoughHistory ? "" : "Muestra corta: percentiles derivados de rangos manuales, no de una probabilidad observada.",
      baseline: buildLab(forecast, events, options), writesPlan: false };
  }

  // ESX1: Monte Carlo de cientos de trayectorias sobre la incertidumbre YA calibrada por
  // prudentSimulation() (A8-3) — nunca una distribución inventada aparte. Con solo tres percentiles
  // conocidos (P10/P50/P90, del historial real conciliado o del rango manual declarado si no hay
  // historial suficiente) la estimación de tres puntos habitual es un triángulo(P10, P50, P90);
  // se declara así, no se disfraza de distribución real medida. Cada mes del horizonte recibe una
  // desviación aleatoria de ese triángulo, que se acumula sobre el cierre de caja del escenario base
  // — mismo patrón que ya usa PV1 (applyLearnedBias) para acumular una desviación mensual sobre el
  // horizonte, aquí hecho estocástico en vez de determinista. Acotado a un número de trayectorias
  // moderado (cientos, no miles) para que quepa en el hilo principal sin arriesgar el presupuesto de
  // rendimiento de OPT-5 — decisión explícita del usuario en vez de miles de trayectorias con Web
  // Worker.
  const MONTE_CARLO_DEFAULT_TRAJECTORIES = 300;
  const MONTE_CARLO_MAX_TRAJECTORIES = 500;

  function triangularSample(min, mode, max, randomFn) {
    if (max <= min) return mode;
    const u = randomFn();
    const cutoff = (mode - min) / (max - min);
    return u < cutoff
      ? min + Math.sqrt(u * (max - min) * (mode - min))
      : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }

  function monteCarloSimulation(forecast = {}, events = [], options = {}) {
    const monteCarloSchemaId = `${SCHEMA_ID}/monte-carlo-v1`;
    const prudent = prudentSimulation(forecast, events, options);
    const { p10, p50, p90 } = prudent.percentiles;
    const baseline = prudent.baseline.scenarios.find((scenario) => scenario.id === "base") || prudent.baseline.scenarios[0];
    const monthCount = baseline?.rows?.length || 0;
    // p90 < p10 solo puede venir de un rango manual invertido (mínimo declarado por encima del
    // máximo) — un dato mal introducido, no una incertidumbre real que simular.
    if (!monthCount || !Number.isFinite(p10) || !Number.isFinite(p90) || p90 < p10) {
      return { schemaId: monteCarloSchemaId, calculable: false, prudent };
    }
    const trajectories = Math.max(1, Math.min(MONTE_CARLO_MAX_TRAJECTORIES, Math.round(number(options.trajectories) || MONTE_CARLO_DEFAULT_TRAJECTORIES)));
    const randomFn = typeof options.randomFn === "function" ? options.randomFn : Math.random;
    const minCheckings = [];
    let breaches = 0;
    for (let trajectory = 0; trajectory < trajectories; trajectory += 1) {
      let cumulativeDeviation = 0;
      let worst = Infinity;
      for (let month = 0; month < monthCount; month += 1) {
        cumulativeDeviation = round(cumulativeDeviation + triangularSample(p10, p50, p90, randomFn));
        const checking = round(number(baseline.rows[month].closingChecking) + cumulativeDeviation);
        if (checking < worst) worst = checking;
      }
      minCheckings.push(worst);
      if (worst < 0) breaches += 1;
    }
    minCheckings.sort((a, b) => a - b);
    return {
      schemaId: monteCarloSchemaId,
      calculable: true,
      trajectories,
      maxTrajectories: MONTE_CARLO_MAX_TRAJECTORIES,
      monthCount,
      source: prudent.source,
      calibrated: prudent.calibrated,
      warning: prudent.warning,
      breachProbabilityPct: round((breaches / trajectories) * 100),
      minCheckingPercentiles: { p10: quantile(minCheckings, 0.1), p50: quantile(minCheckings, 0.5), p90: quantile(minCheckings, 0.9) },
      writesPlan: false,
    };
  }

  function correlateRisks(events = [], rules = []) {
    const normalized = events.map(normalizeEvent);
    const blockedPairs = [];
    rules.forEach((rule) => {
      if (rule?.relationship !== "incompatible") return;
      const left = normalized.find((event) => event.id === rule.leftId);
      const right = normalized.find((event) => event.id === rule.rightId);
      if (left && right) blockedPairs.push({ leftId: left.id, rightId: right.id, reason: text(rule.reason || "Riesgos incompatibles") });
    });
    return { events: normalized, rules: clone(rules), valid: blockedPairs.length === 0, blockedPairs,
      assumption: rules.length ? "explicit-rules" : "independence-not-assumed" };
  }

  function sensitivity(forecast = {}, events = [], options = {}) {
    const baseline = simulate(forecast, PROFILES[0], events).metrics.minChecking;
    const variations = [
      { id: "income", label: "Ingresos", field: "incomeFactor", delta: -Math.abs(number(options.step) || 0.1) },
      { id: "expenses", label: "Gastos", field: "expenseFactor", delta: Math.abs(number(options.step) || 0.1) },
      { id: "events", label: "Eventos", field: "eventFactor", delta: Math.abs(number(options.step) || 0.1) },
    ].map((factor) => {
      const profile = { ...PROFILES[0], [factor.field]: 1 + factor.delta };
      const adjustedEvents = factor.id === "events" ? events.map((event) => ({ ...event, amount: number(event.amount) * (1 + factor.delta) })) : events;
      const result = simulate(forecast, profile, adjustedEvents).metrics.minChecking;
      const impact = round(result - baseline);
      return { ...factor, impact, absoluteImpact: Math.abs(impact), breakEvenChange: impact < 0 && baseline > 0 ? round((baseline / Math.abs(impact)) * Math.abs(factor.delta)) : null };
    }).sort((left, right) => right.absoluteImpact - left.absoluteImpact);
    return { schemaId: `${SCHEMA_ID}/sensitivity-v1`, baselineMinChecking: baseline, dominantFactors: variations.slice(0, 3) };
  }

  // ESX4: malla de dos supuestos cruzados. sensitivity() ya varía ingresos/gastos/eventos uno a la
  // vez (one-at-a-time); esta malla varía ingresos Y gastos a la vez sobre una cuadrícula de pasos
  // simétricos alrededor del caso base — reutiliza tal cual simulate() (A8-1), sin motor nuevo. Cinco
  // pasos por eje (±10% en incrementos de 5% con el paso por defecto) para que la malla se lea de un
  // vistazo, no un mapa de calor de precisión artificial.
  const GRID_STEPS = Object.freeze([-2, -1, 0, 1, 2]);

  function sensitivityGrid(forecast = {}, events = [], options = {}) {
    const step = Math.abs(number(options.step) || 0.05);
    const baseline = simulate(forecast, PROFILES[0], events).metrics.minChecking;
    const rows = GRID_STEPS.map((incomeStep) => ({
      incomeDeltaPct: round(incomeStep * step * 100),
      cells: GRID_STEPS.map((expenseStep) => {
        const profile = { ...PROFILES[0], incomeFactor: 1 + incomeStep * step, expenseFactor: 1 + expenseStep * step };
        const minChecking = simulate(forecast, profile, events).metrics.minChecking;
        return { expenseDeltaPct: round(expenseStep * step * 100), minChecking: round(minChecking), impact: round(minChecking - baseline) };
      }),
    }));
    return { schemaId: `${SCHEMA_ID}/sensitivity-grid-v1`, step, baselineMinChecking: round(baseline), rows };
  }

  // ESX3: escenario inverso — «¿qué tendría que cambiar?». Depende de A8-6 (sensitivity(), que ya
  // identifica el factor dominante pero solo con una extrapolación lineal de un único paso de
  // prueba) y de PV6 (verdictSensitivity(), que ya resuelve el punto de cruce EXACTO pero solo para
  // el mínimo ajustado de un mes concreto de Previsión). Aquí se busca el punto de cruce exacto —
  // por bisección sobre el propio simulate() (A8-1), nunca una extrapolación — para el horizonte
  // completo (minChecking de toda la simulación base), factor a factor. Ningún motor de simulación
  // nuevo: la bisección solo llama repetidamente a simulate(), ya existente.
  function findFactorCrossing(probe, lowerBound, upperBound, { tolerance = 0.5, maxIterations = 30 } = {}) {
    const lowerValue = probe(lowerBound);
    const upperValue = probe(upperBound);
    if (lowerValue === 0) return lowerBound;
    if (upperValue === 0) return upperBound;
    if (Math.sign(lowerValue) === Math.sign(upperValue)) return null;
    let low = lowerBound; let high = upperBound; let lowValue = lowerValue;
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const mid = (low + high) / 2;
      const midValue = probe(mid);
      if (Math.abs(midValue) <= tolerance) return mid;
      if (Math.sign(midValue) === Math.sign(lowValue)) { low = mid; lowValue = midValue; } else { high = mid; }
    }
    return (low + high) / 2;
  }

  function inverseScenario(forecast = {}, events = [], options = {}) {
    const minCheckingWith = (profile, adjustedEvents = events) => simulate(forecast, profile, adjustedEvents).metrics.minChecking;
    const baseline = round(minCheckingWith(PROFILES[0]));
    const verdict = baseline >= 0 ? "safe" : "danger";
    // Un plan ya roto hoy no tiene "punto de cruce" que buscar hacia delante — decirlo en vez de
    // fabricar un porcentaje sin sentido sobre un veredicto que ya es negativo.
    if (verdict === "danger") return { schemaId: `${SCHEMA_ID}/inverse-scenario-v1`, verdict, baselineMinChecking: baseline, alreadyBroken: true, factors: [] };

    const incomeCrossing = findFactorCrossing((factor) => minCheckingWith({ ...PROFILES[0], incomeFactor: factor }), 0, 1);
    const expenseCeiling = Math.max(1, number(options.expenseCeiling) || 3);
    const expenseCrossing = findFactorCrossing((factor) => minCheckingWith({ ...PROFILES[0], expenseFactor: factor }), 1, expenseCeiling);

    const factors = [
      { id: "income", label: "Ingresos", calculable: incomeCrossing !== null,
        dropPercent: incomeCrossing !== null ? round((1 - incomeCrossing) * 100) : null,
        note: incomeCrossing !== null ? "" : "Ni perdiendo todo el ingreso (bajada del 100%) se rompe el plan en este horizonte." },
      { id: "expenses", label: "Gastos", calculable: expenseCrossing !== null,
        risePercent: expenseCrossing !== null ? round((expenseCrossing - 1) * 100) : null,
        note: expenseCrossing !== null ? "" : `Ni multiplicando el gasto por ${expenseCeiling} se rompe el plan en el rango explorado.` },
    ];
    // Eventos: solo tiene sentido escalar lo que el hogar ya declaró — sin eventos temporales
    // activos en el laboratorio, este eje no existe (null explícito, nunca un 0% inventado).
    if (events.length) {
      const eventCrossing = findFactorCrossing((factor) => minCheckingWith(PROFILES[0], events.map((event) => ({ ...event, amount: number(event.amount) * factor }))), 1, expenseCeiling);
      factors.push({ id: "events", label: "Eventos", calculable: eventCrossing !== null,
        risePercent: eventCrossing !== null ? round((eventCrossing - 1) * 100) : null,
        note: eventCrossing !== null ? "" : `Ni multiplicando el importe de los eventos declarados por ${expenseCeiling} se rompe el plan en el rango explorado.` });
    }
    return { schemaId: `${SCHEMA_ID}/inverse-scenario-v1`, verdict, baselineMinChecking: baseline, alreadyBroken: false, expenseCeiling, factors };
  }

  function saveScenario(forecast = {}, events = [], metadata = {}) {
    const lab = buildLab(forecast, events, metadata);
    return { schemaId: SAVED_SCHEMA_ID, id: text(metadata.id || `scenario-${Date.now()}`), name: text(metadata.name || "Escenario guardado"),
      savedAt: metadata.savedAt || new Date().toISOString(), sourceForecastFingerprint: forecast.fingerprint,
      sourceAssumptionsFingerprint: forecast.assumptionsFingerprint, events: clone(lab.events), original: clone(lab), immutableOriginal: true };
  }

  function recalculateSavedScenario(saved = {}, forecast = {}, metadata = {}) {
    if (saved?.schemaId !== SAVED_SCHEMA_ID) throw new Error("Escenario guardado no compatible.");
    return { original: clone(saved.original), recalculated: buildLab(forecast, saved.events, metadata),
      originalForecastFingerprint: saved.sourceForecastFingerprint, currentForecastFingerprint: forecast.fingerprint,
      overwroteOriginal: false };
  }

  return { SCHEMA_ID, SAVED_SCHEMA_ID, EVENT_TYPES, PROFILES, ASSET_SHOCK_TARGET_TYPE, MONTE_CARLO_DEFAULT_TRAJECTORIES, MONTE_CARLO_MAX_TRAJECTORIES, buildLab, normalizeEvent, simulate, assetImpact, prudentSimulation, correlateRisks, sensitivity, sensitivityGrid, inverseScenario, monteCarloSimulation, saveScenario, recalculateSavedScenario };
});
