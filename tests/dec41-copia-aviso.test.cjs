// DEC-41 (18/11/2026): la copia de seguridad que avisa. Los datos viven en el navegador; si la última copia descargada tiene más de
// 30 días (o no consta) y no hay nube, Ajustes y el «Listo» del repaso lo dicen con «Descargar copia». Sin rojo hasta los 60 días.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Aviso = require("../views/copia-aviso.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const HOY = new Date("2026-11-18T10:00:00Z");
const hace = (dias) => new Date(HOY.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();

test("DEC-41 · con la nube o sin datos, nada; con copia de 30 días o menos, nada", () => {
  assert.equal(Aviso.estado({ nube: true, hayDatos: true, hoy: HOY }), null);
  assert.equal(Aviso.estado({ hayDatos: false, hoy: HOY }), null);
  assert.equal(Aviso.estado({ ultimaCopia: hace(0), hayDatos: true, hoy: HOY }), null);
  assert.equal(Aviso.estado({ ultimaCopia: hace(30), hayDatos: true, hoy: HOY }), null);
});

test("DEC-41 · de 31 a 60 días, aviso; de más de 60 o sin copia, urgente (y lo dice)", () => {
  assert.deepEqual(Aviso.estado({ ultimaCopia: hace(31), hayDatos: true, hoy: HOY }), { nivel: "aviso", dias: 31, texto: "La última copia descargada es de hace 31 días. Conviene descargar otra: los datos viven en este navegador." });
  assert.equal(Aviso.estado({ ultimaCopia: hace(60), hayDatos: true, hoy: HOY }).nivel, "aviso");
  assert.equal(Aviso.estado({ ultimaCopia: hace(61), hayDatos: true, hoy: HOY }).nivel, "urgente");
  const nunca = Aviso.estado({ ultimaCopia: "", hayDatos: true, hoy: HOY });
  assert.equal(nunca.nivel, "urgente");
  assert.equal(nunca.dias, null);
  assert.match(nunca.texto, /No consta ninguna copia descargada desde este navegador/);
  assert.equal(Aviso.estado({ ultimaCopia: "no es fecha", hayDatos: true, hoy: HOY }).nivel, "urgente");
});

test("DEC-41 · en Ajustes encima del botón de la copia, en el «Listo» del repaso; descarga con la copia de siempre y sin rojo", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('<div id="copiaAvisoAjustes"></div>') > 0 && html.indexOf('<div id="copiaAvisoAjustes"></div>') < html.indexOf('id="exportStateBackup"'));
  assert.ok(html.indexOf('src="views/copia-aviso.js?v=') > html.indexOf('src="views/repaso-v2.js?v='));
  const vista = read("views/copia-aviso.js");
  assert.match(vista, /downloadStateBackup\(\)/);
  assert.match(vista, /lastEmergencyBackupAt/);
  assert.match(vista, /FinanceMedidor\?\.anotar\("copia-aviso", "vista"\)/);
  assert.match(vista, /FinanceMedidor\?\.anotar\("copia-aviso", "accion"\)/);
  assert.doesNotMatch(vista, /<h[1-6]/, "XGO-01: sin titulares");
  assert.match(read("views/repaso-v2.js"), /globalThis\.copiaAvisoHtml\?\.\("repaso"\)/);
  const css = read("styles.css");
  const reglas = css.slice(css.indexOf(".copia-aviso {"), css.indexOf(".copia-aviso-hecho {"));
  assert.doesNotMatch(reglas, /danger/, "sin rojo");
  assert.ok(require("../medidor-utilidad.js").FUNCIONES.some((item) => item.id === "copia-aviso"));
  assert.match(read("service-worker.js"), /"\.\/views\/copia-aviso\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"views\/copia-aviso\.js",/);
});
