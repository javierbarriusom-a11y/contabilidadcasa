const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

// ARQ-6 (sesión 244, decisión del hogar): las fotos de ticket/factura (T11/A17-3) solo vivían en
// este dispositivo, sin ninguna opción de nube, a diferencia del expediente privado de deuda que ya
// cifra y sincroniza. El hogar eligió pedir la clave privada una sola vez por sesión (nunca se
// persiste) en vez de en cada foto — esta suite cubre esa pieza nueva de p2-private-store.js:
// requestSessionKey() (el diálogo), saveAttachment() (nube con caída a local) y getOrDecrypt()
// (dispositivo primero, nube si hace falta).

const source = fs.readFileSync(path.join(__dirname, "..", "p2-private-store.js"), "utf8");

function createFakeIndexedDb() {
  const store = new Map();
  function request(work) {
    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      try { req.result = work(); req.onsuccess?.(); }
      catch (error) { req.error = error; req.onerror?.(); }
    });
    return req;
  }
  return {
    open() {
      const openRequest = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        openRequest.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          transaction: () => ({
            objectStore: () => ({
              put: (record) => request(() => { store.set(record.id, record); }),
              get: (id) => request(() => store.get(id)),
              delete: (id) => request(() => { store.delete(id); }),
            }),
          }),
          close() {},
        };
        openRequest.onsuccess?.();
      });
      return openRequest;
    },
  };
}

function createFakeDialog() {
  const dialog = {
    returnValue: "",
    _closeHandler: null,
    addEventListener(event, handler, options) {
      if (event === "close") this._closeHandler = handler;
    },
    showModal() {},
    // El formulario `method="dialog"` fija returnValue al valor del botón pulsado, antes de que el
    // navegador dispare `close` — este helper simula exactamente eso.
    userSubmits(value) {
      this.returnValue = value;
      this._closeHandler?.();
    },
  };
  return dialog;
}

function buildContext({ dialog, keyInputValue = "" } = {}) {
  const uploads = [];
  const downloads = [];
  const keyInput = { value: keyInputValue, focus() {} };
  const elements = { p2SessionCloudKeyDialog: dialog, p2SessionCloudKeyInput: keyInput };
  const context = {
    document: { getElementById: (id) => elements[id] || null },
    crypto: webcrypto,
    indexedDB: createFakeIndexedDb(),
    FinanceP2Bridge: {
      uploadPrivateAttachment: async (id, blob) => { uploads.push({ id, blob }); return `remote/${id}.encrypted`; },
      downloadPrivateAttachment: async (path) => { downloads.push(path); return context.__lastUpload; },
    },
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    Blob,
    TextEncoder,
    setTimeout,
    queueMicrotask,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, keyInput, uploads, downloads };
}

function fakeFile(text, type = "text/plain") {
  return new Blob([text], { type });
}

test("requestSessionKey · activar con una clave válida la resuelve y la recuerda para la próxima llamada", async () => {
  const dialog = createFakeDialog();
  const { context, keyInput } = buildContext({ dialog });
  const promise = context.P2PrivateStore.requestSessionKey();
  keyInput.value = "una-clave-larga-de-verdad";
  dialog.userSubmits("activate");
  assert.equal(await promise, "una-clave-larga-de-verdad");
  // Segunda llamada: no vuelve a abrir el diálogo, resuelve la misma clave ya guardada en memoria.
  dialog.showModal = () => { throw new Error("no debería reabrir el diálogo"); };
  assert.equal(await context.P2PrivateStore.requestSessionKey(), "una-clave-larga-de-verdad");
});

test("requestSessionKey · declinar resuelve null y no vuelve a preguntar en la misma sesión", async () => {
  const dialog = createFakeDialog();
  const { context } = buildContext({ dialog });
  const promise = context.P2PrivateStore.requestSessionKey();
  dialog.userSubmits("decline");
  assert.equal(await promise, null);
  dialog.showModal = () => { throw new Error("no debería reabrir el diálogo"); };
  assert.equal(await context.P2PrivateStore.requestSessionKey(), null);
});

test("requestSessionKey · una clave de menos de 12 caracteres cuenta como declinar", async () => {
  const dialog = createFakeDialog();
  const { context, keyInput } = buildContext({ dialog });
  const promise = context.P2PrivateStore.requestSessionKey();
  keyInput.value = "corta";
  dialog.userSubmits("activate");
  assert.equal(await promise, null);
});

test("requestSessionKey · sin el diálogo en la página, resuelve null sin fallar", async () => {
  const { context } = buildContext({ dialog: null });
  assert.equal(await context.P2PrivateStore.requestSessionKey(), null);
});

test("saveAttachment · con clave de sesión, cifra y sube a la nube en vez de guardar local", async () => {
  const dialog = createFakeDialog();
  const { context, keyInput, uploads } = buildContext({ dialog });
  const promise = context.P2PrivateStore.requestSessionKey();
  keyInput.value = "una-clave-larga-de-verdad";
  dialog.userSubmits("activate");
  await promise;
  const meta = await context.P2PrivateStore.saveAttachment("receipt-1", fakeFile("foto"));
  assert.equal(meta.storage, "cloud");
  assert.equal(meta.remotePath, "remote/receipt-1.encrypted");
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].id, "receipt-1");
});

test("saveAttachment · si la subida a la nube falla, cae a guardar en el dispositivo sin perder la foto", async () => {
  const dialog = createFakeDialog();
  const { context, keyInput } = buildContext({ dialog });
  context.FinanceP2Bridge.uploadPrivateAttachment = async () => { throw new Error("sin conexión"); };
  const promise = context.P2PrivateStore.requestSessionKey();
  keyInput.value = "una-clave-larga-de-verdad";
  dialog.userSubmits("activate");
  await promise;
  const meta = await context.P2PrivateStore.saveAttachment("receipt-2", fakeFile("foto"));
  assert.equal(meta.storage, "local");
  const stored = await context.P2PrivateStore.get("receipt-2");
  assert.ok(stored, "el fichero debería seguir accesible en el dispositivo");
});

test("saveAttachment · sin clave de sesión (declinada), guarda local directamente", async () => {
  const dialog = createFakeDialog();
  const { context } = buildContext({ dialog });
  const promise = context.P2PrivateStore.requestSessionKey();
  dialog.userSubmits("decline");
  await promise;
  const meta = await context.P2PrivateStore.saveAttachment("receipt-3", fakeFile("foto"));
  assert.equal(meta.storage, "local");
});

test("getOrDecrypt · si está en el dispositivo, no toca la nube", async () => {
  const { context } = buildContext({ dialog: null });
  await context.P2PrivateStore.put("receipt-4", fakeFile("foto"));
  const blob = await context.P2PrivateStore.getOrDecrypt({ inboxItemId: "receipt-4", storage: "local" });
  assert.ok(blob);
});

test("getOrDecrypt · si no está en el dispositivo y se subió a la nube, pide la clave y descifra", async () => {
  const dialog = createFakeDialog();
  const { context, keyInput, downloads } = buildContext({ dialog });
  const uploadPromise = context.P2PrivateStore.requestSessionKey();
  keyInput.value = "una-clave-larga-de-verdad";
  dialog.userSubmits("activate");
  await uploadPromise;
  const encrypted = await context.P2PrivateStore.encrypt(fakeFile("contenido real del ticket"), "una-clave-larga-de-verdad");
  context.__lastUpload = encrypted;
  const blob = await context.P2PrivateStore.getOrDecrypt({ inboxItemId: "no-existe-local", storage: "cloud", remotePath: "remote/x.encrypted" });
  assert.ok(blob);
  assert.equal(await blob.text(), "contenido real del ticket");
  assert.deepEqual(downloads, ["remote/x.encrypted"]);
});

test("getOrDecrypt · sin adjunto local ni entrada de nube, resuelve null", async () => {
  const { context } = buildContext({ dialog: null });
  const blob = await context.P2PrivateStore.getOrDecrypt({ inboxItemId: "no-existe", storage: "local" });
  assert.equal(blob, null);
});
