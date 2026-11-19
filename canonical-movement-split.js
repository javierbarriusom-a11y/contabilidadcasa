(function attachCanonicalMovementSplit(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalMovementSplit = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalMovementSplit() {
  "use strict";

  // DAT-07 (novena auditoría §4.1; visto bueno del hogar del 19/11/2026, «Haz DAT-07 y DEC-12»): dividir un movimiento en varias
  // partidas. Un ticket del súper con farmacia y droguería, o un Bizum que mezcla cena y regalo, ya no obliga a elegir una sola.
  //
  // La división se guarda en la regla «solo este movimiento» (`movementMappings[identidad]`), con su partida mayor como `rowKey`:
  // lo que solo pregunta «¿tiene partida?» sigue igual, y la copia, la nube y el «Deshacer» de la ficha la llevan sin nada nuevo.
  // Solo cuenta si cuadra: dos partidas o más, todas distintas, cada trozo mayor que cero y la suma igual al importe del
  // movimiento (al céntimo). Si deja de cuadrar (una partida borrada), el movimiento va entero a su partida mayor, como antes.
  //
  // Puro: sin DOM ni estado de la app. La pantalla (ficha-movimiento-ui.js) y app.js (mappingForMovement, bankActualTotals) lo usan.

  const MIN_PARTES = 2;
  const MAX_PARTES = 8;
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  /** Un importe tecleado («12,50», «1.234,5», «7») a número; null si no es un importe válido. */
  function parseAmount(raw) {
    if (typeof raw === "number") return Number.isFinite(raw) ? round2(raw) : null;
    const text = String(raw ?? "").trim().replace(/\s|€/g, "");
    if (!text) return null;
    const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? round2(value) : null;
  }

  /**
   * Cómo está una división frente al importe del movimiento (en positivo).
   * @param {Array<{rowKey?: string, amount?: number|string}>} parts
   * @param {number} total
   * @returns {{ ok: boolean, sum: number, remaining: number, reason: string, parts: Array<{rowKey: string, amount: number}> }}
   */
  function evaluate(parts, total) {
    const objetivo = round2(Math.abs(Number(total) || 0));
    const limpias = (Array.isArray(parts) ? parts : []).map((part) => ({ rowKey: String(part?.rowKey || ""), amount: parseAmount(part?.amount) }));
    const sum = round2(limpias.reduce((acc, part) => acc + (part.amount && part.amount > 0 ? part.amount : 0), 0));
    const remaining = round2(objetivo - sum);
    const salida = (reason) => ({ ok: !reason, sum, remaining, reason, parts: reason ? [] : limpias.map((part) => ({ rowKey: part.rowKey, amount: part.amount })) });
    if (!(objetivo > 0)) return salida("el movimiento no tiene importe");
    if (limpias.length < MIN_PARTES) return salida(`hacen falta ${MIN_PARTES} partidas o más`);
    if (limpias.length > MAX_PARTES) return salida(`como mucho ${MAX_PARTES} partidas`);
    if (limpias.some((part) => !part.rowKey)) return salida("falta elegir la partida de algún trozo");
    if (new Set(limpias.map((part) => part.rowKey)).size !== limpias.length) return salida("hay una partida repetida: júntala en un solo trozo");
    if (limpias.some((part) => part.amount === null)) return salida("falta el importe de algún trozo");
    if (limpias.some((part) => !(part.amount > 0))) return salida("cada trozo tiene que ser mayor que cero");
    if (Math.abs(remaining) >= 0.005) return salida(remaining > 0 ? "falta repartir una parte" : "se reparte más que el movimiento");
    return salida("");
  }

  /** La partida mayor de una división válida (la que se guarda como `rowKey`); en empate, la primera. */
  function mainRowKey(parts) {
    return (parts || []).reduce((best, part) => (!best || part.amount > best.amount ? part : best), null)?.rowKey || "";
  }

  /**
   * La división guardada, solo si sigue cuadrando con el movimiento y con las partidas que existen hoy (`hasRow`).
   * @param {{ split?: Array<{rowKey?: string, amount?: number|string}> } | null | undefined} entry
   * @param {number} total
   * @param {(rowKey: string) => boolean} [hasRow]
   */
  function storedParts(entry, total, hasRow = (rowKey) => Boolean(rowKey)) {
    if (!entry || !Array.isArray(entry.split)) return null;
    const result = evaluate(entry.split, total);
    if (!result.ok || result.parts.some((part) => !hasRow(part.rowKey))) return null;
    return result.parts;
  }

  /** Para la barra: cuánto se ha repartido (0-100) y la frase de lo que falta o sobra. */
  function progress(result, total) {
    const objetivo = round2(Math.abs(Number(total) || 0));
    const pct = objetivo > 0 ? Math.max(0, Math.min(100, Math.round((result.sum / objetivo) * 100))) : 0;
    return { pct, over: result.remaining < -0.004, done: Math.abs(result.remaining) < 0.005 };
  }

  return Object.freeze({ MIN_PARTES, MAX_PARTES, parseAmount, evaluate, mainRowKey, storedParts, progress });
});
