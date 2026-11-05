// WP-21 · PR-1 (docs/WP21_DISENO.md §5): el motor del informe para la Renta, con cifras calculadas a mano. Datos INVENTADOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const report = require("../canonical-tax-report.js");

const venta = (id, date, saleProceeds, consumedCost, extra = {}) => ({ id, date, saleProceeds, consumedCost, realizedGain: saleProceeds - consumedCost, shortfall: 0, ...extra });
const posicion = (id, titular, disposals = [], extra = {}) => ({ id, label: `Posición ${id}`, titular, depositario: "espana", currentValue: 1000, disposals, ...extra });
const cobro = (id, fecha, integro, extra = {}) => ({ id, fecha, tipo: "dividendo", posicionId: "", concepto: "Broker", titular: "javi", integro, retencionEspana: round(integro * 0.19), retencionOrigen: null, paisOrigen: "", ...extra });
function round(v) { return Math.round(v * 100) / 100; }

test("una venta con ganancia y un dividendo: la cuota por tramos (19 % hasta 6.000, 21 % después)", () => {
  const r = report.taxReport({ year: 2026, holder: "javi", positions: [posicion("a", "javi", [venta("v1", "2026-04-10", 30000, 20000)])], rendimientos: [cobro("d1", "2026-06-01", 1000)] });
  assert.equal(r.calculable, true);
  assert.deepEqual([r.totals.gpBalance, r.totals.rcmBalance, r.compensation.base], [10000, 1000, 11000]);
  assert.equal(r.quota.gross, 2190, "6.000 × 19 % + 5.000 × 21 %");
  assert.equal(r.quota.scaleOrigin, "referencia");
  assert.match(r.quota.scaleSource, /Ley 7\/2024/);
  assert.deepEqual([r.totals.spanishWithholding, r.totals.withholdingComplete], [190, true]);
  assert.deepEqual([r.transmissions[0].transmissionValue, r.transmissions[0].acquisitionValue], [30000, 20000]);
});

test("el tramo del 30 % por encima de 300.000 €", () => {
  const r = report.taxReport({ year: 2026, holder: "tere", positions: [posicion("a", "tere", [venta("v1", "2026-01-10", 400000, 0)])] });
  // 6.000×19 % + 44.000×21 % + 150.000×23 % + 100.000×27 % + 100.000×30 % = 1.140 + 9.240 + 34.500 + 27.000 + 30.000
  assert.equal(r.quota.gross, 101880);
});

test("pérdidas de transmisiones mayores que las ganancias: compensan el 25 % de los rendimientos y el resto se arrastra", () => {
  const r = report.taxReport({ year: 2026, holder: "javi", positions: [posicion("a", "javi", [venta("v1", "2026-03-01", 3000, 5000)])], rendimientos: [cobro("d1", "2026-06-01", 4000)] });
  assert.deepEqual(r.compensation.steps, [{ kind: "year-cross", from: "ganancias", against: "rendimientos", amount: 1000 }]);
  assert.deepEqual([r.compensation.gpAfter, r.compensation.rcmAfter, r.compensation.base], [-1000, 3000, 3000]);
  assert.deepEqual(r.compensation.carryForward, [{ year: "2026", bloque: "ganancias", amount: 1000 }]);
  assert.equal(r.quota.gross, 570);
});

test("las pérdidas del año y las de dos años anteriores comparten el mismo cupo del 25 %", () => {
  const c = report.compensate({ gp: -300, rcm: 4000, year: "2026", priorLosses: [{ year: "2024", amount: 800, bloque: "ganancias" }, { year: "2023", amount: 600, bloque: "ganancias" }] });
  // Cupo: 25 % de 4.000 = 1.000. Primero el año (300), luego 2023 (600) y de 2024 solo cabe 100.
  assert.deepEqual(c.steps.map((s) => [s.kind, s.year || "año", s.amount]), [["year-cross", "año", 300], ["prior-cross", "2023", 600], ["prior-cross", "2024", 100]]);
  assert.deepEqual(c.remainingPriorLosses, [{ year: "2024", bloque: "ganancias", amount: 700 }]);
  assert.equal(c.rcmAfter, 3000);
  assert.deepEqual(c.carryForward, [], "la pérdida del año cupo entera");
});

test("una pérdida arrastrada va primero contra su bloque sin límite; lo que sobra, al otro con el 25 %; la de hace 4 años que no cabe, caduca", () => {
  const c = report.compensate({ gp: 3000, rcm: 1000, year: "2026", priorLosses: [{ year: "2022", amount: 5000, bloque: "ganancias" }, { year: "2021", amount: 900, bloque: "ganancias" }] });
  assert.deepEqual(c.steps, [{ kind: "prior-own", year: "2022", bloque: "ganancias", amount: 3000 }, { kind: "prior-cross", year: "2022", bloque: "ganancias", amount: 250 }]);
  assert.deepEqual(c.expiredPriorLosses, [{ year: "2022", bloque: "ganancias", amount: 1750 }], "2022 + 4 = 2026: lo que no cabe ahora se pierde");
  assert.deepEqual(c.remainingPriorLosses, [], "la de 2021 ya estaba fuera de plazo y ni se cuenta");
  assert.equal(c.base, 750);
});

test("una pérdida arrastrada de rendimientos va contra los rendimientos y luego contra las ganancias con el 25 %", () => {
  const c = report.compensate({ gp: 2000, rcm: 100, year: "2026", priorLosses: [{ year: "2025", amount: 1000, bloque: "rendimientos" }] });
  assert.deepEqual(c.steps.map((s) => [s.kind, s.amount]), [["prior-own", 100], ["prior-cross", 500]]);
  assert.deepEqual(c.remainingPriorLosses, [{ year: "2025", bloque: "rendimientos", amount: 400 }]);
  assert.equal(c.base, 1500);
});

test("una pérdida diferida por recompra (XIN-02) ni se integra ni se arrastra", () => {
  const r = report.taxReport({ year: 2026, holder: "javi", positions: [posicion("a", "javi", [venta("v1", "2026-05-01", 1000, 2000)])], deferredBySale: { v1: -600 } });
  assert.deepEqual([r.transmissions[0].gain, r.transmissions[0].deferredLoss, r.transmissions[0].integrable], [-1000, -600, -400]);
  assert.deepEqual(r.compensation.carryForward, [{ year: "2026", bloque: "ganancias", amount: 400 }]);
  assert.equal(r.totals.deferredLosses, -600);
});

test("una venta sin lotes: el ejercicio no da cuota y dice por qué; las ventas de otros años no molestan", () => {
  const sinLotes = { ...venta("v1", "2026-05-01", 1000, 0), realizedGain: null, shortfall: 3 };
  const r = report.taxReport({ year: 2026, holder: "javi", positions: [posicion("a", "javi", [sinLotes, { ...sinLotes, id: "v0", date: "2025-01-01" }])] });
  assert.equal(r.calculable, false);
  assert.equal(r.quota, null);
  assert.deepEqual(r.missing.map((m) => m.code), ["sale-without-lots"]);
});

test("una posición conjunta: el 50 % en cada declarante; la del otro, nada; sin titular, bloquea", () => {
  const positions = [posicion("c", "household", [venta("v1", "2026-02-01", 5000, 1000)]), posicion("t", "tere", [venta("v2", "2026-02-01", 9000, 1000)])];
  const javi = report.taxReport({ year: 2026, holder: "javi", positions });
  const tere = report.taxReport({ year: 2026, holder: "tere", positions });
  assert.deepEqual([javi.totals.gpBalance, tere.totals.gpBalance], [2000, 10000]);
  assert.equal(javi.transmissions[0].share, 0.5);
  const sinTitular = report.taxReport({ year: 2026, holder: "javi", positions: [posicion("x", "", [venta("v3", "2026-02-01", 2000, 1000)])] });
  assert.equal(sinTitular.calculable, false);
  assert.deepEqual(sinTitular.missing[0], { code: "position-without-holder", blocking: true, positionId: "x", label: "Posición x", sales: 1 });
});

test("un cobro de una posición tiene el titular de la posición; sin retención española declarada no bloquea, pero lo dice", () => {
  const positions = [posicion("c", "household")];
  const r = report.taxReport({ year: 2026, holder: "tere", positions, rendimientos: [cobro("d1", "2026-03-01", 300, { posicionId: "c", titular: "javi", retencionEspana: null })] });
  assert.equal(r.income[0].gross, 150);
  assert.equal(r.calculable, true);
  assert.equal(r.totals.withholdingComplete, false);
  assert.deepEqual(r.missing.map((m) => [m.code, m.blocking]), [["income-without-spanish-withholding", false]]);
});

test("doble imposición: se deduce lo retenido fuera, como mucho lo que esa renta paga aquí", () => {
  const us = report.taxReport({ year: 2026, holder: "javi", rendimientos: [cobro("d1", "2026-03-01", 1000, { retencionOrigen: 150, paisOrigen: "EE. UU." })] });
  assert.deepEqual(us.doubleTaxDeduction, { foreignPaid: 150, limit: 190, deductible: 150, notRecoverable: 0 });
  assert.equal(us.quota.net, 40);
  const ch = report.taxReport({ year: 2026, holder: "javi", rendimientos: [cobro("d1", "2026-03-01", 1000, { retencionOrigen: 350, paisOrigen: "Suiza" })] });
  assert.deepEqual(ch.doubleTaxDeduction, { foreignPaid: 350, limit: 190, deductible: 190, notRecoverable: 160 });
  const sinPais = report.taxReport({ year: 2026, holder: "javi", rendimientos: [cobro("d1", "2026-03-01", 1000, { retencionOrigen: 150 })] });
  assert.deepEqual(sinPais.missing.map((m) => m.code), ["foreign-withholding-without-country"]);
});

test("el 720: un depositario extranjero por encima del umbral avisa; uno sin declarar dice «sin saber», no «no aplica»", () => {
  const fuera = [posicion("a", "household", [], { depositario: "extranjero", currentValue: 60000 })];
  assert.equal(report.taxReport({ year: 2026, holder: "tere", positions: fuera }).model720.state, "above", "la conjunta cuenta entera (criterio prudente)");
  assert.equal(report.model720Notice([posicion("a", "javi", [], { depositario: "extranjero", currentValue: 40000 })], "javi").state, "below");
  assert.equal(report.model720Notice([posicion("a", "javi", [], { depositario: "" })], "javi").state, "unknown");
  assert.equal(report.model720Notice([posicion("a", "tere", [], { depositario: "" })], "javi").state, "below", "la del otro declarante no cuenta");
});

test("pérdidas arrastradas sin titular: bloquean si aún pueden aplicarse; caducadas, no", () => {
  const r = report.taxReport({ year: 2026, holder: "javi", priorLosses: [{ year: "2024", amount: 500 }] });
  assert.deepEqual(r.missing.map((m) => [m.code, m.count]), [["prior-loss-without-holder", 1]]);
  assert.equal(r.calculable, false);
  assert.equal(report.taxReport({ year: 2026, holder: "javi", priorLosses: [{ year: "2020", amount: 500 }] }).calculable, true);
});

test("sin escala registrada, un ejercicio anterior a 2025 no tiene cuota; con la del hogar, se usa la suya", () => {
  const r = report.taxReport({ year: 2024, holder: "javi", rendimientos: [cobro("d1", "2024-03-01", 1000)] });
  assert.equal(r.calculable, false);
  assert.ok(r.missing.some((m) => m.code === "missing-scale"));
  const propia = { brackets: [{ limit: 6000, rate: 19 }, { limit: null, rate: 21 }], source: { url: "x" } };
  const h = report.taxReport({ year: 2024, holder: "javi", rendimientos: [cobro("d1", "2024-03-01", 1000)], savingsScale: propia });
  assert.deepEqual([h.quota.gross, h.quota.scaleOrigin], [190, "hogar"]);
  assert.equal(report.taxReport({ year: "26", holder: "javi" }).reason, "missing-year");
  assert.equal(report.taxReport({ year: 2026, holder: "household" }).reason, "missing-holder", "el informe es de un declarante");
});

// ---- PR-2: la pantalla (informe-renta-ui.js) y su registro ----
const fs = require("node:fs");
const path = require("node:path");
const ui = require("../informe-renta-ui.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("el informe calculable: la base y la cuota arriba, las tablas, la compensación y el aviso de que no es el modelo 100", () => {
  const r = report.taxReport({ year: 2026, holder: "javi", positions: [posicion("a", "javi", [venta("v1", "2026-03-01", 3000, 5000)], { label: "Fondo <A>" })], rendimientos: [cobro("d1", "2026-06-01", 4000, { retencionOrigen: 100, paisOrigen: "Irlanda" })] });
  const html = ui.informeRentaHtml(r, { declarante: "Javi" });
  assert.match(html, /<strong>Javi, 2026:<\/strong> base liquidable del ahorro estimada de 3000/);
  assert.match(html, /<caption>Transmisiones de 2026<\/caption>/);
  assert.match(html, /Fondo &lt;A&gt;/, "escapado");
  assert.match(html, /role="region" tabindex="0" aria-label="Dividendos e intereses de 2026"/, "la tabla se puede desplazar con el teclado");
  assert.match(html, /compensadas con los rendimientos \(tope del 25 %\): 1000/);
  assert.match(html, /Se arrastra a los 4 años siguientes: 1000 € de transmisiones de 2026|Se arrastra a los 4 años siguientes: 1000/);
  assert.match(html, /la escala de la ley: Ley 7\/2024/);
  assert.match(html, /no el modelo 100 ni asesoría/);
  assert.match(html, /Las ventas de fondos también llevan retención; la app no la guarda/);
});

test("sin poder calcular: lo dice arriba y lista lo que falta, con dónde se arregla; sin cuota", () => {
  const r = report.taxReport({ year: 2026, holder: "tere", positions: [posicion("x", "", [venta("v1", "2026-02-01", 2000, 1000)], { label: "ETF B" })] });
  const html = ui.informeRentaHtml(r, { declarante: "Tere" });
  assert.match(html, /todavía no se puede dar la cuota/);
  assert.match(html, /Lo que falta para dar la cuota/);
  assert.match(html, /«ETF B» tiene ventas este año y no se sabe de quién es\. Dilo en Inversión › Cartera › Datos para la Renta\./);
  assert.doesNotMatch(html, /Cuota estimada/);
  assert.match(html, /Modelo 720: sin saber|Modelo 720: los valores/);
});

test("el CSV se vuelve a leer y cuadra con el informe", () => {
  const r = report.taxReport({ year: 2026, holder: "javi", positions: [posicion("a", "household", [venta("v1", "2026-03-01", 9000, 5000)], { label: "Fondo; con \"comillas\"" })], rendimientos: [cobro("d1", "2026-06-01", 1000.5)] });
  const csv = ui.informeRentaCsv(r);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], "Bloque;Fecha;Concepto;Importe;Adquisición;Retención España;Retención origen;País");
  assert.equal(lines[1], 'Transmisión;2026-03-01;"Fondo; con ""comillas"" (50 %)";2000;2500;;;');
  assert.equal(lines[2], "Dividendo;2026-06-01;Broker;1000,5;;190,1;;");
  const total = (name) => Number(lines.find((l) => l.startsWith(`${name};`)).split(";")[3].replace(",", "."));
  assert.equal(total("Base liquidable del ahorro"), r.compensation.base);
  assert.equal(total("Cuota estimada"), r.quota.net);
});

test("registro: plegado dentro del borrador de apoyo para la Renta, los dos módulos antes de app.js, en el sitio público y el service worker, y app.js lo llama con el motor", () => {
  const html = read("index.html");
  const gob8 = html.indexOf('id="gob8DraftPreview"');
  const caja = html.indexOf('<details class="informe-renta" id="informeRenta">');
  assert.ok(gob8 > 0 && caja > gob8 && caja < html.indexOf("</article>", gob8), "dentro de la tarjeta GOB8, sin titular nuevo");
  ["canonical-tax-report.js", "informe-renta-ui.js"].forEach((file) => {
    const at = html.indexOf(`<script defer src="${file}?v=`);
    assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js'), `${file} antes de app.js`);
    assert.ok(read("service-worker.js").includes(`"./${file}"`));
    assert.ok(read("tools/build-public-site.mjs").includes(`"${file}"`));
  });
  assert.match(read("app.js"), /globalThis\.renderInformeRenta\?\.\(globalThis\.FinanceCanonicalTaxReport\); \/\/ WP-21/);
  assert.doesNotMatch(read("informe-renta-ui.js"), /localStorage/);
});

test("el borrador de apoyo (GOB8) suma una línea por declarante con lo que dice el informe", () => {
  const ok = report.taxReport({ year: 2026, holder: "javi", rendimientos: [cobro("d1", "2026-03-01", 1000)] });
  const falta = report.taxReport({ year: 2026, holder: "tere", positions: [posicion("x", "", [venta("v1", "2026-02-01", 2000, 1000)])] });
  const [a, b] = ui.informeRentaResumenLineas([ok, falta]);
  assert.match(a, /^Javi, 2026: base liquidable del ahorro estimada 1000,00 €; cuota estimada 190,00 € \(escala de la ley\)\.$/);
  assert.equal(b, "Tere, 2026: todavía sin cuota; falta 1 dato (detalle en el informe de inversión, más abajo).");
  const app = read("app.js");
  assert.match(app, /"4\) Inversión: base del ahorro de cada declarante/);
  assert.match(app, /typeof informeRentaResumenTexto === "function" \? informeRentaResumenTexto\(\)/);
});

test("imprimir: un botón, y la hoja de impresión deja solo el informe, sin los controles", () => {
  assert.match(read("index.html"), /<button type="button" class="e19-btn e19-btn-secondary" id="informeRentaImprimir">Imprimir<\/button>/);
  const css = read("styles.css");
  assert.match(css, /body\.imprimiendo-informe-renta \[data-informe-renta-ancestro\] > :not\(\[data-informe-renta-ancestro\]\):not\(#informeRenta\) \{\s*display: none;/);
  // Sin :has() en la hoja de impresión del informe: en WebKit dejó colgado el paso de Safari del CI (5/11/2026).
  const bloque = css.slice(css.indexOf("/* Imprimir solo el informe."), css.indexOf("/* WP-21 · PR-0b: dividendos e intereses cobrados. */"));
  assert.ok(bloque.length > 0 && !bloque.replace(/\/\*[\s\S]*?\*\//g, "").includes(":has("), "la hoja de impresión del informe no usa :has()");
  assert.match(read("informe-renta-ui.js"), /removeAttribute\("data-informe-renta-ancestro"\)/, "las marcas de los antepasados se quitan al terminar");
  assert.match(css, /body\.imprimiendo-informe-renta #informeRenta \.informe-renta-controles \{\s*display: none;/);
  assert.match(read("informe-renta-ui.js"), /addEventListener\("afterprint", quitar\)/, "la clase se quita al terminar de imprimir");
});
