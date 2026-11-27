// R2 (auditoría de diseño §4, D-N50; decimocuarta auditoría, CAT-06; 27/11/2026). Con el tema v2, el menú son cinco destinos con su
// pregunta y el buscador arriba; en el móvil, una barra inferior que se esconde al bajar. No se retira ninguna pantalla: toda pantalla
// tiene su destino (o está en el pie: Ajustes y la ayuda) y el menú de siempre sigue entero en el DOM. En el clásico, todo como estaba.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const html = read("index.html");
const app = read("app.js");
const css = read("tema-v2.css");
const Nav = require("../views/navegacion-v2.js");

const vistas = [...html.matchAll(/<section[^>]*class="[^"]*view-section[^"]*"[^>]*>/g)].map((m) => (m[0].match(/id="([^"]+)"/) || [])[1]).filter(Boolean);

test("R2 · cinco destinos, con la pregunta del diseño, en su orden", () => {
  assert.deepEqual(Nav.DESTINOS.map((d) => [d.nombre, d.pregunta]), [
    ["Hoy", "¿Vamos bien?"],
    ["Movimientos", "¿Qué ha pasado?"],
    ["Plan", "¿Qué viene?"],
    ["Patrimonio", "¿Cuánto tenemos y debemos?"],
    ["Decidir", "¿Qué hacemos con el dinero?"],
  ]);
});

test("R2 · toda pantalla tiene su sitio: un destino, o el pie (Ajustes y la ayuda); ninguna en dos destinos", () => {
  assert.ok(vistas.length > 50, `pantallas leídas: ${vistas.length}`);
  const pie = new Set([...Nav.PIE.map(([v]) => v), "operations-manual"]); // la guía operativa (versión anterior) va con la ayuda
  const sinSitio = vistas.filter((v) => !Nav.destinoDe(v) && !pie.has(v));
  assert.deepEqual(sinSitio, [], "pantallas sin destino");
  const vistas2 = Nav.DESTINOS.flatMap((d) => d.vistas);
  assert.equal(new Set(vistas2).size, vistas2.length, "una pantalla en dos destinos");
  for (const v of vistas2) assert.ok(vistas.includes(v), `${v} no es una pantalla`);
});

test("R2 · cada entrada y cada «Más» lleva a una pantalla de su destino, y el «Más» no repite la entrada", () => {
  for (const d of Nav.DESTINOS) {
    assert.equal(Nav.destinoDe(d.href), d.id, `${d.nombre} entra por una pantalla suya`);
    for (const [vista] of d.mas) {
      assert.equal(Nav.destinoDe(vista), d.id, `${vista}, en el «Más» de ${d.nombre}`);
      assert.notEqual(vista, d.href, `${d.nombre} repite su entrada en «Más»`);
    }
  }
  // Las que antes eran entradas principales del menú siguen a un toque: en un destino, en su «Más» o en el pie.
  const principales = [...html.matchAll(/<a href="#([^"]+)" class="nav-primary-link/g)].map((m) => m[1]);
  const aUnToque = new Set([...Nav.DESTINOS.flatMap((d) => [d.href, ...d.mas.map(([v]) => v)]), ...Nav.PIE.map(([v]) => v)]);
  for (const v of principales) assert.ok(aUnToque.has(v), `${v} (entrada principal de siempre) no está a un toque`);
});

test("R2 · el menú: buscador arriba, el destino actual marcado y su «Más» con la pantalla actual", () => {
  const menu = Nav.menuHtml("deuda-contratos");
  assert.match(menu, /^<button type="button" class="nav-v2-buscar" data-e17-open="launcher"[^>]*>.*Buscar o hacer….*⌘K/);
  assert.equal((menu.match(/class="nav-v2-destino[ "]/g) || []).length, 5);
  assert.match(menu, /data-destino="patrimonio"><a href="#deuda-ruta" aria-current="true">/);
  assert.match(menu, /<a href="#deuda-contratos" aria-current="page">Contratos de deuda<\/a>/);
  assert.equal((menu.match(/class="nav-v2-mas"/g) || []).length, 1, "solo el «Más» del destino actual");
  const hoy = Nav.menuHtml("home");
  assert.match(hoy, /data-destino="hoy"><a href="#home" aria-current="page">/);
  assert.doesNotMatch(hoy, /nav-v2-mas/, "Hoy no tiene «Más»");
  // En Ajustes, ningún destino marcado: lo marca el pie.
  assert.doesNotMatch(Nav.menuHtml("ajustes"), /aria-current/);
  assert.match(Nav.pieHtml("ajustes", "Local · guardado a las 14:49"), /<a class="nav-v2-pie-enlace" href="#ajustes" aria-current="page"><strong>Ajustes<\/strong><small>Local · guardado a las 14:49<\/small><\/a>/);
});

test("R2 · la barra inferior: cinco destinos con icono y nombre, el actual marcado", () => {
  const barra = Nav.barraHtml("cierre");
  assert.equal((barra.match(/<li><a href="#/g) || []).length, 5);
  assert.match(barra, /<a href="#movements" data-destino="movimientos" aria-current="page"><svg[^>]*aria-hidden="true"/);
  assert.equal((barra.match(/aria-current/g) || []).length, 1);
});

test("R2 · cableado: contenedores, script, la llamada de setActiveView y los estilos solo en el v2, con el menú de siempre de reserva", () => {
  assert.match(html, /<nav class="nav-destinos-v2" id="navDestinosV2" aria-label="Destinos" hidden><\/nav>\s*<nav class="side-nav"/);
  assert.match(html, /<nav class="nav-pie-v2" id="navPieV2" aria-label="Ajustes y ayuda" hidden><\/nav>/);
  assert.match(html, /<\/aside>\s*<!--[^]*?-->\s*<nav class="barra-destinos-v2" id="barraDestinosV2" aria-label="Destinos" hidden><\/nav>/);
  assert.match(html, /<script defer src="views\/navegacion-v2\.js\?v=20261127r2"><\/script>/);
  assert.match(app, /renderE17ViewGuide\(viewId\);\n  globalThis\.renderNavegacionV2\?\.\(viewId\);/);
  // El menú de siempre solo se esconde cuando los destinos se han pintado (si el script falla, se ve entero).
  assert.match(css, /\.sidebar:has\(> #navDestinosV2:not\(\[hidden\]\)\) \.side-nav > :is\(\.nav-section-label, \.nav-primary-link, \.e17-nav-actions\) \{\s*display: none;/);
  // La barra: solo en el móvil, se esconde al bajar, al escribir y con el menú abierto, y deja su alto libre al final.
  assert.match(css, /\.barra-destinos-v2:is\(\[data-oculta\], \[data-escribiendo\]\),\s*:root\[data-tema="v2"\] body:has\(\.sidebar\.mobile-open\) \.barra-destinos-v2 \{\s*transform: translateY\(110%\);/);
  assert.match(css, /:root\[data-tema="v2"\]\[data-barra-destinos\] body \{\s*padding-bottom: calc\(66px/);
  // Lo fijo o pegado abajo, por encima de la barra (lo que tumbó DUO-05).
  for (const sel of [".rep-v2-pildora", ".finding-test-bar", ".e19-plan-impact, .datos-importar-bar", ".cuadro-mandos-impact", ".view-section.view-calculating::after"]) {
    assert.ok(css.includes(sel) && new RegExp(`\\[data-barra-destinos\\][^{]*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(css), `${sel}, por encima de la barra`);
  }
  for (const f of ["tools/build-public-site.mjs", "service-worker.js"]) assert.ok(read(f).includes("views/navegacion-v2.js"), `${f} lleva el fichero`);
});
