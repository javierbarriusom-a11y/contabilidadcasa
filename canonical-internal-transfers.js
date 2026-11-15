/**
 * canonical-internal-transfers.js
 *
 * DAT-05 (docs/PROPUESTA_NOVENA_AUDITORIA_2026-11-14.md §4.1; 15/11/2026, «sigue con todo lo que puedas»). Un traspaso entre
 * dos cuentas propias no es gasto ni ingreso, pero en el extracto son dos movimientos sin partida: la salida de una cuenta y
 * la entrada en la otra. Sin marcarlos, piden partida en Clasificar, bajan el % de gasto con partida y, si solo se ve una de
 * las dos cuentas, inflan el gasto.
 *
 * Este motor propone las parejas: una salida y una entrada del MISMO importe, en cuentas DISTINTAS, con dos días o menos de
 * diferencia. Cada movimiento va en una sola pareja (la entrada más cercana en fecha) y la pareja dice si había más de una
 * candidata, para que la pantalla lo avise. Solo propone: quien decide que es un traspaso es el hogar.
 *
 * Lo que no puede ver: un traspaso a una cuenta cuyo extracto no se importa (no hay entrada con la que emparejar). Para eso
 * está «Es un traspaso entre cuentas nuestras» en Clasificar, que lo marca por el concepto. Motor puro: sin DOM, red ni
 * almacenamiento.
 */
(function attachCanonicalInternalTransfers(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalInternalTransfers = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalInternalTransfersFactory() {
  "use strict";

  const SCHEMA_ID = "finance-internal-transfers/v1";
  const DAYS = 2;
  const ACTION_TYPE = "transferencia_interna";

  const dayIndex = (iso) => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);
  const cents = (amount) => Math.round(Math.abs(Number(amount)) * 100);

  function pairKey(outId, inId) {
    return `${outId}→${inId}`;
  }

  /**
   * Las parejas de traspaso de una lista de movimientos.
   * @param {Array<Record<string, any>>} movements { id, date (AAAA-MM-DD), amount (negativo = salida), account, settled? }
   *   `settled`: el movimiento ya está decidido (es un traspaso marcado, o las dos puntas tienen partida): no se propone.
   * @param {{ days?: number, dismissed?: string[] }} [options] `dismissed`: claves de pareja que el hogar dijo que no lo son.
   */
  function pairs(movements, options = {}) {
    const days = Number.isFinite(options.days) ? Number(options.days) : DAYS;
    const dismissed = new Set((options.dismissed || []).map(String));
    const list = (Array.isArray(movements) ? movements : [])
      .filter((row) => row && row.id && row.account && /^\d{4}-\d{2}-\d{2}/.test(String(row.date || "")) && cents(row.amount) > 0)
      .map((row) => /** @type {Record<string, any>} */ ({ ...row, date: String(row.date).slice(0, 10), amount: Number(row.amount), day: dayIndex(String(row.date)) }));
    const byCents = new Map();
    list.filter((row) => row.amount > 0).forEach((row) => {
      const bucket = byCents.get(cents(row.amount)) || [];
      bucket.push(row);
      byCents.set(cents(row.amount), bucket);
    });
    const used = new Set();
    const result = [];
    list
      .filter((row) => row.amount < 0)
      .sort((a, b) => a.day - b.day || String(a.id).localeCompare(String(b.id)))
      .forEach((out) => {
        const candidates = (byCents.get(cents(out.amount)) || [])
          .filter((row) => !used.has(row.id) && row.account !== out.account && Math.abs(row.day - out.day) <= days && !dismissed.has(pairKey(out.id, row.id)))
          .sort((a, b) => Math.abs(a.day - out.day) - Math.abs(b.day - out.day) || a.day - b.day || String(a.id).localeCompare(String(b.id)));
        const match = candidates[0];
        if (!match) return;
        used.add(match.id);
        if (out.settled && match.settled) return; // ya decidido en las dos puntas: la entrada queda cogida, pero no se propone
        result.push({ key: pairKey(out.id, match.id), outId: out.id, inId: match.id, amount: cents(out.amount) / 100, date: out.date, inDate: match.date, from: out.account, to: match.account, gap: Math.abs(match.day - out.day), ambiguous: candidates.length > 1 });
      });
    return result.sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
  }

  return { SCHEMA_ID, DAYS, ACTION_TYPE, pairKey, pairs };
});
