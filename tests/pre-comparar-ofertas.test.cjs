// Deuda › Préstamo para saldar · «Comparar con otra oferta» (26/11/2026, petición urgente del hogar): el impacto positivo o negativo de
// pedir un préstamo personal para las deudas de hoy, y dos ofertas lado a lado. Contratos FICTICIOS (los de pre-prestamo-saldar).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const Compare = require("../canonical-loan-offers-compare.js");
const Plan = require("../canonical-loan-payoff-plan.js");

const contratos = [
  { id: "tarjeta", entity: "Entidad T", type: "Tarjeta revolving", paymentStatus: "active", currentPrincipal: 4200, currentPayment: 150, apr: 21.84 },
  { id: "consumo", entity: "Entidad C", type: "Préstamo consumo", paymentStatus: "active", currentPrincipal: 9000, currentPayment: 260, apr: 12.5 },
  { id: "coche", entity: "Entidad A", type: "Financiación coche", paymentStatus: "active", currentPrincipal: 6000, currentPayment: 320, apr: 7.9 },
];
const base = { startMonthKey: "2026-12", selection: "auto", extraMonthly: 0, keepPaying: true, monthlyIncome: 3000 };
const uno = { label: "Banco Uno", capital: 13200, months: 60, tinPct: 7.5, openingFeePct: 1 };
const dos = { label: "Banco Dos", capital: 13200, months: 72, tinPct: 6.9, insuranceMonthly: 12 };

test("las dos ofertas pasan por el mismo motor de la pestaña, con las mismas deudas y supuestos", () => {
  const r = Compare.compare(contratos, base, [uno, dos]);
  assert.equal(r.ok, true);
  const solo = Plan.plan(contratos, { ...base, loan: { capital: 13200, months: 60, tinPct: 7.5, openingFeePct: 1 } });
  assert.equal(r.a.terms.payment, solo.terms.payment, "la cuota de A es la de la pestaña");
  assert.equal(r.a.costToday, solo.paths.today.totalCost, "«hoy» es el mismo camino");
  assert.equal(r.a.costToday, r.b.costToday, "las dos se comparan con el mismo «hoy»");
});

test("los seguros o vinculaciones suben la cuota, el coste del préstamo y el coste efectivo anual (la TAE no los cuenta)", () => {
  const sin = Compare.compare(contratos, base, [uno, { ...dos, insuranceMonthly: 0 }]).b;
  const con = Compare.compare(contratos, base, [uno, dos]).b;
  assert.equal(con.terms.taePct, sin.terms.taePct, "la TAE es la misma");
  assert.equal(con.loanPayment, Math.round((sin.loanPayment + 12) * 100) / 100);
  assert.equal(con.loanCost, Math.round((sin.loanCost + 12 * 72) * 100) / 100, "12 € × 72 meses");
  assert.ok(con.effectiveAnnualPct > con.terms.taePct, `${con.effectiveAnnualPct} > ${con.terms.taePct}`);
  assert.ok(con.costWithLoan > sin.costWithLoan);
});

test("el impacto frente a no pedir nada lleva su signo: positivo es ahorro", () => {
  const r = Compare.compare(contratos, base, [uno, dos]);
  assert.equal(r.a.impactCost, Math.round((r.a.costToday - r.a.costWithLoan) * 100) / 100);
  assert.ok(r.a.impactCost > 0, "Banco Uno ahorra frente a hoy");
  const caras = Compare.compare(contratos, { ...base, keepPaying: true }, [{ capital: 13200, months: 96, tinPct: 11 }, { capital: 13200, months: 120, tinPct: 10.5 }]);
  assert.ok(caras.a.impactCost < 0 && caras.b.impactCost < 0, "a 8 y 10 años cuestan más que hoy");
  assert.match(caras.verdict.lines.join(" "), /Ninguna de las dos os ahorra frente a no pedir nada/);
  assert.equal(caras.verdict.tone, "aviso");
});

test("quién gana cada criterio, y la recomendación por el coste total pagando solo las cuotas", () => {
  const r = Compare.compare(contratos, base, [uno, dos]);
  const crit = Object.fromEntries(r.criteria.map((c) => [c.id, c]));
  assert.equal(crit.costeConPrestamo.winner, "a");
  assert.equal(crit.cuotaDeudas.winner, "b", "a 72 meses la cuota es más baja");
  assert.equal(r.verdict.recommended, "a");
  assert.match(r.verdict.lines[0], /^Banco Uno es la más barata en total: [\d.]+ € menos que Banco Dos/);
  assert.match(r.verdict.lines.join(" "), /Banco Dos deja la cuota de deudas más baja: [\d.]+ € menos al mes/);
  assert.equal(Compare.winner(10, 10.5), "empate");
  assert.equal(Compare.winner(null, 3), null);
});

test("una deuda cancelada a medias se dice, con lo que bastaría pedir, y la cuota se compara acabada esa parte", () => {
  const r = Compare.compare(contratos, base, [uno, dos]);
  assert.ok(r.a.partial, "con el 1 % de apertura, A no llega a cancelar entero el consumo");
  assert.equal(r.a.partial.remaining, 132);
  assert.equal(r.a.monthlyDebtSteady, Math.round((r.a.monthlyDebtWithLoan - r.a.partial.payment) * 100) / 100);
  assert.match(r.verdict.lines.join(" "), /Banco Uno deja Entidad C Préstamo consumo a medias \(quedan 132 € con su cuota de 260 € durante 1 mes\): pidiendo unos 13\.400 € la cancelaría entera/);
});

test("sin nada que cancelar no hay recomendación; si solo una cancela, es esa", () => {
  const ninguna = Compare.compare(contratos, base, [{ capital: 5000, months: 48, tinPct: 25 }, { capital: 5000, months: 48, tinPct: 24 }]);
  assert.equal(ninguna.verdict.recommended, null);
  assert.match(ninguna.verdict.lines[0], /no cancela ninguna deuda/);
  const una = Compare.compare(contratos, base, [uno, { label: "Cara", capital: 13200, months: 60, tinPct: 23 }]);
  assert.equal(una.verdict.recommended, "a");
  assert.match(una.verdict.lines.join(" "), /Solo Banco Uno cancela deuda/);
});

test("datos que no valen: el error dice de qué oferta y de qué campo; hacen falta dos", () => {
  const mal = Compare.compare(contratos, base, [uno, { ...dos, insuranceMonthly: -5 }]);
  assert.equal(mal.ok, false);
  assert.equal(mal.offer, "b");
  assert.equal(mal.field, "insuranceMonthly");
  assert.match(mal.error, /^Banco Dos: /);
  assert.equal(Compare.compare(contratos, base, [{ ...uno, tinPct: 40 }, dos]).offer, "a");
  assert.equal(Compare.compare(contratos, base, [uno]).ok, false);
  assert.equal(Compare.eur(1018.43), "1.018 €");
});

test("cableado: el desplegable de la otra oferta, los seguros, el orden de los scripts y los oyentes desde la carga", () => {
  const html = read("index.html");
  const pestana = html.slice(html.indexOf('id="deuda-prestamo"'), html.indexOf('id="deuda-contratos"'));
  for (const id of ["prestamoNombre", "prestamoSeguro", "prestamoBNombre", "prestamoBCapital", "prestamoBPlazo", "prestamoBTin", "prestamoBComision", "prestamoBComisionAnticipada", "prestamoBSeguro", "prestamoBQuitar"]) {
    assert.ok(pestana.includes(`id="${id}"`), id);
  }
  assert.match(pestana, /<details class="pre-oferta-b" id="prestamoOfertaB">\s*<summary>Comparar con otra oferta<\/summary>/);
  const plan = html.indexOf('src="canonical-loan-payoff-plan.js');
  const cmp = html.indexOf('src="canonical-loan-offers-compare.js?v=20261126pre2"');
  const ui = html.indexOf('src="prestamo-deuda-ui.js?v=20261126pre2"');
  assert.ok(cmp > 0 && cmp < plan && plan < ui && ui < html.indexOf('src="app.js'), "el comparador, antes del motor del préstamo y de la pantalla (busca el motor al usarlo)");
  assert.ok(read("service-worker.js").includes('"./canonical-loan-offers-compare.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"canonical-loan-offers-compare.js"'));
  const src = read("prestamo-deuda-ui.js");
  assert.match(src, /attachPrestamoDeuda\(document\);\n$/, "los oyentes se enganchan al cargar (patrón DUO-D3)");
  for (const fn of ["prestamoOnInput", "prestamoOnChange", "prestamoOnClick"]) {
    const cuerpo = src.slice(src.indexOf(`function ${fn}(`), src.indexOf("\n}\n", src.indexOf(`function ${fn}(`)));
    assert.match(cuerpo, /if \(!prestamoState\) prestamoState = prestamoLoad\(\);/, `${fn} carga el estado si aún no lo hay`);
  }
  assert.match(read("prestamo-deuda.css"), /\.pre-condiciones:has\(\.pre-oferta-b\[open\]\) \{\s*position: static;/);
});
