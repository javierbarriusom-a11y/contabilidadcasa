const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// E-3 (Escenarios.pdf, sesión de auditoría del 16 de agosto): "Comparativa de seis indicadores.
// Reserva, colchón, fecha libre, ahorro anual, peor mes y capacidad. La diferencia se colorea según
// mejore o empeore, no según su signo." El motor E20 (epic del 10 de agosto) solo daba tres
// (liquidez final, caja mínima, libre de deuda) en tarjetas sueltas sin plan-vs-simulado. Estas
// pruebas cubren las piezas nuevas: los dos indicadores derivados (meses de colchón, ahorro anual —
// capacidad libre real reutiliza `monthlyFreeCapacity`, ya probada en su propio archivo) y la tabla
// comparativa coloreada por dirección, no por signo bruto.

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const stubRound2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const stubMoney = (value) => `€${stubRound2(value)}`;
const stubEscapeHtml = (value) => String(value ?? "");
const stubSumRows = (rows, getValue) => rows.reduce((sum, row) => sum + getValue(row), 0);

// --- escenarioMotorAverageCoreSpend / escenarioMotorAhorroAnual ------------------------------

test("E-3 · escenarioMotorAverageCoreSpend promedia coreSpend de los primeros 12 meses, ignora el resto", () => {
  const context = sandboxWith(["escenarioMotorAverageCoreSpend"], { sumRows: stubSumRows });
  const series = Array.from({ length: 18 }, (_, i) => ({ coreSpend: i < 12 ? 1000 : 999999 }));
  assert.equal(context.escenarioMotorAverageCoreSpend(series), 1000);
});

test("E-3 · escenarioMotorAverageCoreSpend con serie vacía da 0", () => {
  const context = sandboxWith(["escenarioMotorAverageCoreSpend"], { sumRows: stubSumRows });
  assert.equal(context.escenarioMotorAverageCoreSpend([]), 0);
});

test("E-3 · escenarioMotorAhorroAnual suma el ahorro (row.saving) solo de los primeros 12 meses", () => {
  const context = sandboxWith(["escenarioMotorAhorroAnual"], { sumRows: stubSumRows, round2: stubRound2 });
  const series = Array.from({ length: 14 }, (_, i) => ({ saving: i < 12 ? 200 : 5000 }));
  assert.equal(context.escenarioMotorAhorroAnual(series), 2400);
});

// --- escenarioMotorSummaryFor ------------------------------------------------------------------

function summaryContext() {
  return sandboxWith(["escenarioMotorSummaryFor", "escenarioMotorAverageCoreSpend", "escenarioMotorAhorroAnual"], {
    sumRows: stubSumRows,
    round2: stubRound2,
    monthlyFreeCapacity: (series) => stubRound2(stubSumRows(series, (row) => row.netBeforeSaving || 0) / series.length),
    escenarioMotorLibreDeDeuda: () => "2029-07",
    FinanceCanonicalCushion: {
      worstMonthOf: (rows) => rows.reduce((worst, row) => (worst === null || row.totalLiquidity < worst.totalLiquidity ? row : worst), null),
    },
  });
}

test("E-3 · escenarioMotorSummaryFor devuelve todo null cuando el resultado no es válido", () => {
  const context = summaryContext();
  const summary = context.escenarioMotorSummaryFor({ valid: false }, []);
  ["minimoLiquidez", "liquidezFinal", "libreDeDeuda", "mesesColchon", "ahorroAnual", "peorMesClave", "peorMesValor", "capacidadLibre"].forEach(
    (key) => assert.equal(summary[key], null, `${key} debería ser null`),
  );
});

test("E-3 · escenarioMotorSummaryFor calcula los seis indicadores de un resultado válido", () => {
  const context = summaryContext();
  const months = [
    { key: "2026-01" },
    { key: "2026-02" },
    { key: "2026-03" },
  ];
  const series = [
    { totalLiquidity: 5000, coreSpend: 1000, saving: 200, netBeforeSaving: 300 },
    { totalLiquidity: 1000, coreSpend: 1000, saving: 200, netBeforeSaving: 300 },
    { totalLiquidity: 3000, coreSpend: 1000, saving: 200, netBeforeSaving: 300 },
  ];
  const summary = context.escenarioMotorSummaryFor({ valid: true, series, debtStateFinal: [] }, months);
  assert.equal(summary.liquidezFinal, 3000, "liquidez final es la del último mes de la serie");
  assert.equal(summary.minimoLiquidez, 1000, "caja mínima es el mínimo de toda la serie");
  assert.equal(summary.mesesColchon, 3, "3000 de liquidez final / 1000 de gasto medio = 3 meses");
  assert.equal(summary.ahorroAnual, 600, "200 de ahorro en cada uno de los tres meses");
  assert.equal(summary.peorMesClave, "2026-02", "el peor mes es el de menor liquidez (mes 2)");
  assert.equal(summary.peorMesValor, 1000);
  assert.equal(summary.capacidadLibre, 300);
  assert.equal(summary.libreDeDeuda, "2029-07");
});

test("E-3 · escenarioMotorSummaryFor no divide por cero si el gasto corriente medio es 0", () => {
  const context = summaryContext();
  const months = [{ key: "2026-01" }];
  const series = [{ totalLiquidity: 500, coreSpend: 0, saving: 0, netBeforeSaving: 0 }];
  const summary = context.escenarioMotorSummaryFor({ valid: true, series, debtStateFinal: [] }, months);
  assert.equal(summary.mesesColchon, null);
});

// --- escenarioMotorMonthCompareDelta ------------------------------------------------------------

test("E-3 · escenarioMotorMonthCompareDelta: fecha libre de deuda antes es mejora (is-up)", () => {
  const context = sandboxWith(["escenarioMotorMonthCompareDelta"]);
  const result = context.escenarioMotorMonthCompareDelta("2029-06", "2029-07");
  assert.equal(result.text, "antes");
  assert.equal(result.tone, "is-up");
});

test("E-3 · escenarioMotorMonthCompareDelta: fecha libre de deuda después es empeora (is-down)", () => {
  const context = sandboxWith(["escenarioMotorMonthCompareDelta"]);
  const result = context.escenarioMotorMonthCompareDelta("2030-01", "2029-07");
  assert.equal(result.text, "después");
  assert.equal(result.tone, "is-down");
});

test("E-3 · escenarioMotorMonthCompareDelta: misma fecha es sin cambio, sin color", () => {
  const context = sandboxWith(["escenarioMotorMonthCompareDelta"]);
  const result = context.escenarioMotorMonthCompareDelta("2029-07", "2029-07");
  assert.equal(result.text, "sin cambio");
  assert.equal(result.tone, "");
});

test("E-3 · escenarioMotorMonthCompareDelta: sin fecha estimable en alguno de los dos, sin dato", () => {
  const context = sandboxWith(["escenarioMotorMonthCompareDelta"]);
  const result = context.escenarioMotorMonthCompareDelta("sin fecha estimable · sin cuota activa", "2029-07");
  assert.equal(result.text, "—");
  assert.equal(result.tone, "");
});

// --- escenarioMotorCompareRowHtml ---------------------------------------------------------------

test("E-3 · escenarioMotorCompareRowHtml colorea is-up cuando sube y higherIsBetter=true", () => {
  const context = sandboxWith(["escenarioMotorCompareRowHtml"], { round2: stubRound2, escapeHtml: stubEscapeHtml });
  const html = context.escenarioMotorCompareRowHtml("Ahorro anual", 1000, 1500, stubMoney, (d) => `+${stubMoney(d)}`, true);
  assert.match(html, /class="escenario-motor-compare-delta is-up"/);
  assert.match(html, /\+€500/);
});

test("E-3 · escenarioMotorCompareRowHtml colorea is-down cuando sube pero higherIsBetter=false (p. ej. gasto)", () => {
  const context = sandboxWith(["escenarioMotorCompareRowHtml"], { round2: stubRound2, escapeHtml: stubEscapeHtml });
  const html = context.escenarioMotorCompareRowHtml("Coste", 1000, 1500, stubMoney, (d) => `+${stubMoney(d)}`, false);
  assert.match(html, /class="escenario-motor-compare-delta is-down"/);
});

test("E-3 · escenarioMotorCompareRowHtml sin datos en alguno de los dos lados muestra — sin color", () => {
  const context = sandboxWith(["escenarioMotorCompareRowHtml"], { round2: stubRound2, escapeHtml: stubEscapeHtml });
  const html = context.escenarioMotorCompareRowHtml("Meses de colchón", null, 1.5, (v) => v, (d) => `${d}`, true);
  assert.match(html, /<td>—<\/td>/);
  assert.doesNotMatch(html, /is-up|is-down/);
});

// --- escenarioMotorKpiCardsHtml (integración) ---------------------------------------------------

test("E-3 · escenarioMotorKpiCardsHtml construye una tabla con las seis filas pedidas por el criterio", () => {
  const context = sandboxWith(
    ["escenarioMotorKpiCardsHtml", "escenarioMotorCompareRowHtml", "escenarioMotorMonthCompareDelta"],
    {
      round2: stubRound2,
      money: stubMoney,
      escapeHtml: stubEscapeHtml,
      escenarioMotorGuardrailValue: null,
      escenarioMotorMonthLabel: (value) => value || "—",
    },
  );
  const base = { liquidezFinal: 5000, minimoLiquidez: 1000, libreDeDeuda: "2029-07", mesesColchon: 1.5, ahorroAnual: 4800, peorMesClave: "2026-11", peorMesValor: 1400, capacidadLibre: 4077 };
  const scenario = { liquidezFinal: 2000, minimoLiquidez: -200, libreDeDeuda: "2030-12", mesesColchon: 0.7, ahorroAnual: 2400, peorMesClave: "2026-11", peorMesValor: 300, capacidadLibre: 3879 };
  const html = context.escenarioMotorKpiCardsHtml(base, scenario);
  assert.match(html, /<table class="e19-table escenario-motor-compare-table">/);
  assert.equal((html.match(/<tr/g) || []).length, 7, "cabecera + 6 filas de indicador");
  ["Reserva protegida", "Meses de colchón", "Fecha libre de deuda", "Ahorro anual", "Peor mes", "Capacidad libre real"].forEach((label) => {
    assert.match(html, new RegExp(label), `falta el indicador «${label}»`);
  });
});

test("E-3 · escenarioMotorKpiCardsHtml marca la fila de peor mes como aviso cuando rompe el guardarraíl", () => {
  const context = sandboxWith(
    ["escenarioMotorKpiCardsHtml", "escenarioMotorCompareRowHtml", "escenarioMotorMonthCompareDelta"],
    {
      round2: stubRound2,
      money: stubMoney,
      escapeHtml: stubEscapeHtml,
      escenarioMotorGuardrailValue: 500,
      escenarioMotorMonthLabel: (value) => value || "—",
    },
  );
  const base = { liquidezFinal: 5000, minimoLiquidez: 1000, libreDeDeuda: "2029-07", mesesColchon: 1.5, ahorroAnual: 4800, peorMesClave: "2026-11", peorMesValor: 1400, capacidadLibre: 4077 };
  const scenario = { liquidezFinal: 2000, minimoLiquidez: 100, libreDeDeuda: "2030-12", mesesColchon: 0.7, ahorroAnual: 2400, peorMesClave: "2026-11", peorMesValor: 100, capacidadLibre: 3879 };
  const html = context.escenarioMotorKpiCardsHtml(base, scenario);
  assert.match(html, /<tr class="is-danger">/);
  assert.match(html, /bajo el saldo mínimo indicado/);
});
