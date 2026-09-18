/**
 * tests/t8-alto-contraste-y-reduced-motion.test.cjs
 *
 * T8 (BACKLOG_CONTABILIDADCASA_2_0.md, Horizonte 2): `prefers-reduced-motion` y modo de alto
 * contraste. La investigación previa a esta tarea encontró que `prefers-reduced-motion` YA estaba
 * construido (OPT-9, ver `tests/opt9-auditoria-important.test.cjs`) — la nota original del backlog
 * ("cero ocurrencias") estaba desactualizada, no era un hueco real. El alcance real de esta sesión
 * fue: 1) confirmarlo y dejar constancia, 2) construir `prefers-contrast: more` (ausente de verdad),
 * y 3) un hallazgo de paso: el anillo de foco de teclado (`:focus-visible`) tenía un color fijo con
 * solo 1,5-1,7:1 de contraste en el tema claro — muy por debajo del 3:1 de WCAG 1.4.11 — separado
 * ahora en `--focus-ring` por tema.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const stylesCss = read("styles.css");
const designTokensCss = read("design-tokens.css");

// --- prefers-reduced-motion ya existía (OPT-9) — no es un hueco de esta tarea ------------------

test("prefers-reduced-motion: el override universal de OPT-9 ya existía antes de T8, cubre animation/transition/scroll-behavior", () => {
  assert.match(stylesCss, /@media \(prefers-reduced-motion: reduce\) \{/);
  const start = stylesCss.indexOf("@media (prefers-reduced-motion: reduce)");
  const end = stylesCss.indexOf("}", stylesCss.indexOf("{", start));
  const block = stylesCss.slice(start, end);
  assert.match(block, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(block, /animation-iteration-count:\s*1\s*!important/);
  assert.match(block, /scroll-behavior:\s*auto\s*!important/);
  assert.match(block, /transition-duration:\s*0\.01ms\s*!important/);
});

test("prefers-reduced-motion: único @keyframes del proyecto (viewIn) queda cubierto por el override universal, sin excepción propia", () => {
  const keyframeCount = (stylesCss.match(/@keyframes/g) || []).length;
  assert.equal(keyframeCount, 1, "si aparece un @keyframes nuevo, confirmar que sigue bajo el override universal de arriba");
  assert.match(stylesCss, /@keyframes viewIn/);
});

// --- prefers-contrast: more — construido en esta sesión -----------------------------------------

test("styles.css: prefers-contrast:more refuerza --muted/--line con color-mix sobre --ink, sin duplicar paleta por tema", () => {
  assert.match(stylesCss, /@media \(prefers-contrast: more\) \{/);
  const start = stylesCss.indexOf("@media (prefers-contrast: more)");
  const end = stylesCss.indexOf("\n}\n", start);
  const block = stylesCss.slice(start, end);
  assert.match(block, /--muted:\s*color-mix\(in srgb, var\(--ink\) 40%, var\(--muted\) 60%\)/);
  assert.match(block, /--line:\s*color-mix\(in srgb, var\(--ink\) 45%, var\(--line\) 55%\)/);
  assert.match(block, /outline-width:\s*4px/);
  assert.match(block, /outline-offset:\s*4px/);
});

test("design-tokens.css: prefers-contrast:more refuerza --e19-muted/--e19-faint/--e19-border/--e19-border-strong igual que styles.css", () => {
  assert.match(designTokensCss, /@media \(prefers-contrast: more\) \{/);
  const start = designTokensCss.indexOf("@media (prefers-contrast: more)");
  const end = designTokensCss.indexOf("\n}\n", start);
  const block = designTokensCss.slice(start, end);
  ["--e19-muted", "--e19-faint", "--e19-border", "--e19-border-strong"].forEach((token) => {
    assert.match(block, new RegExp(`${token}:\\s*color-mix\\(in srgb, var\\(--e19-ink\\)`));
  });
});

test("prefers-contrast:more no depende de --e19-heading/--e19-accent — esos ya tienen su compromiso documentado en T7, esta tarea no lo reabre", () => {
  const start = designTokensCss.indexOf("@media (prefers-contrast: more)");
  const end = designTokensCss.indexOf("\n}\n", start);
  const block = designTokensCss.slice(start, end);
  assert.doesNotMatch(block, /--e19-heading|--e19-accent\b/);
});

// --- Hallazgo: anillo de foco de teclado invisible en tema claro --------------------------------

test("--focus-ring separa el color del anillo de foco por tema (navy en claro, ámbar en oscuro) — antes era un solo hex fijo", () => {
  assert.match(stylesCss, /--focus-ring:\s*#293e5e;/);
  const darkMatches = stylesCss.match(/--focus-ring:\s*#f2bf4f;/g) || [];
  assert.equal(darkMatches.length, 2, "debe fijarse en el bloque @media dark y en :root[data-theme=\"dark\"]");
  assert.doesNotMatch(stylesCss, /outline:\s*3px solid #f2bf4f/, "el :focus-visible universal ya no debe fijar el amarillo directamente");
});

test(":focus-visible universal usa var(--focus-ring), no un hex fijo", () => {
  // El mismo selector aparece también dentro de @media (prefers-contrast: more) reforzando el
  // grosor — se busca la última aparición, la regla base fuera de esa media query.
  const start = stylesCss.lastIndexOf(':where(a, button, input, select, textarea, summary, [tabindex]):focus-visible');
  const block = stylesCss.slice(start, start + 150);
  assert.match(block, /outline:\s*3px solid var\(--focus-ring\)/);
});

// --- Wiring: no se ha introducido ningún <select>/checkbox sin color-scheme ---------------------

test("color-scheme está declarado (T7) — prerequisito para que los controles nativos respeten alto contraste/tema", () => {
  assert.match(stylesCss, /color-scheme:\s*light;/);
  assert.match(stylesCss, /color-scheme:\s*dark;/);
});

test("index.html: styles.css y design-tokens.css llevan el bump de versión de T8", () => {
  assert.match(html, /styles\.css\?v=20260918t8a1/);
  assert.match(html, /design-tokens\.css\?v=20260918t8a1/);
});
