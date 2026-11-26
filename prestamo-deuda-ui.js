// Deuda › Préstamo para saldar (14/11/2026, petición del hogar): la pestaña para mirar en pareja un préstamo personal que cancele
// las deudas más caras y un plan agresivo para saldarlo todo. El cálculo vive en canonical-loan-payoff-plan.js (puro, sobre el
// motor de «Camino a deuda cero»); aquí solo se leen los contratos que ya declara Deuda › Contratos, se pinta y se atienden los
// controles. Los parámetros se recuerdan en este navegador (almacén local de la app, como la oferta de reunificación de Comparar):
// no son datos del hogar sino una simulación. No pide, firma ni escribe nada en el plan (A11-4).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, storageSet,
// storageKey, escenarioMotorDebtOptions…). Sin DOM al cargarse: views/deuda.js llama a `renderPrestamoDeuda` desde
// `renderDeudaPrestamo`, que engancha las escuchas la primera vez. Los controles están en index.html y nunca se repintan (así el
// foco y lo tecleado no se pierden); solo se repinta el resultado.
const PRESTAMO_STORE_KEY = "deuda-prestamo-saldar";
const PRESTAMO_FIELDS = {
  capital: { id: "prestamoCapital", range: "prestamoCapitalRango", integer: false },
  months: { id: "prestamoPlazo", range: "prestamoPlazoRango", integer: true },
  tinPct: { id: "prestamoTin" },
  openingFeePct: { id: "prestamoComision" },
  earlyFeePct: { id: "prestamoComisionAnticipada" },
  extraMonthly: { id: "prestamoExtra" },
  monthlyIncome: { id: "prestamoIngresos" },
};
let prestamoState = null;
let prestamoLastError = "";

function prestamoEngine() {
  return globalThis.FinanceCanonicalLoanPayoffPlan || null;
}

function prestamoDefaults() {
  const engine = prestamoEngine();
  const base = engine ? engine.DEFAULTS : { capital: 16500, months: 72, tinPct: 8.5, openingFeePct: 0, earlyFeePct: 0, extraMonthly: 0, keepPaying: true };
  return {
    capital: base.capital,
    months: base.months,
    tinPct: base.tinPct,
    openingFeePct: base.openingFeePct,
    earlyFeePct: base.earlyFeePct,
    extraMonthly: base.extraMonthly,
    monthlyIncome: null,
    keepPaying: base.keepPaying,
    includeMortgage: false,
    holder: "",
    selection: "auto",
    label: "",
    insuranceMonthly: 0,
    offerB: prestamoOfferBEmpty(),
  };
}

// 26/11/2026 · «Comparar con otra oferta»: los campos de la segunda oferta (sin deslizadores) y su estado vacío.
const PRESTAMO_B_FIELDS = {
  capital: { id: "prestamoBCapital", integer: false },
  months: { id: "prestamoBPlazo", integer: true },
  tinPct: { id: "prestamoBTin" },
  openingFeePct: { id: "prestamoBComision" },
  earlyFeePct: { id: "prestamoBComisionAnticipada" },
  insuranceMonthly: { id: "prestamoBSeguro" },
};

function prestamoOfferBEmpty() {
  return { label: "", capital: null, months: null, tinPct: null, openingFeePct: 0, earlyFeePct: 0, insuranceMonthly: 0 };
}

/** La segunda oferta cuenta cuando tiene capital, plazo y TIN. */
function prestamoOfferBReady(offer) {
  return Boolean(offer) && ["capital", "months", "tinPct"].every((key) => offer[key] !== null && offer[key] !== undefined && Number.isFinite(Number(offer[key])));
}

// Los ingresos del hogar que ya conoce la app (los mismos que lee el guardarraíl de apalancamiento), solo como valor de partida.
function prestamoKnownIncome() {
  try {
    const fromState = typeof state !== "undefined" && state ? Number(state.baseHouseholdIncome) : NaN;
    if (Number.isFinite(fromState) && fromState > 0) return fromState;
    const fromBase = typeof baseData !== "undefined" && baseData ? Number(baseData.assumptions?.monthlyIncome) : NaN;
    return Number.isFinite(fromBase) && fromBase > 0 ? fromBase : null;
  } catch {
    return null;
  }
}

function prestamoLoad() {
  const defaults = prestamoDefaults();
  let saved = {};
  try {
    const raw = typeof storageGet === "function" ? storageGet(storageKey(PRESTAMO_STORE_KEY), "{}") : "{}";
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") saved = parsed;
  } catch {
    saved = {};
  }
  const num = (value, fallback) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? fallback : Number(value));
  const loaded = {
    capital: num(saved.capital, defaults.capital),
    months: Math.round(num(saved.months, defaults.months)),
    tinPct: num(saved.tinPct, defaults.tinPct),
    openingFeePct: num(saved.openingFeePct, defaults.openingFeePct),
    earlyFeePct: num(saved.earlyFeePct, defaults.earlyFeePct),
    extraMonthly: num(saved.extraMonthly, defaults.extraMonthly),
    monthlyIncome: num(saved.monthlyIncome, prestamoKnownIncome()),
    keepPaying: typeof saved.keepPaying === "boolean" ? saved.keepPaying : defaults.keepPaying,
    includeMortgage: saved.includeMortgage === true,
    holder: typeof saved.holder === "string" ? saved.holder.slice(0, 40) : "",
    selection: Array.isArray(saved.selection) ? saved.selection.map(String).slice(0, 40) : "auto",
    label: typeof saved.label === "string" ? saved.label.slice(0, 40) : "",
    insuranceMonthly: num(saved.insuranceMonthly, 0),
    offerB: (() => {
      const b = saved.offerB && typeof saved.offerB === "object" ? saved.offerB : {};
      const empty = prestamoOfferBEmpty();
      return {
        label: typeof b.label === "string" ? b.label.slice(0, 40) : "",
        capital: num(b.capital, empty.capital),
        months: b.months === null || b.months === undefined ? null : Math.round(num(b.months, 0)) || null,
        tinPct: num(b.tinPct, empty.tinPct),
        openingFeePct: num(b.openingFeePct, 0),
        earlyFeePct: num(b.earlyFeePct, 0),
        insuranceMonthly: num(b.insuranceMonthly, 0),
      };
    })(),
  };
  return loaded;
}

function prestamoSave() {
  if (!prestamoState || typeof storageSet !== "function") return;
  try {
    storageSet(storageKey(PRESTAMO_STORE_KEY), JSON.stringify(prestamoState));
  } catch {
    // Sin almacén (modo privado), la simulación sigue funcionando en memoria.
  }
}

function prestamoPct(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

function prestamoMonthText(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key || "");
  if (!match) return "sin fecha";
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function prestamoSpan(months) {
  if (!Number.isFinite(months)) return "—";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years ? `${years} ${years === 1 ? "año" : "años"}` : "";
  const m = rest ? `${rest} ${rest === 1 ? "mes" : "meses"}` : "";
  return [y, m].filter(Boolean).join(" y ") || "0 meses";
}

function prestamoMonths(count) {
  return `${count} ${count === 1 ? "mes" : "meses"}`;
}

function prestamoOptions(todayKey) {
  const s = prestamoState;
  return {
    startMonthKey: todayKey,
    loan: { capital: s.capital, months: s.months, tinPct: s.tinPct, openingFeePct: s.openingFeePct },
    selection: s.selection,
    extraMonthly: s.extraMonthly,
    keepPaying: s.keepPaying,
    earlyFeePct: s.earlyFeePct,
    monthlyIncome: s.monthlyIncome,
    includeMortgage: s.includeMortgage,
    holder: s.holder,
  };
}

function prestamoOfferHtml(result) {
  const t = result.terms;
  const holder = result.holder ? ` · a nombre de ${escapeHtml(result.holder)}` : "";
  const feeRow = t.openingFee > 0
    ? `<div class="pre-linea pre-sub"><span>— Comisión de apertura (${prestamoPct(t.openingFeePct)})</span><span>${money(t.openingFee, true)}</span></div>
       <div class="pre-linea pre-sub"><span>Dinero que se recibe</span><span>${money(t.netFunds, true)}</span></div>`
    : `<div class="pre-linea pre-sub"><span>— Comisión de apertura (0 %)</span><span>${money(0, true)}</span></div>`;
  return `<article class="e19-card pre-oferta" aria-labelledby="prestamoOfertaTitulo">
      <h3 class="pre-oferta-titulo" id="prestamoOfertaTitulo">Cuota mensual</h3>
      <p class="pre-cuota">${money(t.payment, true)}</p>
      <div class="pre-tipos"><div><strong>${prestamoPct(t.tinPct)}</strong><span>TIN</span></div><div><strong>${prestamoPct(t.taePct)}</strong><span>TAE</span></div></div>
      <p class="pre-oferta-resumen">${money(t.capital, true)} · ${prestamoMonths(t.months)} (${prestamoSpan(t.months)})${holder}</p>
      <div class="pre-linea"><span>Importe solicitado</span><strong>${money(t.capital, true)}</strong></div>
      <div class="pre-linea"><span>Coste total del préstamo</span><strong>${money(t.totalCost, true)}</strong></div>
      <div class="pre-linea pre-sub"><span>— Total intereses</span><span>${money(t.totalInterest, true)}</span></div>
      ${feeRow}
      <div class="pre-linea pre-total"><span>Importe total adeudado</span><strong>${money(round2(t.totalOwed + t.openingFee), true)}</strong></div>
      ${prestamoSeguroLineaHtml(t, prestamoState.insuranceMonthly)}
    </article>`;
}

// Con seguros o vinculaciones, lo que de verdad cuesta al mes y al año (la TAE no los incluye).
function prestamoSeguroLineaHtml(terms, seguro) {
  if (!(Number(seguro) > 0)) return "";
  const engine = prestamoEngine();
  const irr = engine?.monthlyIrr ? engine.monthlyIrr(terms.netFunds, terms.payment + Number(seguro), terms.months) : null;
  const efectivo = irr === null ? null : round2((Math.pow(1 + irr, 12) - 1) * 100);
  return `<p class="e19-kpi-note pre-seguro-nota" data-prestamo-seguro-nota>Con ${money(Number(seguro), true)} al mes de seguros o vinculaciones, la cuota es ${money(round2(terms.payment + Number(seguro)), true)} y el coste efectivo anual, ${prestamoPct(efectivo)} (la TAE no los cuenta).</p>`;
}

// La frase con UNA cifra: cuándo se acaba la deuda con el plan agresivo, y la comparación honesta con pagar lo mismo sin préstamo.
function prestamoVerdictHtml(result) {
  const { today, aggressive, sameEffort } = result.paths;
  if (!result.cancelled.length || !aggressive) {
    return `<article class="e19-card pre-veredicto"><p class="pre-veredicto-titulo">Este préstamo no cancela ninguna deuda</p>
      <p class="e19-kpi-note">${escapeHtml(result.warnings[0] || "Elige qué deudas cancelar.")}</p></article>`;
  }
  const scope = result.includeMortgage ? "Deuda cero" : "Deuda de consumo cero";
  const title = aggressive.debtFreeMonthKey ? `${scope} en ${prestamoMonthText(aggressive.debtFreeMonthKey)}` : `${scope}: alguna deuda no acaba`;
  const parts = [];
  if (today && aggressive.debtFreeMonthKey && today.debtFreeMonthKey && !today.beyondHorizon) {
    const saved = today.monthsToDebtFree - aggressive.monthsToDebtFree;
    parts.push(saved > 0 ? `${prestamoMonths(saved)} antes que hoy` : saved < 0 ? `${prestamoMonths(-saved)} después que hoy` : "la misma fecha que hoy");
    const costDiff = round2(today.totalCost - aggressive.totalCost);
    parts.push(costDiff >= 0 ? `${money(costDiff, true)} menos de intereses y comisiones` : `${money(-costDiff, true)} más de intereses y comisiones`);
  }
  const monthlyLine = result.keepPaying
    ? `pagando ${money(result.aggressiveMonthly, true)} al mes en deudas, lo mismo que hoy${prestamoState.extraMonthly > 0 ? ` más ${money(prestamoState.extraMonthly, true)} de extra` : ""}`
    : `pagando ${money(result.aggressiveMonthly, true)} al mes en deudas`;
  let honest = "";
  if (sameEffort && sameEffort.debtFreeMonthKey && aggressive.debtFreeMonthKey && !sameEffort.beyondHorizon) {
    const months = sameEffort.monthsToDebtFree - aggressive.monthsToDebtFree;
    const money2 = round2(sameEffort.totalCost - aggressive.totalCost);
    const gain = [];
    if (months > 0) gain.push(`os adelanta ${prestamoMonths(months)}`);
    if (money2 > 0.5) gain.push(`os ahorra ${money(money2, true)}`);
    const loss = [];
    if (months < 0) loss.push(`acabáis ${prestamoMonths(-months)} más tarde`);
    if (money2 < -0.5) loss.push(`pagáis ${money(-money2, true)} más`);
    const verdict = gain.length && !loss.length
      ? `el préstamo ${gain.join(" y ")}.`
      : gain.length
        ? `el préstamo ${gain.join(" y ")}, pero ${loss.join(" y ")}.`
        : loss.length
          ? `con el préstamo ${loss.join(" y ")}: lo que aporta es una cuota más baja, no velocidad.`
          : "el préstamo da lo mismo: lo que aporta es una cuota más baja.";
    honest = `<p class="pre-veredicto-honesto">Sin préstamo, poniendo el mismo dinero al mes en vuestras deudas de hoy, llegaríais en ${escapeHtml(prestamoMonthText(sameEffort.debtFreeMonthKey))}: ${escapeHtml(verdict)}</p>`;
  }
  return `<article class="e19-card pre-veredicto" aria-labelledby="prestamoVeredictoTitulo">
      <p class="pre-veredicto-eyebrow">Plan agresivo</p>
      <p class="pre-veredicto-titulo" id="prestamoVeredictoTitulo">${escapeHtml(title)}</p>
      <p class="pre-veredicto-sub">${escapeHtml([monthlyLine, ...parts].join(" · "))}</p>
      ${honest}
    </article>`;
}

function prestamoCancelHtml(result) {
  if (!result.candidates.length) {
    return `<article class="e19-card pre-cancela"><h3 class="escenario-motor-panel-title">Qué cancela</h3>
      <p class="e19-kpi-note">No hay deudas con capital pendiente${result.includeMortgage ? "" : " (sin contar la hipoteca)"}. Dalas de alta en <a href="#deuda-contratos">Contratos</a>.</p></article>`;
  }
  const byId = new Map(result.allocations.map((row) => [row.id, row]));
  const rows = result.candidates.map((row) => {
    const allocation = byId.get(row.id);
    const checked = allocation && allocation.amount > 0;
    const selected = Array.isArray(prestamoState.selection) ? prestamoState.selection.includes(row.id) : checked;
    const id = `prestamoSel-${row.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const status = !allocation
      ? row.aprPct !== null && result.terms.taePct !== null && row.aprPct <= result.terms.taePct ? "más barata que el préstamo" : "se queda"
      : allocation.unfunded ? "no llega el dinero" : allocation.full ? "se cancela entera" : `se cancela en parte (${money(allocation.amount, true)})`;
    const freed = allocation && allocation.full && allocation.freedPayment > 0 ? `libera ${money(allocation.freedPayment, true)}/mes` : row.projected ? `${money(row.payment, true)}/mes` : "sin cuota activa";
    return `<li class="pre-deuda${checked ? " pre-deuda-sel" : ""}">
        <input type="checkbox" id="${escapeHtml(id)}" data-prestamo-sel="${escapeHtml(row.id)}"${selected ? " checked" : ""} />
        <label for="${escapeHtml(id)}"><span class="pre-deuda-nombre">${escapeHtml(row.label)}${row.revolving ? ' <span class="e19-badge e19-badge-neutral">tarjeta o línea</span>' : ""}</span>
          <span class="pre-deuda-datos">${money(row.principal, true)} pendiente · TAE ${prestamoPct(row.aprPct)}${row.rateSource === "implied" ? " (deducida)" : ""} · ${escapeHtml(freed)}</span></label>
        <span class="pre-deuda-estado">${escapeHtml(status)}</span>
      </li>`;
  }).join("");
  const mode = result.selection === "manual"
    ? `Elegidas a mano. <button type="button" class="pre-enlace" data-prestamo-auto>Volver a la selección automática</button>`
    : "Selección automática: las más caras que el préstamo, de la TAE más alta a la más baja, hasta agotar el dinero. Marca o desmarca para elegir a mano.";
  const summary = result.allocated > 0
    ? `<p class="pre-cancela-resumen">Cancela <strong>${money(result.allocated, true)}</strong>${result.weightedAprPct !== null ? ` con una TAE media del ${prestamoPct(result.weightedAprPct)}` : ""} y libera <strong>${money(result.freedPayments, true)} al mes</strong> de cuotas, frente a ${money(result.terms.payment, true)} de la cuota nueva.</p>`
    : "";
  const leftOut = result.mortgagesLeftOut.length
    ? `<p class="e19-kpi-note">Fuera de la cuenta: ${result.mortgagesLeftOut.map((row) => `${escapeHtml(row.label)} (${money(row.principal, true)})`).join(", ")}. Un préstamo personal no la cancela; márcala en «Contar la hipoteca» para verla dentro.</p>`
    : "";
  return `<article class="e19-card pre-cancela" aria-labelledby="prestamoCancelaTitulo">
      <h3 class="escenario-motor-panel-title" id="prestamoCancelaTitulo">Qué cancela</h3>
      <p class="e19-kpi-note">${mode}</p>
      <ul class="pre-deudas">${rows}</ul>
      ${summary}${leftOut}
      <p class="e19-kpi-note">Los datos salen de <a href="#deuda-contratos">Deuda › Contratos</a>: si una cifra no cuadra, corrígela allí y se recalcula aquí.</p>
    </article>`;
}

function prestamoChecksHtml(result) {
  const items = result.checks.map((check) => {
    const fix = !check.pass && check.fixMonths ? `<button type="button" class="e19-btn e19-btn-secondary pre-probar" data-prestamo-fix-months="${check.fixMonths}">Probar a ${check.fixMonths} meses</button>` : "";
    const detail = check.id === "intereses" && Number.isFinite(check.diff)
      ? (check.diff > 0 ? `${money(check.diff, true)} más que hoy si solo se paga la cuota nueva` : `${money(-check.diff, true)} menos que hoy`)
      : check.detail.replace(/(\d+(?:\.\d+)?) €/g, (match, value) => money(Number(value), true));
    return `<li class="pre-check-item${check.pass ? " pre-ok" : " pre-ko"}">
        <span class="pre-check-icono" aria-hidden="true">${check.pass ? "✓" : "✕"}</span>
        <span class="pre-check-texto"><strong>${escapeHtml(check.title)}</strong><small>${escapeHtml(detail)}</small></span>
        <span class="sr-only">${check.pass ? "Cumple" : "No cumple"}</span>${fix}
      </li>`;
  }).join("");
  const income = result.checks.some((check) => check.id === "ratio") ? "" : `<p class="e19-kpi-note">Sin ingresos del hogar no se juzga el ratio de deuda: escríbelos en las condiciones.</p>`;
  return `<article class="e19-card pre-politica" aria-labelledby="prestamoPoliticaTitulo">
      <div class="pre-politica-cabecera"><h3 class="escenario-motor-panel-title" id="prestamoPoliticaTitulo">Vuestra política de deuda</h3>
        <span class="pre-politica-cuenta${result.checksPassed < result.checks.length ? " pre-incumple" : ""}">cumple ${result.checksPassed} de ${result.checks.length}</span></div>
      <ul class="pre-checks">${items}</ul>${income}
    </article>`;
}

function prestamoPathCard(title, path, note, tone) {
  if (!path) return `<div class="pre-camino"><p class="pre-camino-titulo">${escapeHtml(title)}</p><p class="e19-kpi-note">Sin datos.</p></div>`;
  const date = path.debtFreeMonthKey ? prestamoMonthText(path.debtFreeMonthKey) : "no acaba en 50 años";
  return `<div class="pre-camino pre-camino-${tone}">
      <p class="pre-camino-titulo"><span class="pre-punto" aria-hidden="true"></span>${escapeHtml(title)}</p>
      <dl>
        <div><dt>Al mes en deudas</dt><dd>${money(path.monthlyPayment, true)}</dd></div>
        <div><dt>Deuda cero</dt><dd>${escapeHtml(date)}</dd></div>
        <div><dt>Tiempo</dt><dd>${path.monthsToDebtFree ? escapeHtml(prestamoSpan(path.monthsToDebtFree)) : "—"}</dd></div>
        <div><dt>Intereses y comisiones</dt><dd>${path.beyondHorizon ? "sin tope" : money(path.totalCost, true)}</dd></div>
      </dl>
      <p class="pre-camino-nota">${escapeHtml(note)}</p>
    </div>`;
}

// Deuda viva mes a mes de los cuatro caminos. Las etiquetas van en HTML (no dentro del SVG estirado) y el SVG lleva min-height: 0.
function prestamoChartHtml(result) {
  const series = [
    ["today", "Hoy", result.paths.today],
    ["loan", "Con préstamo", result.paths.withLoan],
    ["aggressive", "Plan agresivo", result.paths.aggressive],
    ["same", "Mismo esfuerzo sin préstamo", result.paths.sameEffort],
  ].filter(([, , path]) => path && Array.isArray(path.series) && path.series.length);
  if (!series.length) return "";
  const length = Math.max(...series.map(([, , path]) => path.series.length));
  const max = Math.max(1, ...series.map(([, , path]) => Math.max(...path.series.map((point) => point.balance))));
  const width = 600;
  const height = 200;
  const lines = series.map(([tone, , path]) => {
    const points = path.series.map((point, index) => `${((index / Math.max(1, length - 1)) * width).toFixed(1)},${(height - (point.balance / max) * height).toFixed(1)}`).join(" ");
    return `<polyline class="pre-linea-${tone}" points="${points}" fill="none" vector-effect="non-scaling-stroke" />`;
  }).join("");
  const startKey = result.startMonthKey;
  const endKey = globalThis.FinanceCanonicalDebtPayoffPath ? globalThis.FinanceCanonicalDebtPayoffPath.addMonths(startKey, length - 1) : "";
  const legend = series.map(([tone, label]) => `<li><span class="pre-punto pre-punto-${tone}" aria-hidden="true"></span>${escapeHtml(label)}</li>`).join("");
  return `<article class="e19-card pre-grafico" aria-labelledby="prestamoGraficoTitulo">
      <h3 class="escenario-motor-panel-title" id="prestamoGraficoTitulo">Deuda viva, mes a mes</h3>
      <div class="pre-grafico-marco">
        <span class="pre-grafico-max">${money(max, true)}</span>
        <svg class="pre-grafico-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Deuda viva de cada camino desde ${escapeHtml(prestamoMonthText(startKey))} hasta ${escapeHtml(prestamoMonthText(endKey))}">${lines}</svg>
        <span class="pre-grafico-eje"><span>${escapeHtml(prestamoMonthText(startKey))}</span><span>${escapeHtml(prestamoMonthText(endKey))}</span></span>
      </div>
      <ul class="pre-leyenda">${legend}</ul>
    </article>`;
}

function prestamoMilestonesHtml(result) {
  const path = result.paths.aggressive;
  if (!path || !path.milestones.length) return "";
  const items = path.milestones.map((row) => `<li><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(prestamoMonthText(row.payoffMonthKey))}</strong></li>`).join("");
  return `<article class="e19-card pre-calendario" aria-labelledby="prestamoCalendarioTitulo">
      <h3 class="escenario-motor-panel-title" id="prestamoCalendarioTitulo">Calendario del plan agresivo</h3>
      <p class="e19-kpi-note">En orden de TAE: cada deuda que se acaba suma su cuota a la siguiente.</p>
      <ol class="pre-hitos">${items}</ol>
    </article>`;
}

function prestamoNotesHtml(result) {
  const warnings = result.warnings.map((text) => `<li>${escapeHtml(text.replace(/(\d+(?:\.\d+)?) €/g, (match, value) => money(Number(value), true)))}</li>`).join("");
  const early = result.earlyFee > 0 ? `<li>El plan agresivo amortiza ${money(result.earlyRepaid, true)} del préstamo antes de tiempo: con la comisión declarada, ${money(result.earlyFee, true)}, ya sumados.</li>` : "";
  return `<article class="e19-card pre-notas" aria-labelledby="prestamoNotasTitulo">
      <h3 class="escenario-motor-panel-title" id="prestamoNotasTitulo">Antes de pedirlo</h3>
      <ul class="pre-avisos">${warnings}${early}
        <li>Lo pide una sola persona, pero la cuota sale del dinero del hogar: queda en su CIRBE y cuenta en su capacidad de endeudamiento para lo que venga (coche, hipoteca).</li>
        <li>Compara siempre la TAE, no el TIN: la TAE incluye la comisión de apertura. Los seguros o vinculaciones que exija el banco no están aquí: si los hay, súmalos.</li>
        <li>Las deudas actuales se calculan con su capital, cuota y TAE declarados (el mismo cálculo que «Camino a deuda cero»); sin cambios de tipo en las variables.</li>
      </ul>
      <p class="e19-kpi-note">Es una simulación: no pide nada al banco ni cambia el plan. Para que la previsión lo cuente, regístralo como contrato en <a href="#deuda-contratos">Contratos</a> cuando esté firmado.</p>
    </article>`;
}

// ---- «Comparar con otra oferta» (26/11/2026) ----

function prestamoCompareEngine() {
  return globalThis.FinanceCanonicalLoanOffersCompare || null;
}

/** Las dos ofertas en la forma del comparador: la de arriba (A) y la del desplegable (B). */
function prestamoOffersForCompare() {
  const s = prestamoState;
  return [
    { label: s.label || "", capital: s.capital, months: s.months, tinPct: s.tinPct, openingFeePct: s.openingFeePct, earlyFeePct: s.earlyFeePct, insuranceMonthly: s.insuranceMonthly },
    { ...s.offerB },
  ];
}

function prestamoSignedEuros(value) {
  return money(Math.abs(round2(value)), true);
}

// Frente a no pedir nada: el signo en palabras (no solo en color), y lo que no se puede comparar, dicho.
function prestamoImpactoHtml(offer) {
  const lines = [];
  if (offer.impactCost === null) {
    lines.push({ tone: "neutro", text: "Alguna deuda no acaba dentro del horizonte: no se puede decir cuánto ahorra." });
  } else if (offer.impactCost > 1) {
    lines.push({ tone: "pos", text: `Os ahorra ${prestamoSignedEuros(offer.impactCost)} en intereses, comisiones y seguros hasta la deuda cero.` });
  } else if (offer.impactCost < -1) {
    lines.push({ tone: "neg", text: `Os cuesta ${prestamoSignedEuros(offer.impactCost)} más en intereses, comisiones y seguros hasta la deuda cero.` });
  } else {
    lines.push({ tone: "neutro", text: "Cuesta lo mismo que hoy en intereses, comisiones y seguros." });
  }
  const delta = offer.monthlyDeltaSteady;
  if (delta < -1) lines.push({ tone: "pos", text: `Pagáis ${prestamoSignedEuros(delta)} menos al mes en deudas (de ${money(offer.monthlyDebtToday, true)} a ${money(offer.monthlyDebtSteady, true)}).` });
  else if (delta > 1) lines.push({ tone: "neg", text: `Pagáis ${prestamoSignedEuros(delta)} más al mes en deudas (de ${money(offer.monthlyDebtToday, true)} a ${money(offer.monthlyDebtSteady, true)}).` });
  else lines.push({ tone: "neutro", text: `Pagáis lo mismo al mes en deudas (${money(offer.monthlyDebtSteady, true)}).` });
  if (offer.impactMonths !== null && offer.debtFreeWithLoan) {
    const when = prestamoMonthText(offer.debtFreeWithLoan);
    if (offer.impactMonths > 0) lines.push({ tone: "pos", text: `Deuda cero en ${when}, ${prestamoMonths(offer.impactMonths)} antes que hoy.` });
    else if (offer.impactMonths < 0) lines.push({ tone: "neg", text: `Deuda cero en ${when}, ${prestamoMonths(-offer.impactMonths)} después que hoy (pagando solo las cuotas).` });
    else lines.push({ tone: "neutro", text: `Deuda cero en ${when}, como hoy.` });
  }
  const signo = { pos: "Mejor", neg: "Peor", neutro: "Igual" };
  return `<section class="pre-impacto" aria-label="${escapeHtml(offer.label)} frente a no pedir nada">
      <h4 class="pre-impacto-titulo">${escapeHtml(offer.label)}</h4>
      <ul>${lines.map((line) => `<li class="pre-impacto-linea" data-signo="${line.tone}"><span class="pre-impacto-signo">${signo[line.tone]}</span> ${escapeHtml(line.text)}</li>`).join("")}</ul>
    </section>`;
}

function prestamoCompareValue(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  if (unit === "%") return prestamoPct(value);
  if (unit === "meses") return prestamoSpan(Number(value));
  return money(Number(value), true);
}

function prestamoCompareHtml(comparison) {
  if (!comparison) return "";
  if (!comparison.ok) {
    return `<article class="e19-card pre-comparar" id="prestamoComparar" aria-labelledby="prestamoCompararTitulo"><h3 class="escenario-motor-panel-title" id="prestamoCompararTitulo">Comparar las dos ofertas</h3><p class="e19-kpi-note" role="alert">${escapeHtml(comparison.error)}</p></article>`;
  }
  const { a, b, criteria, verdict } = comparison;
  const mark = (who, side) => (who === side ? ' data-gana="1"' : "");
  const winnerText = (who) => (who === "a" ? a.label : who === "b" ? b.label : who === "empate" ? "Empate" : "—");
  const extraRows = [
    { title: "Cuota del préstamo (con seguros)", a: a.loanPayment, b: b.loanPayment, unit: "€" },
    { title: "TAE", a: a.terms.taePct, b: b.terms.taePct, unit: "%" },
    { title: "Deudas que cancela", a: a.cancelled, b: b.cancelled, unit: "€" },
    { title: "Cuota de deudas el primer mes (hoy " + money(a.monthlyDebtToday, true) + ")", a: a.monthlyDebtWithLoan, b: b.monthlyDebtWithLoan, unit: "€" },
  ];
  // En el móvil la cabecera de la tabla no se ve: cada cifra lleva el nombre de su oferta (oculto en el escritorio).
  // En el escritorio la etiqueta no se pinta (display: none) y el lector usa la cabecera; en el móvil, sin cabecera, la lee aquí.
  const cell = (label, text) => `<span class="pre-comparar-etq">${escapeHtml(label)}: </span>${escapeHtml(text)}`;
  const rows = [
    ...criteria.map((c) => `<tr><th scope="row">${escapeHtml(c.title)}</th><td${mark(c.winner, "a")}>${cell(a.label, prestamoCompareValue(c.a, c.unit))}</td><td${mark(c.winner, "b")}>${cell(b.label, prestamoCompareValue(c.b, c.unit))}</td><td class="pre-comparar-gana">${escapeHtml(winnerText(c.winner))}</td></tr>`),
    ...extraRows.map((r) => `<tr class="pre-comparar-info"><th scope="row">${escapeHtml(r.title)}</th><td>${cell(a.label, prestamoCompareValue(r.a, r.unit))}</td><td>${cell(b.label, prestamoCompareValue(r.b, r.unit))}</td><td class="pre-comparar-gana"></td></tr>`),
    `<tr class="pre-comparar-info"><th scope="row">Comprobaciones de vuestra política superadas</th><td>${cell(a.label, `${a.checksPassed} de ${a.checksTotal}`)}</td><td>${cell(b.label, `${b.checksPassed} de ${b.checksTotal}`)}</td><td class="pre-comparar-gana"></td></tr>`,
  ].join("");
  const [first, ...rest] = verdict.lines;
  const pick = verdict.recommended === "a" ? a.label : verdict.recommended === "b" ? b.label : "";
  return `<article class="e19-card pre-comparar" id="prestamoComparar" aria-labelledby="prestamoCompararTitulo" data-tono="${escapeHtml(verdict.tone)}">
      <p class="pre-veredicto-eyebrow">Comparar las dos ofertas</p>
      <h3 class="pre-comparar-titulo" id="prestamoCompararTitulo">${pick ? `La más conveniente: ${escapeHtml(pick)}` : a.cancelled > 0 || b.cancelled > 0 ? "Sin una ganadora clara" : "Ninguna de las dos cancela deuda"}</h3>
      <p class="pre-comparar-frase">${escapeHtml(first || "")}</p>
      ${rest.length ? `<ul class="pre-comparar-lineas">${rest.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : ""}
      <h4 class="pre-comparar-sub">Frente a no pedir nada</h4>
      <div class="pre-impactos">${prestamoImpactoHtml(a)}${prestamoImpactoHtml(b)}</div>
      <div class="pre-comparar-tabla-caja" tabindex="0" role="region" aria-label="Las dos ofertas, criterio a criterio">
        <table class="pre-comparar-tabla">
          <caption class="sr-only">Las dos ofertas, criterio a criterio; la mejor de cada fila va marcada</caption>
          <thead><tr><th scope="col">Criterio</th><th scope="col">${escapeHtml(a.label)}</th><th scope="col">${escapeHtml(b.label)}</th><th scope="col">Mejor</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="e19-kpi-note">Mismas deudas y mismos supuestos para las dos, con el mismo cálculo que el resto de esta pestaña. El detalle de abajo es el de ${escapeHtml(a.label)}. Es una simulación: no pide nada al banco ni cambia el plan.</p>
    </article>`;
}

function prestamoResultHtml(result) {
  if (!result.ok) return `<article class="e19-card"><p class="e19-kpi-note" role="alert">${escapeHtml(result.error)}</p></article>`;
  // Sin nada que cancelar, comparar caminos sería pedir dinero para dejarlo parado: solo la oferta, el porqué y la elección.
  if (!result.cancelled.length) {
    return `<div class="pre-columna-a">${prestamoOfferHtml(result)}${prestamoVerdictHtml(result)}</div><div class="pre-columna-b">${prestamoCancelHtml(result)}</div>`;
  }
  const caminos = `<article class="e19-card pre-caminos-card" aria-labelledby="prestamoCaminosTitulo">
      <h3 class="escenario-motor-panel-title" id="prestamoCaminosTitulo">Lo que cambia</h3>
      <div class="pre-caminos">
        ${prestamoPathCard("Hoy", result.paths.today, "Vuestras deudas como están, pagando sus cuotas.", "today")}
        ${prestamoPathCard("Con préstamo", result.paths.withLoan, "Tras cancelar, pagando solo las cuotas.", "loan")}
        ${prestamoPathCard("Plan agresivo", result.paths.aggressive, result.keepPaying ? "Tras cancelar, pagando lo mismo que hoy (más el extra): cada cuota liberada va a la siguiente deuda." : "Tras cancelar, con el extra: cada cuota liberada va a la siguiente deuda.", "aggressive")}
        ${prestamoPathCard("Mismo esfuerzo sin préstamo", result.paths.sameEffort, "Sin pedir nada, con el mismo dinero al mes que el plan agresivo.", "same")}
      </div>
    </article>`;
  return `<div class="pre-columna-a">${prestamoOfferHtml(result)}${prestamoVerdictHtml(result)}${prestamoChecksHtml(result)}</div>
    <div class="pre-columna-b">${prestamoCancelHtml(result)}${caminos}${prestamoChartHtml(result)}${prestamoMilestonesHtml(result)}${prestamoNotesHtml(result)}</div>`;
}

function prestamoSyncControls() {
  const s = prestamoState;
  Object.entries(PRESTAMO_FIELDS).forEach(([key, field]) => {
    const input = qs(field.id);
    const value = s[key];
    if (input && document.activeElement !== input) input.value = value === null || value === undefined ? "" : String(value);
    if (field.range) {
      const range = qs(field.range);
      if (range && document.activeElement !== range && Number.isFinite(Number(value))) range.value = String(Math.min(Math.max(Number(value), Number(range.min)), Number(range.max)));
    }
  });
  const holder = qs("prestamoTitular");
  if (holder && document.activeElement !== holder) holder.value = s.holder || "";
  const nombre = qs("prestamoNombre");
  if (nombre && document.activeElement !== nombre) nombre.value = s.label || "";
  const seguro = qs("prestamoSeguro");
  if (seguro && document.activeElement !== seguro) seguro.value = Number(s.insuranceMonthly) > 0 ? String(s.insuranceMonthly) : "";
  const b = s.offerB || prestamoOfferBEmpty();
  const bNombre = qs("prestamoBNombre");
  if (bNombre && document.activeElement !== bNombre) bNombre.value = b.label || "";
  Object.entries(PRESTAMO_B_FIELDS).forEach(([key, field]) => {
    const input = qs(field.id);
    if (!input || document.activeElement === input) return;
    const value = b[key];
    const vacio = value === null || value === undefined || ((key === "openingFeePct" || key === "earlyFeePct" || key === "insuranceMonthly") && !(Number(value) > 0));
    input.value = vacio ? "" : String(value);
  });
  const desplegable = qs("prestamoOfertaB");
  if (desplegable && prestamoOfferBReady(b) && !desplegable.dataset.abiertoUnaVez) {
    desplegable.open = true;
    desplegable.dataset.abiertoUnaVez = "1";
  }
  const keep = qs("prestamoSeguir");
  if (keep) keep.checked = s.keepPaying;
  const mortgage = qs("prestamoHipoteca");
  if (mortgage) mortgage.checked = s.includeMortgage;
}

// Pinta el resultado (nunca los controles). Si el foco estaba en una casilla del resultado, vuelve a ella tras repintar.
// 15/11/2026 (riesgo del traspaso del 15/11): mientras sigan en Contratos los contratos de ejemplo sin tocar, los caminos de
// esta pestaña los cuentan como deudas del hogar. Se dice aquí, donde se decide, y no solo en Contratos.
function prestamoEjemplosAviso() {
  const ejemplos = typeof deudaContratosEjemplosVisibles === "function" ? deudaContratosEjemplosVisibles() : [];
  if (!ejemplos.length) return "";
  const cuantos = ejemplos.length === 1 ? "un contrato de ejemplo" : `${ejemplos.length} contratos de ejemplo`;
  return `<p class="e19-kpi-note is-warn" id="prestamoEjemplosAviso" role="status"><strong>Estas cifras no son todavía las vuestras.</strong> Los caminos de abajo cuentan ${cuantos} (${ejemplos.map((row) => escapeHtml(row.entity)).join(", ")}) como si ${ejemplos.length === 1 ? "fuera una deuda vuestra" : "fueran deudas vuestras"}. Quitadlos y dad de alta las de verdad en <a href="#deuda-contratos">Contratos</a> antes de decidir nada con esta pestaña.</p>`;
}

function renderPrestamoDeuda(engine, contracts) {
  const box = qs("prestamoResultado");
  if (!box) return;
  attachPrestamoDeuda(document);
  if (!prestamoState) prestamoState = prestamoLoad();
  const loanEngine = engine || prestamoEngine();
  if (!loanEngine) {
    box.innerHTML = '<p class="e19-kpi-note">No se ha podido cargar el cálculo del préstamo.</p>';
    return;
  }
  prestamoSyncControls();
  try {
    const list = Array.isArray(contracts) ? contracts : typeof escenarioMotorDebtOptions === "function" ? escenarioMotorDebtOptions() : [];
    const todayKey = isoLocalDate(new Date()).slice(0, 7);
    const result = loanEngine.plan(list, prestamoOptions(todayKey));
    const focusedId = document.activeElement && box.contains(document.activeElement) ? document.activeElement.id : "";
    let comparison = null;
    const compareEngine = prestamoCompareEngine();
    if (compareEngine && prestamoOfferBReady(prestamoState.offerB)) {
      const { loan, earlyFeePct, ...baseOptions } = prestamoOptions(todayKey);
      comparison = compareEngine.compare(list, baseOptions, prestamoOffersForCompare(), { engine: loanEngine });
    }
    const html = `${prestamoEjemplosAviso()}${prestamoCompareHtml(comparison)}${prestamoResultHtml(result)}`;
    if (box.__prestamoHtml !== html) {
      box.innerHTML = html;
      box.__prestamoHtml = html;
      if (focusedId) qs(focusedId)?.focus();
    }
    const error = qs("prestamoError");
    if (error) {
      error.hidden = !prestamoLastError;
      error.textContent = prestamoLastError;
    }
  } catch (error) {
    console.error(`renderPrestamoDeuda: ${error.message}`);
  }
}

function prestamoRerender() {
  prestamoSave();
  renderPrestamoDeuda(prestamoEngine(), null);
}

function prestamoParse(raw) {
  const text = String(raw ?? "").trim().replace(/\./g, (match, offset, all) => (/,/.test(all) ? "" : match)).replace(",", ".");
  if (text === "") return { empty: true };
  const value = Number(text);
  return Number.isFinite(value) ? { value } : { invalid: true };
}

function prestamoOnInput(event) {
  const target = event.target;
  if (!target || !target.id || !target.closest?.("#deuda-prestamo")) return;
  if (!prestamoState) prestamoState = prestamoLoad(); // lo escrito antes del primer pintado no se pierde (como DUO-D3)
  if (target.id === "prestamoNombre" || target.id === "prestamoBNombre") {
    const texto = String(target.value || "").slice(0, 40);
    if (target.id === "prestamoNombre") prestamoState.label = texto;
    else prestamoState.offerB = { ...(prestamoState.offerB || prestamoOfferBEmpty()), label: texto };
    prestamoRerender();
    return;
  }
  if (target.id === "prestamoSeguro") {
    const parsed = prestamoParse(target.value);
    if (parsed.invalid || (!parsed.empty && (parsed.value < 0 || parsed.value > 1000))) {
      target.setAttribute("aria-invalid", "true");
      prestamoLastError = "Los seguros o vinculaciones, un importe al mes entre 0 y 1.000 €.";
      renderPrestamoDeuda(prestamoEngine(), null);
      return;
    }
    target.removeAttribute("aria-invalid");
    prestamoLastError = "";
    prestamoState.insuranceMonthly = parsed.empty ? 0 : parsed.value;
    prestamoRerender();
    return;
  }
  const entryB = Object.entries(PRESTAMO_B_FIELDS).find(([, field]) => field.id === target.id);
  if (entryB) {
    const [key, field] = entryB;
    const parsed = prestamoParse(target.value);
    if (parsed.invalid) {
      target.setAttribute("aria-invalid", "true");
      prestamoLastError = "Escribe un número, por ejemplo 16500 o 8,5.";
      renderPrestamoDeuda(prestamoEngine(), null);
      return;
    }
    target.removeAttribute("aria-invalid");
    prestamoLastError = "";
    const optional = key === "openingFeePct" || key === "earlyFeePct" || key === "insuranceMonthly";
    const value = parsed.empty ? (optional ? 0 : null) : field.integer ? Math.round(parsed.value) : parsed.value;
    prestamoState.offerB = { ...(prestamoState.offerB || prestamoOfferBEmpty()), [key]: value };
    prestamoRerender();
    return;
  }
  if (target.id === "prestamoTitular") {
    prestamoState.holder = String(target.value || "").slice(0, 40);
    prestamoRerender();
    return;
  }
  const entry = Object.entries(PRESTAMO_FIELDS).find(([, field]) => field.id === target.id || field.range === target.id);
  if (!entry) return;
  const [key, field] = entry;
  const parsed = prestamoParse(target.value);
  if (parsed.invalid) {
    target.setAttribute("aria-invalid", "true");
    prestamoLastError = "Escribe un número, por ejemplo 16500 o 8,5.";
    renderPrestamoDeuda(prestamoEngine(), null);
    return;
  }
  target.removeAttribute("aria-invalid");
  prestamoLastError = "";
  if (parsed.empty) {
    if (key === "monthlyIncome") prestamoState.monthlyIncome = null;
    else if (key === "extraMonthly" || key === "openingFeePct" || key === "earlyFeePct") prestamoState[key] = 0;
    else return;
  } else {
    prestamoState[key] = field.integer ? Math.round(parsed.value) : parsed.value;
  }
  if (field.range && target.id === field.range) {
    const number = qs(field.id);
    if (number) number.value = String(prestamoState[key]);
  }
  prestamoRerender();
}

function prestamoOnChange(event) {
  const target = event.target;
  if (!target || !target.closest?.("#deuda-prestamo")) return;
  if (!prestamoState) prestamoState = prestamoLoad();
  if (target.id === "prestamoSeguir") {
    prestamoState.keepPaying = target.checked;
    prestamoRerender();
    return;
  }
  if (target.id === "prestamoHipoteca") {
    prestamoState.includeMortgage = target.checked;
    prestamoState.selection = "auto";
    prestamoRerender();
    return;
  }
  const selId = target.getAttribute("data-prestamo-sel");
  if (selId !== null) {
    // Pasar a mano parte de lo que se ve marcado ahora, y cambia solo la casilla tocada.
    const current = Array.isArray(prestamoState.selection)
      ? prestamoState.selection.slice()
      : [...document.querySelectorAll("#prestamoResultado [data-prestamo-sel]")].filter((input) => input !== target ? input.checked : !target.checked).map((input) => input.getAttribute("data-prestamo-sel"));
    const next = target.checked ? [...new Set([...current, selId])] : current.filter((id) => id !== selId);
    prestamoState.selection = next;
    prestamoRerender();
  }
}

function prestamoOnClick(event) {
  const target = event.target;
  if (!target || !target.closest?.("#deuda-prestamo")) return;
  if (!prestamoState) prestamoState = prestamoLoad();
  if (target.id === "prestamoBQuitar") {
    const anterior = prestamoState.offerB;
    prestamoState.offerB = prestamoOfferBEmpty();
    prestamoRerender();
    if (typeof showUndoToast === "function") {
      showUndoToast("Otra oferta quitada.", () => { prestamoState.offerB = anterior; prestamoRerender(); });
    } else if (typeof announceStatus === "function") announceStatus("Otra oferta quitada.");
    qs("prestamoBCapital")?.focus();
    return;
  }
  const fix = target.closest("[data-prestamo-fix-months]");
  if (fix) {
    prestamoState.months = Number(fix.getAttribute("data-prestamo-fix-months"));
    prestamoRerender();
    qs("prestamoPlazo")?.focus();
    if (typeof announceStatus === "function") announceStatus(`Plazo cambiado a ${prestamoState.months} meses.`);
    return;
  }
  if (target.closest("[data-prestamo-auto]")) {
    prestamoState.selection = "auto";
    prestamoRerender();
    qs("prestamoResultado")?.querySelector("[data-prestamo-sel]")?.focus();
    return;
  }
  if (target.id === "prestamoReset") {
    const keepIncome = prestamoState.monthlyIncome;
    const keepHolder = prestamoState.holder;
    const keepB = prestamoState.offerB;
    const keepLabel = prestamoState.label;
    prestamoState = { ...prestamoDefaults(), monthlyIncome: keepIncome, holder: keepHolder, offerB: keepB, label: keepLabel };
    prestamoLastError = "";
    prestamoRerender();
    if (typeof announceStatus === "function") announceStatus("Condiciones devueltas a la oferta de partida.");
  }
}

// Una sola vez, por delegación.
function attachPrestamoDeuda(doc) {
  if (!doc || doc.__prestamoAttached) return false;
  doc.__prestamoAttached = true;
  doc.addEventListener("input", prestamoOnInput);
  doc.addEventListener("change", prestamoOnChange);
  doc.addEventListener("click", prestamoOnClick);
  doc.addEventListener("submit", (event) => {
    if (event.target && event.target.id === "prestamoForm") event.preventDefault();
  });
  return true;
}

// Los oyentes, desde la carga (no desde el primer pintado): lo que se escribe al entrar en la pestaña, antes de que termine de pintarse
// en un teléfono lento, no se pierde. Es el patrón del fallo de DUO-D3 en Safari (26/11/2026). Los manejadores cargan el estado si
// aún no lo hay.
if (typeof document !== "undefined" && typeof document.addEventListener === "function") attachPrestamoDeuda(document);
