(function attachCanonicalChargeDayViability(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalChargeDayViability = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalChargeDayViability() {
  "use strict";

  // WP-04 (ND-03 paso 0, BACKLOG_DEFINITIVO.md §5.1 y docs/ND03_VIABILIDAD.md): ¿se puede APRENDER el
  // día de cargo de cada partida a partir de los movimientos importados, o solo tiene sentido que el
  // hogar lo declare? Solo lectura: no cambia ninguna fecha de la previsión. Para cada partida de gasto
  // mira, en los meses con movimientos importados en los que la partida tenía importe, en qué día cayó
  // el movimiento que la casa (mismo emparejamiento que la previsión), y cuenta en cuántos de esos
  // meses cae en el mismo día ± 1. Devuelve recuentos y porcentajes, nunca importes.
  //
  // Criterios (del plan, sesión 296): «con histórico» = 3 meses o más con movimientos importados;
  // «fiable» = el mismo día ± 1 en el 80 % o más de esos meses. Un mes sin movimiento casado cuenta
  // como fallo: si el cargo no se encuentra, no se puede aprender.

  const MIN_MONTHS = 3;
  const RELIABLE_PCT = 80;
  const TOLERANCE_DAYS = 1;

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  // El día que más meses reúne a ± 1 día. Empate: el más temprano (más prudente para la caja).
  function dominantDay(days) {
    let best = { day: null, hits: 0 };
    for (const candidate of [...new Set(days)].sort((a, b) => a - b)) {
      const near = days.filter((day) => Math.abs(day - candidate) <= TOLERANCE_DAYS);
      if (near.length > best.hits) best = { day: median(near), hits: near.length };
    }
    return best;
  }

  /**
   * Una observación por partida y mes con movimientos importados.
   * @param {Array<{key: string, label?: string, month: string, amount?: number, day?: number|null, rule?: boolean}>} observations
   */
  function analyze(observations = []) {
    const bySeries = new Map();
    for (const item of observations) {
      if (!item || !item.key || !item.month) continue;
      const amount = Math.abs(Number(item.amount) || 0);
      if (!amount) continue;
      const series = bySeries.get(item.key) || { key: item.key, label: String(item.label || item.key), months: new Map(), amount: 0, rule: false };
      series.rule = series.rule || Boolean(item.rule);
      const previous = series.months.get(item.month);
      const day = Number.isInteger(item.day) && item.day >= 1 && item.day <= 31 ? item.day : null;
      // Dos filas de la misma partida en un mes cuentan como un solo mes; vale el día que se encontró.
      series.months.set(item.month, { day: previous?.day ?? day, amount: (previous?.amount || 0) + amount });
      bySeries.set(item.key, series);
    }

    const partidas = [...bySeries.values()].map((series) => {
      const months = [...series.months.values()];
      const monthly = months.reduce((sum, month) => sum + month.amount, 0) / months.length;
      const days = months.map((month) => month.day).filter((day) => day !== null);
      const base = { key: series.key, label: series.label, months: months.length, found: days.length, monthly };
      if (series.rule) return { ...base, status: "regla", day: null, pct: null };
      if (months.length < MIN_MONTHS) return { ...base, status: "insuficiente", day: null, pct: null };
      const dominant = dominantDay(days);
      const pct = Math.round((dominant.hits / months.length) * 100);
      return { ...base, status: pct >= RELIABLE_PCT ? "fiable" : "variable", day: dominant.day, pct };
    });

    const total = partidas.reduce((sum, partida) => sum + partida.monthly, 0);
    const share = (status) => (total ? Math.round((partidas.filter((partida) => status.includes(partida.status)).reduce((sum, partida) => sum + partida.monthly, 0) / total) * 100) : 0);
    const count = (status) => partidas.filter((partida) => partida.status === status).length;
    const withHistory = count("fiable") + count("variable");
    const summary = {
      partidas: partidas.length,
      withHistory,
      reliable: count("fiable"),
      variable: count("variable"),
      insufficient: count("insuficiente"),
      rule: count("regla"),
      reliableSpendPct: share(["fiable"]),
      knownSpendPct: share(["fiable", "regla"]),
      verdict: withHistory === 0 ? "insuficiente" : count("fiable") > 0 ? "sugerir" : "solo-declarado",
    };
    // Sin importes: la lista sale ordenada por peso, pero solo lleva el porcentaje del gasto de cada una.
    const list = partidas
      .sort((a, b) => b.monthly - a.monthly || a.label.localeCompare(b.label, "es"))
      .map(({ monthly, ...partida }) => ({ ...partida, spendPct: total ? Math.round((monthly / total) * 1000) / 10 : 0 }));
    return { summary, partidas: list, criteria: { minMonths: MIN_MONTHS, reliablePct: RELIABLE_PCT, toleranceDays: TOLERANCE_DAYS } };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  const STATUS_LABEL = { fiable: "Fiable", variable: "Variable", insuficiente: "Menos de 3 meses", regla: "Ya tiene regla" };

  function verdictText(summary) {
    if (summary.verdict === "insuficiente") {
      return `Aún no se puede aprender ningún día de cargo: ninguna partida tiene ${MIN_MONTHS} meses o más con movimientos importados. El día de cargo de cada partida se indica en Plan › Partidas; importar más extractos cambia esta lectura.`;
    }
    if (summary.verdict === "solo-declarado") {
      return `Ninguna partida cae en el mismo día (± ${TOLERANCE_DAYS}) en el ${RELIABLE_PCT} % de los meses: el día de cargo de cada partida se indica en Plan › Partidas.`;
    }
    return `${summary.reliable} partida${summary.reliable === 1 ? "" : "s"} (${summary.reliableSpendPct} % del gasto) caen en el mismo día (± ${TOLERANCE_DAYS}) en el ${RELIABLE_PCT} % de los meses o más: Plan › Partidas te propone su día; el resto lo indicas tú.`;
  }

  // HTML de la tarjeta de Ajustes: veredicto, cifras y las partidas con su estado. Sin importes.
  function renderHtml(result) {
    const { summary, partidas } = result;
    const rows = partidas.slice(0, 15).map((partida) => `<tr><td>${escapeHtml(partida.label)}</td><td>${escapeHtml(String(partida.spendPct).replace(".", ","))} %</td><td>${partida.found} de ${partida.months}</td><td>${escapeHtml(STATUS_LABEL[partida.status])}${partida.status === "fiable" || partida.status === "variable" ? ` · día ${partida.day} en el ${partida.pct} %` : ""}</td></tr>`).join("");
    const verdict = `<p class="e19-kpi-note"><strong>${escapeHtml(verdictText(summary))}</strong></p>`;
    // Sin ninguna partida con importe en meses importados, una línea de ceros parecería un dato: solo el veredicto.
    if (!summary.partidas) return verdict;
    return verdict
      + `<p class="e19-kpi-note">${summary.partidas} partidas de gasto · ${summary.withHistory} con ${MIN_MONTHS} meses o más · ${summary.reliable} fiables · ${summary.variable} variables · ${summary.rule} con regla propia. Con fecha conocida (fiable o regla): ${summary.knownSpendPct} % del gasto.</p>`
      + (rows
        ? `<div class="table-wrap"><table class="e19-table"><caption class="sr-only">Día de cargo por partida</caption><thead><tr><th scope="col">Partida</th><th scope="col">% del gasto</th><th scope="col">Meses con cargo encontrado</th><th scope="col">Estado</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : "");
  }

  return { MIN_MONTHS, RELIABLE_PCT, TOLERANCE_DAYS, analyze, dominantDay, verdictText, renderHtml };
});
