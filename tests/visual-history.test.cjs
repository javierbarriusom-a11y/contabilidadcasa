const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("la matriz permite consultar plan, meses abiertos e histórico", () => {
  assert.match(html, /id="visualPeriodMode"/);
  assert.match(html, /value="all">Plan e histórico/);
  assert.match(html, /value="closed">Solo histórico/);
  assert.match(app, /function allVisualMonths\(\)/);
  assert.match(app, /periodMode === "closed"/);
});

test("la matriz separa planificación, registro real y valor usado", () => {
  assert.match(html, /value="planned">Planificar futuro/);
  assert.match(html, /value="actual">Registrar lo ocurrido/);
  assert.match(app, /Previsto pendiente/);
  assert.match(app, /Real registrado/);
  assert.match(app, /Usado \$\{money\(usedValue, true\)\}/);
});

test("un real vacío vuelve al previsto y un cero permanece como real", () => {
  assert.match(app, /if \(input\.value === "" \|\| parsed === null\) delete actuals\[actualKey\]/);
  assert.match(app, /else actuals\[actualKey\] = round2\(parsed\)/);
  assert.match(app, /saveActualsForKind\(row\.kind\)\(\)/);
});

test("los importes históricos permanecen visibles pero no editables", () => {
  assert.match(app, /historical = isClosedMonthKey\(month\.key\)/);
  assert.match(app, /pendingDelete \|\| historical \? "disabled"/);
  assert.match(app, /Histórico · solo lectura/);
});

test("un mes ya cerrado no ofrece repetir el cierre", () => {
  assert.match(app, /closeButton\.disabled = Boolean\(currentClosure\)/);
  assert.match(app, /currentClosure \? "Mes actual cerrado" : "Cerrar mes actual"/);
  assert.match(app, /ensureRemoteSaveQueue\(\)\.acknowledge\(closedAt\)/);
});

test("el arranque recupera cierres desde el registro inmutable remoto", () => {
  assert.match(app, /from\("finance_month_closures"\)/);
  assert.match(app, /closureOperations\.push/);
  assert.match(app, /status: "closed"/);
  assert.match(app, /monthClosures: closureOperations\.sort/);
});

test("E5 permite reabrir sin borrar el cierre histórico", () => {
  assert.match(html, /id="reopenLatestMonth"/);
  assert.match(app, /rpc\("reopen_finance_month"/);
  assert.match(app, /El cierre histórico se conserva/);
});

test("E5 confirma sus operaciones con un diálogo accesible y motivo obligatorio", () => {
  assert.match(html, /id="operationConfirmDialog"/);
  assert.match(html, /id="operationConfirmReason"[^>]*required/);
  assert.match(app, /function requestOperationConfirmation/);
  assert.doesNotMatch(app, /window\.prompt/);
});
