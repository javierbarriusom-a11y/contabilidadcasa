"use strict";

// XDA-02 · PR-2 (25/10/2026): buzón de extractos. Un Atajo de iOS en la hoja Compartir de la app del banco manda el
// fichero aquí con un token personal; el fichero espera en un bucket privado hasta que la app lo importa (o 7 días).
// Diseño y requisitos de seguridad (NTC-06 RQ-01…RQ-11): docs/XDA02_DISENO.md.
//
// Toda la lógica vive aquí, en CommonJS probado con `npm test` (tests/xda02-buzon-servidor.test.cjs), y no sabe nada de
// Supabase: recibe sus dependencias (buscar el token por su hash, contar, guardar, registrar). La Edge Function
// supabase/functions/statement-inbox/index.ts solo las cablea, como assistant-query con private-backend.js.
//
// Lo que NUNCA hace: leer el contenido del extracto (solo mira los primeros bytes para saber qué tipo de fichero es),
// devolver datos del buzón (solo puede añadir), guardar el token en claro, ni escribir en el registro importes,
// conceptos, nombres de fichero o el token.

const crypto = require("node:crypto");

const SCHEMA_ID = "finance-xda02-statement-inbox/v1";
const MAX_BYTES = 2 * 1024 * 1024; // un extracto de un mes ocupa decenas de KB; 2 MB deja margen para un PDF
const MAX_UPLOADS_PER_TOKEN_PER_DAY = 20;
const MAX_PENDING_PER_USER = 20;
const RETENTION_DAYS = 7;
const TOKEN_MAX_DAYS = 90;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes aleatorios en base64url, sin relleno

// Tipos admitidos, decididos por los primeros bytes y no por lo que diga el Atajo.
const KINDS = {
  pdf: { ext: "pdf", mime: "application/pdf" },
  xlsx: { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  xls: { ext: "xls", mime: "application/vnd.ms-excel" },
  csv: { ext: "csv", mime: "text/csv" },
};

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token), "utf8").digest("hex");
}

// Qué es el fichero, por su firma. Texto: sin bytes nulos en el primer KB (CSV o TXT del banco, en cualquier codificación
// de un byte o UTF-8; el UTF-16 lleva BOM y también se admite).
function sniffKind(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf"; // %PDF
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "xlsx"; // PK.. (zip)
  if (b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "xls"; // OLE2
  if (b.length >= 2 && ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff))) return "csv"; // UTF-16 con BOM
  const head = b.subarray(0, 1024);
  if (head.length && !head.includes(0)) return "csv";
  return null;
}

// Nombre para enseñar en la app: sin rutas, sin caracteres de control y corto. No se registra en ningún log.
function cleanFileName(raw, kind) {
  let name = "";
  try {
    name = decodeURIComponent(String(raw || ""));
  } catch {
    name = String(raw || "");
  }
  name = name.split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f<>"]/g, "").trim().slice(0, 80);
  return name || `extracto.${KINDS[kind].ext}`;
}

function plusDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

// deps: { enabled, now(), findTokenByHash(hash), countUploadsSince(tokenId, isoDate), countPending(userId),
//         storeObject(path, bytes, mime), insertItem(row), touchToken(tokenId, isoDate), purgeExpired(userId, isoDate),
//         newId(), audit(event) }
function createStatementInbox(deps = {}) {
  const now = deps.now || (() => new Date());
  const newId = deps.newId || (() => crypto.randomUUID());
  const audit = deps.audit || (() => {});

  async function handle({ method = "", headers = {}, body } = {}) {
    const started = Date.now();
    const requestId = newId();
    const done = (status, result, extra = {}) => {
      // RQ-04: sin importes, conceptos, nombre del fichero ni token; solo petición, usuario, resultado y duración.
      audit({ schema: SCHEMA_ID, requestId, userId: extra.userId || null, result, status, ms: Date.now() - started });
      const bodyOut = status === 201 ? { ok: true, mensaje: "Extracto en el buzón. Ábrelo en Finanzas Casa para importarlo." } : { ok: false, error: result };
      return { status, body: bodyOut };
    };

    if (!deps.enabled) return done(503, "apagado"); // RQ-08
    if (String(method).toUpperCase() !== "POST") return done(405, "metodo");
    const token = String(headers["x-inbox-token"] || "").trim();
    if (!TOKEN_PATTERN.test(token)) return done(401, "token");
    const bytes = body instanceof Uint8Array ? body : body ? new Uint8Array(body) : new Uint8Array();
    if (!bytes.length) return done(400, "vacio");
    if (bytes.length > MAX_BYTES) return done(413, "grande");
    const kind = sniffKind(bytes);
    if (!kind) return done(415, "tipo");

    const at = now();
    const record = await deps.findTokenByHash(hashToken(token));
    // Mismo error para «no existe», «revocado» y «caducado»: no se da pista de cuál.
    if (!record || record.revoked_at || !record.expires_at || new Date(record.expires_at) <= at) return done(401, "token");
    const userId = record.user_id;

    const desde = plusDays(at, -1).toISOString();
    if ((await deps.countUploadsSince(record.id, desde)) >= MAX_UPLOADS_PER_TOKEN_PER_DAY) return done(429, "limite", { userId });
    await deps.purgeExpired(userId, at.toISOString());
    if ((await deps.countPending(userId)) >= MAX_PENDING_PER_USER) return done(429, "lleno", { userId });

    const id = newId();
    const path = `${userId}/${id}.${KINDS[kind].ext}`; // RLS: el primer segmento de la ruta es el dueño
    await deps.storeObject(path, bytes, KINDS[kind].mime);
    await deps.insertItem({
      id,
      user_id: userId,
      token_id: record.id,
      object_path: path,
      file_name: cleanFileName(headers["x-file-name"], kind),
      kind,
      size_bytes: bytes.length,
      received_at: at.toISOString(),
      expires_at: plusDays(at, RETENTION_DAYS).toISOString(),
    });
    await deps.touchToken(record.id, at.toISOString());
    return done(201, "recibido", { userId });
  }

  return { SCHEMA_ID, handle };
}

module.exports = { SCHEMA_ID, MAX_BYTES, MAX_UPLOADS_PER_TOKEN_PER_DAY, MAX_PENDING_PER_USER, RETENTION_DAYS, TOKEN_MAX_DAYS, TOKEN_PATTERN, KINDS, hashToken, sniffKind, cleanFileName, createStatementInbox };
