// Guía del cierre de mes (pedida por el hogar el 29/10/2026): en Cierre, plegable, los pasos del cierre con dónde se hace cada uno y
// si bloquea la firma o solo avisa, y qué hacer si algo no cuadra. Las casillas se guardan por mes en este navegador, así que cada mes
// empieza en blanco. No comprueba nada por su cuenta: lo que bloquea lo comprueba «Antes de firmar» (paso de firma de Cierre), y la guía
// lo dice. Del 1 al 3, mientras el mes que acaba no está firmado, sale abierta.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, storageGet, storageSet, storageKey). Sin
// llamadas al DOM al cargarse: views/cierre.js llama a `renderCierreGuia` al pintar Cierre.

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
  { id: "reales", que: "Anotad los reales que falten", como: "En Registrar › Reales del mes. Al firmar, la app dice qué partidas quedan sin real.", nivel: "avisa", nota: "Avisa, no bloquea", href: "#registrar", enlace: "Ir a Registrar" },
  { id: "valorar", que: "Valorad la cartera", como: "En Inversión › Cartera › Actualizar valoración. Unos 5 minutos; «Sin cambios» vale para lo que no se ha movido.", nivel: "avisa", nota: "Avisa, no bloquea", href: "#inversion-cartera", enlace: "Ir a Cartera" },
  { id: "conciliar", que: "Cierre, paso 1: Conciliar cuentas", como: "Saldo declarado frente a saldo calculado. Ninguna cuenta puede quedar en «Descuadra».", nivel: "bloquea", nota: "Bloquea" },
  { id: "diferencias", que: "Cierre, paso 2: Resolver diferencias", como: "Tareas agrupadas por causa. Cada una se cierra cuando el dato cuadra, no al pulsarla.", nivel: "bloquea", nota: "Bloquea" },
  { id: "firmar", que: "Cierre, último paso: Firmar y archivar", como: "Con «Antes de firmar» en verde, Firmar cierre. El motivo propuesto, «Mes conciliado y revisado», sirve.", nivel: "avisa", nota: "El final" },
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

function cierreGuiaResumen(hechos) {
  return hechos === CIERRE_GUIA_PASOS.length ? "Todos los pasos hechos" : `${hechos} de ${CIERRE_GUIA_PASOS.length} pasos hechos`;
}

function cierreGuiaHtml(monthKey, store) {
  const marcados = store.meses[monthKey] || {};
  const mes = cierreGuiaNombreMes(monthKey);
  const pasos = CIERRE_GUIA_PASOS.map((paso) => {
    const id = `cierreGuia-${paso.id}`;
    const enlace = paso.href ? ` <a class="cierre-guia-enlace" href="${paso.href}" data-cierre-guia-ir>${escapeHtml(paso.enlace)}</a>` : "";
    return `<li class="cierre-guia-paso${marcados[paso.id] ? " is-hecho" : ""}">
      <input type="checkbox" id="${id}" data-cierre-guia-paso="${paso.id}"${marcados[paso.id] ? " checked" : ""}>
      <label for="${id}"><strong>${escapeHtml(paso.que.replace("{mes}", mes))}</strong><span class="e19-kpi-note">${escapeHtml(paso.como)}</span><span class="cierre-guia-nivel is-${paso.nivel}">${escapeHtml(paso.nota)}</span></label>${enlace}
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
 * @param {{signed?: boolean, today?: string}} [options] Firmado o no; del 1 al 3 sin firmar, la guía sale abierta.
 */
function renderCierreGuia(monthKey, { signed = false, today = "" } = {}) {
  const card = qs("cierreGuia");
  if (!card || !/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return;
  attachCierreGuia(card);
  const store = cierreGuiaLoad();
  card.dataset.monthKey = monthKey;
  qs("cierreGuiaResumen").textContent = cierreGuiaResumen(cierreGuiaHechos(store, monthKey));
  qs("cierreGuiaMes").textContent = `Guía del cierre de ${cierreGuiaNombreMes(monthKey)}`;
  qs("cierreGuiaCuerpo").innerHTML = cierreGuiaHtml(monthKey, store);
  // Del 1 al 3 con el mes sin firmar, abierta: es cuando se usa. El resto del mes, plegada (no pesa en la pantalla).
  const dia = Number(String(today).slice(8, 10));
  if (!card.dataset.abiertaPorFecha && !signed && dia >= 1 && dia <= 3) {
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
    qs("cierreGuiaResumen").textContent = cierreGuiaResumen(cierreGuiaHechos(store, monthKey));
    if (box.checked) globalThis.FinanceMedidor?.anotar("cierre-guia", "accion"); // XGO-02: un paso marcado
  });
}
