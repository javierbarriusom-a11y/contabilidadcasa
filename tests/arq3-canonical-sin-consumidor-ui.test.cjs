const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const viewsDir = path.join(root, "views");
const viewsSource = fs
  .readdirSync(viewsDir)
  .filter((file) => file.endsWith(".js"))
  .map((file) => fs.readFileSync(path.join(viewsDir, file), "utf8"))
  .join("\n");

// ARQ-3 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2): detección sistemática de motores canonical-*.js sin
// consumidor real de UI — hasta ahora solo se verificaba caso a caso cuando surgía la pregunta
// (`BACKLOG_INDICE.md` documentaba un único hallazgo, `canonical-e9-assistant.js`/Copiloto-IA, desde
// la sesión 42). Auditoría completa de los 65 ficheros (sesión 231) confirmó que ese caso no era
// aislado: 5 motores más de la misma épica E9 (bancarización/IA, construidos por adelantado para
// A5-1) están igual de huérfanos — cargados en index.html, sin una sola invocación en app.js ni en
// ningún views/*.js. Ninguno de los 59 motores restantes lo está: dos casos que un grep ingenuo
// habría marcado huérfanos (`canonical-recommendation-citation.js`, `canonical-renewal-advisor.js`)
// resultaron tener su único consumidor dentro de views/*.js, nunca en app.js — de ahí que este test
// compruebe ambos ficheros, nunca solo app.js.
//
// Este test convierte esa verificación manual en un invariante: falla solo si aparece un motor
// NUEVO sin consumidor (sin excepción documentada) o si una excepción ya documentada deja de
// aplicar (su motor ya tiene consumidor real y la lista debería reducirse). No borra nada — la
// auditoría de las 10 pantallas del grupo "legacy" del menú avanzado (la otra mitad de ARQ-3) no
// necesitó test nuevo: `LABORATORIO_CATALOG`/`laboratorioWriteGuard()` (`app.js`, regla `L-5`) ya es
// exactamente ese mecanismo, pantalla por pantalla, con veredicto y evidencia de escritura — ya
// "sistemático", no algo que ARQ-3 tuviera que construir de cero.

const canonicalFiles = fs
  .readdirSync(root)
  .filter((file) => /^canonical-.*\.js$/.test(file))
  .sort();

// canonical-scenario-invariants.js no lleva <script> en index.html — es una herramienta de test
// (catálogo de las 15 invariantes de E19 para property-based testing, `E19_INVARIANTES.md`), nunca
// pensada para el navegador. No es "código muerto de UI": no es código de UI en absoluto.
const TEST_ONLY_ENGINES = new Set(["canonical-scenario-invariants.js"]);

// Huérfanos confirmados de la épica E9 (bancarización/IA), bloqueados por la condición externa A5-1
// (IA en producción real) ya documentada en BACKLOG_INDICE.md — construidos por adelantado, no
// abandonados por descuido. Si A5-1 se activa y alguno se conecta a UI, este test empezará a fallar
// en sentido contrario (ver segunda prueba de abajo), avisando de que toca sacarlo de esta lista.
const KNOWN_A5_1_ORPHANS = new Set([
  "canonical-e9-actions.js",
  "canonical-e9-bank-import.js",
  "canonical-e9-banking.js",
  "canonical-e9-foundation.js",
  "canonical-e9-notifications.js",
]);

function globalExportName(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const match = /root\.(Finance\w+)\s*=\s*api/.exec(source);
  assert.ok(match, `${file} no sigue el patrón UMD "root.FinanceXxx = api" — revisa el export a mano`);
  return match[1];
}

test("ARQ-3 · todos los canonical-*.js tienen consumidor real en app.js o views/*.js, salvo las excepciones documentadas", () => {
  const unexpectedOrphans = [];
  const staleExceptions = [];
  canonicalFiles.forEach((file) => {
    if (TEST_ONLY_ENGINES.has(file)) return;
    const name = globalExportName(file);
    const hasConsumer = app.includes(name) || viewsSource.includes(name);
    const isKnownException = KNOWN_A5_1_ORPHANS.has(file);
    if (!hasConsumer && !isKnownException) unexpectedOrphans.push(`${file} (${name})`);
    if (hasConsumer && isKnownException) staleExceptions.push(`${file} (${name})`);
  });
  assert.deepEqual(
    unexpectedOrphans,
    [],
    `Motor(es) sin consumidor de UI y sin excepción documentada — o se conectan a app.js/views, o se añaden a KNOWN_A5_1_ORPHANS con motivo: ${unexpectedOrphans.join(", ")}`,
  );
  assert.deepEqual(
    staleExceptions,
    [],
    `Excepción(es) ya con consumidor real — sácalas de KNOWN_A5_1_ORPHANS, ya no son huérfanas: ${staleExceptions.join(", ")}`,
  );
});

test("ARQ-3 · los 5 huérfanos conocidos de la épica E9 siguen cargados en index.html (construidos por adelantado para A5-1, no basura a medio borrar)", () => {
  KNOWN_A5_1_ORPHANS.forEach((file) => {
    assert.match(html, new RegExp(`<script defer src="${file.replace(/[.]/g, "\\.")}\\?v=`), `${file} debería seguir cargado en index.html`);
  });
});

test("ARQ-3 · canonical-scenario-invariants.js sigue siendo solo una herramienta de test, sin <script> en index.html", () => {
  assert.doesNotMatch(html, /canonical-scenario-invariants\.js/, "si ahora se carga en el navegador, sácalo de TEST_ONLY_ENGINES y trátalo como un motor más");
});

// 65 → 66 en la sesión 237 (ARQ-4): canonical-savings-agent.js, con consumidor real desde el primer
// día (buildSavingsAgentPlan en app.js) — no entra en ninguna lista de excepciones.
// 66 → 67 (R-13): canonical-registrar-actuals-confirm.js, también con consumidor real desde el
// primer día (RegistrarActualsConfirm en app.js, techo de líneas de ARQ-4 sin margen).
// 67 → 68 (S1, Ola 2): canonical-daily-input.js, también con consumidor real desde el primer día
// 68 → 69 (S4, Ola 2): canonical-data-age.js, con consumidor real (homeDataAge) desde el primer día
// 69 → 70 (S3′, Ola 2): canonical-home-margin.js, con consumidor real (homeMarginTile) desde el primer día
// 70 → 71 (WP-02, Ola 1 del plan definitivo): canonical-finding-test.js, con consumidor real (homeMarginTile calcula el texto B con él)
// 71 → 72 (WP-04): canonical-charge-day-viability.js, con consumidor real (renderAjustesChargeDayViability)
// 72 → 73 (WP-07): canonical-timing.js, con consumidor real (timingEngine() en app.js: previsión de ingresos y gastos)
// 73 → 74 (WP-09): canonical-month-close-balances.js, con consumidor real (closeTargetInfo() y el cierre en app.js)
// 74 → 75 (WP-10): canonical-forecast-quality.js, con consumidor real (renderPrevisionQuality en app.js)
// 75 → 76 (WP-08): canonical-charge-days.js, con consumidor real (loadChargeDays en app.js; su tarjeta, en partidas-ui.js desde WP-24)
// 76 → 77 (WP-25): canonical-capture-link.js, con consumidor real (openCaptureLinkFromHash en app.js)
// 77 → 78 (WP-24): canonical-personal-allowance.js, con consumidor real (loadPersonalAllowances y la fórmula del gasto variable en app.js)
// 78 → 79 (WP-26): canonical-balance-pulse.js, con consumidor real (balancePulseAccounts en app.js; su pantalla, en registrar-ui.js)
// 79 → 80 (WP-12): canonical-liquidity-backtest.js, con consumidor real (renderPrevisionQuality en app.js llama a evaluate; la foto y la pantalla, en liquidity-backtest-ui.js)
// 80 → 81 (WP-30 · PR-1): canonical-card-cycles.js, con consumidor real (loadCardCycles y cardAccruedForRow en app.js; su ficha, en partidas-ui.js)
// 81 → 82 (WP-30 · PR-2): canonical-card-purchases.js, con consumidor real (cardAccruedForRow en app.js lee sus compras; la hoja y el informe, en captura-ui.js)
// 82 → 83 (WP-15): canonical-portfolio-valuation.js, con consumidor real (renderIv1PositionList en app.js pinta la frescura con él; renderCierre, el aviso; la hoja, en valoracion-ui.js)
// 83 → 84 (WP-23): canonical-year-end-tax.js, con consumidor real (renderActiveSection en app.js se lo pasa a la tarjeta de fiscal-campana-ui.js)
// 94 → 95 (WP-40): canonical-cirbe.js, con consumidor real (el case «deuda-contratos» de renderActiveSection en app.js se lo pasa a la tarjeta de cirbe-ui.js)
// 93 → 94 (WP-39): canonical-investment-policy.js, con consumidor real (renderInversionRebalanceo en views/inversion.js se lo pasa a la tarjeta de politica-ui.js)
// 92 → 93 (WP-38): canonical-contingency-plan.js, con consumidor real (renderPlanPrevision en app.js se lo pasa a la tarjeta de contingencia-ui.js)
// 91 → 92 (WP-36): canonical-statement-anomalies.js, con consumidor real (el case «movements» de renderActiveSection en app.js se lo pasa a la tarjeta de anomalias-ui.js)
// 90 → 91 (WP-31 · PR-1): canonical-payroll.js, con consumidor real (renderActiveSection en app.js se lo pasa a la tarjeta de nominas-ui.js)
// 89 → 90 (WP-19): canonical-debt-payoff-path.js, con consumidor real (renderDeudaRuta en views/deuda.js se lo pasa a la tarjeta de camino-deuda-ui.js)
// 88 → 89 (WP-20): canonical-rate-review.js, con consumidor real (renderActiveSection y decisionInboxItems en app.js se lo pasan a la tarjeta y al aviso de revision-tipo-ui.js)
// 87 → 88 (WP-13 · PR-1): canonical-rate-indices.js, con consumidor real (renderActiveSection en app.js se lo pasa a la tarjeta de indices-ui.js)
// 86 → 87 (WP-14 + WP-27): canonical-expected-movements.js, con consumidor real (decisionInboxItems en app.js se lo pasa a esperados-ui.js)
// 85 → 86 (WP-32): canonical-reminders.js, con consumidor real (renderAjustes en app.js se lo pasa a la tarjeta de recordatorios-ui.js)
// 84 → 85 (WP-16): canonical-cash-band.js, con consumidor real (renderPrevisionQuality en app.js se lo pasa a la tarjeta de cash-band-ui.js)
// (FinanceCanonicalDailyInput en refreshCanonicalDailyAudit, app.js).
test("ARQ-3 · el recuento de canonical-*.js sigue siendo 95 (si cambia, revisa si el nuevo/borrado fichero necesita entrar en las listas de arriba)", () => {
  assert.equal(canonicalFiles.length, 95);
});
