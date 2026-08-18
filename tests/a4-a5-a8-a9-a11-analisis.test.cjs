const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

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

const cushionLevel = (value, floor) => {
  if (value < 0) return "negativo";
  if (value < floor) return "ajustado";
  return "holgado";
};

function baseContext(names, extra = {}) {
  return sandboxWith(names, {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    escapeHtml: (v) => String(v),
    isClosedMonthKey: () => false,
    sumRows: (rows, fn) => rows.reduce((sum, row) => sum + fn(row), 0),
    money: (v) => `€${Math.round(Number(v || 0))}`,
    isoLocalDate: (d) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : ""),
    FinanceCanonicalCushion: { cushionLevel },
    ...extra,
  });
}

const sampleMonths = [
  { key: "2026-08", label: "ago 26", income: 2000, coreSpend: 1000, car: 200, refi: 100, projectOutflow: 0, saving: 700, checking: 1500, savings: 800, totalLiquidity: 2300 },
  { key: "2026-09", label: "sep 26", income: 2000, coreSpend: 1000, car: 200, refi: 100, projectOutflow: 0, saving: 700, checking: 1200, savings: 1500, totalLiquidity: 2700 },
  { key: "2026-10", label: "oct 26", income: 2000, coreSpend: 1000, car: 200, refi: 100, projectOutflow: 500, saving: 200, checking: 1400, savings: 1700, totalLiquidity: 3100 },
  { key: "2026-11", label: "nov 26", income: 2000, coreSpend: 1000, car: 200, refi: 100, projectOutflow: 0, saving: 700, checking: 1450, savings: 2400, totalLiquidity: 3850 },
  { key: "2026-12", label: "dic 26", income: 2000, coreSpend: 1000, car: 200, refi: 100, projectOutflow: 0, saving: 700, checking: 1500, savings: 3100, totalLiquidity: 4600 },
  { key: "2027-01", label: "ene 27", income: 2000, coreSpend: 1000, car: 200, refi: 100, projectOutflow: 0, saving: 700, checking: 1530, savings: 3800, totalLiquidity: 5330 },
];

// --- A-4 · Cascada del resultado por periodo ---------------------------------------------------------

test("A-4 · agrupa por año, suma ingresos y calcula tasa de ahorro", () => {
  const context = baseContext(["analisisResultGrid", "summarizeCashflowYear"]);
  const html = context.analisisResultGrid(sampleMonths);
  // 2026: 5 meses, 2027: 1 mes
  assert.match(html, /2026/);
  assert.match(html, /2027/);
  // El ingreso de 2026 es 2000 * 5 = 10000
  assert.match(html, /€10000/);
  // Ahorro 2026 = 700 * 4 + 200 = 3000 (700*4 de ago-nov + 200 de oct)
  assert.match(html, /€3000/);
});

test("A-4 · muestra el gasto y la deuda desglosados", () => {
  const context = baseContext(["analisisResultGrid", "summarizeCashflowYear"]);
  const html = context.analisisResultGrid(sampleMonths);
  // Gasto 2026 = coreSpend(1000*5) + car(200*5) + refi(100*5) + projects(500) = 5000+1000+500+500 = 7000
  assert.match(html, /€7000/);
  // Deuda/coche 2026 = (200+100)*5 = 1500
  assert.match(html, /€1500/);
});

// --- A-8 · En qué se va · reparto completo del ingreso ----------------------------------------------

test("A-8 · suma el ingreso total y los componentes del gasto", () => {
  const context = baseContext(["analisisIncomeGrid"]);
  const html = context.analisisIncomeGrid(sampleMonths);
  // Ingreso total = 2000 * 6 = 12000
  assert.match(html, /€12000/);
  // Gasto operativo = 1000 * 6 = 6000
  assert.match(html, /€6000/);
  // Deuda y coche = (200+100) * 6 = 1800
  assert.match(html, /€1800/);
  // Proyectos = 500
  assert.match(html, /€500/);
  // Ahorro = 700*5 + 200 = 3700
  assert.match(html, /€3700/);
});

test("A-8 · calcula el porcentaje sobre el ingreso", () => {
  const context = baseContext(["analisisIncomeGrid"]);
  const html = context.analisisIncomeGrid(sampleMonths);
  // Ahorro 3700 / 12000 = 30.8% -> 31%
  assert.match(html, /31%/);
  // Gasto operativo 6000 / 12000 = 50%
  assert.match(html, /50%/);
});

// --- A-9 · Qué se repite ----------------------------------------------------------------------------

test("A-9 · lista los patrones recurrentes con su media", () => {
  const context = baseContext(["analisisPatternsList"]);
  const html = context.analisisPatternsList(sampleMonths);
  assert.match(html, /Gasto operativo recurrente/);
  assert.match(html, /Cuota de coche/);
  assert.match(html, /Refinanciación/);
  assert.match(html, /Ahorro mensual/);
});

test("A-9 · marca un patrón como estable cuando la variación es mínima", () => {
  const context = baseContext(["analisisPatternsList"]);
  const html = context.analisisPatternsList(sampleMonths);
  // car es siempre 200, refi siempre 100 -> estables
  assert.match(html, /estable/);
});

test("A-9 · sin datos muestra aviso", () => {
  const context = baseContext(["analisisPatternsList"]);
  const html = context.analisisPatternsList([]);
  assert.match(html, /Sin datos/);
});

// --- A-11 · Exportar en CSV y PDF -------------------------------------------------------------------

test("A-11 · el CSV incluye cabecera y una fila por mes", () => {
  const context = baseContext(["analisisCsvContent"]);
  const csv = context.analisisCsvContent(sampleMonths);
  const lines = csv.split("\n");
  assert.equal(lines[0], "Mes,Ingreso,Gasto operativo,Deuda y coche,Proyectos,Ahorro,Patrimonio neto");
  assert.equal(lines.length, sampleMonths.length + 1);
  // Primera fila de datos: ago 26,2000.00,1000.00,300.00,0.00,700.00,2300.00
  assert.match(lines[1], /^ago 26,2000\.00,1000\.00,300\.00,0\.00,700\.00,2300\.00$/);
});
