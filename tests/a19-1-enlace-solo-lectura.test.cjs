const test = require("node:test");
const assert = require("node:assert/strict");

const Share = require("../canonical-share-link.js");

// A19-1 (BACKLOG_PATRIMONIO_Y_FINANZAS.md, depende de A14-1): "comparte una vista concreta (plan
// de deuda, forecast a 6 meses) con un asesor externo sin usuario propio ni acceso a movimientos
// individuales; caduca automáticamente". El token en crudo nunca se persiste — solo su hash SHA-256
// (mismo criterio que finance_household_invitations.token_hash) — y cada vista redacta
// explícitamente los campos que comparte, nunca "todo menos lo prohibido".

test("generateShareToken produce tokens distintos y suficientemente largos (256 bits en base64url)", () => {
  const a = Share.generateShareToken();
  const b = Share.generateShareToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 40, "un token de 32 bytes en base64url debe rondar los 43 caracteres");
  assert.doesNotMatch(a, /[+/=]/, "debe ser base64url, no base64 estándar");
});

test("hashToken es determinista y nunca devuelve el token en crudo", async () => {
  const token = "token-de-prueba";
  const hash1 = await Share.hashToken(token);
  const hash2 = await Share.hashToken(token);
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64, "SHA-256 en hexadecimal son 64 caracteres");
  assert.doesNotMatch(hash1, new RegExp(token));
});

test("hashToken produce hashes distintos para tokens distintos", async () => {
  const hashA = await Share.hashToken("token-a");
  const hashB = await Share.hashToken("token-b");
  assert.notEqual(hashA, hashB);
});

test("normalizeTtlDays cae al valor por defecto si es 0, negativo o no numérico", () => {
  assert.equal(Share.normalizeTtlDays(0), Share.DEFAULT_TTL_DAYS);
  assert.equal(Share.normalizeTtlDays(-5), Share.DEFAULT_TTL_DAYS);
  assert.equal(Share.normalizeTtlDays("no-es-un-numero"), Share.DEFAULT_TTL_DAYS);
});

test("normalizeTtlDays recorta al máximo permitido — nunca un enlace \"para siempre\"", () => {
  assert.equal(Share.normalizeTtlDays(500), Share.MAX_TTL_DAYS);
  assert.equal(Share.normalizeTtlDays(Share.MAX_TTL_DAYS + 1), Share.MAX_TTL_DAYS);
});

test("expiresAtFrom calcula la fecha de caducidad a partir de los días declarados", () => {
  const now = new Date("2026-09-02T00:00:00.000Z");
  assert.equal(Share.expiresAtFrom(14, now), "2026-09-16T00:00:00.000Z");
  assert.equal(Share.expiresAtFrom(1, now), "2026-09-03T00:00:00.000Z");
});

test("isExpired: un dato ausente o corrupto se trata como caducado, nunca como \"vivo por defecto\" (falla cerrado)", () => {
  assert.equal(Share.isExpired(undefined, null), true);
  assert.equal(Share.isExpired("", null), true);
  assert.equal(Share.isExpired("fecha-invalida", null), true);
});

test("isExpired: revocado siempre gana, aunque la fecha de caducidad siga en el futuro", () => {
  assert.equal(Share.isExpired("2099-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"), true);
});

test("isExpired: distingue correctamente pasado y futuro", () => {
  assert.equal(Share.isExpired("2020-01-01T00:00:00.000Z", null), true);
  assert.equal(Share.isExpired("2099-01-01T00:00:00.000Z", null), false);
});

test("redactDebtPlanView solo comparte entidad, tipo, principal pendiente y cuota — nunca número de cuenta ni notas", () => {
  const payload = Share.redactDebtPlanView([
    { entity: "Banco X", type: "Hipoteca", currentPrincipal: 100000, currentPayment: 500, accountNumber: "ES12 3456 SECRETO", notes: "nota privada" },
  ]);
  assert.equal(payload.debts.length, 1);
  const debt = payload.debts[0];
  assert.deepEqual(Object.keys(debt).sort(), ["currentPayment", "currentPrincipal", "entity", "type"]);
  assert.equal(debt.entity, "Banco X");
});

test("redactForecastView solo comparte los primeros 6 meses en agregado — nunca por categoría ni por movimiento", () => {
  const series = Array.from({ length: 12 }, (_, index) => ({
    monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
    label: `Mes ${index + 1}`,
    totals: { income: 2000, outflowsBeforeSaving: 1500, saving: 200, closingLiquidity: 1000 + index * 100, byCategory: { ocio: 100 } },
  }));
  const payload = Share.redactForecastView(series);
  assert.equal(payload.months.length, 6);
  assert.deepEqual(Object.keys(payload.months[0]).sort(), ["closingLiquidity", "income", "label", "monthKey", "outflows", "saving"]);
});

test("buildSharePayload rechaza un tipo de vista desconocido — nunca comparte «todo por defecto»", () => {
  assert.throws(() => Share.buildSharePayload("movimientos-completos", []), /desconocido/);
});

test("VIEW_TYPES solo declara las dos vistas del spec de A19-1", () => {
  assert.deepEqual(Share.VIEW_TYPES, ["debt-plan", "forecast-6m"]);
});
