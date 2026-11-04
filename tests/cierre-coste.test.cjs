// Coste del cierre (4/11/2026, sesión 399): el medidor de utilidad (medidor-utilidad.js) cuenta el tiempo activo de cada
// cierre de mes (Cierre, Movimientos con Clasificar y Registrar, mientras el mes que enseña Cierre ya terminó y no está
// firmado), los días, los grupos sin partida de ese mes al empezar y lo que queda en «Por clasificar» al firmar. Es la
// comparación del cierre de noviembre con la línea base de octubre (unos 45 min, dicho por el hogar). Sin importes.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const medidor = require("../medidor-utilidad.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("el tiempo de cada rato suma como mucho una pausa (3 min); los días no se repiten y los grupos son los del primer rato", () => {
  let store = medidor.registrarTiempoCierre(null, { mes: "2026-11", segundos: 600, hoy: "2026-12-01", grupos: 12 });
  store = medidor.registrarTiempoCierre(store, { mes: "2026-11", segundos: 120, hoy: "2026-12-01", grupos: 3 });
  store = medidor.registrarTiempoCierre(store, { mes: "2026-11", segundos: 60, hoy: "2026-12-02" });
  const c = medidor.cierre(store, "2026-11");
  assert.equal(medidor.CIERRE_PAUSA_S, 180);
  assert.deepEqual({ ...c }, { mes: "2026-11", minutos: 6, dias: 2, grupos: 12, firmado: "", porClasificar: null });
});

test("la firma se anota una vez, con lo que quedó en «Por clasificar»; después ya no suma tiempo", () => {
  let store = medidor.registrarTiempoCierre(null, { mes: "2026-11", segundos: 120, hoy: "2026-12-01" });
  store = medidor.registrarFirmaCierre(store, { mes: "2026-11", hoy: "2026-12-02", porClasificar: 3 });
  store = medidor.registrarFirmaCierre(store, { mes: "2026-11", hoy: "2026-12-05", porClasificar: 9 });
  store = medidor.registrarTiempoCierre(store, { mes: "2026-11", segundos: 120, hoy: "2026-12-06" });
  const c = medidor.cierre(store, "2026-11");
  assert.equal(c.firmado, "2026-12-02");
  assert.equal(c.porClasificar, 3);
  assert.equal(c.minutos, 2);
  assert.equal(c.dias, 1);
  // Un mes que nunca se midió no se da por firmado.
  assert.equal(medidor.cierre(medidor.registrarFirmaCierre(null, { mes: "2026-10" }), "2026-10"), null);
});

test("lo guardado se limpia al leerlo y se guardan como mucho 12 cierres", () => {
  const limpio = medidor.normalize({ cierres: { "2026-11": { s: "90", dias: ["2026-12-01", "2026-12-01", "ayer"], grupos: -1, firmado: "mañana", porClasificar: 2.5 }, nov: { s: 10 } } });
  assert.deepEqual(Object.keys(limpio.cierres), ["2026-11"]);
  assert.deepEqual({ ...limpio.cierres["2026-11"], dias: [...limpio.cierres["2026-11"].dias] }, { s: 90, dias: ["2026-12-01"], grupos: null, firmado: "", porClasificar: null });
  let store = null;
  for (let i = 1; i <= 14; i += 1) store = medidor.registrarTiempoCierre(store, { mes: `2027-${String(i).padStart(2, "0")}`.replace("2027-13", "2028-01").replace("2027-14", "2028-02"), segundos: 60, hoy: "2028-03-01" });
  const meses = Object.keys(store.cierres).sort();
  assert.equal(meses.length, 12);
  assert.equal(meses[0], "2027-03");
});

test("la frase compara con la línea base de octubre (dicha por el hogar), y sin un minuto no dice nada", () => {
  let store = medidor.registrarTiempoCierre(null, { mes: "2026-11", segundos: 180, hoy: "2026-12-01", grupos: 1 });
  store = medidor.registrarTiempoCierre(store, { mes: "2026-11", segundos: 180, hoy: "2026-12-02" });
  assert.equal(medidor.fraseCierre(medidor.cierre(store)), "Cierre de noviembre: 6 min activos en 2 días (octubre: unos 45, dicho por vosotros) · 1 grupo sin partida al empezar · sin firmar todavía");
  assert.equal(medidor.fraseCierre(medidor.cierre(store), { conMes: false, conFirma: false }), "6 min activos en 2 días (octubre: unos 45, dicho por vosotros) · 1 grupo sin partida al empezar");
  const firmado = medidor.registrarFirmaCierre(store, { mes: "2026-11", hoy: "2026-12-02", porClasificar: 0 });
  assert.match(medidor.fraseCierre(medidor.cierre(firmado)), /· firmado$/);
  assert.equal(medidor.fraseCierre(medidor.cierre(medidor.registrarTiempoCierre(null, { mes: "2026-11", segundos: 20 }))), "");
  assert.equal(medidor.fraseCierre(null), "");
  // El propio octubre no se compara consigo mismo.
  const octubre = medidor.registrarTiempoCierre(null, { mes: "2026-10", segundos: 120, hoy: "2026-11-03" });
  assert.equal(medidor.fraseCierre(medidor.cierre(octubre, "2026-10")), "Cierre de octubre: 2 min activos · sin firmar todavía");
});

// ---------- en el navegador: el medidor entero en un vm con lo mínimo de la app ----------

function navegador({ hoy = "2026-12-01", mes = "2026-11", vista = "movements", firmado = () => false, grupos = [] } = {}) {
  let ahora = new Date(`${hoy}T10:00:00`).getTime();
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [ahora]));
    }
    static now() {
      return ahora;
    }
  }
  const datos = new Map();
  const docListeners = {};
  const winListeners = {};
  const doc = {
    readyState: "complete",
    hidden: false,
    documentElement: { dataset: {} },
    getElementById: () => null,
    querySelector: () => null,
    addEventListener: (tipo, fn) => ((docListeners[tipo] ||= []).push(fn)),
  };
  const ctx = {
    console, Math, Number, String, Object, Array, JSON, Set, Intl,
    Date: FakeDate,
    document: doc,
    localStorage: { getItem: (k) => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)) },
    addEventListener: (tipo, fn) => ((winListeners[tipo] ||= []).push(fn)),
    setTimeout: (fn) => fn(),
    activeViewId: vista,
    closeTargetMonthKey: () => mes,
    isSignedClosedMonthKey: (m) => firmado(m),
    clasV2PendingGroups: () => grupos,
    cierrePorClasificarContados: () => 2,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("medidor-utilidad.js"), ctx);
  const disparar = (lista, tipo, evento = {}) => (lista[tipo] || []).forEach((fn) => fn(evento));
  return {
    ctx,
    tocarA(segundos) {
      ahora = new Date(`${hoy}T10:00:00`).getTime() + segundos * 1000;
      disparar(docListeners, "pointerdown");
    },
    ocultar() {
      disparar(docListeners, "visibilitychange");
    },
    clicEnCierre() {
      disparar(docListeners, "click", { target: { closest: (sel) => (sel === "#cierre" ? {} : null) } });
    },
    cierre: (m) => ctx.FinanceMedidor.cierre(ctx.FinanceMedidor.leer(), m),
    crudo: () => datos.get("medidor-utilidad") || "",
  };
}

test("en Movimientos, con noviembre por firmar en diciembre: cuenta el tiempo entre toques y no las pausas de más de 3 min", () => {
  const grupos = [{ rows: [{ month: "2026-11" }] }, { rows: [{ date: "2026-11-30" }, { month: "2026-10" }] }, { rows: [{ month: "2026-09" }] }];
  const nav = navegador({ grupos });
  [0, 60, 120, 600, 660, 720].forEach((s) => nav.tocarA(s));
  nav.ocultar();
  const c = nav.cierre("2026-11");
  assert.equal(c.minutos, 4); // 60 + 60, la pausa de 480 s no cuenta, 60 + 60
  assert.equal(c.dias, 1);
  assert.equal(c.grupos, 2, "solo los grupos con movimientos de noviembre");
  assert.doesNotMatch(nav.crudo(), /amount|importe|concepto/i);
});

test("no cuenta un mes en curso, ni fuera de Cierre, Movimientos y Registrar", () => {
  const enCurso = navegador({ hoy: "2026-12-10", mes: "2026-12" });
  [0, 60, 120].forEach((s) => enCurso.tocarA(s));
  enCurso.ocultar();
  assert.equal(enCurso.cierre("2026-12"), null);
  const enHoy = navegador({ vista: "home" });
  [0, 60, 120].forEach((s) => enHoy.tocarA(s));
  enHoy.ocultar();
  assert.equal(enHoy.cierre("2026-11"), null);
  assert.deepEqual([...medidor.CIERRE_VISTAS], ["cierre", "movements", "registrar"]);
});

test("al firmar (un toque en Cierre y el mes ya sale firmado) anota la firma con lo que quedó en «Por clasificar»", () => {
  let firmado = false;
  const nav = navegador({ vista: "cierre", firmado: () => firmado });
  [0, 60, 120].forEach((s) => nav.tocarA(s));
  nav.ocultar();
  assert.equal(nav.cierre("2026-11").firmado, "");
  firmado = true;
  nav.clicEnCierre();
  const c = nav.cierre("2026-11");
  assert.equal(c.firmado, "2026-12-01");
  assert.equal(c.porClasificar, 2);
  // Firmado, ya no cuenta más tiempo.
  [200, 260].forEach((s) => nav.tocarA(s));
  nav.ocultar();
  assert.equal(nav.cierre("2026-11").minutos, 2);
});

test("lo enseñan «Lo que guarda la firma» del cierre nuevo y el informe de Uso de la app, junto a «Cierre nuevo»", () => {
  const medidorJs = read("medidor-utilidad.js");
  assert.match(medidorJs, /f\.id === "cierre-v2" \? fraseCierre\(cierre\(store\)\)/);
  const cierreV2 = read("views/cierre-v2.js");
  assert.match(cierreV2, /filas\.push\(\["Tiempo de este cierre", tiempo\]\)/);
  assert.match(cierreV2, /fraseCierre\?\.\(medidor\.cierre\(medidor\.leer\(\), ctx\.monthKey\), \{ conMes: false, conFirma: false \}\)/);
  const html = read("index.html");
  for (const f of ["medidor-utilidad.js", "views/cierre-v2.js"]) assert.ok(html.includes(`src="${f}?v=20261104coste1"`), f);
  assert.ok(require("../novedades.js").some((n) => n.id === "2026-11-04-coste-cierre"));
});

test("el cierre nuevo pinta «Tiempo de este cierre» solo cuando hay tiempo medido de ese mes", () => {
  const pintar = (store, monthKey) => {
    const el = () => ({ hidden: true, dataset: {}, innerHTML: "", textContent: "", addEventListener() {}, removeAttribute() {} });
    const els = { cierreV2: el(), cierreTitle: el(), cierreSubtitle: el() };
    const ctx = {
      console, Date, Math, Number, String, Object,
      document: { documentElement: { dataset: { tema: "v2" } } },
      localStorage: { getItem: () => null, removeItem() {} },
      qs: (id) => els[id] || null,
      escapeHtml: (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
      money: (v) => `${v} €`,
      cuadroMandosAllMonths: () => [],
      planMesCollect: () => ({ expense: [], income: [] }),
      cierrePorClasificarAvisoHtml: () => "",
      cierrePorClasificarContados: () => 0,
      FinanceMedidor: { anotar() {}, leer: () => store, cierre: medidor.cierre, fraseCierre: medidor.fraseCierre },
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(read("views/cierre-v2.js"), ctx);
    ctx.renderCierreV2({ monthKey, accountRows: [], tasks: [], unclassified: 0, monthMovementCount: 3, checks: [{ id: "extracto", label: "Extracto", met: true }], syncReady: true, extraSteps: false });
    return els.cierreV2.innerHTML;
  };
  const store = medidor.registrarTiempoCierre(null, { mes: "2026-11", segundos: 180, hoy: "2026-12-01", grupos: 4 });
  assert.match(pintar(store, "2026-11"), /<dt>Tiempo de este cierre<\/dt><dd>3 min activos \(octubre: unos 45, dicho por vosotros\) · 4 grupos sin partida al empezar<\/dd>/);
  assert.doesNotMatch(pintar(store, "2026-10"), /Tiempo de este cierre/);
  assert.doesNotMatch(pintar(null, "2026-11"), /Tiempo de este cierre/);
});
