(function attachCanonicalFindingTest(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalFindingTest = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalFindingTest() {
  "use strict";

  // WP-02 (NXP-01 + PRV-06 + UXS-05, BACKLOG_DEFINITIVO.md §5.1): prueba cronometrada de Hoy. Mide
  // cuánto tarda el hogar, abriendo la app desde el icono, en tener la cifra de «Disponible para
  // gastar» y si la que lee es la misma que calcula la app. Es un instrumento de medida: no cambia
  // ninguna cifra. Lógica pura; el cronómetro y la barra viven en finding-test-ui.js.
  //
  // Reglas que vienen del backlog:
  // - GOV-05: solo cuenta con saldos del día (tecleados hoy o ayer). Con saldos calculados por
  //   calendario o más antiguos el intento se guarda, pero no entra en la mediana.
  // - Un solo usuario (n = 1): el A/B del titular es una preferencia, no un resultado. «Alternar por
  //   semanas» no se activa hasta tener la línea base: 3 intentos válidos con el texto A.
  // - No se guarda ningún importe: solo segundos, «misma cifra sí/no», edad de los saldos y variante.

  const MAX_ATTEMPTS = 30;
  const BASELINE_ATTEMPTS = 3;
  const TARGET_SECONDS = 15;
  const MAX_FRESH_DAYS = 1;
  const SAME_FIGURE_TOLERANCE_EUR = 1;
  const MODES = ["A", "B", "alternar"];

  // Importe tecleado en formato español: «8.310», «8310,5», «8 310 €», «≈ 85 €/día». Un punto seguido
  // de exactamente tres cifras es separador de miles; si hay punto y coma, decimal es el último.
  function parseTypedAmount(text) {
    let clean = String(text ?? "").replace(/[≈~€\s ]|\/d[ií]a/gi, "");
    if (!clean) return null;
    const negative = /^[-−]/.test(clean);
    clean = clean.replace(/^[-−+]/, "");
    if (!/^[\d.,]+$/.test(clean)) return null;
    const lastDot = clean.lastIndexOf(".");
    const lastComma = clean.lastIndexOf(",");
    if (lastDot >= 0 && lastComma >= 0) {
      const decimal = lastDot > lastComma ? "." : ",";
      const thousands = decimal === "." ? "," : ".";
      clean = clean.split(thousands).join("").replace(decimal, ".");
    } else if (lastComma >= 0) {
      clean = clean.split(".").join("").replace(/,(?=[^,]*$)/, ".").split(",").join("");
    } else if (lastDot >= 0 && (/^\d{1,3}(\.\d{3})+$/.test(clean))) {
      clean = clean.split(".").join("");
    }
    const value = Number(clean);
    if (!Number.isFinite(value)) return null;
    return negative ? -value : value;
  }

  // La persona puede redondear lo que lee: un euro de margen.
  function sameFigure(typed, shown) {
    const a = parseTypedAmount(typed);
    const b = Number(shown);
    if (a === null || !Number.isFinite(b)) return false;
    return Math.abs(a - b) <= SAME_FIGURE_TOLERANCE_EUR;
  }

  // GOV-05: ¿cuenta este intento para la mediana?
  /**
   * @param {{balanceMode?: string, ageDays?: number|null, figureAvailable?: boolean}} [input]
   */
  function attemptValidity({ balanceMode, ageDays, figureAvailable } = {}) {
    if (!figureAvailable) return { valid: false, reason: "Hoy no tenía cifra que leer" };
    if (balanceMode === "auto") return { valid: false, reason: "saldos calculados por calendario, no tecleados del banco" };
    if (ageDays === null || ageDays === undefined || !Number.isFinite(Number(ageDays))) return { valid: false, reason: "saldos sin fecha" };
    if (Number(ageDays) < 0) return { valid: false, reason: "saldos con fecha posterior a hoy" };
    if (Number(ageDays) > MAX_FRESH_DAYS) return { valid: false, reason: `saldos de hace ${Number(ageDays)} días` };
    return { valid: true, reason: "" };
  }

  function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  // Un intento listo para guardar. `typed` y `shown` se usan para comparar y se descartan.
  /**
   * @param {{at?: string, elapsedMs?: number|null, typed?: string, shown?: number|null, variant?: string, balanceMode?: string, ageDays?: number|null, trigger?: string, fromIcon?: boolean, version?: string}} [input]
   */
  function buildAttempt({ at, elapsedMs, typed, shown, variant = "A", balanceMode, ageDays, trigger = "arranque", fromIcon = false, version = "" } = {}) {
    const figureAvailable = Number.isFinite(Number(shown)) && shown !== null;
    const validity = attemptValidity({ balanceMode, ageDays, figureAvailable });
    const measured = elapsedMs !== null && elapsedMs !== undefined && Number.isFinite(Number(elapsedMs)) && Number(elapsedMs) >= 0;
    const seconds = measured ? round1(Number(elapsedMs) / 1000) : null;
    return {
      at: String(at || ""),
      seconds,
      matched: figureAvailable ? sameFigure(typed, shown) : false,
      valid: validity.valid && seconds !== null,
      reason: seconds === null ? "sin tiempo medido" : validity.reason,
      variant: variant === "B" ? "B" : "A",
      ageDays: Number.isFinite(Number(ageDays)) && ageDays !== null ? Number(ageDays) : null,
      balanceMode: balanceMode === "auto" ? "auto" : "manual",
      trigger: trigger === "vuelta" ? "vuelta" : "arranque",
      fromIcon: Boolean(fromIcon),
      version: String(version || ""),
    };
  }

  function addAttempt(attempts = [], attempt) {
    return [...attempts, attempt].slice(-MAX_ATTEMPTS);
  }

  function summarizeVariant(attempts, variant) {
    const own = attempts.filter((attempt) => attempt.variant === variant);
    const valid = own.filter((attempt) => attempt.valid);
    const medianSeconds = median(valid.map((attempt) => attempt.seconds));
    return {
      attempts: own.length,
      valid: valid.length,
      medianSeconds: medianSeconds === null ? null : round1(medianSeconds),
      matched: valid.filter((attempt) => attempt.matched).length,
    };
  }

  // Línea base = 3 intentos válidos con el texto A. Hasta entonces no se compara nada.
  function summarize(attempts = []) {
    const A = summarizeVariant(attempts, "A");
    const B = summarizeVariant(attempts, "B");
    const baselineReady = A.valid >= BASELINE_ATTEMPTS;
    const meetsTarget = A.medianSeconds === null ? null : A.medianSeconds <= TARGET_SECONDS;
    return { total: attempts.length, A, B, baselineReady, meetsTarget, targetSeconds: TARGET_SECONDS, baselineAttempts: BASELINE_ATTEMPTS };
  }

  // Semana ISO (1-53) de una fecha AAAA-MM-DD, para alternar el titular por semanas.
  function isoWeek(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  // Qué texto lleva hoy el titular. «alternar» solo alterna con la línea base hecha: semana ISO par
  // → A, impar → B.
  function headlineVariant({ mode = "A", today = "", baselineReady = false } = {}) {
    if (mode === "B") return { variant: "B", reason: "elegido B" };
    if (mode !== "alternar") return { variant: "A", reason: "elegido A" };
    if (!baselineReady) return { variant: "A", reason: `alterna cuando haya ${BASELINE_ATTEMPTS} intentos válidos con A` };
    const week = isoWeek(today);
    if (week === null) return { variant: "A", reason: "sin fecha" };
    return { variant: week % 2 ? "B" : "A", reason: `semana ${week}` };
  }

  // Variante B (PRV-06): «≈ X €/día hasta cobrar». Sin días hasta el cobro o sin margen positivo no
  // hay cifra honesta que dar: se queda en A.
  /**
   * @param {{spendable?: number|null, days?: number|null}} [input]
   */
  function perDayUntilPayday({ spendable, days } = {}) {
    const value = Number(spendable);
    const remaining = Number(days);
    if (!Number.isFinite(value) || value <= 0 || days === null || days === undefined || !Number.isFinite(remaining) || remaining < 0) return null;
    return Math.floor(value / Math.max(1, remaining));
  }

  function normalizeStore(raw) {
    const store = raw && typeof raw === "object" ? raw : {};
    return {
      armed: Boolean(store.armed),
      armedAt: String(store.armedAt || ""),
      mode: MODES.includes(store.mode) ? store.mode : "A",
      attempts: Array.isArray(store.attempts) ? store.attempts.filter((attempt) => attempt && typeof attempt === "object").slice(-MAX_ATTEMPTS) : [],
    };
  }

  return {
    MAX_ATTEMPTS,
    BASELINE_ATTEMPTS,
    TARGET_SECONDS,
    MODES,
    parseTypedAmount,
    sameFigure,
    attemptValidity,
    median,
    buildAttempt,
    addAttempt,
    summarize,
    isoWeek,
    headlineVariant,
    perDayUntilPayday,
    normalizeStore,
  };
});
