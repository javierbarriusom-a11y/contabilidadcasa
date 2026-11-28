const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// D-N57 (27/11/2026): «Registrar gasto» con partida existente o nueva y un mes, un periodo o meses concretos (el importe se
// repite: real hasta el mes de la ventana, previsto después), y «+ Nueva partida» en la ficha de un movimiento.
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ficha = fs.readFileSync(path.join(root, "ficha-movimiento-ui.js"), "utf8");
const { codigoApp } = require("./helpers/codigo-app.cjs");
const app = codigoApp();
const { gastoFlexPlan } = require("../gasto-flexible-ui.js");

const NOV = { key: "2026-11", label: "nov 26" };
const DIC = { key: "2026-12", label: "dic 26" };
const ENE = { key: "2027-01", label: "ene 27" };
const OCT = { key: "2026-10", label: "oct 26" };

test("D-N57 · un solo mes, el de la ventana: real, y en una partida nueva también su previsto", () => {
  const plan = gastoFlexPlan({ meses: [NOV], baseKey: "2026-11", importe: 50, nueva: true });
  assert.equal(plan.filas.length, 1);
  assert.deepEqual(plan.filas[0], { mes: NOV, tipo: "real", importe: 50, previsto: 50 });
  assert.equal(plan.total, 50);
});

test("D-N57 · varios meses: hasta el de la ventana es real (también uno anterior abierto); después, previsto", () => {
  const plan = gastoFlexPlan({ meses: [ENE, OCT, NOV, DIC], baseKey: "2026-11", importe: 20, nueva: true });
  assert.deepEqual(plan.filas.map((fila) => `${fila.mes.key}:${fila.tipo}`), ["2026-10:real", "2026-11:real", "2026-12:previsto", "2027-01:previsto"]);
  assert.equal(plan.total, 80, "el importe se repite en cada mes, no se reparte");
});

test("D-N57 · partida existente: el previsto de cada mes futuro sube en el importe (antes → después) y no se toca el real previsto", () => {
  const antes = { "2026-12": 100, "2027-01": 0 };
  const plan = gastoFlexPlan({ meses: [NOV, DIC, ENE], baseKey: "2026-11", importe: 30.5, nueva: false, antes: (mes) => antes[mes.key] });
  assert.equal(plan.filas[0].tipo, "real");
  assert.equal(plan.filas[0].previsto, null, "en una partida que ya existe, el real no cambia su previsto");
  assert.deepEqual(plan.filas.slice(1).map((fila) => [fila.antes, fila.despues]), [[100, 130.5], [0, 30.5]]);
});

test("D-N57 · una partida de deuda no ve tocado su previsto (lo calcula el plan de deuda) y no cuenta en el total", () => {
  const plan = gastoFlexPlan({ meses: [NOV, DIC], baseKey: "2026-11", importe: 10, nueva: false, esDeuda: () => true });
  assert.deepEqual(plan.filas.map((fila) => fila.tipo), ["real", "omitido"]);
  assert.equal(plan.previstos.length, 0);
  assert.equal(plan.total, 10);
});

test("D-N57 · meses repetidos o vacíos no se cuentan dos veces; sin meses, nada", () => {
  assert.equal(gastoFlexPlan({ meses: [DIC, DIC, null, {}], baseKey: "2026-11", importe: 5 }).filas.length, 1);
  assert.equal(gastoFlexPlan({ meses: [], baseKey: "2026-11", importe: 5 }).filas.length, 0);
});

test("D-N57 · la ventana trae partida, «¿Qué meses?» (tres opciones), periodo, meses sueltos y «Qué ocurrirá»", () => {
  const inicio = html.indexOf('id="homeQuickExpenseDialog"');
  const dialogo = html.slice(inicio, html.indexOf("</dialog>", inicio));
  assert.match(dialogo, /<select id="homeQuickExpensePartida"><option value="">Partida nueva con este concepto<\/option><\/select>/);
  ["uno", "periodo", "sueltos"].forEach((valor) => assert.match(dialogo, new RegExp(`name="homeQuickExpenseCuando" value="${valor}"`)));
  assert.match(dialogo, /value="uno" checked/, "de entrada, solo este mes: lo de siempre");
  assert.match(dialogo, /id="homeQuickExpenseDesde"/);
  assert.match(dialogo, /id="homeQuickExpenseHasta"/);
  assert.match(dialogo, /id="homeQuickExpenseSueltos" hidden/);
  assert.match(dialogo, /id="homeQuickExpenseQueOcurrira" role="status"/);
  assert.ok(html.indexOf('src="gasto-flexible-ui.js?v=') < html.indexOf('src="app.js?v='), "se carga antes que app.js");
});

test("D-N57 · app.js prepara la ventana y, solo si el módulo no lo registra, hace lo de siempre", () => {
  assert.match(app, /globalThis\.gastoFlexPreparar\?\.\(\(\) => month\)/);
  assert.match(app, /if \(!globalThis\.gastoFlexGuardar\?\.\(month, .*\)\) submitHomeQuickExpense\(month,/);
});

test("D-N57 · la ficha de un movimiento trae «¿No está? + Nueva partida» bajo el selector, con nombre, bloque y «Crear y elegir»", () => {
  assert.match(ficha, /<\/select>\n      <\/label>\n      \$\{fichaMovNuevaHtml\(kind\)\}/, "justo debajo del selector de partida");
  assert.match(ficha, /aria-expanded="false" aria-controls="fichaMovNueva">¿No está\? \+ Nueva partida<\/button>/);
  assert.match(ficha, /id="fichaMovNuevaNombre"/);
  assert.match(ficha, /id="fichaMovNuevaBloque"/);
  assert.match(ficha, /id="fichaMovNuevaCrear">Crear y elegir<\/button>/);
  assert.match(ficha, /plannedValue: 0 \}\)\)/, "sale con previsto 0 €: no cambia el plan");
  assert.match(ficha, /customSeriesMonthsFrom\(desde\)/, "en los meses del plan desde el del movimiento, sin los firmados");
  assert.match(ficha, /normalizedText\(displayLabelForRow\(item\)\) === normalizedText\(label\)/, "un nombre que ya existe elige esa partida");
  assert.match(ficha, /fichaMovSincroniza\("partida"\)/, "queda elegida y «Guardar partida» se enciende");
});

test("P4 (a) · la partida de entrada es la del concepto (mappingForMovement), con su pista, y la elegida a mano no se toca", () => {
  const fuente = fs.readFileSync(path.join(root, "gasto-flexible-ui.js"), "utf8");
  assert.match(fuente, /function gastoFlexPropuesta\(concepto\)/);
  assert.match(fuente, /mappingForMovement\(\{ amount: -1, movement: texto/);
  assert.match(fuente, /if \(!gastoFlexEstado \|\| gastoFlexEstado\.aMano\) return;/);
  assert.match(fuente, /qs\("homeQuickExpenseLabel"\)\?\.addEventListener\("input", gastoFlexAplicarPropuesta\)/);
  assert.match(html, /<p class="e19-kpi-note" id="homeQuickExpensePartidaPista" role="status" hidden><\/p>/);
});
