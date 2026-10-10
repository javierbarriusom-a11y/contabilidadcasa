// WP-41 (DAC-04 + DNU-03, docs/WP41_DISENO.md): la tarjeta «Deuda en la sombra y TAE real» de Deuda › Contratos. El cálculo vive en canonical-shadow-debt.js (puro);
// aquí se leen los movimientos ya importados (`canonicalLedgerTransactions`) y los contratos que ya hay, se pintan los compromisos que se comportan como deuda con
// su evidencia, se guardan las respuestas del hogar en el almacén `shadow-debt-answers` y se atiende la calculadora de TAE de una oferta «sin intereses».
// NO da de alta nada (A11-4): «Añadir a Contratos» solo rellena el formulario de alta que ya existe, y quien lo envía decide. Tampoco va a Hoy (congelado hasta H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, isoLocalDate, announceStatus, estadoHtml, showUndoToast,
// canonicalLedgerTransactions, canonicalDebtContractRows, accountBalancesFromState, cuadroMandosReserve…). Sin llamadas al DOM ni escuchas al cargarse: app.js llama a
// `renderDeudaSombra` al pintar Deuda › Contratos, que engancha las escuchas la primera vez.

const SOMBRA_STORE = "shadow-debt-answers"; // en la copia (BACKUP_LOCAL_STORES)
const SOMBRA_VERDICT_TEXT = {
  free: "Financiar no cuesta nada extra. Si el pago encaja, no hay razón de coste para pagar al contado.",
  "free-keep-cash": "Financiar no cuesta nada extra y te deja el dinero rindiendo: aquí financiar sale mejor que pagar al contado.",
  "finance-pays": "Lo que rinde tu dinero parado supera la TAE: sobre el papel, financiar sale mejor que pagar al contado.",
  "cash-breaks-floor": "Pagar al contado te dejaría por debajo del colchón. Financiar cuesta lo de arriba: es el precio de no tocarlo, y vosotros decidís si lo vale.",
  "cash-cheaper": "Pagar al contado sale más barato que financiar.",
};
let sombraUndo = null; // { before } para «Deshacer» la última respuesta
let sombraShown = [];

function sombraEngine() {
  return globalThis.FinanceCanonicalShadowDebt;
}

function sombraLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(SOMBRA_STORE), "{}")) || {}; } catch { saved = {}; }
  return sombraEngine().normalizeAnswers(saved);
}

function sombraSave(answers) {
  storageSet(storageKey(SOMBRA_STORE), JSON.stringify(answers));
  queueRemoteSave();
}

function sombraEuros(value) {
  return money(value, true);
}

function sombraMonth(key) {
  return key ? escenarioMotorMonthLabel(key) : "";
}

function sombraItemHtml(item) {
  const end = item.endMonth
    ? `<p><strong>Acaba:</strong> ${escapeHtml(sombraMonth(item.endMonth))}${item.remaining === 0 ? " (esta es la última cuota)" : ` · quedan ${item.remaining} ${item.remaining === 1 ? "cuota" : "cuotas"}, ${sombraEuros(item.remainingTotal)}`}.</p>`
    : "<p><strong>Acaba:</strong> no se sabe cuándo (el extracto no dice cuántas cuotas son).</p>";
  const evidence = item.evidence.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `<li class="som-aviso" data-sombra-id="${escapeHtml(item.id)}">
      <p class="som-cabecera"><span class="som-tipo">${item.confidence === "alta" ? "Plazos a la vista" : "Parece financiación"}</span> <strong>${escapeHtml(item.label)}</strong> <span>${sombraEuros(item.monthlyAmount)} al mes</span></p>
      ${end}<ul class="som-evidencia">${evidence}</ul>
      <div class="som-acciones" role="group" aria-label="Qué hacer con este compromiso">
        <button type="button" class="e19-btn e19-btn-primary" data-sombra-anadir="${escapeHtml(item.id)}">Añadir a Contratos</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-sombra-tae="${escapeHtml(item.id)}">Calcular su TAE</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-sombra-respuesta="added" data-sombra-ref="${escapeHtml(item.id)}">Ya la he dado de alta</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-sombra-respuesta="not-debt" data-sombra-ref="${escapeHtml(item.id)}">No es deuda</button>
      </div>
    </li>`;
}

function sombraBodyHtml(result) {
  if (result.status === "missing") return `<p class="e19-kpi-note">Para mirar el extracto falta ${escapeHtml(result.missing.join(", "))}.</p>`;
  if (result.status === "stale") {
    const since = result.coveredUntil ? `El último movimiento importado es del ${escapeHtml(result.coveredUntil.split("-").reverse().map(Number).join("/"))}` : "Todavía no hay movimientos importados";
    return estadoHtml({ kind: "obsoleto", titulo: "No puedo mirar lo reciente", texto: `${since}: sin un extracto al día, que no salga nada no significa que no haya financiaciones.`, accion: { label: "Importar el extracto", href: "#registrar" } });
  }
  if (!result.items.length) {
    return `<p class="e19-kpi-note"><strong>No he encontrado compromisos que se comporten como deuda.</strong> Miré hasta el ${escapeHtml(result.coveredUntil.split("-").reverse().map(Number).join("/"))}${result.suppressed ? `; dejo ${result.suppressed} ya respondido${result.suppressed === 1 ? "" : "s"} o ya en la app` : ""}. Solo veo lo que el extracto delata (un «cuota 3 de 12» o la palabra «financiación»): una permanencia con penalización no sale en un extracto.</p>`;
  }
  const total = `<p class="som-resumen"><strong>${result.items.length} ${result.items.length === 1 ? "compromiso" : "compromisos"} que ${result.items.length === 1 ? "se comporta" : "se comportan"} como deuda</strong>: ${sombraEuros(result.monthlyTotal)} al mes${result.latestEnd ? `; el último con fecha acaba en ${escapeHtml(sombraMonth(result.latestEnd))}` : ""}${result.withoutEnd ? `; ${result.withoutEnd} sin fecha de fin conocida` : ""}. Ninguno cuenta hoy en vuestra fecha libre de deuda ni en el ratio de esfuerzo.</p>`;
  const more = result.overflow ? `<p class="e19-kpi-note">Hay ${result.overflow} más. Responde estos y aparecerán los siguientes.</p>` : "";
  const stats = result.stats.falsePositiveRate === null
    ? `<p class="e19-kpi-note som-medida">Cuántos avisos sobran todavía no se puede medir: hacen falta ${result.stats.minAnswered} respuestas y llevas ${result.stats.answered}.</p>`
    : `<p class="e19-kpi-note som-medida">De ${result.stats.answered} avisos respondidos, <strong>${result.stats.notDebt} no eran deuda (${Math.round(result.stats.falsePositiveRate * 100)} %)</strong>.</p>`;
  return `${total}<ul class="som-lista">${result.items.map(sombraItemHtml).join("")}</ul>${more}${stats}`;
}

function sombraCalcHtml() {
  return `<details class="som-calc" id="sombraCalc"><summary>¿Cuánto cuesta de verdad una oferta «sin intereses»?</summary>
      <p class="e19-kpi-note">Pon lo que cuesta <strong>al contado</strong> y cómo te lo cobran a plazos. La app calcula la <strong>TAE efectiva</strong> (con la comisión y el seguro, si los hay) y la compara con pagar al contado. Un campo que dejes en blanco se toma como 0: <strong>«sin comisión» solo es verdad si de verdad no hay ninguna</strong>.</p>
      <form id="sombraForm" novalidate>
        <div class="cuadro-mandos-controls">
          <label class="month-picker"><span>Precio al contado (€)</span><input type="number" id="sombraPrecio" min="0" step="0.01" inputmode="decimal" /></label>
          <label class="month-picker"><span>Número de plazos</span><input type="number" id="sombraPlazos" min="1" max="120" step="1" inputmode="numeric" /></label>
          <label class="month-picker"><span>Importe de cada plazo (€)</span><input type="number" id="sombraCuota" min="0" step="0.01" inputmode="decimal" /></label>
          <label class="month-picker"><span>Comisión de apertura (€)</span><input type="number" id="sombraComision" min="0" step="0.01" inputmode="decimal" /></label>
          <label class="month-picker"><span>Seguro al mes (€)</span><input type="number" id="sombraSeguro" min="0" step="0.01" inputmode="decimal" /></label>
          <label class="month-picker"><span>Pago final aparte (€, opcional)</span><input type="number" id="sombraFinal" min="0" step="0.01" inputmode="decimal" /></label>
          <label class="month-picker"><span>Lo que rinde el dinero parado (% al año, opcional)</span><input type="number" id="sombraRendimiento" min="0" max="30" step="0.1" inputmode="decimal" /></label>
        </div>
        <label class="som-check"><input type="checkbox" id="sombraAlInicio" /> El primer plazo se paga en el acto</label>
        <p class="e19-kpi-note is-danger" id="sombraError" role="alert" hidden></p>
        <button type="submit" class="e19-btn e19-btn-primary">Calcular la TAE</button>
      </form>
      <div id="sombraResultado" role="status" aria-live="polite"></div>
    </details>`;
}

function renderDeudaSombra(engine) {
  const box = qs("sombraCuerpo");
  if (!box || !engine) return;
  attachSombra(document); // idempotente: un clic temprano no puede perderse
  try {
    const result = engine.detectShadowDebt({
      today: isoLocalDate(new Date()),
      transactions: canonicalLedgerTransactions(),
      contracts: typeof canonicalDebtContractRows === "function" ? canonicalDebtContractRows() : [],
      answers: sombraLoad(),
    });
    sombraShown = result.items || [];
    const html = sombraBodyHtml(result);
    const list = qs("sombraLista");
    if (list && list.__sombraHtml !== html) {
      list.innerHTML = html;
      list.__sombraHtml = html;
    }
    if (!box.__sombraCalc) { // la calculadora se pinta una sola vez: repintarla borraría lo tecleado
      const calc = qs("sombraCalcBox");
      if (calc) calc.innerHTML = sombraCalcHtml();
      box.__sombraCalc = true;
    }
  } catch (error) {
    console.error(`renderDeudaSombra: ${error.message}`);
  }
}

function sombraNote(message, withUndo = false) {
  const note = qs("sombraNota");
  if (note) {
    note.textContent = message;
    if (withUndo) {
      note.append(" ");
      const undo = document.createElement("button");
      undo.type = "button";
      undo.className = "link-button som-deshacer";
      undo.dataset.sombraDeshacer = "1";
      undo.textContent = "Deshacer";
      note.append(undo);
    }
  }
  announceStatus(message);
}

function sombraAnswer(response, id) {
  const engine = sombraEngine();
  const item = sombraShown.find((candidate) => candidate.id === id);
  if (!item) return;
  sombraUndo = { before: sombraLoad() };
  sombraSave(engine.applyAnswer(sombraUndo.before, item, response, isoLocalDate(new Date())));
  renderDeudaSombra(engine);
  sombraNote(response === "added" ? "Anotado: ya está dada de alta." : "Anotado: no es deuda; no volveré a avisar de este compromiso.", true);
}

// Rellena el formulario de alta que ya existe en la pantalla: no crea nada, quien lo envía decide.
function sombraAddToContracts(id) {
  const item = sombraShown.find((candidate) => candidate.id === id);
  if (!item) return;
  const fill = sombraEngine().proposal(item);
  const entity = qs("deudaContratosAddEntity");
  const type = qs("deudaContratosAddType");
  const principal = qs("deudaContratosAddPrincipal");
  if (!entity || !type || !principal) return;
  entity.value = fill.entity;
  type.value = fill.type;
  principal.value = String(fill.principal);
  const payment = qs("deudaContratosAddPayment");
  if (payment) payment.value = String(fill.payment);
  const installments = qs("deudaContratosAddInstallments");
  if (installments) installments.value = fill.remainingInstallments === null ? "" : String(fill.remainingInstallments);
  entity.scrollIntoView?.({ block: "center" });
  entity.focus();
  sombraNote(`Formulario de alta rellenado con ${fill.entity}. ${fill.note} Revísalo y envíalo si es una deuda vuestra.`);
}

function sombraPrefillCalc(id) {
  const item = sombraShown.find((candidate) => candidate.id === id);
  const calc = qs("sombraCalc");
  if (!item || !calc) return;
  calc.open = true;
  qs("sombraCuota").value = String(item.monthlyAmount);
  qs("sombraPlazos").value = item.installmentsTotal === null ? "" : String(item.installmentsTotal);
  qs("sombraPrecio").value = "";
  qs("sombraPrecio").focus();
  sombraNote(`Calculadora preparada con la cuota de ${item.label}${item.installmentsTotal === null ? "" : ` y sus ${item.installmentsTotal} plazos`}. Falta lo que costaba al contado: sin él no se puede saber la TAE.`);
}

function sombraCalculate(event) {
  event.preventDefault();
  const engine = sombraEngine();
  const value = (id) => qs(id)?.value;
  const error = qs("sombraError");
  const apr = engine.effectiveApr({
    cashPrice: value("sombraPrecio"),
    installments: value("sombraPlazos"),
    installmentAmount: value("sombraCuota"),
    upfrontFee: value("sombraComision"),
    monthlyInsurance: value("sombraSeguro"),
    finalPayment: value("sombraFinal"),
    firstPaymentAtStart: Boolean(qs("sombraAlInicio")?.checked),
  });
  const out = qs("sombraResultado");
  if (!apr.calculable) {
    if (error) { error.textContent = apr.reason; error.hidden = false; }
    if (out) out.innerHTML = "";
    announceStatus(apr.reason);
    return;
  }
  if (error) error.hidden = true;
  const yieldRaw = value("sombraRendimiento");
  const balances = typeof accountBalancesFromState === "function" ? accountBalancesFromState() : null;
  const floor = typeof FinanceCanonicalCushion !== "undefined" ? FinanceCanonicalCushion.cushionFloor(lastSimulation, cuadroMandosReserve()) : null;
  const compare = engine.cashVsFinance({
    apr,
    cashPrice: Number(value("sombraPrecio")),
    liquidity: balances && Number.isFinite(Number(balances.total)) ? Number(balances.total) : null,
    floor: floor ? floor.value : null,
    yieldPct: yieldRaw === "" || yieldRaw === undefined ? null : Number(yieldRaw),
  });
  const aprText = `${String(apr.aprPct).replace(".", ",")} %`;
  const negative = apr.aprPct < 0 ? "<p class=\"e19-kpi-note\">Sale negativa: con estas cifras pagas <strong>menos</strong> a plazos que al contado. Comprueba que el precio al contado es el real.</p>" : "";
  const verdict = SOMBRA_VERDICT_TEXT[compare.verdict] ? `<p>${escapeHtml(SOMBRA_VERDICT_TEXT[compare.verdict])}</p>` : "";
  const afterCash = compare.afterCash !== null && compare.afterCash !== undefined ? `<p class="e19-kpi-note">Pagar ${sombraEuros(Number(value("sombraPrecio")))} al contado dejaría ${sombraEuros(compare.afterCash)} de liquidez${compare.belowFloor === true ? ", por debajo del colchón" : compare.belowFloor === false ? ", por encima del colchón" : ""}.</p>` : "";
  const notes = compare.notes.length ? `<ul class="som-evidencia">${compare.notes.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "";
  if (out) {
    out.innerHTML = `<p class="som-tae" data-sombra-tae-resultado="${escapeHtml(String(apr.aprPct))}"><strong>TAE efectiva: ${aprText}</strong> · pagas ${sombraEuros(apr.totalPaid)} en total, <strong>${sombraEuros(apr.extraCost)} ${apr.extraCost >= 0 ? "más" : "menos"} que al contado</strong> (${String(apr.extraCostPct).replace(".", ",")} %).</p>${negative}${verdict}${afterCash}${notes}<p class="e19-kpi-note">Interés simple de la TIR de los flujos que has puesto; no incluye comisiones que no hayas tecleado.</p>`;
  }
  announceStatus(`TAE efectiva ${aprText}`);
}

// Una sola vez, por delegación.
function attachSombra(doc) {
  if (!doc || doc.__sombraAttached) return false;
  doc.__sombraAttached = true;
  const inCard = (target) => target?.closest?.("#sombraCard");
  doc.addEventListener("submit", (event) => { if (event.target?.id === "sombraForm") sombraCalculate(event); });
  doc.addEventListener("click", (event) => {
    const target = event.target;
    if (!inCard(target)) return;
    const answer = target.closest("[data-sombra-respuesta]");
    if (answer) { sombraAnswer(answer.dataset.sombraRespuesta, answer.dataset.sombraRef); return; }
    const add = target.closest("[data-sombra-anadir]");
    if (add) { sombraAddToContracts(add.dataset.sombraAnadir); return; }
    const tae = target.closest("[data-sombra-tae]");
    if (tae) { sombraPrefillCalc(tae.dataset.sombraTae); return; }
    if (target.closest("[data-sombra-deshacer]") && sombraUndo) {
      sombraSave(sombraUndo.before);
      sombraUndo = null;
      renderDeudaSombra(sombraEngine());
      sombraNote("Respuesta deshecha: el compromiso vuelve a aparecer.");
    }
  });
  return true;
}
