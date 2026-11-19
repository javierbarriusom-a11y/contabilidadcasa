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

  // Un modo desconocido o un titular desconocido caen al valor más neutro (partes iguales, paga la persona 1)
  // en vez de fallar — mismo criterio que taxTableStatus (A15-5): nunca fabrica peor un dato
  // corrupto, lo trata como si no estuviera configurado.
  // Privacidad, fase 4 (D-N26): las dos personas son «p1» y «p2». Lo guardado antes con la clave de siempre se lee igual
  // (household-members.js, por su huella); lo que sale de aquí va siempre con «p1»/«p2».
  function householdMembers() {
    if (typeof globalThis !== "undefined" && globalThis.FinanceHouseholdMembers) return globalThis.FinanceHouseholdMembers;
    try {
      const ruta = "./household-members.js"; // en Node (pruebas); en el navegador llega por globalThis. Ruta en variable: tsc no la sigue
      return typeof require === "function" ? require(ruta) : null;
    } catch {
      return null;
    }
  }
  const quien = (value) => householdMembers()?.persona(value) || (value === "p1" || value === "p2" ? value : null);
  const de = (obj, persona) => householdMembers()?.valor(obj, persona) ?? obj?.[persona];
  const deSufijo = (obj, persona, sufijo) => householdMembers()?.valorSufijo(obj, persona, sufijo) ?? obj?.[`${persona}${sufijo}`];

  function normalizeRule(rule) {
    const mode = MODES.includes(rule?.mode) ? rule.mode : "equal";
    const payer = quien(rule?.payer) === "p2" ? "p2" : "p1";
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

  /** @param {{amount: number, rule: *, incomes?: Record<string, number>}} params */
  function splitShares({ amount, rule, incomes = {} }) {
    const total = round2(Math.max(0, amount));
    const normalized = normalizeRule(rule);
    if (total === 0) return { p1: 0, p2: 0, mode: normalized.mode };

    if (normalized.mode === "fixed") {
      const payerShare = round2(Math.min(total, normalized.amount ?? 0));
      const otherShare = round2(total - payerShare);
      return normalized.payer === "p1"
        ? { p1: payerShare, p2: otherShare, mode: "fixed" }
        : { p2: payerShare, p1: otherShare, mode: "fixed" };
    }

    if (normalized.mode === "income-proportional") {
      const p1Income = Math.max(0, number(de(incomes, "p1")));
      const p2Income = Math.max(0, number(de(incomes, "p2")));
      const combined = p1Income + p2Income;
      // Sin ingresos declarados de ninguno de los dos, "proporcional a ingresos" no tiene con qué
      // calcularse — cae a partes iguales en vez de repartir 100/0 o dividir por cero, y lo declara
      // en `mode` para que quien lee el resultado sepa que no se aplicó la regla pedida.
      if (combined <= 0) return { p1: round2(total / 2), p2: round2(total / 2), mode: "equal-fallback" };
      const p1Share = round2(total * (p1Income / combined));
      return { p1: p1Share, p2: round2(total - p1Share), mode: "income-proportional" };
    }

    const half = round2(total / 2);
    return { p1: half, p2: round2(total - half), mode: "equal" };
  }

  // A18-2: saldo continuo "quién debe a quién" — cada gasto compartido registrado ya fue pagado al
  // 100% por uno de los dos titulares (`paidBy`); el reparto de A18-1 (resolveRuleForCategory +
  // splitShares) dice cuál era su cuota justa, así que el otro titular le debe esa cuota. Se
  // acumula en un único saldo neto (nunca dos saldos que se contradigan): positivo cuando la persona 2 debe
  // a la persona 1, negativo cuando la persona 1 debe a la 2. Sin gastos registrados el saldo es 0 — no una cifra
  // ausente, sino el resultado correcto de no haber nada que repartir todavía. No toca el libro
  // principal de movimientos: lee y devuelve, nunca escribe.
  function runningBalance(entries = [], settings = {}) {
    const incomes = settings.incomes || {};
    const categoryRules = settings.categoryRules || {};
    const defaultRule = settings.defaultRule || { mode: "equal", payer: "p1", amount: null };
    let net = 0;
    const breakdown = (Array.isArray(entries) ? entries : []).map((entry) => {
      const amount = Math.max(0, round2(entry?.amount));
      const paidBy = quien(entry?.paidBy) === "p2" ? "p2" : "p1";
      const rule = resolveRuleForCategory(categoryRules, entry?.category, defaultRule);
      const shares = splitShares({ amount, rule, incomes });
      const owed = paidBy === "p1" ? shares.p2 : shares.p1;
      net = round2(net + (paidBy === "p1" ? owed : -owed));
      return { id: String(entry?.id || ""), date: String(entry?.date || ""), category: String(entry?.category || ""), amount, paidBy, shares, owed };
    });
    return {
      schemaId: `${SCHEMA_ID}/running-balance-v1`,
      entries: breakdown,
      net,
      owes: net > 0 ? "p2" : net < 0 ? "p1" : null,
      owedTo: net > 0 ? "p1" : net < 0 ? "p2" : null,
      amount: round2(Math.abs(net)),
    };
  }

  const SETTLEMENT_SCHEMA_ID = "finance-canonical-household-split/settlement-v1";

  // A18-3: liquidación con doble confirmación — depende de A18-2 (runningBalance). El saldo continuo
  // de A18-2 nunca se registra como transferencia interna por sí solo ("sin afectar al libro
  // principal", por diseño de esa misma tarea); A18-3 es el único camino para eso, y exige que ambos
  // titulares confirmen por separado antes de registrarla — mismo ciclo de aprobación que el
  // cierre/reapertura de mes (E5), nunca una sola confirmación. Una liquidación confirmada cubre
  // exactamente los gastos compartidos pendientes en ese momento (`entryIds`); los que se registren
  // después empiezan un saldo nuevo, nunca se mezclan con uno ya liquidado.
  function pendingSplitEntries(entries, settledEntryIds = []) {
    const settled = new Set((Array.isArray(settledEntryIds) ? settledEntryIds : []).map(String));
    return (Array.isArray(entries) ? entries : []).filter((entry) => !settled.has(String(entry?.id)));
  }

  // Sin saldo pendiente (todo ya liquidado o sin gastos compartidos), no hay nada que proponer —
  // `hasPendingBalance: false`, nunca una liquidación de importe cero.
  function proposeSettlement(entries, settings, settledEntryIds = []) {
    const pending = pendingSplitEntries(entries, settledEntryIds);
    const balance = runningBalance(pending, settings);
    if (!balance.owes) return { schemaId: SETTLEMENT_SCHEMA_ID, hasPendingBalance: false, entryIds: [] };
    return {
      schemaId: SETTLEMENT_SCHEMA_ID,
      hasPendingBalance: true,
      amount: balance.amount,
      from: balance.owes,
      to: balance.owedTo,
      entryIds: pending.map((entry) => String(entry.id)),
    };
  }

  // Nunca registra con una sola confirmación — si falta alguna, devuelve status "pending" con quién
  // falta, para que la interfaz lo pida explícitamente, nunca lo asuma ni lo complete a medias.
  function confirmSettlement(proposal, confirmations = {}, metadata = {}) {
    if (!proposal || !proposal.hasPendingBalance) {
      return { schemaId: SETTLEMENT_SCHEMA_ID, status: "no-pending-balance" };
    }
    const p1Confirmed = Boolean(de(confirmations, "p1"));
    const p2Confirmed = Boolean(de(confirmations, "p2"));
    const missing = [];
    if (!p1Confirmed) missing.push("p1");
    if (!p2Confirmed) missing.push("p2");
    if (missing.length) return { schemaId: SETTLEMENT_SCHEMA_ID, status: "pending", missing };
    const confirmedAt = metadata.confirmedAt || new Date().toISOString();
    return {
      schemaId: SETTLEMENT_SCHEMA_ID,
      status: "confirmed",
      id: String(metadata.id || `settlement-${Date.now()}`),
      amount: proposal.amount,
      from: proposal.from,
      to: proposal.to,
      entryIds: proposal.entryIds,
      p1ConfirmedAt: deSufijo(metadata, "p1", "ConfirmedAt") || confirmedAt,
      p2ConfirmedAt: deSufijo(metadata, "p2", "ConfirmedAt") || confirmedAt,
      confirmedAt,
    };
  }

  return {
    SCHEMA_ID,
    MODES,
    normalizeRule,
    resolveRuleForCategory,
    splitShares,
    runningBalance,
    SETTLEMENT_SCHEMA_ID,
    pendingSplitEntries,
    proposeSettlement,
    confirmSettlement,
  };
});
