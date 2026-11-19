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
    FinanceHouseholdMembers: Miembros,
  };
}

module.exports = { ...con(), con };
