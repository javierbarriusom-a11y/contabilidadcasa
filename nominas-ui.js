// WP-31 · PR-1 (docs/WP31_DISENO.md): la tarjeta «Nóminas y retenciones» de Herramientas avanzadas › Fiscal. El cálculo vive en
// canonical-payroll.js (puro); aquí solo se lee y se guarda el almacén `payslips`, se pinta y se atienden el formulario y el lector de texto.
// Guarda solo cifras (periodo, titular, pagador, bruto, líquido, retención, cotización): ni PDF, ni NIF, ni IBAN, ni el texto que se pegó.
// No ejecuta nada (A11-4): lo que el hogar apunta se suma; el estimador de Renta recibe la cifra solo cuando se pulsa «Usar».
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, storageGet, escapeHtml, isoLocalDate, announceStatus…).
// Sin llamadas al DOM ni escuchas al cargarse: app.js llama a `renderNominas` al pintar Herramientas › Fiscal, que engancha las escuchas.

const NOMINAS_STORE = "payslips"; // en la copia (BACKUP_LOCAL_STORES)
const NOMINAS_FIELD_LABEL = { period: "el mes", gross: "el bruto", net: "el líquido", withholdingPct: "el % de retención", withholdingAmount: "el importe de la retención", socialSecurity: "la cotización del trabajador" };
let nominasYear = null; // el año que se está mirando; null = el que toca según la fecha

function nominasLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(NOMINAS_STORE), "{}")) || {}; } catch { saved = {}; }
  return globalThis.FinanceCanonicalPayroll.normalizeStore(saved);
}

function nominasSave(store) {
  storageSet(storageKey(NOMINAS_STORE), JSON.stringify(store));
  queueRemoteSave();
}

// Entre enero y junio se declara el año anterior; el resto del año, el actual.
function nominasDefaultYear(today) {
  const year = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) <= 6 ? year - 1 : year;
}

function nominasEuros(value) {
  return money(value, true);
}

function nominasPeriodText(period) {
  return globalThis.FinanceCanonicalPayroll.monthLabel(period);
}

// Los meses que faltan, sin repetir el año: «marzo, mayo a diciembre de 2025».
function nominasMissingText(periods) {
  const labels = periods.map((period) => globalThis.FinanceCanonicalPayroll.monthLabel(period).split(" de ")[0]);
  const years = Array.from(new Set(periods.map((period) => period.slice(0, 4))));
  const runs = [];
  periods.forEach((period, index) => {
    const month = Number(period.slice(5, 7));
    const last = runs[runs.length - 1];
    if (last && last.year === period.slice(0, 4) && last.endMonth === month - 1) { last.endMonth = month; last.to = labels[index]; last.count += 1; }
    else runs.push({ year: period.slice(0, 4), endMonth: month, from: labels[index], to: labels[index], count: 1 });
  });
  const parts = runs.map((run) => (run.count >= 3 ? `${run.from} a ${run.to}` : run.count === 2 ? `${run.from} y ${run.to}` : run.from));
  return `${parts.join(", ")}${years.length === 1 ? ` de ${years[0]}` : ` (${years.join(" y ")})`}`;
}

function nominasSummaryHtml(engine, store, today) {
  if (!store.entries.length) return estadoHtml({ kind: "vacio", titulo: "Aún no hay nóminas apuntadas", texto: "Con la primera, la app suma lo que te retienen y te avisa si cambia el %.", accion: { label: "Apuntar la primera", id: "nominas-primera" } });
  const years = engine.yearsWithData(store);
  const year = years.includes(nominasYear) ? nominasYear : years.includes(nominasDefaultYear(today)) ? nominasDefaultYear(today) : years[0];
  const summary = engine.summarize(store, { year, today });
  const alerts = engine.changeAlerts(store).filter((alert) => Number(alert.to.period.slice(0, 4)) >= year);
  const yearSelect = `<label class="month-picker nom-anio"><span>Año</span><select id="nominasAnio" aria-label="Año de las nóminas">${years.map((y) => `<option value="${y}"${y === year ? " selected" : ""}>${y}</option>`).join("")}</select></label>`;
  const alertHtml = alerts.map((alert) => `<p class="e19-kpi-note nom-aviso" role="status"><strong>${escapeHtml(engine.alertText(alert))}</strong> Suele deberse a una regularización de la empresa o a un cambio de tu situación familiar; si no lo esperabas, pregunta en nóminas.</p>`).join("");
  const holders = summary.holders.map((holder) => {
    const missing = holder.missingMonths.length
      ? `<p class="e19-kpi-note nom-faltan"><strong>Faltan nóminas de:</strong> ${escapeHtml(nominasMissingText(holder.missingMonths))}. El acumulado queda corto hasta que las apuntes.</p>`
      : "";
    const derived = holder.derivedCount ? `<p class="e19-kpi-note">${holder.derivedCount} ${holder.derivedCount === 1 ? "retención está calculada" : "retenciones están calculadas"} desde el % (la nómina no traía el importe).</p>` : "";
    const effective = holder.effectivePct === null ? "" : ` (${String(holder.effectivePct).replace(".", ",")} % efectivo)`;
    return `<div class="nom-titular" data-nominas-titular="${escapeHtml(holder.holder)}">
        <h4 class="nom-titular-nombre">${escapeHtml(holder.holder)} · ${year}</h4>
        <p class="nom-cifra"><strong>${escapeHtml(nominasEuros(holder.withheld))}</strong> retenidos de ${escapeHtml(nominasEuros(holder.gross))} brutos${escapeHtml(effective)} en ${holder.entries} ${holder.entries === 1 ? "nómina" : "nóminas"}.</p>
        ${missing}${derived}
        <button type="button" class="e19-btn e19-btn-secondary" data-nominas-usar="${escapeHtml(holder.holder)}">Usar ${escapeHtml(nominasEuros(holder.withheld))} en el estimador de Renta</button>
      </div>`;
  }).join("");
  const rows = store.entries.filter((entry) => Number(entry.period.slice(0, 4)) === year).slice().reverse().slice(0, 36).map((entry) => `<li>${escapeHtml(entry.holder)} · ${escapeHtml(nominasPeriodText(entry.period))}${entry.payer ? ` · ${escapeHtml(entry.payer)}` : ""}${entry.kind === "extra" ? " · paga extra" : ""}: bruto ${escapeHtml(nominasEuros(entry.gross))}, retención ${escapeHtml(String(entry.withholdingPct).replace(".", ","))} % (${escapeHtml(nominasEuros(entry.withholdingAmount))})
      <button type="button" class="link-button" data-nominas-quitar="${escapeHtml(entry.id)}" aria-label="Quitar la nómina de ${escapeHtml(entry.holder)} de ${escapeHtml(nominasPeriodText(entry.period))}">Quitar</button></li>`).join("");
  return `${yearSelect}${alertHtml}${holders || '<p class="e19-kpi-note">No hay nóminas de este año.</p>'}${rows ? `<details class="nom-lista"><summary>Nóminas de ${year} (${summary.holders.reduce((sum, h) => sum + h.entries, 0)})</summary><ul>${rows}</ul></details>` : ""}`;
}

function renderNominas(engine) {
  const box = qs("nominasResumen");
  if (!box || !engine) return;
  attachNominas(document); // idempotente: la pantalla se pinta antes de que init() termine y un clic temprano no puede perderse
  try {
    const store = nominasLoad();
    const today = isoLocalDate(new Date());
    const html = nominasSummaryHtml(engine, store, today);
    if (box.__nominasHtml !== html) {
      box.innerHTML = html;
      box.__nominasHtml = html;
    }
    const month = qs("nominasMes");
    if (month && !month.value) month.value = today.slice(0, 7);
    const list = qs("nominasTitulares");
    if (list) list.innerHTML = Array.from(new Set(store.entries.map((entry) => entry.holder))).map((holder) => `<option value="${escapeHtml(holder)}"></option>`).join("");
  } catch (error) {
    console.error(`renderNominas: ${error.message}`);
  }
}

function nominasNote(message) {
  const note = qs("nominasNota");
  if (note) note.textContent = message;
  announceStatus(message);
}

function nominasFormValues() {
  const value = (id) => qs(id)?.value ?? "";
  return {
    holder: value("nominasTitular"), period: value("nominasMes"), payer: value("nominasPagador"), kind: value("nominasTipo"),
    gross: value("nominasBruto"), net: value("nominasLiquido"), withholdingPct: value("nominasPct"), withholdingAmount: value("nominasRetencion"), socialSecurity: value("nominasSS"),
    source: qs("nominasForm")?.dataset.fuente === "texto" ? "texto" : "manual",
  };
}

function nominasSubmit(event) {
  event.preventDefault();
  const engine = globalThis.FinanceCanonicalPayroll;
  const today = isoLocalDate(new Date());
  const result = engine.addEntry(nominasLoad(), nominasFormValues(), today);
  if (!result.ok) {
    nominasNote(result.errors.join(" "));
    return;
  }
  nominasSave(result.store);
  const entry = result.store.entries.find((item) => item.holder === nominasFormValues().holder.trim() && item.period === nominasFormValues().period);
  ["nominasBruto", "nominasLiquido", "nominasPct", "nominasRetencion", "nominasSS"].forEach((id) => { const field = qs(id); if (field) field.value = ""; });
  qs("nominasForm").dataset.fuente = "manual";
  nominasYear = entry ? Number(entry.period.slice(0, 4)) : nominasYear;
  renderNominas(engine);
  nominasNote(`Nómina de ${entry ? nominasPeriodText(entry.period) : "ese mes"} ${result.replaced ? "actualizada" : "guardada"}.${result.warnings.length ? ` ${result.warnings.join(" ")}` : ""}`);
}

// Rellena el formulario con lo que se lee del texto pegado y lo borra: nada de lo pegado se conserva. Nunca guarda: el hogar revisa y pulsa «Guardar».
function nominasRead() {
  const engine = globalThis.FinanceCanonicalPayroll;
  const area = qs("nominasTextoPegado");
  const result = engine.extractFromText(area?.value || "");
  const filled = Object.keys(NOMINAS_FIELD_LABEL).filter((key) => result.fields[key] !== null);
  if (!filled.length) {
    nominasNote("No he encontrado ninguna cifra en ese texto. Comprueba que has copiado la nómina entera o apúntala a mano.");
    return;
  }
  const set = (id, value) => { const field = qs(id); if (field && value !== null && value !== undefined) field.value = String(value).replace(".", ","); };
  if (result.fields.period) qs("nominasMes").value = result.fields.period;
  set("nominasBruto", result.fields.gross);
  set("nominasLiquido", result.fields.net);
  set("nominasPct", result.fields.withholdingPct);
  set("nominasRetencion", result.fields.withholdingAmount);
  set("nominasSS", result.fields.socialSecurity);
  qs("nominasTipo").value = result.fields.kind;
  qs("nominasForm").dataset.fuente = "texto";
  if (area) area.value = "";
  const missing = result.missing.filter((key) => key !== "socialSecurity").map((key) => NOMINAS_FIELD_LABEL[key]);
  nominasNote(`He leído ${filled.map((key) => NOMINAS_FIELD_LABEL[key]).join(", ")}. ${missing.length ? `No he encontrado: ${missing.join(", ")}. ` : ""}${result.warnings.join(" ")} Revisa todo contra tu nómina antes de guardar.`.replace(/\s+/g, " ").trim());
}

function nominasUse(holder) {
  const engine = globalThis.FinanceCanonicalPayroll;
  const store = nominasLoad();
  const year = nominasYear ?? nominasDefaultYear(isoLocalDate(new Date()));
  const years = engine.yearsWithData(store);
  const chosen = years.includes(year) ? year : years[0];
  const row = engine.summarize(store, { year: chosen, today: isoLocalDate(new Date()) }).holders.find((item) => item.holder === holder);
  const field = qs("irpfWithholdingsPaid");
  if (!row || !field) return;
  field.value = String(row.withheld);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  nominasNote(`Puesto en el estimador de Renta: ${nominasEuros(row.withheld)} retenidos a ${holder} en ${chosen}.${row.complete ? "" : " Ojo: faltan nóminas, así que la cifra queda corta."}`);
}

// Una sola vez, por delegación.
function attachNominas(doc) {
  if (!doc || doc.__nominasAttached) return false;
  doc.__nominasAttached = true;
  doc.addEventListener("submit", (event) => { if (event.target?.id === "nominasForm") nominasSubmit(event); });
  doc.addEventListener("click", (event) => {
    const read = event.target?.closest?.("[data-nominas-leer]");
    if (read) { nominasRead(); return; }
    const use = event.target?.closest?.("[data-nominas-usar]");
    if (use) { nominasUse(use.dataset.nominasUsar); return; }
    if (event.target?.closest?.('[data-estado-accion="nominas-primera"]')) { qs("nominasTitular")?.focus(); return; }
    const remove = event.target?.closest?.("[data-nominas-quitar]");
    if (remove) {
      const before = nominasLoad();
      nominasSave(globalThis.FinanceCanonicalPayroll.removeEntry(before, remove.dataset.nominasQuitar));
      renderNominas(globalThis.FinanceCanonicalPayroll);
      nominasNote("Nómina quitada.");
      // WP-37 (NXP-04): quitar una nómina es reversible, así que avisa con «Deshacer».
      showUndoToast("Nómina quitada.", () => {
        nominasSave(before);
        renderNominas(globalThis.FinanceCanonicalPayroll);
        nominasNote("Nómina recuperada.");
      });
    }
  });
  doc.addEventListener("change", (event) => {
    if (event.target?.id === "nominasAnio") {
      nominasYear = Number(event.target.value);
      renderNominas(globalThis.FinanceCanonicalPayroll);
    }
  });
  return true;
}
