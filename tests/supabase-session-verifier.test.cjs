const assert = require("node:assert/strict");
const test = require("node:test");
const { verifySupabaseSession } = require("../supabase-session-verifier.js");

const base = { supabaseUrl: "https://proyecto.supabase.co", supabaseAnonKey: "anon-key" };

test("sin configurar Supabase, se rechaza sin llamar a fetch", async () => {
  let called = false;
  const result = await verifySupabaseSession({ fetch: async () => { called = true; }, authorization: "Bearer x" });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "supabase-verifier-not-configured");
  assert.equal(called, false);
});

test("sin cabecera Bearer, se rechaza sin llamar a fetch", async () => {
  let called = false;
  const result = await verifySupabaseSession({ ...base, fetch: async () => { called = true; }, authorization: "" });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "bearer-required");
  assert.equal(called, false);
});

test("una sesión válida de Supabase Auth se acepta con el userId real", async () => {
  let request;
  const result = await verifySupabaseSession({
    ...base,
    authorization: "Bearer token-valido",
    fetch: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ id: "user-1", email: "javi@example.test" }) }; },
  });
  assert.equal(result.allowed, true);
  assert.equal(result.userId, "user-1");
  assert.equal(request.url, "https://proyecto.supabase.co/auth/v1/user");
  assert.equal(request.options.headers.authorization, "Bearer token-valido");
  assert.equal(request.options.headers.apikey, "anon-key");
});

test("un token caducado o inválido se rechaza", async () => {
  const result = await verifySupabaseSession({ ...base, authorization: "Bearer expirado", fetch: async () => ({ ok: false }) });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "session-invalid-or-expired");
});

test("una respuesta sin id de usuario se rechaza igual que una sesión inválida", async () => {
  const result = await verifySupabaseSession({ ...base, authorization: "Bearer token", fetch: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "session-invalid-or-expired");
});

test("un timeout se distingue de una caída genérica del verificador", async () => {
  const result = await verifySupabaseSession({
    ...base,
    authorization: "Bearer token",
    timeoutMs: 5,
    fetch: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); });
    }),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "auth-verifier-timeout");
});

test("un fallo de red se reporta como verificador no disponible", async () => {
  const result = await verifySupabaseSession({ ...base, authorization: "Bearer token", fetch: async () => { throw new Error("network down"); } });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "auth-verifier-unavailable");
});
