(function attachCanonicalForecastConfidence(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecastConfidence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalForecastConfidence() {
  "use strict";

  // FX-31 (BACKLOG_NOVIEMBRE_OLEADA_1.md; docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md §8): una insignia de confianza de la
  // previsión, «baja · media · alta», con el porqué y la tarea que más la sube. No mide nada nuevo: junta tres señales que ya
  // existen y las dice en palabras de hogar.
  //   · Días de cargo (WP-10): del gasto de los próximos 90 días, cuánto cae en un día confirmado (ponderado por importe).
  //   · Saldos (WP-26): si la previsión parte de una foto del banco y de cuándo es.
  //   · Acierto (WP-12): cuántos cierres comparables hay y cuánto se equivoca la previsión de fin de mes.
  // La tarea la elige la cola de WP-45 (euros de incertidumbre por minuto): aquí solo se queda con la primera que sube una señal
  // que no está bien. Motor puro: ni DOM, ni almacenamiento, ni reloj.
  //
  // Reglas de honestidad:
  //   · «alta» exige las tres señales bien: sin 3 cierres comparables no se sabe cuánto acierta, y eso no puede ser confianza alta.
  //   · «baja» con dos o más señales mal; si no, «media».
  //   · una señal sin dato es «mal», no «bien»: la falta de dato no da confianza.
  //   · la insignia no cambia ninguna cifra: dice cuánto fiarse de ellas.

  const SCHEMA_ID = "finance-forecast-confidence/v1";
  const DATE_OK_PCT = 70; // el objetivo de WP-10 (M-RESOL)
  const DATE_REGULAR_PCT = 30;
  const CLOSE_OK_ERROR_PCT = 10; // error medio de la caja a fin de mes que todavía se da por bueno
  const LEVEL_LABEL = Object.freeze({ alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" });
  const STATE_ICON = Object.freeze({ ok: "✓", regular: "◐", mal: "⚠" });
  const SIGNAL_IDS = Object.freeze(["dias", "saldos", "acierto"]);

  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const text = (value) => String(value ?? "").trim();

  function ageText(days) {
    if (days <= 0) return "de hoy";
    if (days === 1) return "de ayer";
    return `de hace ${days} días`;
  }

  /** WP-10: `quality` es la salida de FinanceCanonicalForecastQuality.dateQuality sobre los pagos de los próximos 90 días. */
  function dateSignal(quality = {}) {
    const base = { id: "dias", title: "Días de cargo" };
    if (!finite(quality.value)) return { ...base, state: "ok", text: "No hay pagos previstos en los próximos 90 días: no hay días que adivinar." };
    const value = Math.round(Number(quality.value));
    if (value >= DATE_OK_PCT) return { ...base, state: "ok", text: `El ${value} % del gasto de los próximos 90 días tiene su día confirmado.` };
    const state = value >= DATE_REGULAR_PCT ? "regular" : "mal";
    const resto = value === 0 ? "Ningún pago de los próximos 90 días tiene su día confirmado: todos caen en un día estimado." : `Solo el ${value} % del gasto de los próximos 90 días tiene su día confirmado; el resto cae en un día estimado.`;
    return { ...base, state, text: `${resto} Por eso el punto más bajo puede caer otro día.` };
  }

  /** WP-26: `mode` «auto» son saldos calculados por calendario; `ageDays` la edad de la foto del banco. */
  function balanceSignal({ mode = "auto", ageDays = null, staleAfterDays = 4 } = {}) {
    const base = { id: "saldos", title: "Saldos" };
    if (mode === "auto") return { ...base, state: "mal", text: "Los saldos se calculan por calendario, sin una foto del banco: la previsión parte de una estimación." };
    if (!finite(ageDays)) return { ...base, state: "mal", text: "Los saldos no tienen fecha: no se sabe de cuándo parte la previsión." };
    const days = Math.max(0, Math.round(Number(ageDays)));
    const stale = Math.max(1, Number(staleAfterDays) || 4);
    if (days < stale) return { ...base, state: "ok", text: `La previsión parte de los saldos del banco ${ageText(days)}.` };
    return { ...base, state: days < stale * 4 ? "regular" : "mal", text: `La previsión parte de los saldos del banco ${ageText(days)}: desde entonces el dinero se ha movido.` };
  }

  /** WP-12: `comparable` cierres con foto y saldos del banco; `errorPct` el error medio de la caja a fin de mes, si hay bastantes. */
  function closeSignal({ comparable = 0, min = 3, errorPct = null } = {}) {
    const base = { id: "acierto", title: "Acierto" };
    const n = Math.max(0, Math.round(Number(comparable) || 0));
    const needed = Math.max(1, Math.round(Number(min) || 3));
    if (n === 0) return { ...base, state: "mal", text: `Todavía ningún cierre comparable: no se sabe cuánto acierta (hacen falta ${needed}).` };
    if (n < needed) return { ...base, state: "regular", text: `${n} de ${needed} cierres comparables: aún no se puede medir cuánto acierta.` };
    if (finite(errorPct) && Number(errorPct) > CLOSE_OK_ERROR_PCT) {
      return { ...base, state: "regular", text: `Con ${n} cierres comparables, la previsión de fin de mes se equivoca de media un ${String(Math.round(Number(errorPct) * 10) / 10).replace(".", ",")} %: más de lo que debería.` };
    }
    const error = finite(errorPct) ? `, y se equivoca de media un ${String(Math.round(Number(errorPct) * 10) / 10).replace(".", ",")} %` : "";
    return { ...base, state: "ok", text: `Medida con ${n} cierres comparables${error}.` };
  }

  function levelOf(signals) {
    const mal = signals.filter((signal) => signal.state === "mal").length;
    if (signals.every((signal) => signal.state === "ok")) return "alta";
    return mal >= 2 ? "baja" : "media";
  }

  /**
   * La insignia y su hoja.
   * @param {{dates?: any, balances?: any, closes?: any, tasks?: Array<{id: string, signal?: string, label: string}>}} [input]
   *   `tasks`: las tareas ya en el orden de la cola de WP-45 (primero las que tienen euros por minuto, después las sin estimar),
   *   cada una con la señal que sube (`dias`, `saldos` o `acierto`). Las que no suben ninguna se ignoran.
   */
  function evaluate({ dates = {}, balances = {}, closes = {}, tasks = [] } = {}) {
    const signals = [dateSignal(dates), balanceSignal(balances), closeSignal(closes)];
    const level = levelOf(signals);
    const weak = new Set(signals.filter((signal) => signal.state !== "ok").map((signal) => signal.id));
    const seen = new Set();
    const candidates = (Array.isArray(tasks) ? tasks : []).filter((task) => {
      if (!task || !text(task.id) || !weak.has(task.signal) || seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
    return {
      schemaId: SCHEMA_ID,
      level,
      label: LEVEL_LABEL[level],
      signals: signals.map((signal) => ({ ...signal, icon: STATE_ICON[signal.state] })),
      top: candidates[0] || null,
      more: candidates.slice(1, 3),
    };
  }

  return Object.freeze({ SCHEMA_ID, DATE_OK_PCT, DATE_REGULAR_PCT, CLOSE_OK_ERROR_PCT, LEVEL_LABEL, STATE_ICON, SIGNAL_IDS, dateSignal, balanceSignal, closeSignal, levelOf, evaluate });
});
