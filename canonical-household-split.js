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

  return { SCHEMA_ID, MODES, normalizeRule, resolveRuleForCategory, splitShares };
});
