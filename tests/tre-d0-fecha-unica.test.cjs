// TRE-D0 (decimotercera auditoría, §1.1-§1.2) · D-N40 (25/11/2026, «sí» del hogar): una sola fecha de «libre de deuda» en toda la app.
//
// Dos fallos de corrección que se arreglan aquí:
//  1. Un contrato sin plazo declarado (los de «Pegar varios») contaba como saldado el primer mes del horizonte: la tira de cifras y
//     Hoy decían «Libre de deuda» en el mes en curso con miles de euros vivos.
//  2. El titular de Deuda › Plan salía del final de la ruta de la pestaña «Orden de ataque» *ejecutada* (con «Avalancha», liquidar
//     con caja), y decía «Sin deuda pendiente» con deuda viva.
// La fecha que manda es la del plan guardado (DUO-D1) o la del plan óptimo; las demás son comparaciones con nombre.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const raiz = path.join(__dirname, "..");
const app = codigoApp();
const camino = fs.readFileSync(path.join(raiz, "camino-deuda-ui.js"), "utf8");
const deuda = fs.readFileSync(path.join(raiz, "views", "deuda.js"), "utf8");

function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `falta ${name}`);
  let depth = 0;
  // El cuerpo empieza tras la lista de parámetros (un parámetro por defecto `= {}` no es el cuerpo).
  for (let i = source.indexOf(") {", start) + 2; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(name);
}

function meses(desde, cuantos) {
  const [y, m] = desde.split("-").map(Number);
  return Array.from({ length: cuantos }, (_, i) => {
    const d = new Date(y, m - 1 + i, 1);
    return { monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
  });
}

const motor = {};
vm.runInNewContext(
  `${extract(app, "escenarioMotorPlazoDeducido")}\n${extract(app, "escenarioMotorContractPayoffMonth")}\n${extract(app, "escenarioMotorLibreDeDeuda")}
   this.plazo = escenarioMotorPlazoDeducido; this.fin = escenarioMotorContractPayoffMonth; this.libre = escenarioMotorLibreDeDeuda;`,
  motor,
);
const horizonte = meses("2026-11", 120);

test("TRE-D0 · sin plazo declarado, una deuda viva no está saldada: el plazo sale de capital, cuota y TAE", () => {
  // Los contratos FICTICIOS del arranque en caliente: tarjeta de 2.400 € al 21,9 % con 90 € y préstamo de 5.100 € al 9,5 % con 160 €.
  const tarjeta = { currentPrincipal: 2400, currentPayment: 90, apr: 21.9, remainingInstallments: 0, paymentStatus: "active" };
  const prestamo = { currentPrincipal: 5100, currentPayment: 160, apr: 9.5, remainingInstallments: 0, paymentStatus: "active" };
  assert.equal(motor.plazo(tarjeta), 37);
  assert.equal(motor.plazo(prestamo), 37);
  assert.equal(motor.fin(tarjeta, horizonte), "2029-11", "la misma fecha que «Camino a deuda cero» sin extra");
  assert.notEqual(motor.libre([tarjeta, prestamo], horizonte), "2026-11", "antes: «libre de deuda» este mes");
  assert.equal(motor.libre([tarjeta, prestamo], horizonte), "2029-11");
});

test("TRE-D0 · el plazo declarado sigue mandando; sin TAE, capital entre cuota; si la cuota no cubre los intereses, no acaba", () => {
  assert.equal(motor.fin({ currentPrincipal: 1000, currentPayment: 100, apr: 10, remainingInstallments: 4 }, horizonte), "2027-02");
  assert.equal(motor.plazo({ currentPrincipal: 1000, currentPayment: 100, apr: null }), 10);
  assert.equal(motor.plazo({ currentPrincipal: 1000, currentPayment: 100, apr: "" }), 10);
  assert.equal(motor.plazo({ currentPrincipal: 10000, currentPayment: 50, apr: 12 }), null, "50 € no cubren 100 € de intereses al mes");
  assert.equal(motor.fin({ currentPrincipal: 10000, currentPayment: 50, apr: 12, remainingInstallments: 0 }, horizonte), null);
  assert.equal(motor.libre([{ currentPrincipal: 10000, currentPayment: 50, apr: 12, remainingInstallments: 0, paymentStatus: "active" }], horizonte), "fuera de horizonte");
  assert.equal(motor.fin({ currentPrincipal: 0, currentPayment: 100, apr: 10, remainingInstallments: 0 }, horizonte), "2026-11", "saldada sí es este mes");
  assert.equal(motor.libre([], horizonte), "sin deuda pendiente");
});

// --- homeDebtOutlook: manda la fecha del plan; la de los plazos queda como comparación con nombre ----------------------------------

function outlookCon(deudaFechaUnica) {
  const ctx = {
    homeDebtOutlookCache: { key: "", value: null },
    simulationSignature: "firma",
    escenarioMotorDebtOptions: () => [{ id: "a", currentPrincipal: 2400, currentPayment: 90, apr: 21.9, remainingInstallments: 0, paymentStatus: "active" }],
    debtStrategySummary: () => ({ libreDeDeuda: "2029-11" }),
    escenarioMotorBaseInput: () => ({}),
    debtStrategyReserveDefault: () => 0,
    escenarioMotorMonthLabel: (v) => String(v).replace(/^(\d{4})-(\d{2})/, (_, y, m) => `${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"][Number(m) - 1]} ${y.slice(2)}`),
    round2: (v) => Math.round(v * 100) / 100,
    ...(deudaFechaUnica ? { deudaFechaUnica } : {}),
  };
  vm.runInNewContext(`${extract(app, "homeDebtOutlook")}\nthis.outlook = homeDebtOutlook;`, ctx);
  return ctx.outlook();
}

test("D-N40 · homeDebtOutlook da la fecha del plan y conserva la de los plazos como comparación", () => {
  const conPlan = outlookCon(() => ({ monthKey: "2027-09", mes: "2027-09", fuente: "plan-optimo", nombre: "el plan óptimo" }));
  assert.equal(conPlan.libreDeDeuda, "2027-09");
  assert.equal(conPlan.libreDeDeudaLabel, "sept 2027");
  assert.equal(conPlan.fuente, "plan-optimo");
  assert.equal(conPlan.fuenteNombre, "el plan óptimo");
  assert.equal(conPlan.segunPlazos, "2029-11");
  assert.equal(conPlan.segunPlazosLabel, "nov 2029");
  assert.equal(conPlan.settled, false);

  const sinPlan = outlookCon(() => null);
  assert.equal(sinPlan.libreDeDeuda, "2029-11");
  assert.equal(sinPlan.fuente, "plazos");
  assert.equal(sinPlan.fuenteNombre, "los plazos firmados");

  const sinFuncion = outlookCon(null);
  assert.equal(sinFuncion.libreDeDeuda, "2029-11", "sin el script del plan, cae a los plazos y lo dice");
  assert.equal(sinFuncion.fuente, "plazos");
});

test("D-N40 · la tira de cifras dice de dónde sale la fecha", () => {
  assert.match(app, /debtOutlook\.estimable \? `según \$\{debtOutlook\.fuenteNombre \|\| "los plazos firmados"\}`/);
});

// --- deudaFechaUnica: plan guardado, o el óptimo; nada si no hay deuda o no se puede calcular -----------------------------------

function fechaUnica({ compromiso = null, r, contratos } = {}) {
  const calls = { calcular: 0 };
  const store = { "k:plan-deuda-compromiso": compromiso ? JSON.stringify(compromiso) : "" };
  const ctx = {
    globalThis: { FinanceCanonicalDebtPayoffPath: {}, FinanceCanonicalDebtOptimalPlan: {} },
    console,
    JSON,
    planOptimoModo: "prevision",
    planOptimoMensual: null,
    planOptimoPago: 0,
    PLAN_OPTIMO_ORDEN_KEY: "o",
    PLAN_OPTIMO_MARGEN_KEY: "m",
    PLAN_OPTIMO_QUITAS_KEY: "q",
    PLAN_OPTIMO_COMISIONES_KEY: "c",
    simulationSignature: "firma",
    storageKey: (k) => `k:${k}`,
    storageGet: (k, d) => (k in store ? store[k] : d),
    isoLocalDate: () => "2026-11-25",
    escenarioMotorDebtOptions: () => contratos || [{ id: "a", currentPrincipal: 2400, currentPayment: 90, apr: 21.9, paymentStatus: "active" }],
    planOptimoReferencias: () => ({}),
    planOptimoCalcular: () => {
      calls.calcular += 1;
      return { r };
    },
  };
  ctx.planOptimoGuard = (fn, fallback = null) => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  const fns = ["deudaFechaUnicaLeerCompromiso", "deudaFechaUnicaClave", "deudaFechaUnicaSufijo", "deudaFechaUnica"].map((n) => extract(camino, n)).join("\n");
  vm.runInNewContext(`let deudaFechaUnicaCache = { key: "", value: null };\nlet deudaFechaUnicaCalculando = false;\n${fns}\nthis.unica = deudaFechaUnica;`, ctx);
  return { unica: ctx.unica, calls };
}

const planOk = (mes, extra = {}) => ({ ok: true, recommended: { summary: { debtFreeMonthKey: mes }, result: { ok: true, excluded: [] } }, completo: true, ...extra });

test("D-N40 · sin plan guardado manda el plan óptimo; con plan guardado, su fecha (y el óptimo queda como «vivo»)", () => {
  const sinGuardar = fechaUnica({ r: planOk("2027-09") }).unica();
  assert.deepEqual({ ...sinGuardar }, { monthKey: "2027-09", mes: "2027-09", fuente: "plan-optimo", nombre: "el plan óptimo", vivo: "2027-09" });
  const guardado = fechaUnica({ compromiso: { fechaLibre: "2027-11", guardadoEl: "2026-11-20" }, r: planOk("2027-09") }).unica();
  assert.equal(guardado.monthKey, "2027-11");
  assert.equal(guardado.fuente, "plan-guardado");
  assert.equal(guardado.nombre, "vuestro plan");
  assert.equal(guardado.vivo, "2027-09");
});

test("D-N40 · sin deuda viva, sin datos o sin plan calculable no hay fecha única (quien la usa cae a los plazos y lo dice)", () => {
  assert.equal(fechaUnica({ r: planOk("2027-09"), contratos: [{ id: "a", currentPrincipal: 0 }] }).unica(), null);
  assert.equal(fechaUnica({ r: { ok: true, nothing: true } }).unica(), null);
  assert.equal(fechaUnica({ r: { ok: true, sinDatos: true } }).unica(), null);
  assert.equal(fechaUnica({ r: { ok: false, error: "x" } }).unica(), null);
});

test("D-N40 · con deudas fuera del plan, la fecha lo lleva detrás (como los plazos)", () => {
  const sinCuota = planOk("2027-09", { completo: false });
  sinCuota.recommended.result.excluded = [{ reason: "sin-cuota-activa" }];
  assert.equal(fechaUnica({ r: sinCuota }).unica().monthKey, "2027-09 · queda deuda sin cuota activa");
  const sinDatos = planOk("2027-09", { completo: false });
  sinDatos.recommended.result.excluded = [{ reason: "sin-tae-ni-plazo" }];
  assert.equal(fechaUnica({ r: sinDatos }).unica().monthKey, "2027-09 · queda deuda fuera del plan");
});

test("D-N40 · se calcula una vez por estado (Hoy la pide en cada pintado)", () => {
  const { unica, calls } = fechaUnica({ r: planOk("2027-09") });
  unica();
  unica();
  unica();
  assert.equal(calls.calcular, 1);
});

// --- Deuda › Plan: titular con la fecha única, subtítulo con su fuente, la ruta en condicional ----------------------------------

const vista = {
  escenarioMotorMonthLabel: (key) => ({ "2027-09": "sept 2027" })[key] || key,
  money: (v) => `${v} €`,
  DEBT_STRATEGY_COSTE_LABEL: "Coste total ejecutado",
};
vm.runInNewContext(
  `${extract(deuda, "deudaRutaTitulo")}\n${extract(deuda, "deudaRutaSubtituloFuente")}\nthis.titulo = deudaRutaTitulo; this.fuente = deudaRutaSubtituloFuente;`,
  vista,
);

test("D-N40 · el titular y su fuente", () => {
  const viva = [{ currentPrincipal: 2400, paymentStatus: "active" }];
  assert.equal(vista.titulo("2027-09", viva), "Sin deuda en sept 2027");
  assert.equal(vista.titulo("2027-09 · queda deuda fuera del plan", viva), "Libre de las deudas que entran en el plan en sept 2027");
  assert.match(vista.fuente({ fuente: "plan-optimo" }), /^Según el plan óptimo de abajo/);
  assert.match(vista.fuente({ fuente: "plan-guardado" }), /^Según vuestro plan/);
  assert.match(vista.fuente({ fuente: "plazos" }), /^Según los plazos firmados/);
  assert.equal(vista.fuente({ settled: true }), "");
});

test("D-N40 · lo que haría la ruta de «Orden de ataque» se dice en condicional y con nombre, no como titular", () => {
  assert.match(deuda, /Si aplicáis esta ruta: \$\{deudaRutaSubtitulo\(/);
  assert.match(deuda, /`Con esta ruta, libres en \$\{escenarioMotorMonthLabel\(summary\.libreDeDeuda\)\}`/);
  assert.match(deuda, /titleEl\.dataset\.fechaLibre = "unica";/);
  const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  assert.match(html, /Si aplicáis la ruta de «Orden de ataque»: «Deuda viva»/);
  assert.match(html, /Si aplicáis la ruta de «Orden de ataque»: capital vivo mes a mes/);
});

test("D-N40 · el héroe del plan óptimo es la fecha única, o una comparación con nombre si hay otro plan guardado", () => {
  const fn = extract(camino, "planOptimoHtml");
  assert.match(fn, /otroQueElGuardado \? "comparacion" : "unica"/);
  assert.match(fn, /Con estos ajustes, /);
  assert.match(fn, /antes que pagando solo las cuotas/);
  assert.match(extract(camino, "caminoHeroHtml"), /data-fecha-libre/);
});
