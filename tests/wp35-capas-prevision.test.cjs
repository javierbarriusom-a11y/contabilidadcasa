const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const root = path.resolve(__dirname, "..");
const layers = require("../canonical-forecast-layers.js");

// WP-35 (PRV-02 + PRV-04, docs/WP35_DISENO.md): la previsión de un mes en tres capas y los ingresos con certeza. Motor puro y su tarjeta en Plan › Previsión. Los datos son inventados.

const nbsp = " ";
const expense = (key, section, used, extra = {}) => ({ key, kind: "expense", label: extra.label || key, section, used, settled: extra.settled ?? true });
const income = (key, used, extra = {}) => ({ key, kind: "income", label: extra.label || key, section: "Ingresos", used, settled: extra.settled ?? true });

const MONTH = [
  income("income:nomina", 3000, { label: "Nómina" }),
  income("income:local", 800, { label: "Alquiler del local" }),
  expense("expense:hipoteca", "Gastos fijos", 900, { label: "Hipoteca" }),
  expense("expense:luz", "Gastos fijos", 80, { label: "Luz" }),
  expense("expense:cuota", "Financiaciones", 220, { label: "Cuota del coche" }),
  expense("expense:super", "Gastos variables", 700, { label: "Supermercado" }),
  expense("expense:ocio", "Gastos variables", 150, { label: "Ocio" }),
];

// ---- El motor --------------------------------------------------------------------------------------------------------------------------

test("la capa se SUGIERE por el bloque de la partida y lo que no se reconoce cae en «probable»", () => {
  assert.equal(layers.defaultLayer("Gastos fijos"), "comprometida");
  assert.equal(layers.defaultLayer("Financiaciones"), "comprometida");
  assert.equal(layers.defaultLayer("Deuda"), "comprometida");
  assert.equal(layers.defaultLayer("Gastos variables"), "probable");
  assert.equal(layers.defaultLayer("Sección rara"), "probable", "ni seguro ni decidible: probable");
  assert.equal(layers.defaultLayer(""), "probable");
});

test("la lectura de un mes reparte las salidas en tres capas con lo que declara el hogar y cuenta cuántas son sugeridas", () => {
  const store = layers.setLayer(layers.setLayer(null, "expense:ocio", "discrecional"), "expense:luz", "probable");
  const reading = layers.buildReading({ monthKey: "2026-10", partidas: MONTH, store });
  const by = Object.fromEntries(reading.layers.map((layer) => [layer.id, layer]));
  assert.equal(by.comprometida.amount, 1120, "hipoteca 900 + cuota 220 (la luz la declaró probable)");
  assert.equal(by.probable.amount, 780, "súper 700 + luz 80");
  assert.equal(by.discrecional.amount, 150);
  assert.equal(reading.outflows, 2050);
  assert.deepEqual(by.comprometida.items.map((item) => item.label), ["Hipoteca", "Cuota del coche"], "de más a menos");
  assert.equal(reading.suggested, 3, "hipoteca, cuota y súper por su bloque; luz y ocio, declaradas");
  assert.equal(by.discrecional.items[0].declared, true);
  assert.equal(by.comprometida.items[0].declared, false);
  assert.deepEqual(reading.layers.map((layer) => layer.id), ["comprometida", "probable", "discrecional"]);
  assert.equal(reading.count, 7);
  assert.equal(reading.withReal, 7);
});

test("los ingresos con certeza: sin declarar son «confirmado» (lo de siempre); con probabilidad dan el esperado y tres márgenes", () => {
  const plain = layers.buildReading({ monthKey: "2026-10", partidas: MONTH });
  assert.equal(plain.incomes.confirmed, 3800);
  assert.equal(plain.incomes.hasUncertain, false);
  assert.deepEqual(plain.margin, { confirmed: 1750, expected: 1750, all: 1750 }, "activar esto no cambia nada hasta que se declara");
  const store = layers.setIncome(null, "income:local", "incierto", 50);
  const reading = layers.buildReading({ monthKey: "2026-10", partidas: MONTH, store });
  assert.equal(reading.incomes.confirmed, 3000);
  assert.equal(reading.incomes.expected, 3400, "3.000 + 800 × 50 %");
  assert.equal(reading.incomes.all, 3800);
  assert.equal(reading.incomes.uncertain, 800);
  assert.equal(reading.incomes.hasUncertain, true);
  assert.deepEqual(reading.margin, { confirmed: 950, expected: 1350, all: 1750 }, "3.000 − 2.050, 3.400 − 2.050 y 3.800 − 2.050");
});

test("las frases, a la española y con el signo dicho con palabras", () => {
  const store = layers.setIncome(null, "income:local", "incierto", 50);
  const phrases = layers.sentences(layers.buildReading({ monthKey: "2026-10", partidas: MONTH, store }));
  assert.deepEqual(phrases, [
    `En octubre: comprometido 1.200${nbsp}€; probable 850${nbsp}€; discrecional 0${nbsp}€.`,
    `Con los ingresos confirmados (3.000${nbsp}€) queda un margen de 950${nbsp}€.`,
    `Hay 800${nbsp}€ de ingresos que no son seguros: contando su probabilidad queda un margen de 1.350${nbsp}€, y si llegara todo, queda un margen de 1.750${nbsp}€.`,
  ]);
  assert.equal(layers.sentences(layers.buildReading({ monthKey: "2026-10", partidas: MONTH })).length, 2, "sin ingresos inciertos no hay tercera frase");
});

test("la banda de lo probable sale de lo que se desvió en meses cerrados: con ≥ 3 meses; sin ellos NO hay banda", () => {
  assert.deepEqual(layers.probableBand([40, -20]), { calculable: false, months: 2, need: 3 });
  assert.deepEqual(layers.probableBand([]), { calculable: false, months: 0, need: 3 });
  const band = layers.probableBand([100, 100, 100]);
  assert.deepEqual(band, { calculable: true, months: 3, spread: 0, bias: 100 }, "siempre +100: sesgo, no incertidumbre");
  const spread = layers.probableBand([50, -50, 50, -50]);
  assert.equal(spread.spread, 50);
  assert.equal(spread.bias, 0);
  assert.equal(layers.probableBand(["x", null, 10, 20, 30]).months, 3, "lo que no es un número no cuenta");
  const withBand = layers.buildReading({ monthKey: "2026-10", partidas: MONTH, gaps: [50, -50, 50, -50] });
  assert.equal(withBand.band.spread, 50);
  assert.equal(layers.sentences(withBand)[0], `En octubre: comprometido 1.200${nbsp}€; probable 850${nbsp}€ (± 50${nbsp}€ según los meses cerrados); discrecional 0${nbsp}€.`);
  const noProbable = layers.buildReading({ monthKey: "2026-10", partidas: [income("i", 100), expense("e", "Gastos fijos", 50)], gaps: [1, 2, 3] });
  assert.equal(noProbable.band.calculable, false, "sin partidas probables no hay banda que medir");
});

test("el déficit, el cero y el margen se dicen con palabras", () => {
  const phrase = (partidas) => layers.sentences(layers.buildReading({ monthKey: "2026-03", partidas }))[1];
  assert.equal(phrase([income("i", 1000), expense("e", "Gastos fijos", 1000)]), `Con los ingresos confirmados (1.000${nbsp}€) queda justo a cero.`);
  assert.equal(phrase([income("i", 1000), expense("e", "Gastos fijos", 1400)]), `Con los ingresos confirmados (1.000${nbsp}€) faltan 400${nbsp}€.`);
  assert.equal(phrase([income("i", 1500), expense("e", "Gastos fijos", 1400)]), `Con los ingresos confirmados (1.500${nbsp}€) queda un margen de 100${nbsp}€.`);
});

test("lo declarado se normaliza: capas válidas, certeza solo probable/incierto con probabilidad entre 1 y 99", () => {
  const store = layers.normalizeStore({ layers: { a: "comprometida", b: "inventada", "": "probable" }, incomes: { x: { level: "incierto", probability: 250 }, y: { level: "probable" }, z: { level: "confirmado", probability: 10 }, w: null } });
  assert.deepEqual(store.layers, { a: "comprometida" });
  assert.deepEqual(store.incomes, { x: { level: "incierto", probability: 99 }, y: { level: "probable", probability: 80 } });
  assert.equal(layers.normalizeStore({ incomes: { v: { level: "incierto", probability: 0 } } }).incomes.v.probability, 1);
  assert.deepEqual(layers.normalizeStore("basura").layers, {});
  assert.deepEqual(layers.normalizeStore(null).incomes, {});
  // «Confirmado» y una capa inválida QUITAN la declaración: vuelve a lo sugerido / a lo de siempre.
  let edited = layers.setIncome(null, "income:local", "probable", 70);
  assert.deepEqual(layers.certaintyOf(edited, "income:local"), { level: "probable", probability: 70, declared: true });
  edited = layers.setIncome(edited, "income:local", "confirmado", 70);
  assert.deepEqual(layers.certaintyOf(edited, "income:local"), { level: "confirmado", probability: 100, declared: false });
  edited = layers.setLayer(layers.setLayer(null, "expense:ocio", "discrecional"), "expense:ocio", "auto");
  assert.deepEqual(edited.layers, {});
  assert.deepEqual(layers.setLayer(null, "", "probable").layers, {});
  const many = Object.fromEntries(Array.from({ length: 400 }, (_, index) => [`k${index}`, "probable"]));
  assert.equal(Object.keys(layers.normalizeStore({ layers: many }).layers).length, layers.MAX_ENTRIES);
});

test("el chip de certeza dice el nivel y la probabilidad", () => {
  assert.equal(layers.chipText({ level: "confirmado", probability: 100 }), "Confirmado");
  assert.equal(layers.chipText({ level: "probable", probability: 80 }), "Probable 80 %");
  assert.equal(layers.chipText({ level: "incierto", probability: 50 }), "Incierto 50 %");
});

test("sin partidas con importe, o sin mes, no hay lectura; las partidas a cero no cuentan; el orden de entrada no importa", () => {
  assert.equal(layers.buildReading({ monthKey: "", partidas: MONTH }).calculable, false);
  assert.match(layers.buildReading({ monthKey: "2026-13", partidas: MONTH }).reason, /Falta el mes/);
  assert.equal(layers.buildReading({ monthKey: "2026-10", partidas: [expense("z", "Gastos fijos", 0)] }).calculable, false);
  assert.deepEqual(layers.sentences({ calculable: false }), []);
  assert.equal(layers.buildReading({ monthKey: "2026-10", partidas: [...MONTH, expense("zero", "Gastos fijos", 0)] }).count, 7);
  assert.deepEqual(layers.buildReading({ monthKey: "2026-10", partidas: MONTH }), layers.buildReading({ monthKey: "2026-10", partidas: [...MONTH].reverse() }));
  assert.equal(layers.buildReading({ monthKey: "2026-10", partidas: [{ key: "x", kind: "otro", used: 5 }, null, { used: 3 }] }).calculable, false);
});

test("el motor es puro: sin DOM, sin red, sin almacenamiento y sin reloj", () => {
  const source = fs.readFileSync(path.join(root, "canonical-forecast-layers.js"), "utf8");
  for (const forbidden of [/\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bfetch\s*\(/, /\bnavigator\b/, /Date\.now\s*\(/, /new Date\s*\(\s*\)/, /Math\.random\s*\(/]) assert.doesNotMatch(source, forbidden, `el motor no debe usar ${forbidden}`);
});

// ---- La pantalla (capas-ui.js), en un entorno aislado ----------------------------------------------------------------------------------

const uiSource = fs.readFileSync(path.join(root, "capas-ui.js"), "utf8");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const plain = (value) => JSON.parse(JSON.stringify(value));

// Una partida como la devuelve planMesCollect.
const entry = (kind, id, label, sectionName, planned, usado, hasActual = false) => ({ key: `${kind}:${id}`, row: { id }, label, sectionName, kind, planned, usado, hasActual });

const PLAN_MONTHS = {
  "2026-07": [entry("expense", "super", "Súper", "Gastos variables", 600, 650, true), entry("income", "nomina", "Nómina", "Ingresos", 3000, 3000, true)],
  "2026-08": [entry("expense", "super", "Súper", "Gastos variables", 600, 560, true), entry("income", "nomina", "Nómina", "Ingresos", 3000, 3000, true)],
  "2026-09": [entry("expense", "super", "Súper", "Gastos variables", 600, 700, true), entry("income", "nomina", "Nómina", "Ingresos", 3000, 3000, true)],
  "2026-10": [
    entry("income", "nomina", "Nómina", "Ingresos", 3000, 3000), entry("income", "local", "Alquiler <b>", "Ingresos", 800, 800),
    entry("expense", "hipoteca", "Hipoteca", "Gastos fijos", 900, 900), entry("expense", "super", "Súper", "Gastos variables", 600, 600, false),
  ],
};

function uiSandbox({ months = PLAN_MONTHS, stored = null, today = "2026-10-12", open = true } = {}) {
  const storage = stored ? { "forecast-layers-data:demo": JSON.stringify(stored) } : {};
  const card = { open, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } };
  const body = { innerHTML: "", __cpHtml: undefined, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, querySelectorAll: () => [] };
  const calls = { remote: 0, announced: [] };
  const list = Object.keys(months).map((key) => ({ key }));
  const context = {
    Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, console, Boolean,
    globalThis: null,
    FinanceCanonicalForecastLayers: layers,
    storageKey: (name) => `${name}:demo`,
    storageGet: (key, fallback) => (key in storage ? storage[key] : fallback),
    storageSet: (key, value) => { storage[key] = value; },
    queueRemoteSave: () => { calls.remote += 1; },
    announceStatus: (message) => calls.announced.push(message),
    openMonthCutoffKey: () => today.slice(0, 7),
    cuadroMandosAllMonths: () => list,
    planMesCollect: (month) => ({ income: months[month.key].filter((item) => item.kind === "income"), expense: months[month.key].filter((item) => item.kind === "expense") }),
    actualAwareInfo: () => ({ status: "pending" }),
    registrarMesLongMonth: (key) => `mes ${key}`,
    money: (value) => `${Number(value).toFixed(2).replace(".", ",")} €`,
    escapeHtml,
    qs: (id) => ({ capasCard: card, capas: body }[id] || null),
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(uiSource, context);
  const change = (dataset, value) => context.handleCapasChange({ target: { closest: () => ({ dataset, value }) } });
  return { context, storage, card, body, calls, change, state: () => vm.runInContext("capasState", context) };
}

test("pantalla: cargar el script no toca el DOM ni la red", () => {
  assert.doesNotThrow(() => uiSandbox());
  assert.doesNotMatch(uiSource, /document\.|fetch\(|XMLHttpRequest/);
});

test("pantalla: cerrada no calcula nada; abierta pinta la lectura del mes en curso con su barra, su leyenda y el aviso de que todo es lo previsto", () => {
  const closed = uiSandbox({ open: false });
  closed.context.renderCapasPrevision(layers);
  assert.equal(closed.body.innerHTML, "");
  const { context, body } = uiSandbox();
  context.renderCapasPrevision(layers);
  assert.match(body.innerHTML, /<option value="2026-10" selected>mes 2026-10<\/option>/);
  assert.match(body.innerHTML, /En octubre: comprometido 900 €; probable 600 € \(± 51 € según los meses cerrados\); discrecional 0 €\./);
  assert.match(body.innerHTML, /Con los ingresos confirmados \(3\.800 €\) queda un margen de 2\.300 €\./);
  assert.match(body.innerHTML, /<div class="cp-barra" role="img" aria-label="En octubre: comprometido/);
  assert.equal((body.innerHTML.match(/class="cp-seg /g) || []).length, 2, "solo las capas con importe dibujan tramo");
  assert.match(body.innerHTML, /cp-seg cp-comprometida" style="flex-grow:900"/);
  assert.match(body.innerHTML, /cp-seg cp-probable" style="flex-grow:600"/);
  assert.match(body.innerHTML, /Ninguna de las 4 partidas de este mes tiene real anotado: todo lo que ves es <strong>lo previsto<\/strong>\./);
  assert.doesNotMatch(body.innerHTML, /Sin banda para lo probable/, "con 3 meses cerrados con real ya hay banda");
});

test("pantalla: con meses cerrados con real, la banda sale de lo que se desvió (julio +50, agosto −40, septiembre +100)", () => {
  const { context, body } = uiSandbox();
  context.renderCapasPrevision(layers);
  const gaps = plain(context.capasGaps(layers.normalizeStore(null), "2026-10"));
  assert.deepEqual(gaps, [50, -40, 100]);
  assert.match(body.innerHTML, /probable 600 € \(± 51 € según los meses cerrados\)/);
  assert.match(body.innerHTML, /\(3 meses cerrados\)/);
  assert.doesNotMatch(body.innerHTML, /Sin banda para lo probable/);
  // Si el hogar declara el súper como discrecional, deja de contar en lo probable y desaparecen las desviaciones.
  const declared = uiSandbox({ stored: { layers: { "expense:super": "discrecional" } } });
  assert.deepEqual(plain(declared.context.capasGaps(layers.normalizeStore({ layers: { "expense:super": "discrecional" } }), "2026-10")), []);
});

test("pantalla: el nombre de una partida se escapa y la certeza de un ingreso se ve con su chip", () => {
  const { context, body } = uiSandbox({ stored: { incomes: { "income:local": { level: "incierto", probability: 40 } } } });
  context.renderCapasPrevision(layers);
  assert.doesNotMatch(body.innerHTML, /<b>/);
  assert.match(body.innerHTML, /Alquiler &lt;b&gt;/);
  assert.match(body.innerHTML, /<span class="cp-chip cp-nivel-incierto">Incierto 40 %<\/span>/);
  assert.match(body.innerHTML, /value="40" data-capa-prob="income:local"/);
  assert.match(body.innerHTML, /Hay 800 € de ingresos que no son seguros/);
  assert.match(body.innerHTML, /<span class="cp-chip cp-nivel-confirmado">Confirmado<\/span>/);
  assert.equal((body.innerHTML.match(/data-capa-prob=/g) || []).length, 1, "solo los no confirmados piden probabilidad");
});

test("pantalla: cambiar la certeza, la probabilidad y la capa guarda al momento y avisa; «Confirmado» y la capa sugerida quitan lo declarado", () => {
  const { context, storage, change, body, calls } = uiSandbox();
  context.renderCapasPrevision(layers);
  change({ capaNivel: "income:local" }, "probable");
  assert.deepEqual(JSON.parse(storage["forecast-layers-data:demo"]).incomes, { "income:local": { level: "probable", probability: 80 } }, "la probabilidad por defecto de «probable» es 80 %");
  assert.match(body.innerHTML, /Probable 80 %/);
  assert.match(calls.announced.at(-1), /Certeza del ingreso guardada/);
  change({ capaProb: "income:local" }, "65");
  assert.equal(JSON.parse(storage["forecast-layers-data:demo"]).incomes["income:local"].probability, 65);
  change({ capaProb: "income:local" }, "500");
  assert.equal(JSON.parse(storage["forecast-layers-data:demo"]).incomes["income:local"].probability, 99, "tope 99");
  change({ capaNivel: "income:local" }, "incierto");
  assert.deepEqual(JSON.parse(storage["forecast-layers-data:demo"]).incomes["income:local"], { level: "incierto", probability: 99 }, "al cambiar de nivel se conserva la probabilidad que había");
  change({ capaNivel: "income:local" }, "confirmado");
  assert.deepEqual(JSON.parse(storage["forecast-layers-data:demo"]).incomes, {});
  assert.match(calls.announced.at(-1), /Ingreso confirmado: cuenta como seguro, como siempre/);
  change({ capaLayer: "expense:hipoteca" }, "discrecional");
  assert.deepEqual(JSON.parse(storage["forecast-layers-data:demo"]).layers, { "expense:hipoteca": "discrecional" });
  assert.match(body.innerHTML, /discrecional 900 €/);
  change({ capaLayer: "expense:hipoteca" }, "auto");
  assert.deepEqual(JSON.parse(storage["forecast-layers-data:demo"]).layers, {});
  assert.ok(calls.remote >= 6, "cada cambio pide guardar en la nube");
});

test("pantalla: cambiar de mes repinta ese mes; un mes sin partidas lo dice; el foco vuelve al control que se tocó", () => {
  const { context, change, body, state } = uiSandbox();
  context.renderCapasPrevision(layers);
  change({ capaMes: "" }, "2026-09");
  assert.equal(state().monthKey, "2026-09");
  assert.match(body.innerHTML, /En septiembre: comprometido 0 €; probable 700 €/);
  assert.match(body.innerHTML, /<option value="2026-09" selected>/);
  const empty = uiSandbox({ months: { "2026-10": [] } });
  empty.context.renderCapasPrevision(layers);
  assert.match(empty.body.innerHTML, /no tiene partidas con importe/);
  const focused = [];
  const withFocus = uiSandbox();
  withFocus.body.querySelectorAll = () => [{ dataset: { capaNivel: "income:local" }, focus: () => focused.push("nivel") }, { dataset: { capaLayer: "expense:hipoteca" }, focus: () => focused.push("capa") }];
  withFocus.context.renderCapasPrevision(layers);
  withFocus.change({ capaLayer: "expense:hipoteca" }, "probable");
  assert.deepEqual(focused, ["capa"]);
});

// ---- El cableado -----------------------------------------------------------------------------------------------------------------------

test("cableado: se pinta con Previsión, se guarda en la copia y se registra en la app y en el sitio publicado", () => {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const app = codigoApp();
  assert.match(app, /globalThis\.renderCapasPrevision\?\.\(globalThis\.FinanceCanonicalForecastLayers\)/);
  assert.match(app.slice(app.indexOf("const BACKUP_LOCAL_STORES"), app.indexOf("];", app.indexOf("const BACKUP_LOCAL_STORES"))), /"forecast-layers-data"/);
  const html = read("index.html");
  assert.ok(html.indexOf('<script defer src="canonical-forecast-layers.js') < html.indexOf('<script defer src="capas-ui.js'), "el motor antes que la pantalla");
  assert.match(html, /<link rel="stylesheet" href="capas\.css\?v=/);
  assert.match(html, /<details class="[^"]*capas-card" id="capasCard">\s*<summary id="capasResumen">[\s\S]*?<div id="capas"><\/div>/);
  for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) {
    const source = read(file);
    for (const name of ["canonical-forecast-layers.js", "capas-ui.js", "capas.css"]) assert.ok(source.includes(`"${name}"`) || source.includes(`"./${name}"`), `${file} registra ${name}`);
  }
  assert.match(read("novedades.js"), /2026-10-12-wp35/);
});
