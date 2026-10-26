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

function coberturaAvisoCierreHtml(monthKey, motor = coberturaMotor()) {
  const rangos = coberturaEfectivos();
  if (!motor || !rangos) return "";
  const hoy = isoLocalDate(new Date());
  const cuentas = (globalThis.FinanceCanonicalBalancePulse?.ACCOUNTS || []).map((a) => a.importLabel);
  const lineas = cuentas.map((cuenta) => {
    const m = motor.month(rangos, cuenta, monthKey, hoy);
    if (!m) return null;
    if (m.nothing) return { ok: false, texto: `${cuenta}: ningún extracto de este mes` };
    if (m.complete) return { ok: true, texto: `${cuenta}: mes entero${m.estimado ? " (estimado)" : ""}` };
    const huecos = m.gaps.map((g) => (g.from === g.to ? `el ${coberturaFechaLarga(g.from)}` : `del ${coberturaFechaLarga(g.from)} al ${coberturaFechaLarga(g.to)}`));
    return { ok: false, texto: `${cuenta}: falta ${huecos.join(" y ")}` };
  }).filter(Boolean);
  if (!lineas.length) return "";
  const todo = lineas.every((l) => l.ok);
  return `<div class="cierre-cobertura${todo ? " is-ok" : " is-aviso"}" role="note">
    <p class="e19-kpi-note${todo ? "" : " is-warn"}"><strong>${todo ? "Los extractos cubren el mes entero." : "Los extractos no cubren el mes entero."}</strong> ${todo ? "" : "Puedes firmar igual, pero los reales de los días que faltan no estarán: importa lo que falta antes, si puedes."}</p>
    <ul class="cierre-cobertura-lista">${lineas.map((l) => `<li class="${l.ok ? "is-ok" : "is-aviso"}">${escapeHtml(l.texto)}</li>`).join("")}</ul>
  </div>`;
}

globalThis.FinanceCobertura = {
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
};
