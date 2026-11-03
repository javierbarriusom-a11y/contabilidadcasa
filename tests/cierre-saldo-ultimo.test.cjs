// 3/11/2026 · el primer cierre real descuadraba CaixaBank: dos cargos el último día y el extracto del más nuevo al más antiguo. Cierre ordenaba por posición en el fichero
// suponiendo lo contrario y tomaba como «último» el saldo intermedio. Ahora el último es el que cierra la cadena de saldos de ese día, valga el orden que valga. INVENTADO.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const app = codigoApp();
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0;
  for (let i = app.indexOf("{", app.indexOf(")", start)); i < app.length; i += 1) {
    if (app[i] === "{") depth += 1;
    else if (app[i] === "}") { depth -= 1; if (!depth) return app.slice(start, i + 1); }
  }
  throw new Error(name);
}

function conciliar(entries, caixa) {
  const ctx = { round2: (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100, accountBalancesFromState: () => ({ caixa, mediolanum: 0 }), CIERRE_ACCOUNT_LABELS: { caixabank: "CaixaBank" } };
  vm.createContext(ctx);
  vm.runInContext(extractFunction("cierreAccountReconciliation"), ctx);
  return ctx.cierreAccountReconciliation(entries)[0];
}

const e = (date, signedAmount, balanceAfter, sourceRow) => ({ accountId: "caixabank", duplicateOf: null, date, signedAmount, balanceAfter, sourceRow });
// 30/10: primero −100 (de 2.000 a 1.900) y después −500 (de 1.900 a 1.400). El saldo final es 1.400.
const DIA = [e("2026-10-29", -50, 2000, 0), e("2026-10-30", -100, 1900, 0), e("2026-10-30", -500, 1400, 0)];

test("del más nuevo al más antiguo (como CaixaBank): el último del día es el que cierra la cadena, no el de mayor posición", () => {
  const entries = [e("2026-10-30", -500, 1400, 3), e("2026-10-30", -100, 1900, 4), e("2026-10-29", -50, 2000, 5)];
  const fila = conciliar(entries, 1400);
  assert.equal(fila.calculated, 1400);
  assert.equal(fila.status, "cuadra");
});

test("del más antiguo al más nuevo: igual", () => {
  const entries = DIA.map((entry, index) => ({ ...entry, sourceRow: index }));
  assert.equal(conciliar(entries, 1400).calculated, 1400);
});

test("un solo movimiento el último día, o una cadena que no se puede seguir, cae en el orden del fichero como antes", () => {
  assert.equal(conciliar([e("2026-10-29", -50, 2000, 0), e("2026-10-30", -100, 1900, 1)], 1900).calculated, 1900);
  // Dos movimientos del mismo día que no encadenan (saldos sueltos): no hay un único final, manda la posición.
  assert.equal(conciliar([e("2026-10-30", -10, 500, 1), e("2026-10-30", -20, 700, 2)], 0).calculated, 700);
});
