/**
 * salud-motor.js
 *
 * DUO-04 (duodécima auditoría, docs/PROPUESTA_DUODECIMA_AUDITORIA_2026-11-23.md; recoge UND-03 y UND-22): «salud del motor y datos
 * viejos en un solo sitio». Hoy, saber si la previsión diaria tiene filas, cuándo se calculó o si una invariante falló pide abrir la
 * consola; y un extracto que lleva semanas sin importarse da cifras viejas sin que nada lo diga fuera del Repaso.
 *
 * Motor puro: recibe lo que la app ya tiene en memoria (las ejecuciones de los motores, el último error del recálculo, los movimientos y
 * las cuentas con extracto) y devuelve, para cada motor, un estado con forma además de color (● bien · ◐ aviso · ○ falla) y una frase,
 * y la lista de cuentas con el extracto atrasado. Sin DOM, sin red, sin almacenamiento; no recalcula nada (eso lo hace la pantalla).
 */

(function attachSaludMotor(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceSaludMotor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function saludMotorFactory() {
  "use strict";

  // UND-22: más de 10 días sin movimientos de una cuenta con extracto es un extracto atrasado (el Repaso, a los 7, ya pide importar).
  const EXTRACTO_DIAS = 10;
  const FORMA = Object.freeze({ ok: "●", aviso: "◐", falla: "○" });

  function filasDe(run) {
    if (!run || typeof run !== "object") return 0;
    const n = Number(run.rowCount || (Array.isArray(run.rows) ? run.rows.length : 0) || run.invariants?.checkedRows || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function diasEntre(desde, hasta) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(desde || "")) || !/^\d{4}-\d{2}-\d{2}/.test(String(hasta || ""))) return null;
    const a = new Date(`${String(desde).slice(0, 10)}T12:00:00`);
    const b = new Date(`${String(hasta).slice(0, 10)}T12:00:00`);
    return Math.round((b - a) / 86400000);
  }

  // Un motor con ejecución (mensual o diario): falla si no hay ejecución o no tiene filas, aviso si alguna invariante no pasa.
  function filaMotor(id, nombre, run, unidad) {
    const filas = filasDe(run);
    const calculado = run?.generatedAt || null;
    if (!run || !filas) return { id, nombre, estado: "falla", forma: FORMA.falla, filas: 0, calculado, detalle: `Sin ${unidad}: no se ha podido calcular.` };
    const inv = run.invariants;
    const issues = Array.isArray(inv?.issues) ? inv.issues.length : 0;
    if (inv && inv.valid === false) {
      return { id, nombre, estado: "aviso", forma: FORMA.aviso, filas, calculado, detalle: `${filas} ${unidad}; ${issues === 1 ? "una comprobación no cuadra" : `${issues} comprobaciones no cuadran`}.` };
    }
    return { id, nombre, estado: "ok", forma: FORMA.ok, filas, calculado, detalle: `${filas} ${unidad}${inv ? ", todas las comprobaciones cuadran" : ""}.` };
  }

  function filaPrevision(forecast) {
    const series = Array.isArray(forecast?.series) ? forecast.series.length : 0;
    const calculado = forecast?.generatedAt || null;
    if (!forecast || !series) return { id: "prevision", nombre: "Previsión de caja", estado: "falla", forma: FORMA.falla, filas: 0, calculado, detalle: "Sin meses de previsión: no se ha podido calcular." };
    if (forecast.valid === false) return { id: "prevision", nombre: "Previsión de caja", estado: "aviso", forma: FORMA.aviso, filas: series, calculado, detalle: `${series} meses, pero la previsión se marca como no válida.` };
    return { id: "prevision", nombre: "Previsión de caja", estado: "ok", forma: FORMA.ok, filas: series, calculado, detalle: `${series} meses de previsión.` };
  }

  // Deuda: no tiene ejecución guardada; se dice qué entra en «Camino a deuda cero» y qué no (lo de los pagos suspendidos, aparte).
  function filaDeuda(deuda) {
    if (!deuda || deuda.ok === false) return { id: "deuda", nombre: "Deuda", estado: "falla", forma: FORMA.falla, filas: 0, calculado: null, detalle: "No se ha podido calcular el camino de la deuda." };
    const dentro = Number(deuda.included || 0);
    const fuera = Number(deuda.excluded || 0);
    const suspendidas = Number(deuda.suspended || 0);
    if (!dentro && !fuera) return { id: "deuda", nombre: "Deuda", estado: "ok", forma: FORMA.ok, filas: 0, calculado: null, detalle: "Sin deudas con capital pendiente." };
    const partes = [`${dentro} ${dentro === 1 ? "deuda entra" : "deudas entran"} en el cálculo`];
    if (fuera - suspendidas > 0) partes.push(`${fuera - suspendidas} sin datos suficientes`);
    if (suspendidas > 0) partes.push(`${suspendidas} con los pagos suspendidos`);
    const estado = fuera - suspendidas > 0 ? "aviso" : "ok";
    return { id: "deuda", nombre: "Deuda", estado, forma: FORMA[estado], filas: dentro, calculado: null, detalle: `${partes.join("; ")}.` };
  }

  /**
   * UND-22: la última fecha con movimientos de cada cuenta con extracto y si va atrasada.
   * @param {Array<{date?: string, account?: string}>} transactions
   * @param {Array<{id: string, label: string, importLabel?: string, unlabelledStatements?: boolean}>} cuentas
   * @param {string} hoy «AAAA-MM-DD»
   */
  function extractos(transactions, cuentas, hoy, dias = EXTRACTO_DIAS) {
    const filas = Array.isArray(transactions) ? transactions : [];
    return (Array.isArray(cuentas) ? cuentas : []).map((cuenta) => {
      const suyas = filas.filter((row) => row?.date && (String(row.account || "") === cuenta.importLabel || (!row.account && cuenta.unlabelledStatements)));
      const ultima = suyas.map((row) => String(row.date).slice(0, 10)).sort().at(-1) || "";
      const atras = ultima ? diasEntre(ultima, hoy) : null;
      return { id: cuenta.id, label: cuenta.label, ultima, dias: atras, atrasado: atras !== null && atras > dias, sinExtracto: !ultima };
    });
  }

  /**
   * @param {{monthly?: object|null, daily?: object|null, forecast?: object|null, deuda?: {ok?: boolean, included?: number, excluded?: number, suspended?: number}|null,
   *   recalculoError?: {message?: string, at?: string}|null, extractos?: ReturnType<typeof extractos>}} input
   */
  function diagnostico(input = {}) {
    const filas = [
      filaMotor("mensual", "Plan mensual", input.monthly, "meses"),
      filaMotor("diario", "Previsión diaria", input.daily, "días"),
      filaDeuda(input.deuda),
      filaPrevision(input.forecast),
    ];
    const atrasados = (input.extractos || []).filter((item) => item.atrasado);
    const fallos = filas.filter((fila) => fila.estado === "falla").length;
    const avisos = filas.filter((fila) => fila.estado === "aviso").length;
    const recalculo = input.recalculoError ? { mensaje: String(input.recalculoError.message || ""), at: input.recalculoError.at || null } : null;
    const estado = recalculo || fallos ? "falla" : avisos || atrasados.length ? "aviso" : "ok";
    let resumen;
    if (recalculo) resumen = "El último recálculo falló: las cifras son las de antes";
    else if (fallos) resumen = `${fallos === 1 ? "Un cálculo no sale" : `${fallos} cálculos no salen`}`;
    else if (avisos) resumen = `Todo calculado, con ${avisos === 1 ? "un aviso" : `${avisos} avisos`}`;
    else resumen = `Todo calculado (${filas.length} de ${filas.length})`;
    if (atrasados.length) resumen += ` · ${atrasados.length === 1 ? "un extracto atrasado" : `${atrasados.length} extractos atrasados`}`;
    return { estado, forma: FORMA[estado], resumen, filas, recalculo, extractos: input.extractos || [], atrasados };
  }

  return { EXTRACTO_DIAS, FORMA, diagnostico, extractos, diasEntre };
});
