const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-11 (NXP-05): campo de importe unificado, fase 1 (Registrar: saldos, reales y dato manual). Texto con
// teclado decimal en vez de `type="number"`, que en un iPhone en español no deja escribir «1.234,56», no pega
// «1.234,56 €» y suma céntimos con las flechas. El lector es PROPIO (ux-shell.js): el `parseAmount` general de
// app.js lee también tipos y años, donde «2.125» es 2,125 %, y no se toca. Regla que no puede romperse:
// vacío = sin dato (un real vacío usa el previsto); «0» = cero de verdad.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const shell = require("../ux-shell.js");

test("lector: como escribe y pega un hogar español (y lo que pega de una web en inglés)", () => {
  const cases = {
    "1.234,56": 1234.56, "1234,56": 1234.56, "1.234": 1234, "1.234.567": 1234567, "1.234.567,89": 1234567.89,
    "1 234,56 €": 1234.56, "1.234,56 €": 1234.56, "€ 45": 45, "45€": 45, "1 234,5": 1234.5,
    "12,5": 12.5, "12.5": 12.5, "12.50": 12.5, "1234.5": 1234.5, "12,": 12, "+5": 5,
    "-12,5": -12.5, "−12,5": -12.5, "12,5-": -12.5, "1,234.56": 1234.56, "1,234,567.89": 1234567.89,
    "0": 0, "0,00": 0, "-0": 0,
  };
  for (const [text, expected] of Object.entries(cases)) assert.equal(shell.parseAmountInput(text), expected, JSON.stringify(text));
});

test("lector: vacío o algo que no es un importe da null (nunca un 0 inventado)", () => {
  for (const text of ["", "   ", "abc", "doce", "1,2,3", "1.23.4", "12.", "--5", "1.234,", "1,234,5", "12,34.567", "1e3", "١٢"]) {
    assert.equal(shell.parseAmountInput(text), null, JSON.stringify(text));
  }
  assert.equal(shell.parseAmountInput(12.3), 12.3);
  assert.equal(shell.parseAmountInput(Number.NaN), null);
});

test("formato al salir del campo: separador de miles también en 4 cifras, dos decimales, signo menos", () => {
  assert.equal(shell.formatAmountInput(1234.5), "1.234,50");
  assert.equal(shell.formatAmountInput(1234567.891), "1.234.567,89");
  assert.equal(shell.formatAmountInput(45), "45,00");
  assert.equal(shell.formatAmountInput(-1234), "-1.234,00");
  assert.equal(shell.formatAmountInput(-0.001), "0,00");
  assert.equal(shell.formatAmountInput(0), "0,00");
  for (const empty of ["", null, undefined, "x"]) assert.equal(shell.formatAmountInput(empty), "");
  for (const value of [0, 0.5, 12.34, -99.9, 1234.56, 98765432.1]) assert.equal(shell.parseAmountInput(shell.formatAmountInput(value)), Math.round(value * 100) / 100, "ida y vuelta");
});

test("readAmountInput distingue vacío, cero e inválido", () => {
  assert.deepEqual(shell.readAmountInput({ value: "" }), { empty: true, value: null, invalid: false });
  assert.deepEqual(shell.readAmountInput({ value: "0" }), { empty: false, value: 0, invalid: false });
  assert.deepEqual(shell.readAmountInput({ value: "abc" }), { empty: false, value: null, invalid: true });
});

// Un DOM mínimo, suficiente para el campo, su mensaje de error y el botón de signo.
function fakeDocument() {
  const byId = new Map();
  const el = (tag, attrs = {}) => {
    const node = { tagName: tag, attributes: { ...attrs }, children: [], events: [], value: "", readOnly: false, disabled: false,
      get id() { return this.attributes.id || ""; }, set id(v) { this.attributes.id = v; byId.set(v, this); },
      setAttribute(n, v) { this.attributes[n] = String(v); if (n === "id") byId.set(v, this); }, getAttribute(n) { return this.attributes[n] ?? null; },
      removeAttribute(n) { delete this.attributes[n]; }, appendChild(child) { child.parentNode = this; this.children.push(child); if (child.id) byId.set(child.id, child); },
      remove() { this.parentNode.children = this.parentNode.children.filter((c) => c !== this); byId.delete(this.id); },
      dispatchEvent(event) { this.events.push(event.type); } };
    return node;
  };
  const doc = { createElement: (tag) => el(tag), getElementById: (id) => byId.get(id) || null, el };
  return doc;
}

test("al salir del campo: con formato si vale; si no, marcado y con el motivo a la vista, enlazado al campo", () => {
  const doc = fakeDocument();
  const cell = doc.el("td");
  const input = doc.el("input", { id: "saldo" });
  input.ownerDocument = doc;
  cell.appendChild(input);
  input.value = "1234,5";
  shell.normalizeAmountField(input);
  assert.equal(input.value, "1.234,50");
  input.value = "doce";
  shell.normalizeAmountField(input);
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.equal(input.getAttribute("aria-describedby"), "saldo-error");
  assert.equal(doc.getElementById("saldo-error").textContent, shell.AMOUNT_ERROR_TEXT);
  assert.equal(input.value, "doce", "no se borra lo escrito");
  input.value = "";
  shell.normalizeAmountField(input);
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(doc.getElementById("saldo-error"), null);
  assert.equal(input.value, "", "vacío se queda vacío, no pasa a 0,00");
});

test("WP-25: el aviso se quita al corregir (input), no al tocar el botón: así el botón no se mueve bajo el dedo", () => {
  const doc = fakeDocument();
  const listeners = {};
  Object.assign(doc, { addEventListener: (type, fn) => { listeners[type] = fn; } });
  shell.mountAmountInputs(doc);
  const cell = doc.el("div");
  const input = doc.el("input", { id: "importe" });
  Object.assign(input, { ownerDocument: doc, matches: (selector) => selector === "input[data-amount-input]" || (selector === "input[data-amount-input][aria-invalid]" && input.getAttribute("aria-invalid") !== null) });
  cell.appendChild(input);
  input.value = "abc";
  listeners.focusout({ target: input });
  assert.ok(doc.getElementById("importe-error"), "marcado al salir");
  input.value = "12,";
  listeners.input({ target: input });
  assert.equal(doc.getElementById("importe-error"), null, "al escribir algo válido el aviso se va ya");
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(input.value, "12,", "sin formatear a medio escribir");
  input.value = "1,2,3";
  listeners.input({ target: input });
  assert.equal(doc.getElementById("importe-error"), null, "escribir no marca: solo salir del campo");
});

test("signo «±»: cambia el signo y avisa como si se escribiera; no toca un campo de solo lectura, vacío o cero", () => {
  const input = { value: "1.234,00", readOnly: false, disabled: false, events: [], dispatchEvent(e) { this.events.push(e.type); } };
  global.Event = global.Event || class { constructor(type) { this.type = type; } };
  shell.toggleAmountSign(input);
  assert.equal(input.value, "-1.234,00");
  assert.deepEqual(input.events, ["input", "change"]);
  for (const other of [{ ...input, value: "5", readOnly: true, events: [] }, { ...input, value: "", events: [] }, { ...input, value: "0", events: [] }]) {
    const before = other.value;
    shell.toggleAmountSign(other);
    assert.equal(other.value, before);
    assert.deepEqual(other.events, []);
  }
});

// --- app.js: los lectores de Registrar usan el lector nuevo, y la regla vacío/cero sigue intacta -------------

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start > 0, name);
  return app.slice(start, app.indexOf("\n}\n", start) + 2);
}

function sandbox(names, extra) {
  const context = { parseAmountField: shell.parseAmountInput, ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("reales: «1.234,56 €» guarda 1234,56; «0» guarda 0; vacío borra (usa el previsto); un texto inválido no toca nada", () => {
  const actuals = { "x|2026-10": 42 };
  let renders = 0;
  const ctx = sandbox(["handleRegistrarActualsChange"], {
    registrarActualsSelectedMonth: () => ({ key: "2026-10" }), isClosedMonthKey: () => false, actualsForKind: () => actuals,
    saveActualsForKind: () => () => {}, render: () => { renders += 1; }, registrarRecordSessionChange: () => {},
  });
  const change = (value) => ctx.handleRegistrarActualsChange({ dataset: { registrarActualsKind: "expense", registrarActualsActual: "x|2026-10" }, value });
  change("1.234,56 €");
  assert.equal(actuals["x|2026-10"], 1234.56);
  change("1.234");
  assert.equal(actuals["x|2026-10"], 1234, "«1.234» son mil doscientos treinta y cuatro, no 1,23");
  change("abc");
  assert.equal(actuals["x|2026-10"], 1234);
  assert.equal(renders, 2, "un texto inválido ni guarda ni repinta (el aviso se queda a la vista)");
  change("0");
  assert.equal(actuals["x|2026-10"], 0);
  change("  ");
  assert.equal("x|2026-10" in actuals, false);
});

test("saldos: se copia el NÚMERO a los campos numéricos heredados (el texto «1.234,56» los dejaría vacíos = 0 €)", () => {
  const fields = { registrarCaixaBalance: { value: "1.234,56" }, registrarMediolanumBalance: { value: "4.200" }, visualCaixaBalance: { value: "" }, visualMediolanumBalance: { value: "" } };
  let applied = 0;
  const ctx = sandbox(["handleRegistrarAccountBalanceInput"], {
    state: {}, qs: (id) => fields[id] || null, accountBalancesFromState: () => ({}), applyVisualAccountBalanceInput: () => { applied += 1; },
    registrarRecordBalanceChanges: () => {}, resetRegistrarBalanceBaseline: () => {}, renderRegistrarImpactFooter: () => {},
  });
  ctx.handleRegistrarAccountBalanceInput();
  assert.deepEqual([fields.visualCaixaBalance.value, fields.visualMediolanumBalance.value, applied], ["1234.56", "4200", 1]);
  fields.registrarCaixaBalance.value = "doce";
  ctx.handleRegistrarAccountBalanceInput();
  assert.equal(applied, 1, "un saldo que no es importe no se aplica (antes habría pasado a 0 €)");
});

test("efectivo y dato manual leen con el lector nuevo; parseAmount general no cambia («2.125» sigue siendo 2,125)", () => {
  assert.match(extractFunction("handleRegistrarEfectivoBalanceInput"), /parseAmountField\(input\.value\)/);
  assert.match(extractFunction("handleManualData"), /planned: parseAmountField\(qs\("manualDataPlanned"\)\.value\) \?\? "",\s*actual: parseAmountField\(qs\("manualDataActual"\)\.value\) \?\? "",/);
  const ctx = sandbox(["parseAmount"], {});
  assert.equal(ctx.parseAmount("2.125"), 2.125);
});

test("marcado: los campos de Registrar son texto con teclado decimal, sin autocompletar, con nombre accesible; ± solo en las cuentas", () => {
  const registrar = html.slice(html.indexOf('id="registrar"'), html.indexOf("</section>", html.indexOf('id="registrar"')));
  for (const [id, label] of [["registrarCaixaBalance", "Saldo de CaixaBank"], ["registrarMediolanumBalance", "Saldo de Mediolanum"], ["registrarEfectivoBalance", "Efectivo"]]) {
    assert.match(registrar, new RegExp(`<input id="${id}" type="text" inputmode="decimal" autocomplete="off" data-amount-input aria-label="${label}" />`));
  }
  assert.match(registrar, /<input id="manualDataPlanned" type="text" inputmode="decimal" autocomplete="off" data-amount-input placeholder="0,00" \/>/);
  assert.match(registrar, /<input id="manualDataActual" type="text" inputmode="decimal" autocomplete="off" data-amount-input placeholder="0,00" \/>/);
  assert.equal((registrar.match(/data-amount-sign="/g) || []).length, 2, "el efectivo no puede ser negativo: sin botón de signo");
  assert.doesNotMatch(registrar.slice(0, registrar.indexOf("manualProjectDuration")), /type="number" step="0\.01"/);
  assert.match(extractFunction("registrarActualsRowHtml"), /<input type="text" inputmode="decimal" autocomplete="off" data-amount-input data-registrar-actuals-actual=/);
  assert.match(extractFunction("registrarActualsRowHtml"), /value="\$\{entry\.hasActual \? formatAmountField\(entry\.actual\) : ""\}"/);
});

test("estilos: 44 px de alto y 16 px de letra (el iPhone no amplía); en el móvil, saldos y reales apilados y pie compacto", () => {
  const css = read("styles.css");
  const tokens = read("design-tokens.css");
  assert.match(css, /input\[data-amount-input\] \{\s*min-height: 44px;\s*font-size: 16px;/);
  assert.match(css, /\.amount-sign \{\s*min-width: 44px;\s*min-height: 44px;/);
  assert.match(css, /@media \(max-width: 640px\) \{\s*\.account-balance-table thead/);
  assert.match(tokens, /\.e19-registrar \.registrar-actuals-table input\[data-amount-input\] \{/);
  assert.match(tokens, /\.e19-impact-bar\.e19-registrar-impact dl \{\s*display: none;/);
});

test("registro: el ayudante se monta solo al cargar ux-shell.js, antes que app.js", () => {
  assert.match(read("ux-shell.js"), /api\.mountAmountInputs\(document\);/);
  assert.ok(html.indexOf('src="ux-shell.js?v=') < html.indexOf('src="app.js?v='));
});
