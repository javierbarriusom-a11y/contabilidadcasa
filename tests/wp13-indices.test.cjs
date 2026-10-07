const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = require(path.join(root, "canonical-rate-indices.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const TODAY = "2026-10-07";
const empty = () => engine.normalizeStore({});
const add = (store, indexId, value, date) => engine.addPoint(store, { indexId, value, date }, TODAY);

// WP-13 · PR-1: índices tecleados con fecha y caducidad. Sin ninguna fuente externa.

test("WP-13 · parsePercent entiende la coma, el punto, el signo y el «%», y rechaza lo que no es un tipo", () => {
  assert.equal(engine.parsePercent("2,35"), 2.35);
  assert.equal(engine.parsePercent("2.35"), 2.35);
  assert.equal(engine.parsePercent(" 2,35 % "), 2.35);
  assert.equal(engine.parsePercent("-0,5"), -0.5);
  assert.equal(engine.parsePercent("−0,5"), -0.5, "el signo menos tipográfico del móvil");
  assert.equal(engine.parsePercent(3), 3);
  for (const bad of ["", "abc", "2,35,1", "1.234,5", "2,", ",5", "2 3", null, undefined, NaN]) {
    assert.equal(engine.parsePercent(bad), null, `«${bad}» no es un tipo`);
  }
});

test("WP-13 · un valor válido se guarda con su fecha, su día de alta y origen manual", () => {
  const result = add(empty(), "euribor12m", "2,35", "2026-10-01");
  assert.equal(result.ok, true);
  assert.equal(result.replaced, false);
  assert.deepEqual(result.store.points, [{ indexId: "euribor12m", date: "2026-10-01", value: 2.35, enteredAt: TODAY, source: "manual" }]);
});

test("WP-13 · sin fecha, el dato es de hoy; una fecha futura o inexistente se rechaza", () => {
  assert.equal(add(empty(), "estr", "1,9").store.points[0].date, TODAY);
  assert.equal(add(empty(), "estr", "1,9", "2026-10-08").ok, false, "futura");
  assert.match(add(empty(), "estr", "1,9", "2026-10-08").error, /futura/);
  assert.equal(add(empty(), "estr", "1,9", "2026-02-30").ok, false, "30 de febrero");
  assert.equal(add(empty(), "estr", "1,9", "07/10/2026").ok, false, "formato no ISO");
  assert.equal(add(empty(), "estr", "1,9", "2019-01-01").ok, false, "más de cinco años");
});

test("WP-13 · un valor fuera de lo razonable pide revisar la coma (23,5 en vez de 2,35)", () => {
  const result = add(empty(), "euribor12m", "23,5", "2026-10-01");
  assert.equal(result.ok, false);
  assert.match(result.error, /fuera de lo razonable/);
  assert.equal(result.store.points.length, 0, "no se guarda nada");
  assert.equal(add(empty(), "euribor12m", "-0,5", "2026-10-01").ok, true, "los tipos negativos existieron y valen");
  assert.equal(add(empty(), "ipc", "-3", "2026-10-01").ok, true);
  assert.equal(add(empty(), "euribor12m", "hola", "2026-10-01").ok, false);
  assert.equal(add(empty(), "inventado", "2", "2026-10-01").ok, false);
});

test("WP-13 · un segundo valor en la misma fecha sustituye al primero (y lo dice)", () => {
  const first = add(empty(), "euribor12m", "2,35", "2026-10-01").store;
  const second = add(first, "euribor12m", "2,41", "2026-10-01");
  assert.equal(second.replaced, true);
  assert.equal(second.store.points.length, 1);
  assert.equal(second.store.points[0].value, 2.41);
  assert.equal(first.points[0].value, 2.35, "no muta el almacén recibido");
});

test("WP-13 · la misma fecha en otro índice no se pisa", () => {
  let store = add(empty(), "euribor12m", "2,35", "2026-10-01").store;
  store = add(store, "estr", "1,90", "2026-10-01").store;
  assert.equal(store.points.length, 2);
  assert.equal(engine.latest(store, "euribor12m").value, 2.35);
  assert.equal(engine.latest(store, "estr").value, 1.9);
  assert.equal(engine.latest(store, "ipc"), null);
});

test("WP-13 · «último» es el de fecha más reciente, no el último tecleado", () => {
  let store = add(empty(), "euribor12m", "2,50", "2026-10-05").store;
  store = add(store, "euribor12m", "2,10", "2026-09-01").store; // dato antiguo tecleado después
  assert.equal(engine.latest(store, "euribor12m").date, "2026-10-05");
});

test("WP-13 · caducidad: vigente hasta el día del plazo (inclusive) y caducado el siguiente", () => {
  // Euribor: 35 días
  const euribor = add(empty(), "euribor12m", "2,35", "2026-09-02").store; // hace 35 días
  assert.equal(engine.status(euribor, "euribor12m", TODAY).state, "fresh");
  assert.equal(engine.status(euribor, "euribor12m", TODAY).ageDays, 35);
  assert.equal(engine.status(euribor, "euribor12m", "2026-10-08").state, "stale", "36 días");
  // €STR: 10 días
  const estr = add(empty(), "estr", "1,9", "2026-09-27").store; // hace 10 días
  assert.equal(engine.status(estr, "estr", TODAY).state, "fresh");
  assert.equal(engine.status(estr, "estr", "2026-10-08").state, "stale");
  // IPC: 75 días
  const ipc = add(empty(), "ipc", "3,1", "2026-07-24").store; // hace 75 días
  assert.equal(engine.status(ipc, "ipc", TODAY).state, "fresh");
  assert.equal(engine.status(ipc, "ipc", "2026-10-08").state, "stale");
});

test("WP-13 · sin dato, el estado es «missing» y el texto dice que la app no lo usa; el caducado dice la edad y qué hacer", () => {
  const missing = engine.status(empty(), "euribor12m", TODAY);
  assert.equal(missing.state, "missing");
  assert.match(missing.label, /Sin dato/);
  const stale = engine.status(add(empty(), "euribor12m", "2,35", "2026-06-01").store, "euribor12m", TODAY);
  assert.equal(stale.state, "stale");
  assert.match(stale.label, /caducado \(hace 128 días; vale 35\)/);
  assert.match(stale.label, /Teclea el último publicado/);
  assert.match(engine.status(add(empty(), "euribor12m", "2,35", TODAY).store, "euribor12m", TODAY).label, /hace 0 días/);
  assert.match(engine.status(add(empty(), "euribor12m", "2,35", "2026-10-06").store, "euribor12m", TODAY).label, /hace 1 día;/);
});

test("WP-13 · un dato futuro respecto a «hoy» (reloj atrasado) no da edad negativa", () => {
  const store = engine.normalizeStore({ points: [{ indexId: "estr", date: "2026-10-09", value: 1.9, enteredAt: "2026-10-09", source: "manual" }] });
  assert.equal(engine.status(store, "estr", TODAY).ageDays, 0);
});

test("WP-13 · quitar un punto no toca el resto; quitar uno que no existe no hace nada", () => {
  let store = add(empty(), "euribor12m", "2,35", "2026-10-01").store;
  store = add(store, "euribor12m", "2,40", "2026-10-05").store;
  const removed = engine.removePoint(store, "euribor12m", "2026-10-05");
  assert.deepEqual(removed.points.map((point) => point.date), ["2026-10-01"]);
  assert.deepEqual(engine.removePoint(removed, "euribor12m", "2020-01-01").points, removed.points);
});

test("WP-13 · el historial se limita a 120 puntos por índice y descarta los más antiguos, sin tocar a los demás índices", () => {
  let store = add(empty(), "estr", "1,9", "2026-10-01").store;
  const base = Date.UTC(2026, 9, 7);
  for (let i = 0; i < 125; i += 1) {
    const date = new Date(base - i * 86400000).toISOString().slice(0, 10);
    if (date < "2025-10-10") continue; // dentro de los cinco años; no hace falta más
    store = add(store, "euribor12m", String(2 + (i % 10) / 100), date).store;
  }
  const series = engine.seriesOf(store, "euribor12m");
  assert.ok(series.length <= engine.MAX_POINTS_PER_INDEX);
  assert.equal(engine.seriesOf(store, "estr").length, 1);
  assert.equal(series[series.length - 1].date, TODAY, "se conserva lo más reciente");
});

test("WP-13 · un almacén corrupto o a medias se normaliza sin lanzar: se descartan los puntos inválidos y los duplicados", () => {
  const store = engine.normalizeStore({
    points: [
      null, 7, "x",
      { indexId: "euribor12m", date: "2026-10-01", value: "2.35", enteredAt: "no-fecha", source: "raro" },
      { indexId: "euribor12m", date: "2026-10-01", value: 9, enteredAt: TODAY },
      { indexId: "inventado", date: "2026-10-01", value: 1 },
      { indexId: "estr", date: "mal", value: 1 },
      { indexId: "estr", date: "2026-10-01", value: "abc" },
    ],
  });
  assert.equal(store.points.length, 1);
  assert.deepEqual(store.points[0], { indexId: "euribor12m", date: "2026-10-01", value: 2.35, enteredAt: "2026-10-01", source: "manual" });
  for (const bad of [null, undefined, 3, "x", { points: "no" }]) assert.deepEqual(engine.normalizeStore(bad).points, []);
});

test("WP-13 · media mensual y valor a una fecha usan solo lo tecleado y dicen con cuántos puntos", () => {
  let store = empty();
  for (const [date, value] of [["2026-09-03", "2,00"], ["2026-09-17", "2,20"], ["2026-10-01", "2,50"]]) store = add(store, "euribor12m", value, date).store;
  assert.deepEqual(engine.monthlyAverage(store, "euribor12m", "2026-09"), { value: 2.1, count: 2 });
  assert.deepEqual(engine.monthlyAverage(store, "euribor12m", "2026-08"), { value: null, count: 0 });
  assert.equal(engine.valueAt(store, "euribor12m", "2026-09-20").value, 2.2);
  assert.equal(engine.valueAt(store, "euribor12m", "2026-09-01"), null, "antes del primer dato no hay valor");
  assert.equal(engine.valueAt(store, "euribor12m", "basura"), null);
});

test("WP-13 · el origen «oficial» se conserva si llega (PR-2) y cualquier otro se lee como manual", () => {
  const store = engine.normalizeStore({ points: [{ indexId: "estr", date: "2026-10-01", value: 1.9, enteredAt: TODAY, source: "oficial" }] });
  assert.equal(store.points[0].source, "oficial");
});

// --- Cableado ---------------------------------------------------------------------------------

test("WP-13 · el motor no toca la red ni el DOM (PR-1 no consulta fuentes externas)", () => {
  const source = read("canonical-rate-indices.js");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\/|document\.|window\./);
});

test("WP-13 · la tarjeta está en Deuda › Contratos, los scripts se cargan antes que app.js y el almacén entra en la copia", () => {
  const html = read("index.html");
  const contratos = html.slice(html.indexOf('id="deuda-contratos"'), html.indexOf('id="deuda-contratos"') + 14000);
  assert.match(contratos, /id="indicesCard"/);
  assert.match(contratos, /id="indicesLista"/);
  assert.match(contratos, /No consulta ninguna fuente externa/);
  assert.ok(html.indexOf("canonical-rate-indices.js") < html.indexOf('src="app.js'), "motor antes que app.js");
  assert.ok(html.indexOf("indices-ui.js") < html.indexOf('src="app.js'), "tarjeta antes que app.js");
  const app = read("app.js");
  assert.match(app, /"rate-indices", \/\/ WP-13/);
  assert.match(app, /case "deuda-contratos":\s*renderDeudaContratos\(\);\s*globalThis\.renderIndicesReferencia\?\.\(globalThis\.FinanceCanonicalRateIndices\)/);
  assert.match(app, /globalThis\.attachIndices\?\.\(document\)/);
  for (const file of ["canonical-rate-indices.js", "indices-ui.js", "deuda-tipo.css"]) {
    assert.ok(read("service-worker.js").includes(`"./${file}"`), `${file} en el service worker`);
    assert.ok(read("tools/build-public-site.mjs").includes(`"${file}"`), `${file} en la build`);
  }
});

test("WP-13 · «Novedades» anuncia los índices y el manual los explica", () => {
  assert.match(read("novedades.js"), /wp13/);
  assert.match(read("MANUAL_USUARIO.md"), /Índices de referencia/);
});
