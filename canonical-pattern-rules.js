/**
 * canonical-pattern-rules.js
 *
 * CLA-01 y CLA-02 (docs/PROPUESTA_NOVENA_AUDITORIA_2026-11-14.md §4.2; 15/11/2026, «seguimos con el backlog»). Una regla de
 * Clasificar se guarda por concepto exacto. Eso deja fuera justo lo que más grupos sin propuesta da: el Bizum a una persona
 * (cada uno lleva su texto libre) y el recibo cuyo concepto trae una referencia que cambia cada mes. Cada mes son un
 * concepto nuevo, sin regla y sin propuesta.
 *
 * Una regla por palabras reconoce el movimiento por lo que NO cambia:
 *
 *   · las palabras que lo identifican (el nombre de la persona, el del emisor del recibo), todas presentes en el
 *     concepto o en el detalle, en cualquier orden;
 *   · y, si el hogar lo pide, un importe parecido (± 10 %, con un mínimo de 1 €): es lo que separa el recibo de la luz
 *     de otro cargo del mismo emisor.
 *
 * Las palabras las propone el motor (las comunes a todos los movimientos del grupo, sin las que dicen cómo se pagó, sin
 * números y sin meses) y las decide el hogar: el formato de cada banco es distinto y aquí no se adivina quién es quién.
 *
 * Se guardan en el mismo diccionario de reglas (movementMappings), con una clave propia («patron|gasto|palabras»), así que
 * viajan con la copia de seguridad y con la sincronización sin almacén nuevo. Ganan a la coincidencia de nombre, pero
 * pierden ante una regla del concepto exacto o un ajuste de «solo este movimiento» (app.js, mappingForMovement).
 *
 * Lo que NO hace, a propósito: las reglas no miran el día del mes, la periodicidad ni la cuenta (CLA-01 los nombraba). Un
 * recibo se adelanta por un festivo y el mismo emisor cobra en varias cuentas; con el importe basta para distinguir, y lo
 * que no encaja sigue saliendo en la bandeja para clasificarlo a mano. El día y la periodicidad sí sirven para PROPONER
 * (DEC-14, `recurring`): nunca se guardan como regla. Motor puro: sin DOM, red ni almacenamiento.
 */
(function attachCanonicalPatternRules(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPatternRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalPatternRulesFactory() {
  "use strict";

  const SCHEMA_ID = "finance-pattern-rules/v1";
  const PREFIX = "patron";
  const TOLERANCE = 0.1;
  const MIN_EUROS = 1;
  const MAX_WORDS = 6;

  // Palabras que dicen cómo se pagó o son relleno, no a quién: no identifican nada (las mismas de Clasificar, más
  // preposiciones y las fórmulas de los recibos y los traspasos).
  const GENERIC = new Set(
    (
      "compra compras pago pagos tarj tarjeta credito debito visa mastercard recibo recibos domiciliacion domiciliado " +
      "transferencia transferencias transf trf traspaso bizum enviado enviada recibido recibida cargo adeudo abono tpv " +
      "cuota comision operacion ref referencia num numero concepto favor orden ordenante beneficiario inmediata sepa " +
      "con del las los por para www com una uno unos unas que sus este esta"
    ).split(" "),
  );
  const MONTHS = new Set(
    "enero febrero marzo abril mayo junio julio agosto septiembre setiembre septiemb octubre noviembre noviembr diciembre diciembr".split(" "),
  );
  const TYPES = [
    { type: "bizum", list: ["bizum"] },
    { type: "transferencia", list: ["transferencia", "transferencias", "transf", "trf", "traspaso"] },
    { type: "recibo", list: ["recibo", "recibos", "domiciliacion", "adeudo"] },
  ];

  function fold(text) {
    return String(text ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  function words(text) {
    return fold(text).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  }

  function rowWords(row) {
    return words(`${row?.movement || ""} ${row?.details || ""}`);
  }

  // Una palabra identifica si tiene 3 letras o más, ninguna cifra (las referencias cambian) y no es genérica ni un mes.
  function identifies(word) {
    return word.length >= 3 && /^[a-z]+$/.test(word) && !GENERIC.has(word) && !MONTHS.has(word);
  }

  function kindOf(amount) {
    return Number(amount || 0) >= 0 ? "income" : "expense";
  }

  function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return round2(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
  }

  // Cómo se pagó, por si la pantalla quiere decirlo: «bizum», «transferencia», «recibo» o «» (un comercio).
  function typeOf(row) {
    const set = new Set(rowWords(row));
    return TYPES.find(({ list }) => list.some((word) => set.has(word)))?.type || "";
  }

  /**
   * Lo que entiende el motor de lo que teclea el hogar: palabras que identifican, sin repetir, como mucho seis.
   * @param {string | string[]} input
   * @returns {string[]}
   */
  function cleanWords(input) {
    const list = Array.isArray(input) ? input.flatMap((item) => words(item)) : words(input);
    return [...new Set(list.filter(identifies))].slice(0, MAX_WORDS);
  }

  // Las palabras que identifican y están en TODOS los movimientos del grupo, en el orden del más reciente.
  function candidateWords(rows) {
    const list = (rows || []).filter(Boolean);
    if (!list.length) return [];
    const latest = [...list].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
    const sets = list.map((row) => new Set(rowWords(row)));
    return cleanWords(rowWords(latest).filter((word) => sets.every((set) => set.has(word))));
  }

  // El importe típico del grupo (mediana, en positivo) y si todos sus movimientos caben en la tolerancia.
  function amountProfile(rows, tolerance = TOLERANCE) {
    const amounts = (rows || []).map((row) => Math.abs(Number(row?.amount))).filter((value) => value > 0);
    const typical = median(amounts);
    const margin = Math.max(typical * tolerance, MIN_EUROS);
    return { typical, steady: amounts.length > 0 && amounts.every((value) => Math.abs(value - typical) <= margin), count: amounts.length };
  }

  function keyFor(kind, list) {
    return `${PREFIX}|${kind}|${[...list].sort().join(" ")}`;
  }

  /**
   * La entrada del diccionario: { key, value }, o null si no quedan palabras que identifiquen.
   * @param {{ kind?: string, words?: string | string[], rowKey?: string, label?: string, amount?: number | null, tolerance?: number, now?: string }} [options]
   */
  function build({ kind = "", words: input = "", rowKey = "", label = "", amount = null, tolerance = TOLERANCE, now = "" } = {}) {
    const list = cleanWords(input);
    if (!list.length || !rowKey || (kind !== "income" && kind !== "expense")) return null;
    const typical = Number(amount) > 0 ? round2(Math.abs(Number(amount))) : null;
    return {
      key: keyFor(kind, list),
      value: { kind, rowKey, label, updatedAt: now, patron: { palabras: list, ...(typical ? { importe: typical, tolerancia: tolerance } : {}) } },
    };
  }

  function isPatternKey(key) {
    return String(key || "").startsWith(`${PREFIX}|`);
  }

  // Las reglas por palabras de un diccionario. Las palabras salen de la clave: si la sincronización perdiera el campo
  // «patron», la regla seguiría reconociendo por palabras (sin el importe), que es lo que dice su clave.
  function rulesOf(mappings) {
    const rules = [];
    Object.entries(mappings || {}).forEach(([key, value]) => {
      if (!isPatternKey(key) || !value?.rowKey) return;
      const [, kind, text = ""] = key.split("|");
      const list = text.split(" ").filter(Boolean);
      if (!list.length || value.kind !== kind) return;
      const amount = Number(value.patron?.importe) > 0 ? Number(value.patron.importe) : null;
      // Para decirla, en el orden en que la escribió el hogar; si el campo no cuadra con la clave, manda la clave.
      const typed = Array.isArray(value.patron?.palabras) ? value.patron.palabras.map(String) : [];
      const shown = (typed.length === list.length && typed.every((word) => list.includes(word)) ? typed : list).join(" ").toUpperCase();
      rules.push({ key, kind, words: list, shown, rowKey: value.rowKey, label: value.label || "", updatedAt: value.updatedAt || "", amount, tolerance: Number(value.patron?.tolerancia) > 0 ? Number(value.patron.tolerancia) : TOLERANCE });
    });
    return rules;
  }

  function matches(rule, row, wordSet = null) {
    if (!rule || !row || !Number(row.amount) || kindOf(row.amount) !== rule.kind) return false;
    const set = wordSet || new Set(rowWords(row));
    if (!rule.words.every((word) => set.has(word))) return false;
    if (rule.amount === null || rule.amount === undefined) return true;
    return Math.abs(Math.abs(Number(row.amount)) - rule.amount) <= Math.max(rule.amount * rule.tolerance, MIN_EUROS);
  }

  // La regla que manda si encajan varias: la más concreta (más palabras; a igualdad, la que pide importe) y, si no, la última.
  function best(rules, row) {
    const set = new Set(rowWords(row));
    return (
      (rules || [])
        .filter((rule) => matches(rule, row, set))
        .sort((a, b) => b.words.length - a.words.length || Number(b.amount !== null) - Number(a.amount !== null) || String(b.updatedAt).localeCompare(String(a.updatedAt)))[0] || null
    );
  }

  // Lo que la regla cogería ahora de una lista de movimientos (para decirlo ANTES de crearla).
  function preview(rule, rows) {
    const hit = (rows || []).filter((row) => matches(rule, row));
    return { rows: hit, count: hit.length, total: round2(hit.reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0)) };
  }

  /**
   * CLA-03 (15/11/2026) · «Como lo que ya clasificasteis». La partida del movimiento ya clasificado que más se parece: el
   * que comparte más palabras que identifican y, a igualdad, el de importe parecido. Solo propone; nunca es confianza alta,
   * porque no es una regla del hogar sino un parecido.
   * @param {Record<string, any>} row el movimiento sin partida
   * @param {Array<{ row: Record<string, any>, rowKey: string, words?: Set<string> }>} classified movimientos con partida (y, si se tienen, sus palabras ya calculadas)
   * @returns {{ rowKey: string, shared: string[], alike: boolean, count: number, tie: boolean, confidence: "media" | "baja" } | null}
   */
  function nearest(row, classified, tolerance = TOLERANCE) {
    const kind = kindOf(row?.amount);
    const target = rowWords(row).filter(identifies);
    if (!target.length || !Number(row?.amount)) return null;
    const amount = Math.abs(Number(row.amount));
    const byRow = new Map();
    (classified || []).forEach((item) => {
      if (!item?.rowKey || !item.row || kindOf(item.row.amount) !== kind) return;
      const set = item.words || new Set(rowWords(item.row));
      const shared = target.filter((word) => set.has(word));
      if (!shared.length) return;
      const alike = Math.abs(Math.abs(Number(item.row.amount)) - amount) <= Math.max(amount * tolerance, MIN_EUROS);
      const score = shared.length * 2 + (alike ? 1 : 0);
      const best = byRow.get(item.rowKey);
      if (!best || score > best.score) byRow.set(item.rowKey, { rowKey: item.rowKey, score, shared, alike, count: 1 });
      else if (score === best.score) best.count += 1;
    });
    const ranked = [...byRow.values()].sort((a, b) => b.score - a.score || b.count - a.count);
    const top = ranked[0];
    if (!top) return null;
    const tie = ranked.length > 1 && ranked[1].score === top.score;
    const confidence = !tie && (top.shared.length >= 2 || top.alike) ? "media" : "baja";
    return { rowKey: top.rowKey, shared: [...new Set(top.shared)], alike: top.alike, count: top.count, tie, confidence };
  }

  const RECURRING_DAYS = 3;
  const RECURRING_MONTHS = 2;

  // Día del mes (1-31) y mes («2026-10») de una fecha «AAAA-MM-DD»; null si no lo es.
  function dayAndMonth(date) {
    const match = /^(\d{4}-\d{2})-(\d{2})/.exec(String(date || ""));
    return match ? { month: match[1], day: Number(match[2]) } : null;
  }

  // Días entre dos días del mes, dando la vuelta al cambio de mes (el 30 y el 1 están a 1-2 días, no a 29).
  function dayDistance(a, b) {
    const diff = Math.abs(a - b);
    return Math.min(diff, 31 - diff);
  }

  /**
   * DEC-14 (décima auditoría §4.3; 20/11/2026, «sigue con todo lo que puedas que no depende de nosotros») · el recibo que
   * llega cada mes con el mismo importe y hacia el mismo día, aunque el concepto cambie entero (otra referencia, otro
   * texto del banco). La partida a la que el hogar ya llevó, en dos meses distintos o más, un movimiento del mismo signo
   * con importe ± 10 % (mínimo 1 €) y a ± 3 días del mismo día del mes. Solo propone, y como mucho con confianza media: es
   * una coincidencia de calendario, no una regla del hogar. Si encajan dos partidas o más, empate (la pantalla no propone).
   * @param {Record<string, any>} row el movimiento sin partida (el más reciente del grupo)
   * @param {Array<{ row: Record<string, any>, rowKey: string }>} classified movimientos con partida
   * @returns {{ rowKey: string, months: number, day: number, amount: number, tie: boolean, confidence: "media" | "baja" } | null}
   */
  function recurring(row, classified, { tolerance = TOLERANCE, days = RECURRING_DAYS, minMonths = RECURRING_MONTHS } = {}) {
    const when = dayAndMonth(row?.date);
    const amount = Math.abs(Number(row?.amount));
    if (!when || !(amount > 0)) return null;
    const kind = kindOf(row.amount);
    const margin = Math.max(amount * tolerance, MIN_EUROS);
    const byRow = new Map();
    (classified || []).forEach((item) => {
      if (!item?.rowKey || !item.row || kindOf(item.row.amount) !== kind) return;
      const other = dayAndMonth(item.row.date);
      const otherAmount = Math.abs(Number(item.row.amount));
      if (!other || other.month === when.month || !(otherAmount > 0)) return;
      if (Math.abs(otherAmount - amount) > margin || dayDistance(other.day, when.day) > days) return;
      const entry = byRow.get(item.rowKey) || { rowKey: item.rowKey, months: new Set(), daysSeen: [], amounts: [] };
      entry.months.add(other.month);
      entry.daysSeen.push(other.day);
      entry.amounts.push(otherAmount);
      byRow.set(item.rowKey, entry);
    });
    const ranked = [...byRow.values()].filter((entry) => entry.months.size >= minMonths).sort((a, b) => b.months.size - a.months.size);
    const top = ranked[0];
    if (!top) return null;
    const tie = ranked.length > 1;
    return { rowKey: top.rowKey, months: top.months.size, day: Math.round(median(top.daysSeen)), amount: median(top.amounts), tie, confidence: tie ? "baja" : "media" };
  }

  return { SCHEMA_ID, PREFIX, TOLERANCE, MIN_EUROS, MAX_WORDS, RECURRING_DAYS, RECURRING_MONTHS, words, rowWords, typeOf, cleanWords, candidateWords, amountProfile, keyFor, build, isPatternKey, rulesOf, matches, best, preview, nearest, recurring };
});
