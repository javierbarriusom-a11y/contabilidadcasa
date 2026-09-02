(function attachCanonicalHouseholdSplit(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalHouseholdSplit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalHouseholdSplit() {
  "use strict";

  // A18-1 — reglas de reparto configurables por categoría, para hogares con ingresos o cuentas no
  // simétricas (E25). Hasta ahora el reparto de un gasto compartido estaba fijo al 50/50 en el
  // propio texto de familyContextMeta() ("la mitad de los gastos compartidos"); este motor no toca
  // ese texto ni calcula ningún saldo "quién debe a quién" (A18-2, más adelante, depende de este) —
  // solo resuelve, dado un importe y una regla, cuánto le corresponde a cada titular. Motor puro,
  // sin DOM ni estado global.

  const SCHEMA_ID = "finance-canonical-household-split/v1";
  const MODES = Object.freeze(["equal", "income-proportional", "fixed"]);

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  // Un modo desconocido o un titular desconocido caen al valor más neutro (partes iguales, Javi)
  // en vez de fallar — mismo criterio que taxTableStatus (A15-5): nunca fabrica peor un dato
  // corrupto, lo trata como si no estuviera configurado.
  function normalizeRule(rule) {
    const mode = MODES.includes(rule?.mode) ? rule.mode : "equal";
    const payer = rule?.payer === "tere" ? "tere" : "javi";
    const amount = mode === "fixed" ? Math.max(0, round2(rule?.amount)) : null;
    return { mode, payer, amount };
  }

  // key: nombre de categoría tal cual lo usa el resto de la app (mismo texto que
  // e13BudgetCategoryOptions()) — sin normalizar mayúsculas/acentos, para no fusionar por
  // accidente dos categorías que el hogar quiere distinguir.
  function resolveRuleForCategory(categoryRules, category, defaultRule) {
    const byCategory = categoryRules && category ? categoryRules[category] : null;
    return normalizeRule(byCategory || defaultRule);
  }

  function splitShares({ amount, rule, incomes = {} }) {
    const total = round2(Math.max(0, amount));
    const normalized = normalizeRule(rule);
    if (total === 0) return { javi: 0, tere: 0, mode: normalized.mode };

    if (normalized.mode === "fixed") {
      const payerShare = round2(Math.min(total, normalized.amount ?? 0));
      const otherShare = round2(total - payerShare);
      return normalized.payer === "javi"
        ? { javi: payerShare, tere: otherShare, mode: "fixed" }
        : { tere: payerShare, javi: otherShare, mode: "fixed" };
    }

    if (normalized.mode === "income-proportional") {
      const javiIncome = Math.max(0, number(incomes.javi));
      const tereIncome = Math.max(0, number(incomes.tere));
      const combined = javiIncome + tereIncome;
      // Sin ingresos declarados de ninguno de los dos, "proporcional a ingresos" no tiene con qué
      // calcularse — cae a partes iguales en vez de repartir 100/0 o dividir por cero, y lo declara
      // en `mode` para que quien lee el resultado sepa que no se aplicó la regla pedida.
      if (combined <= 0) return { javi: round2(total / 2), tere: round2(total / 2), mode: "equal-fallback" };
      const javiShare = round2(total * (javiIncome / combined));
      return { javi: javiShare, tere: round2(total - javiShare), mode: "income-proportional" };
    }

    const half = round2(total / 2);
    return { javi: half, tere: round2(total - half), mode: "equal" };
  }

  // A18-2: saldo continuo "quién debe a quién" — cada gasto compartido registrado ya fue pagado al
  // 100% por uno de los dos titulares (`paidBy`); el reparto de A18-1 (resolveRuleForCategory +
  // splitShares) dice cuál era su cuota justa, así que el otro titular le debe esa cuota. Se
  // acumula en un único saldo neto (nunca dos saldos que se contradigan): positivo cuando Tere debe
  // a Javi, negativo cuando Javi debe a Tere. Sin gastos registrados el saldo es 0 — no una cifra
  // ausente, sino el resultado correcto de no haber nada que repartir todavía. No toca el libro
  // principal de movimientos: lee y devuelve, nunca escribe.
  function runningBalance(entries = [], settings = {}) {
    const incomes = settings.incomes || {};
    const categoryRules = settings.categoryRules || {};
    const defaultRule = settings.defaultRule || { mode: "equal", payer: "javi", amount: null };
    let net = 0;
    const breakdown = (Array.isArray(entries) ? entries : []).map((entry) => {
      const amount = Math.max(0, round2(entry?.amount));
      const paidBy = entry?.paidBy === "tere" ? "tere" : "javi";
      const rule = resolveRuleForCategory(categoryRules, entry?.category, defaultRule);
      const shares = splitShares({ amount, rule, incomes });
      const owed = paidBy === "javi" ? shares.tere : shares.javi;
      net = round2(net + (paidBy === "javi" ? owed : -owed));
      return { id: String(entry?.id || ""), date: String(entry?.date || ""), category: String(entry?.category || ""), amount, paidBy, shares, owed };
    });
    return {
      schemaId: `${SCHEMA_ID}/running-balance-v1`,
      entries: breakdown,
      net,
      owes: net > 0 ? "tere" : net < 0 ? "javi" : null,
      owedTo: net > 0 ? "javi" : net < 0 ? "tere" : null,
      amount: round2(Math.abs(net)),
    };
  }

  return { SCHEMA_ID, MODES, normalizeRule, resolveRuleForCategory, splitShares, runningBalance };
});
