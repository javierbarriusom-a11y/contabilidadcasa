const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const C = require("../canonical-cirbe.js");

// WP-40 (DAC-01): conciliación del informe de la CIRBE con los contratos de la app. Lo que el hogar debe poder fiar: que «sin informe» no se lea como
// «todo cuadra», que una operación en el informe de las dos personas cuente una vez, que un aval no se case con un contrato y que lo que falta en el
// INFORME (que no siempre es un error) se muestre aparte.

const contracts = [
  { id: "c1", entity: "CaixaBank", type: "Hipoteca", currentPrincipal: 150000, paymentStatus: "active" },
  { id: "c2", entity: "Santander Consumer Finance", type: "Préstamo", currentPrincipal: 8000, paymentStatus: "active" },
  { id: "c3", entity: "Cetelem", type: "Tarjeta", currentPrincipal: 2000, paymentStatus: "active" },
  { id: "c4", entity: "Préstamo familiar", type: "Otro", currentPrincipal: 3000, paymentStatus: "active" },
  { id: "c5", entity: "Banco Viejo", type: "Préstamo", currentPrincipal: 0, paymentStatus: "settled" },
];
const store = (rows, reportDate = "2026-09-01") => C.normalizeStore({ reportDate, rows });
const row = (extra) => ({ entity: "CaixaBank", kind: "hipoteca", amount: 150500, ...extra });
const find = (result, entity) => result.items.find((item) => item.row.entity.toLowerCase().includes(entity.toLowerCase()));

test("WP-40 · normalizeStore acepta cualquier cosa del almacén, descarta filas sin entidad y acota", () => {
  for (const raw of [null, undefined, "x", 5, [], {}, { rows: "mal" }]) assert.deepEqual(C.normalizeStore(raw).rows, []);
  const s = C.normalizeStore({ reportDate: "ayer", rows: [{ entity: "", amount: 5 }, { entity: "A", kind: "inventado", amount: -3, titularidad: "x" }, ...Array.from({ length: 100 }, () => ({ entity: "B", amount: 1 }))] });
  assert.equal(s.reportDate, "");
  assert.equal(s.rows.length <= C.MAX_ROWS, true);
  assert.equal(s.rows[0].kind, "otro");
  assert.equal(s.rows[0].amount, 0);
  assert.equal(s.rows[0].titularidad, "titular");
  assert.equal(C.normalizeStore({ rows: [{ entity: "Aval", kind: "aval", amount: 1 }] }).rows[0].titularidad, "avalista", "un aval nace como avalista");
});

test("WP-40 · una fila sin entidad o sin importe se rechaza con el motivo", () => {
  assert.equal(C.validateRow({ entity: "", amount: 10 }).ok, false);
  assert.match(C.validateRow({ entity: "X", amount: "" }).reason, /importe/);
  assert.equal(C.validateRow({ entity: "X", amount: 0, overdue: 40 }).ok, true, "solo con vencido también vale: es lo que se quiere ver");
  assert.equal(C.validateRow({ entity: "X", amount: 10 }).ok, true);
});

test("WP-40 · sin informe no hay conciliación, y no dice «todo cuadra»", () => {
  const sin = C.reconcile({ store: C.defaultStore(), contracts, today: "2026-10-09" });
  assert.equal(sin.status, "no-report");
  assert.equal(sin.summary, null);
  assert.match(sin.reason, /no significa que la app esté al día/);
  assert.equal(C.reconcile({ store: store([row()], ""), contracts, today: "2026-10-09" }).status, "no-report", "filas sin fecha de informe: tampoco");
});

test("WP-40 · cuadra dentro de la tolerancia, difiere fuera y dice de cuánto y en qué sentido", () => {
  const r = C.reconcile({ store: store([row({ amount: 151000 }), { entity: "Cetelem", kind: "tarjeta", amount: 1500 }]), contracts, today: "2026-10-09" });
  assert.equal(find(r, "caixabank").state, "fits", "1.000 € de 151.000 son el 0,7 %");
  assert.equal(find(r, "caixabank").diff, -1000);
  const cetelem = find(r, "cetelem");
  assert.equal(cetelem.state, "differs");
  assert.equal(cetelem.diff, 500, "la app tiene 500 € más que el informe");
  const justo = C.reconcile({ store: store([{ entity: "Cetelem", kind: "tarjeta", amount: 1950 }]), contracts, today: "2026-10-09" });
  assert.equal(find(justo, "cetelem").state, "fits", "50 € es la tolerancia mínima");
});

test("WP-40 · normaliza nombres de entidad: «Caixabank, S.A.» y «CAIXABANK» son CaixaBank; «Santander» casa con «Santander Consumer Finance»", () => {
  assert.equal(C.sameEntity("Caixabank, S.A.", "CaixaBank"), true);
  assert.equal(C.sameEntity("BANCO Santander", "Santander Consumer Finance"), true);
  assert.equal(C.sameEntity("BBVA", "Banco Sabadell"), false);
  assert.equal(C.sameEntity("", "CaixaBank"), false);
  const r = C.reconcile({ store: store([{ entity: "Santander", kind: "prestamo", amount: 8100 }]), contracts, today: "2026-10-09" });
  assert.equal(find(r, "santander").match.entity, "Santander Consumer Finance");
});

test("WP-40 · falta en la app: una operación del informe sin contrato que case, y un contrato liquidado no cuenta", () => {
  const r = C.reconcile({ store: store([{ entity: "Banco Viejo", kind: "prestamo", amount: 4000 }, { entity: "Wizink", kind: "tarjeta", amount: 1800 }]), contracts, today: "2026-10-09" });
  assert.equal(find(r, "banco viejo").state, "missing-in-app", "el contrato de la app está liquidado: el informe lo sigue enseñando");
  assert.equal(find(r, "wizink").state, "missing-in-app");
  assert.equal(r.summary.missingInApp, 2);
});

test("WP-40 · un contrato reunificado ya no es una operación aparte: no se espera en el informe", () => {
  const conReunificado = [...contracts, { id: "r", entity: "Banco Viejo Dos", type: "Crédito", currentPrincipal: 6000, paymentStatus: "reunified" }];
  const r = C.reconcile({ store: store([row()]), contracts: conReunificado, today: "2026-10-09" });
  assert.equal(r.missingInReport.some((c) => c.id === "r"), false);
});

test("WP-40 · la misma operación en el informe de las dos personas cuenta una vez", () => {
  const r = C.reconcile({ store: store([row({ titularidad: "cotitular", reportOf: "Ana" }), row({ entity: "Caixabank, S.A.", amount: 150800, titularidad: "cotitular", reportOf: "Luis" })]), contracts, today: "2026-10-09" });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].row.inBothReports, true);
  const dosPrestamos = C.reconcile({ store: store([row({ titularidad: "titular", reportOf: "Ana" }), row({ titularidad: "titular", reportOf: "Luis" })]), contracts, today: "2026-10-09" });
  assert.equal(dosPrestamos.items.length, 2, "dos titulares individuales NO se fusionan: son dos operaciones");
});

test("WP-40 · dos contratos de la misma entidad: cada fila del informe va al de importe más cercano", () => {
  const dos = [
    { id: "a", entity: "Banco X", type: "Préstamo", currentPrincipal: 10000, paymentStatus: "active" },
    { id: "b", entity: "Banco X", type: "Préstamo", currentPrincipal: 2000, paymentStatus: "active" },
  ];
  const r = C.reconcile({ store: store([{ entity: "Banco X", kind: "prestamo", amount: 2050 }, { entity: "Banco X", kind: "prestamo", amount: 9900 }]), contracts: dos, today: "2026-10-09" });
  assert.equal(r.items[0].match.id, "b");
  assert.equal(r.items[1].match.id, "a");
  assert.equal(r.summary.fits, 2);
  assert.equal(r.missingInReport.length, 0);
});

test("WP-40 · el tipo distinto no impide casar por entidad, pero se avisa; el tipo igual manda", () => {
  const r = C.reconcile({ store: store([{ entity: "Cetelem", kind: "prestamo", amount: 2000 }]), contracts, today: "2026-10-09" });
  const item = find(r, "cetelem");
  assert.equal(item.match.id, "c3");
  assert.equal(item.kindMismatch, true);
  const dos = [
    { id: "t", entity: "Banco X", type: "Tarjeta", currentPrincipal: 1000, paymentStatus: "active" },
    { id: "h", entity: "Banco X", type: "Hipoteca", currentPrincipal: 90000, paymentStatus: "active" },
  ];
  const buena = C.reconcile({ store: store([{ entity: "Banco X", kind: "hipoteca", amount: 90000 }]), contracts: dos, today: "2026-10-09" });
  assert.equal(buena.items[0].match.id, "h");
  assert.equal(buena.items[0].kindMismatch, false);
  assert.equal(buena.missingInReport[0].id, "t", "la tarjeta de la app queda sin fila en el informe");
});

test("WP-40 · los avales no se casan con contratos: sin aval declarado faltan, con cuota declarada se revisan a mano", () => {
  const sinAval = C.reconcile({ store: store([{ entity: "Banco Fiador", kind: "aval", amount: 20000 }]), contracts, guaranteeMonthly: 0, today: "2026-10-09" });
  assert.equal(sinAval.items[0].state, "missing-in-app");
  assert.match(sinAval.items[0].note, /No hay ningún aval declarado/);
  const conAval = C.reconcile({ store: store([{ entity: "Banco Fiador", kind: "aval", amount: 20000 }]), contracts, guaranteeMonthly: 120, today: "2026-10-09" });
  assert.equal(conAval.items[0].state, "guarantee-manual");
  assert.match(conAval.items[0].note, /120/);
  assert.equal(conAval.items[0].match, null, "nunca se casa con un contrato");
});

test("WP-40 · lo que falta en el INFORME se muestra aparte (no es un fallo de la fila) y el vencido se señala", () => {
  const r = C.reconcile({ store: store([row(), { entity: "Santander", kind: "prestamo", amount: 8000, overdue: 300 }]), contracts, today: "2026-10-09" });
  assert.deepEqual(r.missingInReport.map((c) => c.entity).sort(), ["Cetelem", "Préstamo familiar"]);
  assert.equal(r.summary.missingInReport, 2);
  assert.equal(r.summary.overdueOperations, 1);
  assert.equal(r.summary.allClean, false);
  const limpio = C.reconcile({ store: store([row({ amount: 150000 })]), contracts: [contracts[0]], today: "2026-10-09" });
  assert.equal(limpio.summary.allClean, true);
});

test("WP-40 · el informe se renueva al año: al día, toca pedirlo a 30 días del año, y vencido", () => {
  const at = (today, reportDate = "2026-01-10") => C.reportStatus({ reportDate }, { today });
  assert.equal(at("2026-06-01").state, "ok");
  assert.equal(at("2026-12-10").state, "ok", "334 días: todavía no");
  assert.equal(at("2026-12-11").state, "renew-soon");
  assert.equal(at("2026-12-11").dueOn, "2027-01-10");
  assert.equal(at("2027-01-10").state, "renew-soon", "el día del aniversario todavía no está vencido");
  assert.equal(at("2027-01-11").state, "overdue");
  assert.equal(C.reportStatus({}, { today: "2026-06-01" }).state, "none", "sin fecha no se inventa una");
  assert.equal(C.reportStatus({ reportDate: "2026-01-10" }, {}).state, "unknown");
});

test("WP-40 · el motor es puro y no escribe: sin DOM, red ni almacenamiento", () => {
  const source = read("canonical-cirbe.js").replace(/\/\/.*$/gm, "");
  for (const forbidden of [/\bdocument\b/, /\bwindow\b/, /localStorage/, /sessionStorage/, /\bfetch\(/, /XMLHttpRequest/, /\bqs\(/]) assert.doesNotMatch(source, forbidden);
  const before = JSON.stringify(contracts);
  C.reconcile({ store: store([row()]), contracts, today: "2026-10-09" });
  assert.equal(JSON.stringify(contracts), before, "no toca los contratos que recibe");
});

test("WP-40 · cableado: el almacén va en la copia, la tarjeta está en Deuda › Contratos, no toca contratos ni Hoy, y quitar se puede deshacer", () => {
  assert.match(read("app.js"), /const BACKUP_LOCAL_STORES = \[[\s\S]*?"cirbe-report"/);
  assert.match(read("app.js"), /globalThis\.renderCirbe\?\.\(globalThis\.FinanceCanonicalCirbe\)/);
  const html = read("index.html");
  const contratos = html.slice(html.indexOf('id="deuda-contratos"'), html.indexOf('id="deuda-simulador"'));
  assert.match(contratos, /id="cirbeCard"/);
  for (const asset of ["canonical-cirbe.js", "cirbe-ui.js", "cirbe.css"]) {
    assert.match(html, new RegExp(`${asset.replace(".", "\\.")}\\?v=\\w+`), `index.html debe cargar ${asset}`);
    for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) assert.ok(read(file).includes(asset), `${file} debe listar ${asset}`);
  }
  const ui = read("cirbe-ui.js");
  assert.doesNotMatch(ui, /decisionInboxItems/, "Hoy sigue congelado hasta leer H-02");
  assert.doesNotMatch(ui, /\bconfirm\(/, "lo reversible se deshace (WP-37), no se confirma");
  assert.doesNotMatch(ui, /saveDebtContract|debtContractOverrides|customDebtContracts|scenarioSettings\.debt/, "no escribe en los contratos: solo los lee");
  assert.match(ui, /showUndoToast\("Fila quitada\."/);
  assert.match(ui, /showUndoToast\("Informe borrado\."/);
});
