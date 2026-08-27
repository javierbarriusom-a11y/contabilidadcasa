// PERF-1 (FASE 6, escala #3): código exclusivo de las vistas "cierre" y "conciliar", extraído de
// app.js. Se carga bajo demanda (ver loadViewChunk() en app.js) la primera vez que se visita
// cualquiera de las dos — comparten helpers de sobres/cuadre/versiones, así que es un solo
// fragmento para las dos, no dos. <script> clásico, no módulo ES: sus declaraciones de nivel
// superior aterrizan en el mismo scope global de siempre. Lo que Registrar/Plan (guardar el cierre
// de un mes), Escenarios (borrar un guardado aplicado) y Análisis necesitan
// (cierreAccountReconciliation, cierreSobresResolved, sobresSettlementsForSign,
// retractDebtLiquidationsFromEscenario, retractProjectsFromEscenario,
// retractPlanningRowsFromEscenario, cierreVersionRows, cierreMonthsCurrentlyReopened,
// loadCierreAprendizajeHistory, saveCierreAprendizajeHistory, recordCierreAprendizaje) se quedó en
// app.js.

function conciliarMonthHistory(monthRows) {
  return monthRows.map((row) => {
    const latest = window.FinanceCanonicalE5?.latestMonthOperation({ monthClosures }, row.monthKey);
    const reopenCount = monthClosures.filter((op) => op.monthKey === row.monthKey && op.operation === "month-reopen").length;
    return { monthKey: row.monthKey, closed: latest?.status === "closed", reopenCount };
  });
}

// =================================================================================================
// Fase 5 · Cierre — pantalla 08 (Cierre.pdf, auditado el 16 de agosto): ritual secuencial de tres
// pasos reales (Conciliar cuentas → Resolver diferencias → Firmar y archivar). El mockup describe
// cuatro pasos con «Liquidar sobres» como el tercero, pero Sobres (P-14/P-15/P-16, Fase 4) no existe
// todavía — el propio mockup contempla este caso explícitamente: «con la fase 6 apagada el cierre
// tiene tres pasos y lo dice» (nota bajo el inventario de Cierre.pdf). No se inventa un paso a medias.
//
// Reutiliza toda la infraestructura ya construida para #conciliar/#reconciliation en vez de
// duplicarla: `FinanceCanonicalLedger` para las entradas del extracto, `E11bInbox.reconciliationTasks`
// para las tareas por causa, `closeCurrentMonthTransaction()`/`reopenLatestMonthTransaction()` para
// firmar y reabrir (misma puerta de escritura transaccional que ya usa #reconciliation, con Supabase
// y `FinanceCanonicalMonthClose`/E5 detrás), `accountBalancesFromState()` para el saldo declarado.
// Ningún cálculo financiero nuevo se fabrica aquí.
// =================================================================================================

let cierreActiveStep = 1;
let cierreEvidenceContext = null;

const CIERRE_TASK_CAUSE_LABELS = {
  unclassified: "Clasificación",
  "bank-actual-difference": "Diferencias banco/real",
  "balance-gap": "Continuidad de saldo",
  "debt-capital-mismatch": "Capital de deuda",
};


function cierreAccountsSettled(rows) {
  return rows.every((row) => row.status !== "descuadra");
}

// C-1: pasos secuenciales — cada uno permanece bloqueado hasta que el anterior está completo. Un
// paso ya completado se puede volver a abrir para consultarlo; nunca se puede saltar hacia delante
// uno todavía pendiente.
// C-1 (Cierre.pdf): «El paso de Sobres se salta solo si la fase 6 está apagada, y el cierre lo
// dice.» Con Sobres apagado, la secuencia base tiene tres pasos; con Sobres activo, «Liquidar
// sobres» se inserta entre Resolver y Firmar.
// E-11b: «Revisar plan propuesto» se inserta igual, justo antes de Firmar, solo mientras exista al
// menos un plan propuesto sin confirmar ni descartar — nunca se marca "done" con datos por sí solo
// (a diferencia de los demás pasos): hace falta la acción explícita de Cierre, y en cuanto se
// resuelve el paso deja de insertarse.
function cierreStepsStatus(accountRows, tasks, sobresRows = [], propuestoPending = false) {
  const step1Done = cierreAccountsSettled(accountRows);
  const step2Done = step1Done && tasks.length === 0;
  const steps = [
    { step: 1, label: "Conciliar cuentas", sublabel: "Declarado frente a calculado", unlocked: true, done: step1Done },
    { step: 2, label: "Resolver diferencias", sublabel: "Tareas agrupadas por causa", unlocked: step1Done, done: step2Done },
  ];
  let previousDone = step2Done;
  if (sobresEnabled()) {
    const sobresDone = previousDone && cierreSobresAllResolved(sobresRows);
    steps.push({ step: steps.length + 1, label: "Liquidar sobres", sublabel: "Origen y destino de cada sobre", unlocked: previousDone, done: sobresDone });
    previousDone = sobresDone;
  }
  if (propuestoPending) {
    steps.push({ step: steps.length + 1, label: "Revisar plan propuesto", sublabel: "Confirmar o descartar", unlocked: previousDone, done: false });
    previousDone = false;
  }
  steps.push({ step: steps.length + 1, label: "Firmar y archivar", sublabel: "Comprobaciones antes de firmar", unlocked: previousDone, done: false });
  return steps;
}

function cierreStepsHtml(steps, activeStep) {
  return steps
    .map((item) => {
      const classes = ["cierre-step"];
      if (item.step === activeStep) classes.push("is-active");
      if (item.done) classes.push("is-done");
      if (!item.unlocked) classes.push("is-locked");
      const sublabel = item.unlocked ? item.sublabel : "Se abre al completar el paso anterior";
      return `<li class="${classes.join(" ")}" data-cierre-step="${item.step}">
        <span class="cierre-step-index">${item.done ? "✓" : item.step}</span>
        <div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(sublabel)}</small></div>
      </li>`;
    })
    .join("");
}

// C-5: cuatro comprobaciones del mockup. «Ningún sobre sin destino» solo se muestra con Sobres
// activo — con la bandera apagada se documenta como paso inexistente en vez de fingir un estado que
// cumple (regla transversal 04), igual que antes de que Sobres existiera.
function cierreFirmChecks(accountRows, tasks, monthMovementCount, sobresRows = []) {
  const checks = [
    { id: "cuentas", label: "Las cuentas cuadran", met: cierreAccountsSettled(accountRows) },
    { id: "diferencias", label: "Ninguna diferencia abierta", met: tasks.length === 0 },
  ];
  if (sobresEnabled()) checks.push({ id: "sobres", label: "Ningún sobre sin destino", met: cierreSobresAllResolved(sobresRows) });
  checks.push({ id: "extracto", label: `Extracto incorporado · ${monthMovementCount} movimiento(s)`, met: monthMovementCount > 0 });
  return checks;
}

function cierreFirmChecksHtml(checks) {
  return checks.map((check) => `<li class="deuda-ruta-check${check.met ? " is-ok" : " is-danger"}">${escapeHtml(check.label)}</li>`).join("");
}

// C-3: tareas agrupadas por causa — cuentas, clasificación y saldo — en vez de la lista plana que
// ya usa `#conciliar`. C-4: abrir una tarea solo navega a la pantalla de origen; nunca la marca
// resuelta por sí sola, así que no hay botón «marcar hecho» — la tarea desaparece cuando el dato
// real cuadra, porque `tasks` se recalcula en cada render desde los mismos datos.
function cierreGroupTasksByCause(tasks) {
  return Object.keys(CIERRE_TASK_CAUSE_LABELS)
    .map((cause) => ({ cause, label: CIERRE_TASK_CAUSE_LABELS[cause], items: tasks.filter((task) => task.cause === cause) }))
    .filter((group) => group.items.length);
}

function cierreTaskActionLabel(task) {
  if (task.action === "classify") return "Clasificar";
  if (task.action === "adjust-balance") return "Revisar saldo";
  if (task.action === "review-debt-capital") return "Revisar contrato";
  return "Corregir real";
}

// C-3b (Cierre.pdf, mockup 4f): las tareas de «Clasificación» se resuelven ahora sin salir de
// Cierre, con las mismas dos salidas del mockup — Clasificar (partida existente) o Crear partida
// (una nueva) — en vez de solo navegar a Movimientos como hacían el resto de causas (C-4 sigue
// intacto para ellas). `E11bInbox.reconciliationTasks` construye el id de cada tarea de
// clasificación como `classify-${entry.id}` — se recorta el prefijo para volver a la entrada real
// del ledger, sin tocar la forma de ese módulo compartido con `#conciliar`.
function cierreTaskEntryId(task) {
  if (task.cause !== "unclassified" || !task.id?.startsWith("classify-")) return null;
  return task.id.slice("classify-".length);
}

function cierreTaskItemHtml(task) {
  const entryId = cierreTaskEntryId(task);
  const actions = entryId
    ? `<div class="cierre-task-actions">
        <button type="button" class="e19-btn e19-btn-primary" data-cierre-task-classify="${escapeHtml(entryId)}">Clasificar</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-cierre-task-create-partida="${escapeHtml(entryId)}">Crear partida</button>
      </div>`
    : `<button type="button" class="e19-btn e19-btn-secondary" data-cierre-task-target="${escapeHtml(task.target)}">${cierreTaskActionLabel(task)}</button>`;
  return `<li class="conciliar-task-item">
      <div><strong>${escapeHtml(task.label)}</strong><p>Abrir no modifica nada.</p></div>
      ${actions}
    </li>`;
}

function cierreLedgerEntryById(entryId) {
  return (canonicalLedgerSnapshot?.entries || []).find((entry) => entry.id === entryId) || null;
}

// La entrada del ledger ya trae `movement`/`details` sueltos (ver canonical-ledger.js) y
// `signedAmount` con el signo real — con eso `movementMappingKey`/`mappingForMovement` funcionan
// igual que con una fila cruda de `state.transactions`, sin tocarla para nada.
function cierreEntryAsTransaction(entry) {
  return { movement: entry.movement, details: entry.details, amount: entry.signedAmount };
}

function cierreClassifyNewSectionOptions(kind) {
  return baseData.monthlyPlanning.sections
    .filter((section) => section.kind === kind)
    .map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`)
    .join("");
}

function cierreClassifyModalHtml(entry, mode) {
  const mapping = mappingForMovement(cierreEntryAsTransaction(entry));
  const selected = mapping?.row ? seriesKeyForRow(mapping.row) : "";
  const existingSection = `<div class="cierre-classify-existing">
      <label>
        <span>Partida</span>
        <select id="cierreClassifyPartida">${movementMappingOptions(entry.kind, selected)}</select>
      </label>
      <button type="button" class="e19-btn e19-btn-primary" id="cierreClassifySave">Clasificar</button>
      <button type="button" class="cierre-classify-switch" id="cierreClassifySwitchToNew">¿No existe esa partida? Créala aquí.</button>
    </div>`;
  const newSection = `<div class="cierre-classify-new">
      <label>
        <span>Nombre</span>
        <input type="text" id="cierreClassifyNewLabel" maxlength="60" placeholder="Ej.: Suscripción streaming" />
      </label>
      <label>
        <span>Sección</span>
        <select id="cierreClassifyNewSection">${cierreClassifyNewSectionOptions(entry.kind)}</select>
      </label>
      <button type="button" class="e19-btn e19-btn-primary" id="cierreClassifyCreate">Crear partida y clasificar</button>
      <button type="button" class="cierre-classify-switch" id="cierreClassifySwitchToExisting">¿Ya existe? Elige de la lista.</button>
    </div>`;
  return `
    <h3 id="cierreClassifyTitle">${escapeHtml(entry.description)}</h3>
    <dl class="movement-detail-fields">
      <div><dt>Fecha</dt><dd>${escapeHtml(formatIsoDate(entry.date))}</dd></div>
      <div><dt>Importe</dt><dd class="${entry.signedAmount < 0 ? "negative" : "positive"}">${money(entry.signedAmount, true)}</dd></div>
    </dl>
    <p class="e19-kpi-note">Clasificar aquí aplica la misma regla que Movimientos: se recuerda para todos los movimientos con este concepto, futuros incluidos.</p>
    ${mode === "new" ? newSection : existingSection}
    <div class="cierre-classify-hidden" hidden>${mode === "new" ? existingSection : newSection}</div>`;
}

function cierreClassifyDialogSetMode(entry, mode) {
  const content = qs("cierreClassifyContent");
  if (!content) return;
  content.innerHTML = cierreClassifyModalHtml(entry, mode);
}

function handleCierreTaskClassifyOpen(entryId, mode) {
  const entry = cierreLedgerEntryById(entryId);
  const dialog = qs("cierreClassifyDialog");
  if (!entry || !dialog) return;
  cierreClassifyEntryId = entryId;
  cierreClassifyDialogSetMode(entry, mode);
  dialog.showModal();
}

// La misma secuencia de escritura que ya usa Movimientos (M-7, `handleMovementReclassify`):
// `movementMappings` → `applyMovementMappingsToActuals` → refrescar la sesión de importación
// abierta (M-8b) → guardar reales → recalcular todas las pantallas. Cero cálculo financiero nuevo.
function cierreClassifyApply(entry, rowKey, rowLabel) {
  const key = movementMappingKey(cierreEntryAsTransaction(entry));
  movementMappings[key] = { kind: entry.kind, rowKey, label: rowLabel, updatedAt: new Date().toISOString() };
  saveMovementMappings();
  applyMovementMappingsToActuals();
  pendingMovementMappings = buildPendingMovementMappings(baseData.transactions || []);
  datosImportarRefreshRowsForMappings(new Set([key]));
  saveIncomeActuals();
  saveExpenseActuals();
}

function handleCierreTaskClassifyConfirm() {
  const entry = cierreLedgerEntryById(cierreClassifyEntryId);
  const select = qs("cierreClassifyPartida");
  if (!entry) return;
  if (!select?.value) {
    announceStatus("Elige una partida antes de guardar.");
    return;
  }
  cierreClassifyApply(entry, select.value, select.options[select.selectedIndex]?.textContent || "");
  qs("cierreClassifyDialog")?.close();
  cierreClassifyEntryId = null;
  refreshAllSectionsAfterDataChange();
  announceStatus(`Partida guardada para «${entry.description}».`);
}

function handleCierreTaskCreatePartidaConfirm() {
  const entry = cierreLedgerEntryById(cierreClassifyEntryId);
  const labelInput = qs("cierreClassifyNewLabel");
  const label = (labelInput?.value || "").trim();
  if (!entry) return;
  if (!label) {
    announceStatus("Pon un nombre de concepto para crear la partida.");
    labelInput?.focus();
    return;
  }
  const sectionName = qs("cierreClassifyNewSection")?.value || "";
  const sharedId = `custom-${entry.kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  customPlanningRows.push({ id: sharedId, custom: true, kind: entry.kind, sectionName, label, monthKey: entry.monthKey, plannedValue: entry.amount });
  saveCustomPlanningRows();
  cierreClassifyApply(entry, `${entry.kind}|${sharedId}`, label);
  qs("cierreClassifyDialog")?.close();
  cierreClassifyEntryId = null;
  refreshAllSectionsAfterDataChange();
  announceStatus(`«${label}» creada y el movimiento clasificado.`);
}

function cierreStep1Html(accountRows) {
  const descuadres = accountRows.filter((row) => row.status === "descuadra").length;
  const statusBadge = { cuadra: "e19-badge-success", descuadra: "e19-badge-danger", "sin-conciliar": "e19-badge-neutral" };
  const statusLabel = { cuadra: "Cuadra", descuadra: "Descuadra", "sin-conciliar": "Sin conciliar" };
  const rows = accountRows
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.label)}</strong></td>
        <td>${money(row.declared, true)}</td>
        <td>${row.calculated === null ? "—" : money(row.calculated, true)}</td>
        <td>${row.diff === null ? "—" : money(row.diff, true)}</td>
        <td><span class="e19-badge ${statusBadge[row.status]}">${statusLabel[row.status]}</span>${
        row.status === "descuadra" ? ` <button type="button" class="e19-btn e19-btn-secondary cierre-inline-button" data-cierre-task-target="update-hub">Crear tarea</button>` : ""
      }</td>
      </tr>`
    )
    .join("");
  return `<article class="e19-card cierre-step-card">
    <div class="section-title with-action">
      <div><h3 class="escenario-motor-panel-title">Conciliar cuentas</h3><p class="e19-kpi-note">Saldo declarado frente a saldo calculado.</p></div>
      ${descuadres ? `<span class="e19-badge e19-badge-danger">${descuadres} cuenta(s) descuadran</span>` : ""}
    </div>
    <div class="table-wrap"><table class="e19-table cierre-accounts-table">
      <thead><tr><th>Cuenta</th><th>Declarado</th><th>Calculado</th><th>Diferencia</th><th>Estado</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="e19-kpi-note">El saldo calculado sale del último movimiento del extracto incorporado; el declarado, de lo que escribiste en Registrar. Una diferencia no se corrige sola: revisa el saldo en Datos.</p>
  </article>`;
}

function cierreStep2Html(tasks) {
  const groups = cierreGroupTasksByCause(tasks);
  if (!groups.length) {
    return `<article class="e19-card cierre-step-card"><h3 class="escenario-motor-panel-title">Resolver diferencias</h3><p class="e19-kpi-note">Sin diferencias abiertas: clasificación, saldos e importes reales están conciliados.</p></article>`;
  }
  const groupsHtml = groups
    .map(
      (group) => `<div class="cierre-task-group">
        <h4>${escapeHtml(group.label)} · ${group.items.length}</h4>
        <ol class="conciliar-task-list">${group.items.map(cierreTaskItemHtml).join("")}</ol>
      </div>`
    )
    .join("");
  return `<article class="e19-card cierre-step-card">
    <h3 class="escenario-motor-panel-title">Resolver diferencias</h3>
    <p class="e19-kpi-note">Cada tarea nombra la pantalla y el dato que la generó. Abrir una tarea no corrige nada por sí sola: se cierra cuando el dato cuadra, no cuando se pulsa.</p>
    ${groupsHtml}
  </article>`;
}

// C-8: efectos reales de firmar, escritos antes de pulsar. «Se liquidan los sobres» solo se anuncia
// con Sobres activo — el mockup lo cuenta como el efecto 02, con origen y destino de cada asiento.
function cierreEffectsHtml(monthLabel, sobresRows = []) {
  const sobresItem = sobresEnabled()
    ? `<li>Se ejecutan los ${sobresRows.length} asiento(s) de liquidación de sobres, cada uno con su origen y destino.</li>`
    : "";
  return `<ol class="cierre-effects-list">
    <li>Los reales de ${escapeHtml(monthLabel)} quedan congelados: dejan de aceptar cambios sin reabrir el mes.</li>
    ${sobresItem}
    <li>Se crea una versión nueva del cierre, con su fecha y su motivo.</li>
    <li>El mes se puede reabrir después: la reapertura pide un motivo y queda registrada como una versión más.</li>
  </ol>`;
}

function cierreStep3Html(accountRows, tasks, monthMovementCount, currentMonthKey, sobresRows = []) {
  const checks = cierreFirmChecks(accountRows, tasks, monthMovementCount, sobresRows);
  const unmet = checks.filter((check) => !check.met).length;
  const monthLabel = ledgerMonthLabel(currentMonthKey);
  const syncReady = Boolean(remoteUser) && Boolean(supabaseClient);
  const canSign = unmet === 0 && syncReady;
  return `<div class="cierre-step3-layout">
    <article class="e19-card">
      <h3 class="escenario-motor-panel-title">Antes de firmar</h3>
      <ul class="deuda-ruta-checklist">${cierreFirmChecksHtml(checks)}</ul>
      ${syncReady ? "" : `<p class="e19-kpi-note is-warn">Inicia sesión y sincroniza una versión antes de firmar.</p>`}
      <button type="button" class="e19-btn e19-btn-primary" id="cierreSignButton" ${canSign ? "" : "disabled"}>${unmet ? `Firmar · ${unmet} sin cumplir` : "Firmar cierre"}</button>
    </article>
    <article class="e19-card">
      <h3 class="escenario-motor-panel-title">Al firmar el cierre</h3>
      ${cierreEffectsHtml(monthLabel, sobresRows)}
    </article>
  </div>`;
}

// C-9: cuatro contadores con enlace al inventario completo (`#conciliar`, que conserva la lista

function cierreSobresRows(month) {
  return sobresMonthBalances(month);
}


function cierreSobresAllResolved(rows) {
  return rows.length ? cierreSobresResolved(rows).every((row) => row.resolved) : true;
}


function cierreSobresDestinoLabel(row, rows) {
  if (row.saldo < 0) return "";
  if (typeof row.destino === "string" && row.destino.startsWith("sobre:")) {
    const target = rows.find((item) => item.rowKey === row.destino.slice(6));
    return `Cubre «${escapeHtml(target?.label || "")}»`;
  }
  if (typeof row.destino === "string" && row.destino.startsWith("objetivo:")) {
    const goal = savingsGoalsList().find((item) => item.id === row.destino.slice("objetivo:".length));
    return `Objetivo: «${escapeHtml(goal?.label || "")}»`;
  }
  return "Arrastra al mes siguiente";
}

function cierreSobresOptionsHtml(row, rows) {
  const current = cierreSobresChoices[row.rowKey] || "";
  const opt = (value, label) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
  const options = [opt("", "Elegir origen…")];
  if (row.rule === "arrastra") options.push(opt("arrastra", "Arrastra el déficit al mes siguiente"));
  rows
    .filter((other) => other.rowKey !== row.rowKey && other.saldo > 0)
    .forEach((other) => options.push(opt(`sobre:${other.rowKey}`, `Se cubre con «${other.label}»`)));
  options.push(opt("general", "Se cubre con liquidez general"));
  return `<select data-sobres-origen="${escapeHtml(row.rowKey)}" aria-label="Origen del sobre ${escapeHtml(row.label)}">${options.join("")}</select>`;
}

// P-16: destino de un sobre positivo NO reclamado por ningún sobre negativo — hasta ahora arrastraba
// en silencio (P-14); ahora puede sumar de verdad a un objetivo de ahorro declarado en P-13, en su
// orden de prioridad, sin ofrecer uno ya completado (regla transversal 04: no tiene sentido seguir
// sumando a un objetivo que ya alcanzó su importe).
function sobresGoalDestinoOptions(current) {
  const contributions = savingsGoalsContributions();
  const goals = savingsGoalsList().filter((goal) => {
    const target = Number(goal.targetAmount || 0);
    return !(target > 0 && Number(contributions[goal.id] || 0) >= target);
  });
  const opt = (value, label) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
  const options = [opt("arrastra", "Arrastra al mes siguiente")];
  goals.forEach((goal) => options.push(opt(`objetivo:${goal.id}`, `Objetivo: ${goal.label}`)));
  return options.join("");
}

function cierreSobresDestinoSelectHtml(row) {
  const current = typeof cierreSobresChoices[row.rowKey] === "string" ? cierreSobresChoices[row.rowKey] : "arrastra";
  return `<select data-sobres-destino="${escapeHtml(row.rowKey)}" aria-label="Destino del sobre ${escapeHtml(row.label)}">${sobresGoalDestinoOptions(current)}</select>`;
}

// P-15/C-6 (Cierre.pdf): «Una línea por sobre con saldo, destino declarado y estado del asiento. Un
// sobre en negativo sin origen bloquea la firma.» C-7: las coberturas entre sobres se listan aparte,
// con origen e importe, antes de firmar.
function cierreStep3SobresHtml(sobresRows, monthKey) {
  const resolved = cierreSobresResolved(sobresRows);
  const monthLabel = ledgerMonthLabel(monthKey);
  const body = resolved.length
    ? resolved
        .map(
          (row) => `<tr class="${row.resolved ? "" : "is-danger"}">
        <td>${escapeHtml(row.label)}</td>
        <td>${money(row.saldo, true)}</td>
        <td>${
          row.saldo >= 0
            ? typeof row.destino === "string" && row.destino.startsWith("sobre:")
              ? escapeHtml(cierreSobresDestinoLabel(row, resolved))
              : cierreSobresDestinoSelectHtml(row)
            : cierreSobresOptionsHtml(row, resolved)
        }</td>
        <td><span class="e19-badge ${row.resolved ? "e19-badge-success" : "e19-badge-danger"}">${row.resolved ? "Listo" : "Pendiente"}</span></td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="registrar-mes-empty">${escapeHtml(monthLabel)} no tiene partidas de Gastos variables.</td></tr>`;
  const coverages = resolved.filter((row) => row.saldo < 0 && row.resolved && typeof row.origen === "string" && row.origen.startsWith("sobre:"));
  const coveragesHtml = coverages.length
    ? `<article class="e19-card">
        <h3 class="escenario-motor-panel-title">Coberturas entre sobres</h3>
        <p class="e19-kpi-note">Cada cobertura queda como su propio asiento, con origen e importe, visible antes de firmar y consultable después en el historial.</p>
        <ul class="deuda-ruta-checklist">${coverages
          .map((row) => {
            const source = resolved.find((item) => item.rowKey === row.origen.slice(6));
            return `<li>«${escapeHtml(source?.label || "")}» cubre ${money(Math.abs(row.saldo), true)} de «${escapeHtml(row.label)}»</li>`;
          })
          .join("")}</ul>
      </article>`
    : "";
  return `<article class="e19-card cierre-step-card">
    <h3 class="escenario-motor-panel-title">Liquidar sobres</h3>
    <p class="e19-kpi-note">Una línea por sobre de Gastos variables de ${escapeHtml(monthLabel)}. Un sobre en negativo necesita un origen declarado antes de firmar.</p>
    <div class="table-wrap"><table class="e19-table cierre-sobres-table">
      <thead><tr><th>Sobre</th><th>Saldo</th><th>Destino / origen</th><th>Estado</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    ${coveragesHtml}
  </article>`;
}

// E-11b: «el cierre del mes es donde se confirma o se descarta» — el único paso de Cierre que no
// se resuelve solo con datos: hace falta pulsar Confirmar o Descartar por cada plan propuesto.
// Confirmar lo convierte en vigente (y degrada a "guardado" el vigente anterior, si había uno);
// descartar lo deja "guardado", sin tocar el vigente actual — ninguna de las dos acciones borra
// nada, misma disciplina que archivar.
function cierreStepPropuestoHtml(propuestos) {
  const rows = propuestos
    .map(
      (entry) => `<li class="conciliar-task-item">
        <div><strong>${escapeHtml(entry.nombre || "Escenario")}</strong><p>${escapeHtml(entry.motivo || "")}</p></div>
        <div class="cierre-propuesto-actions">
          <button type="button" class="e19-btn e19-btn-primary" data-cierre-propuesto-confirm="${escapeHtml(entry.id)}">Confirmar</button>
          <button type="button" class="e19-btn e19-btn-secondary" data-cierre-propuesto-discard="${escapeHtml(entry.id)}">Descartar</button>
        </div>
      </li>`
    )
    .join("");
  return `<article class="e19-card cierre-step-card">
    <h3 class="escenario-motor-panel-title">Revisar plan propuesto</h3>
    <p class="e19-kpi-note">Confirmar lo convierte en el plan vigente. Descartar lo deja guardado, sin tocar el vigente actual. Ninguna de las dos acciones borra nada.</p>
    <ol class="conciliar-task-list">${rows}</ol>
  </article>`;
}

// Laboratorio · debtLiquidations (20 de agosto de 2026, cierra el hueco documentado en
// docs/BACKLOG_NUEVE_PANTALLAS.md §7): Deuda · Ruta y Deuda · Comparar aplican a través de
// Escenarios (`escenario-motor-saved`), un almacén distinto de `debtLiquidations` que Hoy y Deuda
// sí leen para deduplicar ofertas ya decididas (L-5). Sin este puente, una deuda decidida por
// Escenarios seguía apareciendo como «sin decidir» en cualquier pantalla que solo mira
// `debtLiquidations` — hueco real, no una redundancia. No se reconstruye el cálculo completo de
// `debtDecisionFromValues` (cuota/mes exactos exigirían repetir toda la simulación del motor):
// solo se refleja qué deuda ya tiene una decisión vigente y con qué importe aproximado, lo mínimo
// que el resto de la app necesita para no volver a ofrecerla.
function escenarioDecisionIsDebt(decision) {
  return escenarioMotorResolveType(decision)?.grupo === "Deuda";
}

function escenarioDecisionTargetIds(decision) {
  if (!escenarioDecisionIsDebt(decision)) return [];
  const params = decision.params || {};
  // «Pedir deuda nueva» es la única decisión del grupo Deuda sin `deudaId`: no hay contrato
  // existente que marcar como ya decidido.
  if (Array.isArray(params.deudaIds)) return params.deudaIds.filter(Boolean);
  return params.deudaId ? [params.deudaId] : [];
}

// Importe aproximado, solo para las cifras de apoyo de las heredadas que todavía suman
// `debtLiquidations` (Control de deuda). «Reunificar» reparte un único principal nuevo entre
// varias deudas y «Retomar pagos» no tiene un importe de una vez — ambas se dejan en 0 antes que
// inventar un reparto.
function escenarioDecisionAmount(decision) {
  const params = decision.params || {};
  switch (decision.tipo) {
    case "amortizacion":
      return Number(params.importe || 0);
    case "amortizacion_fraccionada":
      return Number(params.importeMensual || 0) * Math.max(0, Number(params.meses || 0));
    case "refinanciacion":
      return Number(params.nuevoPrincipal || 0);
    case "acuerdo_quita":
      return Number(params.importePactado || 0);
    default:
      return 0;
  }
}

// reunificacion/retomar_pagos aterrizan con amount=0 a propósito (escenarioDecisionAmount, "se
// dejan en 0 antes que inventar un reparto") — sin esto, en Planificación de partidas y en el
// resto de sitios que solo leen `name` parecería que la decisión no tiene ningún efecto. Se
// añade como texto de contexto, nunca como cifra de cálculo: no toca escenarioDecisionAmount ni
// los tests que la cubren.
function escenarioDebtLiquidationName(decision) {
  const base = decision.titulo || "Decisión de Escenarios";
  const params = decision.params || {};
  if (decision.tipo === "reunificacion" && params.nuevoPrincipal) {
    return `${base} (nuevo principal ${money(params.nuevoPrincipal, true)})`;
  }
  if (decision.tipo === "retomar_pagos" && params.cuota) {
    return `${base} (cuota retomada ${money(params.cuota, true)}/mes)`;
  }
  return base;
}

function syncDebtLiquidationsFromEscenario(entry) {
  if (!entry) return false;
  const existingTargets = new Set(debtLiquidations.map((item) => item.targetId).filter(Boolean));
  let changed = false;
  (entry.decisiones || []).forEach((decision) => {
    escenarioDecisionTargetIds(decision).forEach((targetId) => {
      // Mismo criterio que `applyDebtDecision`: la primera decisión sobre una deuda gana, las
      // demás no se aplican por duplicado — aquí, no se reflejan.
      if (existingTargets.has(targetId)) return;
      debtLiquidations.push({
        id: `escenario:${entry.id}:${decision.id}:${targetId}`,
        targetId,
        name: escenarioDebtLiquidationName(decision),
        amount: round2(escenarioDecisionAmount(decision)),
        monthlyRelief: 0,
        lifecycleState: "approved",
        source: "escenario",
        escenarioSavedId: entry.id,
        escenarioDecisionId: decision.id,
      });
      existingTargets.add(targetId);
      changed = true;
    });
  });
  return changed;
}


// E-1/E-1b (17-20 de agosto de 2026): aterrizaje de los tipos de Escenarios sin equivalente en
// debtLiquidations. Igual que syncDebtLiquidationsFromEscenario, no reconstruye el motor
// completo: traduce cada decisión al shape mínimo que `projects` ya entiende, replicando la misma
// aritmética que canonical-scenario-engine.js usa para su propio forecast (mismos campos, mismas
// fórmulas) para no divergir del preview que el usuario vio al crear el escenario. `traspaso` y
// `cambio_presupuesto` quedan fuera a propósito: canonical-scenario-engine.js (líneas 61-68) ya
// explica por qué ninguno de los dos tiene motor de cálculo, y tampoco existen en el catálogo de
// tipos de la UI — no es un gap de aterrizaje, es que hoy no se pueden crear desde ningún sitio.
const ESCENARIO_PROJECT_LANDING_TYPES = new Set(["compra", "proyecto", "imprevisto", "propio", "deuda_nueva", "prestamo_familiar"]);

function escenarioResolvedMonthKey(decision) {
  return decision?.planificacion?.mesResuelto || decision?.planificacion?.mesManual || "";
}

function escenarioMonthIndex(monthKey) {
  if (!monthKey) return -1;
  return forecastMonths().findIndex((month) => month.key === monthKey);
}

function landScenarioDecisionAsProjects(decision, entry) {
  if (!decision || !ESCENARIO_PROJECT_LANDING_TYPES.has(decision.tipo)) return [];
  const params = decision.params || {};
  const months = forecastMonths();
  const base = {
    name: decision.titulo || "Decisión de Escenarios",
    source: "escenario",
    escenarioSavedId: entry.id,
    escenarioDecisionId: decision.id,
    lifecycleState: "approved",
    locked: false,
    mode: "fixed",
    recurringAmount: 0,
    recurringDuration: 0,
    recurringStartOffset: 0,
  };
  const withId = (suffix, extra) => ({ ...base, ...extra, id: `escenario-project:${entry.id}:${decision.id}${suffix}` });

  switch (decision.tipo) {
    case "compra": {
      const startIndex = escenarioMonthIndex(escenarioResolvedMonthKey(decision));
      if (startIndex < 0) return [];
      const month = months[startIndex];
      if (params.financiacion) {
        return [withId("", {
          amount: 0,
          duration: 1,
          monthKey: month.key,
          monthIndex: month.index,
          recurringAmount: round2(Number(params.financiacion.cuota || 0)),
          recurringDuration: Math.max(1, Math.floor(Number(params.financiacion.plazo || 1))),
        })];
      }
      return [withId("", { amount: round2(Number(params.importe || 0)), duration: 1, monthKey: month.key, monthIndex: month.index })];
    }
    case "proyecto": {
      const objetivoIndex = escenarioMonthIndex(params.mesObjetivo);
      if (objetivoIndex < 0) return [];
      const importe = round2(Number(params.importeObjetivo || 0));
      if (params.modalidad === "hucha") {
        const resolvedIndex = escenarioMonthIndex(escenarioResolvedMonthKey(decision));
        const startIndex = Math.max(0, resolvedIndex >= 0 ? resolvedIndex : 0);
        if (objetivoIndex > startIndex) {
          const mesesCount = objetivoIndex - startIndex + 1;
          const startMonth = months[startIndex];
          return [withId("", {
            amount: 0,
            duration: 1,
            monthKey: startMonth.key,
            monthIndex: startMonth.index,
            recurringAmount: round2(importe / mesesCount),
            recurringDuration: mesesCount,
          })];
        }
      }
      const month = months[objetivoIndex];
      return [withId("", { amount: importe, duration: 1, monthKey: month.key, monthIndex: month.index })];
    }
    case "imprevisto": {
      const startIndex = escenarioMonthIndex(params.mes);
      if (startIndex < 0) return [];
      const importe = round2(Number(params.importe || 0));
      const recurrenciaMeses = params.recurrenciaMeses;
      if (recurrenciaMeses === undefined || recurrenciaMeses === null) {
        const month = months[startIndex];
        return [withId("", { amount: importe, duration: 1, monthKey: month.key, monthIndex: month.index })];
      }
      const paso = Math.max(1, Math.floor(Number(recurrenciaMeses)));
      const entries = [];
      for (let index = startIndex, occurrence = 0; index < months.length; index += paso, occurrence += 1) {
        const month = months[index];
        entries.push(withId(`:${occurrence}`, { amount: importe, duration: 1, monthKey: month.key, monthIndex: month.index }));
      }
      return entries;
    }
    case "propio": {
      const startIndex = escenarioMonthIndex(params.mes);
      if (startIndex < 0) return [];
      const month = months[startIndex];
      const extra = { monthKey: month.key, monthIndex: month.index, amount: 0, duration: 1 };
      if (params.importe !== undefined) extra.amount = round2(Number(params.importe));
      if (params.mensualidad !== undefined && params.plazo !== undefined) {
        extra.recurringAmount = round2(Number(params.mensualidad));
        extra.recurringDuration = Math.max(1, Math.floor(Number(params.plazo)));
      }
      return [withId("", extra)];
    }
    case "deuda_nueva": {
      const startIndex = escenarioMonthIndex(params.mes);
      if (startIndex < 0) return [];
      const month = months[startIndex];
      const plazo = Math.max(1, Math.floor(Number(params.plazo || 1)));
      return [withId("", {
        amount: round2(-Number(params.principal || 0)),
        duration: 1,
        monthKey: month.key,
        monthIndex: month.index,
        recurringAmount: round2(Number(params.cuota || 0)),
        recurringDuration: plazo,
        recurringStartOffset: 1,
      })];
    }
    case "prestamo_familiar": {
      const startIndex = escenarioMonthIndex(params.mes);
      if (startIndex < 0) return [];
      const month = months[startIndex];
      const sale = params.direccion === "prestamos";
      const importe = round2(Number(params.importe || 0));
      const entries = [withId(":inicial", { amount: sale ? importe : -importe, duration: 1, monthKey: month.key, monthIndex: month.index })];
      if (params.devolucionMensual !== undefined && params.meses !== undefined) {
        const devolucion = round2(Number(params.devolucionMensual));
        const meses = Math.max(1, Math.floor(Number(params.meses)));
        entries.push(withId(":devolucion", {
          amount: 0,
          duration: 1,
          monthKey: month.key,
          monthIndex: month.index,
          recurringAmount: sale ? -devolucion : devolucion,
          recurringDuration: meses,
          recurringStartOffset: 1,
        }));
      }
      return entries;
    }
    default:
      return [];
  }
}

function syncProjectsFromEscenario(entry) {
  if (!entry) return false;
  const existingIds = new Set(projects.map((item) => item.id));
  let changed = false;
  (entry.decisiones || []).forEach((decision) => {
    landScenarioDecisionAsProjects(decision, entry).forEach((project) => {
      if (existingIds.has(project.id)) return;
      projects.push(project);
      existingIds.add(project.id);
      changed = true;
    });
  });
  return changed;
}


// Mismo espíritu que landScenarioDecisionAsProjects, para cambio_ingreso/cambio_gasto: no hay
// ningún array de ingresos/gastos editable por decisión en el dominio existente, así que aterriza
// como líneas nuevas y aditivas de `customPlanningRows` (mismo shape que ya usa
// handleVisualAddRow) en vez de intentar resolver y sobrescribir una fila concreta del
// presupuesto — un ajuste declarado, no una edición silenciosa de otra partida.
function landScenarioDecisionAsPlanningRows(decision, entry) {
  if (!decision || (decision.tipo !== "cambio_ingreso" && decision.tipo !== "cambio_gasto")) return [];
  const params = decision.params || {};
  const months = forecastMonths();
  const startIndex = escenarioMonthIndex(params.mesInicio);
  if (startIndex < 0) return [];
  const declaredEndIndex = params.mesFin ? escenarioMonthIndex(params.mesFin) : months.length - 1;
  const endIndex = declaredEndIndex < 0 ? months.length - 1 : declaredEndIndex;
  const kind = decision.tipo === "cambio_ingreso" ? "income" : "expense";
  const rows = [];
  for (let index = startIndex; index <= endIndex && index < months.length; index += 1) {
    const month = months[index];
    let plannedValue;
    if (decision.tipo === "cambio_ingreso" || params.deltaMensual !== undefined) {
      plannedValue = round2(Number(params.deltaMensual || 0));
    } else {
      const coreSpend = Number(lastSimulation?.[index]?.coreSpend || 0);
      plannedValue = round2(coreSpend * Number(params.deltaPct || 0));
    }
    rows.push({
      id: `escenario-row:${entry.id}:${decision.id}`,
      custom: true,
      kind,
      sectionName: "Escenarios",
      label: decision.titulo || "Ajuste de Escenarios",
      monthKey: month.key,
      plannedValue,
      source: "escenario",
      escenarioSavedId: entry.id,
      escenarioDecisionId: decision.id,
    });
  }
  return rows;
}

function syncPlanningRowsFromEscenario(entry) {
  if (!entry) return false;
  const existingKeys = new Set(
    customPlanningRows
      .filter((row) => row.source === "escenario")
      .map((row) => `${row.escenarioSavedId}|${row.escenarioDecisionId}|${row.monthKey}`),
  );
  let changed = false;
  (entry.decisiones || []).forEach((decision) => {
    landScenarioDecisionAsPlanningRows(decision, entry).forEach((row) => {
      const key = `${row.escenarioSavedId}|${row.escenarioDecisionId}|${row.monthKey}`;
      if (existingKeys.has(key)) return;
      customPlanningRows.push(row);
      existingKeys.add(key);
      changed = true;
    });
  });
  return changed;
}


function handleCierrePropuestoConfirm(id) {
  const previous = loadEscenarioMotorSaved();
  const demoted = previous.filter((entry) => entry.id !== id && (entry.estado === "aplicado" || entry.estado === "vigente"));
  const promoted = previous.find((entry) => entry.id === id) || null;
  const list = previous.map((entry) => {
    if (entry.id === id) return { ...entry, estado: "vigente" };
    if (entry.estado === "aplicado" || entry.estado === "vigente") return { ...entry, estado: "guardado" };
    return entry;
  });
  saveEscenarioMotorSavedList(list);
  let liquidationsChanged = false;
  let projectsChanged = false;
  let planningRowsChanged = false;
  demoted.forEach((entry) => {
    if (retractDebtLiquidationsFromEscenario(entry.id)) liquidationsChanged = true;
    if (retractProjectsFromEscenario(entry.id)) projectsChanged = true;
    if (retractPlanningRowsFromEscenario(entry.id)) planningRowsChanged = true;
  });
  if (promoted) {
    if (syncDebtLiquidationsFromEscenario(promoted)) liquidationsChanged = true;
    if (syncProjectsFromEscenario(promoted)) projectsChanged = true;
    if (syncPlanningRowsFromEscenario(promoted)) planningRowsChanged = true;
  }
  if (liquidationsChanged) saveDebtLiquidations();
  if (projectsChanged) saveProjects();
  if (planningRowsChanged) saveCustomPlanningRows();
  renderCierre();
}

function handleCierrePropuestoDiscard(id) {
  const list = loadEscenarioMotorSaved().map((entry) => (entry.id === id ? { ...entry, estado: "guardado" } : entry));
  saveEscenarioMotorSavedList(list);
  renderCierre();
}

function handleCierreSobresOriginChange(rowKey, value) {
  if (!rowKey) return;
  if (value) cierreSobresChoices[rowKey] = value;
  else delete cierreSobresChoices[rowKey];
  renderCierre();
}

// P-16: elección de destino de un sobre positivo — «arrastra» es el valor por defecto (equivalente
// a no tener ninguna elección guardada), así que solo se guarda una elección real cuando apunta a un
// objetivo.
function handleCierreSobresDestinoChange(rowKey, value) {
  if (!rowKey) return;
  if (value && value !== "arrastra") cierreSobresChoices[rowKey] = value;
  else delete cierreSobresChoices[rowKey];
  renderCierre();
}

// detallada por movimiento). Los IDs de las tareas ya son estables — `E11bInbox.reconciliationTasks`
// los construye a partir del propio dato (`classify-${id}`, no de su posición en la lista).
function cierreCountersHtml(accountRows, tasks, unclassifiedCount) {
  const closedCount = monthClosures.filter((op) => op.status === "closed").length;
  return [
    ["Cuentas descuadradas", String(accountRows.filter((row) => row.status === "descuadra").length)],
    ["Tareas pendientes", String(tasks.length)],
    ["Movimientos sin clasificar", String(unclassifiedCount)],
    ["Meses cerrados", String(closedCount)],
  ]
    .map(([label, value]) => `<div class="e19-kpi"><span class="e19-kpi-label">${escapeHtml(label)}</span><span class="e19-kpi-value">${escapeHtml(value)}</span></div>`)
    .join("");
}


function cierreVersionsHtml(rows) {
  if (!rows.length) return `<p class="e19-kpi-note">Todavía no hay ninguna versión firmada.</p>`;
  const estadoBadge = { closed: "e19-badge-success", reopened: "e19-badge-warning" };
  const estadoLabel = { closed: "Cerrado", reopened: "Reabierto" };
  return `<div class="table-wrap"><table class="e19-table cierre-versions-table">
    <thead><tr><th>Fecha</th><th>Mes</th><th>Autor</th><th>Resumen</th><th>Estado</th></tr></thead>
    <tbody>${rows
      .map(
        (row) => `<tr class="${row.vigente ? "is-vigente" : ""}">
          <td>${escapeHtml(row.fecha ? formatIsoDate(row.fecha.slice(0, 10)) : "—")}</td>
          <td>${escapeHtml(ledgerMonthLabel(row.monthKey))}</td>
          <td>${escapeHtml(row.autor)}</td>
          <td>${escapeHtml(row.resumen)}${row.vigente ? ` <span class="e19-badge e19-badge-neutral">Vigente</span>` : ""}</td>
          <td><span class="e19-badge ${estadoBadge[row.estado] || "e19-badge-neutral"}">${estadoLabel[row.estado] || row.estado}</span></td>
        </tr>`
      )
      .join("")}</tbody>
  </table></div>`;
}


function cierreAprendizajeHtml() {
  const history = loadCierreAprendizajeHistory();
  if (!history.length) {
    return `<p class="e19-kpi-note">Todavía no hay ningún cierre firmado con reales que resumir aquí. Se llena solo, un mes cada vez que se firma.</p>`;
  }
  const threshold = partidaDeviationThreshold();
  const reopened = cierreMonthsCurrentlyReopened();
  const rowsHtml = history
    .map((row) => {
      const badge = !threshold
        ? "—"
        : `<span class="e19-badge ${row.deviationPct <= threshold ? "e19-badge-success" : "e19-badge-danger"}">${row.deviationPct <= threshold ? "Acertó" : "Se desvió"}</span>`;
      const reopenedNote = reopened.has(row.monthKey) ? ` <span class="e19-badge e19-badge-warning">Reabierto desde entonces</span>` : "";
      return `<tr>
        <td>${escapeHtml(row.label)}${reopenedNote}</td>
        <td>${money(row.plannedTotal, true)}</td>
        <td>${money(row.realTotal, true)}</td>
        <td>${row.deviationPct === Infinity ? "—" : `${row.deviationPct.toFixed(1)}%`}</td>
        <td>${badge}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table class="e19-table cierre-aprendizaje-table">
    <thead><tr><th>Mes</th><th>Previsto</th><th>Real</th><th>Desviación</th><th>Veredicto</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table></div>
  <p class="e19-kpi-note">Un registro por mes firmado, no una corrección automática: ninguna previsión futura cambia sola a partir de esta tabla.</p>`;
}

// C-12: "PDF firmado de una página con el estado de las cuentas, las tareas resueltas, los
// asientos de sobres y la versión [...] CSV con los mismos datos en filas [...] Los dos llevan la
// misma fecha y el mismo identificador de versión." Con Sobres (Fase 6) desactivado, o si el cierre
// es anterior a que existiera, no hay asientos que listar y se dice explícitamente en vez de en
// silencio. "Tareas resueltas" se representa como el recuento de diferencias abiertas en el momento
// de la descarga (0 si el mes ya se firmó): no existe un registro histórico de qué tarea concreta
// se resolvió cuándo, así que no se inventa uno.
function cierreEvidenceRows(accountRows, tasks, closure, currentMonthKey) {
  const version = closure ? { id: closure.id, fecha: closure.closedAt || closure.occurredAt || "", autor: closure.author || "Sin identificar", motivo: closure.reason || "" } : null;
  return {
    monthKey: currentMonthKey,
    monthLabel: ledgerMonthLabel(currentMonthKey),
    version,
    accounts: accountRows.map((row) => ({ label: row.label, declarado: row.declared, calculado: row.calculated, diferencia: row.diff, estado: row.status })),
    diferenciasAbiertas: tasks.length,
    envelopeSettlements: Array.isArray(closure?.envelopeSettlements) ? closure.envelopeSettlements : [],
  };
}

function cierreEvidenceCsvContent(evidence) {
  const header = ["Sección", "Cuenta", "Declarado", "Calculado", "Diferencia", "Estado", "Versión", "Fecha", "Autor", "Motivo"];
  const versionCols = [evidence.version?.id || "", evidence.version?.fecha ? evidence.version.fecha.slice(0, 10) : "", evidence.version?.autor || "", evidence.version?.motivo || ""];
  const lines = evidence.accounts.map((row) =>
    ["Cuentas", row.label, row.declarado, row.calculado ?? "", row.diferencia ?? "", row.estado, ...versionCols].map(csvValue).join(";")
  );
  lines.push(["Diferencias", `${evidence.diferenciasAbiertas} abierta(s) en el momento de la descarga`, "", "", "", "", ...versionCols].map(csvValue).join(";"));
  if (evidence.envelopeSettlements.length) {
    evidence.envelopeSettlements.forEach((item) => {
      const destinoTexto = item.saldo >= 0 ? (item.destino === "arrastra" ? "Arrastra al mes siguiente" : item.destino || "") : item.origen || "";
      lines.push(["Sobres", item.label, item.saldo, "", "", destinoTexto, ...versionCols].map(csvValue).join(";"));
    });
  } else {
    lines.push(["Sobres", sobresEnabled() ? "Sin sobres liquidados en este cierre" : "Fase 6 desactivada: sin asientos que exportar", "", "", "", "", ...versionCols].map(csvValue).join(";"));
  }
  return `﻿${[header.map(csvValue).join(";"), ...lines].join("\r\n")}`;
}

function cierreEvidencePrintHtml(evidence) {
  const statusLabel = { cuadra: "Cuadra", descuadra: "Descuadra", "sin-conciliar": "Sin conciliar" };
  const sobresRowsHtml = evidence.envelopeSettlements.length
    ? `<table>
        <thead><tr><th>Sobre</th><th>Saldo</th><th>Destino / origen</th></tr></thead>
        <tbody>${evidence.envelopeSettlements
          .map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${money(item.saldo, true)}</td><td>${escapeHtml(item.saldo >= 0 ? (item.destino === "arrastra" ? "Arrastra al mes siguiente" : item.destino || "") : item.origen || "")}</td></tr>`)
          .join("")}</tbody>
      </table>`
    : `<p>Sobres: ${sobresEnabled() ? "sin sobres liquidados en este cierre" : "Fase 6 desactivada, sin asientos que archivar"}.</p>`;
  return `<h1>Cierre de ${escapeHtml(evidence.monthLabel)}</h1>
    <p>${evidence.version ? `Versión ${escapeHtml(evidence.version.id)} · firmado el ${escapeHtml(formatIsoDate((evidence.version.fecha || "").slice(0, 10)))} · ${escapeHtml(evidence.version.autor)} · ${escapeHtml(evidence.version.motivo)}` : "Mes todavía sin firmar en el momento de esta descarga."}</p>
    <table>
      <thead><tr><th>Cuenta</th><th>Declarado</th><th>Calculado</th><th>Diferencia</th><th>Estado</th></tr></thead>
      <tbody>${evidence.accounts
        .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${money(row.declarado, true)}</td><td>${row.calculado === null ? "—" : money(row.calculado, true)}</td><td>${row.diferencia === null ? "—" : money(row.diferencia, true)}</td><td>${statusLabel[row.estado] || row.estado}</td></tr>`)
        .join("")}</tbody>
    </table>
    <p>Diferencias abiertas en el momento de la descarga: ${evidence.diferenciasAbiertas}.</p>
    ${sobresRowsHtml}`;
}

function downloadCierreEvidenceCsv(evidence) {
  const blob = new Blob([cierreEvidenceCsvContent(evidence)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cierre-${evidence.monthKey}${evidence.version ? `-${evidence.version.id}` : ""}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleCierreDownloadEvidence(kind, accountRows, tasks, closure, currentMonthKey) {
  const evidence = cierreEvidenceRows(accountRows, tasks, closure, currentMonthKey);
  if (kind === "csv") {
    downloadCierreEvidenceCsv(evidence);
    return;
  }
  const container = qs("cierrePrintEvidence");
  if (!container) return;
  container.innerHTML = cierreEvidencePrintHtml(evidence);
  document.body.classList.add("is-printing-cierre-evidence");
  window.print();
  document.body.classList.remove("is-printing-cierre-evidence");
}

function renderCierre() {
  if (!window.FinanceCanonicalLedger) return;
  const snapshot = refreshCanonicalLedger("cierre-view");
  if (!snapshot) return;
  const entries = snapshot.entries || [];
  const checks = snapshot.balanceChecks || [];
  const lines = snapshot.reconciliation?.lines || [];
  const currentMonthKey = openMonthCutoffKey();
  const currentClosure = isClosedMonthKey(currentMonthKey)
    ? window.FinanceCanonicalE5?.latestMonthOperation({ monthClosures }, currentMonthKey)
    : null;

  const titleEl = qs("cierreTitle");
  const subtitleEl = qs("cierreSubtitle");
  const sobresNote = qs("cierreSobresNote");
  if (sobresNote) {
    sobresNote.textContent = sobresEnabled()
      ? "Sobres · Fase 6 activados: el cierre tiene cuatro pasos. La bandera y la regla de cada sobre se editan en Ajustes."
      : "Sobres · Fase 6 desactivados: el cierre tiene tres pasos, no cuatro. Se activa en Ajustes.";
  }

  const unclassified = entries.filter((entry) => !entry.duplicateOf && entry.mapping?.status !== "classified");
  const differences = lines.filter((line) => Math.abs(Number(line.delta || 0)) > 0.02);
  const balanceGaps = checks.flatMap((check) => (check.gaps || []).map((gap, index) => ({ ...gap, id: `${check.accountId}-${index}`, accountId: check.accountId })));
  // D-2b: un descuadre de capital de deuda contra el último cierre firmado se registra como una
  // tarea de cierre más — nunca en silencio. Como mucho una entrada, derivada en vivo (C-4).
  const debtCuadre = debtCapitalCuadre();
  const debtCapitalMismatches =
    debtCuadre.status === "descuadra"
      ? [{ id: "debt-capital", label: `El capital de deuda no cuadra con el cierre de ${ledgerMonthLabel(debtCuadre.monthKey)}: diferencia de ${money(Math.abs(debtCuadre.diff), true)}` }]
      : [];
  const tasks = E11bInbox ? E11bInbox.reconciliationTasks({ unclassified, differences, balanceGaps, debtCapitalMismatches }) : [];
  const accountRows = cierreAccountReconciliation(entries);
  const countersEl = qs("cierreCounters");
  if (countersEl) countersEl.innerHTML = cierreCountersHtml(accountRows, tasks, unclassified.length);

  // C-10: el historial vive fuera del wizard/estado-cerrado — se ve igual en los dos, es la lista
  // completa de versiones, no solo la del mes en curso.
  const versionsEl = qs("cierreVersions");
  if (versionsEl) versionsEl.innerHTML = cierreVersionsHtml(cierreVersionRows(monthClosures));
  // C-12: el contexto que necesitan los botones de descarga se guarda aquí, no se recalcula al
  // pulsar — mismo dato que ya se ve en pantalla en ese momento.
  cierreEvidenceContext = { accountRows, tasks, closure: currentClosure, currentMonthKey };

  // C-13: el historial de aprendizaje es independiente de si el mes en curso está abierto o cerrado
  // — es la lista acumulada de todos los cierres firmados hasta ahora, no solo el de este mes.
  const aprendizajeEl = qs("cierreAprendizaje");
  if (aprendizajeEl) aprendizajeEl.innerHTML = cierreAprendizajeHtml();

  if (currentClosure) {
    if (titleEl) titleEl.textContent = `${ledgerMonthLabel(currentMonthKey)} cerrado`;
    if (subtitleEl) subtitleEl.textContent = "Los reales de este mes están congelados. Reábrelo si necesitas corregir algo.";
    qs("cierreWizard")?.setAttribute("hidden", "");
    qs("cierreClosedState")?.removeAttribute("hidden");
    const closedInfo = qs("cierreClosedInfo");
    if (closedInfo) {
      closedInfo.innerHTML = `<p><strong>Firmado</strong> el ${formatIsoDate((currentClosure.closedAt || currentClosure.occurredAt || "").slice(0, 10))} · ${escapeHtml(currentClosure.reason || "Sin motivo registrado")}</p>`;
    }
    const reopenButton = qs("cierreReopen");
    if (reopenButton) reopenButton.disabled = !remoteUser || !supabaseClient;
    return;
  }
  qs("cierreWizard")?.removeAttribute("hidden");
  qs("cierreClosedState")?.setAttribute("hidden", "");

  if (titleEl) titleEl.textContent = `Cierre de ${ledgerMonthLabel(currentMonthKey)}`;
  if (subtitleEl) subtitleEl.textContent = "Las diferencias se resuelven como tareas: abrir una no corrige nada por sí sola. Al firmar, los reales quedan congelados y se crea una versión nueva.";

  const monthMovementCount = entries.filter((entry) => entry.monthKey === currentMonthKey && !entry.duplicateOf).length;
  // P-15: los sobres del mes en curso solo se calculan con la bandera activa — el resto del tiempo
  // es una lista vacía y el paso 3 ni siquiera existe (cierreStepsStatus ya lo resuelve).
  const currentMonthObj = sobresEnabled() ? cuadroMandosAllMonths().find((item) => item.key === currentMonthKey) : null;
  const sobresRows = currentMonthObj ? cierreSobresRows(currentMonthObj) : [];
  // E-11b: cualquier plan propuesto vivo (no archivado) obliga a pasar por «Revisar plan
  // propuesto» antes de poder firmar — igual de condicional que el paso de Sobres.
  const propuestos = loadEscenarioMotorSaved().filter((entry) => !entry.archived && entry.estado === "propuesto");
  const steps = cierreStepsStatus(accountRows, tasks, sobresRows, propuestos.length > 0);
  const highestUnlocked = steps.filter((item) => item.unlocked).map((item) => item.step).pop() || 1;
  if (cierreActiveStep > highestUnlocked) cierreActiveStep = highestUnlocked;

  const stepsEl = qs("cierreSteps");
  if (stepsEl) stepsEl.innerHTML = cierreStepsHtml(steps, cierreActiveStep);

  const sobresStepEntry = steps.find((item) => item.label === "Liquidar sobres");
  const propuestoStepEntry = steps.find((item) => item.label === "Revisar plan propuesto");
  const firmStep = steps[steps.length - 1].step;
  const body = qs("cierreStepBody");
  if (body) {
    if (cierreActiveStep === 1) body.innerHTML = cierreStep1Html(accountRows);
    else if (cierreActiveStep === 2) body.innerHTML = cierreStep2Html(tasks);
    else if (sobresStepEntry && cierreActiveStep === sobresStepEntry.step) body.innerHTML = cierreStep3SobresHtml(sobresRows, currentMonthKey);
    else if (propuestoStepEntry && cierreActiveStep === propuestoStepEntry.step) body.innerHTML = cierreStepPropuestoHtml(propuestos);
    else if (cierreActiveStep === firmStep) body.innerHTML = cierreStep3Html(accountRows, tasks, monthMovementCount, currentMonthKey, sobresRows);
  }
}

function handleCierreStepSelect(step) {
  cierreActiveStep = step;
  renderCierre();
}

function handleCierreDownload(kind) {
  if (!cierreEvidenceContext) return;
  const { accountRows, tasks, closure, currentMonthKey } = cierreEvidenceContext;
  handleCierreDownloadEvidence(kind, accountRows, tasks, closure, currentMonthKey);
}

async function handleCierreSign() {
  await closeCurrentMonthTransaction();
  const statusEl = qs("cierreStatus");
  if (statusEl) statusEl.textContent = qs("monthCloseStatus")?.textContent || "";
  renderCierre();
}

async function handleCierreReopen() {
  await reopenLatestMonthTransaction();
  const statusEl = qs("cierreStatus");
  if (statusEl) statusEl.textContent = qs("monthCloseStatus")?.textContent || "";
  renderCierre();
}

function renderConciliar() {
  if (!window.FinanceCanonicalLedger) return;
  const snapshot = refreshCanonicalLedger("conciliar-view");
  if (!snapshot) return;
  const quality = snapshot.quality || {};
  const months = snapshot.reconciliation?.months || [];
  const lines = snapshot.reconciliation?.lines || [];
  const entries = snapshot.entries || [];
  const checks = snapshot.balanceChecks || [];
  const differenceTotal = ledgerDifferenceTotal(snapshot);

  const unclassified = entries.filter((entry) => !entry.duplicateOf && entry.mapping?.status !== "classified");
  const differences = lines.filter((line) => Math.abs(Number(line.delta || 0)) > 0.02);
  const balanceGaps = checks.flatMap((check) => (check.gaps || []).map((gap, index) => ({ ...gap, id: `${check.accountId}-${index}`, accountId: check.accountId })));
  const tasks = E11bInbox ? E11bInbox.reconciliationTasks({ unclassified, differences, balanceGaps }) : [];

  const currentMonthKey = openMonthCutoffKey();
  const currentClosure = isClosedMonthKey(currentMonthKey) ? window.FinanceCanonicalE5?.latestMonthOperation({ monthClosures }, currentMonthKey) : null;
  const isClosed = Boolean(currentClosure);

  const titleEl = qs("conciliarTitle");
  if (titleEl) {
    titleEl.textContent = isClosed
      ? `${ledgerMonthLabel(currentMonthKey)} cerrado`
      : tasks.length
      ? `Faltan ${tasks.length} cosa(s) para cerrar ${ledgerMonthLabel(currentMonthKey)}`
      : `Nada pendiente para cerrar ${ledgerMonthLabel(currentMonthKey)}`;
  }
  const subtitleEl = qs("conciliarSubtitle");
  if (subtitleEl) subtitleEl.textContent = `Diferencia total banco vs. real: ${money(differenceTotal, true)}. Abrir una tarea no corrige nada por sí solo.`;

  const kpis = qs("conciliarKpis");
  if (kpis) {
    const gapCount = Number(quality.balanceGapCount || 0);
    kpis.innerHTML = [
      ["Movimientos del banco", String(Number(quality.transactionCount || 0)), ""],
      ["Clasificados", String(Number(quality.classifiedCount || 0)), ""],
      ["Diferencia banco vs. real", money(differenceTotal, true), differenceTotal > 0.02 ? " is-warn" : ""],
      ["Continuidad de saldos", gapCount ? `${gapCount} salto(s)` : "Correcta", gapCount ? " is-warn" : ""],
    ]
      .map(([label, value, tone]) => `<div class="e19-kpi${tone}"><span class="e19-kpi-label">${escapeHtml(label)}</span><span class="e19-kpi-value">${escapeHtml(value)}</span></div>`)
      .join("") + `<div class="e19-kpi${isClosed ? "" : " is-warn"}"><span class="e19-kpi-label">Estado</span><span class="e19-kpi-value">${isClosed ? "Cerrado" : "Abierto"}</span></div>`;
  }

  const taskList = qs("conciliarTasks");
  if (taskList) {
    taskList.innerHTML = tasks.length
      ? tasks
          .slice(0, 12)
          .map(
            (task, index) => `<li class="conciliar-task-item">
              <span class="conciliar-task-index">${index + 1}</span>
              <div>
                <strong>${escapeHtml(task.label)}</strong>
                <p>${task.cause === "unclassified" ? "Movimiento sin partida" : task.cause === "balance-gap" ? "Salto en la continuidad del saldo" : "Banco y real no coinciden"}. Abrir no modifica nada.</p>
              </div>
              <button type="button" class="e19-btn e19-btn-secondary" data-conciliar-task-target="${escapeHtml(task.target)}">${task.action === "classify" ? "Clasificar" : task.action === "adjust-balance" ? "Revisar saldo" : "Corregir real"}</button>
            </li>`
          )
          .join("")
      : `<li class="conciliar-task-item conciliar-task-empty">Sin tareas pendientes: clasificación, saldos e importes reales están conciliados.</li>`;
  }

  const checklist = qs("conciliarChecklist");
  if (checklist) {
    const checkItems = [
      { ok: unclassified.length === 0, label: unclassified.length === 0 ? "Todos los movimientos están clasificados" : `${unclassified.length} movimiento(s) sin clasificar` },
      { ok: Number(quality.balanceGapCount || 0) === 0, label: Number(quality.balanceGapCount || 0) === 0 ? "Continuidad de saldos correcta" : `${quality.balanceGapCount} salto(s) de saldo` },
      { ok: !isClosed, label: isClosed ? `Ya cerrado el ${escenarioMotorMonthLabel(currentMonthKey)}` : "Los reales quedarán congelados en una versión recuperable" },
    ];
    checklist.innerHTML = checkItems.map((check) => `<li class="deuda-ruta-check${check.ok ? " is-ok" : " is-danger"}">${escapeHtml(check.label)}</li>`).join("");
  }

  const history = qs("conciliarHistory");
  if (history) {
    const previousMonths = months.filter((row) => row.monthKey !== currentMonthKey).slice(-3).reverse();
    const rows = conciliarMonthHistory(previousMonths);
    history.innerHTML = rows.length
      ? rows
          .map(
            (row) => `<div class="conciliar-history-row"><span>${escapeHtml(ledgerMonthLabel(row.monthKey))}</span><strong class="${row.closed ? "is-ok" : "is-warn"}">${row.closed ? `Cerrado${row.reopenCount ? ` · reabierto ${row.reopenCount} vez${row.reopenCount > 1 ? "es" : ""}` : ""}` : "Abierto"}</strong></div>`
          )
          .join("")
      : `<p class="e19-kpi-note">Sin meses anteriores con extracto importado.</p>`;
  }

  const closeButton = qs("conciliarClose");
  if (closeButton) {
    closeButton.disabled = isClosed;
    closeButton.textContent = isClosed ? "Mes cerrado" : "Cerrar mes";
  }

  renderConciliarConfidence(entries, checks);
}

// V5-2 · «Confianza del dato» por cuenta (mockup 4f): las dos cuentas reales del hogar, no las
// «tres cuentas, una tarjeta» del mockup — este modelo no tiene tarjeta de crédito separada.
// «Descuadra» prioriza el error de continuidad de saldo (`check.totalError`) cuando existe, porque
// es literalmente un desajuste de saldo; si el saldo cuadra pero quedan movimientos sin clasificar
// de esa cuenta, «Descuadra» usa la suma de esos importes en su lugar, para no decir «Cuadra»
// mientras algo de la cuenta sigue sin decidir. Las diferencias banco-vs-real de `#conciliar` son
// mensuales, no por cuenta, así que no entran en esta cifra — omisión real, no un olvido.
const CONCILIAR_ACCOUNT_LABELS = { caixabank: "CaixaBank", mediolanum: "Mediolanum" };

function conciliarAccountConfidence(entries, checks) {
  return Object.entries(CONCILIAR_ACCOUNT_LABELS).map(([accountId, label]) => {
    const check = (checks || []).find((item) => item.accountId === accountId);
    const unclassified = (entries || []).filter(
      (entry) => entry.accountId === accountId && !entry.duplicateOf && entry.mapping?.status !== "classified",
    );
    if (!check) return { accountId, label, status: "sin-conciliar", amount: 0, unclassifiedCount: unclassified.length };
    if (check.gaps?.length) {
      return { accountId, label, status: "descuadra", amount: round2(Math.abs(Number(check.totalError || 0))), unclassifiedCount: unclassified.length };
    }
    if (unclassified.length) {
      const amount = round2(unclassified.reduce((sum, entry) => sum + Math.abs(Number(entry.amount || 0)), 0));
      return { accountId, label, status: "descuadra", amount, unclassifiedCount: unclassified.length };
    }
    return { accountId, label, status: "cuadra", amount: 0, unclassifiedCount: 0 };
  });
}

function conciliarConfidenceStateLabel(row) {
  if (row.status === "cuadra") return "Cuadra";
  if (row.status === "sin-conciliar") return "Sin conciliar";
  return `Descuadra ${money(row.amount, true)}`;
}

function renderConciliarConfidence(entries, checks) {
  const target = qs("conciliarConfidence");
  if (!target) return;
  target.innerHTML = conciliarAccountConfidence(entries, checks)
    .map(
      (row) => `<li class="conciliar-confidence-item is-${row.status}">
        <strong>${escapeHtml(row.label)}</strong>
        <span class="conciliar-confidence-state">${escapeHtml(conciliarConfidenceStateLabel(row))}</span>
      </li>`,
    )
    .join("");
}
