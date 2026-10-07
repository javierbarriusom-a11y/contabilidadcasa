/**
 * canonical-rate-indices.js
 *
 * WP-13 · PR-1 (docs/WP13_DISENO.md): índices de referencia (Euribor 12 meses, €STR, IPC) que el hogar
 * teclea con la fecha a la que se refiere el dato. Cada valor lleva su fecha y caduca: un tipo de hace
 * cuatro meses no se trata como el de hoy. Motor puro, sin DOM ni almacenamiento: la tarjeta vive en
 * indices-ui.js.
 *
 * Esto NO consulta ninguna fuente externa. La fuente oficial (PR-2) espera a la decisión de O-6 del
 * 16/10/2026 y a la revisión de seguridad (docs/NTC06_AMENAZAS.md); cuando exista, cada punto traerá
 * `source: "oficial"` y el valor tecleado seguirá siendo el de reserva.
 */

(function attachRateIndices(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalRateIndices = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function rateIndicesFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-rate-indices/v1";
  const MAX_POINTS_PER_INDEX = 120;
  const MAX_AGE_YEARS = 5;

  // `staleAfterDays`: pasado ese plazo desde la fecha del dato, el valor se marca caducado. Son decisiones
  // de criterio, no de mercado (docs/WP13_DISENO.md §3): el Euribor y el IPC se publican una vez al mes,
  // el €STR cada día hábil.
  const INDICES = Object.freeze({
    euribor12m: Object.freeze({ id: "euribor12m", label: "Euribor 12 meses", short: "Euribor", cadence: "mensual", staleAfterDays: 35, min: -2, max: 15 }),
    estr: Object.freeze({ id: "estr", label: "€STR", short: "€STR", cadence: "diaria", staleAfterDays: 10, min: -2, max: 15 }),
    ipc: Object.freeze({ id: "ipc", label: "IPC España (variación anual)", short: "IPC", cadence: "mensual", staleAfterDays: 75, min: -10, max: 30 }),
  });
  const INDEX_IDS = Object.freeze(Object.keys(INDICES));

  function isIsoDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function dayNumber(iso) {
    return Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86400000);
  }

  function daysBetween(fromIso, toIso) {
    return dayNumber(toIso) - dayNumber(fromIso);
  }

  function addDays(iso, days) {
    return new Date((dayNumber(iso) + days) * 86400000).toISOString().slice(0, 10);
  }

  // «2,35», «2.35», «-0,5», «2,35 %». Un tipo nunca lleva separador de miles: más de un separador o letras → inválido.
  function parsePercent(text) {
    if (typeof text === "number") return Number.isFinite(text) ? text : null;
    const cleaned = String(text ?? "").trim().replace(/\s*%$/, "").replace("−", "-");
    if (!/^-?\d+([.,]\d+)?$/.test(cleaned)) return null;
    const value = Number(cleaned.replace(",", "."));
    return Number.isFinite(value) ? value : null;
  }

  function round4(value) {
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  }

  function normalizeStore(raw) {
    const points = Array.isArray(raw?.points) ? raw.points : [];
    const clean = [];
    const seen = new Set();
    for (const point of points) {
      if (!point || !INDICES[point.indexId] || !isIsoDate(point.date)) continue;
      const value = Number(point.value);
      if (!Number.isFinite(value)) continue;
      const key = `${point.indexId}|${point.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      clean.push({
        indexId: point.indexId,
        date: point.date,
        value: round4(value),
        enteredAt: isIsoDate(point.enteredAt) ? point.enteredAt : point.date,
        source: point.source === "oficial" ? "oficial" : "manual",
      });
    }
    clean.sort((a, b) => (a.indexId === b.indexId ? a.date.localeCompare(b.date) : a.indexId.localeCompare(b.indexId)));
    return { schemaId: SCHEMA_ID, points: clean };
  }

  function seriesOf(store, indexId) {
    return normalizeStore(store).points.filter((point) => point.indexId === indexId);
  }

  function latest(store, indexId) {
    const series = seriesOf(store, indexId);
    return series.length ? series[series.length - 1] : null;
  }

  // Valida y añade (o sustituye, si ya hay un punto de ese índice en esa fecha). No muta el almacén recibido.
  function addPoint(store, input = {}, today) {
    const index = INDICES[input.indexId];
    if (!index) return { ok: false, error: "Índice desconocido.", store: normalizeStore(store) };
    if (!isIsoDate(today)) return { ok: false, error: "Falta la fecha de hoy.", store: normalizeStore(store) };
    const value = parsePercent(input.value);
    if (value === null) return { ok: false, error: `Escribe el valor en %, por ejemplo 2,35 (${index.short}).`, store: normalizeStore(store) };
    if (value < index.min || value > index.max) {
      return { ok: false, error: `${index.short}: ${String(value).replace(".", ",")} % queda fuera de lo razonable (de ${index.min} a ${index.max} %). Revisa la coma.`, store: normalizeStore(store) };
    }
    const date = input.date || today;
    if (!isIsoDate(date)) return { ok: false, error: "La fecha no es válida.", store: normalizeStore(store) };
    if (daysBetween(today, date) > 0) return { ok: false, error: "La fecha del dato no puede ser futura.", store: normalizeStore(store) };
    if (daysBetween(date, today) > MAX_AGE_YEARS * 366) return { ok: false, error: `Un dato de hace más de ${MAX_AGE_YEARS} años no sirve de referencia.`, store: normalizeStore(store) };
    const current = normalizeStore(store).points;
    const replaced = current.some((point) => point.indexId === index.id && point.date === date);
    const next = current.filter((point) => !(point.indexId === index.id && point.date === date));
    next.push({ indexId: index.id, date, value: round4(value), enteredAt: today, source: "manual" });
    // Tope por índice: se descartan los más antiguos.
    const own = next.filter((point) => point.indexId === index.id).sort((a, b) => a.date.localeCompare(b.date));
    const dropped = new Set(own.slice(0, Math.max(0, own.length - MAX_POINTS_PER_INDEX)).map((point) => point.date));
    const kept = next.filter((point) => point.indexId !== index.id || !dropped.has(point.date));
    return { ok: true, replaced, store: normalizeStore({ points: kept }) };
  }

  function removePoint(store, indexId, date) {
    const current = normalizeStore(store);
    return normalizeStore({ points: current.points.filter((point) => !(point.indexId === indexId && point.date === date)) });
  }

  // Estado de un índice: sin dato, vigente o caducado, con su edad en días y el texto que la tarjeta enseña.
  function status(store, indexId, today) {
    const index = INDICES[indexId];
    const point = latest(store, indexId);
    if (!index) return { state: "missing", point: null, ageDays: null, label: "Índice desconocido." };
    if (!point) return { state: "missing", point: null, ageDays: null, label: "Sin dato: la app no puede usar este índice hasta que lo teclees." };
    const ageDays = isIsoDate(today) ? Math.max(0, daysBetween(point.date, today)) : null;
    if (ageDays === null) return { state: "missing", point, ageDays: null, label: "Falta la fecha de hoy." };
    const value = String(point.value).replace(".", ",");
    if (ageDays > index.staleAfterDays) {
      return { state: "stale", point, ageDays, label: `${value} % del ${point.date}: caducado (hace ${ageDays} días; vale ${index.staleAfterDays}). Teclea el último publicado.` };
    }
    return { state: "fresh", point, ageDays, label: `${value} % del ${point.date}: vigente (hace ${ageDays} día${ageDays === 1 ? "" : "s"}; caduca a los ${index.staleAfterDays}).` };
  }

  // Media de los puntos de un mes (YYYY-MM). Es la media de lo tecleado, no de todos los días del mes: `count` dice con cuántos.
  function monthlyAverage(store, indexId, monthKey) {
    const points = seriesOf(store, indexId).filter((point) => point.date.slice(0, 7) === monthKey);
    if (!points.length) return { value: null, count: 0 };
    return { value: round4(points.reduce((sum, point) => sum + point.value, 0) / points.length), count: points.length };
  }

  // Valor vigente a una fecha: el último punto hasta ese día (sin mirar al futuro).
  function valueAt(store, indexId, date) {
    if (!isIsoDate(date)) return null;
    const upTo = seriesOf(store, indexId).filter((point) => point.date <= date);
    return upTo.length ? upTo[upTo.length - 1] : null;
  }

  return {
    SCHEMA_ID, INDICES, INDEX_IDS, MAX_POINTS_PER_INDEX,
    parsePercent, normalizeStore, seriesOf, latest, addPoint, removePoint, status, monthlyAverage, valueAt,
    isIsoDate, daysBetween, addDays,
  };
});
