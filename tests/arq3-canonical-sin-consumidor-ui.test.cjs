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
test("ARQ-3 · el recuento de canonical-*.js sigue siendo 66 (si cambia, revisa si el nuevo/borrado fichero necesita entrar en las listas de arriba)", () => {
  assert.equal(canonicalFiles.length, 66);
});
