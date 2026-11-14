const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Deuda › Préstamo para saldar (14/11/2026, petición del hogar). Cartera INVENTADA; las condiciones de la oferta son las del simulador
// del banco que enseñó el hogar (16.500 €, 72 meses, 8,50 % TIN, sin comisión → 293,34 €, 4.620,48 €, TAE 8,84 %), calculadas a mano.

const root = path.resolve(__dirname, "..");
const LoanPlan = require("../canonical-loan-payoff-plan.js");
const PayoffPath = require("../canonical-debt-payoff-path.js");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const CARTERA = [
  { id: "tarjeta", entity: "Entidad T", type: "Tarjeta revolving", paymentStatus: "active", currentPrincipal: 4200, currentPayment: 150, apr: 21.84 },
  { id: "consumo", entity: "Entidad C", type: "Préstamo consumo", paymentStatus: "active", currentPrincipal: 9000, currentPayment: 260, apr: 12.5 },
  { id: "coche", entity: "Entidad A", type: "Financiación coche", paymentStatus: "active", currentPrincipal: 6000, currentPayment: 320, apr: 7.9 },
  { id: "hipo", entity: "Entidad H", type: "Hipoteca", paymentStatus: "active", currentPrincipal: 150000, currentPayment: 750, apr: 3.1 },
];
const START = "2026-12";
const OFERTA = { capital: 16500, months: 72, tinPct: 8.5, openingFeePct: 0 };

test("la oferta da las mismas cifras que el simulador del banco", () => {
  const terms = LoanPlan.loanTerms(OFERTA);
  assert.equal(terms.ok, true);
  assert.equal(terms.payment, 293.34);
  assert.equal(terms.totalInterest, 4620.48);
  assert.equal(terms.totalOwed, 21120.48);
  assert.equal(terms.taePct, 8.84);
  assert.equal(terms.netFunds, 16500);
});

test("la comisión de apertura sube la TAE (TIR sobre lo recibido) y no la cuota", () => {
  const terms = LoanPlan.loanTerms({ ...OFERTA, openingFeePct: 2 });
  assert.equal(terms.payment, 293.34);
  assert.equal(terms.openingFee, 330);
  assert.equal(terms.netFunds, 16170);
  assert.ok(terms.taePct > 9.5 && terms.taePct < 9.8, `TAE con comisión: ${terms.taePct}`);
  assert.equal(terms.totalCost, 4950.48);
});

test("TIN 0 %: capital entre plazo, TAE 0", () => {
  const terms = LoanPlan.loanTerms({ capital: 12000, months: 24, tinPct: 0 });
  assert.equal(terms.payment, 500);
  assert.equal(terms.totalInterest, 0);
  assert.equal(terms.taePct, 0);
});

test("condiciones fuera de rango se rechazan con el campo y una frase", () => {
  assert.equal(LoanPlan.loanTerms({ ...OFERTA, capital: 0 }).field, "capital");
  assert.equal(LoanPlan.loanTerms({ ...OFERTA, months: 7.5 }).field, "months");
  assert.equal(LoanPlan.loanTerms({ ...OFERTA, tinPct: 45 }).field, "tinPct");
  assert.equal(LoanPlan.loanTerms({ ...OFERTA, openingFeePct: -1 }).field, "openingFeePct");
  assert.equal(LoanPlan.plan(CARTERA, { startMonthKey: START, loan: OFERTA, extraMonthly: -5 }).field, "extraMonthly");
  assert.match(LoanPlan.plan(CARTERA, { loan: OFERTA }).error, /mes de partida/);
});

test("selección automática: solo lo más caro que el préstamo, de la TAE más alta a la más baja; la hipoteca, fuera", () => {
  const result = LoanPlan.plan(CARTERA, { startMonthKey: START, loan: OFERTA, monthlyIncome: 5000 });
  assert.equal(result.ok, true);
  assert.equal(result.selection, "auto");
  assert.deepEqual(result.cancelled.map((row) => [row.id, row.amount, row.full]), [["tarjeta", 4200, true], ["consumo", 9000, true]]);
  assert.equal(result.allocated, 13200);
  assert.equal(result.leftover, 3300);
  assert.equal(result.capitalNeeded, 13200);
  assert.equal(result.freedPayments, 410);
  assert.equal(result.weightedAprPct, 15.47);
  assert.deepEqual(result.mortgagesLeftOut.map((row) => row.id), ["hipo"]);
  assert.ok(!result.candidates.some((row) => row.id === "hipo"));
  assert.ok(result.warnings.some((text) => /Sobran 3300 €/.test(text)));
  assert.ok(result.warnings.some((text) => /tarjeta o línea/.test(text)));
});

test("con la hipoteca dentro tampoco se cancela: es más barata que el préstamo", () => {
  const result = LoanPlan.plan(CARTERA, { startMonthKey: START, loan: OFERTA, includeMortgage: true });
  assert.ok(result.candidates.some((row) => row.id === "hipo"));
  assert.ok(!result.cancelled.some((row) => row.id === "hipo"));
  assert.equal(result.mortgagesLeftOut.length, 0);
});

test("la última deuda puede quedar cancelada en parte: conserva su cuota y no libera nada", () => {
  const result = LoanPlan.plan(CARTERA, { startMonthKey: START, loan: { ...OFERTA, capital: 10000 } });
  const partial = result.cancelled.find((row) => row.id === "consumo");
  assert.equal(partial.amount, 5800);
  assert.equal(partial.full, false);
  assert.equal(partial.freedPayment, 0);
  assert.equal(result.leftover, 0);
  assert.equal(result.freedPayments, 150);
});

test("selección a mano: avisa si cancela algo más barato que el préstamo", () => {
  const result = LoanPlan.plan(CARTERA, { startMonthKey: START, loan: OFERTA, selection: ["coche", "tarjeta"] });
  assert.equal(result.selection, "manual");
  assert.deepEqual(result.cancelled.map((row) => row.id), ["tarjeta", "coche"]);
  assert.ok(result.warnings.some((text) => /más barata que el préstamo/.test(text)));
  assert.equal(result.checks.find((check) => check.id === "mas-barato").pass, true);
});

test("sin nada más caro que el préstamo, se dice y no se cancela nada", () => {
  const cheap = CARTERA.filter((row) => row.id === "coche" || row.id === "hipo");
  const result = LoanPlan.plan(cheap, { startMonthKey: START, loan: OFERTA });
  assert.equal(result.cancelled.length, 0);
  assert.match(result.warnings[0], /Ninguna deuda es más cara que el préstamo/);
});

test("los cuatro caminos usan el motor de «Camino a deuda cero»: hoy es exactamente su calendario sin extra", () => {
  const consumo = CARTERA.filter((row) => row.id !== "hipo");
  const result = LoanPlan.plan(CARTERA, { startMonthKey: START, loan: { ...OFERTA, capital: 13200, months: 60 }, monthlyIncome: 5000 });
  const camino = PayoffPath.project(consumo, { startMonthKey: START, extraMonthly: 0 });
  assert.equal(result.paths.today.debtFreeMonthKey, camino.debtFreeMonthKey);
  assert.equal(result.paths.today.totalInterest, camino.totalInterest);
  assert.equal(result.todayPayment, 730);
  // Plan agresivo: se sigue pagando lo de hoy (730 €), así que el extra son los 730 − (320 + 270,82) que libera el préstamo.
  assert.equal(result.withLoanPayment, 590.82);
  assert.equal(result.aggressiveMonthly, 730);
  assert.equal(result.paths.aggressive.monthlyPayment, 730);
  assert.equal(result.paths.sameEffort.monthlyPayment, 730);
  assert.equal(result.sameEffortExtra, 0);
  // Con las mismas cifras, el préstamo barato acaba antes y cuesta menos que hoy.
  assert.ok(result.paths.aggressive.monthsToDebtFree < result.paths.today.monthsToDebtFree);
  assert.ok(result.paths.aggressive.totalCost < result.paths.today.totalCost);
  assert.equal(result.checks.length, 5);
  assert.equal(result.checksPassed, 5);
});

test("plazo de más de 5 años: la política lo marca y propone la cuota a 60 meses", () => {
  const result = LoanPlan.plan(CARTERA, { startMonthKey: START, loan: OFERTA });
  const plazo = result.checks.find((check) => check.id === "plazo");
  assert.equal(plazo.pass, false);
  assert.equal(plazo.fixMonths, 60);
  assert.equal(plazo.fixPayment, 338.52);
});

test("sin ingresos no se juzga el ratio de deuda (dato ausente no es cero)", () => {
  const result = LoanPlan.plan(CARTERA, { startMonthKey: START, loan: OFERTA });
  assert.ok(!result.checks.some((check) => check.id === "ratio"));
  const conIngresos = LoanPlan.plan(CARTERA, { startMonthKey: START, loan: OFERTA, monthlyIncome: 5000 });
  assert.equal(conIngresos.checks.find((check) => check.id === "ratio").dtiPct, 12.27);
});

test("la comisión por amortizar antes solo se cuenta si se declara, y se suma al coste del plan agresivo", () => {
  const options = { startMonthKey: START, loan: { ...OFERTA, capital: 13200, months: 60 } };
  const sin = LoanPlan.plan(CARTERA, options);
  const con = LoanPlan.plan(CARTERA, { ...options, earlyFeePct: 1 });
  assert.ok(sin.earlyRepaid > 0);
  assert.equal(sin.earlyFee, 0);
  assert.ok(sin.warnings.some((text) => /comisión/.test(text)));
  assert.ok(Math.abs(con.earlyFee - con.earlyRepaid / 100) < 0.01, "1 % de lo amortizado antes");
  assert.ok(Math.abs(con.paths.aggressive.totalCost - sin.paths.aggressive.totalCost - con.earlyFee) < 0.02);
});

test("sin el plan agresivo, el préstamo solo paga sus cuotas y el extra", () => {
  const result = LoanPlan.plan(CARTERA, { startMonthKey: START, loan: { ...OFERTA, capital: 13200, months: 60 }, keepPaying: false, extraMonthly: 50 });
  assert.equal(result.keepPaying, false);
  assert.equal(result.aggressiveExtra, 50);
  assert.equal(result.aggressiveMonthly, 640.82);
});

test("redirectFreed en «Camino a deuda cero»: sin la opción el resultado no cambia; con ella, las cuotas liberadas adelantan el final", () => {
  const consumo = CARTERA.filter((row) => row.id !== "hipo");
  const base = PayoffPath.project(consumo, { startMonthKey: START, extraMonthly: 100 });
  const igual = PayoffPath.project(consumo, { startMonthKey: START, extraMonthly: 100, redirectFreed: false });
  assert.deepEqual(igual, base);
  const bola = PayoffPath.project(consumo, { startMonthKey: START, extraMonthly: 100, redirectFreed: true });
  assert.equal(bola.redirectFreed, true);
  assert.ok(bola.monthsToDebtFree < base.monthsToDebtFree);
  assert.ok(bola.totalInterest < base.totalInterest);
  // La línea base (para el aviso de plazos) es el calendario sin extra ni bola de nieve.
  assert.deepEqual(bola.baseline, PayoffPath.project(consumo, { startMonthKey: START, extraMonthly: 0 }).baseline || {
    debtFreeMonthKey: PayoffPath.project(consumo, { startMonthKey: START, extraMonthly: 0 }).debtFreeMonthKey,
    monthsToDebtFree: PayoffPath.project(consumo, { startMonthKey: START, extraMonthly: 0 }).monthsToDebtFree,
    totalInterest: PayoffPath.project(consumo, { startMonthKey: START, extraMonthly: 0 }).totalInterest,
    beyondHorizon: false,
  });
  assert.ok(bola.included.some((row) => row.extraApplied > 0));
});

test("la pestaña está cableada: sección, menú, lanzador, ruta, scripts, sitio publicado y service worker", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = codigoApp();
  const deuda = fs.readFileSync(path.join(root, "views/deuda.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "tools/build-public-site.mjs"), "utf8");
  const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  const e17 = fs.readFileSync(path.join(root, "e17-experience.js"), "utf8");
  assert.match(html, /<section class="e19-deuda-decidir view-section" id="deuda-prestamo" hidden>/);
  assert.match(html, /<a href="#deuda-prestamo" data-e17-group="analysis">Préstamo para saldar la deuda<\/a>/);
  ["prestamoCapital", "prestamoCapitalRango", "prestamoPlazo", "prestamoPlazoRango", "prestamoTin", "prestamoComision", "prestamoComisionAnticipada", "prestamoExtra", "prestamoIngresos", "prestamoSeguir", "prestamoHipoteca", "prestamoTitular", "prestamoReset", "prestamoResultado"].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`), id);
  });
  assert.match(html, /<script defer src="canonical-loan-payoff-plan\.js\?v=[\w]+"><\/script>\s*<script defer src="prestamo-deuda-ui\.js\?v=[\w]+"><\/script>/);
  assert.ok(html.indexOf('src="canonical-debt-payoff-path.js') < html.indexOf('src="canonical-loan-payoff-plan.js'), "el motor de Camino carga antes");
  assert.match(html, /<link rel="stylesheet" href="prestamo-deuda\.css\?v=[\w]+" \/>/);
  assert.match(app, /case "deuda-prestamo":\s*\n\s*renderDeudaPrestamo\(\);/);
  assert.match(app, /"deuda-prestamo": \{ src: "views\/deuda\.js\?v=[\w]+", rootId: "deuda-prestamo" \}/);
  assert.match(app, /"deuda-prestamo": "simulation"/);
  assert.match(deuda, /globalThis\.renderPrestamoDeuda\?\.\(globalThis\.FinanceCanonicalLoanPayoffPlan, escenarioMotorDebtOptions\(\)\)/);
  ["prestamo-deuda.css", "canonical-loan-payoff-plan.js", "prestamo-deuda-ui.js"].forEach((file) => {
    assert.match(build, new RegExp(`"${file.replace(/\./g, "\\.")}",`), file);
    assert.match(sw, new RegExp(`"\\./${file.replace(/\./g, "\\.")}",`), file);
  });
  assert.match(e17, /target: "deuda-prestamo"/);
});

test("la pantalla no escribe en el plan y sigue las reglas del rediseño", () => {
  const ui = fs.readFileSync(path.join(root, "prestamo-deuda-ui.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "prestamo-deuda.css"), "utf8");
  assert.doesNotMatch(ui, /saveState\(|commitState|applyDecision|debtContractOverrides\s*=/, "no toca el estado del hogar ni los contratos");
  assert.doesNotMatch(ui, /toFixed\([^)]*\)\s*}\s*€|\.toFixed\(2\)\s*\+\s*" €"/, "las cifras van con money()");
  assert.match(ui, /storageKey\(PRESTAMO_STORE_KEY\)/);
  assert.match(css, /\.pre-grafico-svg \{[^}]*min-height: 0;/, "trampa del min-height de los svg (ESTADO §5)");
  assert.doesNotMatch(css, /#[0-9a-f]{3,6}\b/i, "solo tokens, sin colores fijos");
});
