(function attachCanonicalExpectedMovements(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalExpectedMovements = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalExpectedMovements() {
  "use strict";

  // WP-14 (ND-08 · cobros esperados) + WP-27 (CAP-06 · cargos que no llegaron), docs/WP14_WP27_DISENO.md: el simétrico de «lo que se espera y no
  // aparece». Un cobro que no llega es caja que falta; un recibo que no llega es o un riesgo (póliza impagada, domiciliación rota) o un error de
  // previsión (se sigue restando una salida que no ocurrirá). Nada lo vigilaba.
  //
  // Es un DETECTOR puro: dice qué preguntar y qué hacer con cada respuesta, pero no escribe nada (los efectos los ejecuta la pantalla, con deshacer).
  //
  // Tres reglas que lo separan del ruido:
  //   1. Solo se pregunta por fechas SEGURAS (regla o día de cargo indicado). Con la fecha de relleno (el 8), «no ha llegado» es mentira.
  //   2. En los GASTOS, solo si el libro importado llega hasta el día esperado (+ ventana + margen). Sin extracto al día, «no aparece» es
  //      indistinguible de «no lo he importado»: preguntar sería inventar un hallazgo. Los cobros se preguntan siempre: la propia respuesta
  //      («sí, por el importe previsto») es la forma más barata de registrarlos.
  //   3. Lo ya respondido no se repite: «aún no» calla N días; «ha cambiado de cuenta» calla esa serie.

  const SCHEMA_ID = "finance-canonical-expected-movements/v1";
  const DEFAULTS = Object.freeze({ incomeGraceDays: 2, expenseWindowDays: 1, expenseGraceDays: 3, snoozeDays: Object.freeze({ income: 2, expense: 3 }), maxItems: 5 });

  const RESPONSES = Object.freeze({
    income: Object.freeze([
      Object.freeze({ key: "yes", label: "Sí, por el importe previsto" }),
      Object.freeze({ key: "yesOther", label: "Sí, otro importe", needsAmount: true }),
      Object.freeze({ key: "notYet", label: "Aún no" }),
    ]),
    expense: Object.freeze([
      Object.freeze({ key: "cancelled", label: "Se ha dado de baja" }),
      Object.freeze({ key: "moved", label: "Ha cambiado de cuenta" }),
      Object.freeze({ key: "late", label: "Llegará tarde" }),
      Object.freeze({ key: "paid", label: "Ya está pagado de otra forma" }),
    ]),
  });

  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  function utc(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const isoOf = (date) => date.toISOString().slice(0, 10);
  const addDays = (iso, count) => { const date = utc(iso); date.setUTCDate(date.getUTCDate() + count); return isoOf(date); };
  const dayDiff = (fromIso, toIso) => Math.round((utc(toIso).getTime() - utc(fromIso).getTime()) / 86400000);

  function normalizeOptions(options = {}) {
    const int = (value, fallback, min, max) => { const n = Math.round(Number(value)); return Number.isFinite(n) && n >= min && n <= max ? n : fallback; };
    return {
      incomeGraceDays: int(options.incomeGraceDays, DEFAULTS.incomeGraceDays, 0, 15),
      expenseWindowDays: int(options.expenseWindowDays, DEFAULTS.expenseWindowDays, 0, 5),
      expenseGraceDays: int(options.expenseGraceDays, DEFAULTS.expenseGraceDays, 0, 15),
      snoozeDays: { income: int(options.snoozeDays?.income, DEFAULTS.snoozeDays.income, 1, 30), expense: int(options.snoozeDays?.expense, DEFAULTS.snoozeDays.expense, 1, 30) },
      maxItems: int(options.maxItems, DEFAULTS.maxItems, 1, 20),
    };
  }

  /** Respuestas guardadas, con forma garantizada aunque lo guardado esté dañado. */
  function normalizeAnswers(raw) {
    const snoozes = {};
    const moved = {};
    if (raw && typeof raw === "object") {
      Object.entries(raw.snoozes || {}).forEach(([id, value]) => {
        if (value && utc(value.until)) snoozes[id] = { until: isoOf(utc(value.until)), count: Math.max(1, Math.round(Number(value.count)) || 1) };
      });
      Object.entries(raw.moved || {}).forEach(([key, value]) => {
        if (value && /^\d{4}-\d{2}/.test(String(value.since || ""))) moved[key] = { since: String(value.since).slice(0, 7) }; // un mes, no una fecha completa
      });
    }
    return { snoozes, moved };
  }

  /**
   * @param {{
   *   today?: string, ledgerCoveredUntil?: string|null, answers?: any, options?: Record<string, any>,
   *   expectations?: Array<{id: string, kind: string, seriesKey?: string, label?: string, month?: string, expectedDate: string, certain?: boolean,
   *     plannedAmount?: number, arrived?: boolean, cancelled?: boolean, history?: Array<{date: string, amount: number}>}>
   * }} input
   */
  function detect(input = {}) {
    const today = utc(input.today) ? isoOf(utc(input.today)) : "";
    if (!today) return { schemaId: SCHEMA_ID, status: "missing", missing: ["la fecha de hoy"], items: [], waiting: [], silent: {} };
    const options = normalizeOptions(input.options);
    const answers = normalizeAnswers(input.answers);
    const covered = utc(input.ledgerCoveredUntil) ? isoOf(utc(input.ledgerCoveredUntil)) : "";
    const items = [];
    const waiting = [];
    const silent = { uncertain: 0, arrived: 0, unverifiable: 0, notYetDue: 0, moved: 0 };

    (Array.isArray(input.expectations) ? input.expectations : []).forEach((expectation) => {
      const kind = expectation?.kind === "income" ? "income" : expectation?.kind === "expense" ? "expense" : "";
      const expected = utc(expectation?.expectedDate) ? isoOf(utc(expectation.expectedDate)) : "";
      if (!kind || !expected || !expectation.id) return;
      if (expectation.arrived || expectation.cancelled) { silent.arrived += 1; return; }
      if (!expectation.certain) { silent.uncertain += 1; return; }
      if (kind === "expense" && expectation.seriesKey && answers.moved[expectation.seriesKey] && String(expectation.month || expected.slice(0, 7)) >= answers.moved[expectation.seriesKey].since) { silent.moved += 1; return; }

      const window = kind === "expense" ? options.expenseWindowDays : 0;
      const grace = kind === "expense" ? options.expenseGraceDays : options.incomeGraceDays;
      const askFrom = addDays(expected, window + grace + 1); // el primer día en que ya toca preguntar
      if (today < askFrom) { silent.notYetDue += 1; return; }
      // Sin extracto que llegue hasta ese día, no se puede decir que un cargo «no ha llegado».
      if (kind === "expense" && (!covered || covered < askFrom)) { silent.unverifiable += 1; return; }

      const snooze = answers.snoozes[expectation.id];
      if (snooze && today < snooze.until) { waiting.push({ id: expectation.id, kind, label: expectation.label || "", until: snooze.until, count: snooze.count }); return; }

      items.push({
        id: expectation.id, kind, seriesKey: expectation.seriesKey || "", label: expectation.label || "", month: expectation.month || expected.slice(0, 7),
        expectedDate: expected, daysLate: dayDiff(expected, today), plannedAmount: round2(expectation.plannedAmount),
        history: (Array.isArray(expectation.history) ? expectation.history : []).filter((point) => utc(point?.date)).slice(0, 6),
        snoozeCount: snooze ? snooze.count : 0, responses: RESPONSES[kind],
      });
    });

    // Cobros antes que cargos (dominan la caja), y lo más atrasado primero.
    items.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "income" ? -1 : 1) || b.daysLate - a.daysLate || a.id.localeCompare(b.id));
    return { schemaId: SCHEMA_ID, status: "ok", missing: [], today, items: items.slice(0, options.maxItems), overflow: Math.max(0, items.length - options.maxItems), waiting, silent, options };
  }

  /**
   * Qué hay que hacer con una respuesta (la pantalla lo ejecuta) y qué recordar para no repetir la pregunta.
   * `effect`: setActual (un real para esa partida y mes) · deleteFrom (anular la serie desde ese mes) · none.
   * `patch`: snooze / moved, para el almacén de respuestas.
   * @param {{item: any, response: string, today: string, amount?: number|string|null, options?: Record<string, any>}} input
   */
  function resolve({ item, response, today, amount = null, options = {} }) {
    const opts = normalizeOptions(options);
    const valid = RESPONSES[item?.kind]?.find((candidate) => candidate.key === response);
    if (!valid) return { ok: false, reason: "respuesta desconocida" };
    const base = { ok: true, itemId: item.id, response, effect: { type: "none" }, patch: null, undoable: true };
    switch (response) {
      case "yes":
      case "paid":
        return { ...base, effect: { type: "setActual", kind: item.kind, seriesKey: item.seriesKey, month: item.month, amount: round2(item.plannedAmount) } };
      case "yesOther": {
        const typed = typeof amount === "string" ? Number(amount.trim().replace(/\./g, "").replace(",", ".")) : Number(amount);
        if (amount === null || amount === "" || !Number.isFinite(typed) || typed < 0) return { ok: false, reason: "falta el importe" };
        return { ...base, effect: { type: "setActual", kind: item.kind, seriesKey: item.seriesKey, month: item.month, amount: round2(typed) } };
      }
      case "cancelled":
        return { ...base, effect: { type: "deleteFrom", kind: item.kind, seriesKey: item.seriesKey, fromMonth: item.month } };
      case "moved":
        return { ...base, patch: { type: "moved", seriesKey: item.seriesKey, since: item.month } };
      default: { // notYet · late: callar unos días y volver a preguntar
        const days = opts.snoozeDays[item.kind];
        return { ...base, patch: { type: "snooze", id: item.id, until: addDays(today, days), count: (item.snoozeCount || 0) + 1 } };
      }
    }
  }

  /** Aplica un patch al almacén de respuestas (puro: devuelve el nuevo). */
  function applyPatch(answers, patch) {
    const next = normalizeAnswers(answers);
    if (patch?.type === "snooze") next.snoozes[patch.id] = { until: patch.until, count: patch.count };
    if (patch?.type === "moved") next.moved[patch.seriesKey] = { since: patch.since };
    return next;
  }

  /** Las respuestas ya no sirven pasados dos meses: se limpian para que el almacén no crezca. */
  function prune(answers, today) {
    const next = normalizeAnswers(answers);
    const limit = addDays(today, -62);
    Object.keys(next.snoozes).forEach((id) => { if (next.snoozes[id].until < limit) delete next.snoozes[id]; });
    return next;
  }

  /** Para «Hecho cuando: ningún recibo esperado sin estado más de 3 días»: cuántas preguntas llevan más de 3 días esperando. */
  function staleCount(result) {
    return (result?.items || []).filter((item) => item.daysLate > 3 + (item.kind === "expense" ? DEFAULTS.expenseWindowDays + DEFAULTS.expenseGraceDays : DEFAULTS.incomeGraceDays)).length;
  }

  return Object.freeze({ SCHEMA_ID, DEFAULTS, RESPONSES, normalizeAnswers, detect, resolve, applyPatch, prune, staleCount });
});
