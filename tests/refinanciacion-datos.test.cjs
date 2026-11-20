// 19/11/2026 · el hogar: «Saca el importe de la refinanciación a nuestros datos» (y «dos pasos, sin tocar cifras»; «otro importe de
// ejemplo» en la demo). La cuota, las cuotas, el mes desde el que manda y la partida que la paga son datos del hogar
// (scenarioSettings.reunifiedDebt); la demo trae los suyos. Paso 1: se copiaron una vez a los datos lo que había en el código.
// Paso 2 (20/11/2026, el hogar: «Ya la he abierto y cuadra, haz el paso 2»): el código ya no trae ese importe ni la migración.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const app = codigoApp();
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const extract = (name) => {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return app.slice(start, app.indexOf("\n}\n", start) + 2);
};

function sandbox({ settings = {}, assumptions = {}, publicDemo = false } = {}) {
  const context = {
    scenarioSettings: settings,
    baseData: { metadata: { publicDemo }, assumptions },
    round2: (v) => Math.round(Number(v) * 100) / 100,
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
  };
  vm.createContext(context);
  vm.runInContext(["reunifiedDebtSettings", "reunifiedDebtPayment", "reunifiedDebtInstallments", "reunifiedDebtCost", "adjustedDebtPlannedValue"].map(extract).join("\n"), context);
  return context;
}

test("refinanciación · el dato del hogar manda; sin él, el de la demo; sin ninguno, nada (ni cuota ni plan unificado)", () => {
  const hogar = sandbox({ settings: { reunifiedDebt: { payment: 150.5, installments: 24, fromMonth: "2026-03", rowKey: "expense|r" } }, assumptions: { reunifiedDebt: { payment: 200, installments: 30 } } });
  assert.deepEqual(JSON.parse(JSON.stringify(hogar.reunifiedDebtSettings())), { payment: 150.5, installments: 24, fromMonth: "2026-03", rowKey: "expense|r" });
  assert.equal(hogar.reunifiedDebtCost(), 3612);
  const demo = sandbox({ assumptions: { reunifiedDebt: { payment: 200, installments: 30, fromMonth: "2026-07", rowKey: "expense|demo-refinancing" } } });
  assert.equal(demo.reunifiedDebtPayment(), 200);
  assert.equal(demo.reunifiedDebtInstallments(), 30);
  const vacio = sandbox();
  assert.equal(vacio.reunifiedDebtSettings(), null);
  assert.equal(vacio.reunifiedDebtPayment(), 0);
});

test("refinanciación · la cuota manda en su partida desde su mes (por la clave de la partida, no por el nombre de la entidad)", () => {
  const c = sandbox({ settings: { reunifiedDebt: { payment: 150, installments: 24, fromMonth: "2026-05", rowKey: "expense|r" } } });
  const fila = { kind: "expense", id: "r", label: "Cualquier nombre" };
  assert.equal(c.adjustedDebtPlannedValue(fila, { key: "2026-05" }), 150);
  assert.equal(c.adjustedDebtPlannedValue(fila, { key: "2026-04" }), null, "antes de su mes, lo del plan");
  assert.equal(c.adjustedDebtPlannedValue({ ...fila, id: "otra" }, { key: "2026-06" }), null);
  assert.equal(c.adjustedDebtPlannedValue({ ...fila, custom: true }, { key: "2026-06" }), null);
  assert.equal(sandbox().adjustedDebtPlannedValue(fila, { key: "2026-06" }), null, "sin el dato, nada");
});

test("refinanciación · paso 2: sin migración ni importe en el código; con los datos del hogar vacíos no se inventa nada", () => {
  for (const resto of ["LEGACY_REUNIFIED_DEBT", "migrateReunifiedDebtSetting", "CURRENT_REUNIFIED_DEBT"]) assert.ok(!app.includes(resto), resto);
  // Ni la regla por la etiqueta de la partida: la cuota manda solo por su clave (rowKey).
  assert.doesNotMatch(app, /rowLabel: "refinanciacion/);
  assert.doesNotMatch(extract("adjustedDebtPlannedValue"), /displayLabelForRow|normalizedText/);
  // Fuera de la demo y sin dato guardado: ni cuota, ni coste, ni partida que mande.
  const hogarSinDato = sandbox({ publicDemo: false });
  assert.equal(hogarSinDato.reunifiedDebtSettings(), null);
  assert.equal(hogarSinDato.reunifiedDebtCost(), 0);
  assert.equal(hogarSinDato.adjustedDebtPlannedValue({ kind: "expense", id: "cualquiera" }, { key: "2026-06" }), null);
  // Ni al arrancar ni al llegar una copia o la nube se toca el dato.
  assert.doesNotMatch(extract("refreshFromPersistedState"), /reunifiedDebt/);
});

test("refinanciación · la demo, con su importe inventado; la tarjeta para cambiarla, plegada y con «Deshacer»", () => {
  assert.match(read("tools/build-public-demo-data.mjs"), /reunifiedDebt: \{ payment: 185, installments: 36, fromMonth: "2026-07", rowKey: "expense\|demo-refinancing" \}/);
  // Deuda › Contratos: la tarjeta para cambiarla, plegada y sin titular; guardar con deshacer.
  const html = read("index.html");
  const at = html.indexOf('id="refinanciacionCuotaCard"');
  assert.ok(at > html.indexOf('id="deuda-contratos"') && at < html.indexOf('id="cirbeCard"'));
  assert.doesNotMatch(html.slice(at, html.indexOf("</details>", at)), /<h[1-6]/);
  const deuda = read("views/deuda.js");
  assert.match(deuda, /scenarioSettings\.reunifiedDebt = \{ payment, installments, fromMonth, rowKey, updatedAt: new Date\(\)\.toISOString\(\) \};/);
  assert.match(deuda, /showUndoToast\(texto, \(\) => \{/);
  assert.match(app, /globalThis\.renderRefinanciacionCuota\?\.\(\);/);
});
