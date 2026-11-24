// D-N33 (23/11/2026, decisión del hogar): el escenario de supuestos sale de la barra lateral a Ajustes › Plan y operación, con un
// selector como el de Hogar / Persona 1 / Persona 2, y la cabecera de todas las pantallas avisa cuando no es «Base».
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../escenario-ui.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("D-N33 · los tres escenarios de siempre y el aviso solo fuera de Base", () => {
  assert.deepEqual(Object.keys(E.ESCENARIOS), ["base", "prudente", "ahorro"]);
  assert.equal(E.claveDe("Prudente"), "prudente");
  assert.equal(E.claveDe("Ahorro alto"), "ahorro");
  assert.equal(E.claveDe("otro"), "base");
  assert.equal(E.avisoTexto("base"), "");
  assert.equal(E.avisoTexto("prudente"), "Cifras con el escenario «Prudente»: ingresos al 95 %, gastos al 112 %, inflación de al menos el 3,5 % y un 35 % menos de ahorro objetivo.");
});

test("D-N33 · el escenario es una capa sobre lo del hogar: «Base» es lo vuestro y los otros dos lo escalan", () => {
  const hogar = { recommendedSavings: 1000, annualInflation: 2, emergencyBufferMonths: 6, incomeFactor: 1, expenseFactor: 1 };
  assert.deepEqual(E.CAMPOS, ["recommendedSavings", "annualInflation", "emergencyBufferMonths", "incomeFactor", "expenseFactor"]);
  assert.deepEqual(E.capa(hogar, "base"), hogar);
  assert.deepEqual(E.capa(hogar, "prudente"), { recommendedSavings: 650, annualInflation: 3.5, emergencyBufferMonths: 6, incomeFactor: 0.95, expenseFactor: 1.12 });
  assert.equal(E.capa({ ...hogar, annualInflation: 4.2 }, "prudente").annualInflation, 4.2, "no baja vuestra inflación si ya es mayor");
  assert.deepEqual(E.capa(hogar, "ahorro"), { recommendedSavings: 1200, annualInflation: 2, emergencyBufferMonths: 3, incomeFactor: 1, expenseFactor: 0.9 });
  assert.deepEqual(hogar, { recommendedSavings: 1000, annualInflation: 2, emergencyBufferMonths: 6, incomeFactor: 1, expenseFactor: 1 }, "no toca lo del hogar");
  assert.equal(E.capa({}, "prudente").incomeFactor, 0.95, "sin factores guardados, parte de 1");
});

test("D-N33 · app.js: los campos y lo guardado son lo del hogar; la capa se pone al leerlos y applyScenario ya no escribe preajustes", () => {
  const app = read("app.js");
  const aplicar = app.slice(app.indexOf("function applyScenario(name) {"), app.indexOf("function simulateHistoricalReference("));
  assert.doesNotMatch(aplicar, /writeControls\(/, "elegir escenario no sobrescribe los supuestos del hogar");
  assert.match(aplicar, /render\(\);/);
  const leer = app.slice(app.indexOf("function readStateFromControls() {"), app.indexOf("function writeControls("));
  assert.match(leer, /escenarioAplicarCapa\(\); \/\/ D-N33/);
  const guardar = app.slice(app.indexOf("function saveScenarioSettings() {"), app.indexOf("\n}\n", app.indexOf("function saveScenarioSettings() {")));
  for (const k of E.CAMPOS) assert.match(guardar, new RegExp(`\\n    ${k}: hogar\\.${k},`), k);
  assert.match(app, /escenarioAplicarCapa\(\); \/\/ D-N33: los campos muestran lo del hogar/);
});

test("D-N33 · fuera de la barra lateral; en Ajustes › Plan y operación con los mismos ids que rellena la app; aviso en la cabecera", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /<details class="sidebar-scenario">/);
  const sidebar = html.slice(html.indexOf('<aside class="sidebar"'), html.indexOf("</aside>"));
  assert.doesNotMatch(sidebar, /id="scenarioName"/);
  const grupo = html.slice(html.indexOf('id="ajustes-operacion"'), html.indexOf('id="ajustes-datos"'));
  for (const id of ["escenarioAjustesCard", "scenarioName", "scenarioStatus", "miniSavingsRate", "miniRunway", "miniDebtShift"]) assert.match(grupo, new RegExp(`id="${id}"`), id);
  for (const clave of ["base", "prudente", "ahorro"]) assert.match(grupo, new RegExp(`data-escenario-elegir="${clave}" aria-pressed=`));
  const cabecera = html.slice(html.indexOf('<header class="topbar">'), html.indexOf("</header>"));
  assert.match(cabecera, /<p class="escenario-aviso" id="escenarioAviso" role="status" hidden><\/p>/);
  assert.match(html, /<script defer src="escenario-ui\.js\?v=(?:20261123dn33|20261124dn38)"><\/script>/);
  assert.ok(html.indexOf('src="escenario-ui.js?v=') < html.indexOf('src="app.js?v='));
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"escenario-ui\.js",$/m);
  assert.match(read("service-worker.js"), /^ {2}"\.\/escenario-ui\.js",$/m);
  assert.match(html, /<div class="scenario-buttons">\s*<button data-scenario="base"/, "los botones del Simulador siguen");
  const js = read("escenario-ui.js");
  assert.match(js, /root\.applyScenario\(clave\)/, "mismo camino que el Simulador");
  assert.match(js, /new root\.MutationObserver\(\(\) => pintar\(doc\)\)\.observe\(nombre/);
});
