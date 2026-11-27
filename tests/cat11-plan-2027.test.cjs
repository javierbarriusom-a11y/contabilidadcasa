const test = require("node:test");
const assert = require("node:assert/strict");
const plan = require("../canonical-plan-2027.js");

// CAT-11 / TRE-12 con D-N46 C (27/11/2026). Datos inventados.
const VENTANA = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const AÑO = ["2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09", "2027-10", "2027-11", "2027-12"];
const HOY = "2026-11-27";

const cada = (keys, valor) => Object.fromEntries(keys.map((k, i) => [k, typeof valor === "function" ? valor(k, i) : valor]));

function partida(key, kind, planned, real, extra = {}) {
  return { key, kind, label: key, section: "S", planned, real, ...extra };
}

// Una partida mensual que «cubre» todos los meses de la ventana, para que haya meses cubiertos.
const super12 = partida("super", "expense", cada(AÑO, 450), cada(VENTANA, (k, i) => [480, 520, 510, 490, 900, 500, 505, 495, 500, 510, 490, 500][i]));

function modelo(partidas, ventana = VENTANA) {
  return plan.buildModel({ partidas, windowMonths: ventana, targetMonths: AÑO, today: HOY });
}

test("sin los 12 meses del año que viene no calcula", () => {
  assert.equal(plan.buildModel({ partidas: [], windowMonths: VENTANA, targetMonths: AÑO.slice(0, 11), today: HOY }).calculable, false);
});

test("una partida mensual se propone por su mediana × 12; un mes raro (900) no manda", () => {
  const m = modelo([super12]);
  const it = m.items.find((i) => i.key === "super");
  assert.equal(it.tipo, "mensual");
  assert.equal(it.mediana, 500);
  assert.equal(it.propuestoAnual, 6000);
  assert.equal(it.porDefecto, "mediana");
  assert.match(it.porque, /Mediana de 12 meses/);
});

test("un seguro anual (lo previsto cambia de mes a mes) conserva su forma: nunca 600 × 12", () => {
  const seguro = partida("seguro", "expense", cada(AÑO, (k) => (k === "2027-03" ? 600 : 0)), { "2026-03": 600 });
  const it = modelo([super12, seguro]).items.find((i) => i.key === "seguro");
  assert.equal(it.tipo, "sin-historia");
  assert.equal(it.propuestoAnual, 600);
  const seguro3 = partida("seguro", "expense", cada(AÑO, (k) => (k === "2027-03" ? 600 : 0)), { "2025-12": 600, "2026-03": 600, "2026-06": 600 });
  const it3 = modelo([super12, seguro3]).items.find((i) => i.key === "seguro");
  assert.equal(it3.tipo, "no-mensual");
  assert.equal(it3.propuestoAnual, 600);
});

test("lo previsto plano con reales sueltos (provisión mensual de un pago anual) no se multiplica por 12", () => {
  const ibi = partida("ibi", "expense", cada(AÑO, 50), { "2026-01": 300, "2026-06": 300, "2026-09": 300 });
  const it = modelo([super12, ibi]).items.find((i) => i.key === "ibi");
  assert.equal(it.tipo, "no-mensual");
  assert.match(it.porque, /3 de 12 meses/);
  assert.equal(it.propuestoAnual, 600);
});

test("las pagas extra (ingreso con dos meses dobles) conservan su forma", () => {
  const nomina = partida("nomina", "income", cada(AÑO, (k) => (k === "2027-06" || k === "2027-12" ? 4000 : 2000)), cada(VENTANA, (k) => (k === "2026-06" || k === "2025-12" ? 4000 : 2000)));
  const it = modelo([super12, nomina]).items.find((i) => i.key === "nomina");
  assert.equal(it.tipo, "no-mensual");
  assert.equal(it.propuestoAnual, 28000);
});

test("lo que manda otra cosa (contrato de deuda) no se toca", () => {
  const cuota = partida("hipoteca", "expense", cada(AÑO, 700), cada(VENTANA, 680), { locked: "contrato de deuda" });
  const m = modelo([super12, cuota]);
  const it = m.items.find((i) => i.key === "hipoteca");
  assert.equal(it.tipo, "bloqueada");
  assert.equal(it.propuestoAnual, 8400);
  assert.equal(plan.cambios(m).filter((c) => c.key === "hipoteca").length, 0);
});

test("D-N46 C: si el último trimestre se aparta más de un 20 % y 10 €, se ofrecen las dos cifras; nunca se elige sola", () => {
  const luz = partida("luz", "expense", cada(AÑO, 80), cada(VENTANA, (k, i) => (i >= 9 ? 120 : 80)));
  const m = modelo([super12, luz]);
  const it = m.items.find((i) => i.key === "luz");
  assert.equal(it.mediana, 80);
  assert.equal(it.tipo, "en-linea");
  assert.deepEqual([it.alternativa.importe, it.alternativa.pct], [120, 50]);
  assert.equal(m.conAviso, 1);
  // Por defecto, la mediana (que coincide con lo previsto: no cambia nada); el trimestre solo si se elige.
  assert.deepEqual(plan.cambios(m).filter((c) => c.key === "luz"), []);
  const conTrimestre = plan.cambios(m, { luz: "trimestre" }).filter((c) => c.key === "luz");
  assert.equal(conTrimestre.length, 12);
  assert.equal(conTrimestre[0].to, 120);
});

test("una diferencia pequeña en euros o en % no avisa", () => {
  const agua = partida("agua", "expense", cada(AÑO, 30), cada(VENTANA, (k, i) => (i >= 9 ? 38 : 30)));
  assert.equal(modelo([super12, agua]).items.find((i) => i.key === "agua").alternativa, null);
  const casa = partida("casa", "expense", cada(AÑO, 1000), cada(VENTANA, (k, i) => (i >= 9 ? 1150 : 1000)));
  assert.equal(modelo([super12, casa]).items.find((i) => i.key === "casa").alternativa, null);
});

test("con cuatro meses de historia (agosto-noviembre) no se compara: «poca historia», y se queda la mediana", () => {
  const cuatro = VENTANA.slice(-4);
  const ocio = partida("ocio", "expense", cada(AÑO, 200), cada(cuatro, (k, i) => [150, 160, 300, 310][i]));
  const super4 = partida("super", "expense", cada(AÑO, 500), cada(cuatro, 500));
  const m = modelo([super4, ocio]);
  const it = m.items.find((i) => i.key === "ocio");
  assert.equal(it.tipo, "mensual");
  assert.equal(it.alternativa, null);
  assert.equal(it.aviso.id, "poca-historia");
  assert.equal(m.pocaHistoria, 2);
  assert.equal(it.mediana, 230);
});

test("cambios: solo las celdas que cambian; «mantener» no toca nada", () => {
  const ropa = partida("ropa", "expense", cada(AÑO, 100), cada(VENTANA, 150));
  const m = modelo([super12, ropa]);
  const c = plan.cambios(m).filter((x) => x.key === "ropa");
  assert.equal(c.length, 12);
  assert.deepEqual(c[0], { key: "ropa", monthKey: "2027-01", from: 100, to: 150 });
  assert.equal(plan.cambios(m, { ropa: "mantener" }).filter((x) => x.key === "ropa").length, 0);
  assert.equal(plan.cambios(m, { ropa: "trimestre" }).filter((x) => x.key === "ropa")[0].to, 150, "sin alternativa, «trimestre» vale la mediana");
});

test("totales: real de 12 meses, previsto y propuesto por ingresos y gastos", () => {
  const ropa = partida("ropa", "expense", cada(AÑO, 100), cada(VENTANA, 150));
  const m = modelo([super12, ropa]);
  assert.equal(m.totales.gastos.previsto, 5400 + 1200);
  assert.equal(m.totales.gastos.propuesto, 6000 + 1800);
  assert.equal(m.totales.gastos.real12, 6400 + 1800);
});

test("a precios de hoy: la inflación no se escribe en el plan; el texto dice cuánto añade la previsión", () => {
  const m = modelo([super12]);
  assert.ok(plan.cambios(m).length === 12 && plan.cambios(m).every((c) => c.to === 500), "las celdas, a precios de hoy");
  const texto = plan.inflacionTexto(m, 2);
  assert.match(texto, /^A precios de hoy\. Con la inflación de Ajustes \(2 % al año\)/);
  // 500 €/mes en 2027, a 2-13 meses de noviembre de 2026: unos 90 € en el año.
  const extra = Number(texto.match(/unos ([\d.]+) €/)[1].replace(".", ""));
  assert.ok(extra > 70 && extra < 110, `extra ${extra}`);
  assert.equal(plan.inflacionTexto(m, 0), "");
});

test("el plan ya recoge un cambio reciente (más cerca del trimestre que de la mediana): por defecto se mantiene", () => {
  const alquiler = partida("alquiler", "expense", cada(AÑO, 1150), cada(VENTANA, (k, i) => (i >= 9 ? 1150 : 1000)));
  const m = modelo([super12, alquiler]);
  const it = m.items.find((i) => i.key === "alquiler");
  assert.equal(it.mediana, 1000);
  assert.equal(it.porDefecto, "mantener");
  assert.equal(it.propuestoAnual, 13800);
  assert.deepEqual(plan.cambios(m).filter((c) => c.key === "alquiler"), [], "no arrastra el plan a 1.000");
  assert.equal(plan.cambios(m, { alquiler: "mediana" }).filter((c) => c.key === "alquiler")[0].to, 1000, "la mediana se puede elegir");
});

test("una partida que ya no está en el plan del año que viene no se vuelve a añadir", () => {
  const gym = partida("gym", "expense", cada(AÑO, 0), cada(VENTANA, 40));
  const m = modelo([super12, gym]);
  assert.equal(m.items.find((i) => i.key === "gym").tipo, "fuera-del-plan");
  assert.deepEqual(plan.cambios(m).filter((c) => c.key === "gym"), []);
});

test("sin real en los últimos tres meses cubiertos no se propone (¿ha terminado?)", () => {
  const cole = partida("cole", "expense", cada(AÑO, 100), cada(VENTANA.slice(0, 9), 300));
  const m = modelo([super12, cole]);
  assert.equal(m.items.find((i) => i.key === "cole").tipo, "sin-real-reciente");
  assert.deepEqual(plan.cambios(m).filter((c) => c.key === "cole"), []);
});

test("una diferencia trivial (500 frente a 503) no cambia doce celdas", () => {
  const gas = partida("gas", "expense", cada(AÑO, 500), cada(VENTANA, 503));
  const m = modelo([super12, gas]);
  assert.equal(m.items.find((i) => i.key === "gas").tipo, "en-linea");
  assert.deepEqual(plan.cambios(m).filter((c) => c.key === "gas"), []);
});

test("solo escribe en los meses en que la partida existe", () => {
  const extra = partida("extra", "expense", cada(AÑO.slice(0, 6), 100), cada(VENTANA, 200), { futureMonths: AÑO.slice(0, 6) });
  const m = modelo([super12, extra]);
  const c = plan.cambios(m).filter((x) => x.key === "extra");
  assert.deepEqual(c.map((x) => x.monthKey), AÑO.slice(0, 6));
  assert.equal(m.items.find((i) => i.key === "extra").propuestoAnual, 1200);
});
