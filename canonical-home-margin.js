(function attachCanonicalHomeMargin(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalHomeMargin = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalHomeMargin() {
  "use strict";

  // S3′ (docs/OLA2_RECALIBRACION.md §3): el margen de Hoy, con dos cifras que no dependen del día
  // en que se carga cada recibo:
  //   · Disponible hoy                 = saldo total (CaixaBank + Mediolanum) − suelo de liquidez.
  //   · Disponible a fin de mes (prev.) = liquidez prevista a fin de mes por el motor mensual − suelo.
  //   · Disponible para gastar (titular) = la menor de las dos.
  // Es puro: los saldos, el suelo, las filas del motor mensual y el día de hoy llegan por parámetro.
  // No usa el motor diario (sus fechas de salida son estimadas casi al 100 %, ver §2 del documento).

  // Valor inicial decidido por el hogar el 1/10/2026 (docs/OLA2_SUELO_Y_DISPONIBLE.md §4).
  const DEFAULT_LIQUIDITY_FLOOR = 1500;

  const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // «octubre» a partir de "2026-10": sin año (la pantalla dice «a fin de octubre») y sin depender del
  // formato de la etiqueta de la fila del motor («oct 26» se lee como «26 de octubre»).
  function monthName(monthKey) {
    return MONTH_NAMES[Number(String(monthKey).slice(5, 7)) - 1] || "";
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  // null, "", NaN, texto y negativos no valen 0: son «sin configurar» y devuelven el valor inicial.
  // El 0 explícito sí vale (el hogar puede querer «sin suelo»).
  function normalizeFloor(raw) {
    if (raw === null || raw === undefined || raw === "") return DEFAULT_LIQUIDITY_FLOOR;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? round2(value) : DEFAULT_LIQUIDITY_FLOOR;
  }

  function amount(raw) {
    if (raw === null || raw === undefined || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  // input: { balances: { caixa, mediolanum }, liquidityFloor, caixaMinimum, rows, today: "AAAA-MM-DD" }
  // rows: filas del motor mensual con `detailMonthKey` ("AAAA-MM"), `month` (etiqueta) y `totalLiquidity`.
  function build(input = {}) {
    const caixa = amount(input.balances?.caixa);
    const mediolanum = amount(input.balances?.mediolanum);
    const floor = normalizeFloor(input.liquidityFloor);
    if (caixa === null || mediolanum === null) {
      // Sin saldo no hay cifra: se dice cuál falta y no se rellena con un 0.
      return { status: "missing", missing: [caixa === null ? "saldo de CaixaBank" : "", mediolanum === null ? "saldo de Mediolanum" : ""].filter(Boolean), floor, today: null, endOfMonth: null, spendable: null, caixaShortfall: 0, moveFromMediolanum: 0 };
    }
    const total = round2(caixa + mediolanum);
    const today = { total, floor, margin: round2(total - floor) };

    const monthKey = String(input.today || "").slice(0, 7);
    const row = /^\d{4}-\d{2}$/.test(monthKey)
      ? (Array.isArray(input.rows) ? input.rows : []).find((candidate) => candidate?.detailMonthKey === monthKey)
      : null;
    const projected = amount(row?.totalLiquidity);
    const endOfMonth = projected === null
      ? { available: false, monthKey: /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : "", monthLabel: "", projected: null, margin: null }
      : { available: true, monthKey, monthLabel: monthName(monthKey), projected: round2(projected), margin: round2(projected - floor) };

    // S-2: CaixaBank por debajo de su mínimo operativo aunque el total esté por encima del suelo.
    // No cambia ninguna de las dos cifras; solo se dice, con lo que se puede mover desde Mediolanum.
    const caixaMinimum = amount(input.caixaMinimum);
    const caixaShortfall = caixaMinimum !== null && caixaMinimum > 0 && caixa < caixaMinimum ? round2(caixaMinimum - caixa) : 0;
    const moveFromMediolanum = caixaShortfall > 0 ? round2(Math.min(caixaShortfall, Math.max(0, mediolanum))) : 0;

    // El titular: lo que se puede gastar sin cruzar el suelo ni hoy ni a fin de mes. Gastar X baja las dos
    // cifras en X, así que vale la menor. Con empate, o sin previsión, la base es hoy.
    const spendable = endOfMonth.available && endOfMonth.margin < today.margin
      ? { value: endOfMonth.margin, basis: "endOfMonth" }
      : { value: today.margin, basis: "today" };

    return { status: "ok", missing: [], floor, today, endOfMonth, spendable, caixaShortfall, moveFromMediolanum };
  }

  return { DEFAULT_LIQUIDITY_FLOOR, normalizeFloor, build };
});
