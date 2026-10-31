// WP-42 (CAR-03 + NIN-05 + NIN-08, docs/WP42_DISENO.md): la tarjeta «¿Dónde va el próximo euro?» de Deuda › Comparar. El cálculo vive en canonical-next-euro.js (puro); aquí se
// recogen las cifras que ya existen en la app (liquidez y suelo del colchón, deudas con su coste efectivo tras la deducción fiscal, tipo marginal, tipo del ahorro, reparto
// de la cartera y sus objetivos), se guardan los datos que teclea el hogar en `next-euro-inputs` y se pinta la escalera. NO mueve dinero ni crea transferencias (A11-4; la lista
// de transferencias es WP-47). Tampoco va a Hoy (congelado hasta H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, storageSet, storageKey, isoLocalDate, announceStatus, estadoHtml,
// queueRemoteSave, accountBalancesFromState, cuadroMandosReserve, debtContractSourceRows, dividendSpanishSavingsRatePct, fiscalWithholdingRate, iv1PositionsList, iv6PortfolioTargets,
// iv5PortfolioAnnualReturnPct…). Sin llamadas al DOM ni escuchas al cargarse: app.js llama a `renderProximoEuro` al pintar Deuda › Comparar.

const PROX_EURO_STORE = "next-euro-inputs"; // en la copia (BACKUP_LOCAL_STORES)
const PROX_EURO_CERTAINTY = { cierto: "Cierto", esperado: "Esperado, no garantizado", fiscal: "Ahorro fiscal, de una vez" };
const PROX_EURO_CROSS_ICON = { contradicts: "✕", alert: "⚠", warns: "⚠", watch: "◐", unknown: "?", ok: "✓" };
const PROX_EURO_STATUS = { ok: "Aquí va dinero", skipped: "Hoy no toca", "no-data": "Sin datos", "no-verdict": "Sin veredicto" };

function proxEuroEngine() {
  return globalThis.FinanceCanonicalNextEuro;
}

function proxEuroLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(PROX_EURO_STORE), "{}")) || {}; } catch { saved = {}; }
  const num = (value) => (value === "" || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value));
  const idleOptions = Array.isArray(saved.idleOptions) ? saved.idleOptions.map((row) => ({ id: String(row?.id || ""), ratePct: num(row?.ratePct), months: num(row?.months) })) : [];
  return { amount: num(saved.amount), inAccounts: saved.inAccounts === true, expectedReturnPct: num(saved.expectedReturnPct), alreadyContributed: num(saved.alreadyContributed), idleOptions };
}

function proxEuroSave(inputs) {
  storageSet(storageKey(PROX_EURO_STORE), JSON.stringify(inputs));
  queueRemoteSave();
}

function proxEuroEuros(value) {
  return money(value, true);
}

function proxEuroPct(value) {
  return `${String(value).replace(".", ",")} %`;
}

// Todas las deudas con saldo, no solo las que declaran interés: una deuda sin TAE no es una deuda gratis (dato ausente no es cero). Coste efectivo = TAE declarada tras la
// deducción fiscal (la misma cuenta que DEB5/DEB10); sin TAE, el implícito en la cuota y los plazos si el contrato está al corriente; si no, null.
function proxEuroDebts() {
  const rows = canonicalDebtContractRows().filter((row) => Number(row.currentPrincipal) > 0 && !["settled", "reunified"].includes(row.paymentStatus));
  const priority = FinanceDebtContracts.fiscalAdjustedDebtPriority(rows);
  const declared = new Map((priority.rows || []).map((row) => [row.id, row.effectiveAprPct]));
  const shadow = globalThis.FinanceCanonicalShadowDebt;
  return rows.map((row) => {
    let effectiveAprPct = declared.has(row.id) ? declared.get(row.id) : null;
    let rateSource = effectiveAprPct === null ? null : "declared";
    if (effectiveAprPct === null && shadow && row.paymentStatus === "active" && Number(row.currentPayment) > 0 && Number(row.remainingInstallments) > 0) {
      const implied = shadow.effectiveApr({ cashPrice: Number(row.currentPrincipal), installments: Number(row.remainingInstallments), installmentAmount: Number(row.currentPayment) });
      if (implied.calculable && Number.isFinite(implied.aprPct) && implied.aprPct >= 0) { effectiveAprPct = implied.aprPct; rateSource = "implied"; }
    }
    return { id: row.id, entity: row.entity, currentPrincipal: Number(row.currentPrincipal), effectiveAprPct, rateSource };
  });
}

// Las cifras que ya calcula la app, tal cual; lo que no hay se pasa como null (dato ausente no es cero).
function proxEuroSources(inputs) {
  const guard = (fn, fallback = null) => { try { const value = fn(); return value === undefined ? fallback : value; } catch { return fallback; } };
  const balances = guard(() => accountBalancesFromState());
  const cushion = guard(() => FinanceCanonicalCushion.cushionFloor(lastSimulation, cuadroMandosReserve()));
  const debts = guard(() => proxEuroDebts(), []);
  const savingsTax = guard(() => dividendSpanishSavingsRatePct(), 0);
  const marginal = guard(() => fiscalWithholdingRate(), 0);
  const portfolio = guard(() => {
    const normalized = FinanceCanonicalPortfolio.normalizePositions(iv1PositionsList());
    return { totalsByType: normalized.summary.totalsByType, targets: iv6PortfolioTargets() };
  });
  return {
    amount: inputs.amount || 0,
    amountInAccounts: inputs.inAccounts,
    liquidity: balances && balances.total !== null && balances.total !== undefined && balances.total !== "" && Number.isFinite(Number(balances.total)) ? Number(balances.total) : null, // Number(null) es 0: un saldo ausente no es un saldo de cero
    floor: cushion && Number.isFinite(Number(cushion.value)) ? Number(cushion.value) : null,
    debts,
    investment: { expectedReturnPct: inputs.expectedReturnPct, savingsTaxPct: savingsTax > 0 ? savingsTax : null, source: inputs.expectedReturnPct === null ? null : "typed" },
    pension: { year: Number(isoLocalDate(new Date()).slice(0, 4)), alreadyContributed: inputs.alreadyContributed, marginalRatePct: marginal > 0 ? marginal : null },
    portfolio,
  };
}

function proxEuroRungHtml(rung, index) {
  const lines = (rung.lines || []).map((line) => `<li>${escapeHtml(line.entity)}: <strong>${proxEuroEuros(line.amount)}</strong> al ${proxEuroPct(line.aprPct)} de coste efectivo${line.rateImplied ? " (implícito en su cuota)" : ""}${line.liquidatesIt ? " · la liquida" : ""} · dejas de pagar ${proxEuroEuros(line.interestSavedPerYear)} al año</li>`).join("");
  const split = rung.split && rung.split.calculable
    ? `<p class="e19-kpi-note"><strong>Reparto por aportación, sin vender nada:</strong></p><ul class="peu-lineas">${rung.split.rows.map((row) => `<li>${escapeHtml(String(row.type).replace(/_/g, " "))}: <strong>${proxEuroEuros(row.amount)}</strong> (hoy ${proxEuroPct(row.currentPct)}, objetivo ${proxEuroPct(row.targetPct)}, tras aportar ${proxEuroPct(row.afterPct)})</li>`).join("")}</ul>`
    : "";
  const reasons = (rung.reasons || []).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  const saving = rung.oneOffTaxSaving > 0 ? `<p><strong>Ahorro fiscal de una vez:</strong> ${proxEuroEuros(rung.oneOffTaxSaving)}</p>` : "";
  return `<li class="peu-peldano" data-peu-rung="${escapeHtml(rung.id)}" data-peu-status="${escapeHtml(rung.status)}">
      <p class="peu-cabecera"><span class="peu-num" aria-hidden="true">${index + 1}</span> <strong>${escapeHtml(rung.label)}</strong> <span class="peu-importe">${proxEuroEuros(rung.amount)}</span> <span class="peu-estado">${escapeHtml(PROX_EURO_STATUS[rung.status] || rung.status)}</span></p>
      ${reasons}${lines ? `<ul class="peu-lineas">${lines}</ul>` : ""}${split}${saving}
      <p class="e19-kpi-note"><strong>${escapeHtml(PROX_EURO_CERTAINTY[rung.certainty] || rung.certainty)}.</strong> ${escapeHtml(rung.liquidity)}</p>
    </li>`;
}

// WP-42 PR-2 (docs/WP42_DISENO.md §6): el reparto frente a la política firmada (WP-39) y al plan B (WP-38). Aquí solo se recoge lo que dicen esos motores; el texto lo compone
// `crossChecks`. Solo avisa: no reordena la escalera ni bloquea nada.
function proxEuroCrossInputs(ladder) {
  const guard = (fn, fallback = null) => { try { const value = fn(); return value === undefined ? fallback : value; } catch { return fallback; } };
  const policy = guard(() => {
    const engine = globalThis.FinanceCanonicalInvestmentPolicy;
    if (!engine) return null;
    const saved = politicaLoad();
    const state = engine.signatureState(saved);
    if (state === "none") return { state };
    const portfolio = politicaPortfolio();
    const invest = ladder.rungs.find((rung) => rung.id === "invest");
    const rows = invest && invest.split && invest.split.calculable ? invest.split.rows.filter((row) => row.amount > 0) : [];
    return {
      state,
      checks: rows.map((row) => {
        const check = engine.checkOperation({ policy: saved, operation: { kind: "buy", type: row.type, amount: row.amount }, totalsByType: portfolio.totalsByType, totalValue: portfolio.totalValue, drawdownPct: null });
        return { type: row.type, amount: row.amount, verdict: check.verdict, lines: check.findings.map((finding) => finding.text) };
      }),
    };
  });
  const planB = guard(() => {
    const engine = globalThis.FinanceCanonicalContingencyPlan;
    if (!engine) return null;
    const plan = planBLoad();
    const state = engine.signatureState(plan);
    if (state === "none") return { state };
    return { state, status: engine.evaluate({ plan, ...planBContext() }).status };
  });
  return { policy, planB };
}

function proxEuroCrossBlockHtml(title, block) {
  const lines = block.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const draft = block.draft ? `<p class="e19-kpi-note">${escapeHtml(block.draft)}</p>` : "";
  return `<div class="peu-cruce-bloque" data-peu-cruce="${escapeHtml(title)}" data-peu-cruce-nivel="${escapeHtml(block.level)}">
      <p class="peu-cruce-titulo"><span aria-hidden="true">${escapeHtml(PROX_EURO_CROSS_ICON[block.level] || "?")}</span> <strong>${escapeHtml(block.title)}</strong></p>
      ${lines ? `<ul class="peu-lineas">${lines}</ul>` : ""}${draft}
    </div>`;
}

function proxEuroCrossHtml(ladder) {
  const engine = proxEuroEngine();
  if (!engine || typeof engine.crossChecks !== "function") return "";
  const cross = engine.crossChecks({ ladder, ...proxEuroCrossInputs(ladder), fmt: proxEuroEuros });
  if (!cross.show) return "";
  return `<section class="peu-cruce" aria-label="El reparto frente a vuestra política y vuestro plan B">
      <h4 class="peu-cruce-cabecera">Frente a vuestra política y vuestro plan B</h4>
      ${cross.policy ? proxEuroCrossBlockHtml("politica", cross.policy) : ""}${cross.planB ? proxEuroCrossBlockHtml("plan-b", cross.planB) : ""}
      <p class="e19-kpi-note">Solo avisa: la escalera no se reordena y no se bloquea nada. La app no sabe si lo acordado sigue siendo lo que queréis.</p>
    </section>`;
}

function proxEuroResultHtml(ladder) {
  if (ladder.status === "invalid") return estadoHtml({ kind: "vacio", titulo: "Escribe un importe", texto: ladder.reason });
  const parts = ladder.rungs.filter((rung) => rung.amount > 0).map((rung) => `${proxEuroEuros(rung.amount)} a «${rung.label.toLowerCase()}»`);
  if (ladder.unassigned > 0) parts.push(`${proxEuroEuros(ladder.unassigned)} sin reparto`);
  const partial = ladder.status === "partial"
    ? `<p class="peu-aviso" role="note"><strong>Reparto parcial:</strong> faltan datos (${escapeHtml(ladder.missing.join(", "))}). Lo que dependa de ellos no es fiable.</p>`
    : "";
  const benefits = [
    ladder.certainAnnualBenefit > 0 ? `<li><strong>Intereses que dejas de pagar (cierto):</strong> ${proxEuroEuros(ladder.certainAnnualBenefit)} al año</li>` : "",
    ladder.oneOffTaxSaving > 0 ? `<li><strong>Ahorro fiscal de la pensión (de una vez, difiere el impuesto):</strong> ${proxEuroEuros(ladder.oneOffTaxSaving)}</li>` : "",
    ladder.expectedAnnualBenefit ? `<li><strong>Rentabilidad esperada de lo invertido (no garantizada):</strong> ${proxEuroEuros(ladder.expectedAnnualBenefit)} al año</li>` : "",
  ].join("");
  const notes = ladder.notes.length ? `<ul class="peu-lineas">${ladder.notes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "";
  return `<p class="peu-resumen"><strong>De ${proxEuroEuros(ladder.amount)}:</strong> ${parts.length ? parts.join(" · ") : "nada que repartir"}.</p>${partial}
    <ol class="peu-escalera">${ladder.rungs.map(proxEuroRungHtml).join("")}</ol>
    ${proxEuroCrossHtml(ladder)}${benefits ? `<ul class="peu-beneficios" aria-label="Beneficio esperado, por naturaleza">${benefits}</ul>` : ""}${notes}
    <p class="e19-kpi-note">Son tres tipos de beneficio distintos y no se suman. La app no mueve dinero: es un orden para decidir, no una orden.</p>`;
}

function proxEuroFillInputs(inputs) {
  const set = (id, value) => { const field = qs(id); if (field && document.activeElement !== field) field.value = value === null || value === undefined ? "" : String(value); };
  set("proxEuroImporte", inputs.amount);
  set("proxEuroRentabilidad", inputs.expectedReturnPct);
  set("proxEuroPension", inputs.alreadyContributed);
  const check = qs("proxEuroEnCuentas");
  if (check && document.activeElement !== check) check.checked = inputs.inAccounts;
}

function proxEuroHint() {
  const hint = qs("proxEuroPista");
  if (!hint) return;
  let historical = null;
  try { historical = iv5PortfolioAnnualReturnPct(); } catch { historical = null; }
  hint.textContent = Number.isFinite(historical)
    ? `Vuestra cartera ha rendido un ${String(Math.round(historical * 10) / 10).replace(".", ",")} % anual hasta hoy: es pasado, no una promesa, y no lo uso si no lo escribís vosotros.`
    : "No uso ninguna rentabilidad por vosotros: sin ella, lo que sobre de la deuda y la pensión queda sin reparto.";
}

// NIN-08 (docs/WP42_DISENO.md §7): el dinero parado, arriba de la escalera. Cuánto hay por encima del suelo del colchón que la previsión (mes a mes, según el plan) no
// toca en 3, 6 y 12 meses; con un botón lo lleva a la escalera, y un comparador dice cuánto rendiría neto en los productos que el hogar compara (tipo y plazo los teclea
// él: la app no consulta tipos ni recomienda). En prueba, con interruptor propio («dinero-parado»).
const PROX_EURO_IDLE_PRODUCTS = Object.freeze([
  { id: "cuenta", label: "Cuenta remunerada", months: 3 },
  { id: "deposito", label: "Depósito", months: 6 },
  { id: "letras", label: "Letras del Tesoro", months: 12 },
]);

function proxEuroIdleOn() {
  return globalThis.FinanceFuncionesEnPrueba?.encendida?.("dinero-parado") === true;
}

function proxEuroIdleProducts(inputs) {
  return PROX_EURO_IDLE_PRODUCTS.map((product) => {
    const saved = (inputs.idleOptions || []).find((row) => row.id === product.id) || {};
    return { id: product.id, label: product.label, ratePct: saved.ratePct ?? null, months: saved.months ?? product.months };
  });
}

function proxEuroIdleModel(engine, inputs) {
  const guard = (fn, fallback = null) => { try { const value = fn(); return value === undefined ? fallback : value; } catch { return fallback; } };
  const cushion = guard(() => FinanceCanonicalCushion.cushionFloor(lastSimulation, cuadroMandosReserve()));
  const monthly = guard(() => canonicalDailyEngineRuns.active?.monthly, []) || [];
  const savingsTax = guard(() => dividendSpanishSavingsRatePct(), 0);
  return engine.idleCash({
    floor: cushion && Number.isFinite(Number(cushion.value)) ? Number(cushion.value) : null,
    monthlyMins: monthly,
    fromMonthKey: isoLocalDate(new Date()).slice(0, 7),
    options: proxEuroIdleProducts(inputs),
    savingsTaxPct: savingsTax > 0 ? savingsTax : null,
  });
}

function proxEuroIdleDate(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";
}

function proxEuroIdleCompareHtml(model, inputs) {
  const products = proxEuroIdleProducts(inputs);
  // Texto con teclado decimal y coma española (como los importes de WP-11): en un campo numérico «2,5» no se puede escribir.
  const field = (product, name, label, value, mode) => `<label class="peu-parado-campo"><span>${escapeHtml(label)}</span><input type="text" inputmode="${mode}" autocomplete="off" data-peu-parado-${name}="${escapeHtml(product.id)}" value="${value === null || value === undefined ? "" : escapeHtml(String(value).replace(".", ","))}" aria-label="${escapeHtml(`${label} de ${product.label}`)}" /></label>`;
  const rows = products.map((product) => `<div class="peu-parado-producto"><strong>${escapeHtml(product.label)}</strong>${field(product, "tipo", "TAE (%)", product.ratePct, "decimal")}${field(product, "plazo", "Plazo (meses)", product.months, "numeric")}</div>`).join("");
  const tax = model.savingsTaxPct === null ? "sin el tipo del ahorro (Ajustes): solo bruto" : `impuesto del ahorro al ${proxEuroPct(model.savingsTaxPct)}`;
  const results = model.options.filter((row) => row.ratePct !== null);
  // Una lista y no una tabla: seis columnas no caben a 390 px, y la tabla escondía el neto al año en escritorio.
  const table = results.length
    ? `<ul class="peu-parado-resultados">${results.map((row) => row.calculable
      ? `<li data-peu-parado-fila="${escapeHtml(row.id)}"><strong>${escapeHtml(row.label)}</strong> · ${row.months} ${row.months === 1 ? "mes" : "meses"}: sobre ${proxEuroEuros(row.amount)}, ${proxEuroEuros(row.gross)} brutos${row.net === null ? "" : `, <strong>${proxEuroEuros(row.net)} netos</strong> (${proxEuroPct(row.netAnnualPct)} neto al año)`}</li>`
      : `<li data-peu-parado-fila="${escapeHtml(row.id)}"><strong>${escapeHtml(row.label)}</strong>: ${escapeHtml(row.reason)}</li>`).join("")}</ul>`
    : "";
  return `<details class="peu-parado-comparar"${results.length ? " open" : ""}><summary>Comparar dónde dejarlo</summary>
      <form id="proxEuroParadoForm" novalidate><div class="peu-parado-productos">${rows}</div><div><button type="submit" class="e19-btn e19-btn-secondary">Comparar</button></div></form>
      ${table}
      <p class="e19-kpi-note">Escribe el tipo que os ofrezcan y el plazo. «Disponible» es lo que la previsión no toca durante ese plazo; ${escapeHtml(tax)}. El neto al año es lo comparable entre plazos distintos. La app no consulta tipos ni recomienda un producto: la liquidez de cada uno pesa distinto para cada hogar.</p>
    </details>`;
}

function proxEuroIdleHtml(model, inputs) {
  if (model.status !== "ok") {
    return `<p class="peu-parado-titulo"><strong>Dinero parado</strong></p><p class="e19-kpi-note">Para saber si hay dinero parado hace falta ${escapeHtml(model.reason)}.</p>`;
  }
  const six = model.windows.find((row) => row.months === 6 && row.calculable) || model.windows.find((row) => row.calculable);
  const windows = model.windows.map((row) => `<li>${row.months} meses: ${row.calculable ? `<strong>${proxEuroEuros(row.idle)}</strong>` : "la previsión no llega"}</li>`).join("");
  const where = six ? `${six.date ? ` el ${escapeHtml(proxEuroIdleDate(six.date))}` : ""}${six.event ? `, con «${escapeHtml(six.event)}»` : ""}` : "";
  const lead = !six
    ? "<p>La previsión no llega a tres meses: no se puede decir qué dinero está parado.</p>"
    : six.idle > 0
      ? `<p>En los próximos ${six.months} meses, según la previsión, vuestra liquidez no baja de <strong>${proxEuroEuros(six.minimum)}</strong>${where}. Con el colchón en ${proxEuroEuros(model.floor)}, hay <strong>${proxEuroEuros(six.idle)} que el plan no necesita</strong> en ese tiempo.</p>`
      : `<p>No hay dinero parado: en los próximos ${six.months} meses la liquidez baja hasta ${proxEuroEuros(six.minimum)}${where}, ${six.minimum < model.floor ? "por debajo" : "al nivel"} del colchón (${proxEuroEuros(model.floor)}).</p>`;
  const button = six && six.idle > 0 ? `<button type="button" class="e19-btn e19-btn-secondary" data-peu-colocar="${six.idle}">Repartir ${proxEuroEuros(six.idle)} en la escalera</button>` : "";
  return `<p class="peu-parado-titulo"><strong>Dinero parado</strong> · según la previsión</p>${lead}<ul class="peu-parado-ventanas">${windows}</ul>${button}
    ${proxEuroIdleCompareHtml(model, inputs)}
    <p class="e19-kpi-note">Es la previsión según el plan: si un gasto llega antes o más caro, ese mínimo baja. El colchón queda entero en cualquier caso.</p>`;
}

function renderProximoEuroParado(engine, inputs) {
  const box = qs("proxEuroParado");
  if (!box) return;
  if (!proxEuroIdleOn() || typeof engine?.idleCash !== "function") { box.hidden = true; box.innerHTML = ""; box.__proxEuroHtml = ""; return; }
  let html;
  try {
    const model = proxEuroIdleModel(engine, inputs);
    html = proxEuroIdleHtml(model, inputs);
    if (model.status === "ok" && model.windows.some((row) => row.calculable && row.idle > 0)) globalThis.FinanceMedidor?.anotar("dinero-parado", "vista"); // XGO-02: un día visto cuenta una vez
  } catch {
    html = '<p class="e19-kpi-note">No se pudo calcular el dinero parado con los datos actuales.</p>';
  }
  // No se repinta mientras se escribe en él (se perdería lo tecleado), salvo al pulsar «Comparar».
  if (box.__proxEuroHtml !== html && (box.__proxEuroForzar || !box.contains(document.activeElement))) {
    box.innerHTML = html;
    box.__proxEuroHtml = html;
  }
  box.__proxEuroForzar = false;
  box.hidden = false;
}

function proxEuroIdleSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const read = (input) => {
    const raw = String(input?.value ?? "").trim().replace(/\s|%/g, "").replace(",", ".");
    return raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
  };
  const idleOptions = PROX_EURO_IDLE_PRODUCTS.map((product) => ({
    id: product.id,
    ratePct: read(form.querySelector(`[data-peu-parado-tipo="${product.id}"]`)),
    months: read(form.querySelector(`[data-peu-parado-plazo="${product.id}"]`)),
  }));
  proxEuroSave({ ...proxEuroLoad(), idleOptions });
  const box = qs("proxEuroParado");
  if (box) box.__proxEuroForzar = true;
  renderProximoEuro(proxEuroEngine());
  qs("proxEuroParadoForm")?.querySelector("button[type=submit]")?.focus(); // el foco sigue donde estaba, no se va al principio de la página
  globalThis.FinanceMedidor?.anotar("dinero-parado", "accion"); // XGO-02: comparar
  announceStatus("Comparación hecha.");
}

function proxEuroIdlePlace(amount) {
  if (!(amount > 0)) return;
  proxEuroSave({ ...proxEuroLoad(), amount, inAccounts: true });
  renderProximoEuro(proxEuroEngine());
  globalThis.FinanceMedidor?.anotar("dinero-parado", "accion"); // XGO-02: llevarlo a la escalera
  qs("proxEuroResultado")?.scrollIntoView?.({ block: "nearest" });
  announceStatus(`Escalera calculada para ${proxEuroEuros(amount)} de dinero parado.`);
}

function renderProximoEuro(engine) {
  const box = qs("proxEuroResultado");
  if (!box || !engine) return;
  attachProximoEuro(document); // idempotente: un clic temprano no puede perderse
  try {
    const inputs = proxEuroLoad();
    renderProximoEuroParado(engine, inputs);
    proxEuroFillInputs(inputs);
    proxEuroHint();
    const html = inputs.amount > 0
      ? proxEuroResultHtml(engine.buildLadder(proxEuroSources(inputs)))
      : estadoHtml({ kind: "vacio", titulo: "¿Cuánto hay que colocar?", texto: "Escribe un importe (una paga, un sobrante del mes, dinero parado) y verás en qué orden se llena cada peldaño." });
    if (box.__proxEuroHtml !== html) {
      box.innerHTML = html;
      box.__proxEuroHtml = html;
    }
  } catch {
    box.textContent = "No se pudo calcular la escalera con los datos actuales.";
  }
}

function proxEuroSubmit(event) {
  event.preventDefault();
  const read = (id) => { const raw = qs(id)?.value; return raw === undefined || raw === "" ? null : parseAmount(raw); };
  const amount = read("proxEuroImporte");
  const error = qs("proxEuroError");
  if (!(amount > 0)) {
    if (error) { error.textContent = "Escribe un importe mayor que cero."; error.hidden = false; }
    announceStatus("Escribe un importe mayor que cero.");
    return;
  }
  if (error) error.hidden = true;
  proxEuroSave({ ...proxEuroLoad(), amount, inAccounts: Boolean(qs("proxEuroEnCuentas")?.checked), expectedReturnPct: read("proxEuroRentabilidad"), alreadyContributed: read("proxEuroPension") });
  renderProximoEuro(proxEuroEngine());
  announceStatus("Escalera calculada.");
}

// Una sola vez, por delegación.
function attachProximoEuro(doc) {
  if (!doc || doc.__proxEuroAttached) return false;
  doc.__proxEuroAttached = true;
  doc.addEventListener("submit", (event) => {
    if (event.target?.id === "proxEuroForm") proxEuroSubmit(event);
    else if (event.target?.id === "proxEuroParadoForm") proxEuroIdleSubmit(event);
  });
  doc.addEventListener("click", (event) => {
    const place = event.target?.closest?.("[data-peu-colocar]");
    if (place) proxEuroIdlePlace(Number(place.dataset.peuColocar));
  });
  return true;
}
