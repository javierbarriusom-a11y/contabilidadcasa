// XDA-04 · PR-1 (26/10/2026): la cobertura del libro en la app (motor: canonical-ledger-coverage.js).
//
// - Al importar, la revisión de Importar v2 deduce qué periodo cubre el extracto (del primer al último movimiento) y lo
//   pregunta antes de confirmar: si se exportó un periodo más largo (sin movimientos al final o al principio), se cambia.
//   Al confirmar la importación (datosImportarApply, app.js) se guarda en el almacén `ledger-coverage`, que viaja en la
//   copia y en la nube y entra en el lote: «Deshacer» lo devuelve. Sin importes ni conceptos.
// - Lo importado antes de este registro cuenta como «estimado»: por cuenta, del primer al último movimiento de extracto
//   anterior al primer periodo registrado. Se calcula al leer, sin guardarlo: así no depende de cuándo llegan los datos.
// - Lo usan las preguntas de «¿ha llegado…?» (esperados-ui.js: solo preguntan por un cargo si se ha visto entero el
//   periodo en que podía llegar) y el cierre (views/cierre.js: avisa de los huecos del mes, sin bloquear la firma).
// Script clásico con defer, antes de app.js: `baseData` y el resto de app.js se leen al usarse, nunca al cargar.

const COBERTURA_STORE = "ledger-coverage";
const COBERTURA_MANUALES = new Set(["manual-quick-capture"]); // una anotación a mano no demuestra que se vio el día entero

function coberturaMotor() {
  return globalThis.FinanceCanonicalLedgerCoverage;
}

// Cuenta de una fila del libro: la que dijo el extracto o, sin cuenta, la de los extractos sin etiqueta (CaixaBank),
// como el pulso de saldos (canonical-balance-pulse.js).
function coberturaCuentaDe(row) {
  if (row?.account) return String(row.account);
  return (globalThis.FinanceCanonicalBalancePulse?.ACCOUNTS || []).find((a) => a.unlabelledStatements)?.importLabel || "CaixaBank";
}

function coberturaCuentaRecibos() {
  return coberturaCuentaDe({});
}

function coberturaLeer() {
  const motor = coberturaMotor();
  if (!motor) return null;
  let raw = null;
  try {
    raw = JSON.parse(storageGet(storageKey(COBERTURA_STORE), "null"));
  } catch {
    raw = null;
  }
  return motor.normalizeStore(raw);
}

// Lo registrado más lo «estimado»: por cuenta, los movimientos de extracto anteriores a su primer periodo registrado.
function coberturaEfectivos() {
  const motor = coberturaMotor();
  const store = coberturaLeer();
  if (!motor || !store) return null;
  const primero = new Map();
  store.ranges.forEach((r) => { if (!primero.has(r.account) || r.from < primero.get(r.account)) primero.set(r.account, r.from); });
  const filas = (typeof baseData !== "undefined" && baseData ? baseData.transactions || [] : []).filter((row) => {
    if (COBERTURA_MANUALES.has(String(row?.source || ""))) return false;
    const desde = primero.get(coberturaCuentaDe(row));
    return !desde || String(row?.date || "") < desde;
  });
  return [...motor.estimateFromLedger(filas, coberturaCuentaDe), ...store.ranges];
}

function coberturaGuardar(store) {
  storageSet(storageKey(COBERTURA_STORE), JSON.stringify(store));
}

// El almacén tiene que existir ANTES de importar: «Deshacer» restaura la foto de antes del lote, y esa restauración nunca
// borra un almacén que la foto no traía (restoreBackupLocalStores). Sin esto, deshacer la primera importación dejaría
// su periodo registrado sin sus movimientos. Se crea al cargar un fichero para importar (handleDatosImportarFile, app.js),
// nunca al mirar una pantalla: leer no escribe nada.
function coberturaAsegurar() {
  if (typeof storageGet !== "function" || storageGet(storageKey(COBERTURA_STORE), "") !== "") return;
  coberturaGuardar({ version: 1, ranges: [] });
}

function coberturaRangos(cuenta) {
  const rangos = coberturaEfectivos();
  return rangos ? coberturaMotor().merged(rangos, cuenta) : null;
}

// Para esperados-ui.js: los periodos vistos de la cuenta de los recibos. null = sin motor (se usa la fecha de siempre).
function coberturaRangosRecibos() {
  return coberturaRangos(coberturaCuentaRecibos());
}

// ---------- al importar: deducir, preguntar y guardar ----------

function coberturaDeducida(session) {
  return coberturaMotor()?.deduce((session?.rows || []).map((row) => row.transaction)) || null;
}

// El periodo de la sesión: el que dijo el hogar o, si no ha tocado nada, el deducido.
function coberturaSesion(session) {
  const deducida = coberturaDeducida(session);
  if (!deducida) return null;
  const elegido = session.fileMeta?.cobertura;
  return { from: elegido?.from || deducida.from, to: elegido?.to || deducida.to, deducida, cambiada: Boolean(elegido?.from || elegido?.to) };
}

// Un cambio en los campos: el periodo tiene que contener todos los movimientos del fichero y no pasar de hoy.
function coberturaCambiar(session, campo, valor) {
  const actual = coberturaSesion(session);
  if (!actual) return "";
  const hoy = isoLocalDate(new Date());
  const motor = coberturaMotor();
  let aviso = "";
  let from = actual.from;
  let to = actual.to;
  if (campo === "desde") {
    if (!motor.isIso(valor)) aviso = "Fecha no válida: se deja la que había.";
    else if (valor > actual.deducida.from) aviso = `El extracto tiene movimientos desde el ${displayShortDate(actual.deducida.from)}: no puede empezar después.`;
    else from = valor;
  } else {
    if (!motor.isIso(valor)) aviso = "Fecha no válida: se deja la que había.";
    else if (valor < actual.deducida.to) aviso = `El extracto tiene movimientos hasta el ${displayShortDate(actual.deducida.to)}: no puede acabar antes.`;
    else if (valor > hoy) aviso = "No puede acabar después de hoy.";
    else to = valor;
  }
  session.fileMeta.cobertura = { from, to };
  return aviso;
}

let coberturaAviso = "";

function coberturaRevisionHtml(session) {
  const c = coberturaSesion(session);
  if (!c) return "";
  const hoy = isoLocalDate(new Date());
  const aviso = coberturaAviso;
  coberturaAviso = "";
  session.fileMeta.coberturaVista = true; // el hogar tiene delante el periodo antes de confirmar
  return `<fieldset class="imp-v2-cubre">
    <legend class="mov-v2-meta">¿Qué periodo exportaste?</legend>
    <p class="mov-v2-meta">Por sus movimientos, cubre del ${escapeHtml(displayShortDate(c.deducida.from))} al ${escapeHtml(displayShortDate(c.deducida.to))}. Si en el banco elegiste más días, cámbialo: un día sin movimientos no es un día sin mirar.</p>
    <div class="imp-v2-cubre-campos">
      <label><span class="mov-v2-meta">Desde</span><input type="date" id="importarV2CubreDesde" value="${escapeHtml(c.from)}" max="${escapeHtml(c.deducida.from)}" /></label>
      <label><span class="mov-v2-meta">Hasta</span><input type="date" id="importarV2CubreHasta" value="${escapeHtml(c.to)}" min="${escapeHtml(c.deducida.to)}" max="${escapeHtml(hoy)}" /></label>
    </div>
    ${aviso ? `<p class="mov-v2-meta is-warn" role="status">${escapeHtml(aviso)}</p>` : ""}
  </fieldset>`;
}

function coberturaCambioCampo(session, id, valor) {
  coberturaAviso = coberturaCambiar(session, id === "importarV2CubreDesde" ? "desde" : "hasta", valor);
}

// Lo llama datosImportarApply (app.js) antes de tomar la foto del lote: el periodo entra en el lote y «Deshacer» lo quita.
// Con la revisión de Importar v2 delante, es el periodo que el hogar ha visto y confirmado; desde el asistente de siempre,
// el deducido.
function coberturaRegistrar(session, incoming) {
  const motor = coberturaMotor();
  const store = coberturaLeer();
  if (!motor || !store || !(incoming || []).length) return;
  const c = coberturaSesion(session);
  if (!c) return;
  const range = { account: session.fileMeta?.bankAccount || coberturaCuentaRecibos(), from: c.from, to: c.to, source: session.fileMeta?.coberturaVista ? "declarado" : "deducido", recordedAt: new Date().toISOString(), fileName: session.fileMeta?.fileName || "" };
  coberturaGuardar(motor.addRange(store, range));
}

// ---------- en el cierre: los huecos del mes, por cuenta (avisa, no bloquea) ----------

function coberturaFechaLarga(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Cuenta a cuenta, si el extracto cubre el mes: { ok, texto }. La usan el aviso de abajo y el cierre nuevo (views/cierre-v2.js).
function coberturaLineasCierre(monthKey, motor = coberturaMotor()) {
  const rangos = coberturaEfectivos();
  if (!motor || !rangos) return [];
  const hoy = isoLocalDate(new Date());
  const cuentas = (globalThis.FinanceCanonicalBalancePulse?.ACCOUNTS || []).map((a) => a.importLabel);
  return cuentas.map((cuenta) => {
    const m = motor.month(rangos, cuenta, monthKey, hoy);
    if (!m) return null;
    if (m.nothing) return { ok: false, texto: `${cuenta}: ningún extracto de este mes` };
    if (m.complete) return { ok: true, texto: `${cuenta}: mes entero${m.estimado ? " (estimado)" : ""}` };
    const huecos = m.gaps.map((g) => (g.from === g.to ? `el ${coberturaFechaLarga(g.from)}` : `del ${coberturaFechaLarga(g.from)} al ${coberturaFechaLarga(g.to)}`));
    return { ok: false, texto: `${cuenta}: falta ${huecos.join(" y ")}` };
  }).filter(Boolean);
}

function coberturaAvisoCierreHtml(monthKey, motor = coberturaMotor()) {
  const lineas = coberturaLineasCierre(monthKey, motor);
  if (!lineas.length) return "";
  const todo = lineas.every((l) => l.ok);
  return `<div class="cierre-cobertura${todo ? " is-ok" : " is-aviso"}" role="note">
    <p class="e19-kpi-note${todo ? "" : " is-warn"}"><strong>${todo ? "Los extractos cubren el mes entero." : "Los extractos no cubren el mes entero."}</strong> ${todo ? "" : "Puedes firmar igual, pero los reales de los días que faltan no estarán: importa lo que falta antes, si puedes."}</p>
    <ul class="cierre-cobertura-lista">${lineas.map((l) => `<li class="${l.ok ? "is-ok" : "is-aviso"}">${escapeHtml(l.texto)}</li>`).join("")}</ul>
  </div>`;
}

// ---------- XDA-04 · PR-2 (12/11/2026): la tira de 90 días por cuenta ----------
//
// De la referencia (docs/rediseno/referencias/html/Movimientos.html, «Cobertura · últimos 90 días»): por cuenta, una
// barra con lo cubierto (verde), los huecos (rayado rojo) y lo que no tiene dato (gris: antes del primer extracto o
// desde el último). Lo que solo cubre lo importado antes del registro va en verde claro, «estimado». Tocar una cuenta
// con algo por traer dice qué extracto importar («Importa un extracto de CaixaBank que cubra del 4 oct al 12 nov») y lo
// importa en un toque. Sin ningún extracto en ninguna cuenta no se pinta (decisión 4 de docs/rediseno/ESTADO.md):
// Movimientos ya lleva a Importar en ese caso.

const COBERTURA_TIRA_DIAS = 90;

function coberturaFecha(iso, conMes = true) {
  const d = new Date(`${iso}T12:00:00`);
  return conMes ? d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "") : String(d.getDate());
}

// «el 4 oct», «del 4 al 9 oct», «del 28 sep al 3 oct».
function coberturaPeriodo(from, to) {
  if (from === to) return `el ${coberturaFecha(from)}`;
  return `del ${coberturaFecha(from, from.slice(0, 7) !== to.slice(0, 7))} al ${coberturaFecha(to)}`;
}

function coberturaCuentas() {
  return (globalThis.FinanceCanonicalBalancePulse?.ACCOUNTS || []).map((a) => a.importLabel);
}

// Las tiras de cada cuenta, o null si no hay motor o ninguna cuenta tiene un solo extracto.
function coberturaTiras(hoy = isoLocalDate(new Date())) {
  const motor = coberturaMotor();
  const rangos = coberturaEfectivos();
  if (!motor || !rangos) return null;
  const tiras = coberturaCuentas().map((cuenta) => motor.strip(rangos, cuenta, hoy, COBERTURA_TIRA_DIAS)).filter(Boolean);
  return tiras.some((t) => !t.sinExtractos) ? tiras : null;
}

function coberturaEtiqueta(t) {
  if (t.sinExtractos) return "sin extractos";
  if (t.huecos.length === 1) return `hueco ${coberturaPeriodo(t.huecos[0].from, t.huecos[0].to)}`;
  if (t.huecos.length > 1) return `${t.huecos.length} huecos · ${t.diasHueco} días`;
  if (t.pendiente) return `cubierto hasta el ${coberturaFecha(t.ultimo)}`;
  return "al día";
}

function coberturaPista(t) {
  if (t.sinExtractos) return `Importa un extracto de ${t.account}: con el primero, la tira empieza a contar.`;
  const s = t.sugerencia;
  if (!s) return "";
  const que = t.huecos.length && t.pendiente
    ? `cierra ${t.huecos.length === 1 ? "el hueco" : "los huecos"} y trae lo que va desde el último`
    : t.huecos.length ? `cierra ${t.huecos.length === 1 ? "el hueco" : "los huecos"}` : "trae lo que va desde el último";
  return `Importa un extracto de ${t.account} que cubra ${coberturaPeriodo(s.from, s.to)}: ${que}. Al importar, confirma ese periodo en «¿Qué periodo exportaste?».`;
}

function coberturaBarraHtml(t, clase = "cob-tira-barra") {
  const tramos = t.segments.map((s) => `<span class="cob-seg is-${s.kind}${s.estimado ? " is-estimado" : ""}" style="flex:${s.days}"></span>`).join("");
  return `<span class="${clase}" aria-hidden="true">${tramos}</span>`;
}

// Una cuenta. Con algo que traer, la fila se despliega (<details>, sin JS) y dentro va el botón de importar, con el
// atributo que la pantalla ya sabe manejar (`importarAttr`: Movimientos usa data-mov-v2-nav). Con `importarAttr` vacío
// (el repaso, que ya tiene «Importar extracto» en su pie) solo la pista: una acción, un botón.
function coberturaCuentaHtml(t, importarAttr) {
  const cabeza = `<span class="cob-tira-cab"><span class="cob-tira-nombre">${escapeHtml(t.account)}</span><span class="cob-tira-estado">${escapeHtml(coberturaEtiqueta(t))}</span></span>${coberturaBarraHtml(t)}`;
  const pista = coberturaPista(t);
  if (!pista) return `<li class="cob-tira-cuenta" data-cob-cuenta="${escapeHtml(t.account)}"><div class="cob-tira-fila">${cabeza}</div></li>`;
  return `<li class="cob-tira-cuenta${t.huecos.length ? " is-hueco" : ""}" data-cob-cuenta="${escapeHtml(t.account)}"><details class="cob-tira-detalle">
      <summary class="cob-tira-fila">${cabeza}</summary>
      <div class="cob-tira-pista"><p>${escapeHtml(pista)}</p>${importarAttr ? `<button type="button" class="e19-btn e19-btn-secondary" ${importarAttr}>Importar extracto</button>` : ""}</div>
    </details></li>`;
}

function coberturaLeyendaHtml(tiras) {
  const items = [["cubierto", "cubierto"]];
  if (tiras.some((t) => t.estimado)) items.push(["cubierto is-estimado", "estimado"]);
  items.push(["hueco", "hueco"], ["sin-dato", "sin dato"]);
  return `<p class="cob-tira-leyenda" aria-hidden="true">${items.map(([k, l]) => `<span><span class="cob-seg is-${k}"></span>${l}</span>`).join("")}</p>`;
}

// opciones: { titulo: true para el bloque con su cabecera (Movimientos), importarAttr ("" = sin botón), hoy }.
function coberturaTiraHtml(opciones = {}) {
  const tiras = coberturaTiras(opciones.hoy);
  if (!tiras) return "";
  const attr = opciones.importarAttr ?? 'data-mov-v2-nav="datos-importar"';
  const estimado = tiras.some((t) => t.estimado)
    ? `<p class="cob-tira-nota">«Estimado»: importado antes del 26/10, cuando aún no se preguntaba el periodo; se da por visto del primer al último movimiento.</p>`
    : "";
  const cuerpo = `<ul class="cob-tira-lista" aria-label="Cobertura de los últimos ${COBERTURA_TIRA_DIAS} días por cuenta">${tiras.map((t) => coberturaCuentaHtml(t, attr)).join("")}</ul>${coberturaLeyendaHtml(tiras)}${estimado}`;
  if (!opciones.titulo) return `<div class="cob-tira cob-tira-suelta">${cuerpo}</div>`;
  return `<section class="cob-tira" aria-labelledby="cobTiraTitulo">
    <div class="mov-v2-section-head"><h3 id="cobTiraTitulo">Cobertura</h3><span>últimos ${COBERTURA_TIRA_DIAS} días</span></div>
    <div class="mov-v2-card cob-tira-tarjeta">${cuerpo}</div>
  </section>`;
}

// «Cobertura tras importar» en la revisión de Importar (referencia ImportarDesktop.html): qué cierra este extracto y
// hasta cuándo queda cubierta la cuenta, con el periodo que el hogar tiene delante.
function coberturaTrasImportarHtml(session, hoy = isoLocalDate(new Date())) {
  const motor = coberturaMotor();
  const rangos = coberturaEfectivos();
  const c = coberturaSesion(session);
  if (!motor || !rangos || !c) return "";
  const cuenta = session.fileMeta?.bankAccount || coberturaCuentaRecibos();
  const r = motor.afterImport(rangos, { account: cuenta, from: c.from, to: c.to, source: "declarado" }, hoy, COBERTURA_TIRA_DIAS);
  if (!r) return "";
  const frases = [];
  if (r.primero) frases.push(`Es el primer extracto de ${cuenta} que se registra.`);
  if (r.cierra.length) frases.push(`Este extracto cierra ${r.cierra.length === 1 ? `el hueco ${coberturaPeriodo(r.cierra[0].from, r.cierra[0].to)}` : `${r.cierra.length} huecos`}.`);
  if (r.abre.length) frases.push(`Deja sin ver ${r.abre.map((h) => coberturaPeriodo(h.from, h.to)).join(" y ")}: importa también esos días si puedes.`);
  if (r.hasta) frases.push(`${cuenta} queda cubierto hasta el ${coberturaFecha(r.hasta)}${r.quedan ? `, con ${r.quedan === 1 ? "un hueco" : `${r.quedan} huecos`} en los últimos ${COBERTURA_TIRA_DIAS} días` : ""}.`);
  return `<section class="mov-v2-card cob-tras" aria-labelledby="cobTrasTitulo" data-cob-tras>
    <span class="mov-v2-meta cob-tras-titulo" id="cobTrasTitulo">Cobertura tras importar</span>
    ${coberturaBarraHtml(r.after, "cob-tira-barra cob-tras-barra")}
    <p class="mov-v2-meta">${escapeHtml(frases.join(" "))}</p>
  </section>`;
}

// WP-36 y WP-41: lo que no han podido mirar en [desde, hasta] porque falta el extracto de esos días. "" si nada.
function coberturaNoMiradoTexto(desde, hasta) {
  const motor = coberturaMotor();
  const rangos = coberturaEfectivos();
  if (!motor?.unseen || !rangos || !desde || !hasta) return "";
  const faltan = motor.unseen(rangos, coberturaCuentas(), desde, hasta);
  if (!faltan.length) return "";
  const partes = faltan.map((f) => `${f.gaps.map((g) => coberturaPeriodo(g.from, g.to)).join(" y ")} en ${f.account}`);
  return `No he podido mirar ${partes.join(" ni ")}: no hay extracto de esos días.`;
}

// Lo mismo para la ventana de «lo reciente» de WP-36 y WP-41 (los últimos `dias` hasta el último movimiento importado):
// lo que va después de ese movimiento ya lo dicen ellas («Mirado hasta el …»).
function coberturaNoMiradoReciente(hasta, dias, hoy = isoLocalDate(new Date())) {
  const motor = coberturaMotor();
  if (!motor || !hasta) return "";
  return coberturaNoMiradoTexto(motor.addDays(hoy, -dias), hasta < hoy ? hasta : hoy);
}

globalThis.FinanceCobertura = {
  noMiradoReciente: coberturaNoMiradoReciente,
  tiras: coberturaTiras,
  tiraHtml: coberturaTiraHtml,
  trasImportarHtml: coberturaTrasImportarHtml,
  noMiradoTexto: coberturaNoMiradoTexto,
  periodo: coberturaPeriodo,
  STORE: COBERTURA_STORE,
  asegurar: coberturaAsegurar,
  leer: coberturaLeer,
  efectivos: coberturaEfectivos,
  rangos: coberturaRangos,
  rangosRecibos: coberturaRangosRecibos,
  sesion: coberturaSesion,
  revisionHtml: coberturaRevisionHtml,
  cambioCampo: coberturaCambioCampo,
  registrar: coberturaRegistrar,
  avisoCierreHtml: coberturaAvisoCierreHtml,
  lineasCierre: coberturaLineasCierre,
};
