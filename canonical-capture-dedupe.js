(function attachCanonicalCaptureDedupe(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalCaptureDedupe = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalCaptureDedupe() {
  "use strict";

  // WP-53 (CAP-10, docs/WP53_DISENO.md): el emparejamiento de lo que el hogar anota a mano con lo que luego trae el extracto, para que un
  // mismo pago no cuente dos veces. Motor puro: sin DOM, sin red, sin almacenamiento y sin reloj.
  //
  // La regla es del plan: IMPORTE EXACTO (al céntimo), FECHA a ±2 días y COMERCIO por similitud. Y manda el extracto: del par sale
  // siempre el importe y la fecha del banco, nunca los de la captura.
  //
  // Lo que NO hace, a propósito:
  //   · no empareja por importe aproximado (una propina o un redondeo no se adivinan: queda sin emparejar y se ve);
  //   · no empareja nada solo: devuelve parejas CON su confianza y quien llama pregunta;
  //   · «sin comercio comparable» no es «comercio distinto»: si falta el nombre de un lado, la similitud es null (dato ausente, no 0).

  const DEFAULT_DAYS = 2;
  const DEFAULT_MIN_SIMILARITY = 0.5;
  const MAX_LOG = 200;
  const LOG_KEEP_DAYS = 120;
  const MAX_CONCEPT = 60;
  const MAX_AMOUNT = 100000;
  const CHANNELS = ["ventana", "enlace"];

  // Ruido que los bancos añaden al nombre del comercio y que no identifica nada.
  const NOISE = new Set([
    "compra", "tarj", "tarjeta", "pago", "movil", "bizum", "recibo", "adeudo", "num", "nº", "sa", "sl", "slu", "sau", "cb", "scp",
    "comercio", "pos", "visa", "mastercard", "debito", "credito", "importe", "eur", "ref", "operacion", "trans", "transf", "transferencia",
    "cargo", "tpv", "apple", "google", "contactless", "web", "online", "www", "com", "es",
  ]);

  function text(value) {
    return String(value ?? "").trim();
  }

  function cents(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100);
  }

  function validIsoDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  function daysBetween(fromIso, toIso) {
    const parse = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
  }

  /** Las palabras que identifican al comercio: sin acentos, minúsculas, sin cifras sueltas ni ruido de banco. */
  function merchantTokens(value) {
    return text(value)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9ñ]+/g, " ")
      .split(" ")
      .filter((token) => token.length >= 2 && !/^\d+$/.test(token) && !NOISE.has(token));
  }

  function tokensMatch(a, b) {
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.length >= 4 && long.startsWith(short); // «carrefour» ~ «carrefourexpress»
  }

  /**
   * Parecido entre dos nombres de comercio, de 0 a 1 (Dice sobre palabras, con prefijos de 4+ letras), o null si de un lado no queda
   * ninguna palabra útil: no hay con qué comparar y eso no es lo mismo que «distinto».
   */
  function similarity(a, b) {
    const left = merchantTokens(a);
    const right = merchantTokens(b);
    if (!left.length || !right.length) return null;
    const used = new Set();
    let common = 0;
    left.forEach((token) => {
      const index = right.findIndex((other, position) => !used.has(position) && tokensMatch(token, other));
      if (index >= 0) { used.add(index); common += 1; }
    });
    let score = (2 * common) / (left.length + right.length);
    const glued = (tokens) => tokens.join("");
    const [shortGlue, longGlue] = glued(left).length <= glued(right).length ? [glued(left), glued(right)] : [glued(right), glued(left)];
    if (shortGlue.length >= 4 && longGlue.includes(shortGlue)) score = Math.max(score, 0.9); // «mercadona» dentro de «compra mercadonasa 1234»
    return Math.round(score * 100) / 100;
  }

  function normalizeSide(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = text(raw.id);
    const date = text(raw.date);
    const amount = Number(raw.amount);
    if (!id || !validIsoDate(date) || !Number.isFinite(amount) || amount === 0) return null;
    return { id, date, amount, concept: text(raw.concept), kind: text(raw.kind), monthKey: text(raw.monthKey) };
  }

  /**
   * Empareja capturas con filas del extracto, una a una.
   * @param {Array<{id: string, date: string, amount: number, concept?: string, kind?: string, monthKey?: string}>} captures
   * @param {Array<{id: string, date: string, amount: number, concept?: string}>} rows filas del extracto (importe con signo, como el banco)
   * @param {{days?: number, minSimilarity?: number}} [options]
   * @returns {{ pairs: Array<{captureId: string, rowId: string, days: number, similarity: number|null, confidence: "alta"|"media"}>, unpairedCaptures: string[], unpairedRows: string[] }}
   */
  function pairCaptures(captures, rows, options = {}) {
    const days = Number.isFinite(options.days) && options.days >= 0 ? Math.floor(options.days) : DEFAULT_DAYS;
    const minSimilarity = Number.isFinite(options.minSimilarity) ? options.minSimilarity : DEFAULT_MIN_SIMILARITY;
    const sides = (list) => (Array.isArray(list) ? list : []).map(normalizeSide).filter(Boolean);
    const left = sides(captures);
    const right = sides(rows);
    const candidates = [];
    left.forEach((capture) => {
      right.forEach((row) => {
        if (cents(capture.amount) !== cents(row.amount)) return; // importe EXACTO: el mismo signo y los mismos céntimos
        const gap = daysBetween(capture.date, row.date);
        if (Math.abs(gap) > days) return;
        const score = similarity(capture.concept, row.concept);
        candidates.push({ captureId: capture.id, rowId: row.id, days: gap, similarity: score, confidence: score !== null && score >= minSimilarity ? "alta" : "media" });
      });
    });
    const rank = (item) => (item.confidence === "alta" ? 0 : 1);
    candidates.sort((a, b) =>
      rank(a) - rank(b) ||
      (b.similarity ?? -1) - (a.similarity ?? -1) ||
      Math.abs(a.days) - Math.abs(b.days) ||
      a.captureId.localeCompare(b.captureId) ||
      a.rowId.localeCompare(b.rowId));
    const takenCaptures = new Set();
    const takenRows = new Set();
    const pairs = [];
    candidates.forEach((candidate) => {
      if (takenCaptures.has(candidate.captureId) || takenRows.has(candidate.rowId)) return; // una captura, una fila: dos cafés iguales no se funden
      takenCaptures.add(candidate.captureId);
      takenRows.add(candidate.rowId);
      pairs.push(candidate);
    });
    return {
      pairs,
      unpairedCaptures: left.filter((item) => !takenCaptures.has(item.id)).map((item) => item.id),
      unpairedRows: right.filter((item) => !takenRows.has(item.id)).map((item) => item.id),
    };
  }

  /** Lo que queda de un par: manda el extracto en importe y fecha. `changes` dice en qué se diferenciaban, para enseñarlo. */
  function resolvePair(capture, row) {
    const a = normalizeSide(capture);
    const b = normalizeSide(row);
    if (!a || !b) return null;
    const gap = daysBetween(a.date, b.date);
    return {
      amount: b.amount,
      date: b.date,
      concept: b.concept,
      captured: { amount: a.amount, date: a.date, concept: a.concept },
      changes: { days: gap, amount: cents(a.amount) !== cents(b.amount) },
    };
  }

  const CONFIDENCE_LABEL = Object.freeze({ alta: "Misma compra probable", media: "Mismo importe y fecha cercana, comercio distinto o sin nombre" });

  /** La frase que explica el par al hogar. Siempre dice por qué se propone y qué conservará. */
  function describePair(pair) {
    if (!pair) return "";
    const when = pair.days === 0 ? "el mismo día" : `${Math.abs(pair.days)} día${Math.abs(pair.days) === 1 ? "" : "s"} ${pair.days > 0 ? "después" : "antes"} de anotarlo`;
    const shop = pair.similarity === null ? "sin nombre de comercio comparable" : `comercio parecido en un ${Math.round(pair.similarity * 100)} %`;
    return `${CONFIDENCE_LABEL[pair.confidence] || ""}: mismo importe, ${when}, ${shop}.`;
  }

  // ---- El registro de capturas que no dejan movimiento ----------------------------------------------------------------------------------
  // «Registrar gasto» (FLU-2) y el enlace de WP-25 sin tarjetas crean una PARTIDA con su real, no un movimiento, y no guardaban la fecha ni
  // cuándo se anotó. Para poder emparejarlas con el extracto, cada una deja aquí una entrada: lo anotado, no un dato nuevo.

  function normalizeLogEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = text(raw.id);
    const rowId = text(raw.rowId);
    const monthKey = text(raw.monthKey);
    const date = text(raw.date);
    const amount = Number(raw.amount);
    const concept = text(raw.concept).replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").slice(0, MAX_CONCEPT);
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(id) || !/^[A-Za-z0-9_.:-]{1,80}$/.test(rowId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return null;
    if (!validIsoDate(date) || !concept || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > MAX_AMOUNT) return null;
    return {
      id, rowId, monthKey, date, concept, amount: Math.round(amount * 100) / 100,
      channel: CHANNELS.includes(raw.channel) ? raw.channel : "ventana",
      capturedAt: Number.isFinite(Date.parse(text(raw.capturedAt))) ? text(raw.capturedAt) : "",
    };
  }

  function normalizeLog(raw) {
    const list = Array.isArray(raw?.entries) ? raw.entries : Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const entries = [];
    list.forEach((item) => {
      const entry = normalizeLogEntry(item);
      if (entry && !seen.has(entry.id)) { seen.add(entry.id); entries.push(entry); }
    });
    return { entries: entries.slice(-MAX_LOG) };
  }

  /** Añade una entrada y poda las de más de 120 días (un extracto que llega más tarde ya no se empareja con una captura tan vieja). */
  function appendLog(log, entry, today) {
    const clean = normalizeLogEntry(entry);
    if (!clean) return normalizeLog(log);
    const limit = validIsoDate(today) ? new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) - LOG_KEEP_DAYS)).toISOString().slice(0, 10) : "";
    const kept = normalizeLog(log).entries.filter((item) => item.id !== clean.id && (!limit || item.date >= limit));
    return { entries: [...kept, clean].slice(-MAX_LOG) };
  }

  return Object.freeze({
    DEFAULT_DAYS, DEFAULT_MIN_SIMILARITY, MAX_LOG, LOG_KEEP_DAYS, CONFIDENCE_LABEL,
    merchantTokens, similarity, pairCaptures, resolvePair, describePair, normalizeLog, normalizeLogEntry, appendLog,
  });
});
