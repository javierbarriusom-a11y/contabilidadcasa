/**
 * views/copia-aviso.js · DEC-41 (décima auditoría §4.8; 18/11/2026, «sigue con más cosas que puedas avanzar sin el hogar»).
 *
 * La copia de seguridad que avisa. Los datos del hogar viven en el navegador: si Safari borra los datos del sitio (lo hace con
 * las webs que no se abren en un tiempo, o al limpiar el historial), sin una copia o la nube se pierden. La app ya apunta cuándo
 * se descargó la última copia (`scenarioSettings.lastEmergencyBackupAt`, desde RGX1), pero solo lo decía en una pantalla de
 * herramientas avanzadas. Aquí se dice donde se ve: en Ajustes, encima del botón de la copia, y en el «Listo» del repaso.
 *
 *   · con la nube conectada, o sin datos que guardar, no dice nada;
 *   · con una copia de 30 días o menos, tampoco;
 *   · de 31 a 60 días, una línea con «Descargar copia»;
 *   · de más de 60 días, o si no consta ninguna, la misma línea con más énfasis (sin rojo hasta los 60 días, como pedía DEC-41).
 *
 * El botón es la misma copia completa de siempre (`downloadStateBackup`, app.js): no toca ningún dato. La parte pura
 * (`FinanceCopiaAviso.estado`) se prueba en Node; el pintado va aparte. Sin titulares (XGO-01).
 */
(function attachCopiaAviso(root) {
  "use strict";

  const DIAS_AVISO = 30;
  const DIAS_URGENTE = 60;
  const DIA_MS = 24 * 60 * 60 * 1000;

  /**
   * Qué decir de la copia. `ultimaCopia`: la fecha ISO de la última copia descargada (o vacía). `nube`: si hay sesión en la
   * nube. `hayDatos`: si hay algo que perder. `hoy`: la fecha de referencia.
   * @param {{ ultimaCopia?: string, nube?: boolean, hayDatos?: boolean, hoy?: Date }} [input]
   * @returns {{ nivel: "aviso" | "urgente", dias: number | null, texto: string } | null}
   */
  function estado({ ultimaCopia = "", nube = false, hayDatos = false, hoy = new Date() } = {}) {
    if (nube || !hayDatos) return null;
    const cuando = ultimaCopia ? new Date(ultimaCopia).getTime() : NaN;
    if (!Number.isFinite(cuando)) {
      return { nivel: "urgente", dias: null, texto: "No consta ninguna copia descargada desde este navegador. Vuestros datos solo están aquí: si el navegador los borra, se pierden." };
    }
    const dias = Math.max(0, Math.floor((hoy.getTime() - cuando) / DIA_MS));
    if (dias <= DIAS_AVISO) return null;
    const hace = `La última copia descargada es de hace ${dias} días.`;
    return dias > DIAS_URGENTE
      ? { nivel: "urgente", dias, texto: `${hace} Vuestros datos solo están en este navegador: si los borra, se pierde todo lo de después.` }
      : { nivel: "aviso", dias, texto: `${hace} Conviene descargar otra: los datos viven en este navegador.` };
  }

  const api = { DIAS_AVISO, DIAS_URGENTE, estado };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCopiaAviso = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

// La app: el estado con los datos de esta sesión, el pintado y el botón.

function copiaAvisoEstado() {
  const settings = typeof scenarioSettings === "undefined" ? {} : scenarioSettings || {};
  const transacciones = typeof baseData === "undefined" ? [] : baseData?.transactions || [];
  const nube = typeof remoteUser !== "undefined" && Boolean(remoteUser);
  return globalThis.FinanceCopiaAviso?.estado({ ultimaCopia: settings.lastEmergencyBackupAt || "", nube, hayDatos: transacciones.length > 0 }) || null;
}

// La línea, o "" si no hay nada que decir. `donde` solo distingue el medidor (Ajustes o repaso).
function copiaAvisoHtml(donde = "ajustes") {
  const aviso = copiaAvisoEstado();
  if (!aviso) return "";
  globalThis.FinanceMedidor?.anotar("copia-aviso", "vista");
  return `<div class="copia-aviso${aviso.nivel === "urgente" ? " is-urgente" : ""}" role="status" data-copia-aviso="${escapeHtml(donde)}">
    <p>${escapeHtml(aviso.texto)}</p>
    <button type="button" class="e19-btn e19-btn-secondary" data-copia-aviso-descargar>Descargar copia</button>
  </div>`;
}

function copiaAvisoPintarAjustes() {
  const caja = document.getElementById("copiaAvisoAjustes");
  if (caja) caja.innerHTML = copiaAvisoHtml("ajustes");
}

function setupCopiaAviso() {
  if (document.documentElement.dataset.copiaAviso) return;
  document.documentElement.dataset.copiaAviso = "1";
  document.addEventListener("click", (event) => {
    const boton = event.target?.closest?.("[data-copia-aviso-descargar]");
    if (boton) {
      if (typeof downloadStateBackup === "function") downloadStateBackup();
      globalThis.FinanceMedidor?.anotar("copia-aviso", "accion");
      const caja = boton.closest(".copia-aviso");
      if (caja && !copiaAvisoEstado()) caja.outerHTML = '<p class="copia-aviso-hecho" role="status">Copia descargada. Guardadla fuera del móvil (correo, nube, ordenador).</p>';
      copiaAvisoPintarAjustes();
      return;
    }
    // El botón de siempre de Ajustes también cuenta: al descargar, la línea se va.
    if (event.target?.closest?.("#exportStateBackup")) setTimeout(copiaAvisoPintarAjustes, 0);
  });
  window.addEventListener("hashchange", () => {
    if (String(location.hash || "").startsWith("#ajustes")) copiaAvisoPintarAjustes();
  });
  copiaAvisoPintarAjustes();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupCopiaAviso);
  else setupCopiaAviso();
}
