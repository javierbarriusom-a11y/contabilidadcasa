// PERF-1 (FASE 6, escala #4): código exclusivo de la vista "analisis", extraído de app.js. Se
// carga bajo demanda (ver loadViewChunk() en app.js) la primera vez que se visita — <script>
// clásico, no módulo ES: sus declaraciones de nivel superior aterrizan en el mismo scope global de
// siempre. Lo que otras vistas necesitan (analisisCushionBand/analisisCushionWorst/
// analisisCushionBandHtml para Hoy y Plan · Previsión, analisisCascadaRows/analisisCascadaHtml para
// Plan · Previsión, analisisAccuracyRow para el propio flujo de guardado de cierre de mes) se quedó
// en app.js.

function analisisWindowMonths(windowKey = analisisWindowKey) {
  const all = cuadroMandosAllMonths();
  const config = ANALISIS_WINDOWS[windowKey] || ANALISIS_WINDOWS["12m"];
  return Number.isFinite(config.months) ? all.slice(0, config.months) : all;
}

// =================================================================================================
// Fase 6 · Análisis, segunda fase (Analisis.pdf, 17 de agosto): A-4 (cascada del resultado), A-5
// (patrimonio neto proyectado), A-8 (reparto del ingreso), A-9 (qué se repite) y A-11 (exportar).
// Ningún cálculo financiero nuevo: A-4/A-8 reutilizan `planMesCollect` (P-2/P-4, real donde existe,
// previsto donde no); A-5 reutiliza `debtAmortizationSchedule` (D-4) y `lastSimulation`; A-9 agrupa
// `baseData.transactions` con `movementMappingKey`, la misma clave de concepto que ya usan M-7/M-8.
// =================================================================================================

// A-4: "Selector de periodo: mes en curso, cualquier mes cerrado o un rango (trimestre, semestre,
// año)." Los rangos se anclan al mes en curso hacia atrás; cualquier mes individual (abierto o
// cerrado) también se puede elegir por su clave.
const ANALISIS_PERIOD_PRESETS = [
  { id: "trimestre", label: "Último trimestre", months: 3 },
  { id: "semestre", label: "Último semestre", months: 6 },
  { id: "ano", label: "Último año", months: 12 },
];
let analisisPeriodKey = "mes-actual";

function analisisPeriodMonths(periodKey = analisisPeriodKey) {
  const all = cuadroMandosAllMonths();
  if (!all.length) return [];
  if (periodKey === "mes-actual") {
    const match = all.find((month) => month.key === openMonthCutoffKey());
    return match ? [match] : [all[0]];
  }
  const preset = ANALISIS_PERIOD_PRESETS.find((item) => item.id === periodKey);
  if (preset) {
    const endIndex = Math.max(0, all.findIndex((month) => month.key === openMonthCutoffKey()));
    const startIndex = Math.max(0, endIndex - preset.months + 1);
    return all.slice(startIndex, endIndex + 1);
  }
  const match = all.find((month) => month.key === periodKey);
  return match ? [match] : [all[0]];
}

function analisisPeriodLabel(periodKey = analisisPeriodKey) {
  if (periodKey === "mes-actual") return "Mes en curso";
  const preset = ANALISIS_PERIOD_PRESETS.find((item) => item.id === periodKey);
  if (preset) return preset.label;
  return ledgerMonthLabel(periodKey);
}

// A-5: "Liquidez menos deuda viva [...] con el eje cero visible y tres hitos: hoy, cruce a cero y
// fin del plan." La deuda viva es el calendario declarado de cada contrato real (D-4,
// `debtAmortizationSchedule`), sin aplicar ninguna decisión ni ruta — Análisis es de solo lectura,
// no presupone qué estrategia se va a seguir.
function analisisDebtLiveSeries(months) {
  const contracts = canonicalDebtContractRows();
  const totals = months.map(() => 0);
  contracts.forEach((contract) => {
    const schedule = debtAmortizationSchedule(contract, months.length);
    const rows = schedule.rows;
    const flatBalance = schedule.stalled && rows.length ? rows[rows.length - 1].balance : null;
    for (let index = 0; index < months.length; index += 1) {
      if (index < rows.length) totals[index] += rows[index].balance;
      else if (flatBalance !== null) totals[index] += flatBalance;
    }
  });
  return totals.map((value) => round2(value));
}

function analisisNetWorthSeries(months, simRows) {
  const debtSeries = analisisDebtLiveSeries(months);
  const byKey = new Map(simRows.map((row) => [row.detailMonthKey, row]));
  return months.map((month, index) => {
    const row = byKey.get(month.key);
    const liquidity = row ? Number(row.totalLiquidity ?? 0) : null;
    return { key: month.key, label: month.label, netWorth: liquidity === null ? null : round2(liquidity - debtSeries[index]) };
  });
}

function analisisNetWorthMilestones(series) {
  const withData = series.filter((item) => item.netWorth !== null);
  if (!withData.length) return null;
  let cruce = null;
  for (let index = 1; index < withData.length; index += 1) {
    if (withData[index - 1].netWorth < 0 && withData[index].netWorth >= 0) {
      cruce = withData[index];
      break;
    }
  }
  return { hoy: withData[0], cruce, finDelPlan: withData[withData.length - 1] };
}

function analisisNetWorthBandHtml(series) {
  const values = series.map((item) => item.netWorth).filter((value) => value !== null);
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));
  return series
    .map((item) => {
      if (item.netWorth === null) {
        return `<div class="analisis-networth-col"><div class="analisis-networth-bar"></div><small>${escapeHtml(item.label)}</small></div>`;
      }
      const heightPct = Math.max(4, round2((Math.abs(item.netWorth) / maxAbs) * 100));
      const tone = item.netWorth < 0 ? "is-negativo" : "is-positivo";
      return `<div class="analisis-networth-col">
        <span class="analisis-networth-value">${money(item.netWorth, true)}</span>
        <div class="analisis-networth-bar ${tone}" style="height:${heightPct}%"></div>
        <small>${escapeHtml(item.label)}</small>
      </div>`;
    })
    .join("");
}

function analisisNetWorthMilestonesHtml(milestones) {
  if (!milestones) return `<p class="e19-kpi-note">Sin datos suficientes para proyectar el patrimonio neto.</p>`;
  const parts = [
    ["Hoy", money(milestones.hoy.netWorth, true)],
    ["Cruza a cero", milestones.cruce ? milestones.cruce.label : "No cruza en esta ventana"],
    ["Fin del plan", `${milestones.finDelPlan.label} · ${money(milestones.finDelPlan.netWorth, true)}`],
  ];
  return parts.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

// A-8: "Barra apilada con cada euro del ingreso [...] Los segmentos suman el 100% del ingreso, no
// del gasto." Reutiliza los mismos bloques que A-4 para un único mes; "Sin asignar" es lo que
// sobra tras gasto, deuda y ahorro — puede salir negativo si el mes gastó más que su ingreso, y se
// muestra tal cual (regla transversal 04: no se recorta un dato real para que cuadre visualmente).
function analisisIncomeSplit(month) {
  const collected = planMesCollect(month);
  const ingreso = round2(sumRows(collected.income, (entry) => entry.usado));
  const blockValue = (name) => round2(sumRows(collected.expense.filter((entry) => entry.sectionName === name), (entry) => entry.usado));
  const groups = [
    { label: "Gastos fijos", value: blockValue("Gastos fijos") },
    { label: "Gastos variables", value: blockValue("Gastos variables") },
    { label: "Cuota de deuda", value: blockValue("Financiaciones") },
    { label: "Ahorro", value: analisisSavingSum([month]).sum },
  ];
  const asignado = round2(sumRows(groups, (group) => group.value));
  groups.push({ label: "Sin asignar", value: round2(ingreso - asignado) });
  return { ingreso, groups: groups.map((group) => ({ ...group, pct: ingreso > 0 ? round2((group.value / ingreso) * 100) : 0 })) };
}

function analisisIncomeSplitHtml(split) {
  if (!(split.ingreso > 0)) return `<p class="e19-kpi-note">Sin ingreso registrado este mes: no hay nada que repartir.</p>`;
  const classes = ["is-fijos", "is-variables", "is-deuda", "is-ahorro", "is-sin-asignar"];
  const bar = split.groups
    .map((group, index) => `<span class="analisis-split-seg ${classes[index]}" style="width:${Math.max(0, group.pct)}%"></span>`)
    .join("");
  const legend = split.groups
    .map(
      (group, index) => `<div class="analisis-split-legend-item"><i class="analisis-split-dot ${classes[index]}"></i><span>${escapeHtml(group.label)}</span><strong>${money(group.value, true)}</strong><small>${group.pct}%</small></div>`
    )
    .join("");
  return `<div class="analisis-split-bar">${bar}</div><div class="analisis-split-legend">${legend}</div>`;
}

// A-9: "Recurrentes por peso, con variación frente al trimestre anterior, y aviso de los que han
// crecido sin decisión." Un concepto es "recurrente" cuando aparece con gasto real en los dos
// últimos trimestres — no en uno solo, eso sería una compra puntual, no algo que se repite.
function analisisRecurringWindow(referenceMonthKey) {
  const ref = dateFromMonthKey(referenceMonthKey);
  const keys = [];
  for (let offset = 5; offset >= 0; offset -= 1) keys.push(monthKey(addMonths(ref, -offset)));
  return { previous: keys.slice(0, 3), current: keys.slice(3, 6) };
}

function analisisRecurringItems(transactions, referenceMonthKey) {
  const ventana = analisisRecurringWindow(referenceMonthKey);
  const sums = { previous: new Map(), current: new Map() };
  const labels = new Map();
  (transactions || []).forEach((row) => {
    if (!(Number(row.amount) < 0)) return;
    const monthOfRow = String(row.date || "").slice(0, 7);
    const bucket = ventana.current.includes(monthOfRow) ? "current" : ventana.previous.includes(monthOfRow) ? "previous" : null;
    if (!bucket) return;
    const key = movementMappingKey(row);
    if (!labels.has(key)) labels.set(key, movementDisplayName(row));
    sums[bucket].set(key, round2((sums[bucket].get(key) || 0) + Math.abs(Number(row.amount) || 0)));
  });
  const items = [];
  sums.current.forEach((currentValue, key) => {
    const previousValue = sums.previous.get(key);
    if (previousValue === undefined) return;
    const pct = previousValue > 0 ? round2(((currentValue - previousValue) / previousValue) * 100) : null;
    items.push({ key, label: labels.get(key), current: currentValue, previous: previousValue, pct, grewWithoutDecision: pct !== null && pct > 0 });
  });
  return items.sort((a, b) => b.current - a.current).slice(0, 6);
}

function analisisRecurringHtml(items) {
  if (!items.length) {
    return `<p class="e19-kpi-note">Sin datos suficientes: hacen falta gastos en dos trimestres seguidos para saber qué se repite.</p>`;
  }
  const maxValue = Math.max(1, ...items.map((item) => item.current));
  return items
    .map((item) => {
      const widthPct = round2((item.current / maxValue) * 100);
      const toneClass = item.pct === null || item.pct === 0 ? "" : item.pct > 0 ? "is-danger" : "is-success";
      const pctText = item.pct === null
        ? "Sin dato del trimestre anterior"
        : item.pct === 0
          ? "Sin cambio frente al trimestre anterior"
          : `${item.pct > 0 ? "+" : ""}${item.pct}% frente al trimestre anterior`;
      return `<div class="analisis-recurring-item">
        <div class="analisis-recurring-head"><strong>${escapeHtml(item.label)}</strong><span>${money(item.current, true)}</span></div>
        <div class="analisis-recurring-track"><div class="analisis-recurring-bar ${toneClass}" style="width:${widthPct}%"></div></div>
        <small class="${toneClass}">${escapeHtml(pctText)}</small>
      </div>`;
    })
    .join("");
}

// A-13: el enlace genérico a Movimientos obligaba a repetir a mano la búsqueda del concepto y la
// selección de sus filas. El botón deja ya buscado el concepto (o los conceptos, si crecieron
// varios) y sus filas exactas preseleccionadas — mismo camino de clasificación en lote que M-8, sin
// segunda puerta.
function analisisRecurringGrowthNote(items) {
  const grown = items.filter((item) => item.grewWithoutDecision);
  if (!grown.length) return "";
  const names = grown.map((item) => item.label).join(" y ");
  const extra = round2(sumRows(grown, (item) => item.current - item.previous));
  const keys = grown.map((item) => item.key).join("||");
  return `${names} sube${grown.length > 1 ? "n" : ""} ${money(extra, true)} más al mes que en el trimestre anterior. Nadie decidió eso. <button type="button" class="secondary-button" data-analisis-actuar-repite="${escapeHtml(keys)}" data-analisis-actuar-label="${escapeHtml(grown.length === 1 ? names : "")}">Clasificar en Movimientos</button>`;
}

// A-13: A-9 sí señala uno o varios conceptos concretos (movementMappingKey, la misma clave que ya
// usan M-7/M-8) — se preseleccionan solo las filas de esos conceptos exactos, no todo lo que
// contenga el texto de casualidad. Con un único concepto, además se deja escrito en el buscador
// para que se vea de dónde sale la selección.
function handleAnalisisActuarRepite(keysRaw, label) {
  const keys = new Set(String(keysRaw || "").split("||").filter(Boolean));
  if (!keys.size) return;
  movementsActFromAlert({
    search: keys.size === 1 ? label || "" : "",
    chip: "todos",
    matcher: (row) => keys.has(movementMappingKey(row)),
  });
}

// A16-3: detección de recurrentes/suscripciones — distinto de A-9 (qué concepto pesa más y ha
// crecido, comparando trimestres): esto busca cargos de importe exactamente igual que se repiten mes
// a mes (candidatos a suscripción) y da su coste mensual y anualizado. Mismo movementMappingKey()/
// movementDisplayName() que ya usan A-9/M-7/M-8 — ninguna normalización de texto en paralelo. Todo
// el histórico visible, no una ventana: una suscripción de hace 8 meses sigue siendo relevante hoy.
function analisisSubscriptionsResult(transactions) {
  if (!window.FinanceCanonicalForecast?.detectRecurringSubscriptions) return null;
  const movements = (transactions || [])
    .filter((row) => Number(row.amount) < 0)
    .map((row) => ({
      pattern: movementMappingKey(row),
      label: movementDisplayName(row),
      category: row.category,
      amount: row.amount,
      month: row.month || String(row.date || "").slice(0, 7),
    }));
  return window.FinanceCanonicalForecast.detectRecurringSubscriptions(movements);
}

const ANALISIS_SUBSCRIPTION_CONFIDENCE_LABEL = { high: "alta", medium: "media", low: "baja" };

function analisisSubscriptionsHtml(result) {
  if (!result || !result.detected.length) {
    return `<p class="e19-kpi-note">Sin cargos del mismo importe repetidos al menos ${result?.minMonths ?? 3} meses todavía.</p>`;
  }
  const rows = result.detected
    .map((item) => `<div class="analisis-subscription-item">
      <div class="analisis-subscription-head"><strong>${escapeHtml(item.label)}</strong><span>${money(item.monthlyCost, true)}/mes</span></div>
      <small>${escapeHtml(item.category || "Sin categoría")} · visto ${item.sampleMonths} meses · ${money(item.annualCost, true)}/año · confianza ${escapeHtml(ANALISIS_SUBSCRIPTION_CONFIDENCE_LABEL[item.confidence] || item.confidence)}</small>
    </div>`)
    .join("");
  return `${rows}<p class="e19-kpi-note">Total detectado: ${money(result.totalMonthlyCost, true)}/mes (${money(result.totalAnnualCost, true)}/año). Candidatos a confirmar a mano: un mismo importe repetido no siempre es una suscripción real.</p>`;
}

// P-1: desglose de gasto del periodo (mismo `periodMonths` que la cascada de A-4) por tipo de
// acción — reutiliza `actionTypeForMovement` (app.js), el mismo campo que edita Movimientos, no un
// cálculo aparte. Solo gastos (amount < 0): la pregunta que resuelve es "¿cuánto de lo gastado es
// deuda, discrecional, recurrente?", no un segundo reparto del ingreso (esa es A-8).
function analisisActionTypeRows(transactions, periodMonths) {
  const monthKeys = new Set((periodMonths || []).map((month) => month.key));
  const totals = new Map();
  let unclassified = 0;
  (transactions || []).forEach((row) => {
    if (!(Number(row.amount) < 0)) return;
    if (!monthKeys.has(String(row.date || "").slice(0, 7))) return;
    const amount = Math.abs(Number(row.amount) || 0);
    const entry = actionTypeForMovement(row);
    if (!entry) {
      unclassified = round2(unclassified + amount);
      return;
    }
    totals.set(entry.actionType, round2((totals.get(entry.actionType) || 0) + amount));
  });
  const rows = ACTION_TYPES.filter((type) => totals.has(type.id))
    .map((type) => ({ id: type.id, label: type.label, value: totals.get(type.id) }))
    .sort((a, b) => b.value - a.value);
  return { rows, unclassified };
}

function analisisActionTypeHtml(breakdown) {
  if (!breakdown.rows.length && !breakdown.unclassified) {
    return `<p class="e19-kpi-note">Sin gastos con tipo de acción en este periodo.</p>`;
  }
  const maxValue = Math.max(1, ...breakdown.rows.map((row) => row.value), breakdown.unclassified);
  const rowHtml = (label, value, toneClass) => `<div class="analisis-recurring-item">
        <div class="analisis-recurring-head"><strong>${escapeHtml(label)}</strong><span>${money(value, true)}</span></div>
        <div class="analisis-recurring-track"><div class="analisis-recurring-bar ${toneClass}" style="width:${round2((value / maxValue) * 100)}%"></div></div>
      </div>`;
  const rowsHtml = breakdown.rows.map((row) => rowHtml(row.label, row.value, "")).join("");
  const unclassifiedHtml = breakdown.unclassified ? rowHtml("Sin tipo de acción todavía", breakdown.unclassified, "is-danger") : "";
  return `${rowsHtml}${unclassifiedHtml}`;
}

function analisisAccuracyRows(months) {
  return months
    .filter((month) => isClosedMonthKey(month.key))
    .map(analisisAccuracyRow)
    .filter((row) => row.partidasCount > 0);
}

function analisisAccuracySummary(rows) {
  const threshold = partidaDeviationThreshold();
  if (!threshold) return { threshold: 0, hits: null, total: rows.length };
  return { threshold, hits: rows.filter((row) => row.withinThreshold).length, total: rows.length };
}

function analisisAccuracyRowsHtml(rows) {
  return rows
    .map((row) => {
      const badge =
        row.withinThreshold === null
          ? "—"
          : `<span class="e19-badge ${row.withinThreshold ? "e19-badge-success" : "e19-badge-danger"}">${row.withinThreshold ? "Acierta" : "Se desvía"}</span>`;
      return `<tr>
        <td>${escapeHtml(row.label)}</td>
        <td>${money(row.plannedTotal, true)}</td>
        <td>${money(row.realTotal, true)}</td>
        <td class="${row.diff < 0 ? "negative" : row.diff > 0 ? "positive" : ""}">${registrarMesSignedMoney(row.diff)}</td>
        <td>${row.deviationPct === Infinity ? "—" : `${row.deviationPct.toFixed(1)}%`}</td>
        <td>${row.partidasOver === null ? "—" : `${row.partidasOver} de ${row.partidasCount}`}</td>
        <td>${badge}</td>
      </tr>`;
    })
    .join("");
}

function analisisAccuracyHtml(rows, summary) {
  if (!rows.length) {
    return `<p class="e19-kpi-note">Ningún mes cerrado con reales en esta ventana todavía.</p>`;
  }
  const summaryHtml = summary.threshold
    ? `<p class="e19-kpi-note">${summary.hits} de ${summary.total} mes(es) cerrados dentro del margen del ${summary.threshold}% configurado en <a href="#ajustes" data-home-nav="ajustes">Ajustes</a>.</p>`
    : `<p class="e19-kpi-note">Sin umbral de desviación configurado en <a href="#ajustes" data-home-nav="ajustes">Ajustes</a>: se muestran las cifras, sin veredicto (Registrar usa el mismo umbral).</p>`;
  return `${summaryHtml}<div class="table-wrap"><table class="e19-table analisis-accuracy-table">
    <thead><tr><th>Mes</th><th>Previsto</th><th>Real</th><th>Diferencia</th><th>Desviación</th><th>Partidas fuera</th><th>Veredicto</th></tr></thead>
    <tbody>${analisisAccuracyRowsHtml(rows)}</tbody></table></div>`;
}

// A-3: "Peor mes explicado" — depende de A-2 (la banda de colchón ya marca el peor mes) y de E-2
// (el formulario de parámetros por decisión, la fuente de lo que hay que nombrar aquí). Mismo patrón
// que E-7 (`escenarioMotorVerdictText`)/D-6 (`renderDeudaCompararModeInsight`): un culpable nombrado
// y una palanca, nunca un cálculo financiero nuevo. Reutiliza `projectsForForecastIndex` +
// `scheduledDecisionMonthlyImpact` — el mismo desglose por decisión que ya usa el gráfico de deuda
// (`renderDebtPayoffChart`) — en vez de inventar una segunda forma de repartir el impacto por mes.
function analisisWorstMonthCulprit(worstMonthKey) {
  if (!worstMonthKey) return null;
  const index = forecastMonths().findIndex((month) => month.key === worstMonthKey);
  if (index < 0) return null;
  const active = projectsForForecastIndex(index).filter((project) => project.monthlyAmount > 0);
  if (!active.length) return null;
  return active.reduce((top, current) => (current.monthlyAmount > top.monthlyAmount ? current : top));
}

function analisisWorstMonthHtml(worst) {
  if (!worst) return `<p class="e19-kpi-note">Sin datos suficientes para marcar un peor mes en esta ventana.</p>`;
  const culprit = analisisWorstMonthCulprit(worst.key);
  if (!culprit) {
    return `<p class="e19-kpi-note"><strong>${escapeHtml(worst.label)}</strong> es el peor mes de la ventana, con ${worst.monthsValue.toFixed(1)} meses de colchón. Ninguna decisión cargada concentra su gasto ahí — viene del gasto habitual, no de una decisión concreta.</p>`;
  }
  return `<strong>${escapeHtml(culprit.name || "Una decisión cargada")} concentra el golpe de ${escapeHtml(worst.label)}</strong>
    <p>${money(culprit.monthlyAmount, true)} ese mes, con ${worst.monthsValue.toFixed(1)} meses de colchón resultantes. Ábrela en <a href="#simulator" data-home-nav="simulator">Simulador</a> para mover su importe o su mes.</p>`;
}

// A-10: "Confianza del dato" — pieza compartida con C-2 (sección 5 del backlog, «Saldo calculado y
// su cuadre»): mismo cuadre por cuenta que Cierre y Movimientos (M-8c) ya pintan, llamando
// literalmente a `cierreAccountReconciliation` en vez de recalcularlo. La cobertura de clasificación
// del mes reutiliza el mismo filtro que ya usa Cierre (`mapping?.status !== "classified"`), acotada
// al mes en curso — no un segundo recuento de "sin clasificar".
function analisisConfianzaDatoContext() {
  if (!window.FinanceCanonicalLedger) return null;
  const snapshot = refreshCanonicalLedger("analisis-view");
  if (!snapshot) return null;
  const entries = snapshot.entries || [];
  const accountRows = cierreAccountReconciliation(entries);
  const currentMonthKey = openMonthCutoffKey();
  const monthEntries = entries.filter((entry) => !entry.duplicateOf && String(entry.date || "").slice(0, 7) === currentMonthKey);
  const unclassifiedCount = monthEntries.filter((entry) => entry.mapping?.status !== "classified").length;
  return { accountRows, monthKey: currentMonthKey, monthLabel: ledgerMonthLabel(currentMonthKey), totalMovements: monthEntries.length, unclassifiedCount };
}

function analisisConfianzaDatoHtml(context) {
  if (!context) return `<p class="e19-kpi-note">Sin datos suficientes todavía.</p>`;
  const statusBadge = { cuadra: "e19-badge-success", descuadra: "e19-badge-danger", "sin-conciliar": "e19-badge-neutral" };
  const statusLabel = { cuadra: "Cuadra", descuadra: "Descuadra", "sin-conciliar": "Sin conciliar" };
  const accountsHtml = `<div class="table-wrap"><table class="e19-table analisis-confianza-table">
    <thead><tr><th>Cuenta</th><th>Declarado</th><th>Calculado</th><th>Diferencia</th><th>Estado</th></tr></thead>
    <tbody>${context.accountRows
      .map(
        (row) => `<tr>
          <td><strong>${escapeHtml(row.label)}</strong></td>
          <td>${money(row.declared, true)}</td>
          <td>${row.calculated === null ? "—" : money(row.calculated, true)}</td>
          <td>${row.diff === null ? "—" : money(row.diff, true)}</td>
          <td><span class="e19-badge ${statusBadge[row.status]}">${statusLabel[row.status]}</span></td>
        </tr>`,
      )
      .join("")}</tbody>
  </table></div>`;
  const coverageText = context.totalMovements
    ? context.unclassifiedCount
      ? `${context.unclassifiedCount} de ${context.totalMovements} movimiento(s) de ${escapeHtml(context.monthLabel)} sin clasificar todavía.`
      : `Los ${context.totalMovements} movimiento(s) de ${escapeHtml(context.monthLabel)} están clasificados.`
    : `Sin movimientos registrados en ${escapeHtml(context.monthLabel)} todavía.`;
  // A-13: con pendientes reales, el CTA deja ya puesto el chip "sin clasificar" (M-3) acotado a este
  // mismo mes y sus filas preseleccionadas, en vez de un enlace genérico a Movimientos que obligaba
  // a volver a filtrar a mano.
  const classifyCta = context.unclassifiedCount
    ? `<button type="button" class="secondary-button" data-analisis-actuar-confianza="${escapeHtml(context.monthKey)}">Clasificar en Movimientos</button>`
    : `<a href="#movements" data-home-nav="movements">Movimientos</a>`;
  return `${accountsHtml}<p class="e19-kpi-note">${coverageText} Se cierra en <a href="#cierre" data-home-nav="cierre">Cierre</a>, se clasifica en ${classifyCta}.</p>`;
}

// A-13: A-10 solo cuenta cuántos movimientos del mes en curso quedan sin clasificar — no hay un
// concepto único que buscar, así que reutiliza el chip "sin clasificar" (M-3) acotado a las fechas
// de ese mes, con todas sus filas preseleccionadas para la barra de acción en lote de M-8.
function handleAnalisisActuarConfianza(monthKey) {
  if (!monthKey) return;
  const monthStart = dateFromMonthKey(monthKey);
  movementsActFromAlert({
    chip: "sin-clasificar",
    dateFrom: isoLocalDate(monthStart),
    dateTo: isoLocalDate(monthEndDate(monthStart)),
    matcher: () => true,
  });
}

// A-11: "CSV con las series completas de cada bloque, una fila por mes y bloque [...] PDF de una
// página con los seis bloques, la ventana elegida y la fecha de cálculo." Mismo patrón que C-12
// (recién construido): Blob/URL de objeto para el CSV, `window.print()` sobre un contenedor
// dedicado para el PDF — ninguna librería nueva.
function analisisExportContext() {
  const windowMonths = analisisWindowMonths();
  const targetMonths = Number(state.emergencyBufferMonths || 0);
  const cushion = analisisCushionBand(windowMonths, lastSimulation, targetMonths);
  const netWorth = analisisNetWorthSeries(windowMonths, lastSimulation);
  const accuracyRows = analisisAccuracyRows(windowMonths);
  const accuracySummary = analisisAccuracySummary(accuracyRows);
  const periodMonths = analisisPeriodMonths();
  const cascada = analisisCascadaRows(periodMonths);
  const currentMonth = analisisPeriodMonths("mes-actual")[0] || windowMonths[0];
  const split = currentMonth ? analisisIncomeSplit(currentMonth) : { ingreso: 0, groups: [] };
  const recurring = analisisRecurringItems(baseData?.transactions || [], currentMonth?.key || openMonthCutoffKey());
  // #9/P-5 (Ola 4, plan de mejora post-E20 · 28/08/2026): una fila más sobre el mismo export, no un
  // exportador nuevo. Reutiliza tal cual savingsGoalsList()/savingsGoalsContributions() (P-13/P-16,
  // ya usados por la pestaña Ahorro de Plan) — el mismo acumulado real, no uno recalculado aparte.
  // No es una serie "por mes" como el resto de bloques: es el estado actual de cada objetivo.
  const goalContributions = savingsGoalsContributions();
  const goals = savingsGoalsList().map((goal) => {
    const target = round2(Number(goal.targetAmount || 0));
    const accumulated = round2(Number(goalContributions[goal.id] || 0));
    return { label: goal.label, target, accumulated, pct: target > 0 ? Math.round((accumulated / target) * 100) : null };
  });
  return {
    windowLabel: ANALISIS_WINDOWS[analisisWindowKey]?.label || "12 meses",
    periodLabel: analisisPeriodLabel(),
    calculatedAt: formatIsoDate(defaultBalanceDate()),
    cushion,
    netWorth,
    accuracyRows,
    accuracySummary,
    cascada,
    split,
    recurring,
    goals,
  };
}

function analisisExportCsvContent(context) {
  const lines = [];
  lines.push(["Bloque", "Mes", "Valor", "Detalle"].map(csvValue).join(";"));
  context.cushion.forEach((item) => lines.push(["Colchón (meses)", item.label, item.monthsValue ?? "", item.level].map(csvValue).join(";")));
  context.netWorth.forEach((item) => lines.push(["Patrimonio neto", item.label, item.netWorth ?? "", ""].map(csvValue).join(";")));
  lines.push([]);
  lines.push(
    ["¿Acierta el plan?", "", "", context.accuracySummary.threshold ? `${context.accuracySummary.hits} de ${context.accuracySummary.total} dentro del ${context.accuracySummary.threshold}%` : "sin umbral configurado"].map(csvValue).join(";"),
  );
  context.accuracyRows.forEach((row) =>
    lines.push(
      ["Acierta el plan", row.label, row.diff, row.deviationPct === Infinity ? "sin previsto" : `${row.deviationPct.toFixed(1)}% de desviación`].map(csvValue).join(";"),
    ),
  );
  lines.push([]);
  lines.push(["Cascada del resultado", context.periodLabel, "", ""].map(csvValue).join(";"));
  context.cascada.rows.forEach((row) => lines.push(["Cascada", row.label, row.value, ""].map(csvValue).join(";")));
  lines.push(["Cascada", "Resultado", context.cascada.resultado, ""].map(csvValue).join(";"));
  lines.push([]);
  lines.push(["Reparto del ingreso", "", "", `${money(context.split.ingreso, true)} de ingreso`].map(csvValue).join(";"));
  context.split.groups.forEach((group) => lines.push(["Reparto", group.label, group.value, `${group.pct}%`].map(csvValue).join(";")));
  lines.push([]);
  lines.push(["Qué se repite", "", "", ""].map(csvValue).join(";"));
  context.recurring.forEach((item) => lines.push(["Recurrente", item.label, item.current, item.pct === null ? "sin dato anterior" : `${item.pct}% vs trimestre anterior`].map(csvValue).join(";")));
  lines.push([]);
  lines.push(["Objetivos de ahorro", "", "", context.goals.length ? "" : "sin objetivos declarados"].map(csvValue).join(";"));
  context.goals.forEach((goal) =>
    lines.push(["Objetivo", goal.label, goal.accumulated, goal.target > 0 ? `${goal.pct}% de ${money(goal.target, true)}` : "sin importe objetivo"].map(csvValue).join(";")),
  );
  return `﻿${lines.join("\r\n")}`;
}

function downloadAnalisisCsv() {
  const context = analisisExportContext();
  const blob = new Blob([analisisExportCsvContent(context)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `analisis-${context.calculatedAt}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function analisisExportPrintHtml(context) {
  return `<h1>Análisis</h1>
    <p>Ventana: ${escapeHtml(context.windowLabel)} · Periodo de la cascada: ${escapeHtml(context.periodLabel)} · Fecha de cálculo: ${escapeHtml(context.calculatedAt)}</p>
    <h2>Colchón (meses)</h2>
    <table><thead><tr><th>Mes</th><th>Meses de colchón</th></tr></thead><tbody>${context.cushion.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.monthsValue === null ? "—" : item.monthsValue.toFixed(1)}</td></tr>`).join("")}</tbody></table>
    <h2>Patrimonio neto</h2>
    <table><thead><tr><th>Mes</th><th>Patrimonio neto</th></tr></thead><tbody>${context.netWorth.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.netWorth === null ? "—" : money(item.netWorth, true)}</td></tr>`).join("")}</tbody></table>
    <h2>¿Acierta el plan? ${context.accuracySummary.threshold ? `(${context.accuracySummary.hits} de ${context.accuracySummary.total} dentro del ${context.accuracySummary.threshold}%)` : "(sin umbral configurado en Ajustes)"}</h2>
    <table><thead><tr><th>Mes</th><th>Previsto</th><th>Real</th><th>Diferencia</th><th>Desviación</th></tr></thead><tbody>${context.accuracyRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${money(row.plannedTotal, true)}</td><td>${money(row.realTotal, true)}</td><td>${registrarMesSignedMoney(row.diff)}</td><td>${row.deviationPct === Infinity ? "—" : `${row.deviationPct.toFixed(1)}%`}</td></tr>`).join("")}</tbody></table>
    <h2>De dónde sale el resultado (${escapeHtml(context.periodLabel)})</h2>
    <table><thead><tr><th>Bloque</th><th>Importe</th></tr></thead><tbody>${context.cascada.rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${money(row.value, true)}</td></tr>`).join("")}<tr><td>Resultado</td><td>${money(context.cascada.resultado, true)}</td></tr></tbody></table>
    <h2>En qué se va</h2>
    <table><thead><tr><th>Bloque</th><th>Importe</th><th>%</th></tr></thead><tbody>${context.split.groups.map((group) => `<tr><td>${escapeHtml(group.label)}</td><td>${money(group.value, true)}</td><td>${group.pct}%</td></tr>`).join("")}</tbody></table>
    <h2>Qué se repite</h2>
    <table><thead><tr><th>Concepto</th><th>Este trimestre</th><th>Variación</th></tr></thead><tbody>${context.recurring.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${money(item.current, true)}</td><td>${item.pct === null ? "—" : `${item.pct}%`}</td></tr>`).join("")}</tbody></table>
    <h2>Objetivos de ahorro</h2>
    ${
      context.goals.length
        ? `<table><thead><tr><th>Objetivo</th><th>Acumulado</th><th>Progreso</th></tr></thead><tbody>${context.goals.map((goal) => `<tr><td>${escapeHtml(goal.label)}</td><td>${money(goal.accumulated, true)}</td><td>${goal.target > 0 ? `${goal.pct}% de ${money(goal.target, true)}` : "sin importe objetivo"}</td></tr>`).join("")}</tbody></table>`
        : `<p>Todavía no hay ningún objetivo declarado.</p>`
    }`;
}

function handleAnalisisDownload(kind) {
  const context = analisisExportContext();
  if (kind === "csv") {
    downloadAnalisisCsv();
    return;
  }
  // A-11 reutiliza el mismo contenedor de impresión que C-12 (`#cierrePrintEvidence`, fuera de
  // `.app-shell`) y la misma clase de `<body>` — un solo mecanismo de "PDF de una página" para toda
  // la app, no uno por pantalla.
  const container = qs("cierrePrintEvidence");
  if (!container) return;
  container.innerHTML = analisisExportPrintHtml(context);
  document.body.classList.add("is-printing-cierre-evidence");
  window.print();
  document.body.classList.remove("is-printing-cierre-evidence");
}

function handleAnalisisPeriod(periodKey) {
  analisisPeriodKey = periodKey;
  renderAnalisis();
}

function renderAnalisis() {
  const band = qs("analisisCushionBand");
  if (!band || !lastSimulation.length) return;

  document.querySelectorAll("[data-analisis-window]").forEach((button) => {
    const active = button.dataset.analisisWindow === analisisWindowKey;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  const months = analisisWindowMonths();
  const targetMonths = Number(state.emergencyBufferMonths || 0);
  const cushion = analisisCushionBand(months, lastSimulation, targetMonths);
  const worst = analisisCushionWorst(cushion);

  band.innerHTML = analisisCushionBandHtml(cushion, worst?.key || "");

  const legend = qs("analisisCushionLegend");
  if (legend) {
    legend.textContent = `Meses de gasto que cubre la liquidez, mes a mes · objetivo ${targetMonths} mes(es). Se calcula sobre lo simulado, con la fecha de cálculo de hoy.`;
  }

  const worstNote = qs("analisisCushionWorst");
  if (worstNote) {
    worstNote.innerHTML = worst
      ? `<span class="e19-badge e19-badge-danger">Peor mes · ${escapeHtml(worst.label)}</span> ${worst.monthsValue.toFixed(1)} meses de colchón.`
      : `<span class="e19-kpi-note">Sin datos suficientes para calcular el peor mes en esta ventana.</span>`;
  }

  // A-3: mismo peor mes que acaba de marcar A-2 arriba, con su desglose por decisión.
  const worstExplainedEl = qs("analisisWorstMonthExplained");
  if (worstExplainedEl) worstExplainedEl.innerHTML = analisisWorstMonthHtml(worst);

  // A-10: independiente de la ventana (siempre el mes en curso, como Cierre).
  const confianzaEl = qs("analisisConfianzaDato");
  if (confianzaEl) confianzaEl.innerHTML = analisisConfianzaDatoHtml(analisisConfianzaDatoContext());

  // C-11: Análisis es uno de los dependientes que el criterio de reapertura nombra explícitamente
  // — se avisa mientras alguno de los meses visibles esté reabierto (sin volver a cerrarse todavía).
  const reopenNotice = qs("analisisReopenNotice");
  if (reopenNotice) {
    const reopenedMonths = cierreMonthsCurrentlyReopened();
    const affected = months.filter((month) => reopenedMonths.has(month.key));
    if (affected.length) {
      reopenNotice.hidden = false;
      reopenNotice.textContent = `${affected.map((month) => month.label).join(", ")} se reabrió en Cierre y todavía no se ha vuelto a firmar: estas cifras pueden no reflejar la versión definitiva de ese mes.`;
    } else {
      reopenNotice.hidden = true;
      reopenNotice.textContent = "";
    }
  }

  // A-5: patrimonio neto proyectado — misma ventana que A-2 (A-6 lo declara: "afecta a la banda y
  // al patrimonio, no al mes").
  const netWorth = analisisNetWorthSeries(months, lastSimulation);
  const netWorthBand = qs("analisisNetWorthBand");
  if (netWorthBand) netWorthBand.innerHTML = analisisNetWorthBandHtml(netWorth);
  const milestonesEl = qs("analisisNetWorthMilestones");
  if (milestonesEl) milestonesEl.innerHTML = analisisNetWorthMilestonesHtml(analisisNetWorthMilestones(netWorth));

  // A-7: misma ventana que A-2/A-5 (A-6 la declara compartida) — meses cerrados solamente.
  const accuracyEl = qs("analisisAccuracy");
  if (accuracyEl) {
    const accuracyRows = analisisAccuracyRows(months);
    accuracyEl.innerHTML = analisisAccuracyHtml(accuracyRows, analisisAccuracySummary(accuracyRows));
  }

  // A-4: cascada del resultado, con su propio selector de periodo — independiente de la ventana de
  // A-2/A-5 (mes en curso, un mes cualquiera, o un rango relativo a hoy).
  const periodSelect = qs("analisisPeriodSelect");
  if (periodSelect && !periodSelect.childElementCount) {
    const allMonths = cuadroMandosAllMonths();
    const monthOptions = allMonths
      .map((month) => `<option value="${escapeHtml(month.key)}">${escapeHtml(month.label)}${isClosedMonthKey(month.key) ? " · cerrado" : ""}</option>`)
      .join("");
    periodSelect.innerHTML = `<option value="mes-actual">Mes en curso</option>
      <optgroup label="Rango">${ANALISIS_PERIOD_PRESETS.map((preset) => `<option value="${preset.id}">${escapeHtml(preset.label)}</option>`).join("")}</optgroup>
      <optgroup label="Un mes">${monthOptions}</optgroup>`;
  }
  if (periodSelect) periodSelect.value = analisisPeriodKey;
  const periodMonths = analisisPeriodMonths();
  const cascada = analisisCascadaRows(periodMonths);
  const cascadaEl = qs("analisisCascada");
  if (cascadaEl) cascadaEl.innerHTML = analisisCascadaHtml(cascada);
  const cascadaNote = qs("analisisCascadaNote");
  if (cascadaNote) {
    cascadaNote.textContent = `${analisisPeriodLabel()} · ${cascada.blocksWithReal} de ${cascada.blocksPresent} bloque(s) con dato real, el resto usa el previsto.`;
  }

  // A-8: reparto del ingreso del mes en curso — no depende del selector de periodo de A-4.
  const currentMonth = analisisPeriodMonths("mes-actual")[0];
  const splitEl = qs("analisisIncomeSplit");
  if (splitEl && currentMonth) splitEl.innerHTML = analisisIncomeSplitHtml(analisisIncomeSplit(currentMonth));

  // A-9: qué se repite, sobre el mismo mes en curso.
  const recurringItems = analisisRecurringItems(baseData?.transactions || [], currentMonth?.key || openMonthCutoffKey());
  const recurringEl = qs("analisisRecurring");
  if (recurringEl) recurringEl.innerHTML = analisisRecurringHtml(recurringItems);
  const recurringNote = qs("analisisRecurringNote");
  if (recurringNote) {
    const note = analisisRecurringGrowthNote(recurringItems);
    recurringNote.innerHTML = note;
    recurringNote.hidden = !note;
  }

  // A16-3: recurrentes de importe fijo (candidatos a suscripción), sobre todo el histórico visible.
  const subscriptionsEl = qs("analisisSubscriptions");
  if (subscriptionsEl) subscriptionsEl.innerHTML = analisisSubscriptionsHtml(analisisSubscriptionsResult(baseData?.transactions || []));

  // P-1: desglose por tipo de acción, mismo periodo que la cascada de A-4.
  const actionTypeEl = qs("analisisActionTypeBreakdown");
  if (actionTypeEl) actionTypeEl.innerHTML = analisisActionTypeHtml(analisisActionTypeRows(baseData?.transactions || [], periodMonths));
}

function handleAnalisisWindow(windowKey) {
  if (!ANALISIS_WINDOWS[windowKey] || windowKey === analisisWindowKey) return;
  analisisWindowKey = windowKey;
  renderAnalisis();
}

