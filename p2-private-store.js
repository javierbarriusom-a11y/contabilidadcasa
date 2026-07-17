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

  root.P2PrivateStore = {
    put(id, file) {
      return run("readwrite", (store) => store.put({ id, file, savedAt: new Date().toISOString() }));
    },
    get(id) {
      return run("readonly", (store) => store.get(id));
    },
    remove(id) {
      return run("readwrite", (store) => store.delete(id));
    },
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
