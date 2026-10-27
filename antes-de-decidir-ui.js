// XDA-10 · PR-1 «Comprobar los datos antes de decidir»: la línea «Antes de decidir…» bajo el veredicto del guardarraíl de colchón (DLX1),
// que usan los simuladores de amortizar una deuda (AP1) y de llamada de garantía del Lombard (APX3). El cálculo vive en canonical-decision-freshness.js
// (puro); la edad de los saldos y cuánto pueden haberse movido salen de WP-45 (datos-ui.js y canonical-data-queue.js), sin duplicarlo.
// Nace apagada en Funciones en prueba (XGO-03): sin encenderla, el veredicto es el de siempre. El Euribor de los simuladores de deuda, en el PR-2.
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

/** La línea bajo el veredicto del guardarraíl: vacía con la función apagada o con los datos al día. */
function antesDeDecidirHtml(guardrail, engine) {
  if (!guardrail || !engine || !antesDeDecidirOn() || !globalThis.FinanceCanonicalDataQueue) return "";
  try {
    const today = isoLocalDate(new Date());
    // «Hasta» estima lo que ha podido SALIR (gasto diario × días): sirve para un veredicto a salvo, que se vuelve alerta si sale dinero. Una
    // alerta solo cambia si ha ENTRADO dinero, y eso no se estima: su margen queda sin saber («conviene actualizar»).
    const below = Number(guardrail.remaining) < Number(guardrail.floor);
    const result = engine.check({ margin: below ? null : Number(guardrail.remaining) - Number(guardrail.floor), inputs: [antesDeDecidirSaldos(today)] });
    if (result.status !== "stale") return "";
    const first = result.items[0];
    const link = first.flips !== "no" && first.action ? ` <a href="${escapeHtml(first.action.href)}" data-antes-decidir-ir>${escapeHtml(first.action.label)}</a>` : "";
    globalThis.FinanceMedidor?.anotar("antes-de-decidir", "vista"); // XGO-02: un día visto cuenta una vez
    return `<p class="e19-kpi-note antes-decidir" role="note" data-antes-decidir="${escapeHtml(first.flips)}">${escapeHtml(result.sentence)}${link} <span class="antes-decidir-nota">El veredicto de arriba es con estos datos; «hasta» es una estimación (gasto diario × días).</span></p>`;
  } catch (error) {
    console.error(`antesDeDecidirHtml: ${error.message}`);
    return "";
  }
}
