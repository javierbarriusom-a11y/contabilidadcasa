// WP-53 (CAP-10, docs/WP53_DISENO.md): sin duplicados entre lo que el hogar anota a mano y lo que trae el extracto. Motor puro:
// canonical-capture-dedupe.js (importe exacto, ±2 días, comercio por similitud, una captura con una fila; manda el extracto).
//
// Script de pantalla, como captura-ui.js: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, baseData, storageSet…).
// Nada de lo que sigue se ejecuta hasta que app.js lo llama o el hogar toca un control.
//
// Qué capturas se pueden emparejar con una fila del extracto:
//   · «captura rápida» y «foto de ticket» (movimientos con `source` manual-quick-capture / receipt-photo): ya tienen fecha e importe;
//   · «Registrar gasto» y el enlace de WP-25 SIN tarjetas (crean una partida con su real): dejan una entrada en `capture-log`.
// Las compras de la hoja de WP-30 NO se emparejan fila a fila: la tarjeta liquida en un cargo único y de eso se ocupa la conciliación.

const CAPTURA_DUP_MOVEMENT_SOURCES = ["manual-quick-capture", "receipt-photo"];

function capturaDupEngine() {
  return globalThis.FinanceCanonicalCaptureDedupe;
}

function loadCaptureLog() {
  return cachedLocalStore("capture-log", (raw) => capturaDupEngine().normalizeLog(raw), { entries: [] });
}

// «Registrar gasto» / enlace sin tarjetas: deja constancia de lo anotado (fecha y cuándo) para poder emparejarlo con el extracto.
function recordCaptureLog(entry) {
  const engine = capturaDupEngine();
  if (!engine) return;
  const id = `cap-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  storageSet(storageKey("capture-log"), JSON.stringify(engine.appendLog(loadCaptureLog(), { id, capturedAt: new Date().toISOString(), ...entry }, isoLocalDate(new Date()))));
}

// Las capturas que aún esperan su fila del banco, con la forma que entiende el motor.
function capturaDupPending() {
  const out = [];
  (baseData?.transactions || []).forEach((transaction) => {
    if (!CAPTURA_DUP_MOVEMENT_SOURCES.includes(String(transaction.source || ""))) return;
    if (!Number(transaction.amount) || !transaction.date) return;
    out.push({ id: `mov|${transactionIdentity(transaction)}`, kind: "movimiento", date: transaction.date, amount: Number(transaction.amount), concept: String(transaction.movement || ""), identity: transactionIdentity(transaction) });
  });
  const mapped = new Set(Object.values(movementMappings || {}).map((item) => item?.rowKey));
  loadCaptureLog().entries.forEach((entry) => {
    const rowKey = `expense|${entry.rowId}`;
    const row = customPlanningRows.find((item) => item.id === entry.rowId && item.monthKey === entry.monthKey);
    if (!row || mapped.has(rowKey) || isClosedMonthKey(entry.monthKey)) return; // la partida ya no existe, ya recibió su movimiento, o el mes está firmado
    out.push({ id: `log|${entry.id}`, kind: "partida", date: entry.date, amount: entry.amount, concept: entry.concept, monthKey: entry.monthKey, rowKey, entry });
  });
  return out;
}

// Lo que se le enseña al hogar de la captura, con la forma de un movimiento (la tabla del paso 3 pinta movimientos).
function capturaDupAsTransaction(capture) {
  if (capture.kind === "movimiento") return (baseData?.transactions || []).find((item) => transactionIdentity(item) === capture.identity) || null;
  return { date: capture.date, valueDate: capture.date, movement: capture.concept, details: "Anotado con «Registrar gasto»", amount: capture.amount, source: "captura-partida" };
}

// Empareja las filas de la sesión de importación con las capturas pendientes. Idempotente: se puede llamar al reconstruir la sesión.
function capturaDuplicadosAnotar(rows, engine = capturaDupEngine()) {
  if (!engine || !Array.isArray(rows)) return rows;
  rows.forEach((row) => { row.capturePair = null; });
  const pending = capturaDupPending();
  if (!pending.length) return rows;
  const byId = new Map(pending.map((item) => [item.id, item]));
  const bankRows = rows
    .map((row) => ({ id: row.rowId, date: row.transaction.date, amount: Number(row.transaction.amount), concept: `${row.transaction.movement || ""} ${row.transaction.details || ""}`, month: row.transaction.month || String(row.transaction.date || "").slice(0, 7) }));
  // Una partida solo se empareja con una fila de SU mes: el real se escribe por partida y mes, y en otro mes no la sustituiría.
  const result = engine.pairCaptures(pending, bankRows, {});
  const monthOf = new Map(bankRows.map((item) => [item.id, item.month]));
  result.pairs.forEach((pair) => {
    const capture = byId.get(pair.captureId);
    const row = rows.find((item) => item.rowId === pair.rowId);
    if (!capture || !row) return;
    if (capture.kind === "partida" && monthOf.get(pair.rowId) !== capture.monthKey) return;
    const shown = capturaDupAsTransaction(capture);
    if (!shown) return;
    row.capturePair = { captureId: capture.id, kind: capture.kind, identity: capture.identity || "", rowKey: capture.rowKey || "", confidence: pair.confidence, similarity: pair.similarity, days: pair.days, summary: engine.describePair(pair), shown };
    row.duplicates = [shown, ...(row.duplicates || []).filter((item) => item !== shown && transactionIdentity(item) !== transactionIdentity(shown))];
  });
  return rows;
}

// Una fila del paso 3 cuando el candidato es una captura: se enseña por qué se propone, qué se queda y que NO cambia nada hasta confirmar.
function capturaDuplicadosRowMarkup(row) {
  const pair = row.capturePair;
  const decided = row.duplicateDecision;
  const shown = pair.shown;
  const origin = pair.kind === "partida" ? "Anotado con «Registrar gasto»" : "Anotado a mano";
  const button = (value, label) => `<button type="button" class="e19-btn e19-btn-secondary${decided === value ? " is-active" : ""}" data-datos-importar-duplicate="${value}" data-datos-importar-row-id="${escapeHtml(row.rowId)}" aria-pressed="${decided === value ? "true" : "false"}">${label}</button>`;
  const later = pair.days !== 0 ? ` (el banco lo fecha el ${formatIsoDate(row.transaction.date)})` : "";
  const effect = pair.kind === "partida"
    ? "Si es la misma, la partida que anotaste pasa a valer lo que dice el banco, sin sumarse aparte."
    : "Si es la misma, se quita lo que anotaste y se queda la fila del banco.";
  const label = `Posible duplicado: ${formatIsoDate(row.transaction.date)} · ${movementDisplayName(row.transaction)} · ${money(row.transaction.amount, true)}`;
  return `<tr class="${decided ? "is-decided" : ""}" data-captura-duplicado="${pair.confidence}"><td colspan="3">
    <div class="cdup" role="group" aria-label="${escapeHtml(label)}">
      <div class="cdup-lados">
        <div><strong>Del extracto</strong><p>${escapeHtml(formatIsoDate(row.transaction.date))} · ${escapeHtml(movementDisplayName(row.transaction))} · ${money(row.transaction.amount, true)}</p></div>
        <div><strong>${origin}</strong><p>${escapeHtml(formatIsoDate(shown.date))} · ${escapeHtml(shown.movement)} · ${money(shown.amount, true)}${escapeHtml(later)}</p></div>
      </div>
      <p class="cdup-motivo">${escapeHtml(pair.summary)} ${effect}</p>
      <div class="datos-importar-row-actions">${button("misma", "Es la misma compra")}${button("distinto", "Son distintas")}</div>
    </div>
  </td></tr>`;
}

// En el paso de confirmar: sustituye cada captura por su fila del banco. Va DENTRO del lote reversible: «Deshacer» devuelve la captura.
// Devuelve cuántas capturas se han sustituido.
function capturaDuplicadosAplicar(rows) {
  let replaced = 0;
  const removeIdentities = new Set();
  rows.forEach((row) => {
    const pair = row.capturePair;
    if (!pair || row.duplicateDecision !== "misma") return;
    if (pair.kind === "movimiento") {
      removeIdentities.add(pair.identity);
    } else {
      // La partida anotada recibe esta fila del banco: su real pasa a ser lo que dice el extracto (applyMovementMappingsToActuals).
      movementMappings = { ...movementMappings, [transactionIdentity(row.transaction)]: { kind: "expense", rowKey: pair.rowKey, label: row.transaction.movement || "", updatedAt: new Date().toISOString() } };
    }
    replaced += 1;
  });
  if (removeIdentities.size) baseData = { ...baseData, transactions: (baseData.transactions || []).filter((item) => !removeIdentities.has(transactionIdentity(item))) };
  return replaced;
}

// Una frase para el paso de confirmar: cuántas capturas a mano se sustituirían.
function capturaDuplicadosResumen(rows) {
  const count = rows.filter((row) => row.capturePair && row.duplicateDecision === "misma").length;
  return count ? ` ${count} ${count === 1 ? "captura anotada a mano se sustituye" : "capturas anotadas a mano se sustituyen"} por su fila del banco (importe y fecha del extracto).` : "";
}
