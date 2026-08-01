(function (root) {
  "use strict";

  const bridge = () => root.FinanceP2Bridge;
  const domain = () => root.P2Domain;
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
  const euro = (value) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
  const shortDate = (value) => (value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value)) : "Sin fecha");
  const ownerLabel = (owner) => ({ household: "Hogar", javi: "Javi", tere: "Tere" })[owner] || "Hogar";
  const ownerOptions = (selected) => ["household", "javi", "tere"].map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${ownerLabel(value)}</option>`).join("");
  const state = () => bridge()?.getState() || domain()?.normalizeState({}) || {};
  const save = (next) => bridge()?.saveState(next);
  const uid = (prefix) => domain()?.id(prefix) || `${prefix}-${Date.now()}`;

  function notice(target, message, error = false) {
    if (!target) return;
    target.innerHTML = `<div class="p2-notice${error ? " error" : ""}">${esc(message)}</div>`;
    setTimeout(() => { if (target.isConnected) target.innerHTML = ""; }, 5000);
  }

  function panel(id, kicker, title, description) {
    return `<article class="p2-panel" id="${id}">
      <div class="p2-panel-head"><div><p class="p2-kicker">${esc(kicker)}</p><h3>${esc(title)}</h3><p class="p2-help">${esc(description)}</p></div></div>
      <div data-p2-body></div>
    </article>`;
  }

  function mount(sectionId, panelId, position, html) {
    const section = byId(sectionId);
    if (!section) return null;
    let target = byId(panelId);
    if (!target) {
      section.insertAdjacentHTML(position, html);
      target = byId(panelId);
    }
    return target;
  }

  function movementChoices() {
    const used = new Set(state().goals.flatMap((goal) => goal.contributions.map((item) => item.movementId).filter(Boolean)));
    return (bridge()?.movements() || [])
      .filter((row) => row.reconciled && Number(row.amount) > 0 && !used.has(row.id))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function renderGoals() {
    const target = mount("savings-agent", "p2-goals", "beforeend", panel("p2-goals", "Objetivos con saldo real", "Huchas vinculadas", "Cada aportación queda vinculada una sola vez a un movimiento conciliado o a una entrada manual."));
    if (!target) return;
    const p2 = state();
    const snapshots = p2.goals.map((goal) => domain().goalSnapshot(goal));
    const active = snapshots.filter((goal) => goal.status === "active");
    const saved = snapshots.reduce((sum, goal) => sum + goal.saved, 0);
    target.querySelector("[data-p2-body]").innerHTML = `
      <div class="p2-kpis">
        <div class="p2-kpi"><span>Objetivos activos</span><strong>${active.length}</strong></div>
        <div class="p2-kpi"><span>Ahorro conciliado</span><strong>${euro(saved)}</strong></div>
        <div class="p2-kpi"><span>Pendiente</span><strong>${euro(active.reduce((sum, goal) => sum + goal.remaining, 0))}</strong></div>
        <div class="p2-kpi"><span>Movimientos disponibles</span><strong>${movementChoices().length}</strong></div>
      </div>
      <form class="p2-form p2-grid four" data-goal-form>
        <label class="p2-field"><span>Objetivo</span><input name="name" required placeholder="Coche, emergencia, reforma" /></label>
        <label class="p2-field"><span>Importe</span><input name="target" type="number" min="0" step="0.01" required /></label>
        <label class="p2-field"><span>Tipo</span><select name="type"><option value="emergency">Emergencia</option><option value="car">Coche</option><option value="project">Proyecto</option><option value="other">Otro</option></select></label>
        <label class="p2-field"><span>Titular</span><select name="owner">${ownerOptions("household")}</select></label>
        <label class="p2-field"><span>Fecha objetivo</span><input name="targetDate" type="date" /></label>
        <div class="p2-actions"><button class="p2-button" type="submit">Crear hucha</button></div>
      </form>
      <div data-goal-notice></div>
      <div class="p2-list" data-goal-list>${snapshots.length ? snapshots.map(goalCard).join("") : '<div class="p2-empty">Aún no hay huchas. Crea la primera y vincula aportaciones reales.</div>'}</div>`;
    bindGoalEvents(target);
  }

  function goalCard(goal) {
    const movements = movementChoices();
    return `<section class="p2-item" data-goal-id="${esc(goal.id)}">
      <div class="p2-item-head"><div><h4>${esc(goal.name)}</h4><p class="p2-help">${ownerLabel(goal.owner)} · ${goal.targetDate ? `objetivo ${shortDate(goal.targetDate)}` : "sin fecha objetivo"}</p></div><span class="p2-status${goal.status === "paused" ? " warn" : ""}">${esc(goal.status)}</span></div>
      <div class="p2-progress" aria-label="Progreso ${goal.progress}%"><span style="width:${goal.progress}%"></span></div>
      <div class="p2-grid three"><div class="p2-kpi"><span>Acumulado real</span><strong>${euro(goal.saved)}</strong></div><div class="p2-kpi"><span>Objetivo</span><strong>${euro(goal.target)}</strong></div><div class="p2-kpi"><span>Falta</span><strong>${euro(goal.remaining)}</strong></div></div>
      <form class="p2-form p2-grid three" data-contribution-form>
        <label class="p2-field"><span>Origen</span><select name="source"><option value="manual">Aportación manual</option><option value="movement">Movimiento conciliado</option></select></label>
        <label class="p2-field" data-manual-field><span>Importe</span><input name="amount" type="number" min="0" step="0.01" /></label>
        <label class="p2-field" data-movement-field hidden><span>Movimiento</span><select name="movementId"><option value="">Seleccionar...</option>${movements.map((row) => `<option value="${esc(row.id)}">${esc(row.date)} · ${esc(row.label)} · ${euro(row.amount)}</option>`).join("")}</select></label>
        <label class="p2-field"><span>Fecha</span><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
        <div class="p2-actions"><button class="p2-button" type="submit">Registrar aportación</button><button class="p2-button secondary" type="button" data-goal-status>${goal.status === "paused" ? "Reactivar" : "Pausar"}</button><button class="p2-button danger" type="button" data-goal-delete>Eliminar hucha</button></div>
      </form>
      <div class="p2-contributions">${goal.contributions.length ? goal.contributions.slice().reverse().map((item) => `<div class="p2-contribution"><span>${esc(item.label)}</span><strong>${euro(item.amount)}</strong><small>${esc(item.date || item.month || item.source)}</small><button type="button" data-contribution-delete="${esc(item.id)}">Quitar</button></div>`).join("") : '<p class="p2-help">Sin aportaciones registradas.</p>'}</div>
    </section>`;
  }

  function bindGoalEvents(target) {
    target.querySelector("[data-goal-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const p2 = state();
      save({ ...p2, goals: [...p2.goals, domain().normalizeGoal({ ...values, target: Number(values.target) })] });
      renderGoals();
    });
    target.querySelectorAll("[data-goal-id]").forEach((card) => {
      const goalId = card.dataset.goalId;
      const source = card.querySelector('[name="source"]');
      source?.addEventListener("change", () => {
        card.querySelector("[data-manual-field]").hidden = source.value === "movement";
        card.querySelector("[data-movement-field]").hidden = source.value !== "movement";
      });
      card.querySelector("[data-contribution-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        const movement = values.source === "movement" ? (bridge().movements() || []).find((row) => row.id === values.movementId) : null;
        const amount = movement ? Number(movement.amount) : Number(values.amount);
        if (!(amount > 0)) return notice(target.querySelector("[data-goal-notice]"), "Introduce una aportación positiva o elige un movimiento.", true);
        const result = domain().addContributionToState(state(), goalId, {
          id: uid("contribution"), movementId: movement?.id || "", amount, date: movement?.date || values.date,
          month: movement?.month || String(values.date || "").slice(0, 7), label: movement?.label || "Aportación manual", source: movement ? "movement" : "manual",
        });
        if (!result.added) return notice(target.querySelector("[data-goal-notice]"), result.reason === "duplicate-movement" ? "Ese movimiento ya está vinculado a otra hucha." : "No se pudo registrar la aportación.", true);
        save(result.state); renderGoals();
      });
      card.querySelector("[data-goal-status]")?.addEventListener("click", () => {
        const p2 = state();
        save({ ...p2, goals: p2.goals.map((goal) => goal.id === goalId ? { ...goal, status: goal.status === "paused" ? "active" : "paused" } : goal) }); renderGoals();
      });
      card.querySelector("[data-goal-delete]")?.addEventListener("click", () => {
        if (!confirm("¿Eliminar esta hucha y sus aportaciones vinculadas?")) return;
        const p2 = state(); save({ ...p2, goals: p2.goals.filter((goal) => goal.id !== goalId) }); renderGoals();
      });
      card.querySelectorAll("[data-contribution-delete]").forEach((button) => button.addEventListener("click", () => {
        save(domain().removeGoalContribution(state(), goalId, button.dataset.contributionDelete)); renderGoals();
      }));
    });
  }

  function ensureOwnership() {
    const p2 = state();
    const rows = [...bridge().seriesRows("income"), ...bridge().seriesRows("expense")];
    const ownership = { ...p2.ownership };
    let changed = false;
    rows.forEach((row) => { if (!ownership[row.key]) { ownership[row.key] = domain().inferOwner(row.label); changed = true; } });
    const debts = bridge().debts().map((row) => ({
      ...row,
      key: `debt|${row.id}`,
      kind: "debt",
      label: `${row.entity} · ${row.type}${row.number ? ` · ${row.number}` : ""}`,
      sectionName: "Control de deuda",
    }));
    debts.forEach((row) => { if (!ownership[row.key]) { ownership[row.key] = domain().inferOwner(`${row.entity} ${row.number}`); changed = true; } });
    if (changed) save({ ...p2, ownership });
    return [...rows, ...debts];
  }

  function renderFamilyAndExport() {
    const target = mount("data-entry", "p2-family-export", "beforeend", panel("p2-family-export", "Gobierno del dato", "Familia y paquete para asesor", "Asigna cada serie a Javi, Tere o Hogar y genera una exportación versionada con procedencia."));
    if (!target) return;
    const rows = ensureOwnership();
    const p2 = state();
    const covered = rows.filter((row) => p2.ownership[row.key]).length;
    target.querySelector("[data-p2-body]").innerHTML = `
      <div class="p2-kpis"><div class="p2-kpi"><span>Series asignadas</span><strong>${covered}/${rows.length}</strong></div><div class="p2-kpi"><span>Javi</span><strong>${rows.filter((row) => p2.ownership[row.key] === "javi").length}</strong></div><div class="p2-kpi"><span>Tere</span><strong>${rows.filter((row) => p2.ownership[row.key] === "tere").length}</strong></div><div class="p2-kpi"><span>Hogar</span><strong>${rows.filter((row) => p2.ownership[row.key] === "household").length}</strong></div></div>
      <div class="p2-toolbar"><label class="p2-field"><span>Filtrar titular</span><select data-owner-filter><option value="all">Todos</option>${ownerOptions("")}</select></label><div class="p2-actions"><button class="p2-button" data-export-pdf>Descargar PDF</button><button class="p2-button secondary" data-export-xlsx>Descargar Excel</button></div></div>
      <div data-export-notice></div>
      <div class="p2-table-wrap"><table class="p2-table"><thead><tr><th>Tipo</th><th>Serie</th><th>Titular</th><th>Identificador canónico</th></tr></thead><tbody data-family-rows>${rows.map((row) => familyRow(row, p2)).join("")}</tbody></table></div>
      <p class="p2-help">Últimas exportaciones: ${p2.exportHistory.length ? p2.exportHistory.slice(-5).reverse().map((item) => `v${item.version} ${item.format.toUpperCase()} · ${shortDate(item.createdAt)}`).join(" · ") : "ninguna"}.</p>`;
    bindFamilyExportEvents(target, rows);
  }

  function familyRow(row, p2) {
    const typeLabel = row.kind === "income" ? "Ingreso" : row.kind === "debt" ? "Deuda" : "Gasto";
    return `<tr data-owner-row="${esc(p2.ownership[row.key])}"><td>${typeLabel}</td><td><strong>${esc(row.label)}</strong><br><small>${esc(row.sectionName || "")}</small></td><td><select class="p2-owner-select" data-owner-key="${esc(row.key)}">${ownerOptions(p2.ownership[row.key])}</select></td><td><code>${esc(row.key)}</code></td></tr>`;
  }

  function bindFamilyExportEvents(target, rows) {
    target.querySelectorAll("[data-owner-key]").forEach((select) => select.addEventListener("change", () => {
      const p2 = state(); save({ ...p2, ownership: { ...p2.ownership, [select.dataset.ownerKey]: select.value } }); renderFamilyAndExport();
    }));
    target.querySelector("[data-owner-filter]")?.addEventListener("change", (event) => target.querySelectorAll("[data-owner-row]").forEach((row) => { row.hidden = event.target.value !== "all" && row.dataset.ownerRow !== event.target.value; }));
    ["pdf", "xlsx"].forEach((format) => target.querySelector(`[data-export-${format}]`)?.addEventListener("click", () => {
      try {
        const p2 = state(); const version = p2.exportVersion; const model = bridge().exportModel(version);
        if (format === "pdf") root.P2Export.downloadPdf(model, `informe-financiero-v${version}.pdf`); else root.P2Export.downloadExcel(model, `informe-financiero-v${version}.xlsx`);
        save({ ...p2, exportVersion: version + 1, exportHistory: [...p2.exportHistory, { id: uid("export"), version, format, createdAt: new Date().toISOString() }] });
        renderFamilyAndExport();
      } catch (error) { notice(target.querySelector("[data-export-notice]"), error.message, true); }
    }));
  }

  function renderBehavior() {
    const target = mount("movements", "p2-behavior", "beforeend", panel("p2-behavior", "Comportamiento conciliado", "Tendencias y anomalías reales", "Los indicadores excluyen movimientos sin asignar: la procedencia queda visible y no se mezcla con estimaciones."));
    if (!target) return;
    const movements = bridge().movements();
    const analytics = domain().behaviorAnalytics(movements, (row) => row.reconciled);
    target.querySelector("[data-p2-body]").innerHTML = `
      <div class="p2-kpis"><div class="p2-kpi"><span>Conciliados</span><strong>${analytics.reconciledTransactions}/${analytics.totalTransactions}</strong></div><div class="p2-kpi"><span>Gasto conciliado</span><strong>${euro(analytics.reconciledAmount)}</strong></div><div class="p2-kpi"><span>Media últimos 3 meses</span><strong>${euro(analytics.recentAverage)}</strong></div><div class="p2-kpi"><span>Tendencia</span><strong>${analytics.trendPercent > 0 ? "+" : ""}${analytics.trendPercent}%</strong></div></div>
      <div class="p2-grid two"><section><h4>Categorías principales</h4><div class="p2-list">${analytics.categories.slice(0, 8).map(([name, amount]) => `<div class="p2-item p2-item-head"><span>${esc(name)}</span><strong>${euro(amount)}</strong></div>`).join("") || '<div class="p2-empty">Faltan movimientos conciliados.</div>'}</div></section><section><h4>Anomalías a revisar</h4><div class="p2-list">${analytics.anomalies.map((row) => `<div class="p2-item p2-anomaly"><div class="p2-item-head"><strong>${esc(row.label)}</strong><strong>${euro(Math.abs(row.amount))}</strong></div><p class="p2-help">${esc(row.date)} · ${esc(row.category)}</p></div>`).join("") || '<div class="p2-empty">No hay anomalías relevantes entre los movimientos conciliados.</div>'}</div></section></div>
      <p class="p2-help">Procedencia: ${esc(analytics.provenance)}.</p>`;
  }

  function renderDocuments() {
    const target = mount("debt-control", "p2-documents", "beforeend", panel("p2-documents", "Expediente privado", "Documentos de acuerdos", "Guarda evidencias localmente o cifra el archivo antes de enviarlo al almacenamiento privado. La clave nunca se guarda ni se sincroniza."));
    if (!target) return;
    const p2 = state(); const debts = bridge().debts().filter((row) => row.currentPrincipal > 0);
    target.querySelector("[data-p2-body]").innerHTML = `
      <form class="p2-form p2-grid four" data-document-form>
        <label class="p2-field"><span>Deuda</span><select name="debtId" required><option value="">Seleccionar...</option>${debts.map((row) => `<option value="${esc(row.id)}">${esc(row.entity)} · ${esc(row.number)} · ${euro(row.currentPrincipal)}</option>`).join("")}</select></label>
        <label class="p2-field"><span>Título</span><input name="title" required placeholder="Oferta recibida 17/07" /></label>
        <label class="p2-field"><span>Tipo</span><select name="status"><option value="offer">Oferta</option><option value="call">Llamada</option><option value="evidence">Evidencia</option><option value="signed">Firmado</option></select></label>
        <label class="p2-field"><span>Fecha límite</span><input name="deadline" type="date" /></label>
        <label class="p2-field"><span>Archivo</span><input name="file" type="file" /></label>
        <label class="p2-field"><span>Almacenamiento</span><select name="storage"><option value="device">Solo este dispositivo</option><option value="cloud">Privado multidispositivo</option></select></label>
        <label class="p2-field"><span>Clave privada (solo nube)</span><input name="cloudKey" type="password" minlength="12" autocomplete="new-password" placeholder="12 caracteres o más" /></label>
        <label class="p2-field"><span>Notas</span><textarea name="notes"></textarea></label>
        <label class="p2-field"><span>Validación</span><select name="verified"><option value="false">Pendiente de verificar</option><option value="true">Verificado por usuario</option></select></label>
        <div class="p2-actions"><button class="p2-button" type="submit">Guardar evidencia</button></div>
      </form><div data-document-notice></div>
      <div class="p2-list">${p2.documents.length ? p2.documents.map((doc) => documentCard(doc, debts)).join("") : '<div class="p2-empty">No hay documentos guardados.</div>'}</div>`;
    bindDocumentEvents(target);
  }

  function documentCard(doc, debts) {
    const debt = debts.find((row) => row.id === doc.debtId);
    const deleted = Boolean(doc.deletedAt);
    return `<div class="p2-item" data-document-id="${esc(doc.id)}"><div class="p2-item-head"><div><h4>${esc(doc.title)}</h4><p class="p2-help">${esc(debt ? `${debt.entity} · ${debt.number}` : doc.debtId)} · ${esc(doc.fileName || "sin archivo")} · ${doc.storage === "cloud" ? "cifrado en nube privada" : "solo dispositivo"}</p></div><span class="p2-status${deleted || !doc.verified ? " warn" : ""}">${deleted ? "Recuperable" : doc.verified ? "Verificado" : "Pendiente"}</span></div><p class="p2-help">${deleted ? `Eliminado; recuperable hasta ${esc(doc.recoverUntil)}.` : `Límite: ${esc(doc.deadline || "sin fecha")} · ${esc(doc.notes || "sin notas")}`}</p>${doc.storage === "cloud" && !deleted ? '<label class="p2-field"><span>Clave para descargar</span><input data-document-key type="password" minlength="12" autocomplete="off" /></label>' : ""}<div class="p2-actions">${deleted ? '<button class="p2-button secondary" type="button" data-document-restore>Recuperar</button><button class="p2-button danger" type="button" data-document-purge>Eliminar definitivamente</button>' : `<button class="p2-button secondary" type="button" data-document-download ${doc.fileName ? "" : "disabled"}>Descargar</button><button class="p2-button danger" type="button" data-document-delete>Eliminar</button>`}</div></div>`;
  }

  function bindDocumentEvents(target) {
    target.querySelector("[data-document-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); const file = form.elements.file.files[0];
      let doc = domain().normalizeDocument({ ...values, id: uid("document"), verified: values.verified === "true", fileName: file?.name || "", mimeType: file?.type || "", size: file?.size || 0, deviceOnly: values.storage !== "cloud", storage: values.storage, encrypted: values.storage === "cloud" });
      try {
        if (file && file.size > 10 * 1024 * 1024) throw new Error("El archivo supera el límite privado de 10 MB");
        if (file && values.storage === "cloud") {
          const encrypted = await root.P2PrivateStore.encrypt(file, values.cloudKey);
          const remotePath = await bridge().uploadPrivateAttachment(doc.id, encrypted);
          doc = domain().normalizeDocument({ ...doc, remotePath });
        } else if (file) await root.P2PrivateStore.put(doc.id, file);
        const p2 = state(); save({ ...p2, documents: [...p2.documents, doc] }); renderDocuments();
      } catch (error) { notice(target.querySelector("[data-document-notice]"), `No se pudo guardar: ${error.message}`, true); }
    });
    target.querySelectorAll("[data-document-id]").forEach((card) => {
      const id = card.dataset.documentId;
      card.querySelector("[data-document-download]")?.addEventListener("click", async () => {
        try {
          const doc = state().documents.find((item) => item.id === id); let blob = await root.P2PrivateStore.get(id);
          if (!blob && doc?.storage === "cloud") { const encrypted = await bridge().downloadPrivateAttachment(doc.remotePath); blob = await root.P2PrivateStore.decrypt(encrypted, card.querySelector("[data-document-key]")?.value); }
          if (!blob) return notice(target.querySelector("[data-document-notice]"), "El archivo privado no está en este dispositivo.", true);
          const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = doc.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        } catch (error) { notice(target.querySelector("[data-document-notice]"), `No se pudo descargar: ${error.message}`, true); }
      });
      card.querySelector("[data-document-delete]")?.addEventListener("click", async () => { if (!confirm("¿Mover esta evidencia a recuperación durante 30 días?")) return; const p2 = state(); const deletedAt = new Date(); const recoverUntil = new Date(deletedAt.getTime() + 30 * 86400000); save({ ...p2, documents: p2.documents.map((item) => item.id === id ? domain().normalizeDocument({ ...item, deletedAt: deletedAt.toISOString(), recoverUntil: recoverUntil.toISOString().slice(0, 10) }) : item) }); renderDocuments(); });
      card.querySelector("[data-document-restore]")?.addEventListener("click", () => { const p2 = state(); save({ ...p2, documents: p2.documents.map((item) => item.id === id ? domain().normalizeDocument({ ...item, deletedAt: "", recoverUntil: "" }) : item) }); renderDocuments(); });
      card.querySelector("[data-document-purge]")?.addEventListener("click", async () => { if (!confirm("¿Eliminar definitivamente esta evidencia? Esta acción no se puede deshacer.")) return; const doc = state().documents.find((item) => item.id === id); if (doc?.remotePath) await bridge().purgePrivateAttachment(doc.remotePath); await root.P2PrivateStore.remove(id); const p2 = state(); save({ ...p2, documents: p2.documents.filter((item) => item.id !== id) }); renderDocuments(); });
    });
  }

  function renderAlertChannels() {
    const target = mount("alerts-center", "p2-alert-channels", "beforeend", panel("p2-alert-channels", "Entrega y silencios", "Canales configurables", "Elige cómo recibir cada alerta. Navegador usa notificaciones del dispositivo; email prepara un mensaje para enviar sin compartir datos automáticamente."));
    if (!target) return;
    const p2 = state(); const alerts = bridge().alerts();
    target.querySelector("[data-p2-body]").innerHTML = `<div data-alert-notice></div><div class="p2-list">${alerts.map((alert) => {
      const delivery = p2.alertDeliveries[alert.id] || { channel: "app", externalTarget: "", muteUntil: "" };
      const muted = domain().alertMuted(delivery);
      return `<div class="p2-item" data-alert-id="${esc(alert.id)}"><div class="p2-item-head"><div><h4>${esc(alert.name || alert.label || "Alerta")}</h4><p class="p2-help">${alert.triggered ? "Umbral superado" : alert.overdue ? "Revisión vencida" : "En control"}</p></div><span class="p2-status${alert.triggered ? " danger" : alert.overdue || muted ? " warn" : ""}">${muted ? "Silenciada" : alert.triggered ? "Actuar" : "Activa"}</span></div><div class="p2-grid three"><label class="p2-field"><span>Canal</span><select name="channel"><option value="app" ${delivery.channel === "app" ? "selected" : ""}>En la app</option><option value="browser" ${delivery.channel === "browser" ? "selected" : ""}>Notificación navegador</option><option value="email" ${delivery.channel === "email" ? "selected" : ""}>Preparar email</option></select></label><label class="p2-field"><span>Email destino</span><input name="externalTarget" type="email" value="${esc(delivery.externalTarget || "")}" placeholder="familia@correo.com" /></label><label class="p2-field"><span>Silenciar hasta</span><input name="muteUntil" type="date" value="${esc(delivery.muteUntil || "")}" /></label></div><div class="p2-actions"><button class="p2-button" type="button" data-alert-save>Guardar canal</button><button class="p2-button secondary" type="button" data-alert-test>Probar</button></div></div>`;
    }).join("") || '<div class="p2-empty">Crea primero una regla de alerta.</div>'}</div>`;
    bindAlertEvents(target, alerts);
  }

  function bindAlertEvents(target, alerts) {
    target.querySelectorAll("[data-alert-id]").forEach((card) => {
      const alertId = card.dataset.alertId; const alert = alerts.find((item) => item.id === alertId);
      const values = () => ({ channel: card.querySelector('[name="channel"]').value, externalTarget: card.querySelector('[name="externalTarget"]').value.trim(), muteUntil: card.querySelector('[name="muteUntil"]').value });
      card.querySelector("[data-alert-save]")?.addEventListener("click", () => { const p2 = state(); save({ ...p2, alertDeliveries: { ...p2.alertDeliveries, [alertId]: { ...values(), updatedAt: new Date().toISOString() } } }); renderAlertChannels(); });
      card.querySelector("[data-alert-test]")?.addEventListener("click", async () => {
        const delivery = values(); const title = alert.name || alert.label || "Alerta financiera"; const body = alert.triggered ? "El umbral configurado está superado." : "Prueba de canal completada.";
        if (delivery.channel === "browser") { if (!("Notification" in root)) return notice(target.querySelector("[data-alert-notice]"), "Este navegador no admite notificaciones.", true); const permission = await Notification.requestPermission(); if (permission === "granted") new Notification(title, { body }); else notice(target.querySelector("[data-alert-notice]"), "Permiso de notificaciones no concedido.", true); }
        else if (delivery.channel === "email") { if (!delivery.externalTarget) return notice(target.querySelector("[data-alert-notice]"), "Indica un email destino.", true); location.href = `mailto:${encodeURIComponent(delivery.externalTarget)}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`; }
        else notice(target.querySelector("[data-alert-notice]"), "La alerta está visible en el centro de alertas.");
      });
    });
  }

  function render(viewId) {
    if (!bridge() || !domain()) return;
    if (viewId === "savings-agent") renderGoals();
    if (viewId === "data-entry") renderFamilyAndExport();
    if (viewId === "movements") renderBehavior();
    if (viewId === "debt-control") renderDocuments();
    if (viewId === "alerts-center") renderAlertChannels();
  }

  function currentView() { return location.hash.replace(/^#/, "") || "home"; }
  root.addEventListener("finance:view-rendered", (event) => render(event.detail?.viewId || currentView()));
  root.addEventListener("hashchange", () => setTimeout(() => render(currentView()), 0));
  document.addEventListener("DOMContentLoaded", () => setTimeout(() => render(currentView()), 0));
})(typeof globalThis !== "undefined" ? globalThis : window);
