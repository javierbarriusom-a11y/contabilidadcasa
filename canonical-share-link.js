(function attachCanonicalShareLink(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalShareLink = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalShareLinkFactory() {
  "use strict";

  // A19-1: enlace de solo lectura, redactado y caducable — comparte una vista concreta (plan de
  // deuda o forecast a 6 meses) con un asesor externo sin usuario propio ni acceso a movimientos
  // individuales. Motor puro, sin red ni DOM: genera el token (nunca se guarda en crudo, solo su
  // hash — mismo criterio que finance_household_invitations.token_hash en Supabase), redacta
  // exactamente los campos que declara cada vista (nunca "todo menos lo prohibido"), y decide
  // expiración/revocación. La lectura/escritura remota vive en app.js.

  const SCHEMA_ID = "finance-a19-1-share-link/v1";
  const VIEW_TYPES = Object.freeze(["debt-plan", "forecast-6m"]);
  const TOKEN_BYTES = 32;
  const DEFAULT_TTL_DAYS = 14;
  const MAX_TTL_DAYS = 90;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }
  function text(value) {
    return String(value ?? "").trim();
  }

  function cryptoImpl() {
    const impl = (typeof globalThis !== "undefined" && globalThis.crypto) || (typeof window !== "undefined" && window.crypto);
    if (!impl || typeof impl.getRandomValues !== "function" || !impl.subtle) {
      throw new Error("No hay Web Crypto disponible para generar el enlace.");
    }
    return impl;
  }

  function toBase64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function toHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // Token aleatorio de 32 bytes (256 bits) — nunca se persiste en crudo, solo su hash (hashToken).
  // Vive únicamente en la URL que se entrega al asesor externo.
  function generateShareToken() {
    const impl = cryptoImpl();
    const bytes = new Uint8Array(TOKEN_BYTES);
    impl.getRandomValues(bytes);
    return toBase64Url(bytes);
  }

  // SHA-256 del token en hexadecimal — lo único que se guarda en finance_share_links.token_hash.
  // Un volcado de esa tabla nunca expone un token utilizable.
  async function hashToken(token) {
    const impl = cryptoImpl();
    const encoded = new TextEncoder().encode(text(token));
    const digest = await impl.subtle.digest("SHA-256", encoded);
    return toHex(new Uint8Array(digest));
  }

  // Fuera de rango (<=0 o corrupto) cae al valor por defecto; por encima del máximo se recorta —
  // nunca un enlace "para siempre" por un dato de entrada inválido.
  function normalizeTtlDays(days) {
    const value = Math.round(number(days, DEFAULT_TTL_DAYS));
    if (value <= 0) return DEFAULT_TTL_DAYS;
    return Math.min(MAX_TTL_DAYS, value);
  }

  function expiresAtFrom(ttlDays, now = new Date()) {
    const days = normalizeTtlDays(ttlDays);
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  // Dato ausente o corrupto en expiresAt se trata como caducado — nunca como "vivo por defecto".
  // Falla cerrado, no abierto: mismo criterio de seguridad que el resto del contrato, invertido
  // (aquí "no sé" significa "deniega", no "aún no calculado").
  function isExpired(expiresAt, revokedAt, now = new Date()) {
    if (revokedAt) return true;
    const expiry = new Date(text(expiresAt)).getTime();
    if (!Number.isFinite(expiry)) return true;
    return now.getTime() >= expiry;
  }

  // Cada vista declara explícitamente los campos que comparte — nunca "todo menos lo prohibido".
  // Sin número de cuenta, sin notas, sin movimientos individuales: solo lo que el asesor necesita
  // para leer el plan.
  function redactDebtPlanView(rows = []) {
    return {
      schemaId: `${SCHEMA_ID}/debt-plan-v1`,
      generatedAt: new Date().toISOString(),
      debts: (Array.isArray(rows) ? rows : []).map((row) => ({
        entity: text(row.entity) || "Entidad",
        type: text(row.type) || "Deuda",
        currentPrincipal: round2(row.currentPrincipal),
        currentPayment: round2(row.currentPayment),
      })),
    };
  }

  function redactForecastView(series = [], months = 6) {
    return {
      schemaId: `${SCHEMA_ID}/forecast-6m-v1`,
      generatedAt: new Date().toISOString(),
      months: (Array.isArray(series) ? series : []).slice(0, months).map((month) => ({
        monthKey: text(month.monthKey),
        label: text(month.label || month.monthKey),
        income: round2(month.totals?.income),
        outflows: round2(month.totals?.outflowsBeforeSaving),
        saving: round2(month.totals?.saving),
        closingLiquidity: round2(month.totals?.closingLiquidity),
      })),
    };
  }

  function buildSharePayload(viewType, data) {
    if (viewType === "debt-plan") return redactDebtPlanView(data);
    if (viewType === "forecast-6m") return redactForecastView(data);
    throw new Error(`Tipo de vista de A19-1 desconocido: ${viewType}`);
  }

  return {
    SCHEMA_ID,
    VIEW_TYPES,
    DEFAULT_TTL_DAYS,
    MAX_TTL_DAYS,
    generateShareToken,
    hashToken,
    normalizeTtlDays,
    expiresAtFrom,
    isExpired,
    redactDebtPlanView,
    redactForecastView,
    buildSharePayload,
  };
});
