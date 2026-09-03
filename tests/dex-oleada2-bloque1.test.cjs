const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const analisis = read("views/analisis.js");

// Oleada 2 · Bloque 1 (BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md): primer lote priorizado del
// protocolo de entrada de datos — DEX9 (progreso de la bandeja previa), DEX7 (importe sugerido por
// partida), DEX3 (plantilla de un toque para lo recurrente) y DEX11 (confirmación por gesto en
// móvil). DEX8 (copy de errores) se prueba junto a confirmReceiptCapture, en
// tests/a17-3-captura-camara.test.cjs.

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = source.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

// ---------------------------------------------------------------------------------------------
// DEX9 · bandeja previa con progreso hasta cero
// ---------------------------------------------------------------------------------------------

function dex9Sandbox() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction(app, "dataInboxPendingSummary"), context);
  return context;
}

test("dataInboxPendingSummary · sin entradas, no hay pendientes", () => {
  const ctx = dex9Sandbox();
  const result = ctx.dataInboxPendingSummary([]);
  assert.equal(result.remaining, 0);
  assert.deepEqual(result.pending, []);
});

test("dataInboxPendingSummary · solo cuenta ready/blocked — applied/undone/discarded ya están resueltas", () => {
  const ctx = dex9Sandbox();
  const items = [
    { id: "a", status: "applied", createdAt: "2026-09-01T00:00:00.000Z" },
    { id: "b", status: "ready", createdAt: "2026-09-02T00:00:00.000Z" },
    { id: "c", status: "discarded", createdAt: "2026-09-03T00:00:00.000Z" },
    { id: "d", status: "blocked", createdAt: "2026-09-01T00:00:00.000Z" },
  ];
  const result = ctx.dataInboxPendingSummary(items);
  assert.equal(result.remaining, 2);
  assert.deepEqual(result.pending.map((item) => item.id), ["d", "b"]); // la más antigua primero
});

test("renderE11bStatus · con pendientes, muestra el contador y ordena por la más antigua primero", () => {
  const source = extractFunction(app, "renderE11bStatus");
  assert.match(source, /dataInboxPendingSummary\(dataInbox\)/);
  assert.match(source, /pendiente\$\{remaining === 1 \? "" : "s"\} de confirmar — la más antigua primero/);
  assert.match(source, /pending\.slice\(0, 4\)/);
  assert.match(source, /Sin pendientes: la bandeja está al día\./);
});

// ---------------------------------------------------------------------------------------------
// DEX7 · valores por defecto que aprenden (último real por partida)
// ---------------------------------------------------------------------------------------------

function dex7Sandbox({ incomeActuals = {}, expenseActuals = {}, months = [] } = {}) {
  const context = {
    baseData: { monthlyPlanning: { months } },
    incomeActuals,
    expenseActuals,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction(app, "actualsForKind"), context);
  vm.runInContext(extractFunction(app, "lastActualForEntry"), context);
  return context;
}

test("lastActualForEntry · sin real anterior, no hay sugerencia (hueco, no invención)", () => {
  const ctx = dex7Sandbox({ months: [{ key: "2026-08" }, { key: "2026-09" }] });
  const entry = { key: "luz-partida|2026-09", kind: "expense" };
  assert.equal(ctx.lastActualForEntry(entry, { key: "2026-09" }), null);
});

test("lastActualForEntry · toma el real del mes anterior más reciente que sí lo tiene, no cualquiera", () => {
  const ctx = dex7Sandbox({
    expenseActuals: { "luz-partida|2026-06": 40, "luz-partida|2026-08": 55 },
    months: [{ key: "2026-06", label: "junio 2026" }, { key: "2026-07", label: "julio 2026" }, { key: "2026-08", label: "agosto 2026" }, { key: "2026-09", label: "septiembre 2026" }],
  });
  const entry = { key: "luz-partida|2026-09", kind: "expense" };
  const suggestion = ctx.lastActualForEntry(entry, { key: "2026-09" });
  assert.equal(suggestion.amount, 55);
  assert.equal(suggestion.monthLabel, "agosto 2026");
});

test("lastActualForEntry · nunca mira meses iguales o posteriores al seleccionado", () => {
  const ctx = dex7Sandbox({
    expenseActuals: { "luz-partida|2026-09": 70, "luz-partida|2026-10": 90 },
    months: [{ key: "2026-09", label: "septiembre 2026" }, { key: "2026-10", label: "octubre 2026" }],
  });
  const entry = { key: "luz-partida|2026-09", kind: "expense" };
  assert.equal(ctx.lastActualForEntry(entry, { key: "2026-09" }), null);
});

test("registrarActualsRowHtml · la sugerencia solo llega como placeholder, nunca como value — sin real propio, el input sigue vacío", () => {
  const source = extractFunction(app, "registrarActualsRowHtml");
  assert.match(source, /const suggestion = entry\.hasActual \? null : lastActualForEntry\(entry, month\);/);
  assert.match(source, /value="\$\{entry\.hasActual \? entry\.actual : ""\}"/);
  assert.match(source, /placeholder="\$\{escapeHtml\(placeholder\)\}"/);
});

// ---------------------------------------------------------------------------------------------
// DEX3 · plantilla de un toque para lo recurrente
// ---------------------------------------------------------------------------------------------

function dex3Sandbox() {
  const calls = { addE11bInboxItem: null, applyStagedMovementImport: 0 };
  const context = {
    round2: (value) => Math.round(Number(value || 0) * 100) / 100,
    addE11bInboxItem: (input) => { calls.addE11bInboxItem = input; return { id: "inbox-dex3-1" }; },
    applyStagedMovementImport: () => { calls.applyStagedMovementImport += 1; },
    pendingE11bApply: null,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction(analisis, "handleAnalisisRepeatSubscription"), context);
  return { context, calls };
}

test("handleAnalisisRepeatSubscription · un toque crea la entrada en la bandeja previa y confirma por el mismo camino que un extracto", () => {
  const { context, calls } = dex3Sandbox();
  vm.runInContext('handleAnalisisRepeatSubscription("NETFLIX.COM", "12.99", "Suscripciones")', context);
  assert.equal(calls.addE11bInboxItem.source, "manual-template");
  const row = calls.addE11bInboxItem.rows[0];
  assert.equal(row.amount, -12.99);
  assert.equal(row.movement, "NETFLIX.COM");
  assert.equal(row.category, "Suscripciones");
  assert.equal(calls.applyStagedMovementImport, 1);
  assert.equal(context.pendingE11bApply.imported[0].movement, "NETFLIX.COM");
});

test("handleAnalisisRepeatSubscription · un label con comercio y detalle («movement · details») se reparte en los dos campos", () => {
  const { context, calls } = dex3Sandbox();
  vm.runInContext('handleAnalisisRepeatSubscription("RECIBO · SPOTIFY", "9.99", "Suscripciones")', context);
  assert.equal(calls.addE11bInboxItem.rows[0].movement, "RECIBO");
  assert.equal(calls.addE11bInboxItem.rows[0].details, "SPOTIFY");
});

test("handleAnalisisRepeatSubscription · sin importe válido, no incorpora nada", () => {
  const { context, calls } = dex3Sandbox();
  vm.runInContext('handleAnalisisRepeatSubscription("NETFLIX.COM", "0", "Suscripciones")', context);
  assert.equal(calls.addE11bInboxItem, null);
  assert.equal(calls.applyStagedMovementImport, 0);
});

test("el botón «Repetir hoy» está cableado en la vista Análisis (misma delegación que el resto de acciones)", () => {
  assert.match(app, /data-analisis-repeat-subscription/);
  assert.match(app, /handleAnalisisRepeatSubscription\(repeatSubscription\.dataset\.analisisRepeatSubscription/);
  assert.match(analisis, /data-analisis-repeat-subscription="\$\{escapeHtml\(item\.label\)\}"/);
});

// ---------------------------------------------------------------------------------------------
// DEX11 · confirmación por gesto en móvil
// ---------------------------------------------------------------------------------------------

function fakeButton() {
  const classes = new Set();
  const listeners = {};
  return {
    dataset: {},
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    listeners,
    clicked: 0,
    click() { this.clicked += 1; },
  };
}

function dex11Sandbox({ touch = true } = {}) {
  const context = {
    window: {
      navigator: { maxTouchPoints: touch ? 1 : 0 },
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id),
    },
  };
  vm.createContext(context);
  const holdMsDeclaration = app.match(/const GESTURE_CONFIRM_HOLD_MS = \d+;/);
  assert.ok(holdMsDeclaration, "No existe GESTURE_CONFIRM_HOLD_MS en app.js");
  vm.runInContext(holdMsDeclaration[0], context);
  vm.runInContext(extractFunction(app, "isTouchInputDevice"), context);
  vm.runInContext(extractFunction(app, "wireGestureConfirm"), context);
  return context;
}

test("isTouchInputDevice · sin maxTouchPoints ni ontouchstart, no es táctil", () => {
  const ctx = dex11Sandbox({ touch: false });
  assert.equal(ctx.isTouchInputDevice(), false);
});

test("isTouchInputDevice · con maxTouchPoints > 0, es táctil", () => {
  const ctx = dex11Sandbox({ touch: true });
  assert.equal(ctx.isTouchInputDevice(), true);
});

test("wireGestureConfirm · en desktop (sin táctil), no toca el botón — el clic normal sigue confirmando al instante", () => {
  const ctx = dex11Sandbox({ touch: false });
  ctx.button = fakeButton();
  vm.runInContext("wireGestureConfirm(button)", ctx);
  assert.equal(ctx.button.classList.contains("gesture-confirm"), false);
  assert.equal(ctx.button.listeners.touchstart, undefined);
});

test("wireGestureConfirm · en táctil, un toque suelto (sin mantener) no confirma", async () => {
  const ctx = dex11Sandbox({ touch: true });
  ctx.button = fakeButton();
  vm.runInContext("wireGestureConfirm(button)", ctx);
  assert.equal(ctx.button.classList.contains("gesture-confirm"), true);
  ctx.button.listeners.touchstart({ preventDefault: () => {} });
  assert.equal(ctx.button.classList.contains("is-holding"), true);
  ctx.button.listeners.touchend();
  assert.equal(ctx.button.classList.contains("is-holding"), false);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(ctx.button.clicked, 0);
});

test("wireGestureConfirm · en táctil, mantener pulsado el tiempo completo sí confirma", async () => {
  const ctx = dex11Sandbox({ touch: true });
  ctx.button = fakeButton();
  vm.runInContext("wireGestureConfirm(button)", ctx);
  ctx.button.listeners.touchstart({ preventDefault: () => {} });
  await new Promise((resolve) => setTimeout(resolve, 650));
  assert.equal(ctx.button.clicked, 1);
  assert.equal(ctx.button.classList.contains("is-holding"), false);
});

test("wireGestureConfirm · se cablea sobre los botones de confirmación explícita ya existentes (A6-5), sin sustituirlos", () => {
  assert.match(app, /qs\("receiptCaptureConfirm"\)\?\.addEventListener\("click", confirmReceiptCapture\);\s*\n\s*qs\("receiptCaptureCancel"\)\?\.addEventListener\("click", cancelReceiptCapture\);\s*\n\s*wireGestureConfirm\(qs\("receiptCaptureConfirm"\)\);/);
  assert.match(app, /qs\("confirmMovementInbox"\)\?\.addEventListener\("click", applyStagedMovementImport\);\s*\n\s*wireGestureConfirm\(qs\("confirmMovementInbox"\)\);/);
});

test(".gesture-confirm/.is-holding tienen relleno visual en styles.css", () => {
  const css = read("styles.css");
  assert.match(css, /\.gesture-confirm\s*\{/);
  assert.match(css, /\.gesture-confirm\.is-holding::after/);
});
