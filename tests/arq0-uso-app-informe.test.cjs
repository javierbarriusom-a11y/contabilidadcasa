const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// ARQ-0 (BACKLOG_CONTABILIDADCASA_3_0.md §1): el contador de visitas por pantalla ya existía desde
// T-4/OPT-2 (22 de agosto de 2026, ver tests/t-4-contador-visitas.test.cjs), pero solo se enseñaba
// dentro de la ficha de cada una de las 17 heredadas de Laboratorio. Estas pruebas cubren el informe
// nuevo (usoAppRows/usoAppSummaryText/usoAppRowHtml/usoAppTableHtml) que reutiliza ese mismo
// contador sobre viewTitles — el catálogo real de las ~40 pantallas de la app — sin motor nuevo, y
// su cableado en renderAjustesUsoApp/renderAjustes.

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

function extractConst(name) {
  const marker = `const ${name} = `;
  const start = app.indexOf(marker);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const valueStart = start + marker.length;
  const openChar = app[valueStart];
  assert.ok(openChar === "[" || openChar === "{", `${name} no empieza con [ ni {`);
  const closeChar = openChar === "[" ? "]" : "}";
  let depth = 0;
  for (let index = valueStart; index < app.length; index += 1) {
    if (app[index] === openChar) depth += 1;
    else if (app[index] === closeChar) {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`${name} no cierra`);
}

function sandboxWith(names, consts, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  consts.forEach((name) => vm.runInContext(`${extractConst(name)}\nthis.${name} = ${name};`, context));
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function fakeVisits(map) {
  return (id) => map[id] || { count: 0, last: "" };
}

const realViewTitles = (() => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractConst("viewTitles")}\nthis.viewTitles = viewTitles;`, context);
  return context.viewTitles;
})();

// --- usoAppRows ---------------------------------------------------------------------------------

test("ARQ-0 · usoAppRows devuelve una fila por cada pantalla de viewTitles, ninguna de más ni de menos", () => {
  const context = sandboxWith(["usoAppRows"], ["viewTitles"], {
    viewVisitSummary: fakeVisits({}),
  });
  const rows = context.usoAppRows();
  assert.equal(rows.length, Object.keys(realViewTitles).length);
  assert.deepEqual(new Set(rows.map((row) => row.id)), new Set(Object.keys(realViewTitles)));
});

test("ARQ-0 · usoAppRows ordena de más a menos abierta", () => {
  const context = sandboxWith(["usoAppRows"], ["viewTitles"], {
    viewVisitSummary: fakeVisits({ home: { count: 3, last: "2026-09-20" }, analisis: { count: 9, last: "2026-09-21" } }),
  });
  const rows = context.usoAppRows();
  assert.equal(rows[0].id, "analisis");
  const homeIndex = rows.findIndex((row) => row.id === "home");
  const analisisIndex = rows.findIndex((row) => row.id === "analisis");
  assert.ok(analisisIndex < homeIndex);
});

test("ARQ-0 · usoAppRows nunca lanza con una pantalla sin ninguna visita todavía", () => {
  const context = sandboxWith(["usoAppRows"], ["viewTitles"], {
    viewVisitSummary: fakeVisits({}),
  });
  const rows = context.usoAppRows();
  assert.ok(rows.every((row) => row.count === 0 && row.last === ""));
});

// --- usoAppSummaryText ---------------------------------------------------------------------------

test("ARQ-0 · usoAppSummaryText cuenta el total y cuántas siguen sin ninguna apertura", () => {
  const context = sandboxWith(["usoAppSummaryText"], []);
  const rows = [
    { id: "a", count: 3 },
    { id: "b", count: 0 },
    { id: "c", count: 0 },
  ];
  assert.equal(context.usoAppSummaryText(rows), "3 pantallas registradas · 2 sin ninguna apertura todavía.");
});

// --- usoAppRowHtml / usoAppTableHtml -------------------------------------------------------------

test("ARQ-0 · usoAppRowHtml escapa el título y muestra un guion cuando nunca se abrió", () => {
  const context = sandboxWith(["usoAppRowHtml"], [], {
    escapeHtml: (v) => String(v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    formatIsoDate: (v) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : ""),
  });
  const row = { title: "<script>", eyebrow: "Hoy", count: 0, last: "" };
  const rowHtml = context.usoAppRowHtml(row);
  assert.match(rowHtml, /&lt;script&gt;/);
  assert.match(rowHtml, /<td>—<\/td>/);
});

test("ARQ-0 · usoAppRowHtml formatea la fecha de última apertura cuando sí hay visitas", () => {
  const context = sandboxWith(["usoAppRowHtml"], [], {
    escapeHtml: (v) => String(v ?? ""),
    formatIsoDate: (v) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : ""),
  });
  const row = { title: "Análisis", eyebrow: "Analizar", count: 5, last: "2026-09-21" };
  assert.match(context.usoAppRowHtml(row), /<td>21\/09\/2026<\/td>/);
});

test("ARQ-0 · usoAppTableHtml concatena una fila por pantalla", () => {
  const context = sandboxWith(["usoAppTableHtml", "usoAppRowHtml"], [], {
    escapeHtml: (v) => String(v ?? ""),
    formatIsoDate: () => "",
  });
  const rows = [
    { title: "Hoy", eyebrow: "Hoy", count: 1, last: "" },
    { title: "Análisis", eyebrow: "Analizar", count: 2, last: "" },
  ];
  const tableHtml = context.usoAppTableHtml(rows);
  assert.equal((tableHtml.match(/<tr>/g) || []).length, 2);
});

// --- Cableado: renderAjustesUsoApp / renderAjustes -----------------------------------------------

test("ARQ-0 · renderAjustesUsoApp escribe el resumen y las filas en el DOM", () => {
  const elements = { usoAppSummary: { textContent: "" }, usoAppTableBody: { innerHTML: "" } };
  const context = sandboxWith(["renderAjustesUsoApp"], [], {
    qs: (id) => elements[id] || null,
    usoAppRows: () => [{ id: "home", title: "Hoy", eyebrow: "Hoy", count: 2, last: "2026-09-21" }],
    usoAppSummaryText: () => "1 pantallas registradas · 0 sin ninguna apertura todavía.",
    usoAppTableHtml: () => "<tr><td>Hoy</td></tr>",
  });
  context.renderAjustesUsoApp();
  assert.equal(elements.usoAppSummary.textContent, "1 pantallas registradas · 0 sin ninguna apertura todavía.");
  assert.equal(elements.usoAppTableBody.innerHTML, "<tr><td>Hoy</td></tr>");
});

test("ARQ-0 · renderAjustes llama a renderAjustesUsoApp junto a renderAjustesLaboratorio", () => {
  const source = extractFunction("renderAjustes");
  assert.match(source, /renderAjustesLaboratorio\(\);\s*\n\s*renderAjustesUsoApp\(\);/);
});

// --- Markup: el panel vive en Ajustes, con su ancla, junto a Laboratorio -------------------------

test("ARQ-0 · index.html tiene el ancla y el grupo «Uso de la app» en Ajustes", () => {
  assert.match(html, /data-ajustes-anchor="ajustes-uso-app">Uso de la app</);
  assert.match(html, /id="ajustes-uso-app" aria-labelledby="ajustes-uso-app-title"/);
  assert.match(html, /id="usoAppSummary"/);
  assert.match(html, /id="usoAppTableBody"/);
});
