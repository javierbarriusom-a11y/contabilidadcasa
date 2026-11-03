// Ficha de un movimiento (M-6, M-7, P-1, T11): el panel que abre tocar un movimiento en Movimientos, en los dos temas.
// Sale de app.js el 3/11/2026 (techo ARQ-4); se carga con `defer` antes de app.js y comparte su ámbito, como datos-ui.js.
//
// Rehecha el 3/11/2026 a petición del hogar, con el primer cierre a medias: las casillas «Recordar para los que empiecen
// igual» salían enormes y encima de su texto (styles.css da a todo `input` 100 % de ancho y 40 px de alto), y no quedaba
// claro qué guardaba cada botón, si la partida y el tipo de acción dependían uno del otro ni qué había pasado al pulsar.
// - Dos bloques separados, cada uno con su botón: «Partida» y «Tipo de acción», este marcado como opcional y aparte.
// - Cada bloque dice cómo está ahora: sin partida, solo este movimiento, por la regla del concepto o propuesto.
// - «¿A cuáles?» son dos opciones (solo este / todos los del concepto, con cuántos son), no una casilla.
// - El botón dice a cuántos movimientos afecta y está apagado mientras no cambie nada.
// - El error sale junto al campo; lo guardado se confirma en el propio bloque, con «Deshacer».
// Si el movimiento ya va por la regla de su concepto, «todos» viene marcado: cambiar la partida aquí cambia la regla. Antes la
// casilla venía desmarcada y guardar creaba, sin decirlo, una excepción para este movimiento con la regla intacta: el hogar
// veía que «no se guardaba» en los demás. «Todos» escribe además las reglas del mismo concepto de otros meses
// (FINANCIE-SEPTIEMB…), que si no seguirían mandando en su mes, y quita la excepción de este movimiento si la tenía.

const FICHA_MOV_BLOQUES = {
  partida: {
    boton: "movementDetailSave", campos: ["movementDetailPartida"], todos: "movementDetailRemember",
    texto: "Guardar partida", pista: "movementDetailPista", error: "movementDetailError",
  },
  tipo: {
    boton: "movementDetailActionTypeSave", campos: ["movementDetailActionType", "movementDetailRecurring"], todos: "movementDetailActionTypeRemember",
    texto: "Guardar tipo de acción", pista: "movementDetailActionTypePista", error: "movementDetailActionTypeError",
  },
};

let fichaMovAviso = null; // { id, bloque, texto, deshacer }: lo último guardado en la ficha abierta, con su «Deshacer»

function fichaMovSinMes(key) {
  return typeof movementMappingMonthlessKey === "function" ? movementMappingMonthlessKey(key) : key;
}

// Las claves de regla de un diccionario (partidas o tipos de acción) que son el mismo concepto que `row`, de cualquier mes,
// más la de su propio mes aunque aún no exista.
function fichaMovClavesDelConcepto(dict, row, kind) {
  const exacta = movementMappingKey(row);
  const suelta = fichaMovSinMes(exacta);
  const claves = Object.keys(dict || {}).filter((key) => key !== exacta && key.startsWith(`${kind}|`) && fichaMovSinMes(key) === suelta);
  return [exacta, ...claves];
}

// La regla de tipo de acción del mismo concepto en otro mes (la más reciente), como `movementMappingForAnyMonth` hace con
// las partidas. La usa `actionTypeEntryForMovement` (app.js) tras la regla exacta.
function fichaMovTipoDeOtroMes(transaction) {
  const exacta = movementMappingKey(transaction);
  const suelta = fichaMovSinMes(exacta);
  if (suelta === exacta) return null;
  let mejor = null;
  Object.entries(movementActionTypes || {}).forEach(([key, entry]) => {
    if (key === exacta || !entry?.actionType || fichaMovSinMes(key) !== suelta) return;
    if (!mejor || String(entry.updatedAt || "") > String(mejor.updatedAt || "")) mejor = entry;
  });
  return mejor;
}

// Cuántos movimientos tiene el concepto (de cualquier mes), cuántos llevan una excepción propia en `dict` y en cuántos meses
// firmados caen: lo que «todos» va a tocar, dicho antes de pulsar.
function fichaMovGrupo(row, kind, dict) {
  const suelta = fichaMovSinMes(movementMappingKey(row));
  const grupoDe = (tx) => (typeof movementMappingGroupKey === "function" ? movementMappingGroupKey(tx) : movementMappingKey(tx));
  const id = transactionIdentity(row);
  const filas = (baseData?.transactions || []).filter((tx) => tx && Number(tx.amount) && movementKindFromAmount(tx.amount) === kind && grupoDe(tx) === suelta);
  if (!filas.some((tx) => transactionIdentity(tx) === id)) filas.push(row);
  const propias = filas.filter((tx) => {
    const entry = (dict || {})[transactionIdentity(tx)];
    return transactionIdentity(tx) !== id && entry && (entry.kind === undefined || entry.kind === kind);
  }).length;
  const meses = [...new Set(filas.map((tx) => String(tx.month || tx.date || "").slice(0, 7)).filter(Boolean))];
  const firmados = typeof isSignedClosedMonthKey === "function" ? meses.filter((mes) => isSignedClosedMonthKey(mes)).length : 0;
  return { total: filas.length, propias, meses: meses.length, firmados, cualquierMes: suelta !== movementMappingKey(row) };
}

function fichaMovCuantos(n) {
  return n === 1 ? "1 movimiento" : `${n} movimientos`;
}

function fichaMovAlcanceHtml({ prefijo, idTodos, todos, grupo, nombre, conFirmados }) {
  const cuantos = grupo.total === 1 ? "por ahora solo está este" : `${fichaMovCuantos(grupo.total)}${grupo.meses > 1 ? ` de ${grupo.meses} meses` : ""}`;
  const notas = [];
  if (grupo.propias) notas.push(`${grupo.propias === 1 ? "1 tiene la suya propia y no cambia" : `${grupo.propias} tienen la suya propia y no cambian`}`);
  if (conFirmados && grupo.firmados) notas.push("en los meses ya firmados no cambian los reales");
  return `<fieldset class="ficha-mov-alcance">
      <legend>¿A cuáles?</legend>
      <label><input type="radio" name="${prefijo}Alcance" value="uno" id="${prefijo}Solo"${todos ? "" : " checked"} /><span>Solo a este movimiento</span></label>
      <label><input type="radio" name="${prefijo}Alcance" value="todos" id="${idTodos}"${todos ? " checked" : ""} /><span>A todos los «${escapeHtml(nombre)}»${grupo.cualquierMes ? " de cualquier mes" : ""} (${cuantos}) y a los que vengan${notas.length ? `<small>${notas.join(" · ")}.</small>` : ""}</span></label>
    </fieldset>`;
}

function fichaMovNombrePartida(row) {
  return `${row.sectionName} · ${typeof displayLabelForRow === "function" ? displayLabelForRow(row) : row.label}`;
}

function fichaMovAhoraPartida(mapping) {
  if (!mapping) return "Ahora: <strong>sin partida</strong>. No cuenta en los reales de ninguna.";
  const por = mapping.source === "single" ? "solo este movimiento" : mapping.source === "dictionary" ? "por la regla de este concepto" : "por coincidir con el nombre de la partida";
  return `Ahora: <strong>${escapeHtml(fichaMovNombrePartida(mapping.row))}</strong> · ${por}.`;
}

function fichaMovAhoraTipo(action) {
  if (!action) return "Ahora: <strong>sin tipo</strong>.";
  const nombre = (typeof ACTION_TYPE_LABELS !== "undefined" && ACTION_TYPE_LABELS[action.actionType]) || action.actionType;
  const repite = action.recurring === true ? ", se repite cada mes" : action.recurring === false ? ", puntual" : "";
  const por = action.source === "single" ? "solo este movimiento" : action.source === "dictionary" ? "por la regla de este concepto" : "propuesto por la partida, sin confirmar";
  return `Ahora: <strong>${escapeHtml(nombre)}${repite}</strong> · ${por}.`;
}

function fichaMovAvisoHtml(row, bloque) {
  if (!fichaMovAviso || fichaMovAviso.bloque !== bloque || fichaMovAviso.id !== transactionIdentity(row)) return "";
  return `<p class="ficha-mov-aviso" role="status"><span>✓ ${escapeHtml(fichaMovAviso.texto)}</span><button type="button" class="link-button" id="fichaMovDeshacer">Deshacer</button></p>`;
}

function fichaMovRecurrenteValor(recurring) {
  return recurring === true ? "true" : recurring === false ? "false" : "";
}

function renderMovementDetailDialog() {
  const content = qs("movementDetailContent");
  const row = movementDetailTransaction;
  if (!content || !row) return;
  const mapping = mappingForMovement(row);
  const kind = movementKindFromAmount(row.amount);
  const action = actionTypeForMovement(row);
  const nombre = movementDisplayName(row);
  const grupoPartida = fichaMovGrupo(row, kind, movementMappings);
  const grupoTipo = fichaMovGrupo(row, kind, movementActionTypes);
  const partidaInicial = mapping?.row ? seriesKeyForRow(mapping.row) : "";
  const reglaPartida = mapping?.source === "dictionary";
  const reglaTipo = action?.source === "dictionary";
  // Los dos campos del bloque, juntos como los lee fichaMovSincroniza. Una propuesta sin confirmar no es un valor guardado: el
  // botón queda encendido para confirmarla. Sin tipo ni propuesta, nada que guardar hasta que se elija uno.
  const tipoInicial = action?.confirmed ? `${action.actionType}|${fichaMovRecurrenteValor(action.recurring)}` : action ? "" : "|";
  content.innerHTML = `
    <h3 id="movementDetailTitle">${escapeHtml(nombre)}</h3>
    <dl class="movement-detail-fields">
      <div><dt>Fecha</dt><dd>${escapeHtml(formatIsoDate(row.date))}</dd></div>
      <div><dt>Fecha valor</dt><dd>${escapeHtml(formatIsoDate(row.valueDate))}</dd></div>
      <div><dt>Movimiento</dt><dd>${escapeHtml(row.movement)}</dd></div>
      <div><dt>Más datos</dt><dd>${escapeHtml(row.details || "—")}</dd></div>
      <div><dt>Categoría del banco</dt><dd>${escapeHtml(row.category || "—")}</dd></div>
      <div><dt>Importe</dt><dd class="${row.amount < 0 ? "negative" : "positive"}">${money(row.amount, true)}</dd></div>
      <div><dt>Saldo</dt><dd>${row.balance === null || row.balance === undefined ? "—" : money(row.balance, true)}</dd></div>
      <div><dt>Origen</dt><dd>${escapeHtml(row.source || "—")}</dd></div>
      <div><dt>Cuenta</dt><dd>${escapeHtml(row.account || "—")}</dd></div>
    </dl>
    ${movementDetailAttachmentHtml(row)}
    <section class="ficha-mov-bloque" data-ficha-bloque="partida" aria-labelledby="fichaMovPartidaTitulo">
      <h4 id="fichaMovPartidaTitulo">Partida</h4>
      <p class="ficha-mov-ahora">${fichaMovAhoraPartida(mapping)}</p>
      <label class="ficha-mov-campo">
        <span>Partida</span>
        <select id="movementDetailPartida">${movementMappingOptions(kind, mapping?.row ? seriesKeyForRow(mapping.row) : "")}</select>
      </label>
      ${fichaMovAlcanceHtml({ prefijo: "movementDetail", idTodos: "movementDetailRemember", todos: reglaPartida, grupo: grupoPartida, nombre, conFirmados: true })}
      <p class="ficha-mov-error" id="movementDetailError" role="alert" hidden></p>
      ${fichaMovAvisoHtml(row, "partida")}
      <button type="button" class="e19-btn e19-btn-primary" id="movementDetailSave" data-inicial="${escapeHtml(partidaInicial)}" data-inicial-todos="${reglaPartida}" data-total-todos="${grupoPartida.total - grupoPartida.propias}">Guardar partida</button>
      <p class="e19-kpi-note" id="movementDetailPista">Nada que guardar todavía: cambia la partida o «¿A cuáles?».</p>
    </section>
    <section class="ficha-mov-bloque" data-ficha-bloque="tipo" aria-labelledby="fichaMovTipoTitulo">
      <h4 id="fichaMovTipoTitulo">Tipo de acción <span class="ficha-mov-opcional">opcional</span></h4>
      <p class="e19-kpi-note">Va aparte de la partida y no cambia ningún importe: sirve para ver cuánto del gasto es deuda, fijo o variable.</p>
      <p class="ficha-mov-ahora">${fichaMovAhoraTipo(action)}</p>
      <div class="ficha-mov-pareja">
        <label class="ficha-mov-campo">
          <span>Tipo de acción</span>
          <select id="movementDetailActionType">${movementActionTypeOptions(action?.actionType || "")}</select>
        </label>
        <label class="ficha-mov-campo">
          <span>¿Es recurrente?</span>
          <select id="movementDetailRecurring">
            <option value="">Sin marcar</option>
            <option value="true" ${action?.recurring === true ? "selected" : ""}>Sí, se repite cada mes</option>
            <option value="false" ${action?.recurring === false ? "selected" : ""}>No, es puntual</option>
          </select>
        </label>
      </div>
      ${fichaMovAlcanceHtml({ prefijo: "movementDetailActionType", idTodos: "movementDetailActionTypeRemember", todos: reglaTipo, grupo: grupoTipo, nombre, conFirmados: false })}
      <p class="ficha-mov-error" id="movementDetailActionTypeError" role="alert" hidden></p>
      ${fichaMovAvisoHtml(row, "tipo")}
      <button type="button" class="e19-btn e19-btn-primary" id="movementDetailActionTypeSave" data-inicial="${escapeHtml(tipoInicial)}" data-inicial-todos="${reglaTipo}" data-total-todos="${grupoTipo.total - grupoTipo.propias}">Guardar tipo de acción</button>
      <p class="e19-kpi-note" id="movementDetailActionTypePista">Nada que guardar todavía: cambia el tipo, si se repite o «¿A cuáles?».</p>
    </section>`;
  fichaMovSincroniza("partida");
  fichaMovSincroniza("tipo");
  content.onchange = (event) => {
    const bloque = event.target.closest?.("[data-ficha-bloque]")?.dataset.fichaBloque;
    if (!bloque) return;
    fichaMovError(bloque, "");
    fichaMovSincroniza(bloque);
  };
  qs("fichaMovDeshacer")?.addEventListener("click", fichaMovDeshacer);
  qs("movementDetailViewReceipt")?.addEventListener("click", () => viewReceiptAttachment(row));
  qs("movementDetailAttachPhoto")?.addEventListener("change", (event) => handleMovementDetailAttachPhoto(event, row));
  qs("movementDetailSaveGeo")?.addEventListener("click", () => handleMovementDetailSaveGeo(row));
}

// El botón se enciende solo si algo cambió (o si hay una propuesta sin confirmar) y dice a cuántos movimientos afecta.
function fichaMovSincroniza(bloque) {
  const def = FICHA_MOV_BLOQUES[bloque];
  const boton = qs(def.boton);
  if (!boton) return;
  const valor = def.campos.map((id) => qs(id)?.value ?? "").join("|");
  const todos = Boolean(qs(def.todos)?.checked);
  const inicial = boton.dataset.inicial || "";
  const cambiado = valor !== inicial || String(todos) !== boton.dataset.inicialTodos;
  const n = todos ? Math.max(1, Number(boton.dataset.totalTodos) || 1) : 1;
  boton.disabled = !cambiado;
  boton.textContent = cambiado ? `${def.texto} · ${fichaMovCuantos(n)}` : def.texto;
  const pista = qs(def.pista);
  if (pista) pista.hidden = cambiado;
}

function fichaMovError(bloque, texto) {
  const def = FICHA_MOV_BLOQUES[bloque];
  const el = qs(def.error);
  if (el) {
    el.textContent = texto;
    el.hidden = !texto;
  }
  if (!texto) return;
  announceStatus(texto);
  qs(def.campos[0])?.focus?.();
}

function fichaMovFoto(dict, keys) {
  return Object.fromEntries([...new Set(keys)].map((key) => [key, dict[key] ? { ...dict[key] } : null]));
}

function fichaMovRestaura(dict, foto) {
  Object.entries(foto).forEach(([key, value]) => {
    if (value) dict[key] = value;
    else delete dict[key];
  });
}

// La misma secuencia de refresco de siempre tras cambiar una regla de partida (M-7 y el lote de Movimientos).
function fichaMovRefrescaPartidas(clavesRegla) {
  saveMovementMappings();
  const applied = applyMovementMappingsToActuals();
  pendingMovementMappings = buildPendingMovementMappings(baseData.transactions || []);
  if (clavesRegla) datosImportarRefreshRowsForMappings(new Set(clavesRegla)); // M-8b: una importación a medias ve la regla nueva
  saveIncomeActuals();
  saveExpenseActuals();
  refreshAllSectionsAfterDataChange();
  return applied;
}

function fichaMovDeshacer() {
  const aviso = fichaMovAviso;
  if (!aviso) return;
  fichaMovAviso = null;
  aviso.deshacer();
  announceStatus("Deshecho: todo vuelve a como estaba antes de guardar.");
  renderMovementDetailDialog();
  renderDetailedMovements();
  qs(FICHA_MOV_BLOQUES[aviso.bloque].campos[0])?.focus?.();
}

// M-7: cambio de partida. Mismo diccionario y mismo camino de escritura que `applyPendingMovementMappings` (regla
// transversal 01). «Solo a este movimiento» guarda por su identidad; «todos», como regla del concepto.
function handleMovementReclassify() {
  const row = movementDetailTransaction;
  const select = qs("movementDetailPartida");
  if (!row || !select) return;
  const rowKeyValue = select.value;
  if (!rowKeyValue) {
    fichaMovError("partida", "Elige una partida antes de guardar.");
    return;
  }
  const remember = Boolean(qs("movementDetailRemember")?.checked);
  const kind = movementKindFromAmount(row.amount);
  const nombre = movementDisplayName(row);
  const antes = mappingForMovement(row);
  const single = transactionIdentity(row);
  const keys = remember ? fichaMovClavesDelConcepto(movementMappings, row, kind) : [single];
  const foto = fichaMovFoto(movementMappings, [...keys, single]);
  const label = select.options[select.selectedIndex]?.textContent || "";
  const updatedAt = new Date().toISOString();
  keys.forEach((key) => {
    movementMappings[key] = { kind, rowKey: rowKeyValue, label, updatedAt };
  });
  if (remember) delete movementMappings[single];
  fichaMovRefrescaPartidas(remember ? keys : null);
  const grupo = fichaMovGrupo(row, kind, movementMappings);
  const partes = [];
  if (remember) {
    partes.push(`${fichaMovCuantos(Math.max(1, grupo.total - grupo.propias))} de «${nombre}» van ahora a «${label}», también los que vengan.`);
    if (grupo.firmados) partes.push("En los meses firmados no cambian los reales.");
  } else {
    partes.push(`Este movimiento va ahora a «${label}».`);
    if (antes?.source === "dictionary" && seriesKeyForRow(antes.row) !== rowKeyValue) partes.push(`Los demás «${nombre}» siguen en «${fichaMovNombrePartida(antes.row)}».`);
  }
  const texto = partes.join(" ");
  fichaMovAviso = {
    id: single,
    bloque: "partida",
    texto,
    deshacer: () => {
      fichaMovRestaura(movementMappings, foto);
      fichaMovRefrescaPartidas(remember ? keys : null);
    },
  };
  announceStatus(texto);
  renderMovementDetailDialog();
  renderDetailedMovements();
}

// P-1: tipo de acción y «¿es recurrente?», en su propio diccionario (`movementActionTypes`) y con su propio botón: no toca
// la partida ni los reales.
function handleMovementActionTypeSave() {
  const row = movementDetailTransaction;
  const select = qs("movementDetailActionType");
  if (!row || !select) return;
  const actionType = select.value;
  if (!actionType) {
    fichaMovError("tipo", "Elige un tipo de acción antes de guardar.");
    return;
  }
  const recurringRaw = qs("movementDetailRecurring")?.value ?? "";
  const recurring = recurringRaw === "true" ? true : recurringRaw === "false" ? false : null;
  const remember = Boolean(qs("movementDetailActionTypeRemember")?.checked);
  const kind = movementKindFromAmount(row.amount);
  const nombre = movementDisplayName(row);
  const single = transactionIdentity(row);
  const keys = remember ? fichaMovClavesDelConcepto(movementActionTypes, row, kind) : [single];
  const foto = fichaMovFoto(movementActionTypes, [...keys, single]);
  const updatedAt = new Date().toISOString();
  keys.forEach((key) => {
    movementActionTypes[key] = { actionType, recurring, updatedAt };
  });
  if (remember) delete movementActionTypes[single];
  saveMovementActionTypes();
  const etiqueta = (typeof ACTION_TYPE_LABELS !== "undefined" && ACTION_TYPE_LABELS[actionType]) || actionType;
  const grupo = fichaMovGrupo(row, kind, movementActionTypes);
  const texto = remember
    ? `${fichaMovCuantos(Math.max(1, grupo.total - grupo.propias))} de «${nombre}» son ahora «${etiqueta}», también los que vengan.`
    : `Este movimiento es ahora «${etiqueta}».`;
  fichaMovAviso = {
    id: single,
    bloque: "tipo",
    texto,
    deshacer: () => {
      fichaMovRestaura(movementActionTypes, foto);
      saveMovementActionTypes();
    },
  };
  announceStatus(texto);
  renderMovementDetailDialog();
  renderDetailedMovements();
}
