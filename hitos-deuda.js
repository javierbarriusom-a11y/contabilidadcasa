/**
 * hitos-deuda.js
 *
 * DUO-D2 (duodécima auditoría, docs/PROPUESTA_DUODECIMA_AUDITORIA_2026-11-23.md §3.2; recoge UND-16): saldar una deuda tiene su momento y
 * su cierre. Las finanzas conductuales documentan que celebrar los hitos sostiene un plan; y una deuda saldada no está cerrada hasta tener
 * la carta de saldo cero, la baja en los ficheros si la hubo y la comprobación en la CIRBE.
 *
 *  - `registrar`: anota el primer día en que la app ve cada deuda saldada (con su cuota, la que queda libre). La primera vez que corre, las
 *    que ya estaban saldadas se marcan como antiguas: no se celebran deudas cerradas hace tiempo.
 *  - `hitoDeHoy`: la deuda saldada vista por primera vez hoy (un solo día, sin confeti) y lo que pasa con su cuota.
 *  - `cierres`: las deudas saldadas (no antiguas) con sus tres pasos de cierre y si están completos.
 *
 * Motor puro: sin DOM, red ni almacenamiento. No ejecuta ni pide nada a ninguna entidad (A11-4).
 */

(function attachHitosDeuda(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceHitosDeuda = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function hitosDeudaFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-hitos-deuda/v1";
  const PASOS = Object.freeze([
    Object.freeze({ id: "carta", texto: "La carta de deuda saldada (saldo cero)", estados: ["pedida", "recibida"] }),
    Object.freeze({ id: "ficheros", texto: "La baja en los ficheros de morosidad, si os incluyeron", estados: ["hecha", "no-hacia-falta"] }),
    Object.freeze({ id: "cirbe", texto: "Comprobar en la próxima CIRBE que aparece cancelada", estados: ["comprobado"] }),
  ]);
  // Lo que da un paso por terminado (la carta, solo recibida).
  const TERMINA = Object.freeze({ carta: ["recibida"], ficheros: ["hecha", "no-hacia-falta"], cirbe: ["comprobado"] });

  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  function saldada(c) {
    if (!c || c.paymentStatus === "reunified") return false;
    return c.paymentStatus === "settled" || (Number(c.currentPrincipal) <= 0 && Number(c.initialPrincipal) > 0);
  }

  function nombre(c) {
    return [c.entity, c.type].filter(Boolean).join(" · ").trim() || String(c.label || c.id || "la deuda");
  }

  /**
   * @param {Array<object>} contratos todas las filas canónicas (también las saldadas)
   * @param {{iniciado?: string|null, saldadas?: Record<string, object>}|null} estado lo guardado
   * @param {string} hoy «AAAA-MM-DD»
   * @returns {{estado: object, cambiado: boolean}}
   */
  function registrar(contratos, estado, hoy) {
    const previo = estado && typeof estado === "object" ? estado : {};
    const saldadas = { ...(previo.saldadas || {}) };
    const primeraVez = !previo.iniciado;
    let cambiado = primeraVez;
    (Array.isArray(contratos) ? contratos : []).filter(saldada).forEach((c) => {
      const id = String(c.id);
      if (saldadas[id]) return;
      saldadas[id] = { fecha: String(hoy).slice(0, 10), label: nombre(c), cuota: round2(Number(c.contractualPayment ?? c.originalPayment) || 0), antiguo: primeraVez };
      cambiado = true;
    });
    return { estado: { schemaId: SCHEMA_ID, iniciado: previo.iniciado || String(hoy).slice(0, 10), saldadas }, cambiado };
  }

  /**
   * La deuda saldada vista por primera vez hoy, con cuántas quedan activas (para decir a dónde va su cuota).
   * @param {ReturnType<typeof registrar>["estado"]} estado
   * @param {Array<object>} contratos
   * @param {string} hoy
   */
  function hitoDeHoy(estado, contratos, hoy) {
    const dia = String(hoy).slice(0, 10);
    const hoyMismo = Object.entries(estado?.saldadas || {}).filter(([, s]) => !s.antiguo && s.fecha === dia);
    if (!hoyMismo.length) return null;
    const vivos = (Array.isArray(contratos) ? contratos : []).filter((c) => !saldada(c) && c.paymentStatus !== "reunified" && Number(c.currentPrincipal) > 0);
    const [id, s] = hoyMismo[0];
    return { id, label: s.label, cuota: s.cuota, mas: hoyMismo.length - 1, quedan: vivos.length };
  }

  /**
   * @param {ReturnType<typeof registrar>["estado"]} estado
   * @param {Record<string, Record<string, {estado: string, fecha: string}>>} pasos lo marcado por deuda y paso
   * @param {Array<object>} contratos para no listar las que ya no están saldadas
   */
  function cierres(estado, pasos, contratos) {
    const sigue = new Set((Array.isArray(contratos) ? contratos : []).filter(saldada).map((c) => String(c.id)));
    return Object.entries(estado?.saldadas || {})
      .filter(([id, s]) => !s.antiguo && sigue.has(id))
      .map(([id, s]) => {
        const marcados = (pasos && pasos[id]) || {};
        const lista = PASOS.map((p) => {
          const m = marcados[p.id] || null;
          return { id: p.id, texto: p.texto, estados: p.estados, marcado: m, terminado: Boolean(m && TERMINA[p.id].includes(m.estado)) };
        });
        return { id, label: s.label, fecha: s.fecha, cuota: s.cuota, pasos: lista, completo: lista.every((p) => p.terminado) };
      })
      .sort((a, b) => Number(a.completo) - Number(b.completo) || b.fecha.localeCompare(a.fecha));
  }

  return { SCHEMA_ID, PASOS, TERMINA, saldada, registrar, hitoDeHoy, cierres };
});
