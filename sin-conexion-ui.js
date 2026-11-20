// DEC-39 · Estado sin conexión explícito (décima auditoría §4.8; 20/11/2026, el hogar: «sigue con todo lo que puedas que no
// depende de nosotros»). La app abre sin red (PWA con service worker) y hasta hoy no lo decía: el chip de la nube seguía en
// «Sincronizado» y «Entrar» o «Sincronizar» fallaban al pulsarlos. Ahora, mientras el navegador dice que no hay conexión:
//
//   · una línea bajo el chip de la nube, en todas las pantallas: «Sin conexión · los datos son los de este dispositivo» y qué
//     pasa con lo que se cambie (se guarda aquí; con la nube, se sube al volver la conexión);
//   · los botones que necesitan la nube (entrar, crear cuenta, reenviar el email, sincronizar, migrar), apagados con su porqué;
//   · al volver la conexión, todo vuelve como estaba y, con la nube, se intenta ya el guardado que esperaba (la cola lo
//     reintenta sola cada 10 s; aquí no se espera al siguiente intento).
//
// No cambia ningún dato ni ninguna cifra. Script de pantalla: se carga antes de app.js y lee del ámbito global, al llamarse,
// `remoteUser` y `ensureRemoteSaveQueue` (app.js); si no existen (pruebas, demo), lo de la nube se omite.
(function attachSinConexion(root) {
  "use strict";

  const BOTONES_NUBE = ["syncLogin", "syncSignup", "syncResend", "syncNow", "migrateLegacyRemote"];
  const MOTIVO = "Necesita conexión a internet";

  function conNube() {
    try {
      // eslint-disable-next-line no-undef
      return typeof remoteUser !== "undefined" && Boolean(remoteUser);
    } catch {
      return false;
    }
  }

  /** La frase de la línea, según haya o no sesión en la nube. */
  function texto(nube) {
    return nube
      ? "Sin conexión · los datos son los de este dispositivo. Lo que cambiéis se guarda aquí y se subirá a la nube al volver la conexión."
      : "Sin conexión · los datos son los de este dispositivo. Lo que cambiéis se guarda aquí.";
  }

  function sinRed(nav) {
    return Boolean(nav) && nav.onLine === false;
  }

  /**
   * Pinta el estado. Solo apaga los botones que estaban encendidos y solo enciende los que apagó él, para no pisar lo que
   * decida app.js (un botón oculto o apagado por otro motivo sigue igual).
   * @param {Document} doc
   * @param {{ onLine?: boolean }} nav
   * @param {boolean} nube
   */
  function pintar(doc = root.document, nav = root.navigator, nube = conNube()) {
    if (!doc) return false;
    const offline = sinRed(nav);
    doc.documentElement?.toggleAttribute?.("data-sin-conexion", offline);
    const aviso = doc.getElementById("conexionAviso");
    if (aviso) {
      aviso.hidden = !offline;
      aviso.textContent = offline ? texto(nube) : "";
    }
    BOTONES_NUBE.forEach((id) => {
      const boton = doc.getElementById(id);
      if (!boton) return;
      if (offline) {
        if (boton.disabled) return;
        boton.disabled = true;
        boton.dataset.sinConexion = "1";
        boton.title = MOTIVO;
      } else if (boton.dataset.sinConexion) {
        boton.disabled = false;
        delete boton.dataset.sinConexion;
        boton.removeAttribute("title");
      }
    });
    return offline;
  }

  function alVolver() {
    pintar();
    if (!conNube()) return;
    try {
      // eslint-disable-next-line no-undef
      if (typeof ensureRemoteSaveQueue === "function") void ensureRemoteSaveQueue().flush();
    } catch {
      // Sin la cola (no debería pasar con sesión): la cola reintenta sola.
    }
  }

  const api = Object.freeze({ BOTONES_NUBE, MOTIVO, texto, pintar });
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  root.FinanceSinConexion = api;
  root.addEventListener?.("offline", () => pintar());
  root.addEventListener?.("online", alVolver);
  if (root.document?.readyState === "loading") root.document.addEventListener("DOMContentLoaded", () => pintar());
  else pintar();
})(typeof globalThis !== "undefined" ? globalThis : this);
