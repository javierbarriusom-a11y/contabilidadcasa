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
let previsionV2Dia = { date: "", fijado: false }; // FX-10 PR-2: el día del panel; sin fijar, sigue al ratón
let previsionV2Pulsado = false; // un clic, un toque o una tecla sobre el gráfico fija el día
let previsionV2Ultimo = null; // lo último pintado, para repintar solo el panel al recorrer el gráfico
let previsionV2ConfianzaAbierta = false; // FX-31: la hoja de la insignia, hasta recargar

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
 * El suelo de la cuenta corriente (decisión del hogar del 6/11/2026): la reserva operativa de Ajustes, la misma que el motor deja en
 * la cuenta al traspasar el excedente al ahorro; sin reserva, 0 € (no quedar en descubierto). No es el colchón heredado de 2.500 €,
 * que el motor no usa.
 */
function previsionV2SueloCuenta() {
  const reserva = Number(state?.operatingReserve || 0);
  return Number.isFinite(reserva) && reserva > 0 ? reserva : 0;
}

/** Lo que hay que pasar del ahorro, redondeado hacia arriba (a la decena hasta 1.000 €, a la centena después): quedarse corto no sirve. */
function previsionV2HaciaArriba(value) {
  const paso = value < 1000 ? 10 : 100;
  return Math.ceil(Number(value) / paso) * paso;
}

/** «se queda en descubierto el 8 ene» o «baja de su reserva de 1.000 € el 8 ene». */
function previsionV2CuentaVerbo(cuenta, today) {
  return cuenta.floor > 0 ? `baja de su reserva de ${money(cuenta.floor)} el ${previsionV2Fecha(cuenta.crossDate, today)}` : `se queda en descubierto el ${previsionV2Fecha(cuenta.crossDate, today)}`;
}

/** Un saldo que puede ser negativo, redondeado según su horizonte (FX-04) y con el signo menos de verdad. */
function previsionV2Saldo(value, date, today) {
  const contract = globalThis.FinanceCanonicalForecastContract;
  const redondeado = contract ? contract.roundForHorizon(value, contract.daysBetween(today, date)) : Math.round(value);
  return redondeado < 0 ? `−${money(-redondeado)}` : money(redondeado);
}

/** La frase de la cuenta corriente: cuándo cruza, hasta dónde baja y cuánto pasar del ahorro antes (o que el ahorro no alcanza). */
function previsionV2CuentaFrase(cuenta, today) {
  const hasta = `hasta ${previsionV2Saldo(cuenta.low.value, cuenta.low.date, today)} el ${previsionV2Fecha(cuenta.low.date, today)}`;
  const importe = money(previsionV2HaciaArriba(cuenta.gap));
  if (cuenta.sweep) return `la cuenta corriente ${previsionV2CuentaVerbo(cuenta, today)} (${hasta}): bastaría con traspasar unos ${importe} menos al ahorro el ${previsionV2Fecha(cuenta.sweep.date, today)}${cuenta.sweep.label ? ` («${cuenta.sweep.label}»)` : ""}`;
  return cuenta.coveredBySavings
    ? `la cuenta corriente ${previsionV2CuentaVerbo(cuenta, today)} (${hasta}): habría que pasar unos ${importe} del ahorro antes de ese día`
    : `la cuenta corriente ${previsionV2CuentaVerbo(cuenta, today)} (${hasta}) y el ahorro de ese día no alcanza para cubrirlo`;
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
    const checkingFloor = previsionV2SueloCuenta();
    const key = `${id}|${to}|${floor}|${checkingFloor}|${JSON.stringify(params)}`;
    const cached = previsionV2Cache.get(key);
    if (cached && cached.rows === rows) return cached.result;
    result = S.evaluate(id, input, rows, previsionV2Deps(), { today, to, floor, checkingFloor, params });
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

/** La lectura de un punto del gráfico (y su texto para lectores de pantalla): el saldo y el margen, redondeados como el panel. El
 *  detalle de lo que mueve el día está en el panel del día (FX-10 PR-2), no se repite aquí. */
function previsionV2Lectura(row, floor, today) {
  const contract = globalThis.FinanceCanonicalForecastContract;
  const margen = Number(row.total) - floor;
  const margenDicho = money(contract.roundForHorizon(Math.abs(margen), contract.daysBetween(today, row.date)));
  return `${previsionV2Fecha(row.date, today)}: ${previsionV2Saldo(Number(row.total), row.date, today)} previstos · ${margen < 0 ? `${margenDicho} por debajo del suelo` : `${margenDicho} sobre el suelo`}.`;
}

function previsionV2HeroHtml({ tramo, horizonte, floor, today, confianza = null }) {
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
  // El suelo también en la cuenta corriente: si el propio plan la deja por debajo, se avisa aquí, con lo que hay que traspasar.
  const cuenta = globalThis.FinanceCanonicalStressScenarios?.checkingShortfall(tramo, { today, to: tramo.at(-1).date, checkingFloor: previsionV2SueloCuenta() });
  const avisoCuenta = cuenta?.crossDate ? `<p class="prev-v2-frase prev-v2-cuenta">Ojo: en el plan, ${escapeHtml(previsionV2CuentaFrase(cuenta, today))}.</p>` : "";
  return `<div class="prev-v2-hero${margen < 0 ? " is-bad" : ""}">
    <div class="prev-v2-hero-cabecera"><p class="e19-eyebrow">Punto más bajo ${escapeHtml(horizonte.titulo)}</p>${previsionV2InsigniaHtml(confianza)}</div>
    <p class="prev-v2-cifra">${said.approximate ? "<small>unos</small> " : ""}${escapeHtml(money(said.value))} <span class="prev-v2-cuando">${escapeHtml(said.when)}</span></p>
    <p class="prev-v2-frase">${frase}</p>
    ${avisoCuenta}
    ${previsionV2LibreHtml({ tramo, floor, margen, margenSaid, today })}
    ${previsionV2ConfianzaHojaHtml(confianza)}
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
  const readings = puntos.map((row) => previsionV2Lectura(row, floor, today));
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
  const nivel = (low) => previsionV2Saldo(low.value, low.date, today);
  const resta = (base, prueba, date) => redondea(prueba, date) - redondea(base, date);
  // Una celda con cifra y día pone el día debajo, para que a 390 px quepan las cuatro columnas sin pisarse.
  const celda = (value) => (Array.isArray(value) ? `<td>${escapeHtml(value[0])}<small class="prev-v2-impacto-dia">${escapeHtml(value[1])}</small></td>` : `<td>${escapeHtml(value)}</td>`);
  const fin = (value) => previsionV2Saldo(value, c.yearEnd.date, today);
  const dif = (value) => (value === null ? "—" : value ? `${value < 0 ? "−" : "+"}${money(Math.abs(value))}` : "igual"); // ya redondeada
  const bajadaVista = redondea(c.low.value, c.low.date) - redondea(c.baseLow.value, c.baseLow.date);
  const filas = [
    ["Punto más bajo", [nivel(c.baseLow), previsionV2Fecha(c.baseLow.date, today)], [nivel(c.low), previsionV2Fecha(c.low.date, today)], dif(bajadaVista)],
    ["¿Bajáis del suelo?", c.baseCrossesFloor ? `Sí, el ${previsionV2Fecha(c.baseCrossDate, today)}` : "No", c.crossesFloor ? `Sí, el ${previsionV2Fecha(c.crossDate, today)}` : "No", c.shortfall ? `faltan ${money(contract.roundDifference(c.shortfall))}` : "—"],
    [`A 31 de diciembre`, c.yearEnd ? fin(c.yearEnd.base) : "—", c.yearEnd ? fin(c.yearEnd.shocked) : "—", c.yearEnd ? dif(resta(c.yearEnd.base, c.yearEnd.shocked, c.yearEnd.date)) : "—"],
  ];
  const cuentaPlan = c.checking?.base;
  const cuentaPrueba = c.checking?.shocked;
  if (cuentaPlan && cuentaPrueba) {
    filas.splice(2, 0, ["Cuenta corriente, lo más bajo", [previsionV2Saldo(cuentaPlan.low.value, cuentaPlan.low.date, today), previsionV2Fecha(cuentaPlan.low.date, today)], [previsionV2Saldo(cuentaPrueba.low.value, cuentaPrueba.low.date, today), previsionV2Fecha(cuentaPrueba.low.date, today)], dif(redondea(cuentaPrueba.low.value, cuentaPrueba.low.date) - redondea(cuentaPlan.low.value, cuentaPlan.low.date))]);
  }
  // El final del horizonte elegido, si no es el 31/12: ahí se ve lo que la prueba acumula (la cuota más alta, mes a mes).
  if (c.end && c.end.date !== c.yearEnd?.date) {
    filas.push([`A ${previsionV2Fecha(c.end.date, today)}`, previsionV2Saldo(c.end.base, c.end.date, today), previsionV2Saldo(c.end.shocked, c.end.date, today), dif(resta(c.end.base, c.end.shocked, c.end.date))]);
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
  // El suelo también en la cuenta corriente: si la prueba la deja por debajo y el plan no, se dice a continuación.
  // Si el plan ya la deja por debajo, solo se dice cuando la prueba la hunde más, con lo que habría que pasar entonces.
  const cuentaPeor = Boolean(cuentaPrueba?.crossDate && cuentaPlan?.crossDate && cuentaPrueba.gap > cuentaPlan.gap + 0.5);
  const cuentaNueva = Boolean(cuentaPrueba?.crossDate && !cuentaPlan?.crossDate) && !fuera;
  const conector = c.crossesFloor ? "Además," : "Pero";
  const fraseCompleta = cuentaNueva
    ? `${frase} ${conector} ${previsionV2CuentaFrase(cuentaPrueba, today)}.`
    : cuentaPeor && !fuera
    ? `${frase} ${conector} la cuenta corriente, que en el plan ya baja de su suelo, bajaría hasta ${previsionV2Saldo(cuentaPrueba.low.value, cuentaPrueba.low.date, today)} el ${previsionV2Fecha(cuentaPrueba.low.date, today)}: habría que pasar unos ${money(previsionV2HaciaArriba(cuentaPrueba.gap))} del ahorro${cuentaPrueba.coveredBySavings ? "" : ", y el ahorro de ese día no alcanza"}.`
    : frase;
  const nota = previsionV2Nota(prueba, today);
  return `${fila}
    ${previsionV2OpcionesHtml(prueba)}
    <div class="prev-v2-impacto" role="status">
      <p class="prev-v2-impacto-frase${c.crossesFloor || cuentaNueva || cuentaPeor ? " is-bad" : ""}">${escapeHtml(fraseCompleta)}</p>
      <table class="e19-table prev-v2-impacto-tabla">
        <caption class="sr-only">El plan frente a la prueba: ${escapeHtml(cuando)}</caption>
        <thead><tr><th scope="col">Indicador</th><th scope="col">Plan</th><th scope="col">${escapeHtml(previsionV2Corto(prueba))}</th><th scope="col">Diferencia</th></tr></thead>
        <tbody>${filas.map((fila) => `<tr><th scope="row">${escapeHtml(fila[0])}</th>${fila.slice(1).map(celda).join("")}</tr>`).join("")}</tbody>
      </table>
      <p class="e19-kpi-note">${nota ? `${escapeHtml(nota)} ` : ""}Es una prueba: no cambia el plan ni mueve dinero.</p>
    </div>`;
}

// ---- FX-31 · La insignia de confianza ------------------------------------------------------------------------------
// Tres señales que ya existen (días de cargo WP-10, saldos WP-26, acierto WP-12) dichas como «Confianza baja · media · alta»
// en canonical-forecast-confidence.js. La tarea que más la sube sale de la cola de WP-45 (euros de incertidumbre por minuto, la
// misma de Registrar › Saldos) más una propia de Previsión: decir el día de cargo de los pagos grandes que aún no lo tienen.

const PREVISION_V2_SENAL_DE_TAREA = Object.freeze({ balances: "saldos", statement: "saldos", close: "acierto" });

function previsionV2Confianza(tramo, today) {
  const engine = globalThis.FinanceCanonicalForecastConfidence;
  const queue = globalThis.FinanceCanonicalDataQueue;
  if (!engine) return null;
  try {
    const fin = previsionV2AddDays(today, 90);
    const pagos = tramo.filter((row) => row.date <= fin)
      .flatMap((row) => (row.events || []).filter((event) => event.kind === "outflow" && Number(event.amount) > 0).map((event) => ({ ...event, date: row.date })));
    const dates = globalThis.FinanceCanonicalForecastQuality?.dateQuality(pagos) || { value: null };
    const modo = (state?.balanceMode || "auto") === "auto" ? "auto" : "manual";
    const fecha = String(state?.balanceDate || "").slice(0, 10);
    const balances = {
      mode: modo,
      ageDays: fecha ? globalThis.FinanceCanonicalForecastContract.daysBetween(fecha, today) : null,
      staleAfterDays: globalThis.FinanceCanonicalDataAge?.STALE_AFTER_DAYS ?? 4,
    };
    const backtest = globalThis.FinanceCanonicalLiquidityBacktest;
    const result = backtest && typeof readLiquidityBacktestStore === "function"
      ? backtest.evaluate({ store: readLiquidityBacktestStore(), closes: loadMonthCloseBalances(), today })
      : null;
    // La ventana con la que se titula el acierto (WP-12): la del día 15 si tiene bastantes cierres, si no la del día 1, si no la que más lleve.
    const ventana = result
      ? ["d15", "d01"].map((id) => result.slots.find((slot) => slot.slot === id)).find((slot) => slot?.enough)
        || result.slots.slice().sort((a, b) => b.n - a.n)[0]
      : null;
    // La antigua etiqueta «Fiabilidad de la previsión» (P3/PVC17): el error del neto mensual en los meses conciliados, dentro del acierto.
    const pvc17 = typeof pvc17PredictiveHealthIndex === "function" ? (() => { try { return pvc17PredictiveHealthIndex(); } catch { return null; } })() : null;
    const monthly = pvc17?.samples ? { samples: pvc17.samples, meanAbsoluteError: pvc17.meanAbsoluteError } : null;
    const closes = { comparable: ventana?.n || 0, min: result?.minCloses || 3, errorPct: ventana?.enough ? ventana.pct : null, monthly };
    return engine.evaluate({ dates, balances, closes, tasks: queue ? previsionV2Tareas(queue, pagos, today) : [] });
  } catch {
    return null; // sin insignia antes que una insignia equivocada
  }
}

/** Las tareas que suben alguna señal, en el orden de la cola de WP-45: primero las que tienen euros por minuto. */
function previsionV2Tareas(queue, pagos, today) {
  const datos = typeof datosTasks === "function" && typeof datosSources === "function"
    ? (() => { try { return datosTasks(queue, datosSources(today), today); } catch { return []; } })()
    : [];
  const tareas = datos.filter((task) => PREVISION_V2_SENAL_DE_TAREA[task.id]).map((task) => ({ ...task, signal: PREVISION_V2_SENAL_DE_TAREA[task.id] }));
  // Los pagos grandes con día estimado: cada partida cuenta una vez, con su pago más grande de los próximos 90 días.
  const porPartida = new Map();
  // El gasto variable (súper, gasolina…) no tiene día de cargo: no es una tarea, aunque cuente como estimado en el % de WP-10.
  pagos.filter((event) => event.field !== "variableOperationalSpend" && !["declared", "observed", "rule"].includes(event.confidence)).forEach((event) => {
    const label = String(event.label || "").trim();
    if (label) porPartida.set(label, Math.max(porPartida.get(label) || 0, Number(event.amount) || 0));
  });
  const grandes = [...porPartida.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (grandes.length) {
    tareas.push({
      id: "dias-de-cargo", signal: "dias",
      label: grandes.length === 1 ? `Decir el día de cargo de «${grandes[0][0]}»` : `Decir el día de cargo de las ${grandes.length} partidas más grandes`,
      detail: grandes.map(([label]) => label).join(", "),
      uncertainty: Math.round(grandes.reduce((sum, [, amount]) => sum + amount, 0) * 100) / 100,
      basis: "lo que suman esos pagos: cualquiera de ellos puede caer otro día",
      minutes: queue.taskMinutes({ measuredSeconds: [], assumedMinutes: grandes.length * 0.5 }),
      action: { label: "Decir el día de cargo", nav: "planificacion-partidas" },
    });
  }
  if (!tareas.some((task) => task.signal === "acierto")) {
    tareas.push({
      id: "cierre-firmar", signal: "acierto", label: "Firmar cada cierre de mes con los saldos del banco", uncertainty: null,
      reasonUnknown: "Cada cierre firmado con los saldos del banco mide cuánto acierta la previsión; hacen falta 3.",
      minutes: queue.taskMinutes({ measuredSeconds: [], assumedMinutes: 3 }), action: { label: "Ir a Cierre", nav: "reconciliation" },
    });
  }
  const cola = queue.buildQueue({ tasks: tareas });
  return [...cola.ranked, ...cola.deadlines, ...cola.unestimated];
}

function previsionV2Minutos(minutes) {
  if (!minutes) return "";
  const segundos = Math.round(Number(minutes.value) * 60);
  const cuanto = segundos < 90 ? `${segundos} s` : `${String(Math.round(Number(minutes.value) * 10) / 10).replace(".", ",")} min`;
  return `unos ${cuanto} (${minutes.measured ? `medido en ${minutes.samples} usos` : "supuesto, sin medir"})`;
}

/** La insignia: un botón que despliega su hoja. `hojaId` permite pintarla también en Herramientas › Previsión (la misma, unificada). */
function previsionV2InsigniaHtml(confianza, { hojaId = "prevV2Confianza", abierta = previsionV2ConfianzaAbierta } = {}) {
  if (!confianza) return "";
  return `<button type="button" class="prev-v2-confianza" data-nivel="${escapeHtml(confianza.level)}" data-prevision-v2-confianza aria-expanded="${abierta}" aria-controls="${escapeHtml(hojaId)}"><span class="prev-v2-confianza-punto" aria-hidden="true"></span>${escapeHtml(confianza.label)}<span class="prev-v2-confianza-flecha" aria-hidden="true">${abierta ? "▾" : "▸"}</span></button>`;
}

function previsionV2TareaAccion(task) {
  const action = task?.action;
  if (!action) return "";
  if (action.nav) return `<button type="button" class="e19-btn e19-btn-secondary" data-prevision-v2-nav="${escapeHtml(action.nav)}">${escapeHtml(action.label)}</button>`;
  return `<a class="e19-btn e19-btn-secondary" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`;
}

function previsionV2ConfianzaHojaHtml(confianza, { hojaId = "prevV2Confianza", abierta = previsionV2ConfianzaAbierta } = {}) {
  if (!confianza) return "";
  const estado = { ok: "bien", regular: "a medias", mal: "flojo" };
  const senales = confianza.signals.map((signal) => `<li class="prev-v2-senal" data-estado="${escapeHtml(signal.state)}">
      <span class="prev-v2-senal-icono" aria-hidden="true">${escapeHtml(signal.icon)}</span>
      <span><strong>${escapeHtml(signal.title)}</strong> · <span class="prev-v2-senal-estado">${escapeHtml(estado[signal.state])}</span><br>${escapeHtml(signal.text)}</span>
    </li>`).join("");
  const top = confianza.top;
  const cuanto = top
    ? (top.uncertainty
      ? `Quita hasta ${money(top.uncertainty)} de incertidumbre (${top.basis}), en ${previsionV2Minutos(top.minutes)}.`
      : `${top.reason || top.reasonUnknown || ""} Tiempo: ${previsionV2Minutos(top.minutes)}.`)
    : "";
  const sube = top
    ? `<div class="prev-v2-sube">
        <p class="e19-eyebrow">Lo que más la sube</p>
        <p><strong>${escapeHtml(top.label)}</strong>${top.detail ? `<br><small>${escapeHtml(top.detail)}</small>` : ""}</p>
        <p class="e19-kpi-note">${escapeHtml(cuanto)}</p>
        ${previsionV2TareaAccion(top)}
      </div>`
    : `<p>Las tres señales están bien: no hay nada que la suba.</p>`;
  const despues = confianza.more.length ? `<p class="e19-kpi-note">Después: ${escapeHtml(confianza.more.map((task) => task.label).join(" · "))}.</p>` : "";
  return `<section class="prev-v2-confianza-hoja" id="${escapeHtml(hojaId)}" aria-labelledby="${escapeHtml(hojaId)}Titulo"${abierta ? "" : " hidden"}>
    <h3 id="${escapeHtml(hojaId)}Titulo">Por qué la confianza es ${escapeHtml(confianza.level)}</h3>
    <ul class="prev-v2-senales">${senales}</ul>
    ${sube}
    ${despues}
    <p class="e19-kpi-note">La confianza no cambia ninguna cifra: dice cuánto fiarse de ellas.</p>
  </section>`;
}

// ---- FX-10 PR-2 · El panel del día ----------------------------------------------------------------------------------
// De PrevisionDesktop.png: a la derecha del gráfico en escritorio (debajo en móvil), el día elegido con su saldo, cómo se reparte
// entre la cuenta corriente y el ahorro, y qué lo mueve, con la certeza de cada cosa y «¿sabes el día?» en lo estimado. De
// entrada, el punto más bajo. Sigue al ratón; un clic, un toque o las flechas lo fijan. Lee las mismas filas del motor diario que
// el gráfico: no calcula nada nuevo.

const PREVISION_V2_CERTEZA = Object.freeze({ observed: "día cierto", rule: "día por regla", declared: "día indicado por ti", estimated: "día estimado" });

function previsionV2DiaElegido(ctx) {
  if (!ctx?.puntos?.length) return "";
  if (previsionV2Dia.date && ctx.puntos.some((row) => row.date === previsionV2Dia.date)) return previsionV2Dia.date;
  return globalThis.FinanceCanonicalForecastContract?.lowPoint(ctx.tramo, {})?.date || ctx.puntos[0].date;
}

function previsionV2FechaLarga(iso, today) {
  const dia = new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long" });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${previsionV2Fecha(iso, today)}`;
}

function previsionV2DiaItemHtml(event) {
  const label = event.label || "Sin nombre";
  if (event.kind === "transfer") {
    return `<li class="prev-v2-dia-item"><span class="prev-v2-dia-que">${escapeHtml(label)}<small>entre vuestras cuentas: no cambia el total</small></span><strong class="prev-v2-dia-importe">${escapeHtml(money(event.amount))}</strong></li>`;
  }
  const variable = event.field === "variableOperationalSpend";
  const estimado = event.kind === "outflow" && !variable && (event.confidence === "estimated" || !PREVISION_V2_CERTEZA[event.confidence]);
  const certeza = variable
    ? `<small>gasto variable, sin día fijo: se reparte por el mes</small>`
    : estimado
    ? `<small>día estimado · <button type="button" class="hoy-v2-link" data-prevision-v2-nav="planificacion-partidas" aria-label="¿Sabes el día de ${escapeHtml(label)}?">¿sabes el día?</button></small>`
    : `<small>${escapeHtml(PREVISION_V2_CERTEZA[event.confidence] || "previsto")}</small>`;
  const ingreso = event.kind === "income";
  return `<li class="prev-v2-dia-item"><span class="prev-v2-dia-que">${escapeHtml(label)}${certeza}</span><strong class="prev-v2-dia-importe${ingreso ? " is-pos" : ""}">${ingreso ? "+" : "−"}${escapeHtml(money(event.amount))}</strong></li>`;
}

function previsionV2DiaHtml(ctx, date) {
  const row = ctx?.tramo?.find((item) => item.date === date);
  if (!row) return "";
  const { today, floor, puntos, horizonte, prueba } = ctx;
  const contract = globalThis.FinanceCanonicalForecastContract;
  const esBajo = contract?.lowPoint(ctx.tramo, {})?.date === date;
  const margen = Number(row.total) - floor;
  const margenDicho = money(contract.roundForHorizon(Math.abs(margen), contract.daysBetween(today, date)));
  const lineas = [`${margen < 0 ? `${margenDicho} por debajo del suelo` : `${margenDicho} sobre el suelo`}.`];
  if (Number.isFinite(Number(row.checking)) && Number.isFinite(Number(row.savings))) {
    const suelo = previsionV2SueloCuenta();
    const bajo = Number(row.checking) < suelo - 0.5;
    lineas.push(`Cuenta corriente ${previsionV2Saldo(Number(row.checking), date, today)}${bajo ? (suelo > 0 ? " (bajo su reserva)" : " (en descubierto)") : ""} · ahorro ${previsionV2Saldo(Number(row.savings), date, today)}.`);
  }
  let conPrueba = "";
  const hit = prueba?.applied && prueba.rows?.find((item) => item.date === date);
  if (hit) {
    const dias = contract.daysBetween(today, date);
    const diferencia = contract.roundForHorizon(Number(hit.total), dias) - contract.roundForHorizon(Number(row.total), dias);
    conPrueba = `<p class="prev-v2-dia-prueba">Con «${escapeHtml(previsionV2Corto(prueba))}»: <strong>${escapeHtml(previsionV2Saldo(Number(hit.total), date, today))}</strong> (${diferencia ? `${diferencia < 0 ? "−" : "+"}${escapeHtml(money(Math.abs(diferencia)))}` : "igual"})</p>`;
  }
  const eventos = (row.events || []).filter((event) => Number(event.amount) > 0)
    .slice().sort((a, b) => (a.kind === "income") - (b.kind === "income") || (a.kind === "transfer") - (b.kind === "transfer") || Number(b.amount) - Number(a.amount));
  const lista = eventos.length
    ? `<ul class="prev-v2-dia-lista" aria-label="Lo que entra y sale ese día">${eventos.map(previsionV2DiaItemHtml).join("")}</ul>`
    : `<p class="prev-v2-dia-nada">Ese día el plan no mueve nada: el saldo sigue igual.</p>`;
  // En 12 m, 24 m y hasta 2036 cada punto del gráfico resume varios días: lo que entra y sale desde el punto anterior.
  let tramoResumen = "";
  const index = puntos.findIndex((item) => item.date === date);
  if (horizonte.paso !== 1 && index > 0) {
    const desde = puntos[index - 1].date;
    const entre = ctx.tramo.filter((item) => item.date > desde && item.date <= date).flatMap((item) => item.events || []);
    const entra = entre.filter((event) => event.kind === "income").reduce((sum, event) => sum + Number(event.amount || 0), 0);
    const sale = entre.filter((event) => event.kind === "outflow").reduce((sum, event) => sum + Number(event.amount || 0), 0);
    tramoResumen = `<p class="e19-kpi-note">Desde el ${escapeHtml(previsionV2Fecha(desde, today))}: entran ${escapeHtml(money(entra))} y salen ${escapeHtml(money(sale))}.</p>`;
  }
  const volver = previsionV2Dia.fijado && !esBajo ? `<button type="button" class="hoy-v2-link" data-prevision-v2-dia-soltar>Volver al punto más bajo</button>` : "";
  return `<aside class="prev-v2-dia" aria-labelledby="prevV2DiaTitulo">
    <p class="e19-eyebrow">${esBajo ? "Día seleccionado · el más bajo" : "Día seleccionado"}</p>
    <div class="prev-v2-dia-cabecera"><p class="prev-v2-dia-fecha" id="prevV2DiaTitulo">${escapeHtml(previsionV2FechaLarga(date, today))}</p><strong class="prev-v2-dia-saldo">${escapeHtml(previsionV2Saldo(Number(row.total), date, today))}</strong></div>
    <p class="prev-v2-dia-sub">${escapeHtml(lineas.join(" "))}</p>
    ${conPrueba}
    <p class="e19-eyebrow prev-v2-dia-mueve">Qué lo mueve</p>
    ${lista}
    ${tramoResumen}
    <p class="e19-kpi-note prev-v2-dia-pista">${previsionV2Dia.fijado ? "Día fijado." : "Recorre el gráfico con el ratón, el dedo o ← →; al hacer clic o tocar, el día se queda fijo."} ${volver}</p>
  </aside>`;
}

function previsionV2PintaDia() {
  const hueco = qs("planPrevisionV2")?.querySelector(".prev-v2-dia-hueco");
  if (hueco && previsionV2Ultimo) hueco.innerHTML = previsionV2DiaHtml(previsionV2Ultimo, previsionV2DiaElegido(previsionV2Ultimo));
}

/** Tras pintar, el cursor del gráfico en el día del panel (de entrada, el punto más bajo). */
function previsionV2CursorAlDia(box) {
  const slider = box.querySelector('[data-ck-id="prevision-v2"] .ck-scrub');
  const index = previsionV2Ultimo?.puntos?.findIndex((row) => row.date === previsionV2DiaElegido(previsionV2Ultimo)) ?? -1;
  if (slider && index >= 0) globalThis.ChartKit?.select?.(slider, index);
}

// ---- XPR-07 dentro de C2 · El arreglo más barato -------------------------------------------------------------------
// La tarjeta de descubierto-ui.js (motor canonical-overdraft-fix.js), con la trayectoria que pinta esta pantalla (el motor diario) y el
// mismo suelo. Solo si la liquidez baja del suelo en los próximos 30 días, y sigue con su interruptor de Funciones en prueba hasta su
// revisión del 12/11 (no se gradúa sin el hogar).
function previsionV2ArregloHtml({ tramo, floor, today }) {
  const engine = globalThis.FinanceCanonicalOverdraftFix;
  if (!engine || typeof descubiertoOn !== "function" || !descubiertoOn() || typeof descubiertoHtml !== "function") return "";
  try {
    const fin = previsionV2AddDays(today, 30);
    const days = tramo.filter((row) => row.date <= fin).map((row) => ({ date: row.date, central: Number(row.total) }));
    const deficit = engine.findDeficit({ days, floor });
    if (!deficit) return "";
    const levers = engine.levers({
      discretionary: descubiertoDiscrecional(today, deficit.lowestDate),
      cushion: true,
      creditLine: { limit: emergencyCreditLimit(), ratePct: emergencyCreditRate(), months: 3 },
    });
    const solution = engine.solve({ shortfall: deficit.shortfall, levers: levers.list });
    globalThis.FinanceMedidor?.anotar("descubierto", "vista"); // XGO-02: la misma métrica que la tarjeta de siempre
    return `<section class="e19-card prev-v2-arreglo" aria-labelledby="prevV2ArregloTitulo">
      <h3 id="prevV2ArregloTitulo">Para no bajar del suelo el ${escapeHtml(descubiertoFecha(deficit.date))}</h3>
      ${descubiertoHtml(engine, deficit, solution, levers.missing, { capasDonde: "Herramientas › Previsión", origen: "la trayectoria del gráfico de arriba" })}
    </section>`;
  } catch {
    return "";
  }
}

// ---- XPR-08 con D-N9 (b) · De verdad libre ------------------------------------------------------------------------
// Decisión del hogar del 7/11/2026: una sola cifra. Lo que queda sobre el suelo en el punto más bajo ya descuenta lo que el plan pone
// dentro del horizonte; de verdad libre es eso menos lo que el plan aún no descuenta: lo que no está en el plan y cae dentro (entero) y
// la parte ya devengada de lo que cae después (`provisions` de canonical-large-payments.js, sobre el mismo mapa de pagos grandes de
// WP-49). Solo sale cuando hay algo que restar: si no, lo libre es la cifra de arriba y repetirla sería ruido. No aparta nada (A11-4):
// dice cuánto apartar al mes y lleva al mapa.
function previsionV2LibreHtml({ tramo, floor, margen, margenSaid, today }) {
  const engine = globalThis.FinanceCanonicalLargePayments;
  if (!engine?.provisions || typeof mapaPagosBuild !== "function" || !(margen >= 0) || !tramo?.length) return "";
  try {
    const map = mapaPagosBuild(engine);
    const prov = engine.provisions({ items: map.months.flatMap((month) => month.items), today, horizonEnd: tramo.at(-1).date });
    // Lo que no está en el plan resta desde su día: se aplica a la trayectoria y se vuelve a buscar el punto más bajo. Si cae cuando el
    // saldo ya ha subido, no come nada de lo libre.
    const fuera = prov.items.filter((item) => item.reason === "no-esta-en-el-plan");
    const minimo = Math.min(...tramo.map((row) => Number(row.total) - floor - fuera.filter((item) => item.date <= row.date).reduce((sum, item) => sum + item.part, 0)));
    const porFuera = Math.max(0, margen - minimo);
    const devengados = prov.items.filter((item) => item.reason === "devengado");
    const devengado = devengados.reduce((sum, item) => sum + item.part, 0);
    if (!(porFuera + devengado > 0.5)) return "";
    const ya = previsionV2HaciaArriba(porFuera + devengado);
    const libre = margenSaid - ya;
    const contract = globalThis.FinanceCanonicalForecastContract;
    const cuando = (date) => previsionV2Fecha(date, today);
    const partes = devengados.slice(0, 3).map((item) => `${item.label} (${money(item.amount)} el ${cuando(item.date)}; van ${item.elapsed} de ${item.cycle} meses: ${money(contract.roundDifference(item.part))})`);
    if (devengados.length > 3) partes.push(`${devengados.length - 3} más`);
    if (porFuera > 0.5) partes.push(`${money(contract.roundDifference(porFuera))} por lo que no está en el plan: ${fuera.map((item) => `${item.label} (${money(item.part)} el ${cuando(item.date)})`).join(", ")}`);
    const cifra = libre >= 0
      ? `<strong>De verdad libre: ${escapeHtml(money(libre))}.</strong>`
      : `<strong>De verdad libre: nada.</strong> Lo que viene se come lo libre y faltarían ${escapeHtml(money(-libre))}.`;
    const apartar = prov.monthly > 0.5 ? `Apartando unos ${escapeHtml(money(previsionV2HaciaArriba(prov.monthly)))} al mes, esos pagos no tocarán el colchón. ` : "";
    return `<div class="prev-v2-libre${libre < 0 ? " is-bad" : ""}">
      <p>${cifra} De los ${escapeHtml(money(margenSaid))} sobre el suelo, ${escapeHtml(money(ya))} ya son de lo que viene y el plan aún no descuenta: ${escapeHtml(partes.join("; "))}.</p>
      <p class="e19-kpi-note">${apartar}<button type="button" class="hoy-v2-link" data-prevision-v2-mapa>Ver el mapa de pagos grandes</button></p>
    </div>`;
  } catch {
    return "";
  }
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
  previsionV2Ultimo = { tramo, puntos, today, floor, horizonte, prueba };
  return `${segmentado}
    <article class="e19-card prev-v2-card con-dia">
      ${previsionV2HeroHtml({ tramo, horizonte, floor, today, confianza: previsionV2Confianza(tramo, today) })}
      ${previsionV2GraficoHtml({ puntos, floor, today, horizonte, prueba })}
      <div class="prev-v2-dia-hueco">${previsionV2DiaHtml(previsionV2Ultimo, previsionV2DiaElegido(previsionV2Ultimo))}</div>
      <div class="prev-v2-comparar-bloque">${previsionV2CompararHtml(prueba, today)}</div>
    </article>
    ${previsionV2ArregloHtml({ tramo, floor, today })}
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
  previsionV2CursorAlDia(box);
  panel.classList.add("prevision-v2-on");
  if (!qs("plan")?.hidden && !panel.closest("[data-plan-panel]")?.hidden) globalThis.FinanceMedidor?.anotar("prevision-v2", "vista"); // XGO-02
  return true;
}

/** Abre o cierra la hoja de una insignia (la de Plan › Previsión o la de Herramientas › Previsión). Devuelve si queda abierta. */
function previsionV2AbreHoja(insignia) {
  const abierta = insignia.getAttribute("aria-expanded") !== "true";
  insignia.setAttribute("aria-expanded", String(abierta));
  const flecha = insignia.querySelector(".prev-v2-confianza-flecha");
  if (flecha) flecha.textContent = abierta ? "▾" : "▸";
  const hoja = document.getElementById(insignia.getAttribute("aria-controls") || "");
  if (hoja) hoja.hidden = !abierta;
  return abierta;
}

/**
 * Unificación del 7/11 («unifica la etiqueta de fiabilidad con la insignia»): Herramientas › Previsión enseñaba «Fiabilidad de la
 * previsión: media/baja» (P3, solo el error del neto mensual) y podía contradecir a la insignia. Ahora pinta la misma insignia,
 * con su hoja, con los dos temas. La llama renderPrevisionReliabilityBadge() (app.js).
 */
function previsionV2InsigniaHerramientas(box) {
  if (!box) return;
  const today = isoLocalDate(new Date());
  const rows = typeof canonicalDailyEngineRuns !== "undefined" ? canonicalDailyEngineRuns.active?.rows || [] : [];
  const tramo = rows.filter((row) => row.date >= today && Number.isFinite(Number(row.total)));
  const confianza = tramo.length ? previsionV2Confianza(tramo, today) : null;
  const abierta = box.querySelector("[data-prevision-v2-confianza]")?.getAttribute("aria-expanded") === "true";
  box.innerHTML = confianza
    ? `${previsionV2InsigniaHtml(confianza, { hojaId: "previsionConfianzaHoja", abierta })}${previsionV2ConfianzaHojaHtml(confianza, { hojaId: "previsionConfianzaHoja", abierta })}`
    : "";
  if (!box.__confianzaEscucha) {
    box.__confianzaEscucha = true;
    box.addEventListener("click", (event) => {
      const insignia = event.target.closest("[data-prevision-v2-confianza]");
      if (insignia) { previsionV2AbreHoja(insignia); return; }
      const nav = event.target.closest("[data-prevision-v2-nav]");
      const target = nav?.dataset.previsionV2Nav;
      if (target && document.getElementById(target)?.classList.contains("view-section")) {
        history.pushState(null, "", `#${target}`);
        setActiveView(target);
      }
    });
  }
}

function previsionV2Init() {
  const box = qs("planPrevisionV2");
  // FX-10 PR-2: el panel del día sigue al punto elegido en el gráfico (ChartKit avisa con «ck-select»). Pasar el ratón solo
  // cambia el panel si el día no está fijado; un clic, un toque o una flecha lo fijan.
  const TECLAS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
  box?.addEventListener("pointerdown", (event) => {
    if (!event.target.closest?.('[data-ck-id="prevision-v2"] .ck-scrub')) return;
    previsionV2Pulsado = true;
    globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
  });
  box?.addEventListener("keydown", (event) => {
    if (event.target.closest?.('[data-ck-id="prevision-v2"] .ck-scrub') && TECLAS.includes(event.key)) previsionV2Pulsado = true;
  });
  const suelta = () => { previsionV2Pulsado = false; };
  document.addEventListener("pointerup", suelta);
  document.addEventListener("pointercancel", suelta);
  document.addEventListener("keyup", suelta);
  box?.addEventListener("ck-select", (event) => {
    if (!event.target.closest?.('[data-ck-id="prevision-v2"]')) return;
    const punto = previsionV2Ultimo?.puntos?.[event.detail?.index];
    if (!punto) return;
    if (previsionV2Dia.fijado && !previsionV2Pulsado) return;
    const cambia = punto.date !== previsionV2Dia.date || (previsionV2Pulsado && !previsionV2Dia.fijado);
    previsionV2Dia = { date: punto.date, fijado: previsionV2Dia.fijado || previsionV2Pulsado };
    if (cambia) previsionV2PintaDia();
  });
  box?.addEventListener("click", (event) => {
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
    const insignia = event.target.closest("[data-prevision-v2-confianza]");
    if (insignia) {
      previsionV2ConfianzaAbierta = previsionV2AbreHoja(insignia);
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      return;
    }
    if (event.target.closest("[data-prevision-v2-mapa]")) {
      const mapa = qs("mapaPagosCard");
      if (mapa) {
        mapa.scrollIntoView({ block: "start" });
        mapa.querySelector("h3")?.setAttribute("tabindex", "-1");
        mapa.querySelector("h3")?.focus({ preventScroll: true });
      }
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      return;
    }
    if (event.target.closest("[data-prevision-v2-dia-soltar]")) {
      previsionV2Dia = { date: "", fijado: false };
      previsionV2PintaDia();
      previsionV2CursorAlDia(box);
      box.querySelector('[data-ck-id="prevision-v2"] .ck-scrub')?.focus();
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
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
