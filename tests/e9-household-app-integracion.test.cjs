const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const migrationSource = fs.readFileSync(path.join(root, "migrations", "20260904_e9_household_writes.sql"), "utf8");

// E9-1 (RGX1/RGX2, Oleada 2 Bloque 2/3): hogar compartido. La migración original
// (20260801_e9_household.sql) dejó tablas y lectura vía RLS listas, pero ninguna escritura —
// reservada a un backend que nunca se desplegó (mismo hallazgo que ya documentó A19-1 sobre
// backend/server.mjs). Esta oleada añade las funciones security definer que faltaban y la interfaz.

test("E9-1: la tarjeta de hogar compartido y el simulacro de RGX1 están en Ajustes", () => {
  ["rgxHouseholdCard", "rgx1AccessDrill", "rgxKnowledgeConcentration"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en index.html`);
  });
});

test("E9-1: createRgxHousehold exige sesión antes de generar cualquier hogar", () => {
  const block = app.slice(app.indexOf("async function createRgxHousehold("), app.indexOf("async function createRgxHousehold(") + 500);
  assert.match(block, /if \(!supabaseClient \|\| !remoteUser\)/);
  assert.match(block, /finance_household_create/);
});

test("E9-1: inviteRgxHouseholdMember comprueba el permiso members:invite con el motor canónico antes de escribir", () => {
  const block = app.slice(app.indexOf("async function inviteRgxHouseholdMember("), app.indexOf("async function inviteRgxHouseholdMember(") + 1600);
  assert.match(block, /E9Household\.can\(rgxHouseholdState\(\), remoteUser\.id, "members:invite"\)/);
  assert.match(block, /No tienes permiso para invitar/);
});

test("E9-1: inviteRgxHouseholdMember genera el token y el hash del correo con el mismo motor que A19-1 (FinanceCanonicalShareLink), nunca envía ninguno en crudo a Supabase", () => {
  const block = app.slice(app.indexOf("async function inviteRgxHouseholdMember("), app.indexOf("async function inviteRgxHouseholdMember(") + 1600);
  assert.match(block, /shareEngine\.generateShareToken\(\)/);
  assert.match(block, /shareEngine\.hashToken\(rawToken\)/);
  assert.match(block, /shareEngine\.hashToken\(normalizedEmail\)/);
  assert.match(block, /p_invitee_hash: inviteeHash/);
  assert.match(block, /p_token_hash: tokenHash/);
  assert.doesNotMatch(block, /p_invitee_hash: normalizedEmail/, "el correo en crudo nunca debe enviarse como invitee_hash");
});

test("E9-1: acceptRgxHouseholdInvitationFromUrl lee el token del fragmento propio (#household-invite=), nunca de la query string, y limpia la URL tras leerlo", () => {
  const block = app.slice(app.indexOf("async function acceptRgxHouseholdInvitationFromUrl("), app.indexOf("async function acceptRgxHouseholdInvitationFromUrl(") + 700);
  assert.match(block, /household-invite=/);
  assert.match(block, /location\.hash/);
  assert.match(block, /history\.replaceState/);
  assert.match(block, /finance_household_accept/);
});

test("E9-1: revokeRgxHouseholdMember pide confirmación explícita antes de retirar el acceso", () => {
  const block = app.slice(app.indexOf("async function revokeRgxHouseholdMember("), app.indexOf("async function revokeRgxHouseholdMember(") + 900);
  assert.match(block, /requestOperationConfirmation/);
  assert.match(block, /if \(!reason\) return;/);
  assert.match(block, /finance_household_revoke/);
});

test("E9-1: renderRgxHouseholdCard solo muestra el botón de retirar a miembros que no sean el propietario", () => {
  const block = app.slice(app.indexOf("function renderRgxHouseholdCard("), app.indexOf("function renderRgxHouseholdCard(") + 1800);
  assert.match(block, /canManage && member\.role !== "owner"/);
});

test("E9-1: los controles del hogar compartido y el arranque de sesión están cableados", () => {
  assert.match(app, /qs\("rgxHouseholdCard"\)\?\.addEventListener\("click"/);
  assert.match(app, /createRgxHousehold\(""\)\.then/);
  assert.match(app, /revokeRgxHouseholdMember\(revokeButton\.dataset\.rgxHouseholdRevoke\)/);
  assert.match(app, /refreshRgxHouseholdCard\(\);\s*\n\s*renderA19ShareLinkList\(\);/);
  const sessionReadyOccurrences = app.match(/await acceptRgxHouseholdInvitationFromUrl\(\);\s*\n\s*await refreshRgxHouseholdCard\(\);/g) || [];
  assert.equal(sessionReadyOccurrences.length, 2, "debe engancharse tanto a la sesión inicial como a onAuthStateChange");
});

test("E9-1: renderIvx8HousingExposure y renderRgxKnowledgeConcentration se recalculan juntos en los tres mismos puntos (renderA14AssetBreakdown y las dos salidas de renderIv1PositionConcentration)", () => {
  const occurrences = app.match(/renderIvx8HousingExposure\(\);\s*\n\s*renderRgxKnowledgeConcentration\(\);/g) || [];
  assert.equal(occurrences.length, 3);
});

test("E9-1: descargar la copia de emergencia registra la fecha (RGX1), nunca inventa una fecha pasada", () => {
  const block = app.slice(app.indexOf("function downloadStateBackup("), app.indexOf("function downloadStateBackup(") + 900);
  assert.match(block, /scenarioSettings\.lastEmergencyBackupAt = new Date\(\)\.toISOString\(\);/);
  assert.match(block, /saveScenarioSettings\(\);/);
});

test("E9-1: la migración de escritura nunca concede privilegios directos sobre las tablas, solo ejecución de las funciones", () => {
  ["finance_household_create(uuid, text)", "finance_household_invite(uuid, uuid, text, text, text, jsonb, int)", "finance_household_accept(text)", "finance_household_revoke(uuid, uuid, text)"].forEach((signature) => {
    assert.match(migrationSource, new RegExp(`revoke all on function public\\.${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} from public`));
    assert.match(migrationSource, new RegExp(`grant execute on function public\\.${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} to authenticated`));
  });
  assert.doesNotMatch(migrationSource, /grant\s+insert|grant\s+update|grant\s+delete/i, "las tablas de escritura del hogar solo se tocan a través de las funciones, nunca con grant directo");
});

test("E9-1: finance_household_accept exige que el hash del correo propio coincida con invitee_hash — no basta con tener el token", () => {
  const block = migrationSource.slice(migrationSource.indexOf("function public.finance_household_accept("), migrationSource.indexOf("function public.finance_household_accept(") + 2200);
  assert.match(block, /v_invitation\.invitee_hash <> encode\(digest\(lower\(trim\(coalesce\(v_email, ''\)\)\), 'sha256'\), 'hex'\)/);
  assert.match(block, /Esta invitación no es para esta cuenta/);
  assert.match(block, /set search_path = public, extensions/, "misma incidencia real que A19-1: digest() necesita \"extensions\" en el search_path");
});

test("E9-1: finance_household_revoke nunca permite retirar a la persona propietaria", () => {
  const block = migrationSource.slice(migrationSource.indexOf("function public.finance_household_revoke("), migrationSource.indexOf("function public.finance_household_revoke(") + 1600);
  assert.match(block, /if v_target_role = 'owner' then raise exception/);
});

test("E9-1: finance_household_invite exige rol owner/admin y al menos un área, igual que canonical-e9-household.js#invite", () => {
  const block = migrationSource.slice(migrationSource.indexOf("function public.finance_household_invite("), migrationSource.indexOf("function public.finance_household_invite(") + 2000);
  assert.match(block, /finance_household_role\(p_household_id\) not in \('owner', 'admin'\)/);
  assert.match(block, /jsonb_array_length\(coalesce\(p_areas, '\[\]'::jsonb\)\) = 0/);
});

test("canonical-e9-household.js sigue siendo la referencia de reglas: ROLES/SHARED_AREAS/can/activeMember, sin duplicar su lógica en app.js", () => {
  assert.match(app, /const E9Household = globalThis\.FinanceCanonicalE9Household \|\| null;/);
  assert.doesNotMatch(app, /const ROLES = \{[\s\S]{0,40}owner:/, "los roles no deben redeclararse en app.js");
});
