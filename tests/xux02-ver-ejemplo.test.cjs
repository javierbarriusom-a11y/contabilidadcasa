const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const C = require("../canonical-data-contracts.js");
const fep = require("../funciones-en-prueba.js");
const medidor = require("../medidor-utilidad.js");

// XUX-02 · PR-1 «Ver cómo quedaría»: una tarjeta vacía que pide un alta (plan B, política de inversión) enseña la tarjeta pintada por su propio
// código con un hogar inventado, con la banda EJEMPLO y lo que hace falta para verla con lo vuestro (altas del registro de XDA-01). Nunca se
// mezcla con cifras reales y no deja pulsar nada dentro. Nace apagada en Funciones en prueba. La e2e de qa1 abre los dos ejemplos.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function load(on) {
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]),
    FinanceFuncionesEnPrueba: { encendida: (id) => on && id === "ver-ejemplo" },
  };
  vm.createContext(context);
  vm.runInContext(`${read("estados-ui.js")}\n${read("ejemplos-ui.js")}\nthis.api = { estadoHtml, ejemploBotonHtml, EJEMPLOS };`, context);
  return context.api;
}

test("el estado vacío ofrece «Ver cómo quedaría» solo con la función encendida y un ejemplo que exista", () => {
  const off = load(false);
  const vacio = { kind: "vacio", titulo: "Todavía no habéis acordado un plan B", accion: { label: "Acordar el plan B", id: "planb-empezar" }, ejemplo: "plan-b" };
  assert.doesNotMatch(off.estadoHtml(vacio), /data-ejemplo-abrir/, "apagada: el estado vacío de siempre");
  const on = load(true);
  const html = on.estadoHtml(vacio);
  assert.match(html, /data-estado-accion="planb-empezar">Acordar el plan B<\/button><button type="button" class="e19-btn e19-btn-secondary" data-ejemplo-abrir="plan-b">Ver cómo quedaría<\/button>/, "la acción principal sigue primero");
  assert.doesNotMatch(on.estadoHtml({ ...vacio, ejemplo: "no-existe" }), /data-ejemplo-abrir/);
  assert.doesNotMatch(on.estadoHtml({ ...vacio, ejemplo: "" }), /data-ejemplo-abrir/);
  assert.deepEqual(Object.keys(on.EJEMPLOS).sort(), ["plan-b", "politica"]);
});

test("cada ejemplo tiene su alta en el registro de XDA-01: qué hace falta y cuánto se tarda, dicho como supuesto", () => {
  for (const id of ["plan-b", "politica"]) {
    const alta = C.alta(id);
    assert.ok(alta.label && alta.datos.length >= 3, id);
    assert.ok(Number.isInteger(alta.minutes) && alta.minutes > 0, id);
    assert.equal(alta.measured, false, `${id}: aún no se mide`);
  }
  assert.equal(C.alta("no-existe"), null);
  assert.equal(C.alta("politica").datos.length, 6, "las seis preguntas de la política");
});

test("nunca se mezcla con cifras reales: las vistas aceptan los datos del ejemplo y el ejemplo los pasa todos", () => {
  const plan = read("contingencia-ui.js");
  assert.match(plan, /liquidity: ctx\.liquidity \?\? accountBalancesFromState\(\)\.total/);
  assert.match(plan, /monthlyOutflow: ctx\.monthlyOutflow \?\? lpAverageMonthlyOutflow\(\)/);
  assert.match(plan, /ejemplo: "plan-b" \}\)/);
  const pol = read("politica-ui.js");
  assert.match(pol, /function politicaViewHtml\(policy, \{ portfolio = politicaPortfolio\(\), today = politicaToday\(\), reasonsHtml = null \} = \{\}\)/);
  assert.match(pol, /\$\{reasonsHtml \?\? politicaReasonsHtml\(\)\}/);
  assert.match(pol, /ejemplo: "politica" \}\)/);
  const ui = read("ejemplos-ui.js");
  assert.match(ui, /liquidity: 5200, monthlyOutflow: 2400/, "el plan B trae su liquidez y sus salidas");
  assert.match(ui, /politicaViewHtml\(policy, \{ portfolio: \{[^}]+\}, totalValue: 10000, loanAmount: 0 \}, today, reasonsHtml: "" \}\)/, "la política trae su cartera y ninguna operación");
  for (const real of ["accountBalancesFromState", "lpAverageMonthlyOutflow", "iv1PositionsList", "politicaPortfolio(", "planBContext(", "planBLoad(", "politicaLoad("]) {
    assert.ok(!ui.includes(real), `el ejemplo no lee ${real}`);
  }
});

test("dentro del ejemplo no se pulsa nada, los clics no salen de la hoja y la banda dice EJEMPLO con texto", () => {
  const ui = read("ejemplos-ui.js");
  assert.match(ui, /querySelectorAll\("\.ej-cuerpo button, \.ej-cuerpo a, \.ej-cuerpo input, \.ej-cuerpo select, \.ej-cuerpo textarea"\)\.forEach\(\(el\) => el\.remove\(\)\)/);
  assert.match(ui, /event\.stopPropagation\(\);/);
  assert.match(ui, /<strong>EJEMPLO<\/strong> · cifras y nombres inventados, no son los vuestros/);
  assert.match(read("estados.css"), /\.ej-banda \{\n  position: sticky;/);
  assert.match(read("index.html"), /<dialog class="action-review-dialog ej-dialog" id="ejemploDialog" aria-labelledby="ejemploTitulo">/);
  for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) assert.ok(read(file).includes("ejemplos-ui.js"), file);
});

test("en Funciones en prueba con su interruptor, encendida de serie desde el 29/10/2026; el medidor cuenta las altas empezadas tras ver el ejemplo", () => {
  const item = fep.CATALOGO.find((entry) => entry.id === "ver-ejemplo");
  assert.equal(item.interruptor, "propio");
  assert.match(item.metrica, /altas empezadas después de ver el ejemplo; se retira si no suben/);
  assert.equal(fep.encendida("ver-ejemplo", { getItem: () => null }), true);
  assert.deepEqual(medidor.FUNCIONES.find((f) => f.id === "ver-ejemplo").accion, ["alta empezada tras el ejemplo", "altas empezadas tras el ejemplo"]);
  assert.match(read("ejemplos-ui.js"), /anotar\("ver-ejemplo", "vista"\)/);
  assert.match(read("ejemplos-ui.js"), /anotar\("ver-ejemplo", "accion"\)/);
});
