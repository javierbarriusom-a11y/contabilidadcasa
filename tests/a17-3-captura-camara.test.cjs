const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const buildSite = read("tools/build-public-site.mjs");

// A17-3 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 6 — "captura por cámara, OCR de tickets/facturas").
// La extracción pura (importe/fecha/comercio) tiene su propia suite en
// canonical-receipt-ocr.test.cjs; esta cubre la orquestación en app.js: que un ticket reutiliza
// tal cual el mismo camino de aplicación que un extracto bancario (pendingE11bApply/
// applyStagedMovementImport), que el motor de OCR se carga bajo demanda (nunca en la carga normal
// de la app) y que el adjunto cifrado (A3-5, P2PrivateStore) se enlaza por transactionIdentity().

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

test("canonical-receipt-ocr.js se carga antes que app.js y está en la whitelist del sitio público", () => {
  const scriptPos = html.indexOf('canonical-receipt-ocr.js?v=');
  const appPos = html.indexOf('app.js?v=');
  assert.ok(scriptPos >= 0, "No se encontró el <script> de canonical-receipt-ocr.js en index.html");
  assert.ok(scriptPos < appPos, "canonical-receipt-ocr.js debe cargarse antes que app.js (define window.FinanceCanonicalReceiptOcr)");
  assert.match(buildSite, /"canonical-receipt-ocr\.js"/);
});

test("el input de cámara existe con accept=image y capture=environment, sin pedir un segundo formulario", () => {
  assert.match(html, /<input id="receiptCameraInput" type="file" accept="image\/\*" capture="environment" \/>/);
});

test("el motor de OCR (Tesseract.js) nunca se referencia como <script> — solo se carga bajo demanda", () => {
  assert.doesNotMatch(html, /<script[^>]*tesseract/i);
  assert.match(app, /RECEIPT_OCR_CDN_URL/);
  assert.match(app, /function loadReceiptOcrEngine/);
});

test("confirmReceiptCapture reutiliza applyStagedMovementImport en vez de una segunda puerta de escritura", () => {
  const body = extractFunction(app, "confirmReceiptCapture");
  assert.match(body, /pendingE11bApply\s*=\s*\{\s*imported,\s*inboxItem\s*\}/);
  assert.match(body, /applyStagedMovementImport\(\)/);
  assert.match(body, /addE11bInboxItem\(\{\s*source:\s*"receipt-photo"/);
  assert.match(body, /amount:\s*-Math\.abs\(round2\(amount\)\)/);
  assert.match(body, /transactionIdentity\(row\)/);
});

function sandbox({ amount, date, merchant, storeAvailable = true } = {}) {
  const calls = { addE11bInboxItem: null, applyStagedMovementImport: 0, storePut: null, saveLocalSnapshot: 0, logs: [] };
  const inputs = {
    receiptCaptureAmount: { value: amount },
    receiptCaptureDate: { value: date },
    receiptCaptureMerchant: { value: merchant },
    receiptCameraReview: { innerHTML: "" },
    receiptCameraFileName: { textContent: "" },
  };
  const context = {
    qs: (id) => inputs[id] || null,
    parseAmount: (value) => (value === "" || value === undefined || value === null ? null : Number(value)),
    round2: (value) => Math.round(Number(value || 0) * 100) / 100,
    showImportLog: (title, body, tone, targetId) => { calls.logs.push({ title, tone, targetId }); },
    addE11bInboxItem: (input) => { calls.addE11bInboxItem = input; return { id: "inbox-a173-1" }; },
    applyStagedMovementImport: () => { calls.applyStagedMovementImport += 1; },
    P2PrivateStore: storeAvailable ? { put: (id, file) => { calls.storePut = { id, file }; return Promise.resolve(); } } : undefined,
    transactionIdentity: (row) => `${row.date}|${row.movement}|${row.amount}`,
    receiptAttachments: {},
    receiptCaptureDraft: { file: { type: "image/jpeg", name: "ticket.jpg" }, previewUrl: "blob:fake" },
    saveLocalSnapshot: () => { calls.saveLocalSnapshot += 1; },
    pendingE11bApply: null,
    URL: { revokeObjectURL: () => {} },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction(app, "confirmReceiptCapture"), context);
  vm.runInContext("confirmReceiptCapture();", context);
  return { context, calls };
}

test("confirmReceiptCapture · sin importe/fecha/comercio no incorpora nada y avisa", () => {
  const { calls } = sandbox({ amount: "", date: "", merchant: "" });
  assert.equal(calls.addE11bInboxItem, null);
  assert.equal(calls.applyStagedMovementImport, 0);
  assert.ok(calls.logs.some((log) => log.tone === "danger"));
});

test("confirmReceiptCapture · con los tres campos, registra un movimiento negativo y reutiliza el import de extracto", () => {
  const { context, calls } = sandbox({ amount: "23.45", date: "2026-09-03", merchant: "Mercadona" });
  assert.equal(calls.addE11bInboxItem.source, "receipt-photo");
  assert.equal(calls.addE11bInboxItem.sourceLabel, "Mercadona");
  const row = calls.addE11bInboxItem.rows[0];
  assert.equal(row.amount, -23.45);
  assert.equal(row.source, "receipt-photo");
  assert.equal(row.movement, "Mercadona");
  assert.equal(calls.applyStagedMovementImport, 1);
  assert.equal(context.pendingE11bApply.imported[0].movement, "Mercadona");
  assert.equal(context.receiptCaptureDraft, null, "el borrador se limpia tras confirmar");
});

test("confirmReceiptCapture · un importe negativo o cero se rechaza igual que uno vacío", () => {
  const { calls } = sandbox({ amount: "0", date: "2026-09-03", merchant: "Mercadona" });
  assert.equal(calls.addE11bInboxItem, null);
  assert.ok(calls.logs.some((log) => log.tone === "danger"));
});

test("renderMovementDetailDialog muestra el botón de ver ticket solo cuando hay adjunto enlazado", () => {
  const body = extractFunction(app, "renderMovementDetailDialog");
  assert.match(body, /receiptAttachments\[transactionIdentity\(row\)\]/);
  assert.match(body, /movementDetailViewReceipt/);
});

test("receiptAttachments se persiste en el snapshot local (guardado, carga y valor por defecto tras error)", () => {
  assert.match(app, /receiptAttachments,\s*\n\s*e11b:/);
  assert.match(app, /storageSet\(storageKey\("receiptAttachments"\), JSON\.stringify\(receiptAttachments\)\)/);
  assert.match(app, /receiptAttachments: JSON\.parse\(storageGet\(storageKey\("receiptAttachments"\), "\{\}"\)\)/);
});
