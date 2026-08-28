/**
 * tests/retiro-asistente-financiero.test.cjs
 *
 * Punto aislado del plan de mejora post-E20 (ver BACKLOG.md §9), decidido el 28 de agosto de 2026:
 * retirada del widget flotante "Asistente financiero" (`#financeAssistant`, presente en las 40+
 * pantallas). Empareja el texto libre contra cuatro palabras clave (deuda/proyecto/ahorro/caja) y
 * rellena una plantilla con cifras reales — es honesto sobre lo que es ("análisis local basado en
 * reglas"), pero era el único rincón de la app que fingía diálogo abierto cuando el resto del diseño
 * se apoya en decisiones trazables con evidencia. Sus cuatro lecturas ya están mejor servidas en
 * otro sitio: prioridad de deuda en el Asesor ejecutivo, ahorro/caja en Análisis, decisiones abiertas
 * en Hoy — por eso la retirada es una eliminación pura, sin construir nada nuevo.
 *
 * El motor canónico E9 (`canonical-e9-assistant.js`, `FinanceCanonicalE9Assistant`) NO se toca: es
 * infraestructura general (validación de citas, prohibición de contenido de escritura) sin más
 * llamador que este widget en app.js, pensada para un futuro motor de recomendación real (T-6);
 * queda disponible sin usar, no se borra.
 *
 * - Parte A: index.html ya no tiene el widget ni ningún control suyo.
 * - Parte B: app.js ya no define las funciones ni el wiring del widget.
 * - Parte C: styles.css ya no tiene las reglas del widget.
 * - Parte D: el motor canónico E9 sigue intacto (no forma parte de esta retirada).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");
const css = read("styles.css");

// ============================================================================
// Parte A: index.html
// ============================================================================

test("retiro Asistente financiero · el widget y sus controles ya no están en index.html", () => {
  assert.doesNotMatch(html, /id="financeAssistant"/);
  assert.doesNotMatch(html, /class="finance-assistant"/);
  assert.doesNotMatch(html, /id="assistantToggle"/);
  assert.doesNotMatch(html, /id="assistantPanel"/);
  assert.doesNotMatch(html, /id="assistantClose"/);
  assert.doesNotMatch(html, /id="assistantQuestion"/);
  assert.doesNotMatch(html, /id="assistantAsk"/);
  assert.doesNotMatch(html, /id="assistantAnswer"/);
  assert.doesNotMatch(html, /data-assistant-prompt/);
});

// ============================================================================
// Parte B: app.js
// ============================================================================

test("retiro Asistente financiero · las funciones del widget ya no existen en app.js", () => {
  assert.doesNotMatch(app, /function assistantDashboardContext\(/);
  assert.doesNotMatch(app, /function assistantRecommendationForQuestion\(/);
  assert.doesNotMatch(app, /function renderAssistantAnswer\(/);
  assert.doesNotMatch(app, /function handleAssistantAsk\(/);
  assert.doesNotMatch(app, /function toggleAssistant\(/);
});

test("retiro Asistente financiero · ya no hay wiring de clics/teclado del widget en app.js", () => {
  assert.doesNotMatch(app, /qs\("assistantToggle"\)/);
  assert.doesNotMatch(app, /qs\("assistantClose"\)/);
  assert.doesNotMatch(app, /qs\("assistantAsk"\)/);
  assert.doesNotMatch(app, /qs\("assistantQuestion"\)/);
  assert.doesNotMatch(app, /data-assistant-prompt/);
});

// ============================================================================
// Parte C: styles.css
// ============================================================================

test("retiro Asistente financiero · las reglas del widget ya no están en styles.css", () => {
  assert.doesNotMatch(css, /\.finance-assistant\s*\{/);
  assert.doesNotMatch(css, /\.assistant-toggle/);
  assert.doesNotMatch(css, /\.assistant-panel/);
  assert.doesNotMatch(css, /\.assistant-head/);
  assert.doesNotMatch(css, /\.assistant-quick-actions/);
  assert.doesNotMatch(css, /\.assistant-answer/);
  assert.doesNotMatch(css, /\.assistant-mini-kpis/);
});

// ============================================================================
// Parte D: el motor canónico E9 no forma parte de esta retirada
// ============================================================================

test("retiro Asistente financiero · el motor canónico E9 (infraestructura futura, T-6) sigue cargado y sin borrar", () => {
  assert.match(html, /canonical-e9-assistant\.js/);
  assert.ok(fs.existsSync(path.join(root, "canonical-e9-assistant.js")), "canonical-e9-assistant.js no se borra: es infraestructura reutilizable, no parte del widget");
  const engineSrc = read("canonical-e9-assistant.js");
  assert.match(engineSrc, /localDisclosure/);
  assert.match(engineSrc, /prepareQuery/);
  assert.match(engineSrc, /validateResponse/);
});
