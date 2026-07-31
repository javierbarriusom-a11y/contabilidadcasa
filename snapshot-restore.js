(function attachSnapshotRestore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceSnapshotRestore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function snapshotRestoreFactory() {
  "use strict";

  const METRICS = [
    ["projects", "Proyectos", (state) => state.projects?.length || 0],
    ["debtLiquidations", "Decisiones de deuda", (state) => state.debtLiquidations?.length || 0],
    ["incomeActuals", "Ingresos reales", (state) => Object.keys(state.incomeActuals || {}).length],
    ["expenseActuals", "Gastos reales", (state) => Object.keys(state.expenseActuals || {}).length],
    ["customPlanningRows", "Partidas personalizadas", (state) => state.customPlanningRows?.length || 0],
    ["seriesOverrides", "Ajustes de series", (state) => Object.keys(state.seriesOverrides || {}).length],
    ["movementMappings", "Reglas de movimientos", (state) => Object.keys(state.movementMappings || {}).length],
    ["debtRoadmapState", "Datos del plan de deuda", (state) => Object.keys(state.debtRoadmapState || {}).length],
  ];

  function buildSnapshotPreview(current = {}, target = {}) {
    const metrics = METRICS.map(([key, label, read]) => {
      const before = read(current);
      const after = read(target);
      return { key, label, before, after, delta: after - before, changed: before !== after };
    });
    return {
      metrics,
      changed: metrics.filter((metric) => metric.changed),
      unchanged: metrics.filter((metric) => !metric.changed),
      sourceWorkbookChanged: String(current.sourceWorkbook || "") !== String(target.sourceWorkbook || ""),
    };
  }

  return { buildSnapshotPreview };
});
