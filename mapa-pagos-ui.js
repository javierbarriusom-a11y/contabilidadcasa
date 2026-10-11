// WP-49 (NPV-04, docs/WP49_DISENO.md): la tarjeta «Mapa anual de pagos grandes» de Plan › Previsión. El cálculo vive en canonical-large-payments.js (puro); aquí se leen las fuentes que ya existen (las
// partidas del plan de gastos de los próximos 12 meses, el inventario de seguros, los objetivos con fecha y el calendario financiero) y se pinta una franja de 12 meses con los pagos de cada uno, su barra
// (llena = reservado) y su estado de financiación en texto + icono + patrón. NO guarda nada, NO reserva dinero y NO mueve nada (A11-4): solo enseña. Tampoco va a Hoy (congelado hasta H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, announceStatus, estadoHtml, isoLocalDate, normalizedText, cuadroMandosAllMonths, planningSectionsForMonth,
// plannedValueForRowRaw, displayLabelForRow, seriesKeyForRow, isFinancingPlanningRow, isVariableOperationalRow, insurancePolicies, p2State, ajustesFinancialCalendarInput, registrarMesLongMonth…). Sin
// llamadas al DOM ni escuchas al cargarse: app.js llama a `renderMapaPagos` al pintar Plan › Previsión.

const MAPA_PAGOS_MIN_OPTIONS = [300, 500, 1000, 2000];
let mapaPagosMin = 300; // el mínimo para llamar «grande» a un pago; vale solo en esta sesión (no se guarda)

function mapaPagosEngine() {
  return globalThis.FinanceCanonicalLargePayments;
}

function mapaPagosEuros(value) {
  return money(value, true);
}

function mapaPagosGuard(fn, fallback = null) {
  try { const value = fn(); return value === undefined ? fallback : value; } catch { return fallback; }
}

function mapaPagosMonthName(key) {
  return mapaPagosGuard(() => registrarMesLongMonth(key), key) || key;
}

// Las partidas de gasto del plan en la ventana: una serie por partida con su importe previsto de cada mes. Se dejan fuera las financiaciones (son de Deuda) y el gasto variable (es del día a día y ya
// tiene sus sobres): lo que queda es lo fijo, lo anual y lo puntual, y el motor decide qué pesa de golpe.
function mapaPagosPlanRows(monthKeys) {
  const all = cuadroMandosAllMonths();
  const series = new Map();
  monthKeys.forEach((key) => {
    const month = all.find((item) => item.key === key);
    if (!month) return;
    planningSectionsForMonth("expense", month).forEach((section) => {
      if (normalizedText(section.name) === "gastos variables") return;
      section.rows.forEach((row) => {
        if (isVariableOperationalRow(row) || isFinancingPlanningRow(section, row)) return;
        const id = seriesKeyForRow(row);
        const entry = series.get(id) || { id, label: displayLabelForRow(row), values: {} };
        entry.values[key] = Number(plannedValueForRowRaw(row, month)) || 0;
        series.set(id, entry);
      });
    });
  });
  return [...series.values()];
}

function mapaPagosGoals() {
  const e15 = globalThis.FinanceCanonicalE15;
  const goals = mapaPagosGuard(() => p2State().goals, []) || [];
  // El fondo de emergencia es un colchón, no un pago con fecha: no entra en el mapa.
  return e15 ? goals.filter((goal) => goal.type !== "emergency").map((goal) => e15.normalizeGoal(goal)) : [];
}

function mapaPagosBuild(engine) {
  const today = isoLocalDate(new Date());
  const startMonth = today.slice(0, 7);
  const monthKeys = engine.monthsFrom(startMonth, engine.DEFAULT_MONTHS);
  return engine.assemble({
    rows: mapaPagosGuard(() => mapaPagosPlanRows(monthKeys), []),
    policies: mapaPagosGuard(() => insurancePolicies(), []),
    goals: mapaPagosGoals(),
    calendar: mapaPagosGuard(() => ajustesFinancialCalendarInput()?.calendar, null),
    startMonth, months: engine.DEFAULT_MONTHS, minAmount: mapaPagosMin, today,
  });
}

// El estado de financiación en palabras (nunca solo color): icono + texto, y un patrón distinto en la barra.
function mapaPagosState(item) {
  const f = item.funding;
  if (f.status === "sin-importe") return { icon: "?", cls: "desconocido", text: "Importe sin determinar" };
  if (f.status === "financiado") return { icon: "✓", cls: "financiado", text: "Financiado" };
  if (f.status === "parcial") return f.pct === 0
    ? { icon: "○", cls: "vacio", text: "Objetivo sin ahorrar aún" }
    : { icon: "%", cls: "parcial", text: `Reservado ${f.pct} %` };
  return { icon: "○", cls: "sin-reserva", text: "Sin reserva asignada" };
}

function mapaPagosHowTo(item) {
  const f = item.funding;
  if (f.status === "sin-importe" || f.status === "financiado") return "";
  if (f.dueNow) return `Vence este mes: faltan ${mapaPagosEuros(f.missing)} y ya no hay meses para repartirlo.`;
  const months = f.monthsLeft === 1 ? "el mes que queda" : `los ${f.monthsLeft} meses que quedan`;
  return `Para llegar sin tocar la caja: ${mapaPagosEuros(f.monthlyNeeded)} al mes durante ${months} (faltan ${mapaPagosEuros(f.missing)}).`;
}

function mapaPagosItemHtml(item, maxAmount) {
  const state = mapaPagosState(item);
  const hasAmount = item.amount !== null && item.amount !== undefined;
  const width = hasAmount && maxAmount > 0 ? Math.max(6, Math.round((item.amount / maxAmount) * 100)) : 0;
  const filled = item.funding.pct || 0;
  const engine = mapaPagosEngine();
  const tags = [engine.KIND_LABEL[item.kind] || item.kind];
  if (item.estimated) tags.push(item.kind === "tax" ? "sin estimar" : "estimado");
  if (item.overdue) tags.push("fecha vencida");
  const amountText = hasAmount ? mapaPagosEuros(item.amount) : "—";
  const bar = hasAmount
    ? `<span class="mpg-barra mpg-barra-${state.cls}" aria-hidden="true" style="width:${width}%"><span class="mpg-lleno" style="width:${filled}%"></span></span>`
    : `<span class="mpg-barra mpg-barra-desconocido" aria-hidden="true"></span>`;
  const how = mapaPagosHowTo(item);
  const reservedLine = item.funding.status === "financiado" || item.funding.status === "parcial"
    ? `<p>Reservado: ${mapaPagosEuros(item.reserved)} de ${mapaPagosEuros(item.amount)} (lo ahorrado en el objetivo).</p>`
    : (item.funding.status === "sin-reserva" ? `<p>Nadie ha declarado dinero para este pago: la app no tiene fondos por pago, solo los objetivos.</p>` : "");
  const dayLine = item.day ? `<p>Día ${item.day} del mes${item.estimated ? " (estimado a partir de la última renovación declarada; se repite cada año)" : ""}.</p>` : "";
  const unknownLine = hasAmount ? "" : `<p>No suma en ningún total: no se sabe cuánto es, y desconocido no es cero.</p>`;
  const alsoLine = item.alsoInPlan ? `<p>También está en el plan de gastos como «${escapeHtml(item.alsoInPlan)}»: se cuenta una sola vez.</p>` : "";
  return `<li class="mpg-item mpg-st-${state.cls}"><details>
      <summary aria-label="${escapeHtml(`${item.label}, ${amountText}, ${state.text}`)}">
        <span class="mpg-linea"><span class="mpg-nombre">${escapeHtml(item.label)}</span><span class="mpg-importe">${escapeHtml(amountText)}</span></span>
        ${bar}
        <span class="mpg-estado mpg-estado-${state.cls}"><span aria-hidden="true">${state.icon}</span> ${escapeHtml(state.text)}</span>
      </summary>
      <div class="mpg-detalle"><p class="mpg-etiquetas">${escapeHtml(tags.join(" · "))}</p>${dayLine}${reservedLine}${how ? `<p>${escapeHtml(how)}</p>` : ""}${unknownLine}${alsoLine}<p class="mpg-origen">Origen: ${escapeHtml(item.source)}.</p></div>
    </details></li>`;
}

function mapaPagosMonthHtml(row, maxAmount) {
  const total = row.items.length
    ? (row.total > 0 ? `<span class="mpg-total">${escapeHtml(mapaPagosEuros(row.total))}</span>` : `<span class="mpg-total">sin importe</span>`)
    : `<span class="mpg-total mpg-total-vacio">sin pagos grandes</span>`;
  return `<li class="mpg-mes${row.items.length ? "" : " mpg-mes-vacio"}"><h4 class="mpg-mes-titulo"><span>${escapeHtml(mapaPagosMonthName(row.monthKey))}</span>${total}</h4>${
    row.items.length ? `<ul class="mpg-lista">${row.items.map((item) => mapaPagosItemHtml(item, maxAmount)).join("")}</ul>` : ""
  }</li>`;
}

function mapaPagosTableHtml(map) {
  const body = map.months.flatMap((row) => row.items.map((item) => {
    const state = mapaPagosState(item);
    return `<tr><td>${escapeHtml(mapaPagosMonthName(row.monthKey))}</td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.source)}</td><td>${item.amount === null ? "sin determinar" : escapeHtml(mapaPagosEuros(item.amount))}</td><td>${item.reserved === null || item.reserved === undefined ? "—" : escapeHtml(mapaPagosEuros(item.reserved))}</td><td>${escapeHtml(state.text)}</td></tr>`;
  })).join("");
  return `<details class="mpg-tabla"><summary>Ver como tabla</summary><div class="table-wrap"><table class="e19-table"><thead><tr><th>Mes</th><th>Pago</th><th>Origen</th><th>Importe</th><th>Reservado</th><th>Estado</th></tr></thead><tbody>${body}</tbody></table></div></details>`;
}

function mapaPagosStatsHtml(map) {
  const s = map.summary;
  const cell = (label, value, note) => `<div class="mpg-dato"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>${note ? `<dd class="mpg-dato-nota">${escapeHtml(note)}</dd>` : ""}</div>`;
  const parts = [
    cell("Suman", mapaPagosEuros(s.total), `${s.countWithAmount} pago${s.countWithAmount === 1 ? "" : "s"} con importe${s.unknownCount ? ` y ${s.unknownCount} sin importe (no suman)` : ""}`),
    cell("Reservado", mapaPagosEuros(s.fundedTotal), s.fundedPct === null ? "" : `${s.fundedPct} % · solo de objetivos con ahorro declarado`),
    cell("Falta", mapaPagosEuros(s.missingTotal), s.total > 0 ? "de lo que tiene importe" : ""),
  ];
  if (s.reserveCount) parts.push(cell("Apartar al mes", `${mapaPagosEuros(s.reserveMonthly)}/mes`, `para llegar a ${s.reserveCount} pago${s.reserveCount === 1 ? "" : "s"} sin tocar la caja`));
  if (s.dueNowCount) parts.push(cell("Vence ya", mapaPagosEuros(s.dueNowTotal), `${s.dueNowCount} pago${s.dueNowCount === 1 ? "" : "s"} de este mes sin cubrir`));
  return `<dl class="mpg-datos">${parts.join("")}</dl>`;
}

function mapaPagosNotesHtml(map) {
  const s = map.summary;
  const notes = [];
  if (s.belowThreshold) notes.push(`${s.belowThreshold} pago${s.belowThreshold === 1 ? "" : "s"} por debajo de ${mapaPagosEuros(map.minAmount)} no se muestra${s.belowThreshold === 1 ? "" : "n"}.`);
  map.ignored.forEach((item) => notes.push(`«${item.label}» no se puede colocar en el mapa: ${item.reason}.`));
  map.merged.forEach((item) => notes.push(`«${item.plan}» está en el plan y en ${item.with}: se cuenta una sola vez.`));
  notes.push("Una partida del plan cuenta como pago grande si llega al mínimo y pesa al menos 2,5 veces lo habitual de esa misma partida: una cuota igual cada mes no lo es.");
  notes.push("Lo «reservado» sale solo de los objetivos con ahorro declarado. Los sobres de gastos variables arrastran el sobrante del mes, no guardan dinero para un pago concreto: por eso el resto sale «sin reserva asignada», no «0 %».");
  notes.push("El plan se repite cada año con lo previsto para el mismo mes: si un pago cambia de mes o de importe, hay que ajustarlo en el plan.");
  return `<ul class="mpg-notas">${notes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
}

function mapaPagosBodyHtml(engine) {
  const map = mapaPagosBuild(engine);
  const options = MAPA_PAGOS_MIN_OPTIONS.map((value) => `<option value="${value}"${value === mapaPagosMin ? " selected" : ""}>${escapeHtml(mapaPagosEuros(value))}</option>`).join("");
  const select = `<label class="month-picker mpg-minimo"><span>Contar como grande desde</span><select id="mapaPagosMinimo">${options}</select></label>`;
  if (!map.summary.count) {
    return `${select}${estadoHtml({
      kind: "vacio", titulo: "No hay pagos grandes en los próximos 12 meses",
      texto: `La app no ve ningún pago de ${mapaPagosEuros(mapaPagosMin)} o más. Aparecerán los seguros con fecha de renovación y prima, los objetivos con fecha e importe, y las partidas del plan que un mes pesen de golpe.`,
    })}${mapaPagosNotesHtml(map)}`;
  }
  const sentence = engine.describe(map, { labelOf: mapaPagosMonthName, euros: mapaPagosEuros });
  const maxAmount = Math.max(0, ...map.months.flatMap((row) => row.items.map((item) => (item.amount === null ? 0 : item.amount))));
  return `${select}<p class="mpg-frase"><strong>${escapeHtml(sentence)}</strong></p>${mapaPagosStatsHtml(map)}
    <ol class="mpg-meses" aria-label="Pagos grandes de los próximos 12 meses, mes a mes">${map.months.map((row) => mapaPagosMonthHtml(row, maxAmount)).join("")}</ol>
    ${mapaPagosTableHtml(map)}${mapaPagosNotesHtml(map)}`;
}

function renderMapaPagos(engine) {
  const box = qs("mapaPagosCuerpo");
  if (!box || !engine) return;
  attachMapaPagos(document); // idempotente: un cambio temprano no puede perderse
  try {
    const html = mapaPagosBodyHtml(engine);
    if (box.__mapaPagosHtml !== html) {
      const open = [...box.querySelectorAll("details[open]")].map((el) => el.querySelector("summary")?.getAttribute("aria-label") || el.querySelector("summary")?.textContent || "");
      box.innerHTML = html;
      box.__mapaPagosHtml = html;
      if (open.length) box.querySelectorAll("details").forEach((el) => { const key = el.querySelector("summary")?.getAttribute("aria-label") || el.querySelector("summary")?.textContent || ""; if (open.includes(key)) el.open = true; });
    }
  } catch {
    box.textContent = "No se pudo pintar el mapa de pagos con los datos actuales.";
  }
}

// Una sola vez, por delegación.
function attachMapaPagos(doc) {
  if (!doc || doc.__mapaPagosAttached) return false;
  doc.__mapaPagosAttached = true;
  doc.addEventListener("change", (event) => {
    if (event.target?.id !== "mapaPagosMinimo") return;
    const value = Number(event.target.value);
    mapaPagosMin = MAPA_PAGOS_MIN_OPTIONS.includes(value) ? value : 300;
    renderMapaPagos(mapaPagosEngine());
    qs("mapaPagosMinimo")?.focus(); // el menú se repinta con el mapa: el foco no se pierde
    announceStatus("Mapa de pagos recalculado.");
  });
  return true;
}
