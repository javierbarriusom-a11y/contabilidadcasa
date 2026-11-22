// UND-23 y UND-26 (undécima auditoría; 22/11/2026). Las áreas de Hoy, medidas una a una (vista = días en que se abrió, acción =
// lo que se hizo desde ella) y los fallos de JavaScript contados por fichero y mes, sin el mensaje.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const medidor = require("../medidor-utilidad.js");

const hoyV2 = fs.readFileSync(path.join(__dirname, "..", "views", "hoy-v2.js"), "utf8");

test("UND-23 · una función del medidor por área de Hoy, con acción y sin descarte", () => {
  const areas = medidor.FUNCIONES.filter((f) => f.id.startsWith("hoy-area-"));
  assert.deepEqual(areas.map((f) => f.id), ["hoy-area-hoy", "hoy-area-mes", "hoy-area-caja", "hoy-area-patrimonio", "hoy-area-seguimiento"]);
  for (const f of areas) {
    assert.ok(f.accion, f.id);
    assert.equal(f.descarte, null);
  }
});

test("UND-23 · Hoy anota la vista del área abierta y la acción en el área desde la que se actúa", () => {
  assert.match(hoyV2, /FinanceMedidor\?\.anotar\(`hoy-area-\$\{hoyV2AreaActual\(\)\}`, "vista"\)/);
  assert.equal((hoyV2.match(/FinanceMedidor\?\.anotar\(`hoy-area-\$\{hoyV2AreaActual\(\)\}`, "accion"\)/g) || []).length, 2);
  let store = medidor.normalize(null);
  store = medidor.registrar(store, "hoy-area-mes", "vista", { hoy: "2026-11-22" });
  store = medidor.registrar(store, "hoy-area-mes", "vista", { hoy: "2026-11-22" });
  store = medidor.registrar(store, "hoy-area-mes", "accion", { hoy: "2026-11-22" });
  const r = medidor.resumen(store, "hoy-area-mes", "2026-11");
  assert.equal(r.vistas, 1, "un día cuenta una vez");
  assert.equal(r.acciones, 1);
});

test("UND-26 · el fallo se cuenta por fichero de la app, nunca con el mensaje", () => {
  assert.equal(medidor.ficheroDeFallo("https://x.github.io/contabilidadcasa/views/hoy-v2.js?v=20261121areas"), "views/hoy-v2.js");
  assert.equal(medidor.ficheroDeFallo("https://x.github.io/contabilidadcasa/app.js?v=1:123:4"), "app.js");
  assert.equal(medidor.ficheroDeFallo("TypeError: no se pudo leer «Banco X 1.234 €»\n    at f (https://x/app.js:10:2)"), "app.js");
  assert.equal(medidor.ficheroDeFallo(""), "otro");
  assert.equal(medidor.ficheroDeFallo("mensaje sin fichero con 1.234 €"), "otro");
  let store = medidor.normalize(null);
  store = medidor.registrarFallo(store, "https://x/app.js:1:1", "2026-11-22");
  store = medidor.registrarFallo(store, "https://x/app.js:2:1", "2026-11-22");
  store = medidor.registrarFallo(store, "https://x/views/deuda.js:2:1", "2026-11-22");
  assert.deepEqual(store.fallos["2026-11"], { "app.js": 2, "views/deuda.js": 1 });
  assert.doesNotMatch(JSON.stringify(store), /Banco|€/);
  assert.match(medidor.fraseFallos(store, "2026-11"), /^3 fallos de la app este mes: 2 en app\.js, 1 en views\/deuda\.js\./);
  assert.equal(medidor.fraseFallos(store, "2026-10"), "Ningún fallo de la app este mes en este navegador.");
});

test("UND-26 · lo guardado se limpia al leer: ni claves raras ni números imposibles", () => {
  const store = medidor.normalize({ fallos: { "2026-11": { "app.js": 3, "<script>": 2, "views/x.js": -1, "otro": 1.5 }, raro: { "app.js": 1 } } });
  assert.deepEqual(store.fallos, { "2026-11": { "app.js": 3 } });
});
