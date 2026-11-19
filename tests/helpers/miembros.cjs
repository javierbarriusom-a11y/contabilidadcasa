// Privacidad, fase 2: lo que el código de la app usa para enseñar a las dos personas del hogar (household-members.js), para
// los contextos de vm de las pruebas que extraen funciones de app.js. Sin nombres configurados: «Persona 1» y «Persona 2».
// `con(nombres)` da los mismos ayudantes con nombres de prueba (siempre inventados). Fase 3: también quién nombra un texto
// (`memberMentioned`, `memberPayroll`, `memberKey`) y el módulo puro, que el motor de fechas busca en `globalThis`.
const Miembros = require("../../household-members.js");

function con(nombres = {}) {
  return {
    memberLabel: (valor) => Miembros.etiqueta(valor, nombres),
    memberTemplate: (texto) => Miembros.plantilla(texto, nombres),
    memberKey: (valor) => Miembros.clave(valor),
    memberMentioned: (texto, persona) => Miembros.nombra(texto, persona, nombres),
    memberPayroll: (texto, persona) => Miembros.nominaDe(texto, persona, nombres),
    memberValue: (obj, persona) => Miembros.valor(obj, persona),
    memberValueSuffix: (obj, persona, sufijo) => Miembros.valorSufijo(obj, persona, sufijo),
    FinanceHouseholdMembers: Miembros,
  };
}

// Fase 5: las pruebas que comprueban que una partida con el nombre de siempre de una persona se reconoce (los datos del hogar
// llevan esos nombres en sus etiquetas) lo toman de aquí, sin escribirlo: en base64, como tests/privacidad-nombres.test.cjs.
const [N1, N2] = ["SmF2aQ==", "VGVyZQ=="].map((b) => Buffer.from(b, "base64").toString("utf8"));
const NOMBRE = Object.freeze({ p1: N1, p2: N2, p1Largo: `${N1}er`, p2Largo: `${N2}sa` });
const CLAVE = Object.freeze({ p1: N1.toLowerCase(), p2: N2.toLowerCase() });

module.exports = { ...con(), con, NOMBRE, CLAVE };
