// Rediseño · fase A3 (docs/rediseno/HANDOFF.md §5 «B1/B2 · Hoy», referencias/png/Hoy.png y HoyDesktop.png).
//
// Hoy v2: una cifra protagonista, como mucho tres decisiones, el mes en una barra y la deuda en una línea.
// Solo se ve con el tema v2 (<html data-tema="v2">); sin la bandera este fichero no pinta nada.
//
// No es un motor nuevo ni recalcula nada: renderHomeDashboard() (app.js) le pasa los mismos valores que
// ya ha calculado para la Hoy de siempre (saldos, reserva, decisiones, deuda) y aquí solo se leen los
// motores existentes (canonical-home-margin, canonical-daily-engine, data-age). La Hoy de siempre sigue
// en el DOM: el botón «Ver todo el detalle» la vuelve a enseñar entera, así que no se retira nada.
// Script clásico con defer, cargado antes de app.js (mismo scope global que el resto de views/*.js); sin
// la bandera solo define funciones y no pinta nada.

const HOY_V2_DETAIL_CLASS = "hoy-v2-detalle";

function hoyV2Active() {
  return document.documentElement.dataset.tema === "v2";
}

function hoyV2LongDate(iso) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function hoyV2DayMonth(iso) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(date);
}

function hoyV2ShortDay(iso) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(date).replace(".", "");
}

function hoyV2AddDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoLocalDate(date);
}

// Trayectoria del saldo total desde hoy hasta pasado el próximo cobro. Los movimientos día a día salen
// del calendario del motor diario (canonicalDailyEngineRuns.active); el punto de partida es el saldo
// real de hoy, no el del plan, para que la línea empiece exactamente donde está la cifra de arriba.
function hoyV2Trajectory(asOf, todayTotal, nextIncomeDate) {
  const rows = canonicalDailyEngineRuns?.active?.rows || [];
  const start = rows.findIndex((row) => row.date >= asOf);
  if (start < 0) return [];
  const minEnd = hoyV2AddDays(asOf, 14);
  const end = nextIncomeDate && nextIncomeDate > asOf ? hoyV2AddDays(nextIncomeDate, 6) : minEnd;
  const limit = hoyV2AddDays(asOf, 45);
  const wanted = end > minEnd ? end : minEnd;
  const until = wanted > limit ? limit : wanted;
  const slice = rows.slice(start).filter((row) => row.date <= until);
  if (!slice.length) return [];
  const shift = Number(todayTotal || 0) - Number(slice[0].openingTotal ?? slice[0].total ?? 0);
  return slice.map((row) => ({ date: row.date, value: round2(Number(row.total || 0) + shift) }));
}

function hoyV2ChartSvg(points, floor, nextIncomeDate) {
  if (points.length < 2) return "";
  const width = 640;
  const height = 168;
  const pad = { top: 18, right: 8, bottom: 22, left: 8 };
  const values = points.map((point) => point.value);
  const low = Math.min(floor, ...values);
  const high = Math.max(floor, ...values);
  const span = Math.max(1, high - low);
  const yMin = low - span * 0.12;
  const yMax = high + span * 0.12;
  const x = (index) => pad.left + (index / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (1 - (value - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom);
  const line = points.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const floorY = y(floor).toFixed(1);
  const incomeIndex = nextIncomeDate ? points.findIndex((point) => point.date === nextIncomeDate) : -1;
  const pct = (index) => ((x(index) / width) * 100).toFixed(2);
  // Las etiquetas van en HTML, no dentro del SVG: el SVG se estira al ancho y deformaría el texto.
  const ticks = [0, Math.round((points.length - 1) / 2), points.length - 1]
    .map((index) => `<span>${escapeHtml(hoyV2ShortDay(points[index].date))}</span>`)
    .join("");
  const income = incomeIndex > 0
    ? `<line class="hoy-v2-chart-income" x1="${x(incomeIndex).toFixed(1)}" x2="${x(incomeIndex).toFixed(1)}" y1="0" y2="${height - pad.bottom}"></line>`
    : "";
  const incomeLabel = incomeIndex > 0
    ? `<span class="hoy-v2-chart-label${incomeIndex > points.length * 0.7 ? " is-end" : ""}" style="left:${pct(incomeIndex)}%">cobro · ${escapeHtml(hoyV2ShortDay(nextIncomeDate))}</span>`
    : "";
  const min = points.reduce((best, point) => (point.value < best.value ? point : best), points[0]);
  const summary = `Saldo previsto del ${hoyV2DayMonth(points[0].date)} al ${hoyV2DayMonth(points[points.length - 1].date)}: mínimo ${money(min.value)} el ${hoyV2DayMonth(min.date)}; suelo ${money(floor)}.`;
  return `<figure class="hoy-v2-chart" role="img" aria-label="${escapeHtml(summary)}">
    <div class="hoy-v2-chart-plot">
      <svg viewBox="0 0 ${width} ${height - pad.bottom}" preserveAspectRatio="none" aria-hidden="true">
        <line class="hoy-v2-chart-floor" x1="0" x2="${width}" y1="${floorY}" y2="${floorY}"></line>
        ${income}
        <polyline class="hoy-v2-chart-line" points="${line}"></polyline>
      </svg>
      <span class="hoy-v2-chart-dot" style="left:${pct(0)}%;top:${((y(points[0].value) / (height - pad.bottom)) * 100).toFixed(2)}%"></span>
      ${incomeLabel}
      <span class="hoy-v2-chart-floor-label" style="top:${((Number(floorY) / (height - pad.bottom)) * 100).toFixed(2)}%">suelo ${escapeHtml(money(floor))}</span>
    </div>
    <div class="hoy-v2-chart-ticks" aria-hidden="true">${ticks}</div>
  </figure>`;
}

function hoyV2Hero({ balances, protectedReserve, reserveStatus, asOf, dataAge, coverage }) {
  const margin = window.FinanceCanonicalHomeMargin?.build({
    balances, liquidityFloor: state?.liquidityFloor, caixaMinimum: agentCaixaFloor(),
    rows: openSimulationRows(lastSimulation), today: isoLocalDate(new Date()),
  });
  // Solo un cobro futuro cuenta como «hasta cobrar»: con datos reales el motor puede devolver una fecha
  // ya pasada (p. ej. el último ingreso del plan, «0 días hasta 31 ago»), y eso no se pinta como cobro.
  const payday = coverage?.nextIncomeDate && coverage.nextIncomeDate > asOf && Number(coverage.days) > 0 ? coverage : null;
  const kicker = payday ? "Disponible hasta cobrar" : "Disponible para gastar";
  if (margin?.status !== "ok") {
    const reason = margin?.missing?.length ? `Falta el ${margin.missing.join(" y el ")}.` : "No se puede calcular todavía.";
    return `<article class="hoy-v2-card hoy-v2-hero">
      <p class="hoy-v2-kicker">${kicker}</p>
      <p class="hoy-v2-figure">—</p>
      <p class="hoy-v2-sentence">${escapeHtml(reason)}</p>
      ${coberturaAjusteAvisoHtml(e6CoverageSettings(), "hoy-v2-warning")}
      <button type="button" class="e19-btn e19-btn-primary" data-home-nav="update-hub">Poner los saldos</button>
    </article>`;
  }
  const { today, endOfMonth: eom, spendable } = margin;
  const sentence = [
    `Sin bajar del suelo de ${escapeHtml(money(today.floor))}.`,
    payday ? `Cobráis en <strong>${payday.days} ${payday.days === 1 ? "día" : "días"}</strong>, el ${escapeHtml(hoyV2DayMonth(payday.nextIncomeDate))}.` : "",
  ].join(" ");
  const caixa = margin.caixaShortfall > 0
    ? `<p class="hoy-v2-warning">CaixaBank está ${escapeHtml(money(margin.caixaShortfall))} por debajo de su mínimo operativo${margin.moveFromMediolanum > 0 ? `: mueve ${escapeHtml(money(margin.moveFromMediolanum))} desde Mediolanum` : ""}.</p>`
    : "";
  // Mismo criterio que la tarjeta «Reserva protegida» de siempre: CaixaBank frente al mínimo protegido.
  const reserveGap = round2(Number(balances?.caixa || 0) - Number(protectedReserve || 0));
  const reserveWord = reserveGap < 0
    ? `CaixaBank, ${money(Math.abs(reserveGap))} por debajo`
    : reserveStatus === "warn" ? `justa: ${money(reserveGap)} de margen` : `cubierta: ${money(reserveGap)} de margen`;
  const stats = [
    eom.available ? `<div class="hoy-v2-stat"><span>Fin de ${escapeHtml(eom.monthLabel)}</span><strong>${escapeHtml(money(eom.margin))}</strong></div>` : "",
    `<div class="hoy-v2-stat is-${escapeHtml(reserveStatus)}"><span>Reserva protegida</span><strong>${escapeHtml(money(protectedReserve))}</strong><small>${escapeHtml(reserveWord)}</small></div>`,
  ].join("");
  const chart = hoyV2ChartSvg(hoyV2Trajectory(asOf, balances?.total, payday?.nextIncomeDate), today.floor, payday?.nextIncomeDate);
  const provenance = [
    dataAge?.known === false ? "saldos sin fecha" : state?.balanceMode === "manual" ? "saldos declarados" : "estimado",
    "calendario de cobros y pagos",
    dataAge?.ageLabel || "hoy",
  ].join(" · ");
  return `<article class="hoy-v2-card hoy-v2-hero${spendable.value < 0 ? " is-negative" : ""}">
    <div class="hoy-v2-hero-head">
      <div>
        <p class="hoy-v2-kicker">${kicker}</p>
        <p class="hoy-v2-figure">${escapeHtml(money(spendable.value))}</p>
        <p class="hoy-v2-sentence">${sentence}</p>
        ${caixa}
        ${coberturaAjusteAvisoHtml(e6CoverageSettings(), "hoy-v2-warning")}
      </div>
      <div class="hoy-v2-stats">${stats}</div>
    </div>
    ${chart}
    <p class="hoy-v2-provenance"><span class="hoy-v2-dot" aria-hidden="true"></span>${escapeHtml(provenance)}</p>
  </article>`;
}

// Nivel visible de cada decisión: el mismo status que ya usa la Hoy de siempre (danger/warn/…).
function hoyV2Level(status) {
  if (status === "danger") return { label: "Alto", tone: "danger" };
  if (status === "warn") return { label: "Medio", tone: "warn" };
  return { label: "Bajo", tone: "neutral" };
}

function hoyV2DecisionRow(item, index) {
  const level = hoyV2Level(item.status || (item.tone === "danger" ? "danger" : item.tone === "warn" ? "warn" : ""));
  const detail = [item.text, item.expiryLabel ? `Vence el ${item.expiryLabel}.` : ""].filter(Boolean).join(" ");
  // Las acciones del centro unificado conservan su paso de revisión («Qué ocurrirá») antes de ejecutar.
  const action = item.isUnifiedAction
    ? `<details class="hoy-v2-review"><summary class="e19-btn e19-btn-secondary">Revisar</summary>
        <div><p>${escapeHtml(unifiedActionImpact(item))}</p>
        <button type="button" class="e19-btn e19-btn-primary" data-unified-confirm-id="${escapeHtml(item.id)}">${item.debtId || item.projectId || item.command ? "Continuar simulación" : "Abrir sección"}</button></div>
      </details>`
    : item.target
      ? `<button type="button" class="e19-btn e19-btn-secondary" data-home-nav="${escapeHtml(item.target)}">${escapeHtml(item.cta || "Abrir")}</button>`
      : "";
  return `<li class="hoy-v2-decision">
    <span class="hoy-v2-rank" aria-hidden="true">${index + 1}</span>
    <div class="hoy-v2-decision-body">
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(detail)}</p>
    </div>
    <span class="hoy-v2-level is-${level.tone}">${level.label}</span>
    ${action}
  </li>`;
}

function hoyV2Decisions(todayRead, decisions) {
  const lead = todayRead && todayRead.status !== "good" ? [todayRead] : [];
  const items = [...lead, ...(decisions || [])].slice(0, 3);
  if (!items.length) {
    return `<article class="hoy-v2-card hoy-v2-decisions">
      <div class="hoy-v2-card-head"><h3>Decidir esta semana</h3></div>
      <p class="hoy-v2-empty">Nada que decidir ahora mismo. El plan va por donde esperabais.</p>
    </article>`;
  }
  return `<article class="hoy-v2-card hoy-v2-decisions">
    <div class="hoy-v2-card-head"><h3>Decidir esta semana</h3><span>${items.length} de 3</span></div>
    <ol class="hoy-v2-decision-list">${items.map(hoyV2DecisionRow).join("")}</ol>
  </article>`;
}

function hoyV2Month(asOf, plannedSaving) {
  const glance = homeMonthAtAGlance(asOf, plannedSaving);
  const day = Number(String(asOf).slice(8, 10)) || 1;
  const [year, month] = String(asOf).split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate() || 30;
  const dayPct = Math.round((day / daysInMonth) * 100);
  const planned = glance.plannedExpense;
  const spentPct = planned > 0 ? Math.min(100, Math.round((glance.expenseTotal / planned) * 100)) : 0;
  const over = planned !== null && glance.expenseTotal > planned;
  const real = glance.movementCount
    ? `<p class="hoy-v2-month-real${over ? " is-over" : ""}">Gastado <strong>${escapeHtml(money(glance.expenseTotal))}</strong>${planned !== null ? ` de ${escapeHtml(money(planned))}` : ""} · ${glance.unclassifiedCount ? `${glance.unclassifiedCount} sin clasificar` : "todo clasificado"}</p>`
    : `<button type="button" class="hoy-v2-pending" data-home-nav="datos-importar"><span class="hoy-v2-dot is-empty" aria-hidden="true"></span><span>Sin gasto real todavía. <strong>Importa el extracto</strong> · 2 min</span><span aria-hidden="true">›</span></button>`;
  return `<article class="hoy-v2-card hoy-v2-month">
    <div class="hoy-v2-card-head"><h3>${escapeHtml(glance.monthLabel)}</h3><strong>${planned === null ? "—" : `${escapeHtml(money(planned))} asignado`}</strong></div>
    <div class="hoy-v2-pace" role="img" aria-label="Día ${day} de ${daysInMonth}; gastado el ${spentPct} % de lo asignado.">
      <span class="hoy-v2-pace-fill${over ? " is-over" : ""}" style="width:${spentPct}%"></span>
      <span class="hoy-v2-pace-today" style="left:${dayPct}%"></span>
    </div>
    <div class="hoy-v2-pace-legend"><span>día ${day} de ${daysInMonth}</span><span>${escapeHtml(money(plannedSaving))} irán a ahorro</span></div>
    ${real}
  </article>`;
}

function hoyV2Patrimonio(debtOutlook) {
  const partial = debtOutlook.estimable && / · /.test(debtOutlook.libreDeDeudaLabel);
  const free = debtOutlook.settled
    ? "sin deuda"
    : debtOutlook.estimable
      ? `libre ${debtOutlook.libreDeDeudaLabel.split(" · ")[0]}${partial ? "*" : ""}`
      : "sin fecha estimable";
  const netWorth = typeof a14NetWorthToday === "function" ? a14NetWorthToday() : { calculable: false };
  const net = netWorth.calculable
    ? `<div class="hoy-v2-row"><span>Patrimonio neto</span><strong class="${netWorth.netWorthAfterDebt < 0 ? "is-negative" : ""}">${escapeHtml(money(netWorth.netWorthAfterDebt))}</strong></div>`
    : "";
  const note = partial
    ? `<p class="hoy-v2-footnote">* Solo deudas con cuota: ${escapeHtml(debtOutlook.libreDeDeudaLabel.split(" · ").slice(1).join(" · "))}.</p>`
    : "";
  return `<article class="hoy-v2-card hoy-v2-patrimonio">
    <div class="hoy-v2-card-head"><h3>Patrimonio</h3></div>
    <button type="button" class="hoy-v2-row hoy-v2-row-link" data-home-nav="deuda-ruta">
      <span>Deuda viva · ${escapeHtml(free)}</span><strong>${escapeHtml(money(debtOutlook.pendingPrincipal))}</strong>
    </button>
    ${net}
    ${note}
  </article>`;
}

// Lo que antes eran tarjetas «Sin datos» sueltas: una sola línea plegada que dice qué espera datos.
function hoyV2Waiting() {
  const waiting = [];
  if (typeof homeBudgetSummary === "function" && !homeBudgetSummary()) waiting.push("presupuesto del mes");
  if (typeof a14NetWorthToday === "function" && !a14NetWorthToday().calculable) waiting.push("patrimonio neto");
  if (typeof homeBudgetGoalsSummary === "function" && !homeBudgetGoalsSummary()) waiting.push("objetivos");
  if (!waiting.length) return "";
  const list = waiting.join(", ").replace(/, ([^,]*)$/, " y $1");
  return `<button type="button" class="hoy-v2-pending hoy-v2-waiting" data-hoy-v2-detail>
    <span class="hoy-v2-dot is-empty" aria-hidden="true"></span>
    <span><strong>${waiting.length} ${waiting.length === 1 ? "función espera" : "funciones esperan"} datos</strong><br>${escapeHtml(list.charAt(0).toUpperCase() + list.slice(1))}</span>
    <span aria-hidden="true">›</span>
  </button>`;
}

// «+ Apuntar gasto» abre exactamente lo mismo que «+ Registrar gasto» de la Hoy de siempre (la hoja de compras
// con tarjeta o el formulario rápido), y hereda de él si se puede usar: sin mes abierto con bloques de gasto
// queda desactivado y dice por qué, en vez de no hacer nada al pulsarlo.
function hoyV2ExpenseButton() {
  const classic = qs("homeQuickExpenseOpen");
  const disabled = Boolean(classic?.disabled);
  const title = disabled ? classic?.title || "" : "";
  return `<button type="button" class="e19-btn e19-btn-primary" data-hoy-v2-expense${disabled ? " disabled" : ""}${title ? ` title="${escapeHtml(title)}"` : ""}>+ Apuntar gasto</button>`;
}

function hoyV2Header(asOf, dataAge) {
  const pill = dataAge?.stale || state?.balanceMode !== "manual"
    ? `<button type="button" class="hoy-v2-age${dataAge?.stale ? " is-stale" : ""}" data-home-nav="update-hub"><span class="hoy-v2-dot" aria-hidden="true"></span>${escapeHtml(dataAge?.stale ? dataAge.warning || dataAge.label : "Saldos estimados · confírmalos con tu banco")}</button>`
    : "";
  return `<header class="hoy-v2-header">
    <div>
      <p class="hoy-v2-date">${escapeHtml(hoyV2LongDate(asOf || isoLocalDate(new Date())))}</p>
      <h2 class="hoy-v2-title">Hoy</h2>
    </div>
    <div class="hoy-v2-header-actions">
      ${pill}
      <button type="button" class="e19-btn e19-btn-secondary" data-hoy-v2-detail aria-expanded="false">Ver todo el detalle</button>
      ${hoyV2ExpenseButton()}
    </div>
  </header>`;
}

// XGO-02: cuándo se pintó Hoy por primera vez en esta visita, para medir los segundos hasta la primera acción.
let hoyV2PaintedAt = null;
let hoyV2Measured = false;

function hoyV2BindOnce(root) {
  if (root.dataset.bound) return;
  root.dataset.bound = "1";
  root.addEventListener("click", (event) => {
    // XGO-02: lo que se pulsa en Hoy es una acción (la primera de la visita, con sus segundos desde que se pintó);
    // abrir «Ver todo el detalle» es apartarse de ella.
    const detalle = event.target.closest("[data-hoy-v2-detail]");
    if (detalle && !qs("home")?.classList.contains(HOY_V2_DETAIL_CLASS)) globalThis.FinanceMedidor?.anotar("hoy-v2", "descarte");
    else if (!detalle && event.target.closest("a, button")) {
      const segundos = hoyV2PaintedAt !== null ? (performance.now() - hoyV2PaintedAt) / 1000 : null;
      hoyV2PaintedAt = null;
      globalThis.FinanceMedidor?.anotar("hoy-v2", "accion", { segundos });
    }
    if (event.target.closest("[data-hoy-v2-expense]")) {
      qs("homeQuickExpenseOpen")?.click();
      return;
    }
    if (event.target.closest("[data-hoy-v2-detail]")) {
      const home = qs("home");
      const open = !home.classList.contains(HOY_V2_DETAIL_CLASS);
      home.classList.toggle(HOY_V2_DETAIL_CLASS, open);
      root.querySelectorAll("[data-hoy-v2-detail][aria-expanded]").forEach((button) => {
        button.setAttribute("aria-expanded", String(open));
        button.textContent = open ? "Ocultar el detalle" : "Ver todo el detalle";
      });
      if (open) qs("homeBudgetGlance")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function hoyV2Render(model) {
  const root = qs("hoyV2");
  if (!root) return;
  if (!hoyV2Active()) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  const coverage = executiveCoverageSnapshot();
  const asOf = model.asOf || state?.balanceDate || isoLocalDate(new Date());
  const detailOpen = qs("home")?.classList.contains(HOY_V2_DETAIL_CLASS);
  root.innerHTML = `${hoyV2Header(asOf, model.dataAge)}
    <div class="hoy-v2-grid">
      <div class="hoy-v2-main">
        ${hoyV2Hero({ ...model, asOf, coverage })}
        ${hoyV2Decisions(model.todayRead, model.decisions)}
      </div>
      <div class="hoy-v2-side">
        ${hoyV2Month(asOf, model.plannedSaving)}
        ${hoyV2Patrimonio(model.debtOutlook)}
        ${hoyV2Waiting()}
      </div>
    </div>`;
  if (detailOpen) {
    root.querySelectorAll("[data-hoy-v2-detail][aria-expanded]").forEach((button) => {
      button.setAttribute("aria-expanded", "true");
      button.textContent = "Ocultar el detalle";
    });
  }
  root.hidden = false;
  hoyV2BindOnce(root);
  if (qs("home")?.hidden === false) {
    globalThis.FinanceMedidor?.anotar("hoy-v2", "vista"); // XGO-02
    if (!hoyV2Measured) {
      hoyV2Measured = true;
      hoyV2PaintedAt = performance.now();
    }
  }
}
