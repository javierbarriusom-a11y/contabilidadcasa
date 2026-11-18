// DEC-40 (18/11/2026): lo plegado también es superficie. Se anota, solo en este navegador, qué desplegables de la página se
// abren y cuándo; Uso de la app dice cuántos se han abierto en 60 días y, con 60 días anotados, cuántos son candidatos a retirar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../views/plegados-medidor.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("DEC-40 · la clave: el id o la pantalla y el resumen sin cifras; sin nada, ninguna", () => {
  assert.equal(P.clave({ id: "cargoDiaCard", vista: "registrar", resumen: "Días de cargo · 12 estimados" }), "#cargoDiaCard");
  assert.equal(P.clave({ vista: "faqs-ayuda", resumen: "  ¿Cómo cierro el mes?  " }), "#faqs-ayuda › ¿Cómo cierro el mes?");
  assert.equal(P.clave({ vista: "plan", resumen: "Gasto variable: 1.750 € · 3 meses" }), "#plan › Gasto variable · meses");
  assert.equal(P.clave({ vista: "plan", resumen: "123 €" }), "");
});

test("DEC-40 · anotar: veces y último día, y el primer día anotado", () => {
  let s = P.registrar({}, "#a", new Date(2026, 10, 18));
  s = P.registrar(s, "#a", new Date(2026, 10, 20));
  s = P.registrar(s, "#b", new Date(2026, 10, 21));
  assert.deepEqual(s, { desde: "2026-11-18", aperturas: { "#a": { n: 2, ultima: "2026-11-20" }, "#b": { n: 1, ultima: "2026-11-21" } } });
  assert.deepEqual(P.registrar(s, "", new Date()), s, "sin clave no se anota");
});

test("DEC-40 · el resumen: abiertos en 60 días de los que hay en la página; sin 60 días anotados no propone retirar", () => {
  const store = { desde: "2026-11-18", aperturas: { "#a": { n: 2, ultima: "2026-11-20" }, "#viejo": { n: 1, ultima: "2026-08-01" } } };
  const corto = P.resumen(store, ["#a", "#b", "#viejo", "#a"], new Date(2026, 10, 25));
  assert.deepEqual(corto, { total: 3, abiertos: 1, sinAbrir: 2, desde: "2026-11-18", completo: false });
  assert.equal(P.texto(corto), "Desplegables: 1 de 3 abiertos en los últimos 60 días en este navegador. Se anota desde el 18/11/2026: hasta tener 60 días, no se propone retirar ninguno.");
  const largo = P.resumen(store, ["#a", "#b", "#viejo"], new Date(2027, 0, 20));
  assert.equal(largo.completo, true);
  assert.equal(largo.abiertos, 0, "el 20/11 queda a 61 días del 20/1");
  assert.match(P.texto(largo), /Los 3 que nadie ha abierto son candidatos a retirar \(se decide con el hogar\)\.$/);
  assert.match(P.texto(P.resumen({}, ["#a"])), /Se empieza a anotar al abrir el primero\.$/);
  assert.equal(P.texto(P.resumen({}, [])), "");
});

test("DEC-40 · solo lo que viene en la página: se marca antes de que app.js pinte, se escucha en captura y sale en Uso de la app", () => {
  const html = read("index.html");
  const at = html.indexOf('src="views/plegados-medidor.js?v=');
  assert.ok(at > 0 && at < html.indexOf('src="app.js?v='), "antes de app.js, que pinta lo que lleva datos");
  const vista = read("views/plegados-medidor.js");
  assert.match(vista, /document\.addEventListener\("toggle", [\s\S]*?, true\);/);
  assert.match(vista, /!details\.dataset\.plegadoClave/);
  assert.ok(html.indexOf('id="usoAppPlegados"') > html.indexOf('id="usoAppLegacy"'));
  assert.match(read("laboratorio-ui.js"), /plegadosEl\.textContent = globalThis\.plegadosResumenTexto\?\.\(\) \|\| ""/);
  assert.match(read("service-worker.js"), /"\.\/views\/plegados-medidor\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"views\/plegados-medidor\.js",/);
});
