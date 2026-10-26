const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../canonical-data-contracts.js");
const fep = require("../funciones-en-prueba.js");
const medidor = require("../medidor-utilidad.js");

// XDA-01 · PR-1 «Lo que la app te pide» (docs/XDA01_DISENO.md): cada función declara qué datos pide y cada cuánto; el motor suma lo que cuesta
// darlos a la semana (cada fuente una vez) frente al presupuesto de 10 min (GOV-01) y dice qué funciones tienen hambre. Sobre WP-45. Nace
// apagada en Funciones en prueba. La e2e de qa1 recorre la tarjeta.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fresh = (tone, extra = {}) => ({ tone, status: tone === "current" ? "Al día" : "Antiguo", ageText: "hace 9 días", action: { label: "Ir", href: "#x" }, ...extra });
const allFresh = Object.fromEntries(Object.keys(C.SOURCES).map((id) => [id, fresh("current")]));

test("el registro: cada función pide fuentes que existen, con cadencia en días, y lleva a su pantalla", () => {
  assert.equal(C.BUDGET_MINUTES, 10, "GOV-01");
  C.FUNCTIONS.forEach((fn) => {
    assert.match(fn.href, /^#[a-z-]+$/, fn.id);
    assert.ok(fn.needs.length > 0, fn.id);
    fn.needs.forEach((need) => {
      assert.ok(C.SOURCES[need.source], `${fn.id}: ${need.source}`);
      assert.ok(Number.isInteger(need.everyDays) && need.everyDays > 0, `${fn.id}: ${need.source}`);
    });
  });
  Object.values(C.SOURCES).forEach((source) => assert.ok(Number.isInteger(source.assumedSeconds) && source.assumedSeconds > 0 && source.label));
});

test("el total cuenta cada fuente una vez, con la cadencia más exigente; la función, lo suyo", () => {
  const r = C.evaluate({ freshness: allFresh, minutes: { balances: { value: 0.5, measured: true }, statement: { value: 2, measured: true } }, aplica: {} });
  const hoy = r.functions.find((fn) => fn.id === "hoy");
  assert.equal(hoy.needs.find((need) => need.source === "balances").weeklyMinutes, 0.88, "0,5 min cada 4 días");
  const saldos = r.sources.find((source) => source.source === "balances");
  assert.deepEqual([saldos.everyDays, saldos.weeklyMinutes], [4, 0.88], "Hoy (cada 4 días) manda sobre Previsión (cada semana)");
  const extracto = r.sources.find((source) => source.source === "statement");
  assert.deepEqual([extracto.everyDays, extracto.weeklyMinutes], [7, 2], "Movimientos y Previsión lo piden cada semana; Cierre, cada mes: cuenta una vez");
  const expected = r.sources.reduce((sum, source) => sum + source.weeklyMinutes, 0);
  assert.equal(r.totalMinutes, Math.round(expected * 10) / 10);
  assert.ok(r.totalMinutes < r.functions.reduce((sum, fn) => sum + fn.weeklyMinutes, 0), "sumar función a función contaría dos veces");
  assert.equal(r.measured, false, "cobros y cierre siguen supuestos: el total no es medido");
  assert.equal(r.overBudget, false);
  assert.equal(r.hungryCount, 0);
});

test("sin cartera ni índices, no hay valoración ni revisión de la hipoteca que pedir; con ellas, sí", () => {
  const sin = C.evaluate({ freshness: allFresh, aplica: {} });
  assert.deepEqual(sin.functions.map((fn) => fn.id).sort(), ["cierre", "hoy", "movimientos", "patrimonio", "prevision"]);
  assert.ok(!sin.sources.some((source) => source.source === "valuation"), "Patrimonio sin cartera no pide valoración");
  const con = C.evaluate({ freshness: allFresh, aplica: { cartera: true, indices: true } });
  assert.ok(con.functions.some((fn) => fn.id === "cartera") && con.functions.some((fn) => fn.id === "hipoteca"));
  assert.deepEqual(con.functions.find((fn) => fn.id === "patrimonio").needs.map((need) => need.source), ["close", "valuation"]);
});

test("hambre: un dato antiguo o que nunca llegó; primero las que tienen hambre, y el minuto supuesto se dice", () => {
  const r = C.evaluate({ freshness: { ...allFresh, statement: fresh("stale", { status: "Antiguo" }), close: { tone: "unknown" } }, aplica: {} });
  assert.ok(r.functions.slice(0, 4).every((fn) => fn.hungry), "las cuatro con hambre van delante");
  assert.equal(r.functions.at(-1).id, "hoy", "Hoy está al día: al final");
  const cierre = r.functions.find((fn) => fn.id === "cierre");
  assert.deepEqual(cierre.missing.map((need) => need.source), ["statement", "close"]);
  assert.equal(cierre.missing[1].status, "Sin dato", "una fuente sin ficha cuenta como sin dato");
  assert.equal(r.hungryCount, 4);
  assert.equal(cierre.measured, false);
  const sinFichas = C.evaluate({});
  assert.equal(sinFichas.hungryCount, sinFichas.functions.length, "sin ninguna ficha, todas tienen hambre: no se finge que algo está al día");
});

test("el presupuesto se dice, y pasarse también", () => {
  const caro = C.evaluate({ freshness: allFresh, minutes: { statement: { value: 30, measured: true } }, aplica: {} });
  assert.equal(caro.overBudget, true);
  assert.match(C.sentence(caro), /Se pasa del presupuesto\./);
  const r = C.evaluate({ freshness: allFresh, aplica: {} });
  assert.match(C.sentence(r), /^Lo que piden las funciones que usáis: unos [\d,]+ min a la semana \(con minutos supuestos donde aún no hay nada medido\), frente a un presupuesto de 10 min\. Ninguna tiene hambre/);
  assert.equal(C.everyText(7), "cada semana");
  assert.equal(C.everyText(30), "cada mes");
  assert.equal(C.everyText(4), "cada 4 días");
  assert.equal(C.minutesText(2.345), "2,3 min");
  assert.equal(C.minutesText(0.04), "menos de 0,1 min");
});

test("nace apagada en Funciones en prueba, el medidor la cuenta y la tarjeta solo se enciende con su interruptor", () => {
  const item = fep.CATALOGO.find((entry) => entry.id === "lo-que-pide");
  assert.equal(item.interruptor, "propio");
  assert.match(item.metrica, /dos meses/, "con su criterio de retirada");
  assert.equal(fep.encendida("lo-que-pide", { getItem: () => null }), false);
  assert.deepEqual(medidor.FUNCIONES.find((f) => f.id === "lo-que-pide").accion, ["dato buscado desde aquí", "datos buscados desde aquí"]);
  const html = read("index.html");
  assert.match(html, /<article class="e19-card lqp-card" id="loQuePideCard" aria-labelledby="loQuePideTitulo" hidden>/, "oculta por defecto: XGO-01 no cuenta nada nuevo");
  assert.match(html, /<script defer src="canonical-data-contracts\.js\?v=[^"]+"><\/script>/);
  assert.match(html, /<script defer src="lo-que-pide-ui\.js\?v=[^"]+"><\/script>/);
  for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) {
    assert.ok(read(file).includes("canonical-data-contracts.js") && read(file).includes("lo-que-pide-ui.js"), file);
  }
  assert.match(read("app.js"), /globalThis\.renderLoQuePide\?\.\(globalThis\.FinanceCanonicalDataContracts\)/);
  const ui = read("lo-que-pide-ui.js");
  assert.match(ui, /card\.hidden = !on;/);
  assert.match(ui, /datosSources\(today\)/, "reutiliza WP-45, no lo reimplementa");
});
