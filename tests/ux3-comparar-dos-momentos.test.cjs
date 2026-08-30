const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js") + "\n" + read("views/analisis.js");
const html = read("index.html");

// UX3 · Bloque 5: comparar dos momentos en el tiempo, no solo "ahora". Reutiliza
// homeMonthAtAGlance() (H-6, app.js) para dos meses cualesquiera — sin motor nuevo, sin escritura.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js/views/analisis.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
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
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    registrarMesSignedMoney: (v) => (v >= 0 ? `+${Number(v).toFixed(2)} €` : `${Number(v).toFixed(2)} €`),
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("ux3DefaultMonthKeys · sin meses, no propone nada", () => {
  const ctx = sandboxWith(["ux3DefaultMonthKeys"]);
  const result = ctx.ux3DefaultMonthKeys([]);
  assert.equal(result.a, "");
  assert.equal(result.b, "");
});

test("ux3DefaultMonthKeys · por defecto, el mes en curso frente al anterior", () => {
  const ctx = sandboxWith(["ux3DefaultMonthKeys"], {
    state: { balanceDate: "2026-08-15" },
    defaultBalanceDate: () => "2026-08-15",
  });
  const months = [{ key: "2026-06" }, { key: "2026-07" }, { key: "2026-08" }, { key: "2026-09" }];
  const defaults = ctx.ux3DefaultMonthKeys(months);
  assert.equal(defaults.a, "2026-08");
  assert.equal(defaults.b, "2026-07");
});

test("ux3ComparisonRow · calcula la diferencia como cifra, no como texto reinterpretado", () => {
  const ctx = sandboxWith(["ux3ComparisonRow"]);
  const row = ctx.ux3ComparisonRow("Ingresos", 2000, 1500);
  assert.equal(row.valueA, "2000.00 €");
  assert.equal(row.valueB, "1500.00 €");
  assert.equal(row.delta, "+500.00 €");
});

test("ux3ComparisonRow · sin uno de los dos valores, no fabrica una diferencia", () => {
  const ctx = sandboxWith(["ux3ComparisonRow"]);
  const row = ctx.ux3ComparisonRow("Gasto previsto", null, 1000);
  assert.equal(row.valueA, "—");
  assert.equal(row.delta, "—");
});

test("ux3ComparisonRow · isMoney:false no formatea como dinero", () => {
  const ctx = sandboxWith(["ux3ComparisonRow"]);
  const row = ctx.ux3ComparisonRow("Sin clasificar", 3, 1, { isMoney: false });
  assert.equal(row.valueA, "3");
  assert.equal(row.delta, "+2");
});

test("renderUx3Comparison · sin los dos meses seleccionados, deja la tabla vacía", () => {
  const table = { innerHTML: "x" };
  const ctx = sandboxWith(["renderUx3Comparison", "ux3ComparisonRow"], {
    qs: (id) => (id === "ux3ComparisonTable" ? table : id === "ux3MonthA" ? { value: "" } : { value: "2026-07" }),
  });
  ctx.renderUx3Comparison();
  assert.equal(table.innerHTML, "");
});

test("renderUx3Comparison · con dos meses, pinta las cinco filas comparadas con ambas etiquetas de mes", () => {
  const table = { innerHTML: "" };
  const glances = {
    "2026-08-01": { monthLabel: "agosto 2026", incomeTotal: 2000, plannedExpense: 1500, expenseTotal: 1600, deviation: 100, unclassifiedCount: 2 },
    "2026-07-01": { monthLabel: "julio 2026", incomeTotal: 1900, plannedExpense: 1500, expenseTotal: 1400, deviation: -100, unclassifiedCount: 0 },
  };
  const ctx = sandboxWith(["renderUx3Comparison", "ux3ComparisonRow"], {
    qs: (id) => {
      if (id === "ux3ComparisonTable") return table;
      if (id === "ux3MonthA") return { value: "2026-08" };
      if (id === "ux3MonthB") return { value: "2026-07" };
      return null;
    },
    homeMonthAtAGlance: (asOfDate) => glances[asOfDate],
  });
  ctx.renderUx3Comparison();
  assert.match(table.innerHTML, /agosto 2026/);
  assert.match(table.innerHTML, /julio 2026/);
  assert.match(table.innerHTML, /Ingresos/);
  assert.match(table.innerHTML, /Movimientos sin clasificar/);
});

test("la tarjeta vive en #analisis con sus dos selects y la tabla", () => {
  const openTag = /<section[^>]*id="analisis"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #analisis");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const analisis = html.slice(start, end);
  assert.match(analisis, /id="ux3MonthA"/);
  assert.match(analisis, /id="ux3MonthB"/);
  assert.match(analisis, /id="ux3ComparisonTable"/);
});

test("renderAnalisis llama a la comparación de UX3", () => {
  const body = extractFunction("renderAnalisis");
  assert.match(body, /renderUx3MonthOptions\(\)/);
  assert.match(body, /renderUx3Comparison\(\)/);
});

test("los selects están cableados con un listener de change delegado", () => {
  assert.match(app, /qs\("analisis"\)\?\.addEventListener\("change"/);
  assert.match(app, /data-ux3-month/);
});
