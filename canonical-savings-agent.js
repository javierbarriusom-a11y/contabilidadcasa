/**
 * canonical-savings-agent.js
 *
 * ARQ-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2, tercer incremento, sesión 237): núcleo de cálculo del
 * agente de ahorro, extraído de `buildSavingsAgentPlan()` (app.js). Es la regla que decide, mes a
 * mes, cuánto dinero pasa de CaixaBank (cuenta operativa) a Mediolanum (ahorro) y cuánto hay que
 * rescatar de vuelta:
 *
 *   - Reserva exigida en cada mes = colchón (`caixaFloor`) + pagos previstos del mes SIGUIENTE
 *     (`outflowsBeforeSaving` de la fila siguiente; en el último mes, solo el colchón).
 *   - Si la caja del mes queda por debajo de esa reserva, se rescata de Mediolanum lo que falte
 *     (nunca más de lo que haya); lo que no se pueda cubrir queda como `shortage`.
 *   - Si queda por encima, el exceso se traspasa a Mediolanum.
 *
 * Por qué aquí y no el resto del agente: esta regla es pura — solo depende de las filas de la
 * simulación, los saldos de partida y el colchón —, así que puede vivir en un `canonical-*.js` con
 * sus propios tests, que es el patrón ya decidido para lógica sin estado (T14/ARQ-4, sin
 * `import`/`export`). El optimizador de deuda del agente (`agentOptimalDebtPayoffPlan` y
 * compañía) NO es puro: vuelve a ejecutar la simulación completa del hogar (`simulate()`,
 * `debtTargetOptions()`...) para cada candidato, así que se queda en app.js; y la pantalla del
 * agente vive en `views/savings-agent.js`, con carga diferida.
 *
 * Contrato: mismo redondeo a céntimos que app.js (`round2` con `Number.EPSILON`) y la misma forma
 * de fila (`{...fila, agentIndex, operatingResult, requiredReserve, transferToSavings,
 * rescueFromSavings, shortage, agentCaixa, agentMediolanum, agentTotal}`) que ya leen Hoy, el
 * asesor virtual, el plan de deuda y el ejecutivo — cambiar la forma rompería a todos ellos.
 */

(function attachCanonicalSavingsAgent(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalSavingsAgent = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalSavingsAgentFactory() {
  "use strict";

  function round2(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  // Reserva que debe quedar en caja al cerrar el mes `index`: colchón + pagos del mes siguiente.
  function nextMonthReserve(sourceRows, index, caixaFloor) {
    const next = sourceRows[index + 1];
    if (!next) return caixaFloor;
    return round2(caixaFloor + Math.max(0, Number(next.outflowsBeforeSaving || 0)));
  }

  /**
   * Barrido mensual de caja: aplica la regla de traspaso/rescate a cada fila de la simulación.
   * `startBalances` = `{ caixa, mediolanum, total }` al empezar (los de `accountBalancesFromState`).
   * Devuelve las filas enriquecidas y los agregados; la deuda (patrimonio neto) la añade quien
   * llama, porque depende del estado de deuda de la app.
   *
   * @param {{ sourceRows?: any[], startBalances?: { caixa?: number, mediolanum?: number, total?: number }, caixaFloor?: number }} [options]
   */
  function sweepCashPlan({ sourceRows = [], startBalances = {}, caixaFloor = 0 } = {}) {
    const rowsIn = Array.isArray(sourceRows) ? sourceRows : [];
    /** @type {{ caixa?: number, mediolanum?: number, total?: number }} */
    const start = startBalances || {};
    let caixa = Number(start.caixa || 0);
    let mediolanum = Number(start.mediolanum || 0);
    let totalTransferred = 0;
    let totalRescued = 0;
    let shortage = 0;
    let projectSpend = 0;
    const rows = rowsIn.map((row, index) => {
      const result = round2(row.income - row.coreSpend - row.car - row.refi - row.projectOutflow);
      const beforeTransfer = round2(caixa + result);
      const requiredReserve = nextMonthReserve(rowsIn, index, caixaFloor);
      const rescue = beforeTransfer < requiredReserve ? round2(Math.min(mediolanum, requiredReserve - beforeTransfer)) : 0;
      const protectedCaixa = round2(beforeTransfer + rescue);
      const monthShortage = Math.max(0, round2(requiredReserve - protectedCaixa));
      const transfer = Math.max(0, round2(protectedCaixa - requiredReserve));
      caixa = round2(protectedCaixa - transfer);
      mediolanum = round2(mediolanum + transfer - rescue);
      totalTransferred = round2(totalTransferred + transfer);
      totalRescued = round2(totalRescued + rescue);
      shortage = round2(shortage + monthShortage);
      projectSpend = round2(projectSpend + Math.max(0, Number(row.projectOutflow || 0)));
      return {
        ...row,
        agentIndex: index,
        operatingResult: result,
        requiredReserve,
        transferToSavings: transfer,
        rescueFromSavings: rescue,
        shortage: monthShortage,
        agentCaixa: caixa,
        agentMediolanum: mediolanum,
        agentTotal: round2(caixa + mediolanum),
      };
    });
    const final = rows.at(-1) || {};
    return {
      rows,
      caixaFloor,
      totalTransferred,
      totalRescued,
      shortage,
      projectSpend,
      finalCaixa: round2(final.agentCaixa || start.caixa || 0),
      finalMediolanum: round2(final.agentMediolanum || start.mediolanum || 0),
      finalTotal: round2(final.agentTotal || start.total || 0),
      minCaixa: rows.length ? Math.min(...rows.map((row) => row.agentCaixa)) : start.caixa,
      minReserveCoverage: rows.length ? Math.min(...rows.map((row) => row.agentCaixa - row.requiredReserve)) : 0,
      maxSavings: rows.length ? Math.max(...rows.map((row) => row.agentMediolanum)) : start.mediolanum,
    };
  }

  return {
    round2,
    nextMonthReserve,
    sweepCashPlan,
  };
});
