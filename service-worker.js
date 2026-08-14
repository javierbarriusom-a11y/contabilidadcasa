const CACHE_NAME = "finanzas-casa-shell-20260814-f1a1";
const SHELL_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./p2.css",
  "./design-tokens.css",
  "./data.js",
  "./app.js",
  "./state-contract.js",
  "./recovery-guide.js",
  "./canonical-state.js",
  "./canonical-ledger.js",
  "./canonical-engine.js",
  "./canonical-forecast.js",
  "./canonical-cushion.js",
  "./canonical-e13-scenarios.js",
  "./canonical-daily-engine.js",
  "./canonical-debt-contracts.js",
  "./canonical-e14-debt-adapter.js",
  "./legacy-debt-roadmap-engine.js",
  "./canonical-e14-operations.js",
  "./canonical-e14-parity.js",
  "./canonical-e15-goals.js",
  "./canonical-e16-monitoring.js",
  "./executive-read-model.js",
  "./canonical-debt-comparator.js",
  "./canonical-e7-analysis.js",
  "./canonical-e8-operations.js",
  "./canonical-e9-foundation.js",
  "./canonical-e9-household.js",
  "./canonical-e9-assistant.js",
  "./canonical-e9-actions.js",
  "./canonical-e9-notifications.js",
  "./canonical-e9-banking.js",
  "./canonical-e9-bank-import.js",
  "./canonical-e11b-inbox.js",
  "./e17-experience.js",
  "./e18-health.js",
  "./canonical-decisions.js",
  "./canonical-commit-barrier.js",
  "./canonical-workflow.js",
  "./canonical-supabase-store.js",
  "./canonical-month-close.js",
  "./canonical-e5-operations.js",
  "./snapshot-restore.js",
  "./durable-outbox.js",
  "./remote-save-queue.js",
  "./ux-settings.js",
  "./ux-shell.js",
  "./p2-domain.js",
  "./p2-private-store.js",
  "./p2-export.js",
  "./p2-ui.js",
  "./debt-roadmap.html",
  "./vendor/xlsx.full.min.js",
];

async function precacheFreshShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(SHELL_URLS.map(async (url) => {
    const response = await fetch(new Request(url, { cache: "reload" }));
    if (!response.ok) throw new Error(`No se pudo actualizar el recurso ${url}.`);
    await cache.put(url, response);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheFreshShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname.replace(/index\.html$/, "");
  const allowed = SHELL_URLS.some((entry) => {
    const allowedUrl = new URL(entry, self.registration.scope);
    return allowedUrl.pathname === url.pathname || (entry === "./" && allowedUrl.pathname === path);
  });
  if (!allowed) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || fetch(event.request)),
  );
});
