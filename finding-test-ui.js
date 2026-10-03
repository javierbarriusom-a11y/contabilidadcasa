// WP-02 (NXP-01 + PRV-06 + UXS-05): cronómetro de la prueba de Hoy, su barra flotante y la tarjeta
// de Ajustes › Uso de la app. La lógica (validez, mediana, variante del titular) es de
// canonical-finding-test.js; aquí solo hay estado del dispositivo y DOM, para no gastar margen de
// app.js, que solo avisa de qué cifra pinta Hoy (noteShown) y pregunta qué texto toca (variantToday).
//
// Cómo se mide: se «prepara» la prueba en Ajustes y cuenta la SIGUIENTE apertura de la app — desde
// el arranque de la página si se abre de cero, o desde que vuelve a primer plano si estaba en
// memoria (lo normal en iPhone). Así el tiempo incluye la carga, que es lo que vive el hogar.
// No se guarda ningún importe: solo segundos, «misma cifra sí/no», edad de los saldos y variante.
(function exposeFinanceFindingTestUi(root) {
  "use strict";

  const FINDING_TEST_KEY = "finding-test";
  const RESULT_VISIBLE_MS = 6000;

  const engine = () => root.FinanceCanonicalFindingTest;
  let shown = null;
  let run = null;
  let hiddenSinceArmed = false;

  function deviceStorage() {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  }

  function readStore() {
    let raw = null;
    try {
      raw = JSON.parse(deviceStorage()?.getItem(FINDING_TEST_KEY) || "null");
    } catch {
      raw = null;
    }
    return engine() ? engine().normalizeStore(raw) : { armed: false, armedAt: "", mode: "A", attempts: [] };
  }

  function writeStore(store) {
    try {
      const storage = deviceStorage();
      storage.setItem(FINDING_TEST_KEY, JSON.stringify(store));
    } catch {
      // Navegación privada o almacenamiento bloqueado: la prueba solo vive esta visita.
    }
  }

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  // Lo que pregunta Hoy al pintar el titular: A o B, según la elección guardada y la línea base.
  function variantToday() {
    if (!engine()) return "A";
    const store = readStore();
    const summary = engine().summarize(store.attempts);
    return engine().headlineVariant({ mode: store.mode, today: todayIso(), baselineReady: summary.baselineReady }).variant;
  }

  // Lo que pinta Hoy: variante y cifra (importe o €/día). Solo en memoria, nunca se guarda.
  function noteShown(info) {
    shown = info && Number.isFinite(Number(info.value)) ? { ...info, value: Number(info.value) } : { variant: info?.variant || "A", value: null, ageDays: info?.ageDays ?? null, balanceMode: info?.balanceMode };
  }

  function fromIcon() {
    try {
      return Boolean(root.matchMedia?.("(display-mode: standalone)")?.matches || root.navigator?.standalone === true);
    } catch {
      return false;
    }
  }

  function el(id) {
    return root.document?.getElementById(id) || null;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function formatSeconds(seconds) {
    return seconds === null || seconds === undefined ? "—" : `${String(seconds).replace(".", ",")} s`;
  }

  // --- Barra flotante durante la prueba ------------------------------------------------------

  function showBar(stage, text) {
    const bar = el("findingTestBar");
    if (!bar) return;
    bar.dataset.stage = stage;
    const message = el("findingTestMessage");
    if (message) message.textContent = text;
    const found = el("findingTestFound");
    const form = el("findingTestForm");
    if (found) found.hidden = stage !== "running";
    if (form) form.hidden = stage !== "typing";
    const cancel = el("findingTestCancel");
    if (cancel) cancel.hidden = stage === "result";
    bar.hidden = false;
  }

  function hideBar() {
    const bar = el("findingTestBar");
    if (bar) bar.hidden = true;
  }

  function start(trigger) {
    const store = readStore();
    if (!store.armed || run) return;
    const now = root.performance?.now?.() ?? 0;
    run = { trigger, startedAt: trigger === "arranque" ? 0 : now, elapsedMs: null };
    store.armed = false;
    writeStore(store);
    // Empieza en lo alto de Hoy, como una apertura normal, aunque la app se quedara en otra pantalla.
    if (root.location && root.location.hash !== "#home") root.location.hash = "#home";
    root.scrollTo?.(0, 0);
    showBar("running", "Prueba en marcha: busca «Disponible para gastar» y pulsa cuando tengas la cifra.");
  }

  function found() {
    if (!run) return;
    run.elapsedMs = (root.performance?.now?.() ?? 0) - run.startedAt;
    showBar("typing", "¿Qué cifra has visto? Escríbela tal cual (el tiempo ya está parado).");
    el("findingTestInput")?.focus?.();
  }

  function save(typed) {
    if (!run || run.elapsedMs === null || !engine()) return;
    const store = readStore();
    const attempt = engine().buildAttempt({
      at: new Date().toISOString(),
      elapsedMs: run.elapsedMs,
      typed,
      shown: shown?.value ?? null,
      variant: shown?.variant || "A",
      balanceMode: shown?.balanceMode,
      ageDays: shown?.ageDays ?? null,
      trigger: run.trigger,
      fromIcon: fromIcon(),
      version: root.FinanceUxShell?.shortVersion?.(root.FinanceUxShell?.BUILD_INFO?.version) || "dev",
    });
    store.attempts = engine().addAttempt(store.attempts, attempt);
    writeStore(store);
    run = null;
    const input = el("findingTestInput");
    if (input) input.value = "";
    const verdict = attempt.matched ? "misma cifra" : "cifra distinta";
    showBar("result", `${formatSeconds(attempt.seconds)} · ${verdict}${attempt.valid ? "" : ` · no cuenta: ${attempt.reason}`}.`);
    root.setTimeout?.(hideBar, RESULT_VISIBLE_MS);
    renderCard();
  }

  function cancel() {
    run = null;
    hideBar();
    renderCard();
  }

  // --- Tarjeta de Ajustes › Uso de la app ----------------------------------------------------

  function renderCard() {
    const status = el("pruebaHoyEstado");
    if (!status || !engine()) return;
    const store = readStore();
    const summary = engine().summarize(store.attempts);
    const prepare = el("pruebaHoyPreparar");
    if (prepare) prepare.textContent = store.armed ? "Anular la prueba preparada" : "Preparar prueba";
    status.textContent = store.armed
      ? "Prueba preparada: sal de la app y ábrela desde el icono. Cuenta desde que se abre."
      : "Sin prueba preparada.";
    const resumen = el("pruebaHoyResumen");
    if (resumen) {
      const a = summary.A;
      const base = summary.baselineReady
        ? `Línea base (texto A): mediana ${formatSeconds(a.medianSeconds)} con ${a.valid} intentos válidos, misma cifra en ${a.matched} de ${a.valid}. Objetivo ≤ ${summary.targetSeconds} s: ${summary.meetsTarget ? "se cumple" : "no se cumple"}.`
        : `Línea base: ${a.valid} de ${summary.baselineAttempts} intentos válidos con el texto A${a.medianSeconds === null ? "" : ` (mediana provisional ${formatSeconds(a.medianSeconds)})`}.`;
      const b = summary.B.valid ? ` Texto B: mediana ${formatSeconds(summary.B.medianSeconds)} con ${summary.B.valid} válidos (con un solo usuario, es una preferencia, no un resultado).` : "";
      resumen.textContent = base + b;
    }
    root.document?.querySelectorAll?.('input[name="pruebaHoyModo"]').forEach((radio) => {
      radio.checked = radio.value === store.mode;
    });
    const nota = el("pruebaHoyModoNota");
    if (nota) {
      const choice = engine().headlineVariant({ mode: store.mode, today: todayIso(), baselineReady: summary.baselineReady });
      // B sin días hasta el cobro no tiene cifra honesta: Hoy se queda en A y aquí se dice por qué.
      nota.textContent = choice.variant === "B" && shown?.variant === "A"
        ? `Toca el texto B (${choice.reason}), pero Hoy no sabe cuántos días faltan para cobrar y sigue mostrando A: fija la fecha del próximo ingreso en la tarjeta de cobertura de Hoy.`
        : `Hoy se muestra el texto ${choice.variant} (${choice.reason}).`;
    }
    const body = el("pruebaHoyIntentos");
    if (body) {
      const rows = store.attempts.slice(-5).reverse();
      body.innerHTML = rows.length
        ? rows.map((attempt) => `<tr><td>${escapeHtml(String(attempt.at).slice(0, 10).split("-").reverse().join("/"))}</td><td>${escapeHtml(formatSeconds(attempt.seconds))}</td><td>${attempt.matched ? "Sí" : "No"}</td><td>${escapeHtml(attempt.variant)}</td><td>${attempt.valid ? "Cuenta" : `No cuenta: ${escapeHtml(attempt.reason)}`}</td><td>${attempt.fromIcon ? "Icono" : "Navegador"}</td></tr>`).join("")
        : '<tr><td colspan="6">Aún no hay intentos.</td></tr>';
    }
  }

  function togglePrepared() {
    const store = readStore();
    store.armed = !store.armed;
    store.armedAt = store.armed ? new Date().toISOString() : "";
    writeStore(store);
    hiddenSinceArmed = false;
    renderCard();
  }

  function setMode(mode) {
    const store = readStore();
    if (!engine()?.MODES.includes(mode)) return;
    store.mode = mode;
    writeStore(store);
    renderCard();
  }

  function mount() {
    const doc = root.document;
    if (!doc) return;
    el("pruebaHoyPreparar")?.addEventListener("click", togglePrepared);
    doc.querySelectorAll?.('input[name="pruebaHoyModo"]').forEach((radio) => radio.addEventListener("change", () => setMode(radio.value)));
    el("findingTestFound")?.addEventListener("click", found);
    el("findingTestCancel")?.addEventListener("click", cancel);
    el("findingTestForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      save(el("findingTestInput")?.value || "");
    });
    // Preparada y la app recién abierta: cuenta desde el arranque de la página.
    if (readStore().armed) start("arranque");
    // Preparada con la app en memoria: cuenta desde que vuelve a primer plano (no desde que se preparó).
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "hidden") {
        hiddenSinceArmed = true;
        return;
      }
      if (hiddenSinceArmed && readStore().armed) start("vuelta");
    });
    root.addEventListener?.("hashchange", renderCard);
    renderCard();
  }

  const api = { variantToday, noteShown, renderCard, mount, _internals: { start, found, save, cancel, togglePrepared, setMode, readStore } };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceFindingTestUi = api;
  if (root?.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", mount);
    else mount();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
