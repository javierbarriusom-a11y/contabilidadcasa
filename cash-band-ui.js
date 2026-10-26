// WP-16 (NPV-01, docs/WP16_DISENO.md): la tarjeta «Banda de caja a 30 días» de Plan › Previsión. El cálculo vive en canonical-cash-band.js (puro);
// el dibujo, el recorrido y «Ver como tabla», en chart-kit.js (WP-28). Aquí solo se juntan: se leen los saldos y los movimientos fechados del plan,
// se simula y se pinta.
//
// Script de pantalla, como valoracion-ui.js: se carga antes de app.js y comparte su ámbito global (qs, money, state, canonicalDailyEngineRuns…).
// No hay llamadas al DOM ni escuchas al cargarse: app.js llama a `renderCashBand` al pintar Previsión.

let cashBandRenderedKey = ""; // lo último pintado: repintar igual borraría la lectura y el foco del gráfico que se está recorriendo
let cashBandLastInput = null; // XPR-06: las entradas de la banda pintada, para desglosar el día elegido con las mismas

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
  // XPR-06, con su interruptor encendido: «Qué mueve el …» abre el desglose del día elegido en el recorrido (de entrada, hoy).
  const dayButton = cashBandDayOn()
    ? `<p class="banda-dia-abrir" data-banda-dia-fechas="${escapeHtml(JSON.stringify(shown.map((day) => day.date)))}"><button type="button" class="e19-btn e19-btn-secondary" data-banda-dia="${escapeHtml(shown[0].date)}">${escapeHtml(cashBandDayButtonText(engine, shown[0].date))}</button></p>`
    : "";
  return `<p class="ck-frase">${escapeHtml(result.sentence)}</p>${kit.figureHtml({
    id: "cash-band", plotHtml: plot.svg, plotClass: "ck-plot-media", belowPlotHtml: cashBandTicks(shown) + legend + dayButton, readings, xs: plot.xs,
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
    const key = [input.asOf, input.today, input.openingTotal, input.floor, input.declared, cashBandDayOn(), input.events.map((event) => `${event.date}${event.kind}${event.amount}${event.confidence}${event.spread ? "s" : ""}`).join(",")].join("|");
    if (key === cashBandRenderedKey && box.firstElementChild) return;
    const result = engine.simulate(input);
    cashBandLastInput = input;
    cashBandDayBindOnce();
    if (qs("previsionBandaResumen")) qs("previsionBandaResumen").textContent = cashBandSummary(engine, result);
    box.innerHTML = result.status === "ok"
      ? cashBandHtml(engine, result, input)
      : `<p class="e19-kpi-note">No se puede calcular: falta ${escapeHtml(result.missing.join(" y "))}.</p>`;
    cashBandRenderedKey = key;
  } catch (error) {
    console.error(`renderCashBand: ${error.message}`);
  }
}

// ---- XPR-06 · «Toca un día y mira qué lo mueve» (ficha XPR-06 de docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md) ----
// Nace apagada en Funciones en prueba (XGO-03): sin encenderla, la banda se pinta como siempre. Encendida, debajo del gráfico va
// «Qué mueve el …», que sigue al día elegido en el recorrido y abre una hoja con el saldo al empezar el día según el plan, lo que entra
// y sale ese día con su certeza, lo que toca del gasto repartido por el mes y el saldo al acabar. El cálculo es `dayBreakdown` de
// canonical-cash-band.js (la columna «Según el plan» de la tabla, desglosada). Los de fecha estimada dicen entre qué días los mueve la
// banda y llevan «¿Sabes el día?» a su partida en Días de cargo (WP-08). Corregir el importe desde aquí queda fuera de esta entrega.

const CASH_BAND_CERTEZA = { observed: "fecha cierta", rule: "fecha por regla", declared: "día indicado por ti", estimated: "fecha estimada" };
let cashBandDayBound = false;

function cashBandDayOn() {
  return globalThis.FinanceFuncionesEnPrueba?.encendida?.("banda-dia") === true;
}

function cashBandDayButtonText(engine, date) {
  return `Qué mueve el ${engine.dateLabel(date)}`;
}

function cashBandSigned(value) {
  return value > 0 ? `+${money(value, true)}` : money(value, true);
}

function cashBandDayHtml(engine, day) {
  const items = day.items.map((item) => {
    const certeza = CASH_BAND_CERTEZA[item.confidence] || CASH_BAND_CERTEZA.estimated;
    const atrasado = item.overdue ? ` (se suponía el ${engine.dateLabel(item.planned)}; el plan lo sigue dando por pendiente)` : "";
    const tramo = item.window && (item.window.from !== item.window.to) ? ` · puede caer ${engine.whenLabel(item.window.from, item.window.to)}` : "";
    const cargo = item.confidence === "estimated" && item.kind === "outflow"
      ? ` <button type="button" class="banda-dia-cargo" data-banda-dia-cargo="${escapeHtml(item.label)}">¿Sabes el día?</button>`
      : "";
    return `<li class="banda-dia-item"><span class="banda-dia-importe${item.signed > 0 ? " is-pos" : ""}">${escapeHtml(cashBandSigned(item.signed))}</span><span class="banda-dia-texto"><strong>${escapeHtml(item.label || "Sin nombre")}</strong><span class="banda-dia-certeza">${escapeHtml(certeza + atrasado + tramo)}</span>${cargo}</span></li>`;
  });
  if (day.spread.amount > 0) {
    const de = day.spread.labels.length ? ` (${day.spread.labels.join(", ")})` : "";
    items.push(`<li class="banda-dia-item"><span class="banda-dia-importe">${escapeHtml(cashBandSigned(-day.spread.amount))}</span><span class="banda-dia-texto"><strong>Lo de este día del gasto que llega repartido por el mes${escapeHtml(de)}</strong><span class="banda-dia-certeza">repartido por igual entre los días que quedan del mes</span></span></li>`);
  }
  const lista = items.length
    ? `<ul class="banda-dia-lista" aria-label="Lo que entra y sale ese día">${items.join("")}</ul>`
    : `<p class="banda-dia-nada">Ese día el plan no mueve nada: el saldo sigue igual.</p>`;
  return `<h2 id="bandaDiaTitulo">Qué mueve el ${escapeHtml(engine.dateLabel(day.date))}</h2>
    <p class="banda-dia-saldo">Al empezar el día, según el plan: <strong>${escapeHtml(money(day.opening, true))}</strong></p>
    ${lista}
    <p class="banda-dia-saldo">Al acabar el día, según el plan: <strong>${escapeHtml(money(day.closing, true))}</strong></p>
    <p class="e19-kpi-note">Es la columna «Según el plan» de la tabla, desglosada: cada cosa en el día que supone el plan. La banda P10-P90 además mueve las de fecha estimada de un día a otro entre trayectorias.</p>`;
}

function cashBandOpenDay(date) {
  const engine = globalThis.FinanceCanonicalCashBand;
  const dialog = qs("bandaDiaDialog");
  if (!engine || !dialog || !cashBandLastInput) return;
  const day = engine.dayBreakdown(cashBandLastInput, date);
  if (!day) return;
  qs("bandaDiaContenido").innerHTML = cashBandDayHtml(engine, day);
  globalThis.FinanceMedidor?.anotar("banda-dia", "vista"); // XGO-02
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  qs("bandaDiaCerrar")?.focus();
}

// «¿Sabes el día?»: a Días de cargo (Plan › Partidas), abierta y con el foco en el selector de esa partida si se encuentra por su nombre.
function cashBandGoToChargeDay(label) {
  globalThis.FinanceMedidor?.anotar("banda-dia", "accion"); // XGO-02: la métrica de la ficha (fechas corregidas desde aquí)
  qs("bandaDiaDialog")?.close?.();
  location.hash = "#planificacion-partidas";
  setTimeout(() => {
    const card = qs("cargoDiaCard");
    if (!card) return;
    card.open = true;
    const item = [...card.querySelectorAll(".cargo-dia-item")].find((li) => li.querySelector("strong")?.textContent.trim() === String(label).trim());
    const target = item?.querySelector("[data-cargo-dia]") || qs("cargoDiaResumen");
    target?.scrollIntoView({ block: "center" });
    target?.focus();
  }, 150);
}

function cashBandDayBindOnce() {
  if (cashBandDayBound) return;
  cashBandDayBound = true;
  document.addEventListener("ck-select", (event) => {
    const figure = event.target.closest?.("#previsionBanda");
    const holder = figure?.querySelector("[data-banda-dia-fechas]");
    const button = holder?.querySelector("[data-banda-dia]");
    const engine = globalThis.FinanceCanonicalCashBand;
    if (!button || !engine) return;
    const date = JSON.parse(holder.dataset.bandaDiaFechas || "[]")[event.detail?.index];
    if (!date) return;
    button.dataset.bandaDia = date;
    button.textContent = cashBandDayButtonText(engine, date);
  });
  document.addEventListener("click", (event) => {
    const open = event.target.closest?.("[data-banda-dia]");
    if (open) return cashBandOpenDay(open.dataset.bandaDia);
    const cargo = event.target.closest?.("[data-banda-dia-cargo]");
    if (cargo) return cashBandGoToChargeDay(cargo.dataset.bandaDiaCargo);
    if (event.target.closest?.("#bandaDiaCerrar")) qs("bandaDiaDialog")?.close?.();
  });
}
