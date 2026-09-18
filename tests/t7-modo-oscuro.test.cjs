/**
 * tests/t7-modo-oscuro.test.cjs
 *
 * T7 (BACKLOG_CONTABILIDADCASA_2_0.md, Horizonte 2): modo oscuro real. Se sigue automáticamente el
 * sistema (`prefers-color-scheme`) salvo que el hogar fuerce un tema desde Personalizar
 * (`data-theme` en `<html>`). Cubre: la paleta oscura en los tres CSS (styles.css, design-tokens.css,
 * p2.css), el script inline anti-parpadeo de index.html, las funciones compartidas de app.js
 * (themePreference/applyThemePreference/setThemePreference/chartColor) y el control de tres
 * opciones en el diálogo "Personalización progresiva".
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");
const stylesCss = read("styles.css");
const designTokensCss = read("design-tokens.css");
const p2Css = read("p2.css");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
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

// Sandbox mínimo con un localStorage y un document.documentElement.dataset reales (objetos planos
// de JS), sin JSDOM — mismo límite que el resto de la suite (tests/o10-atajo-teclado-lanzador.test.cjs
// hace lo mismo para setupE17Experience).
function sandbox({ initialStored } = {}) {
  const store = {};
  if (initialStored !== undefined) store["theme-preference"] = initialStored;
  const themeInputs = [];
  const documentElement = { dataset: {} };
  const context = {
    // themePreference/applyThemePreference/setThemePreference leen esta constante de módulo, que
    // extractFunction() no captura (vive fuera del cuerpo de la función) — se inyecta aquí con el
    // mismo valor real que app.js, para no fingir un comportamiento que el código no tiene.
    THEME_STORAGE_KEY: "theme-preference",
    window: {
      localStorage: {
        getItem: (key) => (key in store ? store[key] : null),
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
      },
    },
    document: {
      documentElement,
      querySelectorAll: (selector) => (selector === "[data-e17-theme]" ? themeInputs : []),
    },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("themePreference"), context);
  vm.runInContext(extractFunction("applyThemePreference"), context);
  vm.runInContext(extractFunction("setThemePreference"), context);
  vm.runInContext(extractFunction("chartColor"), context);
  return { context, store, documentElement, themeInputs };
}

test("themePreference · sin nada guardado, por defecto es 'auto'", () => {
  const { context } = sandbox();
  assert.equal(context.themePreference(), "auto");
});

test("themePreference · valores guardados válidos se respetan, cualquier otra cosa cae a 'auto'", () => {
  assert.equal(sandbox({ initialStored: "light" }).context.themePreference(), "light");
  assert.equal(sandbox({ initialStored: "dark" }).context.themePreference(), "dark");
  assert.equal(sandbox({ initialStored: "sepia" }).context.themePreference(), "auto");
});

test("themePreference · localStorage no disponible (lanza al leer) cae a 'auto', nunca revienta", () => {
  const context = { window: { localStorage: { getItem() { throw new Error("blocked"); } } } };
  vm.createContext(context);
  vm.runInContext(extractFunction("themePreference"), context);
  assert.equal(context.themePreference(), "auto");
});

test("applyThemePreference · 'light'/'dark' fijan data-theme en <html>; 'auto' lo quita", () => {
  const { context, documentElement } = sandbox();
  context.applyThemePreference("dark");
  assert.equal(documentElement.dataset.theme, "dark");
  context.applyThemePreference("light");
  assert.equal(documentElement.dataset.theme, "light");
  context.applyThemePreference("auto");
  assert.equal(documentElement.dataset.theme, undefined);
});

test("applyThemePreference · marca el radio correspondiente entre los [data-e17-theme], desmarca el resto", () => {
  const { context, themeInputs } = sandbox();
  const auto = { dataset: { e17Theme: "auto" }, checked: false };
  const light = { dataset: { e17Theme: "light" }, checked: false };
  const dark = { dataset: { e17Theme: "dark" }, checked: true };
  themeInputs.push(auto, light, dark);
  context.applyThemePreference("light");
  assert.equal(auto.checked, false);
  assert.equal(light.checked, true);
  assert.equal(dark.checked, false);
});

test("applyThemePreference · sin argumento, lee la preferencia ya guardada", () => {
  const { context, documentElement } = sandbox({ initialStored: "dark" });
  context.applyThemePreference();
  assert.equal(documentElement.dataset.theme, "dark");
});

test("setThemePreference · persiste en localStorage y aplica al momento", () => {
  const { context, store, documentElement } = sandbox();
  context.setThemePreference("dark");
  assert.equal(store["theme-preference"], "dark");
  assert.equal(documentElement.dataset.theme, "dark");
  context.setThemePreference("auto");
  assert.equal("theme-preference" in store, false);
  assert.equal(documentElement.dataset.theme, undefined);
});

test("setThemePreference · sin localStorage disponible, sigue aplicando el tema para esta sesión", () => {
  const documentElement = { dataset: {} };
  const context = {
    window: { localStorage: { setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } } },
    document: { documentElement, querySelectorAll: () => [] },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("applyThemePreference"), context);
  vm.runInContext(extractFunction("setThemePreference"), context);
  context.setThemePreference("dark");
  assert.equal(documentElement.dataset.theme, "dark");
});

test("chartColor · devuelve el valor de la variable CSS si existe, si no el fallback", () => {
  const context = {
    document: { documentElement: {} },
    getComputedStyle: () => ({ getPropertyValue: (name) => (name === "--blue" ? "  #4c81e5  " : "") }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("chartColor"), context);
  assert.equal(context.chartColor("--blue", "#2c6be0"), "#4c81e5");
  assert.equal(context.chartColor("--sin-definir", "#2c6be0"), "#2c6be0");
});

// --- CSS: paleta oscura real, no solo el gancho de la clase ------------------------------------

test("styles.css: @media (prefers-color-scheme: dark) y :root[data-theme=\"dark\"] redefinen la paleta heredada", () => {
  assert.match(stylesCss, /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\)/);
  assert.match(stylesCss, /:root\[data-theme="dark"\] \{/);
  ["--bg", "--surface", "--ink", "--muted", "--line", "--blue", "--teal", "--green", "--red", "--amber", "--violet", "--chart-muted-line"].forEach((token) => {
    const count = stylesCss.split(token).length - 1;
    assert.ok(count >= 3, `${token} debería declararse en :root, en el bloque @media y en :root[data-theme="dark"] (encontrado ${count} veces)`);
  });
});

test("design-tokens.css: paleta oscura --e19-* completa, reutilizando canvas/surface de styles.css a propósito", () => {
  assert.match(designTokensCss, /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\)/);
  assert.match(designTokensCss, /:root\[data-theme="dark"\] \{/);
  ["--e19-canvas", "--e19-surface", "--e19-ink", "--e19-heading", "--e19-accent", "--e19-success", "--e19-warning", "--e19-danger", "--e19-debt"].forEach((token) => {
    const count = designTokensCss.split(token).length - 1;
    assert.ok(count >= 3, `${token} debería declararse en :root, en el bloque @media y en :root[data-theme="dark"] (encontrado ${count} veces)`);
  });
});

test("p2.css: reutiliza las variables de styles.css para su modo oscuro, sin duplicar toda la paleta", () => {
  assert.match(p2Css, /@media \(prefers-color-scheme: dark\) \{/);
  assert.match(p2Css, /:root\[data-theme="dark"\] \.p2-panel/);
  assert.match(p2Css, /var\(--surface\)/);
  assert.match(p2Css, /var\(--ink\)/);
});

test("las hojas de estilo no usan anidamiento CSS ('&'), consistente con el resto del proyecto", () => {
  [stylesCss, designTokensCss, p2Css].forEach((css) => {
    assert.doesNotMatch(css, /\{\s*&\s/);
  });
});

// --- HTML: script anti-parpadeo, meta theme-color y control de tema ----------------------------

test("index.html: el script inline de tema vive en <head>, antes de las hojas de estilo, y solo lee localStorage", () => {
  const headEnd = html.indexOf("</head>");
  const scriptStart = html.indexOf('window.localStorage.getItem("theme-preference")');
  const firstStylesheet = html.indexOf('rel="stylesheet"');
  assert.ok(scriptStart >= 0 && scriptStart < headEnd, "El script de tema debe vivir en <head>");
  assert.ok(scriptStart < firstStylesheet, "El script debe ir antes de las hojas de estilo para evitar parpadeo");
  assert.doesNotMatch(html.slice(0, headEnd), /localStorage\.setItem/, "El script inline nunca debe escribir, solo leer");
});

test("index.html: no queda el literal \"app.js\" en prosa (rompería los tests de orden de carga que usan indexOf)", () => {
  const occurrences = html.split("app.js").length - 1;
  assert.equal(occurrences, 1, "\"app.js\" debe aparecer una sola vez: en su propio <script>, nunca en un comentario");
});

test("index.html: meta theme-color declara variante clara y oscura", () => {
  assert.match(html, /<meta name="theme-color" content="#0b1f33" media="\(prefers-color-scheme: light\)" \/>/);
  assert.match(html, /<meta name="theme-color" content="#10161a" media="\(prefers-color-scheme: dark\)" \/>/);
});

test("index.html: el diálogo de Personalizar tiene el fieldset de tema con las tres opciones", () => {
  const dialogStart = html.indexOf('id="e17PreferencesDialog"');
  const dialogEnd = html.indexOf("</dialog>", dialogStart);
  const dialog = html.slice(dialogStart, dialogEnd);
  assert.match(dialog, /id="e17ThemeFields"/);
  ["auto", "light", "dark"].forEach((value) => {
    assert.match(dialog, new RegExp(`data-e17-theme="${value}"`));
  });
  assert.match(dialog, /name="e17Theme"/g);
});

// --- app.js: wiring real ------------------------------------------------------------------------

test("setupE17Experience: aplica el tema al iniciar y escucha 'change' en [data-e17-theme]", () => {
  const block = extractFunction("setupE17Experience");
  assert.match(block, /applyThemePreference\(\);/);
  assert.match(block, /document\.addEventListener\("change", \(event\) => \{/);
  assert.match(block, /setThemePreference\(themeInput\.dataset\.e17Theme\)/);
});

test("openE17Dialog: al abrir 'preferences' también sincroniza el tema, no solo la navegación", () => {
  const block = extractFunction("openE17Dialog");
  assert.match(block, /applyE17Preferences\(\); applyThemePreference\(\); \}/);
});

test("los cuatro gráficos SVG a mano usan chartColor() en vez de hexadecimales embebidos para blue/teal/green/red/violet/gris", () => {
  // Los únicos hex sueltos que deben quedar son los "halo" blancos de los puntos (stroke="#fff"),
  // documentados como decisión de diseño, no un hueco de modo oscuro.
  const strayHex = [...app.matchAll(/(?:stroke|fill)="#[0-9a-fA-F]{3,6}"/g)].map((m) => m[0]);
  const allowed = strayHex.every((match) => match === 'stroke="#fff"');
  assert.ok(allowed, `Colores de gráfico sin pasar por chartColor(): ${strayHex.filter((m) => m !== 'stroke="#fff"').join(", ")}`);
  assert.match(app, /function chartColor\(varName, fallback\)/);
});

// --- Versionado de caché --------------------------------------------------------------------

test("index.html: styles.css, p2.css, design-tokens.css y app.js comparten el nuevo bump de versión de T7", () => {
  ["styles.css", "p2.css", "design-tokens.css"].forEach((file) => {
    assert.match(html, new RegExp(`${file.replace(".", "\\.")}\\?v=20260918t7a1`));
  });
  assert.match(html, /<script defer src="app\.js\?v=20260918t7a1">/);
});
