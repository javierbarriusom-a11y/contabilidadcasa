const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const medidor = require("../medidor-utilidad.js");

// XGO-02 · Medidor de utilidad por función (P10): por función y mes, si se vio (días distintos), si se actuó, si se
// descartó y si se deshizo, solo en agregado y sin importes. Lo leen Ajustes › Uso de la app (informe mensual) y
// «Funciones en prueba» (dato junto a la métrica, para revisar con datos). La e2e de qa1 («XGO-02 · Medidor de
// utilidad») recorre Clasificar y comprueba los dos sitios.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const apply = (eventos) => eventos.reduce((store, [id, evento, opciones]) => medidor.registrar(store, id, evento, opciones), null);

test("está en el sitio público y el service worker, se carga antes de «Funciones en prueba» y su informe vive en Uso de la app", () => {
  const html = read("index.html");
  const at = html.indexOf('<script defer src="medidor-utilidad.js');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="funciones-en-prueba.js'));
  assert.ok(read("service-worker.js").includes('"./medidor-utilidad.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"medidor-utilidad.js"'));
  const grupo = html.indexOf('id="ajustes-uso-app"');
  assert.ok(html.indexOf('id="medidorUtilidadCard"') > html.indexOf('id="panelUsoCard"') && html.indexOf('id="panelUsoCard"') > grupo);
});

test("una vista es un día: repintar el mismo día no suma, otro día sí", () => {
  const store = apply([
    ["clasificar-v2", "vista", { hoy: "2026-10-22" }],
    ["clasificar-v2", "vista", { hoy: "2026-10-22" }],
    ["clasificar-v2", "vista", { hoy: "2026-10-23" }],
  ]);
  assert.equal(medidor.resumen(store, "clasificar-v2").vistas, 2);
});

test("acciones, días con acción, descartes y deshechos; la tasa es la parte de los días vistos en que se actuó", () => {
  const store = apply([
    ["clasificar-v2", "vista", { hoy: "2026-10-22" }],
    ["clasificar-v2", "accion", { hoy: "2026-10-22" }],
    ["clasificar-v2", "accion", { hoy: "2026-10-22" }],
    ["clasificar-v2", "descarte", { hoy: "2026-10-22" }],
    ["clasificar-v2", "deshecho", { hoy: "2026-10-22" }],
    ["clasificar-v2", "vista", { hoy: "2026-10-23" }],
    ["clasificar-v2", "vista", { hoy: "2026-10-24" }],
    ["clasificar-v2", "vista", { hoy: "2026-10-25" }],
  ]);
  const r = medidor.resumen(store, "clasificar-v2");
  assert.deepEqual([r.vistas, r.acciones, r.diasAccion, r.descartes, r.deshechos, r.tasa], [4, 2, 1, 1, 1, 25]);
  assert.equal(medidor.frase("clasificar-v2", r), "vista 4 días · 2 reglas aceptadas (actuasteis el 25 % de los días) · 1 grupo saltado · 1 regla deshecha");
});

test("informe por mes: cada mes por separado y, sin mes, todo lo guardado; se guardan como mucho 6 meses", () => {
  let store = apply([
    ["importar-v2", "accion", { hoy: "2026-10-30", clave: "b1" }],
    ["importar-v2", "accion", { hoy: "2026-11-02", clave: "b2" }],
  ]);
  assert.equal(medidor.resumen(store, "importar-v2", "2026-10").acciones, 1);
  assert.equal(medidor.resumen(store, "importar-v2", "2026-11").acciones, 1);
  assert.equal(medidor.resumen(store, "importar-v2").acciones, 2);
  assert.deepEqual(Array.from(medidor.mesesGuardados(store)), ["2026-11", "2026-10"]);
  for (const mes of ["2026-12", "2027-01", "2027-02", "2027-03", "2027-04"]) store = medidor.registrar(store, "tema-v2", "vista", { hoy: `${mes}-05` });
  assert.equal(medidor.mesesGuardados(store).length, 6);
  assert.ok(!medidor.mesesGuardados(store).includes("2026-10"), "el más antiguo sale");
});

test("la clave evita contar dos veces el mismo lote importado aunque se repinte", () => {
  const store = apply([
    ["importar-v2", "accion", { hoy: "2026-10-22", clave: "lote-1" }],
    ["importar-v2", "accion", { hoy: "2026-10-22", clave: "lote-1" }],
    ["importar-v2", "accion", { hoy: "2026-10-23", clave: "lote-2" }],
  ]);
  assert.equal(medidor.resumen(store, "importar-v2").acciones, 2);
});

test("Hoy: mediana de los segundos hasta la primera acción", () => {
  const store = apply([
    ["hoy-v2", "accion", { hoy: "2026-10-22", segundos: 4.24 }],
    ["hoy-v2", "accion", { hoy: "2026-10-23", segundos: 30 }],
    ["hoy-v2", "accion", { hoy: "2026-10-24", segundos: 8 }],
    ["hoy-v2", "accion", { hoy: "2026-10-24" }],
  ]);
  const r = medidor.resumen(store, "hoy-v2");
  assert.deepEqual([r.medianaSegundos, r.veces, r.acciones], [8, 3, 4]);
  assert.match(medidor.frase("hoy-v2", r), /8 s hasta la primera acción \(mediana de 3\)/);
});

test("sin datos lo dice; datos raros o rotos no rompen nada; eventos desconocidos no cuentan", () => {
  assert.equal(medidor.frase("clasificar-v2", medidor.resumen(null, "clasificar-v2")), "aún sin usar");
  assert.equal(medidor.resumen({ meses: { "2026-10": { "clasificar-v2": { vistas: -3, acciones: "x" } } } }, "clasificar-v2").vistas, 0);
  assert.equal(medidor.resumen([1, 2], "clasificar-v2").vistas, 0);
  assert.equal(medidor.resumen(medidor.registrar(null, "clasificar-v2", "clic", { hoy: "2026-10-22" }), "clasificar-v2").acciones, 0);
  assert.equal(medidor.frase("tema-v2", medidor.resumen(apply([["tema-v2", "vista", { hoy: "2026-10-22" }], ["tema-v2", "descarte", { hoy: "2026-10-22" }]]), "tema-v2")), "vista 1 día · 1 vuelta al de siempre");
});

test("cada pantalla anota sus eventos, sin importes, y nada se rompe si el medidor no carga", () => {
  const anota = (file, id, evento) => assert.ok(new RegExp(`globalThis\\.FinanceMedidor\\?\\.anotar\\("${id}", "${evento}"`).test(read(file)), `${file}: ${id} ${evento}`);
  for (const evento of ["vista", "accion", "descarte", "deshecho"]) anota("views/clasificar-v2.js", "clasificar-v2", evento);
  for (const evento of ["vista", "accion", "descarte", "deshecho"]) anota("views/importar-v2.js", "importar-v2", evento);
  for (const evento of ["vista", "accion", "descarte"]) anota("views/movimientos-v2.js", "movimientos-v2", evento);
  for (const evento of ["vista", "accion", "descarte"]) anota("views/hoy-v2.js", "hoy-v2", evento);
  anota("funciones-en-prueba.js", "tema-v2", "descarte");
  assert.match(read("medidor-utilidad.js"), /anotar\("tema-v2", "vista"\)/);
  assert.ok(!/money\(|amount|importe:/.test(read("medidor-utilidad.js")), "el medidor no guarda importes");
});

test("«Funciones en prueba» enseña lo medido junto a la métrica de cada función", () => {
  const fep = read("funciones-en-prueba.js");
  assert.match(fep, /<span class="fep-meta fep-medido">Medido: \$\{escapeHtml\(medidor\.frase\(item\.id, medidor\.resumen\(medidor\.leer\(\), item\.id\)\)\)\}<\/span>/);
});
