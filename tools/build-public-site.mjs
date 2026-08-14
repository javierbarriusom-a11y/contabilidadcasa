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
fs.writeFileSync(path.join(destination, ".nojekyll"), "");
fs.writeFileSync(
  path.join(destination, "version.json"),
  `${JSON.stringify({ version: process.env.GITHUB_SHA || "local", builtAt: new Date().toISOString() }, null, 2)}\n`,
);
