(function attachCanonicalContingencyPlan(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalContingencyPlan = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalContingencyPlanFactory() {
  "use strict";

  // WP-38 (PRV-05 + NPV-09, docs/WP38_DISENO.md): el plan B que el hogar acuerda EN FRÍO.
  // Motor puro: ni DOM, ni red, ni almacenamiento. Recibe el plan (disparador, acciones en orden, firma) y la serie de liquidez de fin de mes que ya
  // calcula la previsión, y dice si el disparador salta, qué dice lo acordado y cuánto aporta cada paso. NUNCA ejecuta nada (A11-4): enseña lo acordado.
  //
  // Reglas de honestidad:
  //   · un dato que falta (sin colchón, sin gasto variable, sin serie) NO es un cero: el estado es «incompleto» o «sin datos», no «todo bien».
  //   · el efecto de cada paso se suma a la liquidez mes a mes (lineal, sin volver a correr el motor): es una estimación, y se dice.
  //   · pedir crédito no es dinero propio: cuenta como liquidez, pero se marca con su coste y que hay que devolverlo.

  const SCHEMA_ID = "finance-contingency-plan/v1";
  const KINDS = Object.freeze({
    "pause-saving": { label: "Pausar el ahorro mensual", ownMoney: true },
    "cut-discretionary": { label: "Recortar el gasto variable", ownMoney: true },
    "credit-line": { label: "Usar la línea de crédito de emergencia", ownMoney: false },
    other: { label: "Otra acción (sin efecto calculado)", ownMoney: true },
  });
  const MAX_ACTIONS = 6;
  const DEFAULT_CONSECUTIVE = 2;
  const DEFAULT_HORIZON = 6;
  const DEFAULT_ACTION_MONTHS = 3;
  const DEFAULT_DRAW_MONTHS = 3;

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null ? Number(value) : fallback);
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function defaultPlan() {
    return { schema: SCHEMA_ID, trigger: { mode: "floor", amount: 0, consecutive: DEFAULT_CONSECUTIVE, horizon: DEFAULT_HORIZON }, actions: [], signature: null, updatedAt: "" };
  }

  function normalizeAction(raw = {}, index = 0) {
    const kind = Object.hasOwn(KINDS, raw.kind) ? raw.kind : "other";
    const action = { id: text(raw.id) || `accion-${index + 1}`, kind, label: text(raw.label).slice(0, 80) };
    if (kind === "cut-discretionary") {
      action.pct = clamp(Math.round(number(raw.pct, 20)), 1, 100);
      action.months = clamp(Math.round(number(raw.months, DEFAULT_ACTION_MONTHS)), 1, 12);
    } else if (kind === "pause-saving") {
      action.months = clamp(Math.round(number(raw.months, DEFAULT_ACTION_MONTHS)), 1, 12);
      // El ahorro que la previsión aparta cada mes se queda DENTRO de la liquidez total (cuenta de ahorro): pausarlo no cambia esa cifra. Solo cuenta
      // como dinero que se libera si el hogar dice que ese ahorro sale de la liquidez (va a un fondo o a una inversión).
      action.outside = raw.outside === true;
    } else if (kind === "credit-line") {
      action.amount = Math.max(0, round2(raw.amount));
    }
    if (!action.label) action.label = KINDS[kind].label;
    return action;
  }

  /** @param {*} raw Lo que haya en el almacén: cualquier cosa. Devuelve siempre un plan completo y acotado. */
  function normalizePlan(raw) {
    const base = defaultPlan();
    if (!raw || typeof raw !== "object") return base;
    const trigger = raw.trigger && typeof raw.trigger === "object" ? raw.trigger : {};
    const actions = (Array.isArray(raw.actions) ? raw.actions : []).slice(0, MAX_ACTIONS).map(normalizeAction);
    const signature = raw.signature && typeof raw.signature === "object" && /^\d{4}-\d{2}-\d{2}$/.test(text(raw.signature.signedAt))
      ? { signedAt: text(raw.signature.signedAt), signers: (Array.isArray(raw.signature.signers) ? raw.signature.signers : []).map((name) => text(name).slice(0, 40)).filter(Boolean).slice(0, 4), fingerprint: text(raw.signature.fingerprint) }
      : null;
    return {
      schema: SCHEMA_ID,
      trigger: {
        mode: trigger.mode === "amount" ? "amount" : "floor",
        amount: Math.max(0, round2(trigger.amount)),
        consecutive: clamp(Math.round(number(trigger.consecutive, DEFAULT_CONSECUTIVE)), 1, 6),
        horizon: clamp(Math.round(number(trigger.horizon, DEFAULT_HORIZON)), 2, 12),
      },
      actions,
      signature,
      updatedAt: text(raw.updatedAt).slice(0, 10),
    };
  }

  // Lo que se firma: el disparador y las acciones, en orden. Si cambia después de firmar, la firma deja de valer.
  function fingerprint(plan) {
    const p = normalizePlan(plan);
    const body = JSON.stringify([p.trigger, p.actions.map((a) => [a.kind, a.label, a.pct ?? null, a.months ?? null, a.amount ?? null, a.outside === true])]);
    let h = 5381;
    for (let i = 0; i < body.length; i += 1) h = ((h * 33) ^ body.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  /** Qué falta para poder firmar. Lista vacía = completo. */
  function problems(plan) {
    const p = normalizePlan(plan);
    const list = [];
    if (p.trigger.mode === "amount" && !(p.trigger.amount > 0)) list.push("Falta la cifra por debajo de la cual salta el plan.");
    if (!p.actions.length) list.push("Falta al menos una acción.");
    p.actions.forEach((action, index) => {
      if (action.kind === "credit-line" && !(action.amount > 0)) list.push(`El paso ${index + 1} (crédito) necesita un importe.`);
    });
    return list;
  }

  /** @returns {"none"|"unsigned"|"signed"|"changed"} */
  function signatureState(plan) {
    const p = normalizePlan(plan);
    if (!p.signature) return p.actions.length || p.trigger.amount > 0 ? "unsigned" : "none";
    return p.signature.fingerprint === fingerprint(p) ? "signed" : "changed";
  }

  /** @param {*} plan @param {{signers?: string[], today?: string}} [options] */
  function sign(plan, { signers = [], today = "" } = {}) {
    const p = normalizePlan(plan);
    const names = (Array.isArray(signers) ? signers : []).map((name) => text(name).slice(0, 40)).filter(Boolean);
    if (problems(p).length) return { ok: false, reason: "incompleto", plan: p };
    if (names.length < 2 || new Set(names.map((name) => name.toLowerCase())).size < 2) return { ok: false, reason: "dos-firmas", plan: p };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(today))) return { ok: false, reason: "sin-fecha", plan: p };
    return { ok: true, plan: { ...p, signature: { signedAt: today, signers: names.slice(0, 4), fingerprint: fingerprint(p) }, updatedAt: today } };
  }

  // Racha más larga y primera racha que llega a N meses seguidos por debajo del umbral.
  function breachRuns(values, threshold, consecutive) {
    let run = 0;
    let longest = 0;
    let triggeredAt = -1;
    let firstBelow = -1;
    values.forEach((value, index) => {
      if (value < threshold) {
        if (firstBelow < 0) firstBelow = index;
        run += 1;
        longest = Math.max(longest, run);
        if (run >= consecutive && triggeredAt < 0) triggeredAt = index - run + 1;
      } else {
        run = 0;
      }
    });
    return { longest, triggeredAt, firstBelow, below: values.filter((value) => value < threshold).length };
  }

  function mapValue(map, monthKey) {
    const value = map ? map[monthKey] : undefined;
    return Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : null;
  }

  // Efecto de una acción sobre la liquidez, mes a mes, desde `start`. `null` en un mes = no hay dato (no es 0).
  function actionEffects(action, months, start, ctx) {
    const effects = months.map(() => 0);
    let missing = false;
    let moved = 0;
    let note = "";
    let cost = null;
    const span = action.kind === "credit-line" ? 1 : (action.months || DEFAULT_ACTION_MONTHS);
    const end = Math.min(months.length, start + span);
    if (action.kind === "pause-saving") {
      for (let i = start; i < end; i += 1) {
        const value = mapValue(ctx.saving, months[i].monthKey);
        if (value === null) { missing = true; continue; }
        if (action.outside) effects[i] = Math.max(0, value);
        else moved += Math.max(0, value);
      }
      note = action.outside
        ? `Deja de ahorrar lo previsto cada mes durante ${action.months} ${action.months === 1 ? "mes" : "meses"}; ese ahorro sale de la liquidez, así que se queda en la cuenta.`
        : `Pasa el ahorro previsto de la cuenta de ahorro a la corriente durante ${action.months} ${action.months === 1 ? "mes" : "meses"}${moved > 0 ? ` (≈ ${ctx.eur(round2(moved))})` : ""}. No cambia la liquidez total, porque el ahorro cuenta como liquidez: no ayuda a este disparador.`;
    } else if (action.kind === "cut-discretionary") {
      for (let i = start; i < end; i += 1) {
        const value = mapValue(ctx.discretionary, months[i].monthKey);
        if (value === null) { missing = true; continue; }
        effects[i] = round2(Math.max(0, value) * action.pct / 100);
      }
      note = `Un ${action.pct} % menos de gasto variable durante ${action.months} ${action.months === 1 ? "mes" : "meses"}.`;
    } else if (action.kind === "credit-line") {
      const limit = Math.max(0, number(ctx.creditLimit));
      const amount = limit > 0 ? Math.min(action.amount, limit) : action.amount;
      if (start < months.length) effects[start] = round2(amount);
      const rate = Math.max(0, number(ctx.creditRate));
      cost = rate > 0 ? round2(amount * (rate / 100) * (DEFAULT_DRAW_MONTHS / 12)) : null;
      note = limit > 0 && action.amount > limit
        ? `Pides ${ctx.eur(action.amount)} pero la línea declarada es de ${ctx.eur(limit)}: cuenta solo ${ctx.eur(limit)}. No es dinero propio: hay que devolverlo.`
        : "No es dinero propio: hay que devolverlo.";
      if (!(limit > 0)) note += " No hay línea de crédito declarada en Ajustes: no se sabe si existe.";
    } else {
      note = "Sin efecto calculado: se enseña en su sitio, pero no suma a la liquidez.";
    }
    return { effects, missing, note, cost };
  }

  function typicalPerMonth(action, months, ctx) {
    if (action.kind === "pause-saving" && action.outside) {
      const values = months.map((m) => mapValue(ctx.saving, m.monthKey)).filter((v) => v !== null);
      return values.length ? round2(values.reduce((s, v) => s + Math.max(0, v), 0) / values.length) : null;
    }
    if (action.kind === "cut-discretionary") {
      const values = months.map((m) => mapValue(ctx.discretionary, m.monthKey)).filter((v) => v !== null);
      return values.length ? round2((values.reduce((s, v) => s + Math.max(0, v), 0) / values.length) * action.pct / 100) : null;
    }
    return null;
  }

  /**
   * @param {{plan?: *, series?: Array<{monthKey: string, label?: string, liquidity: number}>, floor?: number, saving?: Object<string, number>, discretionary?: Object<string, number>, creditLimit?: number, creditRate?: number, fmt?: (value: number) => string}} [input]
   */
  function evaluate({ plan, series, floor, saving, discretionary, creditLimit, creditRate, fmt } = {}) {
    const eur = typeof fmt === "function" ? fmt : (value) => `${value} €`;
    const p = normalizePlan(plan);
    const signature = signatureState(p);
    const base = { schemaId: SCHEMA_ID, signature, signedAt: p.signature?.signedAt || "", signers: p.signature?.signers || [], status: "none", reasons: [], threshold: null, thresholdSource: "", horizon: p.trigger.horizon, consecutive: p.trigger.consecutive, evidence: [], actions: [], afterAll: null, triggerMonth: null, resolvedAtStep: null };
    if (signature === "none") return base;
    const missing = problems(p);
    if (missing.length) return { ...base, status: "incomplete", reasons: missing };

    let threshold;
    if (p.trigger.mode === "amount") {
      threshold = p.trigger.amount;
      base.thresholdSource = "la cifra que fijasteis";
    } else {
      threshold = round2(number(floor));
      base.thresholdSource = "el colchón de la app";
      if (!(threshold > 0)) return { ...base, status: "incomplete", reasons: ["El plan salta cuando la liquidez baja del colchón, y la app no tiene colchón: fíjalo en Ajustes o elige una cifra."] };
    }
    base.threshold = threshold;

    const months = (Array.isArray(series) ? series : [])
      .filter((row) => row && /^\d{4}-\d{2}$/.test(text(row.monthKey)) && Number.isFinite(Number(row.liquidity)))
      .slice(0, p.trigger.horizon)
      .map((row) => ({ monthKey: text(row.monthKey), label: text(row.label) || text(row.monthKey), liquidity: round2(row.liquidity) }));
    if (!months.length) return { ...base, status: "no-data", reasons: ["Sin previsión de liquidez no se puede vigilar el disparador. Esto no significa que todo vaya bien."] };

    const values = months.map((m) => m.liquidity);
    const runs = breachRuns(values, threshold, p.trigger.consecutive);
    const min = Math.min(...values);
    const minMonth = months[values.indexOf(min)].monthKey;
    base.minLiquidity = min;
    base.minMonth = minMonth;
    base.minMonthLabel = months[values.indexOf(min)].label;
    base.margin = round2(min - threshold);
    base.horizonMonths = months.length;

    const status = runs.triggeredAt >= 0 ? "triggered" : runs.below > 0 ? "watch" : "ok";
    const start = runs.triggeredAt >= 0 ? runs.triggeredAt : runs.firstBelow >= 0 ? runs.firstBelow : -1;
    base.status = status;
    if (runs.triggeredAt >= 0) { base.triggerMonth = months[runs.triggeredAt].monthKey; base.triggerMonthLabel = months[runs.triggeredAt].label; }
    if (status === "triggered") base.evidence.push(`La liquidez queda por debajo de ${eur(threshold)} ${runs.longest} ${runs.longest === 1 ? "mes" : "meses"} seguidos desde ${months[runs.triggeredAt].label} (el plan salta con ${p.trigger.consecutive}).`);
    else if (status === "watch") base.evidence.push(`Hay ${runs.below} ${runs.below === 1 ? "mes" : "meses"} por debajo de ${eur(threshold)}, pero no ${p.trigger.consecutive} seguidos: el plan aún no salta.`);
    else base.evidence.push(`En los próximos ${months.length} ${months.length === 1 ? "mes" : "meses"} la liquidez no baja de ${eur(threshold)}; el mínimo es ${eur(min)} (${months[values.indexOf(min)].label}).`);

    // Pasos en orden: cada uno suma a los anteriores. Con disparador ok no hay mes de arranque: se enseña solo el efecto típico mensual.
    const ctx = { saving, discretionary, creditLimit, creditRate, eur };
    let cumulative = months.map(() => 0);
    let resolved = null;
    let creditBefore = false;
    let ownAfterCredit = false;
    base.actions = p.actions.map((action, index) => {
      const row = { id: action.id, index: index + 1, kind: action.kind, label: action.label, ownMoney: KINDS[action.kind].ownMoney, typicalPerMonth: typicalPerMonth(action, months, ctx), note: "", cost: null, effectByMonth: null, adds: null, minAfter: null, resolves: null, incomplete: false };
      if (action.kind === "credit-line") creditBefore = true;
      else if (creditBefore && KINDS[action.kind].ownMoney && action.kind !== "other") ownAfterCredit = true;
      if (start < 0) {
        row.note = actionEffects(action, months, 0, ctx).note;
        return row;
      }
      const result = actionEffects(action, months, start, ctx);
      row.note = result.note;
      row.cost = result.cost;
      row.incomplete = result.missing;
      row.effectByMonth = result.effects;
      row.adds = round2(result.effects.reduce((s, v) => s + v, 0));
      let running = 0;
      cumulative = cumulative.map((value, i) => { running += result.effects[i]; return round2(value + running); });
      const adjusted = values.map((v, i) => round2(v + cumulative[i]));
      row.minAfter = Math.min(...adjusted);
      const after = breachRuns(adjusted, threshold, p.trigger.consecutive);
      row.resolves = after.triggeredAt < 0;
      if (row.resolves && resolved === null) resolved = index + 1;
      return row;
    });
    base.resolvedAtStep = resolved;
    if (start >= 0 && p.actions.length) {
      const adjusted = values.map((v, i) => round2(v + cumulative[i]));
      base.afterAll = { minLiquidity: Math.min(...adjusted), stillTriggered: breachRuns(adjusted, threshold, p.trigger.consecutive).triggeredAt >= 0, short: round2(Math.max(0, threshold - Math.min(...adjusted))) };
    }
    if (ownAfterCredit) base.reasons.push("El plan pide crédito antes de agotar lo propio (ahorro y gasto variable). Conviene poner el crédito el último.");
    if (base.actions.some((a) => a.incomplete)) base.reasons.push("Para algún paso falta el dato del mes (ahorro o gasto variable previstos): su efecto está por debajo de lo real, no es cero.");
    if (signature === "unsigned") base.reasons.push("Todavía sin firmar: hasta que lo firméis las dos personas es un borrador.");
    if (signature === "changed") base.reasons.push("Se ha cambiado después de firmar: la firma ya no vale hasta que se firme de nuevo.");
    return base;
  }

  /**
   * NPV-09 · «¿cuánto aguanta el colchón?». Sin ingresos (el caso peor) y con un % de recorte del gasto variable, cuántos meses dura la liquidez y
   * cuántos hasta tocar el colchón. `discretionaryMonthly` ausente (null) = sin palanca, no «0 de recorte».
   * @param {{liquidity?: number, floor?: number, monthlyOutflow?: number, discretionaryMonthly?: number|null, pcts?: number[]}} [input]
   */
  function cutLeverage({ liquidity, floor, monthlyOutflow, discretionaryMonthly, pcts = [0, 10, 20, 30, 50] } = {}) {
    const cash = Math.max(0, round2(liquidity));
    const outflow = Math.max(0, round2(monthlyOutflow));
    if (!(outflow > 0)) return { calculable: false, reason: "Sin salidas mensuales calculables." };
    const hasDiscretionary = discretionaryMonthly !== null && discretionaryMonthly !== undefined && Number.isFinite(Number(discretionaryMonthly)) && Number(discretionaryMonthly) > 0;
    const discretionary = hasDiscretionary ? Math.min(outflow, round2(discretionaryMonthly)) : 0;
    const floorValue = Math.max(0, round2(floor));
    const rows = (hasDiscretionary ? pcts : [0]).map((pct) => {
      const saved = round2(discretionary * pct / 100);
      const burn = round2(outflow - saved);
      return {
        pct,
        monthlySaved: saved,
        monthlyBurn: burn,
        monthsToZero: Math.floor((cash / burn) * 10) / 10,
        monthsToFloor: floorValue > 0 ? Math.floor((Math.max(0, cash - floorValue) / burn) * 10) / 10 : null,
      };
    });
    return { calculable: true, liquidity: cash, floor: floorValue, monthlyOutflow: outflow, discretionaryMonthly: hasDiscretionary ? discretionary : null, hasLever: hasDiscretionary, rows };
  }

  return { SCHEMA_ID, KINDS, MAX_ACTIONS, defaultPlan, normalizePlan, normalizeAction, fingerprint, problems, signatureState, sign, evaluate, cutLeverage };
});
