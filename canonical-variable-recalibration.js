/**
 * canonical-variable-recalibration.js
 *
 * PRV-01 (novena auditoría, §3; 14/11/2026), primera parte: MEDIR el gasto variable de verdad, mes a mes, y compararlo con lo
 * previsto. No cambia la previsión (D-N11: sin previsión nueva hasta el 4/12; el recálculo espera a D-N12). Deja hecha la
 * proyección hasta 2036 para cuando el hogar la apruebe.
 *
 * Por qué hace falta: desde junio de 2026 el «Gasto variable estimado» del plan es una cifra fija puesta a mano por migración
 * (`variable-operational-1750-from-2026-06-v2`), sin estacionalidad, sin gastos irregulares y sin contrastarla con lo real. Nadie
 * sabe si se queda corta o larga.
 *
 * Método (sin depender de la clasificación, que va por el 71 %):
 *   · gasto variable de un mes = salidas de las cuentas − fijos (partida de «Gastos fijos» o tipo «gasto fijo») − cuotas
 *     (partida de «Financiaciones» o tipo «pago de deuda») − traspasos (tipo «transferencia interna» o «aportación a ahorro», o la
 *     salida emparejada con una entrada del mismo importe en otra cuenta propia ±2 días) − liquidaciones de tarjeta − recurrentes
 *     sin partida (el mismo concepto en 3 o más meses con importe parecido: se parecen a un fijo y se listan para confirmarlos)
 *     − extraordinarios (un movimiento suelto que pesa más del 40 % de un mes típico, de más de 500 €, y no se repite);
 *   · las tarjetas: si se pagan ENTERAS cada mes, lo que la liquidación tiene de compras (liquidación − suscripciones del mes)
 *     vuelve al variable; si se pagan APLAZADAS, la liquidación es una cuota y las compras no se ven en la cuenta (se dice);
 *   · base: media recortada (sin el 10 % de cada extremo) de los últimos 12 meses completos; hacen falta 6;
 *   · estacionalidad por mes del año, contraída hacia 1 porque hay pocos años: s' = 1 + w·(s − 1), w = n/(n + 2);
 *   · prueba contra el pasado con origen móvil: cada mes se predice con los anteriores y se compara con lo real; lo mismo con lo
 *     que estaba previsto. Así se ve cuál se equivoca menos.
 *
 * Motor puro: sin DOM, red ni almacenamiento. No escribe nada (A11-4).
 */
(function attachCanonicalVariableRecalibration(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalVariableRecalibration = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalVariableRecalibrationFactory() {
  "use strict";

  const SCHEMA_ID = "finance-variable-recalibration/v1";
  const DEFAULTS = Object.freeze({
    windowMonths: 12,
    minMonths: 6,
    trimShare: 0.1,
    transferDays: 2,
    recurringMinMonths: 3,
    recurringTolerance: 0.1,
    extraordinaryShare: 0.4,
    extraordinaryMin: 500,
    cardMode: "total",
    endMonthKey: "2036-12",
  });
  const FIXED_TYPES = new Set(["gasto_fijo"]);
  const DEBT_TYPES = new Set(["pago_deuda"]);
  const TRANSFER_TYPES = new Set(["transferencia_interna", "aportacion_ahorro"]);

  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const monthOk = (key) => typeof key === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
  const monthOf = (iso) => String(iso || "").slice(0, 7);
  const dayIndex = (iso) => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);

  function addMonths(key, offset) {
    const [year, month] = key.split("-").map(Number);
    const index = year * 12 + (month - 1) + offset;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  }

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /** Media recortada: quita `share` de cada extremo (redondeando hacia abajo). */
  function trimmedMean(values, share = DEFAULTS.trimShare) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const cut = Math.floor(sorted.length * share);
    const kept = sorted.slice(cut, sorted.length - cut);
    return kept.reduce((sum, value) => sum + value, 0) / kept.length;
  }

  /** Empareja salidas y entradas del mismo importe en cuentas distintas a ±`days` días: traspasos entre cuentas propias. */
  function pairTransfers(movements, days = DEFAULTS.transferDays) {
    const paired = new Set();
    const ins = movements.map((row, index) => ({ row, index })).filter(({ row }) => row.amount > 0 && row.account);
    movements.forEach((row, index) => {
      if (!(row.amount < 0) || !row.account || paired.has(index)) return;
      const match = ins.find(({ row: other, index: j }) => !paired.has(j)
        && other.account !== row.account
        && Math.abs(other.amount + row.amount) < 0.005
        && Math.abs(dayIndex(other.date) - dayIndex(row.date)) <= days);
      if (match) {
        paired.add(index);
        paired.add(match.index);
      }
    });
    return paired;
  }

  /** Conceptos que se repiten en ≥ 3 meses con importe parecido (±10 % de su mediana) y sin partida: se parecen a un fijo. */
  function recurringUnclassified(candidates, months, options) {
    const byKey = new Map();
    candidates.forEach((row) => {
      if (row.block || !row.conceptKey) return;
      const list = byKey.get(row.conceptKey) || [];
      list.push(row);
      byKey.set(row.conceptKey, list);
    });
    const keys = new Set();
    byKey.forEach((list, key) => {
      const monthsSeen = new Set(list.map((row) => monthOf(row.date)).filter((month) => months.includes(month)));
      if (monthsSeen.size < options.recurringMinMonths) return;
      const amounts = list.map((row) => -row.amount);
      const mid = median(amounts);
      if (mid > 0 && amounts.every((amount) => Math.abs(amount - mid) <= mid * options.recurringTolerance)) keys.add(key);
    });
    return keys;
  }

  /**
   * El gasto variable de cada mes completo.
   * @param {Array<Record<string, any>>} movements {date, amount (negativo = salida), account, conceptKey, label, block ('fijo'|'variable'|'financiacion'|'ingreso'|null), actionType, cardSettlement}
   * @param {Record<string, any>} options {completeMonths: string[], subscriptionsByMonth?: Record<string, number>, cardMode?: 'total'|'aplazado', ...}
   */
  function measure(movements, options = {}) {
    const opts = /** @type {Record<string, any>} */ ({ ...DEFAULTS, ...options });
    const months = (Array.isArray(opts.completeMonths) ? opts.completeMonths : []).filter(monthOk).sort();
    const list = (Array.isArray(movements) ? movements : [])
      .filter((row) => row && /^\d{4}-\d{2}-\d{2}/.test(String(row.date || "")) && Number.isFinite(Number(row.amount)))
      .map((row) => /** @type {Record<string, any>} */ ({ ...row, date: String(row.date).slice(0, 10), amount: Number(row.amount) }));
    const paired = pairTransfers(list, opts.transferDays);
    const outflows = list.map((row, index) => ({ row, index })).filter(({ row }) => row.amount < 0 && months.includes(monthOf(row.date)));
    const transfer = ({ row, index }) => paired.has(index) || TRANSFER_TYPES.has(row.actionType);
    const fixed = ({ row }) => row.block === "fijo" || FIXED_TYPES.has(row.actionType);
    const debt = ({ row }) => row.block === "financiacion" || DEBT_TYPES.has(row.actionType);
    const card = ({ row }) => row.cardSettlement === true;
    const rest = outflows.filter((item) => !transfer(item) && !fixed(item) && !debt(item) && !card(item));
    const recurringKeys = recurringUnclassified(rest.map((item) => item.row), months, opts);

    const perMonth = months.map((month) => {
      const inMonth = (item) => monthOf(item.row.date) === month;
      const sum = (items) => round2(items.reduce((total, item) => total + -item.row.amount, 0));
      const all = outflows.filter(inMonth);
      const cards = all.filter((item) => card(item) && !transfer(item));
      const settlement = sum(cards);
      const subscriptions = round2(Math.max(0, Number(opts.subscriptionsByMonth?.[month]) || 0));
      const cardPurchases = opts.cardMode === "total" ? round2(Math.max(0, settlement - subscriptions)) : 0;
      const candidates = rest.filter(inMonth);
      const recurring = candidates.filter((item) => recurringKeys.has(item.row.conceptKey));
      const variableRows = candidates.filter((item) => !recurringKeys.has(item.row.conceptKey));
      return { month, all, cards, settlement, subscriptions, cardPurchases, recurring, variableRows, sum };
    });

    // Extraordinarios: un movimiento suelto que pesa más de un 40 % del variable típico de un mes (y más de 500 €) y cuyo concepto
    // no aparece en ningún otro mes. Se quitan de la base y se listan.
    const typical = median(perMonth.map((month) => month.sum(month.variableRows) + month.cardPurchases).filter((value) => value > 0));
    const conceptMonths = new Map();
    perMonth.forEach((month) => month.variableRows.forEach((item) => {
      const set = conceptMonths.get(item.row.conceptKey) || new Set();
      set.add(month.month);
      conceptMonths.set(item.row.conceptKey, set);
    }));
    const threshold = Math.max(opts.extraordinaryMin, typical * opts.extraordinaryShare);
    const extraordinary = [];
    // Qué pesa en el variable (14/11/2026: la primera medición del hogar salió muy alta y hay que ver qué la infla): por concepto y
    // mes, lo que queda en el variable; las compras con tarjeta, como una línea más.
    const concepts = new Map();
    const addConcept = (key, label, unclassified, month, amount) => {
      const entry = concepts.get(key) || { conceptKey: key, label, unclassified, byMonth: {} };
      entry.byMonth[month] = round2((entry.byMonth[month] || 0) + amount);
      concepts.set(key, entry);
    };
    const rows = perMonth.map((month) => {
      const normal = [];
      month.variableRows.forEach((item) => {
        const once = !item.row.conceptKey || (conceptMonths.get(item.row.conceptKey)?.size || 0) <= 1;
        if (once && -item.row.amount > threshold) extraordinary.push({ month: month.month, date: item.row.date, label: item.row.label || item.row.conceptKey || "", amount: round2(-item.row.amount) });
        else {
          normal.push(item);
          addConcept(item.row.conceptKey || item.row.label || "?", item.row.label || item.row.conceptKey || "", !item.row.block, month.month, -item.row.amount);
        }
      });
      if (month.cardPurchases > 0) addConcept("__tarjetas__", "Liquidaciones de tarjeta (sin suscripciones)", false, month.month, month.cardPurchases);
      const variable = round2(month.sum(normal) + month.cardPurchases);
      return {
        month: month.month,
        outflows: month.sum(month.all),
        transfers: month.sum(month.all.filter(transfer)),
        // Una liquidación de tarjeta con partida de Financiaciones («Financie-octubre») es tarjeta, no cuota: no cuenta aquí.
        fixed: month.sum(month.all.filter((item) => !transfer(item) && !card(item) && fixed(item))),
        debt: month.sum(month.all.filter((item) => !transfer(item) && !card(item) && !fixed(item) && debt(item))),
        cardSettlement: month.settlement,
        cardSubscriptions: month.subscriptions,
        cardPurchases: month.cardPurchases,
        recurringUnclassified: month.sum(month.recurring),
        extraordinary: round2(month.sum(month.variableRows) - month.sum(normal)),
        variable,
      };
    });
    const recurringList = [...recurringKeys].map((key) => {
      const items = rest.filter((item) => item.row.conceptKey === key).map((item) => item.row);
      return { conceptKey: key, label: items[0]?.label || key, months: new Set(items.map((row) => monthOf(row.date))).size, typical: round2(median(items.map((row) => -row.amount))) };
    }).sort((a, b) => b.typical - a.typical);
    return { rows, extraordinary, recurring: recurringList, pairedTransfers: paired.size / 2, threshold: round2(threshold), concepts: [...concepts.values()] };
  }

  /** Índices por mes del año (1…12), contraídos hacia 1 según cuántos años hay de ese mes, y normalizados a media 1. */
  function seasonality(rows) {
    const values = rows.map((row) => row.variable);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const index = Array.from({ length: 12 }, () => 1);
    if (!(mean > 0)) return index;
    for (let m = 1; m <= 12; m += 1) {
      const same = rows.filter((row) => Number(row.month.slice(5, 7)) === m).map((row) => row.variable);
      if (!same.length) continue;
      const raw = same.reduce((sum, value) => sum + value, 0) / same.length / mean;
      const weight = same.length / (same.length + 2);
      index[m - 1] = 1 + weight * (raw - 1);
    }
    const avg = index.reduce((sum, value) => sum + value, 0) / 12;
    return index.map((value) => Math.round((value / avg) * 1000) / 1000);
  }

  function errorStats(pairs) {
    const usable = pairs.filter((pair) => pair.actual > 0 && Number.isFinite(pair.predicted));
    if (!usable.length) return { n: 0, mape: null, bias: null };
    const pct = usable.map((pair) => (pair.predicted - pair.actual) / pair.actual);
    return {
      n: usable.length,
      mape: Math.round((pct.reduce((sum, value) => sum + Math.abs(value), 0) / usable.length) * 1000) / 10,
      bias: Math.round((pct.reduce((sum, value) => sum + value, 0) / usable.length) * 1000) / 10,
    };
  }

  /**
   * Medición completa: meses, base, estacionalidad, prueba contra el pasado (método y lo previsto) y proyección hasta 2036.
   * @param {Array<Record<string, any>>} movements ver `measure`
   * @param {Record<string, any>} options los de `measure` + {plannedByMonth?: Record<string, number>, startMonthKey?: string}
   */
  function recalibrate(movements, options = {}) {
    const opts = /** @type {Record<string, any>} */ ({ ...DEFAULTS, ...options });
    const measured = measure(movements, opts);
    const rows = measured.rows;
    const gate = { ok: rows.length >= opts.minMonths, months: rows.length, minMonths: opts.minMonths };
    const recent = rows.slice(-opts.windowMonths);
    const base = recent.length ? round2(trimmedMean(recent.map((row) => row.variable), opts.trimShare)) : null;
    const seasonal = seasonality(recent);
    const cardNote = opts.cardMode === "aplazado"
      ? "Con la tarjeta aplazada, su liquidación es una cuota: las compras con tarjeta no se ven en la cuenta. Hace falta el extracto de la tarjeta para contarlas."
      : "Tarjetas pagadas enteras cada mes: lo que su liquidación tiene de compras (sin las suscripciones) cuenta como gasto variable.";

    // Prueba contra el pasado: cada mes k (desde el `minMonths`-ésimo) con los anteriores (como mucho `windowMonths`).
    const methodPairs = [];
    const plannedPairs = [];
    for (let k = opts.minMonths; k < rows.length; k += 1) {
      const train = rows.slice(Math.max(0, k - opts.windowMonths), k);
      const trainBase = trimmedMean(train.map((row) => row.variable), opts.trimShare);
      const s = seasonality(train)[Number(rows[k].month.slice(5, 7)) - 1];
      methodPairs.push({ month: rows[k].month, predicted: trainBase * s, actual: rows[k].variable });
    }
    rows.forEach((row) => {
      const planned = Number(opts.plannedByMonth?.[row.month]);
      if (Number.isFinite(planned)) plannedPairs.push({ month: row.month, predicted: planned, actual: row.variable });
    });
    const backtest = { method: errorStats(methodPairs), planned: errorStats(plannedPairs) };

    const plannedRecent = recent.map((row) => Number(opts.plannedByMonth?.[row.month])).filter(Number.isFinite);
    const plannedAverage = plannedRecent.length ? round2(plannedRecent.reduce((sum, value) => sum + value, 0) / plannedRecent.length) : null;

    // Proyección (en euros de hoy: la inflación la pone el motor de la previsión, no aquí, para no contarla dos veces).
    const projection = [];
    if (gate.ok && monthOk(opts.startMonthKey) && monthOk(opts.endMonthKey)) {
      for (let key = opts.startMonthKey; key <= opts.endMonthKey; key = addMonths(key, 1)) {
        projection.push({ month: key, variable: round2(base * seasonal[Number(key.slice(5, 7)) - 1]) });
      }
    }

    return {
      ok: true,
      schemaId: SCHEMA_ID,
      cardMode: opts.cardMode === "aplazado" ? "aplazado" : "total",
      cardNote,
      gate,
      rows,
      base,
      plannedAverage,
      gap: base !== null && plannedAverage !== null ? round2(base - plannedAverage) : null,
      seasonal,
      backtest,
      extraordinary: measured.extraordinary,
      // Los 10 conceptos que más pesan en el variable de los meses de la base, con su media al mes y en cuántos aparecen.
      topConcepts: measured.concepts.map((entry) => {
        const months = recent.map((row) => row.month).filter((month) => entry.byMonth[month]);
        const total = round2(months.reduce((sum, month) => sum + entry.byMonth[month], 0));
        return { conceptKey: entry.conceptKey, label: entry.label, card: entry.conceptKey === "__tarjetas__", unclassified: entry.unclassified, total, perMonth: recent.length ? round2(total / recent.length) : 0, months: months.length };
      }).filter((entry) => entry.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
      recurring: measured.recurring,
      pairedTransfers: measured.pairedTransfers,
      extraordinaryThreshold: measured.threshold,
      projection,
    };
  }

  /** Meses completos: los que van del segundo mes con movimientos al anterior al actual (el primero y el actual suelen estar a medias). */
  function completeMonthsFrom(movements, todayIso) {
    const current = monthOf(todayIso);
    const seen = [...new Set((Array.isArray(movements) ? movements : []).map((row) => monthOf(row?.date)).filter(monthOk))].sort();
    if (seen.length < 2) return [];
    const out = [];
    for (let key = addMonths(seen[0], 1); key < current && key <= seen[seen.length - 1]; key = addMonths(key, 1)) {
      if (seen.includes(key)) out.push(key);
    }
    return out;
  }

  return { SCHEMA_ID, DEFAULTS, measure, recalibrate, seasonality, trimmedMean, pairTransfers, completeMonthsFrom, addMonths };
});
