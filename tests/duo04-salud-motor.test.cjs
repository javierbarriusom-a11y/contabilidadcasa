// DUO-04 (duodécima auditoría, 23/11/2026; recoge UND-03 y UND-22): salud del cálculo en Ajustes › Uso de la app y extractos atrasados.
// Datos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Salud = require("../salud-motor.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const run = (rows, valid = true, issues = []) => ({ generatedAt: "2026-11-23T10:00:00.000Z", rowCount: rows, invariants: { valid, issues, checkedRows: rows } });
const forecast = { generatedAt: "2026-11-23T10:00:00.000Z", valid: true, series: new Array(12).fill({}) };
const deuda = { ok: true, included: 2, excluded: 0, suspended: 0 };

test("DUO-04 · todo bien: cuatro filas con ●, y el resumen lo dice", () => {
  const d = Salud.diagnostico({ monthly: run(60), daily: run(365), forecast, deuda, extractos: [] });
  assert.equal(d.estado, "ok");
  assert.equal(d.forma, "●");
  assert.deepEqual(d.filas.map((f) => [f.id, f.estado, f.forma]), [["mensual", "ok", "●"], ["diario", "ok", "●"], ["deuda", "ok", "●"], ["prevision", "ok", "●"]]);
  assert.equal(d.resumen, "Todo calculado (4 de 4)");
  assert.match(d.filas[1].detalle, /365 días, todas las comprobaciones cuadran/);
});

test("DUO-04 · lo que falla se ve (○), no se esconde: sin filas, invariante rota, recálculo fallido", () => {
  const sinDiario = Salud.diagnostico({ monthly: run(60), daily: { generatedAt: null, rowCount: 0 }, forecast, deuda });
  assert.equal(sinDiario.estado, "falla");
  assert.equal(sinDiario.filas[1].forma, "○");
  assert.match(sinDiario.filas[1].detalle, /Sin días: no se ha podido calcular/);
  assert.equal(sinDiario.resumen, "Un cálculo no sale");

  const rota = Salud.diagnostico({ monthly: run(60, false, [{ type: "month-continuity" }, { type: "non-finite" }]), daily: run(365), forecast, deuda });
  assert.equal(rota.estado, "aviso");
  assert.equal(rota.filas[0].forma, "◐");
  assert.match(rota.filas[0].detalle, /2 comprobaciones no cuadran/);

  const recalculo = Salud.diagnostico({ monthly: run(60), daily: run(365), forecast, deuda, recalculoError: { message: "invariante diaria", at: "2026-11-23T10:00:00Z" } });
  assert.equal(recalculo.estado, "falla");
  assert.equal(recalculo.resumen, "El último recálculo falló: las cifras son las de antes");
  assert.equal(recalculo.recalculo.mensaje, "invariante diaria");

  assert.equal(Salud.diagnostico({ monthly: null, daily: null, forecast: null, deuda: null }).filas.every((f) => f.estado === "falla"), true);
});

test("DUO-04 · deuda: lo que no tiene datos es un aviso; lo de los pagos suspendidos se nombra, no es un fallo del cálculo", () => {
  const conFuera = Salud.diagnostico({ monthly: run(60), daily: run(365), forecast, deuda: { ok: true, included: 2, excluded: 3, suspended: 2 } });
  assert.equal(conFuera.filas[2].estado, "aviso");
  assert.equal(conFuera.filas[2].detalle, "2 deudas entran en el cálculo; 1 sin datos suficientes; 2 con los pagos suspendidos.");
  const soloSuspendidas = Salud.diagnostico({ monthly: run(60), daily: run(365), forecast, deuda: { ok: true, included: 1, excluded: 1, suspended: 1 } });
  assert.equal(soloSuspendidas.filas[2].estado, "ok");
  assert.equal(soloSuspendidas.filas[2].detalle, "1 deuda entra en el cálculo; 1 con los pagos suspendidos.");
});

test("UND-22 · extractos: más de 10 días sin movimientos de una cuenta con extracto es atrasado; sin ninguno, se dice aparte", () => {
  const cuentas = [
    { id: "caixa", label: "Cuenta FICTICIA", importLabel: "CaixaBank" },
    { id: "otra", label: "Otra FICTICIA", importLabel: "Otra" },
    { id: "nueva", label: "Nueva FICTICIA", importLabel: "Nueva" },
  ];
  const tx = [
    { date: "2026-11-01", account: "CaixaBank" }, { date: "2026-11-12", account: "CaixaBank" },
    { date: "2026-11-20", account: "Otra" },
  ];
  const e = Salud.extractos(tx, cuentas, "2026-11-23");
  assert.deepEqual(e.map((x) => [x.id, x.ultima, x.dias, x.atrasado, x.sinExtracto]), [
    ["caixa", "2026-11-12", 11, true, false],
    ["otra", "2026-11-20", 3, false, false],
    ["nueva", "", null, false, true],
  ]);
  const d = Salud.diagnostico({ monthly: run(60), daily: run(365), forecast, deuda, extractos: e });
  assert.equal(d.estado, "aviso");
  assert.equal(d.resumen, "Todo calculado (4 de 4) · un extracto atrasado");
  assert.equal(Salud.extractos(tx, cuentas, "2026-11-22")[0].atrasado, false, "a los 10 días justos, aún no");
});

function cargarHoy(hoyTx) {
  const context = {
    escapeHtml: (v) => String(v), isoLocalDate: () => "2026-11-23", baseData: { transactions: hoyTx },
    globalThis: { FinanceSaludMotor: Salud, FinanceCanonicalBalancePulse: { ACCOUNTS: [{ id: "caixa", label: "Cuenta FICTICIA", importLabel: "CaixaBank" }] } },
  };
  vm.createContext(context);
  const src = read("views/hoy-v2.js");
  const inicio = src.indexOf("const HOY_V2_EXTRACTOS_DESDE");
  const fin = src.indexOf("// DEC-23 (décima auditoría", inicio);
  vm.runInContext(src.slice(inicio, fin), context);
  return context;
}

test("UND-22 · la línea de Hoy: con puerta de fecha el 24/11 (D-N39; antes, el 21/12) y solo con algún extracto atrasado; lleva a Importar", () => {
  const atrasado = cargarHoy([{ date: "2026-12-01", account: "CaixaBank" }]);
  assert.equal(vm.runInContext('hoyV2ExtractosAtrasados("2026-11-23")', atrasado), "", "antes del 24/11, nada (D-N39 adelantó la puerta del 21/12)");
  const html = vm.runInContext('hoyV2ExtractosAtrasados("2026-12-21")', atrasado);
  assert.match(html, /href="#datos-importar"/);
  assert.match(html, /El extracto de Cuenta FICTICIA lleva 20 días sin importar/);
  const alDia = cargarHoy([{ date: "2026-12-18", account: "CaixaBank" }]);
  assert.equal(vm.runInContext('hoyV2ExtractosAtrasados("2026-12-21")', alDia), "", "al día, no ocupa pantalla");
  assert.match(read("views/hoy-v2.js"), /\$\{hoyV2Repaso\(\)\}\n\s+\$\{hoyV2ExtractosAtrasados\(hoy\)\}/);
});

test("DUO-04 · cableado: la tarjeta plegada en Uso de la app, sus scripts y su hoja, el service worker y renderAjustes", () => {
  const html = read("index.html");
  const tarjeta = html.indexOf('id="saludMotorCard"');
  const grupo = html.indexOf('id="ajustes-uso-app"');
  assert.ok(grupo > 0 && tarjeta > grupo, "dentro de Ajustes › Uso de la app");
  assert.match(html, /<details class="e19-card salud-motor-card" id="saludMotorCard">\s*<summary data-salud-resumen>/);
  assert.match(html, /<script defer src="salud-motor\.js\?v=20261123duo04"><\/script>\s*<script defer src="salud-motor-ui\.js\?v=20261123duo04"><\/script>/);
  assert.match(html, /salud-motor\.css\?v=20261123duo04/);
  const sw = read("service-worker.js");
  ["./salud-motor.js", "./salud-motor-ui.js", "./salud-motor.css"].forEach((f) => assert.ok(sw.includes(`"${f}"`), f));
  assert.match(read("app.js"), /globalThis\.renderSaludMotor\?\.\(\); \/\/ DUO-04/);
});
