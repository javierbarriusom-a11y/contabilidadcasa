const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// WP-03 (UXS-04 + NTC-03 reducido, BACKLOG_DEFINITIVO.md §5.1): panel de uso real, la base de la regla
// de parada de cada ola. Un solo usuario y un solo móvil (decisión del hogar del 3/10/2026): local, sin
// sincronización, solo agregados. Lo que no se puede medir todavía se dice («sin medir»), nunca se
// rellena con un cero.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const panel = require("../usage-panel.js");

test("semana ISO con año ISO y lunes de la semana", () => {
  assert.equal(panel.isoWeekKey("2026-10-05"), "2026-W41");
  assert.equal(panel.isoWeekKey("2027-01-01"), "2026-W53", "el 1/1/2027 (viernes) es de la semana 53 de 2026");
  assert.equal(panel.isoWeekKey("2027-01-04"), "2027-W01");
  assert.equal(panel.weekStart("2026-10-08"), "2026-10-05");
  assert.equal(panel.weekStart("2026-10-05"), "2026-10-05");
  assert.equal(panel.weekStart("2026-10-11"), "2026-10-05", "el domingo es de la semana del lunes anterior");
});

test("un día de uso se cuenta una vez y se olvida a los 180 días", () => {
  let store = panel.recordActiveDay(null, "2026-10-05");
  store = panel.recordActiveDay(store, "2026-10-05");
  assert.deepEqual(Object.keys(store.days), ["2026-10-05"]);
  store = panel.recordActiveDay(store, "2027-04-10");
  assert.deepEqual(Object.keys(store.days), ["2027-04-10"], "más de 180 días después, el primero se descarta");
});

test("frescura: cuenta la mejor edad del día; saldos por calendario no son del banco", () => {
  let store = panel.recordFreshness(null, "2026-10-05", { ageDays: 5, balanceMode: "manual" });
  store = panel.recordFreshness(store, "2026-10-05", { ageDays: 0, balanceMode: "manual" });
  assert.equal(store.days["2026-10-05"].freshAge, 0, "se actualizaron a media mañana: el día cuenta como fresco");
  store = panel.recordFreshness(store, "2026-10-05", { ageDays: 3, balanceMode: "manual" });
  assert.equal(store.days["2026-10-05"].freshAge, 0);
  store = panel.recordFreshness(store, "2026-10-06", { ageDays: 0, balanceMode: "auto" });
  assert.deepEqual(store.days["2026-10-06"], { freshAge: null, auto: true });
  store = panel.recordFreshness(store, "2026-10-07", { ageDays: null, balanceMode: "manual" });
  assert.equal(store.days["2026-10-07"].freshAge, null, "sin fecha no es fresco ni rancio: no se sabe");
});

test("minutos por semana: solo números razonables", () => {
  assert.equal(panel.recordMinutes(null, "2026-W41", "12").store.minutes["2026-W41"], 12);
  assert.equal(panel.recordMinutes(null, "2026-W41", "7.6").store.minutes["2026-W41"], 8);
  assert.equal(panel.recordMinutes(null, "2026-W41", "-1").ok, false);
  assert.equal(panel.recordMinutes(null, "2026-W41", "601").ok, false);
  assert.equal(panel.recordMinutes(null, "2026-W41", "").ok, false, "vacío no es «0 minutos»: sería un dato inventado");
  assert.equal(panel.recordMinutes(null, "2026-W41", "0").store.minutes["2026-W41"], 0, "0 escrito a propósito sí cuenta");
  assert.equal(panel.recordMinutes(null, "41", "5").ok, false);
});

test("con menos de 7 días de uso la frescura se enseña sin veredicto", () => {
  let store = null;
  for (const day of ["2026-10-05", "2026-10-06"]) store = panel.recordFreshness(store, day, { ageDays: 0, balanceMode: "auto" });
  const summary = panel.summarize(store, "2026-10-06");
  assert.equal(summary.freshness.value, 0);
  assert.equal(summary.freshness.meets, null, "dos días no bastan para decir «no cumple»");
});

test("sin datos el panel dice «sin datos», no ceros", () => {
  const summary = panel.summarize(null, "2026-10-05");
  assert.equal(summary.firstDay, "");
  assert.deepEqual(summary.weeks, []);
  assert.equal(summary.adoption.value, null);
  assert.equal(summary.adoption.meets, null);
  assert.equal(summary.freshness.value, null);
  assert.equal(summary.minutes.value, null);
});

test("semanas completas desde el primer uso: una semana anterior al primer uso no cuenta como semana sin uso", () => {
  let store = null;
  // Empieza el miércoles 7/10 (semana 41); hoy es el miércoles 21/10 (semana 43).
  for (const day of ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-19", "2026-10-21"]) {
    store = panel.recordFreshness(store, day, { ageDays: day === "2026-10-13" ? 6 : 1, balanceMode: "manual" });
  }
  store = panel.recordMinutes(store, "2026-W41", 15).store;
  store = panel.recordMinutes(store, "2026-W42", 6).store;
  const summary = panel.summarize(store, "2026-10-21");
  assert.deepEqual(summary.weeks.map((week) => [week.week, week.activeDays, week.minutes]), [["2026-W41", 3, 15], ["2026-W42", 5, 6]]);
  assert.equal(summary.adoption.value, 4);
  assert.equal(summary.adoption.meets, true, "≥ 4 días por semana");
  assert.equal(summary.activeThisWeek, 2);
  assert.equal(summary.freshness.activeDays, 10);
  assert.equal(summary.freshness.freshDays, 9);
  assert.equal(summary.freshness.value, 90);
  assert.equal(summary.freshness.meets, true, "≥ 90 %");
  assert.equal(summary.minutes.value, 10.5);
  assert.equal(summary.minutes.meets, false, "≤ 10 min por semana");
});

test("el panel solo guarda agregados: ni importes ni movimientos", () => {
  const store = panel.recordFreshness(panel.recordMinutes(null, "2026-W41", 9).store, "2026-10-05", { ageDays: 0, balanceMode: "manual", value: 8310, spendable: 8310 });
  assert.doesNotMatch(JSON.stringify(store), /8310/);
  assert.deepEqual(Object.keys(store), ["days", "minutes"]);
});

test("marcado: panel en Ajustes › Uso de la app, sin tocar Hoy ni app.js", () => {
  const html = read("index.html");
  const uso = html.slice(html.indexOf('id="ajustes-uso-app"'), html.indexOf('id="ajustes-operacion"'));
  for (const id of ["panelUsoCard", "panelUsoDesde", "panelUsoLista", "panelUsoForm", "panelUsoMinutos", "panelUsoMinutosEstado"]) assert.match(uso, new RegExp(`id="${id}"`));
  assert.ok(uso.indexOf('id="panelUsoCard"') < uso.indexOf('id="usoAppCard"'), "el panel va antes que la tabla de pantallas");
  assert.ok(html.indexOf('src="usage-panel.js?v=') > 0 && html.indexOf('src="usage-panel.js?v=') < html.indexOf('<script defer src="app.js?v='));
  assert.doesNotMatch(read("app.js"), /FinanceUsagePanel|usage-days/, "WP-03 no ocupa margen de app.js");
  assert.match(read("finding-test-ui.js"), /root\.FinanceUsagePanel\?\.noteFreshness\?\.\(\{ ageDays: shown\.ageDays, balanceMode: shown\.balanceMode \}\)/, "Hoy le pasa al panel solo la edad y el modo de los saldos");
  assert.match(read("service-worker.js"), /"\.\/usage-panel\.js",/);
});

test("lo que no se puede medir se dice con su motivo", () => {
  const source = read("usage-panel.js");
  assert.match(source, /Gasto registrado en menos de 48 h", "—", "—", null, "Sin medir: la app no guarda cuándo registras cada gasto[^"]*", "Sin medir"\)/);
  assert.match(source, /Decisiones registradas", "—", "—", null, "Sin medir[^"]*", "Sin medir"\)/);
});

// --- Navegador, con un DOM mínimo simulado ------------------------------------------------------

test("al montar anota el día de uso, pinta la tabla y guarda los minutos de la semana", () => {
  const elements = Object.fromEntries(["panelUsoLista", "panelUsoDesde", "panelUsoMinutos", "panelUsoMinutosEstado", "panelUsoForm"].map((id) => {
    const listeners = {};
    return [id, { id, innerHTML: "", textContent: "", value: "", listeners, addEventListener(type, fn) { (listeners[type] ||= []).push(fn); } }];
  }));
  const store = {};
  const fakeRoot = {
    document: { getElementById: (id) => elements[id] || null, addEventListener() {}, activeElement: null, visibilityState: "visible" },
    localStorage: { getItem: (key) => store[key] ?? null, setItem: (key, value) => { store[key] = String(value); } },
    addEventListener() {},
    FinanceFindingTestUi: { summary: () => ({ A: { medianSeconds: 12.5, valid: 3 }, baselineReady: true, meetsTarget: true, baselineAttempts: 3 }) },
  };
  panel.mount(fakeRoot);
  const saved = JSON.parse(store["usage-days"]);
  assert.equal(Object.keys(saved.days).length, 1, "abrir la app es un día de uso");
  assert.match(elements.panelUsoLista.innerHTML, /<strong>Días de uso por semana<\/strong><span class="panel-uso-valor">—<\/span><\/div><p><span class="status-pill neutral">Sin datos aún<\/span> Objetivo: ≥ 4<\/p>/);
  assert.match(elements.panelUsoLista.innerHTML, /<strong>Segundos hasta la cifra de Hoy<\/strong><span class="panel-uso-valor">12,5 s<\/span><\/div><p><span class="status-pill good">Cumple<\/span> Objetivo: ≤ 15 s<\/p>/);
  assert.match(elements.panelUsoDesde.textContent, /^Datos desde el \d{2}\/\d{2}\/\d{4}, solo en este móvil\.$/);
  elements.panelUsoMinutos.value = "abc";
  elements.panelUsoForm.listeners.submit[0]({ preventDefault() {} });
  assert.match(elements.panelUsoMinutosEstado.textContent, /entre 0 y 600/);
  elements.panelUsoMinutos.value = "8";
  elements.panelUsoForm.listeners.submit[0]({ preventDefault() {} });
  assert.equal(elements.panelUsoMinutosEstado.textContent, "Esta semana: 8 min.");
  assert.equal(Object.values(JSON.parse(store["usage-days"]).minutes)[0], 8);
  panel.noteFreshness({ ageDays: 0, balanceMode: "manual" });
  assert.equal(Object.values(JSON.parse(store["usage-days"]).days)[0].freshAge, 0);
});
