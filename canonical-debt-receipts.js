/**
 * canonical-debt-receipts.js
 *
 * Deuda › Contratos · «Detectadas en vuestros recibos» (15/11/2026, petición del hogar: «hazlo tú por mí directamente»). Las cuotas
 * de los créditos ya están en los extractos (recibos de financieras, tarjetas aplazadas, préstamos al consumo); el hogar no debería
 * tener que copiarlas a mano en Contratos. Este motor las agrupa por entidad y contrato y, de cada una, dice:
 *
 *   · la entidad con un nombre legible (los recibos traen abreviaturas: «ECITC», «BANKINTER CONS», «LIQUID.VISA ORO»…);
 *   · el último recibo (fecha e importe) y la cuota de ahora (la mediana de los tres últimos meses con recibo);
 *   · en cuántos meses aparece y si sigue viva (recibo en el mes actual o en el anterior);
 *   · si ya está dada de alta en Contratos (por la entidad o por la referencia del contrato).
 *
 * Lo que los recibos NO dicen, y por eso no se inventa: el capital pendiente y la TAE. Sin capital pendiente un contrato se
 * leería como liquidado, así que el alta pide ese dato; la TAE puede quedar «por confirmar» (sin TAE, la pestaña Préstamo no
 * la cancela ni la ordena por coste, y lo dice). Motor puro: sin DOM, red ni almacenamiento.
 */
(function attachCanonicalDebtReceipts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDebtReceipts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalDebtReceiptsFactory() {
  "use strict";

  const SCHEMA_ID = "finance-debt-receipts/v1";
  const CUOTA_CATEGORIES = new Set(["Creditos antiguos", "Refinanciacion", "Coche"]);
  // Las liquidaciones de tarjeta que se pagan enteras no son cuota de un crédito (mismo criterio que la medición del gasto variable).
  const CARD_SETTLEMENT = /master basica|servicios financieros carrefour|financiera carrefour|tarjeta carrefour|pass carrefour|\bfinancie[-\s]?(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\b/;
  // Nombre legible y tipo de cada entidad que aparece en los recibos. El orden importa: gana el primero que encaja.
  const LENDERS = [
    { test: /\becitc|financiera el corte|fin\.?\s?el corte|financiacion el corte/, entity: "Financiera El Corte Inglés", type: "Crédito al consumo" },
    { test: /bankinter cons/, entity: "Bankinter Consumer Finance", type: "Crédito al consumo" },
    { test: /visa oro/, entity: "Visa Oro", type: "Tarjeta de crédito" },
    { test: /caixabank paym|caixabank payments|cpc consumer/, entity: "CaixaBank Payments & Consumer", type: "Crédito al consumo" },
    { test: /serv\.?\s?financ|recibo entidad de financiacion|entidad de financiacion/, entity: "Servicios financieros (pago aplazado)", type: "Pago aplazado" },
    { test: /cetelem/, entity: "Cetelem", type: "Crédito al consumo" },
    { test: /cofidis/, entity: "Cofidis", type: "Crédito al consumo" },
    { test: /santander consumer/, entity: "Santander Consumer Finance", type: "Crédito al consumo" },
    { test: /bbva consumer|bbva consumo/, entity: "BBVA Consumo", type: "Crédito al consumo" },
  ];
  // Referencia de contrato en el concepto o el detalle: una letra opcional y 8 o más cifras.
  const REFERENCE = /\b([a-z]?\d{8,})\b/;

  const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
  const monthOf = (date) => String(date || "").slice(0, 7);

  function normalize(text) {
    return String(text || "")
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function previousMonth(monthKey) {
    const [year, month] = String(monthKey).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 2, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  /** La entidad legible de un texto de recibo, o null si no se reconoce. */
  function lenderOf(text) {
    const normalized = normalize(text);
    return LENDERS.find((lender) => lender.test.test(normalized)) || null;
  }

  /** ¿Es la cuota de un crédito? Partida de Financiaciones o, sin partida, la categoría que pone la app al importar. */
  function isDebtReceipt(movement) {
    if (!(Number(movement.amount) < 0)) return false;
    const text = normalize(`${movement.label || ""} ${movement.details || ""}`);
    if (CARD_SETTLEMENT.test(text)) return false;
    if (movement.block) return movement.block === "financiacion";
    return CUOTA_CATEGORIES.has(movement.category);
  }

  function alreadyRegistered(group, contracts) {
    return contracts.some((contract) => {
      if (contract.receiptKey) return contract.receiptKey === group.key;
      const entity = normalize(contract.entity);
      const number = normalize(contract.number);
      if (group.reference && number && number.includes(group.reference)) return true;
      if (group.reference) return false; // con referencia, solo cuenta el mismo contrato: una entidad puede tener varios
      return entity && (entity === normalize(group.entity) || entity.includes(normalize(group.sourceLabel)));
    });
  }

  /**
   * @param {Array<{date:string, amount:number, label?:string, details?:string, category?:string, block?:string|null}>} movements
   * @param {{today?:string, contracts?:Array<{entity?:string, number?:string}>}} [options]
   */
  function detect(movements, options = {}) {
    // Sin «hoy» explícito, el día local (no el de UTC: a medianoche cambiaría de mes antes de tiempo).
    const now = new Date();
    const today = String(options.today || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
    const current = monthOf(today);
    const live = new Set([current, previousMonth(current)]);
    const contracts = Array.isArray(options.contracts) ? options.contracts : [];
    const groups = new Map();
    (Array.isArray(movements) ? movements : []).filter(isDebtReceipt).forEach((movement) => {
      const text = `${movement.label || ""} ${movement.details || ""}`;
      const lender = lenderOf(text);
      const reference = (normalize(text).match(REFERENCE) || [])[1] || "";
      const sourceLabel = String(movement.label || "").trim() || "Recibo sin concepto";
      const key = `${lender ? lender.entity : normalize(sourceLabel)}|${reference}`;
      if (!groups.has(key)) {
        groups.set(key, { key, entity: lender ? lender.entity : sourceLabel, type: lender ? lender.type : "Crédito", recognised: Boolean(lender), reference, sourceLabel, byMonth: new Map(), last: null });
      }
      const group = groups.get(key);
      const month = monthOf(movement.date);
      group.byMonth.set(month, round2((group.byMonth.get(month) || 0) - Number(movement.amount)));
      if (!group.last || String(movement.date) > group.last.date) group.last = { date: String(movement.date), amount: round2(-Number(movement.amount)) };
    });
    const debts = [...groups.values()].map((group) => {
      const months = [...group.byMonth.keys()].sort();
      const recent = months.slice(-3).map((month) => group.byMonth.get(month));
      const lastMonth = months.at(-1) || "";
      return {
        key: group.key,
        entity: group.entity,
        type: group.type,
        recognised: group.recognised,
        reference: group.reference,
        sourceLabel: group.sourceLabel,
        months: months.length,
        firstMonth: months[0] || "",
        lastMonth,
        lastDate: group.last?.date || "",
        lastAmount: group.last?.amount || 0,
        payment: round2(median(recent)),
        active: live.has(lastMonth),
        registered: alreadyRegistered(group, contracts),
      };
    });
    // Primero las vivas, después la cuota más alta.
    debts.sort((a, b) => Number(b.active) - Number(a.active) || b.payment - a.payment || a.entity.localeCompare(b.entity, "es"));
    const pending = debts.filter((debt) => debt.active && !debt.registered);
    return {
      schemaId: SCHEMA_ID,
      debts,
      pending: pending.length,
      pendingMonthly: round2(pending.reduce((sum, debt) => sum + debt.payment, 0)),
      activeMonthly: round2(debts.filter((debt) => debt.active).reduce((sum, debt) => sum + debt.payment, 0)),
    };
  }

  return { SCHEMA_ID, detect, lenderOf, isDebtReceipt, normalize };
});
