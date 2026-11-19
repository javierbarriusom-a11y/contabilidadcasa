// Rediseño · fase A4, PR-1 (docs/rediseno/HANDOFF.md §5 «B3 · Movimientos» y §5b, referencias/png/Movimientos.png
// y MovimientosDesktop.png).
//
// Movimientos v2: «¿qué ha pasado?». La bandeja arriba, la lista agrupada por día con la partida como etiqueta (y
// «¿partida?» si falta), filtros por cuenta y el acceso a Cierre al final. Con 0 movimientos, un solo bloque que lleva
// a Importar. Solo se ve con el tema v2 (<html data-tema="v2">); sin la bandera este fichero no pinta nada.
//
// No es un motor nuevo ni clasifica nada: lee baseData.transactions y la partida de cada movimiento con
// mappingForMovement (el mismo diccionario de reglas de siempre), y tocar un movimiento abre el mismo panel de
// detalle de la vista de siempre (openMovementDetailRow, app.js), donde se cambia su partida. La vista de siempre
// sigue en el DOM: «Ver todo el detalle» la vuelve a enseñar entera (rango de fechas, tipo de acción, selección en
// lote, comercios, totales). La tarjeta de anomalías (WP-36) no se oculta: es parte de la bandeja.
//
// Lo que la referencia enseña y aún no existe (extracto que llega por Compartir, XDA-02; cobros que el extracto
// confirma solo, XDA-08) va plegado en una línea, sin construirlo aquí. La cobertura de 90 días por cuenta (XDA-04
// PR-2, cobertura-ui.js) va entre la bandeja y la lista, como en la referencia, solo si hay algún extracto.
// Script clásico con defer, cargado antes de app.js (mismo scope global que el resto de views/*.js).

const MOV_V2_DETAIL_CLASS = "mov-v2-detalle";
const MOV_V2_PAGE = 40;
const MOV_V2_ACCOUNT_LABELS = { caixabank: "CaixaBank", mediolanum: "Mediolanum", efectivo: "Efectivo" };

let movV2Filter = "todas";
let movV2Search = "";
let movV2SearchOpen = false;
let movV2Limit = MOV_V2_PAGE;
let movV2Shown = [];

function movV2Active() {
  return document.documentElement.dataset.tema === "v2";
}

function movV2Account(row) {
  return String(row.account || MOV_V2_ACCOUNT_LABELS[row.accountId] || "").trim();
}

function movV2Partida(row) {
  if (!Number(row.amount)) return null;
  const mapping = mappingForMovement(row);
  if (mapping?.split) return `Dividido en ${mapping.split.length} partidas`; // DAT-07
  if (mapping) return displayLabelForRow(mapping.row);
  // DAT-05 (15/11/2026): un traspaso entre cuentas propias no pide partida; se dice lo que es.
  return typeof movementIsInternalTransfer === "function" && movementIsInternalTransfer(row) ? MOV_V2_TRASPASO : null;
}

// DAT-05 · Las parejas de traspaso que propone el motor (canonical-internal-transfers.js): una salida y una entrada del mismo
// importe, en cuentas distintas, con dos días o menos de diferencia, donde al menos una de las dos pide partida. Las que el
// hogar dijo que no lo son quedan en «traspasos-descartados» (va en la copia, BACKUP_LOCAL_STORES).
const MOV_V2_TRASPASO = "Traspaso";
const MOV_V2_TRASPASOS_KEY = "traspasos-descartados";
const MOV_V2_TRASPASOS_VISIBLES = 3;
const MOV_V2_TRASPASOS_GUARDADAS = 300;

function movV2TraspasosDescartados() {
  try {
    const value = JSON.parse(storageGet(storageKey(MOV_V2_TRASPASOS_KEY), "[]"));
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function movV2Traspasos() {
  const motor = globalThis.FinanceCanonicalInternalTransfers;
  if (!motor || typeof movementIsInternalTransfer !== "function") return [];
  const byId = new Map();
  const movements = (baseData?.transactions || []).filter((row) => row && Number(row.amount)).map((row) => {
    const id = transactionIdentity(row);
    byId.set(id, row);
    return { id, date: row.date, amount: Number(row.amount), account: movV2Account(row), settled: Boolean(mappingForMovement(row)) || movementIsInternalTransfer(row) };
  });
  return motor.pairs(movements, { dismissed: movV2TraspasosDescartados() });
}

function movV2TraspasoHtml(pair) {
  const gap = pair.gap === 0 ? "el mismo día" : pair.gap === 1 ? "con un día de diferencia" : `con ${pair.gap} días de diferencia`;
  const duda = pair.ambiguous ? " Hay más de una entrada que encaja: miradlo antes." : "";
  return `<li class="mov-v2-card mov-v2-esperado mov-v2-traspaso">
    <span class="mov-v2-av" aria-hidden="true">${movV2Icon('<path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"></path>')}</span>
    <div class="mov-v2-main"><strong>${escapeHtml(money(pair.amount, true))} de ${escapeHtml(pair.from)} a ${escapeHtml(pair.to)}</strong>
      <span class="mov-v2-meta">Sale el ${escapeHtml(movV2Date(pair.date, { day: "numeric", month: "long" }))} y entra ${escapeHtml(gap)}.${duda}</span>
      <div class="mov-v2-esperado-acciones">
        <button type="button" class="e19-btn e19-btn-primary" data-mov-v2-traspaso-si="${escapeHtml(pair.key)}">Es un traspaso</button>
        <button type="button" class="e19-btn e19-btn-secondary" data-mov-v2-traspaso-no="${escapeHtml(pair.key)}">No lo es</button>
      </div></div>
  </li>`;
}

function movV2TraspasosHtml(pairs) {
  if (!pairs.length) return "";
  const rest = pairs.length - MOV_V2_TRASPASOS_VISIBLES;
  return `<div class="mov-v2-traspasos">
    <p class="mov-v2-meta"><strong>${pairs.length === 1 ? "Un posible traspaso" : `${pairs.length} posibles traspasos`} entre vuestras cuentas.</strong> Mismo importe, de una cuenta a otra. No es gasto ni ingreso: marcado, deja de pedir partida.</p>
    <ul class="mov-v2-esperados" aria-label="Posibles traspasos entre vuestras cuentas">${pairs.slice(0, MOV_V2_TRASPASOS_VISIBLES).map(movV2TraspasoHtml).join("")}</ul>
    ${rest > 0 ? `<p class="mov-v2-meta">Y ${rest === 1 ? "otro más" : `otros ${rest}`}: ${rest === 1 ? "sale" : "salen"} al contestar ${rest === 1 ? "uno de estos" : "estos"}.</p>` : ""}
  </div>`;
}

// Marca las dos puntas como «Transferencia interna», solo esos dos movimientos (clave transactionIdentity), con «Deshacer».
function movV2TraspasoSi(key) {
  const pair = movV2Traspasos().find((item) => item.key === key);
  if (!pair || typeof movementActionTypes === "undefined") return;
  const ids = [pair.outId, pair.inId];
  const foto = ids.map((id) => [id, movementActionTypes[id] ? { ...movementActionTypes[id] } : null]);
  const updatedAt = new Date().toISOString();
  ids.forEach((id) => {
    movementActionTypes[id] = { actionType: "transferencia_interna", recurring: null, everyMonths: null, updatedAt };
  });
  const guardar = () => {
    saveMovementActionTypes();
    refreshAllSectionsAfterDataChange();
    movimientosV2Render();
  };
  guardar();
  const texto = `Traspaso de ${money(pair.amount, true)} de ${pair.from} a ${pair.to} marcado: ya no pide partida ni cuenta como gasto.`;
  showUndoToast(texto, () => {
    foto.forEach(([id, value]) => {
      if (value) movementActionTypes[id] = value;
      else delete movementActionTypes[id];
    });
    guardar();
  });
  announceStatus(texto);
}

// Reglas por palabras (CLA-01 y CLA-02), todas a la vista (16/11/2026): hasta ahora solo se veían y se quitaban desde la ficha de
// un movimiento que clasificaran. Una regla así clasifica sola lo que llega, así que hace falta un sitio donde repasarlas: qué
// palabras piden, a qué partida llevan, cuántos movimientos clasifican ahora y «Quitar», con «Deshacer». Plegado de entrada (no
// añade un titular: XGO-01) y solo si hay alguna.
let movV2ReglasAbiertas = false;

function movV2ReglasPalabras() {
  const motor = globalThis.FinanceCanonicalPatternRules;
  if (!motor) return [];
  const reglas = motor.rulesOf(movementMappings);
  if (!reglas.length) return []; // sin reglas no se recorre el extracto
  const cuenta = new Map();
  (baseData?.transactions || []).forEach((row) => {
    const key = row && Number(row.amount) ? mappingForMovement(row)?.patternKey : null;
    if (key) cuenta.set(key, (cuenta.get(key) || 0) + 1);
  });
  return reglas
    .map((rule) => {
      const partida = planningRowBySeriesKey(rule.kind, rule.rowKey);
      return { ...rule, partida: partida ? `${partida.sectionName} · ${displayLabelForRow(partida)}` : "", movimientos: cuenta.get(rule.key) || 0 };
    })
    .sort((a, b) => b.movimientos - a.movimientos || a.shown.localeCompare(b.shown, "es"));
}

function movV2ReglasHtml() {
  const reglas = movV2ReglasPalabras();
  if (!reglas.length) return "";
  movV2ReglasAbiertas = qs("movV2Reglas")?.open ?? movV2ReglasAbiertas;
  const filas = reglas.map((rule) => {
    const importe = rule.amount ? ` de unos ${money(rule.amount, true)}` : "";
    const destino = rule.partida
      ? `van a <strong>${escapeHtml(rule.partida)}</strong>`
      : `<strong>su partida ya no existe</strong>: no clasifica nada`;
    const ahora = rule.movimientos === 0 ? "ahora no clasifica ningún movimiento" : rule.movimientos === 1 ? "ahora clasifica un movimiento" : `ahora clasifica ${rule.movimientos} movimientos`;
    return `<li class="mov-v2-card mov-v2-regla">
      <div class="mov-v2-main"><strong>«${escapeHtml(rule.shown)}»</strong>
        <span class="mov-v2-meta">Los ${rule.kind === "income" ? "ingresos" : "gastos"} con ${rule.words.length === 1 ? "esa palabra" : "esas palabras"}${importe} ${destino}; ${ahora}.</span></div>
      <button type="button" class="e19-btn e19-btn-secondary" data-mov-v2-regla-quitar="${escapeHtml(rule.key)}" aria-label="Quitar la regla de palabras «${escapeHtml(rule.shown)}»">Quitar</button>
    </li>`;
  });
  return `<details class="mov-v2-reglas" id="movV2Reglas"${movV2ReglasAbiertas ? " open" : ""}>
    <summary>${reglas.length === 1 ? "Una regla por palabras" : `${reglas.length} reglas por palabras`}</summary>
    <p class="mov-v2-meta">Clasifican solas lo que llega con esas palabras, aunque cambie el resto del concepto. Se crean en Clasificar («Recordar también por palabras»).</p>
    <ul class="mov-v2-esperados" aria-label="Reglas por palabras">${filas.join("")}</ul>
  </details>`;
}

function movV2ReglaQuitar(key) {
  const antes = movementMappings[key];
  if (!antes) return;
  const regla = movV2ReglasPalabras().find((item) => item.key === key);
  const guardar = () => {
    saveMovementMappings();
    applyMovementMappingsToActuals();
    pendingMovementMappings = buildPendingMovementMappings(baseData.transactions || []);
    saveIncomeActuals();
    saveExpenseActuals();
    refreshAllSectionsAfterDataChange();
    movimientosV2Render();
  };
  movV2ReglasAbiertas = true;
  delete movementMappings[key];
  guardar();
  const vuelven = regla?.movimientos ? ` ${regla.movimientos === 1 ? "Un movimiento vuelve" : `${regla.movimientos} movimientos vuelven`} a pedir partida.` : "";
  const texto = `Regla de palabras «${regla?.shown || ""}» quitada.${vuelven}`;
  showUndoToast(texto, () => {
    movementMappings[key] = antes;
    guardar();
    announceStatus(`Regla de palabras «${regla?.shown || ""}» recuperada.`);
  });
  announceStatus(texto);
  (qs("movV2Reglas")?.querySelector("summary") || qs("movimientosV2")?.querySelector("h1, h2"))?.focus?.();
}

function movV2TraspasoNo(key) {
  const antes = movV2TraspasosDescartados();
  const guardar = (list) => {
    storageSet(storageKey(MOV_V2_TRASPASOS_KEY), JSON.stringify(list.slice(-MOV_V2_TRASPASOS_GUARDADAS)));
    movimientosV2Render();
  };
  guardar([...antes.filter((item) => item !== key), key]);
  const texto = "De acuerdo, no es un traspaso: no vuelvo a proponer esa pareja.";
  showUndoToast(texto, () => guardar(antes));
  announceStatus(texto);
}

function movV2Date(iso, options) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", options).format(date).replace(".", "");
}

function movV2DayLabel(iso) {
  const text = movV2Date(iso, { weekday: "long", day: "numeric", month: "short" }).replace(",", "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function movV2Amount(amount) {
  const value = Number(amount || 0);
  return `${value > 0 ? "+" : ""}${money(value, true)}`;
}

function movV2Icon(path) {
  return `<svg class="mov-v2-ico" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

// Todos los movimientos, del más reciente al más antiguo, con lo que la pantalla necesita de cada uno.
function movV2AllRows() {
  return (baseData?.transactions || [])
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((row) => ({ row, account: movV2Account(row), partida: movV2Partida(row) }));
}

function movV2Filtered(all) {
  const search = normalizedText(movV2Search);
  return all.filter((item) => {
    if (movV2Filter === "sin-partida" && (item.partida || !Number(item.row.amount))) return false;
    if (movV2Filter !== "todas" && movV2Filter !== "sin-partida" && item.account !== movV2Filter) return false;
    if (!search) return true;
    const amount = Math.abs(Number(item.row.amount || 0));
    return normalizedText(`${item.row.movement} ${item.row.details} ${item.partida || ""} ${item.row.amount} ${money(amount, true)}`).includes(search);
  });
}

function movV2Header(hasRows) {
  const search = hasRows
    ? `<button type="button" class="e19-btn e19-btn-secondary mov-v2-icon-btn mov-v2-solo-movil" data-mov-v2-search aria-label="Buscar movimientos" aria-expanded="${movV2SearchOpen}" aria-controls="movV2Buscar">${movV2Icon('<circle cx="11" cy="11" r="6.5"></circle><path d="m20 20-4.2-4.2"></path>')}</button>`
    : "";
  const cierre = hasRows ? `<button type="button" class="e19-btn e19-btn-secondary mov-v2-solo-ancho" data-mov-v2-nav="cierre">${escapeHtml(movV2CloseTitle())}</button>` : "";
  return `<div class="mov-v2-header">
    <h2 class="mov-v2-title">Movimientos</h2>
    <div class="mov-v2-actions">${search}${cierre}
      <button type="button" class="e19-btn e19-btn-primary mov-v2-importar" data-mov-v2-nav="datos-importar" aria-label="Importar extracto">${movV2Icon('<path d="M12 5v14M5 12h14"></path>')}<span class="mov-v2-solo-ancho">Importar</span></button>
    </div>
  </div>`;
}

// Cobros y cargos esperados (WP-14 + WP-27, esperados-ui.js): «¿ha llegado la nómina?», «el recibo no ha llegado».
// Desde el 25/10/2026, primer cambio de Hoy tras levantar su congelación, con el tema v2 viven aquí y no en la bandeja
// de decisiones de Hoy: se contestan mirando el extracto, que es lo que enseña esta pantalla (referencia: «cobros
// confirmados» en la bandeja de Movimientos.png). Las respuestas son los mismos botones de siempre: esperados-ui.js
// los atiende por delegación en todo el documento y, al contestar, repinta esta pantalla (renderDecisionInboxCard).
// Hoy estuvo congelado hasta el 25/10/2026 (BACKLOG_DEFINITIVO.md §4): el cambio se publica antes, pero solo se activa
// ese día. Antes, las preguntas siguen en la bandeja de Hoy como siempre. Pasado el 25/10 esta puerta ya no hace nada.
const MOV_V2_ESPERADOS_DESDE = "2026-10-25";

function movV2EsperadosAqui() {
  return movV2Active() && isoLocalDate(new Date()) >= MOV_V2_ESPERADOS_DESDE;
}

function movV2Esperados() {
  return movV2EsperadosAqui() && typeof expectedMovementInboxItems === "function" ? expectedMovementInboxItems() : [];
}

globalThis.movV2EsperadosAqui = movV2EsperadosAqui;

function movV2EsperadoHtml(item) {
  const income = item.source === "Cobro esperado";
  const icon = income ? '<path d="M12 19V5M6 11l6-6 6 6"></path>' : '<path d="M12 5v14M6 13l6 6 6-6"></path>';
  const actions = item.html || `<button type="button" class="e19-btn e19-btn-secondary" data-mov-v2-nav="${escapeHtml(item.target || "registrar")}">Revisar</button>`;
  return `<li class="mov-v2-card mov-v2-esperado">
    <span class="mov-v2-av ${income ? "is-pos" : "is-warn"}" aria-hidden="true">${movV2Icon(icon)}</span>
    <div class="mov-v2-main"><strong>${escapeHtml(item.title)}</strong><span class="mov-v2-meta">${escapeHtml(item.text)}</span>
      <div class="mov-v2-esperado-acciones">${actions}</div></div>
  </li>`;
}

function movV2EsperadosList(esperados) {
  return esperados.length
    ? `<ul class="mov-v2-esperados" aria-label="Cobros y cargos por confirmar">${esperados.map(movV2EsperadoHtml).join("")}</ul>`
    : "";
}

function movV2BandejaHead(count) {
  return `<div class="mov-v2-section-head"><h3>Bandeja</h3><span>${count ? `${count} ${count === 1 ? "cosa" : "cosas"}` : "nada pendiente"}</span></div>`;
}

// DEC-18 (18/11/2026): la meta de D-N11 (95 % del gasto importado con partida antes del 1/12) a la vista en la bandeja, con la
// misma cifra que Funciones en prueba y el medidor (clasV2Meta, views/clasificar-v2.js): cuánto falta y cuántos de los
// conceptos que más suman bastan. Barra fina, azul hasta la meta y tinta al llegar; sin rojo. Sin gasto importado, nada.
function movV2MetaHtml() {
  const meta = typeof clasV2Meta === "function" ? clasV2Meta() : null;
  if (!meta) return "";
  const hecho = meta.pct >= meta.objetivo;
  const bastan = meta.grupos === 1 ? "basta el concepto que más suma" : `bastan los ${meta.grupos} conceptos que más suman`;
  const texto = hecho
    ? `Gasto con partida (últimos 90 días): ${meta.pct} % · objetivo del ${meta.objetivo} % cumplido`
    : `Gasto con partida (últimos 90 días): ${meta.pct} % · objetivo ${meta.objetivo} % · faltan ${money(meta.falta)}${meta.grupos ? `; ${bastan}` : ""}`;
  return `<div class="mov-v2-meta-partida${hecho ? " is-hecho" : ""}">
    <p class="mov-v2-meta">${escapeHtml(texto)}</p>
    <div class="mov-v2-meta-barra" role="progressbar" aria-label="Gasto con partida, últimos 90 días" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${meta.pct}">
      <span style="width:${Math.min(100, Math.max(0, meta.pct))}%"></span><i style="left:${meta.objetivo}%" aria-hidden="true"></i>
    </div>
  </div>`;
}

// Bandeja: lo que pide algo. Los movimientos sin partida (agrupados por concepto, que es la unidad de las reglas: dar
// partida a uno se la da a los demás con el mismo concepto) y los cobros y cargos esperados por confirmar. Las
// anomalías del extracto (WP-36) son su propia tarjeta, justo debajo. La tarjeta abre Clasificar por lotes (A5,
// views/clasificar-v2.js); el filtro «Sin partida» sigue en la lista.
function movV2Bandeja(all, esperados = []) {
  const sinPartida = all.filter((item) => Number(item.row.amount) && !item.partida);
  const groupKey = typeof movementMappingGroupKey === "function" ? movementMappingGroupKey : movementMappingKey; // sin el mes, como Clasificar
  const grupos = new Set(sinPartida.map((item) => groupKey(item.row))).size;
  const traspasos = movV2Traspasos();
  const head = movV2BandejaHead((grupos ? 1 : 0) + esperados.length + traspasos.length);
  const body = grupos
    ? `<button type="button" class="mov-v2-card mov-v2-fila-bandeja" data-mov-v2-clasificar>
        <span class="mov-v2-av is-warn" aria-hidden="true">${grupos}</span>
        <span class="mov-v2-main"><strong>${grupos === 1 ? "Un concepto sin partida" : `${grupos} conceptos sin partida`}</strong>
          <span class="mov-v2-meta">${sinPartida.length} ${sinPartida.length === 1 ? "movimiento" : "movimientos"} · clasifícalos por grupos, de 5 en 5, con propuesta y deshacer</span></span>
        <span aria-hidden="true">›</span>
      </button>`
    : `<p class="mov-v2-card mov-v2-vacio-linea">Todos los movimientos tienen partida.</p>`;
  return `<section class="mov-v2-bandeja" aria-label="Bandeja">${head}${body}${movV2MetaHtml()}${movV2TraspasosHtml(traspasos)}${movV2EsperadosList(esperados)}${movV2ReglasHtml()}</section>`;
}

// Rediseño B5: la puerta del Repaso semanal (views/repaso-v2.js). No es algo pendiente, así que va aparte de la bandeja,
// con lo que costó el último.
function movV2Repaso() {
  if (typeof globalThis.repasoV2Open !== "function") return "";
  const resumen = globalThis.FinanceRepaso?.resumen?.();
  const ultimo = resumen?.ultimo;
  const dias = ultimo ? Math.round((new Date(`${isoLocalDate(new Date())}T12:00:00`) - new Date(`${ultimo.date}T12:00:00`)) / 86400000) : null;
  const meta = ultimo
    ? `El último, ${dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`}, en ${Math.max(1, Math.round(ultimo.seconds / 60))} min`
    : "Saldos, extracto, lo que vino y la bandeja, en orden";
  return `<button type="button" class="mov-v2-card mov-v2-fila-bandeja mov-v2-repaso" data-mov-v2-repaso>
    <span class="mov-v2-av" aria-hidden="true">${movV2Icon('<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>')}</span>
    <span class="mov-v2-main"><strong>Repaso semanal · unos 5 min</strong><span class="mov-v2-meta">${escapeHtml(meta)}</span></span>
    <span aria-hidden="true">›</span>
  </button>`;
}

// Sin movimientos también se puede contestar si ha llegado un cobro (registra el real): la bandeja sale solo con eso.
function movV2BandejaSoloEsperados(esperados) {
  return esperados.length ? `<section class="mov-v2-bandeja" aria-label="Bandeja">${movV2BandejaHead(esperados.length)}${movV2EsperadosList(esperados)}</section>` : "";
}

function movV2Chips(all) {
  const accounts = [...new Set(all.map((item) => item.account).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const chips = [["todas", accounts.length > 1 ? "Todas las cuentas" : "Todas"], ...accounts.map((account) => [account, account]), ["sin-partida", "Sin partida"]];
  return `<div class="mov-v2-chips" role="group" aria-label="Filtrar movimientos">${chips
    .map(([id, label]) => `<button type="button" class="mov-v2-chip${movV2Filter === id ? " is-active" : ""}" data-mov-v2-filtro="${escapeHtml(id)}" aria-pressed="${movV2Filter === id}">${escapeHtml(label)}</button>`)
    .join("")}</div>`;
}

function movV2Tag(partida) {
  return partida ? `<span class="mov-v2-tag">${escapeHtml(partida)}</span>` : `<span class="mov-v2-tag is-missing">¿partida?</span>`;
}

function movV2Row(item, index) {
  const { row, account, partida } = item;
  const amount = Number(row.amount || 0);
  const concept = String(row.movement || row.details || "Movimiento");
  const initial = partida ? concept.trim().charAt(0).toUpperCase() || "·" : "?";
  return `<li><button type="button" class="mov-v2-fila" data-mov-v2-index="${index}" aria-label="${escapeHtml(`${concept}, ${movV2Amount(amount)}, ${movV2Date(row.date, { day: "numeric", month: "long" })}${partida ? `, ${partida}` : ", sin partida"}. Abrir el detalle`)}">
    <span class="mov-v2-fecha">${escapeHtml(movV2Date(row.date, { day: "numeric", month: "short" }))}</span>
    <span class="mov-v2-av${amount > 0 ? " is-pos" : ""}" aria-hidden="true">${escapeHtml(initial)}</span>
    <span class="mov-v2-main"><strong>${escapeHtml(concept)}</strong><span class="mov-v2-solo-movil">${movV2Tag(partida)}</span></span>
    <span class="mov-v2-cuenta">${escapeHtml(account || "—")}</span>
    <span class="mov-v2-partida">${movV2Tag(partida)}</span>
    <span class="mov-v2-importe${amount > 0 ? " is-pos" : ""}">${escapeHtml(movV2Amount(amount))}</span>
  </button></li>`;
}

function movV2List(filtered) {
  movV2Shown = filtered.slice(0, movV2Limit).map((item) => item.row);
  if (!filtered.length) return `<p class="mov-v2-card mov-v2-vacio-linea">Ningún movimiento con este filtro.</p>`;
  const groups = [];
  filtered.slice(0, movV2Limit).forEach((item, index) => {
    const last = groups.at(-1);
    if (last?.date === item.row.date) last.items.push([item, index]);
    else groups.push({ date: item.row.date, items: [[item, index]] });
  });
  const more = filtered.length > movV2Limit
    ? `<button type="button" class="e19-btn e19-btn-secondary mov-v2-mas" data-mov-v2-mas>Ver ${Math.min(MOV_V2_PAGE, filtered.length - movV2Limit)} más (quedan ${filtered.length - movV2Limit})</button>`
    : "";
  return `<div class="mov-v2-tabla">
    <div class="mov-v2-cabecera mov-v2-solo-ancho" aria-hidden="true"><span>Fecha</span><span>Concepto</span><span>Cuenta</span><span>Partida</span><span>Importe</span></div>
    ${groups.map((group) => `<p class="mov-v2-dia">${escapeHtml(movV2DayLabel(group.date))}</p><ul class="mov-v2-grupo">${group.items.map(([item, index]) => movV2Row(item, index)).join("")}</ul>`).join("")}
  </div>${more}`;
}

function movV2CloseTitle() {
  const info = typeof closeTargetInfo === "function" ? closeTargetInfo() : null;
  const key = info?.monthKey || isoLocalDate(new Date()).slice(0, 7);
  return `Cierre de ${movV2Date(`${key}-15`, { month: "long" })}`;
}

function movV2Cierre() {
  const info = typeof closeTargetInfo === "function" ? closeTargetInfo() : null;
  const current = isoLocalDate(new Date()).slice(0, 7);
  const key = info?.monthKey || current;
  const next = new Date(`${current}-15T12:00:00`);
  next.setMonth(next.getMonth() + 1);
  const meta = key < current ? "Ya se puede cerrar: saldos, movimientos y firma" : `Se abre el 1 de ${movV2Date(isoLocalDate(next), { month: "long" })}`;
  return `<button type="button" class="mov-v2-card mov-v2-fila-bandeja mov-v2-solo-movil" data-mov-v2-nav="cierre">
    <span class="mov-v2-av" aria-hidden="true">${movV2Icon('<path d="M4 6.5h16v14H4zM4 10.5h16M8 3.5v5M16 3.5v5"></path>')}</span>
    <span class="mov-v2-main"><strong>${escapeHtml(movV2CloseTitle())}</strong><span class="mov-v2-meta">${escapeHtml(meta)}</span></span>
    <span aria-hidden="true">›</span>
  </button>`;
}

function movV2DetailButton() {
  const open = qs("movements")?.classList.contains(MOV_V2_DETAIL_CLASS);
  return `<button type="button" class="e19-btn e19-btn-secondary mov-v2-detalle-btn" data-mov-v2-detail aria-expanded="${Boolean(open)}">${open ? "Ocultar el detalle" : "Ver todo el detalle"}</button>`;
}

function movV2Empty() {
  return `<div class="mov-v2-card mov-v2-vacio">
    <span class="mov-v2-av" aria-hidden="true">${movV2Icon('<path d="M4 13.5V19h16v-5.5"></path><path d="M12 15V4M8 8l4-4 4 4"></path>')}</span>
    <h3>Todavía no hay movimientos</h3>
    <p class="mov-v2-meta">Importa el extracto de tu banco (CSV o Excel) y aquí verás qué ha pasado cada día, con su partida. Sin movimientos, el cierre de mes y la previsión trabajan a ciegas.</p>
    <button type="button" class="e19-btn e19-btn-primary" data-mov-v2-nav="datos-importar">Importar extracto</button>
  </div>`;
}

function movV2Pending() {
  const compartir = globalThis.FinanceBuzon?.disponible?.() ? "" : "el extracto por Compartir, ";
  return `<p class="mov-v2-pending"><span class="mov-v2-dot" aria-hidden="true"></span>Aún no llegan solos: ${compartir ? `el extracto por Compartir y ` : ""}los cobros que el extracto confirma.</p>`;
}

// XDA-02 · PR-2: los extractos que han llegado por el Atajo y esperan a importarse (buzon-extractos.js). Arriba del todo,
// porque es lo más fresco que tiene la pantalla; sin nada en el buzón, no ocupa sitio.
function movV2Buzon() {
  const buzon = globalThis.FinanceBuzon;
  return `${buzon?.htmlAviso?.() || ""}${buzon?.htmlPendientes?.() || ""}`;
}

function movV2OpenDetail(index) {
  const row = movV2Shown[Number(index)];
  if (row && typeof openMovementDetailRow === "function") openMovementDetailRow(row);
}

function movV2Navigate(target) {
  if (!document.getElementById(target)?.classList.contains("view-section")) return;
  history.pushState(null, "", `#${target}`);
  setActiveView(target);
}

function movV2BindOnce(root) {
  if (root.dataset.bound) return;
  root.dataset.bound = "1";
  root.addEventListener("click", (event) => {
    // XGO-02: abrir, filtrar, clasificar o ir a otra pantalla es usarla; «Ver todo el detalle» es apartarse de ella.
    if (event.target.closest("[data-mov-v2-nav], [data-mov-v2-clasificar], [data-mov-v2-repaso], [data-mov-v2-filtro], [data-mov-v2-index], [data-home-expected]")) globalThis.FinanceMedidor?.anotar("movimientos-v2", "accion");
    else if (event.target.closest("[data-mov-v2-detail]") && !qs("movements")?.classList.contains(MOV_V2_DETAIL_CLASS)) globalThis.FinanceMedidor?.anotar("movimientos-v2", "descarte");
    const nav = event.target.closest("[data-mov-v2-nav]");
    // XDA-02 · PR-1: «Importar» abre ya el selector de archivos (views/importar-v2.js).
    if (nav?.dataset.movV2Nav === "datos-importar" && typeof globalThis.importarV2Elegir === "function") return globalThis.importarV2Elegir();
    if (nav) return movV2Navigate(nav.dataset.movV2Nav);
    const repaso = event.target.closest("[data-mov-v2-repaso]");
    if (repaso) return globalThis.repasoV2Open?.(repaso); // rediseño B5, views/repaso-v2.js
    const reglaQuitar = event.target.closest("[data-mov-v2-regla-quitar]");
    if (reglaQuitar) return movV2ReglaQuitar(reglaQuitar.dataset.movV2ReglaQuitar);
    const traspasoSi = event.target.closest("[data-mov-v2-traspaso-si]");
    if (traspasoSi) return movV2TraspasoSi(traspasoSi.dataset.movV2TraspasoSi);
    const traspasoNo = event.target.closest("[data-mov-v2-traspaso-no]");
    if (traspasoNo) return movV2TraspasoNo(traspasoNo.dataset.movV2TraspasoNo);
    const clasificar = event.target.closest("[data-mov-v2-clasificar]");
    if (clasificar) return globalThis.clasificarV2Open?.(clasificar); // rediseño A5, views/clasificar-v2.js
    const filtro = event.target.closest("[data-mov-v2-filtro]");
    if (filtro) {
      movV2Filter = filtro.dataset.movV2Filtro;
      movV2Limit = MOV_V2_PAGE;
      movimientosV2Render();
      return;
    }
    const fila = event.target.closest("[data-mov-v2-index]");
    if (fila) return movV2OpenDetail(fila.dataset.movV2Index);
    if (event.target.closest("[data-mov-v2-mas]")) {
      movV2Limit += MOV_V2_PAGE;
      return movimientosV2Render();
    }
    if (event.target.closest("[data-mov-v2-search]")) {
      movV2SearchOpen = !movV2SearchOpen;
      movimientosV2Render();
      if (movV2SearchOpen) qs("movV2Buscar")?.focus();
      return;
    }
    if (event.target.closest("[data-mov-v2-detail]")) {
      const section = qs("movements");
      const open = !section.classList.contains(MOV_V2_DETAIL_CLASS);
      section.classList.toggle(MOV_V2_DETAIL_CLASS, open);
      movimientosV2Render();
      if (open) qs("movements")?.querySelector(".movement-detail-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  root.addEventListener("input", (event) => {
    if (event.target.id !== "movV2Buscar") return;
    movV2Search = event.target.value;
    movV2Limit = MOV_V2_PAGE;
    const list = qs("movimientosV2Filas");
    if (list) list.innerHTML = movV2List(movV2Filtered(movV2AllRows()));
  });
}

function movimientosV2Render() {
  const top = qs("movimientosV2");
  const bottom = qs("movimientosV2Lista");
  if (!top || !bottom) return;
  if (!movV2Active()) {
    top.hidden = bottom.hidden = true;
    top.innerHTML = bottom.innerHTML = "";
    qs("movements")?.classList.remove("mov-v2-vacia");
    return;
  }
  const all = movV2AllRows();
  const esperados = movV2Esperados();
  // Sin movimientos, un solo bloque que lleva a Importar: la tarjeta de anomalías (que solo diría «importa el
  // extracto» otra vez) queda tras «Ver todo el detalle».
  qs("movements")?.classList.toggle("mov-v2-vacia", !all.length);
  movV2BindOnce(top);
  movV2BindOnce(bottom);
  if (!all.length) {
    movV2Shown = [];
    top.innerHTML = `${movV2Header(false)}${movV2Buzon()}${movV2Repaso()}${movV2BandejaSoloEsperados(esperados)}${movV2Empty()}`;
    bottom.innerHTML = movV2DetailButton();
  } else {
    if (movV2Filter !== "todas" && movV2Filter !== "sin-partida" && !all.some((item) => item.account === movV2Filter)) movV2Filter = "todas";
    top.innerHTML = `${movV2Header(true)}${movV2Buzon()}${movV2Repaso()}${movV2Bandeja(all, esperados)}`;
    bottom.innerHTML = `${globalThis.FinanceCobertura?.tiraHtml?.({ titulo: true }) || ""}${movV2Pending()}
      <div class="mov-v2-filtros">
        <input type="search" id="movV2Buscar" class="mov-v2-buscar${movV2SearchOpen || movV2Search ? " is-open" : ""}" placeholder="Buscar concepto, importe o partida" aria-label="Buscar concepto, importe o partida" value="${escapeHtml(movV2Search)}" />
        ${movV2Chips(all)}
      </div>
      <div id="movimientosV2Filas">${movV2List(movV2Filtered(all))}</div>
      ${movV2Cierre()}
      ${movV2DetailButton()}`;
  }
  top.hidden = bottom.hidden = false;
  if (qs("movements")?.hidden === false) globalThis.FinanceMedidor?.anotar("movimientos-v2", "vista"); // XGO-02
}

globalThis.movimientosV2Render = movimientosV2Render;
