// FX-27 (XDO-02 en parte) · la revisión de la hipoteca como escenario con fecha. Hipoteca FICTICIA (repositorio público): 120.000 €
// a 240 meses, cuota de 640 €, diferencial 0,99 y Euribor tecleado del 2,35 %.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../canonical-stress-scenarios.js");
const R = require("../canonical-rate-review.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const revision = (nextReview, today = "2026-11-12") => R.evaluate({
  today,
  contract: { principal: 120000, remainingMonths: 240, payment: 640 },
  settings: { spread: 0.99, nextReview, periodMonths: 12, rule: "monthlyAverage", ruleLag: 1, currentRate: 3.1 },
  index: { value: 2.35, date: "2026-11-02", state: "fresh", ageDays: 10 },
});

test("FX-27 · a 120 días o menos de la revisión, «Euribor» va delante; más lejos o ya pasada, no", () => {
  assert.equal(S.REVIEW_SOON_DAYS, 120);
  const pronto = revision("2027-01-15"); // 64 días
  const lejos = revision("2027-06-01");
  assert.equal(pronto.daysToReview, 64);
  assert.equal(S.reviewSoon([pronto]), true);
  assert.equal(S.reviewSoon([lejos]), false);
  assert.equal(S.reviewSoon([lejos, pronto]), true, "basta con una hipoteca cerca");
  assert.equal(S.nearestReview([lejos, pronto]), pronto);
  assert.equal(S.reviewSoon([revision("2027-03-12")]), true, "el día 120 cuenta");
  assert.equal(S.reviewSoon([revision("2027-03-13")]), false);
  assert.equal(S.reviewSoon([]), false);
  assert.equal(S.nearestReview([{ status: "incomplete" }]), null);
});

test("FX-27 · tres caminos con el mismo cálculo que la prueba y, con una oferta fija, el cuarto", () => {
  const r = revision("2027-01-15");
  const paths = S.reviewPaths([r], { payment: R.payment });
  assert.deepEqual(paths.map((p) => p.id), ["sin-cambio", "mas-1", "mas-2"]);
  assert.deepEqual(paths.map((p) => p.rate), [3.34, 4.34, 5.34], "Euribor tecleado + diferencial, +1 y +2");
  // +1 es exactamente la prueba de siempre (euriborShocks): un solo cálculo.
  assert.deepEqual(paths[1].shocks, S.euriborShocks([r], 1, R.payment));
  // Cada punto más, la cuota sube.
  assert.ok(paths[0].shocks[0].to < paths[1].shocks[0].to && paths[1].shocks[0].to < paths[2].shocks[0].to);
  const conFija = S.reviewPaths([r], { payment: R.payment, fixedRate: 2 });
  assert.deepEqual(conFija.map((p) => p.id), ["sin-cambio", "mas-1", "mas-2", "fija"]);
  assert.equal(conFija[3].rate, 2);
  assert.equal(conFija[3].shocks[0].to, Math.round(R.payment(r.principalAtReview, 2, r.remainingAtReview) * 100) / 100);
  assert.ok(conFija[3].shocks[0].extra < 0, "un fijo más bajo que el tipo de hoy baja la cuota (la previsión no lo suma)");
  // Con dos hipotecas no se sabe a cuál va la oferta (DEB-4 guarda una): sin camino fijo.
  assert.equal(S.reviewPaths([r, revision("2027-06-01")], { payment: R.payment, fixedRate: 2.9 }).some((p) => p.id === "fija"), false);
  assert.deepEqual(S.reviewPaths([], { payment: R.payment }), []);
  assert.deepEqual(S.reviewPaths([r], { payment: R.payment, fixedRate: 0 }).map((p) => p.id), ["sin-cambio", "mas-1", "mas-2"]);
});

test("FX-27 · enganchado en «Comparar con»: el orden de las pruebas y la tabla de caminos con la prueba del Euribor sola", () => {
  const prevision = read("views/prevision-v2.js");
  assert.match(prevision, /\[\{ id: "", short: "Solo el plan" \}, \.\.\.previsionV2PresetsOrden\(S, today\), /);
  assert.match(prevision, /\$\{previsionV2CaminosHtml\(prueba, today\)\}/);
  assert.match(prevision, /prueba\?\.preset\?\.id !== "euribor" \|\| prueba\.combined \|\| !prueba\.applied/, "con dos pruebas juntas no hay caminos");
  assert.match(prevision, /S\.reviewPaths\(revisiones, \{ payment: globalThis\.FinanceCanonicalRateReview\.payment, fixedRate: oferta\?\.tipo \?\? null \}\)/);
  assert.match(prevision, /scenarioSettings\?\.deb4Radar/, "la oferta fija es la de DEB-4 (Ajustes), no un campo nuevo");
  assert.doesNotMatch(read("canonical-stress-scenarios.js"), /fetch\(|localStorage|document\./);
});
