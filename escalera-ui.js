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
const PROX_EURO_STATUS = { ok: "Aquí va dinero", skipped: "Hoy no toca", "no-data": "Sin datos", "no-verdict": "Sin veredicto" };

function proxEuroEngine() {
  return globalThis.FinanceCanonicalNextEuro;
}

function proxEuroLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(PROX_EURO_STORE), "{}")) || {}; } catch { saved = {}; }
  const num = (value) => (value === "" || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value));
  return { amount: num(saved.amount), inAccounts: saved.inAccounts === true, expectedReturnPct: num(saved.expectedReturnPct), alreadyContributed: num(saved.alreadyContributed) };
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
    ${benefits ? `<ul class="peu-beneficios" aria-label="Beneficio esperado, por naturaleza">${benefits}</ul>` : ""}${notes}
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

function renderProximoEuro(engine) {
  const box = qs("proxEuroResultado");
  if (!box || !engine) return;
  attachProximoEuro(document); // idempotente: un clic temprano no puede perderse
  try {
    const inputs = proxEuroLoad();
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
  proxEuroSave({ amount, inAccounts: Boolean(qs("proxEuroEnCuentas")?.checked), expectedReturnPct: read("proxEuroRentabilidad"), alreadyContributed: read("proxEuroPension") });
  renderProximoEuro(proxEuroEngine());
  announceStatus("Escalera calculada.");
}

// Una sola vez, por delegación.
function attachProximoEuro(doc) {
  if (!doc || doc.__proxEuroAttached) return false;
  doc.__proxEuroAttached = true;
  doc.addEventListener("submit", (event) => { if (event.target?.id === "proxEuroForm") proxEuroSubmit(event); });
  return true;
}
