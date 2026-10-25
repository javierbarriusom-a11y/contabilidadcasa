// XDA-02 · PR-2 (25/10/2026): Edge Function del buzón de extractos. Solo cablea statement-inbox.js (CommonJS, probado con
// `npm test` en tests/xda02-buzon-servidor.test.cjs) con Supabase: buscar el token por su hash, contar, guardar el fichero
// en el bucket privado y apuntarlo en la tabla. Diseño, requisitos NTC-06 y pasos de despliegue: docs/XDA02_DISENO.md.
//
// AVISO para quien lo despliegue: igual que assistant-query, este fichero no se ha podido ejecutar en un runtime Deno real
// dentro de la sesión en que se escribió (no hay `deno` en ese entorno). La lógica sí está probada; el cableado de aquí
// abajo se ha revisado a mano contra la documentación de Supabase. Antes de darlo por bueno: `supabase functions serve
// statement-inbox --no-verify-jwt` y las pruebas con curl de docs/XDA02_DISENO.md §6 (201, 401, 413, 415).
//
// Se despliega con `--no-verify-jwt`: quien llama es un Atajo, sin sesión; la autorización es el token del buzón, que va
// en la cabecera `x-inbox-token` (no en Authorization, que Supabase reserva para su JWT).
//
// Variables de entorno:
//   FINANCE_STATEMENT_INBOX_ENABLED=true   (RQ-08: sin ella, responde 503 y no guarda nada)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (las inyecta Supabase; RQ-01: la clave de servicio solo vive aquí)

import { createRequire } from "node:module";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const require = createRequire(import.meta.url);
const { createStatementInbox, MAX_BYTES } = require("../../../statement-inbox.js");

const BUCKET = "finance-statement-inbox";
const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const must = <T>(result: { data: T; error: unknown }): T => {
  if (result.error) throw result.error;
  return result.data;
};

const app = createStatementInbox({
  enabled: Deno.env.get("FINANCE_STATEMENT_INBOX_ENABLED") === "true",
  findTokenByHash: async (hash: string) =>
    must(await admin.from("finance_statement_inbox_tokens").select("id, user_id, expires_at, revoked_at").eq("token_hash", hash).maybeSingle()),
  countUploadsSince: async (tokenId: string, since: string) => {
    const { count, error } = await admin.from("finance_statement_inbox").select("id", { count: "exact", head: true }).eq("token_id", tokenId).gte("received_at", since);
    if (error) throw error;
    return count || 0;
  },
  countPending: async (userId: string) => {
    const { count, error } = await admin.from("finance_statement_inbox").select("id", { count: "exact", head: true }).eq("user_id", userId).is("imported_at", null);
    if (error) throw error;
    return count || 0;
  },
  purgeExpired: async (userId: string, now: string) => {
    const expired = must(await admin.from("finance_statement_inbox").select("id, object_path").eq("user_id", userId).lte("expires_at", now)) || [];
    if (!expired.length) return;
    must(await admin.storage.from(BUCKET).remove(expired.map((row: { object_path: string }) => row.object_path)));
    must(await admin.from("finance_statement_inbox").delete().in("id", expired.map((row: { id: string }) => row.id)));
  },
  storeObject: async (path: string, bytes: Uint8Array, mime: string) => {
    must(await admin.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false }));
  },
  insertItem: async (row: Record<string, unknown>) => {
    must(await admin.from("finance_statement_inbox").insert(row));
  },
  touchToken: async (tokenId: string, at: string) => {
    must(await admin.from("finance_statement_inbox_tokens").update({ last_used_at: at }).eq("id", tokenId));
  },
  audit: (event: unknown) => console.log(JSON.stringify(event)), // RQ-04: el evento no lleva datos personales
});

Deno.serve(async (req: Request) => {
  try {
    // No leer en memoria un cuerpo que ya se anuncia demasiado grande.
    if (Number(req.headers.get("content-length") || 0) > MAX_BYTES) return Response.json({ ok: false, error: "grande" }, { status: 413, headers: { "cache-control": "no-store" } });
    const result = await app.handle({
      method: req.method,
      headers: { "x-inbox-token": req.headers.get("x-inbox-token") || "", "x-file-name": req.headers.get("x-file-name") || "" },
      body: req.method === "POST" ? new Uint8Array(await req.arrayBuffer()) : undefined,
    });
    return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
  } catch {
    // RQ-02: errores sin detalles internos.
    return Response.json({ ok: false, error: "interno" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
});
