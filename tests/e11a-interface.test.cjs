const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("E11a ofrece un centro único para los cinco flujos de actualización", () => {
  assert.match(html, /id="update-hub"/);
  ["visual-detail", "update-data", "movements", "data-entry", "reconciliation"].forEach((target) => {
    assert.match(html, new RegExp(`data-home-nav="${target}"`));
  });
  assert.match(app, /function renderUpdateHub\(\)/);
  assert.match(app, /Siguiente paso recomendado/);
});

test("E11a explica y muestra previsto, real y usado", () => {
  assert.match(html, /Una regla en toda la aplicación/);
  assert.match(html, /<dt>Previsto<\/dt>/);
  assert.match(html, /<dt>Real<\/dt>/);
  assert.match(html, /<dt>Usado<\/dt>/);
  assert.match(app, /usa el real/);
  assert.match(app, /usa el previsto/);
});

test("E11a mantiene distintas las reglas de guardado", () => {
  assert.match(html, /Guardado automático\. Vaciar un real recupera el previsto/);
  assert.match(html, /Queda pendiente hasta pulsar «Guardar cambios»/);
  assert.match(html, /no sustituye datos sin confirmar/);
});
