// WP-21 · PR-0a (docs/WP21_DISENO.md §3): titular y depositario de cada posición, para el informe de la Renta.
// Cartera INVENTADA.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const portfolio = require("../canonical-portfolio.js");
const ui = require("../renta-datos-ui.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pos = (extra) => ({ id: "p1", type: "fondo", label: "Fondo A", quantity: 10, costBasis: 1000, currentValue: 1100, ...extra });

test("el motor guarda titular y depositario declarados, y vacío si no lo están (nunca un titular ni «España» por defecto)", () => {
  const [a, b, c] = portfolio.normalizePositions([
    pos({ titular: "tere", depositario: "extranjero", depositarioPais: "  Irlanda " }),
    pos({ id: "p2" }),
    pos({ id: "p3", titular: "otra", depositario: "luna", depositarioPais: "Irlanda" }),
  ]).positions;
  assert.deepEqual([a.titular, a.depositario, a.depositarioPais], ["tere", "extranjero", "Irlanda"]);
  assert.deepEqual([b.titular, b.depositario, b.depositarioPais], ["", "", ""]);
  assert.deepEqual([c.titular, c.depositario, c.depositarioPais], ["", "", ""], "valores desconocidos no pasan; país solo si está fuera de España");
  assert.deepEqual([...portfolio.PORTFOLIO_HOLDERS], ["javi", "tere", "household"]);
});

test("cambiar un campo toca solo esa posición; volver a España borra el país", () => {
  const list = [pos({ depositario: "extranjero", depositarioPais: "Irlanda" }), pos({ id: "p2", label: "ETF B" })];
  const next = ui.rentaDatosAplicar(list, "p1", "depositario", "espana");
  assert.deepEqual([next[0].depositario, next[0].depositarioPais], ["espana", ""]);
  assert.equal(next[1], list[1], "la otra posición, intacta");
  assert.equal(ui.rentaDatosAplicar(list, "p1", "currentValue", 0), null, "solo los campos de la Renta");
  assert.equal(ui.rentaDatosAplicar(list, "nadie", "titular", "javi"), null);
  assert.equal(ui.rentaDatosAplicar(list, "p2", "titular", "household")[1].titular, "household");
});

test("la lista: una fila por posición con titular, depositario y país (este solo fuera de España), y lo que falta, dicho", () => {
  const html = ui.rentaDatosHtml([pos({ titular: "javi", depositario: "espana" }), pos({ id: "p2", label: "ETF <B>", depositario: "extranjero", depositarioPais: "Irlanda" })]);
  assert.equal((html.match(/class="renta-datos-fila"/g) || []).length, 2);
  assert.match(html, /<option value="javi" selected>Javi<\/option>/);
  assert.match(html, /<option value="household">Conjunta \(50 % cada uno\)<\/option>/);
  assert.match(html, /aria-label="Titular de ETF &lt;B&gt;"/, "el nombre va escapado");
  assert.match(html, /<label><span>País<\/span><input type="text" maxlength="60" data-renta-datos-campo="depositarioPais" aria-label="País donde está depositada ETF &lt;B&gt;" value="Irlanda"/);
  assert.match(html, /<label hidden><span>País<\/span>/, "en España, el país va oculto");
  assert.match(html, /1 de 2 posiciones tienen titular\./);
  assert.match(ui.rentaDatosHtml([]), /Aún no hay posiciones en la cartera\./);
  assert.equal(ui.rentaDatosResumenTexto([pos({ titular: "tere", depositario: "espana" }), pos({ titular: "javi", depositario: "espana" })]), "Las 2 posiciones tienen titular.");
});

test("vive plegado en Inversión › Cartera, se carga antes de app.js y está en el sitio público y el service worker", () => {
  const html = read("index.html");
  assert.match(html, /<details class="e19-card renta-datos" id="rentaDatos">\s*<summary>Datos para la Renta: titular y depósito de cada posición, dividendos e intereses<\/summary>/);
  assert.ok(html.indexOf('id="rentaDatos"') < html.indexOf('id="valoracionCard"'));
  const at = html.indexOf('<script defer src="renta-datos-ui.js');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js'));
  assert.ok(read("service-worker.js").includes('"./renta-datos-ui.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"renta-datos-ui.js"'));
  assert.doesNotMatch(read("renta-datos-ui.js"), /localStorage/, "guarda con la lista de posiciones de siempre");
});

// ---- WP-21 · PR-0b: dividendos e intereses, y el bloque de cada pérdida arrastrada. Cifras INVENTADAS. ----
const cobro = (extra) => ({ fecha: "2026-03-12", tipo: "dividendo", posicionId: "p1", integro: "120,50", retencionEspana: "22,90", retencionOrigen: "", paisOrigen: "", ...extra });

test("un cobro se guarda con el íntegro y las retenciones; una retención en blanco es «sin declarar» (null), nunca 0", () => {
  const { record } = ui.rentaRendimientoNormalizar(cobro({ id: "r1" }), [pos()]);
  assert.deepEqual(record, { id: "r1", fecha: "2026-03-12", tipo: "dividendo", posicionId: "p1", concepto: "", titular: "", integro: 120.5, retencionEspana: 22.9, retencionOrigen: null, paisOrigen: "" });
  assert.equal(ui.rentaRendimientoNormalizar(cobro({ retencionOrigen: "0" }), [pos()]).record.retencionOrigen, 0, "0 tecleado es 0");
  const interes = ui.rentaRendimientoNormalizar(cobro({ tipo: "interes", posicionId: "", concepto: " Cuenta remunerada ", titular: "tere" }), [pos()]).record;
  assert.deepEqual([interes.posicionId, interes.concepto, interes.titular], ["", "Cuenta remunerada", "tere"]);
});

test("lo que no se puede guardar dice por qué", () => {
  const motivo = (extra, positions = [pos()]) => ui.rentaRendimientoNormalizar(cobro(extra), positions).error;
  assert.match(motivo({ fecha: "" }), /fecha/);
  assert.match(motivo({ fecha: "2026-13-40" }), /fecha/);
  assert.match(motivo({ tipo: "cupón" }), /dividendo o un interés/);
  assert.match(motivo({ integro: "0" }), /íntegro/);
  assert.match(motivo({ retencionEspana: "500" }), /de 0 al íntegro/, "la retención no puede pasar del íntegro");
  assert.match(motivo({ retencionOrigen: "-1" }), /de 0 al íntegro/);
  assert.match(motivo({ posicionId: "" }), /de dónde viene/, "sin posición hace falta el concepto");
  assert.match(motivo({ posicionId: "borrada" }), /ya no está/);
});

test("el titular de un cobro es el de su posición (aunque cambie después); sin posición, el declarado", () => {
  const positions = [pos({ titular: "javi" })];
  assert.equal(ui.rentaRendimientoTitular({ posicionId: "p1", titular: "tere" }, positions), "javi");
  assert.equal(ui.rentaRendimientoTitular({ posicionId: "p1" }, [pos({ titular: "household" })]), "household");
  assert.equal(ui.rentaRendimientoTitular({ posicionId: "", titular: "tere" }, positions), "tere");
  assert.equal(ui.rentaRendimientoTitular({ posicionId: "p9" }, positions), "", "posición borrada: sin titular, no se adivina");
});

test("por año: lo cobrado, lo retenido declarado y lo que falta para el informe", () => {
  const list = [
    { id: "a", fecha: "2026-03-12", tipo: "dividendo", posicionId: "p1", integro: 100, retencionEspana: 19, retencionOrigen: 15, paisOrigen: "" },
    { id: "b", fecha: "2026-06-30", tipo: "interes", posicionId: "", concepto: "Cuenta", titular: "", integro: 40.25, retencionEspana: null, retencionOrigen: null, paisOrigen: "" },
    { id: "c", fecha: "2025-12-01", tipo: "dividendo", posicionId: "p1", integro: 10, retencionEspana: 1.9, retencionOrigen: 0, paisOrigen: "" },
  ];
  const [y26, y25] = ui.rentaRendimientosPorAno(list, [pos({ titular: "javi" })]);
  assert.equal(y26.year, "2026");
  assert.deepEqual([y26.integro, y26.retencionEspana, y26.retencionOrigen], [140.25, 19, 15]);
  assert.deepEqual(y26.cobros.map((r) => r.id), ["b", "a"], "lo más reciente primero");
  assert.deepEqual([y26.sinRetencionEspana, y26.sinTitular, y26.origenSinPais], [1, 1, 1]);
  assert.equal(ui.rentaRendimientosFaltaTexto(y26), "Falta: 1 sin la retención española declarada; 1 sin titular; 1 con retención en origen y sin país.");
  assert.equal(ui.rentaRendimientosFaltaTexto(y25), "", "retención en origen 0: no pide país");
});

test("el formulario y la lista: escapados, con el total del año y el «Quitar» de cada cobro", () => {
  const html = ui.rentaRendimientosHtml([{ id: "a", fecha: "2026-03-12", tipo: "dividendo", posicionId: "p1", integro: 100, retencionEspana: null, retencionOrigen: 15, paisOrigen: "Irlanda" }], [pos({ label: "ETF <B>", titular: "javi" })]);
  assert.match(html, /<option value="p1">ETF &lt;B&gt;<\/option><option value="">Ninguna: una cuenta o un depósito<\/option>/);
  assert.match(html, /<label data-renta-rend-sin-posicion hidden><span>De dónde viene<\/span>/, "con posiciones, lo de «sin posición» va oculto");
  assert.match(html, /<strong>2026<\/strong> · 1 cobro · íntegro/);
  assert.match(html, /retención en España sin declarar · en origen 15,00 € \(Irlanda\)/);
  assert.match(html, /aria-label="Quitar dividendo del 12\/03\/2026 de ETF &lt;B&gt;"/);
  assert.match(ui.rentaRendimientosHtml([], []), /Aún no hay cobros registrados\./);
  assert.doesNotMatch(ui.rentaRendimientosHtml([], []), /data-renta-rend-sin-posicion hidden/, "sin posiciones, el concepto se ve");
});

test("pérdidas arrastradas por bloque: FC3 solo aplica las de transmisiones; sin bloque, son de transmisiones como siempre", () => {
  const venta = { disposals: [{ date: "2026-05-01", realizedGain: 1000 }] };
  const r = portfolio.yearEndCompensation({ positions: [venta], year: "2026", priorLosses: [
    { year: "2024", amount: 300, bloque: "rendimientos" },
    { year: "2023", amount: 200 },
    { year: "2025", amount: 100, bloque: "ganancias" },
  ] });
  assert.deepEqual(r.priorLossesApplied, [{ year: "2023", amount: 200 }, { year: "2025", amount: 100 }]);
  assert.equal(r.taxableNet, 700);
  assert.equal(r.marginalSaleBase, 700, "la de rendimientos tampoco cuenta para valorar otra venta");
  assert.equal(ui.rentaPerdidaEtiqueta({ bloque: "rendimientos", titular: "tere" }), " · rendimientos · Tere");
  assert.equal(ui.rentaPerdidaEtiqueta({}), " · transmisiones · sin titular");
});

test("el formulario de pérdidas arrastradas pide el bloque y el titular, y app.js los guarda", () => {
  const html = read("index.html");
  assert.match(html, /<select id="fc3PriorLossBloque">\s*<option value="ganancias" selected>Transmisiones/);
  assert.match(html, /<select id="fc3PriorLossTitular">\s*<option value="" selected>Sin declarar<\/option>/);
  assert.doesNotMatch(html.slice(html.indexOf('id="fc3PriorLossTitular"'), html.indexOf('id="fc3PriorLossTitular"') + 300), /household/, "una pérdida es de un declarante: sin «conjunta»");
  const app = read("app.js");
  assert.match(app, /bloque: qs\("fc3PriorLossBloque"\)\?\.value === "rendimientos"|bloque, titular: qs\("fc3PriorLossTitular"\)/);
  assert.match(app, /fc3PriorLossesList\(\)\.filter\(\(entry\) => entry\.bloque !== "rendimientos"\)/, "el aviso del coste de la deuda solo suma las de transmisiones");
});
