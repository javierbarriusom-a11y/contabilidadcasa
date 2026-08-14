const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const FinanceCanonicalCushion = require("../canonical-cushion.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const css = read("design-tokens.css");
const worker = read("service-worker.js");

// Cierre del bloque V2 · Plan: tres remates que reutilizan cálculos ya existentes, sin fabricar
// ninguno nuevo.
// - V2-5: el panel «Dónde seguir con ese mes» nombra el bloque de gasto que de verdad pesa más en
//   el peor mes, en vez de un enlace genérico.
// - V2-6: el pie de impacto gana un cuarto indicador, la fecha libre de deuda — sin diferencia,
//   porque editar Plan no puede moverla; se dice por qué en vez de fingir una comparación.
// - V2-7: una banda de doce meses, con el mismo color que ya usa el mapa de calor, embebida en
//   Plan.

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

// --- V2-5 -----------------------------------------------------------------------------------

function sandboxV25() {
  const context = {
    money: (value) => `${Number(value).toFixed(2)} €`,
    escenarioMotorMonthLabel: (value) => `etiqueta:${value}`,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("mapaCalorTopBlockLink"), context);
  return context;
}

test("V2-5 · con un bloque, el primer enlace lo nombra con su importe real", () => {
  const { mapaCalorTopBlockLink } = sandboxV25();
  const [text, href, cta] = mapaCalorTopBlockLink(
    [{ name: "Gastos fijos", total: 1234.5 }, { name: "Ocio", total: 200 }],
    "2026-09",
  );
  assert.match(text, /Gastos fijos/);
  assert.match(text, /1234\.50 €/);
  assert.match(text, /etiqueta:2026-09/);
  assert.equal(href, "#cuadro-mandos");
  assert.equal(cta, "Abrir cuadro de mandos");
});

test("V2-5 · sin bloques, cae al texto genérico en vez de romper", () => {
  const { mapaCalorTopBlockLink } = sandboxV25();
  const [text] = mapaCalorTopBlockLink([], "2026-09");
  assert.equal(text, "Mover o recortar una partida de ese mes");
});

test("V2-5 · el panel reutiliza el mismo desglose que ya calcula, no inventa una recomendación", () => {
  const render = extractFunction("renderMapaCalor");
  assert.match(render, /mapaCalorTopBlockLink\(blocks, worstKey\)/);
});

// --- V2-6 -----------------------------------------------------------------------------------

function sandboxV26() {
  const context = {
    homeDebtOutlook: () => ({ libreDeDeudaLabel: "jul 29" }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("cuadroMandosDebtFreeReadout"), context);
  return context;
}

test("V2-6 · el cuarto indicador reutiliza homeDebtOutlook, sin recalcular nada", () => {
  const { cuadroMandosDebtFreeReadout } = sandboxV26();
  assert.equal(cuadroMandosDebtFreeReadout(), "jul 29");
});

test("V2-6 · sin etiqueta, no revienta ni inventa una fecha", () => {
  const context = {
    homeDebtOutlook: () => ({ libreDeDeudaLabel: "" }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("cuadroMandosDebtFreeReadout"), context);
  assert.equal(context.cuadroMandosDebtFreeReadout(), "—");
});

test("V2-6 · el pie de impacto muestra el cuarto indicador sin diferencia, con la razón en el título", () => {
  const bar = extractFunction("renderCuadroMandosImpactBar");
  assert.match(bar, /Fecha libre de deuda \(fija\)/);
  assert.match(bar, /cuadroMandosDebtFreeReadout\(\)/);
  assert.match(bar, /No se mueve al editar Plan/);
  // A diferencia de los otros tres indicadores, este no pasa por cuadroMandosBeforeAfter: no hay
  // un antes/después real que mostrar.
  const debtFreeLine = bar.slice(bar.indexOf("Fecha libre de deuda"));
  assert.ok(!/cuadroMandosBeforeAfter/.test(debtFreeLine.slice(0, 80)));
});

// --- V2-7 -----------------------------------------------------------------------------------

function sandboxV27({ reserve = 0 } = {}) {
  const context = {
    money: (value, precise) => (precise ? `${Number(value).toFixed(2)} €` : `${Math.round(Number(value))}€`),
    escapeHtml: (value) => String(value ?? ""),
    escenarioMotorMonthLabel: (value) => `etiqueta:${value}`,
    cuadroMandosReserve: () => reserve,
    FinanceCanonicalCushion,
  };
  vm.createContext(context);
  vm.runInContext([extractFunction("mapaCalorFloor"), extractFunction("mapaCalorTone"), extractFunction("cuadroMandosMonthBandHtml")].join("\n"), context);
  return context;
}

test("V2-7 · la banda pinta hasta doce meses, con su etiqueta corta y el mismo color que el mapa de calor", () => {
  const { cuadroMandosMonthBandHtml } = sandboxV27({ reserve: 1000 });
  const rows = Array.from({ length: 14 }, (_, index) => ({
    detailMonthKey: `2026-${String((index % 12) + 1).padStart(2, "0")}`,
    totalLiquidity: 1500,
  }));
  const html2 = cuadroMandosMonthBandHtml(rows, new Set());
  assert.equal((html2.match(/cuadro-mandos-band-item/g) || []).length, 12, "corta en doce meses, no muestra más");
  assert.match(html2, /class="mapa-calor-cell is-ok"/);
  assert.match(html2, /ene 26/);
});

test("V2-7 · un mes con un cambio sin guardar sale marcado, igual que en el mapa de calor", () => {
  const { cuadroMandosMonthBandHtml } = sandboxV27({ reserve: 1000 });
  const rows = [{ detailMonthKey: "2026-09", totalLiquidity: 500 }];
  const html2 = cuadroMandosMonthBandHtml(rows, new Set(["2026-09"]));
  assert.match(html2, /is-touched/);
});

test("V2-7 · un colchón por debajo de la reserva se pinta distinto que uno holgado", () => {
  const { cuadroMandosMonthBandHtml } = sandboxV27({ reserve: 1000 });
  const rows = [{ detailMonthKey: "2026-09", totalLiquidity: 100 }];
  const html2 = cuadroMandosMonthBandHtml(rows, new Set());
  assert.match(html2, /is-tight/);
});

test("V2-7 · Plan pinta la banda con lo que ya tenía calculado (rowsAfter del impacto), sin recalcular", () => {
  const render = extractFunction("renderCuadroMandos");
  assert.match(render, /cuadroMandosMonthBandHtml\(rowsAfter, touchedMonths\)/);
});

test("V2-7 · el contenedor vive en #cuadro-mandos, entre la tabla y el pie de impacto, con su CSS", () => {
  assert.match(html, /id="cuadroMandosBand"/);
  const tableIndex = html.indexOf('id="cuadroMandosTable"');
  const bandIndex = html.indexOf('id="cuadroMandosBand"');
  const impactIndex = html.indexOf('id="cuadroMandosImpact"');
  assert.ok(tableIndex < bandIndex && bandIndex < impactIndex, "la banda va entre la tabla y el pie de impacto");
  assert.match(css, /\.e19-cuadro-mandos \.cuadro-mandos-band \{/);
});

test("Plan · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
  assert.match(html, /design-tokens\.css\?v=20260814f1a1/);
});
