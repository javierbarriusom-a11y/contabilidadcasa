const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const deuda = read("views/deuda.js");
const inversion = read("views/inversion.js");
const html = read("index.html");

// NAV-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.3): heurístico 6 de Nielsen (reconocer, no recordar),
// mismo criterio que ya aplicó T17 — repetir en texto, en el punto de uso, un dato/contexto que el
// usuario tendría que recordar o ir a buscar a otra pantalla, sin construir UI nueva si ya existe
// una forma barata de decirlo con palabras. Inversión ya seguía el patrón "<Grupo> · <Pestaña>" en
// su eyebrow (`"Inversión · Cartera"`, etc.); Deuda decía "Decidir · <descripción libre>" —
// vestigial desde que NAV-1 sacó Deuda del grupo «Decidir» del menú avanzado — y no repetía ni la
// palabra "Deuda" ni la etiqueta exacta de su propia pestaña activa. Este test fija que las 9
// pestañas de segundo nivel (5 de Inversión + 4 de Deuda) usan el mismo patrón consistente, y que
// el eyebrow estático de cada sección (index.html) coincide EXACTAMENTE con la entrada gemela de
// `viewTitles` (app.js) que alimenta la cabecera compartida real (#viewEyebrow, setActiveView) —
// el propio comentario de viewTitles ya prometía esa igualdad sin que nada la comprobara.

function extractConst(source, name) {
  const start = source.indexOf(`const ${name} = [`);
  assert.ok(start >= 0, `No existe la constante ${name}`);
  let depth = 0;
  for (let index = source.indexOf("[", start); index < source.length; index += 1) {
    if (source[index] === "[") depth += 1;
    else if (source[index] === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} no cierra`);
}

function tabsFrom(source, name) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractConst(source, name)}\nthis.${name} = ${name};`, context);
  return context[name];
}

const DEUDA_SCREEN_TABS = tabsFrom(deuda, "DEUDA_SCREEN_TABS");
const INVERSION_SCREEN_TABS = tabsFrom(inversion, "INVERSION_SCREEN_TABS");

function staticEyebrowFor(viewId) {
  const sectionStart = html.indexOf(`id="${viewId}"`);
  assert.ok(sectionStart >= 0, `No existe la sección #${viewId}`);
  const eyebrowStart = html.indexOf('<p class="panel-kicker e19-eyebrow">', sectionStart);
  const eyebrowEnd = html.indexOf("</p>", eyebrowStart);
  assert.ok(eyebrowStart >= 0 && eyebrowStart - sectionStart < 800, `No se encontró el eyebrow de #${viewId} cerca de su apertura`);
  return html.slice(eyebrowStart + '<p class="panel-kicker e19-eyebrow">'.length, eyebrowEnd);
}

const viewTitlesStart = app.indexOf("const viewTitles = {");
assert.ok(viewTitlesStart >= 0, "No existe viewTitles en app.js");

function viewTitlesEyebrowFor(viewId) {
  // Ojo: "<id>": { también aparece antes, en el loader de fragmentos lazy (src/rootId, sin
  // eyebrow) — se busca a partir de donde arranca viewTitles, no la primera ocurrencia cualquiera.
  const marker = `"${viewId}": {`;
  const start = app.indexOf(marker, viewTitlesStart);
  assert.ok(start >= 0, `No existe la entrada "${viewId}" en viewTitles`);
  const block = app.slice(start, app.indexOf("}", start));
  const match = /eyebrow: "([^"]*)"/.exec(block);
  assert.ok(match, `La entrada "${viewId}" no tiene eyebrow`);
  return match[1];
}

// --- Las 4 pestañas de Deuda usan "Deuda · <Pestaña>", igual que Inversión -----------------------

test("NAV-4 · las cuatro pestañas de Deuda repiten «Deuda · <Pestaña>», con la etiqueta exacta de su propia pestaña", () => {
  DEUDA_SCREEN_TABS.forEach((tab) => {
    const expected = `Deuda · ${tab.label}`;
    assert.equal(staticEyebrowFor(tab.id), expected, `${tab.id}: el eyebrow estático debe ser "${expected}"`);
    assert.equal(viewTitlesEyebrowFor(tab.id), expected, `${tab.id}: viewTitles.eyebrow debe ser "${expected}"`);
  });
});

test("NAV-4 · ninguna pestaña de Deuda sigue diciendo «Decidir» (vestigial desde que NAV-1 la sacó de ese grupo)", () => {
  DEUDA_SCREEN_TABS.forEach((tab) => {
    assert.doesNotMatch(staticEyebrowFor(tab.id), /^Decidir/, `${tab.id} no debería empezar por "Decidir"`);
  });
});

// --- Las 5 pestañas de Inversión ya seguían el patrón — esto fija que NAV-4 no las rompe ----------

test("NAV-4 · las cinco pestañas de Inversión ya seguían «Inversión · <Pestaña>» y siguen así", () => {
  INVERSION_SCREEN_TABS.forEach((tab) => {
    const expected = `Inversión · ${tab.label}`;
    assert.equal(staticEyebrowFor(tab.id), expected, `${tab.id}: el eyebrow estático debe ser "${expected}"`);
    assert.equal(viewTitlesEyebrowFor(tab.id), expected, `${tab.id}: viewTitles.eyebrow debe ser "${expected}"`);
  });
});

// --- El eyebrow estático (index.html) y el gemelo de viewTitles (app.js) nunca divergen -----------

test("NAV-4 · el eyebrow estático de cada pestaña coincide siempre con su entrada gemela de viewTitles", () => {
  [...DEUDA_SCREEN_TABS, ...INVERSION_SCREEN_TABS].forEach((tab) => {
    assert.equal(staticEyebrowFor(tab.id), viewTitlesEyebrowFor(tab.id), `${tab.id}: index.html y viewTitles deben decir exactamente lo mismo`);
  });
});
