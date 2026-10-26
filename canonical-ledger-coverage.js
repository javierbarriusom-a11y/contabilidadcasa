// XDA-04 · PR-1 (26/10/2026): cobertura del libro por cuenta. Qué días ha visto la app en un extracto de cada cuenta, qué
// huecos quedan y si una fecha (o un periodo) está cubierta. Motor puro: no lee el navegador ni el libro; recibe rangos.
//
// Por qué rangos y no «el último movimiento»: un día sin movimientos no es un día sin cubrir, y una sola fecha global
// (lo de antes) daba por visto el día 15 si se importó del 1 al 10 y del 20 al 31, o daba Mediolanum por al día porque
// CaixaBank lo estaba. Cada importación guarda el periodo que cubre su extracto (deducido de sus movimientos y
// confirmado por el hogar antes de importar); lo importado antes de existir este registro cuenta como «estimado», del
// primer al último movimiento de cada cuenta.
//
// Rango: { account, from, to, source: "declarado" | "deducido" | "estimado", recordedAt?, fileName? } con fechas ISO
// (AAAA-MM-DD) e inclusivas. Sin importes ni conceptos.
(function exposeLedgerCoverage(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceCanonicalLedgerCoverage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const SCHEMA_ID = "finance-xda04-ledger-coverage/v1";
  const SOURCES = Object.freeze(["declarado", "deducido", "estimado"]);
  const MAX_RANGES = 400; // años de importaciones semanales; lo más viejo sobra

  const isIso = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  const dayNumber = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
  const isoOf = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  const addDays = (iso, days) => isoOf(dayNumber(iso) + days);

  function normalizeRange(raw) {
    if (!raw || typeof raw !== "object") return null;
    const account = String(raw.account || "").trim().slice(0, 40);
    if (!account || !isIso(raw.from) || !isIso(raw.to) || raw.from > raw.to) return null;
    const range = { account, from: raw.from, to: raw.to, source: SOURCES.includes(raw.source) ? raw.source : "deducido" };
    if (typeof raw.recordedAt === "string") range.recordedAt = raw.recordedAt.slice(0, 30);
    if (typeof raw.fileName === "string" && raw.fileName) range.fileName = raw.fileName.slice(0, 80);
    return range;
  }

  // Lectura tolerante: una copia vieja o corrupta da un registro vacío, nunca un error.
  function normalizeStore(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const ranges = (Array.isArray(value.ranges) ? value.ranges : []).map(normalizeRange).filter(Boolean).slice(-MAX_RANGES);
    return { version: 1, ranges };
  }

  // Del primer al último movimiento de unas filas (las de un extracto, o las de una cuenta): lo único que se puede deducir.
  function deduce(rows) {
    const dates = (Array.isArray(rows) ? rows : []).map((row) => String(row?.date || "").slice(0, 10)).filter(isIso).sort();
    return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null;
  }

  // Los rangos de una cuenta, ordenados y unidos (también los contiguos: del 1 al 10 y del 11 al 20 son del 1 al 20).
  function merged(ranges, account) {
    const list = (Array.isArray(ranges) ? ranges : []).map(normalizeRange).filter((r) => r && r.account === account).sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    const out = [];
    list.forEach((r) => {
      const last = out[out.length - 1];
      if (last && dayNumber(r.from) <= dayNumber(last.to) + 1) {
        if (r.to > last.to) last.to = r.to;
        if (r.source !== "estimado") last.estimado = false;
      } else {
        out.push({ from: r.from, to: r.to, estimado: r.source === "estimado" });
      }
    });
    return out;
  }

  // ¿Está cubierto entero el periodo [from, to] en esa cuenta?
  function covers(ranges, account, from, to = from) {
    if (!isIso(from) || !isIso(to) || from > to) return false;
    return merged(ranges, account).some((r) => r.from <= from && r.to >= to);
  }

  // Huecos dentro de [from, to] en esa cuenta (periodos sin cubrir, inclusivos).
  function gaps(ranges, account, from, to) {
    if (!isIso(from) || !isIso(to) || from > to) return [];
    const out = [];
    let cursor = from;
    merged(ranges, account).forEach((r) => {
      if (r.to < cursor || r.from > to) return;
      if (r.from > cursor) out.push({ from: cursor, to: addDays(r.from, -1) < to ? addDays(r.from, -1) : to });
      if (r.to >= cursor) cursor = addDays(r.to, 1);
    });
    if (cursor <= to) out.push({ from: cursor, to });
    return out;
  }

  // Un mes en una cuenta: hasta hoy si es el mes en curso. `complete` si no queda ningún hueco.
  function month(ranges, account, monthKey, today) {
    if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return null;
    const first = `${monthKey}-01`;
    const [y, m] = monthKey.split("-").map(Number);
    const last = isoOf(dayNumber(`${String(m === 12 ? y + 1 : y).padStart(4, "0")}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`) - 1);
    const end = isIso(today) && today < last ? today : last;
    if (end < first) return { account, monthKey, from: first, to: end, gaps: [], complete: true, nothing: false, estimado: false };
    const holes = gaps(ranges, account, first, end);
    const inside = merged(ranges, account).filter((r) => r.to >= first && r.from <= end);
    return { account, monthKey, from: first, to: end, gaps: holes, complete: holes.length === 0, nothing: inside.length === 0, estimado: inside.some((r) => r.estimado) };
  }

  // Lo importado antes de este registro: por cuenta, del primer al último movimiento de extracto, como «estimado».
  function estimateFromLedger(rows, accountOf) {
    const byAccount = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const account = accountOf(row);
      const date = String(row?.date || "").slice(0, 10);
      if (!account || !isIso(date)) return;
      const r = byAccount.get(account) || { account, from: date, to: date, source: "estimado" };
      if (date < r.from) r.from = date;
      if (date > r.to) r.to = date;
      byAccount.set(account, r);
    });
    return [...byAccount.values()];
  }

  // Añade el rango de una importación; no duplica uno idéntico de la misma cuenta.
  function addRange(store, range) {
    const s = normalizeStore(store);
    const r = normalizeRange(range);
    if (!r) return s;
    if (!s.ranges.some((x) => x.account === r.account && x.from === r.from && x.to === r.to && x.source === r.source)) s.ranges.push(r);
    s.ranges = s.ranges.slice(-MAX_RANGES);
    return s;
  }

  return { SCHEMA_ID, SOURCES, MAX_RANGES, isIso, addDays, normalizeRange, normalizeStore, deduce, merged, covers, gaps, month, estimateFromLedger, addRange };
});
