const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-24 (HOG-02): asignación personal sin detalle. Una partida por persona («Asignación personal · Nombre») en
// Gastos variables, con id estable, que se paga por transferencia a una cuenta propia que la app no importa.
// Decisión del hogar (4/10/2026): el dinero SALE del gasto variable, así que el gasto total previsto no cambia;
// el «Gasto variable estimado» baja lo mismo, venga de la fórmula o de la cifra fijada a mano (la migración de
// junio lo fija a mano en toda la previsión, por eso el descuento va sobre el valor final y no en la fórmula).

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const allowance = require("../canonical-personal-allowance.js");
const plain = (value) => JSON.parse(JSON.stringify(value));

const JAVI = { id: "javi", name: "Javi", amount: 300, from: "2026-11", to: "" };
const TERE = { id: "tere", name: "Tere", amount: 250.5, from: "2026-11", to: "2027-01" };
const STORE = { people: [JAVI, TERE] };

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start > 0, name);
  return app.slice(start, app.indexOf("\n}\n", start) + 2);
}

function line(prefix) {
  const start = app.indexOf(prefix);
  assert.ok(start >= 0, prefix);
  return app.slice(start, app.indexOf("\n", start) + 1);
}

test("almacén: solo entra lo válido; dañado, sin nombre, importe ≤ 0, meses mal o ids repetidos, fuera", () => {
  assert.deepEqual(allowance.normalizeStore(null), { people: [] });
  assert.deepEqual(allowance.normalizeStore({ people: "x" }), { people: [] });
  const store = allowance.normalizeStore({
    people: [
      JAVI,
      { ...TERE },
      { ...JAVI, name: "Otro Javi" },
      { id: "a", name: "", amount: 10, from: "2026-11" },
      { id: "b", name: "B", amount: 0, from: "2026-11" },
      { id: "c", name: "C", amount: 10, from: "2026-13" },
      { id: "d", name: "D", amount: 10, from: "2026-11", to: "2026-10" },
      { id: "e", name: "<b>E</b>", amount: 10, from: "2026-11" },
      { id: "F mal", name: "F", amount: 10, from: "2026-11" },
    ],
  });
  assert.deepEqual(plain(store), { people: [JAVI, TERE] });
});

test("alta: id estable sacado del nombre (sin tildes), sin chocar; editar conserva el id; quitar", () => {
  let result = allowance.upsertPerson({ people: [] }, { name: "  José   María ", amount: 300, from: "2026-11", to: "" });
  assert.deepEqual(result.errors, {});
  assert.deepEqual(plain(result.person), { id: "jose-maria", name: "José María", amount: 300, from: "2026-11", to: "" });
  result = allowance.upsertPerson(result.store, { name: "Jose Maria", amount: 100, from: "2026-12" });
  assert.equal(result.person.id, "jose-maria-2", "dos nombres que dan el mismo id no se pisan");
  const edited = allowance.upsertPerson(result.store, { id: "jose-maria", name: "Chema", amount: 310.456, from: "2026-11", to: "2027-04" });
  assert.deepEqual(plain(edited.person), { id: "jose-maria", name: "Chema", amount: 310.46, from: "2026-11", to: "2027-04" });
  assert.equal(edited.store.people.length, 2);
  assert.deepEqual(plain(allowance.removePerson(edited.store, "jose-maria").people.map((person) => person.id)), ["jose-maria-2"]);
});

test("alta: lo que no vale vuelve como error por campo y el almacén no cambia", () => {
  const base = { people: [JAVI] };
  const errorsFor = (input) => allowance.upsertPerson(base, { from: "2026-11", amount: 100, name: "X", ...input });
  assert.deepEqual(Object.keys(errorsFor({ name: "" }).errors), ["name"]);
  assert.deepEqual(Object.keys(errorsFor({ name: "<script>" }).errors), ["name"]);
  assert.deepEqual(Object.keys(errorsFor({ name: "x".repeat(41) }).errors), ["name"]);
  assert.deepEqual(Object.keys(errorsFor({ amount: null }).errors), ["amount"], "texto que no es importe: la app lo pasa como null");
  assert.deepEqual(Object.keys(errorsFor({ amount: 0 }).errors), ["amount"]);
  assert.deepEqual(Object.keys(errorsFor({ amount: -20 }).errors), ["amount"]);
  assert.deepEqual(Object.keys(errorsFor({ amount: 100001 }).errors), ["amount"]);
  assert.deepEqual(Object.keys(errorsFor({ from: "" }).errors), ["from"]);
  assert.deepEqual(Object.keys(errorsFor({ to: "2026-10" }).errors), ["to"], "la última no puede ser anterior a la primera");
  assert.deepEqual(Object.keys(errorsFor({ id: "nadie" }).errors), ["name"], "editar a alguien que ya no está");
  const result = errorsFor({ amount: 0 });
  assert.equal(result.person, null);
  assert.deepEqual(plain(result.store), plain(base));
  const full = { people: Array.from({ length: allowance.MAX_PEOPLE }, (_, index) => ({ ...JAVI, id: `p${index}` })) };
  assert.deepEqual(Object.keys(allowance.upsertPerson(full, { name: "Una más", amount: 10, from: "2026-11" }).errors), ["name"]);
});

test("partidas del mes: solo en Gastos variables y solo en sus meses; id estable para día de cargo, regla y reales", () => {
  const rows = (monthKey, sectionName = "Gastos variables", kind = "expense") => allowance.rowsForMonth(STORE, { kind, sectionName, monthKey });
  assert.deepEqual(rows("2026-10"), []);
  assert.deepEqual(plain(rows("2026-11")), [
    { id: "personal-allowance-javi", personalAllowance: true, kind: "expense", sectionName: "Gastos variables", label: "Asignación personal · Javi", plannedValue: 300, monthKey: "2026-11" },
    { id: "personal-allowance-tere", personalAllowance: true, kind: "expense", sectionName: "Gastos variables", label: "Asignación personal · Tere", plannedValue: 250.5, monthKey: "2026-11" },
  ]);
  assert.deepEqual(rows("2027-02").map((row) => row.id), ["personal-allowance-javi"], "Tere termina en enero");
  assert.deepEqual(rows("2026-11", "Gastos fijos"), []);
  assert.deepEqual(rows("2026-11", "Gastos variables", "income"), []);
  assert.ok(rows("2026-11").every((row) => !row.custom), "no son partidas «custom»: esas viven una por mes en customPlanningRows");
  assert.deepEqual(allowance.seriesRows(STORE, "expense").map((row) => row.id), ["personal-allowance-javi", "personal-allowance-tere"]);
  assert.deepEqual(allowance.seriesRows(STORE, "income"), []);
  assert.equal(allowance.amountForMonth(STORE, "personal-allowance-tere", "2027-01"), 250.5);
  assert.equal(allowance.amountForMonth(STORE, "personal-allowance-tere", "2027-02"), 0);
  assert.equal(allowance.amountForMonth(STORE, "personal-allowance-nadie", "2026-11"), 0);
  assert.equal(allowance.totalForMonth(STORE, "2026-12"), 550.5);
  assert.equal(allowance.totalForMonth(STORE, "2026-10"), 0);
});

test("tarjeta: una ficha por persona y otra para añadir; nombre escapado; importe con el campo de WP-11", () => {
  const months = [{ key: "2026-10", label: "oct 26" }, { key: "2026-11", label: "nov 26" }];
  const empty = allowance.renderHtml({ people: [] }, { months, defaultFrom: "2026-11" });
  assert.equal((empty.match(/<form /g) || []).length, 1);
  assert.match(empty, /data-asignacion="nueva"/);
  assert.match(empty, /<option value="2026-11" selected>nov 26<\/option>/, "por defecto, el mes siguiente");
  assert.match(empty, /Sale del gasto variable/);
  assert.match(empty, /id="asignacionEstado" role="status"/);
  const out = allowance.renderHtml({ people: [JAVI] }, { months, formatAmount: (value) => `F${value}`, notes: ["Aviso <x>"] });
  assert.equal((out.match(/<form /g) || []).length, 2);
  assert.match(out, /name="amount" type="text" inputmode="decimal" autocomplete="off" data-amount-input value="F300"/);
  assert.match(out, /data-asignacion-quitar="javi"/);
  assert.match(out, /<label for="asignacion-0-nombre">/);
  assert.match(out, /Aviso &lt;x&gt;/);
  const full = { people: Array.from({ length: allowance.MAX_PEOPLE }, (_, index) => ({ ...JAVI, id: `p${index}` })) };
  assert.doesNotMatch(allowance.renderHtml(full, { months }), /data-asignacion="nueva"/, "con el máximo, sin ficha de alta");
  assert.equal(allowance.summaryText({ people: [] }), "Asignación personal: sin configurar");
  assert.equal(allowance.summaryText(STORE), "Asignación personal: Javi y Tere");
});

test("app.js: el gasto variable estimado baja lo que sumen las asignaciones, fijado a mano o por fórmula, nunca bajo 0", () => {
  const overrides = {};
  const context = {
    round2: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    isVariableOperationalRow: (row) => row.id === "variable-operational-spend",
    seriesOverrideForRow: (row, month) => overrides[`${row.id}|${month.key}`] || null,
    variableOperationalFormulaValue: () => 1270,
    plannedValueForRowRaw: (row) => row.plannedValue,
    personalAllowanceRows: (kind, sectionName, month) => allowance.rowsForMonth(STORE, { kind, sectionName, monthKey: month.key }),
    VARIABLE_OPERATIONAL_SECTION: "Gastos variables",
  };
  vm.runInNewContext(`${extractFunction("plannedValueForRow")}\n${line("function personalAllowanceTotal(")}\nthis.planned = plannedValueForRow;`, context);
  const variable = { id: "variable-operational-spend", kind: "expense" };
  assert.equal(context.planned(variable, { key: "2026-10" }), 1270, "sin asignaciones, igual que antes");
  assert.equal(context.planned(variable, { key: "2026-11" }), 719.5, "por fórmula: 1270 − 550,50");
  overrides["variable-operational-spend|2026-11"] = { planned: 1750 };
  assert.equal(context.planned(variable, { key: "2026-11" }), 1199.5, "fijado a mano (la migración de junio): 1750 − 550,50");
  overrides["variable-operational-spend|2026-11"] = { planned: 400 };
  assert.equal(context.planned(variable, { key: "2026-11" }), 0, "si no da, se queda en 0 (la tarjeta lo avisa)");
  overrides["variable-operational-spend|2026-11"] = { deleted: true };
  assert.equal(context.planned(variable, { key: "2026-11" }), 0);
});

test("app.js: el previsto de la partida es el de la persona ese mes; las borradas en Partidas no cuentan", () => {
  const context = {
    FinanceCanonicalPersonalAllowance: allowance, // globalThis del contexto, como en el navegador
    loadPersonalAllowances: () => STORE,
    sourcePlanningMonthForMonth: () => { throw new Error("una asignación no lee el plan base"); },
    isPlanningRowDeleted: (row, month) => row.id === "personal-allowance-tere" && month.key === "2026-12",
  };
  vm.runInNewContext(`${extractFunction("basePlannedValueForRow")}\n${line("function personalAllowanceRows(")}\nthis.base = basePlannedValueForRow; this.rows = personalAllowanceRows;`, context);
  assert.equal(context.base({ id: "personal-allowance-javi", personalAllowance: true }, { key: "2026-10" }), 0);
  assert.equal(context.base({ id: "personal-allowance-javi", personalAllowance: true }, { key: "2026-11" }), 300);
  assert.deepEqual(context.rows("expense", "Gastos variables", { key: "2026-12" }).map((row) => row.id), ["personal-allowance-javi"]);
});

test("app.js: las partidas entran en el plan del mes, en las listas de partidas y en el editor; el almacén va en la copia y la firma", () => {
  assert.match(app, /\.concat\(customRowsForSection\(section\.kind, section\.name, month\), personalAllowanceRows\(section\.kind, section\.name, month\)\);/);
  assert.match(extractFunction("availableSeriesRows"), /FinanceCanonicalPersonalAllowance\?\.seriesRows\(loadPersonalAllowances\(\), kind\)/);
  assert.match(extractFunction("visualRowsForSection"), /FinanceCanonicalPersonalAllowance\?\.seriesRows\(loadPersonalAllowances\(\), section\.kind\)/);
  assert.match(extractFunction("basePlannedValueForRow"), /if \(row\.personalAllowance\) return globalThis\.FinanceCanonicalPersonalAllowance\?\.amountForMonth/);
  assert.match(app, /"personal-allowances", \/\/ WP-24/);
  assert.match(extractFunction("modelComputationSignature"), /personalAllowances: loadPersonalAllowances\(\)\.people/);
  assert.match(app, /renderChargeDays\(\);\n\s+renderPersonalAllowances\(\);/);
  assert.match(app, /\["submit", "click"\]\.forEach\(\(type\) => qs\("asignacionPersonal"\)\?\.addEventListener\(type, handlePersonalAllowanceEvent\)\);/);
  assert.match(extractFunction("variableOperationalFormulaValue"), /return round2\(Math\.max\(0, VARIABLE_OPERATIONAL_FORMULA_TARGET - subscriptions - financing\)\);/, "la fórmula no se toca: el descuento va sobre el valor final");
});

test("registro: tarjeta plegada en Plan › Partidas antes de Días de cargo; motor y pantalla antes de app.js, offline y publicados", () => {
  const partidas = html.slice(html.indexOf('id="planificacion-partidas"'), html.indexOf('id="planificacionPartidasRoot"'));
  assert.match(partidas, /<details class="e19-card prevision-calidad-card asignacion-card" id="asignacionCard">\s*<summary id="asignacionResumen">[^<]+<\/summary>\s*<div id="asignacionPersonal"><\/div>\s*<\/details>\s*<details class="e19-card prevision-calidad-card cargo-dia-card" id="cargoDiaCard">/);
  ["canonical-personal-allowance.js", "partidas-ui.js"].forEach((file) => {
    const at = html.indexOf(`<script defer src="${file}?v=`);
    assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js?v='), file);
    assert.match(read("service-worker.js"), new RegExp(`"\\./${file.replace(/\./g, "\\.")}",`));
    assert.match(read("tools/build-public-site.mjs"), new RegExp(`"${file.replace(/\./g, "\\.")}",`));
  });
  const ui = read("partidas-ui.js");
  ["renderChargeDays", "saveChargeDays", "handleChargeDayEvent", "renderPersonalAllowances", "savePersonalAllowances", "handlePersonalAllowanceEvent"].forEach((name) => {
    assert.match(ui, new RegExp(`function ${name}\\(`), name);
    assert.doesNotMatch(app, new RegExp(`function ${name}\\(`), `${name} vive en partidas-ui.js, no en app.js`);
  });
  assert.match(ui, /showUndoToast\(/, "quitar se puede deshacer");
  assert.match(ui, /parseAmountField\(amountText\)/, "el importe se lee como en Registrar (WP-11)");
});

test("el módulo es puro: sin DOM ni estado de la app", () => {
  assert.doesNotMatch(read("canonical-personal-allowance.js"), /\bwindow\b|\bdocument\b|\bbaseData\b|\blocalStorage\b|\bstate\./);
});
