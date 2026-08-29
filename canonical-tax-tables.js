(function attachCanonicalTaxTables(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalTaxTables = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalTaxTables() {
  "use strict";

  // A15-5 — tablas fiscales versionadas y su actualización anual. Los tramos de IRPF, mínimos
  // personales y demás parámetros fiscales cambian cada año; sin versión, un cálculo hecho con
  // datos de un año viejo (o inventados) se cuela como si fuera del año en curso. Este módulo no
  // calcula nada fiscal — es el registro de qué año está cubierto y cuál falta, la infraestructura
  // que A15-1 (registro de supuestos fiscales, con los valores reales) y A15-2 (estimador de IRPF)
  // usarán más adelante. Ninguna cifra fiscal se fabrica aquí: solo el año y una etiqueta libre.

  const SCHEMA_ID = "finance-canonical-tax-tables/v1";

  function taxTableStatus(tables, currentYear) {
    const list = Array.isArray(tables) ? tables : [];
    const years = [...new Set(list.map((table) => Number(table.year)).filter(Number.isFinite))].sort((a, b) => a - b);
    // Number(null) es 0, un año "válido" falso -- se descarta antes de convertir, no después.
    const yearKnown = currentYear !== null && currentYear !== undefined && currentYear !== "" && Number.isFinite(Number(currentYear));
    const year = yearKnown ? Number(currentYear) : null;
    const currentYearCovered = yearKnown && years.includes(year);
    return {
      schemaId: SCHEMA_ID,
      currentYear: year,
      yearsRegistered: years,
      latestYear: years.length ? years[years.length - 1] : null,
      currentYearCovered,
      // stale: no hay tabla para el año en curso, así que un cálculo fiscal usaría datos de otro
      // año (o ninguno) sin avisar. null cuando no se pudo determinar el año en curso.
      stale: yearKnown ? !currentYearCovered : null,
    };
  }

  return { SCHEMA_ID, taxTableStatus };
});
