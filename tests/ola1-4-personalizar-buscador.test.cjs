/**
 * tests/ola1-4-personalizar-buscador.test.cjs
 *
 * Ola 1 (UX), entrega 4, parte 1 — coherencia entre tres cosas que hablan de la misma navegación y
 * que no se comprobaban entre sí (D2 de `docs/OLA1_ARQUITECTURA_NAVEGACION.md`):
 *
 *   1. los enlaces del menú lateral (`index.html`), que «Personalizar» oculta por `data-e17-group`;
 *   2. el catálogo del lanzador «Buscar o abrir» (`TASKS` de `e17-experience.js`), que NO mira esas
 *      preferencias y encuentra todas las pantallas;
 *   3. las pestañas de familia («Pantallas de Plan» / «Pantallas de Escenarios»), que son botones de la
 *      propia pantalla y por tanto no dependen de ningún interruptor.
 *
 * El campo `group` del lanzador es metadato (ningún código lo lee), pero describe dónde vive cada
 * pantalla en el menú; si se desincroniza, el catálogo miente. Este test lo cruza con `index.html`.
 * Motivo del cambio: la entrega 1 movió «Planificación de partidas» fuera del menú principal y subió
 * Deuda, Inversión y Escenarios, y el catálogo seguía con los grupos anteriores.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const { TASKS } = require(path.join(root, "e17-experience.js"));

const nav = html.slice(html.indexOf('<nav class="side-nav"'), html.indexOf("</nav>", html.indexOf('<nav class="side-nav"')));
const GROUPS = ["main", "analysis", "assistants", "data", "legacy"];
// Entradas del catálogo con grupo `main` que no tienen enlace propio en el menú porque son alias de
// otra pantalla (desde R-10 `#update-hub` redirige a Registrar); se buscan por su nombre antiguo.
const MAIN_WITHOUT_LINK = new Set(["update-hub"]);

// Por cada destino del menú lateral, de dónde cuelga: `main` (entrada principal) o el grupo filtrable.
const menu = {};
for (const match of nav.matchAll(/<a\s[^>]*href="#([\w-]+)"[^>]*>/g)) {
  const group = /nav-primary-link/.test(match[0]) ? "main" : match[0].match(/data-e17-group="(\w+)"/)?.[1] ?? "sin-grupo";
  (menu[match[1]] ||= []).push(group);
}

test("cada grupo del catálogo es uno de los cinco conocidos y los cuatro filtrables tienen interruptor en «Personalizar»", () => {
  for (const task of TASKS) assert.ok(GROUPS.includes(task.group), `${task.target}: grupo «${task.group}» desconocido`);
  const toggles = [...html.matchAll(/data-e17-preference="(\w+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(toggles, ["analysis", "assistants", "data", "legacy"]);
  const filterable = new Set([...nav.matchAll(/data-e17-group="(\w+)"/g)].map((match) => match[1]));
  for (const group of filterable) assert.ok(toggles.includes(group), `el grupo «${group}» del menú no tiene interruptor`);
});

test("el grupo de cada pantalla del catálogo coincide con el enlace que tiene en el menú", () => {
  for (const task of TASKS) {
    const links = menu[task.target];
    if (!links) continue; // sin enlace propio: se comprueba en el test siguiente
    if (links.includes("main")) assert.equal(task.group, "main", `${task.target} es entrada principal y el catálogo dice «${task.group}»`);
    else assert.ok(links.includes(task.group), `${task.target} cuelga de «${links.join(", ")}» en el menú y el catálogo dice «${task.group}»`);
  }
});

test("solo son `main` las entradas principales del menú y los alias documentados", () => {
  for (const task of TASKS.filter((item) => item.group === "main")) {
    const isPrimary = menu[task.target]?.includes("main");
    assert.ok(isPrimary || MAIN_WITHOUT_LINK.has(task.target), `${task.target} figura como principal en el catálogo pero no lo es en el menú`);
  }
  // Y al revés: ninguna entrada principal del menú queda fuera del catálogo o con otro grupo.
  const primary = Object.entries(menu).filter(([, groups]) => groups.includes("main")).map(([id]) => id);
  assert.equal(primary.length, 10);
  for (const id of primary) assert.ok(TASKS.some((task) => task.target === id && task.group === "main"), `${id} no está en el catálogo como principal`);
});

test("toda pantalla con enlace en el menú se puede encontrar con el buscador, apague lo que se apague", () => {
  const catalog = new Set(TASKS.map((task) => task.target));
  for (const id of Object.keys(menu)) assert.ok(catalog.has(id), `${id} tiene enlace en el menú pero no entrada en el lanzador`);
});

test("las pestañas de Plan y de Escenarios no dependen de un grupo filtrable y sus destinos están en el buscador", () => {
  const strips = [...html.matchAll(/<nav class="e19-registrar-tabs"[^>]*(?:id="planTabs"|aria-label="Pantallas de [^"]+")[^>]*>[\s\S]*?<\/nav>|<nav[^>]*id="planTabs"[^>]*>[\s\S]*?<\/nav>/g)];
  assert.ok(strips.length >= 8, `se esperaban la franja de Plan y las de sus hermanas y de Escenarios (${strips.length})`);
  const catalog = new Set(TASKS.map((task) => task.target));
  for (const [strip] of strips) {
    assert.doesNotMatch(strip, /data-e17-group/, "una pestaña no puede depender de «Personalizar»");
    for (const match of strip.matchAll(/data-e17-target="([\w-]+)"/g)) {
      assert.ok(catalog.has(match[1]) || match[1] === "plan", `${match[1]}: destino de pestaña sin entrada en el lanzador`);
    }
  }
});

test("«Personalizar» avisa de que pestañas y buscador no se apagan con él", () => {
  const dialog = html.slice(html.indexOf('id="e17PreferencesDialog"'), html.indexOf("</dialog>", html.indexOf('id="e17PreferencesDialog"')));
  assert.match(dialog, /las pestañas de Plan y de Escenarios y el buscador siguen llevando a todas las pantallas/);
});
