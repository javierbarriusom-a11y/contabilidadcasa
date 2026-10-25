const test = require("node:test");
const assert = require("node:assert/strict");
const inbox = require("../statement-inbox.js");

// XDA-02 · PR-2: la lógica del buzón de extractos (statement-inbox.js), con dependencias falsas en memoria.
// Requisitos de NTC-06 que se comprueban aquí: RQ-01 (token solo como hash), RQ-02 (cerrado por defecto, tamaño máximo,
// límite de peticiones, errores sin detalle), RQ-04 (registro sin datos personales) y RQ-08 (interruptor de apagado).

const TOKEN = "A".repeat(43);
const NOW = new Date("2026-10-25T10:00:00Z");
const CSV = new TextEncoder().encode("Fecha;Concepto;Importe;Saldo\n01/10/2026;NOMINA FICTICIA;3000,00;4000,00\n");

function fakeDeps(overrides = {}) {
  const state = { objects: [], items: [], touched: [], purged: [], logs: [], uploads: 0, pending: 0 };
  let n = 0;
  const deps = {
    enabled: true,
    now: () => NOW,
    newId: () => `id-${(n += 1)}`,
    findTokenByHash: async (hash) => (hash === inbox.hashToken(TOKEN) ? { id: "tok-1", user_id: "user-1", expires_at: "2026-12-01T00:00:00Z", revoked_at: null } : null),
    countUploadsSince: async () => state.uploads,
    countPending: async () => state.pending,
    storeObject: async (path, bytes, mime) => state.objects.push({ path, size: bytes.length, mime }),
    insertItem: async (row) => state.items.push(row),
    touchToken: async (id, at) => state.touched.push({ id, at }),
    purgeExpired: async (userId, at) => state.purged.push({ userId, at }),
    audit: (event) => state.logs.push(event),
    ...overrides,
  };
  return { deps, state };
}

const post = (app, { token = TOKEN, body = CSV, name = "movimientos%20octubre.csv", method = "POST" } = {}) =>
  app.handle({ method, headers: { "x-inbox-token": token, "x-file-name": name }, body });

test("un extracto válido se guarda en la carpeta de su dueño, caduca a los 7 días y no devuelve nada del buzón", async () => {
  const { deps, state } = fakeDeps();
  const res = await post(inbox.createStatementInbox(deps));
  assert.equal(res.status, 201);
  assert.deepEqual(Object.keys(res.body).sort(), ["mensaje", "ok"]);
  assert.equal(state.objects.length, 1);
  assert.match(state.objects[0].path, /^user-1\/id-\d+\.csv$/);
  assert.equal(state.objects[0].mime, "text/csv");
  const item = state.items[0];
  assert.equal(item.user_id, "user-1");
  assert.equal(item.token_id, "tok-1");
  assert.equal(item.file_name, "movimientos octubre.csv");
  assert.equal(item.kind, "csv");
  assert.equal(item.expires_at, "2026-11-01T10:00:00.000Z");
  assert.deepEqual(state.touched, [{ id: "tok-1", at: NOW.toISOString() }]);
  assert.deepEqual(state.purged, [{ userId: "user-1", at: NOW.toISOString() }], "aprovecha cada envío para borrar lo caducado");
});

test("RQ-08: con el interruptor apagado no recibe nada", async () => {
  const { deps, state } = fakeDeps({ enabled: false });
  const res = await post(inbox.createStatementInbox(deps));
  assert.equal(res.status, 503);
  assert.equal(state.objects.length, 0);
});

test("RQ-01/RQ-02: token mal formado, inexistente, revocado o caducado dan el mismo 401 sin pistas", async () => {
  const casos = [
    [{ token: "corto" }, {}],
    [{ token: "B".repeat(43) }, {}],
    [{}, { findTokenByHash: async () => ({ id: "t", user_id: "u", expires_at: "2026-12-01T00:00:00Z", revoked_at: "2026-10-20T00:00:00Z" }) }],
    [{}, { findTokenByHash: async () => ({ id: "t", user_id: "u", expires_at: "2026-10-25T09:59:59Z", revoked_at: null }) }],
  ];
  for (const [req, override] of casos) {
    const { deps, state } = fakeDeps(override);
    const res = await post(inbox.createStatementInbox(deps), req);
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { ok: false, error: "token" });
    assert.equal(state.objects.length, 0);
  }
});

test("el token solo viaja como hash SHA-256", async () => {
  let visto = null;
  const { deps } = fakeDeps({ findTokenByHash: async (hash) => { visto = hash; return null; } });
  await post(inbox.createStatementInbox(deps));
  assert.match(visto, /^[0-9a-f]{64}$/);
  assert.notEqual(visto, TOKEN);
});

test("RQ-02: solo POST, ni vacío ni más de 2 MB, y solo PDF, Excel o texto por su firma", async () => {
  const app = (o) => inbox.createStatementInbox(fakeDeps(o).deps);
  assert.equal((await post(app(), { method: "GET" })).status, 405);
  assert.equal((await post(app(), { body: new Uint8Array() })).status, 400);
  assert.equal((await post(app(), { body: new Uint8Array(inbox.MAX_BYTES + 1).fill(65) })).status, 413);
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
  assert.equal((await post(app(), { body: exe })).status, 415, "un binario cualquiera no entra");
  assert.equal(inbox.sniffKind(new TextEncoder().encode("%PDF-1.7")), "pdf");
  assert.equal(inbox.sniffKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])), "xlsx");
  assert.equal(inbox.sniffKind(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), "xls");
  assert.equal(inbox.sniffKind(new Uint8Array([0xff, 0xfe, 0x46, 0x00])), "csv");
});

test("RQ-02: límite de 20 envíos al día por token y de 20 extractos esperando por usuario", async () => {
  const lleno = fakeDeps();
  lleno.state.uploads = inbox.MAX_UPLOADS_PER_TOKEN_PER_DAY;
  assert.equal((await post(inbox.createStatementInbox(lleno.deps))).status, 429);
  const esperando = fakeDeps();
  esperando.state.pending = inbox.MAX_PENDING_PER_USER;
  const res = await post(inbox.createStatementInbox(esperando.deps));
  assert.equal(res.status, 429);
  assert.equal(res.body.error, "lleno");
  assert.equal(esperando.state.objects.length, 0);
});

test("RQ-04: el registro no lleva token, nombre de fichero ni contenido", async () => {
  const { deps, state } = fakeDeps();
  await post(inbox.createStatementInbox(deps));
  await post(inbox.createStatementInbox(deps), { token: "B".repeat(43) });
  const texto = JSON.stringify(state.logs);
  assert.ok(state.logs.length === 2);
  assert.ok(!texto.includes(TOKEN) && !texto.includes("B".repeat(43)));
  assert.ok(!/octubre|NOMINA|3000/.test(texto));
  state.logs.forEach((log) => assert.deepEqual(Object.keys(log).sort(), ["ms", "requestId", "result", "schema", "status", "userId"]));
});

test("el nombre del fichero se limpia: sin rutas ni caracteres raros, y con uno por defecto", () => {
  assert.equal(inbox.cleanFileName("../../etc/passwd", "csv"), "passwd");
  assert.equal(inbox.cleanFileName("a<script>.csv", "csv"), "ascript.csv");
  assert.equal(inbox.cleanFileName("", "xlsx"), "extracto.xlsx");
  assert.equal(inbox.cleanFileName("%E0%A4%A", "csv"), "%E0%A4%A", "un nombre mal codificado no rompe");
  assert.equal(inbox.cleanFileName("x".repeat(200), "csv").length, 80);
});
