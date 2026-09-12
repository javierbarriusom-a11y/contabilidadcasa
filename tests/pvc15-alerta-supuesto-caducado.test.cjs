const test = require("node:test");
const assert = require("node:assert/strict");

const forecast = require("../canonical-forecast.js");

// PVC15 (Oleada 4, Bloque 3): alerta de "supuesto caducado" — antigüedad de un supuesto INDIVIDUAL
// (tipo de interés, salario...) frente a su propia fecha de confirmación (`updatedAt` del registro
// de A7-2/A15-1), distinto de PVC7 (caducidad de un ESCENARIO GUARDADO frente al forecast actual).

function registryWith(items) {
  return { schemaId: forecast.ASSUMPTIONS_SCHEMA_ID, version: 1, items };
}

test("assumptionExpiryAlerts · un supuesto confirmado hoy no está caducado", () => {
  const registry = registryWith([
    { id: "incomeFactor", label: "Factor general de ingresos", unit: "ratio", value: 1.05, updatedAt: "2026-09-12T00:00:00.000Z" },
  ]);
  const result = forecast.assumptionExpiryAlerts(registry, new Date("2026-09-12T00:00:00.000Z"));
  assert.equal(result.expired.length, 0);
});

test("assumptionExpiryAlerts · incomeFactor caduca a los 6 meses (7 meses sin confirmar, caduca)", () => {
  const registry = registryWith([
    { id: "incomeFactor", label: "Factor general de ingresos", unit: "ratio", value: 1.05, updatedAt: "2026-02-12T00:00:00.000Z" },
  ]);
  const result = forecast.assumptionExpiryAlerts(registry, new Date("2026-09-12T00:00:00.000Z"));
  assert.equal(result.expired.length, 1);
  assert.equal(result.expired[0].id, "incomeFactor");
  assert.equal(result.expired[0].ageMonths, 7);
  assert.equal(result.expired[0].thresholdMonths, 6);
});

test("assumptionExpiryAlerts · plannedMonthlySaving (umbral 12 meses) con la misma antigüedad de 7 meses NO caduca", () => {
  const registry = registryWith([
    { id: "plannedMonthlySaving", label: "Ahorro mensual objetivo", unit: "EUR", value: 250, updatedAt: "2026-02-12T00:00:00.000Z" },
  ]);
  const result = forecast.assumptionExpiryAlerts(registry, new Date("2026-09-12T00:00:00.000Z"));
  assert.equal(result.expired.length, 0);
});

test("assumptionExpiryAlerts · los saldos iniciales y el interruptor de ahorro automático nunca caducan (excluidos a propósito)", () => {
  const registry = registryWith([
    { id: "openingChecking", label: "Saldo inicial de la cuenta operativa", unit: "EUR", value: 1200, updatedAt: "2020-01-01T00:00:00.000Z" },
    { id: "openingSavings", label: "Saldo inicial de ahorro", unit: "EUR", value: 800, updatedAt: "2020-01-01T00:00:00.000Z" },
    { id: "autoCapSavings", label: "Ajuste automático del ahorro", unit: "boolean", value: true, updatedAt: "2020-01-01T00:00:00.000Z" },
  ]);
  const result = forecast.assumptionExpiryAlerts(registry, new Date("2026-09-12T00:00:00.000Z"));
  assert.equal(result.expired.length, 0);
});

test("assumptionExpiryAlerts · fiscalJointTaxation/fiscalLargeFamily usan el umbral más largo (24 meses)", () => {
  const registry = registryWith([
    { id: "fiscalJointTaxation", label: "Tributación conjunta", unit: "boolean", value: true, updatedAt: "2025-01-12T00:00:00.000Z" },
  ]);
  const eighteenMonths = forecast.assumptionExpiryAlerts(registry, new Date("2026-07-12T00:00:00.000Z"));
  assert.equal(eighteenMonths.expired.length, 0);
  const twentyFiveMonths = forecast.assumptionExpiryAlerts(registry, new Date("2027-02-12T00:00:00.000Z"));
  assert.equal(twentyFiveMonths.expired.length, 1);
});

test("assumptionExpiryAlerts · admite umbrales personalizados por opción, sin perder el resto de los valores por defecto", () => {
  const registry = registryWith([
    { id: "incomeFactor", label: "Factor general de ingresos", unit: "ratio", value: 1.05, updatedAt: "2026-08-12T00:00:00.000Z" },
  ]);
  const result = forecast.assumptionExpiryAlerts(registry, new Date("2026-09-12T00:00:00.000Z"), { thresholdMonths: { incomeFactor: 1 } });
  assert.equal(result.expired.length, 1);
  assert.equal(result.expired[0].thresholdMonths, 1);
});

test("buildAssumptionRegistry + assumptionExpiryAlerts: integración real — un supuesto sin cambiar conserva su updatedAt original y puede caducar", () => {
  const input = { policy: { incomeFactor: 1.05 } };
  const first = forecast.buildAssumptionRegistry(input, {}, { generatedAt: "2026-02-12T00:00:00.000Z" });
  const second = forecast.buildAssumptionRegistry(input, first, { generatedAt: "2026-09-12T00:00:00.000Z" });
  const incomeFactorItem = second.items.find((item) => item.id === "incomeFactor");
  assert.equal(incomeFactorItem.updatedAt, "2026-02-12T00:00:00.000Z");
  const result = forecast.assumptionExpiryAlerts(second, new Date("2026-09-12T00:00:00.000Z"));
  assert.ok(result.expired.some((entry) => entry.id === "incomeFactor"));
});
