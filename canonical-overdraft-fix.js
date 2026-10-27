(function attachCanonicalOverdraftFix(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalOverdraftFix = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalOverdraftFixFactory() {
  "use strict";

  // XPR-07 · PR-1 «El arreglo más barato para un descubierto» (ficha XPR-07 de docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md). Cuando la
  // trayectoria «según el plan» de la banda de caja (WP-16) baja del suelo de liquidez, dice cuánto falta y ordena las palancas por lo que
  // cuestan, de la más barata a la más cara, con una a tres combinaciones. Es táctico (el mes que viene), frente al plan B (WP-38), que es
  // estructural y se acuerda en frío.
  //
  // Reglas de honestidad:
  //   · una palanca sin dato no se inventa: sin gasto marcado como discrecional (WP-35) o sin línea de crédito declarada, no sale, y se dice;
  //   · el coste es en euros y con su cálculo; «tirar del colchón» cuesta 0 € pero deja el colchón por debajo del suelo, y se dice cuánto;
  //   · a igual coste gana la palanca de menos riesgo (aplazar un gasto decidible antes que tocar el colchón);
  //   · no hace nada: enseña. Motor puro: ni DOM, ni almacenamiento, ni reloj.

  const SCHEMA_ID = "finance-overdraft-fix/v1";
  const MAX_OPTIONS = 3;
  const RISK = Object.freeze({ discrecional: 0, colchon: 1, credito: 2 });

  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  /**
   * El primer día por debajo del suelo en la trayectoria «según el plan», el punto más bajo desde ahí y cuánto falta para no bajar.
   * @param {{days?: Array<{date: string, central: number}>, floor?: number|null}} input
   * @returns {null|{date: string, lowestDate: string, lowest: number, floor: number, shortfall: number}}
   */
  function findDeficit({ days = [], floor = null } = {}) {
    if (!known(floor) || Number(floor) <= 0) return null;
    const list = (Array.isArray(days) ? days : []).filter((day) => day && /^\d{4}-\d{2}-\d{2}$/.test(String(day.date)) && known(day.central));
    const first = list.findIndex((day) => Number(day.central) < Number(floor));
    if (first < 0) return null;
    let lowest = list[first];
    list.slice(first).forEach((day) => { if (Number(day.central) < Number(lowest.central)) lowest = day; });
    return { date: list[first].date, lowestDate: lowest.date, lowest: round2(lowest.central), floor: round2(floor), shortfall: round2(Number(floor) - Number(lowest.central)) };
  }

  /**
   * Las palancas que se pueden usar, normalizadas, con su coste por euro. Solo las que tienen dato.
   * @param {{discretionary?: {amount?: number, monthKey?: string, items?: Array<{label: string, amount: number}>}|null,
   *   cushion?: boolean, creditLine?: {limit?: number, ratePct?: number, months?: number}|null}} input
   */
  function levers({ discretionary = null, cushion = true, creditLine = null } = {}) {
    const list = [];
    const missing = [];
    if (discretionary && known(discretionary.amount) && Number(discretionary.amount) > 0) {
      list.push({ id: "discrecional", available: round2(discretionary.amount), costPerEuro: 0, items: (discretionary.items || []).slice(0, 3) });
    } else missing.push("discrecional");
    if (cushion) list.push({ id: "colchon", available: Infinity, costPerEuro: 0 });
    if (creditLine && known(creditLine.limit) && Number(creditLine.limit) > 0 && known(creditLine.ratePct)) {
      const months = known(creditLine.months) && Number(creditLine.months) > 0 ? Number(creditLine.months) : 3;
      list.push({ id: "credito", available: round2(creditLine.limit), costPerEuro: (Number(creditLine.ratePct) / 100) * (months / 12), months, ratePct: Number(creditLine.ratePct) });
    } else missing.push("credito");
    return { list, missing };
  }

  // Llena lo que falta con las palancas dadas, en su orden. Devuelve null si no llega.
  function fill(shortfall, ordered) {
    let left = shortfall;
    const parts = [];
    ordered.forEach((lever) => {
      if (left <= 0.005) return;
      const amount = round2(Math.min(left, lever.available));
      if (amount <= 0) return;
      parts.push({ id: lever.id, amount, cost: round2(amount * lever.costPerEuro), ...(lever.items ? { items: lever.items } : {}), ...(lever.months ? { months: lever.months, ratePct: lever.ratePct } : {}) });
      left = round2(left - amount);
    });
    if (left > 0.005) return null;
    return { parts, cost: round2(parts.reduce((sum, part) => sum + part.cost, 0)), cushionUsed: round2(parts.filter((part) => part.id === "colchon").reduce((sum, part) => sum + part.amount, 0)) };
  }

  /**
   * Hasta tres arreglos para cubrir `shortfall`, del más barato al más caro; a igual coste, el que menos colchón gasta y, después, el de menos
   * piezas.
   * @param {{shortfall?: number, levers?: Array<any>}} input
   */
  function solve({ shortfall, levers: available = [] } = {}) {
    if (!known(shortfall) || Number(shortfall) <= 0) return { status: "none", options: [] };
    const byCost = available.slice().sort((a, b) => a.costPerEuro - b.costPerEuro || RISK[a.id] - RISK[b.id]);
    const candidates = [];
    // La combinación más barata: cada palanca hasta donde llegue, por coste y riesgo.
    const cheapest = fill(Number(shortfall), byCost);
    if (cheapest) candidates.push(cheapest);
    // Cada palanca sola, si basta; y la combinación sin tocar el colchón, si existe.
    available.forEach((lever) => { const alone = fill(Number(shortfall), [lever]); if (alone) candidates.push(alone); });
    const sinColchon = fill(Number(shortfall), byCost.filter((lever) => lever.id !== "colchon"));
    if (sinColchon) candidates.push(sinColchon);
    const seen = new Set();
    const options = candidates
      .filter((option) => { const key = option.parts.map((part) => `${part.id}:${part.amount}`).join("|"); if (seen.has(key)) return false; seen.add(key); return true; })
      .sort((a, b) => a.cost - b.cost || a.cushionUsed - b.cushionUsed || a.parts.length - b.parts.length)
      .slice(0, MAX_OPTIONS);
    return { status: options.length ? "ok" : "uncovered", options };
  }

  return Object.freeze({ SCHEMA_ID, MAX_OPTIONS, findDeficit, levers, solve });
});
