/**
 * tests/ola1-3-escenarios-pestanas.test.cjs
 *
 * Ola 1 (UX), entrega 3 — camino B de `docs/OLA1_ARQUITECTURA_NAVEGACION.md`, mecanismo (i): las cuatro
 * pantallas de decisión (Simular, Guardados, Asesor, Segunda opinión) llevan una franja gemela
 * «Pantallas de Escenarios». Los tres comparadores (Seguros, Fiscal, Patrimonio) se quedan en el menú
 * avanzado a propósito: agruparlos exigiría una pantalla de índice, que el camino B no crea.
 *
 * - No mueve código ni cambia ningún #id.
 * - Los pasos del flujo (`escenario-aplicar`, `escenario-comparar`) no son pestañas y no llevan franja.
 * - Se navega con el manejador global `data-e17-target`: no añade líneas a `app.js` (techo ARQ-4).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const TABS = [
  ["escenario-simular", "Simular"],
  ["escenario-guardados", "Guardados"],
  ["asesor-decision", "Asesor"],
  ["segunda-opinion", "Segunda opinión"],
];

function sectionHtml(id) {
  const match = html.match(new RegExp(`<section[^>]*id="${id}"[^>]*>`));
  assert.ok(match, `no existe la sección ${id}`);
  return html.slice(match.index, html.indexOf("</section>", match.index));
}

test("cada una de las cuatro pantallas lleva la franja «Pantallas de Escenarios» con las cuatro y la actual marcada", () => {
  for (const [id, label] of TABS) {
    const section = sectionHtml(id);
    const strips = section.match(/<nav class="e19-registrar-tabs" aria-label="Pantallas de Escenarios">[\s\S]*?<\/nav>/g) || [];
    assert.equal(strips.length, 1, `${id}: exactamente una franja`);
    const buttons = [...strips[0].matchAll(/<button([^>]*)>([^<]+)<\/button>/g)].map((match) => ({ attrs: match[1], label: match[2] }));
    assert.deepEqual(buttons.map((button) => button.label), TABS.map(([, text]) => text));
    const active = buttons.filter((button) => /is-active/.test(button.attrs));
    assert.equal(active.length, 1, `${id}: exactamente una pestaña activa`);
    assert.equal(active[0].label, label);
    assert.match(active[0].attrs, /aria-current="page"/);
    for (const button of buttons.filter((item) => !/is-active/.test(item.attrs))) {
      const target = button.attrs.match(/data-e17-target="([\w-]+)"/)?.[1];
      assert.ok(target, `${id}: «${button.label}» sin destino`);
      assert.ok(TABS.some(([tabId]) => tabId === target), `${id}: destino inesperado ${target}`);
    }
  }
});

test("los destinos de la franja son pantallas reales y siguen con su enlace en el menú avanzado", () => {
  for (const [id] of TABS) {
    assert.match(html, new RegExp(`<section[^>]*id="${id}"[^>]*view-section|<section[^>]*view-section[^>]*id="${id}"`));
    assert.match(html, new RegExp(`<a href="#${id}" data-e17-group="\\w+">`));
  }
});

test("la franja va antes del contenido de la pantalla, no dentro de un contenedor que se reescriba", () => {
  const firstContent = {
    "escenario-simular": '<div class="escenario-motor-layout">',
    "escenario-guardados": '<div class="escenario-motor-saved-list"',
    "asesor-decision": '<div class="e19-card asesor-decision-empty"',
    "segunda-opinion": "<!-- CPX2:",
  };
  for (const [id] of TABS) {
    const section = sectionHtml(id);
    assert.ok(section.indexOf('aria-label="Pantallas de Escenarios"') < section.indexOf(firstContent[id]), `${id}: la franja debe ir antes del contenido`);
  }
});

test("los pasos del flujo y los tres comparadores no llevan la franja: no son pestañas", () => {
  for (const id of ["escenario-aplicar", "escenario-comparar", "herramientas-seguros", "herramientas-fiscal", "herramientas-patrimonio"]) {
    assert.doesNotMatch(sectionHtml(id), /aria-label="Pantallas de Escenarios"/, id);
  }
});
