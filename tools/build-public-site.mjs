import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "p2.css",
  "design-tokens.css",
  "data.js",
  "app.js",
  "state-contract.js",
  "recovery-guide.js",
  "service-worker.js",
  "manifest.webmanifest",
  "canonical-state.js",
  "canonical-ledger.js",
  "canonical-engine.js",
  "canonical-forecast.js",
  "canonical-cushion.js",
  "canonical-e13-scenarios.js",
  "canonical-scenario-schema.js",
  "canonical-scenario-engine.js",
  "canonical-daily-engine.js",
  "canonical-debt-contracts.js",
  "canonical-e14-debt-adapter.js",
  "legacy-debt-roadmap-engine.js",
  "canonical-e14-operations.js",
  "canonical-e14-parity.js",
  "canonical-e15-goals.js",
  "canonical-e16-monitoring.js",
  "canonical-budget-schema.js",
  "canonical-budget-analyzer.js",
  "canonical-budget-alerts.js",
  "canonical-budget-forecast-category.js",
  "executive-read-model.js",
  "canonical-debt-comparator.js",
  "canonical-e7-analysis.js",
  "canonical-e8-operations.js",
  "canonical-e9-foundation.js",
  "canonical-e9-household.js",
  "canonical-e9-assistant.js",
  "canonical-e9-actions.js",
  "canonical-e9-notifications.js",
  "canonical-e9-banking.js",
  "canonical-e9-bank-import.js",
  "canonical-e11b-inbox.js",
  "e17-experience.js",
  "e18-health.js",
  "canonical-decisions.js",
  "canonical-commit-barrier.js",
  "canonical-workflow.js",
  "canonical-supabase-store.js",
  "canonical-month-close.js",
  "canonical-e5-operations.js",
  "snapshot-restore.js",
  "durable-outbox.js",
  "remote-save-queue.js",
  "ux-settings.js",
  "ux-shell.js",
  "p2-domain.js",
  "p2-private-store.js",
  "p2-export.js",
  "p2-ui.js",
  "supabase-config.js",
  "debt-roadmap.html",
  "vendor/xlsx.full.min.js",
  // PERF-1: fragmentos de vista con carga diferida (views/*.js). index.html nunca los referencia
  // con src="" —los inyecta app.js en tiempo de ejecución (ver VIEW_CHUNKS/loadViewChunk)—, así
  // que la comprobación automática de más abajo (recursos referenciados por index.html) no puede
  // detectar que faltan en esta lista. Cada view añadida a VIEW_CHUNKS necesita su entrada aquí a
  // mano, o el sitio publicado la serviría con 404 la primera vez que alguien visite esa pantalla.
  "views/presupuesto-mes.js",
  "views/deuda.js",
];

// Esta lista se mantiene a mano, y por eso puede quedarse corta sin que nadie se entere: hasta el
// 10 de agosto de 2026 le faltaban `canonical-scenario-schema.js` y `canonical-scenario-engine.js`,
// añadidos al `index.html` en E20 y nunca copiados a `dist`. Como Pages publica `dist`, el sitio
// llevaba semanas sin el motor de escenarios: `window.FinanceCanonicalScenarioEngine` no existía y
// todo lo que depende de él —comparador de estrategias, ruta de deuda, simulador de escenarios—
// se quedaba sin cifras, en silencio y solo en producción.
//
// La comprobación va antes de copiar nada: cualquier recurso local que el `index.html` cargue tiene
// que estar en la lista. Añadir un script y olvidarse de la lista ahora rompe la construcción en vez
// de romper el sitio publicado.
const referenced = [...fs.readFileSync(path.join(root, "index.html"), "utf8").matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((url) => !/^(?:https?:|#|mailto:|data:)/.test(url))
  .map((url) => url.split("?")[0]);
const listed = new Set(files);
const uncopied = [...new Set(referenced)].filter((relative) => !listed.has(relative) && fs.existsSync(path.join(root, relative)));
if (uncopied.length) {
  throw new Error(
    `index.html carga recursos que no se copian a dist: ${uncopied.join(", ")}. ` +
      "Añádelos a la lista de este archivo o el sitio publicado se quedará sin ellos.",
  );
}

fs.rmSync(destination, { recursive: true, force: true });
for (const relative of files) {
  const source = path.join(root, relative);
  const target = path.join(destination, relative);
  if (!fs.existsSync(source)) throw new Error(`Falta recurso público: ${relative}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

// El nombre de la caché del Service Worker (`service-worker.js`) solo se invalida cuando el propio
// fichero cambia byte a byte — así detecta el navegador que hay una versión nueva que instalar. Del
// 14 al 19 de agosto se desplegaron Registrar, Escenarios, Cierre, Análisis y Sobres sin que nadie
// tocara `CACHE_NAME` a mano, así que los navegadores que ya tenían el Service Worker instalado
// siguieron sirviendo el shell del 14 de agosto en silencio, sin ningún error visible. Se corrige
// aquí, no confiando en que alguien se acuerde de bump-earlo cada vez: cada build de `dist` reescribe
// `CACHE_NAME` con la misma referencia de versión que ya usa `version.json`, así que el propio
// contenido del fichero cambia en cada despliegue y el navegador siempre detecta la actualización.
// Nota: `index.html` tiene su propio `?v=...` por cada `<script>`/`<link>` (caché HTTP normal, uno
// por fichero, bump-eado a mano por quien toca ese fichero) — deliberadamente fuera de esta reescritura.
// El Service Worker interpreta cada petición con `ignoreSearch: true` (ver `service-worker.js`), así
// que en cuanto está instalado ignora esos `?v=` por completo y sirve por ruta desde Cache Storage:
// el único interruptor real es `CACHE_NAME`. Reescribir aquí los 55 `?v=` de golpe destruiría el
// bump fino por fichero sin arreglar nada.
const cacheVersion = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 12) : `local${Date.now().toString(36)}`;

const workerPath = path.join(destination, "service-worker.js");
const workerSource = fs.readFileSync(workerPath, "utf8");
const versionedWorker = workerSource.replace(
  /const CACHE_NAME = "[^"]*";/,
  `const CACHE_NAME = "finanzas-casa-shell-${cacheVersion}";`,
);
if (versionedWorker === workerSource) throw new Error("No se encontró CACHE_NAME en service-worker.js para versionarlo.");
fs.writeFileSync(workerPath, versionedWorker);

fs.writeFileSync(path.join(destination, ".nojekyll"), "");
fs.writeFileSync(
  path.join(destination, "version.json"),
  `${JSON.stringify({ version: process.env.GITHUB_SHA || "local", builtAt: new Date().toISOString() }, null, 2)}\n`,
);
