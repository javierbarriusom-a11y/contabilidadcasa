/**
 * tests/ola1-2-plan-pestanas.test.cjs
 *
 * Ola 1 (UX), entrega 2 — camino B de `docs/OLA1_ARQUITECTURA_NAVEGACION.md`, mecanismo (i): la franja
 * de Plan enlaza a tres pantallas independientes (Presupuesto, Esta semana, Partidas), que antes solo
 * se alcanzaban desde «Herramientas avanzadas» (o, Partidas, desde una entrada principal).
 *
 * - No mueve código ni cambia ningún #id: las tres siguen siendo `view-section` con su fragmento diferido.
 * - Las tres llevan una franja gemela «Pantallas de Plan» con «‹ Plan» y sus hermanas, con la actual marcada.
 * - Se navega con el manejador global `data-e17-target`: no añade líneas a `app.js` (techo ARQ-4).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const tokens = fs.readFileSync(path.join(root, "design-tokens.css"), "utf8");

const SIBLINGS = ["presupuesto-mes", "estado-semana", "planificacion-partidas"];
const LABELS = { "presupuesto-mes": "Presupuesto", "estado-semana": "Esta semana", "planificacion-partidas": "Partidas" };

function navAfter(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, `no se encontró ${marker}`);
  return html.slice(start, html.indexOf("</nav>", start));
}

function sectionHtml(id) {
  const match = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`));
  assert.ok(match, `no existe la sección ${id}`);
  return html.slice(match.index, html.indexOf("</section>", match.index));
}

test("la franja de Plan añade Presupuesto, Esta semana y Partidas como enlaces a pantallas, tras sus tres pestañas internas", () => {
  const strip = navAfter('id="planTabs"');
  const labels = [...strip.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((match) => match[1]);
  assert.deepEqual(labels, ["Mes", "Previsión", "Ahorro y objetivos", "Presupuesto", "Esta semana", "Partidas"]);
  for (const id of SIBLINGS) {
    const button = strip.match(new RegExp(`<button[^>]*data-e17-target="${id}"[^>]*>`));
    assert.ok(button, `falta el enlace a ${id}`);
    // Un enlace a otra pantalla no es un panel interno: no debe llevar data-plan-tab.
    assert.doesNotMatch(button[0], /data-plan-tab/);
  }
});

test("cada pantalla hermana lleva la franja «Pantallas de Plan», con «‹ Plan» y la actual marcada", () => {
  for (const id of SIBLINGS) {
    const section = sectionHtml(id);
    const strip = section.match(/<nav class="e19-registrar-tabs" aria-label="Pantallas de Plan">[\s\S]*?<\/nav>/);
    assert.ok(strip, `${id} no tiene la franja`);
    const buttons = [...strip[0].matchAll(/<button([^>]*)>([^<]+)<\/button>/g)].map((match) => ({ attrs: match[1], label: match[2] }));
    assert.deepEqual(buttons.map((button) => button.label), ["‹ Plan", "Presupuesto", "Esta semana", "Partidas"]);
    const active = buttons.filter((button) => /is-active/.test(button.attrs));
    assert.equal(active.length, 1, `${id}: exactamente una pestaña activa`);
    assert.equal(active[0].label, LABELS[id]);
    assert.match(active[0].attrs, /aria-current="page"/);
    // Las demás llevan un destino que existe; la activa no navega a sí misma.
    for (const button of buttons.filter((item) => !/is-active/.test(item.attrs))) {
      const target = button.attrs.match(/data-e17-target="([\w-]+)"/)?.[1];
      assert.ok(target, `${id}: «${button.label}» sin destino`);
      assert.match(html, new RegExp(`<section[^>]*id="${target}"[^>]*view-section|<section[^>]*view-section[^>]*id="${target}"`));
    }
    // La franja va antes del contenido diferido, no dentro del `root` que el fragmento reescribe.
    const rootId = { "presupuesto-mes": "presupuestoMesRoot", "estado-semana": "estadoSemanaRoot", "planificacion-partidas": "planificacionPartidasRoot" }[id];
    assert.ok(section.indexOf(strip[0]) < section.indexOf(`id="${rootId}"`), `${id}: la franja debe ir antes del contenedor diferido`);
  }
});

test("los identificadores de las tres pantallas no cambian y siguen con su enlace en el menú avanzado", () => {
  for (const id of SIBLINGS) {
    assert.match(html, new RegExp(`<a href="#${id}" data-e17-group="analysis">`));
  }
});

test("el estilo distingue la franja de familia (nivel superior) de las franjas internas, sin clases nuevas", () => {
  assert.match(tokens, /\.e19-registrar-tabs\[aria-label="Pantallas de Plan"\] \{\s*margin-bottom: 14px;/);
  assert.match(tokens, /\.e19-registrar-tabs\[aria-label="Pantallas de Plan"\] \.e19-registrar-tab \{\s*padding: 6px 12px;/);
});
