// TRACK-3 (FASE 7): pantalla "Estado de la semana" — funde tres lecturas que hoy viven en
// pantallas separadas (alertas de caja anticipadas de E16 en Hoy, ritmo de presupuesto en
// Presupuesto del mes, próximos vencimientos de objetivos del calendario financiero de E15 en
// Huchas) en una única lectura de solo lectura. Sin motor nuevo: cada tarjeta reutiliza tal cual
// la función que ya construye esa misma lectura en su pantalla de origen (CanonicalE16.
// buildReadModel, homeBudgetSummary/homeBudgetWeekSummary, CanonicalE15.financialCalendar) y
// enlaza a esa pantalla para cualquier acción real. Igual que presupuesto-mes.js (PERF-1): script
// clásico cargado bajo demanda por loadViewChunk(), aterriza en el mismo scope global de app.js.

// Card 1: alertas de caja anticipadas (E16) — mismo modelo que ya consume p2-ui.js en Hoy.
function estadoSemanaCashAlerts() {
  const api = window.FinanceCanonicalE16;
  const input = window.FinanceP2Bridge?.e16Input?.();
  if (!api || !input) return null;
  return api.buildReadModel(input).alerts.alerts;
}

function estadoSemanaCashAlertsHtml() {
  const alerts = estadoSemanaCashAlerts();
  const body =
    alerts === null
      ? `<p class="e19-subtitle">El seguimiento predictivo de caja (E16) no está disponible todavía.</p>`
      : alerts.length
        ? `<ul class="commit-barrier-list">${alerts
            .slice(0, 3)
            .map((alert) => `<li><strong>${escapeHtml(alert.monthKey || "Ahora")}</strong> · ${escapeHtml(alert.message)}</li>`)
            .join("")}</ul>`
        : `<p class="e19-subtitle">No hay riesgos que superen el presupuesto de caja configurado.</p>`;
  const countNote = alerts?.length
    ? `<div class="registrar-mes-card-foot"><p class="e19-kpi-note">${alerts.length} alerta${alerts.length === 1 ? "" : "s"} anticipada${alerts.length === 1 ? "" : "s"} en total.</p></div>`
    : "";
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Alertas de caja anticipadas</h3>
        <p class="e19-subtitle">Mismo seguimiento predictivo (E16) que en Hoy: riesgos de liquidez, variación mensual y ratio de deuda.</p>
      </div>
      <div class="cuadro-mandos-controls">
        <button type="button" class="e19-btn e19-btn-secondary" data-home-nav="home">Ver detalle en Hoy</button>
      </div>
    </div>
    ${body}
    ${countNote}
  </article>`;
}

// Card 2: ritmo de presupuesto, semana y mes — mismos agregados que Presupuesto del mes/Hoy.
function estadoSemanaBudgetRhythmRowHtml(summary, label, emptyText) {
  if (!summary) return `<p class="e19-subtitle">${escapeHtml(label)}: ${escapeHtml(emptyText)}</p>`;
  const pill =
    summary.status === "danger"
      ? `<span class="e19-pill e19-pill-warn">Por encima del ritmo</span>`
      : summary.status === "warn"
        ? `<span class="e19-pill e19-pill-warn">Cerca del límite</span>`
        : `<span class="e19-pill e19-pill-safe">En ritmo</span>`;
  return `<div class="registrar-mes-card-foot">
    <p class="e19-kpi-note"><strong>${escapeHtml(label)}</strong>: ${money(summary.totalSpent, true)} de ${money(summary.totalBudgeted, true)} presupuestado (${summary.count} presupuesto${summary.count === 1 ? "" : "s"}) ${pill}</p>
    ${summary.worstMessage ? `<p class="e19-kpi-note">${escapeHtml(summary.worstMessage)}</p>` : ""}
  </div>`;
}

function estadoSemanaBudgetRhythmHtml() {
  const weekly = homeBudgetWeekSummary();
  const monthly = homeBudgetSummary();
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Ritmo de presupuesto</h3>
        <p class="e19-subtitle">Mismo cálculo que Presupuesto del mes — solo categorías de gasto; los presupuestos de objetivo se leen aparte, más abajo.</p>
      </div>
      <div class="cuadro-mandos-controls">
        <button type="button" class="e19-btn e19-btn-secondary" data-home-nav="presupuesto-mes">Ver Presupuesto del mes</button>
      </div>
    </div>
    ${estadoSemanaBudgetRhythmRowHtml(weekly, "Esta semana", "todavía no hay presupuestos semanales.")}
    ${estadoSemanaBudgetRhythmRowHtml(monthly, "Este mes", "todavía no hay presupuestos mensuales.")}
  </article>`;
}

// Card 3: objetivos, próximos vencimientos — mismo calendario financiero que Huchas (E15).
function estadoSemanaGoalDeadlines(monthsAhead = 6) {
  const api = window.FinanceCanonicalE15;
  const planning = window.FinanceP2Bridge?.goalPlanning?.();
  if (!api || !planning) return null;
  const p2 = p2State();
  const calendar = api.financialCalendar({ ...planning, goals: p2.goals, reviews: p2.e15?.reviews || [] });
  return calendar.rows
    .slice(0, monthsAhead)
    .flatMap((row) => row.events.filter((event) => event.type === "goal").map((event) => ({ monthKey: row.monthKey, label: row.label, event })));
}

function estadoSemanaGoalDeadlinesHtml() {
  const deadlines = estadoSemanaGoalDeadlines();
  const body =
    deadlines === null
      ? `<p class="e19-subtitle">El calendario de objetivos (E15) no está disponible todavía.</p>`
      : deadlines.length
        ? `<ul class="commit-barrier-list">${deadlines
            .map(({ label, event }) => `<li><strong>${escapeHtml(label)}</strong> · ${escapeHtml(event.label)} — ${money(event.amount, true)} pendiente</li>`)
            .join("")}</ul>`
        : `<p class="e19-subtitle">Ningún objetivo vence en los próximos 6 meses.</p>`;
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Objetivos: próximos vencimientos</h3>
        <p class="e19-subtitle">Mismo calendario financiero (E15) que en Huchas — próximos 6 meses.</p>
      </div>
      <div class="cuadro-mandos-controls">
        <button type="button" class="e19-btn e19-btn-secondary" data-home-nav="savings-agent">Ver Huchas</button>
      </div>
    </div>
    ${body}
  </article>`;
}

// CPX1: resumen semanal proactivo — añade la próxima mejor acción de CP1 como cabecera de "Estado
// de la semana", antes de las tres lecturas pasivas de arriba. Misma selección que ya usa
// cp1NextBestAction() en p2-ui.js (mismo catálogo de fuentes E9 y el mismo validador de citas CP3):
// se repite aquí, no se reimporta, porque p2-ui.js encierra esa función en su propio cierre y este
// script vive en el scope global de app.js — mismo criterio de pequeñas funciones compartidas entre
// módulos independientes que ya usan los motores canónicos (DI5). Nunca decide nada por el hogar,
// solo prioriza qué mirar primero.
const CPX1_SEVERITY_RANK = { critical: 0, high: 1, medium: 2 };
const CPX1_ALERT_LABELS = { cash: "Revisar la caja prevista", variation: "Revisar la variación prevista", debt: "Revisar el ratio de deuda" };

function cpx1WeeklyPriorityAction(alerts) {
  const assistantApi = window.FinanceCanonicalE9Assistant;
  const citationApi = window.FinanceCanonicalRecommendationCitation;
  if (!assistantApi || !citationApi || !alerts.length) return null;
  const sources = assistantApi.sourceCatalog({ alerts: alerts.map((item) => ({ id: item.id, label: item.message })) });
  const availableSources = new Set(sources.map((item) => item.id));
  const candidates = [...alerts]
    .sort((a, b) => (CPX1_SEVERITY_RANK[a.severity] ?? 3) - (CPX1_SEVERITY_RANK[b.severity] ?? 3))
    .map((alert) => ({
      label: CPX1_ALERT_LABELS[alert.type] || "Revisar la evidencia",
      message: alert.message,
      severity: alert.severity,
      citations: [`alert:${alert.id}`],
      evidence: Array.isArray(alert.evidence) ? alert.evidence : [],
      confidence: alert.confidence || "",
    }));
  const validated = citationApi.validateRecommendations(candidates, { availableSources });
  const index = validated.results.findIndex((result) => result.valid);
  return index === -1 ? null : candidates[index];
}

function cpx1WeeklyPriorityHtml(alerts) {
  if (alerts === null) return `<p class="e19-subtitle">El seguimiento predictivo de caja (E16) no está disponible todavía.</p>`;
  const action = cpx1WeeklyPriorityAction(alerts);
  if (!action) return `<p class="e19-subtitle">Sin ninguna alerta que priorizar esta semana.</p>`;
  const evidenceItems = (action.evidence || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const confidenceItem = action.confidence ? `<li>Confianza del dato: ${escapeHtml(action.confidence)}</li>` : "";
  return `<p><strong>${escapeHtml(action.label)}</strong></p><p>${escapeHtml(action.message)}</p><details class="p2-details"><summary>Ver por qué</summary><ul class="e19-kpi-note">${evidenceItems}${confidenceItem}<li>Cita: ${escapeHtml(action.citations.join(", "))}</li></ul></details>`;
}

function estadoSemanaPriorityHtml() {
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Empieza por aquí esta semana</h3>
        <p class="e19-subtitle">La alerta más urgente con evidencia citable (CP1), antes de las tres lecturas de abajo.</p>
      </div>
    </div>
    ${cpx1WeeklyPriorityHtml(estadoSemanaCashAlerts())}
  </article>`;
}

function renderEstadoSemana() {
  const root = qs("estadoSemanaRoot");
  if (!root) return;
  root.innerHTML = `${estadoSemanaPriorityHtml()}${estadoSemanaCashAlertsHtml()}${estadoSemanaBudgetRhythmHtml()}${estadoSemanaGoalDeadlinesHtml()}`;
}
