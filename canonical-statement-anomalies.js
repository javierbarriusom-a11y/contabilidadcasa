/**
 * canonical-statement-anomalies.js
 *
 * WP-36 · ND-07 (docs/WP36_DISENO.md): anomalías del extracto. Detector puro sobre los movimientos ya importados: cargo duplicado, devolución de un
 * recibo, comisión nueva (o que sube), recurrente sin partida en el plan e importe fuera de lo normal de su partida. Cada aviso lleva su evidencia.
 *
 * NUNCA actúa: no toca el extracto, no reclama nada al banco, no clasifica. Solo enseña y deja responder «es algo real», «es normal» o «es normal
 * siempre»; de esas respuestas sale la tasa de falsos positivos (objetivo < 20 %). Lo que no puede mirar lo dice: sin extracto reciente, el silencio
 * no significa que todo esté bien.
 *
 * Sin DOM, red ni almacenamiento: las respuestas entran y salen como datos; la tarjeta vive en anomalias-ui.js.
 */

(function attachStatementAnomalies(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalStatementAnomalies = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function statementAnomaliesFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-statement-anomalies/v1";
  const LOOKBACK_DAYS = 45; // solo se vigila lo reciente: lo viejo ya lo vio quien miró el extracto
  const MIN_HISTORY_DAYS = 90;
  const MIN_DUPLICATE_AMOUNT = 5;
  const HABITUAL_REPEATS = 2; // un par igual en el mismo día que ya ocurrió otras 2 veces es costumbre, no anomalía
  const COMMISSION_RISE = 0.25;
  const RECURRING_SPREAD = 0.1;
  const ATYPICAL_MIN_OBSERVATIONS = 8;
  const ATYPICAL_MIN_MONTHS = 4;
  const ATYPICAL_FACTOR = 1.25;
  const ATYPICAL_MARGIN_EUR = 25;
  const MIN_ANSWERS_FOR_RATE = 10;
  const DEFAULT_LIMIT = 6;
  const RESPONSES = Object.freeze(["real", "normal", "normalAlways"]);
  const SEVERITY = Object.freeze({ devolucion: 5, duplicado: 4, comision: 3, recurrente: 2, atipico: 1 });
  const RETURN_RE = /devoluci[oó]n\s+(?:de\s+)?recibo|recibo\s+devuelto|recibos?\s+impagad|impagado|recibo\s+rechazad|rechazo\s+de\s+recibo/i;
  const COMMISSION_RE = /comisi[oó]n|comis\.|gastos?\s+(?:de\s+)?(?:devoluci[oó]n|correo|mantenimiento)|intereses?\s+deudor|descubierto|mantenimiento\s+(?:de\s+)?cuenta/i;
  const RETURN_WORDS = new Set(["devolucion", "devuelto", "impagado", "rechazado", "rechazo", "de"]);

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function isIsoDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime());
  }

  function dayNumber(iso) {
    return Math.round(new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() / 86400000);
  }

  function shortDate(iso) {
    const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
    return `${day}/${month}/${year}`;
  }

  function eur(value) {
    return `${Math.abs(value).toFixed(2).replace(".", ",")} €`;
  }

  function plain(text) {
    return String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // Las primeras palabras del concepto, sin números ni referencias (que cambian en cada cargo): «compra tarj mercadona».
  function conceptKey(row) {
    const tokens = plain(`${row.movement || ""} ${row.details || ""}`).split(/[^a-z]+/).filter((token) => token.length >= 3);
    return tokens.slice(0, 4).join(" ");
  }

  function coreKey(key) {
    return key.split(" ").filter((token) => !RETURN_WORDS.has(token)).join(" ");
  }

  function normalizeAnswers(raw) {
    const byId = {};
    const silenced = {};
    if (raw && typeof raw === "object") {
      Object.entries(raw.byId && typeof raw.byId === "object" ? raw.byId : {}).forEach(([id, value]) => {
        if (value && RESPONSES.includes(value.response) && typeof value.at === "string") byId[id] = { response: value.response, at: value.at };
      });
      Object.entries(raw.silenced && typeof raw.silenced === "object" ? raw.silenced : {}).forEach(([key, at]) => {
        if (typeof at === "string") silenced[key] = at;
      });
    }
    return { byId, silenced };
  }

  /**
   * @param {{byId?: Record<string, any>, silenced?: Record<string, any>}} answers
   * @param {{id: string, silenceKey?: string}} item
   * @param {string} response
   * @param {string} today
   */
  function applyAnswer(answers, item, response, today) {
    if (!RESPONSES.includes(response)) throw new Error("Esa respuesta no existe: usa «real», «normal» o «normalAlways».");
    const next = normalizeAnswers(answers);
    next.byId[item.id] = { response, at: today };
    if (response === "normalAlways" && item.silenceKey) next.silenced[item.silenceKey] = today;
    return next;
  }

  function percentile(sorted, fraction) {
    if (!sorted.length) return null;
    const rank = (sorted.length - 1) * fraction;
    const low = Math.floor(rank);
    const high = Math.ceil(rank);
    return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
  }

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    return percentile(sorted, 0.5);
  }

  function prepare(transactions) {
    return (Array.isArray(transactions) ? transactions : [])
      .filter((row) => row && isIsoDate(row.date) && Number.isFinite(Number(row.amount)))
      .map((row, index) => ({
        index, date: row.date.slice(0, 10), amount: round2(Number(row.amount)), movement: String(row.movement || row.concept || ""),
        accountId: String(row.accountId || row.account || "cuenta"), key: conceptKey(row),
        classified: row.mapping?.status === "classified", rowKey: row.mapping?.rowKey || "",
      }))
      .filter((row) => row.key)
      .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
  }

  function detectReturns(rows, recent, used) {
    const found = [];
    recent.filter((row) => row.amount > 0 && RETURN_RE.test(plain(row.movement))).forEach((row) => {
      const core = coreKey(row.key);
      const original = rows.filter((other) => other.amount < 0 && Math.abs(Math.abs(other.amount) - row.amount) < 0.005 && coreKey(other.key) === core
        && dayNumber(other.date) <= dayNumber(row.date) && dayNumber(row.date) - dayNumber(other.date) <= 45).pop();
      used.add(row.index);
      if (original) used.add(original.index);
      found.push({
        kind: "devolucion", row, id: `devolucion|${row.accountId}|${row.key}|${Math.round(row.amount * 100)}|${row.date}`, silenceKey: `devolucion|${row.key}`,
        evidence: [
          `El banco ha devuelto un recibo de ${eur(row.amount)} el ${shortDate(row.date)}: «${row.movement}».`,
          original ? `Devuelve el cargo de ${eur(original.amount)} del ${shortDate(original.date)} («${original.movement}»).` : "No encuentro el cargo original en los últimos 45 días.",
        ],
      });
    });
    return found;
  }

  function detectDuplicates(rows, recent, used, coveredUntil) {
    const clusters = new Map();
    recent.filter((row) => row.amount <= -MIN_DUPLICATE_AMOUNT && !used.has(row.index)).forEach((row) => {
      const key = `${row.accountId}|${row.key}|${Math.round(row.amount * 100)}`;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(row);
    });
    const found = [];
    clusters.forEach((list) => {
      let current = [list[0]];
      const groups = [];
      for (let index = 1; index < list.length; index += 1) {
        if (dayNumber(list[index].date) - dayNumber(current[current.length - 1].date) <= 1) current.push(list[index]);
        else { groups.push(current); current = [list[index]]; }
      }
      groups.push(current);
      groups.filter((group) => group.length >= 2).forEach((group) => {
        const inGroup = new Set(group.map((row) => row.index));
        // Costumbre del concepto (con cualquier importe): pares iguales con un día de diferencia como mucho que ya ocurrieron fuera de este grupo.
        const sameConcept = rows.filter((row) => row.accountId === group[0].accountId && row.key === group[0].key && row.amount < 0 && !inGroup.has(row.index));
        let others = 0;
        for (let i = 0; i < sameConcept.length; i += 1) {
          const next = sameConcept[i + 1];
          if (next && next.amount === sameConcept[i].amount && dayNumber(next.date) - dayNumber(sameConcept[i].date) <= 1) { others += 1; i += 1; }
        }
        if (others >= HABITUAL_REPEATS) return;
        group.forEach((row) => used.add(row.index));
        const first = group[0];
        found.push({
          kind: "duplicado", row: first, id: `duplicado|${first.accountId}|${first.key}|${Math.round(first.amount * 100)}|${first.date}`, silenceKey: `duplicado|${first.key}|${Math.round(first.amount * 100)}`,
          evidence: [
            `${group.length} cargos de ${eur(first.amount)} de «${first.movement}»: ${group.map((row) => shortDate(row.date)).join(" y ")}.`,
            others ? `Ya había pasado ${others} ${others === 1 ? "vez" : "veces"} antes: ${others === 1 ? "no es costumbre" : "no llega a ser costumbre"} (hacen falta ${HABITUAL_REPEATS}).` : "No había pasado antes con este concepto e importe.",
          ],
        });
      });
    });
    return found;
  }

  function detectCommissions(rows, recent, used, historyDays) {
    if (historyDays < MIN_HISTORY_DAYS) return [];
    const found = [];
    recent.filter((row) => row.amount < 0 && !used.has(row.index) && COMMISSION_RE.test(plain(row.movement))).forEach((row) => {
      const before = rows.filter((other) => other.key === row.key && other.amount < 0 && other.index !== row.index && dayNumber(other.date) < dayNumber(row.date));
      const base = { kind: "comision", row, id: `comision|${row.accountId}|${row.key}|${Math.round(-row.amount * 100)}|${row.date}`, silenceKey: `comision|${row.key}` };
      if (!before.length) {
        used.add(row.index);
        found.push({ ...base, evidence: [`Comisión de ${eur(row.amount)} el ${shortDate(row.date)}: «${row.movement}».`, `Es la primera vez que aparece este concepto en los ${historyDays} días de extracto que hay.`] });
        return;
      }
      if (before.length < 3) return;
      const typical = median(before.map((other) => Math.abs(other.amount)));
      if (Math.abs(row.amount) >= typical * (1 + COMMISSION_RISE) && Math.abs(row.amount) - typical >= 1) {
        used.add(row.index);
        found.push({ ...base, evidence: [`Comisión de ${eur(row.amount)} el ${shortDate(row.date)}: «${row.movement}».`, `Antes se cobraba ${eur(typical)} (${before.length} veces): sube un ${Math.round((Math.abs(row.amount) / typical - 1) * 100)} %.`] });
      }
    });
    return found;
  }

  function detectRecurringOutsidePlan(rows, recent, used, historyDays) {
    if (historyDays < MIN_HISTORY_DAYS) return [];
    const byKey = new Map();
    rows.filter((row) => row.amount < 0).forEach((row) => {
      if (!byKey.has(row.key)) byKey.set(row.key, []);
      byKey.get(row.key).push(row);
    });
    const recentIds = new Set(recent.map((row) => row.index));
    const found = [];
    byKey.forEach((list, key) => {
      const latest = list[list.length - 1];
      if (!recentIds.has(latest.index) || used.has(latest.index)) return;
      const months = [];
      list.forEach((row) => { const month = row.date.slice(0, 7); const last = months[months.length - 1]; if (last && last.month === month) last.rows.push(row); else months.push({ month, rows: [row] }); });
      const lastThree = months.slice(-3);
      const index = (month) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
      if (lastThree.length < 3 || index(lastThree[2].month) - index(lastThree[0].month) !== 2 || lastThree.some((entry) => entry.rows.length !== 1)) return;
      const amounts = lastThree.map((entry) => Math.abs(entry.rows[0].amount));
      const typical = median(amounts);
      if (!(typical > 0) || (Math.max(...amounts) - Math.min(...amounts)) / typical > RECURRING_SPREAD) return;
      if (lastThree.filter((entry) => !entry.rows[0].classified).length < 2) return;
      used.add(latest.index);
      found.push({
        kind: "recurrente", row: latest, id: `recurrente|${latest.accountId}|${key}`, silenceKey: `recurrente|${key}`,
        evidence: [
          `«${latest.movement}» se cobra todos los meses (${lastThree.map((entry) => shortDate(entry.rows[0].date)).join(", ")}) por unos ${eur(typical)}.`,
          "Ese cargo no está en ninguna partida de tu plan (sin partida).",
        ],
      });
    });
    return found;
  }

  function detectAtypical(rows, recent, used, historyDays) {
    if (historyDays < MIN_HISTORY_DAYS) return [];
    const found = [];
    recent.filter((row) => row.amount < 0 && !used.has(row.index)).forEach((row) => {
      const group = (candidate) => (row.classified && row.rowKey ? candidate.classified && candidate.rowKey === row.rowKey : !candidate.classified && candidate.key === row.key);
      const history = rows.filter((other) => other.amount < 0 && other.index !== row.index && dayNumber(other.date) < dayNumber(row.date) && group(other));
      if (history.length < ATYPICAL_MIN_OBSERVATIONS || new Set(history.map((other) => other.date.slice(0, 7))).size < ATYPICAL_MIN_MONTHS) return;
      const sorted = history.map((other) => Math.abs(other.amount)).sort((a, b) => a - b);
      const p95 = percentile(sorted, 0.95);
      // Un P95 a secas marca 1 de cada 20 por construcción: se exige además holgura relativa, absoluta y proporcional a lo dispersa que es la partida.
      const threshold = Math.max(p95 * ATYPICAL_FACTOR, p95 + ATYPICAL_MARGIN_EUR, p95 + 2 * (p95 - percentile(sorted, 0.5)));
      if (Math.abs(row.amount) <= threshold) return;
      used.add(row.index);
      found.push({
        kind: "atipico", row, id: `atipico|${row.accountId}|${row.key}|${Math.round(-row.amount * 100)}|${row.date}`, silenceKey: `atipico|${row.rowKey || row.key}`,
        evidence: [
          `Cargo de ${eur(row.amount)} el ${shortDate(row.date)}: «${row.movement}».`,
          `En esa partida, el 95 % de los ${history.length} cargos anteriores no pasa de ${eur(p95)}.`,
        ],
      });
    });
    return found;
  }

  /**
   * @param {{today?: string, transactions?: Array<Record<string, any>>, answers?: Record<string, any>, limit?: number}} [input]
   */
  function detect({ today, transactions, answers, limit } = {}) {
    if (!isIsoDate(today)) return { status: "missing", missing: ["la fecha de hoy"], items: [], overflow: 0, suppressed: 0, stats: statsOf(answers), coveredUntil: null };
    const rows = prepare(transactions);
    const stats = statsOf(answers);
    if (!rows.length) return { status: "stale", missing: [], items: [], overflow: 0, suppressed: 0, stats, coveredUntil: null };
    const coveredUntil = rows[rows.length - 1].date;
    if (dayNumber(today) - dayNumber(coveredUntil) > LOOKBACK_DAYS) return { status: "stale", missing: [], items: [], overflow: 0, suppressed: 0, stats, coveredUntil };
    const historyDays = dayNumber(coveredUntil) - dayNumber(rows[0].date);
    const todayNumber = dayNumber(today);
    const recent = rows.filter((row) => todayNumber - dayNumber(row.date) <= LOOKBACK_DAYS && dayNumber(row.date) <= todayNumber);
    const used = new Set();
    const candidates = [
      ...detectReturns(rows, recent, used),
      ...detectDuplicates(rows, recent, used),
      ...detectCommissions(rows, recent, used, historyDays),
      ...detectRecurringOutsidePlan(rows, recent, used, historyDays),
      ...detectAtypical(rows, recent, used, historyDays),
    ];
    const clean = normalizeAnswers(answers);
    let suppressed = 0;
    const visible = candidates.filter((candidate) => {
      const hidden = Boolean(clean.byId[candidate.id]) || Boolean(clean.silenced[candidate.silenceKey]);
      if (hidden) suppressed += 1;
      return !hidden;
    }).sort((a, b) => SEVERITY[b.kind] - SEVERITY[a.kind] || Math.abs(b.row.amount) - Math.abs(a.row.amount) || b.row.date.localeCompare(a.row.date));
    const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
    return {
      status: "ok", schemaId: SCHEMA_ID, missing: [], coveredUntil, suppressed, stats,
      items: visible.slice(0, max).map((candidate) => ({
        id: candidate.id, kind: candidate.kind, severity: SEVERITY[candidate.kind], date: candidate.row.date, amount: candidate.row.amount,
        label: candidate.row.movement, key: candidate.row.key, account: candidate.row.accountId, silenceKey: candidate.silenceKey, evidence: candidate.evidence,
      })),
      overflow: Math.max(0, visible.length - max),
    };
  }

  // La tasa de falsos positivos sale de lo que el hogar contesta: «es normal» = el aviso sobraba.
  function statsOf(answers) {
    const clean = normalizeAnswers(answers);
    const all = Object.values(clean.byId);
    const normal = all.filter((entry) => entry.response !== "real").length;
    return { answered: all.length, normal, real: all.length - normal, minAnswered: MIN_ANSWERS_FOR_RATE, falsePositiveRate: all.length >= MIN_ANSWERS_FOR_RATE ? round2(normal / all.length) : null };
  }

  return { SCHEMA_ID, LOOKBACK_DAYS, RESPONSES, SEVERITY, detect, normalizeAnswers, applyAnswer, conceptKey };
});
