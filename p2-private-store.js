(function (root) {
  const DB_NAME = "finanzas-casa-private-v1";
  const STORE = "agreementDocuments";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return reject(new Error("IndexedDB no está disponible"));
      const request = root.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacén privado"));
    });
  }

  async function run(mode, action) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        const request = action(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  const bytes = (value) => new Uint8Array(value);
  const b64 = (value) => {
    const data = bytes(value); let binary = "";
    for (let offset = 0; offset < data.length; offset += 32768) binary += String.fromCharCode(...data.subarray(offset, offset + 32768));
    return btoa(binary);
  };
  const fromB64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

  async function encryptionKey(passphrase, salt, usage) {
    if (!root.crypto?.subtle) throw new Error("Este navegador no admite cifrado privado");
    if (String(passphrase || "").length < 12) throw new Error("La clave privada debe tener al menos 12 caracteres");
    const material = await root.crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return root.crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, usage);
  }

  async function encrypt(file, passphrase) {
    const salt = root.crypto.getRandomValues(new Uint8Array(16));
    const iv = root.crypto.getRandomValues(new Uint8Array(12));
    const key = await encryptionKey(passphrase, salt, ["encrypt"]);
    const cipher = await root.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await file.arrayBuffer());
    return new Blob([JSON.stringify({ version: 1, salt: b64(salt), iv: b64(iv), mimeType: file.type, data: b64(cipher) })], { type: "application/vnd.finanzas-casa.encrypted+json" });
  }

  async function decrypt(encryptedBlob, passphrase) {
    const envelope = JSON.parse(await encryptedBlob.text());
    if (envelope.version !== 1) throw new Error("Formato cifrado no compatible");
    const salt = fromB64(envelope.salt); const iv = fromB64(envelope.iv);
    const key = await encryptionKey(passphrase, salt, ["decrypt"]);
    try {
      const plain = await root.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromB64(envelope.data));
      return new Blob([plain], { type: envelope.mimeType || "application/octet-stream" });
    } catch { throw new Error("Clave privada incorrecta o archivo alterado"); }
  }

  function put(id, file) {
    return run("readwrite", (store) => store.put({ id, file, savedAt: new Date().toISOString() }));
  }

  function get(id) {
    return run("readonly", (store) => store.get(id)).then((record) => record?.file || null);
  }

  // ARQ-6 (sesión 244, decisión del hogar): las fotos de ticket/factura (T11/A17-3) solo vivían en
  // este dispositivo, sin ninguna opción de nube — a diferencia del expediente privado de deuda, que
  // ya cifra y sincroniza. El hogar eligió pedir esta clave una sola vez por sesión (nunca se
  // persiste, ni aquí ni en ningún almacén) en vez de en cada foto. Mismo diálogo nativo
  // (`<dialog method="dialog">`) y patrón de promesa-en-el-evento-close que ya usa
  // requestOperationConfirmation() en app.js.
  let sessionKey = null;
  let sessionDeclined = false;

  function requestSessionKey() {
    if (sessionKey) return Promise.resolve(sessionKey);
    if (sessionDeclined) return Promise.resolve(null);
    const dialog = root.document?.getElementById("p2SessionCloudKeyDialog");
    const keyInput = root.document?.getElementById("p2SessionCloudKeyInput");
    if (!dialog || !keyInput) return Promise.resolve(null);
    keyInput.value = "";
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => {
        if (dialog.returnValue === "activate" && keyInput.value.trim().length >= 12) {
          sessionKey = keyInput.value.trim();
          resolve(sessionKey);
        } else {
          sessionDeclined = true;
          resolve(null);
        }
      }, { once: true });
      dialog.showModal();
      keyInput.focus();
    });
  }

  // Único punto de guardado de una foto de ticket/factura, compartido por T11 (adjuntar a un
  // movimiento ya existente) y A17-3 (captura por cámara). Con clave de sesión activa, cifra y sube
  // a la nube igual que ya hace el expediente privado con los documentos de deuda; si no hay clave,
  // o si la subida falla, se queda en este dispositivo — nunca se pierde el adjunto por un fallo de
  // red o por no tener sesión iniciada en Supabase.
  async function saveAttachment(id, file) {
    const cloudKey = await requestSessionKey();
    const createdAt = new Date().toISOString();
    if (cloudKey) {
      try {
        const encrypted = await encrypt(file, cloudKey);
        const remotePath = await root.FinanceP2Bridge.uploadPrivateAttachment(id, encrypted);
        return { storage: "cloud", remotePath, mimeType: file.type, createdAt };
      } catch {
        // Sin conexión o sin sesión en Supabase: se queda en el dispositivo, no se pierde la foto.
      }
    }
    await put(id, file);
    return { storage: "local", mimeType: file.type, createdAt };
  }

  // Recupera un adjunto para verlo: primero el dispositivo, y si no está y se subió cifrado a la
  // nube, pide la clave de sesión (si todavía no la tiene) y lo descifra. `link` es la entrada de
  // `receiptAttachments`/`documents` con `inboxItemId`/`storage`/`remotePath`.
  async function getOrDecrypt(link) {
    let blob = await get(link.inboxItemId);
    if (!blob && link.storage === "cloud" && link.remotePath) {
      const cloudKey = await requestSessionKey();
      if (!cloudKey) return null;
      const encrypted = await root.FinanceP2Bridge.downloadPrivateAttachment(link.remotePath);
      blob = await decrypt(encrypted, cloudKey);
    }
    return blob;
  }

  root.P2PrivateStore = {
    put,
    get,
    remove(id) {
      return run("readwrite", (store) => store.delete(id));
    },
    encrypt,
    decrypt,
    requestSessionKey,
    saveAttachment,
    getOrDecrypt,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
