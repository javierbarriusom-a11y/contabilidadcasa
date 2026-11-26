// CIE-01 (26/11/2026, petición del hogar: «incorpora al backlog el cerrar el mes de agosto, que sigue abierto»). Cierre deja elegir un mes
// atrasado sin firmar y lo cierra con los saldos de SU extracto, no con los de hoy. Movimientos FICTICIOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const B = require("../canonical-month-close-balances.js");

test("closeTarget ofrece los meses atrasados sin firmar con movimientos, el más antiguo primero, y deja elegir uno", () => {
  const meses = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
  const firmado = (k) => k === "2026-07" || k === "2026-10";
  const porDefecto = B.closeTarget({ today: "2026-11-26", isSigned: firmado, pastMonths: meses, hasActivity: (k) => k !== "2026-06" });
  assert.equal(porDefecto.monthKey, "2026-11", "por defecto no cambia nada: el mes en curso");
  assert.equal(porDefecto.late, false);
  assert.deepEqual(porDefecto.pending, ["2026-08", "2026-09"], "ni julio (firmado), ni junio (sin movimientos), ni octubre (es el anterior)");
  const agosto = B.closeTarget({ today: "2026-11-26", isSigned: firmado, pastMonths: meses, choice: "2026-08" });
  assert.equal(agosto.monthKey, "2026-08");
  assert.equal(agosto.late, true);
  assert.equal(agosto.alternative, "2026-11", "se puede volver al mes por defecto");
  assert.match(agosto.reason, /mes atrasado/);
  assert.equal(B.closeTarget({ today: "2026-11-26", isSigned: firmado, pastMonths: meses, choice: "2026-07" }).monthKey, "2026-11", "uno firmado no se elige");
  assert.deepEqual(B.closeTarget({ today: "2026-11-26" }).pending, [], "sin meses, nada atrasado");
});

test("balancesAtMonthEnd: el saldo tras el último movimiento del banco de ese mes, el que cierra la cadena del último día", () => {
  const e = (date, signedAmount, balanceAfter, extra = {}) => ({ accountId: "caixabank", date, signedAmount, balanceAfter, source: "extracto bancario", ...extra });
  const entries = [
    e("2026-08-30", -20, 980, { sourceRow: 9 }),
    // El 31: el fichero los lista al revés (CaixaBank), pero el que cierra la cadena es el de 1.030 €.
    e("2026-08-31", 100, 1030, { sourceRow: 1 }),
    e("2026-08-31", -50, 930, { sourceRow: 2 }),
    e("2026-09-01", -5, 1025),
    e("2026-08-31", -999, 1, { duplicateOf: "x" }),
    e("2026-08-31", -10, 5, { source: "captura-hoja" }),
    { accountId: "mediolanum", date: "2026-07-31", signedAmount: 0, balanceAfter: 5000, source: "extracto bancario" },
  ];
  const r = B.balancesAtMonthEnd({ monthKey: "2026-08", entries });
  assert.deepEqual(r.accounts, { caixabank: 1030 });
  assert.equal(r.date, "2026-08-31");
  assert.deepEqual(r.missing, ["mediolanum"], "Mediolanum no tiene movimientos con saldo en agosto: falta, no se toma el de julio ni el de hoy");
  assert.deepEqual(r.ambiguous, []);
  const raro = B.balancesAtMonthEnd({ monthKey: "2026-08", entries: [e("2026-08-31", -10, 100, { sourceRow: 1 }), e("2026-08-31", -10, 300, { sourceRow: 2 })] });
  assert.deepEqual(raro.ambiguous, ["caixabank"], "un último día que no encadena se dice");
  assert.equal(raro.accounts.caixabank, 300, "y se toma el último del fichero");
  assert.throws(() => B.balancesAtMonthEnd({ monthKey: "agosto" }));
});

test("cableado: Cierre ofrece los atrasados, un mes atrasado firma con su extracto (nunca con los saldos de hoy) y lo dice", () => {
  const app = read("app.js");
  const cierre = read("views/cierre.js");
  const v2 = read("views/cierre-v2.js");
  assert.match(app, /closeTarget\(\{ today, isSigned: isSignedClosedMonthKey, hasActivity, choice: [^\n]*, pastMonths \}\)/);
  assert.ok(app.includes('function pendingMonthCloseBalances(monthKey, closedAt = "") { if (closeBalancesEngine() && monthKey < closeBalancesEngine().previousMonthKey(isoLocalDate(new Date()).slice(0, 7))) return globalThis.cierreSaldosMesAtrasado?.(monthKey, closedAt) || null;'), "un mes atrasado: los saldos del extracto o ninguno, nunca los de hoy");
  assert.match(app, /closest\("\[data-cierre-mes-atrasado\]"\)\) handleCierreTargetSwitch/);
  assert.match(cierre, /data-cierre-mes-atrasado="\$\{escapeHtml\(key\)\}">Cerrar \$\{escapeHtml\(ledgerMonthLabel\(key\)\)\}/);
  assert.match(cierre, /const accountRows = target\.late \? cierreCuentasMesAtrasado\(currentMonthKey\) : cierreAccountReconciliation\(entries\);/);
  assert.match(cierre, /engine\.balancesAtMonthEnd\(\{ monthKey, entries: snapshot\?\.entries \|\| \[\] \}\)/);
  assert.match(cierre, /no se usan los de hoy/);
  assert.match(v2, /row\.declared === null \? "sin saldo en el extracto"/);
  const html = read("index.html");
  assert.ok(html.includes('src="canonical-month-close-balances.js?v=20261126cie01"'));
});
