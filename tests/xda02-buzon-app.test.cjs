const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

// XDA-02 · PR-2: el buzón de extractos en la app (buzon-extractos.js) y su sitio en el esquema, la publicación y las
// pantallas. La lógica del servidor se prueba en xda02-buzon-servidor.test.cjs.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const source = read("buzon-extractos.js");

function load({ session = null } = {}) {
  const context = {
    console,
    crypto: crypto.webcrypto,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    TextEncoder,
    SUPABASE_CONFIG: { url: "https://ejemplo.supabase.co/" },
    supabaseClient: session ? session.client : null,
    remoteUser: session ? session.user : null,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test("la clave del Atajo: 32 bytes aleatorios en base64url (43 caracteres) y a la nube solo su SHA-256", async () => {
  const { FinanceBuzon } = load();
  const token = FinanceBuzon._base64url(crypto.webcrypto.getRandomValues(new Uint8Array(32)));
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(require("../statement-inbox.js").TOKEN_PATTERN.source, /43/, "el servidor espera el mismo formato");
  const hash = await FinanceBuzon._sha256Hex(token);
  assert.equal(hash, require("../statement-inbox.js").hashToken(token), "mismo hash en el navegador y en el servidor");
  // El alta solo manda el hash y la caducidad.
  assert.match(source, /insert\(\{ token_hash: await sha256Hex\(token\), expires_at: [^}]+\}\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/, "la clave no se guarda en el navegador");
});

test("sin sesión, o con sesión pero sin el buzón desplegado, no se enseña nada (Importar sigue con su «Aún no»)", () => {
  const { FinanceBuzon } = load();
  assert.equal(FinanceBuzon.htmlPendientes(), "");
  assert.equal(FinanceBuzon.htmlAtajo(), "");
  assert.equal(FinanceBuzon.disponible(), false);
  const ctx = load({ session: { client: {}, user: { id: "u1" } } });
  ctx.FinanceBuzon._estado.cargadoEn = Date.now();
  ctx.FinanceBuzon._estado.disponible = false;
  assert.equal(ctx.FinanceBuzon.htmlAtajo(), "");
  assert.match(source, /PGRST205\|42P01\|does not exist\|schema cache/, "una tabla que no existe apaga el buzón");
  assert.match(read("views/importar-v2.js"), /\$\{atajo \? "" : impV2Pending\("Aún no: desde la app del banco con Compartir\."\)\}/);
});

test("con sesión: los pendientes se ven con Importar y Borrar; un PDF solo con Borrar", () => {
  const ctx = load({ session: { client: {}, user: { id: "u1" } } });
  const estado = ctx.FinanceBuzon._estado;
  estado.cargadoEn = Date.now(); // no refresca
  const ahora = new Date().toISOString();
  estado.pendientes = [
    { id: "a", object_path: "u1/a.csv", file_name: "octubre.csv", kind: "csv", received_at: ahora },
    { id: "b", object_path: "u1/b.pdf", file_name: "mediolanum.pdf", kind: "pdf", received_at: ahora },
  ];
  const html = ctx.FinanceBuzon.htmlPendientes();
  assert.match(html, /En el buzón<\/h3><span>2 extractos<\/span>/);
  assert.match(html, /data-buzon-importar="a"/);
  assert.doesNotMatch(html, /data-buzon-importar="b"/);
  assert.match(html, /data-buzon-borrar="b"/);
  assert.match(html, /Es un PDF: todavía no se puede leer/);
});

test("la clave se enseña una vez, con los pasos del Atajo, hasta «Ya está copiado»", () => {
  const ctx = load({ session: { client: {}, user: { id: "u1" } } });
  ctx.FinanceBuzon._estado.cargadoEn = Date.now();
  ctx.FinanceBuzon._estado.disponible = true;
  ctx.FinanceBuzon._estado.nuevoToken = "T".repeat(43);
  const html = ctx.FinanceBuzon.htmlAtajo();
  assert.match(html, /https:\/\/ejemplo\.supabase\.co\/functions\/v1\/statement-inbox/);
  assert.match(html, new RegExp("T".repeat(43)));
  assert.match(html, /Mostrar en la hoja Compartir/);
  assert.match(html, /data-buzon-copiado/);
  assert.match(ctx.FinanceBuzon.htmlAtajo(), /T{43}/, "un repintado no la borra");
  assert.match(source, /if \(t\.closest\("\[data-buzon-copiado\]"\)\) \{\n\s+estado\.nuevoToken = "";/);
});

test("lo importado sale del buzón solo si es el mismo fichero, y nada entra al libro sin la revisión de siempre", () => {
  assert.match(source, /await handleDatosImportarFile\(\{ target: \{ files: \[fichero\] \} \}\);/);
  assert.match(source, /if \(!pendiente \|\| !resultado \|\| resultado\.fileName !== pendiente\.fileName\) return;/);
  assert.match(read("views/importar-v2.js"), /globalThis\.FinanceBuzon\?\.alImportar\?\.\(datosImportarLastResult\);/);
});

test("el esquema: RLS, el dueño no puede dar de alta en el buzón y solo puede revocar su token", () => {
  const sql = read("supabase_schema.sql");
  assert.match(sql, /create table if not exists public\.finance_statement_inbox_tokens/);
  assert.match(sql, /token_hash text not null unique check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(sql, /expires_at <= created_at \+ interval '90 days'/);
  assert.match(sql, /alter table public\.finance_statement_inbox_tokens enable row level security;/);
  assert.match(sql, /alter table public\.finance_statement_inbox enable row level security;/);
  assert.match(sql, /grant update \(revoked_at\) on public\.finance_statement_inbox_tokens to authenticated;/);
  assert.match(sql, /grant select, delete on public\.finance_statement_inbox to authenticated;/);
  assert.doesNotMatch(sql, /grant[^;]*insert[^;]*on public\.finance_statement_inbox to authenticated/);
  assert.match(sql, /values \('finance-statement-inbox', 'finance-statement-inbox', false, 2097152/);
  assert.doesNotMatch(sql, /finance_statement_inbox_objects_insert/, "al bucket solo sube la función");
  assert.match(sql, /expires_at <= received_at \+ interval '7 days'/);
});

test("la función solo cablea el módulo probado y se despliega sin JWT, con su interruptor", () => {
  const fn = read("supabase/functions/statement-inbox/index.ts");
  assert.match(fn, /require\("\.\.\/\.\.\/\.\.\/statement-inbox\.js"\)/);
  assert.match(fn, /FINANCE_STATEMENT_INBOX_ENABLED/);
  assert.match(fn, /--no-verify-jwt/);
  assert.match(fn, /x-inbox-token/);
});

test("está en la app y en la publicación; en Movimientos e Importar", () => {
  const html = read("index.html");
  assert.match(html, /<script defer src="buzon-extractos\.js\?v=\d+xda02"><\/script>/);
  assert.ok(html.indexOf("buzon-extractos.js") < html.indexOf('src="app.js'));
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"buzon-extractos\.js",$/m);
  assert.match(read("service-worker.js"), /"\.\/buzon-extractos\.js",/);
  assert.match(read("views/movimientos-v2.js"), /\$\{movV2Header\(true\)\}\$\{movV2Buzon\(\)\}/);
  assert.match(read("views/importar-v2.js"), /buzon\?\.htmlAtajo\?\.\(\)/);
  const css = read("tema-v2.css");
  const block = css.slice(css.indexOf("/* ---------- XDA-02 · Buzón de extractos"));
  const selectors = block.replace(/\/\*[\s\S]*?\*\//g, "").match(/^[^@{}\n][^{}]*\{/gm) || [];
  assert.ok(selectors.length > 5);
  selectors.forEach((selector) => assert.match(selector.trim(), /^:root\[data-tema="v2"\]/, `selector fuera del tema: ${selector}`));
});
