const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// WP-02 (NXP-01 + PRV-06 + UXS-05, BACKLOG_DEFINITIVO.md §5.1): prueba cronometrada de Hoy. Un
// instrumento de medida para un solo usuario: segundos hasta tener la cifra de «Disponible para
// gastar», abriendo desde el icono y con saldos del día (GOV-05), sin guardar nunca un importe. El
// texto B («≈ X €/día hasta cobrar») existe, pero «alternar por semanas» no arranca hasta tener la
// línea base con el texto A (decisión del hogar del 3/10/2026: con n = 1 es preferencia, no resultado).

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const engine = require("../canonical-finding-test.js");

test("lee importes tecleados en formato español", () => {
  const cases = [
    ["8.310", 8310], ["8310,50", 8310.5], ["8 310 €", 8310], ["1.234,5", 1234.5], ["1,234.5", 1234.5],
    ["12.5", 12.5], ["≈ 85 €/día", 85], ["-40", -40], ["1.234.567", 1234567], ["abc", null], ["", null], [null, null],
  ];
  for (const [text, expected] of cases) assert.equal(engine.parseTypedAmount(text), expected, String(text));
});

test("«misma cifra» admite un euro de redondeo y nada más", () => {
  assert.equal(engine.sameFigure("8.310", 8310.4), true);
  assert.equal(engine.sameFigure("8311", 8310), true);
  assert.equal(engine.sameFigure("8312", 8310), false);
  assert.equal(engine.sameFigure("", 8310), false);
  assert.equal(engine.sameFigure("8310", null), false);
});

test("GOV-05: solo cuentan los saldos tecleados de hoy o de ayer", () => {
  assert.deepEqual(engine.attemptValidity({ balanceMode: "manual", ageDays: 0, figureAvailable: true }), { valid: true, reason: "" });
  assert.equal(engine.attemptValidity({ balanceMode: "manual", ageDays: 1, figureAvailable: true }).valid, true);
  assert.equal(engine.attemptValidity({ balanceMode: "manual", ageDays: 2, figureAvailable: true }).reason, "saldos de hace 2 días");
  assert.match(engine.attemptValidity({ balanceMode: "auto", ageDays: 0, figureAvailable: true }).reason, /calculados por calendario/, "por calendario no son saldos del banco");
  assert.equal(engine.attemptValidity({ balanceMode: "manual", ageDays: null, figureAvailable: true }).reason, "saldos sin fecha");
  assert.equal(engine.attemptValidity({ balanceMode: "manual", ageDays: -1, figureAvailable: true }).valid, false);
  assert.equal(engine.attemptValidity({ balanceMode: "manual", ageDays: 0, figureAvailable: false }).reason, "Hoy no tenía cifra que leer");
});

test("un intento guardado no lleva ningún importe", () => {
  const attempt = engine.buildAttempt({ at: "2026-10-05T08:00:00Z", elapsedMs: 12345, typed: "8.310", shown: 8310, variant: "A", balanceMode: "manual", ageDays: 0, trigger: "vuelta", fromIcon: true, version: "9d64a55" });
  assert.deepEqual(attempt, {
    at: "2026-10-05T08:00:00Z", seconds: 12.3, matched: true, valid: true, reason: "", variant: "A",
    ageDays: 0, balanceMode: "manual", trigger: "vuelta", fromIcon: true, version: "9d64a55",
  });
  assert.doesNotMatch(JSON.stringify(attempt), /8310|8\.310/);
  const noTime = engine.buildAttempt({ elapsedMs: null, typed: "1", shown: 1, balanceMode: "manual", ageDays: 0 });
  assert.equal(noTime.valid, false);
  assert.equal(noTime.reason, "sin tiempo medido");
  assert.equal(engine.buildAttempt({ elapsedMs: 1000, typed: "", shown: null, ageDays: 0 }).reason, "Hoy no tenía cifra que leer");
});

test("la línea base son 3 intentos válidos con el texto A; la mediana ignora los que no cuentan", () => {
  const make = (seconds, extra = {}) => engine.buildAttempt({ elapsedMs: seconds * 1000, typed: "10", shown: 10, balanceMode: "manual", ageDays: 0, variant: "A", ...extra });
  let attempts = [make(20), make(9), make(40, { ageDays: 5 })];
  let summary = engine.summarize(attempts);
  assert.equal(summary.baselineReady, false);
  assert.equal(summary.A.valid, 2);
  assert.equal(summary.A.medianSeconds, 14.5);
  attempts = engine.addAttempt(attempts, make(12));
  summary = engine.summarize(attempts);
  assert.equal(summary.baselineReady, true);
  assert.equal(summary.A.medianSeconds, 12);
  assert.equal(summary.meetsTarget, true, "objetivo ≤ 15 s");
  assert.equal(summary.A.matched, 3);
  attempts = engine.addAttempt(attempts, make(30, { variant: "B" }));
  assert.equal(engine.summarize(attempts).B.valid, 1, "B se cuenta aparte");
  assert.equal(engine.summarize(attempts).A.valid, 3);
  assert.equal(engine.median([]), null);
});

test("se guardan como mucho 30 intentos", () => {
  let attempts = [];
  for (let i = 0; i < 35; i += 1) attempts = engine.addAttempt(attempts, { at: String(i) });
  assert.equal(attempts.length, 30);
  assert.equal(attempts[0].at, "5");
});

test("el texto del titular: A por defecto; «alternar» espera a la línea base y luego va por semanas ISO", () => {
  assert.equal(engine.headlineVariant({}).variant, "A");
  assert.equal(engine.headlineVariant({ mode: "B" }).variant, "B");
  const waiting = engine.headlineVariant({ mode: "alternar", today: "2026-10-05", baselineReady: false });
  assert.equal(waiting.variant, "A");
  assert.match(waiting.reason, /3 intentos válidos/);
  assert.equal(engine.isoWeek("2026-10-05"), 41);
  assert.equal(engine.isoWeek("2027-01-01"), 53, "el 1/1/2027 es viernes: semana 53 de 2026");
  assert.equal(engine.headlineVariant({ mode: "alternar", today: "2026-10-05", baselineReady: true }).variant, "B");
  assert.equal(engine.headlineVariant({ mode: "alternar", today: "2026-10-12", baselineReady: true }).variant, "A");
});

test("€/día hasta cobrar: sin días o sin margen positivo no hay cifra honesta", () => {
  assert.equal(engine.perDayUntilPayday({ spendable: 850, days: 10 }), 85);
  assert.equal(engine.perDayUntilPayday({ spendable: 859, days: 10 }), 85, "redondea hacia abajo");
  assert.equal(engine.perDayUntilPayday({ spendable: 850, days: 0 }), 850, "día de cobro: no divide por cero");
  assert.equal(engine.perDayUntilPayday({ spendable: 850, days: null }), null);
  assert.equal(engine.perDayUntilPayday({ spendable: -10, days: 5 }), null);
  assert.equal(engine.perDayUntilPayday({ spendable: 0, days: 5 }), null);
});

test("el almacén se normaliza aunque llegue roto", () => {
  assert.deepEqual(engine.normalizeStore(null), { armed: false, armedAt: "", mode: "A", attempts: [] });
  assert.deepEqual(engine.normalizeStore({ armed: 1, mode: "X", attempts: [null, { at: "a" }] }), { armed: true, armedAt: "", mode: "A", attempts: [{ at: "a" }] });
});

test("app.js solo engancha Hoy: calcula el texto B con el motor y anota la cifra pintada", () => {
  const app = read("app.js");
  const tile = app.slice(app.indexOf("function homeMarginTile("), app.indexOf("function renderHomeBudgetGlance("));
  assert.match(tile, /label: "Disponible para gastar"/, "el texto A sigue siendo el titular por defecto");
  assert.match(tile, /FinanceFindingTestUi\?\.variantToday\(\) === "B"/);
  assert.match(tile, /FinanceCanonicalFindingTest\?\.perDayUntilPayday\(/);
  assert.equal((tile.match(/FinanceFindingTestUi\?\.noteShown\(/g) || []).length, 2, "con cifra y sin cifra");
});

test("marcado: tarjeta en Ajustes › Uso de la app, barra fuera de Hoy y scripts antes que la app", () => {
  const html = read("index.html");
  const uso = html.slice(html.indexOf('id="ajustes-uso-app"'), html.indexOf('id="ajustes-operacion"'));
  for (const id of ["pruebaHoyCard", "pruebaHoyEstado", "pruebaHoyPreparar", "pruebaHoyResumen", "pruebaHoyModoNota", "pruebaHoyIntentos"]) assert.match(uso, new RegExp(`id="${id}"`));
  assert.equal((uso.match(/name="pruebaHoyModo"/g) || []).length, 3);
  const home = html.slice(html.indexOf('id="home"'), html.indexOf("</section>", html.indexOf('id="home"')));
  assert.doesNotMatch(home, /findingTest/);
  assert.match(html, /<div class="finding-test-bar" id="findingTestBar" role="status" aria-live="polite" hidden>/);
  const main = html.indexOf('<script defer src="app.js?v=');
  assert.ok(html.indexOf('src="canonical-finding-test.js?v=') > 0 && html.indexOf('src="canonical-finding-test.js?v=') < main);
  assert.ok(html.indexOf('src="finding-test-ui.js?v=') > 0 && html.indexOf('src="finding-test-ui.js?v=') < main);
});

// --- Controlador del navegador, con un DOM mínimo simulado ---------------------------------------

function fakeElement(extra = {}) {
  const listeners = {};
  return {
    hidden: false, textContent: "", innerHTML: "", value: "", checked: false, dataset: {}, listeners,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    fire(type, event = { preventDefault() {} }) { for (const fn of listeners[type] || []) fn(event); },
    focus() {},
    ...extra,
  };
}

function setupBrowser() {
  const ids = ["findingTestBar", "findingTestMessage", "findingTestFound", "findingTestForm", "findingTestInput", "findingTestCancel",
    "pruebaHoyEstado", "pruebaHoyPreparar", "pruebaHoyResumen", "pruebaHoyModoNota", "pruebaHoyIntentos"];
  const elements = Object.fromEntries(ids.map((id) => [id, fakeElement()]));
  elements.findingTestBar.hidden = true;
  const radios = ["A", "B", "alternar"].map((value) => fakeElement({ value }));
  const docListeners = {};
  const store = {};
  let clock = 0;
  const saved = {};
  const globals = {
    document: {
      readyState: "complete",
      visibilityState: "visible",
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => radios,
      addEventListener(type, fn) { (docListeners[type] ||= []).push(fn); },
    },
    localStorage: { getItem: (key) => store[key] ?? null, setItem: (key, value) => { store[key] = String(value); } },
    location: { hash: "#ajustes" },
    matchMedia: () => ({ matches: true }),
    setTimeout: () => {},
    addEventListener: () => {},
  };
  for (const [key, value] of Object.entries(globals)) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const perf = Object.getOwnPropertyDescriptor(globalThis, "performance");
  Object.defineProperty(globalThis, "performance", { value: { now: () => clock }, configurable: true, writable: true });
  saved.performance = perf;
  delete require.cache[require.resolve("../finding-test-ui.js")];
  const ui = require("../finding-test-ui.js"); // se monta solo: hay document y ya está cargado
  const restore = () => {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    delete globalThis.FinanceFindingTestUi;
  };
  const visibility = (state) => {
    globals.document.visibilityState = state;
    for (const fn of docListeners.visibilitychange || []) fn();
  };
  return { ui, elements, radios, store, restore, visibility, tick: (ms) => { clock += ms; }, location: globals.location };
}

test("preparar y volver a la app cronometra desde que vuelve a primer plano, va a Hoy y no guarda el importe", () => {
  const browser = setupBrowser();
  try {
    const { ui, elements, store, visibility, tick, location } = browser;
    assert.equal(elements.pruebaHoyEstado.textContent, "Sin prueba preparada.");
    elements.pruebaHoyPreparar.fire("click");
    assert.match(elements.pruebaHoyEstado.textContent, /Prueba preparada/);
    tick(5000);
    visibility("visible");
    assert.equal(elements.findingTestBar.hidden, true, "volver sin haber salido no arranca la prueba");
    visibility("hidden");
    tick(60000);
    visibility("visible");
    assert.equal(elements.findingTestBar.hidden, false);
    assert.equal(location.hash, "#home", "la prueba empieza en Hoy");
    assert.equal(JSON.parse(store["finding-test"]).armed, false, "una preparación, un intento");
    ui.noteShown({ variant: "A", value: 8310.42, ageDays: 0, balanceMode: "manual" });
    tick(11000);
    elements.findingTestFound.fire("click");
    assert.equal(elements.findingTestForm.hidden, false);
    tick(20000); // teclear no cuenta
    elements.findingTestInput.value = "8.310";
    elements.findingTestForm.fire("submit");
    const saved = JSON.parse(store["finding-test"]);
    assert.equal(saved.attempts.length, 1);
    assert.equal(saved.attempts[0].seconds, 11);
    assert.equal(saved.attempts[0].matched, true);
    assert.equal(saved.attempts[0].valid, true);
    assert.equal(saved.attempts[0].trigger, "vuelta");
    assert.equal(saved.attempts[0].fromIcon, true);
    assert.doesNotMatch(store["finding-test"], /8310|8\.310/, "ningún importe en el almacén");
    assert.match(elements.findingTestMessage.textContent, /^11 s · misma cifra\.$/);
    assert.match(elements.pruebaHoyResumen.textContent, /1 de 3 intentos válidos/);
    assert.match(elements.pruebaHoyIntentos.innerHTML, /<td>11 s<\/td><td>Sí<\/td><td>A<\/td><td>Cuenta<\/td><td>Icono<\/td>/);
  } finally {
    browser.restore();
  }
});

test("con saldos calculados por calendario el intento se guarda pero no cuenta", () => {
  const browser = setupBrowser();
  try {
    const { ui, elements, store, visibility, tick } = browser;
    elements.pruebaHoyPreparar.fire("click");
    visibility("hidden");
    visibility("visible");
    ui.noteShown({ variant: "A", value: 500, ageDays: 0, balanceMode: "auto" });
    tick(4000);
    elements.findingTestFound.fire("click");
    elements.findingTestInput.value = "500";
    elements.findingTestForm.fire("submit");
    const [attempt] = JSON.parse(store["finding-test"]).attempts;
    assert.equal(attempt.valid, false);
    assert.match(elements.findingTestMessage.textContent, /no cuenta: saldos calculados por calendario/);
  } finally {
    browser.restore();
  }
});

test("cancelar no guarda nada; elegir B cambia el texto que pide Hoy", () => {
  const browser = setupBrowser();
  try {
    const { ui, elements, radios, store, visibility } = browser;
    elements.pruebaHoyPreparar.fire("click");
    visibility("hidden");
    visibility("visible");
    elements.findingTestCancel.fire("click");
    assert.equal(elements.findingTestBar.hidden, true);
    assert.equal(JSON.parse(store["finding-test"]).attempts.length, 0);
    assert.equal(ui.variantToday(), "A");
    radios[1].fire("change");
    assert.equal(ui.variantToday(), "B");
    assert.match(elements.pruebaHoyModoNota.textContent, /texto B/);
    radios[2].fire("change");
    assert.equal(ui.variantToday(), "A", "alternar espera a la línea base");
    assert.match(elements.pruebaHoyModoNota.textContent, /3 intentos válidos/);
  } finally {
    browser.restore();
  }
});
