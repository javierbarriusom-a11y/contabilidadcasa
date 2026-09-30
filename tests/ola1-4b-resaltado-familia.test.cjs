/**
 * tests/ola1-4b-resaltado-familia.test.cjs
 *
 * Ola 1 (UX), entrega 4, parte 2 — el menú lateral resalta la entrada principal de la FAMILIA cuando se
 * está en una pantalla hermana (decisión del hogar, 30/09/2026: «sí» a las dos preguntas).
 *
 * - Presupuesto, Esta semana y Partidas resaltan «Plan».
 * - Guardados, Asesor, Segunda opinión y los dos pasos del flujo (aplicar, comparar) resaltan «Escenarios».
 * - En esas pantallas no se resalta ningún enlace del menú avanzado, así que este ya no se abre solo. Ojo: el
 *   menú avanzado conserva un enlace «Escenario · simular» con el mismo destino que la entrada principal; por
 *   eso la familia solo casa con enlaces `nav-primary-link`.
 * - Simular declara su propia familia: sin ello marcaba a la vez la entrada principal y ese duplicado (dos
 *   `aria-current`) y abría el desplegable, un defecto anterior a esta entrega. Plan no lo necesita: no tiene
 *   enlace duplicado.
 * - La familia la declara el HTML (`data-nav-family`); `setActiveView` no lleva ninguna lista nueva. La
 *   línea de `app.js` cambia sin añadir líneas (techo ARQ-4, ya cubierto por `arq4-techo-app-js`).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

const FAMILIES = {
  "escenario-simular": "escenario-simular",
  "presupuesto-mes": "plan",
  "estado-semana": "plan",
  "planificacion-partidas": "plan",
  "escenario-guardados": "escenario-simular",
  "asesor-decision": "escenario-simular",
  "segunda-opinion": "escenario-simular",
  "escenario-aplicar": "escenario-simular",
  "escenario-comparar": "escenario-simular",
};

const nav = html.slice(html.indexOf('<nav class="side-nav"'), html.indexOf("</nav>", html.indexOf('<nav class="side-nav"')));
const primaryHrefs = [...nav.matchAll(/<a\s[^>]*href="#([\w-]+)"[^>]*class="nav-primary-link[^"]*"/g)].map((match) => match[1]);

test("las ocho pantallas hermanas, y Simular, declaran su familia y ninguna otra sección lo hace", () => {
  const declared = {};
  for (const match of html.matchAll(/<section[^>]*id="([\w-]+)"[^>]*data-nav-family="([\w-]+)"[^>]*>/g)) declared[match[1]] = match[2];
  assert.deepEqual(declared, FAMILIES);
  assert.equal([...html.matchAll(/data-nav-family=/g)].length, Object.keys(FAMILIES).length);
});

test("cada familia apunta a una entrada principal del menú; solo Simular, con enlace duplicado en el avanzado, se declara a sí misma", () => {
  for (const [id, family] of Object.entries(FAMILIES)) {
    assert.ok(primaryHrefs.includes(family), `${id}: la familia «${family}» no es entrada principal del menú`);
    if (id === family) assert.match(nav, new RegExp(`data-e17-group="analysis">[^<]*</a>`), "solo se autodeclara quien tiene duplicado en el menú avanzado");
  }
  assert.deepEqual(Object.keys(FAMILIES).filter((id) => id === FAMILIES[id]), ["escenario-simular"]);
  // Plan (cabecera) no lleva atributo: se resalta por su propio identificador y no tiene enlace duplicado.
  assert.doesNotMatch(html, /id="plan"[^>]*data-nav-family/);
  assert.equal([...nav.matchAll(/href="#plan"/g)].length, 1);
});

test("las pantallas con franja de pestañas llevan la familia de esa franja", () => {
  for (const [id, family] of Object.entries(FAMILIES)) {
    const start = html.search(new RegExp(`<section[^>]*id="${id}"`));
    const section = html.slice(start, html.indexOf("</section>", start));
    const label = section.match(/<nav class="e19-registrar-tabs" aria-label="Pantallas de ([^"]+)">/)?.[1];
    if (!label) continue; // los dos pasos del flujo no llevan franja (fijado en ola1-3)
    assert.equal(label === "Plan" ? "plan" : "escenario-simular", family, `${id}: franja «${label}» y familia «${family}» no coinciden`);
  }
});

// Se extrae la línea real de `setActiveView` y se ejecuta con enlaces simulados: lo que se prueba es el código
// de producción, no una copia.
const expression = app.match(/const isActive = (navFamily \? .*?);\n/)?.[1];
const isActive = expression && new Function("navFamily", "viewId", "link", `return ${expression};`);
const link = (href, primary) => ({ classList: { contains: (name) => primary && name === "nav-primary-link" }, getAttribute: () => href });

test("setActiveView usa la familia solo con enlaces principales y conserva el comportamiento sin familia", () => {
  assert.ok(isActive, "no se encontró la expresión isActive en setActiveView");
  assert.match(app, /const navFamily = document\.getElementById\(viewId\)\?\.dataset\.navFamily;/);
  // En Presupuesto: «Plan» sí; ningún otro principal; ni siquiera el enlace avanzado de la propia pantalla.
  assert.equal(isActive("plan", "presupuesto-mes", link("#plan", true)), true);
  assert.equal(isActive("plan", "presupuesto-mes", link("#cierre", true)), false);
  assert.equal(isActive("plan", "presupuesto-mes", link("#presupuesto-mes", false)), false);
  // En Guardados: «Escenarios» sí, y el enlace avanzado duplicado «Escenario · simular» no (no abre el desplegable).
  assert.equal(isActive("escenario-simular", "escenario-guardados", link("#escenario-simular", true)), true);
  assert.equal(isActive("escenario-simular", "escenario-guardados", link("#escenario-simular", false)), false);
  assert.equal(isActive("escenario-simular", "escenario-guardados", link("#escenario-guardados", false)), false);
  // En Simular (familia propia): solo la principal; el duplicado del avanzado ya no marca ni abre el desplegable.
  assert.equal(isActive("escenario-simular", "escenario-simular", link("#escenario-simular", true)), true);
  assert.equal(isActive("escenario-simular", "escenario-simular", link("#escenario-simular", false)), false);
  // Sin familia: coincidencia exacta, igual que antes (principal o avanzado).
  assert.equal(isActive(undefined, "cierre", link("#cierre", true)), true);
  assert.equal(isActive(undefined, "cierre", link("#plan", true)), false);
  assert.equal(isActive(undefined, "analisis", link("#analisis", false)), true);
});
