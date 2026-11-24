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
let planOptimoResultadoUltimo = null;
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

// DUO-D9 (docs/PROPUESTA_DUODECIMA_AUDITORIA_2026-11-23.md): una deuda con los pagos suspendidos (lo que la app trata como impago) no entra en
// la fecha. Se dice en la misma cifra y, en la nota, con la salida que sí sirve: no hay cuota que completar; entra en el plan con una oferta de
// quita (Ofertas de quita, en el plan) y para pedirla está el kit para hablar con la entidad (Deuda › Contratos).
function caminoImpagoNota(rows, total = null, enPlan = false) {
  const principal = total ? total.principal : rows.reduce((sum, row) => sum + (Number(row.principal) || 0), 0);
  const nombres = rows.map((row) => escapeHtml(row.label)).join(", ");
  const salida = enPlan
    ? "Con una oferta de quita entra en el plan (en «Ofertas de quita», más abajo)"
    : "Con una oferta de quita entra en el plan óptimo (Deuda › Plan, «Ofertas de quita»)";
  return `<strong>Con los pagos suspendidos, fuera de la fecha:</strong> ${nombres} (${escapeHtml(money(principal, true))}). No tiene cuota que completar en Contratos. ${salida}; para pedirla, el kit para hablar con la entidad, desde su fila en Deuda › Contratos.`;
}

function planOptimoHeroLabel(r) {
  return r.completo === false ? "Libre de las deudas que entran" : "Libre de deuda";
}

function planOptimoHeroFuera(r) {
  const fuera = r.fueraDeLaFecha;
  if (!fuera || !fuera.count) return "";
  return caminoFueraNota(fuera.count, fuera.principal, fuera.enImpago ? fuera.enImpago.count : 0, fuera.enImpago ? fuera.enImpago.principal : 0);
}

// La coletilla de la fecha cuando algo no entra: lo impagado se nombra (no es un dato que falte).
function caminoFueraNota(count, principal, impagoCount, impagoPrincipal) {
  if (!count) return "";
  if (impagoCount && impagoCount === count) return ` · sin contar ${money(impagoPrincipal, true)} con los pagos suspendidos`;
  if (impagoCount) return ` · sin contar ${money(principal, true)} que no entran (${money(impagoPrincipal, true)} con los pagos suspendidos)`;
  return " · solo las deudas con datos";
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
  // DUO-D9: lo que tiene los pagos suspendidos (impago) no se arregla completando datos; se dice aparte y con su salida.
  const sinDatos = result.excluded.filter((row) => !row.suspended);
  const enImpago = result.excluded.filter((row) => row.suspended);
  if (sinDatos.length) {
    const list = sinDatos.map((row) => `${escapeHtml(row.label)} (${money(row.principal, true)}, ${escapeHtml(CAMINO_REASON_TEXT[row.reason] || row.reason)})`).join("; ");
    notes.push(`<strong>No entran en la cuenta:</strong> ${list}. La fecha es la de las demás deudas; completa su cuota y su TAE o plazo en Contratos para incluirlas.`);
  }
  if (enImpago.length) notes.push(caminoImpagoNota(enImpago));
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
    ? `${caminoSpan(result.monthsToDebtFree)}${result.complete ? "" : caminoFueraNota(result.excluded.length, result.excludedPrincipal, result.excluded.filter((row) => row.suspended).length, result.excluded.filter((row) => row.suspended).reduce((sum, row) => sum + row.principal, 0))}`
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Plan óptimo de saldo de deuda (21/11/2026, petición del hogar: «quiero seguir con un plan optimizado de saldo de deuda»). Encima de
// «Camino a deuda cero», en Deuda › Ruta. El cálculo es canonical-debt-optimal-plan.js, que usa el mismo motor que el camino. Dos
// controles: lo que se pone al mes además de las cuotas (de entrada, la capacidad libre de Hoy, a la decena por abajo) y un pago
// inicial (de entrada, 0; se dice cuánto hay por encima del suelo del colchón en los próximos 12 meses). Propone, no ejecuta (A11-4).
let planOptimoMensual = null; // null: aún sin tocar, se parte de la capacidad libre
let planOptimoPago = 0;
let planOptimoLast = null;
// UND-12 (22/11/2026): «prevision» (el extra de cada mes sale de la previsión, sin bajar del suelo) o «fijo». null: la previsión si la
// hay. Vive en memoria, como el importe; escribir un importe pasa a «fijo».
let planOptimoModo = null;
// UND-11 (22/11/2026): las ofertas de quita que teclea el hogar, por contrato, en este navegador.
const PLAN_OPTIMO_QUITAS_KEY = "plan-optimo-quitas";
const PLAN_OPTIMO_COMISIONES_KEY = "plan-optimo-comisiones"; // DUO-D3: la comisión por amortizar antes de cada contrato

// D-N27 (21/11/2026, «ok, pero me preguntas antes y poder modificar»): el orden elegido y el margen para preguntar se recuerdan en
// este navegador. Sin elegir, la avalancha; si la bola de nieve cuesta poco más y salda antes la primera, se pregunta.
const PLAN_OPTIMO_ORDEN_KEY = "plan-optimo-orden";
const PLAN_OPTIMO_MARGEN_KEY = "plan-optimo-margen";

function planOptimoOrdenGuardado() {
  const value = planOptimoGuard(() => storageGet(storageKey(PLAN_OPTIMO_ORDEN_KEY), ""), "");
  return value === "avalancha" || value === "bola-nieve" ? value : null;
}

function planOptimoMargenGuardado() {
  const parsed = planOptimoGuard(() => JSON.parse(storageGet(storageKey(PLAN_OPTIMO_MARGEN_KEY), "null")), null);
  return parsed && typeof parsed === "object" ? parsed : null;
}

// La oferta registrada en Contratos (un acuerdo «propuesto» de pago único, sin cuotas) sirve de partida si no se ha escrito otra.
function planOptimoQuitaRegistrada(contract) {
  const agreement = contract?.agreement;
  if (!agreement || String(agreement.status || "").toLowerCase() !== "proposed") return null;
  const lump = Number(agreement.settlementAmount);
  const schedule = Number(agreement.payment) > 0 && Number(agreement.duration) > 0;
  return Number.isFinite(lump) && lump > 0 && !schedule ? Math.round(lump * 100) / 100 : null;
}

// Las quitas que entran en el cálculo: lo escrito y, si no, lo registrado. Un campo vaciado a propósito guarda 0 y no usa la registrada.
function planOptimoQuitas(contracts) {
  const guardadas = planOptimoGuard(() => JSON.parse(storageGet(storageKey(PLAN_OPTIMO_QUITAS_KEY), "{}")), {}) || {};
  const out = [];
  (contracts || []).forEach((contract) => {
    const id = String(contract?.id || "");
    if (!id || !(Number(contract.currentPrincipal) > 0)) return;
    if (Object.prototype.hasOwnProperty.call(guardadas, id)) {
      const n = Number(guardadas[id]);
      if (Number.isFinite(n) && n > 0) out.push({ id, amount: Math.round(n * 100) / 100 });
      return;
    }
    const registrada = planOptimoQuitaRegistrada(contract);
    if (registrada) out.push({ id, amount: registrada, registrada: true });
  });
  return out;
}

// Una fila por deuda con capital (las de acuerdo aceptado no: lo pactado ya fija lo que se paga). Solo se rehace si cambian las deudas,
// para no perder el foco ni lo que se está escribiendo.
function planOptimoQuitasListaHtml(contracts) {
  const guardadas = planOptimoGuard(() => JSON.parse(storageGet(storageKey(PLAN_OPTIMO_QUITAS_KEY), "{}")), {}) || {};
  const filas = (contracts || []).filter((c) => Number(c?.currentPrincipal) > 0 && String(c?.agreement?.status || "").toLowerCase() !== "accepted").map((c) => {
    const id = String(c.id || "");
    const registrada = planOptimoQuitaRegistrada(c);
    const propia = Object.prototype.hasOwnProperty.call(guardadas, id) ? Number(guardadas[id]) : null;
    const valor = propia !== null ? (propia > 0 ? String(propia) : "") : registrada ? String(registrada) : "";
    const nombre = [c.entity, c.type].filter(Boolean).join(" ").trim() || c.label || id;
    const nota = registrada && propia === null ? " · la oferta registrada en Contratos" : "";
    return `<label class="month-picker"><span>${escapeHtml(nombre)} <small>(debéis ${escapeHtml(money(Number(c.currentPrincipal), true))}${escapeHtml(nota)})</small></span>
      <input type="number" min="0" max="100000" step="10" inputmode="decimal" data-plan-optimo-quita="${escapeHtml(id)}" value="${escapeHtml(valor)}" placeholder="sin oferta" /></label>`;
  });
  return filas.length ? `<div class="cam-control plan-optimo-quitas-filas">${filas.join("")}</div>` : `<p class="e19-kpi-note">No hay deudas con capital pendiente.</p>`;
}

// DUO-D3: la comisión por amortizar antes, por contrato (la de ahora y, si baja, a cuánto y desde qué mes). Nunca se supone.
function planOptimoComisionesGuardadas() {
  const g = planOptimoGuard(() => JSON.parse(storageGet(storageKey(PLAN_OPTIMO_COMISIONES_KEY), "{}")), {}) || {};
  return g && typeof g === "object" && !Array.isArray(g) ? g : {};
}

function planOptimoComisiones(contracts) {
  const g = planOptimoComisionesGuardadas();
  return (contracts || []).map((c) => ({ id: String(c?.id || ""), ...(g[String(c?.id || "")] || {}) })).filter((x) => x.id && Number(x.pct) > 0);
}

function planOptimoComisionesListaHtml(contracts) {
  const g = planOptimoComisionesGuardadas();
  const filas = (contracts || []).filter((c) => Number(c?.currentPrincipal) > 0 && String(c?.agreement?.status || "").toLowerCase() !== "accepted").map((c) => {
    const id = String(c.id || "");
    const v = g[id] || {};
    const nombre = [c.entity, c.type].filter(Boolean).join(" ").trim() || c.label || id;
    const campo = (k, extra) => `data-plan-optimo-comision="${escapeHtml(id)}" data-comision-campo="${k}" value="${escapeHtml(v[k] === undefined || v[k] === null ? "" : String(v[k]))}" ${extra}`;
    return `<fieldset class="plan-optimo-comision"><legend>${escapeHtml(nombre)}</legend>
      <label class="month-picker"><span>Comisión de ahora (%)</span><input type="number" min="0" max="10" step="0.05" inputmode="decimal" ${campo("pct", 'placeholder="sin comisión"')} /></label>
      <label class="month-picker"><span>Baja a (%)</span><input type="number" min="0" max="10" step="0.05" inputmode="decimal" ${campo("nextPct", 'placeholder="—"')} /></label>
      <label class="month-picker"><span>Desde el mes</span><input type="month" ${campo("untilMonth", "")} /></label>
    </fieldset>`;
  });
  return filas.length ? `<div class="plan-optimo-comisiones-filas">${filas.join("")}</div>` : `<p class="e19-kpi-note">No hay deudas con capital pendiente.</p>`;
}

function planOptimoPintarComisiones(contracts) {
  const lista = qs("planOptimoComisionesLista");
  if (!lista) return;
  const firma = JSON.stringify((contracts || []).map((c) => [c?.id, c?.currentPrincipal, c?.agreement?.status]));
  if (lista.__firma === firma) return;
  lista.__firma = firma;
  lista.innerHTML = planOptimoComisionesListaHtml(contracts);
}

function planOptimoOnComision(target) {
  const campo = target.dataset.comisionCampo;
  const id = target.dataset.planOptimoComision;
  const note = qs("planOptimoNota");
  const raw = String(target.value || "").replace(",", ".").trim();
  let valor = raw;
  if (campo !== "untilMonth") {
    valor = raw === "" ? null : Number(raw);
    if (valor !== null && (!Number.isFinite(valor) || valor < 0 || valor > 10)) {
      target.setAttribute("aria-invalid", "true");
      if (note) note.textContent = "Escribe la comisión como un porcentaje entre 0 y 10, por ejemplo 1 o 0,5 (vacío: sin comisión).";
      return;
    }
  } else if (raw && !/^\d{4}-\d{2}$/.test(raw)) {
    target.setAttribute("aria-invalid", "true");
    if (note) note.textContent = "Elige el mes desde el que baja la comisión.";
    return;
  }
  target.removeAttribute("aria-invalid");
  if (note) note.textContent = "";
  const todas = planOptimoComisionesGuardadas();
  todas[id] = { ...(todas[id] || {}), [campo]: valor === "" ? null : valor };
  planOptimoGuardar(PLAN_OPTIMO_COMISIONES_KEY, JSON.stringify(todas));
  planOptimoRepintar();
}

function planOptimoPintarQuitas(contracts) {
  const lista = qs("planOptimoQuitasLista");
  if (!lista) return;
  const firma = JSON.stringify((contracts || []).map((c) => [c?.id, c?.currentPrincipal, c?.agreement?.status, c?.agreement?.settlementAmount]));
  if (lista.__firma === firma) return;
  lista.__firma = firma;
  lista.innerHTML = planOptimoQuitasListaHtml(contracts);
}

function planOptimoGuardar(key, value) {
  planOptimoGuard(() => storageSet(storageKey(key), value));
}

function planOptimoGuard(fn, fallback = null) {
  try {
    const value = fn();
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

// Capacidad libre al mes (la de Hoy › Patrimonio y deuda, «Capacidad libre real») y lo que hay por encima del suelo del colchón que la
// previsión no toca en 12 meses (el dinero parado de la escalera del próximo euro). Solo para partir y para avisar.
function planOptimoReferencias() {
  const capacity = planOptimoGuard(() => Number(unifiedActionCenterModel()?.context?.capacity?.avgTransfer12m), null);
  const idle = planOptimoGuard(() => {
    if (!globalThis.FinanceCanonicalNextEuro || typeof proxEuroIdleModel !== "function") return null;
    const model = proxEuroIdleModel(globalThis.FinanceCanonicalNextEuro, { idleOptions: [] });
    return model?.status === "ok" ? model.windows.find((row) => row.months === 12 && row.calculable)?.idle ?? null : null;
  }, null);
  // UND-12: la previsión mensual (la línea que se pinta, con las cuotas de hoy ya restadas) y el suelo de Hoy.
  const rows = planOptimoGuard(() => (typeof canonicalEngineRuns !== "undefined" ? canonicalEngineRuns.active?.rows || canonicalEngineRuns.base?.rows || [] : []), []);
  const floor = planOptimoGuard(() => globalThis.FinanceCanonicalHomeMargin?.normalizeFloor?.(state?.liquidityFloor) ?? null, null);
  return { capacity: Number.isFinite(capacity) ? capacity : null, available: Number.isFinite(idle) ? idle : null, rows: Array.isArray(rows) ? rows : [], floor: Number.isFinite(floor) ? floor : null };
}

function planOptimoModoEfectivo(liquidez) {
  if (planOptimoModo === "fijo") return "fijo";
  return liquidez?.ok ? "prevision" : "fijo";
}

// DUO-01 (D-N34): si los dos órdenes dan exactamente lo mismo, cambiar el orden o el margen no mueve ninguna cifra; se dice por qué.
function planOptimoOrdenesCoinciden(r) {
  const a = r.recommended?.summary;
  const b = r.alternative?.summary;
  if (!a || !b) return false;
  return Number(r.diferenciaAlternativa || 0) === 0 && a.debtFreeMonthKey === b.debtFreeMonthKey
    && (a.firstPayoff?.id ?? null) === (b.firstPayoff?.id ?? null) && (a.firstPayoff?.payoffMonthKey ?? null) === (b.firstPayoff?.payoffMonthKey ?? null);
}

function planOptimoRazonHtml(r) {
  if (planOptimoOrdenesCoinciden(r)) {
    const una = (r.recommended.result?.included || []).length <= 1;
    const porque = una ? "solo hay una deuda en la cuenta" : "la más cara es también la más pequeña";
    const quien = r.chosen ? "Orden elegido" : "Orden recomendado";
    const cual = r.recommended.strategy === "bola-nieve" ? "bola de nieve" : "avalancha";
    return `<p class="cam-frase" data-plan-optimo-coinciden><strong>${quien}: ${cual}.</strong> Con vuestras deudas, los dos órdenes coinciden: ${porque}, así que avalancha y bola de nieve dan las mismas fechas y los mismos intereses. Cambiar el orden o el margen no mueve ninguna cifra.</p>`;
  }
  const rec = r.recommended;
  const first = rec.summary.firstPayoff;
  const diff = Number(r.diferenciaAlternativa || 0);
  if (rec.strategy === "avalancha") {
    const quien = r.chosen ? "Orden elegido" : "Orden recomendado";
    return `<p class="cam-frase"><strong>${quien}: avalancha</strong>, primero la deuda más cara. Es el que menos intereses paga${diff > 0 ? `: ${escapeHtml(money(diff, true))} menos que empezar por la más pequeña` : ""}.</p>`;
  }
  const altFirst = r.alternative.summary.firstPayoff;
  const meses = first && altFirst ? altFirst.payoffIndex - first.payoffIndex : 0;
  const coste = Math.max(0, -diff);
  return `<p class="cam-frase"><strong>Orden elegido: bola de nieve</strong>, primero la deuda más pequeña. Saldáis ${escapeHtml(first?.label || "la primera")}${first ? ` en ${escapeHtml(caminoMonthText(first.payoffMonthKey))}` : ""}${meses > 0 ? `, ${caminoMonths(meses)} antes que con la avalancha` : ""}${coste > 0 ? `, por ${escapeHtml(money(coste, true))} más de intereses en total` : ", sin pagar más intereses"}. Podéis cambiarlo en «Orden».</p>`;
}

// D-N27: la pregunta, solo mientras no se ha elegido orden. Hasta contestar, se enseña la avalancha.
function planOptimoPreguntaHtml(r) {
  if (!r.pregunta || !r.sugerencia) return "";
  const s = r.sugerencia;
  const coste = s.extraCost > 0 ? `os cuesta ${escapeHtml(money(s.extraCost, true))} más de intereses en total` : "no os cuesta más intereses";
  return `<div class="plan-optimo-pregunta" role="group" aria-labelledby="planOptimoPreguntaTexto">
      <p id="planOptimoPreguntaTexto"><strong>¿Empezáis por la más pequeña?</strong> Saldar primero ${escapeHtml(s.firstPayoff.label)} ${coste} y la quitáis de en medio ${caminoMonths(s.monthsEarlier)} antes (${escapeHtml(caminoMonthText(s.firstPayoff.payoffMonthKey))}): una cuota menos pronto ayuda a sostener el plan. Mientras no lo decidáis, se enseña la avalancha.</p>
      <div class="plan-optimo-pregunta-botones">
        <button type="button" class="e19-btn e19-btn-primary" data-plan-optimo-orden="bola-nieve">Sí, por la más pequeña</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-plan-optimo-orden="avalancha">No, primero la más cara</button>
      </div>
    </div>`;
}

// DUO-D5 (duodécima auditoría; estilos en seguimiento-plan.css): el valor de cada 50 € más al mes, frente al plan de ahora, con el mismo motor y el mismo orden. Una tabla y
// no un gráfico: son cuatro filas con dos medidas de escala distinta (meses e intereses), y un gráfico pediría dos ejes. La frase de abajo dice
// dónde empieza a rendir poco cada 50 € más (cuando adelanta un mes o menos).
const PLAN_OPTIMO_PASOS = Object.freeze([50, 100, 150, 200]);

function planOptimoCada50(Plan, engine, contracts, comunes, r, base) {
  const s = r?.recommended?.summary;
  if (!r?.ok || !s?.debtFreeMonthKey || s.totalInterest === null) return [];
  let anterior = { meses: 0, intereses: 0 };
  return PLAN_OPTIMO_PASOS.map((paso) => {
    const opciones = { ...comunes, strategy: r.recommended.strategy, monthly: base.monthly + paso, ...(base.byMonth ? { monthlyByMonth: base.byMonth.map((v) => v + paso) } : {}) };
    const alt = Plan.plan(engine, contracts, opciones);
    const a = alt?.ok ? alt.recommended.summary : null;
    if (!a?.debtFreeMonthKey || a.totalInterest === null) return null;
    const fila = {
      paso,
      meses: Math.max(0, s.monthsToDebtFree - a.monthsToDebtFree),
      intereses: Math.max(0, Math.round((s.totalInterest - a.totalInterest) * 100) / 100),
      fecha: a.debtFreeMonthKey,
    };
    fila.mesesDelPaso = fila.meses - anterior.meses;
    anterior = fila;
    return fila;
  }).filter(Boolean);
}

function planOptimoCada50Html(filas) {
  if (!filas.length || !filas.some((f) => f.meses > 0 || f.intereses > 0)) return "";
  const cuerpo = filas.map((f) => `<tr><th scope="row">+${f.paso} €</th><td>${f.meses > 0 ? escapeHtml(caminoMonths(f.meses)) : "el mismo mes"}</td><td>${escapeHtml(money(f.intereses, true))}</td><td>${escapeHtml(caminoMonthText(f.fecha))}</td></tr>`).join("");
  const poco = filas.find((f, i) => i > 0 && f.mesesDelPaso <= 1);
  const frase = poco
    ? `Desde +${poco.paso} €, cada 50 € más adelanta ${poco.mesesDelPaso === 1 ? "solo un mes" : "menos de un mes"}: el salto grande está en los primeros.`
    : "Cada 50 € más sigue adelantando más de un mes.";
  return `<div class="plan-optimo-cada50">
      <table class="plan-optimo-cada50-tabla">
        <caption>Si ponéis más al mes (frente al plan de ahora, mismo orden)</caption>
        <thead><tr><th scope="col">Al mes</th><th scope="col">Acabáis antes</th><th scope="col">Intereses de menos</th><th scope="col">Libres en</th></tr></thead>
        <tbody>${cuerpo}</tbody>
      </table>
      <p class="e19-kpi-note" data-plan-optimo-cada50-frase>${escapeHtml(frase)}</p>
    </div>`;
}

// DUO-D3: al amortizar con el pago inicial, la entidad pregunta si reducir plazo o cuota. El plan supone plazo (lo que más intereses
// ahorra); con la previsión justa en los próximos 6 meses, la cuota da aire y se dice cuánto cuesta. Cálculo de APX6
// (FinanceDebtComparator.amortizeReduceQuotaVsTerm), con la TAE y los plazos que quedan del contrato.
function planOptimoCuotaPlazoHtml(r, contracts, liquidez, modo) {
  const C = globalThis.FinanceDebtComparator;
  if (!C?.amortizeReduceQuotaVsTerm || !r?.ok) return "";
  const porId = new Map((contracts || []).map((c) => [String(c.id), c]));
  const justa = modo === "prevision" && Array.isArray(liquidez?.byMonth) && liquidez.byMonth.slice(0, 6).some((v) => !(Number(v) > 0));
  const filas = (r.recommended.lumpApplied || []).filter((x) => !x.settles && !x.quita).map((x) => {
    const c = porId.get(String(x.id));
    if (!c || !(Number(c.apr) >= 0) || c.apr === null) return "";
    // Sin plazo declarado (una tarjeta), el que sale de su cuota y su TAE.
    let meses = Number(c.remainingInstallments);
    if (!(meses > 0)) {
      const i = Number(c.apr) / 1200;
      const p = Number(c.currentPrincipal);
      const m = Number(c.currentPayment);
      meses = i === 0 ? Math.ceil(p / m) : m > p * i ? Math.ceil(-Math.log(1 - (p * i) / m) / Math.log(1 + i)) : 0;
    }
    if (!(meses > 0) || !Number.isFinite(meses)) return "";
    const k = C.amortizeReduceQuotaVsTerm({ principal: Number(c.currentPrincipal), annualRatePct: Number(c.apr), months: meses, lumpSum: x.amount });
    if (!k?.calculable) return "";
    const diferencia = Math.max(0, Math.round((k.reduceTerm.interestSaved - k.reduceQuota.interestSaved) * 100) / 100);
    const consejo = justa
      ? `Con la previsión justa los próximos meses, <strong>reducir cuota</strong> da aire: cuesta ${escapeHtml(money(diferencia, true))} más de intereses.`
      : `Por defecto, <strong>reducir plazo</strong>: ahorra ${escapeHtml(money(diferencia, true))} más (es lo que supone el plan).`;
    return `<li><strong>${escapeHtml(x.label)}</strong> (${escapeHtml(money(x.amount, true))}): reducir plazo, ${escapeHtml(money(k.reduceTerm.interestSaved, true))} menos de intereses y ${escapeHtml(caminoMonths(k.reduceTerm.monthsReduced))} antes; reducir cuota, ${escapeHtml(money(k.reduceQuota.interestSaved, true))} menos y ${escapeHtml(money(k.reduceQuota.paymentReduction, true))} al mes de liquidez. ${consejo}</li>`;
  }).filter(Boolean);
  return filas.length ? `<div class="plan-optimo-cuota-plazo"><p class="cam-frase">Al amortizar, la entidad os preguntará si <strong>reducir plazo o cuota</strong>:</p><ul class="plan-optimo-tramos">${filas.join("")}</ul></div>` : "";
}

// DUO-D3: las deudas a tipo variable (las que tienen diferencial en la revisión del tipo, WP-20) dan un rango y no una fecha.
function planOptimoVariables() {
  const g = planOptimoGuard(() => JSON.parse(storageGet(storageKey("rate-review"), "{}")), {}) || {};
  const por = g.byContract && typeof g.byContract === "object" ? g.byContract : {};
  return new Set(Object.keys(por).filter((id) => Number.isFinite(Number(por[id]?.spread))));
}

function planOptimoEuriborHtml(Plan, engine, contracts, opciones, r) {
  const variables = planOptimoVariables();
  const afectadas = (contracts || []).filter((c) => variables.has(String(c.id)) && Number(c.apr) >= 0 && c.apr !== null && Number(c.currentPrincipal) > 0);
  if (!afectadas.length || !r?.ok || !r.recommended.summary.debtFreeMonthKey) return "";
  const con = (delta) => {
    const cambiados = (contracts || []).map((c) => (variables.has(String(c.id)) && c.apr !== null ? { ...c, apr: Math.max(0, Number(c.apr) + delta) } : c));
    const alt = Plan.plan(engine, cambiados, opciones);
    return alt?.ok ? alt.recommended.summary.debtFreeMonthKey : null;
  };
  const sube = con(1);
  const baja = con(-1);
  if (!sube || !baja) return "";
  const nombres = afectadas.map((c) => [c.entity, c.type].filter(Boolean).join(" ")).join(", ");
  if (sube === baja && sube === r.recommended.summary.debtFreeMonthKey) {
    return `<p class="e19-kpi-note" data-plan-optimo-euribor>Con tipo variable en ${escapeHtml(nombres)}: aunque el Euribor suba o baje un punto, acabáis el mismo mes.</p>`;
  }
  return `<p class="e19-kpi-note" data-plan-optimo-euribor>Con tipo variable en ${escapeHtml(nombres)}: si el Euribor sube un punto, libres en <strong>${escapeHtml(caminoMonthText(sube))}</strong>; si baja un punto, en <strong>${escapeHtml(caminoMonthText(baja))}</strong>. La fecha de arriba es con el tipo de hoy.</p>`;
}

function planOptimoTramosHtml(periods) {
  if (!periods.length) return "";
  const items = periods.map((p) => {
    const acaba = p.settledId !== p.targetId ? ` <small>(ese mes acaba ${escapeHtml(p.settledLabel)} por su calendario y su cuota se suma)</small>` : "";
    // UND-12: con la previsión, lo de cada mes cambia: se dice el mínimo, el máximo y el total del tramo.
    const cuanto = p.extraMin !== undefined && p.extraMin !== p.extraMax
      ? `entre ${escapeHtml(money(p.extraMin, true))} y ${escapeHtml(money(p.extraMax, true))} al mes de más (${escapeHtml(money(p.extraTotal, true))} en total)`
      : `${escapeHtml(money(p.extra, true))} al mes de más`;
    if (p.quita && p.targetId === p.settledId) {
      // Lo que se junta es lo que pide la quita: lo que sobra del último mes ya va a la siguiente deuda, no a la quita.
      const perdon = p.quita.forgiven > 0 ? `; os perdonan ${escapeHtml(money(p.quita.forgiven, true))}` : "";
      return `<li><strong>Hasta ${escapeHtml(caminoMonthText(p.payoffMonthKey))}:</strong> juntáis ${escapeHtml(money(p.quita.paid, true))} para la quita de ${escapeHtml(p.targetLabel)} (${p.fromIndex === p.toIndex ? "en un mes" : `en ${caminoMonths(p.toIndex - p.fromIndex + 1)}`}${perdon})</li>`;
    }
    return `<li><strong>Hasta ${escapeHtml(caminoMonthText(p.payoffMonthKey))}:</strong> ${cuanto} a ${escapeHtml(p.targetLabel)}${acaba}</li>`;
  }).join("");
  return `<ol class="plan-optimo-tramos" aria-label="Qué se paga de más cada mes y a qué deuda">${items}</ol>`;
}

function planOptimoPct(value) {
  return `${String(Math.round(Number(value) * 10) / 10).replace(".", ",")} %`;
}

// UND-11: lo que dice cada quita: cuánto se paga, cuánto se perdona, cuánto rinde y el paso siguiente (proponerla, en el simulador).
function planOptimoQuitasHtml(r, ofertas, contracts) {
  const items = (r.quitas || []).map((q) => {
    const rinde = q.method === "cuotas"
      ? `rinde como amortizar una deuda al ${planOptimoPct(q.yieldPct)} (frente a las cuotas que os quitáis)`
      : `rinde un ${planOptimoPct(q.yieldPct)} (lo perdonado entre lo pagado, como si se pagara en un año: hoy no tiene cuota que comparar)`;
    let cuando;
    if (!q.settled) cuando = "con lo que ponéis no se llega a juntar dentro del plan";
    else if (q.forgiven > 0) cuando = `se paga en ${escapeHtml(caminoMonthText(q.payoffMonthKey))} y os perdonan ${escapeHtml(money(q.forgiven, true))}`;
    else cuando = `para cuando se junta (${escapeHtml(caminoMonthText(q.payoffMonthKey))}), con las cuotas ya debéis menos de lo ofrecido: no os perdonaría nada`;
    return `<li><strong>${escapeHtml(q.label)}:</strong> pagar ${escapeHtml(money(q.amount, true))} de ${escapeHtml(money(q.principal, true))} ${rinde}; ${cuando}.</li>`;
  });
  const ignoradas = (r.quitasIgnoradas || []).map((id) => {
    const oferta = ofertas.find((o) => o.id === id);
    const c = (contracts || []).find((row) => String(row?.id) === id);
    const nombre = c ? [c.entity, c.type].filter(Boolean).join(" ").trim() || c.label || "esa deuda" : "esa deuda";
    return `<li>La oferta${oferta ? ` de ${escapeHtml(money(oferta.amount, true))}` : ""} para ${escapeHtml(nombre)} no baja de lo que debéis (o la deuda ya tiene un acuerdo aceptado): no entra como quita.</li>`;
  });
  if (!items.length && !ignoradas.length) return "";
  return `<div class="plan-optimo-quitas-resultado"><p class="cam-frase"><strong>Quitas en el plan</strong></p><ul class="plan-optimo-tramos">${items.join("")}${ignoradas.join("")}</ul>
    <p class="e19-kpi-note">Proponer una quita a la entidad se hace en <a href="#deuda-simulador">Ofertas › Simulador visual</a>, que antes os enseña «Qué ocurrirá». Desde aquí no se propone ni se acepta nada.</p></div>`;
}

// UND-12: cuánto pone cada mes y la comparación honesta con un importe fijo que tampoco baja del suelo (la v1 con la misma liquidez mínima).
function planOptimoLiquidezHtml(r, liquidez, fijo) {
  if (!liquidez?.ok) return "";
  const doce = liquidez.byMonth.slice(0, 12);
  const min = Math.min(...doce);
  const max = Math.max(...doce);
  const partes = [`<p class="cam-frase"><strong>Lo que permite la previsión</strong> sin bajar del suelo (${escapeHtml(money(liquidez.floor, true))}): ${min === max ? `${escapeHtml(money(min, true))} al mes` : `de ${escapeHtml(money(min, true))} a ${escapeHtml(money(max, true))} según el mes`}, ${escapeHtml(money(liquidez.total12, true))} en los próximos 12 meses. Los meses de recibos fuertes ponen menos y los de pagas extra, más.</p>`];
  if (liquidez.belowFloor) partes.push(`<p class="e19-kpi-note"><strong>La previsión ya baja del suelo en ${escapeHtml(caminoMonthText(liquidez.belowFloor.monthKey))}</strong> sin poner nada de más: hasta ese mes no se pone extra. Miradlo en Plan › Previsión.</p>`);
  const s = r.recommended.summary;
  const f = fijo?.ok && !fijo.nothing && !fijo.sinDatos ? fijo.recommended.summary : null;
  if (f && s.totalInterest !== null && f.totalInterest !== null && s.debtFreeMonthKey && f.debtFreeMonthKey) {
    const dif = Math.round((f.totalInterest - s.totalInterest) * 100) / 100;
    const meses = (f.monthsToDebtFree || 0) - (s.monthsToDebtFree || 0);
    const veredicto = dif > 0 || meses > 0
      ? `mes a mes acabáis ${meses > 0 ? `${caminoMonths(meses)} antes` : "en la misma fecha"} y pagáis ${escapeHtml(money(Math.max(0, dif), true))} menos de intereses.`
      : dif < 0 || meses < 0
        ? `aquí el importe fijo sale mejor: ${meses < 0 ? `acaba ${caminoMonths(-meses)} antes y ` : ""}paga ${escapeHtml(money(Math.max(0, -dif), true))} menos de intereses. Podéis elegirlo en «Un importe fijo».`
        : "sale igual.";
    partes.push(`<p class="e19-kpi-note">Frente a un importe fijo que tampoco baja del suelo ningún mes (${escapeHtml(money(fijo.monthly, true))} al mes: libres en ${escapeHtml(caminoMonthText(f.debtFreeMonthKey))}): ${veredicto}</p>`);
  }
  return partes.join("");
}

function planOptimoAvisosHtml(r, refs) {
  const notes = [];
  for (const w of r.warnings) {
    if (w.id === "por-encima-capacidad") notes.push(`<strong>Por encima de vuestra capacidad libre</strong> (${escapeHtml(money(w.capacity, true))} al mes): con más, la previsión puede bajar del suelo algún mes. Miradlo en Plan › Previsión.`);
    if (w.id === "por-encima-disponible") notes.push(`<strong>El pago inicial pasa de lo que sobra sobre el suelo del colchón</strong> en los próximos 12 meses (${escapeHtml(money(w.available, true))}): os quedaríais por debajo del colchón.`);
    if (w.id === "pago-inicial-sobra") notes.push(`Del pago inicial sobran ${escapeHtml(money(w.amount, true))}: con lo demás ya se saldan las deudas que entran en la cuenta.`);
    if (w.id === "comision-quita") notes.push(`<strong>La comisión de ${escapeHtml(w.label)} no cuenta:</strong> el plan la cancela con la quita, y una quita no es amortizar.`);
    if (w.id === "comision-baja") notes.push(`<strong>Esperad a ${escapeHtml(caminoMonthText(w.desde))} para amortizar ${escapeHtml(w.label)}:</strong> su comisión pasa del ${escapeHtml(planOptimoPct(w.pct))} al ${escapeHtml(planOptimoPct(w.nextPct))}. Lo previsto de más antes de esa fecha (${escapeHtml(money(w.antes, true))}) pagaría ${escapeHtml(money(w.ahorro, true))} más de comisión. El plan no lo retrasa solo: decidid si esperar.`);
    if (w.id === "fuera") {
      // DUO-D9: sin desglose (motor anterior), todo como «sin datos».
      const datos = w.datos || { count: w.count, principal: w.principal };
      if (datos.count) notes.push(`<strong>No entran en la cuenta</strong> ${datos.count === 1 ? "una deuda" : `${datos.count} deudas`} (${escapeHtml(money(datos.principal, true))}) sin cuota activa o sin TAE ni plazo; las fechas son las de las demás. Completadlas en Contratos.`);
      if (w.enImpago && w.enImpago.count) notes.push(caminoImpagoNota(w.enImpago.labels.map((label) => ({ label })), w.enImpago, true));
    }
  }
  if (refs.available !== null && !r.lump && refs.available > 0) notes.push(`Por encima del suelo del colchón tenéis unos ${escapeHtml(money(refs.available, true))} que la previsión no toca en 12 meses: probad a poner parte como pago inicial.`);
  notes.push("Se calcula con «Camino a deuda cero» (capital, cuota y TAE de cada contrato), pero aquí las cuotas que se liberan al saldar una deuda <strong>sí</strong> pasan a la siguiente. A lo pactado con una entidad no se le adelanta nada. Las comisiones por amortizar antes cuentan si las escribís en «Comisión por amortizar antes»; el tipo es el de hoy (con tipo variable, se da el rango si el Euribor sube o baja un punto). Una quita se supone en pie hasta que se paga, y mientras se junta la deuda sigue con su cuota. Es una propuesta: no ejecuta nada.");
  return notes.map((note) => `<p class="e19-kpi-note">${note}</p>`).join("");
}

function planOptimoHtml(engine, contracts, todayKey, refs, Plan) {
  if (!Plan) return "";
  const fijoMensual = planOptimoMensual === null ? Math.max(0, Math.floor((refs.capacity || 0) / 10) * 10) : planOptimoMensual;
  const liquidez = typeof Plan.liquidityPlan === "function" && refs.floor !== null ? Plan.liquidityPlan(refs.rows, { startMonthKey: todayKey, floor: refs.floor, lump: planOptimoPago }) : { ok: false };
  const modo = planOptimoModoEfectivo(liquidez);
  const ofertas = planOptimoQuitas(contracts);
  const comunes = {
    startMonthKey: todayKey, lump: planOptimoPago, order: caminoOrder(contracts), available: refs.available,
    strategy: planOptimoOrdenGuardado(), tolerance: planOptimoMargenGuardado(), settlements: ofertas, commissions: planOptimoComisiones(contracts),
  };
  const r = modo === "prevision"
    ? Plan.plan(engine, contracts, { ...comunes, monthly: liquidez.after, monthlyByMonth: liquidez.byMonth })
    : Plan.plan(engine, contracts, { ...comunes, monthly: fijoMensual, capacity: refs.capacity });
  planOptimoResultadoUltimo = r; // DUO-D1: el seguimiento del plan guarda y compara este resultado
  const fijo = modo === "prevision" && r.ok ? Plan.plan(engine, contracts, { ...comunes, monthly: liquidez.fixedSafe, strategy: r.recommended.strategy }) : null;
  if (!r.ok) return `<p class="e19-kpi-note">${escapeHtml(r.error)}</p>`;
  if (r.nothing) return `<p class="e19-kpi-note">No hay deudas con capital pendiente: no hay plan que hacer.</p>`;
  if (r.sinDatos) return `<p class="e19-kpi-note"><strong>No se puede calcular.</strong> Ninguna deuda tiene cuota activa con TAE o plazo: completadlas en Contratos.</p>`;
  const s = r.recommended.summary;
  const base = r.baseline;
  // UND-11: con quitas, lo que se ahorra son los intereses más lo perdonado.
  const ahorroHero = s.commissionCost > 0
    ? caminoHeroHtml("Lo que os ahorráis", s.totalSaved === null ? "—" : money(s.totalSaved, true), `${s.interestSaved === null ? "" : `${money(s.interestSaved, true)} de intereses`}${s.forgiven > 0 ? ` + ${money(s.forgiven, true)} perdonados` : ""} − ${money(s.commissionCost, true)} de comisiones`)
    : s.forgiven > 0
    ? caminoHeroHtml("Lo que os ahorráis", s.totalSaved === null ? "—" : money(s.totalSaved, true), `${s.interestSaved === null ? "" : `${money(s.interestSaved, true)} de intereses + `}${money(s.forgiven, true)} que os perdonan`)
    : caminoHeroHtml("Intereses que os ahorráis", s.interestSaved === null ? "—" : money(s.interestSaved, true), s.totalInterest === null ? "alguna deuda no acaba" : `pagaréis ${money(s.totalInterest, true)} en lugar de ${money(base.totalInterest ?? 0, true)}`);
  const heroes = `<div class="cam-heroes">
      ${caminoHeroHtml(planOptimoHeroLabel(r), s.debtFreeMonthKey ? caminoMonthText(s.debtFreeMonthKey) : "sin fecha", `${s.monthsSaved > 0 ? `${caminoMonths(s.monthsSaved)} antes que hoy (${caminoMonthText(base.debtFreeMonthKey)})` : base.beyondHorizon ? "hoy alguna deuda no acaba" : "como el calendario actual"}${planOptimoHeroFuera(r)}`)}
      ${ahorroHero}
      ${caminoHeroHtml("Primera deuda saldada", s.firstPayoff ? s.firstPayoff.label : "—", s.firstPayoff ? caminoMonthText(s.firstPayoff.payoffMonthKey) : "")}
    </div>`;
  const pago = r.recommended.lumpApplied.length
    ? `<p class="e19-kpi-note">El pago inicial va a ${r.recommended.lumpApplied.map((x) => `${escapeHtml(x.label)} (${escapeHtml(money(x.amount, true))}${x.settles ? ", la salda" : ""})`).join(" y ")}.</p>`
    : "";
  const sinPrevision = modo === "fijo" && planOptimoModo !== "fijo" ? `<p class="e19-kpi-note">Sin previsión mensual todavía, el plan pone un importe fijo (de entrada, la capacidad libre).</p>` : "";
  // DUO-D5: con la misma liquidez de base (lo de cada mes de la previsión o el importe fijo), cada 50 € más.
  const liquidezBase = modo === "prevision" ? { monthly: liquidez.after, byMonth: liquidez.byMonth } : { monthly: fijoMensual, byMonth: null };
  const cada50 = planOptimoCada50Html(planOptimoCada50(Plan, engine, contracts, comunes, r, liquidezBase));
  const opcionesVivas = { ...comunes, strategy: r.recommended.strategy, monthly: liquidezBase.monthly, ...(liquidezBase.byMonth ? { monthlyByMonth: liquidezBase.byMonth } : {}) };
  const euribor = planOptimoEuriborHtml(Plan, engine, contracts, opcionesVivas, r);
  const cuotaPlazo = planOptimoCuotaPlazoHtml(r, contracts, liquidez, modo);
  // DUO-D4 (duodécima auditoría): la cascada del siguiente euro ya existe, la escalera de WP-42 (Deuda › Ofertas › Comparar). No se duplica:
  // el plan lleva a ella para la pregunta de antes, «¿todo a deuda?».
  const escalera = `<p class="e19-kpi-note" data-plan-optimo-escalera>¿Todo lo que sobra a deuda? <a href="#deuda-comparar">La escalera del próximo euro</a> reparte un importe entre colchón, deuda cara, pensión e inversión, con el coste de cada deuda tras impuestos.</p>`;
  return `${planOptimoPreguntaHtml(r)}${heroes}${euribor}${planOptimoRazonHtml(r)}${modo === "prevision" ? planOptimoLiquidezHtml(r, liquidez, fijo) : sinPrevision}${planOptimoTramosHtml(r.recommended.periods)}${cada50}${pago}${cuotaPlazo}${escalera}${planOptimoQuitasHtml(r, ofertas, contracts)}${planOptimoAvisosHtml(r, refs)}`;
}

// La llama renderDeudaRuta (views/deuda.js) junto a la del camino, con el motor del camino y el del plan.
function renderPlanOptimo(engine, contracts, Plan) {
  const box = qs("planOptimoResultado");
  if (!box || !engine || !Plan) return;
  attachPlanOptimo(document);
  planOptimoLast = { engine, contracts, Plan };
  try {
    const refs = planOptimoReferencias();
    const mensual = qs("planOptimoMensual");
    if (mensual && planOptimoMensual === null && document.activeElement !== mensual) mensual.value = String(Math.max(0, Math.floor((refs.capacity || 0) / 10) * 10));
    planOptimoSincronizarControles();
    planOptimoPintarQuitas(contracts || []);
    planOptimoPintarComisiones(contracts || []);
    const html = planOptimoHtml(engine, contracts || [], isoLocalDate(new Date()).slice(0, 7), refs, Plan);
    if (box.__planHtml !== html) {
      box.innerHTML = html;
      box.__planHtml = html;
    }
    globalThis.renderSeguimientoPlan?.(planOptimoResultadoUltimo, contracts || []); // DUO-D1 (seguimiento-plan-ui.js)
    globalThis.renderHitosDeuda?.(); // DUO-D2 (hitos-deuda-ui.js)
  } catch (error) {
    console.error(`renderPlanOptimo: ${error.message}`);
  }
}

// Los controles de orden y margen dicen lo guardado (sin pisar lo que se está escribiendo).
function planOptimoSincronizarControles() {
  const modo = planOptimoModo || "prevision";
  document.querySelectorAll('input[name="planOptimoModo"]').forEach((radio) => { radio.checked = radio.value === modo; });
  const orden = planOptimoOrdenGuardado() || "avalancha";
  document.querySelectorAll('input[name="planOptimoOrden"]').forEach((radio) => { radio.checked = radio.value === orden; });
  const margen = globalThis.FinanceCanonicalDebtOptimalPlan?.tolerance?.(planOptimoMargenGuardado());
  if (!margen) return;
  const pct = qs("planOptimoMargenPct");
  const abs = qs("planOptimoMargenAbs");
  if (pct && document.activeElement !== pct && !pct.hasAttribute("aria-invalid")) pct.value = String(Math.round(margen.pct * 1000) / 10);
  if (abs && document.activeElement !== abs && !abs.hasAttribute("aria-invalid")) abs.value = String(margen.abs);
}

function planOptimoRepintar() {
  if (planOptimoLast) renderPlanOptimo(planOptimoLast.engine, planOptimoLast.contracts, planOptimoLast.Plan);
}

function planOptimoElegirOrden(value, enfocar) {
  if (value !== "avalancha" && value !== "bola-nieve") return;
  planOptimoGuardar(PLAN_OPTIMO_ORDEN_KEY, value);
  planOptimoRepintar();
  if (enfocar) document.querySelector(`input[name="planOptimoOrden"][value="${value}"]`)?.focus();
  const note = qs("planOptimoNota");
  if (note) note.textContent = value === "bola-nieve" ? "Orden guardado: primero la más pequeña. Podéis cambiarlo en «Orden»." : "Orden guardado: primero la más cara. Podéis cambiarlo en «Orden».";
}

function planOptimoOnMargen(target) {
  const raw = String(target.value || "").replace(",", ".").trim();
  const value = raw === "" ? NaN : Number(raw);
  const max = target.id === "planOptimoMargenPct" ? 50 : 100000;
  const note = qs("planOptimoNota");
  if (!Number.isFinite(value) || value < 0 || value > max) {
    target.setAttribute("aria-invalid", "true");
    if (note) note.textContent = target.id === "planOptimoMargenPct" ? "Escribe un porcentaje entre 0 y 50, por ejemplo 3." : "Escribe un importe de 0 € o más, por ejemplo 150.";
    return;
  }
  target.removeAttribute("aria-invalid");
  if (note) note.textContent = "";
  const actual = globalThis.FinanceCanonicalDebtOptimalPlan?.tolerance?.(planOptimoMargenGuardado()) || { pct: 0.03, abs: 150 };
  const next = target.id === "planOptimoMargenPct" ? { ...actual, pct: Math.round(value * 10) / 1000 } : { ...actual, abs: Math.round(value * 100) / 100 };
  planOptimoGuardar(PLAN_OPTIMO_MARGEN_KEY, JSON.stringify(next));
  planOptimoRepintar();
}

function planOptimoOnChange(event) {
  const target = event.target;
  if (target?.name === "planOptimoOrden") planOptimoElegirOrden(target.value, false);
  if (target?.name === "planOptimoModo" && (target.value === "prevision" || target.value === "fijo")) {
    planOptimoModo = target.value;
    planOptimoRepintar();
  }
}

// UND-11: una quita escrita se guarda al momento (vaciarla guarda 0: «sin oferta», también frente a la registrada en Contratos).
function planOptimoOnQuita(target) {
  const raw = String(target.value || "").replace(",", ".").trim();
  const value = raw === "" ? 0 : Number(raw);
  const note = qs("planOptimoNota");
  if (!Number.isFinite(value) || value < 0 || value > 100000) {
    target.setAttribute("aria-invalid", "true");
    if (note) note.textContent = "Escribe la quita como un importe de 0 € o más, por ejemplo 1500 (vacío: sin oferta).";
    return;
  }
  target.removeAttribute("aria-invalid");
  if (note) note.textContent = "";
  const actuales = planOptimoGuard(() => JSON.parse(storageGet(storageKey(PLAN_OPTIMO_QUITAS_KEY), "{}")), {}) || {};
  actuales[target.dataset.planOptimoQuita] = Math.round(value * 100) / 100;
  planOptimoGuardar(PLAN_OPTIMO_QUITAS_KEY, JSON.stringify(actuales));
  planOptimoRepintar();
}

function planOptimoOnClick(event) {
  const button = event.target?.closest?.("[data-plan-optimo-orden]");
  if (button) planOptimoElegirOrden(button.dataset.planOptimoOrden, true);
}

function planOptimoOnInput(event) {
  const target = event.target;
  if (target && (target.id === "planOptimoMargenPct" || target.id === "planOptimoMargenAbs")) { planOptimoOnMargen(target); return; }
  if (target?.dataset?.planOptimoQuita !== undefined) { planOptimoOnQuita(target); return; }
  if (target?.dataset?.planOptimoComision !== undefined) { planOptimoOnComision(target); return; }
  if (!target || (target.id !== "planOptimoMensual" && target.id !== "planOptimoPago")) return;
  const parsed = caminoParseExtra(target.value);
  const note = qs("planOptimoNota");
  if (parsed === null) {
    target.setAttribute("aria-invalid", "true");
    if (note) note.textContent = "Escribe un importe de 0 € o más, por ejemplo 150.";
    return;
  }
  target.removeAttribute("aria-invalid");
  if (note) note.textContent = "";
  if (target.id === "planOptimoMensual") {
    planOptimoMensual = parsed;
    planOptimoModo = "fijo"; // UND-12: escribir un importe es elegir el importe fijo
  } else planOptimoPago = parsed;
  planOptimoRepintar();
}

function attachPlanOptimo(doc) {
  if (!doc || doc.__planOptimoAttached) return false;
  doc.__planOptimoAttached = true;
  doc.addEventListener("input", planOptimoOnInput);
  doc.addEventListener("change", planOptimoOnChange);
  doc.addEventListener("click", planOptimoOnClick);
  return true;
}
