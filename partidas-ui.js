// Plan › Partidas: las dos tarjetas de configuración que guardan en un almacén local (copia y nube). Script clásico
// cargado antes de app.js (comparte su ámbito global: qs, storageSet, render, money…), fuera de app.js por su techo
// de líneas (ARQ-4). La lógica vive en los motores puros; aquí solo se pinta, se lee el formulario y se guarda.
//
// WP-08: «Días de cargo» (canonical-charge-days.js), movido sin cambios desde app.js al llegar WP-24.

// Lo que hay que decir y dónde dejar el foco tras guardar: render() vuelve a pintar la pantalla después.
let chargeDaysPending = { status: "", focusKey: "", html: "" };
function renderChargeDays() {
  const engine = window.FinanceCanonicalChargeDays;
  const target = qs("cargoDia");
  if (!engine || !target) return;
  const observations = chargeDayObservations();
  const viability = window.FinanceCanonicalChargeDayViability?.analyze(observations).partidas || [];
  const model = engine.buildModel({ rows: chargeDayRows(), store: loadChargeDays(), suggestions: engine.suggestions(observations, viability) });
  const html = engine.renderHtml(model);
  // Sin cambios, no se repinta: el render diferido de la pantalla no se lleva el foco ni el aviso.
  if (html !== chargeDaysPending.html) target.innerHTML = chargeDaysPending.html = html;
  qs("cargoDiaResumen").textContent = engine.summaryText(model);
  qs("cargoDiaEstado").textContent = chargeDaysPending.status;
  const focusKey = chargeDaysPending.focusKey;
  (focusKey === "*" ? qs("cargoDiaResumen") : [...target.querySelectorAll("[data-cargo-dia]")].find((select) => select.dataset.cargoDia === focusKey))?.focus();
  chargeDaysPending.focusKey = "";
}

// Guarda al momento (sin botón «Guardar») y recalcula la previsión; el foco vuelve al mismo selector.
function saveChargeDays(changes, status) {
  const engine = window.FinanceCanonicalChargeDays;
  const store = changes.reduce((current, [key, value, source]) => engine.setDay(current, key, value, { source, now: new Date().toISOString() }), loadChargeDays());
  storageSet(storageKey("charge-days"), JSON.stringify(store));
  Object.assign(chargeDaysPending, { status, focusKey: changes.length === 1 ? changes[0][0] : "*" });
  render();
  renderChargeDays();
}

function handleChargeDayEvent(event) {
  const engine = window.FinanceCanonicalChargeDays;
  const select = event.type === "change" ? event.target.closest("[data-cargo-dia]") : null;
  const use = event.type === "click" ? event.target.closest("[data-cargo-dia-usar]") : null;
  if (select) saveChargeDays([[select.dataset.cargoDia, select.value, "declarado"]], select.value ? `Guardado: ${engine.dayText(engine.normalizeDay(select.value))}. La previsión ya lo usa.` : "Sin día indicado: vuelve a la fecha automática.");
  else if (use) saveChargeDays([[use.dataset.cargoDiaUsar, use.dataset.cargoDiaValor, "sugerido"]], `Guardado: día ${use.dataset.cargoDiaValor}. La previsión ya lo usa.`);
  else if (event.type === "click" && event.target.closest("[data-cargo-dia-fiables]")) {
    const changes = [...document.querySelectorAll("#cargoDia [data-cargo-dia-fiable]")].map((button) => [button.dataset.cargoDiaUsar, button.dataset.cargoDiaValor, "sugerido"]);
    saveChargeDays(changes, `Aplicadas ${changes.length} propuestas fiables. La previsión ya las usa.`);
  }
}

// WP-24: «Asignación personal» (canonical-personal-allowance.js). Una ficha por persona; guardar recalcula la previsión.
let personalAllowancePending = { status: "", focusId: "", html: "" };

// Los 24 meses del horizonte, para elegir la primera y la última transferencia.
function personalAllowanceMonths() {
  return Array.from({ length: 24 }, (_, index) => planningMonthForDate(addMonths(modelStartDate(), index), index)).map((month) => ({ key: month.key, label: month.label }));
}

// Lo que conviene saber antes de fiarse de la cifra: meses en los que el gasto variable estimado no da para las
// asignaciones (se queda en 0 y lo que pase de ahí sube el gasto total previsto).
function personalAllowanceNotes(store) {
  const engine = window.FinanceCanonicalPersonalAllowance;
  if (!store.people.length) return [];
  const variableRow = { kind: "expense", id: VARIABLE_OPERATIONAL_ROW_ID };
  const exhausted = Array.from({ length: 12 }, (_, index) => planningMonthForDate(addMonths(modelStartDate(), index), index))
    .filter((month) => engine.totalForMonth(store, month.key) > 0 && plannedValueForRow(variableRow, month) === 0);
  return exhausted.length ? [`En ${exhausted.map((month) => month.label).join(", ")} las asignaciones agotan el gasto variable estimado: lo que pase de ahí sube el gasto total previsto.`] : [];
}

function renderPersonalAllowances() {
  const engine = window.FinanceCanonicalPersonalAllowance;
  const target = qs("asignacionPersonal");
  if (!engine || !target) return;
  const store = loadPersonalAllowances();
  const months = personalAllowanceMonths();
  const html = engine.renderHtml(store, { months, defaultFrom: months[1]?.key || months[0]?.key, formatAmount: formatAmountField, notes: personalAllowanceNotes(store) });
  // Sin cambios, no se repinta: el render diferido no se lleva lo que se está escribiendo, el foco ni el aviso.
  if (html !== personalAllowancePending.html) target.innerHTML = personalAllowancePending.html = html;
  qs("asignacionResumen").textContent = engine.summaryText(store);
  qs("asignacionEstado").textContent = personalAllowancePending.status;
  if (personalAllowancePending.focusId) qs(personalAllowancePending.focusId)?.focus();
  personalAllowancePending.focusId = "";
}

function savePersonalAllowances(store, status, focusId) {
  storageSet(storageKey("personal-allowances"), JSON.stringify(store));
  Object.assign(personalAllowancePending, { status, focusId });
  render();
  renderPersonalAllowances();
}

function handlePersonalAllowanceEvent(event) {
  const engine = window.FinanceCanonicalPersonalAllowance;
  const form = event.target.closest?.("form[data-asignacion]");
  const remove = event.type === "click" ? event.target.closest("[data-asignacion-quitar]") : null;
  if (remove) {
    const before = loadPersonalAllowances();
    const person = before.people.find((item) => item.id === remove.dataset.asignacionQuitar);
    savePersonalAllowances(engine.removePerson(before, remove.dataset.asignacionQuitar), `Quitada la asignación de ${person?.name || "esa persona"}. El gasto variable vuelve a su cifra.`, "asignacionResumen");
    showUndoToast(`Asignación de ${person?.name || "esa persona"} quitada.`, () => savePersonalAllowances(before, "Deshecho: la asignación vuelve a estar.", "asignacionResumen"));
    return;
  }
  if (event.type !== "submit" || !form) return;
  event.preventDefault();
  const field = (name) => form.elements.namedItem(name);
  const id = form.dataset.asignacion === "nueva" ? undefined : form.dataset.asignacion;
  const amountText = field("amount").value.trim();
  const result = engine.upsertPerson(loadPersonalAllowances(), { id, name: field("name").value, amount: amountText ? parseAmountField(amountText) : null, from: field("from").value, to: field("to").value });
  const errorBox = form.querySelector(".asignacion-error");
  ["name", "amount", "from", "to"].forEach((name) => {
    if (result.errors[name]) field(name).setAttribute("aria-invalid", "true");
    else field(name).removeAttribute("aria-invalid");
  });
  if (!result.person) {
    errorBox.textContent = Object.values(result.errors).join(" ");
    field(["name", "amount", "from", "to"].find((name) => result.errors[name]) || "name").focus();
    return;
  }
  errorBox.textContent = "";
  const { person } = result;
  const fromLabel = personalAllowanceMonths().find((month) => month.key === person.from)?.label || person.from;
  savePersonalAllowances(result.store, `Guardado: Asignación personal · ${person.name}, ${money(person.amount, true)} al mes desde ${fromLabel}. El gasto variable estimado baja lo mismo.`, "asignacionResumen");
}
