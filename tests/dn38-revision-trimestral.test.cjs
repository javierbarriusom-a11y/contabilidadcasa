// D-N38 · UND-24 (duodécima auditoría, 24/11/2026): la hoja de la primera revisión trimestral (semana del 14/12). Propone, no retira.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../revision-trimestral.js");
const M = require("../medidor-utilidad.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const hoy = "2026-12-14";

test("D-N38 · pantallas de «Versiones anteriores»: sin abrir en 30 días (o nunca), se propone retirar; abierta hace poco, se queda", () => {
  const rev = R.revisar({ hoy, pantallas: [
    { id: "debt-roadmap", title: "Plan de deuda", count: 4, last: "2026-10-01" },
    { id: "alerts-center", title: "Centro de alertas", count: 0, last: null },
    { id: "visual-detail", title: "Cuadro de mandos", count: 9, last: "2026-12-10" },
  ] });
  const por = Object.fromEntries(rev.filas.map((f) => [f.id, f]));
  assert.deepEqual([por["debt-roadmap"].propuesta, por["debt-roadmap"].porque], ["retira", "sin abrir en 30 días"]);
  assert.equal(por["debt-roadmap"].candidato, true, "el plan de deuda heredado es candidato de la duodécima");
  assert.match(por["debt-roadmap"].medido, /4 aperturas; la última, hace 74 días/);
  assert.deepEqual([por["alerts-center"].propuesta, por["alerts-center"].medido], ["retira", "nunca abierta"]);
  assert.equal(por["visual-detail"].propuesta, "queda");
  assert.equal(rev.filas[0].id, "debt-roadmap", "primero los candidatos");
});

test("D-N38 · funciones: sin uso, retirar; se ven pero casi no se actúa, fundir; en Laboratorio y sin uso, candidata", () => {
  const rev = R.revisar({ hoy, funciones: [
    { id: "escenario-supuestos", nombre: "Escenario de supuestos", conAccion: true, resumen: { vistas: 0, acciones: 0, descartes: 0, tasa: null } },
    { id: "prevision", nombre: "Previsión", conAccion: true, resumen: { vistas: 10, acciones: 1, descartes: 0, tasa: 10 } },
    { id: "hoy-v2", nombre: "Hoy nuevo", conAccion: true, resumen: { vistas: 30, acciones: 40, descartes: 2, tasa: 70 } },
    { id: "dinero-parado", nombre: "Dinero parado", conAccion: true, laboratorio: true, resumen: { vistas: 0, acciones: 0, descartes: 0, tasa: null } },
  ] });
  const por = Object.fromEntries(rev.filas.map((f) => [f.id, f]));
  assert.deepEqual([por["escenario-supuestos"].propuesta, por["escenario-supuestos"].candidato, por["escenario-supuestos"].medido], ["retira", true, "sin usar"]);
  assert.equal(por.prevision.propuesta, "funde");
  assert.match(por.prevision.porque, /menos del 20 % de los días/);
  assert.equal(por["hoy-v2"].propuesta, "queda");
  assert.match(por["hoy-v2"].medido, /vista 30 días · 40 acciones \(el 70 % de los días\) · 2 descartes/);
  assert.deepEqual([por["dinero-parado"].candidato, por["dinero-parado"].porque], [true, "en Laboratorio y sin uso en los últimos 30 días"]);
});

test("D-N38 · las decisiones del hogar y el acta para copiar (sin datos del hogar)", () => {
  const decisiones = { "pantalla:debt-roadmap": { d: "retira", f: "2026-12-14" }, "funcion:hoy-v2": { d: "queda", f: "2026-12-14" }, "funcion:x": { d: "inventada", f: "2026-12-14" } };
  const rev = R.revisar({ hoy, decisiones, pantallas: [{ id: "debt-roadmap", title: "Plan de deuda", count: 1, last: "2026-09-01" }], funciones: [
    { id: "hoy-v2", nombre: "Hoy nuevo", conAccion: true, resumen: { vistas: 30, acciones: 40, descartes: 0, tasa: 70 } },
    { id: "x", nombre: "Otra", conAccion: false, resumen: { vistas: 2, acciones: 0, descartes: 0, tasa: null } },
  ] });
  assert.equal(rev.decididas, 2, "una decisión que no existe no cuenta");
  assert.equal(rev.pendientes, 1);
  const acta = R.acta(rev);
  assert.match(acta, /^Revisión trimestral · 2026-12-14/);
  assert.match(acta, /Se queda \(1\): Hoy nuevo\./);
  assert.match(acta, /Se retira \(1\): Plan de deuda\./);
  assert.match(acta, /Sin decidir: 1\./);
  assert.match(acta, /redirigir sin borrar código/);
  assert.doesNotMatch(acta, /€/);
});

test("D-N38 · el medidor mide lo que se va a revisar: el escenario de supuestos (antes no se medía) y las funciones de la duodécima", () => {
  ["escenario-supuestos", "salud-motor", "seguimiento-plan", "hitos-deuda"].forEach((id) => assert.ok(M.FUNCIONES.some((f) => f.id === id), id));
  assert.match(read("escenario-ui.js"), /FinanceMedidor\?\.anotar\?\.\("escenario-supuestos", "accion"\)/);
});

test("D-N38 · cableado: la hoja plegada en Uso de la app, sus scripts, el service worker, el build, la copia y renderAjustes", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('id="revisionTrimestralCard"') > html.indexOf('id="ajustes-uso-app"'));
  assert.match(html, /<details class="e19-card revision-trimestral-card" id="revisionTrimestralCard">\s*<summary data-revision-resumen-plegado>/);
  assert.match(html, /<script defer src="revision-trimestral\.js\?v=20261124dn38"><\/script>\s*<script defer src="revision-trimestral-ui\.js\?v=20261124dn38"><\/script>/);
  ["./revision-trimestral.js", "./revision-trimestral-ui.js"].forEach((f) => assert.ok(read("service-worker.js").includes(`"${f}"`), f));
  ["revision-trimestral.js", "revision-trimestral-ui.js"].forEach((f) => assert.ok(read("tools/build-public-site.mjs").includes(`"${f}"`), f));
  assert.match(read("app.js"), /"revision-trimestral", \/\/ D-N38/);
  assert.match(read("app.js"), /globalThis\.renderRevisionTrimestral\?\.\(\); \/\/ D-N38/);
});
