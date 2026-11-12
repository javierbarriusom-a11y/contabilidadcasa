// FX-15 (backlog de noviembre, P1): el resumen por periodo de Previsión, legible. Antes eran cinco cifras sueltas (ingresos,
// gastos, deuda, ahorro y mínimo) que no decían adónde llevaban. Ahora es una cascada de la liquidez del periodo elegido
// (trimestre, semestre o año): con cuánto se empieza, qué suma y qué resta cada bloque y con cuánto se acaba.
//
// · Cuadra siempre: liquidez al acabar = al empezar + ingresos − gastos − deuda. Si algo no encaja (otro flujo del motor), sale
//   como «Otros movimientos» en vez de esconderse.
// · El ahorro no es un paso: pasa de la cuenta corriente al ahorro y no sale de vuestro dinero, así que no resta. Se dice aparte,
//   con lo que queda en el ahorro al acabar.
// · Sin céntimos y redondeado como la previsión (FX-04, según lo lejos que acabe el periodo). Los pasos redondeados suman
//   exactamente el cambio redondeado: el resto del redondeo va al paso más grande.
// · Las barras son las de A-4 (`analisisCascadaHtml`, la misma cascada que Análisis y el puente de WP-43).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (escapeHtml, money, analisisCascadaHtml, isoLocalDate).
// No calcula la previsión: recibe el resumen de `previsionPeriodSummary` (app.js) y solo lo pinta.

function periodoPaso(summary) {
  const contract = globalThis.FinanceCanonicalForecastContract;
  // El día del hogar (isoLocalDate), nunca el de UTC: a medianoche serían días distintos. Sin él, a la decena.
  if (!contract?.roundingStep || !summary.endDate || typeof isoLocalDate !== "function") return 10;
  return contract.roundingStep(contract.daysBetween(isoLocalDate(new Date()), summary.endDate));
}

/** Los pasos de la cascada, redondeados a `paso` y cuadrados: su suma es exactamente el cambio redondeado. */
function periodoPasos(summary, paso) {
  const r = (value) => Math.round(Number(value || 0) / paso) * paso || 0;
  const pasos = [
    { label: "Ingresos", value: Number(summary.income || 0), tone: "is-ingreso" },
    { label: "Gastos", value: -Number(summary.gastos || 0), tone: "is-gasto" },
    { label: "Deuda", value: -Number(summary.deuda || 0), tone: "is-gasto" },
  ];
  const otros = Number(summary.end) - Number(summary.start) - pasos.reduce((sum, item) => sum + item.value, 0);
  if (Math.abs(otros) >= 1) pasos.push({ label: "Otros movimientos", value: otros, tone: otros < 0 ? "is-gasto" : "is-ingreso" });
  const inicio = r(summary.start);
  const fin = r(summary.end);
  const redondeados = pasos.map((item) => ({ ...item, value: r(item.value) }));
  const resto = fin - inicio - redondeados.reduce((sum, item) => sum + item.value, 0);
  if (resto && redondeados.length) {
    const mayor = redondeados.reduce((best, item, at) => (Math.abs(item.value) > Math.abs(redondeados[best].value) ? at : best), 0);
    redondeados[mayor] = { ...redondeados[mayor], value: redondeados[mayor].value + resto };
  }
  return { inicio, fin, pasos: redondeados.filter((item) => item.value !== 0) };
}

function periodoResumenHtml(summary, lowText) {
  const paso = periodoPaso(summary);
  const { inicio, fin, pasos } = periodoPasos(summary, paso);
  const cambio = fin - inicio;
  const r = (value) => Math.round(Number(value || 0) / paso) * paso || 0;
  const unos = paso > 10 ? "unos " : "";
  const frase = cambio === 0
    ? `La liquidez acaba como empieza, en ${unos}${money(fin)}.`
    : `La liquidez ${cambio > 0 ? "sube" : "baja"} ${unos}${money(Math.abs(cambio))}: de ${money(inicio)} a ${money(fin)}.`;
  const cascada = typeof analisisCascadaHtml === "function" ? analisisCascadaHtml({ rows: pasos, resultado: cambio }) : "";
  const ahorro = r(summary.ahorro)
    ? `<p class="e19-kpi-note">En el periodo pasan ${unos}${escapeHtml(money(r(summary.ahorro)))} de la cuenta corriente al ahorro: no salen de vuestro dinero, así que no restan. Al acabar, ${escapeHtml(money(r(summary.savingsEnd)))} están en el ahorro.</p>`
    : "";
  return `<div class="periodo-resumen" data-periodo-cambio="${cambio}">
    <p class="periodo-frase"><strong>${escapeHtml(frase)}</strong></p>
    <p class="periodo-tramo"><span>Liquidez al empezar ${escapeHtml(summary.firstLabel || "")}</span><strong>${escapeHtml(money(inicio))}</strong></p>
    <div class="periodo-cascada" role="group" aria-label="Qué suma y qué resta en el periodo">${cascada}</div>
    <p class="periodo-tramo"><span>Liquidez al acabar ${escapeHtml(summary.lastLabel || "")}</span><strong>${escapeHtml(money(fin))}</strong></p>
    ${ahorro}
    <p class="periodo-minimo">Lo más bajo del periodo: <strong class="${summary.min < 0 ? "negative" : ""}">${escapeHtml(lowText)}</strong> <small class="note">(${escapeHtml(summary.minMonthLabel || "")})</small></p>
  </div>`;
}
