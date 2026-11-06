// Rediseño · fase C2 (docs/rediseno/HANDOFF.md §5 «C2 · Plan › Previsión», referencias/png/Prevision.png y PrevisionDesktop.png)
// ampliada por FX-10 (BACKLOG_NOVIEMBRE_OLEADA_1.md; docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md §6).
//
// Plan › Previsión v2: arriba el punto más bajo del horizonte con su fecha y lo que queda sobre el suelo; el gráfico único de
// previsión (ChartKit.forecastPlotHtml, FX-11) con lo de hoy, el plan, el suelo y los cobros como hitos; y «Lo que viene» con
// los pagos y cobros grandes y si su día es cierto o estimado (FX-12). Horizonte 3 m · 12 m · 24 m · Hasta 2036 (D-N2, la
// recomendación de Claude, a la espera de que el hogar la confirme). Solo con el tema v2.
//
// No calcula nada nuevo: lee la trayectoria del motor diario (canonicalDailyEngineRuns.active), la misma que usan Hoy y el
// titular de Previsión mensual (FX-01, FX-02), el suelo de Hoy y de la banda de caja, y el contrato de cifras para redondear
// y decir las fechas (canonical-forecast-contract.js). La tabla de meses de siempre sigue entera tras «Ver todo el detalle»;
// el plan B, el puente y el mapa de pagos siguen a la vista debajo. No se retira nada.
// Script clásico con defer, cargado antes de app.js (mismo scope global que el resto de views/*.js).

const PREVISION_V2_HORIZONTES = Object.freeze([
  Object.freeze({ id: "3m", label: "3 m", dias: 91, paso: 1, titulo: "de los próximos 3 meses" }),
  Object.freeze({ id: "12m", label: "12 m", dias: 365, paso: 7, titulo: "de los próximos 12 meses" }),
  Object.freeze({ id: "24m", label: "24 m", dias: 730, paso: 14, titulo: "de los próximos 24 meses" }),
  Object.freeze({ id: "full", label: "Hasta 2036", dias: Infinity, paso: "mes", titulo: "de aquí al final del plan" }),
]);
const PREVISION_V2_GRANDE = 300; // «Lo que viene»: pagos y cobros desde este importe

let previsionV2Detalle = false; // «Ver todo el detalle», hasta recargar
let previsionV2Escenario = ""; // FX-20: la prueba de estrés superpuesta, hasta recargar
const previsionV2Params = { concept: "", months: 3, points: 1 }; // FX-21 (D-N3): de quién, cuántos meses y cuántos puntos
const previsionV2Cache = new Map(); // FX-21: cada prueba se calcula una vez por trayectoria del plan y parámetros

/** Los motores de siempre (mensual, entrada diaria y diario), los mismos que pintan la trayectoria del plan. */
function previsionV2Deps() {
  return {
    monthly: globalThis.FinanceCanonicalEngine,
    dailyInput: globalThis.FinanceCanonicalDailyInput,
    daily: globalThis.FinanceCanonicalDailyEngine,
    dailyOptions: { operatingReserve: state?.operatingReserve },
  };
}

/**
 * FX-21 · Euribor: la revisión de cada hipoteca con los datos de Deuda › Contratos (WP-20, revision-tipo-ui.js) y el Euribor
 * tecleado. Devuelve las revisiones calculables o lo que falta para calcularlas.
 */
function previsionV2Revisiones(today) {
  const engine = globalThis.FinanceCanonicalRateReview;
  if (!engine || typeof revisionMortgages !== "function" || typeof revisionEvaluate !== "function") return { reviews: [], missing: ["la revisión del tipo (Deuda › Contratos)"] };
  const hipotecas = revisionMortgages(today);
  if (!hipotecas.length) return { reviews: [], missing: ["una hipoteca activa en Deuda › Contratos, con capital pendiente y plazos"] };
  const store = revisionLoad();
  const results = hipotecas.map((hipoteca) => revisionEvaluate(engine, hipoteca, store.byContract[hipoteca.id] || {}, today));
  const reviews = results.filter((result) => result.status === "ok" && Number(result.currentPayment) > 0);
  if (reviews.length) return { reviews, missing: [] };
  const missing = results.flatMap((result) => (result.status === "ok" ? ["la cuota actual del contrato"] : result.missing || []));
  return { reviews: [], missing: [...new Set(missing)] };
}

/** Los parámetros de la prueba elegida, ya resueltos: el titular por defecto es el de mayor sueldo; el Euribor, con sus cuotas. */
function previsionV2ParamsFor(id, input, today) {
  const S = globalThis.FinanceCanonicalStressScenarios;
  if (id === "sueldo-menos") {
    const lista = S.titulares(input, today);
    const concept = lista.some((item) => item.concept === previsionV2Params.concept) ? previsionV2Params.concept : lista[0]?.concept || "";
    return { concept, months: previsionV2Params.months, titulares: lista };
  }
  if (id === "euribor") {
    const { reviews, missing } = previsionV2Revisiones(today);
    const shocks = reviews.length ? S.euriborShocks(reviews, previsionV2Params.points, globalThis.FinanceCanonicalRateReview.payment) : [];
    return { points: previsionV2Params.points, shocks, missing };
  }
  return {};
}

/** FX-21: la prueba de estrés con los motores de siempre (canonical-stress-scenarios.js), calculada solo al elegirla. */
function previsionV2Prueba(id, rows, today, to, floor) {
  const S = globalThis.FinanceCanonicalStressScenarios;
  if (!S || !id || typeof canonicalEngineInput !== "function") return null;
  let result = null;
  try {
    const input = canonicalEngineInput([], {});
    const params = previsionV2ParamsFor(id, input, today);
    const key = `${id}|${to}|${floor}|${JSON.stringify(params)}`;
    const cached = previsionV2Cache.get(key);
    if (cached && cached.rows === rows) return cached.result;
    result = S.evaluate(id, input, rows, previsionV2Deps(), { today, to, floor, params });
    if (result) result.params = params;
    previsionV2Cache.set(key, { rows, result });
  } catch {
    result = null; // sin prueba si el motor no puede recalcular: la previsión del plan se enseña igual
  }
  return result;
}

function previsionV2Active() {
  return document.documentElement.dataset.tema === "v2";
}

function previsionV2HorizonteId() {
  try {
    const guardado = localStorage.getItem("prevision-v2-horizonte");
    return PREVISION_V2_HORIZONTES.some((h) => h.id === guardado) ? guardado : "3m";
  } catch {
    return "3m";
  }
}

function previsionV2AddDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoLocalDate(date);
}

/** Los puntos del gráfico: cada día en 3 m, cada semana o quincena después y fin de mes hasta 2036. El día más bajo siempre entra. */
function previsionV2Serie(rows, today, horizonte) {
  const end = horizonte.dias === Infinity ? rows.at(-1)?.date || today : previsionV2AddDays(today, horizonte.dias);
  const tramo = rows.filter((row) => row.date >= today && row.date <= end && Number.isFinite(Number(row.total)));
  if (!tramo.length) return { tramo, puntos: [] };
  const low = globalThis.FinanceCanonicalForecastContract?.lowPoint(tramo, {});
  const elegido = (row, index) => index === 0 || index === tramo.length - 1 || row.date === low?.date
    || (horizonte.paso === "mes" ? row.date.slice(0, 7) !== tramo[index + 1]?.date.slice(0, 7) : index % horizonte.paso === 0);
  return { tramo, puntos: tramo.filter(elegido) };
}

function previsionV2Fecha(iso, today) {
  return globalThis.FinanceCanonicalForecastContract?.shortDateLabel(iso, today) || iso;
}

function previsionV2Lectura(row, floor, today, conMovimientos) {
  const margen = Number(row.total) - floor;
  const base = `${previsionV2Fecha(row.date, today)}: ${money(row.total)} previstos · ${margen < 0 ? `${money(Math.abs(margen))} por debajo del suelo` : `${money(margen)} sobre el suelo`}`;
  if (!conMovimientos) return `${base}.`;
  const grandes = (row.events || []).filter((event) => event.kind !== "transfer" && Number(event.amount) >= 50).slice(0, 3);
  return grandes.length ? `${base}. ${grandes.map((event) => `${event.label} ${event.kind === "income" ? "+" : "−"}${money(event.amount)}`).join(", ")}.` : `${base}.`;
}

function previsionV2HeroHtml({ tramo, horizonte, floor, today }) {
  const contract = globalThis.FinanceCanonicalForecastContract;
  const low = contract.lowPoint(tramo, {});
  if (!low) return "";
  const said = contract.describeLow(low, { today, monthLabel: (key) => (typeof escenarioMotorMonthLabel === "function" ? escenarioMotorMonthLabel(key) : key) });
  const margen = low.value - floor;
  const margenSaid = contract.roundForHorizon(Math.abs(margen), said.daysAhead);
  const finAno = tramo.find((row) => row.date === `${today.slice(0, 4)}-12-31`);
  const frase = [
    margen < 0
      ? `<strong class="prev-v2-bajo">${escapeHtml(money(margenSaid))} por debajo del suelo</strong> de ${escapeHtml(money(floor))}.`
      : `${escapeHtml(money(margenSaid))} por encima del suelo de ${escapeHtml(money(floor))}.`,
    finAno && finAno.date !== low.date ? `A 31 de diciembre, ${escapeHtml(money(contract.roundForHorizon(finAno.total, contract.daysBetween(today, finAno.date))))}.` : "",
  ].filter(Boolean).join(" ");
  return `<div class="prev-v2-hero${margen < 0 ? " is-bad" : ""}">
    <p class="e19-eyebrow">Punto más bajo ${escapeHtml(horizonte.titulo)}</p>
    <p class="prev-v2-cifra">${said.approximate ? "<small>unos</small> " : ""}${escapeHtml(money(said.value))} <span class="prev-v2-cuando">${escapeHtml(said.when)}</span></p>
    <p class="prev-v2-frase">${frase}</p>
  </div>`;
}

function previsionV2GraficoHtml({ puntos, floor, today, horizonte, prueba = null }) {
  const kit = globalThis.ChartKit;
  if (!kit?.forecastPlotHtml || puntos.length < 2) return "";
  const markers = horizonte.paso === "mes" ? [] : puntos
    .map((row, index) => ({ index, ingreso: (row.events || []).filter((event) => event.kind === "income").reduce((sum, event) => sum + Number(event.amount || 0), 0) }))
    .filter((item) => item.ingreso >= PREVISION_V2_GRANDE)
    .map((item) => ({ index: item.index, label: `Cobro del ${previsionV2Fecha(puntos[item.index].date, today)}: ${money(item.ingreso)}` }));
  const plot = kit.forecastPlotHtml({
    points: puntos.map((row, index) => ({ label: row.date, plan: Number(row.total), real: index === 0 ? Number(row.total) : null })),
    ariaLabel: `Saldo previsto ${horizonte.titulo}, con el suelo de ${money(floor)}`,
    threshold: { value: floor, label: "suelo" },
    todayIndex: 0,
    markers,
    scenarios: prueba?.rows?.length
      ? [{ name: previsionV2Corto(prueba), values: puntos.map((row) => { const hit = prueba.rows.find((item) => item.date === row.date); return hit ? Number(hit.total) : null; }) }]
      : [],
    format: (value) => money(value),
  });
  const readings = puntos.map((row) => previsionV2Lectura(row, floor, today, horizonte.paso === 1));
  return kit.figureHtml({
    id: "prevision-v2", plotHtml: plot.svg + plot.overlayHtml, plotClass: "prev-v2-plot", readings, xs: plot.xs,
    sliderLabel: `Recorrer la previsión ${horizonte.titulo}`,
    table: { caption: `Saldo previsto ${horizonte.titulo}`, columns: ["Día", "Saldo previsto", "Sobre el suelo"], rows: puntos.map((row) => [previsionV2Fecha(row.date, today), money(row.total), money(Number(row.total) - floor)]) },
  });
}

/** El nombre corto de la prueba, para la línea del gráfico y la cabecera de la tabla. */
function previsionV2Corto(prueba) {
  return prueba.preset.id === "euribor" ? `Euribor +${prueba.params?.points || 1}` : prueba.preset.short;
}

/** Cómo empieza la frase de cada prueba: «Sin «X» durante 3 meses», «Si el Euribor sube 1 punto…», «Con un imprevisto…». */
function previsionV2Cuando(prueba, today) {
  const info = prueba.info || {};
  if (prueba.preset.id === "sueldo-menos") return `Sin «${info.concept}» durante ${info.months} meses`;
  if (prueba.preset.id === "euribor") {
    const puntos = prueba.params?.points || 1;
    return `Si el Euribor sube ${puntos} ${puntos === 1 ? "punto" : "puntos"} en la revisión del ${previsionV2Fecha(info.shocks?.[0]?.date, today)}`;
  }
  return `Con un imprevisto de ${money(info.amount)} el ${previsionV2Fecha(info.date, today)}`;
}

/** La nota de debajo: qué se ha cambiado exactamente, para que se pueda comprobar. */
function previsionV2Nota(prueba, today) {
  const info = prueba.info || {};
  const mes = (key) => (typeof escenarioMotorMonthLabel === "function" ? escenarioMotorMonthLabel(key) : key);
  if (prueba.preset.id === "sueldo-menos") return info.from === info.to ? `Se quita «${info.concept}» en ${mes(info.from)}.` : `Se quita «${info.concept}» de ${mes(info.from)} a ${mes(info.to)}.`;
  if (prueba.preset.id === "euribor") {
    return (info.shocks || []).map((shock) => shock.extra > 0
      ? `Cuota de la hipoteca de ${money(shock.from)} a ${money(shock.to)} al mes desde el ${previsionV2Fecha(shock.date, today)} (tipo ${String(shock.rate).replace(".", ",")} %).`
      : `Con un tipo del ${String(shock.rate).replace(".", ",")} % la cuota no sube (${money(shock.to)} frente a ${money(shock.from)} de ahora).`).join(" ");
  }
  return "";
}

/** Las opciones de la prueba elegida: de quién y cuántos meses para el sueldo; cuántos puntos para el Euribor. */
function previsionV2OpcionesHtml(prueba) {
  const grupo = (titulo, param, opciones, actual) => `<div class="prev-v2-opcion"><span class="prev-v2-comparar-titulo" id="prevV2Op-${param}">${escapeHtml(titulo)}</span><div class="registrar-mes-filters" role="group" aria-labelledby="prevV2Op-${param}">${opciones
    .map(([valor, texto]) => `<button type="button" class="registrar-mes-filter${String(valor) === String(actual) ? " is-active" : ""}" data-prevision-v2-param="${param}" data-valor="${escapeHtml(String(valor))}" aria-pressed="${String(valor) === String(actual)}">${escapeHtml(texto)}</button>`)
    .join("")}</div></div>`;
  const S = globalThis.FinanceCanonicalStressScenarios;
  const params = prueba?.params || {};
  if (previsionV2Escenario === "sueldo-menos" && params.titulares?.length) {
    return `<div class="prev-v2-opciones">${params.titulares.length > 1 ? grupo("De quién", "concept", params.titulares.map((item) => [item.concept, item.concept]), params.concept) : ""}${grupo("Durante", "months", S.SUELDO_MESES.map((n) => [n, `${n} meses`]), params.months)}</div>`;
  }
  if (previsionV2Escenario === "euribor" && params.shocks?.length) {
    return `<div class="prev-v2-opciones">${grupo("Cuánto sube", "points", S.EURIBOR_PUNTOS.map((n) => [n, `+${n} ${n === 1 ? "punto" : "puntos"}`]), params.points)}</div>`;
  }
  return "";
}

/** FX-20: la fila «Comparar con…» y, con una prueba elegida, su impacto frente al plan, siempre en el mismo orden. */
function previsionV2CompararHtml(prueba, today) {
  const S = globalThis.FinanceCanonicalStressScenarios;
  if (!S) return "";
  const chips = [{ id: "", short: "Solo el plan" }, ...S.PRESETS].map((preset) => `<button type="button" class="registrar-mes-filter${preset.id === previsionV2Escenario ? " is-active" : ""}" data-prevision-v2-prueba="${preset.id}" aria-pressed="${preset.id === previsionV2Escenario}"${preset.label ? ` title="${escapeHtml(preset.label)}"` : ""}>${escapeHtml(preset.short)}</button>`).join("");
  const fila = `<div class="prev-v2-comparar"><span class="prev-v2-comparar-titulo" id="prevV2CompararTitulo">Comparar con</span><div class="registrar-mes-filters" role="group" aria-labelledby="prevV2CompararTitulo">${chips}</div></div>`;
  if (!previsionV2Escenario) return fila;
  const c = prueba?.comparison;
  if (!prueba?.applied || !c) {
    const motivo = prueba?.missing?.length
      ? `Para esta prueba falta ${prueba.missing.join(", ")}. <button type="button" class="hoy-v2-link" data-prevision-v2-nav="deuda-contratos">Ir a Deuda › Contratos</button>`
      : previsionV2Escenario === "sueldo-menos" ? "No hay ningún ingreso que llegue casi todos los meses para quitarlo." : "Esta prueba no se puede aplicar con los datos de ahora.";
    return `${fila}<p class="prev-v2-impacto-nota e19-kpi-note" role="status">${motivo}</p>`;
  }
  const contract = globalThis.FinanceCanonicalForecastContract;
  // Cada nivel se redondea según su horizonte (FX-04) y la diferencia es la resta de lo que se ve: 15.700 frente a 14.200 es −1.500.
  const redondea = (value, date) => contract.roundForHorizon(value, contract.daysBetween(today, date));
  const nivel = (low) => money(redondea(low.value, low.date));
  const resta = (base, prueba, date) => redondea(prueba, date) - redondea(base, date);
  // Una celda con cifra y día pone el día debajo, para que a 390 px quepan las cuatro columnas sin pisarse.
  const celda = (value) => (Array.isArray(value) ? `<td>${escapeHtml(value[0])}<small class="prev-v2-impacto-dia">${escapeHtml(value[1])}</small></td>` : `<td>${escapeHtml(value)}</td>`);
  const fin = (value) => money(redondea(value, c.yearEnd.date));
  const dif = (value) => (value === null ? "—" : value ? `${value < 0 ? "−" : "+"}${money(Math.abs(value))}` : "igual"); // ya redondeada
  const bajadaVista = redondea(c.low.value, c.low.date) - redondea(c.baseLow.value, c.baseLow.date);
  const filas = [
    ["Punto más bajo", [nivel(c.baseLow), previsionV2Fecha(c.baseLow.date, today)], [nivel(c.low), previsionV2Fecha(c.low.date, today)], dif(bajadaVista)],
    ["¿Bajáis del suelo?", c.baseCrossesFloor ? `Sí, el ${previsionV2Fecha(c.baseCrossDate, today)}` : "No", c.crossesFloor ? `Sí, el ${previsionV2Fecha(c.crossDate, today)}` : "No", c.shortfall ? `faltan ${money(contract.roundDifference(c.shortfall))}` : "—"],
    [`A 31 de diciembre`, c.yearEnd ? fin(c.yearEnd.base) : "—", c.yearEnd ? fin(c.yearEnd.shocked) : "—", c.yearEnd ? dif(resta(c.yearEnd.base, c.yearEnd.shocked, c.yearEnd.date)) : "—"],
  ];
  // El final del horizonte elegido, si no es el 31/12: ahí se ve lo que la prueba acumula (la cuota más alta, mes a mes).
  if (c.end && c.end.date !== c.yearEnd?.date) {
    filas.push([`A ${previsionV2Fecha(c.end.date, today)}`, money(redondea(c.end.base, c.end.date)), money(redondea(c.end.shocked, c.end.date)), dif(resta(c.end.base, c.end.shocked, c.end.date))]);
  }
  const cuando = previsionV2Cuando(prueba, today);
  const bajada = Math.abs(bajadaVista);
  // Si la prueba empieza después del horizonte (la revisión de la hipoteca cae más allá), se dice en vez de enseñar «igual».
  const empieza = prueba.preset.id === "euribor" ? prueba.info?.shocks?.[0]?.date : null;
  const fuera = Boolean(empieza && c.end && empieza > c.end.date);
  const frase = fuera
    ? `${cuando}, la cuota sube, pero eso cae después de este horizonte: elige 12 m o más para ver cuánto os quita.`
    : c.baseCrossesFloor
    ? `El plan ya baja del suelo el ${previsionV2Fecha(c.baseCrossDate, today)}. ${cuando}, el punto más bajo queda ${money(bajada)} más abajo y faltarían ${money(contract.roundDifference(c.shortfall))}.`
    : c.crossesFloor
    ? `${cuando}, bajáis del suelo el ${previsionV2Fecha(c.crossDate, today)}. Para evitarlo haría falta recortar unos ${money(contract.roundDifference(c.monthlyCut))} al mes de gasto hasta entonces, o tirar del plan B.`
    : `${cuando}, no bajáis del suelo: el punto más bajo queda ${nivel(c.low)} el ${previsionV2Fecha(c.low.date, today)}, ${bajada ? `${money(bajada)} por debajo del plan` : "igual que en el plan"}.`;
  const nota = previsionV2Nota(prueba, today);
  return `${fila}
    ${previsionV2OpcionesHtml(prueba)}
    <div class="prev-v2-impacto" role="status">
      <p class="prev-v2-impacto-frase${c.crossesFloor ? " is-bad" : ""}">${escapeHtml(frase)}</p>
      <table class="e19-table prev-v2-impacto-tabla">
        <caption class="sr-only">El plan frente a la prueba: ${escapeHtml(cuando)}</caption>
        <thead><tr><th scope="col">Indicador</th><th scope="col">Plan</th><th scope="col">${escapeHtml(previsionV2Corto(prueba))}</th><th scope="col">Diferencia</th></tr></thead>
        <tbody>${filas.map((fila) => `<tr><th scope="row">${escapeHtml(fila[0])}</th>${fila.slice(1).map(celda).join("")}</tr>`).join("")}</tbody>
      </table>
      <p class="e19-kpi-note">${nota ? `${escapeHtml(nota)} ` : ""}Es una prueba: no cambia el plan ni mueve dinero.</p>
    </div>`;
}

/** FX-12: los cobros y pagos grandes de los próximos 90 días, con su certeza y, si el día es estimado, el camino a Días de cargo. */
function previsionV2LoQueVieneHtml({ tramo, today }) {
  const fin = previsionV2AddDays(today, 90);
  const grandes = tramo
    .filter((row) => row.date <= fin)
    .flatMap((row) => (row.events || []).filter((event) => event.kind !== "transfer" && Number(event.amount) >= PREVISION_V2_GRANDE).map((event) => ({ ...event, date: row.date })));
  if (!grandes.length) return "";
  const estimados = grandes.filter((event) => event.confidence === "estimated").length;
  const certeza = { estimated: "día estimado", rule: "por regla", observed: "día cierto", declared: "día indicado por ti" };
  const items = grandes.slice(0, 12).map((event) => `<li class="prev-v2-viene-item">
      <span class="prev-v2-viene-dia">${escapeHtml(previsionV2Fecha(event.date, today))}</span>
      <span class="prev-v2-viene-que">${escapeHtml(event.label || "Sin nombre")}<small>${escapeHtml(certeza[event.confidence] || "previsto")}</small></span>
      <strong class="prev-v2-viene-importe${event.kind === "income" ? " is-pos" : ""}">${event.kind === "income" ? "+" : "−"}${escapeHtml(money(event.amount))}</strong>
    </li>`).join("");
  return `<details class="e19-card prev-v2-viene">
    <summary>Lo que viene en 90 días · ${grandes.length} ${grandes.length === 1 ? "cobro o pago grande" : "cobros y pagos grandes"}${estimados ? ` · ${estimados} con el día estimado` : ""}</summary>
    <ul class="prev-v2-viene-lista">${items}</ul>
    ${grandes.length > 12 ? `<p class="e19-kpi-note">Y ${grandes.length - 12} más. Todos, día a día, en la tabla del gráfico.</p>` : ""}
    ${estimados ? `<p class="e19-kpi-note">Los de día estimado mueven el punto más bajo. <button type="button" class="hoy-v2-link" data-prevision-v2-nav="planificacion-partidas">Decir el día de cargo</button></p>` : ""}
  </details>`;
}

function previsionV2Html({ rows, today, floor, horizonte }) {
  const { tramo, puntos } = previsionV2Serie(rows, today, horizonte);
  if (!tramo.length) return `<p class="hoy-v2-pending">Sin previsión desde hoy: pon los saldos para que la app pueda prever.</p>`;
  const segmentado = `<div class="registrar-mes-filters prev-v2-horizontes" role="group" aria-label="Horizonte de la previsión">${PREVISION_V2_HORIZONTES
    .map((h) => `<button type="button" class="registrar-mes-filter${h.id === horizonte.id ? " is-active" : ""}" data-prevision-v2-horizonte="${h.id}" aria-pressed="${h.id === horizonte.id}">${escapeHtml(h.label)}</button>`)
    .join("")}</div>`;
  const prueba = previsionV2Escenario ? previsionV2Prueba(previsionV2Escenario, rows, today, tramo.at(-1).date, floor) : null;
  return `${segmentado}
    <article class="e19-card prev-v2-card">
      ${previsionV2HeroHtml({ tramo, horizonte, floor, today })}
      ${previsionV2GraficoHtml({ puntos, floor, today, horizonte, prueba })}
      ${previsionV2CompararHtml(prueba, today)}
    </article>
    ${previsionV2LoQueVieneHtml({ tramo, today })}
    <p class="prev-v2-mas">
      <button type="button" class="hoy-v2-link" data-prevision-v2-nav="prevision">Rango probable, calidad del dato y acierto</button>
      <button type="button" class="hoy-v2-link" data-prevision-v2-detalle>Ver todo el detalle</button>
    </p>`;
}

/** Lo llama renderPlanPrevision() (app.js). Devuelve true si ha pintado la v2. */
function previsionV2Render() {
  const panel = document.querySelector(".e19-plan-prevision");
  const box = qs("planPrevisionV2");
  if (!panel || !box) return false;
  const rows = typeof canonicalDailyEngineRuns !== "undefined" ? canonicalDailyEngineRuns.active?.rows || [] : [];
  if (!previsionV2Active() || previsionV2Detalle || !rows.length || !globalThis.FinanceCanonicalForecastContract || !globalThis.ChartKit?.forecastPlotHtml) {
    panel.classList.remove("prevision-v2-on");
    box.hidden = true;
    box.innerHTML = "";
    return false;
  }
  const horizonte = PREVISION_V2_HORIZONTES.find((h) => h.id === previsionV2HorizonteId());
  const floor = globalThis.FinanceCanonicalHomeMargin?.normalizeFloor(state?.liquidityFloor) ?? 0;
  box.innerHTML = previsionV2Html({ rows, today: isoLocalDate(new Date()), floor, horizonte });
  box.hidden = false;
  panel.classList.add("prevision-v2-on");
  if (!qs("plan")?.hidden && !panel.closest("[data-plan-panel]")?.hidden) globalThis.FinanceMedidor?.anotar("prevision-v2", "vista"); // XGO-02
  return true;
}

function previsionV2Init() {
  qs("planPrevisionV2")?.addEventListener("click", (event) => {
    const horizonte = event.target.closest("[data-prevision-v2-horizonte]");
    if (horizonte) {
      try { localStorage.setItem("prevision-v2-horizonte", horizonte.dataset.previsionV2Horizonte); } catch { /* sin guardar: vale para esta visita */ }
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      previsionV2Render();
      qs("planPrevisionV2")?.querySelector(`[data-prevision-v2-horizonte="${horizonte.dataset.previsionV2Horizonte}"]`)?.focus();
      return;
    }
    const prueba = event.target.closest("[data-prevision-v2-prueba]");
    if (prueba) {
      previsionV2Escenario = prueba.dataset.previsionV2Prueba;
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      previsionV2Render();
      qs("planPrevisionV2")?.querySelector(`[data-prevision-v2-prueba="${previsionV2Escenario}"]`)?.focus();
      return;
    }
    const param = event.target.closest("[data-prevision-v2-param]");
    if (param) {
      const nombre = param.dataset.previsionV2Param;
      previsionV2Params[nombre] = nombre === "concept" ? param.dataset.valor : Number(param.dataset.valor);
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      previsionV2Render();
      qs("planPrevisionV2")?.querySelector(`[data-prevision-v2-param="${nombre}"][aria-pressed="true"]`)?.focus();
      return;
    }
    const nav = event.target.closest("[data-prevision-v2-nav]");
    if (nav) {
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      const target = nav.dataset.previsionV2Nav;
      if (document.getElementById(target)?.classList.contains("view-section")) {
        history.pushState(null, "", `#${target}`);
        setActiveView(target);
      }
      return;
    }
    if (event.target.closest("[data-prevision-v2-detalle]")) {
      previsionV2Detalle = true;
      globalThis.FinanceMedidor?.anotar("prevision-v2", "descarte");
      previsionV2Render();
      document.querySelector(".e19-plan-prevision")?.querySelector("table")?.focus?.();
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "complete") previsionV2Init();
  else document.addEventListener("DOMContentLoaded", previsionV2Init);
}
