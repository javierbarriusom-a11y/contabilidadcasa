// A5-1 (sesión 164): Edge Function del asistente financiero — mismo patrón ya elegido dos veces en
// este proyecto (E9-1, A19-1) para evitar desplegar backend/server.mjs en un hosting aparte. Toda
// la lógica real (llamada a Anthropic, validación del contrato de solo lectura, verificación de
// sesión) vive en los módulos CommonJS ya probados con `npm test` — este fichero es solo el cableado
// mínimo hacia el runtime de Supabase (Deno).
//
// AVISO para quien lo despliegue: este fichero no se ha podido ejecutar en un runtime Deno real
// dentro de esta sesión (no hay `deno` disponible en este entorno) — la lógica que importa sí está
// probada (`npm test`: private-backend.test.cjs, supabase-session-verifier.test.cjs), pero el
// cableado Deno de aquí abajo solo se ha revisado a mano contra la documentación de Supabase Edge
// Functions. Antes de dar esto por bueno, hazlo pasar por `supabase functions serve assistant-query`
// en local y comprueba con una consulta real (o con curl) que responde 200/403/503 como se espera.
//
// Variables de entorno esperadas (`supabase secrets set ...`):
//   FINANCE_EXTERNAL_ENABLED=true
//   FINANCE_ASSISTANT_ENABLED=true            (opcional, por defecto sigue a FINANCE_EXTERNAL_ENABLED)
//   ANTHROPIC_API_KEY=...
//   ANTHROPIC_MODEL=...                       (fijado por A5-2 tras evaluar, nunca a ciegas)
//   SUPABASE_URL / SUPABASE_ANON_KEY           (para verificar la sesión — Supabase los inyecta solo
//                                               como SUPABASE_URL; el resto, si faltan, se leen igual
//                                               de las variables ya presentes en el proyecto)
//   FINANCE_REMOTE_TIMEOUT_MS=10000            (opcional)

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createPrivateBackend } = require("../../../private-backend.js");
const { verifySupabaseSession } = require("../../../supabase-session-verifier.js");

const enabled = Deno.env.get("FINANCE_EXTERNAL_ENABLED") === "true";
const assistantEnabledRaw = Deno.env.get("FINANCE_ASSISTANT_ENABLED");
const remoteTimeoutMs = Math.max(1, Number(Deno.env.get("FINANCE_REMOTE_TIMEOUT_MS") || 10000));
const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
const supabaseAnonKey = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();

const app = createPrivateBackend({
  enabled,
  serviceEnabled: { assistant: enabled && (assistantEnabledRaw === undefined || assistantEnabledRaw === "true") },
  remoteTimeoutMs,
  apiKey: (Deno.env.get("ANTHROPIC_API_KEY") || "").trim(),
  model: Deno.env.get("ANTHROPIC_MODEL") || "",
  authorize: (request) => verifySupabaseSession({
    fetch,
    supabaseUrl,
    supabaseAnonKey,
    authorization: request.headers?.authorization || "",
    timeoutMs: remoteTimeoutMs,
  }),
  audit: (event) => console.log(JSON.stringify(event)),
});

Deno.serve(async (req: Request) => {
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
    return Response.json({ schemaId: app.SCHEMA_ID, enabled: app.config.enabled, serviceEnabled: app.config.serviceEnabled, modelConfigured: Boolean(app.config.model), authConfigured: Boolean(supabaseUrl && supabaseAnonKey) });
  }
  let body: unknown = {};
  try {
    body = req.method === "POST" ? await req.json() : {};
  } catch {
    return Response.json({ error: "invalid-json", fallback: "local" }, { status: 400 });
  }
  const result = await app.handle({
    method: req.method,
    path: "/v1/assistant/query",
    headers: { authorization: req.headers.get("authorization") || "" },
    body,
  });
  return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
});
