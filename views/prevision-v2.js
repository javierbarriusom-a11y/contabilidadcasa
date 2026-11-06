// Rediseño · fase C2 (docs/rediseno/HANDOFF.md §5 «C2 · Plan › Previsión», referencias/png/Prevision.png y PrevisionDesktop.png)
// ampliada por FX-10 (BACKLOG_NOVIEMBRE_OLEADA_1.md; docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md §6).
//
// Plan › Previsión v2: arriba el punto más bajo del horizonte con su fecha y lo que queda sobre el suelo; el gráfico único de
// previsión (ChartKit.forecastPlotHtml, FX-11) con lo de hoy, el plan, el suelo y los cobros como hitos; y «Lo que viene» con
// los pagos y cobros grandes y si su día es cierto o estimado (FX-12). Horizonte 3 m · 12 m · 24 m · Hasta 2036 (D-N2, la
// recomendación de Claude, a la espera de que el hogar la confirme). Solo con el tema v2.
//
// No calcula nada nuevo: lee la trayectoria del motor diario (canonicalDailyEngineRuns.active), la misma que usan Hoy y el
// titular de Previsión mensual (FX-01, FX-02), el suelo de Hoy y de la banda de caja, y el contrato de cifras para redondear
// y decir las fechas (canonical-forecast-contract.js). Lo de siempre (la tabla de meses, el plan B, el puente y el mapa de
// pagos) sigue entero tras «Ver todo el detalle»: no se retira nada.
// Script clásico con defer, cargado antes de app.js (mismo scope global que el resto de views/*.js).

const PREVISION_V2_HORIZONTES = Object.freeze([
  Object.freeze({ id: "3m", label: "3 m", dias: 91, paso: 1, titulo: "de los próximos 3 meses" }),
  Object.freeze({ id: "12m", label: "12 m", dias: 365, paso: 7, titulo: "de los próximos 12 meses" }),
  Object.freeze({ id: "24m", label: "24 m", dias: 730, paso: 14, titulo: "de los próximos 24 meses" }),
  Object.freeze({ id: "full", label: "Hasta 2036", dias: Infinity, paso: "mes", titulo: "de aquí al final del plan" }),
]);
const PREVISION_V2_GRANDE = 300; // «Lo que viene»: pagos y cobros desde este importe

let previsionV2Detalle = false; // «Ver todo el detalle», hasta recargar

function previsionV2Active() {
  return document.documentElement.dataset.tema === "v2";
}

function previsionV2HorizonteId() {
  try {
    const guardado = localStorage.getItem("prevision-v2-horizonte");
    return PREVISION_V2_HORIZONTES.some((h) => h.id === guardado) ? guardado : "3m";
  } catch {
    return "3m";
  }
}

function previsionV2AddDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoLocalDate(date);
}

/** Los puntos del gráfico: cada día en 3 m, cada semana o quincena después y fin de mes hasta 2036. El día más bajo siempre entra. */
function previsionV2Serie(rows, today, horizonte) {
  const end = horizonte.dias === Infinity ? rows.at(-1)?.date || today : previsionV2AddDays(today, horizonte.dias);
  const tramo = rows.filter((row) => row.date >= today && row.date <= end && Number.isFinite(Number(row.total)));
  if (!tramo.length) return { tramo, puntos: [] };
  const low = globalThis.FinanceCanonicalForecastContract?.lowPoint(tramo, {});
  const elegido = (row, index) => index === 0 || index === tramo.length - 1 || row.date === low?.date
    || (horizonte.paso === "mes" ? row.date.slice(0, 7) !== tramo[index + 1]?.date.slice(0, 7) : index % horizonte.paso === 0);
  return { tramo, puntos: tramo.filter(elegido) };
}

function previsionV2Fecha(iso, today) {
  return globalThis.FinanceCanonicalForecastContract?.shortDateLabel(iso, today) || iso;
}

function previsionV2Lectura(row, floor, today, conMovimientos) {
  const margen = Number(row.total) - floor;
  const base = `${previsionV2Fecha(row.date, today)}: ${money(row.total)} previstos · ${margen < 0 ? `${money(Math.abs(margen))} por debajo del suelo` : `${money(margen)} sobre el suelo`}`;
  if (!conMovimientos) return `${base}.`;
  const grandes = (row.events || []).filter((event) => event.kind !== "transfer" && Number(event.amount) >= 50).slice(0, 3);
  return grandes.length ? `${base}. ${grandes.map((event) => `${event.label} ${event.kind === "income" ? "+" : "−"}${money(event.amount)}`).join(", ")}.` : `${base}.`;
}

function previsionV2HeroHtml({ tramo, horizonte, floor, today }) {
  const contract = globalThis.FinanceCanonicalForecastContract;
  const low = contract.lowPoint(tramo, {});
  if (!low) return "";
  const said = contract.describeLow(low, { today, monthLabel: (key) => (typeof escenarioMotorMonthLabel === "function" ? escenarioMotorMonthLabel(key) : key) });
  const margen = low.value - floor;
  const margenSaid = contract.roundForHorizon(Math.abs(margen), said.daysAhead);
  const finAno = tramo.find((row) => row.date === `${today.slice(0, 4)}-12-31`);
  const frase = [
    margen < 0
      ? `<strong class="prev-v2-bajo">${escapeHtml(money(margenSaid))} por debajo del suelo</strong> de ${escapeHtml(money(floor))}.`
      : `${escapeHtml(money(margenSaid))} por encima del suelo de ${escapeHtml(money(floor))}.`,
    finAno && finAno.date !== low.date ? `A 31 de diciembre, ${escapeHtml(money(contract.roundForHorizon(finAno.total, contract.daysBetween(today, finAno.date))))}.` : "",
  ].filter(Boolean).join(" ");
  return `<div class="prev-v2-hero${margen < 0 ? " is-bad" : ""}">
    <p class="e19-eyebrow">Punto más bajo ${escapeHtml(horizonte.titulo)}</p>
    <p class="prev-v2-cifra">${said.approximate ? "<small>unos</small> " : ""}${escapeHtml(money(said.value))} <span class="prev-v2-cuando">${escapeHtml(said.when)}</span></p>
    <p class="prev-v2-frase">${frase}</p>
  </div>`;
}

function previsionV2GraficoHtml({ puntos, floor, today, horizonte }) {
  const kit = globalThis.ChartKit;
  if (!kit?.forecastPlotHtml || puntos.length < 2) return "";
  const markers = horizonte.paso === "mes" ? [] : puntos
    .map((row, index) => ({ index, ingreso: (row.events || []).filter((event) => event.kind === "income").reduce((sum, event) => sum + Number(event.amount || 0), 0) }))
    .filter((item) => item.ingreso >= PREVISION_V2_GRANDE)
    .map((item) => ({ index: item.index, label: `Cobro del ${previsionV2Fecha(puntos[item.index].date, today)}: ${money(item.ingreso)}` }));
  const plot = kit.forecastPlotHtml({
    points: puntos.map((row, index) => ({ label: row.date, plan: Number(row.total), real: index === 0 ? Number(row.total) : null })),
    ariaLabel: `Saldo previsto ${horizonte.titulo}, con el suelo de ${money(floor)}`,
    threshold: { value: floor, label: "suelo" },
    todayIndex: 0,
    markers,
    format: (value) => money(value),
  });
  const readings = puntos.map((row) => previsionV2Lectura(row, floor, today, horizonte.paso === 1));
  return kit.figureHtml({
    id: "prevision-v2", plotHtml: plot.svg + plot.overlayHtml, plotClass: "prev-v2-plot", readings, xs: plot.xs,
    sliderLabel: `Recorrer la previsión ${horizonte.titulo}`,
    table: { caption: `Saldo previsto ${horizonte.titulo}`, columns: ["Día", "Saldo previsto", "Sobre el suelo"], rows: puntos.map((row) => [previsionV2Fecha(row.date, today), money(row.total), money(Number(row.total) - floor)]) },
  });
}

/** FX-12: los cobros y pagos grandes de los próximos 90 días, con su certeza y, si el día es estimado, el camino a Días de cargo. */
function previsionV2LoQueVieneHtml({ tramo, today }) {
  const fin = previsionV2AddDays(today, 90);
  const grandes = tramo
    .filter((row) => row.date <= fin)
    .flatMap((row) => (row.events || []).filter((event) => event.kind !== "transfer" && Number(event.amount) >= PREVISION_V2_GRANDE).map((event) => ({ ...event, date: row.date })));
  if (!grandes.length) return "";
  const estimados = grandes.filter((event) => event.confidence === "estimated").length;
  const certeza = { estimated: "día estimado", rule: "por regla", observed: "día cierto", declared: "día indicado por ti" };
  const items = grandes.slice(0, 12).map((event) => `<li class="prev-v2-viene-item">
      <span class="prev-v2-viene-dia">${escapeHtml(previsionV2Fecha(event.date, today))}</span>
      <span class="prev-v2-viene-que">${escapeHtml(event.label || "Sin nombre")}<small>${escapeHtml(certeza[event.confidence] || "previsto")}</small></span>
      <strong class="prev-v2-viene-importe${event.kind === "income" ? " is-pos" : ""}">${event.kind === "income" ? "+" : "−"}${escapeHtml(money(event.amount))}</strong>
    </li>`).join("");
  return `<details class="e19-card prev-v2-viene">
    <summary>Lo que viene en 90 días · ${grandes.length} ${grandes.length === 1 ? "cobro o pago grande" : "cobros y pagos grandes"}${estimados ? ` · ${estimados} con el día estimado` : ""}</summary>
    <ul class="prev-v2-viene-lista">${items}</ul>
    ${grandes.length > 12 ? `<p class="e19-kpi-note">Y ${grandes.length - 12} más. Todos, día a día, en la tabla del gráfico.</p>` : ""}
    ${estimados ? `<p class="e19-kpi-note">Los de día estimado mueven el punto más bajo. <button type="button" class="hoy-v2-link" data-prevision-v2-nav="planificacion-partidas">Decir el día de cargo</button></p>` : ""}
  </details>`;
}

function previsionV2Html({ rows, today, floor, horizonte }) {
  const { tramo, puntos } = previsionV2Serie(rows, today, horizonte);
  if (!tramo.length) return `<p class="hoy-v2-pending">Sin previsión desde hoy: pon los saldos para que la app pueda prever.</p>`;
  const segmentado = `<div class="registrar-mes-filters prev-v2-horizontes" role="group" aria-label="Horizonte de la previsión">${PREVISION_V2_HORIZONTES
    .map((h) => `<button type="button" class="registrar-mes-filter${h.id === horizonte.id ? " is-active" : ""}" data-prevision-v2-horizonte="${h.id}" aria-pressed="${h.id === horizonte.id}">${escapeHtml(h.label)}</button>`)
    .join("")}</div>`;
  return `${segmentado}
    <article class="e19-card prev-v2-card">
      ${previsionV2HeroHtml({ tramo, horizonte, floor, today })}
      ${previsionV2GraficoHtml({ puntos, floor, today, horizonte })}
    </article>
    ${previsionV2LoQueVieneHtml({ tramo, today })}
    <p class="prev-v2-mas">
      <button type="button" class="hoy-v2-link" data-prevision-v2-nav="prevision">Rango probable, calidad del dato y acierto</button>
      <button type="button" class="hoy-v2-link" data-prevision-v2-detalle>Ver todo el detalle</button>
    </p>`;
}

/** Lo llama renderPlanPrevision() (app.js). Devuelve true si ha pintado la v2. */
function previsionV2Render() {
  const panel = document.querySelector(".e19-plan-prevision");
  const box = qs("planPrevisionV2");
  if (!panel || !box) return false;
  const rows = typeof canonicalDailyEngineRuns !== "undefined" ? canonicalDailyEngineRuns.active?.rows || [] : [];
  if (!previsionV2Active() || previsionV2Detalle || !rows.length || !globalThis.FinanceCanonicalForecastContract || !globalThis.ChartKit?.forecastPlotHtml) {
    panel.classList.remove("prevision-v2-on");
    box.hidden = true;
    box.innerHTML = "";
    return false;
  }
  const horizonte = PREVISION_V2_HORIZONTES.find((h) => h.id === previsionV2HorizonteId());
  const floor = globalThis.FinanceCanonicalHomeMargin?.normalizeFloor(state?.liquidityFloor) ?? 0;
  box.innerHTML = previsionV2Html({ rows, today: isoLocalDate(new Date()), floor, horizonte });
  box.hidden = false;
  panel.classList.add("prevision-v2-on");
  if (!qs("plan")?.hidden && !panel.closest("[data-plan-panel]")?.hidden) globalThis.FinanceMedidor?.anotar("prevision-v2", "vista"); // XGO-02
  return true;
}

function previsionV2Init() {
  qs("planPrevisionV2")?.addEventListener("click", (event) => {
    const horizonte = event.target.closest("[data-prevision-v2-horizonte]");
    if (horizonte) {
      try { localStorage.setItem("prevision-v2-horizonte", horizonte.dataset.previsionV2Horizonte); } catch { /* sin guardar: vale para esta visita */ }
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      previsionV2Render();
      qs("planPrevisionV2")?.querySelector(`[data-prevision-v2-horizonte="${horizonte.dataset.previsionV2Horizonte}"]`)?.focus();
      return;
    }
    const nav = event.target.closest("[data-prevision-v2-nav]");
    if (nav) {
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      const target = nav.dataset.previsionV2Nav;
      if (document.getElementById(target)?.classList.contains("view-section")) {
        history.pushState(null, "", `#${target}`);
        setActiveView(target);
      }
      return;
    }
    if (event.target.closest("[data-prevision-v2-detalle]")) {
      previsionV2Detalle = true;
      globalThis.FinanceMedidor?.anotar("prevision-v2", "descarte");
      previsionV2Render();
      document.querySelector(".e19-plan-prevision")?.querySelector("table")?.focus?.();
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "complete") previsionV2Init();
  else document.addEventListener("DOMContentLoaded", previsionV2Init);
}
