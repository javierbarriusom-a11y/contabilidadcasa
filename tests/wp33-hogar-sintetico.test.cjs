const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const viability = require("../canonical-charge-day-viability.js");
const chargeDays = require("../canonical-charge-days.js");

// WP-33 (NTC-02): el generador de un hogar ficticio con la verdad conocida (tools/build-synthetic-household.mjs) y lo que permite medir hoy,
// sin esperar a datos reales: la exactitud de la inferencia del día de cargo (WP-04 / WP-08) y un banco de pruebas para la calibración de
// bandas P10-P90 (WP-16). Los umbrales de abajo salen de MEDIR el motor actual sobre 300 semillas (no de lo que se querría que acertase) y
// documentan sus límites conocidos; si una mejora del motor sube la cifra, las pruebas siguen valiendo, y si lo empeora, fallan.

let gen;
test.before(async () => {
  gen = await import("../tools/build-synthetic-household.mjs");
});

const SEEDS = 300;

// Clasifica cada partida de SEEDS hogares con `months` meses y recuenta, por tipo de verdad, qué decide la inferencia.
function measure(months) {
  const stats = {};
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const household = gen.generateHousehold({ seed, months });
    const result = viability.analyze(household.observations);
    const suggested = chargeDays.suggestions(household.observations, result.partidas);
    for (const partida of result.partidas) {
      const truth = household.truth[partida.key];
      const row = (stats[truth.kind] ||= { n: 0, fiable: 0, variable: 0, regla: 0, insuficiente: 0, dayWithinOne: 0, dayExact: 0, sugFiable: 0, sugFiableWithinOne: 0, sugVisto: 0 });
      row.n += 1;
      row[partida.status] += 1;
      if (partida.status === "fiable" && truth.day !== null) {
        if (Math.abs(partida.day - truth.day) <= 1) row.dayWithinOne += 1;
        if (partida.day === truth.day) row.dayExact += 1;
      }
      const suggestion = suggested[partida.key];
      if (suggestion?.kind === "fiable") {
        row.sugFiable += 1;
        if (truth.day !== null && Math.abs(suggestion.day - truth.day) <= 1) row.sugFiableWithinOne += 1;
      } else if (suggestion) {
        row.sugVisto += 1;
      }
    }
  }
  return stats;
}

const rate = (count, total) => count / total;

// ---- El generador ----
test("determinista: la misma semilla da el mismo hogar; otra semilla, otro", () => {
  const a = gen.generateHousehold({ seed: 42, months: 12 });
  const b = gen.generateHousehold({ seed: 42, months: 12 });
  const c = gen.generateHousehold({ seed: 43, months: 12 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.observations, c.observations);
  assert.deepEqual(a.truth, b.truth);
});

test("forma: una observación por partida y mes, meses consecutivos (también al cruzar de año), importes positivos y días válidos", () => {
  const household = gen.generateHousehold({ seed: 7, months: 4, start: "2025-11" });
  assert.deepEqual(household.months, ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.equal(household.observations.length, household.partidas.length * 4);
  household.observations.forEach((item) => {
    assert.ok(item.amount > 0, "importe positivo");
    assert.ok(item.day === null || (Number.isInteger(item.day) && item.day >= 1 && item.day <= 28), `día válido: ${item.day}`);
    assert.ok(household.months.includes(item.month));
    assert.ok(household.truth[item.key]);
  });
  assert.deepEqual(Object.keys(household.truth).sort(), household.partidas.map((partida) => partida.key).sort());
});

test("cada tipo de partida cumple su verdad conocida en los datos que genera", () => {
  const household = gen.generateHousehold({ seed: 9, months: 24 });
  const days = (key) => household.observations.filter((item) => item.key === key).map((item) => item.day);
  assert.ok(days("sint-alquiler").every((day) => day === 1), "fijo: siempre el mismo día");
  assert.ok(days("sint-luz").every((day) => Math.abs(day - 12) <= 1), "casi-fijo: a ±1 del día base");
  assert.ok(new Set(days("sint-luz")).size >= 2, "casi-fijo: varía de verdad");
  assert.ok(new Set(days("sint-errat-1")).size > 10, "errático: repartido por el mes");
  const medias = days("sint-medias-1");
  assert.ok(medias.some((day) => day === null) && medias.some((day) => day === 15), "a medias: unos meses se encuentra y otros no");
  assert.ok(household.observations.filter((item) => item.key === "sint-regla-1").every((item) => item.rule === true && item.day === null), "regla: la fija el extracto");
});

test("sobresaltos conocidos: en el mes con sobresalto cada importe vale el triple y los días no cambian", () => {
  const base = gen.generateHousehold({ seed: 11, months: 6 });
  const shocked = gen.generateHousehold({ seed: 11, months: 6, shockMonths: [2] });
  base.observations.forEach((item, index) => {
    const other = shocked.observations[index];
    assert.equal(other.day, item.day, "el sobresalto no mueve los días");
    const month = base.months.indexOf(item.month);
    if (month === 2) assert.ok(Math.abs(other.amount - item.amount * 3) <= 0.02, `${item.key}: ${other.amount} ≈ 3 × ${item.amount}`);
    else assert.equal(other.amount, item.amount);
  });
});

test("entradas inválidas fallan con un mensaje claro", () => {
  assert.throws(() => gen.generateHousehold({ months: 0 }), /months/);
  assert.throws(() => gen.generateHousehold({ months: 121 }), /months/);
  assert.throws(() => gen.generateHousehold({ months: 2.5 }), /months/);
  assert.throws(() => gen.generateHousehold({ partidas: [{ key: "x", label: "X", kind: "inventado", day: 1, mean: 1, sd: 0 }] }), /tipo de partida desconocido/);
});

test("privacidad: todo es ficticio, con nombres genéricos y sin nada que se parezca a un dato real", () => {
  const household = gen.generateHousehold({ seed: 1, months: 3 });
  household.partidas.forEach((partida) => assert.match(partida.label, /fictici|errátic|a medias|con regla/i, partida.label));
  assert.ok(gen.DEFAULT_PARTIDAS.length >= 10);
  assert.deepEqual([...gen.KINDS], ["fijo", "casi-fijo", "erratico", "a-medias", "regla"]);
});

test("línea de órdenes: imprime un resumen JSON y no escribe nada", () => {
  const run = spawnSync(process.execPath, [path.join(root, "tools", "build-synthetic-household.mjs"), "--seed", "3", "--months", "6"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const summary = JSON.parse(run.stdout);
  assert.equal(summary.seed, 3);
  assert.equal(summary.months, 6);
  assert.equal(summary.observations, summary.partidas * 6);
});

// ---- Exactitud de la inferencia del día de cargo (WP-04 / WP-08), medida con verdad conocida ----
test("ND-03 · lo regular y lo fijado por regla se reconoce siempre, con ≥ 3 meses de historia", () => {
  [3, 6, 12, 24].forEach((months) => {
    const stats = measure(months);
    assert.equal(stats.fijo.fiable, stats.fijo.n, `${months} meses: toda partida fija sale «fiable»`);
    assert.equal(stats.fijo.dayExact, stats.fijo.n, `${months} meses: con el día exacto`);
    assert.equal(stats.regla.regla, stats.regla.n, `${months} meses: toda partida con regla sale «regla»`);
    assert.equal(stats.regla.sugFiable + stats.regla.sugVisto, 0, "y no se le propone ningún día");
  });
});

test("ND-03 · lo errático nunca se vende como fiable con historia suficiente; con 3 meses se equivoca poco", () => {
  assert.equal(measure(12).erratico.fiable, 0, "con 12 meses: ninguna errática sale «fiable»");
  assert.equal(measure(24).erratico.fiable, 0);
  const three = measure(3).erratico;
  assert.ok(rate(three.fiable, three.n) <= 0.05, `con 3 meses, errática «fiable» por azar: ${three.fiable}/${three.n} (medido 1,7 %)`);
});

test("ND-03 · el cargo que casi siempre cae a ±1 día necesita meses: con pocos, la inferencia se abstiene más de lo debido (límite conocido)", () => {
  const recall = (months) => {
    const row = measure(months)["casi-fijo"];
    return rate(row.fiable, row.n);
  };
  const three = recall(3);
  const twelve = recall(12);
  const twentyFour = recall(24);
  assert.ok(three >= 0.7, `3 meses: ${(three * 100).toFixed(1)} % de las partidas a ±1 salen «fiable» (medido ≈ 77 %)`);
  assert.ok(three < 0.9, "con 3 meses sigue habiendo un hueco real: así se documenta, no se esconde");
  assert.ok(twelve >= 0.97, `12 meses: ${(twelve * 100).toFixed(1)} % (medido ≈ 99,3 %)`);
  assert.equal(twentyFour, 1, "24 meses: todas");
  assert.ok(three < twelve && twelve <= twentyFour, "más historia, más acierto");
});

test("ND-03 · cuando dice «fiable», el día está a ±1 de la verdad y la propuesta de WP-08 igual (nunca propone un día lejano como fiable)", () => {
  [3, 12].forEach((months) => {
    const stats = measure(months);
    ["fijo", "casi-fijo"].forEach((kind) => {
      assert.equal(stats[kind].dayWithinOne, stats[kind].fiable, `${months} meses · ${kind}: todo «fiable» está a ±1`);
      assert.equal(stats[kind].sugFiableWithinOne, stats[kind].sugFiable, `${months} meses · ${kind}: toda propuesta «fiable» está a ±1`);
    });
  });
});

test("ND-03 · el cargo que solo se encuentra la mitad de los meses: con 3 meses 1 de cada 8 parece fiable por azar; con historia, casi nunca", () => {
  const fiableRate = (months) => {
    const row = measure(months)["a-medias"];
    return rate(row.fiable, row.n);
  };
  assert.ok(fiableRate(3) <= 0.2, `3 meses: ${(fiableRate(3) * 100).toFixed(1)} % (esperado ≈ 12,5 % por azar: encontrarlo en los tres meses; medido 13,7 %)`);
  assert.ok(fiableRate(12) <= 0.05, "12 meses: ≤ 5 %");
  assert.ok(fiableRate(24) <= 0.02, "24 meses: ≤ 2 %");
});

test("WP-08 · lo que no es «fiable» recibe como propuesta el último día visto, nunca una afirmación de fiabilidad", () => {
  const stats = measure(12);
  assert.equal(stats.erratico.sugFiable, 0);
  assert.equal(stats.erratico.sugVisto, stats.erratico.n, "toda errática lleva su último día visto");
});

// ---- Banco de pruebas de calibración de bandas (para WP-16) ----
test("calibración · la banda P10-P90 verdadera contiene la realidad ≈ 80 % de las veces", () => {
  [{ mean: 80, sd: 22 }, { mean: 900, sd: 120 }, { mean: 45, sd: 5 }].forEach((partida, index) => {
    const realities = gen.sampleAmounts({ seed: 100 + index, ...partida, count: 20000 });
    const band = gen.trueBand(partida);
    const covered = gen.coverage(realities.map(() => band), realities);
    assert.ok(covered > 0.78 && covered < 0.82, `${JSON.stringify(partida)}: cobertura ${covered}`);
  });
});

test("calibración · el banco detecta una banda mal calibrada (demasiado estrecha, demasiado ancha o sesgada)", () => {
  const partida = { mean: 80, sd: 22 };
  const realities = gen.sampleAmounts({ seed: 5, ...partida, count: 20000 });
  const band = gen.trueBand(partida);
  const coverageOf = (shape) => gen.coverage(realities.map(() => shape), realities);
  assert.ok(coverageOf({ low: partida.mean - 0.5 * partida.sd, high: partida.mean + 0.5 * partida.sd }) < 0.5, "estrecha: cubre mucho menos del 80 %");
  assert.ok(coverageOf({ low: partida.mean - 3 * partida.sd, high: partida.mean + 3 * partida.sd }) > 0.95, "ancha: cubre casi todo");
  assert.ok(coverageOf({ low: band.low + partida.sd, high: band.high + partida.sd }) < 0.7, "sesgada una desviación: cubre claramente menos");
});

test("calibración · coverage valida sus entradas", () => {
  assert.throws(() => gen.coverage([], []), /misma longitud/);
  assert.throws(() => gen.coverage([{ low: 0, high: 1 }], [1, 2]), /misma longitud/);
  assert.equal(gen.coverage([{ low: 0, high: 1 }, { low: 0, high: 1 }], [0.5, 2]), 0.5);
});
