(function attachCanonicalMonthMap(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalMonthMap = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalMonthMapFactory() {
  "use strict";

  // CON-01 (Propuesta final §10; D-N55, decidida por el hogar el 27/11/2026, F1): el mapa de meses y extractos de Cierre. Una tabla
  // cuentas × meses con el estado de cada casilla y la siguiente acción que toca, para ver ANTES de intentarlo qué extracto falta en
  // qué cuenta y qué mes se puede firmar. Junta lo que ya existe: la cobertura del libro por cuenta y mes (XDA-04,
  // canonical-ledger-coverage.js `month`) y los meses firmados (el cierre de siempre). Motor puro: ni DOM, ni red, ni almacenamiento,
  // ni reloj (hoy entra como dato).
  //
  // Estados de una casilla (cuenta × mes), con palabra además de color (WCAG 1.4.1):
  //   · «firmado»:      el mes está firmado. Nada que hacer.
  //   · «completo»:     el extracto cubre el mes entero (o hasta hoy, en el mes en curso).
  //   · «parcial»:      hay extracto, pero con huecos; dice hasta qué día llega lo visto.
  //   · «sin-extracto»: ningún extracto de esa cuenta toca ese mes.
  // «Cuadra» (saldo anterior + movimientos = saldo de cierre) queda para después: necesita conciliar saldos por cuenta y mes.
  //
  // La acción de cada casilla es la siguiente que toca: «importar» (sin extracto o parcial) o ninguna. La de cada mes (columna),
  // «firmar» si es un mes pasado sin firmar; con «faltan» = cuántas cuentas no lo tienen completo, porque CIE-01 deja firmar con
  // saldos a mano. El mes en curso no se firma todavía.
  //
  // Sin cuentas o sin ningún extracto en toda la ventana, `vacio` y la pantalla lo pliega a una línea (decisión 4 de ESTADO §3).

  const MESES_MOVIL = 6;
  const MESES_ESCRITORIO = 12;
  const ESTADOS = Object.freeze(["firmado", "completo", "parcial", "sin-extracto"]);

  const isMonth = (value) => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

  function mesAnterior(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  }

  /** Los `n` meses que acaban en el de `hoy` (incluido), del más antiguo al más reciente. */
  function ventana(hoy, n) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(hoy || "")) || !(n > 0)) return [];
    const out = [hoy.slice(0, 7)];
    while (out.length < n) out.unshift(mesAnterior(out[0]));
    return out;
  }

  function diaDe(iso) {
    return Number(String(iso || "").slice(8, 10)) || null;
  }

  function casilla(cobertura, firmado) {
    if (firmado) return { estado: "firmado", accion: null };
    if (!cobertura || cobertura.nothing) return { estado: "sin-extracto", accion: "importar" };
    if (cobertura.complete) return { estado: "completo", accion: null };
    // Parcial: hasta dónde llega lo visto de forma continua desde el día 1 (el primer hueco); si el hueco empieza el día 1, no llega a nada.
    const primerHueco = (cobertura.gaps || [])[0];
    const hasta = primerHueco && primerHueco.from > cobertura.from ? diaDe(primerHueco.from) - 1 : null;
    return { estado: "parcial", hasta, accion: "importar" };
  }

  /**
   * @param {{cuentas?: Array<{id: string, nombre?: string}>, meses?: string[], hoy?: string,
   *   cobertura?: (cuenta: string, mes: string) => any, firmados?: string[]}} entrada
   *   `cobertura(cuenta, mes)` devuelve lo de canonical-ledger-coverage.js `month(...)` para esa cuenta y ese mes.
   */
  function construir({ cuentas = [], meses = [], hoy = "", cobertura = () => null, firmados = [] } = {}) {
    const mesesOk = meses.filter(isMonth);
    const mesActual = /^\d{4}-\d{2}/.test(String(hoy)) ? String(hoy).slice(0, 7) : "";
    const firmadosSet = new Set(firmados.filter(isMonth));
    const filas = cuentas
      .filter((c) => c && String(c.id || "").trim())
      .map((c) => ({
        id: c.id,
        nombre: String(c.nombre || c.id),
        casillas: mesesOk.map((mes) => ({ mes, ...casilla(mes <= mesActual ? cobertura(c.id, mes) : null, firmadosSet.has(mes)) })),
      }));
    const columnas = mesesOk.map((mes, i) => {
      const firmado = firmadosSet.has(mes);
      const faltan = filas.filter((f) => !["completo", "firmado"].includes(f.casillas[i].estado)).length;
      const pasado = mesActual && mes < mesActual;
      return { mes, firmado, faltan, accion: pasado && !firmado ? "firmar" : null };
    });
    const conExtracto = filas.some((f) => f.casillas.some((c) => c.estado !== "sin-extracto"));
    const sinFirmar = columnas.filter((c) => c.accion === "firmar").map((c) => c.mes);
    return {
      meses: mesesOk, filas, columnas, sinFirmar,
      vacio: !filas.length || !conExtracto,
      // El primer paso que toca: el mes sin firmar más antiguo; dentro de él, la primera cuenta a la que le falta extracto.
      siguiente: (() => {
        const mes = sinFirmar[0];
        if (!mes) return null;
        const i = mesesOk.indexOf(mes);
        const fila = filas.find((f) => f.casillas[i].accion === "importar");
        return fila ? { accion: "importar", mes, cuenta: fila.id } : { accion: "firmar", mes };
      })(),
    };
  }

  /** La palabra de una casilla (lo que se lee además del color). */
  function texto(c) {
    if (!c) return "";
    if (c.estado === "firmado") return "Firmado";
    if (c.estado === "completo") return "Completo";
    if (c.estado === "parcial") return c.hasta ? `Parcial (hasta el ${c.hasta})` : "Parcial";
    return "Sin extracto";
  }

  return { MESES_MOVIL, MESES_ESCRITORIO, ESTADOS, ventana, construir, texto };
});
