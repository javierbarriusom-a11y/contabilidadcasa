(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceRemoteSaveQueue = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createRemoteSaveQueue(options = {}) {
    if (typeof options.write !== "function") throw new TypeError("write debe ser una función");
    const capture = typeof options.capture === "function" ? options.capture : () => undefined;
    const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
    const schedule = typeof options.schedule === "function" ? options.schedule : setTimeout;
    const cancel = typeof options.cancel === "function" ? options.cancel : clearTimeout;
    const shouldRetry = typeof options.shouldRetry === "function"
      ? options.shouldRetry
      : (error) => error?.retryable !== false;
    const retryDelays = Array.isArray(options.retryDelays) ? options.retryDelays : [1500, 4000, 10000];
    let requestedRevision = 0;
    let persistedRevision = 0;
    let inFlightRevision = 0;
    let retryAttempt = 0;
    let retryTimer = null;
    let retryScheduled = false;
    let running = false;
    let activeDrain = null;
    let lastError = null;
    let lastPersistedAt = null;

    function snapshot() {
      return {
        requestedRevision,
        persistedRevision,
        inFlightRevision,
        pending: requestedRevision > persistedRevision,
        running,
        retryAttempt,
        retryScheduled,
        lastError,
        lastPersistedAt,
      };
    }

    function notify() {
      onChange(snapshot());
    }

    function clearRetry() {
      if (retryTimer !== null) cancel(retryTimer);
      retryTimer = null;
    }

    async function runDrain() {
      clearRetry();
      running = true;
      inFlightRevision = requestedRevision;
      const revision = inFlightRevision;
      const payload = capture();
      notify();
      try {
        await options.write(payload, revision);
        persistedRevision = Math.max(persistedRevision, revision);
        retryAttempt = 0;
        retryScheduled = false;
        lastError = null;
        lastPersistedAt = new Date().toISOString();
      } catch (error) {
        lastError = error;
        retryAttempt += 1;
        retryScheduled = Boolean(shouldRetry(error, retryAttempt));
      } finally {
        running = false;
        inFlightRevision = 0;
        notify();
      }
      if (lastError) {
        if (retryScheduled) {
          const delay = retryDelays[Math.min(retryAttempt - 1, retryDelays.length - 1)];
          if (Number.isFinite(delay) && delay >= 0) retryTimer = schedule(() => drain(), delay);
        }
      } else if (requestedRevision > persistedRevision) {
        return drain();
      }
      return snapshot();
    }

    function drain() {
      if (running) return activeDrain;
      if (requestedRevision <= persistedRevision) return Promise.resolve(snapshot());
      activeDrain = runDrain().finally(() => {
        activeDrain = null;
      });
      return activeDrain;
    }

    function request(options = {}) {
      requestedRevision += 1;
      lastError = null;
      retryScheduled = false;
      clearRetry();
      notify();
      if (options.immediate) void drain();
      return requestedRevision;
    }

    function flush() {
      return drain();
    }

    function reset() {
      clearRetry();
      requestedRevision = 0;
      persistedRevision = 0;
      inFlightRevision = 0;
      retryAttempt = 0;
      retryScheduled = false;
      running = false;
      activeDrain = null;
      lastError = null;
      lastPersistedAt = null;
      notify();
    }

    function hydrate(state = {}) {
      if (running) throw new Error("No se puede recuperar la cola durante una escritura.");
      clearRetry();
      requestedRevision = Math.max(0, Number(state.requestedRevision || 0));
      persistedRevision = Math.min(requestedRevision, Math.max(0, Number(state.persistedRevision || 0)));
      inFlightRevision = 0;
      retryAttempt = Math.max(0, Number(state.retryAttempt || 0));
      retryScheduled = false;
      lastError = state.lastError || null;
      lastPersistedAt = state.lastPersistedAt || null;
      notify();
      return snapshot();
    }

    function acknowledge(at = new Date().toISOString()) {
      if (running) throw new Error("No se puede confirmar una revisión durante una escritura.");
      clearRetry();
      requestedRevision += 1;
      persistedRevision = requestedRevision;
      inFlightRevision = 0;
      retryAttempt = 0;
      retryScheduled = false;
      lastError = null;
      lastPersistedAt = at;
      notify();
      return snapshot();
    }

    return { request, flush, snapshot, reset, hydrate, acknowledge };
  }

  return { createRemoteSaveQueue };
});
