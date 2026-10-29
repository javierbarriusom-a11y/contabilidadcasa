const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../canonical-overdraft-fix.js");
const fep = require("../funciones-en-prueba.js");
const medidor = require("../medidor-utilidad.js");

// XPR-07 · PR-1 «El arreglo más barato para un descubierto»: cuando la trayectoria «según el plan» de la banda de caja baja del suelo, cuánto
// falta y las palancas por coste (gasto discrecional declarado, colchón, línea de crédito). No inventa palancas sin dato y no hace nada.
// Nace apagada en Funciones en prueba. La e2e de qa1 sube el suelo para provocar un descubierto en el hogar de demostración.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const day = (date, central) => ({ date, central });

test("el descubierto: primer día por debajo del suelo, el punto más bajo desde ahí y cuánto falta; sin suelo o sin cruce, nada", () => {
  const days = [day("2026-11-01", 3500), day("2026-11-10", 2800), day("2026-11-15", 2400), day("2026-11-20", 3100), day("2026-11-25", 2600)];
  assert.deepEqual(F.findDeficit({ days, floor: 3000 }), { date: "2026-11-10", lowestDate: "2026-11-15", lowest: 2400, floor: 3000, shortfall: 600 });
  assert.equal(F.findDeficit({ days, floor: 2000 }), null, "no baja del suelo");
  assert.equal(F.findDeficit({ days, floor: null }), null, "sin suelo declarado no se puede hablar de descubierto");
  assert.equal(F.findDeficit({ days, floor: 0 }), null);
  assert.equal(F.findDeficit({ days: [day("mal", 1), day("2026-11-02", "x")], floor: 3000 }), null, "lo que no es un día con cifra no cuenta");
});

test("las palancas sin dato no se inventan y se dice cuáles faltan", () => {
  const none = F.levers({});
  assert.deepEqual(none.list.map((lever) => lever.id), ["colchon"], "el colchón siempre se puede usar (y se dice lo que cuesta en margen)");
  assert.deepEqual(none.missing, ["discrecional", "credito"]);
  assert.deepEqual(F.levers({ discretionary: { amount: 0 }, creditLine: { limit: 5000, ratePct: null } }).missing, ["discrecional", "credito"], "sin tipo no hay coste que comparar");
  const all = F.levers({ discretionary: { amount: 250, items: [{ label: "Ocio", amount: 150 }, { label: "Ropa", amount: 60 }, { label: "Viajes", amount: 30 }, { label: "Otro", amount: 10 }] }, creditLine: { limit: 5000, ratePct: 9 } });
  assert.deepEqual(all.missing, []);
  assert.equal(all.list.find((lever) => lever.id === "discrecional").items.length, 3, "como mucho tres conceptos de ejemplo");
  assert.equal(all.list.find((lever) => lever.id === "credito").costPerEuro, 0.0225, "9 % durante 3 meses");
});

test("del más barato al más caro; a igual coste, el que menos colchón gasta; como mucho tres", () => {
  const { list } = F.levers({ discretionary: { amount: 250 }, creditLine: { limit: 5000, ratePct: 9 } });
  const r = F.solve({ shortfall: 600, levers: list });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.options.map((option) => [option.parts.map((part) => `${part.id}:${part.amount}`).join("+"), option.cost, option.cushionUsed]), [
    ["discrecional:250+colchon:350", 0, 350],
    ["colchon:600", 0, 600],
    ["discrecional:250+credito:350", 7.88, 0],
  ]);
  assert.ok(r.options.length <= F.MAX_OPTIONS);
  const small = F.solve({ shortfall: 200, levers: list });
  assert.deepEqual(small.options[0].parts.map((part) => [part.id, part.amount]), [["discrecional", 200]], "si el discrecional basta, es la más barata y no toca el colchón");
  assert.equal(F.solve({ shortfall: 0, levers: list }).status, "none");
  assert.equal(F.solve({ shortfall: 900, levers: F.levers({ cushion: false, creditLine: { limit: 500, ratePct: 9 } }).list }).status, "uncovered", "si nada llega, se dice");
});

test("en Funciones en prueba con su interruptor, solo se ve con descubierto y lee la banda de caja, sin recalcular la previsión", () => {
  const item = fep.CATALOGO.find((entry) => entry.id === "descubierto");
  assert.equal(item.interruptor, "propio");
  assert.match(item.metrica, /se queda dormida si no hay ninguno en seis meses/);
  assert.ok(medidor.FUNCIONES.some((f) => f.id === "descubierto"));
  assert.match(read("index.html"), /<article class="e19-card desc-card" id="descubiertoCard" aria-labelledby="descubiertoTitulo" hidden>/);
  assert.match(read("app.js"), /globalThis\.renderDescubierto\?\.\(globalThis\.FinanceCanonicalOverdraftFix\)/);
  const ui = read("descubierto-ui.js");
  assert.match(ui, /if \(!engine \|\| !descubiertoOn\(\) \|\| !input \|\| !result \|\| result\.status !== "ok"\) return off\(\);/);
  assert.match(ui, /if \(!deficit\) return off\(\);/);
  assert.ok(!/\.simulate\(/.test(ui), "no vuelve a simular: usa la banda ya pintada");
  assert.match(read("cash-band-ui.js"), /cashBandLastResult = result;/);
  for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) {
    assert.ok(read(file).includes("canonical-overdraft-fix.js") && read(file).includes("descubierto-ui.js"), file);
  }
});
