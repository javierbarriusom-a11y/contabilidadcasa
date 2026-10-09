(function attachCanonicalCirbe(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalCirbe = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalCirbeFactory() {
  "use strict";

  // WP-40 (DAC-01, docs/WP40_DISENO.md): conciliación operación a operación del informe de la CIRBE (Banco de España) con los contratos de deuda de la
  // app. Motor puro: ni DOM, ni red, ni almacenamiento. El hogar teclea (o copia) las filas del informe UNA vez al año; aquí se normalizan, se casan con
  // los contratos y se dice, fila a fila, si «cuadra», «difiere» o «falta en la app», y qué contratos de la app no aparecen en el informe.
  // NUNCA lee la CIRBE ni se conecta a nada, y no escribe en los contratos (A11-4: solo informa; añadir un contrato lo decide quien teclea).
  //
  // Reglas de honestidad:
  //   · sin informe no hay conciliación: «sin informe» no es «todo cuadra».
  //   · un informe viejo se dice viejo: los importes de la app han cambiado con las cuotas desde su fecha.
  //   · lo que falta en el INFORME no es necesariamente un error de la app (préstamos entre particulares, importes pequeños): se muestra aparte y más suave.
  //   · los avales no se pueden casar con contratos: la app solo guarda una cuota mensual de avales, no una lista.

  const SCHEMA_ID = "finance-cirbe-reconciliation/v1";
  const KINDS = Object.freeze({ prestamo: "Préstamo", hipoteca: "Hipoteca", tarjeta: "Tarjeta o crédito", aval: "Aval", otro: "Otro" });
  const TITULARIDADES = Object.freeze({ titular: "Titular", cotitular: "Cotitular", avalista: "Avalista" });
  const TOLERANCE_ABS = 50;
  const TOLERANCE_PCT = 3;
  const RENEW_AFTER_DAYS = 335; // un año menos 30 días: el aviso sale con margen para pedirlo
  const STALE_AFTER_DAYS = 365;
  const MAX_ROWS = 60;

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const isIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value));

  function daysBetween(fromIso, toIso) {
    const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
  }

  function defaultStore() {
    return { schema: SCHEMA_ID, reportDate: "", rows: [], updatedAt: "" };
  }

  function normalizeRow(raw = {}, index = 0) {
    const kind = Object.hasOwn(KINDS, raw.kind) ? raw.kind : "otro";
    return {
      id: text(raw.id) || `cirbe-${index + 1}`,
      entity: text(raw.entity).slice(0, 80),
      kind,
      amount: Math.max(0, round2(raw.amount)),
      overdue: Math.max(0, round2(raw.overdue)),
      titularidad: Object.hasOwn(TITULARIDADES, raw.titularidad) ? raw.titularidad : kind === "aval" ? "avalista" : "titular",
      reportOf: text(raw.reportOf).slice(0, 40),
    };
  }

  /** @param {*} raw Lo que haya en el almacén: cualquier cosa. Devuelve siempre un almacén completo y acotado. */
  function normalizeStore(raw) {
    const base = defaultStore();
    if (!raw || typeof raw !== "object") return base;
    return {
      schema: SCHEMA_ID,
      reportDate: isIso(raw.reportDate) ? text(raw.reportDate) : "",
      rows: (Array.isArray(raw.rows) ? raw.rows : []).slice(0, MAX_ROWS).map(normalizeRow).filter((row) => row.entity),
      updatedAt: isIso(raw.updatedAt) ? text(raw.updatedAt) : "",
    };
  }

  /** Una fila sin entidad o sin importe no se puede casar: se rechaza con el motivo, en vez de guardarla a medias. */
  function validateRow(raw = {}) {
    const row = normalizeRow(raw);
    if (!row.entity) return { ok: false, reason: "Falta la entidad." };
    if (!(Number(raw.amount) > 0) && !(Number(raw.overdue) > 0)) return { ok: false, reason: "Falta el importe dispuesto." };
    return { ok: true, row };
  }

  const STOP_WORDS = new Set(["banco", "bank", "sa", "sau", "sl", "slu", "s", "a", "de", "la", "el", "los", "las", "y", "the", "ag", "ltd", "spain", "espana"]);

  function entityTokens(name) {
    return text(name).toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").split(" ").filter((token) => token && !STOP_WORDS.has(token));
  }

  // Misma entidad si los nombres coinciden o los términos del más corto están todos en el más largo («Santander» ⊂ «Santander Consumer Finance»).
  // Es laxo a propósito: la tarjeta enseña los dos nombres, y el tipo y el importe lo afinan.
  function sameEntity(a, b) {
    const ta = entityTokens(a);
    const tb = entityTokens(b);
    if (!ta.length || !tb.length) return false;
    const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    return short.every((token) => long.includes(token));
  }

  function kindOfContract(type) {
    const value = text(type).toLocaleLowerCase("es");
    if (/hipoteca/.test(value)) return "hipoteca";
    if (/tarjeta|revolving|cr[eé]dito/.test(value)) return "tarjeta";
    if (/pr[eé]stamo|financi|reunific/.test(value)) return "prestamo";
    return "otro";
  }

  const toleranceFor = (amount) => Math.max(TOLERANCE_ABS, round2((Math.abs(amount) * TOLERANCE_PCT) / 100));

  // La misma operación puede salir en el informe de las dos personas (cotitulares): se cuenta una vez.
  function mergeJointRows(rows) {
    const merged = [];
    rows.forEach((row) => {
      const twin = merged.find((other) => other.titularidad === "cotitular" && row.titularidad === "cotitular" && other.reportOf && row.reportOf && other.reportOf !== row.reportOf
        && other.kind === row.kind && sameEntity(other.entity, row.entity) && Math.abs(other.amount - row.amount) <= toleranceFor(Math.max(other.amount, row.amount)));
      if (twin) {
        twin.inBothReports = true;
        twin.overdue = Math.max(twin.overdue, row.overdue);
        return;
      }
      merged.push({ ...row, inBothReports: false });
    });
    return merged;
  }

  /**
   * Antigüedad del informe: «al día», «toca pedirlo» (a 30 días del año) o «vencido».
   * @param {*} store @param {{today?: string}} [options]
   */
  function reportStatus(store, { today = "" } = {}) {
    const s = normalizeStore(store);
    if (!s.reportDate) return { state: "none", ageDays: null, renewOn: "", dueOn: "" };
    if (!isIso(today)) return { state: "unknown", ageDays: null, renewOn: "", dueOn: "" };
    const ageDays = daysBetween(s.reportDate, today);
    const state = ageDays > STALE_AFTER_DAYS ? "overdue" : ageDays >= RENEW_AFTER_DAYS ? "renew-soon" : "ok";
    const plus = (days) => { const d = new Date(`${s.reportDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
    return { state, ageDays, renewOn: plus(RENEW_AFTER_DAYS), dueOn: plus(STALE_AFTER_DAYS) };
  }

  /**
   * Casa cada operación del informe con un contrato de la app.
   * @param {{store?: *, contracts?: Array<Object>, guaranteeMonthly?: number, today?: string}} [input]
   */
  function reconcile({ store, contracts = [], guaranteeMonthly = 0, today = "" } = {}) {
    const s = normalizeStore(store);
    const report = reportStatus(s, { today });
    if (!s.rows.length || !s.reportDate) {
      return { schemaId: SCHEMA_ID, status: "no-report", report, items: [], missingInReport: [], summary: null, reason: "Sin informe de la CIRBE no hay nada que conciliar. Eso no significa que la app esté al día." };
    }
    const apps = (Array.isArray(contracts) ? contracts : [])
      .filter((contract) => contract && contract.paymentStatus !== "settled" && contract.paymentStatus !== "reunified" && number(contract.currentPrincipal) > 0)
      .map((contract) => ({ id: String(contract.id ?? ""), entity: text(contract.entity), type: text(contract.type), kind: kindOfContract(contract.type), principal: round2(contract.currentPrincipal), used: false }));
    const operations = mergeJointRows(s.rows);
    const items = operations.map((row) => ({ row, match: null, state: "", diff: 0, kindMismatch: false, note: "" }));

    // Primero, avales (no se casan con contratos).
    const guarantee = Math.max(0, round2(guaranteeMonthly));
    items.filter((item) => item.row.kind === "aval").forEach((item) => {
      item.state = guarantee > 0 ? "guarantee-manual" : "missing-in-app";
      item.note = guarantee > 0
        ? `La app solo guarda una cuota mensual de avales (${guarantee} €), no una lista: comprueba a mano que este aval está dentro.`
        : "No hay ningún aval declarado en la app, y el informe enseña uno. Cambia lo que ve un banco: suma en Ajustes la cuota que cubrirías.";
    });

    // Después, el resto: primero con el mismo tipo; lo que quede, con la misma entidad aunque el tipo difiera.
    const pending = items.filter((item) => item.row.kind !== "aval");
    const assign = (item, contract, kindMismatch) => {
      contract.used = true;
      item.match = { id: contract.id, entity: contract.entity, type: contract.type, principal: contract.principal };
      item.kindMismatch = kindMismatch;
      item.diff = round2(contract.principal - item.row.amount);
      item.state = Math.abs(item.diff) <= toleranceFor(item.row.amount) ? "fits" : "differs";
    };
    const pairs = (sameKindOnly) => {
      const candidates = [];
      pending.filter((item) => !item.match).forEach((item) => {
        apps.filter((contract) => !contract.used && sameEntity(item.row.entity, contract.entity) && (sameKindOnly ? contract.kind === item.row.kind || contract.kind === "otro" || item.row.kind === "otro" : contract.kind !== item.row.kind))
          .forEach((contract) => candidates.push({ item, contract, gap: Math.abs(contract.principal - item.row.amount) }));
      });
      candidates.sort((a, b) => a.gap - b.gap);
      candidates.forEach(({ item, contract }) => { if (!item.match && !contract.used) assign(item, contract, !sameKindOnly); });
    };
    pairs(true);
    pairs(false);
    pending.filter((item) => !item.match).forEach((item) => { item.state = "missing-in-app"; });

    const missingInReport = apps.filter((contract) => !contract.used).map((contract) => ({ id: contract.id, entity: contract.entity, type: contract.type, principal: contract.principal }));
    const count = (state) => items.filter((item) => item.state === state).length;
    const withApp = items.filter((item) => item.match);
    return {
      schemaId: SCHEMA_ID,
      status: "reconciled",
      report,
      items,
      missingInReport,
      summary: {
        operations: items.length,
        fits: count("fits"),
        differs: count("differs"),
        missingInApp: count("missing-in-app"),
        guaranteeManual: count("guarantee-manual"),
        missingInReport: missingInReport.length,
        overdueOperations: items.filter((item) => item.row.overdue > 0).length,
        cirbeTotal: round2(withApp.reduce((sum, item) => sum + item.row.amount, 0)),
        appTotal: round2(withApp.reduce((sum, item) => sum + item.match.principal, 0)),
        allClean: items.length > 0 && count("fits") === items.length && missingInReport.length === 0,
      },
      reason: "",
    };
  }

  return { SCHEMA_ID, KINDS, TITULARIDADES, TOLERANCE_ABS, TOLERANCE_PCT, RENEW_AFTER_DAYS, STALE_AFTER_DAYS, MAX_ROWS, defaultStore, normalizeRow, normalizeStore, validateRow, sameEntity, kindOfContract, reportStatus, reconcile };
});
