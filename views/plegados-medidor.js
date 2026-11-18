/**
 * views/plegados-medidor.js · DEC-40, segunda mitad (décima auditoría §4.8; 18/11/2026, «continúa con lo que puedas hacer sin mí»).
 *
 * Lo plegado también es superficie: la décima auditoría vio que «uno entra, uno sale» se cumplía plegando. El inventario
 * (docs/gobierno/superficie.json, «plegados») cuenta cuántos desplegables se ven por defecto; esto anota, solo en este
 * navegador, cuáles se abren y cuándo, para que «lo plegado que nadie abre en 60 días se proponga para retirar» se decida
 * con datos. No retira nada ni cambia ninguna pantalla.
 *
 * Qué se anota y qué no:
 *   · solo los desplegables que vienen en la página desde el principio (index.html), no los que pintan las pantallas con
 *     datos del hogar: su resumen podría llevar un nombre o un importe;
 *   · la clave es su id o, si no tiene, la pantalla y el texto de su resumen sin cifras;
 *   · por clave, cuántas veces se abrió y el último día. Nada sale del navegador.
 *
 * La parte pura (`FinancePlegados`) se prueba en Node; la línea del informe sale en Ajustes › Uso de la app.
 */
(function attachPlegados(root) {
  "use strict";

  const DIAS = 60;
  const MAX_CLAVES = 400;
  const DIA_MS = 24 * 60 * 60 * 1000;

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  // La clave de un desplegable: su id o «#vista › resumen» sin cifras, sin espacios de más y corto.
  function clave({ id = "", vista = "", resumen = "" } = {}) {
    if (id) return `#${id}`;
    const texto = String(resumen).replace(/[0-9€%.,:]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    return texto ? `${vista ? `#${vista}` : "?"} › ${texto}` : "";
  }

  /** Anota una apertura. Devuelve el almacén nuevo (con su «desde», el primer día anotado). */
  function registrar(store, key, hoy = new Date()) {
    if (!key) return store || {};
    const dia = iso(hoy);
    const aperturas = { ...((store && store.aperturas) || {}) };
    const previa = aperturas[key] || { n: 0, ultima: "" };
    aperturas[key] = { n: previa.n + 1, ultima: dia };
    const claves = Object.keys(aperturas);
    if (claves.length > MAX_CLAVES) {
      claves.sort((a, b) => String(aperturas[a].ultima).localeCompare(String(aperturas[b].ultima))).slice(0, claves.length - MAX_CLAVES).forEach((k) => delete aperturas[k]);
    }
    return { desde: (store && store.desde) || dia, aperturas };
  }

  /**
   * Cuántos de los desplegables de la página se han abierto en los últimos 60 días, y desde cuándo se anota.
   * @param {{ desde?: string, aperturas?: Record<string, { n: number, ultima: string }> }} store
   * @param {string[]} claves las de los desplegables que hay ahora en la página
   */
  function resumen(store, claves, hoy = new Date()) {
    const unicas = [...new Set((claves || []).filter(Boolean))];
    const limite = iso(new Date(hoy.getTime() - DIAS * DIA_MS));
    const aperturas = (store && store.aperturas) || {};
    const abiertos = unicas.filter((k) => String(aperturas[k]?.ultima || "") >= limite).length;
    const desde = (store && store.desde) || "";
    const diasAnotando = desde ? Math.floor((hoy.getTime() - new Date(`${desde}T12:00:00`).getTime()) / DIA_MS) : 0;
    return { total: unicas.length, abiertos, sinAbrir: unicas.length - abiertos, desde, completo: diasAnotando >= DIAS };
  }

  function texto(r) {
    if (!r || !r.total) return "";
    const base = `Desplegables: ${r.abiertos} de ${r.total} abiertos en los últimos ${DIAS} días en este navegador.`;
    if (!r.desde) return `${base} Se empieza a anotar al abrir el primero.`;
    const [y, m, d] = r.desde.split("-");
    return r.completo
      ? `${base} Los ${r.sinAbrir} que nadie ha abierto son candidatos a retirar (se decide con el hogar).`
      : `${base} Se anota desde el ${d}/${m}/${y}: hasta tener ${DIAS} días, no se propone retirar ninguno.`;
  }

  const api = { DIAS, MAX_CLAVES, clave, registrar, resumen, texto };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinancePlegados = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

// La app: marcar los desplegables de la página al cargar, anotar al abrirlos y la línea del informe.

function plegadosLeer() {
  try {
    return JSON.parse(localStorage.getItem("plegados-aperturas") || "{}") || {};
  } catch {
    return {};
  }
}

function plegadosMarcar() {
  const motor = globalThis.FinancePlegados;
  if (!motor) return;
  document.querySelectorAll("details").forEach((details) => {
    if (details.dataset.plegadoClave) return;
    const vista = details.closest(".view-section")?.id || "";
    const resumen = details.querySelector(":scope > summary")?.textContent || "";
    const key = motor.clave({ id: details.id, vista, resumen });
    if (key) details.dataset.plegadoClave = key;
  });
}

function plegadosResumenTexto() {
  const motor = globalThis.FinancePlegados;
  if (!motor) return "";
  const claves = [...document.querySelectorAll("details[data-plegado-clave]")].map((d) => d.dataset.plegadoClave);
  return motor.texto(motor.resumen(plegadosLeer(), claves));
}

function setupPlegadosMedidor() {
  if (document.documentElement.dataset.plegadosMedidor) return;
  document.documentElement.dataset.plegadosMedidor = "1";
  plegadosMarcar(); // solo lo que viene en index.html: lo que se pinta después no lleva clave y no se anota
  // «toggle» no burbujea: se escucha en la fase de captura.
  document.addEventListener("toggle", (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || !details.dataset.plegadoClave) return;
    try {
      localStorage.setItem("plegados-aperturas", JSON.stringify(globalThis.FinancePlegados.registrar(plegadosLeer(), details.dataset.plegadoClave)));
    } catch {
      // Navegación privada o almacenamiento lleno: esta apertura no cuenta.
    }
  }, true);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupPlegadosMedidor);
  else setupPlegadosMedidor();
}
