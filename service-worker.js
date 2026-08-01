const CACHE_NAME = "finanzas-casa-shell-20260801-e5";
const SHELL_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./p2.css",
  "./data.js",
  "./app.js",
  "./state-contract.js",
  "./recovery-guide.js",
  "./canonical-state.js",
  "./canonical-ledger.js",
  "./canonical-engine.js",
  "./canonical-daily-engine.js",
  "./canonical-debt-contracts.js",
  "./canonical-debt-comparator.js",
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

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
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
