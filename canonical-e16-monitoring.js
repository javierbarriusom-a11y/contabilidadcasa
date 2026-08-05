(function attachCanonicalE16(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalE16 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalE16Factory() {
  "use strict";

  const SCHEMA_ID = "finance-e16-monitoring/v1";
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const monthKey = (value) => (text(value).match(/^\d{4}-\d{2}/) || [])[0] || "";
  const average = (values) => values.length ? round2(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

  function normalizeRiskBudget(input = {}) {
    return {
      minimumLiquidity: Math.max(0, round2(input.minimumLiquidity ?? input.minLiquidity ?? 0)),
      maximumMonthlyVariation: Math.max(0, round2(input.maximumMonthlyVariation ?? input.maxVariation ?? 0)),
      maximumDebtRatio: Math.max(0, round2(input.maximumDebtRatio ?? input.maxDebtRatio ?? 40)),
    };
  }

  function confidenceFor(row = {}) {
    const confidence = text(row.confidence).toLowerCase();
    if (["high", "alta"].includes(confidence)) return "alta";
    if (["low", "baja"].includes(confidence)) return "baja";
    return "media";
  }

  function predictiveAlerts(forecast = {}, riskBudget = {}, context = {}) {
    const budget = normalizeRiskBudget(riskBudget);
    const series = Array.isArray(forecast.series) ? forecast.series : [];
    const alerts = [];
    series.forEach((row, index) => {
      const liquidity = number(row.totals?.closingLiquidity ?? row.closingLiquidity);
      const previous = index ? number(series[index - 1].totals?.closingLiquidity ?? series[index - 1].closingLiquidity) : liquidity;
      const variation = round2(liquidity - previous);
      const horizon = index + 1;
      const key = monthKey(row.monthKey) || text(row.monthKey);
      if (liquidity < budget.minimumLiquidity) alerts.push({
        id: `cash-${key}`, type: "cash", severity: liquidity < 0 ? "critical" : "high", monthKey: key, horizon,
        confidence: confidenceFor(row), amount: round2(liquidity), threshold: budget.minimumLiquidity,
        message: `La caja prevista queda en ${round2(liquidity)} €, por debajo del mínimo de ${budget.minimumLiquidity} €.`,
        evidence: ["forecast canónico", `horizonte ${horizon} mes(es)`, `umbral de caja ${budget.minimumLiquidity} €`],
      });
      if (index && budget.maximumMonthlyVariation && Math.abs(variation) > budget.maximumMonthlyVariation) alerts.push({
        id: `variation-${key}`, type: "variation", severity: "medium", monthKey: key, horizon,
        confidence: confidenceFor(row), amount: variation, threshold: budget.maximumMonthlyVariation,
        message: `La variación prevista es de ${round2(variation)} €, por encima de la tolerancia mensual.`,
        evidence: ["forecast canónico", `variación ${round2(variation)} €`, `tolerancia ${budget.maximumMonthlyVariation} €`],
      });
    });
    const debtRatio = Math.max(0, round2(context.debtRatio));
    if (debtRatio > budget.maximumDebtRatio) alerts.push({
      id: "debt-ratio", type: "debt", severity: "high", monthKey: "", horizon: 0, confidence: "media", amount: debtRatio, threshold: budget.maximumDebtRatio,
      message: `El ratio de deuda estimado es ${debtRatio} %, por encima del máximo de ${budget.maximumDebtRatio} %.`,
      evidence: ["cuotas de deuda declaradas", `ratio ${debtRatio} %`, `límite ${budget.maximumDebtRatio} %`],
    });
    return { schemaId: `${SCHEMA_ID}/alerts/v1`, readOnly: true, riskBudget: budget, alerts: alerts.sort((a, b) => a.horizon - b.horizon || a.severity.localeCompare(b.severity)) };
  }

  function changeSummary(input = {}) {
    const since = text(input.lastReviewAt || input.lastReview?.completedAt);
    const sinceTime = Date.parse(since) || 0;
    const movements = (Array.isArray(input.movements) ? input.movements : []).filter((item) => !sinceTime || Date.parse(item.date || item.createdAt || 0) > sinceTime);
    const deviations = (Array.isArray(input.deviations) ? input.deviations : []).filter((item) => Math.abs(number(item.delta)) > 0.005);
    const assumptions = (Array.isArray(input.assumptions) ? input.assumptions : []).filter((item) => !sinceTime || Date.parse(item.updatedAt || item.changedAt || 0) > sinceTime);
    const goalChanges = (Array.isArray(input.goals) ? input.goals : []).filter((item) => !sinceTime || Date.parse(item.updatedAt || item.createdAt || 0) > sinceTime);
    const effect = round2(movements.reduce((sum, item) => sum + number(item.amount), 0) + deviations.reduce((sum, item) => sum + number(item.delta), 0));
    return {
      schemaId: `${SCHEMA_ID}/changes/v1`, readOnly: true, since: since || "sin revisión previa", effect,
      movements: movements.map((item) => ({ label: text(item.label || item.details || "Movimiento"), amount: round2(item.amount), date: text(item.date), source: text(item.source || "movimiento conciliado") })),
      deviations: deviations.map((item) => ({ label: text(item.label || "Partida"), delta: round2(item.delta), source: text(item.source || "previsto frente a real") })),
      assumptions: assumptions.map((item) => ({ label: text(item.label || item.key || "Supuesto"), source: text(item.source || "registro de supuestos") })),
      goals: goalChanges.map((item) => ({ label: text(item.name || item.label || "Objetivo"), source: "objetivos" })),
      summary: !since ? "Aún no hay una revisión previa: los cambios se muestran desde los datos disponibles." : `${movements.length} movimiento(s), ${deviations.length} desviación(es), ${assumptions.length} supuesto(s) y ${goalChanges.length} objetivo(s) cambiaron desde la última revisión.`,
    };
  }

  function predictionQuality(input = {}) {
    const samples = (Array.isArray(input.samples) ? input.samples : []).filter((item) => Number.isFinite(Number(item.actual)) && Number.isFinite(Number(item.predicted)) && item.complete !== false);
    const errors = samples.map((item) => Math.abs(number(item.actual) - number(item.predicted)));
    const byCategory = {};
    samples.forEach((item) => {
      const category = text(item.category) || "General";
      const current = byCategory[category] || [];
      current.push(Math.abs(number(item.actual) - number(item.predicted)));
      byCategory[category] = current;
    });
    const categories = Object.entries(byCategory).map(([category, values]) => ({ category, meanAbsoluteError: average(values), samples: values.length })).sort((a, b) => b.meanAbsoluteError - a.meanAbsoluteError);
    const bias = round2(average(samples.map((item) => number(item.actual) - number(item.predicted))));
    return {
      schemaId: `${SCHEMA_ID}/quality/v1`, readOnly: true, samples: samples.length, meanAbsoluteError: average(errors), bias,
      confidence: samples.length >= 6 ? "media" : "baja", categories,
      note: samples.length ? "Solo se evalúan periodos completos con real y previsión disponibles." : "Faltan periodos completos con real y previsión para medir el error.",
    };
  }

  function traceableRecommendations(input = {}) {
    const alerts = Array.isArray(input.alerts?.alerts) ? input.alerts.alerts : [];
    const changes = input.changes || {};
    const quality = input.quality || {};
    const recommendations = [];
    alerts.filter((item) => ["critical", "high"].includes(item.severity)).slice(0, 3).forEach((alert) => recommendations.push({
      id: `recommend-${alert.id}`, priority: alert.severity, action: "Revisar caja y decisiones futuras", message: alert.message,
      evidence: alert.evidence, alternatives: ["Ajustar un supuesto", "Mover un objetivo flexible", "Revisar una estrategia de deuda"], confirmRequired: true,
    }));
    if (Math.abs(number(changes.effect)) > 0.005) recommendations.push({
      id: "recommend-changes", priority: "medium", action: "Revisar cambios desde la última revisión", message: `El efecto acumulado observado es ${round2(changes.effect)} €.`,
      evidence: [changes.summary || "cambios registrados"], alternatives: ["Conciliar movimientos", "Confirmar desviaciones", "Mantener el forecast actual"], confirmRequired: true,
    });
    if (quality.samples < 6) recommendations.push({
      id: "recommend-quality", priority: "low", action: "Completar la evaluación del forecast", message: quality.note || "Faltan muestras cerradas.",
      evidence: ["calidad de predicción", `${quality.samples || 0} muestra(s) válida(s)`], alternatives: ["Esperar al cierre del mes", "Registrar reales", "Revisar categorías"], confirmRequired: false,
    });
    return { schemaId: `${SCHEMA_ID}/recommendations/v1`, readOnly: true, recommendations, note: "Las recomendaciones explican datos y alternativas; no modifican el plan ni ejecutan acciones." };
  }

  function buildReadModel(input = {}) {
    const alerts = predictiveAlerts(input.forecast, input.riskBudget, input);
    const changes = changeSummary(input);
    const quality = predictionQuality({ samples: input.predictionSamples });
    const recommendations = traceableRecommendations({ alerts, changes, quality });
    return { schemaId: SCHEMA_ID, version: 1, readOnly: true, generatedAt: text(input.generatedAt) || new Date().toISOString(), alerts, changes, quality, recommendations };
  }

  return { SCHEMA_ID, normalizeRiskBudget, predictiveAlerts, changeSummary, predictionQuality, traceableRecommendations, buildReadModel };
});
