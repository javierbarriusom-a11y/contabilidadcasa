// Herramientas avanzadas › Fiscal: «Tus datos fiscales» (WP-23 PR-2, docs/WP23_DISENO.md §6). El formulario donde el hogar teclea los datos que la campaña fiscal necesita
// (canonical-year-end-tax.js, motor puro) para dejar de enseñar el hogar de ejemplo. Se guardan SOLO en el almacén `fiscal-data` (en la copia y la nube), nunca en el
// repositorio ni en el chat: el repositorio es público.
//
// Reglas, con prueba:
//   · Vacío NO es cero: un campo vacío es «no lo sé» y deja la acción en «sin calcular»; un 0 escrito es un cero de verdad.
//   · Una cifra fuera de rango o que no es un número NO se guarda ni se corrige en silencio: se dice cuál es y por qué.
//   · Los datos son de un año: los del año anterior no se usan para la campaña nueva (la tarjeta lo dice y vuelve al ejemplo).
//   · Quitar los datos se puede deshacer (sin confirm()), como el resto de borrados de la app.
//   · No ejecuta nada (A11-4) ni sale a la red: lo que se teclea se calcula aquí.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, storageGet, storageSet, storageKey, queueRemoteSave, announceStatus, showUndoToast,
// isoLocalDate, FinanceUxShell…). Sin llamadas al DOM ni escuchas al cargarse: fiscal-campana-ui.js llama a `renderFiscalDatos` al pintar la tarjeta, que engancha las escuchas.

const FISCAL_DATOS_STORE = "fiscal-data"; // en la copia (BACKUP_LOCAL_STORES)
const FISCAL_HECHO_STORE = "fiscal-done"; // PR-3: qué acciones ha marcado el hogar como hechas y cuándo (en la copia)

// Qué se pide, en qué orden y dónde se encuentra. Los ids son los de FIELD_SPECS / TRISTATE_SPECS del motor.
const FISCAL_DATOS_SECCIONES = [
  { titulo: "La Renta", campos: [
    { id: "annualGross", etiqueta: "Bruto anual (€)", ayuda: "Todo lo bruto del año, en la nómina o en el certificado de retenciones." },
    { id: "marginalRatePct", etiqueta: "Tipo marginal de IRPF (%)", pct: true, ayuda: "El % del último tramo de tu base. Sale en el borrador de la Renta o en el simulador de la Agencia Tributaria." },
    { id: "estimatedResult", etiqueta: "Resultado estimado de la Renta (€)", signo: true, ayuda: "Positivo si sale a pagar, negativo si sale a devolver (usa ± si tu teclado no tiene el menos)." },
    { id: "currentWithholdingPct", etiqueta: "Retención actual en la nómina (%) · opcional", pct: true, ayuda: "El % de IRPF que te retienen hoy. Si lo dejas vacío, no se sugiere un tipo final." },
  ] },
  { titulo: "Plan de pensiones", campos: [
    { id: "pensionContributed", etiqueta: "Aportado este año (€)", ayuda: "Lo que ya has aportado en el año a planes individuales. Un 0 escrito significa que no has aportado nada." },
    { eleccion: "hasEmployerPlan", etiqueta: "¿Hay plan de pensiones de empresa?", ayuda: "Con plan de empresa el límite combinado es distinto y la app no lo calcula." },
    { id: "pensionAvailable", etiqueta: "Lo que podéis aportar todavía (€) · opcional", ayuda: "Si hay un tope de liquidez que queréis respetar. Vacío = sin tope propio." },
  ] },
  { titulo: "Vivienda", campos: [
    { eleccion: "housingApplies", etiqueta: "¿Aplica la deducción por vivienda?", ayuda: "Solo si la compra es anterior a 2013 y ya aplicabas la deducción." },
    { id: "housingPaid", etiqueta: "Pagado este año por la vivienda (€)", ayuda: "Cuotas y amortizaciones del año, de este declarante." },
  ] },
  { titulo: "Ventas de inversión", campos: [
    { id: "realizedNet", etiqueta: "Resultado neto de las ventas del año (€)", signo: true, ayuda: "Plusvalías menos minusvalías ya realizadas. Negativo si has perdido." },
    { id: "latentLosses", etiqueta: "Minusvalías latentes que podrías realizar (€)", ayuda: "Lo que perderías si vendieras posiciones que hoy valen menos de lo que costaron." },
    { id: "savingsRatePct", etiqueta: "Tipo de la base del ahorro (%)", pct: true, ayuda: "El % que paga tu base del ahorro en el último tramo." },
  ] },
  { titulo: "Donativos", campos: [
    { id: "donationsAmount", etiqueta: "Donativos del año, hechos o previstos (€)", ayuda: "A entidades acogidas a la Ley 49/2002. Un 0 escrito significa que no donas." },
    { recurrente: true, etiqueta: "Dono cada año a la misma entidad (recurrente)", ayuda: "Sube el tramo del resto del 40 % al 45 %. Sin marcar se supone que no." },
  ] },
];
const FISCAL_DATOS_DECLARANTES = ["Declarante 1", "Declarante 2 (déjalo vacío si solo hay uno)"];
let fiscalDatosRenderedKey = null; // lo último que se pintó en el formulario: no se repinta mientras se escribe

function fiscalDatosEngine() {
  return globalThis.FinanceCanonicalYearEndTax;
}

// El año de la campaña: el del ejemplo, o el actual si ya pasó.
function fiscalDatosYear(engine, today) {
  return Math.max(engine.EXAMPLE_HOUSEHOLD.year, Number(String(today).slice(0, 4)));
}

function fiscalDatosRaw() {
  return storageGet(storageKey(FISCAL_DATOS_STORE), "");
}

function fiscalDatosLoad() {
  let saved = null;
  try { saved = JSON.parse(fiscalDatosRaw() || "null"); } catch { saved = null; }
  return fiscalDatosEngine().normalizeStore(saved);
}

function fiscalDatosWrite(text) {
  storageSet(storageKey(FISCAL_DATOS_STORE), text);
  queueRemoteSave();
}

// «Hecho» (PR-3): lo que el hogar ha marcado, en un almacén aparte para que quitar los datos no borre qué se hizo. La app no comprueba que se hiciera.
function fiscalHechoLoad() {
  let saved = null;
  try { saved = JSON.parse(storageGet(storageKey(FISCAL_HECHO_STORE), "") || "null"); } catch { saved = null; }
  return fiscalDatosEngine().normalizeDone(saved);
}

function fiscalHechoWrite(store) {
  storageSet(storageKey(FISCAL_HECHO_STORE), JSON.stringify(store));
  queueRemoteSave();
}

// Para el calendario del móvil (recordatorios-ui.js → canonical-reminders.js): {year, total, pending} de la campaña con datos reales, o null si no hay datos
// del hogar de este año o no hay tareas con ahorro (sin datos no se sabe nada, y «sin tareas» no es «todo hecho»).
function fiscalCampaignReminder() {
  const engine = fiscalDatosEngine();
  if (!engine) return null;
  const today = isoLocalDate(new Date());
  const year = fiscalDatosYear(engine, today);
  const resolved = engine.resolveHousehold(fiscalDatosLoad(), year);
  if (resolved.status !== "real") return null;
  const campaign = engine.buildCampaign(resolved.household, { today, done: fiscalHechoLoad() });
  return campaign.calculable && campaign.progress.total > 0 ? { year, total: campaign.progress.total, pending: campaign.progress.pending } : null;
}

function fiscalHechoMark(actionId, holderId) {
  const engine = fiscalDatosEngine();
  if (!engine) return;
  const today = isoLocalDate(new Date());
  const { store, error } = engine.markDone(fiscalHechoLoad(), { year: fiscalDatosYear(engine, today), actionId, holderId, at: today });
  if (error) { announceStatus("No se ha podido marcar como hecho."); return; }
  fiscalHechoWrite(store);
  renderFiscalCampaign(engine);
  announceStatus(`Marcado como hecho el ${fiscalDatosDate(today)}.`);
}

function fiscalHechoUnmark(actionId, holderId) {
  const engine = fiscalDatosEngine();
  if (!engine) return;
  const before = fiscalHechoLoad();
  fiscalHechoWrite(engine.unmarkDone(before, { actionId, holderId }));
  renderFiscalCampaign(engine);
  announceStatus("Marca de hecho quitada.");
  showUndoToast("Marca de hecho quitada.", () => {
    fiscalHechoWrite(before);
    renderFiscalCampaign(engine);
    announceStatus("Marca de hecho recuperada.");
  });
}

// Lo que usa la tarjeta: { status: "real" | "empty" | "stale-year", household, storedYear, updatedAt }.
function fiscalDatosResolve(engine, year) {
  return engine.resolveHousehold(fiscalDatosLoad(), year);
}

function fiscalDatosDate(iso) {
  return iso ? String(iso).split("-").reverse().map(Number).join("/") : "";
}

function fiscalDatosFieldId(slot, id) {
  return `fiscalDatos-${slot}-${id}`;
}

function fiscalDatosValueText(value) {
  const shell = globalThis.FinanceUxShell;
  if (value === null || value === undefined) return "";
  return shell?.formatAmountInput ? shell.formatAmountInput(value) : String(value);
}

function fiscalDatosPctText(value) {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}

function fiscalDatosFieldHtml(engine, field, slot, holder) {
  const hintId = (id) => `${fiscalDatosFieldId(slot, id)}-ayuda`;
  if (field.eleccion) {
    const spec = engine.TRISTATE_SPECS.find((item) => item.id === field.eleccion);
    const current = spec.path.reduce((node, key) => (node ? node[key] : undefined), holder || {});
    const option = (value, label) => `<option value="${value}"${(current === true ? "si" : current === false ? "no" : "") === value ? " selected" : ""}>${label}</option>`;
    return `<label class="month-picker fc-datos-campo"><span>${escapeHtml(field.etiqueta)}</span>
        <select id="${fiscalDatosFieldId(slot, field.eleccion)}" aria-describedby="${hintId(field.eleccion)}">${option("", "No lo sé")}${option("si", "Sí")}${option("no", "No")}</select>
        <small class="fc-datos-ayuda" id="${hintId(field.eleccion)}">${escapeHtml(field.ayuda)}</small></label>`;
  }
  if (field.recurrente) {
    const checked = holder?.donations?.recurring === true ? " checked" : "";
    return `<label class="fc-datos-campo fc-datos-casilla"><input type="checkbox" id="${fiscalDatosFieldId(slot, "recurring")}"${checked} aria-describedby="${hintId("recurring")}" /><span>${escapeHtml(field.etiqueta)}</span>
        <small class="fc-datos-ayuda" id="${hintId("recurring")}">${escapeHtml(field.ayuda)}</small></label>`;
  }
  const spec = engine.FIELD_SPECS.find((item) => item.id === field.id);
  const value = spec.path.reduce((node, key) => (node ? node[key] : undefined), holder || {});
  const text = field.pct ? fiscalDatosPctText(value) : fiscalDatosValueText(value);
  const id = fiscalDatosFieldId(slot, field.id);
  const sign = field.signo ? `<button type="button" class="amount-sign" data-amount-sign="${id}" aria-label="Cambiar el signo: ${escapeHtml(field.etiqueta)}">±</button>` : "";
  // Los importes llevan `data-amount-input` (formato es-ES al salir del campo y aviso si no es un importe); los porcentajes, no: «30» no es «30,00».
  return `<label class="month-picker fc-datos-campo"><span>${escapeHtml(field.etiqueta)}</span>
      <span class="fc-datos-entrada"><input type="text" inputmode="decimal" autocomplete="off" id="${id}"${field.pct ? "" : " data-amount-input"} value="${escapeHtml(text)}" aria-describedby="${hintId(field.id)}" />${sign}</span>
      <small class="fc-datos-ayuda" id="${hintId(field.id)}">${escapeHtml(field.ayuda)}</small></label>`;
}

function fiscalDatosHolderHtml(engine, slot, holder) {
  const label = holder?.label || "";
  const groups = FISCAL_DATOS_SECCIONES.map((section) => `<div class="fc-datos-grupo"><h5>${escapeHtml(section.titulo)}</h5>${section.campos.map((field) => fiscalDatosFieldHtml(engine, field, slot, holder)).join("")}</div>`).join("");
  return `<fieldset class="fc-datos-persona" data-fiscal-slot="${slot}">
      <legend>${escapeHtml(FISCAL_DATOS_DECLARANTES[slot] || `Declarante ${slot + 1}`)}</legend>
      <label class="month-picker fc-datos-campo"><span>Nombre (como quieras verlo en la lista)</span>
        <input type="text" id="${fiscalDatosFieldId(slot, "label")}" maxlength="40" autocomplete="off" value="${escapeHtml(label)}" /></label>
      ${groups}
    </fieldset>`;
}

// Qué dice el formulario de lo que hay guardado: nada, datos de otro año, o datos de este.
function fiscalDatosStatusText(resolved, year) {
  if (resolved.status === "real") return `Datos guardados${resolved.updatedAt ? ` el ${fiscalDatosDate(resolved.updatedAt)}` : ""}. La lista de arriba ya usa tus datos.`;
  if (resolved.status === "stale-year") return `Los datos guardados son de ${resolved.storedYear || "otro año"} y esta campaña es la de ${year}: no se usan. Revisa cada cifra y guarda.`;
  return "Todavía no has guardado ningún dato: la lista de arriba es un ejemplo.";
}

// Pinta el formulario. `force` lo repinta aunque se esté escribiendo (tras guardar o quitar).
function renderFiscalDatos(engine, options = {}) {
  const box = qs("campanaFiscalDatos");
  if (!box || !engine) return;
  attachFiscalDatos(document); // idempotente: un envío temprano no puede perderse
  const raw = fiscalDatosRaw();
  const key = `${raw}|${options.year || ""}`;
  if (!options.force && fiscalDatosRenderedKey === key && box.childElementCount) return;
  if (!options.force && box.contains(document.activeElement) && box.childElementCount) return; // escribiendo: no se pisa
  const year = options.year || fiscalDatosYear(engine, isoLocalDate(new Date()));
  const store = fiscalDatosLoad();
  const resolved = engine.resolveHousehold(store, year);
  const byId = Object.fromEntries(store.holders.map((holder) => [holder.id, holder]));
  const slots = Array.from({ length: engine.MAX_HOLDERS }, (_, slot) => byId[`persona-${slot + 1}`] || null);
  // Sin datos guardados el formulario sale abierto (es la llamada a la acción) y con datos, plegado; pero tras guardar o quitar se respeta como estaba: si se plegara,
  // el mensaje de «guardado» y los errores quedarían escondidos justo cuando hacen falta.
  const previous = qs("fiscalDatosDetails");
  const open = (options.force && previous ? previous.open : resolved.status !== "real") ? " open" : "";
  box.innerHTML = `<details class="fc-datos" id="fiscalDatosDetails"${open}>
      <summary>Tus datos fiscales</summary>
      <form id="fiscalDatosForm" novalidate>
        <p class="e19-kpi-note">Escribe lo que sepas: con tus cifras, la lista de arriba deja de ser un ejemplo. <strong>Lo que no sepas, déjalo vacío</strong>: esa acción saldrá «sin calcular» y te dirá qué falta, en lugar de suponer un 0 €. Se guarda solo en esta app (y en tu copia y tu nube), nunca en el repositorio: <strong>no los mandes por el chat</strong>. Son estimaciones, no la Renta.</p>
        ${slots.map((holder, slot) => fiscalDatosHolderHtml(engine, slot, holder)).join("")}
        <div class="fc-datos-errores" id="fiscalDatosError" role="alert" hidden></div>
        <div class="fc-datos-acciones">
          <button type="submit" class="e19-btn e19-btn-primary">Guardar mis datos</button>
          <button type="button" class="e19-btn e19-btn-secondary" data-fiscal-quitar${resolved.status === "empty" ? " disabled" : ""}>Quitar mis datos y volver al ejemplo</button>
        </div>
        <p class="e19-kpi-note" id="fiscalDatosEstado" role="status">${escapeHtml(fiscalDatosStatusText(resolved, year))}</p>
      </form>
    </details>`;
  fiscalDatosRenderedKey = key;
}

function fiscalDatosReadField(input) {
  const read = globalThis.FinanceUxShell?.readAmountInput;
  if (!read) return null;
  const { empty, value, invalid } = read(input);
  if (empty) return null;
  return invalid ? Number.NaN : value;
}

function fiscalDatosClearErrors(form) {
  form.querySelectorAll(".fc-datos-error").forEach((node) => node.remove());
  form.querySelectorAll("[aria-invalid][data-fiscal-invalid]").forEach((input) => {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("data-fiscal-invalid");
    const hint = `${input.id}-ayuda`;
    input.setAttribute("aria-describedby", hint);
  });
  const summary = qs("fiscalDatosError");
  if (summary) { summary.hidden = true; summary.textContent = ""; }
}

function fiscalDatosSubmit(event) {
  event.preventDefault();
  const engine = fiscalDatosEngine();
  const form = event.target;
  if (!engine || !form) return;
  fiscalDatosClearErrors(form);
  const today = isoLocalDate(new Date());
  const year = fiscalDatosYear(engine, today);
  const holders = [];
  const problems = [];
  for (let slot = 0; slot < engine.MAX_HOLDERS; slot += 1) {
    const values = {};
    engine.FIELD_SPECS.forEach((spec) => {
      const input = qs(fiscalDatosFieldId(slot, spec.id));
      values[spec.id] = input ? fiscalDatosReadField(input) : null;
    });
    const choice = (id) => { const raw = qs(fiscalDatosFieldId(slot, id))?.value; return raw === "si" ? true : raw === "no" ? false : null; };
    const input = {
      id: `persona-${slot + 1}`,
      label: qs(fiscalDatosFieldId(slot, "label"))?.value || "",
      values,
      choices: { hasEmployerPlan: choice("hasEmployerPlan"), housingApplies: choice("housingApplies") },
      recurring: Boolean(qs(fiscalDatosFieldId(slot, "recurring"))?.checked),
    };
    const { holder, errors } = engine.holderFromInput(input);
    const who = holder.label || FISCAL_DATOS_DECLARANTES[slot].replace(/ \(.*$/, "");
    Object.entries(errors).forEach(([fieldId, message]) => problems.push({ slot, fieldId, message, who }));
    // Un nombre solo no es un declarante: sin ninguna cifra ni respuesta se descarta esa ficha.
    if (engine.holderHasData(holder)) holders.push({ ...holder, label: holder.label || FISCAL_DATOS_DECLARANTES[slot].replace(/ \(.*$/, "") });
  }
  const summary = qs("fiscalDatosError");
  if (problems.length) {
    problems.forEach(({ slot, fieldId, message }) => {
      const input = qs(fiscalDatosFieldId(slot, fieldId));
      if (!input) return;
      // Un importe que no es un número ya lo explica el lector de importes de la app (su propio aviso bajo el campo): se le pide que lo pinte si aún no lo hizo.
      if (input.matches("[data-amount-input]") && /^No entiendo/.test(message) && globalThis.FinanceUxShell?.normalizeAmountField) {
        globalThis.FinanceUxShell.normalizeAmountField(input);
        return;
      }
      const id = `${input.id}-fallo`;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("data-fiscal-invalid", "true");
      input.setAttribute("aria-describedby", `${id} ${input.id}-ayuda`);
      input.closest("label")?.insertAdjacentHTML("beforeend", `<small class="fc-datos-error" id="${id}">${escapeHtml(message)}</small>`);
    });
    if (summary) {
      summary.innerHTML = `<p><strong>No se ha guardado nada.</strong> Corrige ${problems.length === 1 ? "esto" : `estos ${problems.length} campos`}:</p><ul>${problems.map(({ who, message }) => `<li>${escapeHtml(who)}: ${escapeHtml(message)}</li>`).join("")}</ul>`;
      summary.hidden = false;
    }
    qs(fiscalDatosFieldId(problems[0].slot, problems[0].fieldId))?.focus();
    announceStatus("No se han guardado los datos fiscales: hay campos por corregir.");
    return;
  }
  if (!holders.length) {
    if (summary) {
      summary.innerHTML = "<p><strong>No se ha guardado nada.</strong> No has escrito ninguna cifra ni respuesta: sigues viendo el ejemplo. Escribe al menos un dato (o deja todo como estaba).</p>";
      summary.hidden = false;
    }
    announceStatus("No se han guardado los datos fiscales: no hay ningún dato.");
    return;
  }
  fiscalDatosWrite(JSON.stringify({ schemaId: engine.STORE_SCHEMA_ID, year, holders, updatedAt: today }));
  renderFiscalCampaign(engine, { forceForm: true });
  announceStatus("Datos fiscales guardados. La lista usa ahora tus datos.");
}

function fiscalDatosRemove() {
  const engine = fiscalDatosEngine();
  const before = fiscalDatosRaw();
  if (!engine || !before) return;
  fiscalDatosWrite(JSON.stringify({ schemaId: engine.STORE_SCHEMA_ID, year: null, holders: [], updatedAt: null }));
  renderFiscalCampaign(engine, { forceForm: true });
  announceStatus("Datos fiscales quitados. Vuelve el ejemplo.");
  showUndoToast("Datos fiscales quitados. Vuelve el ejemplo.", () => {
    fiscalDatosWrite(before);
    renderFiscalCampaign(engine, { forceForm: true });
    announceStatus("Datos fiscales recuperados.");
  });
}

// «Rellenar» desde una acción sin calcular: abre el formulario y lleva el foco al primer campo sin rellenar.
function fiscalDatosOpen() {
  const details = qs("fiscalDatosDetails");
  if (!details) return;
  details.open = true;
  const empty = Array.from(details.querySelectorAll("input[type=text]:not([id$='-label'])")).find((input) => !input.value);
  (empty || details.querySelector("summary"))?.focus();
  details.scrollIntoView?.({ block: "nearest" });
}

// Una sola vez, por delegación.
function attachFiscalDatos(doc) {
  if (!doc || doc.__fiscalDatosAttached) return false;
  doc.__fiscalDatosAttached = true;
  doc.addEventListener("submit", (event) => { if (event.target?.id === "fiscalDatosForm") fiscalDatosSubmit(event); });
  doc.addEventListener("click", (event) => {
    const target = event.target?.closest?.("[data-fiscal-quitar], [data-fiscal-abrir], [data-fiscal-hecho], [data-fiscal-deshacer]");
    if (!target) return;
    if (target.hasAttribute("data-fiscal-quitar")) fiscalDatosRemove();
    else if (target.hasAttribute("data-fiscal-abrir")) fiscalDatosOpen();
    else if (target.hasAttribute("data-fiscal-hecho")) fiscalHechoMark(target.dataset.accion || "", target.dataset.declarante || "");
    else fiscalHechoUnmark(target.dataset.accion || "", target.dataset.declarante || "");
  });
  return true;
}
