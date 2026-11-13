// FX-14 · el mes en curso al ritmo real (XPR-04). Movimientos FICTICIOS: un hogar inventado que gasta más a principio de mes (el súper
// grande tras la nómina) y un poco cada día. El motor estima el cierre del gasto variable con el perfil de sus meses pasados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../canonical-variable-pace.js");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const isVariable = (t) => t.section === "Gastos variables";
const pad = (n) => String(n).padStart(2, "0");
const daysIn = (key) => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).getUTCDate();

/** Un mes inventado: 200 € el día 2 (súper grande), `diario` € cada día y un recibo fijo (no variable) el 5. */
function mes(key, { diario = 15, grande = 200, hasta = daysIn(key) } = {}) {
  const out = [];
  for (let d = 1; d <= hasta; d += 1) {
    out.push({ date: `${key}-${pad(d)}`, amount: -diario, section: "Gastos variables" });
    if (d === 2) out.push({ date: `${key}-${pad(d)}`, amount: -grande, section: "Gastos variables" });
    if (d === 5) out.push({ date: `${key}-${pad(d)}`, amount: -750, section: "Vivienda" });
  }
  return out;
}

test("FX-14 · sin 3 meses completos no hay estimación; el mes sin extracto siguiente no cuenta como completo", () => {
  const dos = [...mes("2026-09"), ...mes("2026-10"), ...mes("2026-11", { hasta: 11 })];
  const r = P.estimate(dos, { monthKey: "2026-11", isVariable, today: "2026-11-11" });
  assert.equal(r.ready, false);
  assert.equal(r.reason, "pocos-meses");
  assert.equal(r.monthsUsed, 2);
  // Octubre sin noviembre detrás no está completo: con jul-oct y sin nada de noviembre, solo jul-sep cuentan.
  const sinNov = [...mes("2026-07"), ...mes("2026-08"), ...mes("2026-09"), ...mes("2026-10")];
  assert.equal(P.profile(sinNov, { monthKey: "2026-11", isVariable }).count, 3);
  assert.equal(P.estimate(sinNov, { monthKey: "2026-11", isVariable, today: "2026-11-11" }).reason, "sin-extracto");
});

test("FX-14 · al mismo ritmo que los meses pasados, el cierre estimado es el de esos meses; más rápido, más alto, y nunca por debajo de lo gastado", () => {
  const pasado = [...mes("2026-07"), ...mes("2026-08"), ...mes("2026-09"), ...mes("2026-10")];
  const igual = P.estimate([...pasado, ...mes("2026-11", { hasta: 11 })], { monthKey: "2026-11", isVariable, today: "2026-11-11" });
  assert.equal(igual.ready, true);
  assert.equal(igual.monthsUsed, 4);
  assert.equal(igual.asOfDay, 11);
  assert.equal(igual.spent, 200 + 11 * 15);
  // Noviembre tiene 30 días: el perfil de meses de 31 y 30 días da un cierre entre 30 y 31 días de 15 € más los 200.
  assert.ok(igual.projected > 200 + 30 * 15 - 15 && igual.projected < 200 + 31 * 15 + 15, `cierre ${igual.projected}`);
  assert.ok(igual.low <= igual.projected && igual.projected <= igual.high);
  assert.ok(igual.error15 !== null && igual.error15 < 0.05, `acierto del día 15: ${igual.error15}`);
  // Gastando 25 € al día en vez de 15, el cierre sube y el plan queda por debajo.
  const rapido = P.estimate([...pasado, ...mes("2026-11", { hasta: 11, diario: 25 })], { monthKey: "2026-11", isVariable, today: "2026-11-11" });
  assert.ok(rapido.projected > igual.projected + 100);
  assert.equal(P.versusPlan(rapido, 650).status, "por-encima");
  assert.equal(P.versusPlan(igual, 650).status, "en-linea");
  assert.equal(P.versusPlan(igual, 900).status, "por-debajo");
  assert.ok(rapido.projected >= rapido.spent);
});

test("FX-14 · el extracto que va atrás manda sobre hoy, y demasiado pronto no se estima", () => {
  const pasado = [...mes("2026-07"), ...mes("2026-08"), ...mes("2026-09"), ...mes("2026-10")];
  // Hoy es 20 pero el extracto llega al 11: se estima con el día 11, no con el 20 (si no, parecería que se gasta menos).
  const atras = P.estimate([...pasado, ...mes("2026-11", { hasta: 11 })], { monthKey: "2026-11", isVariable, today: "2026-11-20" });
  assert.equal(atras.asOfDay, 11);
  const pronto = P.estimate([...pasado, ...mes("2026-11", { hasta: 3 })], { monthKey: "2026-11", isVariable, today: "2026-11-03" });
  assert.equal(pronto.ready, false);
  assert.equal(pronto.reason, "pronto");
});

test("FX-14 · las devoluciones restan, lo que no es variable no cuenta y la banda sale de ensayos con el perfil de los demás meses", () => {
  const pasado = [...mes("2026-07", { grande: 100 }), ...mes("2026-08", { grande: 300 }), ...mes("2026-09"), ...mes("2026-10", { grande: 250 })];
  const nov = [...mes("2026-11", { hasta: 11 }), { date: "2026-11-09", amount: 40, section: "Gastos variables" }, { date: "2026-11-10", amount: -2000, section: "Coche" }];
  const r = P.estimate([...pasado, ...nov], { monthKey: "2026-11", isVariable, today: "2026-11-11" });
  assert.equal(r.spent, 200 + 11 * 15 - 40);
  assert.ok(r.high - r.low > 10, "con meses distintos, la banda tiene anchura");
  assert.ok(r.low >= r.spent);
});

test("FX-14 · motor puro, enganchado en Plan › Mes y en la Previsión nueva, y la cifra prudente sigue mandando", () => {
  const root = path.resolve(__dirname, "..");
  const fuente = fs.readFileSync(path.join(root, "canonical-variable-pace.js"), "utf8");
  assert.doesNotMatch(fuente, /document\.|window\.|localStorage|fetch\(/);
  const plan = fs.readFileSync(path.join(root, "views/plan-v2.js"), "utf8");
  assert.match(plan, /FinanceCanonicalVariablePace/);
  assert.match(plan, /planV2RitmoVariableHtml\(today, monthKey\)/);
  const prevision = fs.readFileSync(path.join(root, "views/prevision-v2.js"), "utf8");
  assert.match(prevision, /\$\{previsionV2RitmoHtml\(\{ rows, today \}\)\}/);
  // La previsión no se toca: el motor diario y actualAwareInfo no lo usan.
  assert.doesNotMatch(codigoApp(), /FinanceCanonicalVariablePace/);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /canonical-variable-pace\.js\?v=/);
});
