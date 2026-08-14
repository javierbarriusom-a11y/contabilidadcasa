const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const css = read("design-tokens.css");
const html = read("index.html");
const worker = read("service-worker.js");
const designSystem = read("design-system.html");

// T-2 · el acento interactivo pasa de azul (`#0072E3`) a navy (`#293E5E`), el mismo tono que ya
// usaba `--e19-heading` — así lo pide el handoff, que nombra ese navy como «primario, títulos, pie
// de impacto» a la vez. El hover (`#1B2C48`) es el que el propio handoff llama «Navy hover». Fuera
// de alcance a propósito: `--e19-accent-strong` (ya era navy oscuro, no es el token que nombra T-2)
// y `--e19-eyebrow` (un cian distinto, tampoco nombrado).

test("T-2 · el acento interactivo es el mismo navy que los títulos", () => {
  assert.match(css, /--e19-accent:\s*#293e5e;/);
  assert.match(css, /--e19-heading:\s*#293e5e;/);
});

test("T-2 · el hover del acento es el navy hover que nombra el handoff", () => {
  assert.match(css, /--e19-accent-hover:\s*#1b2c48;/);
});

test("T-2 · los tintes suaves del acento ya no son azules", () => {
  assert.doesNotMatch(css, /--e19-accent-soft:\s*#ebf6fc;/);
  assert.doesNotMatch(css, /--e19-accent-soft-border:\s*#cfe8f8;/);
  assert.match(css, /--e19-accent-soft:\s*#[0-9a-f]{6};/);
  assert.match(css, /--e19-accent-soft-border:\s*#[0-9a-f]{6};/);
});

test("T-2 · el azul anterior ya no es el valor de ningún token, solo queda citado en la nota histórica", () => {
  assert.doesNotMatch(css, /:\s*#0072e3;/i);
  assert.doesNotMatch(css, /:\s*#005bb8;/i);
});

test("T-2 · lo que no nombra el handoff no se toca: fondo fuerte, semánticos y eyebrow siguen igual", () => {
  assert.match(css, /--e19-accent-strong:\s*#0b1a30;/);
  assert.match(css, /--e19-eyebrow:\s*#049ff9;/);
  assert.match(css, /--e19-success:\s*#1f9d55;/);
  assert.match(css, /--e19-danger:\s*#c13b3b;/);
});

test("T-2 · la muestra de color de la guía de estilo también dice el hex nuevo", () => {
  assert.match(designSystem, /<b>Interactivo<\/b><span>#293E5E<\/span>/);
  assert.doesNotMatch(designSystem, /#0072E3/);
});

test("T-2 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /design-tokens\.css\?v=20260814f1a1/);
});
