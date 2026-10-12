(function attachCanonicalMonthLetter(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalMonthLetter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalMonthLetterFactory() {
  "use strict";

  // WP-29 (NHG-05, docs/WP29_DISENO.md): la carta del mes. Un párrafo llano de ≤ 120 palabras con cinco huecos —resultado frente a previsión, mayor desviación, un hito,
  // una acción sugerida y la calidad del dato— compuesto con plantillas y selectores. SIN IA generativa: la misma entrada da siempre el mismo texto, y cada cifra del texto
  // sale de la entrada (nada se inventa, nada se redondea a un valor que no sea el de la entrada). Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj.
  //
  // Reglas de honestidad:
  //   · el hueco de calidad del dato NUNCA se omite (si falta, la carta no se escribe): una carta sin decir cuánto del mes es real engaña;
  //   · un hueco sin dato (sin hito, sin acción, sin desviación relevante) se omite o dice que no hay: no se rellena con una frase de adorno;
  //   · «desviación» es atribución dentro de los datos (qué partida y cuánto de la diferencia explica), no una causa: el motor no sabe POR QUÉ se gastó más;
  //   · si hay que recortar para caber en 120 palabras, se sacrifica primero el hito, luego la acción, luego el detalle de la desviación; el resultado y la calidad se quedan.

  const SCHEMA_ID = "finance-month-letter/v1";
  const MAX_WORDS = 120;
  const MAX_LETTERS = 36;
  const TOLERANCE_EUR = 1; // por debajo de 1 € de diferencia, «tal como se preveía»
  const MATERIAL_ABS_EUR = 25; // una partida solo es «la mayor desviación» si se aparta al menos 25 €…
  const MATERIAL_REL = 0.05; // …y al menos el 5 % de lo previsto en ella
  const STREAK_MIN = 3; // tres cierres seguidos igual o mejor que lo previsto
  const DEBT_DROP_MIN_EUR = 50;
  const LOW_REAL_SHARE_PCT = 70;
  const LABEL_MAX = 40;

  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const text = (value) => String(value ?? "").trim();
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const num = (value, fallback = 0) => (known(value) ? Number(value) : fallback);
  const round2 = (value) => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const isMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(text(value));

  function monthName(monthKey) {
    return isMonth(monthKey) ? MONTHS[Number(monthKey.slice(5, 7)) - 1] : "el mes";
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  /** @param {string} monthKey @param {number} months */
  function addMonths(monthKey, months) {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 + months, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  /** Euros enteros, a la española (punto de miles) y con espacio duro antes del «€»: «1.250 €». Siempre en positivo: el signo se dice con palabras. */
  function euros(value) {
    const rounded = Math.round(Math.abs(num(value)));
    return `${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;
  }

  function countWords(value) {
    return text(value).split(/\s+/).filter(Boolean).length;
  }

  function clip(label) {
    const clean = text(label).replace(/\s+/g, " ");
    return clean.length > LABEL_MAX ? `${clean.slice(0, LABEL_MAX - 1).trimEnd()}…` : clean;
  }

  function plural(count, one, many) {
    return count === 1 ? one : many;
  }

  /**
   * Las partidas del mes con la forma que entiende el motor. `used` es lo que cuenta (el real si lo hay, si no lo previsto); `settled` dice si ese número es real.
   * @param {Array<any>} raw
   * @returns {Array<{id: string, label: string, section: string, kind: "income"|"expense", planned: number, used: number, settled: boolean}>}
   */
  function normalizeItems(raw) {
    return (Array.isArray(raw) ? raw : [])
      .filter((item) => item && (item.kind === "income" || item.kind === "expense") && known(item.planned) && known(item.used))
      .map((item) => ({ id: text(item.id), label: text(item.label) || "Sin nombre", section: text(item.section), kind: item.kind, planned: round2(item.planned), used: round2(item.used), settled: Boolean(item.settled) }));
  }

  /** Efecto de la partida en el resultado del mes: positivo = a favor (más ingreso o menos gasto de lo previsto). */
  function impact(item) {
    return round2(item.kind === "income" ? item.used - item.planned : item.planned - item.used);
  }

  function isMaterial(item) {
    if (!item.settled) return false;
    const gap = Math.abs(item.used - item.planned);
    return gap >= MATERIAL_ABS_EUR && (Math.abs(item.planned) < 0.005 || gap >= MATERIAL_REL * Math.abs(item.planned));
  }

  /** El resultado del mes y cuánto de él es real. Sin partidas con importe, `total` es 0 y no hay carta. */
  function summarize(rawItems) {
    const items = normalizeItems(rawItems).filter((item) => Math.abs(item.planned) >= 0.005 || Math.abs(item.used) >= 0.005);
    const sum = (list, field) => round2(list.reduce((total, item) => total + item[field], 0));
    const income = items.filter((item) => item.kind === "income");
    const expense = items.filter((item) => item.kind === "expense");
    const plannedNet = round2(sum(income, "planned") - sum(expense, "planned"));
    const realNet = round2(sum(income, "used") - sum(expense, "used"));
    const weight = (list) => list.reduce((total, item) => total + Math.abs(item.used), 0);
    const settledWeight = weight(items.filter((item) => item.settled));
    const allWeight = weight(items);
    const unsettled = items.filter((item) => !item.settled);
    return {
      items,
      total: items.length,
      withReal: items.length - unsettled.length,
      realSharePct: allWeight > 0 ? Math.round((settledWeight / allWeight) * 100) : null,
      plannedNet,
      realNet,
      diffNet: round2(realNet - plannedNet),
      unsettledCount: unsettled.length,
      unsettledPlanned: round2(unsettled.reduce((total, item) => total + Math.abs(item.planned), 0)),
    };
  }

  /** Las partidas que se desviaron EN CONTRA de forma relevante, por identificador: para saber si la misma partida lo hizo también el mes anterior. */
  function adverseIds(rawItems) {
    const out = {};
    normalizeItems(rawItems).forEach((item) => { if (isMaterial(item) && impact(item) < 0 && item.id) out[item.id] = true; });
    return out;
  }

  /** La partida con más efecto en el resultado (a favor o en contra), si se aparta de forma relevante. Empates por nombre, para que no dependa del orden. */
  function pickDeviation(summary) {
    const candidates = summary.items.filter(isMaterial).map((item) => ({ item, impact: impact(item) }));
    if (!candidates.length) return null;
    candidates.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact) || a.item.label.localeCompare(b.item.label, "es") || a.item.id.localeCompare(b.item.id));
    const top = candidates[0];
    // Solo es «una parte de la diferencia» si va en el mismo sentido y no la supera: si la partida explica más que el total, otra la compensa y un porcentaje sería engañoso.
    const sameDirection = Math.abs(summary.diffNet) >= TOLERANCE_EUR && Math.sign(summary.diffNet) === Math.sign(top.impact) && Math.abs(top.impact) <= Math.abs(summary.diffNet) + 0.005;
    const sharePct = sameDirection ? Math.min(100, Math.round((Math.abs(top.impact) / Math.abs(summary.diffNet)) * 100)) : null;
    return { item: top.item, impact: top.impact, adverse: top.impact < 0, sharePct };
  }

  function resultSentence(summary, monthKey) {
    const name = capitalize(monthName(monthKey));
    // Sin ningún real, «real» y «previsto» son el mismo número: decir «cierra con X, tal como se preveía» sería una tautología presentada como un resultado.
    if (summary.withReal === 0) {
      return `${name} no tiene ningún real anotado: el ${summary.plannedNet < 0 ? "déficit" : "margen"} que sale, ${euros(summary.plannedNet)}, es solo el previsto.`;
    }
    const magnitude = Math.round(Math.abs(summary.realNet));
    const base = magnitude === 0 ? `${name} cierra sin margen ni déficit` : `${name} cierra con ${euros(summary.realNet)} ${summary.realNet > 0 ? "de margen" : "de déficit"}`;
    let compare;
    if (Math.abs(summary.diffNet) < TOLERANCE_EUR) compare = "tal como se preveía";
    else compare = `${euros(summary.diffNet)} ${summary.diffNet > 0 ? "mejor" : "peor"} de lo previsto`;
    return `${base}, ${compare}.`;
  }

  function deviationSentences(deviation, summary) {
    if (!deviation) {
      return summary.withReal > 0
        ? { full: "Ninguna partida se aparta de lo previsto de forma relevante.", short: "Ninguna partida se aparta de forma relevante." }
        : null;
    }
    const { item } = deviation;
    const label = clip(item.label);
    const where = item.section ? ` (${clip(item.section)})` : "";
    const thing = item.kind === "income" ? "ingreso" : "gasto";
    const figures = `${euros(item.used)} frente a ${euros(item.planned)} previstos`;
    const share = deviation.sharePct === null ? "" : deviation.sharePct === 100 ? ", toda la diferencia" : `, el ${deviation.sharePct} % de la diferencia`;
    return {
      full: `La mayor desviación está en ${label}${where}: ${thing} de ${figures}${share}.`,
      short: `${label}: ${euros(item.used)} frente a ${euros(item.planned)} previstos.`,
    };
  }

  /** Cierres seguidos (mes a mes, sin huecos) igual o mejor que lo previsto, contando el actual. `previous`: cartas ya guardadas. */
  function streakLength(previous, monthKey, diffNet) {
    if (diffNet < -TOLERANCE_EUR) return 0;
    const byMonth = new Map((Array.isArray(previous) ? previous : []).filter((letter) => letter && isMonth(letter.monthKey) && known(letter.diffNet)).map((letter) => [letter.monthKey, letter]));
    let count = 1;
    let key = addMonths(monthKey, -1);
    while (byMonth.has(key) && Number(byMonth.get(key).diffNet) >= -TOLERANCE_EUR) {
      count += 1;
      key = addMonths(key, -1);
    }
    return count;
  }

  /**
   * Un hito, o nada. En este orden: racha, máximo del patrimonio, deuda que baja, patrimonio que sube. Que el patrimonio baje NO es un hito y no se cuenta aquí (lo enseña su tarjeta).
   * @param {{netWorth?: {previousMonthKey?: string, net?: number, delta?: number, debtDelta?: number, isMax?: boolean, seriesCount?: number}|null}} facts
   */
  function pickMilestone(facts, summary, monthKey, previousLetters) {
    const streak = streakLength(previousLetters, monthKey, summary.diffNet);
    if (streak >= STREAK_MIN) return { id: "racha", text: `Son ${streak} cierres seguidos igual o mejor que lo previsto.` };
    const worth = facts && facts.netWorth;
    if (!worth || !isMonth(worth.previousMonthKey) || !known(worth.net)) return null;
    const since = `desde el cierre de ${monthName(worth.previousMonthKey)}`;
    if (worth.isMax && num(worth.seriesCount) >= 3) return { id: "patrimonio-maximo", text: `El patrimonio neto llega a ${euros(worth.net)}, su máximo desde que se registra.` };
    if (known(worth.debtDelta) && Number(worth.debtDelta) >= DEBT_DROP_MIN_EUR) return { id: "deuda-baja", text: `La deuda pendiente baja ${euros(worth.debtDelta)} ${since}.` };
    if (known(worth.delta) && Number(worth.delta) >= TOLERANCE_EUR) return { id: "patrimonio-sube", text: `El patrimonio neto sube ${euros(worth.delta)} ${since}.` };
    return null;
  }

  /** Una acción, o nada. En este orden: la misma partida en contra dos cierres seguidos, partidas sin real, déficit. */
  function pickAction(summary, deviation, previousAdverse) {
    if (deviation && deviation.adverse && deviation.item.id && previousAdverse && previousAdverse[deviation.item.id]) {
      return { id: "revisar-previsto", text: `Revisa el previsto de ${clip(deviation.item.label)}: se ha desviado en contra dos cierres seguidos.` };
    }
    if (summary.unsettledCount > 0) {
      const n = summary.unsettledCount;
      return { id: "sin-real", text: `${plural(n, "Quedó", "Quedaron")} ${n} ${plural(n, "partida", "partidas")} sin real (${euros(summary.unsettledPlanned)} previstos): anótalas o cancélalas para que el próximo cierre sea más fiable.` };
    }
    if (summary.realNet < -TOLERANCE_EUR) return { id: "deficit", text: "El mes cierra en déficit: revisa en Plan qué partidas se pueden ajustar antes del próximo cierre." };
    return null;
  }

  function qualitySentences(summary) {
    const share = summary.realSharePct !== null ? ` (el ${summary.realSharePct} % del importe)` : "";
    const caution = summary.realSharePct !== null && summary.realSharePct < LOW_REAL_SHARE_PCT ? " Tómala con cautela." : "";
    const full = summary.withReal === summary.total
      ? `Se basa en las ${summary.total} ${plural(summary.total, "partida", "partidas")}, todas con real.`
      : `Se basa en ${summary.withReal} de ${summary.total} partidas con real${share}; el resto cuenta como previsto.${caution}`;
    return { full, short: `Se basa en ${summary.withReal} de ${summary.total} partidas con real.${caution}` };
  }

  /**
   * Compone la carta.
   * @param {{monthKey?: string, items?: Array<any>, netWorth?: any, previousLetters?: Array<any>, previousAdverse?: Record<string, boolean>}} facts
   * @param {{maxWords?: number}} [options]
   */
  function compose(facts = {}, options = {}) {
    const maxWords = Number.isFinite(options.maxWords) && options.maxWords > 0 ? options.maxWords : MAX_WORDS;
    const monthKey = text(facts.monthKey);
    if (!isMonth(monthKey)) return { calculable: false, reason: "Falta el mes de la carta." };
    const summary = summarize(facts.items);
    if (!summary.total) return { calculable: false, reason: "El mes no tiene partidas con importe: no hay nada que contar." };
    const deviation = pickDeviation(summary);
    const deviationText = deviationSentences(deviation, summary);
    const milestone = pickMilestone(facts, summary, monthKey, facts.previousLetters);
    const action = pickAction(summary, deviation, facts.previousAdverse);
    const quality = qualitySentences(summary);

    // Cada hueco con su texto largo y, si lo tiene, uno corto. Se recorta por prioridad hasta caber; el resultado y la calidad no desaparecen.
    const slots = [
      { id: "result", text: resultSentence(summary, monthKey) },
      deviationText ? { id: "deviation", text: deviationText.full, short: deviationText.short } : null,
      milestone ? { id: "milestone", text: milestone.text, kind: milestone.id } : null,
      action ? { id: "action", text: action.text, kind: action.id } : null,
      { id: "quality", text: quality.full, short: quality.short },
    ].filter(Boolean);
    const omitted = [];
    const total = () => countWords(slots.map((slot) => slot.text).join(" "));
    const reductions = [
      () => dropSlot("milestone"),
      () => dropSlot("action"),
      () => shortenSlot("deviation"),
      () => shortenSlot("quality"),
    ];
    function dropSlot(id) {
      const index = slots.findIndex((slot) => slot.id === id);
      if (index < 0) return false;
      omitted.push({ id, reason: "no cabía en el límite de palabras" });
      slots.splice(index, 1);
      return true;
    }
    function shortenSlot(id) {
      const slot = slots.find((item) => item.id === id);
      if (!slot || !slot.short || slot.text === slot.short) return false;
      slot.text = slot.short;
      return true;
    }
    for (const reduce of reductions) {
      if (total() <= maxWords) break;
      reduce();
    }
    if (!milestone) omitted.push({ id: "milestone", reason: "sin hito que contar" });
    if (!action) omitted.push({ id: "action", reason: "sin acción que sugerir" });

    const ordered = ["result", "deviation", "milestone", "action", "quality"].map((id) => slots.find((slot) => slot.id === id)).filter(Boolean);
    const body = ordered.map((slot) => slot.text).join(" ");
    return {
      calculable: true,
      schemaId: SCHEMA_ID,
      monthKey,
      text: body,
      words: countWords(body),
      slots: ordered.map((slot) => ({ id: slot.id, text: slot.text, kind: slot.kind || "" })),
      omitted,
      summary: { plannedNet: summary.plannedNet, realNet: summary.realNet, diffNet: summary.diffNet, total: summary.total, withReal: summary.withReal, realSharePct: summary.realSharePct },
    };
  }

  // ---- Las cartas guardadas ----

  /** @param {any} composed @param {{closedAt?: string, reconstructed?: boolean}} [meta] */
  function toRecord(composed, meta = {}) {
    if (!composed || !composed.calculable) return null;
    return {
      schemaId: SCHEMA_ID,
      monthKey: composed.monthKey,
      closedAt: text(meta.closedAt),
      text: composed.text,
      words: composed.words,
      plannedNet: composed.summary.plannedNet,
      realNet: composed.summary.realNet,
      diffNet: composed.summary.diffNet,
      total: composed.summary.total,
      withReal: composed.summary.withReal,
      reconstructed: Boolean(meta.reconstructed),
    };
  }

  function normalizeStore(raw) {
    const list = Array.isArray(raw) ? raw : raw && Array.isArray(raw.letters) ? raw.letters : [];
    const seen = new Set();
    return list
      .filter((letter) => letter && letter.schemaId === SCHEMA_ID && isMonth(letter.monthKey) && text(letter.text))
      .map((letter) => ({
        schemaId: SCHEMA_ID, monthKey: letter.monthKey, closedAt: text(letter.closedAt), text: text(letter.text).slice(0, 1200), words: Math.max(0, Math.round(num(letter.words))),
        plannedNet: round2(letter.plannedNet), realNet: round2(letter.realNet), diffNet: round2(letter.diffNet), total: Math.max(0, Math.round(num(letter.total))), withReal: Math.max(0, Math.round(num(letter.withReal))), reconstructed: Boolean(letter.reconstructed),
      }))
      .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))
      .filter((letter) => (seen.has(letter.monthKey) ? false : (seen.add(letter.monthKey), true)))
      .slice(0, MAX_LETTERS);
  }

  function upsert(store, record) {
    if (!record) return normalizeStore(store);
    return normalizeStore([record, ...(Array.isArray(store) ? store.filter((letter) => letter && letter.monthKey !== record.monthKey) : [])]);
  }

  return { SCHEMA_ID, MAX_WORDS, MAX_LETTERS, TOLERANCE_EUR, MATERIAL_ABS_EUR, MATERIAL_REL, STREAK_MIN, addMonths, monthName, euros, countWords, normalizeItems, summarize, adverseIds, pickDeviation, streakLength, pickMilestone, pickAction, compose, toRecord, normalizeStore, upsert };
});
