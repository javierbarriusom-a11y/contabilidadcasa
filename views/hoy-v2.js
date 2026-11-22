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

function hoyV2DaysBetween(from, to) {
  return Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);
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

// UND-02 (undécima auditoría; 22/11/2026): si el gráfico de la previsión no sale (motor diario sin filas, fechas fuera de su tramo,
// un fallo al calcular), se dice, en vez de dejar el hueco: un hueco y un «sin datos» se veían igual y el hogar no podía distinguir
// un fallo. ⚠ y no ○ (la forma dice el estado además del color), y «Recalcular» rehace la previsión diaria.
function hoyV2SinGraficoHtml() {
  return `<div class="hoy-v2-fallo" role="status" data-hoy-v2-sin-grafico>
      <span class="hoy-v2-fallo-icono" aria-hidden="true">⚠</span>
      <span>No he podido dibujar la previsión de estos días.</span>
      <button type="button" class="secondary-button" data-hoy-v2-recalcular>Recalcular</button>
    </div>`;
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

function hoyV2Hero({ balances, protectedReserve, reserveStatus, asOf, hoy = isoLocalDate(new Date()), dataAge, coverage }) {
  const margin = window.FinanceCanonicalHomeMargin?.build({
    balances, liquidityFloor: state?.liquidityFloor, caixaMinimum: agentCaixaFloor(),
    rows: openSimulationRows(lastSimulation), today: isoLocalDate(new Date()),
  });
  // Solo un cobro futuro cuenta como «hasta cobrar»: con datos reales el motor puede devolver una fecha
  // ya pasada (p. ej. el último ingreso del plan, «0 días hasta 31 ago»), y eso no se pinta como cobro.
  // 1/11/2026: la cuenta parte de la fecha de los saldos (asOf), pero «hoy» es hoy. Un cobro posterior a los saldos que ya
  // ha pasado no es «Cobráis en 4 días»: se dice que la cifra no lo cuenta y se ofrece poner los saldos al día.
  const nextIncome = coverage?.nextIncomeDate || "";
  const payday = nextIncome && nextIncome > asOf && nextIncome >= hoy && Number(coverage.days) > 0 ? { nextIncomeDate: nextIncome, days: hoyV2DaysBetween(hoy, nextIncome) } : null;
  const cobroPasado = nextIncome && nextIncome > asOf && nextIncome < hoy ? nextIncome : "";
  const saldosViejos = asOf < hoy;
  const kicker = payday ? "Disponible hasta cobrar" : cobroPasado ? `Disponible con los saldos del ${hoyV2ShortDay(asOf)}` : "Disponible para gastar";
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
    saldosViejos && !cobroPasado ? `Con los saldos del ${escapeHtml(hoyV2DayMonth(asOf))}.` : "",
    `Sin bajar del suelo de ${escapeHtml(money(today.floor))}.`,
    payday ? (payday.days ? `Cobráis en <strong>${payday.days} ${payday.days === 1 ? "día" : "días"}</strong>, el ${escapeHtml(hoyV2DayMonth(payday.nextIncomeDate))}.` : "Cobráis <strong>hoy</strong>.") : "",
  ].filter(Boolean).join(" ");
  const cobroAviso = cobroPasado
    ? `<p class="hoy-v2-warning">El cobro del ${escapeHtml(hoyV2DayMonth(cobroPasado))} ya ha pasado desde esos saldos y esta cifra no lo cuenta. <button type="button" class="hoy-v2-link" data-home-nav="update-hub">Poner los saldos de hoy</button></p>`
    : "";
  const caixa = margin.caixaShortfall > 0
    ? `<p class="hoy-v2-warning">CaixaBank está ${escapeHtml(money(margin.caixaShortfall))} por debajo de su mínimo operativo${margin.moveFromMediolanum > 0 ? `: mueve ${escapeHtml(money(margin.moveFromMediolanum))} desde Mediolanum` : ""}.</p>`
    : "";
  // T25 (decisión del hogar del 5/11/2026): la reserva protegida se mide con TODA la liquidez, como la tira de cifras
  // de Registrar y Plan. Antes aquí era solo CaixaBank («2.150 € por debajo») y allí toda («2.850 € de margen»): la misma
  // etiqueta con lecturas opuestas. Lo que CaixaBank necesita para los recibos es otra cosa, su mínimo operativo, y tiene
  // su propio aviso justo arriba («CaixaBank está … por debajo de su mínimo operativo: mueve … desde Mediolanum»).
  const reserveGap = round2(Number(balances?.total || 0) - Number(protectedReserve || 0));
  const reserveWord = reserveGap < 0
    ? `${money(Math.abs(reserveGap))} por debajo`
    : reserveStatus === "warn" ? `justa: ${money(reserveGap)} de margen` : `cubierta: ${money(reserveGap)} de margen`;
  const stats = [
    // D-N4 (decisión del hogar del 6/11/2026, FX-01): arriba el saldo previsto a fin de mes, el mismo que la banda de caja
    // «según el plan» y el motor diario; debajo, el margen sobre el suelo. Antes decía solo el margen con la etiqueta
    // «Fin de noviembre», que se leía como saldo.
    eom.available ? `<div class="hoy-v2-stat hoy-v2-stat-prevision${eom.margin < 0 ? " is-danger" : ""}"><div class="hoy-v2-stat-cabecera"><span>Fin de ${escapeHtml(eom.monthLabel)}</span>${hoyV2ConfianzaHtml()}</div><strong>${escapeHtml(money(eom.projected))}</strong><small>${escapeHtml(eom.margin < 0 ? `${money(Math.abs(eom.margin))} por debajo del suelo` : `${money(eom.margin)} sobre el suelo`)}</small></div>` : "",
    `<div class="hoy-v2-stat is-${escapeHtml(reserveStatus)}"><span>Reserva protegida</span><strong>${escapeHtml(money(protectedReserve))}</strong><small>${escapeHtml(reserveWord)}</small></div>`,
  ].join("");
  const chart = hoyV2ChartSvg(hoyV2Trajectory(asOf, balances?.total, payday?.nextIncomeDate), today.floor, payday?.nextIncomeDate) || hoyV2SinGraficoHtml();
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
        ${cobroAviso}
        ${caixa}
        ${coberturaAjusteAvisoHtml(e6CoverageSettings(), "hoy-v2-warning")}
      </div>
      <div class="hoy-v2-stats">${stats}</div>
    </div>
    ${chart}
    <p class="hoy-v2-provenance"><span class="hoy-v2-dot" aria-hidden="true"></span>${escapeHtml(provenance)}</p>
  </article>`;
}

// FX-31 en Hoy (7/11/2026, «primero el punto de confianza en Hoy»): junto a «Fin de mes», la cifra de Hoy que sale de la previsión, un
// punto con la confianza de la previsión, sin texto extra (la ficha lo pide así). El nivel va por forma además de por color (○ baja,
// ◐ media, ● alta), con su nombre para lectores de pantalla y al pasar el ratón. Lleva a Plan › Previsión con la hoja del porqué
// abierta. Es la misma insignia (previsionV2Confianza, views/prevision-v2.js): no hay otro cálculo.
const HOY_V2_CONFIANZA_FORMA = Object.freeze({ baja: "○", media: "◐", alta: "●" });

function hoyV2ConfianzaHtml() {
  if (typeof previsionV2Confianza !== "function" || typeof canonicalDailyEngineRuns === "undefined") return "";
  const hoy = isoLocalDate(new Date());
  const tramo = (canonicalDailyEngineRuns.active?.rows || []).filter((row) => row.date >= hoy && Number.isFinite(Number(row.total)));
  const confianza = tramo.length ? previsionV2Confianza(tramo, hoy) : null;
  if (!confianza) return "";
  return `<button type="button" class="hoy-v2-confianza" data-hoy-v2-confianza data-nivel="${escapeHtml(confianza.level)}" aria-label="Confianza de la previsión: ${escapeHtml(confianza.level)}. Ver por qué" title="${escapeHtml(confianza.label)} · ver por qué">${HOY_V2_CONFIANZA_FORMA[confianza.level] || "○"}</button>`;
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
  // FX-41: los avisos de previsión llevan a Plan › Previsión, donde está el arreglo más barato o el porqué.
  // DEC-20: los avisos de caja de Ajustes › Alertas también llevan a la Previsión, con su propio atributo (no son de FX-41).
  const action = item.previsionAviso
    ? `<button type="button" class="e19-btn e19-btn-secondary" data-hoy-v2-prevision>Ver la previsión</button>`
    : item.verPrevision
    ? `<button type="button" class="e19-btn e19-btn-secondary" data-hoy-v2-a-prevision>${escapeHtml(item.cta || "Ver la previsión")}</button>`
    : item.isUnifiedAction
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

// ---- FX-41 · avisos de previsión con umbral (el cambio de Hoy de la semana del 23/11/2026) ------------------------------------
// La previsión avisa cuando cruza un umbral en los próximos 90 días (canonical-forecast-alerts.js): el suelo, el mínimo de la cuenta
// corriente, el objetivo de colchón o un fin de año que cae más de un 10 % frente a la última visita a la Previsión. Entran en «Decidir
// esta semana» antes que las demás decisiones, de más a menos euros en juego, y siguen siendo 3 como mucho. Puerta de fecha, como los
// cambios 1 y 2 de Hoy: se publica antes y se activa el lunes de su semana (un cambio de Hoy por semana).
const HOY_V2_AVISOS_DESDE = "2026-11-23";

/** Las entradas de FX-41 para el motor: la trayectoria del motor diario y los umbrales del hogar. null si falta algo. */
function hoyV2AvisosEntrada(hoy) {
  const rows = typeof canonicalDailyEngineRuns !== "undefined" ? canonicalDailyEngineRuns.active?.rows || [] : [];
  if (!rows.length) return null;
  const C = globalThis.FinanceCanonicalForecastChanges;
  const A = globalThis.FinanceCanonicalForecastAlerts;
  const fotos = typeof previsionV2FotosCargar === "function" ? previsionV2FotosCargar() : [];
  const visita = C?.previousVisit(fotos, hoy) || null;
  const finVisita = visita ? A.yearEndFromSnapshot(visita, hoy.slice(0, 4)) : null;
  return {
    rows,
    today: hoy,
    floor: globalThis.FinanceCanonicalHomeMargin?.normalizeFloor(state?.liquidityFloor) ?? 0,
    checkingFloor: typeof previsionV2SueloCuenta === "function" ? previsionV2SueloCuenta() : 0,
    cushionTargetMonths: Math.max(0, Number(state?.emergencyBufferMonths) || 0),
    monthlySpend: typeof escenarioMotorAverageCoreSpend === "function" && typeof canonicalEngineRuns !== "undefined" ? escenarioMotorAverageCoreSpend(canonicalEngineRuns.active?.rows || []) : 0,
    previousYearEnd: finVisita !== null ? { value: finVisita, visitDate: visita.date } : null,
  };
}

/** Un aviso del motor, dicho como una decisión de Hoy (título, frase y nivel). */
function hoyV2AvisoDecision(alert, hoy) {
  const contract = globalThis.FinanceCanonicalForecastContract;
  const fecha = (iso) => contract?.shortDateLabel(iso, hoy) || iso;
  const euros = money(contract?.roundDifference(alert.euros) ?? Math.round(alert.euros));
  const d = alert.data || {};
  if (alert.id === "suelo") {
    return { title: `El ${fecha(alert.date)} bajáis del suelo`, text: `La previsión llega a ${money(d.lowValue)} el ${fecha(d.lowDate)}: faltan unos ${euros} sobre el suelo de ${money(d.floor)}. En la Previsión está el arreglo más barato.`, status: "danger" };
  }
  if (alert.id === "cuenta") {
    const ahorro = d.coveredBySavings ? `habría que pasar unos ${euros} del ahorro antes` : `faltan unos ${euros} y el ahorro de ese día no alcanza`;
    return { title: `La cuenta corriente se queda corta el ${fecha(alert.date)}`, text: `Baja de su mínimo de ${money(d.checkingFloor)} hasta ${money(d.lowValue)} el ${fecha(d.lowDate)}: ${ahorro}.`, status: d.coveredBySavings ? "warn" : "danger" };
  }
  if (alert.id === "colchon") {
    const meses = (n) => `${String(n).replace(".", ",")} ${n === 1 ? "mes" : "meses"}`;
    return { title: `El colchón baja de ${meses(d.targetMonths)} el ${fecha(alert.date)}`, text: `Llega a ${meses(d.lowMonths)} de gasto el ${fecha(d.lowDate)}: faltan unos ${euros} para vuestro objetivo.`, status: "warn" };
  }
  return { title: `El 31 de diciembre, unos ${euros} menos que en tu visita del ${fecha(d.visitDate)}`, text: `La previsión de fin de año baja un ${d.share} % (de ${money(d.before)} a ${money(d.after)}). En la Previsión está el porqué.`, status: "warn" };
}

/** Los avisos de FX-41 como decisiones de Hoy, de más a menos euros; nada antes de su puerta de fecha o si falta el motor. */
function hoyV2AvisosPrevision(hoy = isoLocalDate(new Date())) {
  const A = globalThis.FinanceCanonicalForecastAlerts;
  if (hoy < HOY_V2_AVISOS_DESDE || !A) return [];
  try {
    const entrada = hoyV2AvisosEntrada(hoy);
    if (!entrada) return [];
    return A.evaluate(entrada).alerts.map((alert) => ({ ...hoyV2AvisoDecision(alert, hoy), previsionAviso: alert.id }));
  } catch {
    return [];
  }
}

/**
 * FX-41 · los mismos avisos, para el calendario del móvil (WP-32, recordatorios-ui.js): los que tienen un día en que se cruza el umbral
 * (no el del fin de año, que cuenta un cambio ya ocurrido). El título no lleva importes: la pantalla de bloqueo no los enseña.
 */
const HOY_V2_AVISO_TITULO = Object.freeze({ suelo: "Previsión: bajáis del suelo", cuenta: "Previsión: la cuenta corriente se queda corta", colchon: "Previsión: el colchón baja del objetivo" });

function hoyV2AvisosCalendario(hoy = isoLocalDate(new Date())) {
  const A = globalThis.FinanceCanonicalForecastAlerts;
  if (hoy < HOY_V2_AVISOS_DESDE || !A) return [];
  try {
    const entrada = hoyV2AvisosEntrada(hoy);
    if (!entrada) return [];
    return A.evaluate(entrada).alerts.filter((alert) => HOY_V2_AVISO_TITULO[alert.id]).map((alert) => {
      const dicho = hoyV2AvisoDecision(alert, hoy);
      return { id: alert.id, date: alert.date, title: `${HOY_V2_AVISO_TITULO[alert.id]} el ${globalThis.FinanceCanonicalForecastContract?.shortDateLabel(alert.date, hoy) || alert.date}`, description: `${dicho.title}. ${dicho.text}` };
    });
  } catch {
    return [];
  }
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

function hoyV2Month(asOf, plannedSaving, enlaceArea = false) {
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
    <div class="hoy-v2-card-head"><h3>${escapeHtml(glance.monthLabel)}</h3><strong>${planned === null ? "—" : `${escapeHtml(money(planned))} de gasto`}</strong></div>
    <div class="hoy-v2-pace" role="img" aria-label="Día ${day} de ${daysInMonth}; gastado el ${spentPct} % del gasto previsto.">
      <span class="hoy-v2-pace-fill${over ? " is-over" : ""}" style="width:${spentPct}%"></span>
      <span class="hoy-v2-pace-today" style="left:${dayPct}%"></span>
    </div>
    <div class="hoy-v2-pace-legend"><span>día ${day} de ${daysInMonth}</span><span>${escapeHtml(money(plannedSaving))} irán a ahorro</span></div>
    ${real}
    ${enlaceArea ? `<button type="button" class="hoy-v2-link hoy-v2-a-area" data-hoy-v2-area="mes">Detalle del mes ›</button>` : ""}
  </article>`;
}

function hoyV2Patrimonio(debtOutlook, enlaceArea = false) {
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
  // T28 (Nielsen 4/11): el titular dice lo que enseña. Con activos declarados, primero el patrimonio neto; sin ellos, la
  // tarjeta es de la deuda y se titula así (antes «Patrimonio» con la deuda viva como única cifra).
  return `<article class="hoy-v2-card hoy-v2-patrimonio">
    <div class="hoy-v2-card-head"><h3>${net ? "Patrimonio" : "Deuda"}</h3></div>
    ${net}
    <button type="button" class="hoy-v2-row hoy-v2-row-link" data-home-nav="deuda-ruta">
      <span>Deuda viva · ${escapeHtml(free)}</span><strong>${escapeHtml(money(debtOutlook.pendingPrincipal))}</strong>
    </button>
    ${note}
    ${enlaceArea ? `<button type="button" class="hoy-v2-link hoy-v2-a-area" data-hoy-v2-area="patrimonio">Patrimonio y deuda ›</button>` : ""}
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

// Desde el 25/10/2026 los cobros y cargos esperados se contestan en la bandeja de Movimientos (views/movimientos-v2.js):
// Hoy solo deja una línea que lleva a ellos, para que una pregunta pendiente no se quede sin ver.
function hoyV2Esperados() {
  const items = globalThis.movV2EsperadosAqui?.() && typeof expectedMovementInboxItems === "function" ? expectedMovementInboxItems() : [];
  if (!items.length) return "";
  const questions = items.filter((item) => item.id !== "decision-inbox-expected-more").length;
  const more = items.length > questions;
  const label = `${questions}${more ? " o más" : ""} ${questions === 1 && !more ? "pregunta" : "preguntas"} sobre cobros y cargos`;
  return `<button type="button" class="hoy-v2-pending hoy-v2-esperados" data-home-nav="movements">
    <span class="hoy-v2-dot" aria-hidden="true"></span>
    <span><strong>${escapeHtml(label)}</strong><br>¿Ha llegado lo que esperabais? Se contesta en la bandeja de Movimientos.</span>
    <span aria-hidden="true">›</span>
  </button>`;
}

// Hoy, cambio 2 (semana del 1/11/2026, uno por semana; BACKLOG_DEFINITIVO.md §4): la entrada al Repaso semanal
// (views/repaso-v2.js). Solo sale mientras el repaso de esta semana (lunes a domingo) está por hacer: hecho, no ocupa
// pantalla, y el repaso sigue a mano en Movimientos. Se publica antes con puerta de fecha, como el cambio 1.
const HOY_V2_REPASO_DESDE = "2026-11-01";

function hoyV2Repaso(hoy = isoLocalDate(new Date())) {
  if (hoy < HOY_V2_REPASO_DESDE || typeof globalThis.repasoV2Open !== "function") return "";
  const resumen = globalThis.FinanceRepaso?.resumen?.();
  const ultimo = resumen?.ultimo;
  // DEC-23: hecho esta semana, a partir de su semana, la línea «Hecho esta semana» ocupa su sitio (sin botón).
  if (ultimo && globalThis.FinanceRepaso?.mismaSemana?.(ultimo.date, hoy)) return typeof hoyV2RepasoHecho === "function" ? hoyV2RepasoHecho(resumen, hoy) : "";
  const dias = ultimo ? Math.round((new Date(`${hoy}T12:00:00`) - new Date(`${ultimo.date}T12:00:00`)) / 86400000) : null;
  const detalle = ultimo
    ? `El último, hace ${dias} ${dias === 1 ? "día" : "días"}, en ${Math.max(1, Math.round(ultimo.seconds / 60))} min.`
    : "Saldos, extracto, lo que vino y la bandeja, en orden.";
  return `<button type="button" class="hoy-v2-pending hoy-v2-repaso" data-hoy-v2-repaso>
    <span class="hoy-v2-dot" aria-hidden="true"></span>
    <span><strong>Repaso de esta semana · unos 5 min</strong><br>${escapeHtml(detalle)}</span>
    <span aria-hidden="true">›</span>
  </button>`;
}

// DEC-23 (décima auditoría §4.4; el cambio de Hoy de la semana del 30/11/2026, uno por semana): con el repaso de esta semana hecho,
// en el hueco de su entrada, una línea de conclusión hasta el domingo: «Repaso hecho el martes» y, debajo, lo que se sabe de él
// (grupos clasificados en ese repaso, % del gasto con partida de los últimos 90 días, la misma cifra que la bandeja, y la racha).
// Tinte claro y sin botón (ESTADO.md §3, decisión 1): no pide nada. Sin repaso esta semana, la entrada de siempre. Puerta de fecha.
const HOY_V2_HECHO_DESDE = "2026-11-30";
const HOY_V2_DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function hoyV2RepasoHecho(resumen, hoy = isoLocalDate(new Date())) {
  const ultimo = resumen?.ultimo;
  if (hoy < HOY_V2_HECHO_DESDE || !ultimo || !/^\d{4}-\d{2}-\d{2}$/.test(String(ultimo.date))) return "";
  const [y, m, d] = ultimo.date.split("-").map(Number);
  const cuando = ultimo.date === hoy ? "hoy" : `el ${HOY_V2_DIAS_SEMANA[new Date(y, m - 1, d, 12).getDay()]}`;
  const clasificados = Number(ultimo.clasificados);
  let meta = null;
  try {
    meta = typeof clasV2Meta === "function" ? clasV2Meta() : null;
  } catch {
    meta = null;
  }
  const partes = [
    Number.isInteger(clasificados) && clasificados > 0 ? `${clasificados} ${clasificados === 1 ? "grupo clasificado" : "grupos clasificados"}` : "",
    Number.isFinite(meta?.pct) ? `${meta.pct} % del gasto con partida` : "",
    resumen.racha > 1 ? `${resumen.racha} semanas seguidas` : "",
  ].filter(Boolean);
  return `<div class="hoy-v2-hecho" data-hoy-v2-hecho>
    <span class="hoy-v2-hecho-marca" aria-hidden="true">✓</span>
    <span><strong>Repaso hecho ${cuando}</strong>${partes.length ? `<br>${escapeHtml(partes.join(" · "))}` : ""}</span>
  </div>`;
}

// «+ Apuntar gasto» abre exactamente lo mismo que «+ Registrar gasto» de la Hoy de siempre (la hoja de compras
// con tarjeta o el formulario rápido), y hereda de él si se puede usar: sin mes abierto con bloques de gasto
// queda desactivado y dice por qué, en vez de no hacer nada al pulsarlo.
function hoyV2ExpenseButton() {
  const classic = qs("homeQuickExpenseOpen");
  const disabled = Boolean(classic?.disabled);
  const title = disabled ? classic?.title || "" : "";
  return `<button type="button" class="e19-btn e19-btn-primary" data-hoy-v2-expense${disabled ? " disabled" : ""}${title ? ` title="${escapeHtml(title)}"` : ""}>+ Registrar gasto</button>`; // T30: mismo nombre que la ventana que abre
}

function hoyV2Header(hoy, dataAge) {
  const pill = dataAge?.stale || state?.balanceMode !== "manual"
    ? `<button type="button" class="hoy-v2-age${dataAge?.stale ? " is-stale" : ""}" data-home-nav="update-hub"><span class="hoy-v2-dot" aria-hidden="true"></span>${escapeHtml(dataAge?.stale ? dataAge.warning || dataAge.label : "Saldos estimados · confírmalos con tu banco")}</button>`
    : "";
  return `<header class="hoy-v2-header">
    <div>
      <p class="hoy-v2-date">${escapeHtml(hoyV2LongDate(hoy))}</p>
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
  root.addEventListener("keydown", (event) => {
    const tab = event.target.closest?.('[role="tab"][data-hoy-v2-area]');
    if (!tab || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const ids = HOY_V2_AREAS.map((item) => item.id);
    const i = ids.indexOf(tab.dataset.hoyV2Area);
    const siguiente = event.key === "Home" ? 0 : event.key === "End" ? ids.length - 1 : (i + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
    hoyV2ElegirArea(ids[siguiente], { foco: true });
  });
  root.addEventListener("click", (event) => {
    // XGO-02: lo que se pulsa en Hoy es una acción (la primera de la visita, con sus segundos desde que se pintó);
    // abrir «Ver todo el detalle» es apartarse de ella.
    if (event.target.closest("[data-hoy-v2-recalcular]")) {
      // UND-02: se rehace la previsión diaria desde cero (la copia en memoria se descarta) y se repinta todo.
      globalThis.FinanceMedidor?.anotar("hoy-sin-grafico", "accion");
      canonicalDailyEngineRuns = { base: null, active: null, planned: null };
      simulationSignature = ""; // sin esto, render() da el modelo por calculado y no rehace nada
      if (typeof render === "function") render();
      return;
    }
    const areaBoton = event.target.closest("[data-hoy-v2-area]");
    if (areaBoton) {
      // Cambiar de área es mirar, no actuar: no cuenta como la primera acción de la visita (XGO-02).
      hoyV2ElegirArea(areaBoton.dataset.hoyV2Area, { foco: areaBoton.getAttribute("role") === "tab" });
      if (areaBoton.getAttribute("role") !== "tab") qs("hoyV2Panel")?.scrollIntoView({ block: "start" });
      return;
    }
    if (event.target.closest("[data-hoy-v2-plan-mes]")) {
      globalThis.FinanceMedidor?.anotar("hoy-v2", "accion", { segundos: null });
      globalThis.FinanceMedidor?.anotar(`hoy-area-${hoyV2AreaActual()}`, "accion"); // UND-23
      history.pushState(null, "", "#plan");
      setActiveView("plan");
      if (typeof setPlanTab === "function") setPlanTab("mes");
      return;
    }
    const detalle = event.target.closest("[data-hoy-v2-detail]");
    if (detalle && !qs("home")?.classList.contains(HOY_V2_DETAIL_CLASS)) globalThis.FinanceMedidor?.anotar("hoy-v2", "descarte");
    else if (!detalle && event.target.closest("a, button")) {
      const segundos = hoyV2PaintedAt !== null ? (performance.now() - hoyV2PaintedAt) / 1000 : null;
      hoyV2PaintedAt = null;
      globalThis.FinanceMedidor?.anotar("hoy-v2", "accion", { segundos });
      globalThis.FinanceMedidor?.anotar(`hoy-area-${hoyV2AreaActual()}`, "accion"); // UND-23: desde qué área se actúa
    }
    if (event.target.closest("[data-hoy-v2-prevision], [data-hoy-v2-a-prevision]")) {
      history.pushState(null, "", "#plan");
      setActiveView("plan");
      if (typeof setPlanTab === "function") setPlanTab("prevision");
      return;
    }
    if (event.target.closest("[data-hoy-v2-confianza]")) {
      globalThis.previsionV2AbrirConfianza?.();
      return;
    }
    const repaso = event.target.closest("[data-hoy-v2-repaso]");
    if (repaso) {
      globalThis.repasoV2Open?.(repaso);
      return;
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

// Hoy por áreas (21/11/2026, petición del hogar: «tiene muchos datos interesantes, pero están todos en una sola página y hay que
// prestar mucha atención; agrúpalo por áreas temáticas, como Deuda»). Cinco pestañas en la misma pantalla, con el aspecto de las de
// Deuda pero sin número: Deuda es un recorrido en orden y estas áreas no. «Hoy» es la de siempre (cifra, gráfico, decisiones) y la de
// entrada; las otras cuatro reparten lo que hasta ahora solo salía con «Ver todo el detalle», que sigue igual (todo a la vez). No se
// retira nada ni se calcula nada nuevo: cada área enseña bloques que ya existían (los de la Hoy de siempre, por CSS) y lo de la v2.
const HOY_V2_AREAS = Object.freeze([
  { id: "hoy", label: "Hoy" },
  { id: "mes", label: "Mes" },
  { id: "caja", label: "Caja" },
  { id: "patrimonio", label: "Patrimonio y deuda" },
  { id: "seguimiento", label: "Seguimiento" },
]);
const HOY_V2_AREA_CLAVE = "hoy-v2-area";
let hoyV2UltimoModelo = null;

// El área elegida dura lo que la pestaña del navegador (sessionStorage): al volver otro día se entra por «Hoy».
function hoyV2AreaActual() {
  let area = "hoy";
  try {
    area = sessionStorage.getItem(HOY_V2_AREA_CLAVE) || "hoy";
  } catch {
    area = "hoy";
  }
  return HOY_V2_AREAS.some((item) => item.id === area) ? area : "hoy";
}

function hoyV2GuardarArea(area) {
  try {
    sessionStorage.setItem(HOY_V2_AREA_CLAVE, area);
  } catch {
    /* sin almacenamiento: el área vale hasta que se repinte la página */
  }
}

// UND-06 (undécima auditoría; 22/11/2026): un indicador en la pestaña del área que tiene algo, para que esconder no sea olvidar.
// Mes: las partidas de gasto de este mes por encima de lo previsto (número, en rojo: rompe una regla del hogar). Caja: un punto rojo si
// la previsión baja del suelo, del mínimo de la cuenta o del colchón en los próximos 30 días (los avisos de FX-41). Seguimiento: las
// decisiones abiertas (número, sin rojo). Patrimonio y deuda no lleva: no hay una señal suya que no esté ya en otra.
// Puerta de fecha: desde el 7/12, después de la revisión de las áreas a las dos semanas (UND-23, desde el 22/11). Con indicadores
// antes, lo medido diría qué áreas abre el indicador y no cuáles busca el hogar; y la semana del 30/11 ya tiene su cambio de Hoy
// (DEC-23, ESTADO §8.7: uno por semana).
const HOY_V2_INDICADORES_DESDE = "2026-12-07";
let hoyV2Indicadores = {};

function hoyV2IndicadoresDe(model, hoy) {
  if (String(hoy) < HOY_V2_INDICADORES_DESDE) return {};
  const out = {};
  try {
    const monthKey = String(hoy).slice(0, 7);
    const month = (typeof cuadroMandosAllMonths === "function" ? cuadroMandosAllMonths() : []).find((item) => item.key === monthKey);
    const pasadas = month && typeof planMesCollect === "function" ? planMesCollect(month).expense.filter((entry) => entry.hasActual && Number(entry.variance) >= 0.5) : [];
    if (pasadas.length) out.mes = { n: pasadas.length, rojo: true, texto: `${pasadas.length} ${pasadas.length === 1 ? "partida" : "partidas"} por encima de lo previsto` };
  } catch {
    /* sin plan del mes: sin indicador */
  }
  try {
    const A = globalThis.FinanceCanonicalForecastAlerts;
    const entrada = A ? hoyV2AvisosEntrada(hoy) : null;
    if (entrada) {
      const limite = new Date(`${hoy}T12:00:00`);
      limite.setDate(limite.getDate() + 30);
      const hasta = isoLocalDate(limite);
      const n = A.evaluate(entrada).alerts.filter((alert) => HOY_V2_AVISO_TITULO[alert.id] && alert.date && alert.date <= hasta).length;
      if (n) out.caja = { n, punto: true, rojo: true, texto: n === 1 ? "un aviso de caja en los próximos 30 días" : `${n} avisos de caja en los próximos 30 días` };
    }
  } catch {
    /* sin previsión: sin indicador */
  }
  const abiertas = Array.isArray(model?.decisions) ? model.decisions.length : 0;
  if (abiertas) out.seguimiento = { n: abiertas, rojo: false, texto: `${abiertas} ${abiertas === 1 ? "decisión abierta" : "decisiones abiertas"}` };
  return out;
}

function hoyV2InsigniaHtml(ind) {
  if (!ind) return "";
  return `<span class="hoy-v2-insignia${ind.rojo ? " is-rojo" : ""}${ind.punto ? " is-punto" : ""}" aria-hidden="true">${ind.punto ? "" : ind.n}</span><span class="sr-only">, ${escapeHtml(ind.texto)}</span>`;
}

function hoyV2AreasHtml(activa, indicadores = {}) {
  return `<div class="e19-registrar-tabs hoy-v2-areas" role="tablist" aria-label="Áreas de Hoy">${HOY_V2_AREAS.map((area) => {
    const sel = area.id === activa;
    return `<button type="button" role="tab" class="e19-registrar-tab${sel ? " is-active" : ""}" id="hoyV2Tab-${area.id}" aria-selected="${sel}" aria-controls="hoyV2Panel" tabindex="${sel ? "0" : "-1"}" data-hoy-v2-area="${area.id}">${escapeHtml(area.label)}${hoyV2InsigniaHtml(indicadores[area.id])}</button>`;
  }).join("")}</div>`;
}

// Mes: el ritmo del mes (la misma tarjeta de la columna de Hoy) y las tres partidas de gasto que más se desvían de lo previsto (la
// comprobación 3 de Cierre, cierreV2Desvios); debajo, por CSS, «El mes en una línea» (ingresos, previsto, real, desviación, sin
// clasificar e irá a ahorro) y el presupuesto y los objetivos del mes de la Hoy de siempre.
function hoyV2AreaMes(hoy, plannedSaving) {
  const monthKey = String(hoy).slice(0, 7);
  const desvios = typeof cierreV2Desvios === "function" ? cierreV2Desvios(monthKey) : [];
  const tabla = desvios.length && typeof cierreV2DesviosHtml === "function"
    ? cierreV2DesviosHtml(desvios, monthKey)
    : `<p class="hoy-v2-area-nota">Sin reales del mes con que comparar todavía: salen al importar el extracto y clasificarlo.</p>`;
  return `<div class="hoy-v2-area-cuerpo">
    ${hoyV2Month(hoy, plannedSaving)}
    <article class="hoy-v2-card hoy-v2-desvios">
      <div class="hoy-v2-card-head"><h3>Lo previsto frente a lo real</h3></div>
      ${tabla}
      <button type="button" class="e19-btn e19-btn-secondary" data-hoy-v2-plan-mes>Abrir Plan › Mes</button>
    </article>
  </div>`;
}

function hoyV2AreaIntro(texto) {
  return `<p class="hoy-v2-area-intro">${escapeHtml(texto)}</p>`;
}

function hoyV2AreaPanel(area, model, hoy, asOf, coverage) {
  if (area === "mes") return hoyV2AreaMes(hoy, model.plannedSaving);
  if (area === "caja") return hoyV2AreaIntro("Hasta cuándo llegáis sin bajar del suelo, los meses que conviene vigilar y las alertas de caja.");
  if (area === "patrimonio") return `<div class="hoy-v2-area-cuerpo">${hoyV2Patrimonio(model.debtOutlook)}</div>${hoyV2AreaIntro("Deuda, capacidad libre, reserva, riesgo y la salud financiera del hogar.")}`;
  if (area === "seguimiento") return `${hoyV2AreaIntro("Lo que ha cambiado desde la última vez, las decisiones abiertas, los próximos hitos y las señales que piden revisión.")}${hoyV2Waiting()}`;
  return `<div class="hoy-v2-grid">
      <div class="hoy-v2-main">
        ${hoyV2Hero({ ...model, asOf, hoy, coverage })}
        ${hoyV2Decisions(model.todayRead, [...hoyV2AvisosPrevision(hoy), ...(typeof svdPropuestasHoy === "function" ? svdPropuestasHoy(hoy) : []), ...(model.decisions || [])])}
        ${hoyV2Repaso()}
        ${hoyV2Esperados()}
      </div>
      <div class="hoy-v2-side">
        ${hoyV2Month(hoy, model.plannedSaving, true)}
        ${hoyV2Patrimonio(model.debtOutlook, true)}
        ${hoyV2Waiting()}
      </div>
    </div>`;
}

function hoyV2AplicarArea(area) {
  const home = qs("home");
  if (!home) return;
  for (const item of HOY_V2_AREAS) home.classList.toggle(`hoy-v2-area-${item.id}`, item.id === area);
  home.classList.toggle("hoy-v2-area-clasica", area !== "hoy");
}

function hoyV2ElegirArea(area, { foco = false } = {}) {
  if (!HOY_V2_AREAS.some((item) => item.id === area)) return;
  // UND-06: las aperturas de un área con indicador, para compararlas con todas las del área (UND-23).
  if (hoyV2Indicadores[area] && area !== hoyV2AreaActual()) globalThis.FinanceMedidor?.anotar("hoy-indicador", "accion");
  hoyV2GuardarArea(area);
  if (hoyV2UltimoModelo) hoyV2Render(hoyV2UltimoModelo);
  if (foco) qs(`hoyV2Tab-${area}`)?.focus();
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
  const hoy = isoLocalDate(new Date());
  const asOf = model.asOf || state?.balanceDate || hoy; // fecha de los saldos: de ahí parte la cuenta, pero la cabecera y el mes son los de hoy
  const detailOpen = qs("home")?.classList.contains(HOY_V2_DETAIL_CLASS);
  hoyV2UltimoModelo = model;
  const area = hoyV2AreaActual();
  hoyV2Indicadores = hoyV2IndicadoresDe(model, hoy);
  root.innerHTML = `${hoyV2Header(hoy, model.dataAge)}
    ${hoyV2AreasHtml(area, hoyV2Indicadores)}
    <div class="hoy-v2-panel" id="hoyV2Panel" role="tabpanel" aria-labelledby="hoyV2Tab-${area}">
      ${hoyV2AreaPanel(area, model, hoy, asOf, coverage)}
    </div>`;
  hoyV2AplicarArea(area);
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
    globalThis.FinanceMedidor?.anotar(`hoy-area-${hoyV2AreaActual()}`, "vista"); // UND-23: el área abierta (un día cuenta una vez)
    if (root.querySelector("[data-hoy-v2-sin-grafico]")) globalThis.FinanceMedidor?.anotar("hoy-sin-grafico", "vista"); // UND-02: días en que salta
    if (!hoyV2Measured) {
      hoyV2Measured = true;
      hoyV2PaintedAt = performance.now();
    }
  }
}
