// DEC-12 · Confirmar solos los cobros y cargos que ya llegaron (décima auditoría; XDA-08 de la séptima). Visto bueno del hogar del
// 19/11/2026 («Haz DAT-07 y DEC-12») y decisión del mismo día: «confirma solo al importar». Solo sin duda: fecha segura, sin real,
// importe ± 2 %, de 3 días antes a 5 después, un único candidato en los dos sentidos y sin «No era esto» previo. Datos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../canonical-expected-movements.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const esperado = (extra = {}) => ({ id: "expense|seguro|2026-10", kind: "expense", seriesKey: "expense|seguro", month: "2026-10", label: "Seguro ficticio", expectedDate: "2026-10-05", certain: true, plannedAmount: 100, ...extra });
const mov = (id, date, amount) => ({ id, date, amount });

test("DEC-12 · se confirma el movimiento único, del mismo signo, por su importe ± 2 % y en su ventana", () => {
  const { confirmed, doubtful } = E.autoConfirm({ expectations: [esperado()], movements: [mov("m1", "2026-10-07", -101.5)] });
  assert.deepEqual(doubtful, []);
  assert.equal(confirmed.length, 1);
  assert.deepEqual(confirmed[0], { expectationId: "expense|seguro|2026-10", movementId: "m1", kind: "expense", seriesKey: "expense|seguro", month: "2026-10", label: "Seguro ficticio", expectedDate: "2026-10-05", date: "2026-10-07", amount: 101.5, plannedAmount: 100 });
  // Un cobro: signo positivo.
  const cobro = esperado({ id: "income|nomina|2026-10", kind: "income", seriesKey: "income|nomina", plannedAmount: 2000 });
  assert.equal(E.autoConfirm({ expectations: [cobro], movements: [mov("m2", "2026-10-05", 2000)] }).confirmed.length, 1);
  assert.equal(E.autoConfirm({ expectations: [cobro], movements: [mov("m2", "2026-10-05", -2000)] }).confirmed.length, 0);
});

test("DEC-12 · fuera del ± 2 % o de la ventana (3 días antes, 5 después) no se confirma", () => {
  const una = (m) => E.autoConfirm({ expectations: [esperado()], movements: [m] }).confirmed.length;
  assert.equal(una(mov("a", "2026-10-05", -102)), 1);
  assert.equal(una(mov("b", "2026-10-05", -102.5)), 0);
  assert.equal(una(mov("c", "2026-10-05", -97.9)), 0);
  assert.equal(una(mov("d", "2026-10-02", -100)), 1);
  assert.equal(una(mov("e", "2026-10-01", -100)), 0);
  assert.equal(una(mov("f", "2026-10-10", -100)), 1);
  assert.equal(una(mov("g", "2026-10-11", -100)), 0);
});

test("DEC-12 · con duda no se confirma nada: dos candidatos, o un movimiento que encaja con dos esperados", () => {
  const dos = E.autoConfirm({ expectations: [esperado()], movements: [mov("m1", "2026-10-05", -100), mov("m2", "2026-10-06", -100)] });
  assert.deepEqual(dos, { confirmed: [], doubtful: ["expense|seguro|2026-10"] });
  const otro = esperado({ id: "expense|luz|2026-10", seriesKey: "expense|luz", label: "Luz ficticia", expectedDate: "2026-10-06" });
  const compartido = E.autoConfirm({ expectations: [esperado(), otro], movements: [mov("m1", "2026-10-05", -100)] });
  assert.deepEqual(compartido.confirmed, []);
  assert.deepEqual(compartido.doubtful.sort(), ["expense|luz|2026-10", "expense|seguro|2026-10"]);
});

test("DEC-12 · solo esperados con fecha segura, sin real ni anulados; y nunca una pareja que el hogar descartó", () => {
  const m = [mov("m1", "2026-10-05", -100)];
  assert.equal(E.autoConfirm({ expectations: [esperado({ certain: false })], movements: m }).confirmed.length, 0, "la fecha de relleno no es una fecha");
  assert.equal(E.autoConfirm({ expectations: [esperado({ hasActual: true })], movements: m }).confirmed.length, 0, "ya tiene su real");
  assert.equal(E.autoConfirm({ expectations: [esperado({ cancelled: true })], movements: m }).confirmed.length, 0);
  assert.equal(E.autoConfirm({ expectations: [esperado({ plannedAmount: 0 })], movements: m }).confirmed.length, 0);
  assert.equal(E.autoConfirm({ expectations: [esperado()], movements: m, rejected: ["expense|seguro|2026-10|m1"] }).confirmed.length, 0);
  assert.equal(E.autoConfirm({ expectations: [esperado()], movements: m, rejected: ["expense|seguro|2026-09|m1"] }).confirmed.length, 1);
  assert.deepEqual(E.autoConfirm(), { confirmed: [], doubtful: [] });
});

test("DEC-12 · cableado: dentro del lote de la importación y antes de los reales; almacén en la copia; bandeja con «No era esto»", () => {
  const imp = read("importar-extracto-ui.js");
  const at = imp.indexOf("const confirmadosSolos = typeof expectedAutoConfirmOnImport === \"function\" ? expectedAutoConfirmOnImport(incoming) : [];");
  assert.ok(at > imp.indexOf("baseData = { ...baseData, transactions: mergeTransactions(baseData.transactions || [], incoming) };"));
  assert.ok(at < imp.indexOf("const appliedActuals = applyMovementMappingsToActuals();", at));
  assert.ok(at < imp.indexOf("const afterState = appStatePayload({ includeCanonical: false });"), "dentro del lote: su «Deshacer» lo devuelve");
  assert.match(imp, /confirmadosSolos: confirmadosSolos\.length \};/);
  assert.match(read("app.js"), /\n {2}"expected-auto", \/\/ DEC-12:/);
  const esp = read("esperados-ui.js");
  // Solo los movimientos que entran sin partida y no son un traspaso; confirmar es clasificar ese movimiento.
  assert.match(esp, /\.filter\(\(transaction\) => Number\(transaction\.amount\) && !mappingForMovement\(transaction\) && !\(typeof movementIsInternalTransfer === "function" && movementIsInternalTransfer\(transaction\)\)\)/);
  assert.match(esp, /movementMappings\[entry\.movementId\] = \{ kind: entry\.kind, rowKey: entry\.seriesKey, label: displayLabelForRow\(row\), auto: "DEC-12",/);
  assert.match(esp, /hasActual: Boolean\(info\.hasActual\)/);
  assert.match(esp, /data-expected-auto-reject="\$\{escapeHtml\(entry\.movementId\)\}">No era esto<\/button>/);
  assert.match(esp, /if \(antesRegla\?\.auto === "DEC-12"\) delete movementMappings\[movementId\];/);
  // Nunca al abrir la app: la única llamada es la de la importación.
  const llamadas = ["app.js", "esperados-ui.js", "importar-extracto-ui.js", "datos-ui.js", "registrar-ui.js", "views/movimientos-v2.js", "views/hoy-v2.js", "views/repaso-v2.js"]
    .flatMap((f) => (read(f).match(/expectedAutoConfirmOnImport\(/g) || []).map(() => f));
  assert.deepEqual(llamadas, ["esperados-ui.js", "importar-extracto-ui.js"]);
});
