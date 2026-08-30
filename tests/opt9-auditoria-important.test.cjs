const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// OPT-9 · Bloque 5: auditoría de los `!important` de styles.css. Dos de los 23 existentes
// (`.agent-debt-order-warning`, `.agent-agreement-note`) no tenían ninguna regla más específica ni
// estilo inline que superar — eran peso muerto de alguna sesión de depuración que se quedó pegado.
// Los 19 restantes son legítimos (utilidades globales `[hidden]`/`.is-hidden`/`.sr-only`, el
// override universal `prefers-reduced-motion`, o una regla que necesita ganar a otra más específica
// del mismo componente) y quedan documentados con el comentario "OPT-9:"/"UX-6:" más cercano que los
// precede. Esta prueba fija el conteo y exige que cualquier `!important` nuevo caiga bajo un
// comentario así — el próximo `!important` sin justificar se detecta aquí, no en otra auditoría.

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

function importantOffsets(css) {
  const offsets = [];
  const re = /!important;/g;
  let match;
  while ((match = re.exec(css))) offsets.push(match.index);
  return offsets;
}

function commentBlocks(css) {
  const blocks = [];
  const re = /\/\*[^]*?\*\//g;
  let match;
  while ((match = re.exec(css))) blocks.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  return blocks;
}

function lineOf(css, offset) {
  return css.slice(0, offset).split("\n").length;
}

test("el número de declaraciones !important en styles.css no crece en silencio", () => {
  const css = read("styles.css");
  assert.equal(importantOffsets(css).length, 19, "Si esta cifra cambió, audita el nuevo !important antes de subir la cuenta.");
});

test("cada !important cae bajo el comentario OPT-9/UX-6 que lo justifica, sin otro comentario de por medio", () => {
  const css = read("styles.css");
  const blocks = commentBlocks(css);
  importantOffsets(css).forEach((offset) => {
    const nearestBefore = [...blocks].reverse().find((block) => block.end <= offset);
    assert.ok(nearestBefore, `Línea ${lineOf(css, offset)}: no hay ningún comentario antes de este !important.`);
    assert.match(
      nearestBefore.text,
      /(OPT-9|UX-6)/,
      `Línea ${lineOf(css, offset)}: el comentario más cercano ("${nearestBefore.text}") no justifica el !important.`,
    );
  });
});

test("los dos !important sin justificación real (agent-debt-order-warning, agent-agreement-note) se han quitado", () => {
  const css = read("styles.css");
  const orderWarning = css.slice(css.indexOf(".agent-debt-order-warning {"), css.indexOf(".agent-debt-order-warning {") + 120);
  const agreementNote = css.slice(css.indexOf(".agent-agreement-note {"), css.indexOf(".agent-agreement-note {") + 120);
  assert.ok(!orderWarning.includes("!important"), ".agent-debt-order-warning ya no necesita !important.");
  assert.ok(!agreementNote.includes("!important"), ".agent-agreement-note ya no necesita !important.");
});
