(function attachCanonicalInvestmentPolicy(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalInvestmentPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalInvestmentPolicyFactory() {
  "use strict";

  // WP-39 (CAR-01, docs/WP39_DISENO.md): la política de inversión del hogar, acordada en frío. Motor puro: ni DOM, ni red, ni almacenamiento.
  // Recibe las seis respuestas del hogar (más lo que la app ya sabe de la cartera) y devuelve las reglas numeradas, qué falta, el estado de la firma y
  // de la revisión, cómo está hoy la cartera frente a la política y si una operación concreta la contradice. NUNCA opera (A11-4): avisa.
  //
  // Reglas de honestidad:
  //   · una pregunta sin responder no se rellena sola: la política queda «incompleta», no firmable.
  //   · sin cartera registrada o sin dato de caída, el motor dice «sin datos», nunca «cumple».
  //   · una regla que la app no puede vigilar todavía se dice (p. ej. «no vender por caídas» sin saber cuánto ha caído la cartera).

  const SCHEMA_ID = "finance-investment-policy/v1";
  const TYPES = Object.freeze({ fondo: "Fondo", accion: "Acción", etf: "ETF", cripto: "Cripto", "plan-pension": "Plan de pensiones", otro: "Otro" });
  const DRAWDOWN_ACTIONS = Object.freeze({
    hold: "No vender, esperar a que se recupere",
    "keep-contributing": "Seguir aportando como siempre, sin vender",
    "rebalance-buying": "Rebalancear solo comprando, sin vender",
    "review-together": "Hablarlo las dos personas antes de tocar nada",
  });
  const CONTRIBUTION_MODES = Object.freeze({ fixed: "Una cantidad fija al mes", surplus: "Lo que sobre cada mes, tras el colchón", none: "No aportamos de forma regular" });
  const DEFAULT_BAND_PCT = 10; // el umbral con el que el rebalanceo de la app (IV6) avisa hoy
  const REVIEW_MONTH_CHOICES = Object.freeze([6, 12, 24]);
  const DRAWDOWN_LEVELS = Object.freeze([20, 35]);
  const SUM_TOLERANCE = 0.5;

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const isIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value));

  function addMonthsIso(iso, months) {
    const [year, month, day] = iso.split("-").map(Number);
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
  }

  function daysBetween(fromIso, toIso) {
    const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
  }

  function defaultPolicy() {
    return {
      schema: SCHEMA_ID,
      purpose: { text: "", horizonYears: 0 },
      allocation: { targets: {}, bandPct: DEFAULT_BAND_PCT, rebalanceByContributions: true },
      contribution: { mode: "", monthly: 0 },
      exclusions: { noLeverage: false, noCrypto: false, custom: "" },
      drawdown: { at20: "review-together", at35: "review-together" },
      review: { everyMonths: 12 },
      signature: null,
      updatedAt: "",
    };
  }

  /** @param {*} raw Lo que haya en el almacén: cualquier cosa. Devuelve siempre una política completa y acotada. */
  function normalizePolicy(raw) {
    const base = defaultPolicy();
    if (!raw || typeof raw !== "object") return base;
    const obj = (value) => (value && typeof value === "object" ? value : {});
    const purpose = obj(raw.purpose);
    const allocation = obj(raw.allocation);
    const contribution = obj(raw.contribution);
    const exclusions = obj(raw.exclusions);
    const drawdown = obj(raw.drawdown);
    const review = obj(raw.review);
    const targets = {};
    Object.entries(obj(allocation.targets)).forEach(([type, value]) => {
      const pct = round2(clamp(number(value), 0, 100));
      if (Object.hasOwn(TYPES, type) && pct > 0) targets[type] = pct;
    });
    const action = (value) => (Object.hasOwn(DRAWDOWN_ACTIONS, value) ? value : "review-together");
    const signature = raw.signature && typeof raw.signature === "object" && isIso(raw.signature.signedAt)
      ? { signedAt: text(raw.signature.signedAt), signers: (Array.isArray(raw.signature.signers) ? raw.signature.signers : []).map((name) => text(name).slice(0, 40)).filter(Boolean).slice(0, 4), fingerprint: text(raw.signature.fingerprint) }
      : null;
    return {
      schema: SCHEMA_ID,
      purpose: { text: text(purpose.text).slice(0, 200), horizonYears: clamp(Math.round(number(purpose.horizonYears)), 0, 60) },
      allocation: {
        targets,
        bandPct: clamp(round2(number(allocation.bandPct, DEFAULT_BAND_PCT)), 2, 25),
        rebalanceByContributions: allocation.rebalanceByContributions !== false,
      },
      contribution: { mode: Object.hasOwn(CONTRIBUTION_MODES, contribution.mode) ? contribution.mode : "", monthly: Math.max(0, round2(contribution.monthly)) },
      exclusions: { noLeverage: exclusions.noLeverage === true, noCrypto: exclusions.noCrypto === true, custom: text(exclusions.custom).slice(0, 160) },
      drawdown: { at20: action(drawdown.at20), at35: action(drawdown.at35) },
      review: { everyMonths: REVIEW_MONTH_CHOICES.includes(Number(review.everyMonths)) ? Number(review.everyMonths) : 12 },
      signature,
      updatedAt: isIso(raw.updatedAt) ? text(raw.updatedAt) : "",
    };
  }

  // Lo que se firma son las respuestas. Si cambia cualquiera después de firmar, la firma deja de valer.
  function fingerprint(policy) {
    const p = normalizePolicy(policy);
    const body = JSON.stringify([p.purpose, p.allocation, p.contribution, p.exclusions, p.drawdown, p.review]);
    let h = 5381;
    for (let i = 0; i < body.length; i += 1) h = ((h * 33) ^ body.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function targetsSum(policy) {
    return round2(Object.values(normalizePolicy(policy).allocation.targets).reduce((sum, value) => sum + value, 0));
  }

  /** Qué falta para poder firmar, por pregunta. Lista vacía = completa. */
  function problems(policy) {
    const p = normalizePolicy(policy);
    const list = [];
    if (!p.purpose.text) list.push({ question: 1, text: "Falta para qué es este dinero." });
    if (!(p.purpose.horizonYears > 0)) list.push({ question: 1, text: "Falta el horizonte, en años." });
    const sum = targetsSum(p);
    if (!Object.keys(p.allocation.targets).length) list.push({ question: 2, text: "Falta el reparto objetivo por tipo de activo." });
    else if (Math.abs(sum - 100) > SUM_TOLERANCE) list.push({ question: 2, text: `El reparto suma ${sum} %, no 100 %.` });
    if (!p.contribution.mode) list.push({ question: 3, text: "Falta decidir cómo se aporta." });
    else if (p.contribution.mode === "fixed" && !(p.contribution.monthly > 0)) list.push({ question: 3, text: "Falta la cantidad fija mensual." });
    return list;
  }

  /** @returns {"none"|"unsigned"|"signed"|"changed"} */
  function signatureState(policy) {
    const p = normalizePolicy(policy);
    if (!p.signature) return p.purpose.text || Object.keys(p.allocation.targets).length || p.contribution.mode ? "unsigned" : "none";
    return p.signature.fingerprint === fingerprint(p) ? "signed" : "changed";
  }

  /** @param {*} policy @param {{signers?: string[], today?: string}} [options] */
  function sign(policy, { signers = [], today = "" } = {}) {
    const p = normalizePolicy(policy);
    const names = (Array.isArray(signers) ? signers : []).map((name) => text(name).slice(0, 40)).filter(Boolean);
    if (problems(p).length) return { ok: false, reason: "incompleta", policy: p };
    if (names.length < 2 || new Set(names.map((name) => name.toLowerCase())).size < 2) return { ok: false, reason: "dos-firmas", policy: p };
    if (!isIso(today)) return { ok: false, reason: "sin-fecha", policy: p };
    return { ok: true, policy: { ...p, signature: { signedAt: today, signers: names.slice(0, 4), fingerprint: fingerprint(p) }, updatedAt: today } };
  }

  /**
   * Cuándo toca revisarla: la fecha de firma más el intervalo elegido. Sin firma vigente no hay fecha de revisión (no se inventa).
   * @param {*} policy @param {{today?: string}} [options]
   */
  function reviewStatus(policy, { today = "" } = {}) {
    const p = normalizePolicy(policy);
    if (signatureState(p) !== "signed" || !isIso(today)) return { status: "none", dueDate: "", daysLeft: null };
    const dueDate = addMonthsIso(p.signature.signedAt, p.review.everyMonths);
    const daysLeft = daysBetween(today, dueDate);
    return { status: daysLeft < 0 ? "overdue" : daysLeft <= 30 ? "due-soon" : "ok", dueDate, daysLeft };
  }

  /** Las reglas, numeradas y en lenguaje llano: es lo que «la regla N» significa en los avisos. */
  function rules(policy) {
    const p = normalizePolicy(policy);
    const list = [];
    const add = (id, textValue, extra = {}) => list.push({ n: list.length + 1, id, text: textValue, ...extra });
    if (p.purpose.text || p.purpose.horizonYears) add("purpose", `Este dinero es para ${p.purpose.text || "…"}, a ${p.purpose.horizonYears || "…"} años.`);
    const targetText = Object.entries(p.allocation.targets).map(([type, pct]) => `${TYPES[type]} ${pct} %`).join(", ");
    if (targetText) add("allocation", `Reparto objetivo: ${targetText}. Se rebalancea cuando un tipo se desvía más de ${p.allocation.bandPct} puntos${p.allocation.rebalanceByContributions ? ", y primero con las aportaciones, sin vender" : ""}.`);
    if (p.contribution.mode) add("contribution", `Aportación: ${CONTRIBUTION_MODES[p.contribution.mode].toLowerCase()}${p.contribution.mode === "fixed" ? ` (${p.contribution.monthly} €)` : ""}.`);
    if (p.exclusions.noLeverage) add("no-leverage", "No invertimos con dinero prestado (sin apalancamiento).");
    if (p.exclusions.noCrypto) add("no-crypto", "No compramos cripto.");
    if (p.exclusions.custom) add("custom-exclusion", `No compramos: ${p.exclusions.custom}.`);
    DRAWDOWN_LEVELS.forEach((level) => add(`drawdown-${level}`, `Si la cartera cae un ${level} % desde su máximo: ${DRAWDOWN_ACTIONS[p.drawdown[`at${level}`]].toLowerCase()}.`, { level }));
    add("review", `La revisamos cada ${p.review.everyMonths} meses.`);
    return list;
  }

  const ruleNumber = (list, id) => list.find((rule) => rule.id === id)?.n ?? null;

  /**
   * Cómo está la cartera hoy frente a la política. Cada fila trae la regla que la origina (`n`).
   * @param {{policy?: *, totalsByType?: Object<string, number>, totalValue?: number, loanAmount?: number}} [input]
   */
  function assessPortfolio({ policy, totalsByType = {}, totalValue = 0, loanAmount = 0 } = {}) {
    const p = normalizePolicy(policy);
    const list = rules(p);
    const total = Math.max(0, number(totalValue));
    if (!(total > 0)) return { status: "no-data", items: [], reason: "Sin posiciones con valor en la cartera no hay nada que comparar. Esto no significa que cumpla la política." };
    const items = [];
    const types = new Set([...Object.keys(p.allocation.targets), ...Object.keys(totalsByType).filter((type) => number(totalsByType[type]) > 0)]);
    const allocationN = ruleNumber(list, "allocation");
    types.forEach((type) => {
      const real = round2((number(totalsByType[type]) / total) * 100);
      const target = number(p.allocation.targets[type]);
      const deviation = round2(real - target);
      if (Object.keys(p.allocation.targets).length && Math.abs(deviation) > p.allocation.bandPct) {
        items.push({ ruleId: "allocation", n: allocationN, severity: "out", type, real, target, deviation, text: `${TYPES[type] || type}: ${real} % frente a un objetivo de ${target} %, ${deviation > 0 ? "por encima" : "por debajo"} en ${Math.abs(deviation)} puntos (la banda es de ${p.allocation.bandPct}).` });
      }
    });
    if (p.exclusions.noCrypto && number(totalsByType.cripto) > 0) items.push({ ruleId: "no-crypto", n: ruleNumber(list, "no-crypto"), severity: "out", text: "Hay cripto en la cartera y la política dice que no se compra." });
    if (p.exclusions.noLeverage && number(loanAmount) > 0) items.push({ ruleId: "no-leverage", n: ruleNumber(list, "no-leverage"), severity: "out", text: `Hay un préstamo declarado de ${round2(loanAmount)} € con la cartera como garantía y la política dice que no se invierte con dinero prestado.` });
    return { status: items.length ? "out" : "ok", items, reason: "" };
  }

  /**
   * ¿Contradice la política una operación concreta? `drawdownPct` es la caída de la cartera desde su máximo (positiva); `null` si no se sabe.
   * @param {{policy?: *, operation?: {kind?: string, type?: string, amount?: number}, totalsByType?: Object<string, number>, totalValue?: number, drawdownPct?: number|null}} [input]
   */
  function checkOperation({ policy, operation = {}, totalsByType = {}, totalValue = 0, drawdownPct = null } = {}) {
    const p = normalizePolicy(policy);
    const list = rules(p);
    const kind = operation.kind === "sell" ? "sell" : operation.kind === "buy" ? "buy" : "";
    const type = Object.hasOwn(TYPES, operation.type) ? operation.type : "";
    const amount = Math.max(0, number(operation.amount));
    if (!kind || !type) return { verdict: "no-data", findings: [], reason: "Falta si es una compra o una venta y de qué tipo." };
    const findings = [];
    const add = (severity, ruleId, textValue) => findings.push({ severity, ruleId, n: ruleNumber(list, ruleId), text: textValue });
    if (kind === "buy" && type === "cripto" && p.exclusions.noCrypto) add("contradicts", "no-crypto", "Comprar cripto: la política dice que no se compra.");
    if (kind === "sell") {
      const known = drawdownPct !== null && drawdownPct !== undefined && Number.isFinite(Number(drawdownPct));
      const noSellActions = ["hold", "keep-contributing", "rebalance-buying"]; // las tres dicen «sin vender»
      if (known) {
        const hit = DRAWDOWN_LEVELS.filter((level) => Number(drawdownPct) >= level).pop();
        if (hit) {
          const chosen = p.drawdown[`at${hit}`];
          if (noSellActions.includes(chosen)) add("contradicts", `drawdown-${hit}`, `Vender con la cartera ${round2(drawdownPct)} % por debajo de su máximo: a partir del ${hit} % la política dice «${DRAWDOWN_ACTIONS[chosen].toLowerCase()}».`);
          else add("warns", `drawdown-${hit}`, `Con la cartera ${round2(drawdownPct)} % por debajo de su máximo, la política pide hablarlo las dos personas antes de tocar nada.`);
        }
      } else {
        const level = DRAWDOWN_LEVELS[0];
        add("warns", `drawdown-${level}`, "No sé cuánto ha caído la cartera desde su máximo y la política tiene reglas para las caídas. Mira la caída antes de vender.");
      }
    }
    const total = Math.max(0, number(totalValue));
    if (total > 0 && amount > 0 && Object.keys(p.allocation.targets).length) {
      const before = number(totalsByType[type]);
      const after = kind === "buy" ? before + amount : Math.max(0, before - amount);
      const newTotal = kind === "buy" ? total + amount : Math.max(0, total - amount);
      const target = number(p.allocation.targets[type]);
      const afterPct = newTotal > 0 ? round2((after / newTotal) * 100) : 0;
      const beforePct = round2((before / total) * 100);
      const band = p.allocation.bandPct;
      const worsens = Math.abs(afterPct - target) > Math.abs(beforePct - target);
      if (Math.abs(afterPct - target) > band && worsens) add("warns", "allocation", `${kind === "buy" ? "Comprar" : "Vender"} dejaría ${TYPES[type]} en ${afterPct} %, fuera de la banda (${target} % ± ${band}) y más lejos del objetivo que ahora.`);
    }
    const verdict = findings.some((f) => f.severity === "contradicts") ? "contradicts" : findings.length ? "warns" : total > 0 ? "complies" : "no-data";
    return { verdict, findings, reason: verdict === "no-data" ? "Sin cartera registrada no se puede comparar el reparto: solo se miran las reglas que no dependen de él." : "" };
  }

  return { SCHEMA_ID, TYPES, DRAWDOWN_ACTIONS, CONTRIBUTION_MODES, DEFAULT_BAND_PCT, REVIEW_MONTH_CHOICES, DRAWDOWN_LEVELS, defaultPolicy, normalizePolicy, fingerprint, targetsSum, problems, signatureState, sign, reviewStatus, rules, assessPortfolio, checkOperation };
});
