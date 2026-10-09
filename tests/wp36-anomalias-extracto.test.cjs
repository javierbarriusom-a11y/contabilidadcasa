const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = require(path.join(root, "canonical-statement-anomalies.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const TODAY = "2026-10-08";

// WP-36 (ND-07): anomalías del extracto. Detector puro sobre los movimientos ya importados: lo que más importa es lo que NO marca (falsos positivos
// < 20 %) y que nunca actúa: solo enseña con su evidencia y deja responder «real», «es normal» o «es normal siempre».

let counter = 0;
const tx = (date, amount, movement, over = {}) => ({
  date, month: date.slice(0, 7), amount, movement, details: "", accountId: "caixabank", balance: 1000 + (counter += 1),
  mapping: { status: "classified", rowKey: "expense|gasto" }, ...over,
});

// Seis meses de historia tranquila: una suscripción, un súper a ratos y el alquiler. Termina el 2026-09-20.
function history() {
  const rows = [];
  for (const month of ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]) {
    rows.push(tx(`${month}-01`, -900, "RECIBO ALQUILER FICTICIO", { mapping: { status: "classified", rowKey: "expense|alquiler" } }));
    rows.push(tx(`${month}-05`, -12.99, "SUSCRIPCION FICTICIA", { mapping: { status: "classified", rowKey: "expense|suscripcion" } }));
    rows.push(tx(`${month}-10`, -52, "COMPRA TARJ SUPER FICTICIO", { mapping: { status: "classified", rowKey: "expense|super" } }));
    rows.push(tx(`${month}-20`, -48, "COMPRA TARJ SUPER FICTICIO", { mapping: { status: "classified", rowKey: "expense|super" } }));
  }
  return rows;
}
const detect = (extra = [], over = {}) => engine.detect({ today: TODAY, transactions: [...history(), ...extra], ...over });
const kinds = (result) => result.items.map((item) => item.kind);

test("WP-36 · sin la fecha de hoy no hay nada que decir y se dice qué falta", () => {
  const result = engine.detect({ transactions: history() });
  assert.equal(result.status, "missing");
  assert.deepEqual(result.missing, ["la fecha de hoy"]);
});

test("WP-36 · una historia tranquila no marca nada", () => {
  const result = detect([tx("2026-10-01", -900, "RECIBO ALQUILER FICTICIO", { mapping: { status: "classified", rowKey: "expense|alquiler" } }), tx("2026-10-05", -12.99, "SUSCRIPCION FICTICIA", { mapping: { status: "classified", rowKey: "expense|suscripcion" } })]);
  assert.equal(result.status, "ok");
  assert.deepEqual(result.items, []);
});

test("WP-36 · sin extracto reciente no se vigila lo reciente: el silencio no significa que todo esté bien", () => {
  const result = engine.detect({ today: "2026-12-20", transactions: history() });
  assert.equal(result.status, "stale");
  assert.equal(result.coveredUntil, "2026-09-20");
  assert.deepEqual(result.items, []);
  assert.equal(engine.detect({ today: TODAY, transactions: [] }).status, "stale");
});

test("WP-36 · cargo duplicado: el mismo importe y concepto dos veces con un día de diferencia como mucho", () => {
  const result = detect([tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA"), tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA")]);
  assert.deepEqual(kinds(result), ["duplicado"]);
  const item = result.items[0];
  assert.equal(item.amount, -45);
  assert.equal(item.date, "2026-10-03");
  assert.match(item.evidence.join(" "), /45,00 €/);
  assert.match(item.evidence.join(" "), /2 cargos/);
  const nextDay = detect([tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA"), tx("2026-10-04", -45, "COMPRA TARJ GASOLINERA FICTICIA")]);
  assert.deepEqual(kinds(nextDay), ["duplicado"]);
});

test("WP-36 · no es duplicado: dos días de diferencia, importes distintos, importes pequeños, otra cuenta o un concepto que ya se repite el mismo día", () => {
  assert.deepEqual(detect([tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA"), tx("2026-10-05", -45, "COMPRA TARJ GASOLINERA FICTICIA")]).items, []);
  assert.deepEqual(detect([tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA"), tx("2026-10-03", -45.5, "COMPRA TARJ GASOLINERA FICTICIA")]).items, []);
  assert.deepEqual(detect([tx("2026-10-03", -3.2, "COMPRA TARJ CAFETERIA FICTICIA"), tx("2026-10-03", -3.2, "COMPRA TARJ CAFETERIA FICTICIA")]).items, [], "por debajo de 5 €");
  assert.deepEqual(detect([tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA", { accountId: "mediolanum" }), tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA")]).items, [], "otra cuenta");
  const habitual = [];
  for (const month of ["2026-06", "2026-07", "2026-08", "2026-09"]) {
    habitual.push(tx(`${month}-12`, -2.4, "COMPRA TARJ BILLETE METRO FICTICIO"), tx(`${month}-12`, -2.4, "COMPRA TARJ BILLETE METRO FICTICIO"));
  }
  assert.deepEqual(detect([...habitual, tx("2026-10-03", -9.6, "COMPRA TARJ BILLETE METRO FICTICIO"), tx("2026-10-03", -9.6, "COMPRA TARJ BILLETE METRO FICTICIO")]).items, [], "ya se repite el mismo día en otros meses");
});

test("WP-36 · devolución de un recibo: lo dice con el cargo que devuelve; una devolución de compra no es una anomalía", () => {
  const result = detect([tx("2026-10-01", -62.3, "RECIBO SEGURO FICTICIO"), tx("2026-10-04", 62.3, "DEVOLUCION RECIBO SEGURO FICTICIO")]);
  assert.deepEqual(kinds(result), ["devolucion"]);
  assert.match(result.items[0].evidence.join(" "), /62,30 €/);
  assert.match(result.items[0].evidence.join(" "), /1\/10\/2026/);
  assert.deepEqual(detect([tx("2026-10-04", 20, "DEVOLUCION COMPRA TIENDA FICTICIA")]).items, []);
  assert.deepEqual(detect([tx("2026-10-04", 1500, "NOMINA FICTICIA")]).items, []);
  assert.deepEqual(kinds(detect([tx("2026-10-04", 30, "RECIBO DEVUELTO GIMNASIO FICTICIO")])), ["devolucion"], "sin el cargo original también se dice");
});

test("WP-36 · comisión nueva: una que nunca se había visto; si ya se cobraba, no", () => {
  const result = detect([tx("2026-10-02", -4.5, "COMISION MANTENIMIENTO CUENTA")]);
  assert.deepEqual(kinds(result), ["comision"]);
  assert.match(result.items[0].evidence.join(" "), /primera vez/i);
  const recurring = [];
  for (const month of ["2026-07", "2026-08", "2026-09"]) recurring.push(tx(`${month}-02`, -4.5, "COMISION MANTENIMIENTO CUENTA"));
  assert.deepEqual(detect([...recurring, tx("2026-10-02", -4.5, "COMISION MANTENIMIENTO CUENTA")]).items, []);
});

test("WP-36 · una comisión que ya se cobraba pero sube un 25 % o más se marca como subida", () => {
  const recurring = [];
  for (const month of ["2026-06", "2026-07", "2026-08", "2026-09"]) recurring.push(tx(`${month}-02`, -4.5, "COMISION MANTENIMIENTO CUENTA"));
  const result = detect([...recurring, tx("2026-10-02", -6, "COMISION MANTENIMIENTO CUENTA")]);
  assert.deepEqual(kinds(result), ["comision"]);
  assert.match(result.items[0].evidence.join(" "), /4,50 €/);
  assert.deepEqual(detect([...recurring, tx("2026-10-02", -4.9, "COMISION MANTENIMIENTO CUENTA")]).items, [], "un 9 % no es una subida");
});

test("WP-36 · con menos de tres meses de historia no se presume que una comisión sea nueva", () => {
  const short = [tx("2026-09-02", -20, "COMPRA FICTICIA"), tx("2026-09-20", -15, "COMPRA FICTICIA")];
  assert.deepEqual(engine.detect({ today: TODAY, transactions: [...short, tx("2026-10-02", -4.5, "COMISION MANTENIMIENTO CUENTA")] }).items, []);
});

test("WP-36 · recurrente fuera del plan: cuatro meses seguidos, importe estable y sin partida; con partida o inestable, no", () => {
  const gym = (status) => ["2026-07", "2026-08", "2026-09", "2026-10"].map((month) => tx(`${month}-04`, -39.9, "RECIBO GIMNASIO FICTICIO", { mapping: { status, rowKey: status === "classified" ? "expense|gimnasio" : undefined } }));
  const result = detect(gym("unclassified"));
  assert.deepEqual(kinds(result), ["recurrente"]);
  assert.match(result.items[0].evidence.join(" "), /39,90 €/);
  assert.match(result.items[0].evidence.join(" "), /sin partida/i);
  assert.deepEqual(detect(gym("classified")).items, []);
  const unstable = ["2026-07", "2026-08", "2026-09", "2026-10"].map((month, index) => tx(`${month}-04`, -[30, 55, 20, 70][index], "RECIBO GIMNASIO FICTICIO", { mapping: { status: "unclassified" } }));
  assert.deepEqual(detect(unstable).items, []);
  assert.deepEqual(detect(gym("unclassified").slice(2)).items, [], "dos meses no son un patrón");
});

test("WP-36 · importe atípico: por encima del P95 de su partida con holgura; con poca historia o poco exceso, no", () => {
  const base = history();
  const typical = detect([tx("2026-10-06", -200, "COMPRA TARJ SUPER FICTICIO", { mapping: { status: "classified", rowKey: "expense|super" } })]);
  assert.deepEqual(kinds(typical), ["atipico"]);
  assert.match(typical.items[0].evidence.join(" "), /200,00 €/);
  assert.deepEqual(detect([tx("2026-10-06", -70, "COMPRA TARJ SUPER FICTICIO", { mapping: { status: "classified", rowKey: "expense|super" } })]).items, [], "70 € no llega a P95 + 25 €");
  assert.equal(base.filter((row) => row.mapping.rowKey === "expense|alquiler").length, 6);
  assert.deepEqual(detect([tx("2026-10-06", -300, "OTRA COSA FICTICIA", { mapping: { status: "classified", rowKey: "expense|nueva" } })]).items, [], "sin historia suficiente de su partida");
});

test("WP-36 · una fila no se marca dos veces: un duplicado enorme es un duplicado, no además un atípico", () => {
  const result = detect([tx("2026-10-06", -200, "COMPRA TARJ SUPER FICTICIO"), tx("2026-10-06", -200, "COMPRA TARJ SUPER FICTICIO")]);
  assert.deepEqual(kinds(result), ["duplicado"]);
});

test("WP-36 · lo ya respondido no vuelve; «es normal siempre» calla ese patrón; la tasa de falsos positivos sale de las respuestas", () => {
  const rows = [tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA"), tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA")];
  const first = detect(rows);
  const item = first.items[0];
  const normal = engine.applyAnswer(engine.normalizeAnswers({}), item, "normal", TODAY);
  const after = detect(rows, { answers: normal });
  assert.deepEqual(after.items, []);
  assert.equal(after.suppressed, 1);
  const always = engine.applyAnswer(engine.normalizeAnswers({}), item, "normalAlways", TODAY);
  const later = detect([...rows, tx("2026-10-07", -45, "COMPRA TARJ GASOLINERA FICTICIA"), tx("2026-10-07", -45, "COMPRA TARJ GASOLINERA FICTICIA")], { answers: always });
  assert.deepEqual(later.items, [], "el mismo patrón, otra fecha: callado");
  let answers = engine.normalizeAnswers({});
  for (let index = 0; index < 10; index += 1) answers = engine.applyAnswer(answers, { ...item, id: `x${index}` }, index < 2 ? "normal" : "real", TODAY);
  const stats = detect([], { answers }).stats;
  assert.equal(stats.answered, 10);
  assert.equal(stats.normal, 2);
  assert.equal(stats.falsePositiveRate, 0.2);
  assert.equal(detect([], { answers: engine.applyAnswer(engine.normalizeAnswers({}), item, "real", TODAY) }).stats.falsePositiveRate, null, "con menos de 10 respuestas no se mide");
  assert.throws(() => engine.applyAnswer(engine.normalizeAnswers({}), item, "borrar", TODAY), /respuesta/i);
});

test("WP-36 · las respuestas se normalizan y no se mutan", () => {
  const raw = { byId: { a: { response: "normal", at: "2026-10-01" }, b: { response: "otra", at: "x" }, c: null }, silenced: { "duplicado|k": "2026-10-01", bad: 3 } };
  const snapshot = JSON.stringify(raw);
  const clean = engine.normalizeAnswers(raw);
  assert.deepEqual(Object.keys(clean.byId), ["a"]);
  assert.deepEqual(Object.keys(clean.silenced), ["duplicado|k"]);
  assert.equal(JSON.stringify(raw), snapshot);
  assert.deepEqual(engine.normalizeAnswers(null), { byId: {}, silenced: {} });
});

test("WP-36 · muestra pocas cosas, las más graves primero, y dice cuántas quedan", () => {
  const names = ["ALFA", "BRAVO", "CHARLIE", "DELTA", "ECO", "FOXTROT", "GOLF", "HOTEL"];
  const extra = [];
  names.forEach((name, index) => {
    const date = `2026-10-0${(index % 7) + 1}`;
    extra.push(tx(date, -(60 + index * 11), `COMPRA TARJ COMERCIO ${name}`), tx(date, -(60 + index * 11), `COMPRA TARJ COMERCIO ${name}`));
  });
  extra.push(tx("2026-10-04", 62.3, "DEVOLUCION RECIBO SEGURO FICTICIO"));
  const result = detect(extra);
  assert.equal(result.items.length, 6);
  assert.equal(result.overflow, 3);
  assert.equal(result.items[0].kind, "devolucion", "lo más grave, primero");
});

test("WP-36 · solo mira lo reciente: lo anterior a 45 días no se marca aunque lo parezca", () => {
  const old = [tx("2026-07-03", -45, "COMPRA TARJ GASOLINERA FICTICIA"), tx("2026-07-03", -45, "COMPRA TARJ GASOLINERA FICTICIA"), tx("2026-09-30", -5, "COMPRA FICTICIA")];
  assert.deepEqual(detect(old).items, []);
});

test("WP-36 · no modifica lo recibido, no tiene red ni DOM y nunca decide por el hogar", () => {
  const input = [...history(), tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA"), tx("2026-10-03", -45, "COMPRA TARJ GASOLINERA FICTICIA")];
  const snapshot = JSON.stringify(input);
  engine.detect({ today: TODAY, transactions: input });
  assert.equal(JSON.stringify(input), snapshot);
  assert.doesNotMatch(read("canonical-statement-anomalies.js"), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\/|document\.|window\.|localStorage/);
});

// ---- calibración con el hogar sintético de WP-33 ----
// Verdad conocida: se inyectan cuatro anomalías por hogar (un duplicado, una devolución de recibo, una comisión nueva y un importe fuera de lo
// normal) y se mide cuántas se encuentran y cuántos avisos eran falsos. Lo generó la misma mano que el detector: es una cota optimista, no el
// número real; el real sale de las respuestas del hogar.

test("WP-36 · calibración sintética: se encuentran las anomalías inyectadas y los falsos positivos quedan por debajo del 20 %", async () => {
  const { generateHousehold } = await import(path.join(root, "tools", "build-synthetic-household.mjs"));
  let found = 0;
  let injected = 0;
  let flagged = 0;
  let falsePositives = 0;
  const seeds = Array.from({ length: 40 }, (_, index) => index + 1);
  for (const seed of seeds) {
    const household = generateHousehold({ seed, months: 10, start: "2026-01" });
    const rows = household.observations.map((obs) => tx(`${obs.month}-${String(obs.day || 15).padStart(2, "0")}`, -obs.amount, obs.label.toUpperCase(), { mapping: { status: "classified", rowKey: obs.key } }));
    const today = "2026-11-08";
    const gap = engine.detect({ today, transactions: rows });
    const baseline = gap.items.length;
    // Las anomalías, en octubre y noviembre (dentro de los 45 días).
    const anomalies = [
      tx("2026-10-20", -88, "COMPRA TARJ TIENDA ANOMALA"), tx("2026-10-20", -88, "COMPRA TARJ TIENDA ANOMALA"),
      tx("2026-10-25", -140, "RECIBO ASEGURADORA ANOMALA"), tx("2026-10-28", 140, "DEVOLUCION RECIBO ASEGURADORA ANOMALA"),
      tx("2026-11-03", -6.5, "COMISION ANOMALA ESPECIAL"),
      tx("2026-11-05", -1800, "COMPRA TARJ SUPER ANOMALO", { mapping: { status: "classified", rowKey: "sint-errat-2" } }),
    ];
    const withAnomalies = engine.detect({ today, transactions: [...rows, ...anomalies], limit: 50 });
    injected += 4;
    flagged += withAnomalies.items.length;
    const wanted = new Set(["duplicado", "devolucion", "comision"]);
    found += withAnomalies.items.filter((item) => wanted.has(item.kind) && /ANOMAL|anomal/i.test(`${item.label} ${item.evidence.join(" ")}`)).length;
    found += withAnomalies.items.filter((item) => item.kind === "atipico" && Math.abs(item.amount) === 1800).length;
    falsePositives += Math.max(0, baseline);
  }
  const falsePositiveRate = falsePositives / flagged;
  assert.ok(found / injected >= 0.9, `se encuentran ${found} de ${injected}`);
  assert.ok(falsePositiveRate < 0.2, `falsos positivos ${(falsePositiveRate * 100).toFixed(1)} % (${falsePositives} de ${flagged})`);
});
