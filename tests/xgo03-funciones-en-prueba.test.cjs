const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fep = require("../funciones-en-prueba.js");

// XGO-03 · «Funciones en prueba» (P8): lo nuevo se prueba antes de quedarse, con su fecha, su métrica y su revisión a
// las dos semanas (P9: aviso en la app y confirmación a mano). El primer interruptor es el diseño nuevo, que recarga con
// ?tema=v2 o ?tema=clasico para que tema-v2.js siga siendo el único que guarda la elección (docs/rediseno/ESTADO.md §4).
// La e2e de qa1 («XGO-03 · Funciones en prueba») recorre el interruptor, el aviso del menú, graduar y aplazar.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const ON = { "tema-v2": true };
const tema = fep.CATALOGO.find((item) => item.id === "tema-v2");
const hoyV2 = fep.CATALOGO.find((item) => item.id === "hoy-v2");

test("está en el sitio público y el service worker, se carga con defer y la tarjeta vive en Ajustes › Simuladores y Laboratorio", () => {
  const html = read("index.html");
  assert.match(html, /<script defer src="funciones-en-prueba\.js\?v=[^"]+"><\/script>/);
  assert.ok(read("service-worker.js").includes('"./funciones-en-prueba.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"funciones-en-prueba.js"'));
  const grupo = html.indexOf('id="ajustes-laboratorio"');
  const card = html.indexOf('id="funcionesEnPruebaCard"');
  assert.ok(grupo > 0 && card > grupo && card < html.indexOf('id="laboratorioCard"'), "dentro del grupo, antes del Laboratorio de pantallas heredadas");
  assert.match(html, /<h3 class="escenario-motor-panel-title" id="funcionesEnPruebaTitulo">Funciones en prueba<\/h3>/);
});

test("el catálogo: el diseño nuevo es el primer interruptor y las pantallas del rediseño van con él, con su fecha y su métrica", () => {
  assert.equal(fep.CATALOGO[0].id, "tema-v2");
  assert.equal(tema.interruptor, "tema");
  for (const id of ["hoy-v2", "movimientos-v2", "importar-v2", "clasificar-v2"]) {
    const item = fep.CATALOGO.find((entry) => entry.id === id);
    assert.equal(item.parteDe, "tema-v2", id);
    assert.match(item.desde, /^2026-10-(19|21)$/, id);
    assert.ok(item.metrica.length > 5, id);
  }
  assert.equal(fep.REVISION_DIAS, 14);
});

test("P9: en prueba hasta las dos semanas; ese día pide revisión, y no la pide lo que va con un interruptor apagado", () => {
  assert.deepEqual({ ...fep.estadoDe(hoyV2, {}, "2026-11-01", ON) }, { estado: "en-prueba", desde: "2026-10-19", revision: "2026-11-02", activa: true, tocaRevisar: false });
  assert.equal(fep.estadoDe(hoyV2, {}, "2026-11-02", ON).tocaRevisar, true);
  assert.equal(fep.estadoDe(hoyV2, {}, "2026-11-02", { "tema-v2": false }).tocaRevisar, false, "con el clásico no se está probando");
  assert.equal(fep.estadoDe(tema, {}, "2026-11-02", { "tema-v2": false }).tocaRevisar, false);
  assert.deepEqual(Array.from(fep.porRevisar({}, "2026-11-04", ON), (item) => item.id), ["tema-v2", "hoy-v2", "movimientos-v2", "importar-v2", "clasificar-v2"]);
});

test("graduar lo anota con su fecha y deja de pedir revisión; «Dos semanas más» aplaza la pregunta 14 días", () => {
  const graduada = fep.graduar({}, "hoy-v2", "2026-11-03");
  assert.deepEqual({ ...fep.estadoDe(hoyV2, graduada, "2026-12-01", ON) }, { estado: "graduada", fecha: "2026-11-03" });
  const aplazada = fep.aplazar({}, "tema-v2", "2026-11-03");
  assert.equal(fep.estadoDe(tema, aplazada, "2026-11-16", ON).tocaRevisar, false);
  assert.equal(fep.estadoDe(tema, aplazada, "2026-11-17", ON).revision, "2026-11-17");
  assert.equal(fep.estadoDe(tema, aplazada, "2026-11-17", ON).tocaRevisar, true);
  assert.equal(fep.addDays("2026-12-25", 14), "2027-01-08", "cruza el año");
});

test("las decisiones se guardan en este navegador y un almacenamiento roto o ajeno no rompe nada", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(fep.writeDecisions(storage, fep.graduar({}, "hoy-v2", "2026-11-03")), true);
  assert.deepEqual(fep.readDecisions(storage), { "hoy-v2": { estado: "graduada", fecha: "2026-11-03" } });
  mem.set(fep.STORAGE_KEY, "{roto");
  assert.deepEqual(fep.readDecisions(storage), {});
  mem.set(fep.STORAGE_KEY, "[1,2]");
  assert.deepEqual(fep.readDecisions(storage), {});
  assert.deepEqual(fep.readDecisions(null), {});
  assert.equal(fep.writeDecisions({ setItem() { throw new Error("cuota"); } }, {}), false);
});

test("el interruptor del diseño nuevo recarga con ?tema=… en Ajustes: tema-v2.js sigue siendo el único que guarda la elección", () => {
  assert.equal(fep.urlTema("https://x.test/contabilidadcasa/index.html?tema=v2#movements", false), "https://x.test/contabilidadcasa/index.html?tema=clasico#ajustes");
  assert.equal(fep.urlTema("https://x.test/contabilidadcasa/?a=1", true), "https://x.test/contabilidadcasa/?a=1&tema=v2#ajustes");
  const js = read("funciones-en-prueba.js");
  assert.ok(!/localStorage\.setItem\(\s*["']tema-preferencia/.test(js), "no escribe la preferencia de tema");
  assert.match(js, /role="switch" aria-checked="\$\{on\}"/);
  assert.ok(!/createElement\(["']script/.test(js), "sin cargadores de scripts (NTC-6)");
});

test("el interruptor apagado tiene borde suficiente (WCAG 1.4.11) y la tarjeta usa los tokens de los dos temas", () => {
  const css = read("design-tokens.css");
  assert.match(css, /\.fep-switch \{[^}]*box-shadow: inset 0 0 0 1\.5px var\(--e19-muted\);/);
  assert.match(css, /\.fep-switch\[aria-checked="true"\] \{\s*background: var\(--e19-accent\);/);
  assert.ok(!/fep-/.test(read("tema-v2.css")), "sin estilos solo-v2: el clásico necesita la tarjeta para volver");
});
