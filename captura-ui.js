// WP-30 · PR-2 (docs/WP30_DISENO.md §5): la hoja de captura de compras con tarjeta. Importe primero, concepto con sugerencias, tarjeta,
// fecha y «Guardar», con deshacer de 8 s. La abre «+ Registrar gasto» de Hoy y el enlace de registro de WP-25 cuando hay tarjetas
// configuradas; sin tarjetas, todo sigue como antes (la ventana «Registrar gasto» de FLU-2). Motor puro: canonical-card-purchases.js.
//
// Script de pantalla, como partidas-ui.js: se carga antes de app.js y comparte su ámbito global (qs, money, storageSet, render…).
// Nada de lo que sigue se ejecuta hasta que app.js lo llama o el hogar toca un control.

let capturaSheet = null; // { openedAt, cardId, dateMode, prefillNote } mientras la hoja está abierta
let cardPurchasesHtml = "";

function loadCardPurchases() {
  return cachedLocalStore("card-purchases", (raw) => globalThis.FinanceCanonicalCardPurchases.normalizeStore(raw), { purchases: [], timings: [], lastCard: "" });
}

function saveCardPurchases(store) {
  storageSet(storageKey("card-purchases"), JSON.stringify(store));
}

// El tiempo de la ventana anterior «Registrar gasto» (FLU-2), para poder decir «de X a Y segundos» (M-CAPT).
function recordLegacyCaptureTime(seconds) {
  const engine = globalThis.FinanceCanonicalCardPurchases;
  if (engine && Number.isFinite(seconds)) saveCardPurchases(engine.recordTiming(loadCardPurchases(), "dialogo", seconds, new Date().toISOString()));
}

function capturaChip(label, attribute, value, pressed) {
  return `<button type="button" class="e19-btn ${pressed ? "e19-btn-primary" : "e19-btn-secondary"}" ${attribute}="${escapeHtml(value)}" aria-pressed="${pressed ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

// La tarjeta que el enlace nombra («cuenta=Carrefour»), sin acentos ni mayúsculas; solo si es una y solo una.
function capturaCardForAccount(cards, account) {
  const wanted = normalizedText(account || "");
  if (!wanted) return "";
  const hits = cards.filter((card) => normalizedText(card.label).includes(wanted) || wanted.includes(normalizedText(card.label)));
  return hits.length === 1 ? hits[0].id : "";
}

// Lo que la hoja enseña de un enlace de registro: de dónde viene y qué no se ha usado. Texto plano (va con textContent).
function captureLinkSheetNote(link) {
  const { fields, errors, warnings } = link;
  const origin = [fields.origin === "enlace" ? "" : fields.originLabel, fields.account ? `tarjeta o cuenta ${fields.account}` : "", fields.date ? `${fields.dateDefaulted ? "hoy, " : ""}${fields.date.split("-").reverse().join("/")}` : ""].filter(Boolean).join(" · ");
  const lines = [`Rellenado desde un enlace${origin ? ` (${origin})` : ""}. Revisa los datos: no se guarda nada hasta que pulses «Guardar».`];
  if (Object.keys(errors).length) lines.push(`Del enlace no se ha usado: ${Object.values(errors).join("; ")}.`);
  if (warnings.length) lines.push(`Aviso: ${warnings.join("; ")}.`);
  return lines.join(" ");
}

function capturaSelectedDate(today) {
  if (capturaSheet.dateMode === "ayer") return addDaysIsoLocal(today, -1);
  if (capturaSheet.dateMode === "otra") return qs("capturaHojaDate").value || "";
  return today;
}

function addDaysIsoLocal(iso, count) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + count)).toISOString().slice(0, 10);
}

function renderCapturaSheet() {
  if (!capturaSheet) return;
  const engine = globalThis.FinanceCanonicalCardPurchases;
  const cycles = globalThis.FinanceCanonicalCardCycles;
  const cards = loadCardCycles().cards;
  const today = isoLocalDate(new Date());
  const concept = qs("capturaHojaConcept").value;
  const suggestions = engine.conceptSuggestions(loadCardPurchases(), { now: new Date().toISOString(), cardId: capturaSheet.cardId });
  qs("capturaHojaSuggest").innerHTML = suggestions.map((item) => capturaChip(item, "data-captura-concepto", item, normalizedText(item) === normalizedText(concept))).join("");
  qs("capturaHojaCards").innerHTML = cards.map((card) => capturaChip(card.label, "data-captura-tarjeta", card.id, card.id === capturaSheet.cardId)).join("");
  qs("capturaHojaDates").innerHTML = [["hoy", "Hoy"], ["ayer", "Ayer"], ["otra", "Otra fecha"]].map(([value, label]) => capturaChip(label, "data-captura-fecha", value, value === capturaSheet.dateMode)).join("");
  const dateInput = qs("capturaHojaDate");
  dateInput.hidden = capturaSheet.dateMode !== "otra";
  dateInput.max = today;
  const card = cards.find((item) => item.id === capturaSheet.cardId);
  const date = capturaSelectedDate(today);
  const cycle = card && date ? cycles.cycleFor(date, card) : null;
  qs("capturaHojaPreview").textContent = cycle ? `Se carga el ${cycle.chargeDate.split("-").reverse().join("/")} (ciclo del ${cycle.cycleStart.split("-").reverse().join("/")} al ${cycle.cycleEnd.split("-").reverse().join("/")}).` : "";
  const note = qs("capturaHojaNote");
  note.hidden = !capturaSheet.prefillNote;
  note.textContent = capturaSheet.prefillNote || "";
}

/**
 * Abre la hoja. Devuelve `false` (y no hace nada) si no hay tarjetas configuradas o la hoja no está disponible: el llamador abre
 * entonces la ventana anterior. `prefill`: { amount, label, date, account, note } del enlace de registro (WP-25).
 */
function openCapturaHoja(prefill = null) {
  const dialog = qs("capturaHojaDialog");
  const engine = globalThis.FinanceCanonicalCardPurchases;
  const cards = globalThis.FinanceCanonicalCardCycles ? loadCardCycles().cards : [];
  if (!dialog || !engine || !cards.length || dialog.open) return false;
  const today = isoLocalDate(new Date());
  const last = loadCardPurchases().lastCard;
  const cardId = capturaCardForAccount(cards, prefill?.account) || (cards.some((card) => card.id === last) ? last : cards.length === 1 ? cards[0].id : "");
  const fromLink = prefill?.date && prefill.date !== today;
  capturaSheet = { openedAt: Date.now(), cardId, dateMode: fromLink ? (prefill.date === addDaysIsoLocal(today, -1) ? "ayer" : "otra") : "hoy", prefillNote: prefill?.note || "" };
  qs("capturaHojaAmount").value = prefill?.amount ? formatAmountField(prefill.amount) : "";
  qs("capturaHojaConcept").value = prefill?.label || "";
  qs("capturaHojaDate").value = fromLink ? prefill.date : "";
  qs("capturaHojaError").textContent = "";
  renderCapturaSheet();
  dialog.showModal();
  // Importe primero (teclado decimal abierto); desde un enlace, el primer dato que falta.
  const first = !prefill?.amount ? qs("capturaHojaAmount") : !prefill?.label ? qs("capturaHojaConcept") : qs("capturaHojaSubmit");
  first.focus();
  return true;
}

function saveCapturaSheet() {
  const engine = globalThis.FinanceCanonicalCardPurchases;
  const cycles = globalThis.FinanceCanonicalCardCycles;
  const cards = loadCardCycles().cards;
  const today = isoLocalDate(new Date());
  const amount = parseAmountField(qs("capturaHojaAmount").value);
  const seconds = Math.round(((Date.now() - capturaSheet.openedAt) / 1000) * 10) / 10;
  const result = engine.buildPurchase(
    { amount, concept: qs("capturaHojaConcept").value, card: capturaSheet.cardId, date: capturaSelectedDate(today), seconds },
    { today, now: new Date().toISOString(), cards },
  );
  const errors = Object.values(result.errors);
  if (errors.length) {
    qs("capturaHojaError").textContent = errors.join(" ");
    const field = result.errors.amount ? "capturaHojaAmount" : result.errors.concept ? "capturaHojaConcept" : null;
    if (field) qs(field).focus();
    return false;
  }
  const purchase = result.purchase;
  const before = loadCardPurchases();
  saveCardPurchases(engine.addPurchase(before, purchase));
  const card = cards.find((item) => item.id === purchase.card);
  const cycle = cycles.cycleFor(purchase.date, card);
  render();
  announceStatus(`Anotada la compra de ${money(purchase.amount, true)}.`);
  showUndoToast(`Anotada: ${money(purchase.amount, true)} · ${purchase.concept} · ${card.label}. Se carga el ${cycle.chargeDate.split("-").reverse().join("/")}.`, () => {
    saveCardPurchases(engine.removePurchase(loadCardPurchases(), purchase.id));
    render();
    announceStatus("Compra deshecha.");
  }, 8000);
  return true;
}

function handleCapturaClick(event) {
  if (!capturaSheet) return;
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.capturaConcepto !== undefined) qs("capturaHojaConcept").value = target.dataset.capturaConcepto;
  else if (target.dataset.capturaTarjeta !== undefined) capturaSheet.cardId = target.dataset.capturaTarjeta;
  else if (target.dataset.capturaFecha !== undefined) capturaSheet.dateMode = target.dataset.capturaFecha;
  else if (target.id === "capturaHojaCancel") {
    qs("capturaHojaDialog").close("cancel");
    return;
  } else if (target.id === "capturaHojaLegacy") {
    qs("capturaHojaDialog").close("cancel");
    openHomeQuickExpenseDialog();
    return;
  } else return;
  event.preventDefault();
  qs("capturaHojaError").textContent = "";
  renderCapturaSheet();
  if (target.dataset.capturaConcepto !== undefined) qs("capturaHojaSubmit").focus();
}

// «Hecho» del teclado envía el formulario: Guardar es su único botón de envío (Cancelar no lo es).
function handleCapturaSubmit(event) {
  event.preventDefault();
  if (capturaSheet && saveCapturaSheet()) qs("capturaHojaDialog").close("confirm");
}

// Plan › Partidas › Tarjetas de crédito: tiempos, compras por concepto y ciclo, y las últimas con «Quitar».
function renderCardPurchases() {
  const engine = globalThis.FinanceCanonicalCardPurchases;
  const cycles = globalThis.FinanceCanonicalCardCycles;
  const target = qs("tarjetasCompras");
  if (!engine || !cycles || !target) return;
  const cards = loadCardCycles();
  const store = loadCardPurchases();
  const html = engine.renderHtml({ store, cards: cards.cards, report: engine.conceptReport(store, cards, cycles), summary: engine.timingSummary(store) }, { money: (value) => money(value, true) });
  if (html !== cardPurchasesHtml) target.innerHTML = cardPurchasesHtml = html;
}

function handleCardPurchaseRemove(event) {
  const button = event.target.closest?.("[data-compra-quitar]");
  const engine = globalThis.FinanceCanonicalCardPurchases;
  if (!button || !engine) return;
  const before = loadCardPurchases();
  const purchase = before.purchases.find((item) => item.id === button.dataset.compraQuitar);
  if (!purchase) return;
  saveCardPurchases(engine.removePurchase(before, purchase.id));
  render();
  renderCardPurchases();
  showUndoToast(`Compra quitada: ${purchase.concept}, ${money(purchase.amount, true)}.`, () => {
    saveCardPurchases(before);
    render();
    renderCardPurchases();
  });
}

// Este script se ejecuta antes que app.js: `qs` todavía no existe, de ahí `document.getElementById`.
const capturaListen = (id, type, handler) => document.getElementById(id)?.addEventListener(type, handler);
capturaListen("capturaHojaDialog", "click", handleCapturaClick);
capturaListen("capturaHojaForm", "submit", handleCapturaSubmit);
capturaListen("capturaHojaConcept", "input", () => capturaSheet && renderCapturaSheet());
capturaListen("capturaHojaDate", "input", () => capturaSheet && renderCapturaSheet());
capturaListen("capturaHojaDialog", "close", () => { capturaSheet = null; });
capturaListen("tarjetasCompras", "click", handleCardPurchaseRemove);
