const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// OPT-1 · Bloque 1: index.html cargaba ~60 <script src="..."> síncronos y en orden, bloqueando el
// parseo del HTML y el primer pintado hasta descargar y ejecutar todos. `defer` conserva el mismo
// orden de ejecución (a diferencia de `async`), así que este cambio no altera el comportamiento —
// solo deja de bloquear el parseo del documento.

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

test("todos los <script src> de index.html llevan defer", () => {
  const html = read("index.html");
  const scriptTags = html.match(/<script[^>]*\ssrc="[^"]*"[^>]*><\/script>/g) || [];
  assert.ok(scriptTags.length >= 50, "Debe haber decenas de <script src> cargados en index.html.");
  const withoutDefer = scriptTags.filter((tag) => !/<script\s+defer\s+src="/.test(tag));
  assert.deepEqual(withoutDefer, [], "Todo <script src> debe tener defer para no bloquear el parseo.");
});

test("el script inline de registro del Service Worker no necesita defer y sigue al final del body", () => {
  const html = read("index.html");
  const swIndex = html.indexOf('navigator.serviceWorker.register');
  const bodyCloseIndex = html.indexOf("</body>");
  assert.ok(swIndex > 0, "El registro del Service Worker debe seguir presente.");
  assert.ok(swIndex < bodyCloseIndex, "El registro del Service Worker sigue siendo el último script del body.");
  const lastScriptSrc = html.lastIndexOf('<script defer src=');
  assert.ok(lastScriptSrc < swIndex, "El bloque de <script src> con defer precede al script inline.");
});

test("defer conserva el orden declarado: app.js sigue cargándose después de sus dependencias canónicas", () => {
  const html = read("index.html");
  const cushionIndex = html.indexOf('canonical-cushion.js');
  const leverageBarrierIndex = html.indexOf('canonical-leverage-barrier.js');
  const appIndex = html.indexOf('<script defer src="app.js?v=');
  assert.ok(cushionIndex > 0 && leverageBarrierIndex > 0 && appIndex > 0);
  assert.ok(cushionIndex < appIndex);
  assert.ok(leverageBarrierIndex < appIndex);
});
