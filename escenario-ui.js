/**
 * escenario-ui.js
 *
 * D-N33 (23/11/2026, decisión del hogar): el escenario de supuestos (Base · Prudente · Ahorro alto) sale de la barra lateral, donde solo
 * se veía plegado y no se podía cambiar, a Ajustes › Plan y operación, con un selector como el de Hogar / Persona 1 / Persona 2. Y, como
 * fuera de «Base» cambian TODAS las cifras de la app (ingresos, gastos, ahorro e inflación del motor), la cabecera de todas las pantallas
 * lo dice, con «Volver a Base».
 *
 * Al probarlo se vio que el escenario no cambiaba ninguna cifra: `applyScenario` escribía los valores del escenario y los guardados del
 * hogar los pisaban en el mismo paso, así que era solo un rótulo. Y «arreglarlo» aplicando sus valores habría sobrescrito la política
 * guardada del hogar (y «Base» habría devuelto los valores de ejemplo). Ahora el escenario es una CAPA TEMPORAL (`capa`): app.js la pone
 * encima de vuestros valores al leerlos en cada pintado; los campos del Simulador y lo guardado siguen siendo los vuestros, y «Base»
 * es exactamente lo vuestro. Solo se guarda qué escenario está puesto.
 *
 * Elegirlo aquí es lo mismo que los botones del Simulador (`applyScenario` de app.js), que siguen ahí. El nombre activo es el que
 * app.js escribe en #scenarioName (al cargar, al restaurar y al elegir), así que este script lo lee de ahí y se entera de cualquier
 * cambio con un MutationObserver.
 */
(function exposeEscenarioUi(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceEscenarioUi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createEscenarioUi(root) {
  "use strict";

  const ESCENARIOS = Object.freeze({
    base: { etiqueta: "Base", cambia: "" },
    prudente: { etiqueta: "Prudente", cambia: "ingresos al 95 %, gastos al 112 %, inflación de al menos el 3,5 % y un 35 % menos de ahorro objetivo" },
    ahorro: { etiqueta: "Ahorro alto", cambia: "gastos al 90 %, un 20 % más de ahorro objetivo y colchón de 3 meses" },
  });

  // Los cinco supuestos que toca un escenario. Lo demás (saldos, partidas, deuda…) no lo toca nunca.
  const CAMPOS = Object.freeze(["recommendedSavings", "annualInflation", "emergencyBufferMonths", "incomeFactor", "expenseFactor"]);

  function numero(valor, porDefecto) {
    const n = Number(valor);
    return valor !== null && valor !== "" && Number.isFinite(n) ? n : porDefecto;
  }

  const a50 = (valor) => Math.round(valor / 50) * 50;
  const a4 = (valor) => Math.round(valor * 10000) / 10000;

  /**
   * Los supuestos efectivos: los del hogar con el escenario encima. Pura: no guarda nada.
   * Me aparto de los preajustes de antes en dos cosas: la inflación de «Prudente» no baja de la vuestra si ya es mayor que el 3,5 %, y
   * su ahorro objetivo es el 65 % del vuestro, sin el mínimo fijo de 800 € (que venía de los datos de ejemplo).
   */
  function capa(hogar = {}, clave = "base") {
    const h = {
      recommendedSavings: numero(hogar.recommendedSavings, 0),
      annualInflation: numero(hogar.annualInflation, 0),
      emergencyBufferMonths: numero(hogar.emergencyBufferMonths, 0),
      incomeFactor: numero(hogar.incomeFactor, 1),
      expenseFactor: numero(hogar.expenseFactor, 1),
    };
    if (clave === "prudente") {
      return { ...h, incomeFactor: a4(h.incomeFactor * 0.95), expenseFactor: a4(h.expenseFactor * 1.12), annualInflation: Math.max(h.annualInflation, 3.5), recommendedSavings: a50(h.recommendedSavings * 0.65) };
    }
    if (clave === "ahorro") {
      return { ...h, expenseFactor: a4(h.expenseFactor * 0.9), recommendedSavings: a50(h.recommendedSavings * 1.2), emergencyBufferMonths: 3 };
    }
    return h;
  }

  function claveDe(etiqueta) {
    const texto = String(etiqueta || "").trim();
    const hallada = Object.entries(ESCENARIOS).find(([, e]) => e.etiqueta === texto);
    return hallada ? hallada[0] : "base";
  }

  function avisoTexto(clave) {
    const e = ESCENARIOS[clave];
    if (!e || clave === "base") return "";
    return `Cifras con el escenario «${e.etiqueta}»: ${e.cambia}.`;
  }

  function pintar(doc) {
    const clave = claveDe(doc.getElementById("scenarioName")?.textContent);
    doc.querySelectorAll("[data-escenario-elegir]").forEach((boton) => {
      if (boton.closest("#escenarioAviso")) return;
      boton.setAttribute("aria-pressed", boton.dataset.escenarioElegir === clave ? "true" : "false");
    });
    const aviso = doc.getElementById("escenarioAviso");
    if (!aviso) return;
    const texto = avisoTexto(clave);
    if (!texto) {
      aviso.hidden = true;
      aviso.textContent = "";
      return;
    }
    if (aviso.dataset.clave !== clave || aviso.hidden) {
      aviso.innerHTML = "";
      const span = doc.createElement("span");
      span.textContent = texto;
      const boton = doc.createElement("button");
      boton.type = "button";
      boton.className = "secondary-button";
      boton.dataset.escenarioElegir = "base";
      boton.textContent = "Volver a Base";
      aviso.append(span, " ", boton);
    }
    aviso.dataset.clave = clave;
    aviso.hidden = false;
  }

  function elegir(doc, clave) {
    if (!ESCENARIOS[clave] || typeof root.applyScenario !== "function") return;
    root.applyScenario(clave);
    pintar(doc);
    const nota = doc.getElementById("escenarioNota");
    if (nota) nota.textContent = clave === "base" ? "Escenario Base: vuestros supuestos, tal cual." : `Escenario ${ESCENARIOS[clave].etiqueta}: las cifras de toda la app lo usan; vuestros valores guardados no cambian. La cabecera lo avisa en cada pantalla.`;
  }

  function iniciar(doc = root.document) {
    if (!doc || doc.__escenarioUi) return;
    doc.__escenarioUi = true;
    doc.addEventListener("click", (event) => {
      const boton = event.target?.closest?.("[data-escenario-elegir]");
      if (boton) elegir(doc, boton.dataset.escenarioElegir);
    });
    const nombre = doc.getElementById("scenarioName");
    if (nombre && typeof root.MutationObserver === "function") {
      new root.MutationObserver(() => pintar(doc)).observe(nombre, { childList: true, characterData: true, subtree: true });
    }
    pintar(doc);
  }

  if (root && root.document && typeof module === "undefined") {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", () => iniciar(root.document), { once: true });
    else iniciar(root.document);
  }

  return { ESCENARIOS, CAMPOS, capa, claveDe, avisoTexto, iniciar };
});
