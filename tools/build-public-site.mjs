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
  "canonical-e13-scenarios.js",
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
