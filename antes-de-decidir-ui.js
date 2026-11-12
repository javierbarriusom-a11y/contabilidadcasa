// XDA-10 · PR-1 «Comprobar los datos antes de decidir»: la línea «Antes de decidir…» bajo el veredicto del guardarraíl de colchón (DLX1),
// que usan los simuladores de amortizar una deuda (AP1) y de llamada de garantía del Lombard (APX3). El cálculo vive en canonical-decision-freshness.js
// (puro); la edad de los saldos y cuánto pueden haberse movido salen de WP-45 (datos-ui.js y canonical-data-queue.js), sin duplicarlo.
// Nace apagada en Funciones en prueba (XGO-03): sin encenderla, el veredicto es el de siempre.
//
// PR-2 (12/11/2026): la misma línea en tres sitios más. (1) Cancelar una deuda entera (DEB-15 y DEB-17): una sola línea para los tres
// guardarraíles (hoy, a N meses y en tensión), con el más justo. (2) «Comparar con» de la Previsión (las pruebas, «¿Y si…?» y los
// escenarios guardados): los saldos y, en la prueba del Euribor, el Euribor tecleado. (3) El veredicto de la reserva en Escenarios.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (escapeHtml, isoLocalDate, datosSources…). Sin llamadas al DOM ni
// escuchas al cargarse: dlx1GuardrailHtml, en app.js, pide la línea al pintar el veredicto.

function antesDeDecidirOn() {
  return globalThis.FinanceFuncionesEnPrueba?.encendida?.("antes-de-decidir") === true;
}

// Los saldos, la entrada del guardarraíl que caduca: su edad y cuánto pueden haberse movido desde entonces (WP-45). Calculados por
// calendario, no tienen edad que medir: «no sé».
function antesDeDecidirSaldos(today) {
  const queue = globalThis.FinanceCanonicalDataQueue;
  const source = datosSources(today);
  const staleAfterDays = globalThis.FinanceCanonicalDataAge?.STALE_AFTER_DAYS ?? 4;
  const ageDays = source.balanceMode === "auto" || !source.balanceDate ? null : Math.max(0, queue.daysBetween(String(source.balanceDate).slice(0, 10), today));
  const move = ageDays === null ? null : queue.unloggedEstimate({ dailyOutflow: source.dailyOutflow, ageDays }).value;
  return { id: "balances", label: "Los saldos", ageDays, staleAfterDays, plausibleMove: move, action: { label: "Actualizar saldos", href: "#visual-detail" } };
}

// «Hasta» estima lo que ha podido SALIR (gasto diario × días): sirve para un veredicto a salvo, que se vuelve alerta si sale dinero. Una
// alerta solo cambia si ha ENTRADO dinero, y eso no se estima: su margen queda sin saber («conviene actualizar»).
function antesDeDecidirMargen(value, floor) {
  return Number(value) < Number(floor) ? null : Number(value) - Number(floor);
}

const ANTES_DECIDIR_NOTA = "El veredicto de arriba es con estos datos; «hasta» es una estimación (gasto diario × días).";

/** La línea a partir de la lectura del motor: un enlace por cada dato que importa (como mucho tres) y la nota. */
function antesDeDecidirLineaHtml(result, nota, extra) {
  if (!result) return "";
  if (result.status !== "stale") return "";
  const first = result.items[0];
  const links = result.items.filter((item) => item.flips !== "no" && item.action);
  const seen = new Set();
  const enlaces = links.filter((item) => !seen.has(item.action.href) && seen.add(item.action.href))
    .map((item) => ` <a href="${escapeHtml(item.action.href)}" data-antes-decidir-ir>${escapeHtml(item.action.label)}</a>`).join("");
  globalThis.FinanceMedidor?.anotar("antes-de-decidir", "vista"); // XGO-02: un día visto cuenta una vez
  return `<p class="e19-kpi-note antes-decidir" role="note" data-antes-decidir="${escapeHtml(first.flips)}"${extra || ""}>${escapeHtml(result.sentence)}${enlaces} <span class="antes-decidir-nota">${escapeHtml(nota)}</span></p>`;
}

/** La línea bajo el veredicto del guardarraíl: vacía con la función apagada o con los datos al día. */
function antesDeDecidirHtml(guardrail, engine) {
  // Al cancelar una deuda entera, la línea va una sola vez, debajo de los tres guardarraíles (antesDeDecidirCancelacionHtml).
  if (!guardrail || !engine || !antesDeDecidirOn() || !globalThis.FinanceCanonicalDataQueue) return "";
  if (guardrail.antesDeDecidirAparte) return "";
  try {
    const today = isoLocalDate(new Date());
    const below = Number(guardrail.remaining) < Number(guardrail.floor); // la misma regla que antesDeDecidirMargen
    const result = engine.check({ margin: below ? null : Number(guardrail.remaining) - Number(guardrail.floor), inputs: [antesDeDecidirSaldos(today)] });
    return antesDeDecidirLineaHtml(result, ANTES_DECIDIR_NOTA);
  } catch (error) {
    console.error(`antesDeDecidirHtml: ${error.message}`);
    return "";
  }
}

const ANTES_DECIDIR_ORDEN = { yes: 0, unknown: 1, no: 2 };

/**
 * PR-2 · cancelar una deuda entera (DEB-15 y DEB-17): `veredictos` son el guardarraíl de hoy (DLX1, `remaining` y `floor`), el de los
 * próximos meses y el de tensión (`worst.projectedLiquidity`, con el suelo del de hoy). Los saldos mueven los tres por igual: la línea habla
 * del más justo (el primero al que le da la vuelta; si no, el de menos margen) y lo nombra.
 */
function antesDeDecidirCancelacionHtml(veredictos) {
  const engine = globalThis.FinanceCanonicalDecisionFreshness;
  const [hoy, meses, tension] = Array.isArray(veredictos) ? veredictos : [];
  if (!engine || !hoy || !antesDeDecidirOn() || !globalThis.FinanceCanonicalDataQueue) return "";
  try {
    const today = isoLocalDate(new Date());
    const saldos = antesDeDecidirSaldos(today);
    const floor = Number(hoy.floor);
    const lecturas = [
      { nombre: "el de hoy", margin: antesDeDecidirMargen(hoy.remaining, floor) },
      meses?.calculable ? { nombre: `el de ${meses.horizonMonths} meses`, margin: antesDeDecidirMargen(meses.worst.projectedLiquidity, floor) } : null,
      tension?.calculable ? { nombre: "el de tensión", margin: antesDeDecidirMargen(tension.worst.projectedLiquidity, floor) } : null,
    ].filter(Boolean).map((lectura) => ({ ...lectura, result: engine.check({ margin: lectura.margin, inputs: [saldos] }) }));
    const peor = lecturas.filter((lectura) => lectura.result.status === "stale").sort((a, b) => ANTES_DECIDIR_ORDEN[a.result.items[0].flips] - ANTES_DECIDIR_ORDEN[b.result.items[0].flips]
      || (a.margin ?? -Infinity) - (b.margin ?? -Infinity))[0];
    if (!peor) return "";
    const nota = lecturas.length > 1
      ? `Los ${lecturas.length} guardarraíles de arriba son con estos datos; el más justo es ${peor.nombre}. «Hasta» es una estimación (gasto diario × días).`
      : ANTES_DECIDIR_NOTA;
    return antesDeDecidirLineaHtml(peor.result, nota, ` data-antes-decidir-cual="${escapeHtml(peor.nombre)}"`);
  } catch (error) {
    console.error(`antesDeDecidirCancelacionHtml: ${error.message}`);
    return "";
  }
}

const antesDeDecidirPuntos = (value) => `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} ${value === 1 ? "punto" : "puntos"}`;

// Cuánto ha podido moverse el Euribor desde que se tecleó: como mucho 1 punto por mes. Es su mayor salto en un mes (el Euribor a 12 meses,
// de media 1,25 % en agosto de 2022 y 2,23 % en septiembre): una cota generosa, como el «hasta» de los saldos, no una previsión.
const ANTES_DECIDIR_EURIBOR_MES = 1;

/**
 * El Euribor de la prueba «Euribor +N» (FX-21): no se mide en euros, así que la lectura se hace aquí, con la trayectoria. Si la prueba no
 * baja del suelo, cuántos puntos más alto tendría que estar hoy el Euribor para que bajara (`need`, `toward: "up"`); si baja, cuántos más
 * bajo para que no (`toward: "down"`). Exacto en lo que la subida es lineal (la cuota por punto cambia muy poco). Cuando el Euribor no
 * puede darle la vuelta, la lectura ya es «no», con su razón. No estima cuánto se ha movido el Euribor: eso lo pone la cota de arriba.
 * `base`/`rows`: la trayectoria diaria del plan y la de la prueba; `points`: los puntos de la prueba; `to`: el final del horizonte.
 * @param {{ base: any[], rows: any[], today: string, to: string, floor: number, points: number, crosses: boolean, baseCrosses: boolean }} input
 */
function antesDeDecidirEuriborLectura(input) {
  const { base, rows, today, to, floor, points, crosses, baseCrosses } = input;
  if (crosses && baseCrosses) return { flips: "no", because: "el plan ya baja del suelo sin la subida, así que el Euribor no le da la vuelta" };
  const plan = new Map((base || []).map((row) => [row.date, Number(row.total)]));
  let need = crosses ? 0 : Infinity;
  let toca = false;
  let posible = true;
  (rows || []).forEach((row) => {
    const b = plan.get(row.date);
    if (row.date < today || row.date > to || !Number.isFinite(b) || !Number.isFinite(Number(row.total))) return;
    const porPunto = (b - Number(row.total)) / points; // lo que la subida quita ese día, por punto
    const hueco = Number(row.total) - floor;
    if (!crosses) {
      if (porPunto > 0.5) { toca = true; need = Math.min(need, hueco / porPunto); }
    } else if (hueco < 0) {
      if (porPunto <= 0.5) posible = false;
      else need = Math.max(need, -hueco / porPunto);
    }
  });
  if (!crosses && !toca) return { flips: "no", because: "la cuota nueva no llega dentro de este horizonte" };
  if (crosses && !posible) return { flips: "no", because: "bajáis del suelo antes de que la cuota nueva empiece, así que el Euribor no le da la vuelta" };
  // Hacia el lado prudente: al decir cuánto haría falta para bajar, se redondea hacia abajo; para dejar de bajar, hacia arriba.
  const puntos = crosses ? Math.max(0.1, Math.ceil(need * 10 - 1e-9) / 10) : Math.max(0.1, Math.floor(need * 10 + 1e-9) / 10);
  return { need: puntos, toward: crosses ? "down" : "up" };
}

/** Con la edad del dato, la lectura en firme: le da la vuelta si lo que hace falta cabe en lo que ha podido moverse (la cota de arriba). */
function antesDeDecidirEuriborVeredicto(lectura, ageDays) {
  if (lectura.flips) return lectura;
  const hasta = Math.max(ANTES_DECIDIR_EURIBOR_MES, Math.round((ageDays / 30) * ANTES_DECIDIR_EURIBOR_MES * 10) / 10);
  const cambio = lectura.toward === "up" ? `con ${antesDeDecidirPuntos(lectura.need)} más bajaríais del suelo` : `con ${antesDeDecidirPuntos(lectura.need)} menos ya no bajaríais del suelo`;
  if (lectura.need <= hasta) return { flips: "yes", because: `puede haberse movido hasta ${antesDeDecidirPuntos(hasta)} y ${cambio}`, hasta };
  const verbo = lectura.toward === "up" ? "subido" : "bajado";
  return { flips: "no", because: `haría falta que hubiera ${verbo} ${antesDeDecidirPuntos(lectura.need)} para cambiar el resultado, y su mayor salto en un mes ha sido de ${antesDeDecidirPuntos(ANTES_DECIDIR_EURIBOR_MES)} (septiembre de 2022)`, hasta };
}

/** El Euribor tecleado como dato de la decisión: su edad, con la lectura de la prueba, y el camino a la tarjeta de índices. */
function antesDeDecidirEuribor(lectura, today) {
  const review = (typeof previsionV2Revisiones === "function" ? previsionV2Revisiones(today).reviews : [])[0];
  const indices = globalThis.FinanceCanonicalRateIndices;
  if (!review?.indexDate || !indices) return null;
  const ageDays = Math.max(0, indices.daysBetween(review.indexDate, today));
  return {
    id: "euribor",
    label: "El Euribor tecleado",
    plural: false,
    ageDays,
    // El índice caduca cuando PASA de sus días (canonical-rate-indices.js, «vale 35»); el motor cuenta desde el día del umbral.
    staleAfterDays: Number(indices.INDICES.euribor12m.staleAfterDays) + 1,
    plausibleMove: null,
    ...antesDeDecidirEuriborVeredicto(lectura, ageDays),
    action: { label: "Actualizar el Euribor", href: "#deuda-contratos" },
  };
}

/**
 * PR-2 · «Comparar con» de la Previsión (las pruebas, «¿Y si…?» y un escenario guardado): el veredicto es si la prueba baja del suelo.
 * Los saldos mueven toda la trayectoria; el Euribor tecleado, solo la prueba del Euribor (sola: combinada con otra, no se separa).
 * @param {{ prueba: any, c: any, floor: number, today: string, base: any[] }} input
 */
function antesDeDecidirPruebaHtml(input) {
  const engine = globalThis.FinanceCanonicalDecisionFreshness;
  const { prueba, c, floor, today, base } = input || {};
  if (!engine || !prueba || !c?.low || !antesDeDecidirOn() || !globalThis.FinanceCanonicalDataQueue) return "";
  try {
    const inputs = [antesDeDecidirSaldos(today)];
    const partes = typeof previsionV2Partes === "function" ? previsionV2Partes(prueba) : [];
    const conEuribor = partes.some((parte) => parte.preset?.id === "euribor");
    if (conEuribor) {
      const lectura = !prueba.combined && prueba.preset?.id === "euribor"
        ? antesDeDecidirEuriborLectura({ base, rows: prueba.rows, today, to: c.end?.date || prueba.rows?.at(-1)?.date || today, floor, points: Number(prueba.params?.points) || 1, crosses: Boolean(c.crossesFloor), baseCrosses: Boolean(c.baseCrossesFloor) })
        : { flips: "unknown", because: "con dos pruebas juntas no separo lo que pone el Euribor" };
      const euribor = antesDeDecidirEuribor(lectura, today);
      if (euribor) inputs.push(euribor);
    }
    const result = engine.check({ margin: antesDeDecidirMargen(c.low.value, floor), inputs });
    // La nota explica el «hasta» de lo que sale en la línea: el de los saldos, el del Euribor o los dos.
    const hastas = [
      result.items.some((item) => item.id === "balances" && item.plausibleMove !== null) ? "en los saldos, una estimación (gasto diario × días)" : "",
      result.items.some((item) => item.id === "euribor" && item.flips !== "unknown") ? `en el Euribor, su mayor salto en un mes (${antesDeDecidirPuntos(ANTES_DECIDIR_EURIBOR_MES)}, septiembre de 2022) por cada mes` : "",
    ].filter(Boolean);
    return antesDeDecidirLineaHtml(result, `El resultado de arriba es con estos datos${hastas.length ? `; «hasta» es, ${hastas.join(", y ")}` : ""}.`);
  } catch (error) {
    console.error(`antesDeDecidirPruebaHtml: ${error.message}`);
    return "";
  }
}

/**
 * PR-2 · el veredicto de la reserva en Escenarios: «se mantiene por encima de X» o «la rompe». Sin saldo mínimo indicado no hay veredicto
 * que dependa de los saldos (la capacidad libre son flujos), y no se dice nada.
 * @param {{ minimo: number|null, reserva: number, rota: boolean }} input
 */
function antesDeDecidirEscenarioHtml(input) {
  const engine = globalThis.FinanceCanonicalDecisionFreshness;
  const { minimo, reserva, rota } = input || {};
  if (!engine || !(Number(reserva) > 0) || minimo === null || minimo === undefined || !antesDeDecidirOn() || !globalThis.FinanceCanonicalDataQueue) return "";
  try {
    const today = isoLocalDate(new Date());
    const result = engine.check({ margin: rota ? null : antesDeDecidirMargen(minimo, reserva), inputs: [antesDeDecidirSaldos(today)] });
    return antesDeDecidirLineaHtml(result, ANTES_DECIDIR_NOTA);
  } catch (error) {
    console.error(`antesDeDecidirEscenarioHtml: ${error.message}`);
    return "";
  }
}
