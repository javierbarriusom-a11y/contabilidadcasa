(function attachCanonicalForecastBridge(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecastBridge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalForecastBridgeFactory() {
  "use strict";

  // WP-43 (PRV-01, docs/WP43_DISENO.md): el puente de previsión («forecast bridge»). En cada cierre se CONGELA la previsión de liquidez a 31/12; el cierre siguiente
  // se compara con ella y la diferencia se reparte en una cascada: ingresos, gasto recurrente, extraordinarios, deuda y «otros». Responde a «¿por qué cambió el fin
  // de año?» con cifras, no con una frase suelta.
  //   · freezeYearEnd: de la serie de previsión de ese momento y de lo REAL del mes cerrado saca una foto pequeña (los meses que quedan hasta diciembre, por componente).
  //   · bridge: dadas dos fotos del MISMO fin de año, cuánto de la diferencia es cada cosa, con una frase y un indicador de si el cambio es relevante.
  // Motor puro: ni DOM, ni red, ni almacenamiento. NUNCA modifica la previsión (A11-4): solo la explica.
  //
  // Reglas de honestidad:
  //   · la cascada SIEMPRE cuadra con la diferencia total: lo que no se sabe atribuir va a «Otros y supuestos», visible, nunca escondido ni repartido a ojo.
  //   · el desglose de lo ocurrido en el mes cerrado exige el real de ese mes; sin él, esa parte entera va a «Otros» y se dice.
  //   · dos fotos de distinto fin de año no se comparan (un cierre de diciembre apunta al 31/12 siguiente).
  //   · «mercado» (la cartera) NO está: la previsión de liquidez no proyecta la cartera. Se dice; no se inventa una barra a cero.

  const SCHEMA_ID = "finance-forecast-bridge/v1";
  const MAX_SNAPSHOTS = 36;
  const RELEVANT_PCT = 5; // un cambio del fin de año de al menos el 5 % del anterior se marca «relevante» (decisión mía; el plan lo mide sobre el ahorro anual).
  const MAIN_DRIVER_SHARE = 15; // una causa se nombra en la frase si pesa al menos el 15 % de lo que mueve en esa dirección.

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const isMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(text(value));

  /** @param {string} monthKey @param {number} months */
  function addMonths(monthKey, months) {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + months, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  /** El 31/12 al que apunta un cierre: el diciembre del año del mes siguiente (cerrar diciembre apunta al diciembre siguiente). */
  function targetYearFor(monthKey) {
    return Number(addMonths(monthKey, 1).slice(0, 4));
  }

  /**
   * Foto de la previsión a 31/12 en el momento de un cierre.
   * @param {{monthKey?: string, closedAt?: string, series?: Array<any>, actuals?: {income?: number|null, recurring?: number|null, debt?: number|null, partial?: boolean}|null}} [params]
   */
  function freezeYearEnd({ monthKey = "", closedAt = "", series = [], actuals = null } = {}) {
    if (!isMonth(monthKey)) return { calculable: false, reason: "Falta el mes que se cierra." };
    const year = targetYearFor(monthKey);
    const target = `${year}-12`;
    const rows = (Array.isArray(series) ? series : []).filter((row) => row && isMonth(row.monthKey));
    if (!rows.some((row) => row.monthKey === target)) return { calculable: false, reason: `La previsión no llega a diciembre de ${year}: no hay nada que congelar.` };
    const months = rows.filter((row) => row.monthKey > monthKey && row.monthKey <= target).map((row) => {
      const totals = row.totals || {};
      const out = (row.components && row.components.outflow) || {};
      const recurring = round2(out.recurrence);
      const extraordinary = round2(number(out.event) + number(out.project) + number(out.manualAdjustment));
      const debt = round2(out.debt);
      const income = round2(totals.income);
      const outflows = round2(totals.outflowsBeforeSaving);
      return {
        monthKey: row.monthKey, income, recurring, extraordinary, debt,
        other: round2(outflows - recurring - extraordinary - debt), // lo que el desglose del motor no clasifica; debería ser 0
        saving: round2(totals.saving), closingLiquidity: round2(totals.closingLiquidity),
      };
    });
    if (!months.length) return { calculable: false, reason: "No quedan meses por delante hasta diciembre." };
    const last = months[months.length - 1];
    const futureNet = round2(months.reduce((sum, month) => sum + month.income - month.recurring - month.extraordinary - month.debt - month.other, 0));
    const real = actuals && typeof actuals === "object" ? {
      income: known(actuals.income) ? round2(actuals.income) : null,
      recurring: known(actuals.recurring) ? round2(actuals.recurring) : null,
      debt: known(actuals.debt) ? round2(actuals.debt) : null,
      partial: actuals.partial === true,
    } : null;
    return {
      calculable: true,
      snapshot: {
        schemaId: SCHEMA_ID, monthKey, closedAt: text(closedAt), targetYear: year,
        yearEndLiquidity: last.closingLiquidity,
        impliedOpening: round2(last.closingLiquidity - futureNet), // la liquidez de la que parte esta previsión al cerrar el mes, según ella misma
        months, closedMonth: real,
      },
    };
  }

  /** Normaliza lo guardado: solo fotos bien formadas, la más reciente primero, una por mes. */
  function normalizeStore(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    return list.filter((s) => s && s.schemaId === SCHEMA_ID && isMonth(s.monthKey) && Array.isArray(s.months) && known(s.yearEndLiquidity))
      .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))
      .filter((s) => (seen.has(s.monthKey) ? false : (seen.add(s.monthKey), true)))
      .slice(0, MAX_SNAPSHOTS);
  }

  function upsert(store, snapshot) {
    return normalizeStore([snapshot, ...(Array.isArray(store) ? store.filter((s) => s && s.monthKey !== snapshot.monthKey) : [])]);
  }

  const ROW_META = [
    ["income", "Ingresos", "is-ingreso"],
    ["recurring", "Gasto recurrente", "is-gasto"],
    ["extraordinary", "Extraordinarios", "is-gasto"],
    ["debt", "Deuda y financiaciones", "is-gasto"],
    ["other", "Otros y supuestos", "is-ahorro"],
  ];

  /**
   * Cascada entre dos fotos del mismo fin de año.
   * @param {any} previous @param {any} current
   */
  function bridge(previous, current) {
    if (!previous || !current || !isMonth(previous.monthKey) || !isMonth(current.monthKey)) return { calculable: false, reason: "Faltan dos cierres con la previsión congelada." };
    if (previous.targetYear !== current.targetYear) return { calculable: false, reason: `Los dos cierres apuntan a fin de años distintos (${previous.targetYear} y ${current.targetYear}): no se pueden comparar.` };
    if (!(current.monthKey > previous.monthKey)) return { calculable: false, reason: "El cierre a comparar tiene que ser anterior al actual." };
    const delta = round2(current.yearEndLiquidity - previous.yearEndLiquidity);
    const sums = { income: 0, recurring: 0, extraordinary: 0, debt: 0, other: 0 };
    const prevByMonth = new Map(previous.months.map((month) => [month.monthKey, month]));
    // 1) Los meses que aún quedan: cuánto cambió la previsión de cada componente.
    current.months.forEach((month) => {
      const before = prevByMonth.get(month.monthKey);
      if (!before) return;
      sums.income += month.income - before.income;
      sums.recurring -= month.recurring - before.recurring;
      sums.extraordinary -= month.extraordinary - before.extraordinary;
      sums.debt -= month.debt - before.debt;
      sums.other -= month.other - before.other;
    });
    // 2) Lo ocurrido hasta este cierre frente a lo que la previsión anterior esperaba. Se desglosa solo con el real del mes cerrado.
    const planned = prevByMonth.get(current.monthKey);
    const openingGap = planned ? round2(current.impliedOpening - planned.closingLiquidity) : null;
    let explainedClosed = 0;
    const real = current.closedMonth;
    const breakdownPossible = Boolean(planned && real);
    if (breakdownPossible) {
      if (real.income !== null) { const v = real.income - planned.income; sums.income += v; explainedClosed += v; }
      if (real.recurring !== null) { const v = -(real.recurring - (planned.recurring + planned.extraordinary)); sums.recurring += v; explainedClosed += v; }
      if (real.debt !== null) { const v = -(real.debt - planned.debt); sums.debt += v; explainedClosed += v; }
    }
    const unexplainedClosed = openingGap === null ? 0 : openingGap - explainedClosed;
    sums.other += unexplainedClosed;
    // 3) La cascada cuadra SIEMPRE con la diferencia: el redondeo y lo que el modelo no atribuye van a «Otros».
    const rows = ROW_META.map(([id, label]) => ({ id, label, tone: "is-ahorro", value: round2(sums[id]) }));
    const drift = round2(delta - rows.reduce((sum, row) => sum + row.value, 0));
    if (drift !== 0) rows[rows.length - 1].value = round2(rows[rows.length - 1].value + drift);
    // El color de la barra sigue el EFECTO sobre el fin de año (a favor / en contra / sin efecto), no el tipo de partida: un ingreso que baja no es «verde».
    rows.forEach((row) => { row.tone = row.value > 0 ? "is-ingreso" : row.value < 0 ? "is-gasto" : "is-ahorro"; });
    const direction = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    const sameWay = rows.filter((row) => Math.sign(row.value) === direction && row.value !== 0);
    const sameWayTotal = sameWay.reduce((sum, row) => sum + Math.abs(row.value), 0);
    const drivers = sameWay.map((row) => ({ id: row.id, label: row.label, value: row.value, sharePct: sameWayTotal > 0 ? Math.round((Math.abs(row.value) / sameWayTotal) * 100) : 0 }))
      .sort((a, b) => b.sharePct - a.sharePct).filter((driver) => driver.sharePct >= MAIN_DRIVER_SHARE);
    const against = rows.filter((row) => direction !== 0 && Math.sign(row.value) === -direction && row.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const relativePct = Math.abs(previous.yearEndLiquidity) > 0 ? round2((Math.abs(delta) / Math.abs(previous.yearEndLiquidity)) * 100) : null;
    const otherRow = rows.find((row) => row.id === "other");
    return {
      calculable: true, schemaId: SCHEMA_ID,
      previousMonthKey: previous.monthKey, currentMonthKey: current.monthKey, targetYear: current.targetYear,
      previousYearEnd: previous.yearEndLiquidity, currentYearEnd: current.yearEndLiquidity, delta,
      direction: direction > 0 ? "improves" : direction < 0 ? "worsens" : "flat",
      rows, drivers, against, relativePct, relevant: relativePct === null ? Math.abs(delta) > 0 : relativePct >= RELEVANT_PCT,
      closedMonthBreakdown: breakdownPossible, openingGap,
      otherSharePct: sameWayTotal > 0 && otherRow && Math.sign(otherRow.value) === direction ? Math.round((Math.abs(otherRow.value) / sameWayTotal) * 100) : 0,
      notes: [
        ...(breakdownPossible ? [] : [`Sin el real del mes cerrado (${current.monthKey}) no puedo repartir lo ocurrido hasta el cierre: va entero a «Otros y supuestos».`]),
        ...(real && real.partial ? ["El real del mes cerrado es parcial: algunas partidas solo tienen lo previsto."] : []),
        ...(previous.monthKey !== addMonths(current.monthKey, -1) ? [`Entre ${previous.monthKey} y ${current.monthKey} hay cierres sin foto: lo ocurrido en los meses intermedios va a «Otros y supuestos».`] : []),
        "La cartera («mercado») no entra: la previsión de liquidez no la proyecta.",
      ],
    };
  }

  /**
   * La frase del puente: «Desde septiembre, el fin de 2026 empeora en 1.200 € (6 %): 70 % por extraordinarios, 30 % por ingresos; compensado en parte por +300 € de gasto recurrente».
   * @param {any} result @param {{labelOf?: (monthKey: string) => string, euros?: (value: number) => string}} [options]
   */
  function describe(result, { labelOf = (key) => key, euros = (value) => `${Math.round(Math.abs(value))} €` } = {}) {
    if (!result || !result.calculable) return text(result && result.reason);
    const since = labelOf(result.previousMonthKey);
    if (result.direction === "flat") return `Desde ${since}, el fin de ${result.targetYear} no cambia.`;
    const verb = result.direction === "improves" ? "mejora" : "empeora";
    const pct = result.relativePct === null ? "" : ` (${String(result.relativePct).replace(".", ",")} %)`;
    const named = result.drivers.map((driver) => `${driver.sharePct} % por ${driver.label.toLowerCase()}`);
    const restRows = result.rows.filter((row) => Math.sign(row.value) === (result.direction === "improves" ? 1 : -1) && !result.drivers.some((driver) => driver.id === row.id));
    const restShare = 100 - result.drivers.reduce((sum, driver) => sum + driver.sharePct, 0);
    const causes = [...named, ...(restRows.length && restShare > 0 ? [`${restShare} % entre ${restRows.map((row) => row.label.toLowerCase()).join(", ")}`] : [])].join(", ");
    const counter = result.against.length
      ? `; compensado en parte por ${result.against.map((row) => `${row.value > 0 ? "+" : "−"}${euros(Math.abs(row.value))} de ${row.label.toLowerCase()}`).join(" y ")}`
      : "";
    return `Desde ${since}, el fin de ${result.targetYear} ${verb} en ${euros(Math.abs(result.delta))}${pct}${causes ? `: ${causes}` : ""}${counter}.`;
  }

  return { SCHEMA_ID, MAX_SNAPSHOTS, describe, RELEVANT_PCT, MAIN_DRIVER_SHARE, ROW_META, addMonths, targetYearFor, freezeYearEnd, normalizeStore, upsert, bridge };
});
