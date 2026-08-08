(function attachE17Experience(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceE17Experience = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function e17ExperienceFactory() {
  "use strict";

  const TASKS = Object.freeze([
    { target: "home", label: "Hoy", group: "main", keywords: "inicio caja alertas decisiones hoy riesgo" },
    { target: "update-hub", label: "Actualizar datos", group: "main", keywords: "saldos reales importar excel csv movimientos previsiones" },
    { target: "forecast", label: "Prever", group: "analysis", keywords: "forecast proyeccion liquidez futuro" },
    { target: "new-life-definitive", label: "Decidir", group: "main", keywords: "decisiones deuda coche proyectos traspasos" },
    { target: "new-life-simulation", label: "Escenarios de vida y deuda", group: "analysis", keywords: "escenario simulacion imprevisto favorable tension" },
    { target: "debt-roadmap", label: "Plan de deuda", group: "analysis", keywords: "deuda negociar ofertas cuota refinanciacion" },
    { target: "savings-agent", label: "Objetivos y ahorro", group: "analysis", keywords: "objetivos huchas aportaciones ahorro" },
    { target: "movements", label: "Movimientos", group: "data", keywords: "movimientos banco categorias buscar" },
    { target: "reconciliation", label: "Conciliar", group: "data", keywords: "conciliacion extracto saldo diferencias" },
    { target: "data-entry", label: "Carga de datos", group: "data", keywords: "importar csv excel datos lote" },
    { target: "data-audit", label: "Datos y auditoría", group: "data", keywords: "calidad procedencia auditoria confianza" },
    { target: "alerts-center", label: "Centro de alertas", group: "analysis", keywords: "alertas riesgo caja deuda capacidad" },
  ]);

  const GUIDANCE = Object.freeze({
    home: ["Para qué sirve", "Revisar primero caja, riesgos y las tres decisiones de hoy.", "Solo lectura", "Abrir Actualizar si falta un saldo o movimiento."],
    "update-hub": ["Para qué sirve", "Poner al día saldos, movimientos, reales, previsiones e importaciones.", "Puede guardar cambios", "Elige una ruta y confirma el recibo antes de continuar."],
    forecast: ["Para qué sirve", "Entender la evolución futura de liquidez y gasto.", "Solo lectura", "Abre Escenarios si quieres probar un cambio sin tocar el plan."],
    "new-life-definitive": ["Para qué sirve", "Preparar una decisión de proyecto, deuda o traspaso con su impacto completo.", "Requiere confirmación", "Revisa la comparación antes de preparar cualquier cambio."],
    "new-life-simulation": ["Para qué sirve", "Comparar escenarios de coche, deuda y estabilidad sin modificar el plan.", "Solo lectura", "Guarda o vuelve a calcular el escenario que quieras estudiar."],
    "debt-roadmap": ["Para qué sirve", "Consultar las ofertas y la estrategia de deuda con datos canónicos.", "Requiere confirmación", "Compara las alternativas antes de aplicar una estrategia."],
  });

  function findTasks(query, normalize = (value) => String(value || "").toLowerCase()) {
    const term = normalize(query);
    return TASKS.filter((item) => !term || normalize(`${item.label} ${item.keywords}`).includes(term));
  }

  function guidanceFor(viewId, fallback) {
    return GUIDANCE[viewId] || fallback;
  }

  return { TASKS, GUIDANCE, findTasks, guidanceFor };
});
