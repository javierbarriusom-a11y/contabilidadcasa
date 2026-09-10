import http from "node:http";
import { createPrivateBackend } from "../private-backend.js";
import { verifySupabaseSession } from "../supabase-session-verifier.js";

const port = Number(process.env.PORT || 8787);
// A5-1 (sesión 164): el verificador externo por defecto es el propio Supabase Auth del hogar (ya en
// producción) en vez de un tercer servicio a desplegar. FINANCE_AUTH_VERIFY_URL sigue aceptándose
// como override explícito, por si algún día conviene un verificador distinto.
const authVerifyUrl = String(process.env.FINANCE_AUTH_VERIFY_URL || "").trim();
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
const enabled = process.env.FINANCE_EXTERNAL_ENABLED === "true";
const remoteTimeoutMs = Math.max(1, Number(process.env.FINANCE_REMOTE_TIMEOUT_MS || 10000));
const serviceNames = ["household", "assistant", "actions", "notifications", "banking"];
const serviceEnabled = Object.fromEntries(serviceNames.map((service) => {
  const variable = `FINANCE_${service.toUpperCase()}_ENABLED`;
  return [service, enabled && (process.env[variable] === undefined || process.env[variable] === "true")];
}));

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remoteTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function authorizeViaExternalUrl(request, service, scopes) {
  const authorization = request.headers?.authorization || "";
  if (!authorization.startsWith("Bearer ")) return { allowed: false, reason: "bearer-required" };
  try {
    const response = await fetchWithTimeout(authVerifyUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify({ service, scopes }),
    });
    if (!response.ok) return { allowed: false, reason: "auth-verifier-rejected" };
    return response.json();
  } catch {
    return { allowed: false, reason: "auth-verifier-unavailable" };
  }
}

// FINANCE_AUTH_VERIFY_URL, si está configurada, gana como override explícito; en su ausencia el
// verificador por defecto es el propio Supabase Auth del hogar (ver supabase-session-verifier.js).
// La comprobación de permiso por servicio/área no vive aquí: las funciones `security definer` de
// Supabase la aplican con el JWT propio de quien llama (RLS de por medio) cuando el comando llega
// a household/push — este verificador solo confirma que la sesión es real y de quién es.
async function authorize(request, service, scopes) {
  if (authVerifyUrl) return authorizeViaExternalUrl(request, service, scopes);
  return verifySupabaseSession({ fetch, supabaseUrl, supabaseAnonKey, authorization: request.headers?.authorization || "", timeoutMs: remoteTimeoutMs });
}

const authConfigured = Boolean(authVerifyUrl) || Boolean(supabaseUrl && supabaseAnonKey);

const app = createPrivateBackend({
  enabled,
  serviceEnabled,
  remoteTimeoutMs,
  apiKey,
  model: process.env.ANTHROPIC_MODEL,
  authorize,
  audit: (event) => { if (process.env.FINANCE_AUDIT_STDOUT === "true") process.stdout.write(`${JSON.stringify(event)}\n`); },
});

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; if (raw.length > 128 * 1024) reject(new Error("payload-too-large")); });
    request.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("invalid-json")); } });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ schemaId: app.SCHEMA_ID, enabled: app.config.enabled, serviceEnabled: app.config.serviceEnabled, modelConfigured: Boolean(app.config.model), authConfigured, remoteTimeoutMs: app.config.remoteTimeoutMs }));
    return;
  }
  try {
    const body = await readBody(request);
    const result = await app.handle({ method: request.method, path: request.url, headers: request.headers, body });
    response.writeHead(result.status, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify(result.body));
  } catch (error) {
    response.writeHead(400, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: error.message || "bad-request", fallback: "local" }));
  }
});

server.listen(port, "127.0.0.1", () => process.stdout.write(`finance-private-backend listening on 127.0.0.1:${port}\n`));
