// ARQ-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2, continúa T14 de BACKLOG_CONTABILIDADCASA_2_0.md):
// pantalla «Conciliación» (`#reconciliation`), extraída de app.js con el mismo patrón `views/*.js`
// de carga diferida de los ocho incrementos de T14.
//
// T14 la dio por bloqueada de forma permanente (sesión 207, octavo incremento): renderReconciliation()
// se llamaba sin guarda de pantalla activa desde closeCurrentMonthTransaction() y
// reopenLatestMonthTransaction(), que también se disparan desde #conciliar (views/cierre.js). Moverla
// tal cual habría lanzado un ReferenceError al cerrar el mes sin haber visitado antes esta pantalla.
// Lo que la desbloquea no es mover más código, sino cambiar el patrón de refresco: esos llamadores
// pasan ahora por refreshReconciliationView() (app.js), que pinta solo con la pantalla abierta y,
// sin ella, conserva los dos únicos efectos de estado que tenía esta función (recalcular y
// persistir el libro conciliado, reevaluar la barrera de publicación). Todo lo demás es DOM de
// esta sección, que se pinta al entrar.
//
// Lo que se movió: renderReconciliation() y los cuatro renderizadores que solo ella usa
// (renderLedgerInvariant, renderCanonicalEngineStatus, renderCanonicalDailyEngineStatus,
// renderCanonicalCommitBarrierStatus), más la tabla de etiquetas ledgerStatusLabels. Todos sus
// nodos de destino viven dentro de `<section id="reconciliation">`.
//
// Lo que NO se movió: ledgerMonthLabel() y ledgerDifferenceTotal() — definidas en el mismo bloque,
// pero las usan Hoy, Análisis, Cierre, Deuda y Presupuesto sin pasar por esta pantalla; y
// downloadCanonicalLedger(), cableado en init() de forma eager.

const ledgerStatusLabels = {
  matched: "Cuadrado",
  difference: "Con diferencia",
  "pending-classification": "Pendiente de clasificar",
};

function renderLedgerInvariant(label, passed, detail) {
  return `<article class="ledger-invariant ${passed ? "passed" : "warning"}">
    <span aria-hidden="true">${passed ? "OK" : "REVISAR"}</span>
    <div><strong>${escapeHtml(label)}</strong><p>${escapeHtml(detail)}</p></div>
  </article>`;
}

function renderCanonicalEngineStatus() {
  const panel = qs("canonicalEngineKpis");
  if (!panel) return;
  const contexts = ["base", "active", "planned"];
  const runs = contexts.map((key) => ({ key, run: canonicalEngineRuns[key] })).filter(({ run }) => run);
  const decisionRun = canonicalDecisionRun
    ? { key: "decisiones", run: canonicalDecisionRun }
    : null;
  const allRuns = decisionRun ? [...runs, decisionRun] : runs;
  const active = canonicalEngineRuns.active;
  const diagnosticRuns = allRuns.filter(({ run }) => run.parity);
  const matched = diagnosticRuns.filter(({ run }) => run.parity?.matched).length;
  const maxDelta = diagnosticRuns.reduce((maximum, { run }) => Math.max(maximum, Number(run.parity?.maxDelta || 0)), 0);
  const issueCount = allRuns.reduce((sum, { run }) => sum + Number(run.invariants?.issues?.length || 0), 0);
  panel.innerHTML = [
    ["Fuente del flujo", active ? "Motor canónico" : "Pendiente", active ? `Escenario activo · ${Number(active.rowCount || active.rows?.length || active.invariants?.checkedRows || 0)} meses` : "Pendiente de calcular", active ? "good" : "warn"],
    ["Diagnóstico histórico", diagnosticRuns.length ? `${matched} / ${diagnosticRuns.length}` : "No ejecutado", "Comparación opcional; nunca sustituye al motor canónico", !diagnosticRuns.length || matched === diagnosticRuns.length ? "good" : "warn"],
    ["Mayor diferencia", diagnosticRuns.length ? money(maxDelta, true) : "-", "Tolerancia diagnóstica: 0,02 €", !diagnosticRuns.length || maxDelta <= 0.02 ? "good" : "warn"],
    ["Invariantes rotas", String(issueCount), "Continuidad, cuentas, liquidez y valores finitos", issueCount === 0 ? "good" : "warn"],
  ].map(([label, value, detail, tone]) => `<article class="audit-kpi ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p>${escapeHtml(detail)}</p></article>`).join("");

  const checks = active?.invariants?.checks || {};
  const decisionChecks = canonicalDecisionRun?.invariants?.checks || {};
  qs("canonicalEngineInvariants").innerHTML = [
    renderLedgerInvariant("Valores finitos", Boolean(checks.finite), checks.finite ? "Ningún cálculo produce Infinity o NaN." : "Hay importes no finitos; el motor canónico ha bloqueado el cálculo."),
    renderLedgerInvariant("Conservación de cuentas", Boolean(checks.accountConservation), checks.accountConservation ? "CaixaBank + Mediolanum coincide con la liquidez total." : "Las cuentas no suman la liquidez mostrada."),
    renderLedgerInvariant("Conservación de liquidez", Boolean(checks.liquidityConservation), checks.liquidityConservation ? "El resultado mensual explica el cambio de liquidez." : "Hay un movimiento sin contrapartida en el mes."),
    renderLedgerInvariant("Continuidad mensual", Boolean(checks.continuity), checks.continuity ? "Cada cierre coincide con la apertura del mes siguiente." : "Existe un salto entre meses consecutivos."),
    renderLedgerInvariant("Conservación de decisiones", Boolean(decisionChecks.monthlyConservation), decisionChecks.monthlyConservation ? "Cada proyecto y deuda tiene contrapartida mensual completa." : "El calendario de decisiones contiene una diferencia."),
    renderLedgerInvariant("Deudas sin duplicar", Boolean(decisionChecks.uniqueDebtTargets), decisionChecks.uniqueDebtTargets ? "Cada deuda aparece una sola vez en el calendario." : "Una deuda está programada más de una vez."),
  ].join("");

  const differences = allRuns.flatMap(({ key, run }) => (run.parity?.differences || []).map((difference) => ({ ...difference, context: key })));
  qs("canonicalEngineParitySummary").textContent = !diagnosticRuns.length
    ? "Diagnóstico histórico no ejecutado. El motor canónico sigue siendo la única fuente de cálculo."
    : differences.length
      ? `${differences.length} diferencia(s) en la referencia diagnóstica; la fuente sigue siendo canónica.`
      : `${diagnosticRuns.length} escenario(s) comparado(s), sin diferencias por encima de 0,02 €.`;
  const comparisonValue = (value, difference) => difference.delta == null
    ? escapeHtml(String(value ?? "-"))
    : money(value, true);
  qs("canonicalEngineDifferenceRows").innerHTML = differences.length
    ? differences.slice(0, 30).map((difference) => `<tr><td>${escapeHtml(difference.context)}</td><td>${escapeHtml(ledgerMonthLabel(difference.monthKey))}</td><td>${escapeHtml(difference.field)}</td><td>${comparisonValue(difference.canonical, difference)}</td><td>${comparisonValue(difference.legacy, difference)}</td><td class="ledger-difference">${difference.delta == null ? "-" : money(difference.delta, true)}</td></tr>`).join("")
    : `<tr><td colspan="6"><div class="audit-empty good"><strong>${diagnosticRuns.length ? "Paridad completa" : "Sin diagnóstico"}</strong><p>${diagnosticRuns.length ? "La referencia histórica coincide con el motor canónico." : "Pulsa Comparar con histórico para generar evidencia opcional."}</p></div></td></tr>`;
}

function renderCanonicalDailyEngineStatus() {
  const panel = qs("canonicalDailyEngineKpis");
  if (!panel) return;
  const run = canonicalDailyEngineRuns.active;
  const invariantPanel = qs("canonicalDailyEngineInvariants");
  const summary = qs("canonicalDailyEngineSummary");
  const rowsTarget = qs("canonicalDailyEngineRows");
  if (!run) {
    panel.innerHTML = `<div class="audit-empty"><strong>Auditoría diaria pendiente</strong><p>El calendario se genera al calcular el escenario activo.</p></div>`;
    if (invariantPanel) invariantPanel.innerHTML = "";
    if (summary) summary.textContent = "Sin calendario diario disponible";
    if (rowsTarget) rowsTarget.innerHTML = `<tr><td colspan="8"><div class="audit-empty">Calcula el escenario activo para auditar fechas y saldos diarios.</div></td></tr>`;
    return;
  }
  const monthly = run.monthly || [];
  const checks = run.invariants?.checks || {};
  const matched = monthly.filter((row) => row.matched).length;
  const minimum = monthly.reduce((selected, row) => !selected || Number(row.minTotal || 0) < Number(selected.minTotal || 0) ? row : selected, null);
  const confidence = run.confidence || {};
  panel.innerHTML = [
    ["Días auditados", String(Number(run.rowCount || run.rows?.length || 0)), `${Number(run.eventCount || 0)} eventos con fecha y cuenta`, "good"],
    ["Cierres que cuadran", `${matched} / ${monthly.length}`, "El cierre diario coincide con el flujo mensual canónico", matched === monthly.length ? "good" : "warn"],
    ["Mínimo diario", minimum ? money(minimum.minTotal, true) : "-", minimum ? `${ledgerMonthLabel(minimum.monthKey)} · ${shortDate(minimum.minTotalDate)} · ${minimum.minTotalEvent || "sin evento"}` : "Sin meses auditados", minimum && Number(minimum.minTotal || 0) >= Number(run.policy?.operatingReserve || 0) ? "good" : "warn"],
    ["Confianza observada", String(Number(confidence.observed || 0)), `${Number(confidence.rule || 0)} reglas y ${Number(confidence.estimated || 0)} estimaciones`, "good"],
  ].map(([label, value, detail, tone]) => `<article class="audit-kpi ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p>${escapeHtml(detail)}</p></article>`).join("");

  if (invariantPanel) {
    invariantPanel.innerHTML = [
      renderLedgerInvariant("Valores finitos", Boolean(checks.finite), checks.finite ? "Todos los eventos y saldos diarios tienen importes válidos." : "Hay un importe diario no válido."),
      renderLedgerInvariant("Conservación diaria", Boolean(checks.dailyConservation), checks.dailyConservation ? "Ingresos menos gastos explican el saldo total de cada día." : "Hay un movimiento diario sin contrapartida."),
      renderLedgerInvariant("Continuidad diaria", Boolean(checks.continuity), checks.continuity ? "Cada apertura coincide con el cierre del día anterior." : "Existe un salto entre días consecutivos."),
      renderLedgerInvariant("Paridad mensual", Boolean(checks.monthlyParity), checks.monthlyParity ? "El detalle por fecha y el motor mensual cierran igual." : "Hay una diferencia entre el calendario diario y el flujo mensual."),
      renderLedgerInvariant("Traspasos neutros", Boolean(checks.transferConservation), checks.transferConservation ? "Mover dinero entre cuentas no altera la liquidez total." : "Un traspaso altera indebidamente la liquidez."),
    ].join("");
  }
  if (summary) summary.textContent = `${matched} de ${monthly.length} meses auditados coinciden con el motor mensual. Muestra los cierres y el punto mínimo de cada mes.`;
  if (rowsTarget) {
    rowsTarget.innerHTML = monthly.length
      ? monthly.map((row) => `<tr>
          <td><strong>${escapeHtml(ledgerMonthLabel(row.monthKey))}</strong></td>
          <td class="positive">${money(row.income, true)}</td>
          <td class="negative">${money(row.outflowsBeforeSaving, true)}</td>
          <td>${money(row.saving, true)}</td>
          <td>${money(row.closingChecking, true)}</td>
          <td>${money(row.closingSavings, true)}</td>
          <td>${money(row.minTotal, true)}<small>${escapeHtml(shortDate(row.minTotalDate))} · ${escapeHtml(row.minTotalEvent || "apertura")}</small></td>
          <td><span class="ledger-status ${row.matched ? "matched" : "difference"}">${row.matched ? "Cuadrado" : "Revisar"}</span></td>
        </tr>`).join("")
      : `<tr><td colspan="8"><div class="audit-empty">No hay meses que auditar.</div></td></tr>`;
  }
}

function renderCanonicalCommitBarrierStatus() {
  const target = qs("canonicalCommitBarrierSummary");
  if (!target || !window.FinanceCanonicalCommitBarrier) return;
  const result = evaluateCanonicalCommitBarrier("reconciliation-view");
  if (!result) return;
  const status = result.status === "blocked" ? "blocked" : result.status === "warning" ? "warning" : "ready";
  const title = status === "blocked"
    ? "Sincronización bloqueada"
    : status === "warning"
      ? "Sincronización permitida con avisos"
      : "Lista para sincronizar";
  const detail = status === "blocked"
    ? "Corrige los bloqueos antes de publicar una versión compartida. Tus cambios locales no se pierden."
    : status === "warning"
      ? "Los avisos no frenan la sincronización, pero conviene revisarlos antes de decidir."
      : "El motor mensual, diario y de decisiones ha superado las comprobaciones de publicación.";
  const items = [...result.blockers, ...result.warnings].slice(0, 6);
  target.innerHTML = `<article class="commit-barrier-overview ${status}">
    <span>Estado de publicación</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p>
  </article><ul class="commit-barrier-list">${items.length
    ? items.map((item) => `<li class="commit-barrier-item ${escapeHtml(item.level)}"><span>${item.level === "blocker" ? "Bloqueo" : "Aviso"}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></li>`).join("")
    : `<li class="commit-barrier-item ok"><span>Correcto</span><strong>Sin bloqueos ni avisos críticos</strong><p>La versión local puede guardarse en Supabase con trazabilidad.</p></li>`}</ul>`;
}

function renderReconciliation() {
  if (!window.FinanceCanonicalLedger) return;
  const snapshot = refreshCanonicalLedger("reconciliation-view");
  if (!snapshot) return;
  const quality = snapshot.quality || {};
  const months = snapshot.reconciliation?.months || [];
  const lines = snapshot.reconciliation?.lines || [];
  const entries = snapshot.entries || [];
  const checks = snapshot.balanceChecks || [];
  const differenceTotal = ledgerDifferenceTotal(snapshot);
  const balancedMonths = months.filter((row) => row.status === "matched").length;

  qs("ledgerKpis").innerHTML = [
    ["Cobertura clasificada", `${Number(quality.coverage || 0)}%`, `${Number(quality.classifiedCount || 0)} de ${Number(quality.usableCount || 0)} movimientos útiles`, Number(quality.coverage || 0) >= 90 ? "good" : "warn"],
    ["Pendientes", String(Number(quality.unclassifiedCount || 0)), "Movimientos bancarios sin partida confirmada", Number(quality.unclassifiedCount || 0) ? "warn" : "good"],
    ["Diferencia banco vs real", money(differenceTotal, true), `${balancedMonths} de ${months.length} meses cuadran`, differenceTotal <= 0.02 ? "good" : "warn"],
    ["Saltos de saldo", String(Number(quality.balanceGapCount || 0)), `${checks.reduce((sum, row) => sum + Number(row.checkedPairs || 0), 0)} pares de movimientos comprobados`, Number(quality.balanceGapCount || 0) ? "warn" : "good"],
  ].map(([label, value, detail, tone]) => `<article class="audit-kpi ${tone}">
    <span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p>${escapeHtml(detail)}</p>
  </article>`).join("");

  const uniqueUsable = Number(quality.usableCount || 0) === Number(quality.transactionCount || 0);
  const fullyMapped = Number(quality.unclassifiedCount || 0) === 0;
  const balancesContinuous = Number(quality.balanceGapCount || 0) === 0;
  const actualsReconciled = months.length > 0 && months.every((row) => row.status === "matched");
  qs("ledgerInvariantSummary").innerHTML = [
    renderLedgerInvariant("Sin duplicados", uniqueUsable, uniqueUsable ? "Cada movimiento se contabiliza una sola vez." : `${quality.duplicateCount} duplicado(s) se excluyen de los totales.`),
    renderLedgerInvariant("Clasificación completa", fullyMapped, fullyMapped ? "Todos los movimientos tienen una partida canónica." : `${quality.unclassifiedCount} movimiento(s) requieren decisión.`),
    renderLedgerInvariant("Continuidad del saldo", balancesContinuous, balancesContinuous ? "Los saldos del extracto siguen la aritmética bancaria." : `${quality.balanceGapCount} salto(s) necesitan revisar orden o filas ausentes.`),
    renderLedgerInvariant("Banco igual a real", actualsReconciled, actualsReconciled ? "Los meses importados coinciden con los reales capturados." : `${months.length - balancedMonths} mes(es) tienen diferencias o clasificación pendiente.`),
  ].join("");
  renderCanonicalEngineStatus();
  renderCanonicalDailyEngineStatus();
  renderCanonicalCommitBarrierStatus();

  qs("ledgerMonthRows").innerHTML = months.length
    ? months.slice().reverse().map((row) => `<tr>
        <td><strong>${escapeHtml(ledgerMonthLabel(row.monthKey))}</strong></td>
        <td class="positive">${money(row.bankIncome, true)}</td>
        <td>${money(row.actualIncome, true)}</td>
        <td class="${Math.abs(row.incomeDelta) > 0.02 ? "ledger-difference" : ""}">${money(row.incomeDelta, true)}</td>
        <td class="negative">${money(row.bankExpense, true)}</td>
        <td>${money(row.actualExpense, true)}</td>
        <td class="${Math.abs(row.expenseDelta) > 0.02 ? "ledger-difference" : ""}">${money(row.expenseDelta, true)}</td>
        <td><span class="ledger-status ${escapeHtml(row.status)}">${escapeHtml(ledgerStatusLabels[row.status] || row.status)}</span></td>
      </tr>`).join("")
    : `<tr><td colspan="8"><div class="audit-empty"><strong>Sin extractos conciliables</strong><p>Importa movimientos bancarios para construir el control mensual.</p></div></td></tr>`;

  const unclassified = entries.filter((entry) => !entry.duplicateOf && entry.mapping?.status !== "classified");
  qs("ledgerUnclassified").innerHTML = unclassified.length
    ? unclassified.slice(0, 20).map((entry) => `<div class="ledger-list-item">
        <div><strong>${escapeHtml(entry.description || "Movimiento sin descripción")}</strong><span>${escapeHtml(entry.date || entry.monthKey)} · ${escapeHtml(entry.accountId)}</span></div>
        <strong class="${entry.kind === "income" ? "positive" : "negative"}">${entry.kind === "expense" ? "-" : "+"}${money(entry.amount, true)}</strong>
      </div>`).join("")
    : `<div class="audit-empty good"><strong>Todo clasificado</strong><p>No quedan movimientos pendientes de relacionar.</p></div>`;

  const taskTarget = qs("reconciliationTasks");
  if (taskTarget && E11bInbox) {
    const tasks = E11bInbox.reconciliationTasks({
      unclassified,
      differences: lines.filter((line) => Math.abs(Number(line.delta || 0)) > 0.02),
      balanceGaps: checks.flatMap((check) => (check.gaps || []).map((gap, index) => ({ ...gap, id: `${check.accountId}-${index}`, accountId: check.accountId }))),
    });
    taskTarget.innerHTML = tasks.length ? tasks.slice(0, 12).map((task) => `<article class="e11b-task-item"><div><strong>${escapeHtml(task.label)}</strong><p>${task.cause === "unclassified" ? "Movimiento sin partida" : task.cause === "balance-gap" ? "Salto en la continuidad del saldo" : "Banco y real no coinciden"}. Abrir no modifica datos.</p></div><button type="button" class="secondary" data-e11b-task-target="${escapeHtml(task.target)}">${task.action === "classify" ? "Clasificar" : task.action === "adjust-balance" ? "Revisar saldo" : "Corregir real"}</button></article>`).join("") : `<div class="audit-empty good"><strong>Sin tareas pendientes</strong><p>Clasificación, saldos e importes reales están conciliados.</p></div>`;
    taskTarget.querySelectorAll("[data-e11b-task-target]").forEach((button) => button.addEventListener("click", () => {
      const target = button.dataset.e11bTaskTarget;
      history.pushState(null, "", `#${target}`); setActiveView(target, { focus: true });
    }));
  }

  qs("ledgerBalanceChecks").innerHTML = checks.length
    ? checks.map((check) => `<div class="ledger-balance-item ${check.gaps.length ? "warning" : "passed"}">
        <div><strong>${escapeHtml(check.accountId)}</strong><span>${check.transactionCount} movimientos · orden ${check.orientation === "newest-first" ? "más reciente primero" : "más antiguo primero"}</span></div>
        <div><strong>${check.gaps.length} salto(s)</strong><span>Error acumulado ${money(check.totalError, true)}</span></div>
      </div>`).join("")
    : `<div class="audit-empty"><strong>Sin saldos bancarios</strong><p>El extracto no contiene saldo posterior para comprobar continuidad.</p></div>`;

  const meaningfulLines = lines
    .filter((line) => Math.abs(Number(line.delta || 0)) > 0.02)
    .sort((a, b) => Math.abs(Number(b.delta || 0)) - Math.abs(Number(a.delta || 0)));
  qs("ledgerLineRows").innerHTML = meaningfulLines.length
    ? meaningfulLines.slice(0, 40).map((line) => `<tr>
        <td>${escapeHtml(ledgerMonthLabel(line.monthKey))}</td>
        <td>${line.kind === "income" ? "Ingreso" : "Gasto"}</td>
        <td><strong>${escapeHtml(line.label || line.rowKey)}</strong><small>${escapeHtml(line.rowKey)}</small></td>
        <td>${money(line.bankAmount, true)}</td>
        <td>${money(line.actualAmount, true)}</td>
        <td class="ledger-difference">${money(line.delta, true)}</td>
      </tr>`).join("")
    : `<tr><td colspan="6"><div class="audit-empty good"><strong>Sin diferencias por partida</strong><p>Los importes bancarios clasificados coinciden con los reales capturados.</p></div></td></tr>`;

  const currentMonthKey = openMonthCutoffKey();
  const currentClosure = isClosedMonthKey(currentMonthKey)
    ? window.FinanceCanonicalE5?.latestMonthOperation({ monthClosures }, currentMonthKey)
    : null;
  const closeButton = qs("closeCurrentMonth");
  const closeStatus = qs("monthCloseStatus");
  if (closeButton) {
    closeButton.disabled = Boolean(currentClosure);
    closeButton.textContent = currentClosure ? "Mes actual cerrado" : "Cerrar mes actual";
  }
  if (currentClosure && closeStatus) {
    closeStatus.textContent = `${currentMonthKey} cerrado. Los reales quedan congelados en una versión recuperable.`;
  }
}
