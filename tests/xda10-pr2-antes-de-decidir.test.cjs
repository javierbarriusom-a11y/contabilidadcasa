// XDA-10 · PR-2 «Antes de decidir»: el Euribor, cancelar una deuda entera (DEB-15 y DEB-17) y los escenarios (las pruebas de «Comparar
// con» de la Previsión, sus escenarios guardados y el veredicto de la reserva en Escenarios). Cifras FICTICIAS (repositorio público).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = require("../canonical-decision-freshness.js");
const Q = require("../canonical-data-queue.js");
const I = require("../canonical-rate-indices.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const saldos = (ageDays, plausibleMove) => ({ id: "balances", label: "Los saldos", ageDays, staleAfterDays: 4, plausibleMove, action: { label: "Actualizar saldos", href: "#visual-detail" } });
const euribor = (ageDays, lectura) => ({ id: "euribor", label: "El Euribor tecleado (2,35 %)", plural: false, ageDays, staleAfterDays: 36, plausibleMove: null, ...lectura, action: { label: "Actualizar el Euribor", href: "#deuda-contratos" } });

/** antes-de-decidir-ui.js en un contexto con lo mínimo de app.js: hoy fijo, la función encendida y unos saldos de `edad` días. */
function pantalla({ edad = 12, gastoDiario = 80, encendida = true, revisiones = [], auto = false } = {}) {
  const hoy = "2026-11-12";
  const vistas = [];
  const ctx = {
    console,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : ["2026-11-12T10:00:00"])); } },
    isoLocalDate: () => hoy,
    escapeHtml: (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"),
    datosSources: () => ({ balanceMode: auto ? "auto" : "manual", balanceDate: Q.addDays ? Q.addDays(hoy, -edad) : new Date(Date.parse(`${hoy}T00:00:00Z`) - edad * 86400000).toISOString().slice(0, 10), dailyOutflow: gastoDiario }),
    previsionV2Revisiones: () => ({ reviews: revisiones, missing: [] }),
    previsionV2Partes: (prueba) => (Array.isArray(prueba?.parts) ? prueba.parts : prueba ? [prueba] : []),
  };
  ctx.globalThis = ctx;
  ctx.FinanceCanonicalDecisionFreshness = F;
  ctx.FinanceCanonicalDataQueue = Q;
  ctx.FinanceCanonicalDataAge = { STALE_AFTER_DAYS: 4 };
  ctx.FinanceCanonicalRateIndices = I;
  ctx.FinanceFuncionesEnPrueba = { encendida: (id) => encendida && id === "antes-de-decidir" };
  ctx.FinanceMedidor = { anotar: (id, que) => vistas.push(`${id}:${que}`) };
  vm.createContext(ctx);
  vm.runInContext(read("antes-de-decidir-ui.js"), ctx);
  return { ctx, vistas, hoy };
}

/** Una trayectoria diaria inventada: `inicio` € y cada día `paso` € (con signo), del 12/11 en adelante. */
function trayectoria(dias, inicio, paso, desplaza = () => 0) {
  return Array.from({ length: dias }, (_, at) => {
    const date = new Date(Date.UTC(2026, 10, 12 + at)).toISOString().slice(0, 10);
    return { date, total: inicio + paso * at - desplaza(at, date) };
  });
}

test("XDA-10 PR-2 · el motor acepta datos con su lectura hecha (el Euribor, en puntos) y nombra los demás que importan", () => {
  const r = F.check({ margin: 500, inputs: [saldos(12, 960), euribor(70, { flips: "unknown", because: "si hoy está 0,4 puntos más alto, bajaríais del suelo" })] });
  assert.deepEqual(r.items.map((item) => [item.id, item.flips]), [["balances", "yes"], ["euribor", "unknown"]]);
  assert.equal(r.sentence, "Antes de decidir, actualiza los saldos (de hace 12 días): pueden haberse movido hasta 960 € y el resultado cambia con 500 €. También conviene actualizar el Euribor tecleado (2,35 %) (de hace 70 días).");
  // Solo el Euribor: su razón, con la mayúscula del nombre propio.
  const solo = F.check({ margin: 5000, inputs: [saldos(2, 160), euribor(70, { flips: "unknown", because: "si hoy está 0,4 puntos más alto, bajaríais del suelo" })] });
  assert.equal(solo.sentence, "Antes de decidir, conviene actualizar el Euribor tecleado (2,35 %) (de hace 70 días): si hoy está 0,4 puntos más alto, bajaríais del suelo.");
  // Un dato que no cambia nada, en singular, y la lectura hecha manda sobre los euros.
  const no = F.check({ margin: 5000, inputs: [euribor(70, { flips: "no", because: "la cuota nueva no llega dentro de este horizonte" })] });
  assert.equal(no.sentence, "El Euribor tecleado (2,35 %) es de hace 70 días, pero la cuota nueva no llega dentro de este horizonte.");
  assert.equal(F.check({ margin: 5000, inputs: [euribor(30, { flips: "unknown", because: "x" })] }).status, "fresh", "el Euribor vale 35 días (canonical-rate-indices.js)");
  assert.equal(F.check({ margin: 5000, inputs: [euribor(36, { flips: "unknown", because: "x" })] }).status, "stale");
  assert.equal(F.check({ margin: 5000, inputs: [{ ...saldos(12, 960), flips: "talvez" }] }).items[0].flips, "no", "una lectura que no es de las tres no se acepta");
});

test("XDA-10 PR-2 · Euribor: cuántos puntos le darían la vuelta a la prueba, hacia el lado prudente, frente a lo que ha podido moverse", () => {
  const { ctx } = pantalla();
  // Plan: 6.000 € planos 120 días. La prueba (+1 punto) quita 100 € al mes desde el 1/12. Suelo 5.000.
  const base = trayectoria(120, 6000, 0);
  const meses = (date) => Math.max(0, (Number(date.slice(0, 4)) - 2026) * 12 + Number(date.slice(5, 7)) - 12 + 1);
  const prueba = trayectoria(120, 6000, 0, (_, date) => (date >= "2026-12-01" ? 100 * meses(date) : 0));
  const to = base.at(-1).date; // 11/3/2027: cuatro cuotas nuevas, 400 € menos
  const lee = (extra) => ctx.antesDeDecidirEuriborLectura({ base, rows: prueba, today: "2026-11-12", to, floor: 5000, points: 1, crosses: false, baseCrosses: false, ...extra });
  // 5.600 € el último día y cada punto quita 400 € ese día: 600 € hasta el suelo son 1,5 puntos (los días de antes dan más).
  assert.deepEqual({ ...lee({}) }, { need: 1.5, toward: "up" });
  // Con el suelo a 5.700 € la prueba baja (5.600 €): haría falta un Euribor 0,25 puntos más bajo, que se dice 0,3 (hacia arriba).
  assert.deepEqual({ ...lee({ floor: 5700, crosses: true }) }, { need: 0.3, toward: "down" });
  // El plan ya baja del suelo: el Euribor no le da la vuelta. La cuota nueva fuera del horizonte, tampoco.
  assert.equal(lee({ floor: 7000, crosses: true, baseCrosses: true }).flips, "no");
  assert.deepEqual({ ...lee({ to: "2026-11-30" }) }, { flips: "no", because: "la cuota nueva no llega dentro de este horizonte" });
  // Un día bajo el suelo que la subida no toca (el plan también baja ese día): por mucho que haya bajado el Euribor, se sigue bajando.
  const hueco = (at) => (at === 5 ? 1500 : 0);
  const antes = trayectoria(120, 6000, 0, (at, date) => hueco(at) + (date >= "2026-12-01" ? 100 * meses(date) : 0));
  assert.equal(ctx.antesDeDecidirEuriborLectura({ base: trayectoria(120, 6000, 0, hueco), rows: antes, today: "2026-11-12", to, floor: 5000, points: 1, crosses: true, baseCrosses: false }).flips, "no");
  // Con la edad: como mucho 1 punto por mes (su mayor salto mensual). A 70 días, hasta 2,3 puntos: 1,5 le da la vuelta; 13,1, no.
  const si = ctx.antesDeDecidirEuriborVeredicto({ need: 1.5, toward: "up" }, 70);
  assert.deepEqual([si.flips, si.because], ["yes", "puede haberse movido hasta 2,3 puntos y con 1,5 puntos más bajaríais del suelo"]);
  const no = ctx.antesDeDecidirEuriborVeredicto({ need: 13.1, toward: "up" }, 70);
  assert.deepEqual([no.flips, no.because], ["no", "haría falta que hubiera subido 13,1 puntos para cambiar el resultado, y su mayor salto en un mes ha sido de 1 punto (septiembre de 2022)"]);
  assert.equal(ctx.antesDeDecidirEuriborVeredicto({ need: 0.3, toward: "down" }, 40).because, "puede haberse movido hasta 1,3 puntos y con 0,3 puntos menos ya no bajaríais del suelo");
});

test("XDA-10 PR-2 · cancelar una deuda entera: una sola línea para los tres guardarraíles, con el más justo", () => {
  const { ctx, vistas } = pantalla({ edad: 12, gastoDiario: 80 }); // hasta 960 €
  const hoy = { remaining: 9000, floor: 6000, status: "sostenible" }; // 3.000 € de margen: no le da la vuelta
  const meses = { calculable: true, horizonMonths: 6, holds: true, worst: { projectedLiquidity: 6500 } }; // 500 €: sí
  const tension = { calculable: true, horizonMonths: 6, holds: true, worst: { projectedLiquidity: 6200 } }; // 200 €: sí, el más justo
  const html = ctx.antesDeDecidirCancelacionHtml([hoy, meses, tension]);
  assert.match(html, /data-antes-decidir="yes"/);
  assert.match(html, /data-antes-decidir-cual="el de tensión"/);
  assert.match(html, /el resultado cambia con 200 €/);
  assert.match(html, /Los 3 guardarraíles de arriba son con estos datos; el más justo es el de tensión/);
  assert.equal(vistas.length, 1);
  // Si el de tensión ya rompe el suelo, ese no se sabe; el que da la vuelta (6 meses, 500 €) pasa delante.
  const rota = ctx.antesDeDecidirCancelacionHtml([hoy, meses, { ...tension, holds: false, worst: { projectedLiquidity: 5800 } }]);
  assert.match(rota, /data-antes-decidir-cual="el de 6 meses"/);
  // Sin los de meses (sin previsión), el de hoy solo; y el guardarraíl de hoy deja su línea a la de la cancelación.
  assert.match(ctx.antesDeDecidirCancelacionHtml([hoy, null, null]), /no cambia el resultado/);
  assert.equal(ctx.antesDeDecidirHtml({ ...hoy, antesDeDecidirAparte: true }, F), "");
  assert.notEqual(ctx.antesDeDecidirHtml(hoy, F), "", "fuera de una cancelación, el guardarraíl de hoy sigue con su línea (PR-1)");
  // Con los saldos al día o la función apagada, nada.
  assert.equal(pantalla({ edad: 2 }).ctx.antesDeDecidirCancelacionHtml([hoy, meses, tension]), "");
  assert.equal(pantalla({ encendida: false }).ctx.antesDeDecidirCancelacionHtml([hoy, meses, tension]), "");
});

test("XDA-10 PR-2 · «Comparar con» y Escenarios: los saldos contra el margen de la prueba o de la reserva, y el Euribor en su prueba", () => {
  const revision = { status: "ok", indexDate: "2026-09-03", indexValue: 2.35, currentPayment: 900 };
  const { ctx } = pantalla({ edad: 12, gastoDiario: 80, revisiones: [revision] });
  const base = trayectoria(120, 6000, 0);
  const meses = (date) => Math.max(0, (Number(date.slice(0, 4)) - 2026) * 12 + Number(date.slice(5, 7)) - 12 + 1);
  const rows = trayectoria(120, 6000, 0, (_, date) => (date >= "2026-12-01" ? 100 * meses(date) : 0));
  const c = { low: { value: 5600, date: rows.at(-1).date }, crossesFloor: false, baseCrossesFloor: false, end: { date: rows.at(-1).date } };
  const html = ctx.antesDeDecidirPruebaHtml({ prueba: { preset: { id: "euribor" }, params: { points: 1 }, rows }, c, floor: 5000, today: "2026-11-12", base });
  // Los saldos (960 € frente a 600 € de margen) le dan la vuelta, y el Euribor de hace 70 días (1,5 puntos de 2,3 posibles) también: va
  // primero el más antiguo, el otro se nombra detrás, con los dos enlaces, y la nota explica los dos «hasta».
  assert.match(html, /Antes de decidir, actualiza el Euribor tecleado \(de hace 70 días\): puede haberse movido hasta 2,3 puntos y con 1,5 puntos más bajaríais del suelo\. También conviene actualizar los saldos \(de hace 12 días\)\./);
  assert.match(html, /«hasta» es, en los saldos, una estimación \(gasto diario × días\), y en el Euribor, su mayor salto en un mes \(1 punto, septiembre de 2022\) por cada mes\./);
  assert.match(html, /href="#deuda-contratos"[^>]*>Actualizar el Euribor<\/a> <a href="#visual-detail"[^>]*>Actualizar saldos<\/a>/);
  // Con saldos frescos, solo el Euribor, con sus puntos.
  const fresco = pantalla({ edad: 1, revisiones: [revision] }).ctx.antesDeDecidirPruebaHtml({ prueba: { preset: { id: "euribor" }, params: { points: 1 }, rows }, c, floor: 5000, today: "2026-11-12", base });
  assert.match(fresco, /Antes de decidir, actualiza el Euribor tecleado \(de hace 70 días\): puede haberse movido hasta 2,3 puntos y con 1,5 puntos más bajaríais del suelo\./);
  assert.doesNotMatch(fresco, /gasto diario/, "sin saldos en la línea, la nota no explica su «hasta»");
  // Otra prueba (un imprevisto) no mira el Euribor.
  const imprevisto = pantalla({ edad: 1, revisiones: [revision] }).ctx.antesDeDecidirPruebaHtml({ prueba: { preset: { id: "imprevisto" }, rows }, c, floor: 5000, today: "2026-11-12", base });
  assert.equal(imprevisto, "");
  // Saldos sin fecha («Auto por fecha»): la prueba no repite la línea de los saldos; sale una vez, fija, junto a «Comparar con».
  const auto = pantalla({ auto: true, revisiones: [revision] }).ctx;
  assert.equal(auto.antesDeDecidirPruebaHtml({ prueba: { preset: { id: "imprevisto" }, rows }, c, floor: 5000, today: "2026-11-12", base }), "");
  assert.doesNotMatch(auto.antesDeDecidirPruebaHtml({ prueba: { preset: { id: "euribor" }, params: { points: 1 }, rows }, c, floor: 5000, today: "2026-11-12", base }), /saldos/, "el Euribor sigue; los saldos, no");
  assert.match(auto.antesDeDecidirPrevisionHtml(), /^<p class="e19-kpi-note antes-decidir antes-decidir-fija"[^>]*>Antes de decidir con estas pruebas: los saldos se calculan por calendario y no tienen fecha, así que no sé cuánto se han movido\. <a href="#visual-detail"/);
  assert.equal(ctx.antesDeDecidirPrevisionHtml(), "", "con saldos con fecha, la línea fija no sale (cada prueba dice lo suyo)");
  assert.equal(pantalla({ auto: true, encendida: false }).ctx.antesDeDecidirPrevisionHtml(), "");
  // Escenarios: la reserva que se mantiene con 300 € le da la vuelta; rota, «conviene»; sin reserva indicada, nada.
  assert.match(ctx.antesDeDecidirEscenarioHtml({ minimo: 6300, reserva: 6000, rota: false }), /el resultado cambia con 300 €/);
  assert.match(ctx.antesDeDecidirEscenarioHtml({ minimo: 5800, reserva: 6000, rota: true }), /data-antes-decidir="unknown"/);
  assert.equal(ctx.antesDeDecidirEscenarioHtml({ minimo: 6300, reserva: 0, rota: false }), "");
});

test("XDA-10 PR-2 · enganchado en Deuda › Comparar, en «Comparar con» y en Escenarios, sin recalcular nada", () => {
  const app = read("app.js");
  assert.match(app, /if \(guardrail && isFullCancellation\) guardrail\.antesDeDecidirAparte = true;/);
  assert.match(app, /globalThis\.antesDeDecidirCancelacionHtml\?\.\(\[guardrail, cancellationGuardrail, cancellationStressGuardrail\]\)/);
  const prevision = read("views/prevision-v2.js");
  assert.match(prevision, /\$\{previsionV2AntesDeDecidir\(prueba, c, today, fuera\)\}/);
  assert.match(prevision, /\$\{previsionV2GuardadoSelectorHtml\(elegido\)\}\$\{previsionV2AntesSaldosHtml\(\)\}`;/, "la línea fija va con la fila de «Comparar con», que sale en todos los casos");
  assert.match(prevision, /globalThis\.antesDeDecidirPruebaHtml\(\{ prueba, c, floor: Number\(previsionV2Ultimo\?\.floor\) \|\| 0, today, base: previsionV2Ultimo\?\.rows \|\| \[\] \}\)/);
  const escenarios = read("views/escenarios.js");
  assert.match(escenarios, /globalThis\.antesDeDecidirEscenarioHtml\?\.\(\{ minimo: scenarioSummary\.minimoLiquidez, reserva: escenarioMotorGuardrailValue, rota: reserva\?\.status === "fail" \}\)/);
  const ui = read("antes-de-decidir-ui.js");
  assert.doesNotMatch(ui, /localStorage|fetch\(/);
  assert.match(ui, /No estima cuánto se ha movido el Euribor: eso lo pone la cota de arriba/);
  assert.match(ui, /const ANTES_DECIDIR_EURIBOR_MES = 1;/, "la cota del Euribor es un criterio con nombre, no un número suelto");
});
