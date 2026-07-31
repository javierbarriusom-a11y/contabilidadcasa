(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceDurableOutbox = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DB_NAME = "finanzas-casa-durable-outbox";
  const STORE_NAME = "pending-writes";
  const MARKER_PREFIX = "financeDashboard:durableOutbox:v1:";

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function markerKey(id) {
    return `${MARKER_PREFIX}${id}`;
  }

  function createDurableOutbox(options = {}) {
    const indexedDb = options.indexedDB;
    const storage = options.storage;
    const dbName = options.dbName || DB_NAME;
    let databasePromise = null;

    function readFallback(id) {
      try {
        const raw = storage?.getItem(markerKey(id));
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }

    function writeFallback(record) {
      try {
        storage?.setItem(markerKey(record.id), JSON.stringify({
          id: record.id,
          userId: record.userId,
          sourceKey: record.sourceKey,
          revision: record.revision,
          baseHeadSnapshotId: record.baseHeadSnapshotId ?? null,
          savedAt: record.savedAt,
          pending: true,
        }));
      } catch {
        // IndexedDB remains the primary durable store.
      }
    }

    function removeFallback(id) {
      try {
        storage?.removeItem(markerKey(id));
      } catch {
        // A stale marker is harmless: get() validates the IndexedDB record.
      }
    }

    function openDatabase() {
      if (!indexedDb?.open) return Promise.resolve(null);
      if (databasePromise) return databasePromise;
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDb.open(dbName, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("No se pudo abrir la bandeja persistente."));
      }).catch(() => null);
      return databasePromise;
    }

    async function transact(mode, action) {
      const database = await openDatabase();
      if (!database) return null;
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let result;
        try {
          result = action(store);
        } catch (error) {
          reject(error);
          return;
        }
        transaction.oncomplete = () => resolve(result?.result ?? null);
        transaction.onerror = () => reject(transaction.error || new Error("Falló la bandeja persistente."));
        transaction.onabort = () => reject(transaction.error || new Error("Se canceló la bandeja persistente."));
      });
    }

    async function put(input) {
      const record = clone({ ...input, pending: true, savedAt: input.savedAt || new Date().toISOString() });
      if (!record.id) throw new TypeError("La operación pendiente necesita un identificador.");
      writeFallback(record);
      const stored = await transact("readwrite", (store) => store.put(record)).catch(() => null);
      return clone(stored || record);
    }

    async function get(id) {
      const stored = await transact("readonly", (store) => store.get(id)).catch(() => null);
      if (stored) return clone(stored);
      const marker = readFallback(id);
      return marker?.pending ? marker : null;
    }

    async function remove(id, completedRevision = Infinity) {
      const database = await openDatabase();
      if (database) {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction(STORE_NAME, "readwrite");
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(id);
          request.onsuccess = () => {
            const current = request.result;
            if (!current || Number(current.revision || 0) <= Number(completedRevision)) store.delete(id);
          };
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error || new Error("No se pudo completar la operación pendiente."));
        }).catch(() => null);
      }
      const marker = readFallback(id);
      if (!marker || Number(marker.revision || 0) <= Number(completedRevision)) removeFallback(id);
    }

    return { put, get, remove };
  }

  return { createDurableOutbox, MARKER_PREFIX };
});
