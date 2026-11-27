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
let fichaMovDivision = null; // DAT-07: { id, abierta, parts: [{ rowKey, amount (texto) }] }, el borrador de «Dividir» de la ficha abierta

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
  if (mapping.source === "pattern") {
    // CLA-01/02 (15/11/2026): la regla por palabras se dice con sus palabras y se quita desde aquí.
    const regla = globalThis.FinanceCanonicalPatternRules?.rulesOf({ [mapping.patternKey]: movementMappings[mapping.patternKey] })[0];
    const palabras = regla?.shown || "";
    const importe = regla?.amount ? `, con un importe de unos ${money(regla.amount, true)}` : "";
    return `Ahora: <strong>${escapeHtml(fichaMovNombrePartida(mapping.row))}</strong> · por la regla de palabras «${escapeHtml(palabras)}»${importe}. <button type="button" class="link-button" id="fichaMovQuitarPatron">Quitar esa regla</button>`;
  }
  if (mapping.source === "split") {
    const trozos = mapping.split.map((part) => `${escapeHtml(fichaMovNombrePartida(part.row))} (${money(part.amount, true)})`).join(", ");
    return `Ahora: <strong>dividido en ${mapping.split.length} partidas</strong>: ${trozos} · solo este movimiento. Guardar una sola partida aquí quita la división.`;
  }
  const por = mapping.source === "single" ? "solo este movimiento" : mapping.source === "dictionary" ? "por la regla de este concepto" : "por coincidir con el nombre de la partida";
  return `Ahora: <strong>${escapeHtml(fichaMovNombrePartida(mapping.row))}</strong> · ${por}.`;
}

function fichaMovAhoraTipo(action) {
  if (!action) return "Ahora: <strong>sin tipo</strong>.";
  const nombre = (typeof ACTION_TYPE_LABELS !== "undefined" && ACTION_TYPE_LABELS[action.actionType]) || action.actionType;
  const repite = fichaMovPeriodoTexto(action);
  const por = action.source === "single" ? "solo este movimiento" : action.source === "dictionary" ? "por la regla de este concepto" : "propuesto por la partida, sin confirmar";
  return `Ahora: <strong>${escapeHtml(nombre)}${repite}</strong> · ${por}.`;
}

function fichaMovAvisoHtml(row, bloque) {
  if (!fichaMovAviso || fichaMovAviso.bloque !== bloque || fichaMovAviso.id !== transactionIdentity(row)) return "";
  return `<p class="ficha-mov-aviso" role="status"><span>✓ ${escapeHtml(fichaMovAviso.texto)}</span><button type="button" class="link-button" id="fichaMovDeshacer">Deshacer</button></p>`;
}

// 3/11/2026 (petición del hogar): no todo lo que se repite es mensual. «¿Cada cuánto?» admite cada mes, cada 2, 3, 4 o 6 meses, cada
// año o puntual. Se guarda como siempre (`recurring`: true, false o null) más `everyMonths`; lo guardado antes como «se repite» sin
// periodo vale como «cada mes».
const FICHA_MOV_PERIODOS = [[1, "Cada mes"], [2, "Cada 2 meses"], [3, "Cada 3 meses (trimestral)"], [4, "Cada 4 meses"], [6, "Cada 6 meses (semestral)"], [12, "Cada año"]];

function fichaMovCadaMeses(entry) {
  const n = Math.round(Number(entry?.everyMonths));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function fichaMovRecurrenteValor(entry) {
  return entry?.recurring === true ? String(fichaMovCadaMeses(entry)) : entry?.recurring === false ? "false" : "";
}

// «, se repite cada mes», «, se repite cada 3 meses», «, se repite cada año» o «, puntual».
function fichaMovPeriodoTexto(entry) {
  if (entry?.recurring === false) return ", puntual";
  if (entry?.recurring !== true) return "";
  const n = fichaMovCadaMeses(entry);
  return n === 1 ? ", se repite cada mes" : n === 12 ? ", se repite cada año" : `, se repite cada ${n} meses`;
}

function fichaMovPeriodoOpciones(entry) {
  const actual = fichaMovRecurrenteValor(entry);
  const periodos = FICHA_MOV_PERIODOS.some(([n]) => String(n) === actual) || !/^\d+$/.test(actual) ? FICHA_MOV_PERIODOS : [...FICHA_MOV_PERIODOS, [Number(actual), `Cada ${actual} meses`]];
  return [
    `<option value=""${actual === "" ? " selected" : ""}>Sin marcar</option>`,
    ...periodos.map(([n, texto]) => `<option value="${n}"${String(n) === actual ? " selected" : ""}>${texto}</option>`),
    `<option value="false"${actual === "false" ? " selected" : ""}>Puntual, no se repite</option>`,
  ].join("");
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
  const tipoInicial = action?.confirmed ? `${action.actionType}|${fichaMovRecurrenteValor(action)}` : action ? "" : "|";
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
      ${fichaMovNuevaHtml(kind)}
      ${fichaMovAlcanceHtml({ prefijo: "movementDetail", idTodos: "movementDetailRemember", todos: reglaPartida, grupo: grupoPartida, nombre, conFirmados: true })}
      <p class="ficha-mov-error" id="movementDetailError" role="alert" hidden></p>
      ${fichaMovAvisoHtml(row, "partida")}
      <button type="button" class="e19-btn e19-btn-primary" id="movementDetailSave" data-inicial="${escapeHtml(partidaInicial)}" data-inicial-todos="${reglaPartida}" data-total-todos="${grupoPartida.total - grupoPartida.propias}">Guardar partida</button>
      <p class="e19-kpi-note" id="movementDetailPista">Nada que guardar todavía: cambia la partida o «¿A cuáles?».</p>
      ${fichaMovDivisionHtml(row, kind, mapping)}
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
          <span>¿Cada cuánto?</span>
          <select id="movementDetailRecurring">${fichaMovPeriodoOpciones(action)}</select>
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
  fichaMovDivisionEscuchas();
  fichaMovNuevaEscuchas(row, kind);
  qs("fichaMovDeshacer")?.addEventListener("click", fichaMovDeshacer);
  qs("fichaMovQuitarPatron")?.addEventListener("click", fichaMovQuitarPatron);
  qs("movementDetailViewReceipt")?.addEventListener("click", () => viewReceiptAttachment(row));
  qs("movementDetailAttachPhoto")?.addEventListener("change", (event) => handleMovementDetailAttachPhoto(event, row));
  qs("movementDetailSaveGeo")?.addEventListener("click", () => handleMovementDetailSaveGeo(row));
}

// «+ Nueva partida» en la ficha (D-N57, 27/11/2026, petición del hogar con la captura de PELAYO MUTUA): la misma de Clasificar
// (views/clasificar-v2.js, 2/11): nombre y bloque del tipo del movimiento, nada más. Sale con previsto 0 € (no cambia el plan) en
// todos los meses del plan desde el del movimiento (o el primero abierto, si es antes), sin los firmados, porque una partida
// personalizada solo existe en los meses con su fila. Un nombre que ya existe elige esa en vez de duplicarla. Queda elegida en el
// selector y «Guardar partida» hace lo de siempre (con su «¿A cuáles?» y su «Deshacer»): crear no asigna nada por sí solo.
function fichaMovNuevaHtml(kind) {
  const bloques = (baseData?.monthlyPlanning?.sections || []).filter((section) => section.kind === kind).map((section) => section.name);
  if (!bloques.length) return "";
  return `<button type="button" class="link-button ficha-mov-nueva-enlace" id="fichaMovNuevaAbrir" aria-expanded="false" aria-controls="fichaMovNueva">¿No está? + Nueva partida</button>
      <div class="ficha-mov-nueva" id="fichaMovNueva" role="group" aria-labelledby="fichaMovNuevaTitulo" hidden>
        <span class="ficha-mov-nueva-titulo" id="fichaMovNuevaTitulo">Nueva partida de ${kind === "income" ? "ingreso" : "gasto"}</span>
        <label class="ficha-mov-campo"><span>Nombre</span><input id="fichaMovNuevaNombre" type="text" maxlength="60" autocomplete="off" placeholder="Ej. Seguro de vida" /></label>
        <label class="ficha-mov-campo"><span>Bloque</span><select id="fichaMovNuevaBloque">${bloques.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></label>
        <p class="e19-kpi-note" id="fichaMovNuevaNota"></p>
        <p class="ficha-mov-error" id="fichaMovNuevaError" role="alert" hidden></p>
        <div class="ficha-mov-nueva-botones">
          <button type="button" class="e19-btn e19-btn-secondary" id="fichaMovNuevaCancelar">Cancelar</button>
          <button type="button" class="e19-btn e19-btn-primary" id="fichaMovNuevaCrear">Crear y elegir</button>
        </div>
      </div>`;
}

function fichaMovNuevaNota(kind) {
  const bloque = qs("fichaMovNuevaBloque")?.value || "";
  const nota = qs("fichaMovNuevaNota");
  if (!nota) return;
  const enBloque = availableSeriesRows(kind).filter((item) => item.sectionName === bloque).length;
  nota.textContent = `Sale con previsto 0 € en los meses abiertos: no cambia el plan, el importe lo pones luego en Plan.${enBloque ? ` «${bloque}» ya tiene ${enBloque === 1 ? "una partida" : `${enBloque} partidas`}: mira antes si alguna sirve.` : ""}`;
}

function fichaMovNuevaAbrir(abrir, kind) {
  const caja = qs("fichaMovNueva");
  const enlace = qs("fichaMovNuevaAbrir");
  if (!caja || !enlace) return;
  caja.hidden = !abrir;
  enlace.setAttribute("aria-expanded", String(abrir));
  const error = qs("fichaMovNuevaError");
  if (error) Object.assign(error, { hidden: true, textContent: "" });
  qs("fichaMovNuevaNombre")?.removeAttribute("aria-invalid");
  if (abrir) {
    const actual = rowForSeriesKey(qs("movementDetailPartida")?.value || "");
    const bloque = qs("fichaMovNuevaBloque");
    if (bloque && actual?.sectionName && [...bloque.options].some((option) => option.value === actual.sectionName)) bloque.value = actual.sectionName;
    fichaMovNuevaNota(kind);
    qs("fichaMovNuevaNombre")?.focus();
  } else {
    if (qs("fichaMovNuevaNombre")) qs("fichaMovNuevaNombre").value = "";
    enlace.focus();
  }
}

function fichaMovNuevaCrear(row, kind) {
  const nombre = qs("fichaMovNuevaNombre");
  const label = String(nombre?.value || "").trim().replace(/\s+/g, " ");
  const sectionName = qs("fichaMovNuevaBloque")?.value || "";
  const error = qs("fichaMovNuevaError");
  const fallo = (texto) => {
    if (error) Object.assign(error, { hidden: false, textContent: texto });
    nombre?.setAttribute("aria-invalid", "true");
    nombre?.setAttribute("aria-describedby", "fichaMovNuevaError");
    nombre?.focus();
  };
  if (!label) return fallo("Ponle un nombre a la partida.");
  const existente = availableSeriesRows(kind).find((item) => normalizedText(displayLabelForRow(item)) === normalizedText(label));
  let clave;
  let mensaje;
  if (existente) {
    clave = seriesKeyForRow(existente);
    mensaje = `Ya había una partida «${displayLabelForRow(existente)}» en ${existente.sectionName}: la he elegido en vez de crear otra. Pulsa «Guardar partida».`;
  } else {
    const months = baseData?.monthlyPlanning?.months || [];
    const primeraAbierta = months.find((month) => !isClosedMonthKey(month.key))?.key || "";
    const desde = [primeraAbierta, String(row.date || "").slice(0, 7)].filter(Boolean).sort()[0] || "";
    const meses = customSeriesMonthsFrom(desde);
    if (!sectionName || !meses.length) return fallo(sectionName ? "No hay meses abiertos en el plan donde crearla." : "No hay ningún bloque de este tipo en el plan.");
    const id = `custom-${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    meses.forEach((month) => customPlanningRows.push({ id, custom: true, kind, sectionName, label, monthKey: month.key, plannedValue: 0 }));
    saveCustomPlanningRows();
    clave = seriesKeyForRow({ kind, id });
    mensaje = `Partida «${label}» creada en ${sectionName} con previsto 0 €, de ${meses[0].label || meses[0].key} a ${meses.at(-1).label || meses.at(-1).key}. Está elegida: pulsa «Guardar partida».`;
  }
  const select = qs("movementDetailPartida");
  if (select) {
    select.innerHTML = movementMappingOptions(kind, clave);
    select.value = clave;
  }
  fichaMovNuevaAbrir(false, kind);
  fichaMovSincroniza("partida");
  select?.focus();
  announceStatus(mensaje);
}

function fichaMovNuevaEscuchas(row, kind) {
  qs("fichaMovNuevaAbrir")?.addEventListener("click", () => fichaMovNuevaAbrir(qs("fichaMovNueva")?.hidden, kind));
  qs("fichaMovNuevaCancelar")?.addEventListener("click", () => fichaMovNuevaAbrir(false, kind));
  qs("fichaMovNuevaCrear")?.addEventListener("click", () => fichaMovNuevaCrear(row, kind));
  qs("fichaMovNuevaBloque")?.addEventListener("change", (event) => { event.stopPropagation(); fichaMovNuevaNota(kind); });
  qs("fichaMovNuevaNombre")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); fichaMovNuevaCrear(row, kind); }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); fichaMovNuevaAbrir(false, kind); }
  });
}

// DAT-07 · «Dividir en varias partidas»: plegado dentro del bloque «Partida». Los trozos tienen que sumar el importe del movimiento
// (la barra dice cuánto falta) y el botón solo se enciende cuando cuadra. Se guarda en la regla «solo este movimiento», con la
// partida mayor y la que hubiera antes (para «Quitar la división»); cada partida recibe su parte en los reales.
function fichaMovImporteTexto(amount) {
  return Number(amount || 0).toFixed(2).replace(".", ",");
}

function fichaMovDivisionBorrador(row, mapping) {
  const id = transactionIdentity(row);
  if (fichaMovDivision?.id === id) return fichaMovDivision;
  const guardada = mapping?.source === "split" ? mapping.split : null;
  fichaMovDivision = {
    id,
    abierta: false,
    parts: guardada
      ? guardada.map((part) => ({ rowKey: seriesKeyForRow(part.row), amount: fichaMovImporteTexto(part.amount) }))
      : [{ rowKey: mapping?.row ? seriesKeyForRow(mapping.row) : "", amount: "" }, { rowKey: "", amount: "" }],
  };
  return fichaMovDivision;
}

function fichaMovDivisionEstado(row) {
  const motor = globalThis.FinanceCanonicalMovementSplit;
  const total = Math.abs(Number(row.amount || 0));
  const result = motor.evaluate(fichaMovDivision.parts, total);
  const barra = motor.progress(result, total);
  const texto = barra.done
    ? `Repartido: ${money(result.sum, true)} de ${money(total, true)}.${result.ok ? "" : ` Falta: ${result.reason}.`}`
    : barra.over
      ? `Sobran ${money(-result.remaining, true)}: los trozos suman ${money(result.sum, true)} y el movimiento es de ${money(total, true)}.`
      : `Falta repartir ${money(result.remaining, true)} de ${money(total, true)}.`;
  return { result, barra, texto };
}

function fichaMovDivisionHtml(row, kind, mapping) {
  const motor = globalThis.FinanceCanonicalMovementSplit;
  if (!motor || !Number(row.amount)) return "";
  const borrador = fichaMovDivisionBorrador(row, mapping);
  const guardada = mapping?.source === "split";
  const { result, barra, texto } = fichaMovDivisionEstado(row);
  const firmado = typeof isSignedClosedMonthKey === "function" && isSignedClosedMonthKey(String(row.month || row.date || "").slice(0, 7));
  const filas = borrador.parts.map((part, index) => `
      <div class="ficha-mov-pareja" data-ficha-dividir-fila="${index}">
        <label class="ficha-mov-campo"><span>Partida ${index + 1}</span><select data-ficha-dividir-partida="${index}">${movementMappingOptions(kind, part.rowKey)}</select></label>
        <label class="ficha-mov-campo"><span>Importe (€)</span><input type="text" inputmode="decimal" autocomplete="off" data-ficha-dividir-importe="${index}" value="${escapeHtml(part.amount)}" /></label>
        ${borrador.parts.length > motor.MIN_PARTES ? `<button type="button" class="link-button" data-ficha-dividir="quitar-fila" data-indice="${index}">Quitar este trozo</button>` : ""}
      </div>`).join("");
  return `
      <details class="ficha-mov-dividir" id="fichaMovDividir"${borrador.abierta ? " open" : ""}>
        <summary>${guardada ? `Dividido en ${mapping.split.length} partidas` : "Dividir en varias partidas"}</summary>
        <p class="e19-kpi-note">Para un ticket o un Bizum que mezcla cosas: reparte ${money(Math.abs(Number(row.amount)), true)} entre dos partidas o más. Cada una recibe su parte en los reales; solo cambia este movimiento.</p>
        ${firmado ? '<p class="e19-kpi-note">El mes de este movimiento está firmado: la división se guarda, pero sus reales no cambian.</p>' : ""}
        ${filas}
        ${borrador.parts.length < motor.MAX_PARTES ? '<button type="button" class="link-button" data-ficha-dividir="anadir">Añadir otra partida</button>' : ""}
        <progress id="fichaMovDividirBarra" max="100" value="${barra.pct}" aria-label="Parte repartida del movimiento">${barra.pct} %</progress>
        <p class="e19-kpi-note" id="fichaMovDividirEstado" aria-live="polite">${escapeHtml(texto)}</p>
        <p class="ficha-mov-error" id="fichaMovDividirError" role="alert" hidden></p>
        <button type="button" class="e19-btn e19-btn-primary" id="fichaMovDividirGuardar"${result.ok ? "" : " disabled"}>Guardar la división</button>
        ${guardada ? '<button type="button" class="e19-btn e19-btn-secondary" id="fichaMovDividirQuitar">Quitar la división</button>' : ""}
      </details>`;
}

// Lo tecleado se guarda en el borrador sin volver a pintar (no se pierde el foco); añadir o quitar un trozo sí repinta la ficha.
function fichaMovDivisionEscuchas() {
  const detalles = qs("fichaMovDividir");
  if (!detalles || !fichaMovDivision) return;
  detalles.addEventListener("toggle", () => { fichaMovDivision.abierta = detalles.open; });
  const actualiza = (event) => {
    const target = event.target;
    const iPartida = target?.dataset?.fichaDividirPartida;
    const iImporte = target?.dataset?.fichaDividirImporte;
    if (iPartida === undefined && iImporte === undefined) return;
    if (iPartida !== undefined) fichaMovDivision.parts[Number(iPartida)].rowKey = target.value;
    if (iImporte !== undefined) fichaMovDivision.parts[Number(iImporte)].amount = target.value;
    const { result, barra, texto } = fichaMovDivisionEstado(movementDetailTransaction);
    const barraEl = qs("fichaMovDividirBarra");
    if (barraEl) { barraEl.value = barra.pct; barraEl.textContent = `${barra.pct} %`; }
    const estado = qs("fichaMovDividirEstado");
    if (estado) estado.textContent = texto;
    const boton = qs("fichaMovDividirGuardar");
    if (boton) boton.disabled = !result.ok;
    const error = qs("fichaMovDividirError");
    if (error) error.hidden = true;
  };
  detalles.addEventListener("input", actualiza);
  detalles.addEventListener("change", actualiza);
  detalles.addEventListener("click", (event) => {
    const accion = event.target.closest?.("[data-ficha-dividir]")?.dataset.fichaDividir;
    if (accion === "anadir") {
      fichaMovDivision.parts.push({ rowKey: "", amount: "" });
      renderMovementDetailDialog();
      qs("movementDetailContent")?.querySelector(`[data-ficha-dividir-partida="${fichaMovDivision.parts.length - 1}"]`)?.focus();
    } else if (accion === "quitar-fila") {
      fichaMovDivision.parts.splice(Number(event.target.dataset.indice), 1);
      renderMovementDetailDialog();
      qs("fichaMovDividirBarra")?.focus?.();
    }
  });
  qs("fichaMovDividirGuardar")?.addEventListener("click", fichaMovDivisionGuardar);
  qs("fichaMovDividirQuitar")?.addEventListener("click", fichaMovDivisionQuitar);
}

function fichaMovNombreDeClave(kind, rowKeyValue) {
  const fila = planningRowBySeriesKey(kind, rowKeyValue);
  return fila ? fichaMovNombrePartida(fila) : rowKeyValue;
}

function fichaMovDivisionGuardar() {
  const row = movementDetailTransaction;
  const motor = globalThis.FinanceCanonicalMovementSplit;
  if (!row || !motor || !fichaMovDivision) return;
  const kind = movementKindFromAmount(row.amount);
  const result = motor.evaluate(fichaMovDivision.parts, row.amount);
  if (!result.ok) {
    const error = qs("fichaMovDividirError");
    if (error) { error.textContent = `No se puede guardar: ${result.reason}.`; error.hidden = false; }
    announceStatus(`No se puede guardar: ${result.reason}.`);
    return;
  }
  const single = transactionIdentity(row);
  const foto = fichaMovFoto(movementMappings, [single]);
  const antes = movementMappings[single];
  const previo = antes && !antes.split ? { rowKey: antes.rowKey, label: antes.label || "" } : antes?.previo || null;
  const principal = motor.mainRowKey(result.parts);
  movementMappings[single] = {
    kind,
    rowKey: principal,
    label: fichaMovNombreDeClave(kind, principal),
    split: result.parts,
    ...(previo ? { previo } : {}),
    updatedAt: new Date().toISOString(),
  };
  fichaMovRefrescaPartidas(null);
  const texto = `Dividido: ${result.parts.map((part) => `${money(part.amount, true)} a «${fichaMovNombreDeClave(kind, part.rowKey)}»`).join(", ")}. Los demás «${movementDisplayName(row)}» no cambian.`;
  fichaMovAviso = {
    id: single,
    bloque: "partida",
    texto,
    deshacer: () => {
      fichaMovRestaura(movementMappings, foto);
      fichaMovRefrescaPartidas(null);
      fichaMovDivision = null;
    },
  };
  fichaMovDivision = null;
  announceStatus(texto);
  renderMovementDetailDialog();
  renderDetailedMovements();
}

// Quitar la división devuelve el movimiento a lo que tenía antes: su partida «solo este» si la había, o la regla de su concepto.
function fichaMovDivisionQuitar() {
  const row = movementDetailTransaction;
  if (!row) return;
  const single = transactionIdentity(row);
  const actual = movementMappings[single];
  if (!actual?.split) return;
  const foto = fichaMovFoto(movementMappings, [single]);
  if (actual.previo?.rowKey) movementMappings[single] = { kind: actual.kind, rowKey: actual.previo.rowKey, label: actual.previo.label || "", updatedAt: new Date().toISOString() };
  else delete movementMappings[single];
  fichaMovRefrescaPartidas(null);
  const ahora = mappingForMovement(row);
  const texto = `División quitada: el movimiento va entero a ${ahora ? `«${fichaMovNombrePartida(ahora.row)}»` : "ninguna partida (vuelve a la bandeja)"}.`;
  fichaMovAviso = {
    id: single,
    bloque: "partida",
    texto,
    deshacer: () => {
      fichaMovRestaura(movementMappings, foto);
      fichaMovRefrescaPartidas(null);
      fichaMovDivision = null;
    },
  };
  fichaMovDivision = null;
  announceStatus(texto);
  renderMovementDetailDialog();
  renderDetailedMovements();
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

// CLA-01/02: quitar la regla por palabras que clasifica este movimiento. Lo que cogía vuelve a la bandeja (salvo lo que
// tenga su propia regla de concepto); con «Deshacer» en el aviso de la ficha.
function fichaMovQuitarPatron() {
  const row = movementDetailTransaction;
  const mapping = row ? mappingForMovement(row) : null;
  if (mapping?.source !== "pattern") return;
  const foto = fichaMovFoto(movementMappings, [mapping.patternKey]);
  const palabras = globalThis.FinanceCanonicalPatternRules?.rulesOf({ [mapping.patternKey]: movementMappings[mapping.patternKey] })[0]?.shown || "";
  delete movementMappings[mapping.patternKey];
  fichaMovRefrescaPartidas(null);
  const texto = `Regla de palabras «${palabras}» quitada: lo que clasificaba vuelve a la bandeja.`;
  fichaMovAviso = {
    id: transactionIdentity(row),
    bloque: "partida",
    texto,
    deshacer: () => {
      fichaMovRestaura(movementMappings, foto);
      fichaMovRefrescaPartidas(null);
    },
  };
  announceStatus(texto);
  renderMovementDetailDialog();
  renderDetailedMovements();
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
  const cada = /^\d+$/.test(recurringRaw) ? Number(recurringRaw) : recurringRaw === "true" ? 1 : null;
  const recurring = cada ? true : recurringRaw === "false" ? false : null;
  const everyMonths = cada || null;
  const remember = Boolean(qs("movementDetailActionTypeRemember")?.checked);
  const kind = movementKindFromAmount(row.amount);
  const nombre = movementDisplayName(row);
  const single = transactionIdentity(row);
  const keys = remember ? fichaMovClavesDelConcepto(movementActionTypes, row, kind) : [single];
  const foto = fichaMovFoto(movementActionTypes, [...keys, single]);
  const updatedAt = new Date().toISOString();
  keys.forEach((key) => {
    movementActionTypes[key] = { actionType, recurring, everyMonths, updatedAt };
  });
  if (remember) delete movementActionTypes[single];
  saveMovementActionTypes();
  const etiqueta = (typeof ACTION_TYPE_LABELS !== "undefined" && ACTION_TYPE_LABELS[actionType]) || actionType;
  const grupo = fichaMovGrupo(row, kind, movementActionTypes);
  const periodo = fichaMovPeriodoTexto({ recurring, everyMonths });
  const texto = remember
    ? `${fichaMovCuantos(Math.max(1, grupo.total - grupo.propias))} de «${nombre}» son ahora «${etiqueta}${periodo}», también los que vengan.`
    : `Este movimiento es ahora «${etiqueta}${periodo}».`;
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
