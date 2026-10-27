// XGO-01 · PR-3 (desalojo de app.js, 27/10/2026): el asistente «Importar extracto» en cuatro pasos (V4-4, R-8), tal cual estaba en app.js,
// sin cambiar una coma. Lo usan Registrar › Importar extracto, la vista v2 (views/importar-v2.js), el buzón (buzon-extractos.js) y el texto de un
// PDF (extracto-pdf-ui.js).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, state, money, escapeHtml, storageGet/storageSet, isoLocalDate,
// mappingForMovement, movementMappingKey, mergeTransactions, FinanceCanonicalE5, render…). Solo declara funciones, constantes y las dos variables de
// la sesión (`datosImportarSession`, `datosImportarLastResult`); nada se ejecuta al cargarse: lo llama app.js al pintar.

// ---------------------------------------------------------------------------------------------
// V4-4 · Importar extracto en cuatro pasos (mockups 5c/5d): Cargar → Clasificar → Duplicados →
// Incorporar. Nada entra en el plan hasta confirmar el paso 4.
//
// No reinventa lo que ya existe y funciona:
//   - la reversibilidad («una sola entrada revertible del historial») es exactamente
//     FinanceCanonicalE5.createImportBatch/undoImportBatch, la misma que ya usan
//     processDataRecords y el importador de extracto de #data-entry — «Deshacer último lote»
//     funciona sobre esta importación sin ningún cambio;
//   - las reglas previas son el mismo diccionario `movementMappings` que ya usa #data-entry
//     (mappingForMovement/movementMappingKey/exactMovementPlanningMatch): una regla aprendida
//     aquí sirve también allí, y viceversa;
//   - el aviso de mes cerrado reutiliza isClosedMonthKey.
// Lo que sí es nuevo, porque no existía nada parecido:
//   - el detector de duplicados por importe en una ventana de días (datosImportarDuplicateCandidates)
//     — el único «duplicado» que existía antes era una colisión de identidad exacta, que
//     mergeTransactions ya resuelve por sí solo y nunca llega a pedir una decisión;
//   - el registro de «ignorar» (un movimiento sin partida a propósito, no todavía sin decidir),
//     guardado aparte del diccionario de reglas para no confundir «ignorado» con «sin regla»;
//   - la huella de fichero para detectar «ya subiste esto» y la bandeja que se guarda a medias.
// ---------------------------------------------------------------------------------------------

const DATOS_IMPORTAR_DRAFT_KEY = "datos-importar-borrador";
const DATOS_IMPORTAR_IGNORED_KEY = "datos-importar-ignorados";
const DATOS_IMPORTAR_HISTORY_KEY = "datos-importar-historial-huellas";
const DATOS_IMPORTAR_DUPLICATE_WINDOW_DAYS = 7;

// FNV-1a de 32 bits sobre el texto normalizado del fichero: no es criptográfico ni pretende serlo,
// solo necesita producir el mismo valor para el mismo contenido para poder decir «esto ya se subió».
function datosImportarContentHash(text) {
  const normalized = String(text || "");
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function datosImportarLoadIgnored() {
  try {
    const parsed = JSON.parse(storageGet(storageKey(DATOS_IMPORTAR_IGNORED_KEY), "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function datosImportarSaveIgnored(map) {
  storageSet(storageKey(DATOS_IMPORTAR_IGNORED_KEY), JSON.stringify(map || {}));
}

function datosImportarLoadAppliedHashes() {
  try {
    const parsed = JSON.parse(storageGet(storageKey(DATOS_IMPORTAR_HISTORY_KEY), "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function datosImportarRecordAppliedHash(hash, meta = {}) {
  const list = datosImportarLoadAppliedHashes();
  list.push({ hash, fileName: meta.fileName || "", appliedAt: meta.appliedAt || new Date().toISOString(), batchId: meta.batchId || "" });
  // Se conservan las últimas 50 huellas, no todo el histórico: basta para detectar el «otra vez el
  // mismo fichero» habitual (repetir un mes por error) sin dejar crecer el almacén sin límite.
  storageSet(storageKey(DATOS_IMPORTAR_HISTORY_KEY), JSON.stringify(list.slice(-50)));
}

function datosImportarFindAppliedHash(hash) {
  return datosImportarLoadAppliedHashes().slice().reverse().find((entry) => entry.hash === hash) || null;
}

function datosImportarLoadDraft() {
  try {
    const parsed = JSON.parse(storageGet(storageKey(DATOS_IMPORTAR_DRAFT_KEY), "null"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function datosImportarSaveDraft(draft) {
  storageSet(storageKey(DATOS_IMPORTAR_DRAFT_KEY), JSON.stringify(draft));
}

function datosImportarClearDraft() {
  storageSet(storageKey(DATOS_IMPORTAR_DRAFT_KEY), "null");
}

function daysBetweenIsoDates(a, b) {
  const parse = (value) => {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  };
  const left = parse(a);
  const right = parse(b);
  if (left === null || right === null) return Infinity;
  return Math.abs(left - right) / 86400000;
}

// Un «candidato a duplicado» es un movimiento ya registrado con el mismo importe (redondeado) en
// una ventana de DATOS_IMPORTAR_DUPLICATE_WINDOW_DAYS días, que no sea ya la misma fila exacta —
// eso lo resuelve mergeTransactions por identidad y nunca necesita preguntarse—. Es deliberadamente
// solo importe + fecha próxima, sin comparar el concepto: dos cargos legítimos del mismo comercio
// el mismo día por el mismo importe son indistinguibles de un duplicado sin mirar el extracto
// original en mano, así que se pregunta en vez de asumir en cualquiera de los dos sentidos.
function datosImportarDuplicateCandidates(transaction, existingTransactions, windowDays = DATOS_IMPORTAR_DUPLICATE_WINDOW_DAYS) {
  const amount = round2(transaction.amount);
  const ownIdentity = transactionIdentity(transaction);
  return (existingTransactions || []).filter((existing) => {
    if (transactionIdentity(existing) === ownIdentity) return false;
    if (round2(existing.amount) !== amount) return false;
    return daysBetweenIsoDates(existing.date, transaction.date) <= windowDays;
  });
}

// Estado de un movimiento antes de que el usuario decida nada en esta sesión: «regla-previa» si ya
// hay una relación guardada o coincide por nombre exacto con una partida (mappingForMovement, el
// mismo diccionario que usa #data-entry); «ignorado-antes» si una importación anterior marcó
// expresamente «Ignorar» para movimientos con esta misma descripción; si no, «pendiente». Separar
// «ignorado» de «regla-previa» importa: los dos cuentan como «con regla previa» en el paso 1 (no
// piden nada), pero solo el primero tiene una partida detrás.
function datosImportarPriorClassification(transaction, ignored = datosImportarLoadIgnored()) {
  const mapping = mappingForMovement(transaction);
  if (mapping) return { status: "regla-previa", mapping };
  if (ignored[movementMappingKey(transaction)]) return { status: "ignorado-antes", mapping: null };
  return { status: "pendiente", mapping: null };
}

// Sugerencia para un movimiento sin regla previa: si el nombre de alguna partida disponible aparece
// dentro del concepto (o al revés), se ofrece esa partida. Es una coincidencia por subcadena, no
// semántica — no entiende sinónimos ni errores de tecleo —, así que solo cuenta subcadenas de al
// menos 4 caracteres: menos que eso y una partida de nombre corto («Luz», «Gas») dispararía con
// casi cualquier concepto bancario.
function datosImportarSuggestionFor(transaction) {
  const kind = movementKindFromAmount(transaction.amount);
  const text = normalizedText(`${transaction.movement || ""} ${transaction.details || ""}`);
  if (text.length < 4) return null;
  return (
    availableSeriesRows(kind).find((row) => {
      const label = normalizedText(displayLabelForRow(row));
      return label.length >= 4 && (text.includes(label) || label.includes(text));
    }) || null
  );
}

// Construye las filas de trabajo de la sesión a partir de los movimientos ya parseados: una
// fotografía de lo que se vería si se importaran tal cual, sin mutar nada del estado global.
function datosImportarBuildRows(transactions) {
  const ignored = datosImportarLoadIgnored();
  const existing = baseData.transactions || [];
  return capturaDuplicadosAnotar(transactions.map((transaction, index) => {
    const prior = datosImportarPriorClassification(transaction, ignored);
    return {
      rowId: `fila-${index}`,
      transaction,
      prior,
      suggestion: prior.status === "pendiente" ? datosImportarSuggestionFor(transaction) : null,
      duplicates: datosImportarDuplicateCandidates(transaction, existing, duplicateWindowDays()),
      // decision: { tipo: "aceptar-sugerencia" | "otra-partida" (+ rowKey) | "ignorar" }, o null
      // mientras el paso 2 no la haya resuelto.
      decision: null,
      // duplicateDecision: "duplicado" | "distinto", o null mientras el paso 3 no la haya resuelto.
      duplicateDecision: null,
    };
  }), globalThis.FinanceCanonicalCaptureDedupe);
}

function datosImportarCounters(rows) {
  const conReglaPrevia = rows.filter((row) => row.prior.status !== "pendiente").length;
  const pidenDecision = rows.filter((row) => row.prior.status === "pendiente").length;
  const posiblesDuplicados = rows.filter((row) => row.duplicates.length > 0).length;
  return { conReglaPrevia, pidenDecision, posiblesDuplicados, total: rows.length };
}

function datosImportarRowsPendingClassification(rows) {
  return rows.filter((row) => row.prior.status === "pendiente" && !row.decision);
}

function datosImportarRowsPendingDuplicate(rows) {
  return rows.filter((row) => row.duplicates.length > 0 && !row.duplicateDecision);
}

// Los movimientos que de verdad entrarían en el plan: todos salvo los que el paso 3 ha marcado
// como duplicado de algo que ya está registrado.
// M-3: cuando el paso 3 marca un candidato como «distinto» (no duplicado), esa decisión se perdía
// al fusionar con baseData.transactions — se estampa aquí como duplicateReviewed, la única fuente
// real que lee el chip «Duplicado revisado» de Movimientos.
function datosImportarIncludedTransactions(rows, bankAccount = "") {
  return rows
    .filter((row) => row.duplicateDecision !== "duplicado")
    .map((row) => {
      const base = row.duplicateDecision === "distinto" ? { ...row.transaction, duplicateReviewed: true } : row.transaction;
      return bankAccount ? { ...base, account: bankAccount } : base;
    });
}

// Las relaciones nuevas que esta sesión añadiría al diccionario de reglas, sin escribirlas
// todavía: solo las decisiones explícitas del paso 2 (aceptar sugerencia u otra partida). Un
// movimiento que ya tenía regla previa no genera nada aquí, porque no ha cambiado.
function datosImportarSessionMappingsDelta(rows) {
  const extra = {};
  rows.forEach((row) => {
    if (row.duplicateDecision === "duplicado") return;
    const kind = movementKindFromAmount(row.transaction.amount);
    if (row.decision?.tipo === "aceptar-sugerencia" && row.suggestion) {
      extra[movementMappingKey(row.transaction)] = { kind, rowKey: seriesKeyForRow(row.suggestion) };
    } else if (row.decision?.tipo === "otra-partida" && row.decision.rowKey) {
      extra[movementMappingKey(row.transaction)] = { kind, rowKey: row.decision.rowKey };
    }
  });
  return extra;
}

// El mismo cálculo que applyMovementMappingsToActuals, pero en modo lectura: recibe la lista de
// movimientos y el diccionario de reglas que se le quiera pasar (los reales o unos hipotéticos) y
// devuelve los totales por partida y mes, sin tocar `incomeActuals`/`expenseActuals`. Se duplica a
// propósito en vez de reutilizar la función que sí muta, por la misma razón que resolveEscenario
// nunca aplica un plan hasta que el usuario lo confirma: el paso 4 necesita ver el «después» sin
// que exista todavía.
function datosImportarComputeActuals(transactions, mappings) {
  const totals = { income: new Map(), expense: new Map() };
  (transactions || []).forEach((transaction) => {
    const kind = movementKindFromAmount(transaction.amount);
    const stored = mappings[movementMappingKey(transaction)];
    const storedRow = stored?.kind === kind ? planningRowBySeriesKey(kind, stored.rowKey) : null;
    const row = storedRow || exactMovementPlanningMatch(transaction);
    if (!row) return;
    const month = monthByKey(transaction.month, baseData.monthlyPlanning?.months || []);
    if (!month || isClosedMonthKey(month.key)) return;
    const key = actualKeyForRow(row, month);
    const amount = kind === "income" ? Number(transaction.amount || 0) : Math.abs(Number(transaction.amount || 0));
    const previous = totals[kind].get(key);
    totals[kind].set(key, { row, month, value: round2((previous?.value || 0) + amount) });
  });
  return totals;
}

// La tabla de impacto del paso 4: solo las partidas cuyo real cambiaría si se incorporara la
// sesión tal como está decidida ahora mismo. No se recalcula todo el plan —sería ruido—, solo lo
// que esta importación tocaría.
function datosImportarImpactRows(rows) {
  const before = datosImportarComputeActuals(baseData.transactions || [], movementMappings);
  const after = datosImportarComputeActuals(
    mergeTransactions(baseData.transactions || [], datosImportarIncludedTransactions(rows)),
    { ...movementMappings, ...datosImportarSessionMappingsDelta(rows) },
  );
  const keys = new Set([...before.income.keys(), ...before.expense.keys(), ...after.income.keys(), ...after.expense.keys()]);
  const impact = [];
  ["income", "expense"].forEach((kind) => {
    keys.forEach((key) => {
      const beforeEntry = before[kind].get(key);
      const afterEntry = after[kind].get(key);
      if (!beforeEntry && !afterEntry) return;
      const beforeValue = beforeEntry?.value ?? (actualsForKind(kind)[key] ?? 0);
      const afterValue = afterEntry?.value ?? beforeValue;
      if (round2(beforeValue) === round2(afterValue)) return;
      const source = afterEntry || beforeEntry;
      impact.push({ kind, row: source.row, month: source.month, before: round2(beforeValue), after: round2(afterValue), desviacion: round2(afterValue - beforeValue) });
    });
  });
  return impact.sort((a, b) => Math.abs(b.desviacion) - Math.abs(a.desviacion));
}

// WP-51: la lectura del CSV (separador, decimal, fechas, columnas, filas con error) vive en canonical-statement-profiles.js; aquí solo se completa cada movimiento leído con lo que añade la app.
function movementsFromStatementRows(rows) {
  return rows.map((row) => {
    const transaction = { ...row, category: "", source: "csv", statementOrder: 0, month: row.date.slice(0, 7) };
    transaction.category = classifyTransaction(transaction);
    return transaction;
  });
}

// Rango de fechas y cuenta detectados en el fichero, para el aviso de mes cerrado y la ficha del
// paso 1. «Cuenta» aquí es descriptiva, no una cuenta con id propio: la app solo modela caixa y
// mediolanum como saldos, no como cuentas con movimientos separados, así que se dice el origen del
// fichero (nombre de la hoja o «CSV») en vez de fingir haber identificado una cuenta bancaria real.
function datosImportarFileSummary(transactions, sourceLabel) {
  const dates = transactions.map((t) => t.date).filter(Boolean).sort();
  const months = [...new Set(transactions.map((t) => t.month).filter(Boolean))].sort();
  const closedMonths = months.filter((month) => isClosedMonthKey(month));
  return {
    account: sourceLabel,
    from: dates[0] || "",
    to: dates.at(-1) || "",
    months,
    closedMonths,
  };
}

// Aplica de verdad la sesión: fusiona los movimientos no marcados como duplicado, escribe las
// decisiones de clasificación en el mismo diccionario que usa #data-entry (una regla aprendida
// aquí sirve también allí, y viceversa), recalcula los reales, y lo empaqueta todo como un único
// lote reversible — el mismo mecanismo que ya usan processDataRecords y el importador de extracto
// de #data-entry (FinanceCanonicalE5.createImportBatch), así que «Deshacer último lote» funciona
// sobre esta importación exactamente igual que sobre las demás.
function datosImportarApply(session, { motivo }) {
  const rows = session.rows;
  // `appStatePayload` solo incluye `baseData.transactions` en el snapshot cuando
  // `baseData.metadata.sourceWorkbookStatus === "Leído desde la app"` — lo que activa
  // `refreshMovementRollups`. Si esta es la primera vez que se tocan movimientos en la sesión, ese
  // campo todavía no está puesto: sin él, el «antes» no llevaría los movimientos actuales y
  // deshacer el lote no podría devolverlos, porque nunca se llegaron a guardar. Se fuerza aquí,
  // sobre los datos tal cual están, antes de fotografiar nada.
  if (baseData?.metadata?.sourceWorkbookStatus !== "Leído desde la app") refreshMovementRollups();
  const beforeState = appStatePayload({ includeCanonical: false });
  movementMappings = { ...movementMappings }; // el «antes» guarda esta referencia: sin copia, las reglas del lote seguían al deshacerlo

  const ignored = datosImportarLoadIgnored();
  let nuevasReglas = 0;
  let nuevosIgnorados = 0;
  rows.forEach((row) => {
    if (row.duplicateDecision === "duplicado") return;
    const key = movementMappingKey(row.transaction);
    const kind = movementKindFromAmount(row.transaction.amount);
    if (row.decision?.tipo === "aceptar-sugerencia" && row.suggestion) {
      movementMappings[key] = { kind, rowKey: seriesKeyForRow(row.suggestion), label: displayLabelForRow(row.suggestion), updatedAt: new Date().toISOString() };
      nuevasReglas += 1;
    } else if (row.decision?.tipo === "otra-partida" && row.decision.rowKey) {
      const chosen = planningRowBySeriesKey(kind, row.decision.rowKey);
      movementMappings[key] = { kind, rowKey: row.decision.rowKey, label: chosen ? displayLabelForRow(chosen) : "", updatedAt: new Date().toISOString() };
      nuevasReglas += 1;
    } else if (row.decision?.tipo === "ignorar") {
      ignored[key] = { updatedAt: new Date().toISOString() };
      nuevosIgnorados += 1;
    }
  });

  const capturasSustituidas = capturaDuplicadosAplicar(rows); // WP-53: dentro del lote, para que «Deshacer» devuelva la captura
  const incoming = datosImportarIncludedTransactions(rows, session.fileMeta.bankAccount);
  baseData = { ...baseData, transactions: mergeTransactions(baseData.transactions || [], incoming) };
  refreshMovementRollups();
  const appliedActuals = applyMovementMappingsToActuals();
  const balance = applyDatosImportarBalanceOffer(session); // WP-26 · ND-02: dentro del lote, para que «Deshacer» lo devuelva
  globalThis.FinanceCobertura?.registrar(session, incoming); // XDA-04: el periodo que cubre el extracto, también dentro del lote

  saveMovementMappings();
  datosImportarSaveIgnored(ignored);
  saveIncomeActuals();
  saveExpenseActuals();

  const afterState = appStatePayload({ includeCanonical: false });
  const batch = window.FinanceCanonicalE5.createImportBatch(beforeState, afterState, {
    sourceLabel: `Importación guiada · ${session.fileMeta.sourceLabel}`,
    reason: motivo,
    recordCount: incoming.length,
    afterFingerprint: window.FinanceCanonicalSupabaseStore?.fingerprintPayload(afterState),
  });
  importBatches.push(batch);

  const duplicadosDescartados = rows.filter((row) => row.duplicateDecision === "duplicado").length;
  applyE11bReceipt(session.inboxItem, {
    batchId: batch.id,
    changed: { records: incoming.length, movements: incoming.length, actuals: appliedActuals, balances: balance ? 1 : 0 },
  });

  datosImportarRecordAppliedHash(session.fileMeta.hash, { fileName: session.fileMeta.fileName, batchId: batch.id });
  datosImportarClearDraft();
  saveLocalSnapshot();
  queueRemoteSave();
  refreshAllSectionsAfterDataChange();

  return { imported: incoming.length, duplicadosDescartados, capturasSustituidas, nuevasReglas, nuevosIgnorados, appliedActuals, batchId: batch.id, balance };
}

// ---------------------------------------------------------------------------------------------
// Interfaz de los cuatro pasos. `datosImportarSession` es la única fuente de verdad mientras el
// asistente está abierto; `datosImportarLastResult` sustituye a la sesión justo después de
// confirmar, para enseñar la banda de éxito sin que un repintado general la pise (ver
// `handleDatosImportarConfirmar`).
// ---------------------------------------------------------------------------------------------

let datosImportarSession = null;
let datosImportarLastResult = null;

// R-8: la pestaña «Importar extracto» de Registrar es este mismo asistente de cuatro pasos, no
// una copia. `datosImportarSession`/`datosImportarLastResult` siguen siendo la única fuente de
// verdad (regla transversal 01); lo único que cambia según la vista activa es dónde se pinta —
// por eso todas las funciones de esta sección leen sus ids de `datosImportarTarget()` en vez de
// tenerlos escritos a fuego, incluidos los botones que se inyectan dentro del panel (confirmar,
// cambiar de fichero...), para que nunca convivan dos elementos con el mismo id en el documento.
const DATOS_IMPORTAR_TARGETS = {
  data: {
    panelId: "datosImportarPanel",
    stepsId: "datosImportarSteps",
    nextId: "datosImportarNext",
    backId: "datosImportarBack",
    blockNoteId: "datosImportarBlockNote",
    fileInputId: "datosImportarFileInput",
    step1NoteId: "datosImportarStep1Note",
    replaceFileId: "datosImportarReplaceFile",
    confirmId: "datosImportarConfirm",
    importarOtroId: "datosImportarImportarOtro",
    accountSelectId: "datosImportarAccount",
  },
  registrar: {
    panelId: "registrarImportPanel",
    stepsId: "registrarImportSteps",
    nextId: "registrarImportNext",
    backId: "registrarImportBack",
    blockNoteId: "registrarImportBlockNote",
    fileInputId: "registrarImportFileInput",
    step1NoteId: "registrarImportStep1Note",
    replaceFileId: "registrarImportReplaceFile",
    confirmId: "registrarImportConfirm",
    importarOtroId: "registrarImportOtro",
    accountSelectId: "registrarImportAccount",
  },
};

// M-2/M-6 (auditoría del 15 de agosto, Prioridad 4): el criterio pide «concepto con cuenta» en la
// tabla de Movimientos y un campo «cuenta» en el panel de detalle. No existe ningún atributo de
// cuenta por movimiento en el modelo de datos, y no hay forma honesta de reconstruirlo para el
// extracto histórico ya cargado (regla transversal 04: dato ausente no es cero, tampoco se inventa).
// Se etiqueta solo hacia delante: al importar un extracto nuevo se pregunta de qué cuenta es, y esa
// cuenta se estampa en los movimientos de esa tanda — no reemplaza `session.fileMeta.sourceLabel`
// (que sigue siendo descriptivo del fichero, no de una cuenta bancaria real, ver la nota de
// `datosImportarFileSummary`), es una etiqueta nueva y opcional.
const DATOS_IMPORTAR_ACCOUNTS = ["CaixaBank", "Mediolanum", "Efectivo"];

function datosImportarPersistDraft() {
  if (!datosImportarSession) {
    datosImportarClearDraft();
    return;
  }
  datosImportarSaveDraft({
    step: datosImportarSession.step,
    fileMeta: datosImportarSession.fileMeta,
    inboxItemId: datosImportarSession.inboxItem?.id || null,
    rows: datosImportarSession.rows.map((row) => ({
      rowId: row.rowId,
      transaction: row.transaction,
      decision: row.decision,
      duplicateDecision: row.duplicateDecision,
    })),
  });
}

// Recompone la sesión desde el borrador guardado. Solo `decision`/`duplicateDecision` son datos
// del usuario que hay que conservar tal cual; `prior`/`suggestion`/`duplicates` se recalculan en
// el momento porque dependen de partidas y movimientos que pueden haber cambiado entretanto.
function datosImportarRestoreSession() {
  const draft = datosImportarLoadDraft();
  if (!draft || !Array.isArray(draft.rows) || !draft.rows.length) return null;
  const ignored = datosImportarLoadIgnored();
  const inboxItem = draft.inboxItemId ? dataInbox.find((item) => item.id === draft.inboxItemId) || null : null;
  return {
    step: Math.min(4, Math.max(1, Number(draft.step) || 1)),
    fileMeta: draft.fileMeta || { fileName: "", sourceLabel: "", hash: "" },
    inboxItem,
    rows: capturaDuplicadosAnotar(draft.rows.map((saved) => {
      const prior = datosImportarPriorClassification(saved.transaction, ignored);
      return {
        rowId: saved.rowId,
        transaction: saved.transaction,
        prior,
        suggestion: prior.status === "pendiente" ? datosImportarSuggestionFor(saved.transaction) : null,
        duplicates: datosImportarDuplicateCandidates(saved.transaction, baseData.transactions || [], duplicateWindowDays()),
        decision: saved.decision || null,
        duplicateDecision: saved.duplicateDecision || null,
      };
    }), globalThis.FinanceCanonicalCaptureDedupe),
  };
}

function datosImportarShowStep1Note(message, isWarning) {
  const note = qs(datosImportarTarget().step1NoteId);
  if (!note) return;
  note.textContent = message;
  note.classList.toggle("is-warn", Boolean(isWarning));
}

async function handleDatosImportarFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  globalThis.FinanceCobertura?.asegurar(); // XDA-04: el registro de periodos existe antes del lote, para que «Deshacer» lo devuelva
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  if (isExcel) extractoPerfilesOlvidar();
  let transactions = [];
  try {
    if (isExcel) {
      if (!(await window.xlsxReady())) {
        datosImportarShowStep1Note("No se pudo cargar la librería de Excel. Comprueba la conexión y vuelve a intentarlo (o importa un CSV).", true);
        return;
      }
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
      transactions = loadTransactionsFromWorkbook(workbook);
    } else {
      const lectura = extractoPerfilesLeer(file, new Uint8Array(await file.arrayBuffer()), globalThis.FinanceCanonicalStatementProfiles);
      transactions = movementsFromStatementRows(lectura.transactions);
      if (!transactions.length) { datosImportarSession = null; datosImportarClearDraft(); renderDatosImportar(); return; } // el panel de lectura explica por qué
    }
  } catch (error) {
    datosImportarShowStep1Note(`No se pudo leer el fichero: ${error.message}`, true);
    return;
  }
  if (!transactions.length) {
    datosImportarShowStep1Note("No se detectaron movimientos importables. Revisa que el fichero tenga Fecha, Movimiento, Importe y Saldo.", true);
    return;
  }

  // La huella se calcula sobre los movimientos ya interpretados, no sobre los bytes del fichero:
  // así el mismo extracto exportado dos veces con nombres distintos (o reabierto y regrabado por
  // el banco) se sigue reconociendo como «lo mismo», y un fichero distinto con el mismo nombre no.
  const hash = datosImportarContentHash(JSON.stringify(transactions));
  const repeated = datosImportarFindAppliedHash(hash);
  const rows = datosImportarBuildRows(transactions);
  // WP-51: corregir la lectura rehace la sesión desde el paso 1; la entrada anterior de la bandeja (misma lectura, peor) se descarta y la cuenta ya elegida se conserva.
  const previous = datosImportarSession;
  if (previous?.inboxItem) dataInbox = dataInbox.map((item) => item.id === previous.inboxItem.id && ["draft", "ready", "blocked"].includes(item.status) ? E11bInbox.transition(item, "discarded") : item);
  const inboxItem = addE11bInboxItem({
    source: isExcel ? "excel-workbook" : "csv",
    fileName: file.name,
    sourceLabel: file.name,
    bankStatement: true,
    rows: transactions,
    comparison: { valid: rows.length > 0 },
    legacyAdapter: "datosImportarApply",
  });

  datosImportarLastResult = null;
  datosImportarSession = {
    step: 1,
    fileMeta: {
      fileName: file.name,
      sourceLabel: file.name,
      hash,
      repeated: repeated ? { fileName: repeated.fileName, appliedAt: repeated.appliedAt } : null,
      ...(previous?.fileMeta?.fileName === file.name && previous.fileMeta.bankAccount ? { bankAccount: previous.fileMeta.bankAccount } : {}),
    },
    inboxItem,
    rows,
  };
  datosImportarPersistDraft();
  renderDatosImportar();
}

function datosImportarStep1Markup() {
  const session = datosImportarSession;
  const target = datosImportarTarget();
  if (!session) {
    return `<div class="e19-card datos-importar-upload">
      <label class="datos-importar-file-label" for="${target.fileInputId}">
        <strong>Cargar extracto</strong>
        <span>CSV o Excel con fecha, concepto, importe (o debe/haber) y, si lo hay, saldo. En CSV se deducen solos el separador, los decimales, las fechas y las columnas.</span>
      </label>
      <input type="file" id="${target.fileInputId}" accept=".csv,.txt,.xlsx,.xls" />
      <p class="e19-kpi-note" id="${target.step1NoteId}"></p>
    </div>
    <div id="extractoPerfilesPanel">${extractoPerfilesHtml()}</div>`;
  }
  const summary = datosImportarFileSummary(session.rows.map((row) => row.transaction), session.fileMeta.sourceLabel);
  const counters = datosImportarCounters(session.rows);
  const repeatedNote = session.fileMeta.repeated
    ? `<p class="e19-kpi-note is-warn">Ya se importó un fichero con el mismo contenido (${escapeHtml(session.fileMeta.repeated.fileName)}) el ${escapeHtml(formatIsoDate(session.fileMeta.repeated.appliedAt))}. Puedes continuar si es intencionado.</p>`
    : "";
  const closedNote = summary.closedMonths.length
    ? `<p class="e19-kpi-note is-warn">Solapa con ${summary.closedMonths.length} ${summary.closedMonths.length === 1 ? "mes ya cerrado" : "meses ya cerrados"}: ${summary.closedMonths.map((month) => escapeHtml(monthLabel(dateFromMonthKey(month)))).join(", ")}. Esos movimientos no recalcularán reales de un mes cerrado.</p>`
    : "";
  const accountOptions = ['<option value="">Sin especificar</option>']
    .concat(
      DATOS_IMPORTAR_ACCOUNTS.map(
        (account) =>
          `<option value="${escapeHtml(account)}"${session.fileMeta.bankAccount === account ? " selected" : ""}>${escapeHtml(account)}</option>`,
      ),
    )
    .join("");
  return `<div class="e19-card datos-importar-file-summary">
    <strong>${escapeHtml(session.fileMeta.fileName)}</strong>
    <p class="e19-kpi-note">Formato reconocido · ${session.rows.length} ${session.rows.length === 1 ? "movimiento" : "movimientos"} · del ${escapeHtml(formatIsoDate(summary.from))} al ${escapeHtml(formatIsoDate(summary.to))}.</p>
    ${repeatedNote}${closedNote}
    <label class="datos-importar-account-select">
      <span>¿De qué cuenta es este extracto?</span>
      <select id="${target.accountSelectId}">${accountOptions}</select>
    </label>
    <p class="e19-kpi-note">Se etiqueta cada movimiento de esta tanda con la cuenta elegida. Sin elegir ninguna, entran sin cuenta asignada — no se inventa una.</p>
    <div class="datos-importar-counters">
      <div><strong>${counters.conReglaPrevia}</strong><span>con regla previa</span></div>
      <div><strong>${counters.pidenDecision}</strong><span>piden decisión</span></div>
      <div><strong>${counters.posiblesDuplicados}</strong><span>posibles duplicados</span></div>
    </div>
    <button type="button" class="e19-btn e19-btn-secondary" id="${target.replaceFileId}">Cambiar de fichero</button>
  </div>
  <div id="extractoPerfilesPanel">${extractoPerfilesHtml()}</div>`;
}

function handleDatosImportarAccountChange() {
  const select = qs(datosImportarTarget().accountSelectId);
  if (!select || !datosImportarSession) return;
  datosImportarSession.fileMeta.bankAccount = select.value || "";
  datosImportarPersistDraft();
}

function datosImportarWireStep1() {
  const target = datosImportarTarget();
  qs(target.fileInputId)?.addEventListener("change", handleDatosImportarFile);
  qs(target.replaceFileId)?.addEventListener("click", () => {
    extractoPerfilesOlvidar();
    datosImportarSession = null;
    datosImportarClearDraft();
    renderDatosImportar();
  });
  qs(target.accountSelectId)?.addEventListener("change", handleDatosImportarAccountChange);
}

function datosImportarClassifyRowMarkup(row) {
  const kind = movementKindFromAmount(row.transaction.amount);
  const decided = row.decision;
  return `<tr class="${decided ? "is-decided" : ""}">
    <td>${escapeHtml(formatIsoDate(row.transaction.date))}</td>
    <td>${escapeHtml(movementDisplayName(row.transaction))}</td>
    <td>${money(row.transaction.amount, true)}</td>
    <td>${row.suggestion ? escapeHtml(displayLabelForRow(row.suggestion)) : "Sin sugerencia"}</td>
    <td class="datos-importar-row-actions">
      ${row.suggestion ? `<button type="button" class="e19-btn e19-btn-secondary${decided?.tipo === "aceptar-sugerencia" ? " is-active" : ""}" data-datos-importar-classify="aceptar-sugerencia" data-datos-importar-row-id="${escapeHtml(row.rowId)}">Aceptar sugerencia</button>` : ""}
      <select data-datos-importar-otra-select data-datos-importar-row-id="${escapeHtml(row.rowId)}">${movementMappingOptions(kind, decided?.tipo === "otra-partida" ? decided.rowKey : "")}</select>
      <button type="button" class="e19-btn e19-btn-secondary${decided?.tipo === "ignorar" ? " is-active" : ""}" data-datos-importar-classify="ignorar" data-datos-importar-row-id="${escapeHtml(row.rowId)}">Ignorar</button>
    </td>
  </tr>`;
}

function handleDatosImportarClasificar(tipo, rowId, rowKey) {
  const row = datosImportarSession?.rows.find((item) => item.rowId === rowId);
  if (!row) return;
  row.decision = tipo === "otra-partida" ? (rowKey ? { tipo, rowKey } : null) : { tipo };
  datosImportarPersistDraft();
  renderDatosImportarStep2();
}

function renderDatosImportarStep2() {
  const panel = qs(datosImportarTarget().panelId);
  const session = datosImportarSession;
  if (!panel || !session) return;
  const pending = datosImportarRowsPendingClassification(session.rows);
  panel.innerHTML = pending.length
    ? `<div class="table-wrap"><table class="datos-importar-table">
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Sugerencia</th><th>Decisión</th></tr></thead>
        <tbody>${pending.map((row) => datosImportarClassifyRowMarkup(row)).join("")}</tbody>
      </table></div>`
    : `<p class="e19-kpi-note">No queda ningún movimiento sin regla previa: los ${session.rows.length} ${session.rows.length === 1 ? "movimiento ya tiene" : "movimientos ya tienen"} partida o quedaron marcados como ignorados en una importación anterior.</p>`;
  panel.querySelectorAll("[data-datos-importar-classify]").forEach((button) => {
    button.addEventListener("click", () =>
      handleDatosImportarClasificar(button.dataset.datosImportarClassify, button.dataset.datosImportarRowId, ""),
    );
  });
  panel.querySelectorAll("[data-datos-importar-otra-select]").forEach((select) => {
    select.addEventListener("change", () => {
      if (select.value) handleDatosImportarClasificar("otra-partida", select.dataset.datosImportarRowId, select.value);
    });
  });
  datosImportarUpdateBar();
}

function datosImportarDuplicateRowMarkup(row) {
  if (row.capturePair) return capturaDuplicadosRowMarkup(row); // WP-53: el candidato es algo anotado a mano
  const decided = row.duplicateDecision;
  const existing = row.duplicates[0];
  return `<tr class="${decided ? "is-decided" : ""}">
    <td>${escapeHtml(formatIsoDate(row.transaction.date))} · ${escapeHtml(movementDisplayName(row.transaction))} · ${money(row.transaction.amount, true)}</td>
    <td>${existing ? `${escapeHtml(formatIsoDate(existing.date))} · ${escapeHtml(movementDisplayName(existing))} · ${money(existing.amount, true)}` : "—"}${row.duplicates.length > 1 ? `<small> y ${row.duplicates.length - 1} ${(row.duplicates.length - 1) === 1 ? "candidato" : "candidatos"} más</small>` : ""}</td>
    <td class="datos-importar-row-actions">
      <button type="button" class="e19-btn e19-btn-secondary${decided === "duplicado" ? " is-active" : ""}" data-datos-importar-duplicate="duplicado" data-datos-importar-row-id="${escapeHtml(row.rowId)}">Es duplicado</button>
      <button type="button" class="e19-btn e19-btn-secondary${decided === "distinto" ? " is-active" : ""}" data-datos-importar-duplicate="distinto" data-datos-importar-row-id="${escapeHtml(row.rowId)}">Son distintos</button>
    </td>
  </tr>`;
}

function handleDatosImportarDuplicado(rowId, decision) {
  const row = datosImportarSession?.rows.find((item) => item.rowId === rowId);
  if (!row) return;
  row.duplicateDecision = decision;
  datosImportarPersistDraft();
  renderDatosImportarStep3();
}

function renderDatosImportarStep3() {
  const panel = qs(datosImportarTarget().panelId);
  const session = datosImportarSession;
  if (!panel || !session) return;
  const pending = datosImportarRowsPendingDuplicate(session.rows);
  panel.innerHTML = pending.length
    ? `<div class="table-wrap"><table class="datos-importar-table${pending.some((row) => row.capturePair) ? " cdup-tabla" : ""}">
        <thead><tr><th>Candidato del fichero</th><th>Ya registrado</th><th>Decisión</th></tr></thead>
        <tbody>${pending.map((row) => datosImportarDuplicateRowMarkup(row)).join("")}</tbody>
      </table></div>`
    : `<p class="e19-kpi-note">No hay candidatos a duplicado sin resolver. La ventana de comparación es de ${duplicateWindowDays()} días por el mismo importe.</p>`;
  panel.querySelectorAll("[data-datos-importar-duplicate]").forEach((button) => {
    button.addEventListener("click", () => handleDatosImportarDuplicado(button.dataset.datosImportarRowId, button.dataset.datosImportarDuplicate));
  });
  datosImportarUpdateBar();
}

function datosImportarSuccessMarkup(result) {
  return `<div class="e19-insight">
      <strong>Importación confirmada</strong>
      <p>${result.imported} ${result.imported === 1 ? "movimiento incorporado" : "movimientos incorporados"} de «${escapeHtml(result.fileName)}». ${result.nuevasReglas} ${result.nuevasReglas === 1 ? "regla nueva aprendida" : "reglas nuevas aprendidas"}${result.nuevosIgnorados ? `, ${result.nuevosIgnorados} ${result.nuevosIgnorados === 1 ? "movimiento marcado" : "movimientos marcados"} para ignorar en el futuro` : ""}${result.duplicadosDescartados ? `, ${result.duplicadosDescartados} ${result.duplicadosDescartados === 1 ? "duplicado descartado" : "duplicados descartados"}` : ""}${result.capturasSustituidas ? `, ${result.capturasSustituidas} ${result.capturasSustituidas === 1 ? "captura a mano sustituida" : "capturas a mano sustituidas"} por su fila del banco` : ""}.${result.balance ? ` Saldo de ${escapeHtml(result.balance.account)}: ${money(result.balance.value, true)} a ${formatIsoDate(result.balance.date)}.` : ""} Puedes deshacer este lote con «Deshacer último lote», en Registrar › Importar extracto.</p>
    </div>
    <button type="button" class="e19-btn e19-btn-secondary" id="${datosImportarTarget().importarOtroId}">Importar otro fichero</button>`;
}

async function handleDatosImportarConfirmar() {
  const session = datosImportarSession;
  if (!session) return;
  const { reason: motivo } = await requestOperationConfirmation({
    title: "Incorporar la importación al plan",
    message: "Se añadirán los movimientos decididos, se guardarán las reglas nuevas y se creará un lote que se puede deshacer después.",
    defaultReason: `Importación de ${session.fileMeta.fileName}`,
    confirmLabel: "Incorporar",
  });
  if (!motivo) return;
  const result = datosImportarApply(session, { motivo });
  datosImportarSession = null;
  datosImportarLastResult = { ...result, fileName: session.fileMeta.fileName };
  renderDatosImportar();
  announceStatus(`Importación confirmada: ${result.imported} ${result.imported === 1 ? "movimiento incorporado" : "movimientos incorporados"}.`);
}

function renderDatosImportarStep4() {
  const target = datosImportarTarget();
  const panel = qs(target.panelId);
  const session = datosImportarSession;
  if (!panel || !session) return;
  const impact = datosImportarImpactRows(session.rows);
  const included = datosImportarIncludedTransactions(session.rows).length;
  const duplicados = session.rows.filter((row) => row.duplicateDecision === "duplicado").length;
  panel.innerHTML = `<p class="e19-kpi-note">${included} ${included === 1 ? "movimiento entraría" : "movimientos entrarían"} en el plan; ${duplicados} queda(n) fuera por marcarse como duplicado.${capturaDuplicadosResumen(session.rows)}</p>
    ${impact.length
      ? `<div class="table-wrap"><table class="datos-importar-table">
          <thead><tr><th>Partida</th><th>Mes</th><th>Actual</th><th>Tras importar</th><th>Desviación</th></tr></thead>
          <tbody>${impact
            .map(
              (item) => `<tr>
            <td>${escapeHtml(displayLabelForRow(item.row))}</td>
            <td>${escapeHtml(item.month.label)}</td>
            <td>${money(item.before, true)}</td>
            <td>${money(item.after, true)}</td>
            <td class="${item.desviacion >= 0 ? "" : "is-negative"}">${item.desviacion >= 0 ? "+" : ""}${money(item.desviacion, true)}</td>
          </tr>`,
            )
            .join("")}</tbody>
        </table></div>`
      : `<p class="e19-kpi-note">Ningún real cambiaría con las decisiones actuales.</p>`}
    ${datosImportarBalanceOfferHtml(session)}
    <button type="button" class="e19-btn e19-btn-primary" id="${target.confirmId}">Incorporar al plan</button>`;
  wireDatosImportarBalanceOffer(session); // WP-26 · ND-02 (registrar-ui.js)
  qs(target.confirmId)?.addEventListener("click", handleDatosImportarConfirmar);
  datosImportarUpdateBar();
}

function datosImportarUpdateSteps(activeStep) {
  const steps = qs(datosImportarTarget().stepsId);
  if (!steps) return;
  [...steps.children].forEach((item, index) => {
    const stepNumber = index + 1;
    item.classList.toggle("is-active", stepNumber === activeStep);
    item.classList.toggle("is-done", stepNumber < activeStep);
  });
}

// El estado de la barra inferior fija: qué puede hacerse desde cada paso y por qué «Continuar»
// está deshabilitado si lo está. Es el único sitio que decide el bloqueo, para que los pasos 2 y 3
// no puedan tener cada uno su propia idea de cuándo se puede avanzar.
function datosImportarUpdateBar() {
  const target = datosImportarTarget();
  const nextButton = qs(target.nextId);
  const backButton = qs(target.backId);
  const blockNote = qs(target.blockNoteId);
  const session = datosImportarSession;
  if (!nextButton || !backButton || !blockNote || !session) return;
  backButton.hidden = session.step === 1;
  nextButton.hidden = session.step === 4;
  if (session.step === 1) {
    blockNote.textContent = "";
  } else if (session.step === 2) {
    const pending = datosImportarRowsPendingClassification(session.rows).length;
    nextButton.disabled = pending > 0;
    blockNote.textContent = pending > 0 ? `${pending} ${pending === 1 ? "movimiento" : "movimientos"} sin decidir.` : "";
  } else if (session.step === 3) {
    const pending = datosImportarRowsPendingDuplicate(session.rows).length;
    nextButton.disabled = pending > 0;
    blockNote.textContent = pending > 0 ? `${pending} ${pending === 1 ? "posible duplicado" : "posibles duplicados"} sin decidir.` : "";
  }
}

function handleDatosImportarNextClick() {
  if (!datosImportarSession) return;
  datosImportarSession.step = Math.min(4, datosImportarSession.step + 1);
  datosImportarPersistDraft();
  renderDatosImportar();
}

function handleDatosImportarBackClick() {
  if (!datosImportarSession) return;
  datosImportarSession.step = Math.max(1, datosImportarSession.step - 1);
  datosImportarPersistDraft();
  renderDatosImportar();
}

function renderDatosImportar() {
  queueMicrotask(() => globalThis.importarV2Render?.()); // rediseño A4 (views/importar-v2.js), con lo que se pinte aquí
  if (!datosImportarSession && !datosImportarLastResult) datosImportarSession = datosImportarRestoreSession();
  const target = datosImportarTarget();
  const panel = qs(target.panelId);
  const backButton = qs(target.backId);
  const nextButton = qs(target.nextId);
  const blockNote = qs(target.blockNoteId);
  if (!panel) return;

  if (datosImportarLastResult) {
    panel.innerHTML = datosImportarSuccessMarkup(datosImportarLastResult);
    qs(target.importarOtroId)?.addEventListener("click", () => {
      datosImportarLastResult = null;
      renderDatosImportar();
    });
    if (backButton) backButton.hidden = true;
    if (nextButton) nextButton.hidden = true;
    if (blockNote) blockNote.textContent = "";
    datosImportarUpdateSteps(4);
    return;
  }

  if (!datosImportarSession) {
    panel.innerHTML = datosImportarStep1Markup();
    datosImportarWireStep1();
    if (backButton) backButton.hidden = true;
    if (nextButton) nextButton.hidden = true;
    if (blockNote) blockNote.textContent = "";
    datosImportarUpdateSteps(1);
    return;
  }

  datosImportarUpdateSteps(datosImportarSession.step);
  if (datosImportarSession.step === 1) {
    panel.innerHTML = datosImportarStep1Markup();
    datosImportarWireStep1();
    datosImportarUpdateBar();
  } else if (datosImportarSession.step === 2) {
    renderDatosImportarStep2();
  } else if (datosImportarSession.step === 3) {
    renderDatosImportarStep3();
  } else {
    renderDatosImportarStep4();
  }
}
