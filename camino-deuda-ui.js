// WP-19 · NDB-01 (docs/WP19_DISENO.md): la tarjeta «Camino a deuda cero» de Deuda › Ruta. El cálculo vive en
// canonical-debt-payoff-path.js (puro); aquí solo se leen los contratos que ya declara Deuda, se pinta y se atiende UN control: el extra al mes.
// No guarda nada (el extra vive en memoria mientras la pantalla está abierta) y no ejecuta ninguna operación (A11-4).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, escenarioMotorMonthLabel…). Sin llamadas al
// DOM ni escuchas al cargarse: views/deuda.js llama a `renderCaminoDeuda` desde `renderDeudaRuta`, que engancha las escuchas la primera vez.

const CAMINO_EXTRA_MAX = 100000;
const CAMINO_REASON_TEXT = {
  "sin-cuota-activa": "sin cuota activa",
  "sin-tae-ni-plazo": "sin TAE ni plazo declarados",
  "plazo-incoherente": "su cuota por su plazo no llega ni al capital",
};
let caminoExtra = 0;
let caminoLast = null;

// «2028-10» → «octubre de 2028». El rótulo corto del resto de Deuda («oct 28») se lee como el día 28.
function caminoMonthText(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key || "");
  if (!match) return "sin fecha";
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

// 38 → «3 años y 2 meses»
function caminoSpan(months) {
  if (!Number.isFinite(months)) return "";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years ? `${years} ${years === 1 ? "año" : "años"}` : "";
  const m = rest ? `${rest} ${rest === 1 ? "mes" : "meses"}` : "";
  return [y, m].filter(Boolean).join(" y ") || "0 meses";
}

function caminoMonths(count) {
  return `${count} ${count === 1 ? "mes" : "meses"}`;
}

function caminoParseExtra(raw) {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (text === "") return 0;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? Math.min(value, CAMINO_EXTRA_MAX) : null;
}

// Orden de ataque: el de DEB5 (TAE efectivo tras deducción fiscal) si se puede calcular; si no, el motor usa la TAE nominal.
function caminoOrder(contracts) {
  const priority = globalThis.FinanceDebtContracts?.fiscalAdjustedDebtPriority?.(contracts);
  return priority?.calculable ? priority.rows.map((row) => row.id) : [];
}

function caminoHeroHtml(label, value, note) {
  return `<div class="cam-hero"><span class="cam-hero-label">${escapeHtml(label)}</span><strong class="cam-hero-value">${escapeHtml(value)}</strong><small class="cam-hero-note">${escapeHtml(note)}</small></div>`;
}

function caminoMilestonesHtml(result, baselineById, todayKey) {
  const total = Math.max(1, ...result.milestones.map((row) => row.payoffIndex + 1));
  const items = result.milestones.map((row) => {
    const before = baselineById.get(row.id);
    const earlier = before && before.payoffMonthKey && before.payoffMonthKey !== row.payoffMonthKey ? ` <small>(sin extra: ${escapeHtml(caminoMonthText(before.payoffMonthKey))})</small>` : "";
    const width = Math.max(3, Math.round(((row.payoffIndex + 1) / total) * 100));
    return `<li class="cam-hito"><span class="cam-hito-nombre">${escapeHtml(row.label)}</span>
      <span class="cam-hito-barra" aria-hidden="true"><span style="width:${width}%"></span></span>
      <span class="cam-hito-mes">${escapeHtml(caminoMonthText(row.payoffMonthKey))}${earlier}</span></li>`;
  }).join("");
  return `<ol class="cam-hitos" aria-label="Cuándo acaba cada deuda">
      <li class="cam-hito cam-hoy"><span class="cam-hito-nombre">Hoy</span><span class="cam-hito-barra" aria-hidden="true"></span><span class="cam-hito-mes">${escapeHtml(caminoMonthText(todayKey))}</span></li>${items}</ol>`;
}

// La fecha que cuenta Hoy sale del plazo declarado (escenarioMotorContractPayoffMonth); esta, de capital, cuota y TAE. Si no coinciden se dice.
function caminoHoyNote(result) {
  if (typeof homeDebtOutlook !== "function" || !result.debtFreeMonthKey) return "";
  const base = result.baseline ? result.baseline.debtFreeMonthKey : result.debtFreeMonthKey;
  const outlook = homeDebtOutlook();
  const hoy = /^\d{4}-\d{2}/.test(String(outlook?.libreDeDeuda || "")) ? String(outlook.libreDeDeuda).slice(0, 7) : "";
  if (!hoy || !base) return "";
  const months = (key) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7));
  // Hasta dos meses es el redondeo de la última cuota (el mismo margen que el aviso de datos que no cuadran): no se avisa.
  if (Math.abs(months(hoy) - months(base)) <= globalThis.FinanceCanonicalDebtPayoffPath.LARGE_GAP_MONTHS) return "";
  return `<strong>Dos fechas distintas:</strong> Hoy y el título de esta pantalla cuentan los plazos declarados (${escapeHtml(caminoMonthText(hoy))}); aquí se calcula con el capital, la cuota y la TAE (${escapeHtml(caminoMonthText(base))} sin extra). Revisa capital, cuota, TAE y plazo en Contratos: una de las dos lecturas está sobre un dato que no cuadra.`;
}

function caminoNotesHtml(result) {
  const notes = [];
  if (result.excluded.length) {
    const list = result.excluded.map((row) => `${escapeHtml(row.label)} (${money(row.principal, true)}, ${escapeHtml(CAMINO_REASON_TEXT[row.reason] || row.reason)})`).join("; ");
    notes.push(`<strong>No entran en la cuenta:</strong> ${list}. La fecha es la de las demás deudas; completa su cuota y su TAE o plazo en Contratos para incluirlas.`);
  }
  const gaps = result.included.filter((row) => row.declaredGapMonths !== null && Math.abs(row.declaredGapMonths) > globalThis.FinanceCanonicalDebtPayoffPath.LARGE_GAP_MONTHS);
  if (gaps.length) {
    const list = gaps.map((row) => `${escapeHtml(row.label)} (declara ${caminoMonths(row.declaredInstallments)}; con su capital, cuota y TAE salen ${caminoMonths(row.declaredInstallments + row.declaredGapMonths)})`).join("; ");
    notes.push(`<strong>Los datos no cuadran entre sí:</strong> ${list}. Revisa capital, cuota, TAE o plazo en Contratos antes de fiarte de la fecha.`);
  }
  const implied = result.included.filter((row) => row.rateSource === "implied");
  if (implied.length) {
    const list = implied.map((row) => `${escapeHtml(row.label)} (≈ ${String(row.aprPct).replace(".", ",")} %)`).join("; ");
    notes.push(`<strong>Sin TAE declarada:</strong> se ha deducido de su cuota y su plazo en ${list}. Es la que explica sus cuotas, no un dato del contrato.`);
  }
  const stalled = result.included.filter((row) => row.stalled);
  if (stalled.length) {
    notes.push(`<strong>No acaban solas:</strong> la cuota de ${stalled.map((row) => escapeHtml(row.label)).join(", ")} no cubre ni el interés. Sin extra el capital no baja.`);
  }
  const hoyNote = caminoHoyNote(result);
  if (hoyNote) notes.push(hoyNote);
  notes.push("Las cuotas que se liberan al saldar una deuda <strong>no</strong> se redirigen: solo el extra pasa de una deuda a la siguiente. No incluye comisiones por amortización anticipada ni cambios de tipo en las variables. Es una proyección, no un compromiso, y la app no ejecuta nada.");
  return notes.map((note) => `<p class="e19-kpi-note">${note}</p>`).join("");
}

function caminoResultHtml(engine, contracts, extra, todayKey) {
  const options = { startMonthKey: todayKey, order: caminoOrder(contracts) };
  const result = engine.project(contracts, { ...options, extraMonthly: extra });
  if (!result.ok) return { html: `<p class="e19-kpi-note">${escapeHtml(result.error)}</p>`, valueText: "" };
  if (result.nothingToProject) return { html: "<p class=\"e19-kpi-note\">No hay deudas con capital pendiente: no hay camino que calcular.</p>", valueText: "sin deudas pendientes" };
  if (!result.included.length) return { html: `<p class="e19-kpi-note"><strong>No se puede calcular el camino.</strong></p>${caminoNotesHtml(result)}`, valueText: "sin datos suficientes" };
  const base = result.baseline || { debtFreeMonthKey: result.debtFreeMonthKey, monthsToDebtFree: result.monthsToDebtFree, totalInterest: result.totalInterest, beyondHorizon: result.beyondHorizon };
  const baseById = new Map((extra > 0 ? engine.project(contracts, { ...options, extraMonthly: 0 }) : result).included.map((row) => [row.id, row]));
  const hundred = engine.perHundred(contracts, options);
  const dateText = result.debtFreeMonthKey ? caminoMonthText(result.debtFreeMonthKey) : "sin fecha";
  const dateNote = result.debtFreeMonthKey
    ? `${caminoSpan(result.monthsToDebtFree)}${result.complete ? "" : " · solo las deudas con datos"}`
    : "alguna deuda no acaba en 50 años";
  const interestNote = extra > 0 && !base.beyondHorizon && !result.beyondHorizon
    ? `${money(Math.max(0, base.totalInterest - result.totalInterest), true)} menos que sin extra`
    : "hasta saldarlas";
  const heroes = `<div class="cam-heroes">
      ${caminoHeroHtml(result.complete ? "Libre de deuda" : "Libre de las deudas con cuota", dateText, dateNote)}
      ${caminoHeroHtml("Cuota total al mes", money(result.monthlyPayment, true), extra > 0 ? `${money(result.monthlyPayment - extra, true)} de cuotas + ${money(extra, true)} de extra` : "suma de las cuotas actuales")}
      ${caminoHeroHtml("Intereses pendientes", result.beyondHorizon ? "sin tope" : money(result.totalInterest, true), result.beyondHorizon ? "alguna deuda no acaba" : interestNote)}
    </div>`;
  const sentences = [];
  if (extra > 0 && result.debtFreeMonthKey && base.debtFreeMonthKey && !base.beyondHorizon) {
    const saved = base.monthsToDebtFree - result.monthsToDebtFree;
    const target = result.firstTarget ? ` El extra iría primero a ${escapeHtml(result.firstTarget.label)} (${String(result.firstTarget.aprPct).replace(".", ",")} % de TAE).` : "";
    sentences.push(`<p class="cam-frase"><strong>Con ${escapeHtml(money(extra, true))} más al mes</strong> acabáis ${saved > 0 ? `${caminoMonths(saved)} antes (${escapeHtml(dateText)} en vez de ${escapeHtml(caminoMonthText(base.debtFreeMonthKey))})` : "en la misma fecha"} y pagáis ${escapeHtml(money(Math.max(0, base.totalInterest - result.totalInterest), true))} menos de intereses.${target}</p>`);
  } else if (extra > 0 && base.beyondHorizon && result.debtFreeMonthKey) {
    sentences.push(`<p class="cam-frase"><strong>Con ${escapeHtml(money(extra, true))} más al mes</strong> pasáis de no acabar nunca a acabar en ${escapeHtml(dateText)}.</p>`);
  } else if (extra === 0 && result.debtFreeMonthKey) {
    sentences.push(`<p class="cam-frase">Sin extra, el calendario actual acaba en <strong>${escapeHtml(dateText)}</strong>. Mueve el control para ver qué cambia.</p>`);
  }
  if (hundred.monthsSaved !== null) {
    const parts = [];
    if (hundred.monthsSaved > 0) parts.push(`${caminoMonths(hundred.monthsSaved)} menos`);
    if (hundred.interestSaved !== null && hundred.interestSaved > 0) parts.push(`${money(hundred.interestSaved, true)} menos de intereses`);
    if (parts.length) sentences.push(`<p class="cam-frase cam-referencia">Cada 100 € más al mes (frente a no poner extra): ${escapeHtml(parts.join(" y "))}. Iría primero a ${escapeHtml(hundred.targetLabel || "—")}.</p>`);
  }
  const body = `${heroes}${sentences.join("")}${result.milestones.length ? caminoMilestonesHtml(result, baseById, todayKey) : ""}${caminoNotesHtml(result)}`;
  const valueText = `${money(extra, true)} al mes de extra: libres de deuda en ${dateText}`;
  return { html: body, valueText };
}

// Pinta el resultado (nunca los controles: así el foco y lo tecleado no se pierden) y sincroniza el deslizador con la caja numérica.
function renderCaminoDeuda(engine, contracts) {
  const box = qs("caminoDeudaResultado");
  if (!box || !engine) return;
  attachCaminoDeuda(document);
  caminoLast = { engine, contracts };
  try {
    const todayKey = isoLocalDate(new Date()).slice(0, 7);
    const { html, valueText } = caminoResultHtml(engine, contracts || [], caminoExtra, todayKey);
    if (box.__caminoHtml !== html) {
      box.innerHTML = html;
      box.__caminoHtml = html;
    }
    const number = qs("caminoDeudaExtra");
    const range = qs("caminoDeudaRango");
    if (number && document.activeElement !== number && number.value !== String(caminoExtra)) number.value = String(caminoExtra);
    if (range) {
      range.value = String(Math.min(caminoExtra, Number(range.max)));
      range.setAttribute("aria-valuetext", valueText);
    }
  } catch (error) {
    console.error(`renderCaminoDeuda: ${error.message}`);
  }
}

function caminoOnInput(event) {
  const target = event.target;
  if (!target || (target.id !== "caminoDeudaExtra" && target.id !== "caminoDeudaRango")) return;
  const parsed = caminoParseExtra(target.value);
  const note = qs("caminoDeudaNota");
  if (parsed === null) {
    target.setAttribute("aria-invalid", "true");
    if (note) note.textContent = "Escribe el extra como un importe de 0 € o más, por ejemplo 150.";
    return;
  }
  target.removeAttribute("aria-invalid");
  if (note) note.textContent = "";
  caminoExtra = parsed;
  if (target.id === "caminoDeudaRango") {
    const number = qs("caminoDeudaExtra");
    if (number) number.value = String(parsed);
  }
  if (caminoLast) renderCaminoDeuda(caminoLast.engine, caminoLast.contracts);
}

// Una sola vez, por delegación.
function attachCaminoDeuda(doc) {
  if (!doc || doc.__caminoAttached) return false;
  doc.__caminoAttached = true;
  doc.addEventListener("input", caminoOnInput);
  return true;
}
