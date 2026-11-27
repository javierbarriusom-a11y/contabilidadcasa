// R1, primera parte (auditoría de diseño §4, D-N49; 26/11/2026). Con el tema v2: el punto de estado en vez de las tres píldoras (que
// siguen, en su hoja), «Guía» en la cabecera en vez del recuadro «Estado · Guía de este flujo» (lo que decía, en la guía) y sin la
// tira de cinco cifras en Cierre, Deuda › Contratos y Deuda › Ofertas. En el clásico, todo como estaba.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const html = read("index.html");
const app = read("app.js");
const css = read("tema-v2.css");
const clasico = read("styles.css");
const Marco = require("../views/marco-v2.js");

test("R1 · el punto de estado lleva las tres píldoras de siempre en su hoja, y los avisos quedan fuera, a la vista", () => {
  const cabecera = html.slice(html.indexOf('<header class="topbar">'), html.indexOf("</header>", html.indexOf('<header class="topbar">')));
  assert.match(cabecera, /<button type="button" class="estado-punto" id="estadoPunto" data-tono="local" aria-expanded="false" aria-controls="estadoHoja">/);
  assert.match(cabecera, /<span class="sr-only">Estado de los datos: <\/span><span class="estado-punto-texto" id="estadoPuntoTexto">/);
  const hoja = cabecera.slice(cabecera.indexOf('id="estadoHoja"'), cabecera.indexOf('id="conexionAviso"'));
  for (const id of ["dataNatureBadge", "durabilityStatus", "sourceNote"]) assert.ok(hoja.includes(`id="${id}"`), `${id}, en la hoja`);
  for (const id of ["conexionAviso", "escenarioAviso"]) assert.ok(cabecera.includes(`id="${id}"`) && !hoja.includes(`id="${id}"`), `${id}, fuera de la hoja`);
  assert.match(cabecera, /<button type="button" class="link-button topbar-guia" id="topbarGuia" data-e17-open="guide">Guía<\/button>/);
});

test("R1 · el tono del punto sale del mismo que el chip: verde, ámbar o rojo, con su palabra", () => {
  assert.deepEqual(Marco.TEXTOS, { cloud: "Sincronizado", local: "Solo en este equipo", warn: "Revisar" });
  for (const [tone, tono, texto] of [["cloud", "cloud", "Sincronizado"], ["local", "local", "Solo en este equipo"], ["warn", "warn", "Revisar"], ["otro", "local", "Solo en este equipo"], [undefined, "local", "Solo en este equipo"]]) {
    assert.deepEqual(Marco.tonoDelPunto(tone), { tono, texto });
  }
  // app.js lo pinta con el tono del chip, justo después de repintar el aviso sin conexión.
  assert.match(app, /globalThis\.FinanceSinConexion\?\.pintar\(\); \/\/ DEC-39\n {2}globalThis\.FinanceMarcoV2\?\.pintarEstadoPunto\(tone\);/);
  assert.match(css, /\.estado-punto\[data-tono="cloud"\] \.estado-punto-marca \{\s*background: var\(--e19-success\);/);
  assert.match(css, /\.estado-punto\[data-tono="warn"\] \.estado-punto-marca \{\s*background: var\(--e19-danger\);/);
});

test("R1 · la hoja se abre con el punto y se cierra con Escape (devolviendo el foco), fuera de ella o al cambiar de pantalla", () => {
  const src = read("views/marco-v2.js");
  const cablear = src.slice(src.indexOf("function cablear("), src.indexOf("function filasDeGuia("));
  assert.match(cablear, /event\.key === "Escape" && abierta\(\)\) abrirHoja\(false, \{ devolverFoco: true \}\)/);
  // El punto, en el móvil, vive en la marca FC (R1, segunda parte): tocarlo no cuenta como «fuera».
  assert.match(cablear, /!event\.target\.closest\("#topbarStatus, #estadoPunto"\)\) abrirHoja\(false\)/);
  assert.match(cablear, /addEventListener\?\.\("hashchange", \(\) => abrirHoja\(false\)\)/);
  assert.match(css, /\.topbar-status\[data-estado-abierto\] > \.estado-hoja \{/);
  // Cargado antes de app.js, en el sitio público y en el service worker.
  const script = html.indexOf('<script defer src="views/marco-v2.js?v=20261126r1b"></script>');
  assert.ok(script > 0 && script < html.indexOf('<script defer src="app.js'));
  assert.ok(read("tools/build-public-site.mjs").includes('"views/marco-v2.js"'));
  assert.ok(read("service-worker.js").includes('"./views/marco-v2.js"'));
});

test("R1 · el recuadro no se pinta con el tema v2 y lo que decía pasa a la guía; «Guía» no se repite donde no había recuadro", () => {
  assert.match(css, /:root\[data-tema="v2"\] #e17ViewGuide \{\s*display: none !important;/);
  assert.match(css, /\.workspace:has\(> #e17ViewGuide\[hidden\]\) \.topbar-guia \{\s*display: none;/);
  assert.match(html, /<dl class="e17-guia-contexto" id="e17FlowGuideContexto" hidden><\/dl>/);
  const guia = app.slice(app.indexOf("function openE17Dialog("), app.indexOf('if (kind === "help")'));
  assert.match(guia, /globalThis\.FinanceMarcoV2\?\.rellenarGuia\(activeViewId, E17Experience\?\.guidanceFor\(activeViewId, null\), [^\n]*\n\s*dialog\.showModal\(\);/);
  // Las tres frases del recuadro, con la guía de la pantalla o, sin ella, la de siempre.
  const filas = Marco.filasDeGuia("cierre", ["Para qué sirve", "Firmar el mes", "Consulta o edición", "Importa el extracto."], "2026-11-26", { fechaCorta: "26 nov 26" });
  assert.deepEqual(filas, [["Para qué sirve", "Firmar el mes"], ["Estado", "Consulta o edición · datos con fecha de análisis 26 nov 26."], ["Siguiente paso", "Importa el extracto."]]);
  const porDefecto = Marco.filasDeGuia("x", null, "", { titulo: "Ajustes" });
  assert.deepEqual(porDefecto[0], ["Para qué sirve", "Ajustes"]);
  assert.equal(porDefecto[1][1], "Consulta o edición · datos con fecha de análisis la copia actual.");
  const src = read("views/marco-v2.js");
  assert.match(src, /const SIN_RECUADRO = new Set\(\["home", "registrar", "movements"\]\);/);
  assert.match(src, /documentElement\.dataset\.tema !== "v2" \|\| SIN_RECUADRO\.has\(viewId\)/);
});

test("R1 · D-N49: sin la tira en Cierre, Contratos y Ofertas con su vista nueva (además de Plan y Deuda › Plan)", () => {
  assert.match(css, /body:has\(#cierre:not\(\[hidden\]\) > #cierreV2\[data-modo="v2"\]\) #topbarStatusStrip/);
  assert.match(css, /body:has\(#deuda-contratos:not\(\[hidden\]\) > #deudaContratosV2:not\(\[hidden\]\):not\(\[data-modo="anterior"\]\)\) #topbarStatusStrip/);
  assert.match(css, /body:has\(#deuda-comparar:not\(\[hidden\]\) > #deudaOfertasV2:not\(\[hidden\]\):not\(\[data-modo="anterior"\]\)\) #topbarStatusStrip/);
});

test("R1 · en el clásico, la cabecera de siempre: sin «Guía» ni punto, y la hoja no pinta caja", () => {
  assert.match(clasico, /\.topbar-guia,\s*\.estado-punto \{\s*display: none;\s*\}/);
  assert.match(clasico, /\.estado-hoja,\s*\.topbar-acciones \{\s*display: contents;\s*\}/);
});

// R1, segunda parte (auditoría de diseño §4: el título a menos de 100 px del borde). Fases A y B.
test("R1, segunda parte · en el móvil la franja solo con algo que decir, plegada a cero (no quitada: dentro va el <h1>); el antetítulo repetido, fuera", () => {
  const movil = css.slice(css.indexOf("R1, segunda parte · el título arriba"));
  assert.ok(movil.length > 100, "el bloque de la segunda parte");
  assert.match(movil, /:root\[data-tema="v2"\] \.topbar:not\(:has\(\[data-estado-abierto\], #conexionAviso:not\(\[hidden\]\), #escenarioAviso:not\(\[hidden\]\)\)\) \{\s*min-height: 0;\s*padding: 0;\s*border: 0;/);
  assert.match(movil, /#escenarioAviso:not\(\[hidden\]\)\)\) > \.topbar-status \{\s*display: none;/);
  assert.doesNotMatch(movil, /#escenarioAviso:not\(\[hidden\]\)\)\) \{\s*display: none;/, "con display: none la página se queda sin <h1>");
  assert.match(movil, /:root\[data-tema="v2"\] \.topbar #viewEyebrow \{\s*display: none;/);
  assert.match(html, /<h1 id="viewTitle" tabindex="-1" class="sr-only">/, "el <h1> de la página sigue en la franja");
  assert.match(movil, /@media \(max-width: 860px\) \{\s*:root\[data-tema="v2"\] #topbarStatusStrip \{\s*display: flex;\s*flex-wrap: nowrap;[\s\S]*?overflow-x: auto;/, "en el móvil, la tira en una fila que se desliza");
});

test("R1, segunda parte · en el móvil el punto es la insignia de la marca FC, con un signo además del color (WCAG 1.4.1) y 24 px de toque", () => {
  const movil = css.slice(css.indexOf("R1, segunda parte · el título arriba"));
  assert.match(movil, /\.brand-mark > \.estado-punto \{\s*position: absolute;[\s\S]*?width: 24px;[\s\S]*?height: 24px;/);
  assert.match(movil, /\.brand-mark > \.estado-punto\[data-tono="cloud"\] \.estado-punto-marca::after \{\s*content: "✓";/);
  assert.match(movil, /\.brand-mark > \.estado-punto\[data-tono="warn"\] \.estado-punto-marca::after \{\s*content: "!";/);
  assert.match(movil, /\.brand-mark > \.estado-punto \.estado-punto-texto \{\s*position: absolute;\s*width: 1px;/, "la palabra, fuera de la vista pero en su nombre accesible");
  const fuente = read("views/marco-v2.js");
  assert.match(fuente, /const ESTRECHO = "\(max-width: 860px\)";/);
  assert.match(fuente, /if \(estrecho\) \{\s*hueco\(punto, [^)]*\);\s*if \(punto\.parentElement !== marca\) marca\.append\(punto\);\s*\} else devolver\(punto\);/, "en el escritorio, de vuelta a la franja");
  assert.match(fuente, /matchMedia\?\.\(ESTRECHO\)\?\.addEventListener\?\.\("change", colocarPunto\)/, "al girar el móvil o cambiar el ancho");
});

test("R1, segunda parte · la tira y las pestañas de la pantalla, debajo de la cabecera que se ve; sin cabecera a la vista, en su sitio", () => {
  const visible = { getClientRects: () => [1] };
  const oculta = { getClientRects: () => [] };
  assert.equal(Marco.cabeceraDe({ querySelector: () => visible }), visible);
  assert.equal(Marco.cabeceraDe({ querySelector: () => oculta }), null, "tras una cabecera oculta, no (Movimientos)");
  assert.equal(Marco.cabeceraDe({ querySelector: () => null }), null);
  assert.equal(Marco.cabeceraDe(null), null);
  const nav = (id) => ({ id });
  const [a, b, c] = [nav("deudaPrestamoScreenTabs"), nav("deudaPrestamoOfertasTabs"), nav("deudaPrestamoFlowNav")];
  let pedido = "";
  assert.deepEqual(Marco.pestanasDe({ querySelectorAll: (sel) => { pedido = sel; return [a, b, c, a]; } }), [a, b, c], "en su orden, sin repetir");
  assert.match(pedido, /:scope > nav\[id\$="ScreenTabs"\], :scope > nav\[id\$="OfertasTabs"\], :scope > nav\[id\$="FlowNav"\]/);
  assert.deepEqual(Marco.pestanasDe(null), []);
  const fuente = read("views/marco-v2.js");
  assert.match(fuente, /if \(ultimo\.nextElementSibling !== tira\) ultimo\.after\(tira\);/, "título, pestañas y después la tira");
  assert.match(fuente, /nodo\.__hueco = doc\(\)\.createComment\(texto\);/, "cada nodo recuerda su sitio de siempre y vuelve a él");
  assert.match(fuente, /if \(!esV2\(\)\) return;/, "con el clásico no se mueve nada");
});
