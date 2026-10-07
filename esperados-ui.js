// WP-14 (cobros esperados) + WP-27 (cargos que no llegaron), docs/WP14_WP27_DISENO.md: las preguntas de la bandeja de Hoy. El detector vive en
// canonical-expected-movements.js (puro); aquí se reúnen las partidas esperadas, se pintan las preguntas con sus botones y se ejecuta la respuesta
// con deshacer (el real de una partida, anular una serie desde un mes, o callar unos días).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, state, storageGet, planningSectionsForMonth…). Sin
// llamadas al DOM ni escuchas al cargarse: app.js llama a `expectedMovementInboxItems` desde la bandeja y a `attachEsperados` una vez en init.

const EXPECTED_ANSWERS_STORE = "expected-answers"; // en la copia (BACKUP_LOCAL_STORES): lo que se respondió y lo que se calló
let expectedAmountEditing = ""; // id de la pregunta cuyo importe se está escribiendo («Sí, otro importe»)

function loadExpectedAnswers() {
  return cachedLocalStore(EXPECTED_ANSWERS_STORE, (raw) => globalThis.FinanceCanonicalExpectedMovements.normalizeAnswers(raw), { snoozes: {}, moved: {} });
}

function saveExpectedAnswers(answers) {
  storageSet(storageKey(EXPECTED_ANSWERS_STORE), JSON.stringify(answers));
}

// Hasta qué día llegan los movimientos importados: sin extracto al día, «no aparece» no quiere decir «no ha llegado».
function expectedLedgerCoveredUntil() {
  const dates = (baseData?.transactions || []).map((transaction) => String(transaction.date || "").slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
  return dates.length ? dates.reduce((latest, date) => (date > latest ? date : latest)) : null;
}

function expectedPreviousMonthKey(monthKeyValue, back) {
  const [year, month] = String(monthKeyValue).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - back, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// PR-2: lo aplazado con «Aún no» / «Llegará tarde» cuenta en la previsión en el día en que se vuelve a preguntar, solo mientras dure el aplazamiento
// (el motor de fechas lo consulta fila a fila; sin aplazamientos no cuesta nada).
function expectedDeferralForRow(row, month) {
  const { snoozes } = loadExpectedAnswers();
  if (!Object.keys(snoozes).length) return null;
  const snooze = snoozes[`${seriesKeyForRow(row)}|${month.key}`];
  return snooze && isoLocalDate(new Date()) < snooze.until ? { date: snooze.until } : null;
}

// Las partidas que se esperan: ingresos y gastos del mes anterior y del actual, con la fecha que el plan les da y lo bien que la sabe.
function expectedMovementExpectations(today) {
  const currentKey = today.slice(0, 7);
  const expectations = [];
  [expectedPreviousMonthKey(currentKey, 1), currentKey].forEach((key) => {
    const month = monthByKey(key);
    if (!month) return;
    ["income", "expense"].forEach((kind) => {
      planningSectionsForMonth(kind, month).forEach((section) => {
        section.rows.forEach((row) => {
          // El gasto variable y la asignación personal llegan repartidos por el mes: no hay un recibo que esperar.
          if (kind === "expense" && (section.name === VARIABLE_OPERATIONAL_SECTION || isVariableOperationalRow(row))) return;
          const info = actualAwareInfo(row, month);
          const planned = Number(info.planned || 0);
          if (!(planned > 0) && !info.hasActual) return;
          const original = { ignoreDeferral: true }; // se pregunta por la fecha de siempre, no por la movida
          const timing = kind === "income" ? timingEngine().incomeTimingForRow(row, month, planned, original) : timingEngine().expenseTimingForRow(row, month, planned, original);
          const fromMovements = kind === "income" ? timingEngine().incomeTimingFromMovements(row, month, planned) : timingEngine().expenseTimingFromMovements(row, month, planned);
          const history = kind === "expense"
            ? [1, 2, 3, 4, 5, 6].map((back) => timingEngine().expenseTimingFromMovements(row, { key: expectedPreviousMonthKey(key, back) }, planned)).filter(Boolean).map((found) => ({ date: found.date, amount: planned }))
            : [];
          expectations.push({
            id: `${seriesKeyForRow(row)}|${key}`, kind, seriesKey: seriesKeyForRow(row), label: displayLabelForRow(row), month: key,
            expectedDate: timing.date, certain: timing.confidence === "rule" || timing.confidence === "declared",
            plannedAmount: planned, arrived: Boolean(info.hasActual || fromMovements), cancelled: info.status === "cancelled", history,
          });
        });
      });
    });
  });
  return expectations;
}

function expectedMovementsResult() {
  const engine = globalThis.FinanceCanonicalExpectedMovements;
  if (!engine || typeof baseData === "undefined" || !baseData) return null;
  const today = isoLocalDate(new Date());
  return engine.detect({ today, ledgerCoveredUntil: expectedLedgerCoveredUntil(), answers: loadExpectedAnswers(), expectations: expectedMovementExpectations(today) });
}

function expectedItemHtml(item) {
  const buttons = item.responses.map((response) => `<button type="button" class="e19-btn e19-btn-secondary" data-home-expected="${escapeHtml(item.id)}" data-expected-response="${escapeHtml(response.key)}">${escapeHtml(response.label)}</button>`).join("");
  if (expectedAmountEditing === item.id) {
    return `<span class="cuadro-mandos-controls"><label>Importe que llegó (€) <input type="text" inputmode="decimal" autocomplete="off" data-expected-amount="${escapeHtml(item.id)}" value="${escapeHtml(String(item.plannedAmount).replace(".", ","))}" /></label>
      <button type="button" class="e19-btn e19-btn-primary" data-home-expected="${escapeHtml(item.id)}" data-expected-response="yesOtherSave">Guardar</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-home-expected="${escapeHtml(item.id)}" data-expected-response="yesOtherCancel">Cancelar</button></span>`;
  }
  return `<span class="cuadro-mandos-controls" role="group" aria-label="Responder: ${escapeHtml(item.label)}">${buttons}</span>`;
}

function expectedItemText(item) {
  const dateText = shortDate(item.expectedDate);
  const late = `${item.daysLate} día${item.daysLate === 1 ? "" : "s"} de retraso`;
  if (item.kind === "income") {
    return `Se esperaba el ${dateText} (${late}) · previsto ${money(item.plannedAmount, true)}.${item.snoozeCount ? ` Llevas ${item.snoozeCount} aplazamiento(s).` : ""}`;
  }
  const history = item.history.length ? ` Últimos cargos: ${item.history.map((point) => shortDate(point.date)).join(", ")}.` : "";
  return `Solía cargarse hacia el ${dateText} (${late}) · ${money(item.plannedAmount, true)}.${history}${item.snoozeCount ? ` Llevas ${item.snoozeCount} aplazamiento(s).` : ""} Si es una póliza o una domiciliación, mira que no se haya quedado sin pagar.`;
}

// Lo que se suma a la bandeja única de Hoy (`decisionInboxItems`).
function expectedMovementInboxItems() {
  try {
    const result = expectedMovementsResult();
    if (!result || result.status !== "ok") return [];
    const items = result.items.map((item) => ({
      id: `decision-inbox-expected-${item.id}`, source: item.kind === "income" ? "Cobro esperado" : "Cargo esperado", tone: "warn",
      title: item.kind === "income" ? `¿Ha llegado «${item.label}»?` : `«${item.label}» no ha llegado`,
      text: expectedItemText(item), target: "registrar", html: expectedItemHtml(item),
    }));
    if (result.overflow > 0) items.push({ id: "decision-inbox-expected-more", source: "Cobros y cargos", tone: "warn", title: `${result.overflow} más por responder`, text: "Responde estas y aparecerán las siguientes.", target: "registrar" });
    return items;
  } catch (error) {
    console.error(`expectedMovementInboxItems: ${error.message}`);
    return [];
  }
}

// ---- ejecutar la respuesta ----
function expectedApplySetActual(effect) {
  const row = rowForSeriesKey(effect.seriesKey);
  const month = monthByKey(effect.month);
  if (!row || !month) return null;
  const actuals = actualsForKind(effect.kind);
  const actualKey = actualKeyForRow(row, month);
  const overrideKey = overrideKeyForRow(row, month);
  const before = { actual: actuals[actualKey], override: seriesOverrides[overrideKey] ? { ...seriesOverrides[overrideKey] } : undefined };
  actuals[actualKey] = effect.amount;
  const next = { ...(seriesOverrides[overrideKey] || {}) };
  delete next.deleted; delete next.actual; delete next.actualStatus;
  if (Object.keys(next).length) seriesOverrides[overrideKey] = next; else delete seriesOverrides[overrideKey];
  return { before, actuals, actualKey, overrideKey };
}

function expectedPersistActuals(kind) {
  storageSet(storageKey(kind === "income" ? "incomeActuals" : "expenseActuals"), JSON.stringify(actualsForKind(kind)));
  saveSeriesOverrides();
}

function expectedApplyDeleteFrom(effect) {
  const row = rowForSeriesKey(effect.seriesKey);
  if (!row) return null;
  const months = selectableMonths().filter((month) => month.key >= effect.fromMonth);
  const before = months.map((month) => [overrideKeyForRow(row, month), seriesOverrides[overrideKeyForRow(row, month)] ? { ...seriesOverrides[overrideKeyForRow(row, month)] } : undefined]);
  months.forEach((month) => { seriesOverrides[overrideKeyForRow(row, month)] = { deleted: true }; });
  return { before, count: months.length };
}

function answerExpectedMovement(itemId, response, typedAmount = null) {
  const engine = globalThis.FinanceCanonicalExpectedMovements;
  const result = expectedMovementsResult();
  const item = result?.items.find((candidate) => candidate.id === itemId);
  if (!engine || !item) return;
  const today = isoLocalDate(new Date());
  const resolved = engine.resolve({ item, response, today, amount: typedAmount });
  if (!resolved.ok) { announceStatus(resolved.reason === "falta el importe" ? "Escribe el importe que llegó." : "No se pudo registrar la respuesta."); return; }
  const previousAnswers = loadExpectedAnswers();
  let undo = () => {};
  let message = "";
  if (resolved.effect.type === "setActual") {
    const applied = expectedApplySetActual(resolved.effect);
    if (!applied) { announceStatus("No se encontró la partida; revísala en Registrar el mes."); return; }
    expectedPersistActuals(resolved.effect.kind);
    message = `«${item.label}» registrado: ${money(resolved.effect.amount, true)}.`;
    undo = () => {
      if (applied.before.actual === undefined) delete applied.actuals[applied.actualKey]; else applied.actuals[applied.actualKey] = applied.before.actual;
      if (applied.before.override) seriesOverrides[applied.overrideKey] = applied.before.override; else delete seriesOverrides[applied.overrideKey];
      expectedPersistActuals(resolved.effect.kind);
    };
  } else if (resolved.effect.type === "deleteFrom") {
    const applied = expectedApplyDeleteFrom(resolved.effect);
    if (!applied) { announceStatus("No se encontró la partida; revísala en Registrar el mes."); return; }
    saveSeriesOverrides();
    message = `«${item.label}» anulado desde ${ledgerMonthLabel(resolved.effect.fromMonth)}: ${applied.count} mes(es) menos en la previsión.`;
    undo = () => { applied.before.forEach(([key, value]) => { if (value) seriesOverrides[key] = value; else delete seriesOverrides[key]; }); saveSeriesOverrides(); };
  } else if (resolved.patch?.type === "moved") {
    message = `«${item.label}»: no se volverá a preguntar por ese recibo. La previsión sigue contando la salida.`;
  } else {
    message = `Vale: te lo vuelvo a preguntar el ${shortDate(resolved.patch.until)}. Hasta entonces la previsión lo cuenta ese día.`;
  }
  if (resolved.patch) saveExpectedAnswers(engine.prune(engine.applyPatch(previousAnswers, resolved.patch), today));
  expectedAmountEditing = "";
  if (resolved.effect.type !== "none" || resolved.patch?.type === "snooze") refreshAllSectionsAfterDataChange(); // las fechas de la previsión cambian
  if (resolved.effect.type === "none") renderDecisionInboxCard(); // la tarjeta no repinta por las respuestas: se hace aquí
  showUndoToast(message, () => {
    undo();
    saveExpectedAnswers(previousAnswers);
    refreshAllSectionsAfterDataChange();
    renderDecisionInboxCard();
  });
  announceStatus(message);
}

// Una sola vez, por delegación: los botones de la bandeja.
function attachEsperados(doc) {
  if (!doc || doc.__esperadosAttached) return false;
  doc.__esperadosAttached = true;
  doc.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-home-expected]");
    if (!button) return;
    const id = button.dataset.homeExpected;
    const response = button.dataset.expectedResponse;
    if (response === "yesOther") { expectedAmountEditing = id; renderDecisionInboxCard(); document.querySelector(`[data-expected-amount="${CSS.escape(id)}"]`)?.focus(); return; }
    if (response === "yesOtherCancel") { expectedAmountEditing = ""; renderDecisionInboxCard(); return; }
    if (response === "yesOtherSave") { answerExpectedMovement(id, "yesOther", document.querySelector(`[data-expected-amount="${CSS.escape(id)}"]`)?.value ?? ""); return; }
    answerExpectedMovement(id, response);
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target?.dataset?.expectedAmount) { event.preventDefault(); answerExpectedMovement(event.target.dataset.expectedAmount, "yesOther", event.target.value); }
  });
  return true;
}
