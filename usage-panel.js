(function exposeFinanceUsagePanel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceUsagePanel = api;
  if (root && typeof document !== "undefined" && typeof window !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => api.mount());
    else api.mount();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildFinanceUsagePanel() {
  "use strict";

  // WP-03 (UXS-04 + NTC-03 reducido, BACKLOG_DEFINITIVO.md §5.1): panel de uso real. Es la base de
  // la regla de parada: al cerrar cada ola se mira si la app se usa y cuánto cuesta mantenerla. Con un
  // solo usuario y un solo móvil (decisión del hogar del 3/10/2026), el contador es local y sin
  // sincronización. Solo agregados: qué días se abrió, la edad de los saldos esos días y los minutos
  // que el hogar declara por semana. Ningún importe, ningún movimiento.
  //
  // Lo que todavía no se puede medir se dice, no se inventa: el «% del gasto registrado en < 48 h»
  // necesita la fecha en la que se registra cada gasto, que la app no guarda hoy, y «decisiones registradas»
  // necesita acordar qué cuenta como decisión. Los enlaces de WP-25 no lo resuelven: registran en el momento del
  // pago por construcción (saldría ~100 % sin medir nada); la medida honesta cruza lo registrado con el extracto (WP-53).

  const USAGE_DAYS_KEY = "usage-days";
  const KEEP_DAYS = 180;
  const KEEP_WEEKS = 26;
  const FRESH_MAX_DAYS = 3;
  const TARGETS = { activeDaysPerWeek: 4, freshPct: 90, minutesPerWeek: 10 };
  const WINDOW_WEEKS = 4;
  const WINDOW_DAYS = 30;
  const MAX_MINUTES = 600;
  // Con menos días de uso, un porcentaje de frescura es ruido: se enseña, pero sin veredicto.
  const MIN_DAYS_FOR_VERDICT = 7;

  function parseIso(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
  }

  function toIso(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(iso, days) {
    const date = parseIso(iso);
    if (!date) return "";
    date.setUTCDate(date.getUTCDate() + days);
    return toIso(date);
  }

  function localIsoDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  // «2026-W41»: año y semana ISO (el 1/1/2027, viernes, es la semana 53 de 2026).
  function isoWeekKey(iso) {
    const date = parseIso(iso);
    if (!date) return "";
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const year = date.getUTCFullYear();
    const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  // Lunes de la semana ISO de una fecha.
  function weekStart(iso) {
    const date = parseIso(iso);
    if (!date) return "";
    const day = date.getUTCDay() || 7;
    return addDays(iso, 1 - day);
  }

  function normalizeStore(raw) {
    const store = raw && typeof raw === "object" ? raw : {};
    const days = {};
    for (const [iso, entry] of Object.entries(store.days && typeof store.days === "object" ? store.days : {})) {
      if (!parseIso(iso)) continue;
      const freshAge = Number.isFinite(Number(entry?.freshAge)) && entry?.freshAge !== null ? Number(entry.freshAge) : null;
      days[iso] = { freshAge, auto: Boolean(entry?.auto) };
    }
    const minutes = {};
    for (const [week, value] of Object.entries(store.minutes && typeof store.minutes === "object" ? store.minutes : {})) {
      if (/^\d{4}-W\d{2}$/.test(week) && Number.isFinite(Number(value))) minutes[week] = Number(value);
    }
    return { days, minutes };
  }

  function prune(store, today) {
    const oldestDay = addDays(today, -KEEP_DAYS);
    const oldestWeek = isoWeekKey(addDays(today, -7 * KEEP_WEEKS));
    const days = Object.fromEntries(Object.entries(store.days).filter(([iso]) => iso > oldestDay));
    const minutes = Object.fromEntries(Object.entries(store.minutes).filter(([week]) => week >= oldestWeek));
    return { days, minutes };
  }

  function recordActiveDay(store, today) {
    const current = normalizeStore(store);
    if (!parseIso(today)) return current;
    if (!current.days[today]) current.days[today] = { freshAge: null, auto: false };
    return prune(current, today);
  }

  // La edad de los saldos que enseñó Hoy ese día. Cuenta la mejor del día (si se actualizan a media
  // mañana, el día cuenta como fresco). Saldos calculados por calendario no son saldos del banco.
  /**
   * @param {object} store
   * @param {string} today
   * @param {{ageDays?: number|null, balanceMode?: string}} [info]
   */
  function recordFreshness(store, today, { ageDays, balanceMode } = {}) {
    const current = recordActiveDay(store, today);
    const day = current.days[today];
    if (!day) return current;
    if (balanceMode === "auto") {
      day.auto = true;
      return current;
    }
    const age = Number(ageDays);
    if (ageDays === null || ageDays === undefined || !Number.isFinite(age) || age < 0) return current;
    day.freshAge = day.freshAge === null ? age : Math.min(day.freshAge, age);
    return current;
  }

  function recordMinutes(store, week, minutes) {
    const current = normalizeStore(store);
    const value = String(minutes ?? "").trim() === "" ? NaN : Number(minutes);
    if (!/^\d{4}-W\d{2}$/.test(String(week)) || !Number.isFinite(value) || value < 0 || value > MAX_MINUTES) return { store: current, ok: false };
    current.minutes[week] = Math.round(value);
    return { store: current, ok: true };
  }

  function average(values) {
    return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
  }

  // Las cifras del panel. Las semanas que cuentan son las 4 completas anteriores a la actual, y solo
  // desde la primera semana con datos: una semana anterior al primer uso no es una semana sin uso.
  function summarize(raw, today) {
    const store = normalizeStore(raw);
    const firstDay = Object.keys(store.days).sort()[0] || "";
    const currentWeekStart = weekStart(today);
    const weeks = [];
    for (let i = WINDOW_WEEKS; i >= 1; i -= 1) {
      const start = addDays(currentWeekStart, -7 * i);
      const end = addDays(start, 6);
      if (!firstDay || end < weekStart(firstDay)) continue;
      const activeDays = Object.keys(store.days).filter((iso) => iso >= start && iso <= end).length;
      weeks.push({ week: isoWeekKey(start), start, activeDays, minutes: store.minutes[isoWeekKey(start)] ?? null });
    }
    const activeThisWeek = Object.keys(store.days).filter((iso) => iso >= currentWeekStart && iso <= today).length;
    const avgActiveDays = average(weeks.map((week) => week.activeDays));

    const since = addDays(today, -(WINDOW_DAYS - 1));
    const windowDays = Object.entries(store.days).filter(([iso]) => iso >= since && iso <= today);
    const freshDays = windowDays.filter(([, entry]) => entry.freshAge !== null && entry.freshAge <= FRESH_MAX_DAYS).length;
    const freshPct = windowDays.length ? Math.round((freshDays / windowDays.length) * 100) : null;

    const declared = weeks.map((week) => week.minutes).filter((value) => value !== null);
    const thisWeek = isoWeekKey(today);
    const avgMinutes = average(declared);
    return {
      firstDay,
      weeks,
      activeThisWeek,
      adoption: { value: avgActiveDays, target: TARGETS.activeDaysPerWeek, meets: avgActiveDays === null ? null : avgActiveDays >= TARGETS.activeDaysPerWeek },
      freshness: { value: freshPct, activeDays: windowDays.length, freshDays, target: TARGETS.freshPct, meets: freshPct === null || windowDays.length < MIN_DAYS_FOR_VERDICT ? null : freshPct >= TARGETS.freshPct },
      minutes: { value: avgMinutes, declaredWeeks: declared.length, thisWeek, thisWeekValue: store.minutes[thisWeek] ?? null, target: TARGETS.minutesPerWeek, meets: avgMinutes === null ? null : avgMinutes <= TARGETS.minutesPerWeek },
    };
  }

  // --- Navegador -----------------------------------------------------------------------------

  let rootRef = null;

  function deviceStorage() {
    try {
      return rootRef?.localStorage || null;
    } catch {
      return null;
    }
  }

  function readStore() {
    try {
      return normalizeStore(JSON.parse(deviceStorage()?.getItem(USAGE_DAYS_KEY) || "null"));
    } catch {
      return normalizeStore(null);
    }
  }

  function writeStore(store) {
    try {
      const storage = deviceStorage();
      storage.setItem(USAGE_DAYS_KEY, JSON.stringify(store));
    } catch {
      // Navegación privada o almacenamiento bloqueado: el panel solo ve esta visita.
    }
  }

  function noteActiveDay() {
    writeStore(recordActiveDay(readStore(), localIsoDate()));
  }

  // Lo llama finding-test-ui.js cuando Hoy pinta su cifra (sin importes: edad y modo de los saldos).
  function noteFreshness(info) {
    if (!rootRef) return;
    writeStore(recordFreshness(readStore(), localIsoDate(), info || {}));
  }

  function el(id) {
    return rootRef?.document?.getElementById(id) || null;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function formatNumber(value) {
    return value === null || value === undefined ? "—" : String(value).replace(".", ",");
  }

  function verdict(meets, pending = "Sin datos aún") {
    if (meets === null) return pending;
    return meets ? "Cumple" : "No cumple";
  }

  // Una ficha por métrica, apilada: en el móvil una tabla de cinco columnas escondía los valores.
  function metricRow(name, value, target, meets, detail, pending) {
    const tone = meets === null ? "neutral" : meets ? "good" : "warn";
    const objective = target === "—" ? "" : ` Objetivo: ${escapeHtml(target)}`;
    return `<li><div class="panel-uso-cabecera"><strong>${escapeHtml(name)}</strong><span class="panel-uso-valor">${escapeHtml(value)}</span></div><p><span class="status-pill ${tone}">${escapeHtml(verdict(meets, pending))}</span>${objective}</p><p class="e19-kpi-note">${escapeHtml(detail)}</p></li>`;
  }

  function panelRows(summary, findingSummary, pulseSummary = null) {
    const weeksLabel = summary.weeks.length ? `${summary.weeks.length} semana${summary.weeks.length === 1 ? "" : "s"} completa${summary.weeks.length === 1 ? "" : "s"}` : "aún no hay una semana completa";
    const rows = [
      metricRow("Días de uso por semana", formatNumber(summary.adoption.value), "≥ 4", summary.adoption.meets, `Media de ${weeksLabel}; esta semana, ${summary.activeThisWeek}.`),
      metricRow("Saldos frescos los días de uso", summary.freshness.value === null ? "—" : `${summary.freshness.value} %`, "≥ 90 %", summary.freshness.meets, `${summary.freshness.freshDays} de ${summary.freshness.activeDays} días de uso (últimos 30) con saldos del banco de 3 días o menos.${summary.freshness.activeDays < MIN_DAYS_FOR_VERDICT ? ` Sin veredicto hasta ${MIN_DAYS_FOR_VERDICT} días de uso.` : ""}`, "Pocos datos"),
      metricRow("Minutos por semana para mantener la app", formatNumber(summary.minutes.value), "≤ 10", summary.minutes.meets, `Lo que declaras cada semana (${summary.minutes.declaredWeeks} de ${summary.weeks.length} semanas completas).`),
    ];
    if (findingSummary) {
      const a = findingSummary.A;
      rows.push(metricRow("Segundos hasta la cifra de Hoy", a.medianSeconds === null ? "—" : `${formatNumber(a.medianSeconds)} s`, "≤ 15 s", findingSummary.baselineReady ? findingSummary.meetsTarget : null, `Mediana de la prueba de 30 segundos: ${a.valid} de ${findingSummary.baselineAttempts} intentos válidos para la línea base.`));
    }
    // WP-26: el «Pulso de saldos» de Registrar mide cuánto se tarda en dejar las dos cuentas al día.
    if (pulseSummary) {
      const share = pulseSummary.coincideShare === null ? "" : ` «Coincide» en el ${pulseSummary.coincideShare} % de las respuestas (si roza el 100 % con saldos que se mueven, puede que se confirme sin mirar).`;
      rows.push(metricRow("Segundos para actualizar saldos", pulseSummary.medianSeconds === null ? "—" : `${formatNumber(pulseSummary.medianSeconds)} s`, "≤ 20 s", pulseSummary.medianSeconds === null ? null : pulseSummary.medianSeconds <= 20, pulseSummary.count ? `Mediana de las últimas ${pulseSummary.count} veces con el Pulso de saldos de Registrar.${share}` : "Aún sin medir: se mide al usar el Pulso de saldos de Registrar.", "Sin medir"));
    }
    rows.push(metricRow("Gasto registrado en menos de 48 h", "—", "—", null, "Sin medir: la app no guarda cuándo registras cada gasto. Los enlaces (WP-25) registran al pagar; la medida real cruza lo registrado con el extracto (WP-53).", "Sin medir"));
    rows.push(metricRow("Decisiones registradas", "—", "—", null, "Sin medir: falta acordar qué cuenta como decisión.", "Sin medir"));
    return rows.join("");
  }

  function render() {
    const body = el("panelUsoLista");
    if (!body) return;
    const today = localIsoDate();
    const summary = summarize(readStore(), today);
    body.innerHTML = panelRows(summary, rootRef?.FinanceFindingTestUi?.summary?.() || null, rootRef?.FinanceBalancePulseUi?.summary?.() || null);
    const since = el("panelUsoDesde");
    if (since) since.textContent = summary.firstDay ? `Datos desde el ${summary.firstDay.split("-").reverse().join("/")}, solo en este móvil.` : "Aún no hay datos: el panel empieza a contar hoy.";
    const input = el("panelUsoMinutos");
    const label = el("panelUsoMinutosEstado");
    if (input && rootRef?.document?.activeElement !== input) input.value = summary.minutes.thisWeekValue ?? "";
    if (label) label.textContent = summary.minutes.thisWeekValue === null ? "Esta semana aún no lo has dicho." : `Esta semana: ${summary.minutes.thisWeekValue} min.`;
  }

  function saveMinutes() {
    const input = el("panelUsoMinutos");
    const label = el("panelUsoMinutosEstado");
    const result = recordMinutes(readStore(), isoWeekKey(localIsoDate()), input?.value);
    if (!result.ok) {
      if (label) label.textContent = `Escribe un número de minutos entre 0 y ${MAX_MINUTES}.`;
      return;
    }
    writeStore(result.store);
    render();
  }

  function mount(target = typeof globalThis !== "undefined" ? globalThis : null) {
    rootRef = target;
    const doc = rootRef?.document;
    if (!doc) return;
    noteActiveDay();
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "visible") noteActiveDay();
    });
    el("panelUsoForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveMinutes();
    });
    rootRef.addEventListener?.("hashchange", render);
    render();
  }

  return {
    TARGETS,
    isoWeekKey,
    weekStart,
    normalizeStore,
    recordActiveDay,
    recordFreshness,
    recordMinutes,
    summarize,
    noteFreshness,
    render,
    mount,
  };
});
