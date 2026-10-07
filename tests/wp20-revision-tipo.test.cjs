const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = require(path.join(root, "canonical-rate-review.js"));
const scenarios = require(path.join(root, "canonical-mortgage-rate-scenarios.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const TODAY = "2026-10-07";
const INDEX = { value: 2, date: "2026-10-05", state: "fresh", ageDays: 2 };
const CONTRACT = { principal: 100000, remainingMonths: 240, payment: 560 };
const SETTINGS = { spread: 1, nextReview: "2027-03-15", rule: "monthlyAverage", ruleLag: 1, currentRate: 3, periodMonths: 12 };
const run = (overrides = {}) => engine.evaluate({ today: TODAY, contract: CONTRACT, settings: SETTINGS, index: INDEX, ...overrides });
const inDays = (days) => engine.addDays(TODAY, days);

// WP-20: revisión del tipo variable de la hipoteca. Estimación con el último Euribor tecleado ± 1 punto; no pronostica ni ejecuta nada.

test("WP-20 · la cuota francesa coincide con la de DI1 (no divergen) y con un caso conocido", () => {
  assert.equal(engine.payment(100000, 3, 240), 554.6, "100.000 € al 3 % a 20 años");
  assert.equal(engine.payment(100000, 0, 240), 416.67, "tipo 0: lineal");
  assert.equal(engine.payment(0, 3, 10), 0);
  assert.equal(engine.payment(100000, -2, 240), 416.67, "un tipo negativo no baja de 0 en la cuota");
  for (const [principal, rate, months] of [[85000, 2.1, 180], [250000, 4.75, 360], [12000, 0.5, 24], [100000, 3, 1]]) {
    assert.equal(engine.payment(principal, rate, months), scenarios.monthlyPayment(principal, rate, months), `${principal} @ ${rate} % / ${months}`);
  }
});

test("WP-20 · el capital proyectado baja con las cuotas y llega a ≈ 0 al final del plazo", () => {
  assert.equal(engine.balanceAfter(100000, 3, 554.6, 0), 100000);
  assert.ok(engine.balanceAfter(100000, 3, 554.6, 12) < 100000);
  assert.ok(Math.abs(engine.balanceAfter(100000, 3, 554.6, 240)) < 5, "con la cuota redondeada sobran céntimos, no euros");
  assert.equal(engine.balanceAfter(100000, 0, 500, 10), 95000);
  assert.equal(engine.balanceAfter(1000, 3, 5000, 12), 0, "nunca negativo");
});

test("WP-20 · la regla del contrato: media del mes N antes (cruzando de año) o valor de un día", () => {
  const month = (nextReview, ruleLag) => engine.readingFor({ rule: "monthlyAverage", ruleLag, nextReview }).month;
  assert.equal(month("2027-03-15", 1), "2027-02");
  assert.equal(month("2027-03-15", 3), "2026-12");
  assert.equal(month("2027-01-10", 2), "2026-11");
  assert.equal(month("2027-03-15", 9), "2026-12", "más de 3 se acota a 3");
  assert.equal(month("2027-03-15", 0), "2027-02", "0 se lee como 1: una media mensual no es del mes en curso");
  assert.match(engine.readingFor({ rule: "monthlyAverage", ruleLag: 1, nextReview: "2027-03-15" }).label, /media mensual del Euribor de febrero de 2027/);
  const day = engine.readingFor({ rule: "dayValue", ruleLag: 15, nextReview: "2027-03-15" });
  assert.equal(day.date, "2027-02-28");
  assert.match(day.label, /15 días antes \(28 de febrero de 2027\)/);
  assert.equal(engine.readingFor({ rule: "dayValue", ruleLag: 0, nextReview: "2027-03-15" }).date, "2027-03-15");
});

test("WP-20 · sin los datos necesarios no inventa nada: dice qué falta", () => {
  const none = engine.evaluate({});
  assert.equal(none.status, "incomplete");
  assert.deepEqual(none.missing, ["la fecha de hoy", "el capital pendiente del contrato", "los plazos restantes (o el vencimiento) del contrato", "el diferencial", "la fecha de la próxima revisión", "el valor del Euribor (tarjeta de índices)"]);
  assert.deepEqual(run({ index: null }).missing, ["el valor del Euribor (tarjeta de índices)"]);
  assert.deepEqual(run({ contract: { ...CONTRACT, remainingMonths: 0 } }).missing, ["los plazos restantes (o el vencimiento) del contrato"]);
  assert.deepEqual(run({ settings: { ...SETTINGS, spread: undefined } }).missing, ["el diferencial"]);
  assert.deepEqual(run({ settings: { ...SETTINGS, nextReview: "15/03/2027" } }).missing, ["la fecha de la próxima revisión"]);
  assert.equal(run({ settings: { ...SETTINGS, spread: 0 } }).status, "ok", "un diferencial de 0 es un dato, no una ausencia");
});

test("WP-20 · cuota estimada: tipo central = Euribor + diferencial y banda de ± 1 punto, ordenada", () => {
  const result = run();
  assert.equal(result.status, "ok");
  assert.equal(result.centralRate, 3);
  assert.equal(result.payment.lowRate, 2);
  assert.equal(result.payment.highRate, 4);
  assert.ok(result.payment.low < result.payment.central && result.payment.central < result.payment.high);
  assert.equal(result.payment.central, engine.payment(result.principalAtReview, 3, result.remainingAtReview));
  assert.equal(result.payment.low, engine.payment(result.principalAtReview, 2, result.remainingAtReview));
  assert.equal(result.payment.high, engine.payment(result.principalAtReview, 4, result.remainingAtReview));
});

test("WP-20 · con Euribor negativo la cuota no baja de la lineal y el tipo mostrado de la banda no baja de 0", () => {
  const result = run({ index: { ...INDEX, value: -0.5 }, settings: { ...SETTINGS, spread: 0.3 } });
  assert.equal(result.centralRate, -0.2);
  assert.equal(result.payment.lowRate, 0);
  assert.equal(result.payment.central, engine.payment(result.principalAtReview, 0, result.remainingAtReview));
});

test("WP-20 · el capital y el plazo se proyectan a la fecha de revisión cuando hay tipo aplicado y cuota; si no, se usa el de hoy y se dice", () => {
  const projected = run();
  assert.equal(projected.projected, true);
  assert.ok(projected.principalAtReview < CONTRACT.principal);
  assert.ok(projected.remainingAtReview < CONTRACT.remainingMonths);
  assert.equal(projected.remainingAtReview, 240 - Math.round(projected.daysToReview / 30.4375));
  const withoutRate = run({ settings: { ...SETTINGS, currentRate: undefined } });
  assert.equal(withoutRate.projected, false);
  assert.equal(withoutRate.principalAtReview, CONTRACT.principal);
  assert.equal(withoutRate.remainingAtReview, 240);
  assert.match(withoutRate.warnings.join(" "), /Sin el tipo aplicado actualmente/);
  // Cuota que no cubre los intereses (100 € frente a ≈ 250 € de intereses): proyectar haría crecer la deuda.
  const underwater = run({ contract: { ...CONTRACT, payment: 100 } });
  assert.equal(underwater.projected, false);
  assert.match(underwater.warnings.join(" "), /No se ha podido proyectar el capital/);
  // Revisión de hoy: nada que proyectar.
  assert.equal(run({ settings: { ...SETTINGS, nextReview: TODAY } }).projected, false);
});

test("WP-20 · cuota actual: la declarada; sin ella, la calculada con el tipo aplicado; sin ninguna, no hay comparación", () => {
  assert.equal(run().currentPayment, 560);
  const computed = run({ contract: { ...CONTRACT, payment: 0 } });
  assert.equal(computed.currentPayment, engine.payment(100000, 3, 240));
  const none = run({ contract: { ...CONTRACT, payment: 0 }, settings: { ...SETTINGS, currentRate: undefined } });
  assert.equal(none.currentPayment, null);
  assert.equal(none.deltaMonthly, null);
  assert.equal(none.deltaYearly, null);
  const result = run();
  assert.equal(result.deltaMonthly, Math.round((result.payment.central - 560) * 100) / 100);
  assert.equal(result.deltaYearly, Math.round((result.payment.central - 560) * 12 * 100) / 100);
});

test("WP-20 · avisos a 60 y 30 días: ninguno a 61, el de 60 a 60, el de 30 a 30 y no antes", () => {
  const phase = (days) => run({ settings: { ...SETTINGS, nextReview: inDays(days) } });
  assert.equal(phase(61).phase, "far");
  assert.deepEqual(phase(61).notices.map((n) => n.active), [false, false]);
  assert.equal(phase(60).phase, "notice60");
  assert.deepEqual(phase(60).notices.map((n) => n.active), [true, false]);
  assert.deepEqual(phase(31).notices.map((n) => n.active), [true, false]);
  assert.equal(phase(30).phase, "notice30");
  assert.deepEqual(phase(30).notices.map((n) => n.active), [true, true]);
  assert.deepEqual(phase(0).notices.map((n) => n.active), [true, true]);
  assert.equal(phase(0).daysToReview, 0);
  assert.deepEqual(phase(100).notices.map((n) => n.date), [engine.addDays(inDays(100), -60), engine.addDays(inDays(100), -30)]);
});

test("WP-20 · una revisión que ya pasó se desplaza por periodos completos (12 o 6 meses) y lo dice", () => {
  const rolled12 = run({ settings: { ...SETTINGS, nextReview: "2026-03-15" } });
  assert.equal(rolled12.nextReview, "2027-03-15");
  assert.equal(rolled12.rolled, true);
  assert.equal(rolled12.savedReview, "2026-03-15");
  assert.match(rolled12.warnings.join(" "), /ya pasó: se asume una revisión cada 12 meses y la siguiente cae el 15 de marzo de 2027/);
  assert.equal(run({ settings: { ...SETTINGS, nextReview: "2026-03-15", periodMonths: 6 } }).nextReview, "2027-03-15", "dos semestres: septiembre ya pasó");
  assert.equal(run({ settings: { ...SETTINGS, nextReview: "2026-01-31", periodMonths: 6 } }).nextReview, "2027-01-31");
  assert.equal(run({ settings: { ...SETTINGS, nextReview: "2021-10-08" } }).nextReview, "2026-10-08", "cinco años atrás");
  assert.equal(run({ settings: { ...SETTINGS, nextReview: "2027-03-15" } }).rolled, false);
  assert.equal(run({ settings: { ...SETTINGS, nextReview: TODAY } }).rolled, false, "hoy no ha pasado");
  assert.equal(run({ settings: { ...SETTINGS, nextReview: "2026-10-06" } }).nextReview, "2027-10-06");
});

test("WP-20 · addMonthsToDate no se pasa de fin de mes", () => {
  assert.equal(engine.addMonthsToDate("2026-01-31", 1), "2026-02-28");
  assert.equal(engine.addMonthsToDate("2028-01-31", 1), "2028-02-29", "bisiesto");
  assert.equal(engine.addMonthsToDate("2026-08-31", 6), "2027-02-28");
  assert.equal(engine.addMonthsToDate("2026-11-30", 3), "2027-02-28");
  assert.equal(engine.addMonthsToDate("2026-12-15", 1), "2027-01-15");
});

test("WP-20 · un Euribor caducado avisa; lo que se usa sigue siendo el último tecleado", () => {
  const stale = run({ index: { ...INDEX, state: "stale", ageDays: 90, date: "2026-07-09" } });
  assert.equal(stale.status, "ok");
  assert.equal(stale.indexState, "stale");
  assert.match(stale.warnings.join(" "), /caducado \(del 9\/7\/2026, hace 90 días\)/);
  assert.equal(run().warnings.filter((text) => /caducado/.test(text)).length, 0);
});

test("WP-20 · la bonificación: sin ella no hay línea; con ella, la cuota si se pierde es mayor", () => {
  assert.equal(run().withoutBonus, null);
  const bonus = run({ settings: { ...SETTINGS, bonusPoints: 0.3 } });
  assert.equal(bonus.withoutBonus.points, 0.3);
  assert.equal(bonus.withoutBonus.rate, 3.3);
  assert.ok(bonus.withoutBonus.central > bonus.payment.central);
  assert.equal(bonus.payment.central, run().payment.central, "la banda no cambia: el diferencial ya la incluye");
});

test("WP-20 · una cuota estimada que es menos de la mitad de la actual avisa de revisar los datos", () => {
  const result = run({ contract: { ...CONTRACT, payment: 2000 } });
  assert.match(result.warnings.join(" "), /menos de la mitad de la actual/);
  assert.equal(run().warnings.filter((text) => /mitad/.test(text)).length, 0);
});

test("WP-20 · el motor no toca la red, el DOM ni el almacenamiento", () => {
  assert.doesNotMatch(read("canonical-rate-review.js"), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\/|document\.|window\.|localStorage/);
});

// --- Cableado ---------------------------------------------------------------------------------

test("WP-20 · la tarjeta está en Deuda › Contratos tras la de índices, con ejemplo marcado y sin ejecutar nada", () => {
  const html = read("index.html");
  const start = html.indexOf('id="deuda-contratos"');
  const section = html.slice(start, start + 24000);
  assert.ok(section.indexOf('id="indicesCard"') < section.indexOf('id="revisionTipoCard"'), "primero los índices, después la revisión");
  for (const id of ["revisionTipoContratoInfo", "revisionTipoForm", "revisionTipoSpread", "revisionTipoBonus", "revisionTipoRate", "revisionTipoPeriod", "revisionTipoDate", "revisionTipoRule", "revisionTipoLag", "revisionTipoGuardar", "revisionTipoNota", "revisionTipoResultado", "revisionTipoEjemplo"]) {
    assert.match(section, new RegExp(`id="${id}"`), id);
  }
  assert.match(section, /estimación, no un pronóstico/);
  assert.ok(html.indexOf("canonical-rate-review.js") < html.indexOf('src="app.js'));
  assert.ok(html.indexOf("revision-tipo-ui.js") < html.indexOf('src="app.js'));
  assert.match(read("revision-tipo-ui.js"), /EJEMPLO · cifras inventadas, no son las tuyas/);
});

test("WP-20 · app.js: pinta la tarjeta, mete el aviso en la bandeja, engancha el evento y el almacén entra en la copia", () => {
  const app = read("app.js");
  assert.match(app, /case "deuda-contratos":\s*renderDeudaContratos\(\);[\s\S]{0,200}globalThis\.renderRevisionTipo\?\.\(globalThis\.FinanceCanonicalRateReview\)/);
  assert.match(app, /items\.push\(\.\.\.\(globalThis\.rateReviewInboxItems\?\.\(globalThis\.FinanceCanonicalRateReview\) \|\| \[\]\)\)/);
  assert.match(app, /globalThis\.attachRevisionTipo\?\.\(document\)/);
  assert.match(app, /"rate-review", \/\/ WP-20/);
  for (const file of ["canonical-rate-review.js", "revision-tipo-ui.js"]) {
    assert.ok(read("service-worker.js").includes(`"./${file}"`), `${file} en el service worker`);
    assert.ok(read("tools/build-public-site.mjs").includes(`"${file}"`), `${file} en la build`);
  }
});

test("WP-20 · el aviso de Hoy solo existe dentro de los 60 días previos (no altera Hoy antes: regla «Hoy congelado»)", () => {
  const source = read("revision-tipo-ui.js");
  assert.match(source, /if \(!active\) return;/);
  assert.match(source, /const active = result\.notices\.filter\(\(notice\) => notice\.active\)/);
});

test("WP-20 · «Novedades» anuncia la revisión y el manual la explica", () => {
  assert.match(read("novedades.js"), /wp20/);
  assert.match(read("MANUAL_USUARIO.md"), /Revisión del tipo variable de la hipoteca/);
});

test("WP-20 · pintar la tarjeta garantiza que sus eventos están enganchados, y la tarjeta sigue a la tabla de contratos y al Euribor", () => {
  const source = read("revision-tipo-ui.js");
  const render = source.slice(source.indexOf("function renderRevisionTipo("), source.indexOf("function revisionNote("));
  assert.match(render, /attachRevisionTipo\(document\); \/\/ idempotente/);
  assert.match(source, /if \(!doc \|\| doc\.__revisionTipoAttached\) return false;/);
  assert.match(source, /new MutationObserver[\s\S]*observe\(table, \{ childList: true, subtree: true \}\)/, "sigue a la tabla de contratos");
  assert.match(read("indices-ui.js"), /renderRevisionTipo\?\.\(globalThis\.FinanceCanonicalRateReview\)/, "los índices avisan a la revisión al guardar");
});

test("WP-20 · las fechas del texto se leen como en España y los campos usan coma decimal", () => {
  assert.equal(engine.shortDate("2026-10-07"), "7/10/2026");
  assert.match(read("revision-tipo-ui.js"), /function revisionNum\(value\)[\s\S]*replace\("\.", ","\)/);
});

// --- Evento de calendario (PR-2 de WP-20, sobre el motor de recordatorios de WP-32) ----------------

const Reminders = require(path.join(root, "canonical-reminders.js"));
const reviewOnly = { kinds: { income: false, bigCharge: false, monthClose: false, fiscal: false, rateReview: true } };
const reviewEvents = (date, extra = {}) => Reminders.build({ today: TODAY, options: reviewOnly, reviews: [{ date, low: 627.16, high: 747.12, ...extra }] }).events;

test("WP-20 · calendario: avisos a 60 y 30 días antes de la revisión, con identificadores estables y sin importes en el título", () => {
  const events = reviewEvents("2027-03-15");
  assert.deepEqual(events.map((event) => [event.date, event.uid, event.title]), [
    ["2027-01-14", "rec-revision-2027-03-15-60", "Revisión del tipo de la hipoteca en 60 días"],
    ["2027-02-13", "rec-revision-2027-03-15-30", "Revisión del tipo de la hipoteca en 30 días"],
  ]);
  events.forEach((event) => assert.doesNotMatch(event.title, /€|\d{3}/, "la pantalla de bloqueo no enseña importes"));
  assert.match(events[0].description, /Cuota estimada de 627,16 € a 747,12 €/, "el detalle sí lleva la cuota");
  assert.match(events[0].description, /estimación, no un pronóstico/);
  assert.match(events[0].description, /la app no ejecuta nada/);
  assert.deepEqual(reviewEvents("2027-03-15").map((event) => event.uid), events.map((event) => event.uid), "regenerar da los mismos identificadores");
});

test("WP-20 · calendario: solo los avisos que aún caen en el futuro; si ya pasaron los dos, uno para hoy; una revisión pasada no genera nada", () => {
  assert.deepEqual(reviewEvents("2026-11-20").map((event) => [event.date, event.title]), [["2026-10-21", "Revisión del tipo de la hipoteca en 30 días"]], "el de 60 días ya pasó");
  const late = reviewEvents("2026-10-20");
  assert.deepEqual(late.map((event) => [event.date, event.title, event.uid]), [["2026-10-07", "Revisión del tipo de la hipoteca en 13 días", "rec-revision-2026-10-20-aviso"]]);
  assert.deepEqual(reviewEvents("2026-10-07").map((event) => event.title), ["Hoy se revisa el tipo de la hipoteca"]);
  assert.match(reviewEvents("2026-10-08")[0].title, /en 1 día$/);
  assert.deepEqual(reviewEvents("2026-10-06"), []);
});

test("WP-20 · calendario: respeta el horizonte del fichero y se puede apagar", () => {
  assert.deepEqual(reviewEvents("2027-06-01").map((event) => event.uid), ["rec-revision-2027-06-01-60"], "el de 30 días cae fuera de los 6 meses del fichero");
  assert.deepEqual(reviewEvents("2028-01-01"), []);
  const off = Reminders.build({ today: TODAY, options: { kinds: { rateReview: false } }, reviews: [{ date: "2027-03-15" }] });
  assert.equal(off.counts.rateReview, 0);
  assert.equal(Reminders.build({ today: TODAY, options: reviewOnly }).events.length, 0, "sin revisiones no hay nada");
  assert.equal(Reminders.build({ today: TODAY, options: reviewOnly, reviews: [null, {}, { date: "mal" }] }).events.length, 0, "datos basura no lanzan");
});

test("WP-20 · calendario: sin la cuota estimada el evento sigue valiendo; entra en el .ics con su alarma", () => {
  const events = reviewEvents("2027-03-15", { low: undefined, high: undefined });
  assert.doesNotMatch(events[0].description, /Cuota estimada/);
  const ics = Reminders.toIcs(events, { now: "2026-10-07T10:00:00Z" });
  assert.match(ics, /UID:rec-revision-2027-03-15-60@contabilidadcasa/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
});

test("WP-20 · calendario: la tarjeta de recordatorios ofrece el tipo y le pasa las revisiones; la de WP-20 las calcula con su motor", () => {
  assert.match(read("index.html"), /data-recordatorios-kind="rateReview" checked/);
  assert.match(read("recordatorios-ui.js"), /reviews: globalThis\.rateReviewCalendarItems\?\.\(\) \|\| \[\]/);
  assert.match(read("recordatorios-ui.js"), /rateReview: "avisos de la hipoteca"/);
  const ui = read("revision-tipo-ui.js");
  assert.match(ui, /function rateReviewCalendarItems\(\)/);
  assert.match(ui, /date: result\.nextReview, low: result\.payment\.low, high: result\.payment\.high/, "usa la fecha ya desplazada si la guardada pasó");
});
