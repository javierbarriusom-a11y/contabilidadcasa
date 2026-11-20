// DEC-39 · Estado sin conexión explícito (décima auditoría §4.8; 20/11/2026, «sigue con todo lo que puedas que no depende de
// nosotros»). Sin red: una línea bajo el chip de la nube y los botones de la nube apagados con su porqué; al volver, como
// estaban. Sin cambiar datos.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../sin-conexion-ui.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function documento({ apagados = [] } = {}) {
  const attrs = new Set();
  const el = (id) => ({ id, disabled: apagados.includes(id), hidden: true, textContent: "", title: "", dataset: {}, removeAttribute(name) { this[name] = ""; } });
  const nodos = Object.fromEntries([...S.BOTONES_NUBE, "conexionAviso"].map((id) => [id, el(id)]));
  return {
    nodos,
    attrs,
    documentElement: { toggleAttribute: (name, on) => (on ? attrs.add(name) : attrs.delete(name)) },
    getElementById: (id) => nodos[id] || null,
  };
}

test("DEC-39 · sin red: la línea dice que los datos son los de este dispositivo, y qué pasa con la nube", () => {
  const doc = documento();
  assert.equal(S.pintar(doc, { onLine: false }, false), true);
  assert.equal(doc.nodos.conexionAviso.hidden, false);
  assert.equal(doc.nodos.conexionAviso.textContent, "Sin conexión · los datos son los de este dispositivo. Lo que cambiéis se guarda aquí.");
  assert.ok(doc.attrs.has("data-sin-conexion"));
  S.pintar(doc, { onLine: false }, true);
  assert.match(doc.nodos.conexionAviso.textContent, /y se subirá a la nube al volver la conexión\.$/);
});

test("DEC-39 · los botones de la nube, apagados con su porqué; al volver, solo se encienden los que apagó él", () => {
  const doc = documento({ apagados: ["migrateLegacyRemote"] });
  S.pintar(doc, { onLine: false }, true);
  for (const id of ["syncLogin", "syncSignup", "syncResend", "syncNow"]) {
    assert.equal(doc.nodos[id].disabled, true, id);
    assert.equal(doc.nodos[id].title, "Necesita conexión a internet");
  }
  assert.equal(doc.nodos.migrateLegacyRemote.dataset.sinConexion, undefined, "ya estaba apagado: no es suyo");
  assert.equal(S.pintar(doc, { onLine: true }, true), false);
  for (const id of ["syncLogin", "syncSignup", "syncResend", "syncNow"]) assert.equal(doc.nodos[id].disabled, false, id);
  assert.equal(doc.nodos.migrateLegacyRemote.disabled, true, "sigue como lo dejó app.js");
  assert.equal(doc.nodos.conexionAviso.hidden, true);
  assert.equal(doc.nodos.conexionAviso.textContent, "");
  assert.ok(!doc.attrs.has("data-sin-conexion"));
  // Con red no toca nada; sin documento, tampoco falla.
  assert.equal(S.pintar(null, { onLine: false }), false);
});

test("DEC-39 · cableado: la línea bajo el chip, sin titular; en el sitio público y el service worker; app.js la repinta", () => {
  const html = read("index.html");
  const chip = html.indexOf('id="durabilityStatus"');
  const at = html.indexOf('<p class="conexion-aviso" id="conexionAviso" role="status" hidden></p>');
  assert.ok(chip > 0 && at > chip && at < html.indexOf('id="sourceNote"'), "justo después del chip de la nube");
  const script = html.indexOf('<script defer src="sin-conexion-ui.js?v=20261120dec39"></script>');
  assert.ok(script > 0 && script < html.indexOf('<script defer src="app.js'), "antes de app.js");
  assert.ok(read("service-worker.js").includes('"./sin-conexion-ui.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"sin-conexion-ui.js"'));
  // Al cambiar el chip (por ejemplo, al recuperar la sesión de la nube), la línea se repinta con la frase que toca.
  assert.match(read("app.js"), /durability\.title = qs\("sourceNote"\)\?\.title \|\| qs\("sourceNote"\)\?\.textContent \|\| "";\n {2}globalThis\.FinanceSinConexion\?\.pintar\(\); \/\/ DEC-39/);
  assert.match(read("styles.css"), /\.conexion-aviso \{/);
});
