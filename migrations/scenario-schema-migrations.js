(function attachScenarioSchemaMigrations(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceScenarioSchemaMigrations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function scenarioSchemaMigrationsFactory() {
  "use strict";

  // Registro único de migraciones del esquema de Escenario (canonical-scenario-schema.js).
  // Regla de versionado (dataset dorado, doc "Esquemas validables"):
  //   - añadir campo opcional / tipo de decisión           -> minor, sin migración
  //   - añadir campo obligatorio con valor por defecto      -> minor, migración automática
  //   - renombrar / eliminar campo                          -> major, migración explícita
  //   - cambiar la semántica de un campo existente          -> prohibido: crear campo nuevo y deprecar el viejo
  //
  // Cada migración es una función pura vN_to_vN+1(escenario) -> escenario, registrada aquí junto a
  // al menos un ejemplo real de entrada (T-META-03). No existe todavía ninguna migración: la única
  // versión publicada del esquema es 1.0.

  const MIGRATIONS = new Map();

  function registerMigration(fromVersion, toVersion, migrate, examples = []) {
    if (typeof migrate !== "function") throw new Error("migrate debe ser una función pura (escenario) => escenario");
    if (!Array.isArray(examples) || examples.length === 0) {
      throw new Error(`La migración ${fromVersion} -> ${toVersion} necesita al menos un ejemplo real (T-META-03).`);
    }
    MIGRATIONS.set(fromVersion, { fromVersion, toVersion, migrate, examples });
  }

  function hasMigration(fromVersion) {
    return MIGRATIONS.has(fromVersion);
  }

  function migrationFor(fromVersion) {
    return MIGRATIONS.get(fromVersion) || null;
  }

  // Aplica migraciones encadenadas hasta que no exista una migración registrada para la versión
  // actual (es decir, hasta llegar a la versión vigente del esquema). Devuelve el escenario migrado
  // y la lista de pasos aplicados, para poder dejar traza en el historial operativo de Datos y auditoría.
  function applyMigrations(escenario) {
    let current = escenario;
    const applied = [];
    while (current && MIGRATIONS.has(current.schemaVersion)) {
      const step = MIGRATIONS.get(current.schemaVersion);
      current = step.migrate(current);
      applied.push({ from: step.fromVersion, to: step.toVersion });
    }
    return { escenario: current, applied };
  }

  function registeredVersions() {
    return Array.from(MIGRATIONS.keys());
  }

  return {
    registerMigration,
    hasMigration,
    migrationFor,
    applyMigrations,
    registeredVersions,
  };
});
