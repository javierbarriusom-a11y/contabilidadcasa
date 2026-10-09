const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const E = require("../canonical-contingency-plan.js");

// WP-38 (PRV-05 + NPV-09): el plan B acordado en frío. Motor puro: disparador (cuándo salta), efecto de cada paso en orden, firma con huella y palanca de recorte.
// Las pruebas fijan lo que el hogar debe poder fiar: que no salte por un mes suelto, que un dato ausente no sea un cero, que el crédito no pase por dinero propio
// y que cambiar el plan invalide la firma.

const KEYS = ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"];
const series = (values) => values.map((liquidity, i) => ({ monthKey: KEYS[i], label: KEYS[i], liquidity }));
const flat = (value) => Object.fromEntries(KEYS.map((key) => [key, value]));
const planWith = (actions, trigger = {}) => E.normalizePlan({ trigger: { mode: "amount", amount: 3000, consecutive: 2, horizon: 6, ...trigger }, actions });
const standard = () => planWith([{ kind: "pause-saving", months: 3, outside: true }, { kind: "cut-discretionary", pct: 20, months: 3 }, { kind: "credit-line", amount: 2000 }]);
const ctx = { saving: flat(300), discretionary: flat(600), creditLimit: 5000, creditRate: 9 };

test("WP-38 · normalizePlan acepta cualquier cosa del almacén y devuelve siempre un plan acotado", () => {
  for (const raw of [null, undefined, "x", 5, [], {}, { trigger: "mal", actions: "mal" }]) {
    const plan = E.normalizePlan(raw);
    assert.equal(plan.trigger.mode, "floor");
    assert.deepEqual(plan.actions, []);
    assert.equal(plan.signature, null);
  }
  const wild = E.normalizePlan({ trigger: { mode: "amount", amount: -5, consecutive: 99, horizon: 0 }, actions: Array.from({ length: 20 }, () => ({ kind: "cut-discretionary", pct: 900, months: -3 })) });
  assert.equal(wild.trigger.amount, 0);
  assert.equal(wild.trigger.consecutive, 6);
  assert.equal(wild.trigger.horizon, 2);
  assert.equal(wild.actions.length, E.MAX_ACTIONS);
  assert.equal(wild.actions[0].pct, 100);
  assert.equal(wild.actions[0].months, 1);
  assert.equal(E.normalizePlan({ actions: [{ kind: "inventada" }] }).actions[0].kind, "other");
});

test("WP-38 · sin plan no hay estado; incompleto dice qué falta y un colchón ausente no se rellena con 0", () => {
  assert.equal(E.evaluate({ plan: null, series: series([1000]), floor: 3000 }).status, "none");
  const sinAcciones = E.evaluate({ plan: planWith([]), series: series([1000, 1000]), floor: 3000 });
  assert.equal(sinAcciones.status, "incomplete");
  assert.match(sinAcciones.reasons.join(" "), /al menos una acción/);
  const sinCifra = E.evaluate({ plan: planWith([{ kind: "pause-saving" }], { amount: 0 }), series: series([1000, 1000]) });
  assert.equal(sinCifra.status, "incomplete");
  const sinColchon = E.evaluate({ plan: E.normalizePlan({ trigger: { mode: "floor" }, actions: [{ kind: "pause-saving" }] }), series: series([100, 100]), floor: 0 });
  assert.equal(sinColchon.status, "incomplete", "con el disparador en «el colchón» y sin colchón, no hay umbral que vigilar");
  const sinSerie = E.evaluate({ plan: standard(), series: [], floor: 3000 });
  assert.equal(sinSerie.status, "no-data", "sin previsión no se dice «todo bien»");
  assert.match(sinSerie.reasons.join(" "), /no significa que todo vaya bien/);
});

test("WP-38 · el disparador pide meses SEGUIDOS por debajo: un mes suelto o dos salteados no lo activan", () => {
  const run = (values, consecutive = 2) => E.evaluate({ plan: planWith([{ kind: "pause-saving" }], { consecutive }), series: series(values), ...ctx });
  assert.equal(run([3500, 2800, 3400, 2900, 3300, 3500]).status, "watch", "dos meses por debajo pero no seguidos");
  assert.equal(run([3500, 2800, 2900, 3400, 3500, 3500]).status, "triggered");
  assert.equal(run([3500, 3400, 3300, 3200, 3100, 3000]).status, "ok", "exactamente en el umbral no es «por debajo»");
  assert.equal(run([3500, 2800, 3400, 3500, 3500, 3500], 1).status, "triggered", "con 1 mes seguido basta un mes");
  const triggered = run([3500, 3400, 2800, 2500, 2400, 3200]);
  assert.equal(triggered.triggerMonth, "2027-01", "el mes de arranque es el primero de la racha");
  assert.equal(triggered.minLiquidity, 2400);
  assert.equal(triggered.margin, -600);
});

test("WP-38 · solo se mira el horizonte pedido: lo que pasa después no dispara", () => {
  const plan = planWith([{ kind: "pause-saving" }], { horizon: 3 });
  const result = E.evaluate({ plan, series: series([3500, 3500, 3500, 100, 100, 100]), ...ctx });
  assert.equal(result.status, "ok");
  assert.equal(result.horizonMonths, 3);
});

test("WP-38 · cada paso suma al anterior y el motor dice con cuál ya no salta", () => {
  const result = E.evaluate({ plan: standard(), series: series([3500, 3100, 2800, 2500, 2400, 3200]), ...ctx });
  assert.equal(result.status, "triggered");
  const [pausa, recorte, credito] = result.actions;
  assert.equal(pausa.adds, 900, "300 € x 3 meses de ahorro que no se hace");
  assert.equal(pausa.minAfter, 3100);
  assert.equal(pausa.resolves, true);
  assert.equal(result.resolvedAtStep, 1, "el primer paso ya basta");
  assert.equal(recorte.adds, 360, "20 % de 600 € x 3 meses");
  assert.equal(credito.adds, 2000);
  assert.ok(recorte.adds + pausa.adds + credito.adds === 3260 && recorte.minAfter >= pausa.minAfter && result.afterAll.minLiquidity >= recorte.minAfter, "los pasos se acumulan, nunca restan");
  assert.ok(credito.effectByMonth[2] === 2000 && result.actions.every((a) => a.effectByMonth.slice(0, 2).every((v) => v === 0)), "nada pasa antes del mes en que salta");
  assert.equal(result.afterAll.stillTriggered, false);
});

test("WP-38 · cuando los pasos no bastan lo dice, con lo que falta", () => {
  const plan = planWith([{ kind: "cut-discretionary", pct: 10, months: 1 }]);
  const result = E.evaluate({ plan, series: series([1000, 900, 800, 700, 600, 500]), ...ctx });
  assert.equal(result.status, "triggered");
  assert.equal(result.afterAll.stillTriggered, true);
  assert.ok(result.afterAll.short > 1000);
  assert.equal(result.resolvedAtStep, null);
});

test("WP-38 · el crédito no es dinero propio: se marca, tiene coste, se acota a la línea y avisa si va antes que lo propio", () => {
  const credito = E.evaluate({ plan: planWith([{ kind: "credit-line", amount: 9000 }, { kind: "pause-saving", months: 2 }]), series: series([2000, 2000, 2000, 2000, 2000, 2000]), ...ctx });
  assert.equal(credito.actions[0].ownMoney, false);
  assert.equal(credito.actions[0].adds, 5000, "la línea declarada es de 5.000 €: no cuenta 9.000");
  assert.match(credito.actions[0].note, /hay que devolverlo/);
  assert.equal(credito.actions[0].cost, 112.5, "5.000 € al 9 % durante 3 meses, interés simple");
  assert.match(credito.reasons.join(" "), /crédito antes de agotar lo propio/);
  const sinLinea = E.evaluate({ plan: planWith([{ kind: "credit-line", amount: 1000 }]), series: series([2000, 2000]), saving: flat(0), discretionary: flat(0) });
  assert.match(sinLinea.actions[0].note, /No hay línea de crédito declarada/);
  const bien = E.evaluate({ plan: standard(), series: series([2000, 2000, 2000, 2000, 2000, 2000]), ...ctx });
  assert.doesNotMatch(bien.reasons.join(" "), /crédito antes/, "en el orden bueno no avisa");
});

test("WP-38 · un dato ausente no es un cero: sin ahorro previsto el paso lo dice y no pretende aportar nada exacto", () => {
  const plan = planWith([{ kind: "pause-saving", months: 3 }, { kind: "cut-discretionary", pct: 20, months: 3 }]);
  const result = E.evaluate({ plan, series: series([3500, 3100, 2800, 2500, 2400, 3200]), discretionary: {}, saving: { "2027-01": 300 } });
  assert.equal(result.actions[0].incomplete, true);
  assert.equal(result.actions[1].incomplete, true);
  assert.equal(result.actions[1].adds, 0);
  assert.equal(result.actions[1].typicalPerMonth, null, "sin gasto variable no hay efecto típico");
  assert.match(result.reasons.join(" "), /falta el dato del mes/);
});

test("WP-38 · con el disparador sin saltar no se simula nada: solo el efecto típico mensual", () => {
  const result = E.evaluate({ plan: standard(), series: series([5000, 5000, 5000, 5000, 5000, 5000]), ...ctx });
  assert.equal(result.status, "ok");
  assert.equal(result.actions[0].typicalPerMonth, 300);
  assert.equal(result.actions[1].typicalPerMonth, 120);
  assert.equal(result.actions[0].adds, null);
  assert.equal(result.afterAll, null);
});

test("WP-38 · la firma: pide dos personas distintas y fecha; cambiar el plan después la invalida", () => {
  const plan = standard();
  assert.equal(E.signatureState(plan), "unsigned");
  assert.equal(E.sign(plan, { signers: ["Ana"], today: "2026-12-18" }).reason, "dos-firmas");
  assert.equal(E.sign(plan, { signers: ["Ana", "ana"], today: "2026-12-18" }).reason, "dos-firmas", "la misma persona dos veces no son dos firmas");
  assert.equal(E.sign(plan, { signers: ["Ana", "Luis"], today: "" }).reason, "sin-fecha");
  assert.equal(E.sign(planWith([]), { signers: ["Ana", "Luis"], today: "2026-12-18" }).reason, "incompleto");
  const firmado = E.sign(plan, { signers: ["Ana", "Luis"], today: "2026-12-18" });
  assert.equal(firmado.ok, true);
  assert.equal(E.signatureState(firmado.plan), "signed");
  const viaStore = E.normalizePlan(JSON.parse(JSON.stringify(firmado.plan)));
  assert.equal(E.signatureState(viaStore), "signed", "la firma sobrevive al almacén");
  const cambiado = E.normalizePlan({ ...viaStore, actions: viaStore.actions.map((a) => (a.kind === "cut-discretionary" ? { ...a, pct: 30 } : a)) });
  assert.equal(E.signatureState(cambiado), "changed");
  const reordenado = E.normalizePlan({ ...viaStore, actions: viaStore.actions.slice().reverse() });
  assert.equal(E.signatureState(reordenado), "changed", "el orden de los pasos forma parte de lo firmado");
  const evaluado = E.evaluate({ plan: cambiado, series: series([5000, 5000]), ...ctx });
  assert.match(evaluado.reasons.join(" "), /Se ha cambiado después de firmar/);
});

test("WP-38 · palanca de recorte (NPV-09): más recorte, más meses; sin gasto variable no hay palanca (no es «0 de recorte»)", () => {
  const lever = E.cutLeverage({ liquidity: 12000, floor: 4000, monthlyOutflow: 3000, discretionaryMonthly: 800 });
  assert.equal(lever.hasLever, true);
  assert.equal(lever.rows[0].pct, 0);
  assert.equal(lever.rows[0].monthsToZero, 4);
  assert.equal(lever.rows[0].monthsToFloor, 2.6);
  for (let i = 1; i < lever.rows.length; i += 1) assert.ok(lever.rows[i].monthsToZero >= lever.rows[i - 1].monthsToZero);
  assert.equal(lever.rows.at(-1).monthlySaved, 400, "50 % de 800 €");
  const sinGastoVariable = E.cutLeverage({ liquidity: 12000, floor: 4000, monthlyOutflow: 3000, discretionaryMonthly: null });
  assert.equal(sinGastoVariable.hasLever, false);
  assert.equal(sinGastoVariable.rows.length, 1, "solo la línea base, sin porcentajes inventados");
  assert.equal(E.cutLeverage({ liquidity: 12000, floor: 0, monthlyOutflow: 3000, discretionaryMonthly: 800 }).rows[0].monthsToFloor, null, "sin colchón no hay «hasta tocar el colchón»");
  assert.equal(E.cutLeverage({ liquidity: 5000, monthlyOutflow: 0 }).calculable, false);
  assert.equal(E.cutLeverage({ liquidity: 12000, floor: 0, monthlyOutflow: 500, discretionaryMonthly: 9999 }).discretionaryMonthly, 500, "el gasto variable no puede superar las salidas");
});

test("WP-38 · el motor es puro: sin DOM, red ni almacenamiento", () => {
  const source = read("canonical-contingency-plan.js");
  for (const forbidden of [/\bdocument\b/, /\bwindow\b/, /localStorage/, /sessionStorage/, /\bfetch\(/, /XMLHttpRequest/, /\bqs\(/]) assert.doesNotMatch(source.replace(/\/\/.*$/gm, ""), forbidden);
});

test("WP-38 · cableado: el almacén va en la copia, la tarjeta está en Plan › Previsión, no en Hoy, y no ejecuta nada", () => {
  const app = read("app.js");
  assert.match(app, /const BACKUP_LOCAL_STORES = \[[\s\S]*?"contingency-plan"/);
  assert.match(app, /globalThis\.renderPlanB\?\.\(globalThis\.FinanceCanonicalContingencyPlan\)/);
  const html = read("index.html");
  const prevision = html.slice(html.indexOf('data-plan-panel="prevision"'), html.indexOf('data-plan-panel="ahorro"'));
  assert.match(prevision, /id="planBCard"/);
  assert.match(html, /canonical-contingency-plan\.js\?v=\w+/);
  assert.match(html, /contingencia-ui\.js\?v=\w+/);
  assert.match(html, /contingencia\.css\?v=\w+/);
  for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) for (const asset of ["canonical-contingency-plan.js", "contingencia-ui.js", "contingencia.css"]) assert.ok(read(file).includes(asset), `${file} debe listar ${asset}`);
  const ui = read("contingencia-ui.js");
  assert.doesNotMatch(ui, /decisionInboxItems/, "Hoy sigue congelado hasta leer H-02: sin bandeja");
  assert.doesNotMatch(ui, /\bconfirm\(/, "lo reversible se deshace (WP-37), no se confirma");
  assert.match(ui, /showUndoToast\("Plan B borrado\."/);
});

test("WP-38 · pausar el ahorro NO sube la liquidez total si el ahorro se queda dentro de ella: solo cuenta si sale de la liquidez", () => {
  const dentro = planWith([{ kind: "pause-saving", months: 3 }]);
  const serie = series([3500, 3100, 2800, 2500, 2400, 3200]);
  const r = E.evaluate({ plan: dentro, series: serie, ...ctx });
  assert.equal(r.status, "triggered");
  assert.equal(r.actions[0].adds, 0, "mover dinero de la cuenta de ahorro a la corriente no cambia el total");
  assert.equal(r.actions[0].resolves, false);
  assert.equal(r.afterAll.stillTriggered, true);
  assert.match(r.actions[0].note, /No cambia la liquidez total/);
  assert.match(r.actions[0].note, /900/, "dice cuánto pasa a la cuenta corriente");
  assert.equal(r.actions[0].typicalPerMonth, null);
  const fuera = E.evaluate({ plan: planWith([{ kind: "pause-saving", months: 3, outside: true }]), series: serie, ...ctx });
  assert.equal(fuera.actions[0].adds, 900);
  assert.equal(fuera.actions[0].typicalPerMonth, 300);
  assert.notEqual(E.fingerprint(dentro), E.fingerprint(planWith([{ kind: "pause-saving", months: 3, outside: true }])), "cambiar de dónde sale el ahorro cambia lo firmado");
});
