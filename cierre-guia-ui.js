// Guía del cierre de mes (pedida por el hogar el 29/10/2026): en Cierre, plegable, los pasos del cierre con dónde se hace cada uno y
// si bloquea la firma o solo avisa, y qué hacer si algo no cuadra. Las casillas se guardan por mes en este navegador, así que cada mes
// empieza en blanco. No comprueba nada por su cuenta: lo que bloquea lo comprueba «Antes de firmar» (paso de firma de Cierre), y la guía
// lo dice. Del 1 al 3, mientras el mes que acaba no está firmado, sale abierta.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, storageGet, storageSet, storageKey). Sin
// llamadas al DOM al cargarse: views/cierre.js llama a `renderCierreGuia` al pintar Cierre.
//
// Con el cierre nuevo (rediseño C3, views/cierre-v2.js, 4/11/2026) la guía va plegada en una línea («compacta»): las tres
// comprobaciones ya se ven a la vez con su avance, y una segunda barra de progreso competía con la de la confianza del cierre.
// No se abre sola del 1 al 3, y los tres pasos de la pantalla de Cierre se nombran como en el cierre nuevo (`queV2`, `comoV2`).

const CIERRE_GUIA_STORE = "cierre-guia";
const CIERRE_GUIA_MESES = 6; // se guardan las casillas de los últimos seis meses, no más
const CIERRE_GUIA_NOMBRES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// «2026-10» → «octubre» (el nombre entero: ledgerMonthLabel da «oct 26», que no se lee bien en una frase).
function cierreGuiaNombreMes(monthKey) {
  return CIERRE_GUIA_NOMBRES[Number(String(monthKey).slice(5, 7)) - 1] || String(monthKey);
}

// `bloquea`: sin esto no se puede firmar. `avisa`: la firma lo dice, pero deja firmar.
const CIERRE_GUIA_PASOS = Object.freeze([
  { id: "sesion", que: "Entrad y sincronizad", como: "En el menú, Sincronización › Entrar y después Sincronizar.", nivel: "bloquea", nota: "Sin sesión no se puede firmar" },
  { id: "extracto", que: "Importad el extracto hasta el último día de {mes}", como: "De cada cuenta, en Movimientos › Importar. El cierre necesita al menos un movimiento del mes.", nivel: "bloquea", nota: "Bloquea si no hay ninguno", href: "#movements", enlace: "Ir a Movimientos" },
  { id: "clasificar", que: "Clasificad lo que falte", como: "En Movimientos › Clasificar. No puede quedar ningún movimiento del mes sin partida; los de otros meses no bloquean.", nivel: "bloquea", nota: "Bloquea", href: "#movements", enlace: "Ir a Movimientos" },
  { id: "saldos", que: "Declarad el saldo de cada cuenta", como: "En Registrar › «Declara cuánto hay en cada cuenta», con la fecha del último movimiento importado y el modo «Real manual». Con «Auto por fecha» el saldo no cuenta para el acierto de la caja.", nivel: "bloquea", nota: "Si no cuadra, bloquea", href: "#registrar", enlace: "Ir a Registrar" },
  { id: "reales", que: "Anotad los reales que falten", como: "En Registrar › Reales del mes. Lo pagado fuera del banco (efectivo, otra cuenta) se escribe dentro del total de la partida: la app guarda aparte lo que no viene del extracto y no lo pierde al importar. Al firmar, la app dice qué partidas quedan sin real.", nivel: "avisa", nota: "Avisa, no bloquea", href: "#registrar", enlace: "Ir a Registrar" },
  { id: "valorar", que: "Valorad la cartera", como: "En Inversión › Cartera › Actualizar valoración. Unos 5 minutos; «Sin cambios» vale para lo que no se ha movido.", nivel: "avisa", nota: "Avisa, no bloquea", href: "#inversion-cartera", enlace: "Ir a Cartera" },
  { id: "conciliar", que: "Cierre, paso 1: Conciliar cuentas", como: "Saldo declarado frente a saldo calculado. Ninguna cuenta puede quedar en «Descuadra».", nivel: "bloquea", nota: "Bloquea",
    queV2: "Cierre, 1: Saldos a fin de mes", comoV2: "Saldo declarado frente al del extracto, cuenta a cuenta. Ninguna puede quedar sin cuadrar; «Corregir el saldo» lleva a declararlo." },
  { id: "diferencias", que: "Cierre, paso 2: Resolver diferencias", como: "Tareas agrupadas por causa. Cada una se cierra cuando el dato cuadra, no al pulsarla.", nivel: "bloquea", nota: "Bloquea",
    queV2: "Cierre, 2: Movimientos completos", comoV2: "El extracto del mes entero, sin movimientos sin partida ni otras diferencias: «Importar extracto», «Clasificar», «Dejar en Por clasificar» o «Ver la diferencia», según lo que falte." },
  { id: "firmar", que: "Cierre, último paso: Firmar y archivar", como: "Con «Antes de firmar» en verde, Firmar cierre. El motivo propuesto, «Mes conciliado y revisado», sirve.", nivel: "avisa", nota: "El final",
    queV2: "Cierre: Firmar el cierre de {mes}", comoV2: "A la derecha de las comprobaciones. Si falta algo, el botón dice qué y lleva a ello. El motivo propuesto, «Mes conciliado y revisado», sirve." },
]);

const CIERRE_GUIA_ATASCOS = Object.freeze([
  ["Una cuenta en «Descuadra»", "El saldo declarado es de otra fecha que el último movimiento importado, o falta un trozo del extracto.", "Declarad el saldo a la fecha del último movimiento importado, o importad lo que falta."],
  ["Una cuenta «Sin conciliar»", "No hay extracto de esa cuenta con el que comparar.", "No bloquea, pero esa cuenta no se ha comprobado. Si tiene movimientos, importad su extracto."],
  ["«Extracto incorporado · 0 movimientos»", "No hay movimientos del mes en la app.", "Importad el extracto del mes (paso 2)."],
  ["«Inicia sesión y sincroniza una versión antes de firmar»", "La sesión ha caducado o no se ha sincronizado nada desde que entrasteis.", "Entrad y sincronizad (paso 1)."],
  ["«Recalculados (todavía sin recalcular)»", "La app no ha terminado de calcular al abrirse.", "Recargad la app y volved a Cierre."],
  ["Habéis firmado con algo mal", "Pasa.", "«Reabrir mes», en esta misma pantalla. Pide un motivo y queda en el historial."],
]);

function cierreGuiaLoad() {
  try {
    const parsed = JSON.parse(storageGet(storageKey(CIERRE_GUIA_STORE), "null"));
    return parsed && typeof parsed === "object" && parsed.meses && typeof parsed.meses === "object" ? parsed : { meses: {} };
  } catch {
    return { meses: {} };
  }
}

function cierreGuiaSave(store) {
  const meses = Object.keys(store.meses).sort().slice(-CIERRE_GUIA_MESES);
  storageSet(storageKey(CIERRE_GUIA_STORE), JSON.stringify({ meses: Object.fromEntries(meses.map((key) => [key, store.meses[key]])) }));
}

function cierreGuiaHechos(store, monthKey) {
  const marcados = store.meses[monthKey] || {};
  return CIERRE_GUIA_PASOS.filter((paso) => marcados[paso.id] === true).length;
}

// La barra de la tarjeta plegada: cuánto del cierre lleva marcado este mes.
function cierreGuiaPintarAvance(hechos, compacta = false) {
  const barra = qs("cierreGuiaBarra");
  if (barra) barra.style.width = `${Math.round((hechos / CIERRE_GUIA_PASOS.length) * 100)}%`;
  qs("cierreGuiaResumen").textContent = compacta ? cierreGuiaResumenCompacto(hechos) : cierreGuiaResumen(hechos);
}

function cierreGuiaResumen(hechos) {
  return hechos === CIERRE_GUIA_PASOS.length ? "Todos los pasos hechos" : `${hechos} de ${CIERRE_GUIA_PASOS.length} pasos hechos`;
}

// En una línea, junto al cierre nuevo: qué hay dentro, y lo marcado solo si se ha marcado algo (sin otra barra de avance).
function cierreGuiaResumenCompacto(hechos) {
  const base = `${CIERRE_GUIA_PASOS.length} pasos, dónde se hace cada uno y qué hacer si algo no cuadra`;
  return hechos ? `${base} · ${hechos} ${hechos === 1 ? "marcado" : "marcados"}` : base;
}

function cierreGuiaHtml(monthKey, store, compacta = false) {
  const marcados = store.meses[monthKey] || {};
  const mes = cierreGuiaNombreMes(monthKey);
  const pasos = CIERRE_GUIA_PASOS.map((paso) => {
    const id = `cierreGuia-${paso.id}`;
    const que = compacta && paso.queV2 ? paso.queV2 : paso.que;
    const como = compacta && paso.comoV2 ? paso.comoV2 : paso.como;
    const enlace = paso.href ? ` <a class="cierre-guia-enlace" href="${paso.href}" data-cierre-guia-ir>${escapeHtml(paso.enlace)}</a>` : "";
    return `<li class="cierre-guia-paso${marcados[paso.id] ? " is-hecho" : ""}">
      <input type="checkbox" id="${id}" data-cierre-guia-paso="${paso.id}"${marcados[paso.id] ? " checked" : ""}>
      <label for="${id}"><strong>${escapeHtml(que.replace("{mes}", mes))}</strong><span class="e19-kpi-note">${escapeHtml(como)}</span><span class="cierre-guia-nivel is-${paso.nivel}">${escapeHtml(paso.nota)}</span></label>${enlace}
    </li>`;
  }).join("");
  const atascos = CIERRE_GUIA_ATASCOS.map(([veis, suele, hacer]) => `<tr><td>${escapeHtml(veis)}</td><td>${escapeHtml(suele)}</td><td>${escapeHtml(hacer)}</td></tr>`).join("");
  return `<p class="e19-kpi-note">Unos 15 minutos. Si importáis y clasificáis antes del día 1, el día del cierre se queda en 10. Lo que bloquea la firma lo comprueba la app sola en «Antes de firmar»; estas casillas son para no perderse, solo se guardan en este dispositivo y cada mes empiezan en blanco.</p>
    <ol class="cierre-guia-pasos">${pasos}</ol>
    <details class="cierre-guia-atascos"><summary>Si algo no cuadra</summary>
      <div class="table-wrap"><table class="e19-table"><thead><tr><th scope="col">Lo que veis</th><th scope="col">Suele ser</th><th scope="col">Qué hacer</th></tr></thead><tbody>${atascos}</tbody></table></div>
    </details>`;
}

/**
 * @param {string} monthKey El mes que se cierra (closeTargetInfo).
 * @param {{signed?: boolean, today?: string, compacta?: boolean}} [options] Firmado o no; del 1 al 3 sin firmar, la guía sale
 *   abierta, salvo `compacta` (con el cierre nuevo): entonces va plegada en una línea y no se abre sola.
 */
function renderCierreGuia(monthKey, { signed = false, today = "", compacta = false } = {}) {
  const card = qs("cierreGuia");
  if (!card || !/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return;
  attachCierreGuia(card);
  const store = cierreGuiaLoad();
  card.dataset.monthKey = monthKey;
  if (compacta) card.dataset.compacta = "1";
  else delete card.dataset.compacta;
  cierreGuiaPintarAvance(cierreGuiaHechos(store, monthKey), compacta);
  // Compacta, sin el mes: lo dice el título de la pantalla («Cerrar octubre») y así cabe en una línea a 390 px.
  qs("cierreGuiaMes").textContent = compacta ? "Guía completa del cierre" : `Guía del cierre de ${cierreGuiaNombreMes(monthKey)}`;
  qs("cierreGuiaCuerpo").innerHTML = cierreGuiaHtml(monthKey, store, compacta);
  // Del 1 al 3 con el mes sin firmar, abierta: es cuando se usa. El resto del mes, plegada (no pesa en la pantalla).
  const dia = Number(String(today).slice(8, 10));
  if (!compacta && !card.dataset.abiertaPorFecha && !signed && dia >= 1 && dia <= 3) {
    card.open = true;
    card.dataset.abiertaPorFecha = "1";
  }
  card.hidden = false;
}

function attachCierreGuia(card) {
  if (card.__cierreGuiaAttached) return;
  card.__cierreGuiaAttached = true;
  card.addEventListener("toggle", () => {
    if (card.open) globalThis.FinanceMedidor?.anotar("cierre-guia", "vista"); // XGO-02: un día visto cuenta una vez
  });
  card.addEventListener("change", (event) => {
    const box = event.target.closest("[data-cierre-guia-paso]");
    if (!box) return;
    const monthKey = card.dataset.monthKey;
    const store = cierreGuiaLoad();
    store.meses[monthKey] = { ...(store.meses[monthKey] || {}), [box.dataset.cierreGuiaPaso]: box.checked };
    cierreGuiaSave(store);
    box.closest(".cierre-guia-paso")?.classList.toggle("is-hecho", box.checked);
    cierreGuiaPintarAvance(cierreGuiaHechos(store, monthKey), card.dataset.compacta === "1");
    if (box.checked) globalThis.FinanceMedidor?.anotar("cierre-guia", "accion"); // XGO-02: un paso marcado
  });
}
