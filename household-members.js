/**
 * household-members.js · privacidad, fase 2 (19/11/2026, docs/PRIVACIDAD_NOMBRES.md; decisión del hogar D-N25).
 *
 * Los nombres de las dos personas del hogar no se escriben en el código (el repositorio es público): la app los lee de los
 * datos del hogar (`scenarioSettings.householdNames`, que viaja con la copia y la nube) y, hasta que el hogar los escriba en
 * Ajustes › Hogar y cuentas, enseña «Persona 1» y «Persona 2». En el código, las dos personas son «p1» y «p2».
 *
 * Hasta la fase 4 (claves neutras con migración, D-N26) los datos guardados siguen usando sus claves de siempre; `clave()`
 * las reconoce a todas (también con mayúscula, como guardaba el simulador de proyectos) por su huella, sin nombrarlas.
 *
 * Fase 3: `personasEnTexto("Nómina de …")` dice a quién nombra una partida, por la huella de su nombre en los datos de siempre o
 * por el nombre que el hogar escribió en Ajustes. Con eso reconocen la nómina principal y la de la otra persona el motor de
 * fechas, la previsión y el simulador de proyectos, sin un nombre escrito en el código.
 *
 * `etiqueta(clave)` da el nombre; `plantilla("Ingreso de {p1}")` sustituye {p1} y {p2}; `pintar(raiz)` rellena en la página
 * los [data-member] y [data-member-template]. Solo funciones a nivel superior (sin let/const fuera de la fábrica).
 */
(function attachHouseholdMembers(root) {
  "use strict";

  const PERSONAS = ["p1", "p2"];
  const POR_DEFECTO = { p1: "Persona 1", p2: "Persona 2" };
  const MAX_NOMBRE = 30;

  // Fase 3: el texto se compara normalizado (sin acentos, minúsculas, una sola separación) y por su huella (cyrb53, 53 bits):
  // el código guarda la huella de un nombre, no el nombre. No protege frente a quien ya sospecha el nombre y lo prueba, pero sí
  // frente a leerlo o encontrarlo buscando (como la protección de la fase 1).
  function normal(texto) {
    return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function huella(texto) {
    const str = normal(texto);
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i += 1) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  // Cómo aparece cada persona en los datos de siempre: la clave que guardan (fase 4 la cambia por p1/p2) y su nombre en las
  // partidas («Nómina de …»). Solo sus huellas.
  const ALIAS = {
    p1: new Set(["bb8fe2aeb1a36", "c77a6924cddbd"]),
    p2: new Set(["c75820ddcd046", "1d0cc8ac6cd34e"]),
  };
  // La nómina se reconocía solo por la forma corta de cada nombre (la primera de cada lista): se conserva tal cual.
  const ALIAS_NOMINA = { p1: new Set(["bb8fe2aeb1a36"]), p2: new Set(["c75820ddcd046"]) };

  // La persona de una clave cualquiera: «p1», «p2» o la clave antigua de cada una. «hogar»/«household» y lo demás, null.
  function clave(valor) {
    const k = normal(valor);
    if (PERSONAS.includes(k)) return k;
    if (!k || k.length > MAX_NOMBRE) return null;
    const h = huella(k);
    return PERSONAS.find((persona) => ALIAS[persona].has(h)) || null;
  }

  function palabras(texto) {
    return normal(texto).split(/[^a-z0-9]+/).filter(Boolean);
  }

  /**
   * Qué personas nombra un texto (la etiqueta de una partida, el nombre de un proyecto): palabra a palabra, por la huella de
   * cómo aparecen en los datos de siempre o por el nombre que el hogar escribió en Ajustes (su primera palabra, de 2 letras o
   * más). Nunca por un trozo de palabra: «intereses» no nombra a nadie.
   * @returns {string[]} «p1», «p2», las dos o ninguna, en ese orden
   */
  function personasEnTexto(texto, nombres = {}) {
    const vistas = new Set(palabras(texto).map(huella));
    if (!vistas.size) return [];
    return PERSONAS.filter((persona) => {
      if ([...ALIAS[persona]].some((h) => vistas.has(h))) return true;
      const propio = palabras(limpio(nombres?.[persona]))[0];
      return Boolean(propio && propio.length >= 2 && vistas.has(huella(propio)));
    });
  }

  function nombra(texto, persona, nombres = {}) {
    return personasEnTexto(texto, nombres).includes(persona);
  }

  /**
   * ¿Es la nómina (o el salario) de esa persona? La misma regla que tenían el motor de fechas y la previsión: «nómina» o
   * «salario» seguido de su nombre, o su nombre antes de «nómina»/«salario». Con `{ cualquierOrden: true }`, las dos palabras
   * en cualquier sitio (la regla del día 25 del motor de fechas).
   */
  function nominaDe(texto, persona, nombres = {}, { cualquierOrden = false } = {}) {
    const lista = palabras(texto);
    const esNomina = (w) => w === "nomina" || w === "salario";
    const propio = palabras(limpio(nombres?.[persona]))[0];
    const esPersona = (w) => ALIAS_NOMINA[persona].has(huella(w)) || Boolean(propio && propio.length >= 2 && w === propio);
    if (cualquierOrden) return lista.some(esNomina) && lista.some(esPersona);
    return lista.some((w, i) => (esNomina(w) && i + 1 < lista.length && esPersona(lista[i + 1])) || (esPersona(w) && lista.slice(i + 1).some(esNomina)));
  }

  /** ¿Alguna ventana de palabras seguidas del texto (separadas por espacios) tiene una de estas huellas? */
  function contieneHuella(texto, huellas, maxPalabras = 8) {
    const partes = normal(texto).split(" ").filter(Boolean);
    for (let i = 0; i < partes.length; i += 1) {
      for (let n = 1; n <= maxPalabras && i + n <= partes.length; n += 1) {
        if (huellas.has(huella(partes.slice(i, i + n).join(" ")))) return true;
      }
    }
    return false;
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

  // Fase 4 (D-N26): las claves internas pasan a «p1»/«p2». Lo guardado antes lleva la clave de siempre de cada persona; estas
  // ayudas leen las dos formas (la de siempre, por su huella), para que una copia antigua dé las mismas cifras sin escribir aquí
  // las claves. Lo que se escribe a partir de ahora va con «p1»/«p2».
  /** La persona de un valor, o `porDefecto` si no es ninguna de las dos. */
  function persona(valor, porDefecto = null) {
    return clave(valor) || porDefecto;
  }

  /** El valor de una persona en un objeto: `obj.p1`, o el de su clave de siempre. */
  function valor(obj, quien) {
    if (!obj || typeof obj !== "object") return undefined;
    if (obj[quien] !== undefined) return obj[quien];
    const k = Object.keys(obj).find((key) => !PERSONAS.includes(key) && clave(key) === quien);
    return k === undefined ? undefined : obj[k];
  }

  /** Igual, para campos «<persona><Sufijo>» (p. ej. «p1ConfirmedAt» o el de la clave de siempre). */
  function valorSufijo(obj, quien, sufijo) {
    if (!obj || typeof obj !== "object") return undefined;
    if (obj[`${quien}${sufijo}`] !== undefined) return obj[`${quien}${sufijo}`];
    const k = Object.keys(obj).find((key) => key.endsWith(sufijo) && key.length > sufijo.length && clave(key.slice(0, -sufijo.length)) === quien);
    return k === undefined ? undefined : obj[k];
  }

  const api = { PERSONAS, persona, valor, valorSufijo, POR_DEFECTO, MAX_NOMBRE, normal, huella, clave, personasEnTexto, nombra, nominaDe, contieneHuella, etiqueta, plantilla, normalizar };
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
  return k === "household" || k === "hogar" ? "Hogar" : k === "p2" ? "Persona 2" : k === "p1" ? "Persona 1" : String(valor ?? "");
}

// ¿Es la nómina o el salario de la persona?
function memberPayroll(texto, persona) {
  return globalThis.FinanceHouseholdMembers ? globalThis.FinanceHouseholdMembers.nominaDe(texto, persona, householdNames()) : false;
}

// Fase 4: el valor de una persona en un objeto guardado (con «p1»/«p2» o con la clave de siempre).
function memberValue(obj, persona) {
  return globalThis.FinanceHouseholdMembers ? globalThis.FinanceHouseholdMembers.valor(obj, persona) : obj?.[persona];
}

function memberValueSuffix(obj, persona, sufijo) {
  return globalThis.FinanceHouseholdMembers ? globalThis.FinanceHouseholdMembers.valorSufijo(obj, persona, sufijo) : obj?.[`${persona}${sufijo}`];
}

// «p1», «p2» o null para una clave de los datos (la de siempre o la neutra).
function memberKey(valor) {
  return globalThis.FinanceHouseholdMembers ? globalThis.FinanceHouseholdMembers.clave(valor) : null;
}

// ¿Nombra este texto a la persona («p1» o «p2»)? Con los nombres del hogar y los de los datos de siempre.
function memberMentioned(texto, persona) {
  return globalThis.FinanceHouseholdMembers ? globalThis.FinanceHouseholdMembers.nombra(texto, persona, householdNames()) : false;
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
