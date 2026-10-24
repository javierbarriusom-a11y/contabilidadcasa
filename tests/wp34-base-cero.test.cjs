const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const root = path.resolve(__dirname, "..");
const zero = require("../canonical-zero-base.js");

// WP-34 (PRV-08, docs/WP34_DISENO.md): la revisión base cero del plan. Motor puro (cola, evidencia, propuesta y marca «revisada») y su pantalla en Plan › Partidas. Los datos son inventados.

const WINDOW = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
const FUTURE = ["2027-01", "2027-02", "2027-03", "2027-04"];
const flat = (value) => Object.fromEntries(FUTURE.map((month) => [month, value]));
const reals = (values) => Object.fromEntries(values.map((value, index) => [WINDOW[index], value]).filter(([, value]) => value !== undefined));
const partida = (key, extra = {}) => ({ key, kind: "expense", label: key, section: "Sección", planned: flat(100), real: {}, ...extra });
const model = (partidas, store = null, today = "2027-01-12") => zero.buildModel({ partidas, store, today, windowMonths: WINDOW, futureMonths: FUTURE });
const item = (result, key) => result.items.find((entry) => entry.key === key);

// ---- El motor --------------------------------------------------------------------------------------------------------------------------

test("la propuesta de ajuste es la MEDIANA de lo real, redondeada al euro, con ≥ 3 meses con real y un hueco que importe", () => {
  const result = model([
    partida("super", { planned: flat(600), real: reals([742.4, 700, 690, 2500, 710, 705]) }), // un mes raro (2.500 €) no manda
    partida("poco", { planned: flat(100), real: reals([300, 310]) }),
    partida("cerca", { planned: flat(100), real: reals([104, 98, 105, 101]) }),
    partida("sinreal", { planned: flat(100) }),
  ]);
  assert.deepEqual(item(result, "super").suggestion, { type: "ajustar", amount: 708, gap: 108, gapPct: 18 }, "mediana (742,4 · 700 · 690 · 2500 · 710 · 705 → 707,5 → 708), no la media");
  assert.equal(item(result, "super").evidence.mean > 1000, true, "la media sí la arrastra el mes raro");
  assert.match(item(result, "poco").suggestion.why, /Solo 2 meses con real: hacen falta 3/);
  assert.equal(item(result, "poco").suggestion.type, null);
  assert.match(item(result, "cerca").suggestion.why, /Ya está en línea con lo real/);
  assert.match(item(result, "sinreal").suggestion.why, /Sin reales anotados en los últimos 6 meses/);
  // El hueco mínimo: 10 € y 10 %.
  assert.equal(model([partida("a", { planned: flat(1000), real: reals([1080, 1090, 1085]) })]).items[0].suggestion.type, null, "8,5 %: no llega al 10 %");
  assert.equal(model([partida("a", { planned: flat(50), real: reals([56, 55, 57]) })]).items[0].suggestion.type, null, "6 €: no llega a 10 €");
  assert.equal(model([partida("a", { planned: flat(50), real: reals([65, 66, 64]) })]).items[0].suggestion.amount, 65);
  // Un real de 0 es un real (se anotó que no pasó nada): cuenta.
  assert.equal(model([partida("a", { planned: flat(80), real: reals([0, 0, 0, 0]) })]).items[0].suggestion.amount, 0);
});

test("una partida que cambia de un mes a otro no se aplana a un solo importe", () => {
  const annual = partida("seguro", { planned: { "2027-01": 0, "2027-02": 0, "2027-03": 600, "2027-04": 0 }, real: reals([0, 0, 0, 0, 0, 0]) });
  const result = model([annual]);
  assert.equal(item(result, "seguro").plannedFlat, false);
  assert.equal(item(result, "seguro").suggestion.type, null);
  assert.match(item(result, "seguro").suggestion.why, /cambia de un mes a otro.*pago anual/);
  // Si la partida solo existe en algunos meses (los suyos), solo cuentan esos.
  const own = partida("curso", { planned: { "2027-02": 90, "2027-03": 90 }, futureMonths: ["2027-02", "2027-03"], real: reals([120, 118, 122]) });
  assert.equal(item(model([own]), "curso").plannedFlat, true);
  assert.equal(item(model([own]), "curso").suggestion.amount, 120);
});

test("una partida cuyo importe lo manda otra cosa solo se puede marcar como revisada, y se dice quién la manda", () => {
  const result = model([partida("deuda", { locked: "sigue el calendario de su contrato de deuda", real: reals([300, 300, 300, 300]), planned: flat(180) })]);
  const entry = item(result, "deuda");
  assert.equal(entry.suggestion.type, null);
  assert.match(entry.suggestion.why, /Su importe lo manda otra cosa: sigue el calendario de su contrato de deuda\. Solo se puede marcar como revisada\./);
  assert.equal(entry.flag, null, "tampoco se pregunta si sigue existiendo");
});

test("«¿sigue existiendo?» solo con evidencia: sin ningún real en ≥ 3 meses en los que el hogar SÍ anotó otras partidas", () => {
  const withReals = model([partida("a", { real: reals([100, 100, 100, 100]) }), partida("fantasma", { planned: flat(40) })]);
  assert.equal(withReals.coveredMonths, 4);
  assert.match(item(withReals, "fantasma").flag.text, /No tiene ningún real en 4 meses en los que sí anotaste otras partidas: ¿sigue existiendo\?/);
  // Si el hogar no anota reales, una partida sin real no es «sospechosa»: no se sabe.
  const none = model([partida("a"), partida("fantasma")]);
  assert.equal(none.coveredMonths, 0);
  assert.equal(item(none, "fantasma").flag, null);
  // Con solo 2 meses cubiertos tampoco.
  assert.equal(item(model([partida("a", { real: reals([100, 100]) }), partida("fantasma")]), "fantasma").flag, null);
  // Una partida con algún real no se marca, ni una con previsto 0.
  assert.equal(item(model([partida("a", { real: reals([100, 100, 100, 100]) }), partida("b", { real: reals([undefined, 5]) })]), "b").flag, null);
  assert.equal(item(withReals, "a").flag, null);
});

test("la cola: lo pendiente primero y lo más pesado antes; las revisadas al final; las que no tienen nada que revisar, aparte", () => {
  const partidas = [partida("pequeña", { planned: flat(10) }), partida("grande", { planned: flat(900) }), partida("media", { planned: flat(200) }), partida("vacia", { planned: flat(0) }), partida("conreal", { planned: flat(0), real: reals([30]) })];
  const store = zero.decide(null, "grande", "mantener", { today: "2026-12-01" });
  const result = model(partidas, store);
  assert.deepEqual(result.items.map((entry) => entry.key), ["media", "pequeña", "conreal", "grande"]);
  assert.equal(result.items.at(-1).key, "grande");
  assert.equal(result.items.at(-1).state, "revisada");
  assert.equal(result.dormant, 1, "«vacia» no tiene previsto ni real");
  assert.equal(result.items.some((entry) => entry.key === "vacia"), false);
  assert.deepEqual(result.progress, { total: 4, reviewed: 1, pending: 3, due: 0 });
  // Desempate por nombre, no por el orden de entrada.
  const a = model([partida("b", { label: "Beta" }), partida("a", { label: "Alfa" })]);
  const b = model([partida("a", { label: "Alfa" }), partida("b", { label: "Beta" })]);
  assert.deepEqual(a.items.map((entry) => entry.key), b.items.map((entry) => entry.key));
});

test("la marca «revisada (fecha)»: vale un año, luego «toca»; decidir, repetir y quitar la marca", () => {
  let store = zero.decide(null, "a", "ajustar", { today: "2026-01-12", from: 100, to: 150 });
  assert.deepEqual(store.reviews.a, { decision: "ajustar", reviewedAt: "2026-01-12", from: 100, to: 150 });
  assert.equal(zero.reviewState(store.reviews.a, "2026-12-31"), "revisada");
  assert.equal(zero.reviewState(store.reviews.a, "2027-01-12"), "revisada", "365 días exactos todavía vale");
  assert.equal(zero.reviewState(store.reviews.a, "2027-01-13"), "toca");
  assert.equal(zero.reviewState(null, "2027-01-13"), "pendiente");
  const result = model([partida("a")], store, "2027-02-01");
  assert.equal(result.items[0].state, "toca");
  assert.equal(result.progress.due, 1);
  assert.equal(result.progress.reviewed, 0);
  store = zero.decide(store, "a", "mantener", { today: "2027-02-01", from: 5, to: 6 });
  assert.deepEqual(store.reviews.a, { decision: "mantener", reviewedAt: "2027-02-01", from: null, to: null }, "from/to solo se guardan al ajustar");
  assert.deepEqual(zero.clear(store, "a").reviews, {});
  assert.deepEqual(zero.clear(store, "no-existe").reviews, store.reviews);
  // Entradas inválidas no cambian nada.
  assert.deepEqual(zero.decide(store, "a", "borrar", { today: "2027-02-01" }), store);
  assert.deepEqual(zero.decide(store, "", "mantener", { today: "2027-02-01" }), store);
  assert.deepEqual(zero.decide(store, "b", "mantener", { today: "mañana" }), store);
});

test("el almacén se normaliza: descarta lo que no es una marca y no pasa de 400", () => {
  assert.deepEqual(zero.normalizeStore(null).reviews, {});
  assert.deepEqual(zero.normalizeStore("basura").reviews, {});
  const raw = { reviews: { ok: { decision: "mantener", reviewedAt: "2026-05-01" }, mala: { decision: "borrar", reviewedAt: "2026-05-01" }, sinfecha: { decision: "mantener", reviewedAt: "ayer" }, nula: null, "": { decision: "mantener", reviewedAt: "2026-05-01" } } };
  assert.deepEqual(Object.keys(zero.normalizeStore(raw).reviews), ["ok"]);
  const many = { reviews: Object.fromEntries(Array.from({ length: 450 }, (_, index) => [`p${index}`, { decision: "mantener", reviewedAt: `2026-${String((index % 12) + 1).padStart(2, "0")}-15` }])) };
  assert.equal(Object.keys(zero.normalizeStore(many).reviews).length, zero.MAX_REVIEWS);
});

test("la evidencia en una frase y el resumen de avance; sin fecha de hoy no hay modelo", () => {
  const result = model([partida("super", { planned: flat(600), real: reals([742.4, 700, 690, 710]) }), partida("b", { planned: flat(50) })]);
  assert.equal(zero.evidenceText(item(result, "super")), "4 de los últimos 6 meses con real: mediana de 705 € al mes, entre 690 € y 742 €. Lo previsto hoy: 600 € al mes.");
  assert.equal(zero.evidenceText(item(result, "b")), "Sin reales anotados en los últimos 6 meses.");
  assert.equal(zero.summaryText(result), "Revisión base cero del plan: 0 de 2 partidas revisadas");
  const done = model([partida("a")], zero.decide(null, "a", "mantener", { today: "2027-01-01" }));
  assert.equal(zero.summaryText(done), "Revisión base cero del plan: las 1 partidas revisadas");
  assert.equal(zero.summaryText(model([])), "Revisión base cero del plan: no hay partidas");
  assert.equal(zero.summaryText(null), "Revisión base cero del plan");
  assert.equal(zero.buildModel({ partidas: [partida("a")], today: "" }).calculable, false);
  assert.equal(zero.buildModel({}).calculable, false);
});

test("es determinista y el motor es puro: sin DOM, sin red, sin almacenamiento y sin reloj", () => {
  const partidas = [partida("a", { real: reals([1, 2, 3, 4]), planned: flat(7) }), partida("b", { planned: flat(70) })];
  assert.deepEqual(model(partidas), model([...partidas].reverse()));
  const source = fs.readFileSync(path.join(root, "canonical-zero-base.js"), "utf8");
  for (const forbidden of [/\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bfetch\s*\(/, /\bnavigator\b/, /Date\.now\s*\(/, /new Date\s*\(\s*\)/, /Math\.random\s*\(/]) assert.doesNotMatch(source, forbidden, `el motor no debe usar ${forbidden}`);
});

// ---- La pantalla (base-cero-ui.js), en un entorno aislado ------------------------------------------------------------------------------

const uiSource = fs.readFileSync(path.join(root, "base-cero-ui.js"), "utf8");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const plain = (value) => JSON.parse(JSON.stringify(value));

// Un plan de juguete: julio-diciembre 2026 ya pasado (reales) y 2027 por venir. `rows` = { key: { kind, label, section, planned, real:{mes:valor}, ...extra } }.
function uiSandbox({ rows = {}, store = null, drafts = {}, today = "2027-01-12", cards = [] } = {}) {
  const storage = store ? { "zero-base-data:demo": JSON.stringify(store) } : {};
  const months = [...WINDOW, ...FUTURE].map((key) => ({ key }));
  const card = { open: true, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } };
  const body = { innerHTML: "", __bcHtml: undefined, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, querySelector: () => ({ focus() {} }) };
  const summary = { textContent: "" };
  const calls = { staged: [], deletes: [], saved: 0, discarded: 0, announced: [], rendered: 0, remote: 0 };
  const rowOf = (key) => rows[key];
  const context = {
    Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, console, Boolean,
    globalThis: null,
    FinanceCanonicalZeroBase: zero,
    applicationRenderRevision: 1,
    storageKey: (name) => `${name}:demo`,
    storageGet: (key, fallback) => (key in storage ? storage[key] : fallback),
    storageSet: (key, value) => { storage[key] = value; },
    queueRemoteSave: () => { calls.remote += 1; },
    announceStatus: (message) => calls.announced.push(message),
    isoLocalDate: () => today,
    openMonthCutoffKey: () => today.slice(0, 7),
    isClosedMonthKey: (key) => key < today.slice(0, 7),
    cuadroMandosAllMonths: () => months,
    planningSectionsForMonth: (kind, month) => {
      const list = Object.entries(rows).filter(([, row]) => row.kind === kind && (month.key < "2027-01" || !row.endsBefore || month.key < row.endsBefore)).map(([key, row]) => ({ id: key, kind, ...row }));
      return list.length ? [{ name: "Sección", kind, rows: list }] : [];
    },
    seriesKeyForRow: (row) => row.id,
    displayLabelForRow: (row) => row.label,
    actualAwareInfo: (row, month) => {
      const real = rowOf(row.id).real?.[month.key];
      return { hasActual: real !== undefined, actual: real, status: rowOf(row.id).cancelled?.includes(month.key) ? "cancelled" : "realized" };
    },
    plannedValueForRow: (row, month) => (Array.isArray(row.planned) ? 0 : Number(row.planned?.[month.key] ?? row.planned ?? 0)),
    isVariableOperationalRow: (row) => Boolean(row.variable),
    adjustedDebtPlannedValue: (row) => (row.debt ? 180 : null),
    loadCardCycles: () => ({ cards }),
    cuadroMandosStageCell: (key, monthKey, value) => { calls.staged.push([key, monthKey, value]); context.visualDraftCells[`${key}|${monthKey}`] = { rowKey: key, monthKey, value }; return { removed: false }; },
    handlePartidasDeleteRow: (key) => { calls.deletes.push(key); context.visualDraftDeletes[key] = { rowKey: key }; },
    handlePartidasSave: () => { calls.saved += 1; context.visualDraftCells = {}; context.visualDraftDeletes = {}; },
    handlePartidasDiscard: () => { calls.discarded += 1; context.visualDraftCells = {}; context.visualDraftDeletes = {}; },
    renderPartidasGestionBlocks: () => { calls.rendered += 1; },
    visualDraftCells: { ...drafts },
    visualDraftDeletes: {},
    visualPendingCounts: () => ({ cells: Object.keys(context.visualDraftCells).length, deletes: Object.keys(context.visualDraftDeletes).length, labels: 0 }),
    ledgerMonthLabel: (key) => `mes ${key}`,
    formatIsoDate: (iso) => iso.split("-").reverse().join("/"),
    money: (value) => `${Number(value).toFixed(2).replace(".", ",")} €`,
    escapeHtml,
    qs: (id) => ({ baseCeroCard: card, baseCero: body, baseCeroResumen: summary }[id] || null),
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(uiSource, context);
  return { context, storage, card, body, summary, calls, state: () => vm.runInContext("baseCeroState", context), click: (action, key = "") => context.handleBaseCeroClick({ target: { closest: () => ({ dataset: { bc: action, bcKey: key } }) } }) };
}

const PLAN = {
  "expense|super": { kind: "expense", label: "Súper <b>", planned: 600, real: { "2026-07": 700, "2026-08": 710, "2026-09": 690, "2026-10": 720 } },
  "expense|luz": { kind: "expense", label: "Luz", planned: 90, real: { "2026-10": 88 } },
  "expense|gimnasio": { kind: "expense", label: "Gimnasio", planned: 45 },
  "expense|variable": { kind: "expense", label: "Gasto variable", planned: 1750, variable: true },
  "expense|cuota": { kind: "expense", label: "Cuota", planned: 180, debt: true, real: { "2026-10": 180, "2026-11": 180, "2026-12": 180 } },
  "income|nomina": { kind: "income", label: "Nómina", planned: 3000, real: { "2026-10": 3000, "2026-11": 3000, "2026-12": 3010 } },
  "expense|vacia": { kind: "expense", label: "Vacía", planned: 0 },
};

test("pantalla: cargar el script no toca el DOM ni la red y no deja nada en marcha", () => {
  assert.doesNotThrow(() => uiSandbox());
  assert.doesNotMatch(uiSource, /document\.|fetch\(|XMLHttpRequest/);
});

test("pantalla: se recogen las partidas con su previsto futuro y su real pasado; las bloqueadas, con su motivo; las que ya no existen, fuera", () => {
  const { context } = uiSandbox({ rows: PLAN, cards: [{ rowKey: "expense|luz" }] });
  const collected = plain(context.baseCeroCollect());
  assert.deepEqual(collected.windowMonths, WINDOW);
  assert.deepEqual(collected.futureMonths, FUTURE);
  const by = Object.fromEntries(collected.partidas.map((entry) => [entry.key, entry]));
  assert.equal(by["expense|variable"].locked, "se calcula con la fórmula del gasto variable");
  assert.equal(by["expense|cuota"].locked, "sigue el calendario de su contrato de deuda");
  assert.equal(by["expense|luz"].locked, "se liquida con una tarjeta: lo manda su cargo");
  assert.equal(by["expense|super"].locked, "");
  assert.deepEqual(by["expense|super"].real, { "2026-07": 700, "2026-08": 710, "2026-09": 690, "2026-10": 720 });
  assert.deepEqual(by["expense|super"].futureMonths, FUTURE);
  assert.equal(by["expense|super"].planned["2027-02"], 600);
  const ended = plain(uiSandbox({ rows: { "expense|viejo": { kind: "expense", label: "Viejo", planned: 50, endsBefore: "2027-01" } } }).context.baseCeroCollect());
  assert.deepEqual(ended.partidas, [], "sin ningún mes por venir no entra");
  // Un real cancelado no cuenta como real.
  const cancelled = plain(uiSandbox({ rows: { "expense|a": { kind: "expense", label: "A", planned: 10, real: { "2026-10": 5, "2026-11": 7 }, cancelled: ["2026-11"] } } }).context.baseCeroCollect());
  assert.deepEqual(cancelled.partidas[0].real, { "2026-10": 5 });
});

test("pantalla: cerrada, solo el resumen; abierta, UNA partida con su evidencia, escapada, y las acciones que le tocan", () => {
  const closed = uiSandbox({ rows: PLAN });
  closed.card.open = false;
  closed.context.renderBaseCero(zero);
  assert.match(closed.summary.textContent, /^Revisión base cero del plan: 0 de 6 partidas revisadas$/, "6: la vacía no entra");
  assert.equal(closed.body.innerHTML, "");

  const { context, body, summary, state } = uiSandbox({ rows: PLAN });
  context.renderBaseCero(zero);
  assert.match(body.innerHTML, /<h3 id="bcTitulo" tabindex="-1">Nómina<\/h3>/, "la más pesada primero (3.000 € al mes)");
  assert.doesNotMatch(body.innerHTML, /Solo hay reales anotados en/, "con reales en 6 meses no hay aviso de cobertura");
  assert.match(body.innerHTML, /1 partida sin importe previsto y sin ningún real no entra en la revisión/);
  assert.match(body.innerHTML, /0 de 6 revisadas, 6 por revisar/);
  assert.match(body.innerHTML, /<progress max="6" value="0"/);
  assert.equal((body.innerHTML.match(/<article class="bc-card"/g) || []).length, 1, "una partida por pantalla");
  assert.match(body.innerHTML, /<caption>Reales de los últimos 6 meses<\/caption>/);
  assert.match(body.innerHTML, /data-bc="mantener"/);
  assert.match(body.innerHTML, /data-bc="saltar"/);
  assert.match(summary.textContent, /0 de 6/);
  // El súper tiene propuesta (mediana 705 → 705 €) y se escapa el nombre.
  state().key = "expense|super";
  state().cache.revision = -1;
  context.renderBaseCero(zero);
  assert.match(body.innerHTML, /Súper &lt;b&gt;/);
  assert.doesNotMatch(body.innerHTML, /<b>/);
  assert.match(body.innerHTML, /data-bc="ajustar"[^>]*>Ajustar a 705,00 € al mes</);
  assert.match(body.innerHTML, /Propuesta: 705,00 € al mes \(la mediana de lo real, redondeada al euro\), más que lo previsto hoy \(18 %\)/);
  assert.match(body.innerHTML, /data-bc="quitar"/);
  // Una bloqueada: sin «Quitar» ni «Ajustar».
  state().key = "expense|cuota";
  state().cache.revision = -1;
  context.renderBaseCero(zero);
  assert.doesNotMatch(body.innerHTML, /data-bc="quitar"|data-bc="ajustar"/);
  assert.match(body.innerHTML, /Su importe lo manda otra cosa: sigue el calendario de su contrato de deuda/);
});

test("pantalla: «Mantener» guarda la marca al momento y pasa a la siguiente; el almacén va en la copia", () => {
  const { context, click, storage, calls, body } = uiSandbox({ rows: PLAN });
  context.renderBaseCero(zero);
  click("mantener", "income|nomina");
  const saved = JSON.parse(storage["zero-base-data:demo"]);
  assert.deepEqual(saved.reviews["income|nomina"], { decision: "mantener", reviewedAt: "2027-01-12", from: null, to: null });
  assert.equal(calls.remote, 1, "se pide guardar en la nube");
  assert.deepEqual(calls.staged, [], "mantener no toca el plan");
  assert.deepEqual(calls.deletes, []);
  assert.match(body.innerHTML, /Ya revisadas \(1\)/);
  assert.match(body.innerHTML, /<strong>Nómina<\/strong> · mantenida · 12\/01\/2027/);
  assert.doesNotMatch(body.innerHTML, /<h3 id="bcTitulo" tabindex="-1">Nómina/, "la siguiente ya no es la que se acaba de mantener");
  assert.match(calls.announced.at(-1), /«Nómina» queda como está/);
});

test("pantalla: «Ajustar» PREPARA el importe en los meses por venir (no escribe en el plan) y «Guardar» es el de siempre", () => {
  const { context, click, storage, calls, body } = uiSandbox({ rows: PLAN });
  context.renderBaseCero(zero);
  click("ajustar", "expense|super");
  assert.deepEqual(calls.staged.map(([key, month, value]) => `${key}|${month}|${value}`), FUTURE.map((month) => `expense|super|${month}|705`), "solo meses por venir, y solo los de la partida");
  assert.equal(calls.saved, 0, "no se guarda solo");
  assert.deepEqual(JSON.parse(storage["zero-base-data:demo"]).reviews["expense|super"], { decision: "ajustar", reviewedAt: "2027-01-12", from: 600, to: 705 });
  assert.match(calls.announced.at(-1), /preparado 705,00 € al mes en 4 meses\. Guárdalo para que cuente\./);
  assert.match(body.innerHTML, /4 cambios preparados en el plan/);
  assert.match(body.innerHTML, /ajuste preparado, sin guardar/);
  assert.equal(calls.rendered, 1, "la tabla de Partidas se repinta para enseñar el borrador");
  click("guardar");
  assert.equal(calls.saved, 1);
  assert.match(calls.announced.at(-1), /Cambios guardados en el plan/);
  assert.doesNotMatch(body.innerHTML, /cambios? preparados? en el plan/);
  // Ajustar sin propuesta no hace nada.
  const before = calls.staged.length;
  click("ajustar", "expense|luz");
  assert.equal(calls.staged.length, before);
});

test("pantalla: «Quitar» solo PREPARA el borrado en el borrador de Partidas; sin guardar, el estado lo dice; «Descartar» lo deja como estaba", () => {
  const { context, click, calls, body } = uiSandbox({ rows: PLAN });
  context.renderBaseCero(zero);
  click("quitar", "expense|gimnasio");
  assert.deepEqual(calls.deletes, ["expense|gimnasio"]);
  assert.equal(calls.saved, 0);
  assert.match(body.innerHTML, /borrado preparado, sin guardar/);
  click("descartar");
  assert.equal(calls.discarded, 1);
  assert.match(body.innerHTML, /decidida quitar, sigue en el plan/, "tras descartar, la marca sigue pero dice que no se aplicó");
  // Una bloqueada no se puede quitar aunque llegue el clic.
  click("quitar", "expense|cuota");
  assert.deepEqual(calls.deletes, ["expense|gimnasio"]);
});

test("pantalla: el ajuste ya aplicado se reconoce («ajustada a…»); una revisión de hace más de un año vuelve a tocar; «Revisar de nuevo» quita la marca", () => {
  const applied = { "expense|super": { ...PLAN["expense|super"], planned: 705 } };
  const { context, click, storage, body } = uiSandbox({ rows: applied, store: { reviews: { "expense|super": { decision: "ajustar", reviewedAt: "2027-01-05", from: 600, to: 705 } } } });
  context.renderBaseCero(zero);
  assert.match(body.innerHTML, /ajustada a 705,00 € al mes/);
  click("reabrir", "expense|super");
  assert.deepEqual(JSON.parse(storage["zero-base-data:demo"]).reviews, {});
  assert.match(body.innerHTML, /<h3 id="bcTitulo" tabindex="-1">Súper/);
  const old = uiSandbox({ rows: PLAN, store: { reviews: { "income|nomina": { decision: "mantener", reviewedAt: "2025-12-01", from: null, to: null } } } });
  old.context.renderBaseCero(zero);
  assert.match(old.body.innerHTML, /Se revisó el 01\/12\/2025: ya pasó un año\./);
});

test("pantalla: «Saltar» deja la partida para luego; saltadas todas, ofrece volver a empezar; con todas revisadas, lo dice", () => {
  const small = { "expense|a": { kind: "expense", label: "A", planned: 50 }, "expense|b": { kind: "expense", label: "B", planned: 20 } };
  const { context, click, body } = uiSandbox({ rows: small });
  context.renderBaseCero(zero);
  assert.match(body.innerHTML, /<h3 id="bcTitulo" tabindex="-1">A</);
  click("saltar", "expense|a");
  assert.match(body.innerHTML, /<h3 id="bcTitulo" tabindex="-1">B</);
  click("saltar", "expense|b");
  assert.match(body.innerHTML, /Has saltado las 2 que quedan\./);
  click("volver");
  assert.match(body.innerHTML, /<h3 id="bcTitulo" tabindex="-1">A</);
  click("mantener", "expense|a");
  click("mantener", "expense|b");
  assert.match(body.innerHTML, /Revisión completa\.<\/strong> Las 2 partidas tienen su marca de este año/);
});

test("pantalla: sin reales anotados lo dice y no inventa propuestas", () => {
  const { context, body } = uiSandbox({ rows: { "expense|a": { kind: "expense", label: "A", planned: 50 } } });
  context.renderBaseCero(zero);
  assert.match(body.innerHTML, /Solo hay reales anotados en <strong>0<\/strong> de los últimos 6 meses/);
  assert.doesNotMatch(body.innerHTML, /data-bc="ajustar"/);
  assert.match(body.innerHTML, /Sin reales anotados en los últimos 6 meses: no hay «lo real» con lo que ajustar\./);
});

// ---- El cableado -----------------------------------------------------------------------------------------------------------------------

test("cableado: se pinta con Partidas, se guarda en la copia y se registra en la app y en el sitio publicado", () => {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const app = codigoApp();
  assert.match(app, /case "planificacion-partidas":[\s\S]{0,400}globalThis\.renderBaseCero\?\.\(window\.FinanceCanonicalZeroBase\)/);
  assert.match(app.slice(app.indexOf("const BACKUP_LOCAL_STORES"), app.indexOf("];", app.indexOf("const BACKUP_LOCAL_STORES"))), /"zero-base-data"/);
  const html = read("index.html");
  assert.ok(html.indexOf('<script defer src="canonical-zero-base.js') < html.indexOf('<script defer src="base-cero-ui.js'), "el motor antes que la pantalla");
  assert.match(html, /<link rel="stylesheet" href="base-cero\.css\?v=/);
  assert.match(html, /<details class="[^"]*base-cero-card" id="baseCeroCard">\s*<summary id="baseCeroResumen">[\s\S]*?<div id="baseCero"><\/div>/);
  for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) {
    const source = read(file);
    for (const name of ["canonical-zero-base.js", "base-cero-ui.js", "base-cero.css"]) assert.ok(source.includes(`"${name}"`) || source.includes(`"./${name}"`), `${file} registra ${name}`);
  }
  assert.match(read("novedades.js"), /2026-10-12-wp34/);
});
