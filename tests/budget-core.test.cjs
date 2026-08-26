/**
 * tests/budget-core.test.cjs
 *
 * Suite de tests para módulos canónicos de presupuestos (FASE 0).
 * Cubre: analyzer, alerts, schema, forecast-category.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CanonicalBudgetAnalyzer,
} = require('../canonical-budget-analyzer.js');
const {
  CanonicalBudgetAlerts,
} = require('../canonical-budget-alerts.js');
const {
  CanonicalBudgetSchema,
} = require('../canonical-budget-schema.js');
const {
  CanonicalBudgetForecastCategory,
} = require('../canonical-budget-forecast-category.js');

// Utilidades
const createMovement = (date, amount) => ({
  id: `m_${Date.now()}`,
  date: new Date(date).toISOString().split('T')[0],
  amount: -amount,
  category: 'test_category',
});

const createMovementWithTime = (date, amount) => ({
  id: `m_${Date.now()}`,
  date: new Date(date).toISOString(),
  amount: -amount,
  category: 'test_category',
});

// ============================================================================
// CanonicalBudgetAnalyzer
// ============================================================================

test('Budget Analyzer: retorna null con <3 movimientos', () => {
  const movements = [createMovement('2026-08-01', 100)];
  const result = CanonicalBudgetAnalyzer.analyzeCategory(movements);
  assert.strictEqual(result, null);
});

test('Budget Analyzer: retorna null con <3 meses de datos', () => {
  const movements = [
    createMovement('2026-08-01', 100),
    createMovement('2026-08-15', 100),
    createMovement('2026-08-28', 100),
  ];
  const result = CanonicalBudgetAnalyzer.analyzeCategory(movements);
  assert.strictEqual(result, null);
});

test('Budget Analyzer: calcula estadísticas con 6 meses de datos', () => {
  const movements = [
    createMovement('2026-03-01', 100),
    createMovement('2026-03-15', 100),
    createMovement('2026-04-05', 120),
    createMovement('2026-05-10', 110),
    createMovement('2026-06-20', 130),
    createMovement('2026-07-15', 100),
    createMovement('2026-08-08', 140),
  ];

  const result = CanonicalBudgetAnalyzer.analyzeCategory(movements, { months: 6 });
  assert(result !== null, 'debe retornar análisis');
  assert(typeof result.average === 'number', 'average debe ser número');
  assert(typeof result.median === 'number', 'median debe ser número');
  assert(typeof result.p75 === 'number', 'p75 debe ser número');
  assert(typeof result.stdDev === 'number', 'stdDev debe ser número');
  assert(['high', 'medium', 'low'].includes(result.confidence), 'confidence debe ser válido');
  assert(result.p75 >= result.median, 'p75 >= median');
  assert(result.p75 >= result.average, 'p75 >= average');
});

test('Budget Analyzer: detecta outliers >3σ', () => {
  const movements = [
    createMovement('2026-01-01', 100),
    createMovement('2026-02-01', 110),
    createMovement('2026-03-01', 105),
    createMovement('2026-04-01', 1000), // Outlier extremo
    createMovement('2026-05-01', 100),
    createMovement('2026-06-01', 110),
  ];

  const result = CanonicalBudgetAnalyzer.analyzeCategory(movements);
  assert(result !== null);
  // Con un outlier extremo, confianza debería ser baja o media
  assert(result.confidence === 'low' || result.confidence === 'medium');
});

test('Budget Analyzer: batch procesa múltiples categorías', () => {
  const movements1 = [
    createMovement('2026-03-01', 100),
    createMovement('2026-04-01', 110),
    createMovement('2026-05-01', 105),
    createMovement('2026-06-01', 100),
    createMovement('2026-07-01', 100),
    createMovement('2026-08-01', 110),
  ];

  const movements2 = [
    createMovement('2026-03-05', 200),
    createMovement('2026-04-05', 210),
    createMovement('2026-05-05', 205),
    createMovement('2026-06-05', 200),
    createMovement('2026-07-05', 200),
    createMovement('2026-08-05', 210),
  ];

  const results = CanonicalBudgetAnalyzer.analyzeBatch({
    cat1: movements1,
    cat2: movements2,
  });

  assert.strictEqual(Object.keys(results).length, 2, 'debe procesar 2 categorías');
  assert(results.cat1 !== null, 'cat1 debe tener análisis');
  assert(results.cat2 !== null, 'cat2 debe tener análisis');
  assert(results.cat1.average < results.cat2.average, 'cat2 promedio > cat1');
});

// ============================================================================
// CanonicalBudgetAlerts
// ============================================================================

test('Budget Alerts: on-track si desviación <10%', () => {
  const today = new Date('2026-08-15');
  // Día 15 de 31: 300€/31 * 15 = ~145€ esperado
  // Gastar ~145€ es on-track
  const movements = [
    createMovementWithTime('2026-08-01', 75),
    createMovementWithTime('2026-08-10', 75),
  ];

  const alert = CanonicalBudgetAlerts.calculateAlert({
    budgetAmount: 300,
    movements,
    stdDev: 20,
    dateContext: { today, daysInMonth: 31 },
  });

  assert.strictEqual(alert.status, 'on-track');
  assert(alert.severity <= 2);
});

test('Budget Alerts: overspend si >10% arriba', () => {
  const today = new Date('2026-08-15');
  // Día 15 de 31: 300€/31 * 15 = ~145€ esperado
  // Gastar 170€ es 25€ arriba (17% arriba), overspend
  const movements = [
    createMovementWithTime('2026-08-01', 90),
    createMovementWithTime('2026-08-10', 80),
  ];

  const alert = CanonicalBudgetAlerts.calculateAlert({
    budgetAmount: 300,
    movements,
    stdDev: 20,
    dateContext: { today, daysInMonth: 31 },
  });

  assert.strictEqual(alert.status, 'overspend');
  assert(alert.severity >= 2);
});

test('Budget Alerts: underspend si >10% abajo', () => {
  const today = new Date('2026-08-15');
  const movements = [
    createMovementWithTime('2026-08-01', 30),
    createMovementWithTime('2026-08-10', 30),
  ];

  const alert = CanonicalBudgetAlerts.calculateAlert({
    budgetAmount: 300,
    movements,
    stdDev: 20,
    dateContext: { today, daysInMonth: 31 },
  });

  assert.strictEqual(alert.status, 'underspend');
});

test('Budget Alerts: ritmo diario calculado correctamente', () => {
  const today = new Date('2026-08-15');
  const movements = [];

  const alert = CanonicalBudgetAlerts.calculateAlert({
    budgetAmount: 310,
    movements,
    stdDev: 0,
    dateContext: { today, daysInMonth: 31 },
  });

  assert.strictEqual(alert.metrics.dailyRate, 10);
  assert.strictEqual(alert.metrics.expectedAccumulated, 150);
});

// ============================================================================
// CanonicalBudgetSchema
// ============================================================================

test('Budget Schema: rechaza si falta categoryId', () => {
  const budget = {
    monthYear: '2026-08',
    amountCap: 300,
  };
  assert.strictEqual(CanonicalBudgetSchema.validate(budget), null);
});

test('Budget Schema: rechaza si monthYear no es YYYY-MM', () => {
  const budget = {
    categoryId: 'cat1',
    monthYear: '08-2026',
    amountCap: 300,
  };
  assert.strictEqual(CanonicalBudgetSchema.validate(budget), null);
});

test('Budget Schema: rechaza si amountCap <= 0', () => {
  const budget = {
    categoryId: 'cat1',
    monthYear: '2026-08',
    amountCap: -100,
  };
  assert.strictEqual(CanonicalBudgetSchema.validate(budget), null);
});

test('Budget Schema: create retorna presupuesto con ID', () => {
  const budget = {
    categoryId: 'cat1',
    monthYear: '2026-08',
    amountCap: 300,
    source: 'manual',
  };
  const result = CanonicalBudgetSchema.create(budget);
  assert(result !== null);
  assert(result.id);
  assert.strictEqual(result.categoryId, 'cat1');
  assert.strictEqual(result.amountCap, 300);
});

test('Budget Schema: upsert añade nuevo presupuesto', () => {
  const budgets = [];
  const newBudget = {
    categoryId: 'cat1',
    monthYear: '2026-08',
    amountCap: 300,
  };
  const result = CanonicalBudgetSchema.upsert(budgets, newBudget);
  assert.strictEqual(result.length, 1);
});

test('Budget Schema: upsert reemplaza si existe', () => {
  const budget1 = CanonicalBudgetSchema.create({
    categoryId: 'cat1',
    monthYear: '2026-08',
    amountCap: 300,
  });
  const budgets = [budget1];

  const result = CanonicalBudgetSchema.upsert(budgets, {
    categoryId: 'cat1',
    monthYear: '2026-08',
    amountCap: 350,
  });
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].amountCap, 350);
});

test('Budget Schema: findForCategoryMonth busca correctamente', () => {
  const budget = CanonicalBudgetSchema.create({
    categoryId: 'cat1',
    monthYear: '2026-08',
    amountCap: 300,
  });

  const found = CanonicalBudgetSchema.findForCategoryMonth([budget], 'cat1', '2026-08');
  assert(found !== undefined);
  assert.strictEqual(found.amountCap, 300);
});

test('Budget Schema: byCategory agrupa correctamente', () => {
  const b1 = CanonicalBudgetSchema.create({
    categoryId: 'cat1',
    monthYear: '2026-08',
    amountCap: 300,
  });
  const b2 = CanonicalBudgetSchema.create({
    categoryId: 'cat2',
    monthYear: '2026-08',
    amountCap: 500,
  });

  const grouped = CanonicalBudgetSchema.byCategory([b1, b2], '2026-08');
  assert.strictEqual(grouped.cat1, 300);
  assert.strictEqual(grouped.cat2, 500);
});

// ============================================================================
// CanonicalBudgetForecastCategory
// ============================================================================

test('Budget Forecast: retorna null con <6 movimientos', () => {
  const movements = [createMovement('2026-08-01', 100)];
  const result = CanonicalBudgetForecastCategory.forecast(movements);
  assert.strictEqual(result, null);
});

test('Budget Forecast: genera forecast con datos suficientes', () => {
  const movements = [
    createMovement('2026-01-01', 100),
    createMovement('2026-02-01', 110),
    createMovement('2026-03-01', 105),
    createMovement('2026-04-01', 120),
    createMovement('2026-05-01', 100),
    createMovement('2026-06-01', 130),
    createMovement('2026-07-01', 90),
    createMovement('2026-08-01', 110),
  ];

  const result = CanonicalBudgetForecastCategory.forecast(movements);
  assert(result !== null);
  assert(result.monthlyForecast);
  assert(['high', 'medium', 'low'].includes(result.confidence));
});

// ============================================================================
// Integración
// ============================================================================

test('Budget Integration: análisis → presupuesto → alerta', () => {
  const historicalMovements = [
    createMovementWithTime('2026-03-01', 100),
    createMovementWithTime('2026-04-01', 110),
    createMovementWithTime('2026-05-01', 105),
    createMovementWithTime('2026-06-01', 100),
    createMovementWithTime('2026-07-01', 100),
    createMovementWithTime('2026-08-01', 110),
  ];

  const analysis = CanonicalBudgetAnalyzer.analyzeCategory(historicalMovements);
  assert(analysis !== null);

  const budget = CanonicalBudgetSchema.create({
    categoryId: 'comida',
    monthYear: '2026-08',
    amountCap: analysis.p75,
    source: 'suggested',
  });
  assert(budget !== null);

  const currentMonthMovements = [
    createMovementWithTime('2026-08-01', 30),
    createMovementWithTime('2026-08-10', 35),
  ];
  const today = new Date('2026-08-15');

  const alert = CanonicalBudgetAlerts.calculateAlert({
    budgetAmount: budget.amountCap,
    movements: currentMonthMovements,
    stdDev: analysis.stdDev,
    dateContext: { today, daysInMonth: 31 },
  });

  assert(alert.status);
  assert(alert.severity >= 1 && alert.severity <= 5);
});
