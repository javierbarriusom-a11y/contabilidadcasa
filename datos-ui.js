// WP-45 (ND-09 + CAP-07, docs/WP45_DISENO.md): la tarjeta «Frescura de tus datos y qué hacer primero» de Registrar › Saldos (el hash antiguo #update-hub redirige ahí). El cálculo vive en canonical-data-queue.js (puro); aquí se
// leen las fuentes que ya existen (saldos, extracto, cartera, índices, cierre, cobros y cargos esperados, tiempos medidos) y se pintan las fichas y la cola. NO hace ninguna tarea ni
// cambia un dato (A11-4): cada tarea lleva a la pantalla donde se hace. No guarda nada. Tampoco va a Hoy (congelado hasta H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, isoLocalDate, estadoHtml, state, canonicalLedgerTransactions, iv1PositionsList,
// loadPortfolioValuations, loadMonthCloseBalances, indicesLoad, expectedMovementsResult, readBalancePulseTimes, canonicalScenarioResults…). Sin llamadas al DOM ni escuchas al cargarse:
// app.js llama a `renderDatosCola` al pintar Registrar.

const DATOS_TONE_TEXT = { current: "Al día", recent: "Reciente", stale: "Antiguo", unknown: "Sin dato" };

function datosEngine() {
  return globalThis.FinanceCanonicalDataQueue;
}

function datosGuard(fn, fallback = null) {
  try { const value = fn(); return value === undefined ? fallback : value; } catch { return fallback; }
}

function datosEuros(value) {
  return money(value, true);
}

// Todo lo que ya sabe la app, tal cual; lo que no hay se pasa como null (dato ausente no es cero).
function datosSources(today) {
  const series = canonicalScenarioResults?.base?.forecast?.series || [];
  const outflows = series.slice(0, 12).map((row) => Number(row.totals?.outflowsBeforeSaving)).filter(Number.isFinite);
  const dailyOutflow = outflows.length ? outflows.reduce((sum, value) => sum + value, 0) / outflows.length / 30 : null;
  const balanceDate = state?.balanceDate || "";
  const balanceMode = state?.balanceMode === "auto" ? "auto" : "manual";
  const transactions = datosGuard(() => canonicalLedgerTransactions(), []) || [];
  const lastMovement = transactions.map((row) => String(row.date || "").slice(0, 10)).filter(Boolean).sort().at(-1) || null;
  const positions = datosGuard(() => iv1PositionsList(), []) || [];
  const valuedDates = positions.map((position) => String(position.asOf || "").slice(0, 10)).filter(Boolean);
  const lastValuation = valuedDates.length ? valuedDates.sort().at(-1) : null;
  const valuations = datosGuard(() => loadPortfolioValuations(), { timings: [] });
  const indicesEngine = globalThis.FinanceCanonicalRateIndices;
  let indices = null;
  if (indicesEngine) {
    const store = datosGuard(() => indicesLoad(), null);
    const statuses = indicesEngine.INDEX_IDS.map((id) => indicesEngine.status(store, id, today));
    const dates = statuses.map((item) => item.point && item.point.date).filter(Boolean).sort();
    indices = { lastDate: statuses.some((item) => item.state === "missing") ? null : dates[0] || null, expired: statuses.some((item) => item.state === "stale"), missing: statuses.filter((item) => item.state === "missing").length, total: statuses.length, staleAfter: Math.min(...indicesEngine.INDEX_IDS.map((id) => indicesEngine.INDICES[id].staleAfterDays)) };
  }
  const closes = datosGuard(() => loadMonthCloseBalances().months, {}) || {};
  const closeKeys = Object.keys(closes).sort();
  const lastClose = closeKeys.length ? closeKeys[closeKeys.length - 1] : null;
  const expected = datosGuard(() => expectedMovementsResult(), null);
  const pending = expected && expected.status === "ok" ? expected.items : [];
  return {
    dailyOutflow, balanceDate, balanceMode, lastMovement, lastValuation, positionsCount: positions.length, valuationSeconds: (valuations.timings || []).map((item) => Number(item.seconds)),
    pulseSeconds: datosGuard(() => readBalancePulseTimes().times.map((item) => Number(item.seconds)), []) || [],
    indices, lastClose, lastCloseKey: lastClose, pendingCount: pending.length + (expected && expected.overflow ? expected.overflow : 0), pendingAmount: pending.reduce((sum, item) => sum + Math.abs(Number(item.plannedAmount) || 0), 0),
  };
}

// El mes que se puede cerrar hoy (los días 1 a 3, el mes que acaba) y si ya está cerrado.
function datosCloseDeadline(today, lastCloseKey) {
  const day = Number(today.slice(8, 10));
  if (!(day >= 1 && day <= 3)) return null;
  const [year, month] = today.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const key = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
  return lastCloseKey && lastCloseKey >= key ? null : { key, text: `Hasta el día 3: cerrar ${key}` };
}

function datosCards(engine, source, today) {
  const dataAge = globalThis.FinanceCanonicalDataAge;
  const staleBalances = dataAge ? dataAge.STALE_AFTER_DAYS : 4;
  const cards = [];
  cards.push(source.balanceMode === "auto"
    ? { ...engine.freshnessCard({ id: "balances", label: "Saldos", lastDate: null, today, unknownText: "Calculados por calendario, sin foto del banco" }), action: { label: "Actualizar saldos", href: "#visual-detail" } }
    : engine.freshnessCard({ id: "balances", label: "Saldos", lastDate: source.balanceDate, today, staleAfterDays: staleBalances, unknownText: "Sin fecha de saldos", action: { label: "Actualizar saldos", href: "#visual-detail" } }));
  cards.push(engine.freshnessCard({ id: "statement", label: "Último movimiento importado", lastDate: source.lastMovement, today, staleAfterDays: staleBalances, unknownText: "Ningún extracto importado", action: { label: "Importar el extracto", href: "#movements" } }));
  cards.push(engine.freshnessCard({ id: "valuation", label: "Valoración de la cartera", lastDate: source.positionsCount ? source.lastValuation : null, today, staleAfterDays: 35, unknownText: source.positionsCount ? "Ninguna posición con fecha de valoración" : "Sin cartera registrada", action: source.positionsCount ? { label: "Actualizar valoración", href: "#inversion-cartera" } : null }));
  cards.push(source.indices
    ? engine.freshnessCard({ id: "indices", label: "Índices de referencia (Euribor, €STR, IPC)", lastDate: source.indices.lastDate, today, staleAfterDays: source.indices.staleAfter, expired: source.indices.expired, unknownText: source.indices.missing ? `Faltan ${source.indices.missing} de ${source.indices.total}` : "Sin dato", action: { label: "Teclear índices", href: "#deuda-contratos" } })
    : engine.freshnessCard({ id: "indices", label: "Índices de referencia", lastDate: null, today }));
  // El cierre no envejece por días: está al día si ya se cerró el mes que acaba de terminar; si no, falta uno (y los días 1 a 3 es una tarea con plazo).
  const [ty, tm] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(ty, tm - 2, 1));
  const prevKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const closed = Boolean(source.lastClose);
  const upToDate = closed && source.lastClose >= prevKey;
  const monthName = (key) => (datosGuard(() => registrarMesLongMonth(key), key) || key);
  cards.push({
    id: "close", label: "Último cierre de mes", tone: !closed ? "unknown" : upToDate ? "current" : "stale", icon: !closed ? "?" : upToDate ? "✓" : "⚠", ageDays: null,
    ageText: closed ? `último: ${monthName(source.lastClose)}` : "sin cierres", status: !closed ? "Ningún mes cerrado con saldos" : upToDate ? "Al día" : `Falta cerrar ${monthName(prevKey)}`,
    action: { label: "Ir a Conciliar y cerrar", href: "#reconciliation" },
  });
  cards.push({ id: "pending", label: "Cobros y cargos esperados sin responder", tone: source.pendingCount ? "stale" : "current", icon: source.pendingCount ? "⚠" : "✓", ageDays: null, ageText: source.pendingCount ? `${source.pendingCount} por responder` : "ninguno", status: source.pendingCount ? "Pendiente" : "Al día", action: source.pendingCount ? { label: "Responderlos", href: "#registrar" } : null });
  return cards;
}

function datosTasks(engine, source, today) {
  const balanceAge = source.balanceMode === "auto" || !source.balanceDate ? null : engine.daysBetween(source.balanceDate.slice(0, 10), today);
  const statementAge = source.lastMovement ? engine.daysBetween(source.lastMovement, today) : null;
  const balanceEstimate = engine.unloggedEstimate({ dailyOutflow: source.dailyOutflow, ageDays: balanceAge === null ? null : Math.max(0, balanceAge) });
  const statementEstimate = engine.unloggedEstimate({ dailyOutflow: source.dailyOutflow, ageDays: statementAge === null ? null : Math.max(0, statementAge) });
  const tasks = [];
  tasks.push({
    id: "balances", label: "Actualizar saldos", family: "cuentas", uncertainty: balanceEstimate.value,
    basis: balanceEstimate.value === null ? "" : `gasto diario medio de la previsión × ${balanceEstimate.days} días desde la fecha de los saldos${balanceEstimate.capped ? " (tope de 30)" : ""}`,
    reasonUnknown: source.balanceMode === "auto" ? "Los saldos se calculan por calendario: sin una foto del banco no sé cuánto se han movido." : "Sin fecha de saldos o sin gasto medio de la previsión.",
    minutes: engine.taskMinutes({ measuredSeconds: source.pulseSeconds, assumedMinutes: 20 / 60 }), action: { label: "Actualizar saldos", href: "#visual-detail" },
  });
  tasks.push({
    id: "statement", label: "Importar el extracto", family: "cuentas", absorbs: ["balances"], uncertainty: statementEstimate.value,
    basis: statementEstimate.value === null ? "" : `gasto diario medio de la previsión × ${statementEstimate.days} días desde el último movimiento (importar también pone al día el saldo)`,
    reasonUnknown: "Ningún extracto importado o sin gasto medio de la previsión.", minutes: engine.taskMinutes({ measuredSeconds: [], assumedMinutes: 2 }), action: { label: "Importar el extracto", href: "#movements" },
  });
  tasks.push({
    id: "pending", label: `Responder ${source.pendingCount} ${source.pendingCount === 1 ? "cobro o cargo esperado" : "cobros y cargos esperados"}`, uncertainty: source.pendingCount ? Math.round(source.pendingAmount * 100) / 100 : null,
    basis: source.pendingCount ? "suma de los importes previstos que aún no tienen respuesta" : "", reasonUnknown: "No hay cobros ni cargos esperados sin responder.",
    minutes: engine.taskMinutes({ measuredSeconds: [], assumedMinutes: Math.max(0.17, (source.pendingCount * 10) / 60) }), action: { label: "Responderlos", href: "#registrar" },
  });
  if (source.positionsCount) {
    tasks.push({
      id: "valuation", label: "Actualizar la valoración de la cartera", uncertainty: null,
      reasonUnknown: "No sé cuánto se ha movido: la volatilidad de vuestra cartera no está medida (hacen falta ≥ 3 valoraciones, y aún no se estima).",
      minutes: engine.taskMinutes({ measuredSeconds: source.valuationSeconds, assumedMinutes: 1 }), action: { label: "Actualizar valoración", href: "#inversion-cartera" },
    });
  }
  if (source.indices && (source.indices.expired || source.indices.missing)) {
    tasks.push({
      id: "indices", label: "Teclear los índices de referencia", uncertainty: null,
      reasonUnknown: "No sé cuánto cambia una cifra: hace falta el contrato de la hipoteca con su índice para estimar la cuota (se teclea en Deuda › Contratos).",
      minutes: engine.taskMinutes({ measuredSeconds: [], assumedMinutes: 1 }), action: { label: "Teclear índices", href: "#deuda-contratos" },
    });
  }
  const deadline = datosCloseDeadline(today, source.lastCloseKey);
  if (deadline) tasks.push({ id: "close", label: `Cerrar ${deadline.key}`, deadline: deadline.text, uncertainty: null, minutes: engine.taskMinutes({ measuredSeconds: [], assumedMinutes: 3 }), action: { label: "Ir a Conciliar y cerrar", href: "#reconciliation" } });
  return tasks;
}

function datosCardHtml(card) {
  const action = card.action ? `<a class="e19-btn e19-btn-secondary dat-ir" href="${escapeHtml(card.action.href)}" aria-label="${escapeHtml(card.action.label)}: ${escapeHtml(card.label)}">${escapeHtml(card.action.label)}</a>` : "";
  return `<li class="dat-ficha" data-dat-ficha="${escapeHtml(card.id)}" data-dat-tono="${escapeHtml(card.tone)}">
      <p class="dat-cabecera"><span class="dat-icono" aria-hidden="true">${escapeHtml(card.icon)}</span> <strong>${escapeHtml(card.label)}</strong></p>
      <p><span class="dat-estado">${escapeHtml(card.status || DATOS_TONE_TEXT[card.tone])}</span> · ${escapeHtml(card.ageText)}</p>${action}</li>`;
}

function datosMinutesText(minutes) {
  const seconds = Math.round(minutes.value * 60);
  const label = seconds < 90 ? `${seconds} s` : `${String(Math.round(minutes.value * 10) / 10).replace(".", ",")} min`;
  return `${label} (${minutes.measured ? `medido, ${minutes.samples} usos` : "sin medir: supuesto"})`;
}

function datosTaskHtml(task) {
  const link = task.action ? `<a class="e19-btn e19-btn-primary dat-ir" href="${escapeHtml(task.action.href)}">${escapeHtml(task.action.label)}</a>` : "";
  if (task.uncertainty === null || task.uncertainty === undefined) {
    return `<li class="dat-tarea" data-dat-tarea="${escapeHtml(task.id)}"><p class="dat-cabecera"><strong>${escapeHtml(task.label)}</strong> <span class="dat-estado">${task.deadline ? escapeHtml(task.deadline) : "Sin estimar"}</span></p>
      ${task.deadline ? "" : `<p>${escapeHtml(task.reason || "")}</p>`}<p class="e19-kpi-note">Tiempo: ${escapeHtml(datosMinutesText(task.minutes))}.</p>${link}</li>`;
  }
  return `<li class="dat-tarea" data-dat-tarea="${escapeHtml(task.id)}"><p class="dat-cabecera"><span class="dat-num" aria-hidden="true">${task.rank}</span> <strong>${escapeHtml(task.label)}</strong></p>
      <p>Puede moverse hasta <strong>${datosEuros(task.uncertainty)}</strong> · <strong>${datosEuros(task.valuePerMinute)}</strong> por minuto${task.absorbed ? " · <em>queda resuelta al importar el extracto</em>" : ""}</p>
      <p class="e19-kpi-note">Tiempo: ${escapeHtml(datosMinutesText(task.minutes))}. Cálculo: ${escapeHtml(task.basis)}.</p>${link}</li>`;
}

function datosBodyHtml(engine) {
  const today = isoLocalDate(new Date());
  const source = datosSources(today);
  const cards = datosCards(engine, source, today);
  const queue = engine.buildQueue({ tasks: datosTasks(engine, source, today), budgetMinutes: engine.DEFAULT_BUDGET_MINUTES });
  const fichas = `<ul class="dat-fichas" aria-label="Frescura por fuente">${cards.map(datosCardHtml).join("")}</ul>`;
  const anyStale = cards.some((card) => card.tone === "stale");
  let plan;
  if (queue.plan.ids.length) {
    const names = queue.plan.ids.map((id) => queue.ranked.find((task) => task.id === id).label.toLowerCase());
    plan = `<p class="dat-plan"><strong>Con ${engine.DEFAULT_BUDGET_MINUTES} minutos hoy:</strong> ${names.join(" y ")} (≈ ${String(queue.plan.minutes).replace(".", ",")} min) quitan hasta <strong>${datosEuros(queue.plan.resolved)}</strong> de los ${datosEuros(queue.plan.total)} de incertidumbre estimada.${queue.plan.anyUnmeasured ? " Parte del tiempo es un supuesto, no una medida." : ""}</p>`;
  } else if (queue.allClear && !anyStale) {
    plan = `<p class="dat-plan"><strong>Todo al día.</strong> No hay ninguna tarea de datos con efecto estimable.</p>`;
  } else plan = "";
  const deadlines = queue.deadlines.length ? `<ul class="dat-lista">${queue.deadlines.map(datosTaskHtml).join("")}</ul>` : "";
  const ranked = queue.ranked.length ? `<ol class="dat-lista" aria-label="Tareas de datos, de más a menos incertidumbre por minuto">${queue.ranked.map(datosTaskHtml).join("")}</ol>` : "";
  const notEstimable = queue.unestimated.filter((task) => task.id !== "pending"); // «nada pendiente» no es una tarea sin estimar
  const unestimated = notEstimable.length ? `<h4>Sin estimar</h4><ul class="dat-lista">${notEstimable.map(datosTaskHtml).join("")}</ul>` : "";
  return `${fichas}${plan}${deadlines}${ranked}${unestimated}<p class="e19-kpi-note">«Puede moverse hasta» es una estimación mía (gasto diario medio de la previsión × días sin actualizar, con tope de 30), no un dato: dice cuánto puede haber cambiado la cifra, no cuánto ha cambiado. No hago ninguna tarea por vosotros.</p>`;
}

function renderDatosCola(engine) {
  const box = qs("datosCuerpo");
  if (!box || !engine) return;
  try {
    const html = datosBodyHtml(engine);
    if (box.__datosHtml !== html) {
      box.innerHTML = html;
      box.__datosHtml = html;
    }
  } catch {
    box.textContent = "No se pudo calcular la frescura con los datos actuales.";
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Desalojado de app.js (XGO-01 · PR-1, sesión 329, 20/10/2026), sin cambiar una coma: Datos (Movimientos, importación de extractos, auditoría de datos, enlaces y resúmenes de Herramientas › Datos).
// Siguen siendo funciones globales del mismo ámbito que app.js; este fichero se carga antes que él, así que ya
// existen cuando app.js arranca. Solo declaraciones de función: nada se ejecuta al cargar.

function auditBreakdown(counts, labels, total, kind) {
  return Object.entries(labels).map(([key, label]) => {
    const value = Number(counts?.[key] || 0);
    const percentage = total ? Math.round((value / total) * 100) : 0;
    return `<div class="audit-breakdown-row">
      <div><span class="audit-badge ${kind}-${escapeHtml(key)}">${escapeHtml(label)}</span><strong>${value}</strong></div>
      <div class="audit-meter" aria-label="${escapeHtml(label)}: ${percentage}%"><span style="width:${percentage}%"></span></div>
    </div>`;
  }).join("");
}

function renderDataAudit() {
  if (!window.FinanceCanonicalState) return;
  const snapshot = refreshCanonicalSnapshot("audit-view");
  if (!snapshot) return;
  const rows = canonicalRows(snapshot);
  const quality = snapshot.quality || {};
  const generatedDate = new Date(snapshot.generatedAt || Date.now());
  const generatedLabel = Number.isNaN(generatedDate.getTime())
    ? "Sin fecha"
    : generatedDate.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  const verified = Number(quality.provenance?.verified || 0);

  qs("auditKpis").innerHTML = [
    ["Calidad del inventario", `${Number(quality.score || 0)}%`, `${Number(quality.issueCount || 0)} incidencia(s) detectada(s)`, Number(quality.score || 0) >= 90 ? "good" : "warn"],
    ["Entidades persistidas", String(rows.length), "Proyectos, deuda, ajustes, reales y saldos", "neutral"],
    ["Datos verificados", String(verified), `${rows.length ? Math.round((verified / rows.length) * 100) : 0}% del inventario tiene evidencia real`, "good"],
    ["Última consolidación", generatedLabel, `Huella ${snapshot.fingerprint || "sin huella"}`, "neutral"],
  ].map(([label, value, detail, tone]) => `<article class="audit-kpi ${tone}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <p>${escapeHtml(detail)}</p>
  </article>`).join("");

  qs("auditProvenance").innerHTML = auditBreakdown(quality.provenance, canonicalProvenanceLabels, rows.length, "provenance");
  const issues = Array.isArray(quality.issues) ? quality.issues : [];
  qs("auditQuality").innerHTML = issues.length
    ? `<div class="audit-issue-list">${issues.map((issue) => `<div class="audit-issue ${escapeHtml(issue.severity || "warning")}">
        <strong>${issue.code === "duplicate-identity" ? "Identidad duplicada" : "Dato incompleto"}</strong>
        <span>${escapeHtml(issue.label || issue.entityId || "Revisar registro")}</span>
      </div>`).join("")}</div>`
    : `<div class="audit-empty good"><strong>Sin incidencias estructurales</strong><p>Todos los registros tienen identidad estable, estado, procedencia e importe válido.</p></div>`;
  renderE6DebtQuality();
  renderE6KpiQuality();

  qs("auditEntityTable").innerHTML = rows.length
    ? rows.slice().sort((a, b) => `${a.collection}-${a.label}`.localeCompare(`${b.collection}-${b.label}`, "es")).map((row) => `<tr>
        <td>${escapeHtml(canonicalTypeLabels[row.collection] || row.kind || row.collection)}</td>
        <td><strong>${escapeHtml(row.label || "Sin nombre")}</strong><small>${escapeHtml(row.source || "Sin fuente")}</small></td>
        <td><span class="audit-badge status-${escapeHtml(row.status)}">${escapeHtml(canonicalStatusLabels[row.status] || row.status)}</span></td>
        <td><span class="audit-badge provenance-${escapeHtml(row.provenance)}">${escapeHtml(canonicalProvenanceLabels[row.provenance] || row.provenance)}</span></td>
        <td>${money(Number(row.amount || 0), true)}</td>
        <td>${escapeHtml(row.monthKey || "-")}</td>
        <td><code>${escapeHtml(row.id)}</code></td>
      </tr>`).join("")
    : `<tr><td colspan="7"><div class="audit-empty"><strong>Sin entidades persistidas</strong><p>El modelo base sigue operativo; aquí aparecerán datos cargados, editados o confirmados.</p></div></td></tr>`;

  const trail = Array.isArray(snapshot.auditTrail) ? snapshot.auditTrail : [];
  qs("auditTimeline").innerHTML = trail.length
    ? trail.map((item) => {
        const date = new Date(item.at || Date.now());
        const dateLabel = Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
        const changes = item.changes || {};
        return `<div class="audit-timeline-item">
          <span>${escapeHtml(dateLabel)}</span>
          <div><strong>${escapeHtml(String(item.reason || "actualización").replaceAll("-", " "))}</strong>
          <p>+${Number(changes.added || 0)} altas · ${Number(changes.changed || 0)} cambios · ${Number(changes.removed || 0)} bajas</p></div>
          <code>${escapeHtml(item.fingerprint || "")}</code>
        </div>`;
      }).join("")
    : `<div class="audit-empty"><strong>Sin cambios registrados</strong><p>La primera modificación generará una entrada de auditoría.</p></div>`;
  renderE8AuditExtensions(snapshot, rows);
}

// A16-6 · hitos y rachas en el historial de auditoría. Reutiliza monthClosures tal cual, el mismo
// historial que ya lee latestMonthOperation/isMonthClosed — sin tabla ni estado nuevo.
function renderAuditMilestonesStreaks() {
  const target = qs("a166MilestonesStreaks");
  if (!target) return;
  const result = window.FinanceCanonicalE5?.auditMilestonesAndStreaks(monthClosures);
  if (!result) return;
  const streakText = result.currentStreak > 0
    ? `Racha actual: ${result.currentStreak} mes(es) cerrados seguidos${result.currentStreak === result.longestStreak && result.longestStreak > 0 ? " (tu mejor racha)" : ""}.`
    : "Sin racha activa: el mes más reciente no está cerrado o hay un hueco.";
  const milestonesText = result.reachedMilestones.length
    ? `Hitos alcanzados: ${result.reachedMilestones.join(", ")} meses cerrados.`
    : "Todavía sin hitos alcanzados.";
  const nextText = result.nextMilestone !== null
    ? `Próximo hito: ${result.nextMilestone} meses (${result.monthsUntilNextMilestone} por delante).`
    : "Has alcanzado todos los hitos definidos.";
  target.innerHTML = `<div class="audit-kpi-grid">
    <article class="audit-kpi good"><span>Meses cerrados</span><strong>${result.totalClosed}</strong><p>${escapeHtml(streakText)}</p></article>
    <article class="audit-kpi ${result.longestStreak > 0 ? "good" : "warn"}"><span>Racha más larga</span><strong>${result.longestStreak}</strong><p>meses consecutivos cerrados, sin huecos ni reaperturas</p></article>
    <article class="audit-kpi"><span>Hitos</span><strong>${result.reachedMilestones.length}/${result.milestones.length}</strong><p>${escapeHtml(milestonesText)} ${escapeHtml(nextText)}</p></article>
  </div>`;
}

function renderE8AuditExtensions(snapshot, rows) {
  const e8 = window.FinanceCanonicalE8;
  if (!e8) return;
  const started = performance.now();
  const movements = p2MovementRows();
  const debtQuality = canonicalDebtContractRows().map((contract) => {
    const quality = contract.dataQuality || DebtContracts?.contractQuality(contract, contract) || {};
    return { id: contract.id, label: `${contract.entity || "Deuda"} ${contract.type || ""}`.trim(), unknownFields: quality.missing || [] };
  });
  const executive = Object.values(unifiedActionCenterModel().readModel?.metrics || {});
  const quality = e8.qualityCenter({ canonicalIssues: snapshot?.quality?.issues, debtQuality, kpis: executive, movements });
  const qualityTarget = qs("e8QualityCenter");
  if (qualityTarget) qualityTarget.innerHTML = quality.issues.length
    ? `<div class="audit-issue-list">${quality.issues.slice(0, 50).map((issue) => `<button type="button" class="audit-issue ${escapeHtml(issue.severity)}" data-e8-quality-target="${escapeHtml(issue.target)}"><strong>${escapeHtml(issue.kind)}</strong><span>${escapeHtml(issue.label)}</span></button>`).join("")}</div>${quality.total > 50 ? `<p>Se muestran 50 de ${quality.total} incidencias.</p>` : ""}`
    : `<div class="audit-empty good"><strong>Calidad completa</strong><p>No hay elementos pendientes en las fuentes revisadas.</p></div>`;
  const queueState = remoteSaveQueue?.snapshot?.();
  const localConflict = queueState?.lastError?.code === "REMOTE_WRITE_CONFLICT"
    ? [{ id: "local-conflict", created_at: new Date().toISOString(), status: "conflict" }]
    : [];
  const timeline = e8.operationalTimeline({ snapshots: e8RemoteHistory.snapshots, syncEvents: [...e8RemoteHistory.syncEvents, ...localConflict], closures: monthClosures, auditTrail: snapshot?.auditTrail });
  const timelineTarget = qs("e8OperationalTimeline");
  if (timelineTarget) timelineTarget.innerHTML = timeline.length
    ? timeline.slice(0, 30).map((item) => `<div class="audit-timeline-item"><span>${escapeHtml(new Date(item.at).toLocaleString("es-ES"))}</span><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.type)} · ${escapeHtml(item.status)}</p></div></div>`).join("")
    : `<div class="audit-empty"><strong>Sin eventos operativos</strong></div>`;
  renderAuditMilestonesStreaks();
  const payloadBytes = new TextEncoder().encode(JSON.stringify(appStatePayload({ includeCanonical: false }))).length;
  const budget = e8.performanceBudget({ rowCount: rows.length + movements.length, renderMs: performance.now() - started, payloadBytes });
  const budgetTarget = qs("e8PerformanceBudget");
  if (budgetTarget) budgetTarget.innerHTML = `<div class="audit-kpi-grid"><article class="audit-kpi ${budget.checks.rowCount ? "good" : "warn"}"><span>Filas</span><strong>${budget.measured.rowCount}</strong><p>Límite ${budget.limits.rowCount}</p></article><article class="audit-kpi ${budget.checks.renderMs ? "good" : "warn"}"><span>Preparación</span><strong>${budget.measured.renderMs.toFixed(1)} ms</strong><p>Límite ${budget.limits.renderMs} ms</p></article><article class="audit-kpi ${budget.checks.payloadBytes ? "good" : "warn"}"><span>Estado</span><strong>${(budget.measured.payloadBytes / 1024).toFixed(0)} KB</strong><p>Límite ${(budget.limits.payloadBytes / 1024 / 1024).toFixed(0)} MB</p></article></div>`;
  loadE8RemoteHistory();
}

async function loadE8RemoteHistory() {
  if (!supabaseClient || !remoteUser || e8RemoteHistoryLoading || e8RemoteHistory.snapshots.length) return;
  e8RemoteHistoryLoading = true;
  try {
    const [snapshots, syncEvents] = await Promise.all([
      supabaseClient.from("finance_state_snapshots").select("id,created_at,fingerprint,state").eq("source_key", sourceStateKey()).order("created_at", { ascending: false }).limit(30),
      supabaseClient.from("finance_sync_runs").select("id,status,started_at,completed_at,metadata").eq("source_key", sourceStateKey()).order("started_at", { ascending: false }).limit(30),
    ]);
    if (!snapshots.error && !syncEvents.error) {
      e8RemoteHistory = { snapshots: snapshots.data || [], syncEvents: (syncEvents.data || []).map((row) => ({ ...row, created_at: row.completed_at || row.started_at, status: row.status === "failed" ? "conflict" : row.status })) };
      if (viewFromHash() === "data-audit") renderDataAudit();
    }
  } finally { e8RemoteHistoryLoading = false; }
}

function renderE6DebtQuality() {
  const target = qs("e6DebtQuality");
  if (!target || !DebtContracts) return;
  const contracts = canonicalDebtContractRows();
  target.innerHTML = contracts.length ? `<div class="e6-quality-list">${contracts.map((contract) => {
    const quality = contract.dataQuality || DebtContracts.contractQuality(contract, contract);
    const missing = quality.missing || [];
    // UX4: la píldora de completitud llevaba solo el color como diferencia entre sus tres estados —
    // se añade la palabra ("completo"/"parcial"/"incompleto") para que no dependa solo de él.
    const completenessWord = quality.complete ? "completo" : quality.completeness >= 75 ? "parcial" : "incompleto";
    return `<article class="e6-quality-card"><header><strong>${escapeHtml(`${contract.entity} ${contract.type}`)}</strong><span class="status-pill ${quality.complete ? "good" : quality.completeness >= 75 ? "warn" : "danger"}">${quality.completeness}% ${completenessWord}</span></header>
      <p>${missing.length ? `Desconocido: ${missing.map((field) => e6DebtFieldLabels[field] || field).join(", ")}.` : "Contrato completo para el análisis."}</p>
      <p>Confianza ${escapeHtml(quality.confidence)} · fuente ${escapeHtml(contract.source || "desconocida")}.</p></article>`;
  }).join("")}</div>` : `<div class="audit-empty"><strong>Sin contratos</strong><p>No hay deuda que revisar.</p></div>`;
}

function renderE6KpiQuality() {
  const target = qs("e6KpiQuality");
  if (!target) return;
  const model = unifiedActionCenterModel().readModel;
  const metrics = Object.values(model?.metrics || {});
  const ledgerEntries = canonicalLedgerSnapshot?.entries || [];
  const calibrated = E7Analysis?.calibrateScenarios(ledgerEntries.map((entry) => ({
    ...entry,
    reconciled: entry.reconciled === true || entry.status === "matched" || entry.reconciliationStatus === "matched",
  })), { horizonMonths: forecastMonths().length });
  const scenarioHtml = calibrated ? `<div class="e7-scenario-quality"><strong>Escenarios probabilísticos</strong><p>Solo histórico conciliado · ${calibrated.sampleMonths} mes(es) · confianza ${escapeHtml(calibrated.confidence)} · salida ${calibrated.display === "range" ? "por bandas" : "puntual"}.</p><div class="e6-quality-list">${calibrated.scenarios.map((scenario) => `<article class="e6-quality-card"><header><strong>${scenario.id === "stress" ? "Tensión" : scenario.id === "optimistic" ? "Optimista" : "Base"}</strong><span class="status-pill ${scenario.calibrated ? "warn" : "danger"}">P${Math.round(scenario.percentile * 100)} · ${scenario.calibrated ? "calibrado" : "sin calibrar"}</span></header><p>Flujo mensual calibrado: ${money(scenario.monthlyNet, true)}.</p></article>`).join("")}</div>${calibrated.warning ? `<p class="debt-review-note">${escapeHtml(calibrated.warning)}</p>` : ""}</div>` : "";
  target.innerHTML = (metrics.length ? `<div class="e6-quality-list">${metrics.map((item) => `<article class="e6-quality-card">
    <header><strong>${escapeHtml(item.label)}</strong><span class="status-pill ${item.confidence === "high" ? "good" : item.confidence === "medium" ? "warn" : "danger"}">${escapeHtml(item.confidence)}</span></header>
    <dl><dt>Fecha</dt><dd>${escapeHtml(item.asOf)}</dd><dt>Fuente</dt><dd>${escapeHtml(item.source)}</dd><dt>Método</dt><dd>${escapeHtml(item.method)}</dd><dt>Cobertura</dt><dd>${escapeHtml(item.coverage)}</dd></dl>
  </article>`).join("")}</div>` : `<div class="audit-empty"><strong>Sin lectura ejecutiva</strong><p>Calcula el escenario para generar los KPI.</p></div>`) + scenarioHtml;
}

// MDX1: fuente de las cifras de la vista para hijos — colchón (liquidez total de las cuentas
// declaradas) y patrimonio neto (A14-2, ya calculado por lpNetWorthSnapshot para LPX1/LPX2). Sin
// activos declarados, netWorth queda null explícito — nunca un cero inventado.
// T13: añade periodicHelp/projection, ambos opcionales y declarados por el hogar — ver
// t13KidsSummaryExtras().
function mdx1KidsSummarySource() {
  const balances = accountBalancesFromState();
  const netWorthSnapshot = lpNetWorthSnapshot();
  const extras = t13KidsSummaryExtras();
  return {
    cushion: Number.isFinite(Number(balances?.total)) ? balances.total : null,
    netWorth: netWorthSnapshot.calculable ? netWorthSnapshot.netWorth : null,
    periodicHelp: extras.periodicHelp,
    projection: extras.projection,
  };
}

function a19ShareUrl(rawToken) {
  const basePath = location.pathname.replace(/index\.html$/, "");
  return `${location.origin}${basePath}share.html#token=${encodeURIComponent(rawToken)}`;
}

async function saveA19ShareLink() {
  const engine = window.FinanceCanonicalShareLink;
  const status = qs("a19ShareStatus");
  if (!engine) return;
  if (!supabaseClient || !remoteUser) {
    if (status) status.textContent = "Inicia sesión para generar un enlace compartible.";
    return;
  }
  const viewType = qs("a19ShareViewType")?.value || "";
  if (!engine.VIEW_TYPES.includes(viewType)) {
    if (status) status.textContent = "Selecciona qué vista quieres compartir.";
    return;
  }
  const ttlDays = engine.normalizeTtlDays(parseAmount(qs("a19ShareTtlDays")?.value));
  const sourceData = viewType === "debt-plan"
    ? canonicalDebtContractRows()
    : viewType === "kids-summary"
      ? mdx1KidsSummarySource()
      : (canonicalScenarioResults.base?.forecast?.series || []);
  const payload = engine.buildSharePayload(viewType, sourceData);
  const rawToken = engine.generateShareToken();
  const tokenHash = await engine.hashToken(rawToken);
  const expiresAt = engine.expiresAtFrom(ttlDays);
  const { error } = await supabaseClient.from("finance_share_links").insert({
    owner_user_id: remoteUser.id,
    token_hash: tokenHash,
    view_type: viewType,
    payload,
    expires_at: expiresAt,
  });
  if (error) {
    if (status) status.textContent = "No se pudo generar el enlace. Vuelve a intentarlo.";
    return;
  }
  if (status) status.textContent = `Enlace generado (caduca el ${expiresAt.slice(0, 10)}): ${a19ShareUrl(rawToken)}`;
  renderA19ShareLinkList();
}

async function renderA19ShareLinkList() {
  const list = qs("a19ShareLinkList");
  if (!list) return;
  if (!supabaseClient || !remoteUser) {
    list.innerHTML = `<li class="e19-kpi-note">Inicia sesión para ver tus enlaces compartidos.</li>`;
    return;
  }
  const engine = window.FinanceCanonicalShareLink;
  const { data, error } = await supabaseClient
    .from("finance_share_links")
    .select("id,view_type,created_at,expires_at,revoked_at")
    .eq("owner_user_id", remoteUser.id)
    .order("created_at", { ascending: false });
  if (error || !data) {
    list.innerHTML = `<li class="e19-kpi-note">No se pudieron cargar los enlaces.</li>`;
    return;
  }
  list.innerHTML = data.length
    ? data.map((row) => {
        const expired = engine ? engine.isExpired(row.expires_at, row.revoked_at) : true;
        const statusLabel = row.revoked_at ? "revocado" : expired ? "caducado" : `activo hasta ${String(row.expires_at).slice(0, 10)}`;
        const revokeButton = row.revoked_at ? "" : `<button type="button" class="e19-btn e19-btn-secondary" data-a19-share-revoke="${escapeHtml(row.id)}">Revocar</button>`;
        return `<li class="commit-barrier-item"><strong>${escapeHtml(A19_SHARE_VIEW_LABELS[row.view_type] || row.view_type)}</strong><span>${escapeHtml(statusLabel)} · creado ${escapeHtml(String(row.created_at).slice(0, 10))}</span>${revokeButton}</li>`;
      }).join("")
    : `<li class="e19-kpi-note">Sin enlaces compartidos todavía.</li>`;
}

function syncT13KidsSummaryControls() {
  [
    ["t13PeriodicHelpAmount", state?.t13PeriodicHelpAmount],
    ["t13ChildMonthlyAmount", state?.t13ChildMonthlyAmount],
    ["t13ChildYears", state?.t13ChildYears],
  ].forEach(([id, value]) => {
    const field = qs(id);
    if (!field || document.activeElement === field) return;
    const amount = Number(value || 0);
    field.value = amount > 0 ? String(amount) : "";
  });
  const pctField = qs("t13ChildAnnualReturnPct");
  if (pctField && document.activeElement !== pctField) {
    const pct = Number(state?.t13ChildAnnualReturnPct || 0);
    pctField.value = pct > 0 ? String(pct) : "";
  }
}

function handleT13KidsSummaryFieldChange(field, { max = Infinity } = {}) {
  return (event) => {
    if (!state) return;
    const next = field === "t13ChildAnnualReturnPct"
      ? fiscalNumericFieldFromValue(event.target.value, { max })
      : lifeInsuranceCapitalFromField(event.target.value);
    const previous = round2(Math.max(0, Number(state[field] || 0)));
    event.target.value = next > 0 ? String(next) : "";
    if (next === previous) return;
    state[field] = next;
    saveScenarioSettings();
  };
}

function rgx1AccessLossReadiness(state, backupAt, now = new Date()) {
  const backupCheck = (() => {
    const backupTime = backupAt ? new Date(backupAt).getTime() : NaN;
    if (!Number.isFinite(backupTime)) return { id: "backup", ok: false, detail: "Nunca se ha descargado una copia de emergencia." };
    const ageDays = Math.floor((now.getTime() - backupTime) / (24 * 60 * 60 * 1000));
    return ageDays <= RGX1_BACKUP_STALE_DAYS
      ? { id: "backup", ok: true, detail: `Última copia hace ${ageDays} día(s).` }
      : { id: "backup", ok: false, detail: `Última copia hace ${ageDays} día(s) — más de ${RGX1_BACKUP_STALE_DAYS}.` };
  })();
  const active = (state?.members || []).filter((member) => member.status === "active");
  const stewards = active.filter((member) => member.role === "owner" || member.role === "admin");
  const householdCheck = stewards.length >= 2
    ? { id: "household", ok: true, detail: `${stewards.length} personas con rol de propietario o administrador.` }
    : { id: "household", ok: false, detail: active.length <= 1 ? "Nadie más tiene acceso al hogar compartido todavía." : "Solo una persona tiene rol de propietario o administrador." };
  const concentration = rgxKnowledgeConcentration(state);
  const coverageCheck = { id: "coverage", ok: !concentration, detail: concentration ? `${concentration.areas.length} área(s) con un solo punto de acceso.` : "Cada área compartida tiene al menos dos personas con acceso." };
  const checks = [backupCheck, householdCheck, coverageCheck];
  return { checks, ready: checks.every((check) => check.ok) };
}

function renderRgx1AccessDrill() {
  const container = qs("rgx1AccessDrill");
  if (!container) return;
  const result = rgx1AccessLossReadiness(rgxHouseholdState(), scenarioSettings.lastEmergencyBackupAt);
  const itemsHtml = result.checks.map((check) => `<li class="${check.ok ? "" : "negative"}"><strong>${escapeHtml(RGX1_CHECK_LABELS[check.id])}:</strong> ${escapeHtml(check.detail)}</li>`).join("");
  container.innerHTML = `<ul class="e19-kpi-note">${itemsHtml}</ul>${result.ready ? "<p>Preparación completa frente a una pérdida de acceso.</p>" : ""}`;
}

function renderMerchants() {
  qs("merchantList").innerHTML = baseData.topMerchants
    .slice(0, 12)
    .map(
      (item) => `<div class="merchant">
        <div><strong>${item.Movimiento}</strong><br><span>${item.Categoria}</span></div>
        <strong>${money(item.amount, true)}</strong>
      </div>`,
    )
    .join("");
  renderMovementImportReview();
  renderDetailedMovements();
}

function renderMovementImportReview() {
  const panel = qs("movementMappingReview");
  if (!panel) return;
  // Repaso pixel-perfect del 20 de agosto: este panel vivía dentro de la tarjeta «Cargar
  // movimientos desde Excel», retirada junto con MOVEMENTS_EXCEL_IMPORT_LEGACY_READONLY — sin la
  // tarjeta que lo aloja, no tiene sitio propio donde pintarse.
  if (MOVEMENTS_EXCEL_IMPORT_LEGACY_READONLY) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }
  const dictionaryCount = Object.keys(movementMappings).length;
  if (!pendingMovementMappings.length) {
    panel.hidden = false;
    panel.innerHTML = `<div class="movement-mapping-empty">
      <strong>Diccionario activo: ${dictionaryCount} relación(es)</strong>
      <p>Cuando un movimiento no coincida con ninguna partida del Cuadro de mandos, aparecerá aquí para asignarlo.</p>
    </div>`;
    return;
  }
  panel.hidden = false;
  panel.innerHTML = `<div class="movement-mapping-head">
      <div>
        <strong>${pendingMovementMappings.length} movimiento(s) por relacionar</strong>
        <p>El signo del importe ya separa ingresos y gastos. Elige la partida del Cuadro de mandos y guardaremos la relación para próximos ficheros.</p>
      </div>
      <button id="applyMovementMappings" type="button">Guardar relaciones</button>
    </div>
    <div class="table-wrap movement-mapping-table-wrap">
      <table class="movement-mapping-table">
        <thead><tr><th>Tipo</th><th>Movimiento del banco</th><th>Total detectado</th><th>Asignar a partida</th></tr></thead>
        <tbody>
          ${pendingMovementMappings
            .map(
              (item) => `<tr>
                <td>${item.kind === "income" ? "Ingreso" : "Gasto"}</td>
                <td><strong>${escapeHtml(item.label)}</strong><small>${item.count} mov.; ejemplo ${escapeHtml(formatIsoDate(item.examples[0]?.date))}</small></td>
                <td>${money(item.total, true)}</td>
                <td><select data-movement-map-key="${escapeHtml(item.key)}" data-movement-map-kind="${escapeHtml(item.kind)}">${movementMappingOptions(item.kind)}</select></td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  qs("applyMovementMappings")?.addEventListener("click", applyPendingMovementMappings);
}

function applyPendingMovementMappings() {
  let changed = 0;
  document.querySelectorAll("[data-movement-map-key]").forEach((select) => {
    if (!select.value) return;
    movementMappings[select.dataset.movementMapKey] = {
      kind: select.dataset.movementMapKind,
      rowKey: select.value,
      label: select.options[select.selectedIndex]?.textContent || "",
      updatedAt: new Date().toISOString(),
    };
    changed += 1;
  });
  if (!changed) {
    qs("movementImportStatus").innerHTML = `<strong>No se guardó ninguna relación</strong><p>Selecciona una partida antes de guardar.</p>`;
    return;
  }
  saveMovementMappings();
  const applied = applyMovementMappingsToActuals();
  pendingMovementMappings = buildPendingMovementMappings(baseData.transactions || []);
  saveIncomeActuals();
  saveExpenseActuals();
  refreshAllSectionsAfterDataChange();
  qs("movementImportStatus").innerHTML = `<strong>${changed} relación(es) guardada(s)</strong><p>${applied} importe(s) reales recalculados desde movimientos. ${fullRefreshMessage()}</p>`;
}

function latestStatementBalance(transactions) {
  return (transactions || [])
    .filter((row) => row.balance !== null && row.balance !== undefined && row.date)
    .sort((a, b) => {
      const dateCompare = String(b.date).localeCompare(String(a.date));
      if (dateCompare) return dateCompare;
      return Number(a.statementOrder || 0) - Number(b.statementOrder || 0);
    })[0];
}

function applyMovementBalance(transaction) {
  if (!transaction || transaction.balance === null || transaction.balance === undefined) return null;
  const current = accountBalancesFromState();
  qs("balanceMode").value = "manual";
  qs("balanceDate").value = transaction.date;
  state.balanceMode = "manual";
  state.balanceDate = transaction.date;
  setStateAccountBalances({
    caixa: Number(transaction.balance || 0),
    mediolanum: current.mediolanum,
  });
  saveBalanceSettings();
  return accountBalancesFromState();
}

async function handleMovementExcelImport(event) {
  if (MOVEMENTS_EXCEL_IMPORT_LEGACY_READONLY) return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (!window.XLSX || typeof window.XLSX.read !== "function") {
    qs("movementImportStatus").innerHTML = `<strong>Excel todavía está cargando</strong><p>Pasa la primera vez que se usa en la sesión. Espera unos segundos y vuelve a intentarlo.</p>`;
    return;
  }
  try {
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const imported = loadTransactionsFromWorkbook(workbook);
    if (!imported.length) {
      qs("movementImportStatus").innerHTML = `<strong>Sin movimientos detectados</strong><p>El fichero debe incluir una hoja Movimientos_cuenta con Fecha, Movimiento, Importe y Saldo.</p>`;
      return;
    }
    const before = baseData.transactions || [];
    const merged = mergeTransactions(before, imported);
    const comparison = E7Analysis?.compareImport(before, merged, { invariants: { finiteMovements: imported.every((row) => Number.isFinite(Number(row.amount))) } }) || { valid: true, additions: imported, changes: [], duplicates: [], removals: [] };
    const inboxItem = addE11bInboxItem({ source: "bank-statement", fileName: file.name, sourceLabel: file.name, bankStatement: true, rows: imported, comparison, legacyAdapter: "movement-import" });
    pendingE11bApply = { imported, inboxItem };
    qs("movementImportStatus").innerHTML = `<strong>Vista previa · aún no se ha incorporado nada</strong><p>${comparison.additions?.length || 0} alta(s), ${comparison.duplicates?.length || 0} duplicado(s) y ${buildPendingMovementMappings(imported).length} relación(es) por revisar.</p><div class="data-actions"><button id="confirmMovementInbox" type="button" ${comparison.valid === false ? "disabled" : ""}>Confirmar extracto</button><button id="cancelMovementInbox" class="secondary" type="button">Cancelar</button></div>`;
    qs("confirmMovementInbox")?.addEventListener("click", applyStagedMovementImport);
    wireGestureConfirm(qs("confirmMovementInbox"));
    qs("cancelMovementInbox")?.addEventListener("click", () => {
      pendingE11bApply = null;
      if (inboxItem) dataInbox = dataInbox.map((item) => item.id === inboxItem.id ? E11bInbox.transition(item, "discarded") : item);
      saveLocalSnapshot(); renderE11bStatus();
      qs("movementImportStatus").innerHTML = `<strong>Importación cancelada</strong><p>El extracto se descartó sin modificar los datos.</p>`;
    });
  } catch (error) {
    qs("movementImportStatus").innerHTML = `<strong>No se pudo importar el extracto</strong><p>${escapeHtml(error.message || "Revisa el formato del Excel.")}</p>`;
  } finally {
    event.target.value = "";
  }
}

function applyStagedMovementImport() {
  const pending = pendingE11bApply;
  if (!pending?.imported?.length) return;
  const beforeState = appStatePayload({ includeCanonical: false });
  const imported = pending.imported;
  baseData.transactions = mergeTransactions(baseData.transactions || [], imported);
  refreshMovementRollups();
  const latest = latestStatementBalance(imported);
  const balances = applyMovementBalance(latest);
  const appliedActuals = applyMovementMappingsToActuals();
  pendingMovementMappings = buildPendingMovementMappings(imported);
  saveWorkbookOverride(); saveIncomeActuals(); saveExpenseActuals();
  const batch = window.FinanceCanonicalE5?.createImportBatch(beforeState, appStatePayload({ includeCanonical: false }), {
    sourceLabel: pending.inboxItem?.sourceLabel || "Extracto bancario", reason: pending.inboxItem?.sourceLabel || "Extracto bancario", recordCount: imported.length,
    afterFingerprint: window.FinanceCanonicalSupabaseStore?.fingerprintPayload(appStatePayload({ includeCanonical: false })),
  });
  if (batch) importBatches.push(batch);
  saveLocalSnapshot(); queueRemoteSave(); refreshAllSectionsAfterDataChange();
  applyE11bReceipt(pending.inboxItem, { batchId: batch?.id || "", changed: { records: imported.length, movements: imported.length, actuals: appliedActuals, balances: balances ? 1 : 0 } });
  const balanceText = balances ? `Saldo CaixaBank actualizado a ${money(balances.caixa, true)} con fecha ${formatIsoDate(latest.date)}.` : "No se encontró saldo final utilizable.";
  qs("movementImportStatus").innerHTML = `<strong>Extracto confirmado</strong><p>${imported.length} movimiento(s). ${balanceText} ${appliedActuals} real(es) recalculados; ${pendingMovementMappings.length} relación(es) pendientes.</p>`;
  pendingE11bApply = null;
  renderMovementImportReview();
}

function movementsActFromAlert({ search = "", chip = "todos", dateFrom = "", dateTo = "", matcher = null } = {}) {
  const searchField = qs("movementSearch");
  if (searchField) searchField.value = search;
  const fromField = qs("movementDateFrom");
  if (fromField) fromField.value = dateFrom;
  const toField = qs("movementDateTo");
  if (toField) toField.value = dateTo;
  const actionTypeField = qs("movementActionTypeFilter");
  if (actionTypeField) actionTypeField.value = "";
  movementsChipFilter = MOVEMENT_CHIPS.some((item) => item.id === chip) ? chip : "todos";
  movementsPendingAutoSelect = typeof matcher === "function" ? matcher : null;
  history.pushState(null, "", "#movements");
  setActiveView("movements", { focus: true });
}

// M-3: rango libre (Desde/Hasta) y búsqueda por concepto o importe, sobre `Fecha` — la misma que ya
// ordenaba la tabla. Separado de `movementsFilteredList()` para que el recuento de cada chip
// (`movementsChipCounts`) se calcule sobre el mismo rango+búsqueda que ve la tabla, sin el chip
// activo todavía aplicado.
function movementsRangeAndSearchList() {
  const transactions = (baseData.transactions || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const dateFrom = qs("movementDateFrom")?.value || "";
  const dateTo = qs("movementDateTo")?.value || "";
  const search = normalizedText(qs("movementSearch")?.value || "");
  const actionTypeFilter = qs("movementActionTypeFilter")?.value || "";
  return transactions.filter((row) => {
    if (dateFrom && String(row.date) < dateFrom) return false;
    if (dateTo && String(row.date) > dateTo) return false;
    if (actionTypeFilter) {
      const entry = actionTypeForMovement(row);
      if (actionTypeFilter === "sin-tipo") {
        if (entry) return false;
      } else if (!entry || entry.actionType !== actionTypeFilter) return false;
    }
    if (!search) return true;
    const amountText = normalizedText(`${row.amount} ${money(Math.abs(Number(row.amount || 0)), true)}`);
    if (amountText.includes(search)) return true;
    return normalizedText(`${row.date} ${row.movement} ${row.details} ${row.category} ${row.source}`).includes(search);
  });
}

// M-3: cuatro atajos de rango — «todo» vacía el rango, el resto son meses de calendario completos
// hasta hoy, igual que «Este mes»/«Año en curso» piden literalmente calendario, no una ventana de
// N días.
function movementsRangeShortcutBounds(kind, today = new Date()) {
  if (kind === "todo") return { from: "", to: "" };
  const to = isoLocalDate(today);
  if (kind === "mes") return { from: isoLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  if (kind === "trimestre") return { from: isoLocalDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)), to };
  if (kind === "anio") return { from: isoLocalDate(new Date(today.getFullYear(), 0, 1)), to };
  return { from: "", to: "" };
}

function handleMovementsRangeShortcut(kind) {
  const bounds = movementsRangeShortcutBounds(kind);
  if (qs("movementDateFrom")) qs("movementDateFrom").value = bounds.from;
  if (qs("movementDateTo")) qs("movementDateTo").value = bounds.to;
  renderDetailedMovements();
}

function renderMovementChips(counts) {
  const container = qs("movementChips");
  if (!container) return;
  container.innerHTML = MOVEMENT_CHIPS.map(
    (chip) =>
      `<button type="button" class="registrar-mes-filter${movementsChipFilter === chip.id ? " is-active" : ""}" data-movement-chip="${chip.id}" aria-pressed="${movementsChipFilter === chip.id ? "true" : "false"}">${escapeHtml(chip.label)} · ${counts[chip.id] || 0}</button>`,
  ).join("");
}

// P-1: mismo patrón que `movementPartidaBadge` — hueco sin sugerencia ni confirmación, tono
// "sugerido" (no confirmado por el usuario) o "confirmado" según de dónde salga `actionTypeForMovement`.
function movementActionTypeBadge(row) {
  const entry = actionTypeForMovement(row);
  if (!entry) return `<span class="e19-badge e19-badge-warning">Sin tipo</span>`;
  const label = ACTION_TYPE_LABELS[entry.actionType] || entry.actionType;
  const recurringSuffix = entry.recurring === true ? " · recurrente" : entry.recurring === false ? " · puntual" : "";
  return entry.confirmed
    ? `<span class="e19-badge e19-badge-neutral">${escapeHtml(label)}${escapeHtml(recurringSuffix)}</span>`
    : `<span class="e19-badge e19-badge-accent">${escapeHtml(label)} (sugerido)</span>`;
}

// M-8c: la misma pieza compartida que ya usa Cierre (C-2, `cierreAccountReconciliation`) — saldo
// declarado (Registrar) frente al calculado (último `balanceAfter` del extracto ya incorporado),
// nunca un segundo cálculo. Cierre ya no bloquea esta pieza (Fase 5 está construida), así que M-8c
// solo tenía que exponerla también en Movimientos, donde vive el extracto real.
// M-8c, repaso pixel-perfect del 20 de agosto: Movimientos.pdf pinta el cuadre como una única
// insignia en línea junto a los chips de filtro («Saldo recalculado cuadra con el declarado: X €»),
// no como una tabla aparte por cuenta — y solo de CaixaBank, la misma cuenta de la que ya es
// explícitamente la columna Saldo de la tabla (el efectivo no la mueve). Sigue reutilizando
// cierreAccountReconciliation (C-2), sin segundo cálculo de saldo.
function renderMovementsReconciliation() {
  const container = qs("movementsReconciliation");
  if (!container || !window.FinanceCanonicalLedger) return;
  const snapshot = refreshCanonicalLedger("movements-view");
  if (!snapshot) return;
  const accountRows = cierreAccountReconciliation(snapshot.entries || []);
  const caixa = accountRows.find((row) => row.id === "caixabank") || accountRows[0];
  if (!caixa) return;
  const toneClass = { cuadra: "e19-badge-success", descuadra: "e19-badge-danger", "sin-conciliar": "e19-badge-neutral" }[caixa.status];
  const text =
    caixa.status === "cuadra"
      ? `Saldo recalculado cuadra con el declarado: ${money(caixa.declared, true)}`
      : caixa.status === "descuadra"
        ? `Saldo recalculado no cuadra con el declarado: diferencia de ${money(caixa.diff, true)}`
        : "CaixaBank sin conciliar: falta el extracto para comprobar el saldo recalculado.";
  container.innerHTML = `<span class="e19-badge ${toneClass} movements-reconcile-badge">${escapeHtml(text)}</span>${
    caixa.status === "cuadra" ? "" : ` <a href="#cierre" data-home-nav="cierre" class="e19-kpi-note">Se cierra en Cierre.</a>`
  }`;
}

function renderDetailedMovements() {
  const rowsElement = qs("movementRows");
  if (!rowsElement) return;
  renderMovementsReconciliation();
  const rangeAndSearch = movementsRangeAndSearchList();
  renderMovementChips(movementsChipCounts(rangeAndSearch));
  const chip = MOVEMENT_CHIPS.find((item) => item.id === movementsChipFilter) || MOVEMENT_CHIPS[0];
  const filtered = rangeAndSearch.filter(chip.test);
  const unclassified = filtered.filter((row) => Number(row.amount) && !mappingForMovement(row));

  // M-8: la tabla se reconstruye entera en cada filtro nuevo, así que cualquier selección previa
  // deja de corresponder a las mismas filas — se vacía aquí, no solo al aplicar el lote.
  movementsSelectedIndexes.clear();
  // A-13: si venimos de "actuar desde el aviso", la selección de una sola vez se aplica sobre las
  // filas ya filtradas de este render y se consume — el siguiente re-render vuelve a partir vacío.
  if (movementsPendingAutoSelect) {
    filtered.forEach((row, index) => {
      if (movementsPendingAutoSelect(row)) movementsSelectedIndexes.add(index);
    });
    movementsPendingAutoSelect = null;
  }

  const countLabel = qs("movementCount");
  if (countLabel) countLabel.textContent = `${filtered.length} movimiento(s) reales.`;

  // M-5: aviso de cola sin clasificar, sobre la misma vista filtrada — no un recuento aparte del
  // extracto completo que no coincidiría con lo que la tabla muestra.
  const banner = qs("movementsUnclassifiedBanner");
  if (banner) {
    if (unclassified.length) {
      banner.hidden = false;
      banner.textContent = `${unclassified.length} movimiento(s) de esta vista sin partida asignada. Ábrelos con «Ver» para clasificarlos.`;
    } else {
      banner.hidden = true;
      banner.textContent = "";
    }
  }

  rowsElement.innerHTML = filtered
    .map(
      (row, index) => `<tr>
        <td><input type="checkbox" class="movements-row-select" data-movement-select-index="${index}"${movementsSelectedIndexes.has(index) ? " checked" : ""} aria-label="Seleccionar movimiento del ${escapeHtml(formatIsoDate(row.date))}" /></td>
        <td>${formatIsoDate(row.date)}</td>
        <td>${formatIsoDate(row.valueDate)}</td>
        <td>${escapeHtml(row.movement)}</td>
        <td>${escapeHtml(row.details)}</td>
        <td>${escapeHtml(row.category)}</td>
        <td>${movementPartidaBadge(row)}</td>
        <td class="${row.amount < 0 ? "negative" : "positive"}">${money(row.amount, true)}</td>
        <td>${row.balance === null || row.balance === undefined ? "" : money(row.balance, true)}</td>
        <td>${movementActionTypeBadge(row)}</td>
        <td>${escapeHtml(row.source || "")}</td>
        <td>${escapeHtml(row.account || "—")}</td>
        <td><button type="button" class="e19-btn e19-btn-secondary movements-row-detail" data-movement-detail-index="${index}">Ver</button></td>
      </tr>`,
    )
    .join("");

  // M-9: totales de la vista filtrada.
  const totalsLabel = qs("movementsTotals");
  if (totalsLabel) {
    const totals = movementsTotals(filtered);
    totalsLabel.textContent = filtered.length
      ? `Ingresos de esta vista: ${money(totals.income, true)} · Gastos de esta vista: ${money(totals.expense, true)} · Neto: ${money(totals.income + totals.expense, true)}`
      : "Sin movimientos en esta vista.";
  }

  const selectAll = qs("movementsSelectAll");
  if (selectAll) {
    selectAll.checked = filtered.length > 0 && movementsSelectedIndexes.size === filtered.length;
    selectAll.disabled = !filtered.length;
  }
  renderMovementsBulkBar();
}

// M-8: la fila se identifica por su posición en `movementsFilteredList()`, la misma convención que
// ya usa M-6 para el panel de detalle — determinista mientras no cambien los filtros entre el
// render y el clic, que es síncrono (y por lo que la selección se vacía en cada re-render de la
// tabla, ver `renderDetailedMovements`).
function movementsSelectedRows() {
  const filtered = movementsFilteredList();
  return [...movementsSelectedIndexes].map((index) => filtered[index]).filter(Boolean);
}

// Las claves de concepto distintas entre las filas seleccionadas, con una fila de ejemplo cada
// una. Una acción en lote escribe una entrada de `movementMappings` por concepto, no una por
// movimiento — la misma unidad que ya usa M-7: reclasificar 40 movimientos de 3 conceptos escribe
// 3 reglas, no 40, y esas 3 reglas siguen aplicando a movimientos futuros del mismo concepto.
function movementsSelectedConceptKeys(rows) {
  const keys = new Map();
  rows.forEach((row) => {
    const key = movementMappingKey(row);
    if (!keys.has(key)) keys.set(key, row);
  });
  return keys;
}

function renderMovementsBulkBar() {
  const bar = qs("movementsBulkBar");
  const countLabel = qs("movementsBulkCount");
  const partidaSelect = qs("movementsBulkPartida");
  const actionTypeSelect = qs("movementsBulkActionType");
  const noteEl = qs("movementsBulkNote");
  const applyButton = qs("movementsBulkApply");
  if (!bar) return;
  const rows = movementsSelectedRows();
  if (!rows.length) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const concepts = movementsSelectedConceptKeys(rows);
  const kinds = new Set(rows.map((row) => movementKindFromAmount(row.amount)));
  if (countLabel) countLabel.textContent = `${rows.length} movimiento(s) seleccionados · ${concepts.size} concepto(s) distinto(s)`;
  // Una partida es de ingresos o de gastos (`availableSeriesRows(kind)`); una selección que mezcla
  // los dos no tiene una sola partida válida que ofrecer, así que se bloquea con el motivo en vez
  // de enseñar una lista que solo serviría para la mitad de lo seleccionado (regla transversal 08).
  // Mismo bloqueo para el tipo de acción, por simplicidad — no añade un segundo criterio de mezcla.
  if (kinds.size > 1) {
    if (partidaSelect) {
      partidaSelect.innerHTML = "";
      partidaSelect.disabled = true;
    }
    if (actionTypeSelect) {
      actionTypeSelect.innerHTML = "";
      actionTypeSelect.disabled = true;
    }
    if (noteEl) noteEl.textContent = "Selecciona movimientos del mismo tipo (todo ingresos o todo gastos) para asignarles la misma partida o tipo de acción.";
    if (applyButton) applyButton.disabled = true;
    return;
  }
  const kind = [...kinds][0];
  if (partidaSelect) {
    const previousValue = partidaSelect.value;
    partidaSelect.disabled = false;
    partidaSelect.innerHTML = movementMappingOptions(kind, previousValue);
  }
  if (actionTypeSelect) {
    const previousValue = actionTypeSelect.value;
    actionTypeSelect.disabled = false;
    actionTypeSelect.innerHTML = movementActionTypeOptions(previousValue);
  }
  const alreadyMapped = [...concepts.values()].filter((row) => mappingForMovement(row)).length;
  if (noteEl) {
    noteEl.textContent = alreadyMapped
      ? `${alreadyMapped} de los ${concepts.size} concepto(s) ya tenían otra partida asignada: se sobrescribirá.`
      : `Se aplicará a los ${concepts.size} concepto(s) seleccionados, incluidos los movimientos futuros con el mismo concepto — la misma regla que «Ver › Guardar partida». Partida y tipo de acción se guardan por separado: rellena solo lo que quieras cambiar.`;
  }
  if (applyButton) applyButton.disabled = !partidaSelect?.value && !actionTypeSelect?.value;
}

function handleMovementsSelectToggle(event) {
  const checkbox = event.target.closest("[data-movement-select-index]");
  if (!checkbox) return;
  const index = Number(checkbox.dataset.movementSelectIndex);
  if (checkbox.checked) movementsSelectedIndexes.add(index);
  else movementsSelectedIndexes.delete(index);
  const selectAll = qs("movementsSelectAll");
  if (selectAll) selectAll.checked = movementsSelectedIndexes.size > 0 && movementsSelectedIndexes.size === movementsFilteredList().length;
  renderMovementsBulkBar();
}

function handleMovementsBulkClear() {
  movementsSelectedIndexes.clear();
  document.querySelectorAll("[data-movement-select-index]").forEach((checkbox) => {
    checkbox.checked = false;
  });
  const selectAll = qs("movementsSelectAll");
  if (selectAll) selectAll.checked = false;
  renderMovementsBulkBar();
}

// M-8 · la escritura reutiliza tal cual el mismo diccionario y la misma secuencia de refresco que
// ya usaban M-7 (`handleMovementReclassify`) y la revisión de importación
// (`applyPendingMovementMappings`) — regla transversal 01: ninguna tercera forma de escribir una
// clasificación, solo una tercera forma de elegir a qué conceptos se le aplica.
//
// DEX10 (Oleada 2, Bloque 1): partida y tipo de acción son opcionales e independientes — igual que
// en el detalle individual (`handleMovementReclassify`/`handleMovementActionTypeSave`, dos puertas
// de guardado separadas), se puede rellenar una, la otra, o las dos a la vez. El tipo de acción en
// lote nunca toca `recurring`: adivinarlo en lote sería inventar una decisión que nadie tomó — queda
// `null`, igual que al guardarlo desde el detalle sin marcarlo explícitamente.
function handleMovementsBulkApply() {
  const rows = movementsSelectedRows();
  const partidaSelect = qs("movementsBulkPartida");
  const actionTypeSelect = qs("movementsBulkActionType");
  if (!rows.length || (!partidaSelect?.value && !actionTypeSelect?.value)) return;
  const kinds = new Set(rows.map((row) => movementKindFromAmount(row.amount)));
  if (kinds.size > 1) return;
  const kind = [...kinds][0];
  const concepts = movementsSelectedConceptKeys(rows);
  const messages = [];
  let applied = 0;
  if (partidaSelect?.value) {
    const label = partidaSelect.options[partidaSelect.selectedIndex]?.textContent || "";
    const rowKeyValue = partidaSelect.value;
    concepts.forEach((_row, key) => {
      movementMappings[key] = { kind, rowKey: rowKeyValue, label, updatedAt: new Date().toISOString() };
    });
    saveMovementMappings();
    applied = applyMovementMappingsToActuals();
    pendingMovementMappings = buildPendingMovementMappings(baseData.transactions || []);
    datosImportarRefreshRowsForMappings(new Set(concepts.keys()));
    saveIncomeActuals();
    saveExpenseActuals();
    // Mismo texto exacto que antes de DEX10 cuando solo se aplica partida (regresión cero de copy).
    messages.push(`reclasificados a «${label}». ${applied} importe(s) reales recalculados desde movimientos.`);
  }
  if (actionTypeSelect?.value) {
    const actionLabel = actionTypeSelect.options[actionTypeSelect.selectedIndex]?.textContent || "";
    concepts.forEach((_row, key) => {
      movementActionTypes[key] = { actionType: actionTypeSelect.value, recurring: null, updatedAt: new Date().toISOString() };
    });
    saveMovementActionTypes();
    messages.push(`tipo de acción asignado como «${actionLabel}».`);
  }
  refreshAllSectionsAfterDataChange();
  announceStatus(`${concepts.size} concepto(s) (${rows.length} movimiento(s)) ${messages.join(" ")}`);
  movementsSelectedIndexes.clear();
  renderDetailedMovements();
}
