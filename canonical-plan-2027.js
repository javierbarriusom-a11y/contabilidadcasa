(function attachCanonicalPlan2027(root, factory) {
  const zeroBase = typeof module === "object" && module.exports ? require("./canonical-zero-base.js") : root && root.FinanceCanonicalZeroBase;
  const api = factory(zeroBase);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPlan2027 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalPlan2027Factory(zeroBase) {
  "use strict";

  // CAT-11 / TRE-12 (decimotercera auditoría; D-N46 decidida por el hogar el 27/11/2026, opción C): el plan del año que viene
  // desde lo real de este. Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj. No escribe nada: dice, partida a partida, qué
  // propondría y por qué, y `cambios` traduce lo que el hogar acepte en celdas del plan, que la pantalla prepara y guarda tras
  // «Qué ocurrirá» (decisión 6 de docs/rediseno/ESTADO.md §3).
  //
  // La evidencia (los reales de los últimos 12 meses, su mediana, si lo previsto es plano) es la de base cero (WP-34), la misma
  // función: aquí no se recalcula.
  //
  // Reglas de D-N46 C (docs/PROPUESTA_FINAL_NOVIEMBRE_2026.md §5.1):
  //   · la base es la MEDIANA de los meses con real (un mes raro no manda);
  //   · solo se aplana lo mensual: lo previsto en el año que viene es el mismo cada mes Y la partida tiene real en la mayoría de
  //     los meses cubiertos. Un seguro anual o las pagas extra conservan su forma; un real suelto no se multiplica por 12;
  //   · lo que manda otra cosa (fórmula, contrato de deuda, tarjeta, asignación) no se toca: sus cambios del año ya vienen de ahí;
  //   · aviso por partida: si el último trimestre se aparta de la mediana más de UMBRAL_PCT y UMBRAL_EUR al mes, se dan las dos
  //     cifras y el hogar elige. Nunca se elige sola la del trimestre. UMBRAL_PCT es un parámetro, no una medida;
  //   · con menos de MIN_MESES_COMPARAR meses con real, el trimestre sale de casi los mismos meses que la mediana: no se compara
  //     y se dice «poca historia»;
  //   · A PRECIOS DE HOY: la previsión ya sube los gastos con la inflación de Ajustes mes a mes (app.js, expenseMultiplier); meterla
  //     también aquí la contaría dos veces. `inflacionTexto` solo dice cuánto añadirá la previsión.

  const UMBRAL_PCT = 20;
  const UMBRAL_EUR = 10;
  const MIN_MESES_COMPARAR = 6;
  const MIN_MESES_REAL = 3;
  const CUOTA_MENSUAL = 0.6;
  const MESES_TRIMESTRE = 3;
  const ELECCIONES = Object.freeze(["mediana", "trimestre", "mantener"]);

  const isMonth = (value) => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  const known = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const round2 = (value) => Math.round(Number(value) * 100) / 100;
  const euros = (value) => `${Math.round(value).toLocaleString("es-ES")} €`;
  const suma = (values) => round2(values.reduce((total, value) => total + value, 0));

  function plannedValues(partida, targetKeys) {
    return targetKeys.map((monthKey) => round2(partida.planned && known(partida.planned[monthKey]) ? Number(partida.planned[monthKey]) : 0));
  }

  // El último trimestre: los MESES_TRIMESTRE últimos meses de la ventana, solo si los tres tienen real (si falta uno, no se compara).
  function trimestreDe(partida, windowKeys) {
    const keys = windowKeys.slice(-MESES_TRIMESTRE);
    if (keys.length < MESES_TRIMESTRE) return null;
    const values = keys.map((monthKey) => (partida.real && known(partida.real[monthKey]) ? Number(partida.real[monthKey]) : null));
    if (values.some((value) => value === null)) return null;
    return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  }

  /**
   * @param {{partidas?: Array<{key: string, kind: "income"|"expense", label?: string, section?: string, locked?: string, planned?: Record<string, number>, real?: Record<string, number|null>}>,
   *   windowMonths?: string[], targetMonths?: string[], today?: string}} input
   */
  function buildModel({ partidas = [], windowMonths = [], targetMonths = [], today = "" } = {}) {
    if (!zeroBase || typeof zeroBase.buildModel !== "function") return { calculable: false, reason: "Falta el motor de base cero." };
    const targetKeys = targetMonths.filter(isMonth);
    if (targetKeys.length !== 12) return { calculable: false, reason: "El plan del año que viene necesita sus 12 meses." };
    const base = zeroBase.buildModel({
      partidas: (Array.isArray(partidas) ? partidas : []).map((partida) => ({ ...partida, futureMonths: targetKeys })),
      today, windowMonths, futureMonths: targetKeys,
    });
    if (!base.calculable) return { calculable: false, reason: base.reason };
    const windowKeys = base.windowMonths;
    const covered = base.coveredMonths;
    const byKey = new Map(partidas.map((partida) => [partida.key, partida]));
    const items = base.items.map((item) => {
      const partida = byKey.get(item.key) || {};
      const previsto = plannedValues(partida, targetKeys);
      const ev = item.evidence;
      const mensual = !item.locked && item.plannedFlat && ev.n >= MIN_MESES_REAL && ev.n >= Math.ceil(covered * CUOTA_MENSUAL);
      let tipo;
      let porque;
      if (item.locked) { tipo = "bloqueada"; porque = `Su importe lo manda otra cosa (${item.locked}): sus cambios de ${targetKeys[0].slice(0, 4)} ya vienen de ahí.`; }
      else if (ev.n < MIN_MESES_REAL) { tipo = "sin-historia"; porque = ev.n === 0 ? `Sin reales en los últimos ${windowKeys.length} meses: se queda lo previsto.` : `Solo ${ev.n} ${ev.n === 1 ? "mes" : "meses"} con real: se queda lo previsto.`; }
      else if (!item.plannedFlat) { tipo = "no-mensual"; porque = "Su importe cambia de un mes a otro (¿un pago anual o pagas extra?): conserva su forma mes a mes."; }
      else if (!mensual) { tipo = "no-mensual"; porque = `Tiene real en ${ev.n} de ${covered} meses cubiertos: no es un gasto de cada mes y no se multiplica por 12.`; }
      else { tipo = "mensual"; porque = `Mediana de ${ev.n} ${ev.n === 1 ? "mes" : "meses"} con real: ${euros(ev.median)} al mes.`; }
      const mediana = mensual ? Math.round(ev.median) : null;
      let alternativa = null;
      let aviso = null;
      if (mensual) {
        if (ev.n < MIN_MESES_COMPARAR) aviso = { id: "poca-historia", texto: `Poca historia (${ev.n} meses con real): no se compara con el último trimestre.` };
        else {
          const trimestre = trimestreDe(partida, windowKeys);
          const gap = trimestre === null ? 0 : trimestre - mediana;
          const pct = mediana ? Math.round((Math.abs(gap) / Math.abs(mediana)) * 100) : null;
          if (trimestre !== null && Math.abs(gap) >= UMBRAL_EUR && pct !== null && pct > UMBRAL_PCT) {
            alternativa = { importe: trimestre, pct, texto: `El último trimestre va a ${euros(trimestre)} al mes, un ${pct} % ${gap > 0 ? "más" : "menos"} que la mediana. ¿Ha cambiado algo?` };
          }
        }
      }
      return {
        key: item.key, kind: item.kind, label: item.label, section: item.section, tipo, porque,
        real12: suma(ev.months.map((month) => month.value)), mesesReal: ev.n,
        previsto, previstoAnual: suma(previsto), mediana, alternativa, aviso,
        propuestoAnual: mensual ? round2(mediana * 12) : suma(previsto),
      };
    });
    const total = (kind, field) => suma(items.filter((item) => item.kind === kind).map((item) => item[field]));
    return {
      calculable: true, today, targetMonths: targetKeys, windowMonths: windowKeys, coveredMonths: covered, items,
      totales: {
        ingresos: { real12: total("income", "real12"), previsto: total("income", "previstoAnual"), propuesto: total("income", "propuestoAnual") },
        gastos: { real12: total("expense", "real12"), previsto: total("expense", "previstoAnual"), propuesto: total("expense", "propuestoAnual") },
      },
      conAviso: items.filter((item) => item.alternativa).length,
      pocaHistoria: items.filter((item) => item.aviso && item.aviso.id === "poca-historia").length,
    };
  }

  /**
   * Lo que el hogar acepta, en celdas del plan. `elecciones[key]`: "mediana" (por defecto en lo mensual), "trimestre" (solo si hay
   * alternativa) o "mantener". Solo devuelve celdas que cambian; lo bloqueado, sin historia o no mensual nunca se toca.
   * @param {any} model @param {Record<string, string>} [elecciones]
   * @returns {Array<{key: string, monthKey: string, from: number, to: number}>}
   */
  function cambios(model, elecciones = {}) {
    if (!model || !model.calculable) return [];
    const out = [];
    model.items.forEach((item) => {
      if (item.tipo !== "mensual") return;
      const eleccion = ELECCIONES.includes(elecciones[item.key]) ? elecciones[item.key] : "mediana";
      if (eleccion === "mantener") return;
      const to = eleccion === "trimestre" && item.alternativa ? item.alternativa.importe : item.mediana;
      model.targetMonths.forEach((monthKey, index) => {
        const from = item.previsto[index];
        if (Math.abs(to - from) >= 0.005) out.push({ key: item.key, monthKey, from, to });
      });
    });
    return out;
  }

  /** Cuánto añadirá la previsión a los gastos propuestos con la inflación de Ajustes (no se escribe en el plan). */
  // Como la previsión: cada mes, (1 + p)^(meses desde hoy / 12), contando desde el mes de `model.today`.
  function inflacionTexto(model, inflacionAnualPct) {
    const pct = Number(inflacionAnualPct);
    if (!model || !model.calculable || !Number.isFinite(pct) || pct === 0 || !/^\d{4}-\d{2}/.test(String(model.today || ""))) return "";
    const [y0, m0] = model.today.slice(0, 7).split("-").map(Number);
    const mensual = model.totales.gastos.propuesto / 12;
    const extra = Math.round(model.targetMonths.reduce((total, monthKey) => {
      const [y, m] = monthKey.split("-").map(Number);
      const meses = Math.max(0, (y - y0) * 12 + (m - m0));
      return total + mensual * (Math.pow(1 + pct / 100, meses / 12) - 1);
    }, 0));
    return `A precios de hoy. Con la inflación de Ajustes (${String(pct).replace(".", ",")} % al año), la previsión le suma unos ${euros(extra)} a lo largo del año.`;
  }

  return { UMBRAL_PCT, UMBRAL_EUR, MIN_MESES_COMPARAR, MIN_MESES_REAL, CUOTA_MENSUAL, ELECCIONES, buildModel, cambios, inflacionTexto };
});
