// UND-17 (undécima auditoría; DEC-36, 22/11/2026): ocultar las cifras con un toque. El ojo de la cabecera cambia los importes por «•••»
// hasta volver a tocarlo y se recuerda en el dispositivo. Aquí, la parte pura (qué es un importe) y que todo esté enchufado.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Ocultar = require("../ocultar-cifras.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("UND-17 · tapa los importes con los formatos de la app y nada más", () => {
  const casos = [
    ["8.310 €", "••• €"],
    ["-8.310 €", "••• €"],
    ["412,30 €", "••• €"],
    ["1.218 €", "••• €"], // Intl pone un espacio duro
    ["+90 € al mes", "••• € al mes"],
    ["entre 270 € y 2.670 € al mes", "entre ••• € y ••• € al mes"],
    ["2,5 k€", "••• €"],
    ["€ 1.234,56", "€ •••"],
    ["Libre de deuda en julio de 2027", "Libre de deuda en julio de 2027"],
    ["21,9 % de TAE · 38 meses", "21,9 % de TAE · 38 meses"],
    ["el 14 de noviembre", "el 14 de noviembre"],
  ];
  for (const [entrada, salida] of casos) assert.equal(Ocultar.enmascarar(entrada), salida, entrada);
  assert.equal(Ocultar.tieneImporte("pagáis 1.200 €"), true);
  assert.equal(Ocultar.tieneImporte("pagáis 1.200 € y"), true, "sin estado entre llamadas (regex global)");
  assert.equal(Ocultar.tieneImporte("TAE 9,5 %"), false);
  assert.equal(Ocultar.enmascarar(null), "");
});

test("UND-17 · el ojo está en la cabecera, es un interruptor accesible y el script carga antes que la app", () => {
  const html = read("index.html");
  assert.match(html, /<button class="ocultar-cifras-toggle" id="ocultarCifrasToggle" type="button" aria-pressed="false" aria-label="Ocultar las cifras"/);
  assert.ok(html.indexOf('id="ocultarCifrasToggle"') < html.indexOf('id="mobileNavToggle"'), "en el móvil, a la izquierda de «Menú»");
  assert.match(html, /<script defer src="ocultar-cifras\.js\?v=20261122und17"><\/script>/);
  assert.ok(html.indexOf('src="ocultar-cifras.js?v=') < html.indexOf('src="app.js?v='), "antes que app.js: tapa desde el primer pintado");
  assert.ok(html.indexOf('src="medidor-utilidad.js?v=') < html.indexOf('src="ocultar-cifras.js?v='), "el medidor ya está");
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"ocultar-cifras\.js",$/m);
  assert.match(read("service-worker.js"), /^ {2}"\.\/ocultar-cifras\.js",$/m);
  const js = read("ocultar-cifras.js");
  assert.match(js, /\/\/ Un interruptor: el nombre no cambia y `aria-pressed` dice si está puesto/);
  assert.doesNotMatch(js, /setAttribute\("aria-label", activo/, "el nombre del interruptor no cambia con su estado");
  assert.match(js, /FinanceMedidor\?\.anotar\?\.\("ocultar-cifras", siguiente \? "accion" : "descarte"\)/);
});

test("UND-17 · CSS en los dos temas: el ojo de 44 px (34 a 195 px), tachado al ocultar, campos borrosos y el SVG sin el mínimo global", () => {
  const css = read("styles.css");
  const bloque = css.slice(css.indexOf("/* UND-17 (DEC-36"));
  assert.match(bloque, /\.ocultar-cifras-toggle \{[^}]*min-width: 44px;[^}]*min-height: 44px;/);
  assert.match(bloque, /\.ocultar-cifras-ojo \{\s*min-height: 0;/, "styles.css da 350 px de alto mínimo a todo svg");
  assert.match(bloque, /\.ocultar-cifras-toggle\[aria-pressed="true"\] \.ocultar-cifras-tachado \{\s*display: inline;/);
  assert.match(bloque, /\.cifras-ocultas input\[type="number"\]:not\(:focus\) \{\s*filter: blur\(6px\);/);
  assert.match(bloque, /@media \(width < 260px\) \{[\s\S]*min-width: 34px;[\s\S]*\.mobile-nav-toggle \{\s*grid-column: 4;/);
  assert.doesNotMatch(bloque, /data-tema/, "no cuelga del tema v2: también en el clásico");
  assert.match(read("index.html"), /styles\.css\?v=2026112(?:2und(?:1[37]|04)|6r1a|7dn57)/);
});

test("UND-17 · la preferencia es del dispositivo (no viaja en la copia) y el medidor la cuenta", () => {
  assert.match(read("ocultar-cifras.js"), /const OCULTAR_CIFRAS_KEY = "ocultar-cifras";/);
  assert.match(read("tests/arq6-copia-completa.test.cjs"), /"ocultar-cifras": "/);
  const medidor = require("../medidor-utilidad.js");
  const r = medidor.resumen(medidor.registrar(medidor.registrar(null, "ocultar-cifras", "accion", { hoy: "2026-11-22" }), "ocultar-cifras", "descarte", { hoy: "2026-11-22" }), "ocultar-cifras", "2026-11");
  assert.equal(r.acciones, 1);
  assert.equal(r.descartes, 1);
});
