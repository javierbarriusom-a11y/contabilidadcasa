/**
 * tests/o8-gasto-hormiga.test.cjs
 *
 * #8 (plan de mejora post-E20, Ola 5): alerta de "gasto hormiga" — cada vez más cargos pequeños en
 * una categoría. Confirmado como hueco real tras la verificación de P-4: ni `budgetSeasonalPatterns`
 * (ML-1, agrega el TOTAL por mes) ni A-9 "Recurrentes" (agrupa por concepto y variación de importe)
 * miran el CONTEO de cargos pequeños. Mismo rigor que ML-1: mínimo de datos antes de opinar (10
 * cargos en la ventana), comparación entre dos mitades de la ventana (menos ruido que un mes contra
 * otro) y un umbral de crecimiento (30%, más exigente que el 10% de ML-1 porque un conteo es más
 * ruidoso que un importe agregado).
 *
 * - Parte A: budgetSmallChargeThreshold — mitad del importe mediano de la ventana.
 * - Parte B: budgetAntSpendingSignal — huecos honestos (pocos datos, sin crecimiento, crecimiento
 *   insuficiente) y la señal real cuando el crecimiento es significativo.
 * - Parte C: budgetAntSpendingSignals — agrega por categoría, ordena por crecimiento.
 * - Parte D: presupuestoMesAntSpendingHtml — sin señales no aparece; con señales, formatea la lista.
 * - Parte E: wiring estático — enganchada en renderPresupuestoMes, versión del chunk actualizada.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/presupuesto-mes.js");
const app = appSrc + "\n" + viewSrc;

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js/views/presupuesto-mes.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

// Ventana real de budgetAntSpendingSignal para monthKey="2026-08", monthsBack=6:
// recentBudgetMonthKeys da feb..jul 2026, concat agosto -> [feb,mar,abr,may,jun,jul,ago] (7 meses).
// mid = ceil(7/2) = 4 -> "antes" = feb-may (4 meses), "después" = jun-ago (3 meses).
const MONTHS = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

function txSet(category, monthKey, amounts) {
  return amounts.map((amount, i) => ({
    category,
    month: monthKey,
    date: `${monthKey}-${String(i + 1).padStart(2, "0")}`,
    amount: -Math.abs(amount),
  }));
}

// Fixture con crecimiento real y significativo: 2 cargos grandes (20€) todos los meses (14 en
// total), pequeños (2€) subiendo de 1/mes (feb-may) a 3/mes (jun-ago). Mediana de los 27 cargos cae
// en un "20€" (14 grandes >= 13 pequeños), así que el umbral de "pequeño" es 10€ — los cargos de 2€
// quedan clasificados como pequeños y los de 20€ no.
function growingAntFixture(category = "Comida") {
  const smallCounts = { "2026-02": 1, "2026-03": 1, "2026-04": 1, "2026-05": 1, "2026-06": 3, "2026-07": 3, "2026-08": 3 };
  let all = [];
  MONTHS.forEach((m) => {
    all = all.concat(txSet(category, m, [20, 20]));
    all = all.concat(txSet(category, m, Array(smallCounts[m]).fill(2)));
  });
  return all;
}

function antContext(allTx) {
  const context = {
    round2,
    recentBudgetMonthKeys: (beforeMonthKey, count = 6) => {
      const [year, month] = beforeMonthKey.split("-").map(Number);
      const keys = [];
      for (let i = count; i >= 1; i--) {
        const date = new Date(year, month - 1 - i, 1);
        keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
      }
      return keys;
    },
    budgetExpenseTransactions: (category, monthKey) => allTx.filter((row) => row.category === category && row.month === monthKey),
    budgetableCategories: () => [...new Set(allTx.map((row) => row.category))].sort(),
    escapeHtml: (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    money: (v) => `€${v}`,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction("budgetSmallChargeThreshold"),
      extractFunction("budgetAntSpendingSignal"),
      extractFunction("budgetAntSpendingSignals"),
      extractFunction("presupuestoMesAntSpendingHtml"),
    ].join("\n"),
    context,
    { filename: "views/presupuesto-mes.js#o8-ant" },
  );
  return context;
}

// ============================================================================
// Parte A: budgetSmallChargeThreshold
// ============================================================================

test("#8 · budgetSmallChargeThreshold es la mitad del importe mediano", () => {
  const context = antContext([]);
  const threshold = context.budgetSmallChargeThreshold([{ amount: -20 }, { amount: -20 }, { amount: -2 }]);
  // ordenado: [2,20,20], mediana (índice 1) = 20 -> mitad = 10
  assert.equal(threshold, 10);
});

test("#8 · budgetSmallChargeThreshold sin transacciones es 0", () => {
  const context = antContext([]);
  assert.equal(context.budgetSmallChargeThreshold([]), 0);
});

// ============================================================================
// Parte B: budgetAntSpendingSignal
// ============================================================================

test("#8 · sin suficientes cargos en la ventana (menos de 10), no opina", () => {
  const tx = txSet("Comida", "2026-08", [2, 2, 2]);
  const context = antContext(tx);
  assert.equal(context.budgetAntSpendingSignal("Comida", "2026-08"), null);
});

test("#8 · con crecimiento real y significativo, devuelve la señal", () => {
  const context = antContext(growingAntFixture());
  const signal = context.budgetAntSpendingSignal("Comida", "2026-08");
  assert.ok(signal, "debe detectar el crecimiento");
  assert.equal(signal.category, "Comida");
  assert.equal(signal.threshold, 10);
  assert.equal(signal.earlierAvgCount, 1);
  assert.equal(signal.laterAvgCount, 3);
  assert.equal(signal.growthPct, 200);
  assert.equal(signal.recentCount, 3, "agosto (el último mes de la ventana) tiene 3 cargos pequeños");
  assert.equal(signal.recentTotal, 6);
});

test("#8 · sin crecimiento entre la primera y la segunda mitad, no opina", () => {
  // Mismo conteo de pequeños todos los meses (2/mes) -> earlierAvg === laterAvg, sin crecimiento.
  let all = [];
  MONTHS.forEach((m) => {
    all = all.concat(txSet("Comida", m, [20, 20]));
    all = all.concat(txSet("Comida", m, [2, 2]));
  });
  const context = antContext(all);
  assert.equal(context.budgetAntSpendingSignal("Comida", "2026-08"), null);
});

test("#8 · con crecimiento pero por debajo del umbral del 30%, no opina", () => {
  // earlier 4/mes, later 5/mes -> crecimiento del 25%, insuficiente.
  const smallCounts = { "2026-02": 4, "2026-03": 4, "2026-04": 4, "2026-05": 4, "2026-06": 5, "2026-07": 5, "2026-08": 5 };
  let all = [];
  MONTHS.forEach((m) => {
    all = all.concat(txSet("Comida", m, [20, 20]));
    all = all.concat(txSet("Comida", m, Array(smallCounts[m]).fill(2)));
  });
  const context = antContext(all);
  const signal = context.budgetAntSpendingSignal("Comida", "2026-08");
  assert.equal(signal, null, "un +25% no llega al umbral del 30%");
});

test("#8 · sin cargos pequeños al principio de la ventana (earlierAvg=0), no fabrica un % de crecimiento infinito", () => {
  const smallCounts = { "2026-02": 0, "2026-03": 0, "2026-04": 0, "2026-05": 0, "2026-06": 3, "2026-07": 3, "2026-08": 3 };
  let all = [];
  MONTHS.forEach((m) => {
    all = all.concat(txSet("Comida", m, [20, 20, 20]));
    if (smallCounts[m] > 0) all = all.concat(txSet("Comida", m, Array(smallCounts[m]).fill(2)));
  });
  const context = antContext(all);
  assert.equal(context.budgetAntSpendingSignal("Comida", "2026-08"), null);
});

// ============================================================================
// Parte C: budgetAntSpendingSignals
// ============================================================================

test("#8 · budgetAntSpendingSignals agrega varias categorías y ordena por crecimiento descendente", () => {
  const comida = growingAntFixture("Comida");
  // Ocio: mismo patrón pero con menos crecimiento relativo (2/mes -> 3/mes, +50%). Se necesitan al
  // menos tantos cargos "grandes" (20€) como "pequeños" (2€) en total para que la mediana siga
  // cayendo en un 20€ y el umbral de "pequeño" (mitad de la mediana) siga siendo 10€, no 2€.
  const ocioCounts = { "2026-02": 2, "2026-03": 2, "2026-04": 2, "2026-05": 2, "2026-06": 3, "2026-07": 3, "2026-08": 3 };
  let ocio = [];
  MONTHS.forEach((m) => {
    ocio = ocio.concat(txSet("Ocio", m, [20, 20, 20]));
    ocio = ocio.concat(txSet("Ocio", m, Array(ocioCounts[m]).fill(2)));
  });
  const context = antContext([...comida, ...ocio]);
  const signals = context.budgetAntSpendingSignals("2026-08");
  assert.equal(signals.length, 2);
  assert.equal(signals[0].category, "Comida", "Comida crece un +200%, más que Ocio (+50%)");
  assert.equal(signals[1].category, "Ocio");
});

test("#8 · budgetAntSpendingSignals sin ninguna categoría con crecimiento significativo devuelve []", () => {
  const context = antContext(txSet("Comida", "2026-08", [2, 2]));
  assert.deepEqual(context.budgetAntSpendingSignals("2026-08"), []);
});

// ============================================================================
// Parte D: presupuestoMesAntSpendingHtml
// ============================================================================

test("#8 · sin señales, la tarjeta no aparece", () => {
  const context = antContext(txSet("Comida", "2026-08", [2, 2]));
  assert.equal(context.presupuestoMesAntSpendingHtml("2026-08"), "");
});

test("#8 · con una señal real, la tarjeta pinta la categoría, el umbral y el crecimiento", () => {
  const context = antContext(growingAntFixture());
  const html = context.presupuestoMesAntSpendingHtml("2026-08");
  assert.match(html, /Gasto hormiga/);
  assert.match(html, /Comida/);
  assert.match(html, /€10/, "el umbral de cargo pequeño (10€) aparece en el texto");
  assert.match(html, /\+200%/);
});

// ============================================================================
// Parte E: wiring estático
// ============================================================================

test("#8 · presupuestoMesAntSpendingHtml está enganchada en renderPresupuestoMes", () => {
  assert.match(viewSrc, /\$\{presupuestoMesAntSpendingHtml\(monthKey\)\}/);
});

test("#8 · el chunk de presupuesto-mes viaja versionado tras el cambio", () => {
  const html = read("index.html");
  assert.match(appSrc, /views\/presupuesto-mes\.js\?v=20260828d1/);
  assert.match(html, /app.js\?v=20260829u1/);
});
