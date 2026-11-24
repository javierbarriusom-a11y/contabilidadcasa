/**
 * revision-trimestral.js
 *
 * D-N38 (23/11/2026, decisión del hogar: «ok») y UND-24/UND-25 (undécima y duodécima auditoría): la primera revisión trimestral, la semana del
 * 14/12. Desde el 22/10 nada se había retirado por lo medido: sin un momento fijo para decidir, medir no cambia nada.
 *
 * Qué se revisa: las pantallas de «Versiones anteriores» (por sus aperturas) y las funciones que mide el medidor (XGO-02: días vistas,
 * acciones y tasa de acción en los últimos tres meses). De cada una, lo medido, una propuesta con su porqué y la decisión del hogar:
 * «se queda», «se funde» o «se retira». La propuesta es solo eso: retirar es redirigir sin borrar código (como en la Ola 1) y se hace
 * después, pantalla a pantalla, con el «sí» del hogar. Los cuatro candidatos de la duodécima (§DUO-03) van marcados.
 *
 * Motor puro: sin DOM, red ni almacenamiento; no retira nada.
 */

(function attachRevisionTrimestral(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceRevisionTrimestral = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function revisionTrimestralFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-revision-trimestral/v1";
  const DECISIONES = Object.freeze(["queda", "funde", "retira"]);
  const DECISION_TEXTO = Object.freeze({ queda: "Se queda", funde: "Se funde", retira: "Se retira" });
  const DIAS_SIN_USO = 30;
  const TASA_BAJA = 20; // % de los días vistos en que además se actuó
  // Los candidatos de la duodécima auditoría (D-N38): el escenario de supuestos si no se usa, el plan de deuda heredado y las funciones
  // de Laboratorio (las que se apagan) sin uso en 30 días. UND-19 nunca se hizo: no hay nada que retirar (se cierra en el backlog).
  const CANDIDATOS = Object.freeze({ "escenario-supuestos": true, "debt-roadmap": true, "debt-liquidation-plan": true });

  function diasEntre(desde, hasta) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(desde || "")) || !/^\d{4}-\d{2}-\d{2}/.test(String(hasta || ""))) return null;
    return Math.round((new Date(`${String(hasta).slice(0, 10)}T12:00:00`) - new Date(`${String(desde).slice(0, 10)}T12:00:00`)) / 86400000);
  }

  function pantalla(p, hoy) {
    const dias = p.last ? diasEntre(p.last, hoy) : null;
    const usada = dias !== null && dias <= DIAS_SIN_USO;
    const medido = p.count ? `${p.count} ${p.count === 1 ? "apertura" : "aperturas"}; la última, hace ${dias} ${dias === 1 ? "día" : "días"}` : "nunca abierta";
    const propuesta = usada ? "queda" : "retira";
    const porque = usada ? `se abrió en los últimos ${DIAS_SIN_USO} días` : p.count ? `sin abrir en ${DIAS_SIN_USO} días` : "nunca se ha abierto";
    return { tipo: "pantalla", id: p.id, nombre: p.title || p.id, medido, propuesta, porque, candidato: Boolean(CANDIDATOS[p.id]) };
  }

  function funcion(f, hoy) {
    const r = f.resumen || {};
    const uso = (r.vistas || 0) + (r.acciones || 0);
    const laboratorio = Boolean(f.laboratorio);
    const partes = [];
    if (r.vistas) partes.push(`vista ${r.vistas} ${r.vistas === 1 ? "día" : "días"}`);
    if (f.conAccion) partes.push(`${r.acciones || 0} ${(r.acciones || 0) === 1 ? "acción" : "acciones"}${r.tasa === null || r.tasa === undefined ? "" : ` (el ${r.tasa} % de los días)`}`);
    if (r.descartes) partes.push(`${r.descartes} ${r.descartes === 1 ? "descarte" : "descartes"}`);
    const medido = uso || r.descartes ? partes.join(" · ") : "sin usar";
    let propuesta = "queda";
    let porque = "se usa";
    if (!uso) {
      propuesta = "retira";
      porque = laboratorio ? `en Laboratorio y sin uso en los últimos ${DIAS_SIN_USO} días` : "sin uso en lo medido";
    } else if (f.conAccion && (r.vistas || 0) >= 3 && r.tasa !== null && r.tasa !== undefined && r.tasa < TASA_BAJA) {
      propuesta = "funde";
      porque = `se ve, pero se actúa menos del ${TASA_BAJA} % de los días: ¿cabe en otra pantalla?`;
    }
    return { tipo: "funcion", id: f.id, nombre: f.nombre, medido, propuesta, porque, candidato: Boolean(CANDIDATOS[f.id] || (laboratorio && !uso)) };
  }

  /**
   * @param {{pantallas?: Array<{id: string, title?: string, count?: number, last?: string|null}>, funciones?: Array<{id: string, nombre: string, resumen: object, conAccion?: boolean, laboratorio?: boolean}>, hoy: string, decisiones?: Record<string, {d: string, f: string}>}} entrada
   */
  function revisar(entrada = {}) {
    const hoy = String(entrada.hoy || "").slice(0, 10);
    const decisiones = entrada.decisiones || {};
    const filas = [
      ...(entrada.pantallas || []).map((p) => pantalla(p, hoy)),
      ...(entrada.funciones || []).map((f) => funcion(f, hoy)),
    ].map((fila) => {
      const d = decisiones[`${fila.tipo}:${fila.id}`];
      return { ...fila, decision: d && DECISIONES.includes(d.d) ? d.d : null, decididoEl: d?.f || null };
    });
    // Primero los candidatos y lo que se propone retirar o fundir: es lo que hay que mirar.
    const peso = (f) => (f.candidato ? 0 : 1) * 10 + ({ retira: 0, funde: 1, queda: 2 }[f.propuesta] ?? 3);
    filas.sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, "es"));
    const decididas = filas.filter((f) => f.decision).length;
    return { schemaId: SCHEMA_ID, hoy, filas, decididas, pendientes: filas.length - decididas };
  }

  /** El acta para copiar: lo decidido, agrupado, y lo que falta. Sin importes ni datos del hogar. */
  function acta(rev) {
    const grupo = (d) => rev.filas.filter((f) => f.decision === d).map((f) => f.nombre);
    const lineas = [`Revisión trimestral · ${rev.hoy}`];
    DECISIONES.forEach((d) => {
      const nombres = grupo(d);
      if (nombres.length) lineas.push(`${DECISION_TEXTO[d]} (${nombres.length}): ${nombres.join("; ")}.`);
    });
    if (rev.pendientes) lineas.push(`Sin decidir: ${rev.pendientes}.`);
    lineas.push("Retirar es redirigir sin borrar código; se hace pantalla a pantalla con vuestro «sí».");
    return lineas.join("\n");
  }

  return { SCHEMA_ID, DECISIONES, DECISION_TEXTO, DIAS_SIN_USO, TASA_BAJA, CANDIDATOS, revisar, acta, diasEntre };
});
