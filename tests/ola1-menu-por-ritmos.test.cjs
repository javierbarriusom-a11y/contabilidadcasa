/**
 * tests/ola1-menu-por-ritmos.test.cjs
 *
 * Ola 1 (UX), entrega 1 — camino B de `docs/OLA1_ARQUITECTURA_NAVEGACION.md`: el menú principal se
 * agrupa por ritmo y pasa de 11 a 10 entradas, sin pantallas nuevas y sin cambiar ningún #id.
 *
 * - «Datos» (#update-hub) sale: desde R-10 redirige a Registrar, era la misma pantalla con dos entradas.
 * - «Planificación de partidas» sale del menú principal y pasa a pestaña de Plan; conserva su enlace
 *   en el menú avanzado (resalta y abre el desplegable al estar en ella).
 * - «Escenarios» sube desde «Herramientas avanzadas».
 * - Guardián (D2): ninguna entrada principal lleva `data-e17-group`, porque «Personalizar» oculta los
 *   enlaces por ese atributo y una entrada principal no puede desaparecer por un interruptor.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const experience = read("e17-experience.js");

const nav = html.slice(html.indexOf('<nav class="side-nav"'), html.indexOf("</nav>", html.indexOf('<nav class="side-nav"')));
const primary = nav.slice(0, nav.indexOf('<div class="e17-nav-actions">'));

function sequence() {
  const items = [];
  for (const match of primary.matchAll(/<p class="nav-section-label">([^<]+)<\/p>|<a href="#([\w-]+)"[^>]*class="nav-primary-link[^"]*"/g)) {
    items.push(match[1] ? { label: match[1] } : { href: match[2] });
  }
  return items;
}

test("el menú principal agrupa por ritmo y tiene exactamente 10 entradas, en este orden", () => {
  const groups = [];
  for (const item of sequence()) {
    if (item.label) groups.push({ label: item.label, links: [] });
    else groups.at(-1).links.push(item.href);
  }
  assert.deepEqual(groups, [
    { label: "Día a día", links: ["home", "registrar", "movements"] },
    { label: "Cada mes", links: ["plan", "cierre"] },
    { label: "A largo plazo", links: ["deuda-ruta", "inversion-cartera"] },
    { label: "Para decidir", links: ["escenario-simular"] },
    { label: "Sistema", links: ["ajustes", "faqs-ayuda"] },
  ]);
  assert.equal(groups.flatMap((group) => group.links).length, 10);
});

test("«Datos» ya no es entrada principal pero su destino sigue existiendo como alias de Registrar", () => {
  assert.doesNotMatch(primary, /href="#update-hub"/);
  assert.match(html, /<section[^>]*id="update-hub"[^>]*view-section|<section[^>]*view-section[^>]*id="update-hub"/);
  assert.match(read("app.js"), /"update-hub": "balances"/);
});

test("«Planificación de partidas» es pestaña de Plan y sigue con enlace en el menú avanzado", () => {
  assert.doesNotMatch(primary, /href="#planificacion-partidas"/);
  const planTabs = html.slice(html.indexOf('id="planTabs"'), html.indexOf("</nav>", html.indexOf('id="planTabs"')));
  assert.match(planTabs, /data-e17-target="planificacion-partidas">Partidas<\/button>/);
  assert.doesNotMatch(planTabs.match(/<button[^>]*data-e17-target="planificacion-partidas"[^>]*>/)[0], /data-plan-tab/);
  assert.match(html, /<a href="#planificacion-partidas" data-e17-group="analysis">Planificación de partidas<\/a>/);
  assert.match(html, /<section[^>]*id="planificacion-partidas"[^>]*view-section|<section[^>]*view-section[^>]*id="planificacion-partidas"/);
});

test("guardián: ninguna entrada principal depende de un grupo que «Personalizar» pueda apagar", () => {
  const anchors = [...primary.matchAll(/<a [^>]*class="nav-primary-link[^"]*"[^>]*>/g)].map((match) => match[0]);
  assert.equal(anchors.length, 10);
  for (const anchor of anchors) assert.doesNotMatch(anchor, /data-e17-group/, anchor);
});

test("Escenarios sube al menú principal sin salir del menú avanzado, y el lanzador clasifica bien las dos entradas promovidas", () => {
  assert.match(html, /<a href="#escenario-simular" data-e17-group="analysis">Escenario · simular<\/a>/);
  assert.match(experience, /target: "escenario-simular"[^}]*group: "main"/);
  assert.match(experience, /target: "movements"[^}]*group: "main"/);
});
