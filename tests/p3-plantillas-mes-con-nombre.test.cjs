/**
 * tests/p3-plantillas-mes-con-nombre.test.cjs
 *
 * P-3 (plan de mejora post-E20, ver BACKLOG.md §9): "Plantillas de mes con nombre", sobre la
 * estacionalidad que ML-1 (`budgetSeasonalPatterns`) ya detecta en Presupuesto del mes — sin motor
 * nuevo. Deja ponerle un nombre al mes del calendario actual («Diciembre» → «Navidad») cuando ya hay
 * un patrón estacional real detectado en alguna categoría; el nombre es solo una etiqueta local del
 * usuario (nunca cambia ningún presupuesto ni importe) guardada por número de mes (1-12), mismo
 * patrón local-only de `storageKey`/`storageGet`/`storageSet` que #5/#6 y C-13.
 *
 * - Parte A: almacenamiento — loadMesPlantillaNombres/saveMesPlantillaNombres.
 * - Parte B: handleMesPlantillaNombreSave/handleMesPlantillaNombreRemove.
 * - Parte C: presupuestoMesTemplateHtml — formateo, motores mockeados en el límite.
 * - Parte D: wiring estático (render y delegación de clics).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/presupuesto-mes.js");
const app = appSrc + "\n" + viewSrc;

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js/views/presupuesto-mes.js`);
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

function baseContext(extra = {}) {
  return {
    escapeHtml: (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    money: (v) => `€${v}`,
    ...extra,
  };
}

function storageStub() {
  const store = new Map();
  return {
    storageKey: (key) => key,
    storageGet: (key, fallback) => (store.has(key) ? store.get(key) : fallback),
    storageSet: (key, value) => store.set(key, value),
    _store: store,
  };
}

function sandboxWith(names, extra = {}) {
  const context = baseContext(extra);
  vm.createContext(context);
  vm.runInContext(names.map((name) => extractFunction(name)).join("\n"), context);
  return context;
}

// --- Parte A: almacenamiento -------------------------------------------------------------------

test("P-3 · mesPlantillaNombresStorageKey usa la misma storageKey() que el resto de patrones locales", () => {
  const storage = storageStub();
  const context = sandboxWith(["mesPlantillaNombresStorageKey"], storage);
  assert.equal(context.mesPlantillaNombresStorageKey(), "mes-plantilla-nombres");
});

test("P-3 · loadMesPlantillaNombres devuelve {} sin nada guardado todavía", () => {
  const storage = storageStub();
  const context = sandboxWith(["mesPlantillaNombresStorageKey", "loadMesPlantillaNombres"], storage);
  assert.deepEqual({ ...context.loadMesPlantillaNombres() }, {});
});

test("P-3 · loadMesPlantillaNombres es robusto ante JSON corrupto o un array en vez de objeto", () => {
  const storage = storageStub();
  const context = sandboxWith(["mesPlantillaNombresStorageKey", "loadMesPlantillaNombres"], storage);
  storage._store.set("mes-plantilla-nombres", "{roto");
  assert.deepEqual({ ...context.loadMesPlantillaNombres() }, {});
  storage._store.set("mes-plantilla-nombres", "[1,2,3]");
  assert.deepEqual({ ...context.loadMesPlantillaNombres() }, {});
});

test("P-3 · saveMesPlantillaNombres persiste y loadMesPlantillaNombres lo recupera tal cual", () => {
  const storage = storageStub();
  const context = sandboxWith(["mesPlantillaNombresStorageKey", "loadMesPlantillaNombres", "saveMesPlantillaNombres"], storage);
  context.saveMesPlantillaNombres({ 12: "Navidad", 7: "Vacaciones de verano" });
  assert.deepEqual({ ...context.loadMesPlantillaNombres() }, { 12: "Navidad", 7: "Vacaciones de verano" });
});

// --- Parte B: handlers de guardar/quitar ---------------------------------------------------------

test("P-3 · handleMesPlantillaNombreSave guarda el nombre recortado y vuelve a renderizar", () => {
  const storage = storageStub();
  const renders = [];
  const context = sandboxWith(
    ["mesPlantillaNombresStorageKey", "loadMesPlantillaNombres", "saveMesPlantillaNombres", "handleMesPlantillaNombreSave"],
    {
      ...storage,
      document: { querySelector: () => ({ value: "  Navidad  " }) },
      renderPresupuestoMes: () => renders.push("render"),
    },
  );
  context.handleMesPlantillaNombreSave("12");
  assert.deepEqual({ ...context.loadMesPlantillaNombres() }, { 12: "Navidad" });
  assert.deepEqual(renders, ["render"]);
});

test("P-3 · handleMesPlantillaNombreSave con el campo vacío quita el nombre en vez de guardar cadena vacía", () => {
  const storage = storageStub();
  const context = sandboxWith(
    ["mesPlantillaNombresStorageKey", "loadMesPlantillaNombres", "saveMesPlantillaNombres", "handleMesPlantillaNombreSave"],
    {
      ...storage,
      document: { querySelector: () => ({ value: "   " }) },
      renderPresupuestoMes: () => {},
    },
  );
  context.saveMesPlantillaNombres({ 12: "Navidad" });
  context.handleMesPlantillaNombreSave("12");
  assert.deepEqual({ ...context.loadMesPlantillaNombres() }, {});
});

test("P-3 · handleMesPlantillaNombreSave recorta el nombre a 60 caracteres", () => {
  const storage = storageStub();
  const context = sandboxWith(
    ["mesPlantillaNombresStorageKey", "loadMesPlantillaNombres", "saveMesPlantillaNombres", "handleMesPlantillaNombreSave"],
    {
      ...storage,
      document: { querySelector: () => ({ value: "x".repeat(90) }) },
      renderPresupuestoMes: () => {},
    },
  );
  context.handleMesPlantillaNombreSave("3");
  assert.equal(context.loadMesPlantillaNombres()["3"].length, 60);
});

test("P-3 · handleMesPlantillaNombreRemove quita solo el mes indicado", () => {
  const storage = storageStub();
  const renders = [];
  const context = sandboxWith(
    ["mesPlantillaNombresStorageKey", "loadMesPlantillaNombres", "saveMesPlantillaNombres", "handleMesPlantillaNombreRemove"],
    { ...storage, renderPresupuestoMes: () => renders.push("render") },
  );
  context.saveMesPlantillaNombres({ 12: "Navidad", 7: "Verano" });
  context.handleMesPlantillaNombreRemove("12");
  assert.deepEqual({ ...context.loadMesPlantillaNombres() }, { 7: "Verano" });
  assert.deepEqual(renders, ["render"]);
});

// --- Parte C: presupuestoMesTemplateHtml ---------------------------------------------------------

function viewSandbox({ categories = [], patternsByCategory = {}, names = {} } = {}) {
  return sandboxWith(["mesPlantillaNombresStorageKey", "loadMesPlantillaNombres", "saveMesPlantillaNombres", "presupuestoMesTemplateHtml"], {
    ...storageStub(),
    budgetableCategories: () => categories,
    budgetSeasonalPatterns: (category) => patternsByCategory[category] || [],
    budgetCalendarMonthName: (monthNumber) => ({ 12: "diciembre", 7: "julio" }[monthNumber] || `mes-${monthNumber}`),
    _seedNames: names,
  });
}

test("P-3 · sin patrones detectados y sin nombre guardado, la tarjeta no pinta nada", () => {
  const context = viewSandbox({ categories: ["comida"], patternsByCategory: { comida: [] } });
  assert.equal(context.presupuestoMesTemplateHtml("2026-12"), "");
});

test("P-3 · con un patrón estacional detectado, ofrece nombrar el mes y lista el patrón", () => {
  const context = viewSandbox({
    categories: ["regalos", "comida"],
    patternsByCategory: {
      regalos: [{ calendarMonth: 12, avg: 320, samples: 3, deviationPct: 45 }],
      comida: [{ calendarMonth: 12, avg: 210, samples: 3, deviationPct: -12 }],
    },
  });
  const html = context.presupuestoMesTemplateHtml("2026-12");
  assert.match(html, /Plantilla de diciembre/);
  assert.match(html, /regalos: \+45% frente a la media \(3 observaciones, media €320\)/);
  assert.match(html, /comida: -12% frente a la media \(3 observaciones, media €210\)/);
  assert.match(html, /data-mes-plantilla-nombre-save="12"/);
  assert.match(html, />Guardar nombre</);
  assert.ok(!html.includes("Quitar nombre"), "sin nombre guardado no debe ofrecer quitarlo");
});

test("P-3 · los patrones se listan ordenados por desviación absoluta, de mayor a menor", () => {
  const context = viewSandbox({
    categories: ["a", "b", "c"],
    patternsByCategory: {
      a: [{ calendarMonth: 12, avg: 100, samples: 2, deviationPct: 11 }],
      b: [{ calendarMonth: 12, avg: 100, samples: 2, deviationPct: -60 }],
      c: [{ calendarMonth: 12, avg: 100, samples: 2, deviationPct: 25 }],
    },
  });
  const html = context.presupuestoMesTemplateHtml("2026-12");
  const order = ["b", "c", "a"].map((cat) => html.indexOf(`${cat}:`));
  assert.ok(order[0] < order[1] && order[1] < order[2], "b (-60%) antes que c (25%) antes que a (11%)");
});

test("P-3 · patrones de otro mes del calendario no cuentan para el mes en curso", () => {
  const context = viewSandbox({
    categories: ["regalos"],
    patternsByCategory: { regalos: [{ calendarMonth: 7, avg: 100, samples: 2, deviationPct: 30 }] },
  });
  assert.equal(context.presupuestoMesTemplateHtml("2026-12"), "");
});

test("P-3 · con un nombre ya guardado, lo muestra en el título y ofrece actualizar o quitar", () => {
  const context = viewSandbox({
    categories: ["regalos"],
    patternsByCategory: { regalos: [{ calendarMonth: 12, avg: 320, samples: 3, deviationPct: 45 }] },
  });
  context.saveMesPlantillaNombres({ 12: "Navidad" });
  const html = context.presupuestoMesTemplateHtml("2026-12");
  assert.match(html, /Plantilla de diciembre — «Navidad»/);
  assert.match(html, /value="Navidad"/);
  assert.match(html, />Actualizar nombre</);
  assert.match(html, /data-mes-plantilla-nombre-remove="12"/);
});

test("P-3 · con nombre guardado pero sin patrones este año, conserva el nombre y avisa en vez de fabricar datos", () => {
  const context = viewSandbox({ categories: ["regalos"], patternsByCategory: { regalos: [] } });
  context.saveMesPlantillaNombres({ 12: "Navidad" });
  const html = context.presupuestoMesTemplateHtml("2026-12");
  assert.match(html, /Plantilla de diciembre — «Navidad»/);
  assert.match(html, /Sin patrones estacionales detectados este año para diciembre, pero el nombre se conserva\./);
});

test("P-3 · el nombre guardado por el usuario se escapa al pintarlo (sin XSS)", () => {
  const context = viewSandbox({
    categories: ["regalos"],
    patternsByCategory: { regalos: [{ calendarMonth: 12, avg: 100, samples: 2, deviationPct: 20 }] },
  });
  context.saveMesPlantillaNombres({ 12: '<script>alert(1)</script>' });
  const html = context.presupuestoMesTemplateHtml("2026-12");
  assert.ok(!html.includes("<script>alert(1)</script>"), "el nombre debe salir escapado");
  assert.match(html, /&lt;script&gt;/);
});

// --- Parte D: wiring estático ---------------------------------------------------------------------

test("P-3 · presupuestoMesTemplateHtml está conectado en renderPresupuestoMes, tras la tarjeta de patrones", () => {
  assert.match(viewSrc, /\$\{presupuestoMesSeasonalHtml\(monthKey\)\}[\s\S]{0,60}\$\{presupuestoMesTemplateHtml\(monthKey\)\}/);
});

test("P-3 · el clic en «Guardar/Actualizar nombre» llama a handleMesPlantillaNombreSave con el mes del botón", () => {
  assert.match(app, /data-mes-plantilla-nombre-save[^\n]*\n\s*if \(plantillaSaveButton\) \{ handleMesPlantillaNombreSave\(plantillaSaveButton\.dataset\.mesPlantillaNombreSave\); return; \}/);
});

test("P-3 · el clic en «Quitar nombre» llama a handleMesPlantillaNombreRemove con el mes del botón", () => {
  assert.match(app, /data-mes-plantilla-nombre-remove[^\n]*\n\s*if \(plantillaRemoveButton\) handleMesPlantillaNombreRemove\(plantillaRemoveButton\.dataset\.mesPlantillaNombreRemove\);/);
});

test("P-3 · budgetSeasonalPatterns (ML-1) se reutiliza tal cual, sin un motor de estacionalidad nuevo", () => {
  const source = extractFunction("presupuestoMesTemplateHtml");
  assert.match(source, /budgetSeasonalPatterns\(category, monthKey\)/);
});
