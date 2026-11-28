const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// P2 (D-N58, 28/11/2026): un solo «Elegir partida» con buscador sobre los <select> de partida de siempre (elegir-partida.js).
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const { secciones } = require("../elegir-partida.js");

const OPCIONES = [
  { valor: "", nombre: "Sin asignar todavía", bloque: "" },
  { valor: "e|luz", nombre: "Luz", bloque: "Gastos fijos" },
  { valor: "e|seguro", nombre: "Seguro de previsión", bloque: "Gastos fijos" },
  { valor: "e|super", nombre: "Supermercado", bloque: "Gastos variables" },
  { valor: "e|pelu", nombre: "Peluquería", bloque: "Gastos variables" },
];

test("P2 · sin buscar: la opción vacía, la propuesta, las recientes (sin repetir la propuesta) y todo por bloque", () => {
  const s = secciones(OPCIONES, { propuesta: "e|super", recientes: ["e|super", "e|luz", "no-existe"] });
  assert.deepEqual(s.map((g) => g.titulo), ["", "Propuesta", "Recientes", "Gastos fijos", "Gastos variables"]);
  assert.deepEqual(s[1].items.map((o) => o.valor), ["e|super"]);
  assert.deepEqual(s[2].items.map((o) => o.valor), ["e|luz"], "la propuesta no se repite y lo que ya no existe no sale");
});

test("P2 · buscar sin acentos ni mayúsculas, por el nombre o el bloque; sin la vacía ni propuesta ni recientes", () => {
  assert.deepEqual(secciones(OPCIONES, { buscado: "pel", propuesta: "e|super" }).flatMap((g) => g.items.map((o) => o.nombre)), ["Peluquería"]);
  assert.deepEqual(secciones(OPCIONES, { buscado: "PREVISION" }).flatMap((g) => g.items.map((o) => o.nombre)), ["Seguro de previsión"]);
  assert.deepEqual(secciones(OPCIONES, { buscado: "variables" }).flatMap((g) => g.items.map((o) => o.nombre)), ["Supermercado", "Peluquería"]);
  assert.deepEqual(secciones(OPCIONES, { buscado: "zzz" }), []);
});

test("P2 · los ocho selectores de partida lo llevan; el <select> sigue siendo la fuente de verdad; Intro en el buscador no envía el diálogo", () => {
  const html = read("index.html");
  assert.match(html, /<select id="homeQuickExpensePartida" data-elegir-partida>/);
  assert.match(html, /<select id="movementsBulkPartida" data-elegir-partida>/);
  assert.match(read("ficha-movimiento-ui.js"), /<select id="movementDetailPartida" data-elegir-partida data-elegir-nueva="#fichaMovNuevaAbrir">/);
  assert.match(read("ficha-movimiento-ui.js"), /data-ficha-dividir-partida="\$\{index\}" data-elegir-partida>/);
  assert.match(read("views/clasificar-v2.js"), /data-elegir-partida data-elegir-nueva="\[data-clas-v2-nueva\]"/);
  assert.match(read("views/cierre.js"), /<select id="cierreClassifyPartida" data-elegir-partida>/);
  assert.match(read("importar-extracto-ui.js"), /<select data-elegir-partida data-datos-importar-otra-select/);
  assert.match(read("datos-ui.js"), /<select data-elegir-partida data-movement-map-key=/);
  const fuente = read("elegir-partida.js");
  assert.match(fuente, /select\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/, "elegir dispara el change de siempre");
  assert.match(fuente, /role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls=/);
  assert.match(fuente, /select\.tabIndex = -1;\n    select\.setAttribute\("aria-hidden", "true"\);/);
  assert.match(read("ux-shell.js"), /if \(field\.getAttribute\?\.\("role"\) === "combobox"\) return null;/);
  assert.ok(html.indexOf('src="elegir-partida.js?v=') > 0 && html.indexOf('src="elegir-partida.js?v=') < html.indexOf('src="app.js?v='));
  assert.ok(read("service-worker.js").includes('"./elegir-partida.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"elegir-partida.js"'));
});
