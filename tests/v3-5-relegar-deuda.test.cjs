const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");
const experience = read("e17-experience.js");
const worker = read("service-worker.js");

const navLinks = [...html.matchAll(/<a href="#([\w-]+)" data-e17-group="(\w+)">/g)].map((match) => ({
  view: match[1],
  group: match[2],
}));
const groupOf = (view) => navLinks.find((link) => link.view === view)?.group;

const RELEGADAS = ["debt-roadmap", "debt-liquidation-plan", "debt-control"];

test("V3-5 · las tres heredadas de Deuda quedan en Versiones anteriores", () => {
  for (const view of RELEGADAS) {
    assert.equal(groupOf(view), "legacy", `${view} debería estar relegada`);
  }
});

test("V3-5 · las pantallas nuevas de Deuda se quedan donde estaban", () => {
  for (const view of ["deuda-comparar", "deuda-ruta"]) {
    assert.equal(groupOf(view), "analysis", `${view} es la vista nueva y no se toca`);
  }
  // `#asesor-decision` no es de la vista Deuda aunque hable de deuda: vive en «assistants» y su
  // relegación —la de sus heredadas— es trabajo de V1-4.
  assert.equal(groupOf("asesor-decision"), "assistants");
});

test("V3-5 · relegar no desconecta: las rutas, los enlaces y los renders siguen en pie", () => {
  // La tarjeta de ruta de Hoy y el enlace que `#debt-liquidation-plan` tiene a `#debt-control`
  // siguen funcionando: relegar mueve la pantalla de sitio en el menú, no la apaga.
  assert.match(html, /data-home-nav="debt-control"/);
  assert.match(app, /data-home-nav="debt-control"/);
  assert.match(html, /<a class="secondary-button" href="#debt-control">Simular deuda<\/a>/);
  // Y `#asesor-decision` sigue mandando a `#debt-roadmap` a registrar y aplicar una oferta, que es
  // hoy la única pantalla donde eso se puede hacer: desconectarla dejaría la oferta sin destino.
  assert.match(html, /<a class="e19-btn e19-btn-primary" href="#debt-roadmap">Registrar oferta<\/a>/);
  assert.match(html, /id="asesorDecisionApply" href="#debt-roadmap"/);

  for (const view of RELEGADAS) {
    assert.match(html, new RegExp(`id="${view}"[^>]*view-section|view-section[^>]*id="${view}"`), `falta la vista ${view}`);
  }
  assert.match(app, /case "debt-roadmap":/);
  assert.match(app, /case "debt-liquidation-plan":/);
  // `#debt-control` no se pinta por `case`, se activa con `setActiveView("debt-control")` desde las
  // rutas que llevan a ella. Comprobar un `case` que nunca existió daría una falsa sensación de
  // cobertura, así que se comprueba la vía real.
  assert.match(app, /setActiveView\("debt-control"\)/);
});

test("V3-5 · el lanzador alcanza las dos que solo vivían en el menú", () => {
  // `#debt-roadmap` ya tenía entrada y solo cambia de grupo. `#debt-liquidation-plan` y
  // `#debt-control` no la tenían: con «Versiones anteriores» apagado se habrían quedado sin vía
  // desde el nombre de la pantalla, que es justo para lo que existe el lanzador.
  for (const view of RELEGADAS) {
    assert.match(experience, new RegExp(`target: "${view}"[^}]*group: "legacy"`), `falta ${view} en el lanzador`);
  }
  assert.ok(
    !/target: "debt-(roadmap|liquidation-plan|control)"[^}]*group: "analysis"/.test(experience),
    "ninguna de las tres puede quedarse en «analysis» en el lanzador",
  );
});

test("V3-5 · las tres heredadas de Deuda siguen relegadas, sin duplicados", () => {
  // En su día llegó a trece de las dieciocho; V1-4 sumó las cuatro de Hoy después. Esta prueba ya
  // no fija ese total —es trabajo de la prueba de V1-4—, solo que las tres de V3-5 siguen dentro.
  const legacy = navLinks.filter((link) => link.group === "legacy").map((link) => link.view);
  for (const view of RELEGADAS) assert.ok(legacy.includes(view));
  assert.equal(new Set(legacy).size, legacy.length, "ningún enlace duplicado al mover los tres");
});

test("V3-5 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
