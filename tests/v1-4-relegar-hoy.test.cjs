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

const RELEGADAS = ["executive-advisor", "virtual-advisor", "savings-agent", "alerts-center"];

test("V1-4 · las cuatro heredadas de Hoy quedan en Versiones anteriores", () => {
  for (const view of RELEGADAS) {
    assert.equal(groupOf(view), "legacy", `${view} debería estar relegada`);
  }
});

test("V1-4 · la pantalla nueva de Hoy y su asesor ejecutivo se quedan donde estaban", () => {
  assert.equal(groupOf("asesor-decision"), "assistants", "el asesor nuevo no se toca, solo sus heredadas");
});

test("V1-4 · el grupo relegado llega a diecisiete pantallas, sin duplicados", () => {
  // Diecisiete de las dieciocho heredadas del inventario tras V1-4. La única que quedaba fuera era
  // `#new-life-definitive`, pestaña principal en ese momento — T-1 la releva después, y esa parte
  // se comprueba en `navigation-structure.test.cjs`, no aquí: esta prueba verifica solo lo que
  // hizo V1-4, no lo que hizo T-1 más tarde.
  const legacy = navLinks.filter((link) => link.group === "legacy").map((link) => link.view);
  assert.ok(legacy.length >= 17, "V1-4 dejó al menos diecisiete heredadas relegadas");
  for (const view of RELEGADAS) assert.ok(legacy.includes(view));
  assert.equal(new Set(legacy).size, legacy.length, "ningún enlace duplicado al mover las cuatro");
});

test("V1-4 · relegar no desconecta: las rutas y los renders siguen en pie", () => {
  // La tarjeta de Hoy que abre el centro de alertas y el enlace de `#virtual-advisor` al agente de
  // ahorro siguen funcionando: relegar mueve la pantalla de sitio en el menú, no la apaga.
  assert.match(html, /data-home-nav="alerts-center"/);
  assert.match(html, /data-home-nav="savings-agent"/);

  for (const view of RELEGADAS) {
    assert.match(html, new RegExp(`id="${view}"[^>]*view-section|view-section[^>]*id="${view}"`), `falta la vista ${view}`);
  }
});

test("V1-4 · el lanzador alcanza las cuatro, incluidas las dos que solo vivían en el menú", () => {
  // `#savings-agent` y `#alerts-center` ya tenían entrada y solo cambian de grupo. `#executive-advisor`
  // y `#virtual-advisor` no la tenían: con «Versiones anteriores» apagado se habrían quedado sin vía
  // desde el nombre de la pantalla, que es justo para lo que existe el lanzador.
  for (const view of RELEGADAS) {
    assert.match(experience, new RegExp(`target: "${view}"[^}]*group: "legacy"`), `falta ${view} en el lanzador`);
  }
  assert.ok(
    !/target: "(savings-agent|alerts-center)"[^}]*group: "analysis"/.test(experience),
    "ninguna de las dos puede quedarse en «analysis» en el lanzador",
  );
  assert.ok(
    !/target: "(executive-advisor|virtual-advisor)"[^}]*group: "assistants"/.test(experience),
    "ninguna de las dos puede quedarse en «assistants» en el lanzador",
  );
});

test("V1-4 · las pantallas siguen pintándose igual, el motor no cambia", () => {
  for (const view of RELEGADAS) {
    assert.match(app, new RegExp(`case "${view}":`), `falta el case de ${view} en el switch de renderizado`);
  }
});

test("V1-4 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
