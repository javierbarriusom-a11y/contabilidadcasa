// 19/11/2026 · el hogar: «Saca el importe de la refinanciación a nuestros datos» (y «dos pasos, sin tocar cifras»; «otro importe de
// ejemplo» en la demo). La cuota, las cuotas, el mes desde el que manda y la partida que la paga son datos del hogar
// (scenarioSettings.reunifiedDebt); la demo trae los suyos. Paso 1: se copian una vez a los datos lo que había en el código.
// Esta prueba no escribe ese importe: lo lee de la constante del paso 1 (que el paso 2 borrará).
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
const extractConst = (name) => {
  const start = app.indexOf(`const ${name} = `);
  return app.slice(start, app.indexOf(";\n", start) + 2);
};

function sandbox({ settings = {}, assumptions = {}, publicDemo = false, rows = [] } = {}) {
  const context = {
    scenarioSettings: settings,
    baseData: { metadata: { publicDemo }, assumptions },
    saved: 0,
    round2: (v) => Math.round(Number(v) * 100) / 100,
    normalizedText: (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    displayLabelForRow: (row) => row.label,
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    availableSeriesRows: () => rows,
  };
  context.saveScenarioSettings = () => { context.saved += 1; };
  vm.createContext(context);
  vm.runInContext([extractConst("LEGACY_REUNIFIED_DEBT"), ...["reunifiedDebtSettings", "reunifiedDebtPayment", "reunifiedDebtInstallments", "reunifiedDebtCost", "migrateReunifiedDebtSetting", "adjustedDebtPlannedValue"].map(extract), "this.LEGACY = LEGACY_REUNIFIED_DEBT;"].join("\n"), context);
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

test("refinanciación · paso 1: se copia una vez a los datos del hogar, solo con su partida y nunca en la demo", () => {
  const filaHogar = { kind: "expense", id: "financiaciones-88", label: `Otros · Refinanciacion ${"x"}` };
  // La partida se reconoce por la etiqueta de siempre (paso 1); la prueba la arma con la constante, sin escribirla.
  const conPartida = (extra = {}) => {
    const c = sandbox(extra);
    const label = `Otros · ${c.LEGACY.rowLabel.replace(/^./, (l) => l.toUpperCase())}`;
    c.availableSeriesRows = () => [{ ...filaHogar, label }];
    return c;
  };
  const c = conPartida();
  assert.equal(c.migrateReunifiedDebtSetting(), true);
  const guardado = c.scenarioSettings.reunifiedDebt;
  assert.deepEqual([guardado.payment, guardado.installments, guardado.fromMonth, guardado.rowKey], [c.LEGACY.payment, c.LEGACY.installments, c.LEGACY.fromMonth, "expense|financiaciones-88"]);
  assert.equal(c.saved, 1);
  // Las mismas cifras que antes: la cuota de siempre en su partida desde su mes.
  assert.equal(c.adjustedDebtPlannedValue({ kind: "expense", id: "financiaciones-88" }, { key: c.LEGACY.fromMonth }), c.LEGACY.payment);
  // Una sola vez: con el dato ya guardado (también el que el hogar haya cambiado), no lo pisa.
  c.scenarioSettings.reunifiedDebt = { ...guardado, payment: 999 };
  assert.equal(c.migrateReunifiedDebtSetting(), false);
  assert.equal(c.scenarioSettings.reunifiedDebt.payment, 999);
  // Nunca en la demo ni sin la partida.
  const demo = conPartida({ publicDemo: true });
  assert.equal(demo.migrateReunifiedDebtSetting(), false);
  assert.equal(demo.scenarioSettings.reunifiedDebt, undefined);
  const sinPartida = sandbox({ rows: [{ kind: "expense", id: "z", label: "Otra cosa" }] });
  assert.equal(sinPartida.migrateReunifiedDebtSetting(), false);
  // Se llama al arrancar y al llegar datos de una copia o de la nube.
  assert.match(extract("refreshFromPersistedState"), /migrateReunifiedDebtSetting\(\);/);
  assert.match(app, /applyVariableOperationalMayZeroDefault\(\);\n {2}migrateReunifiedDebtSetting\(\);/);
});

test("refinanciación · ya no hay importe ni regla por el nombre de la entidad fuera del paso 1; la demo, con su importe inventado", () => {
  assert.doesNotMatch(app, /CURRENT_REUNIFIED_DEBT/);
  assert.equal((app.match(/refinanciacion cetelem/g) || []).length, 1, "solo en LEGACY_REUNIFIED_DEBT (paso 1)");
  assert.match(read("tools/build-public-demo-data.mjs"), /reunifiedDebt: \{ payment: 200, installments: 30, fromMonth: "2026-07", rowKey: "expense\|demo-refinancing" \}/);
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
