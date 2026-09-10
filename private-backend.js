"use strict";

const crypto = require("node:crypto");
const assistant = require("./canonical-e9-assistant.js");
const foundation = require("./canonical-e9-foundation.js");

const SCHEMA_ID = "finance-a5-private-backend/v1";
// A5-1 (sesión 164): Anthropic en vez de OpenAI — el hogar ya tiene cuenta y facturación con
// Anthropic (esta misma conversación), evitando abrir un proveedor nuevo solo para el asistente.
// La salida estructurada se fuerza con una herramienta única `strict:true` + `tool_choice` fijo en
// vez del `text.format.json_schema` de la Responses API de OpenAI — mismo contrato de "solo puede
// devolver este JSON exacto", documentado en la API de Mensajes de Anthropic.
const RESPONSE_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const RESPONSE_TOOL_NAME = "finance_read_only_answer";
const DEFAULT_REMOTE_TIMEOUT_MS = 10000;
const SERVICE_NAMES = ["household", "assistant", "actions", "notifications", "banking"];
const text = (value) => String(value ?? "").trim();
const object = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

function serviceSwitches(value, enabled) {
  const input = object(value);
  return Object.fromEntries(SERVICE_NAMES.map((service) => [service, input[service] === undefined ? enabled : input[service] === true]));
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || DEFAULT_REMOTE_TIMEOUT_MS));
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
    asOf: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["answer", "citations", "asOf", "confidence"],
};

function requestId(input = "") {
  return crypto.createHash("sha256").update(text(input)).digest("hex").slice(0, 24);
}

function createPrivateBackend(options = {}) {
  const config = {
    enabled: options.enabled === true,
    serviceEnabled: serviceSwitches(options.serviceEnabled, options.enabled === true),
    remoteTimeoutMs: Math.max(1, Number(options.remoteTimeoutMs) || DEFAULT_REMOTE_TIMEOUT_MS),
    model: text(options.model),
    apiKey: text(options.apiKey),
    fetch: options.fetch || globalThis.fetch,
    authorize: options.authorize || (async () => ({ allowed: false, reason: "authorization-not-configured" })),
    audit: options.audit || (() => {}),
    householdCommand: options.householdCommand,
    pushCommand: options.pushCommand,
    now: options.now || (() => new Date().toISOString()),
  };

  async function assistantQuery(body = {}, request = {}) {
    const auth = await config.authorize(request, "assistant", ["finance:read", "assistant:query"]);
    if (!auth?.allowed) return { status: 403, body: { error: "consent-required", fallback: "local" } };
    if (!config.enabled || !config.serviceEnabled.assistant || !config.apiKey || !config.model || typeof config.fetch !== "function") return { status: 503, body: { error: "service-disabled", fallback: "local" } };
    const readModel = object(body.readModel);
    const query = assistant.prepareQuery({ question: body.question, readModel, foundation: foundation.grantConsent(foundation.createFoundation(), { service: "assistant", purpose: "backend-authorized-query", scopes: ["finance:read", "assistant:query"], at: config.now() }), remoteAvailable: true, at: config.now() });
    const id = requestId(`${auth.userId || "anonymous"}:${query.payload.question}:${query.payload.provenance.generatedAt}`);
    const payload = {
      model: config.model,
      max_tokens: 1024,
      system: "Responde solo con el modelo ejecutivo recibido. No propongas acciones de escritura. Cita únicamente las fuentes recibidas. Llama siempre a la herramienta finance_read_only_answer con tu respuesta.",
      messages: [{ role: "user", content: JSON.stringify(query.payload) }],
      tool_choice: { type: "tool", name: RESPONSE_TOOL_NAME },
      tools: [{
        name: RESPONSE_TOOL_NAME,
        description: "Devuelve la respuesta de solo lectura al ejecutivo financiero, citando únicamente las fuentes recibidas.",
        strict: true,
        input_schema: RESPONSE_SCHEMA,
      }],
    };
    let response;
    let raw;
    try {
      response = await fetchWithTimeout(config.fetch, RESPONSE_URL, { method: "POST", headers: { "content-type": "application/json", "x-api-key": config.apiKey, "anthropic-version": ANTHROPIC_VERSION }, body: JSON.stringify(payload) }, config.remoteTimeoutMs);
      raw = await response.json();
    } catch (error) {
      config.audit({ type: "assistant-failed", requestId: id, reason: error.name === "AbortError" ? "timeout" : "provider-unavailable", at: config.now() });
      return { status: 502, body: { error: "provider-unavailable", fallback: "local", requestId: id } };
    }
    if (!response.ok) {
      config.audit({ type: "assistant-failed", requestId: id, status: response.status, at: config.now() });
      return { status: 502, body: { error: "provider-failed", fallback: "local", requestId: id } };
    }
    const parsed = parseStructuredOutput(raw);
    const checked = assistant.validateResponse(parsed, query);
    config.audit({ type: checked.valid ? "assistant-completed" : "assistant-rejected", requestId: id, userId: auth.userId, at: config.now(), model: config.model });
    if (!checked.valid) return { status: 502, body: { error: "response-contract-failed", reason: checked.reason, fallback: "local", requestId: id } };
    return { status: 200, body: { ...checked.result, requestId: id, model: config.model } };
  }

  async function command(path, body, request) {
    const service = path.startsWith("/v1/household") ? "household" : "notifications";
    const handler = service === "household" ? config.householdCommand : config.pushCommand;
    const auth = await config.authorize(request, service, service === "household" ? ["household:read", "household:share"] : ["alerts:read", "notifications:send"]);
    if (!auth?.allowed) return { status: 403, body: { error: "consent-required", fallback: "local" } };
    if (!config.enabled || !config.serviceEnabled[service] || typeof handler !== "function") return { status: 503, body: { error: "service-disabled", fallback: "local" } };
    const result = await handler({ ...body, userId: auth.userId, request, service });
    config.audit({ type: "external-command-completed", service, userId: auth.userId, at: config.now() });
    return { status: 200, body: { schemaId: SCHEMA_ID, service, result } };
  }

  async function handle(request = {}) {
    const path = text(request.path);
    const body = object(request.body);
    if (request.method !== "POST") return { status: 405, body: { error: "method-not-allowed" } };
    if (path === "/v1/assistant/query") return assistantQuery(body, request);
    if (path === "/v1/household/command" || path === "/v1/notifications/command") return command(path, body, request);
    return { status: 404, body: { error: "not-found" } };
  }

  return { SCHEMA_ID, handle, config: { enabled: config.enabled, serviceEnabled: { ...config.serviceEnabled }, model: config.model, hasApiKey: Boolean(config.apiKey), remoteTimeoutMs: config.remoteTimeoutMs } };
}

function parseStructuredOutput(response = {}) {
  // Un rechazo de los clasificadores de seguridad de Anthropic (stop_reason "refusal") o cualquier
  // turno sin la llamada forzada a la herramienta se trata igual que una respuesta vacía: cae en
  // validateResponse (falta "answer") y de ahí al fallback local — nunca se inventa una respuesta.
  if (response.stop_reason === "refusal") return {};
  const block = (Array.isArray(response.content) ? response.content : []).find((item) => item && item.type === "tool_use" && item.name === RESPONSE_TOOL_NAME);
  return block && typeof block.input === "object" && block.input ? block.input : {};
}

module.exports = { DEFAULT_REMOTE_TIMEOUT_MS, RESPONSE_SCHEMA, RESPONSE_URL, SCHEMA_ID, createPrivateBackend, parseStructuredOutput };
