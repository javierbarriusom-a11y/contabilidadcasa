const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const guide = require("../recovery-guide.js");

test("una cola compatible ofrece reanudar sin ocultar las alternativas", () => {
  const result = guide.assessRecovery({
    pendingRecord: { savedAt: "2026-07-31T10:00:00Z", baseHeadSnapshotId: "head-1" },
    remoteHeadKnown: true,
    remoteHeadSnapshotId: "head-1",
    remoteUpdatedAt: "2026-07-31T09:00:00Z",
    localFingerprint: "1234567890abcdef",
    remoteFingerprint: "fedcba0987654321",
  });
  assert.equal(result.kind, "pending");
  assert.equal(result.localIsNewer, true);
  assert.ok(result.options.includes("resume-sync"));
  assert.ok(result.options.includes("use-remote"));
});

test("un puntero distinto exige recuperación guiada y no ofrece sincronización automática", () => {
  const result = guide.assessRecovery({
    pendingRecord: { baseHeadSnapshotId: "head-old" },
    remoteHeadKnown: true,
    remoteHeadSnapshotId: "head-new",
  });
  assert.equal(result.kind, "conflict");
  assert.equal(result.options.includes("resume-sync"), false);
  assert.ok(result.options.includes("download-local"));
});

test("el service worker solo precachea shell local y excluye Supabase", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");
  assert.doesNotMatch(source, /supabase-config\.js/);
  assert.doesNotMatch(source, /cdn\.jsdelivr\.net/);
  assert.match(source, /url\.origin !== self\.location\.origin/);
  assert.match(source, /event\.request\.method !== "GET"/);
  assert.match(source, /cache:\s*"reload"/);
  assert.match(source, /precacheFreshShell/);
  assert.doesNotMatch(source, /cache\.addAll/);
});

test("la interfaz registra el modo offline y ofrece las cuatro decisiones de recuperación", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /rel="manifest"/);
  assert.match(html, /navigator\.serviceWorker\.register\("\.\/service-worker\.js"\)/);
  assert.match(html, /id="recoveryResumeSync"/);
  assert.match(html, /id="recoveryContinueLocal"/);
  assert.match(html, /id="recoveryDownloadLocal"/);
  assert.match(html, /id="recoveryUseRemote"/);
});

test("la hidratación del plan de deuda no crea una escritura si el iframe devuelve el mismo estado", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(app, /function debtRoadmapStatesMatch/);
  assert.match(app, /if \(debtRoadmapStatesMatch\(debtRoadmapState, nextState\)\) return;/);
});
