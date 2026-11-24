/**
 * seguimiento-plan-deuda.js
 *
 * DUO-D1 (duodécima auditoría, docs/PROPUESTA_DUODECIMA_AUDITORIA_2026-11-23.md §3.2; recoge UND-14) y D-N35 (23/11/2026, decisión del
 * hogar: «ok»): el plan de deuda que se sigue. Un plan sin seguimiento se abandona hacia el tercer mes.
 *
 *  - `compromiso`: al pulsar «Este es nuestro plan», se guarda lo que toca cada mes: a qué deuda va lo de más, cuánto (el extra del mes y
 *    las cuotas que ya se liberaron, lo que el plan llama «pool») y la cuota de esa deuda. Es una foto: el plan de la pantalla sigue
 *    recalculándose con los datos de hoy.
 *  - `pagosDelMes`: busca en los movimientos importados lo pagado a ese contrato ese mes (por su referencia, su entidad o la entidad que
 *    reconoce el motor de recibos). Un pago de más hecho en los cinco primeros días del mes siguiente cuenta para el mes al que le faltaba.
 *  - `seguimiento`: por cada mes, «hecho», «parcial», «no», «preguntar» (no se ha encontrado el pago de más), «en curso» o «más adelante».
 *    D-N35: si la app encuentra el pago, lo da por hecho y lo dice (con «No era esto» para corregir); solo pregunta lo que no puede saber,
 *    y de uno en uno (el mes más antiguo sin contestar). Un mes sin pago de más es una decisión, no un fallo: la frase no culpa.
 *
 * Motor puro: sin DOM, red ni almacenamiento. No ejecuta ni propone ninguna operación (A11-4).
 */

(function attachSeguimientoPlanDeuda(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceSeguimientoPlanDeuda = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function seguimientoPlanDeudaFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-seguimiento-plan-deuda/v1";
  // Margen para dar un pago por bueno: lo que falte hasta lo previsto, como mucho el 10 % o 10 € (lo que sea mayor).
  const MARGEN = Object.freeze({ pct: 0.1, abs: 10 });
  // Un pago de más hecho a primeros del mes siguiente cuenta para el mes al que le faltaba.
  const DIAS_GRACIA = 5;
  const ESTADOS = Object.freeze(["hecho", "parcial", "no", "preguntar", "en-curso", "futuro"]);

  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const mesOk = (key) => /^\d{4}-\d{2}$/.test(String(key || ""));

  function sumarMeses(key, n) {
    const [y, m] = String(key).split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function normalizar(texto) {
    return String(texto || "").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  }

  /**
   * La foto del plan elegido.
   * @param {object} plan resultado de FinanceCanonicalDebtOptimalPlan.plan (ok)
   * @param {Array<object>} contratos los mismos contratos del plan (para la cuota de cada deuda)
   * @param {string} hoy «AAAA-MM-DD»
   */
  function compromiso(plan, contratos, hoy) {
    if (!plan?.ok || !plan.recommended || !mesOk(plan.startMonthKey)) return null;
    const porId = new Map((Array.isArray(contratos) ? contratos : []).map((c) => [String(c.id), c]));
    const meses = [];
    for (const tramo of plan.recommended.periods || []) {
      const contrato = porId.get(String(tramo.targetId));
      const cuota = round2(Number(contrato?.currentPayment) || 0);
      for (let i = tramo.fromIndex; i <= tramo.toIndex; i += 1) {
        const extra = round2(Array.isArray(tramo.pools) ? (tramo.pools[i - tramo.fromIndex] ?? tramo.extra) : tramo.extra);
        if (!(extra > 0)) continue;
        meses.push({ mes: sumarMeses(plan.startMonthKey, i), id: String(tramo.targetId), label: tramo.targetLabel, cuota, extra, ultimo: i === tramo.toIndex, quita: Boolean(tramo.quita) });
      }
    }
    if (!meses.length) return null;
    const s = plan.recommended.summary || {};
    return {
      schemaId: SCHEMA_ID,
      guardadoEl: String(hoy || "").slice(0, 10),
      desde: plan.startMonthKey,
      estrategia: plan.recommended.strategy,
      fechaLibre: s.debtFreeMonthKey || null,
      intereses: s.totalInterest ?? null,
      meses,
    };
  }

  // ¿Es este movimiento de este contrato? Por la referencia del contrato (6 cifras o más), por la entidad escrita en el concepto o por la
  // entidad que reconoce el motor de recibos (que traduce «ECITC», «BANKINTER CONS»…).
  function esDelContrato(mov, contrato, lenderOf) {
    const texto = normalizar(`${mov.movement || mov.label || ""} ${mov.details || ""}`);
    if (!texto) return false;
    const numero = normalizar(contrato?.number).replace(/[^a-z0-9]/g, "");
    if (numero.length >= 6 && texto.replace(/[^a-z0-9]/g, "").includes(numero)) return true;
    const entidad = normalizar(contrato?.entity);
    if (entidad.length >= 4 && texto.includes(entidad)) return true;
    const lender = typeof lenderOf === "function" ? lenderOf(texto) : null;
    return Boolean(lender && entidad && normalizar(lender.entity) === entidad);
  }

  /**
   * Lo pagado a un contrato en un mes (solo cargos), con los movimientos que lo componen.
   * @returns {{total: number, movimientos: Array<{date: string, amount: number, concepto: string}>}}
   */
  function pagosDelMes(movimientos, contrato, mes, { lenderOf, usados = new Set(), desdeDia = 1, hastaMesSiguiente = 0 } = {}) {
    const siguiente = sumarMeses(mes, 1);
    const elegidos = [];
    (Array.isArray(movimientos) ? movimientos : []).forEach((mov, index) => {
      if (usados.has(index) || !(Number(mov?.amount) < 0) || !mov.date) return;
      const fecha = String(mov.date).slice(0, 10);
      const delMes = fecha.slice(0, 7) === mes && Number(fecha.slice(8, 10)) >= desdeDia;
      const deGracia = hastaMesSiguiente > 0 && fecha.slice(0, 7) === siguiente && Number(fecha.slice(8, 10)) <= hastaMesSiguiente;
      if (!(delMes || deGracia) || !esDelContrato(mov, contrato, lenderOf)) return;
      elegidos.push({ index, date: fecha, amount: round2(-Number(mov.amount)), concepto: String(mov.movement || mov.label || "").trim() });
    });
    return { total: round2(elegidos.reduce((sum, m) => sum + m.amount, 0)), movimientos: elegidos };
  }

  function bastante(real, previsto) {
    return real >= previsto - Math.max(MARGEN.abs, previsto * MARGEN.pct);
  }

  /**
   * @param {ReturnType<typeof compromiso>} plan la foto guardada
   * @param {{movimientos?: Array<object>, contratos?: Array<object>, respuestas?: Record<string, {tipo: string, importe?: number}>, hoy: string, lenderOf?: Function}} entrada
   */
  function seguimiento(plan, entrada = {}) {
    if (!plan?.meses?.length) return { ok: false };
    const hoy = String(entrada.hoy || "").slice(0, 10);
    const mesHoy = hoy.slice(0, 7);
    const diaHoy = Number(hoy.slice(8, 10)) || 1;
    const porId = new Map((entrada.contratos || []).map((c) => [String(c.id), c]));
    const respuestas = entrada.respuestas || {};
    const usados = new Set();
    const filas = plan.meses.map((m) => {
      const base = { mes: m.mes, id: m.id, label: m.label, previsto: m.extra, cuota: m.cuota, ultimo: Boolean(m.ultimo) };
      if (m.mes > mesHoy) return { ...base, estado: "futuro", real: null, fuente: null, movimientos: [] };
      // ¿Se puede evaluar ya? Un mes cerrado y pasados los días de gracia del siguiente.
      const cerrado = m.mes < mesHoy && !(sumarMeses(m.mes, 1) === mesHoy && diaHoy <= DIAS_GRACIA);
      const contrato = porId.get(m.id) || { id: m.id, entity: m.label };
      const delMes = pagosDelMes(entrada.movimientos, contrato, m.mes, { lenderOf: entrada.lenderOf, usados });
      let real = round2(delMes.total - m.cuota);
      let movimientos = delMes.movimientos;
      if (!bastante(real, m.extra) || real <= MARGEN.abs) {
        // Un pago de más a primeros del mes siguiente (que no sea la cuota de ese mes: tiene que pasar de la cuota en más de 10 €).
        const gracia = pagosDelMes(entrada.movimientos, contrato, m.mes, { lenderOf: entrada.lenderOf, usados, desdeDia: 32, hastaMesSiguiente: DIAS_GRACIA });
        // Por orden de fecha y solo hasta completar lo previsto: lo que venga después es ya del mes siguiente.
        const extraGracia = [];
        for (const g of gracia.movimientos.filter((x) => x.amount > m.cuota + MARGEN.abs).sort((x, y) => x.date.localeCompare(y.date))) {
          if (bastante(real, m.extra) && real > MARGEN.abs) break;
          extraGracia.push(g);
          real = round2(real + g.amount);
        }
        movimientos = [...movimientos, ...extraGracia];
      }
      movimientos.forEach((mv) => usados.add(mv.index));
      const respuesta = respuestas[m.mes];
      if (respuesta && respuesta.tipo !== "no-era") {
        if (respuesta.tipo === "si") return { ...base, estado: "hecho", real: m.extra, fuente: "respuesta", movimientos: [] };
        if (respuesta.tipo === "no") return { ...base, estado: "no", real: 0, fuente: "respuesta", movimientos: [] };
        if (respuesta.tipo === "otra") {
          const importe = round2(Math.max(0, Number(respuesta.importe) || 0));
          const estado = importe <= 0 ? "no" : bastante(importe, m.extra) ? "hecho" : "parcial";
          return { ...base, estado, real: importe, fuente: "respuesta", movimientos: [] };
        }
      }
      const ignorarDetectado = respuesta?.tipo === "no-era";
      const encontrado = !ignorarDetectado && real > MARGEN.abs;
      if (encontrado && (bastante(real, m.extra) || m.ultimo)) return { ...base, estado: "hecho", real, fuente: "detectado", movimientos };
      if (encontrado && cerrado) return { ...base, estado: "parcial", real, fuente: "detectado", movimientos };
      if (!cerrado) return { ...base, estado: "en-curso", real: encontrado ? real : null, fuente: encontrado ? "detectado" : null, movimientos: encontrado ? movimientos : [] };
      return { ...base, estado: "preguntar", real: null, fuente: null, movimientos: [] };
    });
    const evaluados = filas.filter((f) => ["hecho", "parcial", "no"].includes(f.estado));
    let racha = 0;
    for (let i = filas.length - 1; i >= 0; i -= 1) {
      const f = filas[i];
      if (f.estado === "futuro" || f.estado === "en-curso") continue;
      if (f.estado === "hecho") racha += 1;
      else break;
    }
    const pregunta = filas.find((f) => f.estado === "preguntar") || null;
    const previsto = round2(evaluados.reduce((sum, f) => sum + f.previsto, 0));
    const hecho = round2(evaluados.reduce((sum, f) => sum + (f.real || 0), 0));
    return {
      ok: true,
      filas,
      racha,
      pregunta,
      previsto,
      hecho,
      desviacion: round2(previsto - hecho),
      pendientes: filas.filter((f) => f.estado === "preguntar").length,
      ultimoDetectado: [...filas].reverse().find((f) => f.fuente === "detectado") || null,
    };
  }

  return { SCHEMA_ID, MARGEN, DIAS_GRACIA, ESTADOS, compromiso, pagosDelMes, seguimiento, sumarMeses, esDelContrato };
});
