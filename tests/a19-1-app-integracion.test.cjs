const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");
const shareSource = fs.readFileSync(require.resolve("../share.html"), "utf8");
const buildScript = fs.readFileSync(require.resolve("../tools/build-public-site.mjs"), "utf8");
const migrationSource = fs.readFileSync(require.resolve("../migrations/20260902_a19_1_share_links.sql"), "utf8");

test("A19-1: la tarjeta de Ajustes tiene el selector de vista, los días de caducidad y el botón de generar", () => {
  ["a19ShareViewType", "a19ShareTtlDays", "a19ShareSave", "a19ShareStatus", "a19ShareLinkList"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de A19-1`);
  });
  assert.match(indexSource, /<option value="debt-plan">Plan de deuda<\/option>/);
  assert.match(indexSource, /<option value="forecast-6m">Forecast a 6 meses<\/option>/);
});

test("A19-1: saveA19ShareLink exige sesión remota antes de generar cualquier enlace", () => {
  const block = appSource.slice(appSource.indexOf("async function saveA19ShareLink("), appSource.indexOf("async function saveA19ShareLink(") + 1400);
  assert.match(block, /if \(!supabaseClient \|\| !remoteUser\)/);
  assert.match(block, /Inicia sesión para generar un enlace compartible/);
});

test("A19-1: saveA19ShareLink genera el token, calcula su hash y nunca envía el token en crudo a Supabase", () => {
  const block = appSource.slice(appSource.indexOf("async function saveA19ShareLink("), appSource.indexOf("async function saveA19ShareLink(") + 1400);
  assert.match(block, /engine\.generateShareToken\(\)/);
  assert.match(block, /engine\.hashToken\(rawToken\)/);
  assert.match(block, /token_hash: tokenHash/);
  assert.doesNotMatch(block, /token:\s*rawToken/, "el token en crudo no debe insertarse como columna");
});

test("A19-1: la URL del enlace generado usa el fragmento (#token=), nunca la query string", () => {
  const block = appSource.slice(appSource.indexOf("function a19ShareUrl("), appSource.indexOf("function a19ShareUrl(") + 300);
  assert.match(block, /share\.html#token=/);
});

test("A19-1: renderA19ShareLinkList pide sesión antes de listar, y solo filtra por el propio owner_user_id", () => {
  const block = appSource.slice(appSource.indexOf("async function renderA19ShareLinkList("), appSource.indexOf("async function renderA19ShareLinkList(") + 900);
  assert.match(block, /Inicia sesión para ver tus enlaces compartidos/);
  assert.match(block, /\.eq\("owner_user_id", remoteUser\.id\)/);
});

test("A19-1: revokeA19ShareLink solo marca revoked_at, nunca borra ni reescribe el payload", () => {
  const block = appSource.slice(appSource.indexOf("async function revokeA19ShareLink("), appSource.indexOf("async function revokeA19ShareLink(") + 400);
  assert.match(block, /\.update\(\{ revoked_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(block, /\.eq\("owner_user_id", remoteUser\.id\)/);
});

test("A19-1: los controles y el listado están cableados", () => {
  assert.match(appSource, /qs\("a19ShareSave"\)\?\.addEventListener\("click", saveA19ShareLink\);/);
  assert.match(appSource, /qs\("a19ShareLinkList"\)\?\.addEventListener\("click"/);
  assert.match(appSource, /revokeA19ShareLink\(revokeButton\.dataset\.a19ShareRevoke\)/);
});

test("A19-1: renderA19ShareLinkList se llama en el arranque de la app", () => {
  assert.match(appSource, /renderA19ShareLinkList\(\);\s*\n\s*renderA14AssetList\(\);/);
});

test("share.html es una página independiente: no carga app.js, no registra service worker y lee el token solo del fragmento", () => {
  assert.doesNotMatch(shareSource, /src="app\.js/);
  assert.doesNotMatch(shareSource, /register\(["']service-worker/);
  assert.match(shareSource, /location\.hash/);
  assert.match(shareSource, /get_finance_share_link/);
});

test("share.html nunca expone el detalle del error — siempre el mismo mensaje genérico", () => {
  const scriptStart = shareSource.indexOf("<script>\n// A19-1");
  const script = shareSource.slice(scriptStart);
  assert.match(script, /catch \{/);
  assert.equal((script.match(/showError\(\)/g) || []).length >= 2, true, "debe reutilizar la misma función de error para todos los casos");
});

test("canonical-share-link.js y share.html están registrados en la whitelist del sitio público", () => {
  assert.match(buildScript, /"canonical-share-link\.js"/);
  assert.match(buildScript, /"share\.html"/);
});

test("canonical-share-link.js está versionado en index.html", () => {
  assert.match(indexSource, /canonical-share-link\.js\?v=/);
});

test("la migración SQL de A19-1 nunca concede privilegios directos a anon sobre la tabla, solo sobre la función", () => {
  assert.match(migrationSource, /revoke all on public\.finance_share_links from anon/);
  assert.match(migrationSource, /grant execute on function public\.get_finance_share_link\(text\) to anon, authenticated/);
  assert.match(migrationSource, /token_hash text not null unique/);
  assert.doesNotMatch(migrationSource, /token text not null unique/, "no debe existir una columna de token en crudo");
});

test("la migración SQL solo permite update a un enlace propio, y solo para revocarlo (nunca reactivar ni reescribir)", () => {
  assert.match(migrationSource, /with check \(\(select auth\.uid\(\)\) = owner_user_id and revoked_at is not null\)/);
});

// Fallo real detectado tras aplicar la migración a un proyecto Supabase real: pgcrypto suele venir
// preinstalada en el esquema "extensions" (para uso interno de Supabase), no en "public" — así que
// digest() no se encuentra si el search_path de la función solo incluye "public", y get_finance_
// share_link falla en tiempo de ejecución para todo el mundo, aunque el token sea válido.
test("get_finance_share_link incluye \"extensions\" en su search_path, para que digest() se resuelva aunque pgcrypto esté fuera de \"public\"", () => {
  assert.match(migrationSource, /set search_path = public, extensions/);
});
