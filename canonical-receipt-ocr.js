(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceCanonicalReceiptOcr = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // A17-3: motor puro de extracción de importe/fecha/comercio a partir del texto ya reconocido por
  // el OCR (Tesseract.js, cargado bajo demanda en app.js — este módulo nunca toca una imagen ni un
  // navegador, solo texto, para poder probarse entero en Node con tickets fijos). La categoría no se
  // extrae aquí: se deja que la reclasifique el mismo motor de reglas por concepto que ya usa
  // cualquier movimiento importado (mappingForMovement), en vez de inventar un segundo clasificador.
  // Cada campo declara `calculable: false` si no hay certeza suficiente — nunca un importe, fecha o
  // comercio adivinado que pueda colarse sin que el hogar lo revise.

  const MONEY_TOKEN_RE = /\d{1,3}(?:[.,]\d{3})*[.,]\d{2}/g;
  const DATE_TOKEN_RE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g;
  const TOTAL_KEYWORDS = [/total\s*a\s*pagar/i, /importe\s*total/i, /^total\b/i, /\btotal\b/i, /\bimporte\b/i, /a\s*pagar/i];
  const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function parseMoneyToken(token) {
    const cleaned = String(token || "").trim();
    if (!cleaned) return null;
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decimalIndex = Math.max(lastComma, lastDot);
    if (decimalIndex < 0) return null;
    const intPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decPart = cleaned.slice(decimalIndex + 1);
    if (!/^\d+$/.test(intPart) || !/^\d{2}$/.test(decPart)) return null;
    const value = Number(`${intPart}.${decPart}`);
    return Number.isFinite(value) ? value : null;
  }

  function moneyTokensIn(line) {
    return (String(line || "").match(MONEY_TOKEN_RE) || [])
      .map((token) => ({ token, value: parseMoneyToken(token) }))
      .filter((item) => item.value !== null);
  }

  function extractAmount(lines, fullText) {
    for (const pattern of TOTAL_KEYWORDS) {
      const candidateLines = lines.filter((line) => pattern.test(line));
      const candidates = candidateLines.flatMap(moneyTokensIn);
      if (candidates.length) {
        const best = candidates.reduce((max, item) => (item.value > max.value ? item : max));
        return { value: best.value, calculable: true, raw: best.token };
      }
    }
    const anywhere = moneyTokensIn(fullText);
    if (anywhere.length) {
      const best = anywhere.reduce((max, item) => (item.value > max.value ? item : max));
      return { value: best.value, calculable: true, raw: best.token };
    }
    return { value: null, calculable: false, raw: "" };
  }

  function isValidCalendarDate(day, month, year) {
    if (month < 1 || month > 12 || day < 1) return false;
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const maxDay = month === 2 && isLeap ? 29 : DAYS_IN_MONTH[month - 1];
    return day <= maxDay;
  }

  function extractDate(fullText, { today } = {}) {
    const matches = [...String(fullText || "").matchAll(DATE_TOKEN_RE)];
    for (const match of matches) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      let year = Number(match[3]);
      if (year < 100) year += 2000;
      if (!isValidCalendarDate(day, month, year)) continue;
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (today && iso > today) continue; // un ticket nunca trae una fecha futura respecto a hoy
      return { value: iso, calculable: true };
    }
    return { value: null, calculable: false };
  }

  function looksLikeMerchantLine(line) {
    const trimmed = String(line || "").trim();
    if (trimmed.length < 3) return false;
    if (!/[a-zA-ZÀ-ÿ]{3,}/.test(trimmed)) return false;
    const withoutMoney = trimmed.replace(MONEY_TOKEN_RE, "").trim();
    if (!withoutMoney) return false;
    if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(trimmed)) return false;
    return true;
  }

  function extractMerchant(lines) {
    const candidate = lines.slice(0, 6).find(looksLikeMerchantLine);
    return candidate ? { value: candidate.trim(), calculable: true } : { value: null, calculable: false };
  }

  function extractReceiptFields(text, options = {}) {
    const fullText = String(text || "");
    const lines = fullText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return {
      amount: extractAmount(lines, fullText),
      date: extractDate(fullText, options),
      merchant: extractMerchant(lines),
    };
  }

  return { extractReceiptFields, parseMoneyToken };
});
