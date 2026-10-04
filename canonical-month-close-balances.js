(function attachCanonicalMonthCloseBalances(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalMonthCloseBalances = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalMonthCloseBalances() {
  "use strict";

  // WP-09 (NPV-03 / C2, docs/PLAN_IMPLEMENTACION_2026-10-03.md): el cierre de mes guarda el saldo de cada
  // cuenta con su fecha, y entre el día 1 y el 3 propone cerrar el mes que ACABA (lo acordado el 2/10:
  // mes natural, cierre entre el 1 y el 3). No toca el RPC firmado `close_finance_month` ni el registro
  // del cierre: los saldos van a un almacén aparte (`month-close-balances`), que viaja con la copia y la
  // nube. Cuadre «saldo anterior + movimientos = saldo de cierre»: avisa, nunca bloquea.

  const STORE_NAME = "month-close-balances";
  const GRACE_DAYS = 3;
  const TOLERANCE = 1;
  const MAX_MONTHS = 120;
  const ACCOUNTS = Object.freeze(["caixabank", "mediolanum", "efectivo"]);
  const RECONCILABLE = Object.freeze(["caixabank", "mediolanum"]);
  // Apuntes que no vienen del extracto del banco: no entran en el cuadre (un ticket en efectivo, o uno de
  // tarjeta que luego llega también en el extracto, harían saltar un «no cuadra» falso).
  const NON_BANK_SOURCES = Object.freeze(["manual-quick-capture", "receipt-photo"]);

  function text(value) {
    return String(value ?? "").trim();
  }

  function validMonthKey(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(text(value));
  }

  function validIsoDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  function round2(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function previousMonthKey(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  }

  function lastDayOfMonth(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    return `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  }

  function utcDay(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }

  function daysBetween(fromIso, toIso) {
    return Math.round((utcDay(toIso) - utcDay(fromIso)) / 86400000);
  }

  // Del día 1 al 3, el mes que acaba sigue ABIERTO mientras no se firme: es cuando se terminan de anotar
  // sus reales para cerrarlo (sin esto, la app proponía cerrar un mes que ya no dejaba corregir).
  function isGraceMonth(monthKey, today) {
    if (!validMonthKey(monthKey) || !validIsoDate(today)) return false;
    return Number(today.slice(8, 10)) <= GRACE_DAYS && monthKey === previousMonthKey(today.slice(0, 7));
  }

  /**
   * Qué mes se cierra. Del día 1 al 3, el mes que acaba (firmado o no: si ya se firmó, la pantalla lo
   * enseña cerrado y se puede reabrir); el resto del mes, el mes en curso, como hasta ahora. La otra
   * opción se ofrece si aún no está firmada, para no perder la posibilidad de cerrar el mes de hoy ni
   * la de cerrar tarde el anterior.
   * @param {{ today: string, isSigned?: (monthKey: string) => boolean, choice?: string }} input
   */
  function closeTarget({ today, isSigned = () => false, choice = "" }) {
    if (!validIsoDate(today)) throw new Error("La fecha de hoy no es válida.");
    const current = today.slice(0, 7);
    const previous = previousMonthKey(current);
    const inGrace = Number(today.slice(8, 10)) <= GRACE_DAYS;
    const byDefault = inGrace ? previous : current;
    const monthKey = (choice === current || choice === previous) ? choice : byDefault;
    const other = monthKey === current ? previous : current;
    return {
      monthKey,
      isDefault: monthKey === byDefault,
      // Volver al mes por defecto siempre es posible; el otro, solo si aún no está firmado.
      alternative: other === byDefault || !isSigned(other) ? other : null,
      reason: monthKey === previous
        ? (inGrace ? `del 1 al ${GRACE_DAYS} se cierra el mes que acaba` : "elegido: cerrar tarde el mes anterior")
        : (inGrace ? "elegido: cerrar el mes en curso" : "mes en curso"),
    };
  }

  /**
   * El registro de saldos de un cierre. `offsetDays`: días entre la fecha de los saldos y el último día
   * del mes cerrado (0 = saldo de fin de mes; positivo = de después; negativo = de antes). Saldos
   * calculados por calendario (`mode: "auto"`) se guardan, pero marcados: no son del banco (GOV-05).
   * @param {{ monthKey: string, accounts: Record<string, number>, date: string, mode?: string, closedAt: string }} input
   */
  function buildEntry({ monthKey, accounts, date, mode = "manual", closedAt }) {
    if (!validMonthKey(monthKey)) throw new Error("El mes de cierre no es válido.");
    if (!validIsoDate(date)) throw new Error("La fecha de los saldos no es válida.");
    const clean = {};
    ACCOUNTS.forEach((id) => {
      const value = Number(accounts?.[id]);
      if (Number.isFinite(value)) clean[id] = round2(value);
    });
    if (!Object.keys(clean).length) throw new Error("No hay saldos que guardar.");
    return {
      monthKey,
      accounts: clean,
      total: round2(Object.values(clean).reduce((sum, value) => sum + value, 0)),
      date,
      mode: mode === "auto" ? "auto" : "manual",
      offsetDays: daysBetween(lastDayOfMonth(monthKey), date),
      closedAt: text(closedAt),
    };
  }

  function normalizeStore(raw) {
    const months = raw && typeof raw === "object" && !Array.isArray(raw) && raw.months && typeof raw.months === "object" ? raw.months : {};
    const clean = {};
    Object.entries(months).forEach(([key, entry]) => {
      if (!validMonthKey(key) || !entry || typeof entry !== "object" || !validIsoDate(entry.date) || !entry.accounts || typeof entry.accounts !== "object") return;
      // Una copia o una versión de la nube corrupta no puede colar un saldo que no sea número.
      const accounts = Object.fromEntries(Object.entries(entry.accounts).filter(([, value]) => typeof value === "number" && Number.isFinite(value)));
      clean[key] = { ...entry, accounts };
    });
    return { months: clean };
  }

  // Idempotente: reabrir y volver a cerrar sustituye la entrada del mes (cuenta las revisiones), nunca la duplica.
  function recordEntry(store, entry) {
    const current = normalizeStore(store);
    const previous = current.months[entry.monthKey];
    const months = { ...current.months, [entry.monthKey]: { ...entry, revision: previous ? Number(previous.revision || 1) + 1 : 1 } };
    const kept = Object.keys(months).sort().slice(-MAX_MONTHS);
    return { months: Object.fromEntries(kept.map((key) => [key, months[key]])) };
  }

  // El último cierre guardado ANTES del mes dado (no tiene por qué ser el mes inmediatamente anterior).
  function previousEntry(store, monthKey) {
    const keys = Object.keys(normalizeStore(store).months).filter((key) => key < monthKey).sort();
    return keys.length ? normalizeStore(store).months[keys[keys.length - 1]] : null;
  }

  /**
   * Cuadre por cuenta: saldo del cierre anterior (fecha D1) + movimientos importados de esa cuenta con
   * fecha en (D1, D2] = saldo de este cierre (fecha D2). Independiente del día exacto de cada saldo.
   * Importe con signo: `signedAmount` (entradas del libro) o `amount` (movimientos). Sin cierre anterior,
   * con saldos calculados o sin movimientos en el periodo, no se puede cuadrar y
   * se dice; comparar contra cero sería inventar.
   * @param {{ previous: any, current: any, transactions?: Array<any>, tolerance?: number }} input
   */
  function continuity({ previous, current, transactions = [], tolerance = TOLERANCE }) {
    return RECONCILABLE.filter((id) => current?.accounts?.[id] !== undefined).map((accountId) => {
      const closing = current.accounts[accountId];
      if (!previous || previous.accounts?.[accountId] === undefined) return { accountId, status: "sin-cierre-anterior", closing };
      if (previous.mode === "auto" || current.mode === "auto") return { accountId, status: "calculado", closing };
      if (current.date <= previous.date) return { accountId, status: "fechas-invertidas", closing, from: previous.date, to: current.date };
      const opening = previous.accounts[accountId];
      const moves = transactions.filter((item) => text(item.accountId || "caixabank") === accountId && !item.duplicateOf && !NON_BANK_SOURCES.includes(text(item.source))
        && validIsoDate(text(item.date).slice(0, 10)) && text(item.date).slice(0, 10) > previous.date && text(item.date).slice(0, 10) <= current.date);
      if (!moves.length) return { accountId, status: "sin-movimientos", opening, closing, from: previous.date, to: current.date };
      const movements = round2(moves.reduce((sum, item) => sum + Number(item.signedAmount ?? item.amount ?? 0), 0));
      const expected = round2(opening + movements);
      const diff = round2(closing - expected);
      return { accountId, status: Math.abs(diff) <= tolerance ? "cuadra" : "descuadra", opening, movements, expected, closing, diff, count: moves.length, from: previous.date, to: current.date };
    });
  }

  function formatDate(iso) {
    return iso.split("-").reverse().join("/");
  }

  // Cómo se lee la fecha de los saldos de un cierre, en lenguaje del hogar.
  function describeDate(entry) {
    if (entry.mode === "auto") return `saldos calculados por la app a ${formatDate(entry.date)}, no los del banco`;
    if (entry.offsetDays === 0) return `saldos del ${formatDate(entry.date)}, último día del mes`;
    const days = Math.abs(entry.offsetDays);
    return `saldos del ${formatDate(entry.date)}, ${days} día${days === 1 ? "" : "s"} ${entry.offsetDays > 0 ? "después" : "antes"} del fin de mes`;
  }

  return { STORE_NAME, GRACE_DAYS, TOLERANCE, ACCOUNTS, previousMonthKey, lastDayOfMonth, isGraceMonth, closeTarget, buildEntry, normalizeStore, recordEntry, previousEntry, continuity, describeDate };
});
