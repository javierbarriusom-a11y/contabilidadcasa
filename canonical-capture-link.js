(function attachCanonicalCaptureLink(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalCaptureLink = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalCaptureLink() {
  "use strict";

  // WP-25 (CAP-02 + plantilla de CAP-01, docs/PLAN_DESARROLLO_DEFINITIVO.md): contrato de los enlaces de
  // registro prellenado. `…/#registrar?importe=23,40&concepto=Mercadona&fecha=hoy&cuenta=Caixa&origen=applepay`
  // abre la ventana «Registrar gasto» (FLU-2) con los campos rellenos. NUNCA guarda solo: un enlace lo puede
  // fabricar cualquiera, así que el gasto no existe hasta que el hogar pulsa «Registrar».
  //
  // Aquí solo se lee y se valida (puro, sin DOM): qué trae el enlace, qué no se entiende y por qué. Lo que no
  // es válido no se descarta en silencio: vuelve como un error con el texto recibido, para enseñarlo en la
  // ventana. El concepto y la cuenta se rechazan si traen «<» o «>» (un enlace no mete HTML en la app).
  //
  // Alias: `comercio` = concepto y `tarjeta` = cuenta, que es lo que entrega el Atajo «Transacción» de iOS.

  const ROUTE = "registrar";
  const MAX_LINK_LENGTH = 2000;
  const MAX_LABEL = 80;
  const MAX_ACCOUNT = 40;
  const MAX_AMOUNT = 100000;
  const MAX_AGE_DAYS = 366;
  const ALIASES = { importe: ["importe", "amount"], concepto: ["concepto", "comercio", "concept"], fecha: ["fecha", "date"], cuenta: ["cuenta", "tarjeta"], origen: ["origen", "source"] };
  const ORIGINS = { applepay: "Apple Pay", atajo: "Atajo de iOS", banco: "aviso del banco", enlace: "enlace" };
  const KNOWN_KEYS = new Set(Object.values(ALIASES).flat());

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function dateFromIso(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    return match ? realDate(Number(match[1]), Number(match[2]), Number(match[3])) : null;
  }

  // Fecha de calendario real (nada de 31/02) a mediodía local.
  function realDate(year, month, day) {
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  // Lo recibido, recortado, para citarlo en un error sin pintar un texto enorme.
  function quote(value) {
    const text = String(value).replace(/\s+/g, " ").trim();
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
  }

  // Sin caracteres de control y con los espacios juntados: lo que llega de un Atajo puede traer saltos de línea.
  function cleanText(value) {
    return String(value).replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
  }

  // «#registrar?importe=…» → { route, query }; sin «?», o con otra ruta, no es un enlace de registro.
  function splitHash(hash) {
    const text = String(hash || "").replace(/^#/, "");
    const index = text.indexOf("?");
    if (index < 0) return null;
    return { route: text.slice(0, index), query: text.slice(index + 1) };
  }

  function isCaptureLink(hash) {
    return splitHash(hash)?.route === ROUTE;
  }

  /** ISO, «hoy», «ayer», dd/mm/aaaa, d/m/aa o dd-mm-aaaa; también una ISO con hora (se queda el día). */
  function parseDate(raw, today) {
    const text = cleanText(raw).toLowerCase();
    const base = dateFromIso(today);
    if (!base) return null;
    if (text === "hoy" || text === "today") return isoDate(base);
    if (text === "ayer" || text === "yesterday") return isoDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, 12));
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[t ][\d:.]+(?:z|[+-]\d{2}:?\d{2})?)?$/.exec(text);
    if (iso) {
      const date = realDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
      return date ? isoDate(date) : null;
    }
    const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
    if (local) {
      const year = local[3].length === 2 ? 2000 + Number(local[3]) : Number(local[3]);
      const date = realDate(year, Number(local[2]), Number(local[1]));
      return date ? isoDate(date) : null;
    }
    return null;
  }

  function daysBetween(fromIso, toIso) {
    return Math.round((dateFromIso(toIso).getTime() - dateFromIso(fromIso).getTime()) / 86400000);
  }

  /**
   * Lee el enlace. `null` si el `#` no es un enlace de registro. Si lo es, devuelve lo entendido en `fields`
   * y lo que no en `errors` (por campo, con el texto recibido) y `warnings`; `ok` es «sin errores».
   * @param {string} hash
   * @param {{ today: string, parseAmount: (value: string) => number | null }} options
   */
  function parseCaptureLink(hash, { today, parseAmount }) {
    const parts = splitHash(hash);
    if (!parts || parts.route !== ROUTE) return null;
    const fields = { amount: null, label: "", date: "", dateDefaulted: false, account: "", origin: "enlace", originLabel: ORIGINS.enlace };
    /** @type {Record<string, string>} */
    const errors = {};
    const warnings = [];
    if (parts.query.length > MAX_LINK_LENGTH) {
      errors.enlace = `enlace demasiado largo (${parts.query.length} caracteres; máximo ${MAX_LINK_LENGTH}): no se ha leído`;
      return { ok: false, fields, errors, warnings, ignored: [] };
    }
    const params = new URLSearchParams(parts.query);
    const read = (name) => {
      const key = ALIASES[name].find((alias) => params.has(alias));
      return key === undefined ? null : String(params.get(key));
    };
    const ignored = [...new Set([...params.keys()].filter((key) => !KNOWN_KEYS.has(key)))];

    const rawAmount = read("importe");
    if (rawAmount !== null && cleanText(rawAmount)) {
      const amount = parseAmount(cleanText(rawAmount));
      if (amount === null) errors.importe = `importe no reconocido: «${quote(rawAmount)}»`;
      else if (amount <= 0) errors.importe = `el importe tiene que ser mayor que cero (llegó «${quote(rawAmount)}»): los reembolsos no se registran con un enlace`;
      else if (amount > MAX_AMOUNT) errors.importe = `importe fuera de rango: «${quote(rawAmount)}» (máximo ${MAX_AMOUNT.toLocaleString("es-ES")} €)`;
      else fields.amount = Math.round(amount * 100) / 100;
    }

    const rawLabel = read("concepto");
    if (rawLabel !== null) {
      const label = cleanText(rawLabel);
      if (/[<>]/.test(label)) errors.concepto = `concepto con caracteres no permitidos («<» o «>»): «${quote(label)}»`;
      else if (label.length > MAX_LABEL) {
        fields.label = label.slice(0, MAX_LABEL).trim();
        warnings.push(`concepto recortado a ${MAX_LABEL} caracteres`);
      } else fields.label = label;
    }

    const rawDate = read("fecha");
    if (rawDate === null || !cleanText(rawDate)) {
      fields.date = parseDate("hoy", today) || "";
      fields.dateDefaulted = true;
    } else {
      const date = parseDate(rawDate, today);
      if (!date) errors.fecha = `fecha no reconocida: «${quote(rawDate)}» (vale 2026-10-04, 04/10/2026, hoy o ayer)`;
      else if (daysBetween(today, date) > 0) errors.fecha = `fecha futura: «${quote(rawDate)}»`;
      else if (daysBetween(date, today) > MAX_AGE_DAYS) errors.fecha = `fecha de hace más de un año: «${quote(rawDate)}»`;
      else fields.date = date;
    }

    const rawAccount = read("cuenta");
    if (rawAccount !== null) {
      const account = cleanText(rawAccount);
      if (/[<>]/.test(account)) errors.cuenta = `cuenta con caracteres no permitidos («<» o «>»): «${quote(account)}»`;
      else fields.account = account.slice(0, MAX_ACCOUNT).trim();
    }

    // Un origen desconocido no es un error: queda como «enlace».
    const origin = cleanText(read("origen") || "").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ORIGINS, origin)) {
      fields.origin = origin;
      fields.originLabel = ORIGINS[origin];
    }
    return { ok: Object.keys(errors).length === 0, fields, errors, warnings, ignored };
  }

  // El enlace que construye el Atajo, para la guía y las pruebas. Solo pone lo que trae valor.
  /** @param {string} base @param {{ importe?: string|number, concepto?: string, fecha?: string, cuenta?: string, origen?: string }} values */
  function buildCaptureLink(base, values) {
    const query = Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join("&");
    return `${String(base).replace(/#.*$/, "")}#${ROUTE}${query ? `?${query}` : ""}`;
  }

  function shortDate(iso) {
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }

  /**
   * Lo que la ventana enseña: de dónde viene, en qué mes cae y qué hay que revisar. Texto plano (va con
   * textContent). `monthLabel` es el mes en el que se registrará; `sameMonth`, si es el de la fecha del enlace.
   * @param {{ fields: any, errors: Record<string, string>, warnings: string[] }} result
   * @param {{ monthLabel?: string, sameMonth?: boolean }} [context]
   */
  function noteText(result, { monthLabel = "", sameMonth = true } = {}) {
    const { fields, errors, warnings } = result;
    const origin = [fields.origin === "enlace" ? "" : fields.originLabel, fields.account ? `cuenta ${fields.account}` : "", fields.date ? `${fields.dateDefaulted ? "hoy, " : ""}${shortDate(fields.date)}` : ""].filter(Boolean).join(" · ");
    const lines = [`Rellenado desde un enlace${origin ? ` (${origin})` : ""}. Revisa los datos: no se guarda nada hasta que pulses «Registrar».`];
    // La ventana FLU-2 crea una partida nueva con su real: un gasto que ya está dentro de otra partida contaría dos veces.
    lines.push("Crea una partida nueva: si el gasto ya está previsto en otra (súper, gasolina), anótalo en Registrar › Reales del mes o contará dos veces.");
    if (fields.date && monthLabel && !sameMonth) lines.push(`La fecha del enlace no cae en un mes abierto del plan: se registrará en ${monthLabel}.`);
    if (Object.keys(errors).length) lines.push(`Del enlace no se ha usado: ${Object.values(errors).join("; ")}.`);
    if (warnings.length) lines.push(`Aviso: ${warnings.join("; ")}.`);
    return lines.join(" ");
  }

  function monthKeyOf(iso) {
    return String(iso || "").slice(0, 7);
  }

  return { ROUTE, MAX_LABEL, MAX_AMOUNT, ORIGINS, splitHash, isCaptureLink, parseDate, parseCaptureLink, buildCaptureLink, noteText, monthKeyOf };
});
