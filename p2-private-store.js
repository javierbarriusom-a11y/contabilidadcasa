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

  root.P2PrivateStore = {
    put(id, file) {
      return run("readwrite", (store) => store.put({ id, file, savedAt: new Date().toISOString() }));
    },
    get(id) {
      return run("readonly", (store) => store.get(id)).then((record) => record?.file || null);
    },
    remove(id) {
      return run("readwrite", (store) => store.delete(id));
    },
    encrypt,
    decrypt,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
