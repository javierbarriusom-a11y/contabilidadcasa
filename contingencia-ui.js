// WP-38 (PRV-05 + NPV-09, docs/WP38_DISENO.md): la tarjeta «Plan B del hogar» de Plan › Previsión. El cálculo vive en canonical-contingency-plan.js
// (puro); aquí se leen la previsión y los ajustes que ya existen, se guarda el plan en el almacén `contingency-plan`, se pinta el estado y se atiende
// el asistente de tres pasos (disparador · acciones en orden · firma).
// NO ejecuta nada (A11-4): enseña lo que se acordó en frío y cuánto aporta cada paso. Tampoco va a la bandeja de Hoy: Hoy sigue congelado hasta leer
// H-02 (docs/ESTADO_TAREAS_Y_FASES.md); cuando se levante, avisar allí es un adaptador pequeño sobre `evaluate`.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, isoLocalDate, announceStatus,
// estadoHtml, showUndoToast, lastSimulation, openSimulationRows…). Sin llamadas al DOM ni escuchas al cargarse: app.js llama a `renderPlanB` al pintar
// Plan › Previsión, que engancha las escuchas la primera vez.

const PLANB_STORE = "contingency-plan"; // en la copia (BACKUP_LOCAL_STORES)
const PLANB_STATUS = {
  triggered: { icon: "⚠", label: "Se cumple vuestro plan B" },
  watch: { icon: "◐", label: "Atención: hay meses por debajo, el plan aún no salta" },
  ok: { icon: "✓", label: "Sin disparar: la liquidez aguanta" },
  incomplete: { icon: "…", label: "Plan incompleto" },
  "no-data": { icon: "?", label: "Sin previsión que vigilar" },
};
let planBMode = "ver"; // "ver" | "editar"
let planBStep = 1;
let planBDraft = null;

function planBEngine() {
  return globalThis.FinanceCanonicalContingencyPlan;
}

function planBLoad() {
  let saved = null;
  try { saved = JSON.parse(storageGet(storageKey(PLANB_STORE), "null")); } catch { saved = null; }
  return planBEngine().normalizePlan(saved);
}

function planBSave(plan) {
  storageSet(storageKey(PLANB_STORE), JSON.stringify(plan));
  queueRemoteSave();
}

// Todo lo que el motor necesita de la previsión viva y de los ajustes. Un dato que no existe queda ausente (no se rellena con 0).
function planBContext() {
  const rows = openSimulationRows(lastSimulation).slice(0, 12);
  const series = rows.map((row) => ({ monthKey: row.detailMonthKey, label: escenarioMotorMonthLabel(row.detailMonthKey), liquidity: Number(row.totalLiquidity) }));
  const saving = {};
  rows.forEach((row) => { if (row.saving !== undefined && row.saving !== null && Number.isFinite(Number(row.saving))) saving[row.detailMonthKey] = Number(row.saving); });
  const months = cuadroMandosAllMonths().filter((month) => rows.some((row) => row.detailMonthKey === month.key));
  const section = cuadroMandosSections(months).find((candidate) => candidate.kind !== "income" && candidate.name === VARIABLE_OPERATIONAL_SECTION);
  const discretionary = {};
  if (section) months.forEach((month) => { discretionary[month.key] = planPrevisionSectionTotal(section, month); });
  const floor = FinanceCanonicalCushion.cushionFloor(lastSimulation, cuadroMandosReserve());
  return { series, saving, discretionary, floor: floor.value, floorBasis: floor.basis, creditLimit: emergencyCreditLimit(), creditRate: emergencyCreditRate(), fmt: planBEuros };
}

function planBEuros(value) {
  return money(value, true);
}

function planBMonths(count) {
  return `${count} ${count === 1 ? "mes" : "meses"}`;
}

function planBActionRowHtml(row, resolvedAtStep) {
  const effect = row.adds === null
    ? (row.typicalPerMonth !== null ? `≈ ${planBEuros(row.typicalPerMonth)} al mes` : "")
    : row.kind === "pause-saving" && row.adds === 0 ? "no suma a la liquidez total"
    : `suma ${planBEuros(row.adds)}${row.incomplete ? " (o más: falta algún dato del mes)" : ""}${row.index === resolvedAtStep ? " · con este paso ya no salta" : ""}`;
  const cost = row.cost !== null ? ` Coste estimado de usarla 3 meses: ${planBEuros(row.cost)}.` : "";
  return `<li class="pb-paso"><strong>${row.index}. ${escapeHtml(row.label)}</strong>${effect ? ` — ${escapeHtml(effect)}` : ""}<span class="pb-nota">${escapeHtml(row.note)}${escapeHtml(cost)}</span></li>`;
}

function planBLeverHtml(ctx) {
  const lever = planBEngine().cutLeverage({
    liquidity: accountBalancesFromState().total,
    floor: ctx.floor,
    monthlyOutflow: lpAverageMonthlyOutflow(),
    discretionaryMonthly: Object.keys(ctx.discretionary).length ? Object.values(ctx.discretionary).reduce((sum, value) => sum + value, 0) / Object.keys(ctx.discretionary).length : null,
  });
  if (!lever.calculable) return `<p class="e19-kpi-note">${escapeHtml(lever.reason)}</p>`;
  const lines = lever.rows.map((row) => `<tr><td>${row.pct} %</td><td>${planBEuros(row.monthlySaved)}</td><td>${row.monthsToZero.toString().replace(".", ",")}</td><td>${row.monthsToFloor === null ? "—" : row.monthsToFloor.toString().replace(".", ",")}</td></tr>`).join("");
  const intro = lever.hasLever
    ? `Si se cortaran los ingresos, con ${planBEuros(lever.liquidity)} de liquidez y ${planBEuros(lever.monthlyOutflow)} de salidas medias al mes (gasto variable medio: ${planBEuros(lever.discretionaryMonthly)}).`
    : `Si se cortaran los ingresos, con ${planBEuros(lever.liquidity)} de liquidez y ${planBEuros(lever.monthlyOutflow)} de salidas medias al mes. <strong>No hay gasto variable en el plan</strong>, así que no hay palanca de recorte que probar.`;
  return `<details class="pb-palanca"><summary>¿Cuánto aguanta el colchón?</summary>
      <p class="e19-kpi-note">${intro} Sin ingresos es el caso más duro: no es una previsión, es el suelo.</p>
      <div class="table-wrap"><table class="e19-table pb-tabla"><thead><tr><th scope="col">Recorte del gasto variable</th><th scope="col">Ahorro al mes</th><th scope="col">Meses hasta agotar la liquidez</th><th scope="col">Meses hasta tocar el colchón</th></tr></thead><tbody>${lines}</tbody></table></div>
    </details>`;
}

function planBViewHtml(plan, result, ctx) {
  const state = PLANB_STATUS[result.status] || PLANB_STATUS.incomplete;
  const sig = result.signature === "signed"
    ? `Firmado el ${planBDate(result.signedAt)} por ${escapeHtml(result.signers.join(" y "))}.`
    : result.signature === "changed" ? "Cambiado después de firmar: hace falta firmarlo de nuevo." : "Sin firmar: es un borrador.";
  const reasons = result.reasons.length ? `<ul class="pb-motivos">${result.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>` : "";
  const evidence = result.evidence.length ? `<p>${result.evidence.map(escapeHtml).join(" ")}</p>` : "";
  const trigger = plan.trigger.mode === "amount" ? `${planBEuros(plan.trigger.amount)}` : `el colchón (${planBEuros(ctx.floor)}${ctx.floorBasis === "operating-reserve" ? ", reserva operativa" : ", un mes de gasto"})`;
  const when = `Salta si la liquidez de fin de mes queda por debajo de ${trigger} durante ${planBMonths(plan.trigger.consecutive)} seguidos, mirando los próximos ${planBMonths(plan.trigger.horizon)}.`;
  let closing = "";
  if (result.status === "triggered" && result.afterAll) {
    closing = result.afterAll.stillTriggered
      ? `<p class="pb-cierre"><strong>Ni con todos los pasos llega:</strong> faltarían ${planBEuros(result.afterAll.short)} para no bajar de ${planBEuros(result.threshold)}. Conviene revisar el plan, mejor ahora que en el mes malo.</p>`
      : `<p class="pb-cierre">${result.resolvedAtStep ? `Con ${result.resolvedAtStep === 1 ? "el primer paso" : `los ${result.resolvedAtStep} primeros pasos`} la liquidez ya no baja de ${planBEuros(result.threshold)}.` : ""} Con todos, el mínimo queda en ${planBEuros(result.afterAll.minLiquidity)}.</p>`;
  }
  const steps = result.actions.length ? `<ol class="pb-pasos">${result.actions.map((row) => planBActionRowHtml(row, result.resolvedAtStep)).join("")}</ol>` : "";
  return `<p class="pb-estado" data-planb-status="${escapeHtml(result.status)}"><span aria-hidden="true">${state.icon}</span> <strong>${escapeHtml(state.label)}</strong></p>
    ${evidence}${reasons}
    <p class="e19-kpi-note">${escapeHtml(when)}</p>
    ${result.status === "triggered" ? "<p><strong>Lo acordado, en orden:</strong></p>" : "<p><strong>Lo acordado si salta, en orden:</strong></p>"}
    ${steps}${closing}
    <p class="e19-kpi-note">${sig} El efecto de cada paso se suma a la liquidez prevista mes a mes: es una estimación. La app solo lo enseña, no hace nada por vosotros.</p>
    <div class="pb-acciones">
      <button type="button" class="e19-btn e19-btn-secondary" data-planb-editar>Revisar o cambiar el plan</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-planb-borrar>Borrar el plan</button>
    </div>
    ${planBLeverHtml(ctx)}`;
}

function planBDate(iso) {
  const [year, month, day] = String(iso).slice(0, 10).split("-").map(Number);
  return `${day}/${month}/${year}`;
}

// ---- Asistente de tres pasos ------------------------------------------------------------------------------------------------------------------------

function planBStepsNav() {
  const names = ["Disparador", "Acciones", "Firma"];
  return `<ol class="pb-pasos-nav" aria-label="Pasos del asistente">${names.map((name, index) => `<li${planBStep === index + 1 ? ' aria-current="step"' : ""}>${index + 1}. ${name}</li>`).join("")}</ol>`;
}

function planBStep1Html(ctx) {
  const t = planBDraft.trigger;
  const probe = planBEngine().evaluate({ plan: { ...planBDraft, actions: planBDraft.actions.length ? planBDraft.actions : [{ kind: "other", label: "ensayo" }] }, ...ctx });
  const preview = probe.status === "incomplete" || probe.status === "no-data"
    ? probe.reasons.join(" ")
    : probe.status === "triggered" ? `Con la previsión de hoy este disparador YA saltaría (desde ${probe.triggerMonthLabel}).` : probe.status === "watch" ? "Con la previsión de hoy hay meses por debajo, pero no seguidos: aún no saltaría." : `Con la previsión de hoy no saltaría (mínimo ${planBEuros(probe.minLiquidity)}).`;
  const options = (list, current) => list.map((value) => `<option value="${value}"${value === current ? " selected" : ""}>${value}</option>`).join("");
  return `<fieldset class="pb-fieldset"><legend>1. ¿Cuándo salta el plan B?</legend>
      <p class="e19-kpi-note">Se acuerda con calma, antes de necesitarlo. Es la regla: «si la liquidez de fin de mes cae por debajo de… varios meses seguidos, hacemos esto».</p>
      <label class="pb-radio"><input type="radio" name="planbModo" value="floor" data-planb-campo="mode"${t.mode === "floor" ? " checked" : ""} /> Por debajo del colchón de la app (${planBEuros(ctx.floor)}${ctx.floorBasis === "operating-reserve" ? ", la reserva operativa" : ", un mes de gasto"})</label>
      <label class="pb-radio"><input type="radio" name="planbModo" value="amount" data-planb-campo="mode"${t.mode === "amount" ? " checked" : ""} /> Por debajo de una cifra que fijamos nosotros</label>
      ${t.mode === "amount" ? `<label class="month-picker"><span>Cifra (€)</span><input type="number" min="1" step="50" inputmode="decimal" data-planb-campo="amount" value="${t.amount || ""}" /></label>` : ""}
      <div class="cuadro-mandos-controls">
        <label class="month-picker"><span>Meses seguidos por debajo</span><select data-planb-campo="consecutive">${options([1, 2, 3, 4], t.consecutive)}</select></label>
        <label class="month-picker"><span>Meses de previsión que se miran</span><select data-planb-campo="horizon">${options([3, 6, 9, 12], t.horizon)}</select></label>
      </div>
      <p class="e19-kpi-note" data-planb-previa>${escapeHtml(preview)}</p>
    </fieldset>
    <div class="pb-acciones"><button type="button" class="e19-btn e19-btn-primary" data-planb-paso="2">Siguiente: las acciones</button><button type="button" class="e19-btn e19-btn-secondary" data-planb-cancelar>Cancelar</button></div>`;
}

function planBActionEditorHtml(action, index, row, total) {
  const kinds = Object.entries(planBEngine().KINDS).map(([kind, def]) => `<option value="${kind}"${kind === action.kind ? " selected" : ""}>${escapeHtml(def.label)}</option>`).join("");
  let params = "";
  if (action.kind === "cut-discretionary") params = `<label class="month-picker"><span>Recorte (%)</span><input type="number" min="1" max="100" step="5" data-planb-accion="${index}" data-planb-campo="pct" value="${action.pct}" /></label><label class="month-picker"><span>Durante (meses)</span><input type="number" min="1" max="12" data-planb-accion="${index}" data-planb-campo="months" value="${action.months}" /></label>`;
  else if (action.kind === "pause-saving") params = `<label class="month-picker"><span>Durante (meses)</span><input type="number" min="1" max="12" data-planb-accion="${index}" data-planb-campo="months" value="${action.months}" /></label><label class="pb-radio"><input type="checkbox" data-planb-accion="${index}" data-planb-campo="outside"${action.outside ? " checked" : ""} /> Ese ahorro sale de la liquidez (va a un fondo o a una inversión)</label>`;
  else if (action.kind === "credit-line") params = `<label class="month-picker"><span>Importe (€)</span><input type="number" min="1" step="100" data-planb-accion="${index}" data-planb-campo="amount" value="${action.amount || ""}" /></label>`;
  else params = `<label class="month-picker"><span>Qué haremos</span><input type="text" maxlength="80" data-planb-accion="${index}" data-planb-campo="label" value="${escapeHtml(action.label)}" /></label>`;
  const effect = row && row.typicalPerMonth !== null ? `<p class="e19-kpi-note">Con las cifras de hoy aporta ≈ ${planBEuros(row.typicalPerMonth)} al mes.</p>` : row && action.kind === "cut-discretionary" ? '<p class="e19-kpi-note">No hay gasto variable en el plan: no se puede calcular cuánto aporta.</p>' : "";
  return `<li class="pb-accion"><p><strong>Paso ${index + 1}</strong></p>
      <label class="month-picker"><span>Acción</span><select data-planb-accion="${index}" data-planb-campo="kind">${kinds}</select></label>
      <div class="cuadro-mandos-controls">${params}</div>${effect}
      <div class="pb-acciones">
        <button type="button" class="e19-btn e19-btn-secondary" data-planb-subir="${index}"${index === 0 ? " disabled" : ""} aria-label="Subir el paso ${index + 1}">Subir</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-planb-bajar="${index}"${index === total - 1 ? " disabled" : ""} aria-label="Bajar el paso ${index + 1}">Bajar</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-planb-quitar="${index}" aria-label="Quitar el paso ${index + 1}">Quitar</button>
      </div>
    </li>`;
}

function planBStep2Html(ctx) {
  const probe = planBEngine().evaluate({ plan: planBDraft, ...ctx });
  const total = planBDraft.actions.length;
  const list = total
    ? `<ol class="pb-acciones-lista">${planBDraft.actions.map((action, index) => planBActionEditorHtml(action, index, probe.actions[index], total)).join("")}</ol>`
    : estadoHtml({ kind: "vacio", titulo: "Todavía no hay ninguna acción", texto: "Un plan B sin acciones no dice qué hacer. Empezad por lo que menos duele.", accion: { label: "Añadir la primera", id: "planb-anadir" } });
  return `<fieldset class="pb-fieldset"><legend>2. ¿Qué hacemos, y en qué orden?</legend>
      <p class="e19-kpi-note">Lo propio primero y el crédito el último. Cada paso se suma al anterior. Hasta ${planBEngine().MAX_ACTIONS} pasos.</p>
      ${list}
      ${total < planBEngine().MAX_ACTIONS ? '<button type="button" class="e19-btn e19-btn-secondary" data-planb-anadir>Añadir una acción</button>' : ""}
    </fieldset>
    <div class="pb-acciones"><button type="button" class="e19-btn e19-btn-secondary" data-planb-paso="1">Atrás</button><button type="button" class="e19-btn e19-btn-primary" data-planb-paso="3">Siguiente: fecha y firma</button></div>`;
}

function planBStep3Html(ctx) {
  const engine = planBEngine();
  const missing = engine.problems(planBDraft);
  const probe = engine.evaluate({ plan: planBDraft, ...ctx });
  const t = planBDraft.trigger;
  const trigger = t.mode === "amount" ? planBEuros(t.amount) : `el colchón (${planBEuros(ctx.floor)})`;
  const summary = `<p><strong>Si la liquidez de fin de mes queda por debajo de ${escapeHtml(trigger)} durante ${planBMonths(t.consecutive)} seguidos</strong> (mirando ${planBMonths(t.horizon)}), haremos, por este orden:</p>
    <ol class="pb-pasos">${(probe.actions || []).map((row) => `<li class="pb-paso"><strong>${escapeHtml(row.label)}</strong><span class="pb-nota">${escapeHtml(row.note)}</span></li>`).join("")}</ol>`;
  const signed = planBDraft.signature?.signers || [];
  return `<fieldset class="pb-fieldset"><legend>3. Fecha y firma</legend>
      ${missing.length ? `<ul class="pb-motivos">${missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : summary}
      <p class="e19-kpi-note">Firmar es dejar escrito, con fecha, que las dos personas lo habéis acordado en calma. No es un contrato: se puede cambiar, y al cambiarlo hay que volver a firmar.</p>
      <div class="cuadro-mandos-controls">
        <label class="month-picker"><span>Nombre de la primera persona</span><input type="text" maxlength="40" autocomplete="off" data-planb-firma="0" value="${escapeHtml(signed[0] || "")}" /></label>
        <label class="month-picker"><span>Nombre de la segunda persona</span><input type="text" maxlength="40" autocomplete="off" data-planb-firma="1" value="${escapeHtml(signed[1] || "")}" /></label>
      </div>
      <p class="e19-kpi-note" data-planb-aviso-firma></p>
    </fieldset>
    <div class="pb-acciones"><button type="button" class="e19-btn e19-btn-secondary" data-planb-paso="2">Atrás</button><button type="button" class="e19-btn e19-btn-primary" data-planb-firmar${missing.length ? " disabled" : ""}>Firmar el plan B</button><button type="button" class="e19-btn e19-btn-secondary" data-planb-guardar>Guardar sin firmar</button></div>`;
}

function planBEditorHtml(ctx) {
  return `${planBStepsNav()}${planBStep === 1 ? planBStep1Html(ctx) : planBStep === 2 ? planBStep2Html(ctx) : planBStep3Html(ctx)}`;
}

// ---- Pintado ----------------------------------------------------------------------------------------------------------------------------------------

function planBBodyHtml() {
  const engine = planBEngine();
  const ctx = planBContext();
  if (planBMode === "editar" && planBDraft) return planBEditorHtml(ctx);
  const plan = planBLoad();
  const result = engine.evaluate({ plan, ...ctx });
  if (result.status === "none") {
    return estadoHtml({ kind: "vacio", titulo: "Todavía no habéis acordado un plan B", texto: "Decidir qué recortar cuando el mes va mal, estando tranquilos, sale mejor que decidirlo en el mes malo. Son tres pasos: cuándo salta, qué hacer y firmarlo las dos personas.", accion: { label: "Acordar el plan B", id: "planb-empezar" } }) + planBLeverHtml(ctx);
  }
  return planBViewHtml(plan, result, ctx);
}

function renderPlanB(engine, force = false) {
  const box = qs("planBCuerpo");
  if (!box || !engine) return;
  attachPlanB(document); // idempotente: la pantalla se pinta antes de que init() termine y un clic temprano no puede perderse
  // Mientras se edita, la pantalla no se repinta sola: un repintado desde fuera (otro cálculo de la app) cambiaría el asistente bajo las manos de quien escribe.
  if (planBMode === "editar" && !force) return;
  try {
    const html = planBBodyHtml();
    if (box.__planBHtml !== html) {
      box.innerHTML = html;
      box.__planBHtml = html;
    }
  } catch (error) {
    console.error(`renderPlanB: ${error.message}`);
  }
}

function planBNote(message) {
  const note = qs("planBNota");
  if (note) note.textContent = message;
  announceStatus(message);
}

function planBRerender() {
  const box = qs("planBCuerpo");
  if (box) box.__planBHtml = null;
  renderPlanB(planBEngine(), true);
}

function planBStart(plan) {
  planBDraft = planBEngine().normalizePlan(plan);
  planBMode = "editar";
  planBStep = 1;
  planBRerender();
  qs("planBCuerpo")?.querySelector("input, select")?.focus();
}

function planBSetField(target) {
  const field = target.dataset.planbCampo;
  const index = target.dataset.planbAccion;
  const engine = planBEngine();
  if (index === undefined) {
    const t = { ...planBDraft.trigger };
    t[field] = field === "mode" ? target.value : Number(target.value);
    planBDraft = engine.normalizePlan({ ...planBDraft, trigger: t });
    return field === "mode" || field === "consecutive" || field === "horizon" || field === "amount";
  }
  const actions = planBDraft.actions.map((action) => ({ ...action }));
  const current = actions[Number(index)];
  if (!current) return false;
  if (field === "kind") {
    actions[Number(index)] = { id: current.id, kind: target.value, label: "" };
  } else if (field === "label") {
    current.label = target.value;
  } else if (field === "outside") {
    current.outside = Boolean(target.checked);
  } else {
    current[field] = Number(target.value);
  }
  planBDraft = engine.normalizePlan({ ...planBDraft, actions });
  return field === "kind" || field === "outside";
}

function planBFinish(sign) {
  const engine = planBEngine();
  const names = [...(qs("planBCuerpo")?.querySelectorAll("[data-planb-firma]") || [])].map((input) => input.value);
  const before = planBLoad();
  let next;
  if (sign) {
    const result = engine.sign(planBDraft, { signers: names, today: isoLocalDate(new Date()) });
    if (!result.ok) {
      const warning = qs("planBCuerpo")?.querySelector("[data-planb-aviso-firma]");
      const text = result.reason === "dos-firmas" ? "Hacen falta los nombres de dos personas distintas." : "Completa el plan antes de firmarlo.";
      if (warning) warning.textContent = text;
      announceStatus(text);
      return;
    }
    next = result.plan;
  } else {
    next = { ...planBDraft, signature: null, updatedAt: isoLocalDate(new Date()) };
  }
  planBSave(next);
  planBMode = "ver";
  planBDraft = null;
  planBRerender();
  const message = sign ? "Plan B firmado." : "Plan B guardado sin firmar.";
  planBNote(message);
  showUndoToast(message, () => {
    planBSave(before);
    planBRerender();
    planBNote("Plan B recuperado como estaba.");
  });
}

// Una sola vez, por delegación.
function attachPlanB(doc) {
  if (!doc || doc.__planBAttached) return false;
  doc.__planBAttached = true;
  const inCard = (target) => target?.closest?.("#planBCard");
  doc.addEventListener("click", (event) => {
    const target = event.target;
    if (!inCard(target)) return;
    if (target.closest("[data-planb-editar]")) { planBStart(planBLoad()); return; }
    if (target.closest('[data-estado-accion="planb-empezar"]')) { planBStart(planBEngine().defaultPlan()); return; }
    if (target.closest("[data-planb-cancelar]")) { planBMode = "ver"; planBDraft = null; planBRerender(); return; }
    const step = target.closest("[data-planb-paso]");
    if (step) { planBStep = Number(step.dataset.planbPaso); planBRerender(); qs("planBCuerpo")?.querySelector("input, select, button")?.focus(); return; }
    if (target.closest("[data-planb-anadir]") || target.closest('[data-estado-accion="planb-anadir"]')) {
      if (planBDraft.actions.length >= planBEngine().MAX_ACTIONS) return;
      const kind = !planBDraft.actions.some((a) => a.kind === "cut-discretionary") ? "cut-discretionary" : !planBDraft.actions.some((a) => a.kind === "pause-saving") ? "pause-saving" : "other";
      planBDraft = planBEngine().normalizePlan({ ...planBDraft, actions: [...planBDraft.actions, { id: `accion-${Date.now().toString(36)}`, kind, label: "" }] });
      planBRerender();
      return;
    }
    const move = target.closest("[data-planb-subir], [data-planb-bajar]");
    if (move) {
      const index = Number(move.dataset.planbSubir ?? move.dataset.planbBajar);
      const to = move.dataset.planbSubir !== undefined ? index - 1 : index + 1;
      const actions = planBDraft.actions.slice();
      if (to < 0 || to >= actions.length) return;
      [actions[index], actions[to]] = [actions[to], actions[index]];
      planBDraft = planBEngine().normalizePlan({ ...planBDraft, actions });
      planBRerender();
      announceStatus(`Paso movido a la posición ${to + 1}.`);
      return;
    }
    const remove = target.closest("[data-planb-quitar]");
    if (remove) {
      const before = planBDraft;
      planBDraft = planBEngine().normalizePlan({ ...planBDraft, actions: planBDraft.actions.filter((_, i) => i !== Number(remove.dataset.planbQuitar)) });
      planBRerender();
      showUndoToast("Paso quitado.", () => { planBDraft = before; planBRerender(); announceStatus("Paso recuperado."); });
      return;
    }
    if (target.closest("[data-planb-firmar]")) { planBFinish(true); return; }
    if (target.closest("[data-planb-guardar]")) { planBFinish(false); return; }
    if (target.closest("[data-planb-borrar]")) {
      const before = planBLoad();
      planBSave(planBEngine().defaultPlan());
      planBRerender();
      planBNote("Plan B borrado.");
      showUndoToast("Plan B borrado.", () => { planBSave(before); planBRerender(); planBNote("Plan B recuperado."); });
    }
  });
  doc.addEventListener("change", (event) => {
    const target = event.target;
    if (!inCard(target) || !planBDraft) return;
    if (target.dataset?.planbCampo && planBSetField(target)) planBRerender();
  });
  return true;
}
