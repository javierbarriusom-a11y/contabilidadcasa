const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const Q = require("../canonical-data-queue.js");

// WP-45 (ND-09 + CAP-07): frescura por fuente y cola de tareas de datos por «euros de incertidumbre por minuto». Lo que el hogar debe poder fiar: que una tarea sin estimación no se
// ordene con un euro inventado, que un tiempo supuesto no se presente como medido, y que dos tareas que resuelven lo mismo no cuenten dos veces.

const today = "2026-10-20";
const task = (id, uncertainty, seconds, extra = {}) => ({ id, label: id, uncertainty, minutes: { value: seconds / 60, measured: true, samples: 5 }, ...extra });

test("WP-45 · la ficha de frescura dice la edad con tono, icono y texto, y «sin dato» no es «al día»", () => {
  const f = (lastDate, extra = {}) => Q.freshnessCard({ id: "x", label: "Fuente", lastDate, today, staleAfterDays: 4, ...extra });
  assert.deepEqual([f("2026-10-20").tone, f("2026-10-20").ageText, f("2026-10-20").icon], ["current", "hoy", "✓"]);
  assert.deepEqual([f("2026-10-19").tone, f("2026-10-19").ageText], ["current", "ayer"]);
  assert.deepEqual([f("2026-10-18").tone, f("2026-10-18").ageText, f("2026-10-18").icon, f("2026-10-18").status], ["recent", "hace 2 días", "◐", "Reciente"]);
  assert.deepEqual([f("2026-10-16").tone, f("2026-10-16").icon, f("2026-10-16").status], ["stale", "⚠", "Antiguo"]);
  assert.deepEqual([f(null).tone, f(null).icon, f(null).ageText], ["unknown", "?", "sin dato"]);
  assert.equal(f("basura").tone, "unknown");
  assert.equal(Q.freshnessCard({ lastDate: "2026-10-19", today, staleAfterDays: 35, expired: true }).tone, "stale", "un índice caducado lo es aunque sea de ayer");
  assert.equal(Q.freshnessCard({ lastDate: "2026-10-19", today: "", staleAfterDays: 4 }).tone, "unknown", "sin la fecha de hoy no se sabe");
});

test("WP-45 · la estimación de lo que puede haberse movido es gasto diario × días con tope, y sin gasto o sin fecha no hay estimación", () => {
  assert.deepEqual(Q.unloggedEstimate({ dailyOutflow: 150, ageDays: 4 }), { value: 600, capped: false, days: 4 });
  assert.deepEqual(Q.unloggedEstimate({ dailyOutflow: 150, ageDays: 90 }), { value: 4500, capped: true, days: 30 });
  assert.equal(Q.unloggedEstimate({ dailyOutflow: null, ageDays: 4 }).value, null);
  assert.equal(Q.unloggedEstimate({ dailyOutflow: 150, ageDays: null }).value, null);
  assert.equal(Q.unloggedEstimate({ dailyOutflow: 0, ageDays: 4 }).value, null);
  assert.equal(Q.unloggedEstimate({ dailyOutflow: 150, ageDays: 0 }).value, 0, "hoy mismo: cero movimientos posibles, un dato legítimo");
});

test("WP-45 · el tiempo es la mediana medida con ≥ 3 usos; con menos, el supuesto marcado como no medido", () => {
  const medido = Q.taskMinutes({ measuredSeconds: [30, 18, 24, 20], assumedMinutes: 5 });
  assert.deepEqual(medido, { value: 0.37, measured: true, samples: 4 }, "mediana de 18, 20, 24, 30 = 22 s");
  const poco = Q.taskMinutes({ measuredSeconds: [18, 20], assumedMinutes: 2 });
  assert.deepEqual(poco, { value: 2, measured: false, samples: 2 });
  assert.equal(Q.taskMinutes({ measuredSeconds: [-5, 0, "x", NaN], assumedMinutes: 1 }).measured, false);
  assert.ok(Q.taskMinutes({ assumedMinutes: 0 }).value > 0, "nunca un tiempo cero (dividiría por cero)");
});

test("WP-45 · la cola se ordena por incertidumbre por minuto, no por incertidumbre a secas", () => {
  const q = Q.buildQueue({ tasks: [task("grande-lenta", 1200, 600), task("pequena-rapida", 300, 20), task("media", 500, 120)] });
  assert.deepEqual(q.ranked.map((t) => t.id), ["pequena-rapida", "media", "grande-lenta"], "300 €/20 s = 900 €/min; 500/2 = 250; 1.200/10 = 120");
  assert.equal(q.ranked[0].valuePerMinute, 900);
  assert.deepEqual(q.ranked.map((t) => t.rank), [1, 2, 3]);
});

test("WP-45 · lo que no se sabe estimar va aparte con su motivo y no entra en el orden", () => {
  const q = Q.buildQueue({ tasks: [task("saldos", 600, 20), task("cartera", null, 60, { reasonUnknown: "Sin volatilidad medida." }), task("indices", 0, 60), { id: "raro" }] });
  assert.deepEqual(q.ranked.map((t) => t.id), ["saldos"]);
  assert.deepEqual(q.unestimated.map((t) => t.id), ["cartera", "indices", "raro"]);
  assert.equal(q.unestimated[0].reason, "Sin volatilidad medida.");
  assert.match(q.unestimated[2].reason, /No sé cuánto/);
  assert.equal(q.unestimated.every((t) => t.uncertainty === null), true, "nunca un euro inventado");
});

test("WP-45 · las tareas con plazo van aparte y no se ordenan por euros", () => {
  const q = Q.buildQueue({ tasks: [{ id: "cierre", label: "Cerrar el mes", deadline: "Hasta el día 3", minutes: { value: 3, measured: false } }, task("saldos", 600, 20)] });
  assert.deepEqual(q.deadlines.map((t) => t.id), ["cierre"]);
  assert.deepEqual(q.ranked.map((t) => t.id), ["saldos"]);
  assert.equal(q.allClear, false);
});

test("WP-45 · el plan llena el presupuesto en orden de valor por minuto y dice cuánto resuelve", () => {
  const q = Q.buildQueue({ budgetMinutes: 3, tasks: [task("a", 900, 30), task("b", 400, 120), task("c", 5000, 600)] });
  assert.deepEqual(q.plan.ids, ["a", "b"], "c no cabe en 3 minutos");
  assert.equal(q.plan.minutes, 2.5);
  assert.equal(q.plan.resolved, 1300);
  assert.equal(q.plan.total, 6300);
  const sinPresupuesto = Q.buildQueue({ budgetMinutes: 0, tasks: [task("a", 900, 30)] });
  assert.deepEqual(sinPresupuesto.plan.ids, []);
});

test("WP-45 · dos tareas de la misma familia no suman dos veces, y una tarea que otra absorbe no se repite", () => {
  const tasks = [
    task("saldos", 600, 20, { family: "cuentas" }),
    task("extracto", 900, 120, { family: "cuentas", absorbs: ["saldos"] }),
  ];
  const q = Q.buildQueue({ budgetMinutes: 5, tasks });
  assert.deepEqual(q.plan.ids, ["extracto"], "importar el extracto ya resuelve el saldo");
  assert.equal(q.plan.resolved, 900, "no 1.500");
  assert.equal(q.plan.total, 900);
  assert.equal(q.plan.minutes, 2, "el tiempo de la tarea absorbida se libera");
  assert.equal(q.ranked.find((t) => t.id === "saldos").absorbed, true);
  const sinAbsorcion = Q.buildQueue({ budgetMinutes: 5, tasks: tasks.map((t) => ({ ...t, absorbs: [] })) });
  assert.equal(sinAbsorcion.plan.resolved, 900, "misma familia: cuenta solo la mayor");
});

test("WP-45 · una tarea que no añade nada a lo que su familia ya resuelve no entra en el plan", () => {
  const q = Q.buildQueue({ budgetMinutes: 5, tasks: [task("saldos", 900, 20, { family: "cuentas" }), task("extracto", 600, 120, { family: "cuentas", absorbs: ["saldos"] })] });
  assert.deepEqual(q.plan.ids, ["saldos"], "el pulso de 20 s ya quita los 900 €: importar el extracto, que quita menos, sobra");
  assert.equal(q.plan.resolved, 900);
  assert.equal(q.plan.minutes, 0.33);
  assert.equal(q.ranked.find((t) => t.id === "extracto").absorbed, false);
});

test("WP-45 · avisa si el plan usa algún tiempo que no está medido", () => {
  const medido = Q.buildQueue({ tasks: [task("a", 500, 20)] });
  assert.equal(medido.plan.anyUnmeasured, false);
  const supuesto = Q.buildQueue({ tasks: [{ id: "b", label: "b", uncertainty: 500, minutes: { value: 0.33, measured: false, samples: 0 } }] });
  assert.equal(supuesto.plan.anyUnmeasured, true);
});

test("WP-45 · sin tareas ni plazos, todo al día", () => {
  assert.equal(Q.buildQueue({ tasks: [] }).allClear, true);
  assert.equal(Q.buildQueue({ tasks: [task("indices", null, 60)] }).allClear, true, "lo no estimable no es una tarea útil que ofrecer");
  assert.equal(Q.buildQueue().ranked.length, 0);
});

test("WP-45 · el motor es puro: ni DOM, ni red, ni almacenamiento, ni reloj", () => {
  const source = read("canonical-data-queue.js");
  assert.doesNotMatch(source, /\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest|indexedDB)\b/);
  assert.doesNotMatch(source, /new Date\(|Date\.now/);
});
