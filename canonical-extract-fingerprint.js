/**
 * canonical-extract-fingerprint.js
 *
 * DEC-13 (décima auditoría, docs/PROPUESTA_DECIMA_AUDITORIA_2026-11-16.md §4.3; 18/11/2026, «sigue con más cosas que puedas
 * avanzar sin el hogar»). La huella anónima del extracto: cómo son los movimientos que siguen sin partida, sin decir de
 * quién ni cuánto. El hogar la copia y la pega en la conversación; así se pueden validar con su banco las señales de
 * Clasificar (CLA-01/02/03, DAT-05) y diseñar la que falta (DEC-14, importe típico y día del mes) sin que sus datos salgan.
 *
 * Qué se queda de cada concepto: solo las palabras que dicen CÓMO se pagó (BIZUM, RECIBO, COMPRA TARJ…, una lista cerrada).
 * Todo lo demás se sustituye por su forma:
 *
 *   · las palabras («MERCADONA», «JUAN», «MADRID») → «palabras» (una o varias seguidas, sin decir cuántas);
 *   · los meses («OCTUBRE») → «mes»;
 *   · los números → «número de N cifras» (una referencia de 10 cifras no es una fecha de 4);
 *   · lo que mezcla letras y cifras («ES12AB», «XXXX1234») → «código»;
 *   · las letras sueltas, los enlaces («DE», «DEL», «EN») y la puntuación desaparecen.
 *
 * De cada forma se dice cuántos movimientos tiene, en cuántas cuentas, cuántos conceptos distintos (si cambia cada mes, una
 * regla del concepto exacto no sirve) y cuántos emisores la usan: de ellos, cuántos se repiten en varios meses y cuántos con
 * importe estable (± 10 %, la tolerancia de las reglas por palabras) y el mismo día del mes (± 3 días, la de DEC-14).
 * NUNCA salen importes, fechas, nombres, comercios, referencias, cuentas ni el detalle del movimiento, y lo dice la propia
 * huella. Motor puro: sin DOM, red ni almacenamiento (la pantalla, en views/huella-extracto.js).
 */
(function attachCanonicalExtractFingerprint(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalExtractFingerprint = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalExtractFingerprintFactory() {
  "use strict";

  const SCHEMA_ID = "finance-extract-fingerprint/v1";
  const MAX_FORMS = 40;
  const DAY_TOLERANCE = 3;
  const AMOUNT_TOLERANCE = 0.1;
  const MIN_EUROS = 1;

  // Las únicas palabras que se copian tal cual: dicen cómo se pagó o qué tipo de apunte es, nunca a quién. Lista cerrada a
  // propósito (no se deducen de los datos): ningún comercio, persona, ciudad ni entidad.
  const VOCABULARY = new Set(
    (
      "compra compras pago pagos tarj tarjeta credito debito visa mastercard recibo recibos domiciliacion domiciliado " +
      "transferencia transferencias transf trf traspaso bizum enviado enviada recibido recibida cargo adeudo abono tpv " +
      "cuota comision comisiones operacion ref referencia num numero concepto favor orden ordenante beneficiario inmediata " +
      "sepa nomina devolucion reintegro cajero efectivo liquidacion intereses impuesto impuestos periodica emitida emitido " +
      "contactless internacional financiacion aplazado aplazada prestamo amortizacion"
    ).split(" "),
  );
  // Los enlaces no se dicen (desaparecen): «MARIA DEL MAR» y «MARIA» dan la misma forma.
  const LINKS = new Set("de del la las el los a al en por para con y e o".split(" "));
  // Solo los meses enteros o cortados al final, no las abreviaturas de tres letras («MAR», «MAY» también son nombres).
  const MONTHS = new Set(
    "enero febrero marzo abril mayo junio julio agosto septiembre setiembre septiemb sept octubre noviembre noviembr diciembre diciembr".split(" "),
  );
  const KIND_TEXT = { expense: "gasto", income: "ingreso" };

  function fold(text) {
    return String(text ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  function tokens(text) {
    return fold(text).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  }

  function placeholder(token) {
    if (/^[0-9]+$/.test(token)) return `número de ${token.length} ${token.length === 1 ? "cifra" : "cifras"}`;
    if (/[0-9]/.test(token)) return "código";
    if (token.length === 1 || LINKS.has(token)) return "";
    if (VOCABULARY.has(token)) return token.toUpperCase();
    if (MONTHS.has(token)) return "mes";
    return "palabras";
  }

  /**
   * La forma de un texto: las palabras del vocabulario en mayúsculas y lo demás por su forma, separado por « · ». Las
   * palabras seguidas se dicen una vez («palabras»), para que la forma no cuente las letras de un nombre.
   * @param {string} text
   * @returns {string}
   */
  function shapeOf(text) {
    const out = [];
    tokens(text).forEach((token) => {
      const piece = placeholder(token);
      if (!piece || (piece === "palabras" && out.at(-1) === "palabras")) return;
      out.push(piece);
    });
    return out.join(" · ") || "(vacío)";
  }

  // El emisor (para contar cuántos usan una forma, nunca para decirlo): la primera palabra del concepto que no es del
  // vocabulario ni un mes ni lleva cifras, como el comercio de Clasificar; si no hay, el detalle; si tampoco, ninguno.
  function issuerOf(row) {
    const find = (text) => tokens(text).find((token) => token.length >= 3 && /^[a-z]+$/.test(token) && !VOCABULARY.has(token) && !MONTHS.has(token)) || "";
    return find(row?.movement) || find(row?.details) || "";
  }

  function monthOf(row) {
    const text = String(row?.date || row?.month || "");
    return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : "";
  }

  function dayOf(row) {
    const match = /^\d{4}-\d{2}-(\d{2})/.exec(String(row?.date || ""));
    return match ? Number(match[1]) : null;
  }

  function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Cómo se comporta un emisor: en cuántos meses sale, si su importe es estable y si cae el mismo día del mes.
  function issuerProfile(rows) {
    const months = new Set(rows.map(monthOf).filter(Boolean));
    const amounts = rows.map((row) => Math.abs(Number(row.amount))).filter((value) => value > 0);
    const typical = median(amounts);
    const steady = typical !== null && amounts.every((value) => Math.abs(value - typical) <= Math.max(typical * AMOUNT_TOLERANCE, MIN_EUROS));
    const days = rows.map(dayOf).filter((value) => value !== null);
    const middle = median(days);
    const sameDay = middle !== null && days.length === rows.length && days.every((value) => Math.abs(value - middle) <= DAY_TOLERANCE);
    return { recurring: months.size >= 2, steady, sameDay };
  }

  function plural(count, one, many) {
    return `${count} ${count === 1 ? one : many}`;
  }

  /**
   * @param {{
   *   rows?: Array<Record<string, any>>,             los movimientos que piden partida (con importe, sin regla, sin ser traspaso)
   *   totals?: { movimientos?: number, sinPartida?: number, traspasos?: number },
   *   cobertura?: string,                            la frase del % de gasto con partida de Clasificar, si la hay
   *   mes?: string,                                  «noviembre de 2026»: el mes en que se genera, nunca el día
   *   accountOf?: (row: Record<string, any>) => string
   * }} input
   */
  function build(input = {}) {
    const rows = (input.rows || []).filter((row) => row && Number(row.amount));
    const accountOf = typeof input.accountOf === "function" ? input.accountOf : (row) => String(row?.account || row?.accountId || "");
    const forms = new Map();
    rows.forEach((row) => {
      const kind = Number(row.amount) < 0 ? "expense" : "income";
      const movement = shapeOf(row.movement);
      const details = String(row.details || "").trim() ? shapeOf(row.details) : "";
      const shape = details && details !== movement ? `${movement} / detalle: ${details}` : movement;
      const key = `${kind}|${shape}`;
      const form = forms.get(key) || { kind, shape, rows: [], accounts: new Set(), concepts: new Set(), issuers: new Map() };
      form.rows.push(row);
      form.accounts.add(accountOf(row) || "sin-cuenta");
      form.concepts.add(fold(row.movement).replace(/\s+/g, " ").trim());
      const issuer = issuerOf(row) || `sin-nombre-${form.issuers.size}`;
      form.issuers.set(issuer, [...(form.issuers.get(issuer) || []), row]);
      forms.set(key, form);
    });

    const list = [...forms.values()]
      .map((form) => {
        const profiles = [...form.issuers.values()].map(issuerProfile);
        const recurring = profiles.filter((item) => item.recurring);
        return {
          kind: form.kind,
          shape: form.shape,
          count: form.rows.length,
          accounts: form.accounts.size,
          concepts: form.concepts.size,
          issuers: form.issuers.size,
          recurring: recurring.length,
          steadyAndSameDay: recurring.filter((item) => item.steady && item.sameDay).length,
          steadyOnly: recurring.filter((item) => item.steady && !item.sameDay).length,
        };
      })
      .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind) || a.shape.localeCompare(b.shape));

    const shown = list.slice(0, MAX_FORMS);
    const totals = input.totals || {};
    const lines = [
      `Huella anónima del extracto · Finanzas Casa${input.mes ? ` · ${input.mes}` : ""}`,
      `Sin importes, fechas, nombres, comercios, referencias, cuentas ni el detalle de cada movimiento: solo la forma de cada concepto.`,
    ];
    const resumen = [];
    if (Number.isFinite(totals.movimientos)) resumen.push(`${plural(totals.movimientos, "movimiento", "movimientos")} con importe`);
    resumen.push(`${plural(rows.length, "sin partida", "sin partida")} en ${plural(list.length, "forma", "formas")}`);
    if (Number.isFinite(totals.traspasos) && totals.traspasos > 0) resumen.push(`${plural(totals.traspasos, "traspaso", "traspasos")} entre cuentas propias (no piden partida)`);
    lines.push(resumen.join(" · "));
    if (input.cobertura) lines.push(String(input.cobertura));
    if (!rows.length) {
      lines.push("No queda ningún movimiento sin partida: no hay nada que enseñar.");
    } else {
      lines.push("");
      shown.forEach((form, index) => {
        const partes = [
          KIND_TEXT[form.kind],
          plural(form.count, "movimiento", "movimientos"),
          plural(form.accounts, "cuenta", "cuentas"),
          plural(form.concepts, "concepto distinto", "conceptos distintos"),
          plural(form.issuers, "emisor", "emisores"),
        ];
        if (form.recurring) {
          const detalle = [];
          if (form.steadyAndSameDay) detalle.push(`${form.steadyAndSameDay} con importe y día fijos`);
          if (form.steadyOnly) detalle.push(`${form.steadyOnly} con importe fijo y otro día`);
          partes.push(`${form.recurring} en varios meses${detalle.length ? ` (${detalle.join(", ")})` : ""}`);
        }
        lines.push(`${index + 1}. ${form.shape} — ${partes.join(" · ")}`);
      });
      if (list.length > shown.length) lines.push(`… y ${plural(list.length - shown.length, "forma más", "formas más")} con menos movimientos.`);
    }
    return { schema: SCHEMA_ID, forms: list, text: lines.join("\n") };
  }

  return { SCHEMA_ID, VOCABULARY, MAX_FORMS, shapeOf, issuerOf, build };
});
