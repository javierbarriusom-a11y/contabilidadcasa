(function attachCanonicalPayrollSplit(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPayrollSplit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalPayrollSplitFactory() {
  "use strict";

  // WP-47 (NPV-05, docs/WP47_DISENO.md): el reparto de la nómina en un paso. Dada una nómina confirmada y lo que la escalera del próximo euro (WP-42) propone, esto calcula:
  //   · availableToSplit: cuánto de esa nómina se puede repartir SIN que la liquidez baje del suelo en los próximos días (la banda de caja de WP-16).
  //   · rowsFromLadder: las filas de la escalera como importes editables, con una fila «sin repartir» que absorbe la diferencia.
  //   · moveAmount / setRowAmount: los «steppers»: mover dinero entre una fila y «sin repartir» NUNCA cambia el total repartible ni deja un importe negativo.
  //   · transferList + borradores: la lista de transferencias a hacer a mano, con su casilla «hecha».
  // Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj. NUNCA ejecuta nada ni registra un movimiento (A11-4): propone y apunta.
  //
  // Reglas de honestidad:
  //   · el disponible es el MENOR entre la nómina y la holgura sobre el suelo; si no se puede comprobar la holgura, se dice y se usa la nómina entera marcada «sin comprobar».
  //   · la banda solo recoge la incertidumbre de las FECHAS y mira 30 días: un gasto más caro de lo previsto o un pago a 45 días no están (se dice en la tarjeta).
  //   · lo que la escalera no propone se puede añadir a mano, pero queda marcado «distinto de lo sugerido».
  //   · una transferencia «hecha» es una casilla que marca el hogar: la app no sabe si se hizo.

  const SCHEMA_ID = "finance-payroll-split/v1";
  const DEFAULT_STEP = 50;
  const MAX_DRAFTS = 12;
  const GROUP_ORDER = Object.freeze(["cushion", "debt", "pension", "invest"]);

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const typeLabel = (type) => text(type).replace(/_/g, " ");
  /** ¿Es una partida de nómina? Sin acentos ni mayúsculas, palabra entera: «Nómina Javi», «salario Tere», «sueldo»; no «nominal» ni «ingreso». */
  function isPayrollLabel(label) {
    const plain = text(label).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return /\b(nominas?|salarios?|sueldos?)\b/.test(plain);
  }

  /**
   * Cuánto se puede repartir de las nóminas confirmadas. `headroom` es la holgura sobre el suelo en el peor punto de la banda de caja (puede ser negativa); null si no se pudo calcular.
   * `earmarked` es lo que ya está apuntado en borradores abiertos y todavía no se refleja en los saldos: se descuenta de la holgura para no repartir dos veces el mismo dinero.
   * @param {{payrolls?: Array<{id?: string, label?: string, amount?: number}>, headroom?: number|null, earmarked?: number}} [params]
   */
  function availableToSplit({ payrolls = [], headroom = null, earmarked = 0 } = {}) {
    const list = (Array.isArray(payrolls) ? payrolls : []).filter((item) => item && text(item.id) && known(item.amount) && number(item.amount) > 0);
    const gross = round2(list.reduce((sum, item) => sum + number(item.amount), 0));
    if (!list.length) return { status: "no-payroll", gross: 0, available: 0, basis: "none", limitedBy: null, headroom: null, payrolls: [], notes: [] };
    if (!known(headroom)) {
      return {
        status: "ok", gross, available: gross, basis: "payroll-only", limitedBy: null, headroom: null, payrolls: list,
        notes: ["No he podido comprobar que la liquidez siga por encima del suelo si repartes esto (falta el suelo, los saldos o los movimientos fechados): el disponible es la nómina entera, SIN comprobar."],
      };
    }
    const pending = Math.max(0, round2(number(earmarked)));
    const room = round2(Math.max(0, number(headroom) - pending));
    const available = round2(Math.min(gross, room));
    const limitedBy = room < gross ? "floor" : "payroll";
    const notes = [];
    if (pending > 0) notes.push(`Ya hay ${pending} € apuntados en borradores abiertos que aún no se reflejan en los saldos: se descuentan de la holgura para no repartir dos veces el mismo dinero.`);
    if (limitedBy === "floor") notes.push(`La nómina es de ${gross} €, pero solo caben ${room} € por encima del suelo en el peor punto de los próximos 30 días: el resto se necesita para llegar al próximo cobro.`);
    if (available <= 0) notes.push("En el peor punto de los próximos 30 días la liquidez ya está en el suelo o por debajo, con o sin esta nómina: no hay nada que repartir hoy.");
    return { status: available > 0 ? "ok" : "none", gross, available, basis: "band", limitedBy, headroom: round2(number(headroom)), earmarked: pending, payrolls: list, notes };
  }

  /**
   * Las filas de la escalera de WP-42 como importes editables. Siempre hay una fila por peldaño (también las que la escalera deja a 0, para poder añadir a mano), y una fila
   * «sin repartir» que es lo que queda por asignar: el total de las filas es SIEMPRE `available`.
   * @param {{ladder?: any, available?: number, caps?: {pension?: number|null}, debts?: Array<{id?: string, entity?: string, currentPrincipal?: number}>, investTypes?: string[]}} [params]
   */
  function rowsFromLadder({ ladder = null, available = 0, caps = {}, debts = [], investTypes = [] } = {}) {
    const total = Math.max(0, round2(available));
    const rungs = Array.isArray(ladder && ladder.rungs) ? ladder.rungs : [];
    const rung = (id) => rungs.find((item) => item.id === id) || null;
    /** @type {Array<Record<string, any>>} */
    const rows = [];
    const add = (row) => rows.push({ ...row, amount: Math.max(0, round2(row.amount)), suggested: Math.max(0, round2(row.amount)) });

    add({ id: "cushion", group: "cushion", label: "Colchón", amount: number(rung("cushion") && rung("cushion").amount), max: null });

    const debtLines = new Map((rung("debt") && Array.isArray(rung("debt").lines) ? rung("debt").lines : []).map((line) => [text(line.id), line]));
    (Array.isArray(debts) ? debts : []).filter((debt) => text(debt.id) && number(debt.currentPrincipal) > 0).forEach((debt) => {
      const line = debtLines.get(text(debt.id));
      add({ id: `debt:${text(debt.id)}`, group: "debt", label: `Amortizar ${text(debt.entity) || "deuda"}`, amount: number(line && line.amount), max: round2(number(debt.currentPrincipal)), aprPct: line ? line.aprPct : null });
    });

    add({ id: "pension", group: "pension", label: "Plan de pensiones", amount: number(rung("pension") && rung("pension").amount), max: known(caps.pension) ? Math.max(0, round2(number(caps.pension))) : null });

    const invest = rung("invest");
    const split = invest && invest.split && invest.split.calculable ? invest.split.rows : null;
    if (split && split.length) {
      // Una fila por cada tipo con objetivo (también los que hoy no reciben nada, para poder añadir a mano) y por cada tipo que la escalera reparte.
      const types = [...new Set([...(Array.isArray(investTypes) ? investTypes.map(text) : []), ...split.map((row) => text(row.type))])].filter(Boolean);
      types.forEach((type) => add({ id: `invest:${type}`, group: "invest", label: `Invertir en ${typeLabel(type)}`, amount: number((split.find((row) => text(row.type) === type) || {}).amount), max: null }));
    } else add({ id: "invest", group: "invest", label: "Invertir lo que sobra", amount: number(invest && invest.amount), max: null });

    // La suma de las filas nunca supera el disponible: si la escalera propone más (no debería), se recorta desde el final.
    let assigned = round2(rows.reduce((sum, row) => sum + row.amount, 0));
    for (let index = rows.length - 1; index >= 0 && assigned > total; index -= 1) {
      const cut = Math.min(rows[index].amount, round2(assigned - total));
      rows[index].amount = round2(rows[index].amount - cut);
      rows[index].suggested = rows[index].amount;
      assigned = round2(assigned - cut);
    }
    rows.push({ id: "free", group: "free", label: "Sin repartir (se queda en la cuenta)", amount: round2(total - assigned), suggested: round2(total - assigned), max: null });
    return rows;
  }

  const clone = (rows) => rows.map((row) => ({ ...row }));

  /**
   * Fija el importe de una fila; la diferencia sale de (o va a) la fila «sin repartir». Nunca hay un importe negativo, nunca se pasa del tope de la fila ni de lo que queda por
   * repartir, y la suma de todas las filas no cambia.
   * @param {Array<Record<string, any>>} rows
   */
  function setRowAmount(rows, id, value) {
    const next = clone(rows);
    const row = next.find((item) => item.id === id);
    const free = next.find((item) => item.id === "free");
    if (!row || !free || row.id === "free") return { rows: next, clamped: null, changed: false };
    const wanted = known(value) ? round2(number(value)) : row.amount;
    const maxCap = known(row.max) ? number(row.max) : Infinity;
    const freeCap = round2(row.amount + free.amount);
    const target = round2(Math.max(0, Math.min(wanted, maxCap, freeCap)));
    let clamped = null;
    if (wanted < 0) clamped = "negative";
    else if (target < wanted) clamped = maxCap <= freeCap ? "max" : "free";
    const delta = round2(target - row.amount);
    row.amount = target;
    free.amount = round2(free.amount - delta);
    return { rows: next, clamped, changed: delta !== 0 };
  }

  /** Mueve `delta` € (positivo suma a la fila, negativo resta) entre la fila y «sin repartir». */
  function moveAmount(rows, id, delta) {
    const row = rows.find((item) => item.id === id);
    if (!row) return { rows: clone(rows), clamped: null, changed: false };
    return setRowAmount(rows, id, round2(row.amount + number(delta)));
  }

  /** Vuelve a lo que sugería la escalera. */
  function resetRows(rows) {
    const next = clone(rows);
    const free = next.find((item) => item.id === "free");
    next.forEach((row) => { if (row.id !== "free") row.amount = row.suggested; });
    if (free) free.amount = round2(rows.reduce((sum, row) => sum + row.amount, 0) - next.filter((row) => row.id !== "free").reduce((sum, row) => sum + row.amount, 0));
    return next;
  }

  /** Resumen de las filas: lo repartido, lo que queda sin repartir y si algo difiere de lo sugerido. */
  function summarize(rows) {
    const free = rows.find((row) => row.id === "free");
    const assigned = round2(rows.filter((row) => row.id !== "free").reduce((sum, row) => sum + row.amount, 0));
    return {
      total: round2(assigned + (free ? free.amount : 0)), assigned, free: free ? free.amount : 0,
      differsFromSuggested: rows.some((row) => row.id !== "free" && row.amount !== row.suggested),
    };
  }

  const TRANSFER_NOTES = {
    cushion: "Traspaso a la cuenta donde guardáis el colchón.",
    debt: "Antes de amortizar, comprueba si el contrato cobra comisión por amortización anticipada: la app no la conoce.",
    pension: "El ahorro fiscal es de una vez y difiere el impuesto; el dinero queda inmovilizado hasta la jubilación.",
    invest: "Es una aportación (no vende nada); la rentabilidad no está garantizada.",
  };

  /**
   * La lista de transferencias a hacer a mano: una por fila con dinero, en el orden de la escalera. No incluye «sin repartir» (se queda donde está).
   * @param {Array<Record<string, any>>} rows
   */
  function transferList(rows) {
    return rows
      .filter((row) => row.id !== "free" && row.amount > 0)
      .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
      .map((row, index) => ({
        id: `t${index + 1}`, rowId: row.id, group: row.group, amount: round2(row.amount), done: false,
        label: row.label,
        note: TRANSFER_NOTES[row.group] || "",
      }));
  }

  // ── Borradores ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** @param {any} raw */
  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const drafts = (Array.isArray(source.drafts) ? source.drafts : []).map((draft) => {
      if (!draft || typeof draft !== "object" || !text(draft.id)) return null;
      const transfers = (Array.isArray(draft.transfers) ? draft.transfers : []).filter((item) => item && text(item.id) && known(item.amount) && number(item.amount) > 0)
        .map((item) => ({ id: text(item.id), rowId: text(item.rowId), group: text(item.group), amount: round2(number(item.amount)), label: text(item.label).slice(0, 120), note: text(item.note).slice(0, 200), done: item.done === true, doneAt: item.done === true ? text(item.doneAt).slice(0, 10) : "" }));
      const sources = (Array.isArray(draft.sources) ? draft.sources : []).filter((item) => item && text(item.id)).map((item) => ({ id: text(item.id), label: text(item.label).slice(0, 80), amount: round2(number(item.amount)) }));
      return {
        id: text(draft.id), createdAt: text(draft.createdAt).slice(0, 25), month: text(draft.month).slice(0, 7), available: round2(number(draft.available)),
        basis: draft.basis === "band" ? "band" : "payroll-only", sources, transfers, free: round2(number(draft.free)),
      };
    }).filter(Boolean).slice(0, MAX_DRAFTS);
    const hidden = {};
    Object.keys(source.hidden && typeof source.hidden === "object" ? source.hidden : {}).slice(0, 60).forEach((key) => { if (source.hidden[key] === true) hidden[text(key).slice(0, 120)] = true; });
    const prefs = source.prefs && typeof source.prefs === "object" ? source.prefs : {};
    return { drafts, hidden, prefs: { inAccounts: prefs.inAccounts === true ? true : prefs.inAccounts === false ? false : null } };
  }

  /** Las nóminas con un borrador abierto (no se vuelven a ofrecer mientras exista). */
  function appliedSourceIds(store) {
    return new Set(normalizeStore(store).drafts.flatMap((draft) => draft.sources.map((source) => source.id)));
  }

  /**
   * El borrador que sale de «Aplicar». No toca ningún movimiento: guarda qué nóminas, con cuánto y la lista de transferencias.
   * @param {{id: string, createdAt: string, month: string, availability: any, rows: Array<Record<string, any>>}} params
   */
  function makeDraft({ id, createdAt, month, availability, rows }) {
    const summary = summarize(rows);
    return {
      id: text(id), createdAt: text(createdAt), month: text(month), available: availability.available, basis: availability.basis === "band" ? "band" : "payroll-only",
      sources: availability.payrolls.map((item) => ({ id: text(item.id), label: text(item.label), amount: round2(number(item.amount)) })),
      transfers: transferList(rows), free: summary.free,
    };
  }

  function addDraft(store, draft) {
    const current = normalizeStore(store);
    return normalizeStore({ ...current, drafts: [draft, ...current.drafts.filter((item) => item.id !== draft.id)].slice(0, MAX_DRAFTS) });
  }

  /** Marca una transferencia como hecha (con la fecha en que se marcó, para saber si los saldos declarados ya la reflejan) o la desmarca. */
  function setTransferDone(store, draftId, transferId, done, at = "") {
    const current = normalizeStore(store);
    return { ...current, drafts: current.drafts.map((draft) => (draft.id !== draftId ? draft : { ...draft, transfers: draft.transfers.map((item) => (item.id === transferId ? { ...item, done: done === true, doneAt: done === true ? text(at).slice(0, 10) : "" } : item)) })) };
  }

  /**
   * Lo que los borradores abiertos ya tienen apuntado y los saldos declarados todavía no reflejan: las transferencias sin hacer (el dinero sigue en la cuenta pero está comprometido) y las
   * hechas DESPUÉS de la fecha de los saldos. Sin la fecha de los saldos, se cuentan todas (lo prudente).
   * @param {any} store
   * @param {string} [balanceDate]
   */
  function earmarkedAmount(store, balanceDate = "") {
    const reflectedUntil = /^\d{4}-\d{2}-\d{2}$/.test(text(balanceDate).slice(0, 10)) ? text(balanceDate).slice(0, 10) : null;
    return round2(normalizeStore(store).drafts.reduce((sum, draft) => sum + draft.transfers.reduce((inner, item) => {
      const reflected = item.done && reflectedUntil !== null && /^\d{4}-\d{2}-\d{2}$/.test(item.doneAt) && item.doneAt <= reflectedUntil;
      return inner + (reflected ? 0 : item.amount);
    }, 0), 0));
  }

  /** Descartar libera las nóminas: vuelven a ofrecerse. */
  function discardDraft(store, draftId) {
    const current = normalizeStore(store);
    return { ...current, drafts: current.drafts.filter((draft) => draft.id !== draftId) };
  }

  function hideSource(store, sourceId, hide) {
    const current = normalizeStore(store);
    const hidden = { ...current.hidden };
    if (hide) hidden[text(sourceId)] = true; else delete hidden[text(sourceId)];
    return { ...current, hidden };
  }

  function draftProgress(draft) {
    const total = draft.transfers.length;
    const done = draft.transfers.filter((item) => item.done).length;
    return { total, done, finished: total > 0 && done === total };
  }

  return {
    SCHEMA_ID, DEFAULT_STEP, MAX_DRAFTS, GROUP_ORDER, isPayrollLabel,
    availableToSplit, rowsFromLadder, setRowAmount, moveAmount, resetRows, summarize, transferList,
    normalizeStore, appliedSourceIds, makeDraft, addDraft, setTransferDone, discardDraft, hideSource, draftProgress, earmarkedAmount,
  };
});
