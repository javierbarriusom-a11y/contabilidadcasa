(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceRecoveryGuide = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function timestamp(value) {
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function shortFingerprint(value) {
    return String(value || "sin huella").slice(0, 12);
  }

  function assessRecovery(input = {}) {
    if (!input.pendingRecord) return { required: false, kind: "none", options: [] };
    const localAt = input.pendingRecord.savedAt || input.pendingRecord.payload?.updatedAt || "";
    const remoteAt = input.remoteUpdatedAt || "";
    const conflict = input.remoteHeadKnown === false || input.pendingRecord.baseHeadSnapshotId !== input.remoteHeadSnapshotId;
    return {
      required: true,
      kind: conflict ? "conflict" : "pending",
      localAt,
      remoteAt,
      localIsNewer: timestamp(localAt) > timestamp(remoteAt),
      localFingerprint: shortFingerprint(input.localFingerprint),
      remoteFingerprint: shortFingerprint(input.remoteFingerprint),
      options: conflict
        ? ["continue-local", "download-local", "use-remote"]
        : ["resume-sync", "continue-local", "download-local", "use-remote"],
    };
  }

  return { assessRecovery, shortFingerprint };
});
