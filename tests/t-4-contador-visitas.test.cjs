const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// T-4 (Laboratorio) · T-4 preguntaba si de verdad se pueden retirar las tres heredadas de Deuda
// sin dato real de uso — la app no tenía ninguna telemetría, así que este contador mínimo (talla S)
// guarda, en local y por pantalla, cuántas veces se ha abierto y cuándo fue la última vez. Estas
// pruebas cubren el contador (`recordViewVisit`/`viewVisitSummary`) y su cableado en `setActiveView`
// y en la ficha de Laboratorio (`laboratorioVisitasText`/`laboratorioDetailHtml`).

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

function fakeStore(initial = {}) {
  const backing = { ...initial };
  return {
    backing,
    VISIT_COUNTS_KEY: "visit-counts",
    storageKey: (name) => `${name}:finance`,
    storageGet: (key, fallback = "") => (Object.prototype.hasOwnProperty.call(backing, key) ? backing[key] : fallback),
    storageSet: (key, value) => { backing[key] = value; },
  };
}

// --- recordViewVisit / loadVisitCounts / viewVisitSummary ------------------------------------

test("T-4 · la primera visita a una pantalla queda en 1, con la fecha de hoy", () => {
  const store = fakeStore();
  const context = sandboxWith(["loadVisitCounts", "recordViewVisit", "viewVisitSummary"], store);
  context.recordViewVisit("debt-roadmap");
  const result = context.viewVisitSummary("debt-roadmap");
  assert.equal(result.count, 1);
  assert.equal(result.last, new Date().toISOString().slice(0, 10));
});

test("T-4 · visitar la misma pantalla otra vez suma, no reemplaza", () => {
  const store = fakeStore();
  const context = sandboxWith(["loadVisitCounts", "recordViewVisit", "viewVisitSummary"], store);
  context.recordViewVisit("debt-control");
  context.recordViewVisit("debt-control");
  context.recordViewVisit("debt-control");
  assert.equal(context.viewVisitSummary("debt-control").count, 3);
});

test("T-4 · cada pantalla lleva su propio contador, independiente de las demás", () => {
  const store = fakeStore();
  const context = sandboxWith(["loadVisitCounts", "recordViewVisit", "viewVisitSummary"], store);
  context.recordViewVisit("debt-roadmap");
  context.recordViewVisit("deuda-ruta");
  context.recordViewVisit("deuda-ruta");
  assert.equal(context.viewVisitSummary("debt-roadmap").count, 1);
  assert.equal(context.viewVisitSummary("deuda-ruta").count, 2);
});

test("T-4 · una pantalla nunca visitada devuelve 0 sin fecha, sin lanzar", () => {
  const store = fakeStore();
  const context = sandboxWith(["loadVisitCounts", "recordViewVisit", "viewVisitSummary"], store);
  const result = context.viewVisitSummary("debt-liquidation-plan");
  assert.equal(result.count, 0);
  assert.equal(result.last, "");
});

test("T-4 · si el almacén local viene corrupto, se cae a un contador vacío en vez de romper la app", () => {
  const store = fakeStore({ "visit-counts:finance": "{esto no es json" });
  const context = sandboxWith(["loadVisitCounts", "recordViewVisit", "viewVisitSummary"], store);
  assert.equal(JSON.stringify(context.loadVisitCounts()), "{}");
  assert.equal(context.viewVisitSummary("debt-roadmap").count, 0);
});

test("T-4 · el contador se guarda en local (mismo storageGet/storageSet que el resto de preferencias), nunca sale del navegador", () => {
  const store = fakeStore();
  const context = sandboxWith(["loadVisitCounts", "recordViewVisit", "viewVisitSummary"], store);
  context.recordViewVisit("debt-control");
  assert.ok(Object.prototype.hasOwnProperty.call(store.backing, "visit-counts:finance"));
  const stored = JSON.parse(store.backing["visit-counts:finance"]);
  assert.equal(stored["debt-control"].count, 1);
});

// --- Cableado: setActiveView solo cuenta cambios reales de vista, no cada re-render ------------

test("T-4 · setActiveView llama a recordViewVisit solo cuando la vista cambia de verdad", () => {
  const source = extractFunction("setActiveView");
  assert.match(source, /if \(viewChanged\) recordViewVisit\(viewId\);/);
});

// --- Ficha de Laboratorio: laboratorioVisitasText / laboratorioDetailHtml ----------------------

test("T-4 · laboratorioVisitasText dice «0 visitas» cuando nunca se abrió", () => {
  const context = sandboxWith(["laboratorioVisitasText"], {
    escapeHtml: (v) => String(v ?? ""),
    formatIsoDate: () => "",
    viewVisitSummary: () => ({ count: 0, last: "" }),
  });
  assert.equal(context.laboratorioVisitasText({ hash: "debt-roadmap" }), "0 visitas registradas todavía.");
});

test("T-4 · laboratorioVisitasText distingue singular y plural, con la fecha formateada", () => {
  const context = sandboxWith(["laboratorioVisitasText"], {
    escapeHtml: (v) => String(v ?? ""),
    formatIsoDate: (v) => `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`,
    viewVisitSummary: (hash) => (hash === "debt-roadmap" ? { count: 1, last: "2026-08-20" } : { count: 5, last: "2026-08-20" }),
  });
  assert.equal(context.laboratorioVisitasText({ hash: "debt-roadmap" }), "Abierta 1 vez · última el 20/08/2026.");
  assert.equal(context.laboratorioVisitasText({ hash: "debt-control" }), "Abierta 5 veces · última el 20/08/2026.");
});

test("T-4 · laboratorioDetailHtml incluye la sección de Visitas en la ficha", () => {
  assert.match(extractFunction("laboratorioDetailHtml"), /<strong>Visitas<\/strong><br>\$\{laboratorioVisitasText\(entry\)\}/);
});

test("T-4 · las tres heredadas de Deuda que preocupaban a T-4 siguen en el catálogo de Laboratorio", () => {
  assert.match(app, /hash: "debt-roadmap"/);
  assert.match(app, /hash: "debt-liquidation-plan"/);
  assert.match(app, /hash: "debt-control"/);
});
