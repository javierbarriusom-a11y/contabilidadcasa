const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const S = require("../canonical-shadow-debt.js");

// WP-41 (DAC-04 + DNU-03): deuda en la sombra y TAE real. Lo que el hogar debe poder fiar: que un recurrente normal no se marque como deuda, que la fecha de
// fin solo salga del contador del propio extracto, que el capital propuesto no finja saber los intereses, que la TAE no se calcule sin precio al contado y
// que una comisión o un seguro la suban.

const tx = (date, amount, movement, details = "") => ({ date, month: date.slice(0, 7), movement, details, amount });
const today = "2026-10-15";
const detect = (rows, extra = {}) => S.detectShadowDebt({ today, transactions: rows, ...extra });
const terminal = [tx("2026-08-05", -30, "MOVISTAR CUOTA TERMINAL 1 DE 24"), tx("2026-09-05", -30, "MOVISTAR CUOTA TERMINAL 2 DE 24"), tx("2026-10-05", -30, "MOVISTAR CUOTA TERMINAL 3 DE 24")];

test("WP-41 · sin fecha de hoy o con un extracto viejo no se dice «no hay nada»: se dice que no se puede mirar", () => {
  assert.equal(S.detectShadowDebt({ transactions: terminal }).status, "missing");
  const viejo = S.detectShadowDebt({ today: "2027-03-01", transactions: terminal });
  assert.equal(viejo.status, "stale");
  assert.equal(viejo.coveredUntil, "2026-10-05");
  assert.equal(S.detectShadowDebt({ today, transactions: [] }).status, "stale", "sin movimientos tampoco");
});

test("WP-41 · el contador «cuota 3 de 24» da la fecha de fin y lo que queda por pagar", () => {
  const r = detect(terminal);
  assert.equal(r.status, "ok");
  assert.equal(r.items.length, 1);
  const item = r.items[0];
  assert.equal(item.confidence, "alta");
  assert.equal(item.remaining, 21);
  assert.equal(item.endMonth, "2028-07", "octubre de 2026 + 21 meses");
  assert.equal(item.remainingTotal, 630);
  assert.deepEqual(item.signals, ["counter", "keyword"]);
  assert.match(item.evidence.join(" "), /cuota 3 de 24.*quedan 21/);
  assert.equal(r.monthlyTotal, 30);
  assert.equal(r.latestEnd, "2028-07");
});

test("WP-41 · un solo cargo con contador basta; la última cuota dice que es la última", () => {
  const una = detect([tx("2026-10-10", -49.9, "KLARNA PAGO 2 DE 3")]);
  assert.equal(una.items[0].remaining, 1);
  assert.equal(una.items[0].endMonth, "2026-11");
  const ultima = detect([tx("2026-10-10", -49.9, "KLARNA PAGO 3 DE 3")]);
  assert.equal(ultima.items[0].remaining, 0);
  assert.match(ultima.items[0].evidence.join(" "), /es la última/);
});

test("WP-41 · sin contador, una palabra de financiación + dos meses seguidos; la fecha de fin no se inventa", () => {
  const r = detect([tx("2026-08-12", -25, "COMPRA FINANCIADA TIENDA X"), tx("2026-09-12", -25, "COMPRA FINANCIADA TIENDA X"), tx("2026-10-12", -25, "COMPRA FINANCIADA TIENDA X")]);
  const item = r.items[0];
  assert.equal(item.confidence, "media");
  assert.equal(item.endMonth, null);
  assert.equal(item.remaining, null);
  assert.equal(item.remainingTotal, null, "sin contador no se sabe cuánto queda");
  assert.equal(r.withoutEnd, 1);
  assert.equal(detect([tx("2026-10-12", -25, "COMPRA FINANCIADA TIENDA X")]).items.length, 0, "un solo cargo con solo una palabra no basta");
});

test("WP-41 · un recurrente normal NO es deuda: suscripciones, cuotas de comunidad, plazo fijo, hipoteca y préstamo no se marcan", () => {
  const rows = [
    ...["2026-08-03", "2026-09-03", "2026-10-03"].map((d) => tx(d, -12.99, "NETFLIX")),
    ...["2026-08-02", "2026-09-02", "2026-10-02"].map((d, i) => tx(d, -80, `CUOTA COMUNIDAD ${i + 1}/12`)),
    ...["2026-08-04", "2026-09-04", "2026-10-04"].map((d) => tx(d, -300, "TRASPASO PLAZO FIJO")),
    ...["2026-08-01", "2026-09-01", "2026-10-01"].map((d, i) => tx(d, -650, `HIPOTECA CUOTA ${i + 100} DE 300`)),
    ...["2026-08-06", "2026-09-06", "2026-10-06"].map((d, i) => tx(d, -200, `PRESTAMO PERSONAL CUOTA ${i + 5} DE 36`)),
  ];
  assert.deepEqual(detect(rows).items, []);
});

test("WP-41 · no mensual, importe cambiante o ya acabado: no se marca", () => {
  const raros = [tx("2026-08-12", -25, "COMPRA FINANCIADA TIENDA X"), tx("2026-08-20", -25, "COMPRA FINANCIADA TIENDA X"), tx("2026-10-12", -25, "COMPRA FINANCIADA TIENDA X")];
  assert.equal(detect(raros).items.length, 0, "cargos a 8 y 53 días: no es mensual");
  const cambia = [tx("2026-08-12", -25, "COMPRA FINANCIADA TIENDA X"), tx("2026-09-12", -40, "COMPRA FINANCIADA TIENDA X"), tx("2026-10-12", -60, "COMPRA FINANCIADA TIENDA X")];
  assert.equal(detect(cambia).items.length, 0, "los importes no se repiten");
  const acabado = [tx("2026-05-05", -30, "MOVISTAR CUOTA TERMINAL 10 DE 12"), tx("2026-06-05", -30, "MOVISTAR CUOTA TERMINAL 11 DE 12")];
  assert.equal(detect(acabado).items.length, 0, "hace más de 45 días que no se cobra");
});

test("WP-41 · lo que ya está en la app no se vuelve a proponer, y las respuestas del hogar se recuerdan", () => {
  const yaEsta = detect(terminal, { contracts: [{ entity: "Movistar", currentPayment: 30, paymentStatus: "active" }] });
  assert.equal(yaEsta.items.length, 0);
  assert.equal(yaEsta.suppressed, 1);
  const otraCuota = detect(terminal, { contracts: [{ entity: "Movistar", currentPayment: 90, paymentStatus: "active" }] });
  assert.equal(otraCuota.items.length, 1, "misma entidad pero otra cuota: puede ser otra deuda");
  const item = detect(terminal).items[0];
  const answers = S.applyAnswer(null, item, "not-debt", "2026-10-15");
  const respondida = detect(terminal, { answers });
  assert.equal(respondida.items.length, 0);
  assert.equal(respondida.suppressed, 1);
  assert.equal(S.applyAnswer(null, item, "inventada", "2026-10-15").byId[item.id], undefined, "una respuesta desconocida no se guarda");
  assert.equal(S.stats(answers).falsePositiveRate, null, "con una respuesta no se mide: hacen falta 10");
});

test("WP-41 · la propuesta de alta: el capital es lo que queda por pagar y dice que no incluye intereses; sin contador, solo una cuota", () => {
  const conFin = S.proposal(detect(terminal).items[0]);
  assert.equal(conFin.principal, 630);
  assert.equal(conFin.payment, 30);
  assert.equal(conFin.remainingInstallments, 21);
  assert.match(conFin.note, /no incluye intereses/);
  const sinFin = S.proposal(detect([tx("2026-08-12", -25, "COMPRA FINANCIADA TIENDA X"), tx("2026-09-12", -25, "COMPRA FINANCIADA TIENDA X")]).items[0]);
  assert.equal(sinFin.principal, 25);
  assert.equal(sinFin.remainingInstallments, null);
  assert.match(sinFin.note, /No se sabe cuándo acaba/);
});

test("WP-41 · TAE: sin precio al contado no se calcula; sin sobrecoste es 0 %; una comisión y un seguro la suben", () => {
  assert.equal(S.effectiveApr({ installments: 10, installmentAmount: 100 }).calculable, false);
  assert.match(S.effectiveApr({ installments: 10, installmentAmount: 100 }).reason, /precio al contado/);
  assert.equal(S.effectiveApr({ cashPrice: 1000 }).calculable, false);
  const cero = S.effectiveApr({ cashPrice: 1000, installments: 10, installmentAmount: 100 });
  assert.equal(cero.aprPct, 0);
  assert.equal(cero.extraCost, 0);
  const comision = S.effectiveApr({ cashPrice: 1000, installments: 10, installmentAmount: 100, upfrontFee: 30 });
  assert.ok(comision.aprPct > 5 && comision.aprPct < 9, `TAE ${comision.aprPct}`);
  assert.equal(comision.extraCost, 30);
  const conSeguro = S.effectiveApr({ cashPrice: 1000, installments: 10, installmentAmount: 100, upfrontFee: 30, monthlyInsurance: 3 });
  assert.ok(conSeguro.aprPct > comision.aprPct, "el seguro sube la TAE");
  assert.equal(conSeguro.extraCost, 60);
});

test("WP-41 · TAE: valores de referencia comprobados a mano (TIR mensual → anual)", () => {
  // 1.000 € financiados en 12 cuotas de 90 € (precio al contado 900): coste 180 € sobre 900 €.
  const a = S.effectiveApr({ cashPrice: 900, installments: 12, installmentAmount: 90 });
  const r = a.monthlyRatePct / 100;
  // El valor actual de las 12 cuotas al tipo mensual hallado tiene que ser el precio al contado.
  const pv = Array.from({ length: 12 }, (_, k) => 90 / (1 + r) ** (k + 1)).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(pv - 900) < 0.5, `valor actual ${pv.toFixed(2)}`);
  assert.ok(Math.abs(a.aprPct - (((1 + r) ** 12 - 1) * 100)) < 0.05);
  // Pagar el primer plazo en el acto sube la TAE: se recibe menos dinero «de verdad» al principio.
  const alInicio = S.effectiveApr({ cashPrice: 900, installments: 12, installmentAmount: 90, firstPaymentAtStart: true });
  assert.ok(alInicio.aprPct > a.aprPct);
  // Un pago final (cuota balón) cuenta.
  const balon = S.effectiveApr({ cashPrice: 900, installments: 11, installmentAmount: 70, finalPayment: 130 });
  assert.equal(balon.totalPaid, 900 + (11 * 70 + 130 - 900));
});

test("WP-41 · TAE: ofertas que cuestan menos que el precio de contado salen con TAE negativa, no se esconden", () => {
  const regalo = S.effectiveApr({ cashPrice: 1000, installments: 10, installmentAmount: 90 });
  assert.equal(regalo.calculable, true);
  assert.ok(regalo.aprPct < 0);
  assert.equal(regalo.extraCost, -100);
});

test("WP-41 · contado o financiado: el colchón y lo que rinde el dinero deciden, y un dato ausente se dice en vez de rellenarse", () => {
  const apr = S.effectiveApr({ cashPrice: 1000, installments: 10, installmentAmount: 100, upfrontFee: 30 });
  assert.equal(S.cashVsFinance({ apr: { calculable: false } }).verdict, "no-data");
  const rompe = S.cashVsFinance({ apr, cashPrice: 1000, liquidity: 1500, floor: 1000, yieldPct: null });
  assert.equal(rompe.verdict, "cash-breaks-floor", "al contado quedarían 500 €, por debajo del colchón de 1.000");
  assert.equal(rompe.afterCash, 500);
  assert.match(rompe.notes.join(" "), /cuánto rinde el dinero parado/);
  const sobra = S.cashVsFinance({ apr, cashPrice: 1000, liquidity: 5000, floor: 1000, yieldPct: 0 });
  assert.equal(sobra.verdict, "cash-cheaper");
  const compensa = S.cashVsFinance({ apr, cashPrice: 1000, liquidity: 5000, floor: 1000, yieldPct: 20 });
  assert.equal(compensa.verdict, "finance-pays");
  const gratis = S.cashVsFinance({ apr: S.effectiveApr({ cashPrice: 1000, installments: 10, installmentAmount: 100 }), cashPrice: 1000, liquidity: 5000, floor: 1000, yieldPct: 2 });
  assert.equal(gratis.verdict, "free-keep-cash");
  const sinDatos = S.cashVsFinance({ apr, cashPrice: 1000, liquidity: null, floor: null, yieldPct: null });
  assert.equal(sinDatos.verdict, "cash-cheaper");
  assert.equal(sinDatos.belowFloor, null, "sin liquidez no se dice si toca el colchón");
  assert.match(sinDatos.notes.join(" "), /No se sabe cuánta liquidez/);
});

// ---- calibración con el hogar sintético de WP-33 ----
// Un hogar limpio (sin ninguna financiación) no debe levantar ningún aviso, y una financiación inyectada con contador se encuentra siempre. El hogar lo
// generó la misma mano que el detector y sus conceptos no llevan palabras de plazos: mide que lo ordinario no se confunde, no la tasa real de falsos
// positivos, que sale de las respuestas del hogar.
test("WP-41 · calibración sintética: ningún aviso en hogares limpios y la financiación inyectada se encuentra", async () => {
  const { generateHousehold } = await import(path.join(root, "tools", "build-synthetic-household.mjs"));
  let cleanFlags = 0;
  let injected = 0;
  let found = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const household = generateHousehold({ seed, months: 10, start: "2026-01" });
    const rows = household.observations.map((obs) => tx(`${obs.month}-${String(obs.day || 15).padStart(2, "0")}`, -obs.amount, obs.label.toUpperCase()));
    const clean = S.detectShadowDebt({ today: "2026-11-08", transactions: rows });
    if (clean.status === "ok") cleanFlags += clean.items.length;
    const withDebt = S.detectShadowDebt({ today: "2026-11-08", transactions: [...rows, tx("2026-09-04", -42, "FINANCIACION TERMINAL MOVIL 2 DE 18"), tx("2026-10-04", -42, "FINANCIACION TERMINAL MOVIL 3 DE 18")] });
    injected += 1;
    found += withDebt.items.filter((item) => item.remaining === 15 && item.monthlyAmount === 42).length;
  }
  assert.equal(cleanFlags, 0, `avisos en hogares limpios: ${cleanFlags}`);
  assert.equal(found, injected, `se encuentran ${found} de ${injected}`);
});

test("WP-41 · el motor es puro: sin DOM, red ni almacenamiento", () => {
  const source = read("canonical-shadow-debt.js").replace(/\/\/.*$/gm, "");
  for (const forbidden of [/\bdocument\b/, /\bwindow\b/, /localStorage/, /sessionStorage/, /\bfetch\(/, /XMLHttpRequest/, /\bqs\(/]) assert.doesNotMatch(source, forbidden);
});
