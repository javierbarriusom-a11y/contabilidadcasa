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

  // ---------- XDA-04 · PR-2 (12/11/2026): la tira de los últimos N días por cuenta ----------
  //
  // Tres clases de día, como la referencia (docs/rediseno/referencias/html/Movimientos.html):
  // - «cubierto»: algún extracto lo ha visto (`estimado` si solo lo ve lo importado antes del registro);
  // - «hueco»: sin ver, con días vistos antes y después: falta un extracto en medio;
  // - «sin-dato»: sin ver, antes del primer extracto de la cuenta o después del último (lo de después es lo normal entre
  //   un extracto y el siguiente; no es un hueco hasta que llega un extracto posterior).
  // Se clasifica con la historia entera de la cuenta, no solo la ventana: un hueco que empieza antes de la ventana sigue
  // siendo un hueco.
  const daysIn = (from, to) => dayNumber(to) - dayNumber(from) + 1;
  const maxIso = (a, b) => (a > b ? a : b);
  const minIso = (a, b) => (a < b ? a : b);

  function strip(ranges, account, today, days = 90) {
    if (!isIso(today) || !(days >= 1)) return null;
    const from = addDays(today, -(Math.round(days) - 1));
    const all = merged(ranges, account).filter((r) => r.from <= today);
    const firmes = merged((Array.isArray(ranges) ? ranges : []).filter((r) => r && r.source !== "estimado"), account);
    const segments = [];
    const push = (kind, a, b, extra = {}) => {
      const s = maxIso(a, from);
      const e = minIso(b, today);
      if (s > e) return;
      const last = segments[segments.length - 1];
      if (last && last.kind === kind && !!last.estimado === !!extra.estimado && dayNumber(last.to) + 1 === dayNumber(s)) {
        last.to = e;
        last.days = daysIn(last.from, last.to);
        return;
      }
      segments.push({ kind, from: s, to: e, days: daysIn(s, e), ...extra });
    };
    let cursor = "";
    if (!all.length) push("sin-dato", from, today);
    all.forEach((r, i) => {
      if (i === 0 && r.from > from) push("sin-dato", from, addDays(r.from, -1));
      if (i > 0) push("hueco", addDays(all[i - 1].to, 1), addDays(r.from, -1));
      // Dentro de lo cubierto, lo que solo ve lo «estimado» se marca aparte: `merged` lo pierde en cuanto un rango
      // estimado toca uno declarado, y la tira no debe pintar como visto en un extracto lo que solo se supone.
      let c = r.from;
      firmes.filter((f) => f.to >= r.from && f.from <= r.to).forEach((f) => {
        if (f.from > c) push("cubierto", c, addDays(f.from, -1), { estimado: true });
        push("cubierto", maxIso(f.from, c), minIso(f.to, r.to));
        c = addDays(minIso(f.to, r.to), 1);
      });
      if (c <= r.to) push("cubierto", c, r.to, { estimado: true });
      cursor = r.to;
    });
    if (all.length && cursor < today) push("sin-dato", addDays(cursor, 1), today);
    const huecos = segments.filter((s) => s.kind === "hueco");
    const ultimo = all.length ? minIso(all[all.length - 1].to, today) : "";
    const pendiente = ultimo && ultimo < today ? { from: addDays(ultimo, 1), to: today, days: daysIn(addDays(ultimo, 1), today) } : null;
    // Lo que conviene importar: un solo extracto del primer hueco hasta hoy (en el banco se exporta un periodo, no
    // varios). Sin huecos, lo que va del último extracto a hoy. Sin extractos, nada que sugerir: la tira dice
    // «sin extractos» y lleva a Importar igual.
    const sugerencia = huecos.length ? { from: huecos[0].from, to: pendiente ? today : huecos[huecos.length - 1].to } : pendiente ? { from: pendiente.from, to: today } : null;
    return {
      account,
      from,
      to: today,
      days: Math.round(days),
      segments,
      huecos,
      diasHueco: huecos.reduce((n, s) => n + s.days, 0),
      diasCubiertos: segments.filter((s) => s.kind === "cubierto").reduce((n, s) => n + s.days, 0),
      estimado: segments.some((s) => s.kind === "cubierto" && s.estimado),
      sinExtractos: all.length === 0,
      ultimo,
      pendiente,
      sugerencia,
    };
  }

  // Qué cambia en una cuenta si se añade el rango de un extracto: los huecos que cierra, los que abre (el extracto
  // empieza después del día siguiente al último visto) y hasta cuándo queda cubierta. Para «Cobertura tras importar».
  function afterImport(ranges, range, today, days = 90) {
    const r = normalizeRange(range);
    if (!r || !isIso(today)) return null;
    const before = strip(ranges, r.account, today, days);
    const after = strip([...(Array.isArray(ranges) ? ranges : []), r], r.account, today, days);
    const cierra = before.huecos
      .map((h) => ({ from: maxIso(h.from, r.from), to: minIso(h.to, r.to) }))
      .filter((h) => h.from <= h.to)
      .map((h) => ({ ...h, days: daysIn(h.from, h.to) }));
    const yaEran = new Set(before.huecos.map((h) => `${h.from}|${h.to}`));
    const abre = after.huecos.filter((h) => !yaEran.has(`${h.from}|${h.to}`) && !before.huecos.some((b) => b.from <= h.from && b.to >= h.to));
    return { account: r.account, before, after, cierra, abre, primero: before.sinExtractos, hasta: after.ultimo, quedan: after.huecos.length };
  }

  // Los días que una función que mira el extracto (anomalías, WP-36; deuda en la sombra, WP-41) no ha podido mirar en
  // [from, to]: por cuenta, lo que no ve ningún extracto desde el primero de esa cuenta. Las cuentas sin ningún extracto
  // no salen (eso lo dice la tira, «sin extractos»): aquí solo se avisa de lo que falta en medio o al final.
  function unseen(ranges, accounts, from, to) {
    if (!isIso(from) || !isIso(to) || from > to) return [];
    return (Array.isArray(accounts) ? accounts : []).map((account) => {
      const all = merged(ranges, account);
      if (!all.length) return null;
      const start = maxIso(from, all[0].from);
      if (start > to) return null;
      const holes = gaps(ranges, account, start, to);
      return holes.length ? { account, gaps: holes.map((h) => ({ ...h, days: daysIn(h.from, h.to) })) } : null;
    }).filter(Boolean);
  }

  return { SCHEMA_ID, SOURCES, MAX_RANGES, isIso, addDays, normalizeRange, normalizeStore, deduce, merged, covers, gaps, month, estimateFromLedger, addRange, strip, afterImport, unseen };
});
