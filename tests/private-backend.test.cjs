const assert = require("node:assert/strict");
const test = require("node:test");
const backend = require("../private-backend.js");

const readModel = { schema: "finance-executive-read-model/v1", generatedAt: "2026-08-08T10:00:00Z", asOf: "2026-08-08", capacity: {}, context: {}, quality: {}, metrics: { cash: { id: "cash", label: "Caja", asOf: "2026-08-08", source: "ledger", method: "balance", coverage: "complete", confidence: "high" } }, decisions: [], alerts: [] };

test("el backend permanece apagado y devuelve fallback local", async () => {
  const app = backend.createPrivateBackend({ authorize: async () => ({ allowed: true, userId: "u1" }), model: "model-test", apiKey: "secret" });
  const response = await app.handle({ method: "POST", path: "/v1/assistant/query", body: { question: "¿Cómo está la caja?", readModel } });
  assert.equal(response.status, 503);
  assert.equal(response.body.fallback, "local");
});

test("Responses API recibe store false, esquema estructurado y nunca expone la clave", async () => {
  let request;
  const app = backend.createPrivateBackend({ enabled: true, model: "model-pinned", apiKey: "secret-value", authorize: async () => ({ allowed: true, userId: "u1" }), fetch: async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify({ answer: "La caja está estable.", citations: ["metric:cash"], asOf: "2026-08-08", confidence: "high" }) }) };
  } });
  const response = await app.handle({ method: "POST", path: "/v1/assistant/query", body: { question: "¿Cómo está la caja?", readModel } });
  assert.equal(response.status, 200);
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(JSON.stringify(request).includes("secret-value"), false);
  assert.equal(response.body.mode, "remote-read-only");
});

test("hogar y notificaciones exigen autorización y permanecen en fallback si no se activan", async () => {
  const app = backend.createPrivateBackend({ authorize: async () => ({ allowed: false }) });
  const response = await app.handle({ method: "POST", path: "/v1/household/command", body: { type: "invite" } });
  assert.equal(response.status, 403);
  assert.equal(response.body.fallback, "local");
});

test("cada servicio externo puede apagarse de forma independiente", async () => {
  const app = backend.createPrivateBackend({
    enabled: true,
    serviceEnabled: { assistant: false, notifications: true },
    authorize: async () => ({ allowed: true, userId: "u1" }),
    pushCommand: async () => ({ sent: false }),
  });
  const assistantResponse = await app.handle({ method: "POST", path: "/v1/assistant/query", body: { question: "¿Cómo está la caja?", readModel } });
  const pushResponse = await app.handle({ method: "POST", path: "/v1/notifications/command", body: { type: "deliver" } });
  assert.equal(assistantResponse.status, 503);
  assert.equal(assistantResponse.body.fallback, "local");
  assert.equal(pushResponse.status, 200);
});

test("un proveedor que supera el tiempo límite vuelve al fallback local", async () => {
  const app = backend.createPrivateBackend({
    enabled: true,
    remoteTimeoutMs: 5,
    model: "model-pinned",
    apiKey: "secret-value",
    authorize: async () => ({ allowed: true, userId: "u1" }),
    fetch: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); });
    }),
  });
  const response = await app.handle({ method: "POST", path: "/v1/assistant/query", body: { question: "¿Cómo está la caja?", readModel } });
  assert.equal(response.status, 502);
  assert.equal(response.body.fallback, "local");
});
