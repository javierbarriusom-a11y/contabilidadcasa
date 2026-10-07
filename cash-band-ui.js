// WP-16 (NPV-01, docs/WP16_DISENO.md): la tarjeta «Banda de caja a 30 días» de Plan › Previsión. El cálculo vive en canonical-cash-band.js (puro);
// el dibujo, el recorrido y «Ver como tabla», en chart-kit.js (WP-28). Aquí solo se juntan: se leen los saldos y los movimientos fechados del plan,
// se simula y se pinta.
//
// Script de pantalla, como valoracion-ui.js: se carga antes de app.js y comparte su ámbito global (qs, money, state, canonicalDailyEngineRuns…).
// No hay llamadas al DOM ni escuchas al cargarse: app.js llama a `renderCashBand` al pintar Previsión.

let cashBandRenderedKey = ""; // lo último pintado: repintar igual borraría la lectura y el foco del gráfico que se está recorriendo

// Los movimientos fechados del plan (los que ya reparte el motor diario) y los saldos declarados. Devuelve null si no hay nada que simular.
function cashBandInput(today) {
  const dailyRows = canonicalDailyEngineRuns?.active?.rows;
  if (!Array.isArray(dailyRows) || !state) return null;
  const balances = accountBalancesFromState();
  const asOf = /^\d{4}-\d{2}-\d{2}/.test(String(state.balanceDate || "")) ? String(state.balanceDate).slice(0, 10) : today;
  const staleDays = Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${asOf}T12:00:00Z`)) / 86400000));
  const events = dailyRows.flatMap((row) => row.events || []).map((event) => ({
    id: event.id, label: event.label, kind: event.kind, amount: event.amount, date: event.date, confidence: event.confidence,
    // Súper, gasolina…: llegan repartidos en el mes, no en un día. Con fecha estimada se reparten por igual (sin azar).
    spread: event.confidence === "estimated" && event.field === "variableOperationalSpend",
  }));
  return {
    asOf, staleDays, today, events,
    openingTotal: balances.total,
    floor: window.FinanceCanonicalHomeMargin?.normalizeFloor(state.liquidityFloor) ?? null,
    horizonDays: Math.min(120, staleDays + 30), // la banda parte de los saldos declarados y llega hasta 30 días desde hoy
    declared: state.balanceMode === "manual",
  };
}

function cashBandAriaLabel(engine, result, shown, input) {
  const kit = globalThis.ChartKit;
  const trend = kit.trendSentence({
    subject: "La liquidez central (P50)", points: shown.map((day) => ({ label: engine.dateLabel(day.date), value: day.p50 })),
    format: (value) => money(value, true), threshold: input.floor === null ? null : { value: input.floor, label: "el suelo" },
  });
  return `Banda de caja de los próximos 30 días, del ${engine.dateLabel(shown[0].date)} al ${engine.dateLabel(shown[shown.length - 1].date)}. ${trend} ${result.sentence}`;
}

const CASH_BAND_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Siete marcas de fecha repartidas por igual (cada 5 días con 30 días de horizonte): coinciden con su posición en el dibujo.
function cashBandTicks(shown) {
  const picks = Array.from({ length: 7 }, (_, at) => Math.round((at * (shown.length - 1)) / 6)).filter((index, at, all) => all.indexOf(index) === at);
  return `<div class="ck-eje">${picks.map((index) => { const [, month, day] = shown[index].date.split("-"); return `<span>${Number(day)} ${CASH_BAND_MONTHS[Number(month) - 1]}</span>`; }).join("")}</div>`;
}

function cashBandHtml(engine, result, input) {
  const kit = globalThis.ChartKit;
  const shown = result.days.filter((day) => day.date >= input.today);
  if (!shown.length) return `<p class="e19-kpi-note">Sin días que mostrar.</p>`;
  const plot = kit.bandPlotHtml({
    points: shown.map((day) => ({ low: day.p10, center: day.p50, high: day.p90 })),
    ariaLabel: cashBandAriaLabel(engine, result, shown, input), threshold: input.floor === null ? null : { value: input.floor },
  });
  const readings = shown.map((day) => `${engine.dateLabel(day.date)}: P10 ${money(day.p10, true)} · P50 ${money(day.p50, true)} · P90 ${money(day.p90, true)} · según el plan ${money(day.central, true)}.`);
  const notes = [
    `Solo recoge la incertidumbre de las <strong>fechas</strong> (${result.trajectories} trayectorias), no la de los importes: la banda no cubre un gasto que salga más caro de lo previsto.`,
    result.dateCertainty.estimatedShare === null ? "" : `${Math.round(result.dateCertainty.estimatedShare * 100)} % de lo que se mueve (por importe) tiene fecha estimada; el resto, fecha cierta${result.dateCertainty.spreadAmount > 0 ? ` y ${money(result.dateCertainty.spreadAmount, true)} de gasto variable repartido por los días del mes` : ""}.`,
    input.staleDays > 0 ? `Los saldos son del ${escapeHtml(engine.dateLabel(input.asOf))} (hace ${input.staleDays} día${input.staleDays === 1 ? "" : "s"}): la banda parte de ahí y se ensancha por los días sin declarar.` : "",
    input.declared ? "" : "Los saldos son <strong>calculados</strong>, no declarados: declara tus saldos reales (Registrar) para que la banda parta de la realidad.",
    input.floor === null ? "" : `El suelo de liquidez es ${money(input.floor, true)} (Ajustes).`,
  ].filter(Boolean).map((text) => `<p class="e19-kpi-note">${text}</p>`).join("");
  const legend = `<ul class="ck-leyenda"><li>Mediana (P50)</li><li class="ck-leyenda-banda">Banda P10-P90</li>${input.floor === null ? "" : `<li class="ck-leyenda-umbral">Suelo (${escapeHtml(money(input.floor, true))})</li>`}</ul>`;
  return `<p class="ck-frase">${escapeHtml(result.sentence)}</p>${kit.figureHtml({
    id: "cash-band", plotHtml: plot.svg, plotClass: "ck-plot-media", belowPlotHtml: cashBandTicks(shown) + legend, readings, xs: plot.xs,
    sliderLabel: "Recorrer la banda de caja día a día", noteHtml: notes,
    table: { caption: "Liquidez de los próximos 30 días: banda P10-P90 y trayectoria del plan", columns: ["Día", "P10", "P50", "P90", "Según el plan"], rows: shown.map((day) => [engine.dateLabel(day.date), money(day.p10, true), money(day.p50, true), money(day.p90, true), money(day.central, true)]) },
  })}`;
}

function cashBandSummary(engine, result) {
  if (result.status !== "ok") return "Banda de caja a 30 días";
  if (result.crossing.probability === null) return "Banda de caja a 30 días · sin suelo declarado";
  if (result.crossing.probability === 0) return "Banda de caja a 30 días · no baja del suelo";
  return `Banda de caja a 30 días · baja del suelo en ${Math.round(result.crossing.probability * 100)} % de las trayectorias`;
}

function renderCashBand(engine) {
  const box = qs("previsionBanda");
  if (!box || !engine || !globalThis.ChartKit) return;
  try {
    const today = isoLocalDate(new Date());
    const input = cashBandInput(today);
    if (!input || !input.events.length) {
      const empty = "<p class=\"e19-kpi-note\">Todavía no hay movimientos fechados en el plan para simular.</p>";
      if (cashBandRenderedKey !== "empty") { box.innerHTML = empty; cashBandRenderedKey = "empty"; }
      return;
    }
    const key = [input.asOf, input.today, input.openingTotal, input.floor, input.declared, input.events.map((event) => `${event.date}${event.kind}${event.amount}${event.confidence}${event.spread ? "s" : ""}`).join(",")].join("|");
    if (key === cashBandRenderedKey && box.firstElementChild) return;
    const result = engine.simulate(input);
    if (qs("previsionBandaResumen")) qs("previsionBandaResumen").textContent = cashBandSummary(engine, result);
    box.innerHTML = result.status === "ok"
      ? cashBandHtml(engine, result, input)
      : `<p class="e19-kpi-note">No se puede calcular: falta ${escapeHtml(result.missing.join(" y "))}.</p>`;
    cashBandRenderedKey = key;
  } catch (error) {
    console.error(`renderCashBand: ${error.message}`);
  }
}
