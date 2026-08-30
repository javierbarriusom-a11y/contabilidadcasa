const test = require("node:test");
const assert = require("node:assert/strict");
const Split = require("../canonical-household-split.js");

// A18-1 · Bloque 5: motor puro de reglas de reparto configurables por categoría. Reemplaza el
// 50/50 implícito del hogar por una regla explícita, por defecto o por categoría, sin calcular
// ningún saldo "quién debe a quién" (A18-2, más adelante).

test("splitShares · partes iguales, reparte el importe exactamente en dos mitades", () => {
  const result = Split.splitShares({ amount: 100, rule: { mode: "equal" } });
  assert.equal(result.javi, 50);
  assert.equal(result.tere, 50);
  assert.equal(result.mode, "equal");
});

test("splitShares · partes iguales con céntimo impar, la suma sigue cuadrando con el total", () => {
  const result = Split.splitShares({ amount: 100.01, rule: { mode: "equal" } });
  assert.equal(round2(result.javi + result.tere), 100.01);
});

test("splitShares · proporcional a ingresos, reparte según la proporción declarada", () => {
  const result = Split.splitShares({ amount: 1000, rule: { mode: "income-proportional" }, incomes: { javi: 3000, tere: 1000 } });
  assert.equal(result.javi, 750);
  assert.equal(result.tere, 250);
  assert.equal(result.mode, "income-proportional");
});

test("splitShares · proporcional a ingresos sin ningún ingreso declarado, cae a partes iguales y lo declara", () => {
  const result = Split.splitShares({ amount: 1000, rule: { mode: "income-proportional" }, incomes: {} });
  assert.equal(result.javi, 500);
  assert.equal(result.tere, 500);
  assert.equal(result.mode, "equal-fallback");
});

test("splitShares · importe fijo, el titular paga su parte y el resto lo cubre el otro", () => {
  const result = Split.splitShares({ amount: 300, rule: { mode: "fixed", payer: "javi", amount: 100 } });
  assert.equal(result.javi, 100);
  assert.equal(result.tere, 200);
});

test("splitShares · importe fijo mayor que el total, se capa al total en vez de dar un resto negativo", () => {
  const result = Split.splitShares({ amount: 100, rule: { mode: "fixed", payer: "tere", amount: 500 } });
  assert.equal(result.tere, 100);
  assert.equal(result.javi, 0);
});

test("splitShares · importe cero, reparte cero sin dividir por cero ni fallar", () => {
  const result = Split.splitShares({ amount: 0, rule: { mode: "income-proportional" }, incomes: { javi: 1000, tere: 0 } });
  assert.equal(result.javi, 0);
  assert.equal(result.tere, 0);
});

test("normalizeRule · un modo desconocido cae a partes iguales, no falla", () => {
  const rule = Split.normalizeRule({ mode: "no-existe" });
  assert.equal(rule.mode, "equal");
});

test("normalizeRule · un titular desconocido cae a Javi", () => {
  const rule = Split.normalizeRule({ mode: "fixed", payer: "otro", amount: 100 });
  assert.equal(rule.payer, "javi");
});

test("resolveRuleForCategory · usa la regla de la categoría si existe, si no la regla por defecto", () => {
  const rules = { Alimentación: { mode: "fixed", payer: "tere", amount: 50 } };
  const withMatch = Split.resolveRuleForCategory(rules, "Alimentación", { mode: "equal" });
  assert.equal(withMatch.mode, "fixed");
  const withoutMatch = Split.resolveRuleForCategory(rules, "Ocio", { mode: "income-proportional" });
  assert.equal(withoutMatch.mode, "income-proportional");
});

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
