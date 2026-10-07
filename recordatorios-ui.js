// WP-32 (CAP-09 + ND-10, docs/WP32_DISENO.md): la tarjeta «Recordatorios en el calendario del móvil» de Ajustes. El cálculo vive en
// canonical-reminders.js (puro); aquí solo se leen los movimientos fechados del plan, se guardan las preferencias de este dispositivo, se pinta y se
// descarga el .ics.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, state, storageGet…). Sin llamadas al DOM ni escuchas al
// cargarse: app.js llama a `renderRecordatorios` al pintar Ajustes y a `attachRecordatorios` una vez en init.

const RECORDATORIOS_STORE = "reminders-settings";
const RECORDATORIOS_KIND_LABELS = { income: "cobros", bigCharge: "cargos grandes", monthClose: "cierres de mes", fiscal: "avisos fiscales", rateReview: "avisos de la hipoteca" };

function recordatoriosSettings() {
  const engine = globalThis.FinanceCanonicalReminders;
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(RECORDATORIOS_STORE), "{}")) || {}; } catch { saved = {}; }
  return {
    kinds: { ...engine.DEFAULTS.kinds, ...(saved.kinds || {}) },
    bigChargeMin: Number.isFinite(Number(saved.bigChargeMin)) && Number(saved.bigChargeMin) >= 0 ? Number(saved.bigChargeMin) : engine.DEFAULTS.bigChargeMin,
    lastGeneratedAt: typeof saved.lastGeneratedAt === "string" ? saved.lastGeneratedAt : "",
    coveredUntil: typeof saved.coveredUntil === "string" ? saved.coveredUntil : "",
  };
}

function saveRecordatoriosSettings(next) {
  storageSet(storageKey(RECORDATORIOS_STORE), JSON.stringify(next));
}

// Los movimientos fechados del plan: los mismos que reparte el motor diario, con la confianza de su fecha (observada, por regla o estimada).
function recordatoriosInput(settings, today) {
  const rows = canonicalDailyEngineRuns?.active?.rows;
  const events = Array.isArray(rows) ? rows.flatMap((row) => row.events || []) : [];
  return {
    today,
    incomes: events.filter((event) => event.kind === "income").map((event) => ({ date: event.date, label: event.label, amount: event.amount, confidence: event.confidence })),
    outflows: events.filter((event) => event.kind === "outflow").map((event) => ({ date: event.date, label: event.label, amount: event.amount, confidence: event.confidence })),
    // WP-20 (revision-tipo-ui.js): las fechas de revisión del tipo variable de las hipotecas con sus datos rellenados.
    reviews: globalThis.rateReviewCalendarItems?.() || [],
    options: { kinds: settings.kinds, bigChargeMin: settings.bigChargeMin },
  };
}

function recordatoriosPlan() {
  const engine = globalThis.FinanceCanonicalReminders;
  const settings = recordatoriosSettings();
  const today = isoLocalDate(new Date());
  return { engine, settings, today, result: engine.build(recordatoriosInput(settings, today)) };
}

function recordatoriosSummaryHtml({ engine, settings, today, result }) {
  if (result.status !== "ok") return `<p class="e19-kpi-note">No se pueden calcular: falta ${escapeHtml(result.missing.join(" y "))}.</p>`;
  const stale = engine.staleness({ lastGeneratedAt: settings.lastGeneratedAt, today, coveredUntil: settings.coveredUntil });
  const counts = engine.KINDS.filter((kind) => result.counts[kind] > 0).map((kind) => `${result.counts[kind]} ${RECORDATORIOS_KIND_LABELS[kind]}`).join(" · ");
  const skipped = [
    result.skipped.uncertainIncomes ? `${result.skipped.uncertainIncomes} cobro(s)` : "",
    result.skipped.uncertainCharges ? `${result.skipped.uncertainCharges} cargo(s) grande(s)` : "",
  ].filter(Boolean).join(" y ");
  const next = result.events.slice(0, 5).map((event) => `<li><strong>${escapeHtml(engine.longDate(event.date))}</strong> · ${escapeHtml(event.title)}</li>`).join("");
  return `<p class="rec-resumen"><strong>${result.events.length} recordatorio(s)</strong> hasta el ${escapeHtml(engine.longDate(result.horizonEnd))}${counts ? ` — ${escapeHtml(counts)}` : ""}.</p>
    ${next ? `<ol class="rec-lista" aria-label="Próximos recordatorios">${next}</ol>` : `<p class="e19-kpi-note">No hay ningún recordatorio con estas opciones.</p>`}
    ${skipped ? `<p class="e19-kpi-note">Sin aviso: ${escapeHtml(skipped)} con fecha <strong>estimada</strong>. El plan no sabe qué día caen y un aviso en un día cualquiera es ruido. Declara el día de cargo en Plan › Partidas y entrarán.</p>` : ""}
    <p class="e19-kpi-note ${stale.stale ? "negative" : ""}" role="status">${escapeHtml(stale.label)}</p>`;
}

function renderRecordatorios(engine) {
  const box = qs("recordatoriosResumen");
  if (!box || !engine || typeof canonicalDailyEngineRuns === "undefined") return;
  try {
    const plan = recordatoriosPlan();
    const { settings } = plan;
    document.querySelectorAll("[data-recordatorios-kind]").forEach((input) => { input.checked = settings.kinds[input.dataset.recordatoriosKind] !== false; });
    const min = qs("recordatoriosMin");
    if (min && document.activeElement !== min) min.value = String(settings.bigChargeMin);
    box.innerHTML = recordatoriosSummaryHtml(plan);
  } catch (error) {
    console.error(`renderRecordatorios: ${error.message}`);
  }
}

function downloadRecordatorios() {
  const plan = recordatoriosPlan();
  const { engine, settings, today, result } = plan;
  const note = qs("recordatoriosNota");
  if (result.status !== "ok" || !result.events.length) {
    if (note) note.textContent = "No hay recordatorios que descargar con estas opciones.";
    announceStatus("No hay recordatorios que descargar con estas opciones.");
    return;
  }
  const blob = new Blob([engine.toIcs(result.events, { now: new Date() })], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "recordatorios-finanzas-casa.ics";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 0);
  saveRecordatoriosSettings({ ...settings, lastGeneratedAt: today, coveredUntil: result.horizonEnd });
  const message = `Recordatorios descargados: ${result.events.length}. Ábrelo desde el móvil para añadirlos al calendario.`;
  if (note) note.textContent = message;
  announceStatus(message);
  renderRecordatorios(engine);
}

// Una sola vez, por delegación: los cambios de opciones y el botón de descarga.
function attachRecordatorios(doc) {
  if (!doc || doc.__recordatoriosAttached) return false;
  doc.__recordatoriosAttached = true;
  doc.addEventListener("change", (event) => {
    const kind = event.target?.dataset?.recordatoriosKind;
    if (kind) {
      const settings = recordatoriosSettings();
      saveRecordatoriosSettings({ ...settings, kinds: { ...settings.kinds, [kind]: event.target.checked } });
      renderRecordatorios(globalThis.FinanceCanonicalReminders);
    } else if (event.target?.id === "recordatoriosMin") {
      const value = Number(String(event.target.value).replace(",", "."));
      const settings = recordatoriosSettings();
      saveRecordatoriosSettings({ ...settings, bigChargeMin: Number.isFinite(value) && value >= 0 ? value : settings.bigChargeMin });
      renderRecordatorios(globalThis.FinanceCanonicalReminders);
    }
  });
  doc.addEventListener("click", (event) => {
    if (event.target?.closest?.("#recordatoriosDescargar")) downloadRecordatorios();
  });
  return true;
}
