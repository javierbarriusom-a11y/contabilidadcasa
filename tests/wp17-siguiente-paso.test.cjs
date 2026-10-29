const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../canonical-next-best-action.js");

// WP-17 (NIN-01): la siguiente mejor acción de la cartera, por reglas fijas con su motivo. Hechos inventados.

const base = { today: "2026-11-10", positions: 3, staleDays: 35, stale: [], policy: { state: "signed", review: { status: "ok" }, breaches: [] }, drift: null, fiscal: null, convictions: [] };
const signedDrift = (rows, extra = {}) => ({ source: "politica", bandPct: 5, byContributions: true, n: 2, rows, ...extra });

test("sin posiciones no hay acción que inventar", () => {
  assert.deepEqual(engine.nextBestActions({ positions: 0 }), { calculable: false, reason: "sin-posiciones", primary: null, others: [], checked: [] });
});

test("el orden es fijo: valorar manda sobre todo lo demás, y el resto queda detrás en su orden", () => {
  const result = engine.nextBestActions({
    ...base,
    stale: ["Fondo A", "Acciones B"],
    policy: { state: "signed", review: { status: "overdue", dueDate: "2026-10-01" }, reviewN: 9, breaches: [{ ruleId: "no-crypto", n: 5, text: "Hay cripto en la cartera y la política dice que no se compra." }] },
    drift: signedDrift([{ type: "fondo", currentPct: 50, targetPct: 60, deviation: -10, amount: 1200 }]),
    fiscal: { year: "2026", marginalSaleBase: 800, candidates: [{ label: "ETF C", gainLoss: -500 }] },
    convictions: [{ label: "Acciones B", neverReviewed: true }],
  });
  assert.equal(result.primary.id, "valorar");
  assert.deepEqual(result.others.map((item) => item.id), ["incumple", "deriva", "fiscal", "politica", "conviccion"]);
  assert.equal(result.primary.title, "Actualizad la valoración de 2 posiciones");
  assert.match(result.primary.reason, /Fondo A y Acciones B llevan más de 35 días sin valor/);
  assert.equal(result.primary.cta.kind, "valorar");
});

test("la deriva sale de la política firmada, con su regla; si dice aportar primero, no propone vender", () => {
  const under = engine.nextBestActions({ ...base, drift: signedDrift([{ type: "etf", currentPct: 52, targetPct: 60, deviation: -8, amount: 1234 }, { type: "fondo", currentPct: 48, targetPct: 40, deviation: 8, amount: -1234 }]) });
  assert.equal(under.primary.id, "deriva");
  assert.equal(under.primary.rule, "Regla 2 de vuestra política");
  assert.equal(under.primary.title, "Llevad las próximas aportaciones a ETF"); // empata: la primera de mayor desviación
  assert.match(under.primary.reason, /Faltan unos 1\.234 € para volver al objetivo/);
  const over = engine.nextBestActions({ ...base, drift: signedDrift([{ type: "fondo", currentPct: 70, targetPct: 60, deviation: 10, amount: -900 }, { type: "etf", currentPct: 30, targetPct: 40, deviation: -6, amount: 900 }]) });
  assert.equal(over.primary.title, "No aportéis más a fondos hasta que vuelvan a la banda");
  assert.match(over.primary.reason, /llevadlas a ETF, que están por debajo/);
  assert.doesNotMatch(over.primary.reason + over.primary.title, /[Vv]ended/);
  // Dentro de la banda no hay deriva.
  assert.equal(engine.nextBestActions({ ...base, drift: signedDrift([{ type: "fondo", currentPct: 62, targetPct: 60, deviation: 2, amount: -100 }]) }).primary, null);
});

test("sin política firmada, el reparto de Rebalanceo con su umbral; vender avisa del coste fiscal", () => {
  const result = engine.nextBestActions({ ...base, policy: { state: "none" }, drift: { source: "reparto", bandPct: 10, byContributions: false, rows: [{ type: "accion", currentPct: 75, targetPct: 60, deviation: 15, amount: -3000 }] } });
  assert.equal(result.primary.id, "deriva");
  assert.equal(result.primary.title, "Vended unos 3.000 € de acciones");
  assert.equal(result.primary.rule, "Reparto objetivo de Rebalanceo (sin política firmada)");
  assert.match(result.primary.reason, /mirad su coste fiscal en Inversión › Fiscal/);
  assert.equal(result.others[0].id, "politica");
  assert.equal(result.others[0].title, "Escribid y firmad vuestra política de inversión");
});

test("la fiscal solo del 1/10 al 31/12 del mismo año, con plusvalías sin compensar y una posición en pérdidas; dice la recompra y que no es una recomendación", () => {
  const fiscal = { year: "2026", marginalSaleBase: 800, candidates: [{ label: "ETF C", gainLoss: -500 }, { label: "Fondo D", gainLoss: -1500 }] };
  const result = engine.nextBestActions({ ...base, fiscal });
  assert.equal(result.primary.id, "fiscal");
  assert.equal(result.primary.title, "Antes del 31/12: Fondo D podría compensar 800 € de plusvalías"); // la mayor pérdida, hasta lo que hay que compensar
  assert.match(result.primary.reason, /ventana de recompra/);
  assert.match(result.primary.reason, /no una recomendación de vender/);
  assert.equal(engine.nextBestActions({ ...base, today: "2026-09-30", fiscal }).primary, null, "en septiembre, no");
  assert.equal(engine.nextBestActions({ ...base, fiscal: { ...fiscal, marginalSaleBase: 0 } }).primary, null, "sin plusvalías que compensar, no");
  assert.equal(engine.nextBestActions({ ...base, fiscal: { ...fiscal, candidates: [] } }).primary, null, "sin pérdidas latentes, no");
  assert.equal(engine.nextBestActions({ ...base, today: "2027-11-10", fiscal }).primary, null, "con los datos de otro año, no");
});

test("la política: borrador, cambiada tras firmar y revisión vencida o cercana", () => {
  assert.equal(engine.nextBestActions({ ...base, policy: { state: "unsigned" } }).primary.title, "Terminad y firmad vuestra política de inversión");
  assert.equal(engine.nextBestActions({ ...base, policy: { state: "changed" } }).primary.title, "Volved a firmar la política: cambió después de firmarla");
  const overdue = engine.nextBestActions({ ...base, policy: { state: "signed", review: { status: "overdue", dueDate: "2026-10-01" }, reviewN: 9, breaches: [] } }).primary;
  assert.equal(overdue.reason, "Tocaba revisarla el 1 oct 2026.");
  assert.equal(overdue.rule, "Regla 9 de vuestra política");
  assert.equal(engine.nextBestActions({ ...base, policy: { state: "signed", review: { status: "due-soon", dueDate: "2026-11-30" }, breaches: [] } }).primary.title, "Revisad la política de inversión este mes");
});

test("la convicción, la última; y sin nada pendiente dice qué ha mirado, no que todo esté bien", () => {
  const conviction = engine.nextBestActions({ ...base, convictions: [{ label: "Acciones B", neverReviewed: false, monthsSinceReview: 14 }, { label: "ETF C", neverReviewed: true }] }).primary;
  assert.equal(conviction.title, "Revisad la convicción de Acciones B (y 1 más)");
  assert.match(conviction.reason, /desde hace 14 meses/);
  const nothing = engine.nextBestActions(base);
  assert.equal(nothing.primary, null);
  assert.deepEqual(nothing.others, []);
  assert.ok(nothing.checked.some((item) => /valoraciones de menos de 35 días/.test(item)));
  assert.ok(nothing.checked.some((item) => /no hay reparto objetivo declarado/.test(item)));
});

test("la tarjeta tiene su interruptor (encendida de serie desde el 29/10/2026), solo lee y está declarada donde toca", () => {
  const root = path.resolve(__dirname, "..");
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  assert.match(read("funciones-en-prueba.js"), /id: "siguiente-paso"[^\n]*interruptor: "propio"/);
  assert.match(read("medidor-utilidad.js"), /id: "siguiente-paso"/);
  const ui = read("siguiente-paso-ui.js");
  assert.doesNotMatch(ui, /saveIv1PositionsList|saveScenarioSettings|politicaSave|storageSet/, "no escribe nada");
  assert.match(read("index.html"), /id="siguientePasoCard"[^>]*hidden/);
  assert.match(read("views/inversion.js"), /renderSiguientePaso/);
  const motor = read("canonical-next-best-action.js");
  assert.doesNotMatch(motor, /document\.|window\.|localStorage|fetch\(/, "el motor es puro");
});
