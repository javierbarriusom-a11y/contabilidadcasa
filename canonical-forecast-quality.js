(function attachCanonicalForecastQuality(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecastQuality = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalForecastQuality() {
  "use strict";

  // WP-10 (NPV-08, docs/PLAN_IMPLEMENTACION_2026-10-03.md): medidor de calidad de los datos de la previsión.
  // Tres barras en la cabecera de Plan › Previsión (nunca en Hoy), cada una con lo que hay que hacer para
  // subirla. Convierte el «100 % de fechas estimadas» en un indicador que se ve y se gestiona, y frena la
  // precisión falsa. Ponderado por importe: una partida de 900 € pesa más que una de 9 €.
  //
  // - Fechas: del gasto previsto en el horizonte, cuánto cae en un día CONOCIDO (declarado por el hogar,
  //   observado en un movimiento real o por regla de la casa) frente al estimado (día 8). Objetivo del plan
  //   (M-RESOL): ≥ 70 % con fecha conocida.
  // - Importes: del gasto previsto del mes en curso, cuánto ya tiene real (o se canceló).
  // - Ingresos: de los ingresos esperados del mes en curso, cuántos están confirmados.
  // Sin filas, «sin datos», nunca 0 %. Solo recuentos y porcentajes: el medidor no enseña importes.

  const DATE_TARGET_PCT = 70;
  const KNOWN_CONFIDENCES = Object.freeze(["declared", "observed", "rule"]);

  function weight(value) {
    const number = Math.abs(Number(value));
    return Number.isFinite(number) ? number : 0;
  }

  function pct(part, total) {
    return total > 0 ? Math.round((part / total) * 100) : null;
  }

  /** @param {Array<{ amount?: number, confidence?: string }>} events */
  function dateQuality(events = []) {
    const totals = { declared: 0, observed: 0, rule: 0, estimated: 0 };
    let count = 0;
    events.forEach((event) => {
      const amount = weight(event?.amount);
      if (!amount) return;
      count += 1;
      const confidence = KNOWN_CONFIDENCES.includes(event.confidence) ? event.confidence : "estimated";
      totals[confidence] += amount;
    });
    const total = totals.declared + totals.observed + totals.rule + totals.estimated;
    const known = totals.declared + totals.observed + totals.rule;
    const value = pct(known, total);
    return {
      value,
      count,
      parts: total ? Object.fromEntries(Object.entries(totals).map(([key, amount]) => [key, pct(amount, total)])) : null,
      meets: value === null ? null : value >= DATE_TARGET_PCT,
      target: DATE_TARGET_PCT,
    };
  }

  // Partidas del mes en curso: «realized» (con real) y «cancelled» (no ocurrirá) ya son conocidas.
  /** @param {Array<{ planned?: number, status?: string }>} rows */
  function settledQuality(rows = []) {
    let total = 0;
    let settled = 0;
    let count = 0;
    let settledCount = 0;
    rows.forEach((row) => {
      const amount = weight(row?.planned);
      if (!amount) return;
      count += 1;
      total += amount;
      if (row.status === "realized" || row.status === "cancelled") {
        settled += amount;
        settledCount += 1;
      }
    });
    return { value: pct(settled, total), count, settledCount };
  }

  /** @param {{ dates?: Array<any>, amounts?: Array<any>, income?: Array<any>, monthKey?: string }} input */
  function measure({ dates = [], amounts = [], income = [], monthKey = "" } = {}) {
    return { monthKey, dates: dateQuality(dates), amounts: settledQuality(amounts), income: settledQuality(income) };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function monthName(monthKey) {
    const month = Number(String(monthKey).slice(5, 7));
    return month >= 1 && month <= 12 ? MONTHS[month - 1] : "este mes";
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function card({ title, value, pill, detail, action, href }) {
    const shown = value === null ? "—" : `${value} %`;
    const meter = value === null ? "" : `<meter min="0" max="100" low="${DATE_TARGET_PCT}" high="99" optimum="100" value="${value}" aria-hidden="true"></meter>`;
    const link = href ? ` <a href="${escapeHtml(href)}">${escapeHtml(action)}</a>` : ` ${escapeHtml(action)}`;
    return `<li><div class="panel-uso-cabecera"><strong>${escapeHtml(title)}</strong><span class="panel-uso-valor">${shown}</span></div>${meter}<p><span class="status-pill ${pill.tone}">${escapeHtml(pill.text)}</span> ${escapeHtml(detail)}</p><p class="e19-kpi-note">Para subirla:${link}</p></li>`;
  }

  function renderHtml(quality) {
    const { dates, amounts, income } = quality;
    const month = monthName(quality.monthKey);
    const datePill = dates.meets === null ? { tone: "neutral", text: "Sin datos" } : dates.meets ? { tone: "good", text: "Cumple" } : { tone: "warn", text: "Por debajo" };
    const dateDetail = dates.value === null
      ? "No hay gasto previsto en este horizonte."
      : `Objetivo: ≥ ${dates.target} % del gasto con día conocido. ${capitalize([
        ["indicado por ti", dates.parts.declared], ["por regla de la casa", dates.parts.rule], ["visto en movimientos", dates.parts.observed],
      ].filter(([, part]) => part > 0).map(([label, part]) => `${label} ${part} %`).concat(`estimado (día 8) ${dates.parts.estimated} %`).join(" · "))}.`;
    const settledText = (part, noun, empty) => (part.value === null ? empty : `${part.settledCount} de ${part.count} ${noun} de ${month}.`);
    return `<ul class="panel-uso-lista prevision-calidad">${[
      card({ title: "Fechas de los gastos", value: dates.value, pill: datePill, detail: dateDetail, action: "indicar el día de cargo de cada partida (llegará a Plan › Partidas). Los meses con extracto importado también suben solos.", href: "" }),
      card({ title: `Gastos de ${month} con real`, value: amounts.value, pill: { tone: "neutral", text: "Sin objetivo" }, detail: settledText(amounts, "partidas", "No hay gasto previsto este mes."), action: "anotar los reales del mes en Registrar.", href: "#registrar" }),
      card({ title: `Ingresos de ${month} confirmados`, value: income.value, pill: { tone: "neutral", text: "Sin objetivo" }, detail: settledText(income, "ingresos", "No hay ingresos esperados este mes."), action: "confirmar los cobros del mes en Registrar.", href: "#registrar" }),
    ].join("")}</ul>`;
  }

  // Una línea para el resumen plegado: lo que más pesa en la fiabilidad de las fechas de la previsión.
  function summaryText(quality) {
    const { dates } = quality;
    if (dates.value === null) return "Calidad de los datos: sin gasto previsto en este horizonte";
    return `Calidad de los datos: ${dates.value} % del gasto con día conocido (objetivo ≥ ${dates.target} %)`;
  }

  return { DATE_TARGET_PCT, dateQuality, settledQuality, measure, renderHtml, summaryText };
});
