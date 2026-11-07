// FX-31 · la insignia de confianza de la previsión (canonical-forecast-confidence.js) y su cableado en la Previsión nueva.
// Cifras INVENTADAS: ninguna sale del hogar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const C = require("../canonical-forecast-confidence.js");
const raiz = path.join(__dirname, "..");
const leer = (fichero) => fs.readFileSync(path.join(raiz, fichero), "utf8");

const bien = { dates: { value: 80 }, balances: { mode: "manual", ageDays: 1, staleAfterDays: 4 }, closes: { comparable: 4, min: 3, errorPct: 3.2 } };

test("FX-31 · alta solo con las tres señales bien; baja con dos o más flojas; si no, media", () => {
  assert.equal(C.evaluate(bien).level, "alta");
  assert.equal(C.evaluate(bien).label, "Confianza alta");
  // Sin 3 cierres comparables no se sabe cuánto acierta: nunca «alta», aunque lo demás esté bien.
  assert.equal(C.evaluate({ ...bien, closes: { comparable: 2, min: 3 } }).level, "media");
  assert.equal(C.evaluate({ ...bien, dates: { value: 10 } }).level, "media");
  assert.equal(C.evaluate({ ...bien, dates: { value: 10 }, balances: { mode: "auto" } }).level, "baja");
  assert.equal(C.evaluate({ dates: { value: 0 }, balances: { mode: "auto" }, closes: { comparable: 0 } }).level, "baja");
});

test("FX-31 · días de cargo: umbrales de WP-10 (70 % bien, 30 % a medias) y sin pagos no hay nada que adivinar", () => {
  assert.equal(C.dateSignal({ value: 70 }).state, "ok");
  assert.equal(C.dateSignal({ value: 69 }).state, "regular");
  assert.equal(C.dateSignal({ value: 30 }).state, "regular");
  assert.equal(C.dateSignal({ value: 29 }).state, "mal");
  assert.match(C.dateSignal({ value: 0 }).text, /Ningún pago de los próximos 90 días tiene su día confirmado/);
  assert.match(C.dateSignal({ value: 45 }).text, /Solo el 45 % del gasto/);
  assert.equal(C.dateSignal({ value: null }).state, "ok");
});

test("FX-31 · saldos: calculados por calendario o sin fecha es «flojo»; la edad decide el resto", () => {
  assert.equal(C.balanceSignal({ mode: "auto" }).state, "mal");
  assert.match(C.balanceSignal({ mode: "auto" }).text, /por calendario/);
  assert.equal(C.balanceSignal({ mode: "manual", ageDays: null }).state, "mal");
  assert.equal(C.balanceSignal({ mode: "manual", ageDays: 0, staleAfterDays: 4 }).state, "ok");
  assert.match(C.balanceSignal({ mode: "manual", ageDays: 0, staleAfterDays: 4 }).text, /de hoy/);
  assert.equal(C.balanceSignal({ mode: "manual", ageDays: 3, staleAfterDays: 4 }).state, "ok");
  assert.equal(C.balanceSignal({ mode: "manual", ageDays: 4, staleAfterDays: 4 }).state, "regular");
  assert.equal(C.balanceSignal({ mode: "manual", ageDays: 16, staleAfterDays: 4 }).state, "mal");
});

test("FX-31 · acierto: 0 cierres flojo, menos de 3 a medias, con 3 o más bien salvo un error de más del 10 %", () => {
  assert.equal(C.closeSignal({ comparable: 0, min: 3 }).state, "mal");
  assert.match(C.closeSignal({ comparable: 0, min: 3 }).text, /hacen falta 3/);
  assert.equal(C.closeSignal({ comparable: 2, min: 3 }).state, "regular");
  assert.match(C.closeSignal({ comparable: 2, min: 3 }).text, /2 de 3 cierres/);
  assert.equal(C.closeSignal({ comparable: 3, min: 3, errorPct: 4.5 }).state, "ok");
  assert.match(C.closeSignal({ comparable: 3, min: 3, errorPct: 4.5 }).text, /4,5 %/);
  assert.equal(C.closeSignal({ comparable: 5, min: 3, errorPct: 12 }).state, "regular");
});

test("FX-31 · unificada con la antigua «Fiabilidad de la previsión»: el error del neto mensual entra en el acierto", () => {
  // Con 6 meses conciliados o más (lo que la etiqueta antigua llamaba «media»), y la caja a fin de mes aún sin medir: a medias.
  const conMeses = C.closeSignal({ comparable: 0, min: 3, monthly: { samples: 7, meanAbsoluteError: 212.4 } });
  assert.equal(conMeses.state, "regular");
  assert.match(conMeses.text, /La caja a fin de mes aún no se puede medir \(0 de 3 cierres comparables\)/);
  assert.match(conMeses.text, /en 7 meses: se equivoca de media unos 212\s€/);
  // Con menos de 6, se cuenta pero no sube la señal.
  const pocos = C.closeSignal({ comparable: 0, min: 3, monthly: { samples: 2, meanAbsoluteError: 90 } });
  assert.equal(pocos.state, "mal");
  assert.match(pocos.text, /en 2 meses: se equivoca de media unos 90\s€, aún pocos para fiarse \(hacen falta 6\)/);
  // Con 3 cierres comparables manda la caja a fin de mes; el neto mensual no la empeora.
  assert.equal(C.closeSignal({ comparable: 3, min: 3, errorPct: 4, monthly: { samples: 8, meanAbsoluteError: 500 } }).state, "ok");
  // Una sola insignia: app.js ya no pinta «Fiabilidad de la previsión»; Herramientas › Previsión pinta la de Plan › Previsión.
  const app = leer("app.js");
  assert.doesNotMatch(app, /Fiabilidad de la previsión: /);
  assert.match(app, /function renderPrevisionReliabilityBadge\(\) \{\n\s+globalThis\.previsionV2InsigniaHerramientas\?\.\(qs\("previsionReliabilityBadge"\)\);/);
  const vista = leer("views/prevision-v2.js");
  assert.match(vista, /pvc17PredictiveHealthIndex/);
  assert.match(vista, /hojaId: "previsionConfianzaHoja"/);
  assert.match(leer("index.html"), /<div class="prevision-confianza" id="previsionReliabilityBadge"><\/div>/);
});

test("FX-31 · la tarea que más la sube es la primera de la cola que sube una señal floja; las de señales bien no cuentan", () => {
  const tareas = [
    { id: "statement", signal: "saldos", label: "Importar el extracto" },
    { id: "dias-de-cargo", signal: "dias", label: "Decir el día de cargo" },
    { id: "pending", label: "Responder cobros" }, // no sube ninguna señal
    { id: "dias-de-cargo", signal: "dias", label: "repetida" },
    { id: "cierre-firmar", signal: "acierto", label: "Firmar el cierre" },
  ];
  // Saldos bien: la primera que vale es la de los días.
  const r = C.evaluate({ ...bien, dates: { value: 10 }, closes: { comparable: 0 }, tasks: tareas });
  assert.equal(r.top.id, "dias-de-cargo");
  assert.deepEqual(r.more.map((task) => task.id), ["cierre-firmar"]);
  // Todo bien: no hay nada que la suba.
  const alta = C.evaluate({ ...bien, tasks: tareas });
  assert.equal(alta.top, null);
  assert.deepEqual(alta.more, []);
  assert.deepEqual(alta.signals.map((signal) => signal.icon), ["✓", "✓", "✓"]);
});

test("FX-31 · motor puro y cableado: se carga antes de la vista, entra en la caché sin conexión y en el sitio publicado", () => {
  const motor = leer("canonical-forecast-confidence.js");
  assert.doesNotMatch(motor, /document\.|localStorage|window\.|Date\.now|new Date\(/);
  const html = leer("index.html");
  const motorAt = html.indexOf('src="canonical-forecast-confidence.js?v=');
  assert.ok(motorAt > 0, "index.html lo carga");
  assert.ok(motorAt < html.indexOf('src="views/prevision-v2.js?v='), "antes de la vista que lo usa");
  assert.match(leer("service-worker.js"), /"\.\/canonical-forecast-confidence\.js"/);
  assert.match(leer("tools/build-public-site.mjs"), /"canonical-forecast-confidence\.js"/);
  const vista = leer("views/prevision-v2.js");
  assert.match(vista, /FinanceCanonicalForecastConfidence/);
  assert.match(vista, /data-prevision-v2-confianza/);
  // El gasto variable no tiene día de cargo: ni «¿sabes el día?» ni tarea.
  assert.match(vista, /event\.field !== "variableOperationalSpend"/);
});
