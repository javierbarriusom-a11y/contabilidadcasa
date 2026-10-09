// WP-39 (CAR-01, docs/WP39_DISENO.md): la tarjeta «Política de inversión del hogar» de Inversión › Rebalanceo. El cálculo vive en
// canonical-investment-policy.js (puro); aquí se leen lo que la app ya sabe (reparto objetivo, objetivos, cartera, préstamo declarado), se guarda la
// política en el almacén `investment-policy`, se pinta y se atienden el formulario de seis preguntas, la firma y la consulta «¿esta operación la cumple?».
// NO opera (A11-4): ni compra, ni vende, ni rebalancea; avisa. Tampoco toca la herramienta de rebalanceo (IV6), que sigue avisando con su propio umbral.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, isoLocalDate, announceStatus,
// estadoHtml, showUndoToast, iv1PositionsList, iv6PortfolioTargets…). Sin llamadas al DOM ni escuchas al cargarse: views/inversion.js llama a
// `renderPoliticaInversion` al pintar Rebalanceo, que engancha las escuchas la primera vez.

const POLITICA_STORE = "investment-policy"; // en la copia (BACKUP_LOCAL_STORES)
const POLITICA_REVIEW_TEXT = { ok: "", "due-soon": "Revisar la política: vence pronto.", overdue: "La revisión de la política está vencida." };
let politicaMode = "ver"; // "ver" | "editar"
let politicaDraft = null;

function politicaEngine() {
  return globalThis.FinanceCanonicalInvestmentPolicy;
}

function politicaLoad() {
  let saved = null;
  try { saved = JSON.parse(storageGet(storageKey(POLITICA_STORE), "null")); } catch { saved = null; }
  return politicaEngine().normalizePolicy(saved);
}

function politicaSave(policy) {
  storageSet(storageKey(POLITICA_STORE), JSON.stringify(policy));
  queueRemoteSave();
}

function politicaToday() {
  return isoLocalDate(new Date());
}

function politicaDate(iso) {
  const [year, month, day] = String(iso).slice(0, 10).split("-").map(Number);
  return `${day}/${month}/${year}`;
}

// Lo que la app ya sabe de la cartera: se lee, no se vuelve a pedir.
function politicaPortfolio() {
  const engine = globalThis.FinanceCanonicalPortfolio;
  const rows = iv1PositionsList();
  const summary = engine && rows.length ? engine.normalizePositions(rows).summary : { totalsByType: {}, totalValue: 0 };
  return { totalsByType: summary.totalsByType || {}, totalValue: Number(summary.totalValue) || 0, loanAmount: Number(apx3LombardDeclaration().loanAmount) || 0 };
}

// Valores ya declarados en otras pantallas, para no empezar en blanco (CAR-01: «valores ya rellenos desde lo declarado»).
function politicaPrefill() {
  const policy = politicaEngine().defaultPolicy();
  policy.allocation.targets = { ...iv6PortfolioTargets() };
  const goals = (typeof p2State === "function" ? p2State().goals || [] : []).filter((goal) => /^\d{4}-\d{2}/.test(String(goal.targetDate || "")));
  const today = politicaToday();
  const years = goals.map((goal) => (new Date(`${String(goal.targetDate).slice(0, 10)}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / (365.25 * 86400000)).filter((value) => value > 0);
  if (years.length) policy.purpose.horizonYears = Math.max(1, Math.round(Math.max(...years)));
  return { policy, goals: goals.map((goal) => `${goal.name} (${String(goal.targetDate).slice(0, 7)})`), hasTargets: Object.keys(policy.allocation.targets).length > 0, loanAmount: politicaPortfolio().loanAmount };
}

function politicaTypeOptions(current) {
  return Object.entries(politicaEngine().TYPES).map(([type, label]) => `<option value="${type}"${type === current ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

// ---- Vista ------------------------------------------------------------------------------------------------------------------------------------------

function politicaChecker(portfolio) {
  return `<details class="pol-consulta"><summary>¿Esta operación cumple la política?</summary>
      <p class="e19-kpi-note">Pruébalo <strong>antes</strong> de operar. No compra ni vende nada: solo dice qué regla choca, si alguna.</p>
      <div class="cuadro-mandos-controls">
        <label class="month-picker"><span>Operación</span><select id="politicaOpTipo"><option value="buy">Comprar</option><option value="sell">Vender</option></select></label>
        <label class="month-picker"><span>De qué</span><select id="politicaOpActivo">${politicaTypeOptions("etf")}</select></label>
        <label class="month-picker"><span>Importe (€)</span><input type="number" id="politicaOpImporte" min="0" step="50" inputmode="decimal" /></label>
        <label class="month-picker"><span>Caída de la cartera desde su máximo (%, si la sabes)</span><input type="number" id="politicaOpCaida" min="0" max="100" step="1" inputmode="decimal" /></label>
      </div>
      <button type="button" class="e19-btn e19-btn-secondary" data-politica-probar>Comprobar</button>
      <div id="politicaOpResultado" role="status" aria-live="polite"></div>
      ${portfolio.totalValue > 0 ? "" : '<p class="e19-kpi-note">Todavía no hay cartera registrada: solo se miran las reglas que no dependen del reparto.</p>'}
    </details>`;
}

function politicaAssessmentHtml(policy, portfolio) {
  const result = politicaEngine().assessPortfolio({ policy, ...portfolio });
  if (result.status === "no-data") return `<p class="e19-kpi-note">${escapeHtml(result.reason)}</p>`;
  if (!result.items.length) return `<p class="pol-ok"><span aria-hidden="true">✓</span> <strong>La cartera de hoy está dentro de la política.</strong></p>`;
  const rows = result.items.map((item) => `<li>${item.n ? `<strong>Regla ${item.n}.</strong> ` : ""}${escapeHtml(item.text)}</li>`).join("");
  return `<p class="pol-fuera"><span aria-hidden="true">⚠</span> <strong>${result.items.length} ${result.items.length === 1 ? "cosa se sale" : "cosas se salen"} de la política</strong></p><ul class="pol-lista">${rows}</ul>
    <p class="e19-kpi-note">La herramienta de rebalanceo de arriba sigue avisando con su propio umbral (10 puntos): la banda de la política todavía no la gobierna.</p>`;
}

function politicaViewHtml(policy) {
  const engine = politicaEngine();
  const today = politicaToday();
  const portfolio = politicaPortfolio();
  const signature = engine.signatureState(policy);
  const missing = engine.problems(policy);
  const review = engine.reviewStatus(policy, { today });
  const state = signature === "signed" ? `Firmada el ${politicaDate(policy.signature.signedAt)} por ${policy.signature.signers.map(escapeHtml).join(" y ")}.`
    : signature === "changed" ? "Cambiada después de firmar: la firma ya no vale hasta firmarla de nuevo."
    : missing.length ? "Borrador incompleto: todavía no se puede firmar." : "Borrador sin firmar.";
  const reviewBanner = review.status === "due-soon" || review.status === "overdue"
    ? `<p class="pol-revision" role="status"><strong>${POLITICA_REVIEW_TEXT[review.status]}</strong> ${review.daysLeft >= 0 ? `Vence el ${politicaDate(review.dueDate)} (en ${review.daysLeft} ${review.daysLeft === 1 ? "día" : "días"}).` : `Venció el ${politicaDate(review.dueDate)}.`}</p>` : "";
  const rules = engine.rules(policy).map((rule) => `<li value="${rule.n}">${escapeHtml(rule.text)}</li>`).join("");
  const pending = missing.length ? `<ul class="pol-lista">${missing.map((item) => `<li>Pregunta ${item.question}: ${escapeHtml(item.text)}</li>`).join("")}</ul>` : "";
  return `${reviewBanner}<p class="pol-estado" data-politica-estado="${escapeHtml(signature)}"><strong>${state}</strong></p>${pending}
    <h4 class="pol-sub">Lo acordado</h4><ol class="pol-reglas">${rules}</ol>
    <h4 class="pol-sub">La cartera de hoy frente a la política</h4>${politicaAssessmentHtml(policy, portfolio)}
    <div class="pol-acciones">
      <button type="button" class="e19-btn e19-btn-secondary" data-politica-editar>Revisar o cambiar la política</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-politica-imprimir>Imprimir una página</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-politica-borrar>Borrar la política</button>
    </div>
    ${politicaChecker(portfolio)}`;
}

// ---- Formulario de seis preguntas -------------------------------------------------------------------------------------------------------------------

function politicaEditorHtml(prefill) {
  const d = politicaDraft;
  const engine = politicaEngine();
  const num = (path, value, attrs = "") => `<input type="number" data-pol-path="${path}" value="${value === 0 || value === "" || value === undefined ? "" : value}" inputmode="decimal" ${attrs} />`;
  const targets = Object.entries(engine.TYPES).map(([type, label]) => `<label class="month-picker"><span>${escapeHtml(label)} (%)</span>${num(`allocation.targets.${type}`, d.allocation.targets[type] || "", 'min="0" max="100" step="1"')}</label>`).join("");
  const actions = (path, current) => `<select data-pol-path="${path}">${Object.entries(engine.DRAWDOWN_ACTIONS).map(([key, label]) => `<option value="${key}"${key === current ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
  const goalsNote = prefill.goals.length ? `<p class="e19-kpi-note">Objetivos ya declarados en la app: ${prefill.goals.map(escapeHtml).join(", ")}.</p>` : "";
  const leverageNote = prefill.loanAmount > 0 ? `<p class="e19-kpi-note"><strong>Ojo:</strong> hay un préstamo declarado con la cartera como garantía (${money(prefill.loanAmount, true)}). Si marcas «sin apalancamiento», la política nace incumplida.</p>` : "";
  return `<form id="politicaForm" novalidate>
    <fieldset class="pol-fieldset"><legend>1. ¿Para qué es este dinero y para cuándo?</legend>
      ${goalsNote}
      <label class="month-picker"><span>Para qué</span><input type="text" maxlength="200" data-pol-path="purpose.text" value="${escapeHtml(d.purpose.text)}" placeholder="Ej. jubilación, o entrada de una casa" /></label>
      <label class="month-picker"><span>Dentro de cuántos años lo necesitaremos</span>${num("purpose.horizonYears", d.purpose.horizonYears, 'min="1" max="60" step="1"')}</label>
    </fieldset>
    <fieldset class="pol-fieldset"><legend>2. ¿Cómo repartimos la cartera, y cuándo la rebalanceamos?</legend>
      <p class="e19-kpi-note">${prefill.hasTargets ? "Rellenado con el reparto objetivo que ya fijaste en Rebalanceo." : "Todavía no hay reparto objetivo en Rebalanceo: ponlo aquí."} Tiene que sumar 100 %.</p>
      <div class="cuadro-mandos-controls">${targets}</div>
      <p class="e19-kpi-note" data-pol-suma aria-live="polite"></p>
      <label class="month-picker"><span>Banda: puntos de desvío que toleramos antes de rebalancear</span>${num("allocation.bandPct", d.allocation.bandPct, 'min="2" max="25" step="1"')}</label>
      <label class="pol-check"><input type="checkbox" data-pol-path="allocation.rebalanceByContributions"${d.allocation.rebalanceByContributions ? " checked" : ""} /> Rebalancear primero con las aportaciones, sin vender</label>
    </fieldset>
    <fieldset class="pol-fieldset"><legend>3. ¿Cómo aportamos?</legend>
      <label class="month-picker"><span>Regla de aportación</span><select data-pol-path="contribution.mode"><option value="">Elige una…</option>${Object.entries(engine.CONTRIBUTION_MODES).map(([key, label]) => `<option value="${key}"${key === d.contribution.mode ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label>
      <label class="month-picker"><span>Cantidad al mes (€, solo si es fija)</span>${num("contribution.monthly", d.contribution.monthly, 'min="0" step="25"')}</label>
    </fieldset>
    <fieldset class="pol-fieldset"><legend>4. ¿Qué no compramos nunca?</legend>
      ${leverageNote}
      <label class="pol-check"><input type="checkbox" data-pol-path="exclusions.noLeverage"${d.exclusions.noLeverage ? " checked" : ""} /> Nada con dinero prestado (sin apalancamiento)</label>
      <label class="pol-check"><input type="checkbox" data-pol-path="exclusions.noCrypto"${d.exclusions.noCrypto ? " checked" : ""} /> Nada de cripto</label>
      <label class="month-picker"><span>Otra cosa que no compramos (opcional)</span><input type="text" maxlength="160" data-pol-path="exclusions.custom" value="${escapeHtml(d.exclusions.custom)}" placeholder="Ej. productos que no sepamos explicar" /></label>
    </fieldset>
    <fieldset class="pol-fieldset"><legend>5. ¿Qué hacemos si la cartera cae?</legend>
      <p class="e19-kpi-note">Decidirlo ahora, con calma, es lo que evita vender en el peor momento.</p>
      <label class="month-picker"><span>Si cae un 20 % desde su máximo</span>${actions("drawdown.at20", d.drawdown.at20)}</label>
      <label class="month-picker"><span>Si cae un 35 % desde su máximo</span>${actions("drawdown.at35", d.drawdown.at35)}</label>
    </fieldset>
    <fieldset class="pol-fieldset"><legend>6. ¿Cuándo la revisamos, y quién la firma?</legend>
      <label class="month-picker"><span>La revisamos cada</span><select data-pol-path="review.everyMonths">${engine.REVIEW_MONTH_CHOICES.map((months) => `<option value="${months}"${months === d.review.everyMonths ? " selected" : ""}>${months} meses</option>`).join("")}</select></label>
      <div class="cuadro-mandos-controls">
        <label class="month-picker"><span>Nombre de la primera persona</span><input type="text" maxlength="40" autocomplete="off" data-pol-firma="0" value="${escapeHtml(d.signature?.signers?.[0] || "")}" /></label>
        <label class="month-picker"><span>Nombre de la segunda persona</span><input type="text" maxlength="40" autocomplete="off" data-pol-firma="1" value="${escapeHtml(d.signature?.signers?.[1] || "")}" /></label>
      </div>
      <p class="e19-kpi-note" data-pol-aviso role="alert"></p>
    </fieldset>
    <div class="pol-acciones">
      <button type="button" class="e19-btn e19-btn-primary" data-politica-firmar>Firmar la política</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-politica-guardar>Guardar sin firmar</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-politica-cancelar>Cancelar</button>
    </div>
  </form>`;
}

// ---- Pintado ------------------------------------------------------------------------------------------------------------------------------------

function politicaBodyHtml() {
  const engine = politicaEngine();
  if (politicaMode === "editar" && politicaDraft) return politicaEditorHtml(politicaPrefill());
  const policy = politicaLoad();
  if (engine.signatureState(policy) === "none") {
    const prefill = politicaPrefill();
    const known = [prefill.hasTargets ? "tu reparto objetivo" : "", prefill.goals.length ? "tus objetivos" : ""].filter(Boolean);
    return estadoHtml({ kind: "vacio", titulo: "Todavía no habéis escrito vuestra política de inversión", texto: `Son seis preguntas en lenguaje llano${known.length ? `, ya rellenas con ${known.join(" y ")}` : ""}. Se firma con fecha y sirve para no decidir en el peor momento.`, accion: { label: "Escribir la política", id: "politica-empezar" } });
  }
  return politicaViewHtml(policy);
}

function renderPoliticaInversion(engine, force = false) {
  const box = qs("politicaCuerpo");
  if (!box || !engine) return;
  attachPolitica(document); // idempotente: un clic temprano no puede perderse
  // Mientras se edita, la pantalla no se repinta sola: cambiaría el formulario bajo las manos de quien escribe.
  if (politicaMode === "editar" && !force) return;
  try {
    const html = politicaBodyHtml();
    if (box.__politicaHtml !== html) {
      box.innerHTML = html;
      box.__politicaHtml = html;
      politicaUpdateSum();
    }
  } catch (error) {
    console.error(`renderPoliticaInversion: ${error.message}`);
  }
}

function politicaRerender() {
  const box = qs("politicaCuerpo");
  if (box) box.__politicaHtml = null;
  renderPoliticaInversion(politicaEngine(), true);
}

function politicaNote(message) {
  const note = qs("politicaNota");
  if (note) note.textContent = message;
  announceStatus(message);
}

function politicaUpdateSum() {
  const out = qs("politicaCuerpo")?.querySelector("[data-pol-suma]");
  if (!out || !politicaDraft) return;
  const sum = politicaEngine().targetsSum(politicaDraft);
  const ok = Math.abs(sum - 100) <= 0.5;
  out.textContent = `Suma ahora: ${String(sum).replace(".", ",")} %${ok ? "" : " (tiene que ser 100 %)"}.`;
}

function politicaSetPath(path, value) {
  const parts = path.split(".");
  let node = politicaDraft;
  parts.slice(0, -1).forEach((part) => { node[part] = node[part] && typeof node[part] === "object" ? node[part] : {}; node = node[part]; });
  node[parts.at(-1)] = value;
}

function politicaStart(policy) {
  const prefilled = politicaHasContent(policy) ? policy : { ...politicaPrefill().policy };
  politicaDraft = JSON.parse(JSON.stringify(prefilled));
  politicaMode = "editar";
  politicaRerender();
  qs("politicaCuerpo")?.querySelector("input, select")?.focus();
}

function politicaHasContent(policy) {
  return politicaEngine().signatureState(policy) !== "none";
}

function politicaFinish(sign) {
  const engine = politicaEngine();
  const names = [...(qs("politicaCuerpo")?.querySelectorAll("[data-pol-firma]") || [])].map((input) => input.value);
  const before = politicaLoad();
  const normalized = engine.normalizePolicy(politicaDraft);
  const warning = qs("politicaCuerpo")?.querySelector("[data-pol-aviso]");
  let next;
  if (sign) {
    const result = engine.sign(normalized, { signers: names, today: politicaToday() });
    if (!result.ok) {
      const problems = engine.problems(normalized);
      const message = result.reason === "dos-firmas" ? "Hacen falta los nombres de dos personas distintas." : problems.length ? `Falta responder: ${problems.map((item) => `pregunta ${item.question}`).filter((v, i, all) => all.indexOf(v) === i).join(", ")}.` : "No se puede firmar todavía.";
      if (warning) warning.textContent = message;
      announceStatus(message);
      return;
    }
    next = result.policy;
  } else {
    next = { ...normalized, signature: null, updatedAt: politicaToday() };
  }
  politicaSave(next);
  politicaMode = "ver";
  politicaDraft = null;
  politicaRerender();
  const message = sign ? "Política de inversión firmada." : "Política guardada sin firmar.";
  politicaNote(message);
  showUndoToast(message, () => { politicaSave(before); politicaRerender(); politicaNote("Política recuperada como estaba."); });
}

function politicaProbar() {
  const engine = politicaEngine();
  const out = qs("politicaOpResultado");
  if (!out) return;
  const portfolio = politicaPortfolio();
  const caida = qs("politicaOpCaida")?.value;
  const result = engine.checkOperation({
    policy: politicaLoad(),
    operation: { kind: qs("politicaOpTipo")?.value, type: qs("politicaOpActivo")?.value, amount: Number(qs("politicaOpImporte")?.value) || 0 },
    totalsByType: portfolio.totalsByType,
    totalValue: portfolio.totalValue,
    drawdownPct: caida === "" || caida === undefined ? null : Number(caida),
  });
  const head = { contradicts: "⚠ Contradice la política", warns: "◐ Ojo: la política pide cuidado", complies: "✓ No choca con ninguna regla que la app pueda comprobar", "no-data": "? No se puede comprobar" }[result.verdict];
  const lines = result.findings.map((finding) => `<li>${finding.n ? `<strong>Regla ${finding.n}.</strong> ` : ""}${escapeHtml(finding.text)}</li>`).join("");
  const unsigned = engine.signatureState(politicaLoad()) === "signed" ? "" : "<p class=\"e19-kpi-note\">La política no está firmada: es un borrador.</p>";
  out.innerHTML = `<p class="pol-veredicto" data-politica-veredicto="${escapeHtml(result.verdict)}"><strong>${head}</strong></p>${lines ? `<ul class="pol-lista">${lines}</ul>` : ""}${result.reason ? `<p class="e19-kpi-note">${escapeHtml(result.reason)}</p>` : ""}${result.verdict === "contradicts" ? '<p class="e19-kpi-note">Si aun así la hacéis, dejad escrito el motivo. La app no la impide.</p>' : ""}${unsigned}`;
  announceStatus(head.replace(/^[^\s]+\s/, ""));
}

// Una sola vez, por delegación.
function attachPolitica(doc) {
  if (!doc || doc.__politicaAttached) return false;
  doc.__politicaAttached = true;
  const inCard = (target) => target?.closest?.("#politicaCard");
  doc.addEventListener("click", (event) => {
    const target = event.target;
    if (!inCard(target)) return;
    if (target.closest("[data-politica-editar]")) { politicaStart(politicaLoad()); return; }
    if (target.closest('[data-estado-accion="politica-empezar"]')) { politicaStart(politicaEngine().defaultPolicy()); return; }
    if (target.closest("[data-politica-cancelar]")) { politicaMode = "ver"; politicaDraft = null; politicaRerender(); return; }
    if (target.closest("[data-politica-firmar]")) { politicaFinish(true); return; }
    if (target.closest("[data-politica-guardar]")) { politicaFinish(false); return; }
    if (target.closest("[data-politica-probar]")) { politicaProbar(); return; }
    if (target.closest("[data-politica-imprimir]")) {
      document.body.classList.add("is-printing-politica");
      window.print();
      document.body.classList.remove("is-printing-politica");
      return;
    }
    if (target.closest("[data-politica-borrar]")) {
      const before = politicaLoad();
      politicaSave(politicaEngine().defaultPolicy());
      politicaRerender();
      politicaNote("Política borrada.");
      showUndoToast("Política borrada.", () => { politicaSave(before); politicaRerender(); politicaNote("Política recuperada."); });
    }
  });
  const onField = (event) => {
    const field = event.target;
    if (!inCard(field) || !politicaDraft || !field.dataset?.polPath) return;
    const value = field.type === "checkbox" ? field.checked : field.type === "number" ? (field.value === "" ? 0 : Number(field.value)) : field.value;
    politicaSetPath(field.dataset.polPath, value);
    if (field.dataset.polPath.startsWith("allocation.targets.")) politicaUpdateSum();
  };
  doc.addEventListener("input", onField);
  doc.addEventListener("change", onField);
  return true;
}
