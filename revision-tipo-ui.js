// WP-20 (docs/WP20_DISENO.md): la tarjeta «Revisión del tipo variable de la hipoteca» de Deuda › Contratos. El cálculo vive en
// canonical-rate-review.js (puro); el valor del Euribor sale de la tarjeta de índices (indices-ui.js). Aquí solo se leen los contratos de
// hipoteca ya declarados, se guardan los datos de la revisión (almacén `rate-review`), se pinta y se emite el aviso de la bandeja de Hoy.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, storageGet, escapeHtml, debtContractSourceRows…).
// Sin llamadas al DOM ni escuchas al cargarse: app.js llama a `renderRevisionTipo` al pintar Deuda › Contratos, a `rateReviewInboxItems` al
// armar la bandeja de Hoy y a `attachRevisionTipo` una vez en init.

const REVISION_STORE = "rate-review";
const REVISION_RULE_LABEL = { monthlyAverage: "meses antes (media mensual)", dayValue: "días antes (valor de un día)" };

function revisionLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(REVISION_STORE), "{}")) || {}; } catch { saved = {}; }
  return { byContract: saved.byContract && typeof saved.byContract === "object" ? saved.byContract : {} };
}

function revisionSave(store) {
  storageSet(storageKey(REVISION_STORE), JSON.stringify(store));
}

// Las hipotecas activas ya declaradas en Deuda › Contratos, con lo que la revisión necesita de cada una.
function revisionMortgages(today) {
  const rows = typeof debtContractSourceRows === "function" ? debtContractSourceRows() : [];
  const nowMonth = today.slice(0, 7);
  return rows
    .filter((row) => /hipoteca/i.test(String(row.type || "")) && row.paymentStatus !== "settled" && row.paymentStatus !== "suspended" && Number(row.currentPrincipal) > 0)
    .map((row) => {
      const byMaturity = row.maturityMonth ? (Number(row.maturityMonth.slice(0, 4)) - Number(nowMonth.slice(0, 4))) * 12 + (Number(row.maturityMonth.slice(5, 7)) - Number(nowMonth.slice(5, 7))) : 0;
      const remainingMonths = Number(row.remainingInstallments) > 0 ? Number(row.remainingInstallments) : Math.max(0, byMaturity);
      return { id: String(row.id), label: `${row.entity}${row.number ? ` · ${row.number}` : ""}`, principal: Number(row.currentPrincipal), payment: Number(row.currentPayment) || 0, remainingMonths };
    });
}

function revisionIndexInput(today) {
  const indices = globalThis.FinanceCanonicalRateIndices;
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey("rate-indices"), "{}")) || {}; } catch { saved = {}; }
  const status = indices.status(indices.normalizeStore(saved), "euribor12m", today);
  return status.point ? { value: status.point.value, date: status.point.date, state: status.state, ageDays: status.ageDays } : null;
}

function revisionEvaluate(engine, mortgage, settings, today) {
  return engine.evaluate({
    today,
    contract: { principal: mortgage.principal, remainingMonths: mortgage.remainingMonths, payment: mortgage.payment },
    settings,
    index: revisionIndexInput(today),
  });
}

function revisionEuros(value) {
  return money(value, true);
}

function revisionResultHtml(engine, result) {
  if (result.status !== "ok") return `<p class="e19-kpi-note">Para calcular la revisión falta: ${escapeHtml(result.missing.join(", "))}.</p>`;
  const pct = (value) => `${String(value).replace(".", ",")} %`;
  const notice = result.notices.map((n) => `${n.days} días antes (${engine.longDate(n.date)}): ${n.active ? "<strong>aviso activo</strong>" : "aún no"}`).join(" · ");
  const delta = result.deltaMonthly === null ? "" : ` Frente a la cuota actual (${revisionEuros(result.currentPayment)}): ${result.deltaMonthly >= 0 ? "+" : "−"}${revisionEuros(Math.abs(result.deltaMonthly))} al mes (${result.deltaYearly >= 0 ? "+" : "−"}${revisionEuros(Math.abs(result.deltaYearly))} al año).`;
  const bonus = result.withoutBonus ? `<p class="e19-kpi-note">Si pierdes la bonificación (+${String(result.withoutBonus.points).replace(".", ",")} pt): tipo ${pct(result.withoutBonus.rate)} y cuota ${revisionEuros(result.withoutBonus.central)}.</p>` : "";
  const warnings = result.warnings.map((text) => `<p class="e19-kpi-note negative">${escapeHtml(text)}</p>`).join("");
  return `<div class="rev-resultado">
      <p class="rev-titular"><strong>Próxima revisión: ${escapeHtml(engine.longDate(result.nextReview))}</strong> — dentro de ${result.daysToReview} día${result.daysToReview === 1 ? "" : "s"}.</p>
      <p class="e19-kpi-note">Se leerá <strong>${escapeHtml(result.reading.label)}</strong>. Con el Euribor que has tecleado (${pct(result.indexValue)}, del ${escapeHtml(engine.shortDate(result.indexDate))}) más tu diferencial (${pct(result.spread)}), el tipo nuevo sería ${pct(result.centralRate)}.</p>
      <p class="rev-cuota">Cuota estimada: <strong>de ${revisionEuros(result.payment.low)} a ${revisionEuros(result.payment.high)}</strong> al mes (tipo ${pct(result.payment.lowRate)} a ${pct(result.payment.highRate)}; central ${revisionEuros(result.payment.central)}).${delta}</p>
      ${bonus}
      <p class="e19-kpi-note">Avisos — ${notice}.</p>
      ${warnings}
      <p class="e19-kpi-note">Es una estimación, no un pronóstico: usa el último Euribor tecleado y lo mueve ±${result.payment.bandPoints} punto como rango. Capital proyectado a la revisión: ${revisionEuros(result.principalAtReview)} en ${result.remainingAtReview} plazos${result.projected ? "" : " (el de hoy: sin proyectar)"}. No ejecuta nada.</p>
    </div>`;
}

function revisionExampleHtml(engine, today) {
  const principal = 120000;
  const months = 240;
  const currentRate = 3.1;
  const result = engine.evaluate({
    today,
    contract: { principal, remainingMonths: months, payment: engine.payment(principal, currentRate, months) },
    settings: { spread: 0.99, bonusPoints: 0.3, nextReview: engine.addDays(today, 150), periodMonths: 12, rule: "monthlyAverage", ruleLag: 1, currentRate },
    index: { value: 2.35, date: today, state: "fresh", ageDays: 0 },
  });
  return `<p class="rev-ejemplo"><strong>EJEMPLO · cifras inventadas, no son las tuyas:</strong> 120.000 € pendientes, 240 plazos, tipo actual 3,10 %, Euribor 2,35 % y diferencial 0,99 %.</p>${revisionResultHtml(engine, result)}`;
}

// Los campos se enseñan como se teclean en España: coma decimal.
function revisionNum(value) {
  return value === null || value === undefined || value === "" ? "" : String(value).replace(".", ",");
}

function revisionFieldValues(settings) {
  return {
    revisionTipoSpread: revisionNum(settings.spread),
    revisionTipoBonus: revisionNum(settings.bonusPoints),
    revisionTipoRate: revisionNum(settings.currentRate),
    revisionTipoPeriod: String(settings.periodMonths || 12),
    revisionTipoDate: settings.nextReview || "",
    revisionTipoRule: settings.rule || "monthlyAverage",
    revisionTipoLag: settings.ruleLag ?? (settings.rule === "dayValue" ? 15 : 1),
  };
}

function revisionSyncRuleLabel() {
  const rule = qs("revisionTipoRule")?.value || "monthlyAverage";
  const label = qs("revisionTipoLagLabel");
  if (label) label.textContent = `Cuántos ${REVISION_RULE_LABEL[rule]}`;
}

function renderRevisionTipo(engine) {
  const card = qs("revisionTipoCard");
  if (!card || !engine) return;
  attachRevisionTipo(document); // idempotente: el formulario se pinta antes de que init() termine y un clic temprano no puede perderse
  try {
    const today = isoLocalDate(new Date());
    const mortgages = revisionMortgages(today);
    const example = qs("revisionTipoEjemplo");
    if (example) example.innerHTML = `<summary>Ver un ejemplo con cifras inventadas</summary>${revisionExampleHtml(engine, today)}`;
    const form = qs("revisionTipoForm");
    const result = qs("revisionTipoResultado");
    const info = qs("revisionTipoContratoInfo");
    const select = qs("revisionTipoContrato");
    if (!mortgages.length) {
      if (form) form.hidden = true;
      if (result) result.innerHTML = "";
      if (info) info.textContent = "No hay ninguna hipoteca activa declarada en la tabla de arriba. Da de alta el contrato (tipo «Hipoteca», con capital pendiente y plazos restantes o vencimiento) y vuelve aquí.";
      return;
    }
    if (form) form.hidden = false;
    const store = revisionLoad();
    const wanted = select && select.value && mortgages.some((m) => m.id === select.value) ? select.value : mortgages[0].id;
    if (select) {
      const html = mortgages.map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`).join("");
      if (select.__revisionHtml !== html) { select.innerHTML = html; select.__revisionHtml = html; }
      select.value = wanted;
      select.closest("label")?.toggleAttribute("hidden", mortgages.length < 2);
    }
    const mortgage = mortgages.find((m) => m.id === wanted);
    const settings = store.byContract[wanted] || {};
    if (info) info.textContent = `${mortgage.label}: capital pendiente ${revisionEuros(mortgage.principal)}, ${mortgage.remainingMonths || "¿?"} plazos restantes, cuota ${mortgage.payment ? revisionEuros(mortgage.payment) : "sin declarar"}. Se editan en la tabla de arriba.`;
    // Los campos se rellenan una vez por contrato y datos guardados: un repintado ajeno no pisa lo que se está escribiendo.
    const signature = `${wanted}|${JSON.stringify(settings)}`;
    if (card.__revisionSignature !== signature) {
      Object.entries(revisionFieldValues(settings)).forEach(([id, value]) => { const field = qs(id); if (field) field.value = String(value); });
      card.__revisionSignature = signature;
    }
    revisionSyncRuleLabel();
    if (result) {
      result.innerHTML = Object.keys(settings).length
        ? revisionResultHtml(engine, revisionEvaluate(engine, mortgage, settings, today))
        : `<p class="e19-kpi-note">Rellena los datos de la carta de revisión de tu banco y pulsa «Guardar».</p>`;
    }
  } catch (error) {
    console.error(`renderRevisionTipo: ${error.message}`);
  }
}

function revisionNote(message) {
  const note = qs("revisionTipoNota");
  if (note) note.textContent = message;
  announceStatus(message);
}

function revisionReadForm(today) {
  const indices = globalThis.FinanceCanonicalRateIndices;
  const rule = qs("revisionTipoRule").value === "dayValue" ? "dayValue" : "monthlyAverage";
  const spread = indices.parsePercent(qs("revisionTipoSpread").value);
  const bonusText = qs("revisionTipoBonus").value.trim();
  const rateText = qs("revisionTipoRate").value.trim();
  const bonus = bonusText === "" ? 0 : indices.parsePercent(bonusText);
  const parsedRate = rateText === "" ? null : indices.parsePercent(rateText);
  const currentRate = parsedRate;
  const lag = Number(String(qs("revisionTipoLag").value).replace(",", "."));
  const date = qs("revisionTipoDate").value;
  if (spread === null || spread < -1 || spread > 8) return { error: "El diferencial va en %, por ejemplo 0,99 (entre −1 y 8).", field: "revisionTipoSpread" };
  if (bonus === null || bonus < 0 || bonus > 3) return { error: "La bonificación va en puntos, de 0 a 3 (por ejemplo 0,30).", field: "revisionTipoBonus" };
  if ((rateText !== "" && parsedRate === null) || (currentRate !== null && (currentRate < 0 || currentRate > 15))) return { error: "El tipo aplicado actualmente va en %, por ejemplo 3,10.", field: "revisionTipoRate" };
  if (!indices.isIsoDate(date)) return { error: "Indica la fecha de la próxima revisión.", field: "revisionTipoDate" };
  if (Math.abs(indices.daysBetween(today, date)) > 366 * 5) return { error: "La fecha de revisión queda a más de cinco años: revísala.", field: "revisionTipoDate" };
  const lagOk = Number.isInteger(lag) && (rule === "dayValue" ? lag >= 0 && lag <= 60 : lag >= 1 && lag <= 3);
  if (!lagOk) return { error: rule === "dayValue" ? "Los días antes van de 0 a 60." : "Los meses antes van de 1 a 3.", field: "revisionTipoLag" };
  return { settings: { spread, bonusPoints: bonus, currentRate, nextReview: date, periodMonths: Number(qs("revisionTipoPeriod").value) === 6 ? 6 : 12, rule, ruleLag: lag } };
}

function revisionSaveFromForm() {
  const engine = globalThis.FinanceCanonicalRateReview;
  const today = isoLocalDate(new Date());
  const read = revisionReadForm(today);
  if (read.error) {
    const field = qs(read.field);
    field?.setAttribute("aria-invalid", "true");
    revisionNote(read.error);
    field?.focus();
    return;
  }
  document.querySelectorAll("#revisionTipoForm [aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
  const id = qs("revisionTipoContrato")?.value || revisionMortgages(today)[0]?.id;
  if (!id) return;
  const store = revisionLoad();
  store.byContract[id] = read.settings;
  revisionSave(store);
  revisionNote("Datos de la revisión guardados.");
  renderRevisionTipo(engine);
}

// Aviso en la bandeja de Hoy: solo dentro de los 60 días previos a la revisión (y a los 30, con otro texto). Antes no existe.
function rateReviewInboxItems(engine) {
  if (!engine) return [];
  try {
    const today = isoLocalDate(new Date());
    const store = revisionLoad();
    const items = [];
    revisionMortgages(today).forEach((mortgage) => {
      const settings = store.byContract[mortgage.id];
      if (!settings) return;
      const result = revisionEvaluate(engine, mortgage, settings, today);
      if (result.status !== "ok") return;
      const active = result.notices.filter((notice) => notice.active).map((notice) => notice.days).sort((a, b) => a - b)[0];
      if (!active) return;
      items.push({
        id: `decision-inbox-rate-review-${mortgage.id}`,
        source: "Hipoteca variable",
        tone: "warn",
        title: `Revisión del tipo en ${result.daysToReview} día${result.daysToReview === 1 ? "" : "s"}`,
        text: `Cuota estimada de ${revisionEuros(result.payment.low)} a ${revisionEuros(result.payment.high)} (hoy ${result.currentPayment ? revisionEuros(result.currentPayment) : "sin declarar"}). Se leerá ${result.reading.label}.`,
        target: "deuda-contratos",
      });
    });
    return items;
  } catch (error) {
    console.error(`rateReviewInboxItems: ${error.message}`);
    return [];
  }
}

// Para los recordatorios del calendario (recordatorios-ui.js): la fecha de revisión de cada hipoteca con sus datos rellenados y la cuota estimada
// de A a B, que solo va en el detalle del evento (el título no lleva importes).
function rateReviewCalendarItems() {
  const engine = globalThis.FinanceCanonicalRateReview;
  if (!engine) return [];
  try {
    const today = isoLocalDate(new Date());
    const store = revisionLoad();
    return revisionMortgages(today).flatMap((mortgage) => {
      const settings = store.byContract[mortgage.id];
      if (!settings) return [];
      const result = revisionEvaluate(engine, mortgage, settings, today);
      return result.status === "ok" ? [{ date: result.nextReview, low: result.payment.low, high: result.payment.high }] : [];
    });
  } catch (error) {
    console.error(`rateReviewCalendarItems: ${error.message}`);
    return [];
  }
}

// Una sola vez, por delegación.
function attachRevisionTipo(doc) {
  if (!doc || doc.__revisionTipoAttached) return false;
  doc.__revisionTipoAttached = true;
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("#revisionTipoGuardar")) revisionSaveFromForm();
  });
  doc.addEventListener("change", (event) => {
    if (event.target?.id === "revisionTipoRule") revisionSyncRuleLabel();
    if (event.target?.id === "revisionTipoContrato") renderRevisionTipo(globalThis.FinanceCanonicalRateReview);
  });
  // La tabla de contratos se repinta al dar de alta, editar o borrar uno: la tarjeta lee de ahí (capital, cuota, plazos), así que la sigue.
  // Solo cambia lo que cuelga de la tabla; esta tarjeta no la toca, de modo que no hay bucle.
  const table = doc.getElementById?.("deudaContratosTable");
  if (table && typeof MutationObserver === "function") {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; renderRevisionTipo(globalThis.FinanceCanonicalRateReview); });
    }).observe(table, { childList: true, subtree: true });
  }
  return true;
}
