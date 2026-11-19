/**
 * household-members.js · privacidad, fase 2 (19/11/2026, docs/PRIVACIDAD_NOMBRES.md; decisión del hogar D-N25).
 *
 * Los nombres de las dos personas del hogar no se escriben en el código (el repositorio es público): la app los lee de los
 * datos del hogar (`scenarioSettings.householdNames`, que viaja con la copia y la nube) y, hasta que el hogar los escriba en
 * Ajustes › Hogar y cuentas, enseña «Persona 1» y «Persona 2». En el código, las dos personas son «p1» y «p2».
 *
 * Hasta la fase 4 (claves neutras con migración, D-N26) los datos guardados siguen usando sus claves de siempre; `clave()`
 * las reconoce a todas (también con mayúscula, como guardaba el simulador de proyectos) sin que el código tenga que nombrarlas.
 *
 * `etiqueta(clave)` da el nombre; `plantilla("Ingreso de {p1}")` sustituye {p1} y {p2}; `pintar(raiz)` rellena en la página
 * los [data-member] y [data-member-template]. Solo funciones a nivel superior (sin let/const fuera de la fábrica).
 */
(function attachHouseholdMembers(root) {
  "use strict";

  const PERSONAS = ["p1", "p2"];
  const POR_DEFECTO = { p1: "Persona 1", p2: "Persona 2" };
  const MAX_NOMBRE = 30;
  // Las claves que guardan hoy los datos (fase 4 las cambia por p1/p2). Van por su huella de longitud y primera letra para no
  // escribir aquí los nombres: la primera persona tiene una clave de 4 letras que empieza por «j»; la segunda, de 4 por «t».
  const LEGADO = [
    { persona: "p1", es: (k) => k.length === 4 && k[0] === "j" },
    { persona: "p2", es: (k) => k.length === 4 && k[0] === "t" },
  ];

  // La persona de una clave cualquiera: «p1», «p2» o la clave antigua de cada una. «hogar»/«household» y lo demás, null.
  function clave(valor) {
    const k = String(valor ?? "").trim().toLowerCase();
    if (PERSONAS.includes(k)) return k;
    return LEGADO.find((item) => item.es(k))?.persona || null;
  }

  function limpio(nombre) {
    return String(nombre ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NOMBRE);
  }

  /** El nombre que se enseña. `nombres`: { p1, p2 } escritos por el hogar. «Hogar» para el hogar. */
  function etiqueta(valor, nombres = {}) {
    const k = String(valor ?? "").trim().toLowerCase();
    if (k === "household" || k === "hogar") return "Hogar";
    const persona = clave(valor);
    if (!persona) return String(valor ?? "");
    return limpio(nombres?.[persona]) || POR_DEFECTO[persona];
  }

  function plantilla(texto, nombres = {}) {
    return String(texto ?? "").replace(/\{(p1|p2)\}/g, (_, persona) => etiqueta(persona, nombres));
  }

  // Lo que se guarda: dos nombres cortos, sin marcas; vacío vuelve al de por defecto.
  function normalizar(entrada = {}) {
    return { p1: limpio(entrada.p1), p2: limpio(entrada.p2) };
  }

  const api = { PERSONAS, POR_DEFECTO, MAX_NOMBRE, clave, etiqueta, plantilla, normalizar };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceHouseholdMembers = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

// La app: los nombres del hogar, guardados en sus datos.

function householdNames() {
  const settings = typeof scenarioSettings === "undefined" ? null : scenarioSettings;
  return (settings && settings.householdNames) || {};
}

// El nombre que se enseña para «p1», «p2» o una clave de los datos. Sin el módulo (pruebas aisladas), lo de por defecto.
function memberLabel(valor) {
  const motor = globalThis.FinanceHouseholdMembers;
  if (motor) return motor.etiqueta(valor, householdNames());
  const k = String(valor ?? "").toLowerCase();
  return k === "household" || k === "hogar" ? "Hogar" : k === "p2" || (k.length === 4 && k[0] === "t") ? "Persona 2" : "Persona 1";
}

function memberTemplate(texto) {
  return globalThis.FinanceHouseholdMembers ? globalThis.FinanceHouseholdMembers.plantilla(texto, householdNames()) : String(texto ?? "");
}

// Rellena lo que la página trae escrito con «Persona 1/2»: [data-member="p1"] y [data-member-template="… {p1} …"].
function paintMemberLabels(rootNode = document) {
  rootNode.querySelectorAll?.("[data-member]").forEach((el) => {
    el.textContent = memberLabel(el.dataset.member);
  });
  rootNode.querySelectorAll?.("[data-member-template]").forEach((el) => {
    el.textContent = memberTemplate(el.dataset.memberTemplate);
  });
  const p1 = document.getElementById("householdNameP1");
  const p2 = document.getElementById("householdNameP2");
  const nombres = householdNames();
  if (p1 && document.activeElement !== p1) p1.value = nombres.p1 || "";
  if (p2 && document.activeElement !== p2) p2.value = nombres.p2 || "";
}

function saveHouseholdNames(event) {
  event?.preventDefault?.();
  const motor = globalThis.FinanceHouseholdMembers;
  if (!motor || typeof scenarioSettings === "undefined") return;
  const next = motor.normalizar({ p1: document.getElementById("householdNameP1")?.value, p2: document.getElementById("householdNameP2")?.value });
  scenarioSettings.householdNames = next;
  if (typeof saveScenarioSettings === "function") saveScenarioSettings();
  if (typeof queueRemoteSave === "function") queueRemoteSave();
  paintMemberLabels();
  if (typeof render === "function") render();
  const estado = document.getElementById("householdNamesEstado");
  if (estado) estado.textContent = `Guardado: ${motor.etiqueta("p1", next)} y ${motor.etiqueta("p2", next)}. Solo en vuestros datos, nunca en el código.`;
}

function setupHouseholdMembers() {
  if (document.documentElement.dataset.householdMembers) return;
  document.documentElement.dataset.householdMembers = "1";
  document.getElementById("householdNamesForm")?.addEventListener("submit", saveHouseholdNames);
  paintMemberLabels();
  window.addEventListener("hashchange", () => paintMemberLabels());
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupHouseholdMembers);
  else setupHouseholdMembers();
}
