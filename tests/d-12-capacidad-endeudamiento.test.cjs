const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// D-12 (Deuda) · "comparar la cuota total de deuda contra un umbral, con margen restante". La
// investigación previa a programar encontró que no hacía falta decidir ni construir ninguna cifra
// de ingreso mensual nueva: `savingsPlanCalculations().debtToIncomeRatio` (previsto de los
// próximos 12 meses de Plan) ya es la fuente canónica que usa la alerta H-9 de Hoy, con el mismo
// umbral configurable en Ajustes › Alertas (32% por defecto). D-12 solo la hace visible en
// Deuda · Ruta y Deuda · Comparar — estas pruebas cubren `debtCapacityStatus`/`debtCapacityHtml`,
// cero cálculo financiero nuevo que probar aparte.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
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

const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

function sandboxCapacity({ ratio, income, debtPayment, dangerAt = 32 }) {
  return sandboxWith(["debtCapacityStatus"], {
    round2,
    savingsPlanCalculations: () => ({ debtToIncomeRatio: ratio, monthlyIncomeTotal: income, debtServiceMonthlyTotal: debtPayment }),
    alertThresholdOverride: (id) => (id === "debtRatio" ? dangerAt : null),
  });
}

// --- debtCapacityStatus: estado y margen -----------------------------------------------------

test("D-12 · por debajo del umbral de aviso, estado «good» y margen positivo", () => {
  const context = sandboxCapacity({ ratio: 0.15, income: 3000, debtPayment: 450 });
  const result = context.debtCapacityStatus();
  assert.equal(result.status, "good");
  assert.equal(result.marginEuros, round2(3000 * 0.32 - 450));
});

test("D-12 · entre el 81,25% y el 100% del umbral, estado «warn»", () => {
  // dangerAt 32% -> warnAt = 32 * 0.8125 = 26%. Un ratio del 28% cae en warn.
  const context = sandboxCapacity({ ratio: 0.28, income: 3000, debtPayment: 840 });
  const result = context.debtCapacityStatus();
  assert.equal(result.status, "warn");
});

test("D-12 · por encima del umbral, estado «danger» y margen en 0 (nunca negativo)", () => {
  const context = sandboxCapacity({ ratio: 0.4, income: 3000, debtPayment: 1200 });
  const result = context.debtCapacityStatus();
  assert.equal(result.status, "danger");
  assert.equal(result.marginEuros, 0);
});

test("D-12 · usa el umbral configurado en Ajustes › Alertas, no un 32% fijo en el código", () => {
  // Con dangerAt=32% (por defecto), un ratio del 30% ya sería "warn" (por encima de warnAt=26%).
  // Con el umbral subido al 40% en Ajustes, warnAt sube a 32,5% y el mismo 30% pasa a "good" — la
  // prueba de que el umbral se lee de verdad, no está fijo en el código.
  const context = sandboxCapacity({ ratio: 0.3, income: 3000, debtPayment: 900, dangerAt: 40 });
  const result = context.debtCapacityStatus();
  assert.equal(result.status, "good");
  assert.equal(result.dangerAt, 0.4);
});

test("D-12 · sin umbral configurado, cae al 32% por defecto (mismo que Hoy)", () => {
  const context = sandboxWith(["debtCapacityStatus"], {
    round2,
    savingsPlanCalculations: () => ({ debtToIncomeRatio: 0.3, monthlyIncomeTotal: 3000, debtServiceMonthlyTotal: 900 }),
    alertThresholdOverride: () => null,
  });
  assert.equal(context.debtCapacityStatus().dangerAt, 0.32);
});

// --- debtCapacityHtml: mensaje coherente con el estado -----------------------------------------

test("D-12 · debtCapacityHtml muestra el margen restante cuando no se ha superado el umbral", () => {
  const context = sandboxWith(["debtCapacityHtml"], {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${v}€`,
  });
  const out = context.debtCapacityHtml({ ratio: 0.15, dangerAt: 0.32, status: "good", marginEuros: 500, income: 3000, debtPayment: 450 });
  assert.match(out, /Margen restante antes del umbral: 500€\/mes/);
  assert.match(out, /e19-badge-success/);
});

test("D-12 · debtCapacityHtml avisa de que no queda margen cuando ya supera el umbral", () => {
  const context = sandboxWith(["debtCapacityHtml"], {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${v}€`,
  });
  const out = context.debtCapacityHtml({ ratio: 0.4, dangerAt: 0.32, status: "danger", marginEuros: 0, income: 3000, debtPayment: 1200 });
  assert.match(out, /Ya supera el umbral del 32%/);
  assert.match(out, /e19-badge-danger/);
});

// --- Cableado: index.html y las dos pantallas -------------------------------------------------

test("D-12 · index.html declara los dos contenedores", () => {
  assert.match(html, /id="deudaRutaCapacity"/);
  assert.match(html, /id="deudaCompararCapacity"/);
});

test("D-12 · renderDeudaRuta y renderDeudaComparar pintan el indicador", () => {
  assert.match(extractFunction("renderDeudaRuta"), /deudaRutaCapacity[\s\S]*?debtCapacityHtml\(debtCapacityStatus\(\)\)/);
  assert.match(extractFunction("renderDeudaComparar"), /deudaCompararCapacity[\s\S]*?debtCapacityHtml\(debtCapacityStatus\(\)\)/);
});
