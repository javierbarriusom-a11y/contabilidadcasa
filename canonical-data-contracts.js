(function attachCanonicalDataContracts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDataContracts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalDataContractsFactory() {
  "use strict";

  // XDA-01 · «Lo que la app te pide» (ficha XDA-01 de docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md, diseño en docs/XDA01_DISENO.md).
  // Cada función declara qué datos necesita y cada cuánto (su «contrato de datos»); el motor suma lo que cuesta darlos a la semana y dice qué
  // funciones están «hambrientas» (les falta un dato o lo tienen antiguo). Se apoya en WP-45 (canonical-data-queue.js): la frescura de cada
  // fuente y los minutos de cada tarea, medidos cuando hay al menos 3 usos y supuestos (y dichos) cuando no.
  //
  // Reglas de honestidad:
  //   · un minuto supuesto se dice «supuesto»; el total solo es «medido» si lo es cada sumando;
  //   · una fuente que piden dos funciones se da una vez: el total cuenta cada fuente una sola vez, con la cadencia más exigente;
  //   · una función que no aplica (sin cartera no hay valoración que dar) no cuesta ni tiene hambre.
  // Motor puro: ni DOM, ni almacenamiento, ni reloj. No hace ninguna tarea ni cambia un dato.

  const SCHEMA_ID = "finance-data-contracts/v1";
  const BUDGET_MINUTES = 10; // GOV-01: diez minutos a la semana de mantenimiento

  // Las fuentes son las fichas de frescura de WP-45 (datos-ui.js), con lo que cuesta darlas una vez si no hay nada medido. En segundos: un
  // «20 / 60» minificado se publica como .3333333333333333, y la comprobación de privacidad lo toma (con razón) por un número de tarjeta.
  const SOURCES = Object.freeze({
    balances: { label: "Saldos de las cuentas", assumedSeconds: 20 },
    statement: { label: "Extracto del banco", assumedSeconds: 120 },
    pending: { label: "Cobros y cargos esperados", assumedSeconds: 30 },
    valuation: { label: "Valoración de la cartera", assumedSeconds: 60 },
    indices: { label: "Índices de referencia", assumedSeconds: 60 },
    close: { label: "Cierre del mes", assumedSeconds: 180 },
  });

  // Qué pide cada función y cada cuánto (días). Las cadencias salen de cuándo cada pantalla da su dato por antiguo (WP-45, WP-26) o de su ritmo
  // natural (el cierre, una vez al mes). `aplica`: la condición, si la hay, que la hace aplicable (la da quien pinta).
  const FUNCTIONS = Object.freeze([
    { id: "hoy", label: "Hoy: la cifra del día", href: "#home", needs: [{ source: "balances", everyDays: 4 }, { source: "pending", everyDays: 7 }] },
    { id: "movimientos", label: "Movimientos y Clasificar", href: "#movements", needs: [{ source: "statement", everyDays: 7 }] },
    { id: "prevision", label: "Previsión y banda de caja", href: "#prevision", needs: [{ source: "balances", everyDays: 7 }, { source: "statement", everyDays: 7 }] },
    { id: "cierre", label: "Cierre del mes", href: "#reconciliation", needs: [{ source: "statement", everyDays: 30 }, { source: "close", everyDays: 30 }] },
    { id: "cartera", label: "Cartera e inversión", href: "#inversion-cartera", aplica: "cartera", needs: [{ source: "valuation", everyDays: 35 }] },
    { id: "patrimonio", label: "Patrimonio neto", href: "#inversion-cartera", needs: [{ source: "close", everyDays: 30 }, { source: "valuation", everyDays: 35, soloSi: "cartera" }] },
    { id: "hipoteca", label: "Revisión de la hipoteca", href: "#deuda-contratos", aplica: "indices", needs: [{ source: "indices", everyDays: 30 }] },
  ]);

  const round1 = (value) => Math.round((Number(value) + Number.EPSILON) * 10) / 10;
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  function minutesOf(source, minutes = {}) {
    const given = minutes[source];
    if (given && Number.isFinite(Number(given.value)) && Number(given.value) > 0) return { value: Number(given.value), measured: given.measured === true };
    return { value: SOURCES[source].assumedSeconds / 60, measured: false };
  }

  /**
   * El coste semanal y el hambre de cada función, y el total.
   * @param {{freshness?: Record<string, {tone: string, status?: string, ageText?: string, action?: {label: string, href: string}|null}>,
   *   minutes?: Record<string, {value: number, measured: boolean}>, aplica?: Record<string, boolean>, budgetMinutes?: number}} [input]
   */
  function evaluate({ freshness = {}, minutes = {}, aplica = {}, budgetMinutes = BUDGET_MINUTES } = {}) {
    const functions = FUNCTIONS.filter((fn) => !fn.aplica || aplica[fn.aplica] === true).map((fn) => {
      const needs = fn.needs.filter((need) => !need.soloSi || aplica[need.soloSi] === true).map((need) => {
        const cost = minutesOf(need.source, minutes);
        const card = freshness[need.source] || null;
        const tone = card?.tone || "unknown";
        return {
          source: need.source, label: SOURCES[need.source].label, everyDays: need.everyDays,
          weeklyMinutes: round2((cost.value * 7) / need.everyDays), measured: cost.measured,
          tone, hungry: tone === "stale" || tone === "unknown", status: card?.status || "Sin dato", ageText: card?.ageText || "sin dato", action: card?.action || null,
        };
      });
      const weeklyMinutes = round1(needs.reduce((sum, need) => sum + need.weeklyMinutes, 0));
      const missing = needs.filter((need) => need.hungry);
      return { id: fn.id, label: fn.label, href: fn.href, needs, weeklyMinutes, measured: needs.every((need) => need.measured), hungry: missing.length > 0, missing };
    });
    // Cada fuente una vez, con la cadencia más exigente entre las funciones que la piden.
    const bySource = new Map();
    functions.forEach((fn) => fn.needs.forEach((need) => {
      const current = bySource.get(need.source);
      if (!current || need.everyDays < current.everyDays) bySource.set(need.source, need);
    }));
    const sources = [...bySource.values()].map((need) => ({ source: need.source, label: need.label, everyDays: need.everyDays, weeklyMinutes: need.weeklyMinutes, measured: need.measured, tone: need.tone, hungry: need.hungry }));
    const totalMinutes = round1(sources.reduce((sum, need) => sum + need.weeklyMinutes, 0));
    // Primero las que tienen hambre (lo que falta es lo que hay que ver), después por lo que cuestan.
    functions.sort((a, b) => Number(b.hungry) - Number(a.hungry) || b.weeklyMinutes - a.weeklyMinutes || a.label.localeCompare(b.label, "es"));
    return {
      schemaId: SCHEMA_ID, budgetMinutes, totalMinutes, overBudget: totalMinutes > budgetMinutes, measured: sources.length > 0 && sources.every((need) => need.measured),
      sources, functions, hungryCount: functions.filter((fn) => fn.hungry).length,
    };
  }

  /** Cada cuánto, dicho como se diría: «cada 4 días», «cada semana», «cada mes». */
  function everyText(days) {
    if (days === 7) return "cada semana";
    if (days === 14) return "cada dos semanas";
    if (days >= 28 && days <= 31) return "cada mes";
    return `cada ${days} días`;
  }

  /** «1,5 min» (una cifra decimal; «menos de 0,1 min» por debajo). */
  function minutesText(value) {
    if (value > 0 && value < 0.1) return "menos de 0,1 min";
    return `${String(round1(value)).replace(".", ",")} min`;
  }

  /** La frase del total: lo que la app pide a la semana frente al presupuesto. */
  function sentence(result) {
    const total = minutesText(result.totalMinutes);
    const base = `Lo que piden las funciones que usáis: unos ${total} a la semana${result.measured ? "" : " (con minutos supuestos donde aún no hay nada medido)"}, frente a un presupuesto de ${result.budgetMinutes} min.`;
    const hambre = result.hungryCount ? ` ${result.hungryCount === 1 ? "Una función tiene" : `${result.hungryCount} funciones tienen`} algún dato que falta o es antiguo.` : " Ninguna tiene hambre: todo lo que piden está al día.";
    return base + (result.overBudget ? " Se pasa del presupuesto." : "") + hambre;
  }

  return Object.freeze({ SCHEMA_ID, BUDGET_MINUTES, SOURCES, FUNCTIONS, evaluate, everyText, minutesText, sentence });
});
