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
// FX-12 (9/11/2026): «Lo que viene» y los hitos del gráfico, desde un umbral que se elige (150 € por defecto, como la propuesta)
// y se recuerda en este dispositivo.
const PREVISION_V2_UMBRALES = Object.freeze([150, 300, 1000]);
const PREVISION_V2_UMBRAL_KEY = "prevision-v2-umbral";

let previsionV2Detalle = false; // «Ver todo el detalle», hasta recargar
let previsionV2Escenario = ""; // FX-20: la prueba de estrés superpuesta, o «guardado:<id>» para un escenario guardado; hasta recargar
let previsionV2Segunda = ""; // FX-20 (7/11): una segunda prueba a la vez, sobre la misma trayectoria; hasta recargar
const previsionV2Params = { concept: "", months: 3, points: 1, amount: 3000 }; // FX-21 (D-N3): de quién, cuántos meses y cuántos puntos
const previsionV2Cache = new Map(); // FX-21: cada prueba se calcula una vez por trayectoria del plan y parámetros
let previsionV2Dia = { date: "", fijado: false }; // FX-10 PR-2: el día del panel; sin fijar, sigue al ratón
let previsionV2Pulsado = false; // un clic, un toque o una tecla sobre el gráfico fija el día
let previsionV2Ultimo = null; // lo último pintado, para repintar solo el panel al recorrer el gráfico
let previsionV2ConfianzaAbierta = false; // FX-31: la hoja de la insignia, hasta recargar
let previsionV2CambiosAbierta = false; // FX-40: la hoja «por qué» de lo que ha cambiado, hasta recargar
let previsionV2VieneAbierto = false; // FX-12: «Lo que viene» sigue abierto al cambiar el umbral o repintar, hasta recargar
const PREVISION_V2_FOTOS = "prevision-v2-fotos"; // FX-40: fotos ligeras de la previsión en cada visita, en este dispositivo
let previsionV2GuardarAviso = null; // FX-21: por qué no se ha podido guardar la prueba ({ firma, text }), hasta la siguiente

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
 * La entrada del plan de la línea que se pinta (canonicalDailyEngineRuns.active): con los proyectos aprobados y las liquidaciones de
 * deuda programadas (projectPlan.outflows), como Escenarios. Sin ellas, una prueba se comparaba con otro plan: con una obra de
 * 4.000 € en diciembre, un imprevisto de 3.000 € dejaba el 31/12 1.000 € por encima del plan (8/11/2026).
 */
function previsionV2Entrada() {
  return canonicalEngineInput(typeof projectPlan !== "undefined" ? projectPlan?.outflows || [] : [], {});
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
/** WP-37 (8/11/2026): sin suelo fijado en Ajustes, la app usa el inicial (1.500 €); se dice, en vez de presentarlo como vuestro. */
function previsionV2SueloInicial() {
  const raw = state?.liquidityFloor;
  return raw === null || raw === undefined || raw === "";
}

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
  if (id === "imprevisto") return { amount: previsionV2Params.amount };
  return {};
}

/** FX-21: la prueba de estrés con los motores de siempre (canonical-stress-scenarios.js), calculada solo al elegirla. */
function previsionV2Prueba(id, rows, today, to, floor) {
  const S = globalThis.FinanceCanonicalStressScenarios;
  if (!S || !id || typeof canonicalEngineInput !== "function") return null;
  let result = null;
  try {
    const input = previsionV2Entrada();
    const params = previsionV2ParamsFor(id, input, today);
    const checkingFloor = previsionV2SueloCuenta();
    const key = `${id}|${to}|${floor}|${checkingFloor}|${JSON.stringify(params)}`;
    const cached = previsionV2Cache.get(key);
    if (cached && cached.rows === rows) return cached.result;
    result = S.evaluate(id, input, rows, previsionV2Deps(), { today, to, floor, checkingFloor, params });
    if (result) {
      result.params = params;
      result.decisions = S.toDecisions(result, input); // FX-21: lo que «Guardar como escenario» llevaría a Escenarios
    }
    previsionV2Cache.set(key, { rows, result });
  } catch {
    result = null; // sin prueba si el motor no puede recalcular: la previsión del plan se enseña igual
  }
  return result;
}

/**
 * FX-20 · dos pruebas a la vez: la elegida y la segunda, sobre la misma entrada del plan (canonical-stress-scenarios.js
 * evaluateCombined), con los mismos parámetros que cada una tiene sola. `paramsById` guarda los de cada una para sus opciones.
 */
function previsionV2PruebaDoble(ids, rows, today, to, floor) {
  const S = globalThis.FinanceCanonicalStressScenarios;
  if (!S?.evaluateCombined || ids.length !== 2 || typeof canonicalEngineInput !== "function") return null;
  let result = null;
  try {
    const input = previsionV2Entrada();
    const paramsById = Object.fromEntries(ids.map((id) => [id, previsionV2ParamsFor(id, input, today)]));
    const checkingFloor = previsionV2SueloCuenta();
    const key = `doble|${ids.join("+")}|${to}|${floor}|${checkingFloor}|${JSON.stringify(paramsById)}`;
    const cached = previsionV2Cache.get(key);
    if (cached && cached.rows === rows) return cached.result;
    result = S.evaluateCombined(ids.map((id) => ({ id, params: paramsById[id] })), input, rows, previsionV2Deps(), { today, to, floor, checkingFloor });
    if (result) {
      result.paramsById = paramsById;
      result.decisions = S.toDecisions(result, input);
    }
    previsionV2Cache.set(key, { rows, result });
  } catch {
    result = null;
  }
  return result;
}

/** Las pruebas de una prueba: ella sola, o las dos de una combinación (cada una con su preset, sus parámetros y lo que cambió). */
function previsionV2Partes(prueba) {
  return Array.isArray(prueba?.parts) ? prueba.parts : prueba ? [prueba] : [];
}

// ---- FX-20 · un escenario guardado en «Comparar con» (8/11/2026) -----------------------------------------------------------
// Los de Escenarios › Guardados que no están en el plan: los aplicados ya cuentan en la línea del plan (sus pagos de deuda van en
// projectPlan) y superponerlos los contaría dos veces. Se resuelven con el motor de Escenarios, con sus guardarraíles, sobre la
// misma entrada que la línea del plan, y se recalculan por días como las pruebas (canonical-stress-scenarios.js evaluateResolved).

const PREVISION_V2_GUARDADO = "guardado:";

function previsionV2Guardados() {
  if (typeof loadEscenarioMotorSaved !== "function" || typeof runEscenarioMotor !== "function") return [];
  return loadEscenarioMotorSaved().filter((entry) => entry?.id && !entry.archived && !["aplicado", "vigente"].includes(entry.estado) && Array.isArray(entry.decisiones) && entry.decisiones.length);
}

/** El nombre del escenario, recortado para la línea del gráfico y la cabecera de la tabla (a 390 px caben unas 22 letras). */
function previsionV2NombreCorto(nombre) {
  const limpio = String(nombre || "Escenario").replace(/^Prueba · /, "").trim();
  return limpio.length > 22 ? `${limpio.slice(0, 21).trimEnd()}…` : limpio;
}

/** El id del escenario guardado elegido en «Comparar con», o "". */
function previsionV2GuardadoElegido() {
  return previsionV2Escenario.startsWith(PREVISION_V2_GUARDADO) ? previsionV2Escenario.slice(PREVISION_V2_GUARDADO.length) : "";
}

/** «O un escenario guardado»: el selector con los que no están en el plan; sin ninguno, nada. */
function previsionV2GuardadoSelectorHtml(elegido) {
  const guardados = previsionV2Guardados();
  if (!guardados.length) return "";
  const opciones = guardados.map((entry) => `<option value="${escapeHtml(entry.id)}"${entry.id === elegido ? " selected" : ""}>${escapeHtml(entry.nombre || "Escenario guardado")}</option>`).join("");
  return `<div class="prev-v2-opcion prev-v2-guardados"><label class="prev-v2-comparar-titulo" for="prevV2Guardado">O un escenario guardado</label><select id="prevV2Guardado" data-prevision-v2-guardado><option value="">Ninguno</option>${opciones}</select></div>`;
}

/** Por qué no se puede enseñar el escenario guardado elegido, con el camino a Escenarios. */
function previsionV2GuardadoFalloHtml(prueba) {
  const motivo = prueba?.reason === "ninguna-aplicada" ? "Ninguna decisión de este escenario se aplica con los datos de ahora." : "Este escenario no se puede calcular con los datos de ahora.";
  return `<p class="prev-v2-impacto-nota e19-kpi-note" role="status">${motivo} <button type="button" class="hoy-v2-link" data-prevision-v2-nav="escenario-guardados">Ver en Escenarios</button></p>`;
}

function previsionV2PruebaGuardada(id, rows, today, to, floor) {
  const S = globalThis.FinanceCanonicalStressScenarios;
  const entry = previsionV2Guardados().find((item) => item.id === id);
  if (!S?.evaluateResolved || !entry) return null;
  let result = null;
  try {
    const checkingFloor = previsionV2SueloCuenta();
    const key = `guardado|${id}|${JSON.stringify(entry.decisiones)}|${entry.guardrailValue ?? ""}|${to}|${floor}|${checkingFloor}`;
    const cached = previsionV2Cache.get(key);
    if (cached && cached.rows === rows) return cached.result;
    const input = previsionV2Entrada();
    const guardrail = Number(entry.guardrailValue);
    const resolved = runEscenarioMotor(input, entry.decisiones, Number.isFinite(guardrail) && guardrail > 0 ? guardrail : null);
    result = S.evaluateResolved(resolved, input, rows, previsionV2Deps(), { today, to, floor, checkingFloor, label: entry.nombre || "Escenario guardado", short: previsionV2NombreCorto(entry.nombre) });
    if (result) result.entry = { id: entry.id, nombre: entry.nombre || "Escenario guardado", decisiones: entry.decisiones.length };
    previsionV2Cache.set(key, { rows, result });
  } catch {
    result = null;
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

function previsionV2HeroHtml({ tramo, horizonte, floor, today, confianza = null, cambios = null }) {
  const contract = globalThis.FinanceCanonicalForecastContract;
  const low = contract.lowPoint(tramo, {});
  if (!low) return "";
  const said = contract.describeLow(low, { today, monthLabel: (key) => (typeof escenarioMotorMonthLabel === "function" ? escenarioMotorMonthLabel(key) : key) });
  const margen = low.value - floor;
  const margenSaid = contract.roundForHorizon(Math.abs(margen), said.daysAhead);
  const finAno = tramo.find((row) => row.date === `${today.slice(0, 4)}-12-31`);
  const inicial = previsionV2SueloInicial();
  const suelo = `${inicial ? "suelo inicial" : "suelo"}`;
  const frase = [
    margen < 0
      ? `<strong class="prev-v2-bajo">${escapeHtml(money(margenSaid))} por debajo del ${suelo}</strong> de ${escapeHtml(money(floor))}.`
      : `${escapeHtml(money(margenSaid))} por encima del ${suelo} de ${escapeHtml(money(floor))}.`,
    finAno && finAno.date !== low.date ? `A 31 de diciembre, ${escapeHtml(money(contract.roundForHorizon(finAno.total, contract.daysBetween(today, finAno.date))))}.` : "",
  ].filter(Boolean).join(" ");
  // El suelo también en la cuenta corriente: si el propio plan la deja por debajo, se avisa aquí, con lo que hay que traspasar.
  const cuenta = globalThis.FinanceCanonicalStressScenarios?.checkingShortfall(tramo, { today, to: tramo.at(-1).date, checkingFloor: previsionV2SueloCuenta() });
  const avisoCuenta = cuenta?.crossDate ? `<p class="prev-v2-frase prev-v2-cuenta">Ojo: en el plan, ${escapeHtml(previsionV2CuentaFrase(cuenta, today))}.</p>` : "";
  return `<div class="prev-v2-hero${margen < 0 ? " is-bad" : ""}">
    <div class="prev-v2-hero-cabecera"><p class="e19-eyebrow">Punto más bajo ${escapeHtml(horizonte.titulo)}</p>${previsionV2InsigniaHtml(confianza)}</div>
    <p class="prev-v2-cifra">${said.approximate ? "<small>unos</small> " : ""}${escapeHtml(money(said.value))} <span class="prev-v2-cuando">${escapeHtml(said.when)}</span></p>
    ${previsionV2CambioHtml(cambios, { today, horizonte })}
    <p class="prev-v2-frase">${frase}</p>
    ${inicial ? `<p class="e19-kpi-note prev-v2-suelo-inicial">No habéis fijado vuestro suelo: la app usa ${escapeHtml(money(floor))} de inicio. <button type="button" class="hoy-v2-link" data-prevision-v2-suelo>Fijar el suelo</button></p>` : ""}
    ${avisoCuenta}
    ${previsionV2LibreHtml({ tramo, floor, margen, margenSaid, today })}
    ${previsionV2ConfianzaHojaHtml(confianza)}
  </div>`;
}

function previsionV2GraficoHtml({ puntos, floor, today, horizonte, prueba = null, hitos = [] }) {
  const kit = globalThis.ChartKit;
  if (!kit?.forecastPlotHtml || puntos.length < 2) return "";
  const markers = horizonte.paso === "mes" ? [] : previsionV2Marcadores(puntos, hitos, today);
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
/** La etiqueta del imprevisto con el importe elegido (la de siempre con 3.000 €). */
function previsionV2ImprevistoCorto(preset, amount) {
  const importe = Number(amount) > 0 ? Number(amount) : preset.amount;
  return importe === preset.amount ? preset.short : `Imprevisto ${money(importe)}`.replace(/\u00a0/g, " ");
}

function previsionV2CortoParte(parte) {
  if (parte.preset.id === "euribor") return `Euribor +${parte.params?.points || 1}`;
  if (parte.preset.id === "imprevisto") return previsionV2ImprevistoCorto(parte.preset, parte.params?.amount);
  return parte.preset.short;
}

/** Con dos pruebas, las dos unidas con «+»: «Un sueldo menos + Euribor +2». */
function previsionV2Corto(prueba) {
  return previsionV2Partes(prueba).map(previsionV2CortoParte).join(" + ");
}

/** Cómo empieza la frase de cada prueba: «Sin «X» durante 3 meses», «Si el Euribor sube 1 punto…», «Con un imprevisto…». */
function previsionV2CuandoParte(parte, today) {
  const info = parte.info || {};
  if (parte.preset.id === "guardado") return `Con «${parte.preset.label}»`;
  if (parte.preset.id === "sueldo-menos") return `Sin «${info.concept}» durante ${info.months} meses`;
  if (parte.preset.id === "euribor") {
    const puntos = parte.params?.points || 1;
    return `Si el Euribor sube ${puntos} ${puntos === 1 ? "punto" : "puntos"} en la revisión del ${previsionV2Fecha(info.shocks?.[0]?.date, today)}`;
  }
  return `Con un imprevisto de ${money(info.amount)} el ${previsionV2Fecha(info.date, today)}`;
}

/** Con dos pruebas: «Sin «X» durante 3 meses y si el Euribor sube 2 puntos en la revisión del …». */
function previsionV2Cuando(prueba, today) {
  return previsionV2Partes(prueba).map((parte, index) => {
    const texto = previsionV2CuandoParte(parte, today);
    return index ? texto.charAt(0).toLowerCase() + texto.slice(1) : texto;
  }).join(" y ");
}

/** La nota de debajo: qué se ha cambiado exactamente, para que se pueda comprobar. */
function previsionV2Nota(prueba, today) {
  return previsionV2Partes(prueba).map((parte) => previsionV2NotaParte(parte, today)).filter(Boolean).join(" ");
}

function previsionV2NotaParte(prueba, today) {
  const info = prueba.info || {};
  if (prueba.preset.id === "guardado") {
    const total = info.aplicadas + info.rechazadas;
    const rechazo = info.rechazadas ? ` ${info.rechazadas} de sus ${total} decisiones no se aplican con los datos de ahora (Escenarios dice por qué).` : "";
    return `Es el escenario de Escenarios › Guardados, recalculado con el plan de hoy.${rechazo} Escenarios cuenta por meses: el cierre de cada mes es el suyo; lo que paga de golpe cae aquí el día más bajo de su mes, y el resto, en los días de cobros y pagos de su mes.`;
  }
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
  const ids = [previsionV2Escenario, previsionV2Segunda].filter(Boolean);
  return ids.map((id) => previsionV2OpcionesDe(id, prueba?.paramsById?.[id] || (id === previsionV2Escenario ? prueba?.params : null) || {})).join("");
}

/** Las opciones de una prueba: de quién y cuántos meses para el sueldo; cuántos puntos para el Euribor; cuánto para el imprevisto. */
function previsionV2OpcionesDe(id, params) {
  const grupo = (titulo, param, opciones, actual) => `<div class="prev-v2-opcion"><span class="prev-v2-comparar-titulo" id="prevV2Op-${param}">${escapeHtml(titulo)}</span><div class="registrar-mes-filters" role="group" aria-labelledby="prevV2Op-${param}">${opciones
    .map(([valor, texto]) => `<button type="button" class="registrar-mes-filter${String(valor) === String(actual) ? " is-active" : ""}" data-prevision-v2-param="${param}" data-valor="${escapeHtml(String(valor))}" aria-pressed="${String(valor) === String(actual)}">${escapeHtml(texto)}</button>`)
    .join("")}</div></div>`;
  const S = globalThis.FinanceCanonicalStressScenarios;
  if (id === "sueldo-menos" && params.titulares?.length) {
    return `<div class="prev-v2-opciones">${params.titulares.length > 1 ? grupo("De quién", "concept", params.titulares.map((item) => [item.concept, item.concept]), params.concept) : ""}${grupo("Durante", "months", S.SUELDO_MESES.map((n) => [n, `${n} meses`]), params.months)}</div>`;
  }
  if (id === "euribor" && params.shocks?.length) {
    return `<div class="prev-v2-opciones">${grupo("Cuánto sube", "points", S.EURIBOR_PUNTOS.map((n) => [n, `+${n} ${n === 1 ? "punto" : "puntos"}`]), params.points)}</div>`;
  }
  if (id === "imprevisto" && S.IMPREVISTO_IMPORTES) {
    return `<div class="prev-v2-opciones">${grupo("Cuánto", "amount", S.IMPREVISTO_IMPORTES.map((n) => [n, money(n)]), params.amount)}</div>`;
  }
  return "";
}

/** FX-20: la fila «Comparar con…» y, con una prueba elegida, su impacto frente al plan, siempre en el mismo orden. */
function previsionV2CompararHtml(prueba, today) {
  const S = globalThis.FinanceCanonicalStressScenarios;
  if (!S) return "";
  const corto = (preset) => (preset.id === "imprevisto" ? previsionV2ImprevistoCorto(preset, previsionV2Params.amount) : preset.short);
  const chips = [{ id: "", short: "Solo el plan" }, ...S.PRESETS].map((preset) => `<button type="button" class="registrar-mes-filter${preset.id === previsionV2Escenario ? " is-active" : ""}" data-prevision-v2-prueba="${preset.id}" aria-pressed="${preset.id === previsionV2Escenario}"${preset.label ? ` title="${escapeHtml(preset.label)}"` : ""}>${escapeHtml(corto(preset))}</button>`).join("");
  const elegido = previsionV2GuardadoElegido();
  const fila = `<div class="prev-v2-comparar"><span class="prev-v2-comparar-titulo" id="prevV2CompararTitulo">Comparar con</span><div class="registrar-mes-filters" role="group" aria-labelledby="prevV2CompararTitulo">${chips}</div></div>${previsionV2GuardadoSelectorHtml(elegido)}`;
  if (!previsionV2Escenario) return fila;
  // FX-20: una segunda prueba a la vez, de las otras dos; «Ninguna» la quita.
  const otras = S.PRESETS.filter((preset) => preset.id !== previsionV2Escenario);
  const sumar = `<div class="prev-v2-opcion prev-v2-sumar"><span class="prev-v2-comparar-titulo" id="prevV2SumarTitulo">Sumar otra prueba</span><div class="registrar-mes-filters" role="group" aria-labelledby="prevV2SumarTitulo">${[{ id: "", short: "Ninguna" }, ...otras]
    .map((preset) => `<button type="button" class="registrar-mes-filter${preset.id === previsionV2Segunda ? " is-active" : ""}" data-prevision-v2-segunda="${preset.id}" aria-pressed="${preset.id === previsionV2Segunda}">${escapeHtml(corto(preset))}</button>`)
    .join("")}</div></div>`;
  const c = prueba?.comparison;
  // Un escenario guardado se combina en Escenarios, no aquí: sin «Sumar otra prueba».
  if (elegido && (!prueba?.applied || !c)) return `${fila}${previsionV2GuardadoFalloHtml(prueba)}`;
  if (!prueba?.applied || !c) {
    const fallo = prueba?.failed?.id || previsionV2Escenario;
    const cual = prueba?.combined ? ` («${prueba.failed?.short || ""}»)` : "";
    const motivo = prueba?.missing?.length
      ? `Para esta prueba${cual} falta ${prueba.missing.join(", ")}. <button type="button" class="hoy-v2-link" data-prevision-v2-nav="deuda-contratos">Ir a Deuda › Contratos</button>`
      : fallo === "sueldo-menos" ? "No hay ningún ingreso que llegue casi todos los meses para quitarlo." : "Esta prueba no se puede aplicar con los datos de ahora.";
    return `${fila}${previsionV2OpcionesHtml(prueba)}${sumar}<p class="prev-v2-impacto-nota e19-kpi-note" role="status">${motivo}</p>`;
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
  // FX-20: el colchón en meses en el punto más bajo, con el gasto corriente medio del plan en los dos lados (así la diferencia
  // son meses de gasto normal que se pierden, y un imprevisto no infla el gasto de un mes).
  const gasto = typeof escenarioMotorAverageCoreSpend === "function" && typeof canonicalEngineRuns !== "undefined" ? escenarioMotorAverageCoreSpend(canonicalEngineRuns.active?.rows || []) : 0;
  const colchonPlan = contract.cushionMonths?.(c.baseLow.value, gasto) ?? null;
  const colchonPrueba = contract.cushionMonths?.(c.low.value, gasto) ?? null;
  // Con «−» y no con el guion de toLocaleString, como el resto de cifras de la tabla.
  const decimaConSigno = (value) => `${value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  const meses = (value) => `${decimaConSigno(value)} ${Math.abs(value) === 1 ? "mes" : "meses"}`;
  // En la tabla, la unidad va en la etiqueta: «−0,7 meses» no cabe en la columna a 390 px.
  const decima = decimaConSigno;
  const difMeses = (value) => (value ? `${value < 0 ? "−" : "+"}${decima(Math.abs(value))}` : "igual");
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
  if (colchonPlan !== null && colchonPrueba !== null) {
    filas.splice(1, 0, ["Colchón en el punto más bajo (meses)", decima(colchonPlan), decima(colchonPrueba), difMeses(Math.round((colchonPrueba - colchonPlan) * 10) / 10)]);
  }
  // El final del horizonte elegido, si no es el 31/12: ahí se ve lo que la prueba acumula (la cuota más alta, mes a mes).
  if (c.end && c.end.date !== c.yearEnd?.date) {
    filas.push([`A ${previsionV2Fecha(c.end.date, today)}`, previsionV2Saldo(c.end.base, c.end.date, today), previsionV2Saldo(c.end.shocked, c.end.date, today), dif(resta(c.end.base, c.end.shocked, c.end.date))]);
  }
  const cuando = previsionV2Cuando(prueba, today);
  const bajada = Math.abs(bajadaVista);
  // Si la prueba empieza después del horizonte (la revisión de la hipoteca cae más allá), se dice en vez de enseñar «igual».
  const empieza = prueba.preset.id === "euribor" ? prueba.info?.shocks?.[0]?.date : null; // con dos pruebas, la otra ya se ve
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
  // El objetivo de colchón de Ajustes: se dice solo si la prueba lo rompe y el plan no.
  const objetivo = Math.max(0, Number(state?.emergencyBufferMonths) || 0);
  const rompeObjetivo = !fuera && objetivo > 0 && colchonPlan !== null && colchonPrueba !== null && colchonPlan >= objetivo && colchonPrueba < objetivo;
  const fraseFinal = rompeObjetivo
    ? `${fraseCompleta} El colchón en el punto más bajo baja de ${meses(colchonPlan)} a ${meses(colchonPrueba)} de gasto: por debajo de vuestro objetivo de ${objetivo} ${objetivo === 1 ? "mes" : "meses"}.`
    : fraseCompleta;
  const nota = previsionV2Nota(prueba, today);
  const notaColchon = colchonPlan !== null ? ` Colchón: cuántos meses de gasto corriente (${money(contract.roundForHorizon(gasto, 0))} al mes de media en los próximos 12) cubre la liquidez.` : "";
  // FX-20: con dos pruebas, cuánto baja el punto más bajo cada una sola y juntas (juntas pueden quitar más que la suma).
  const separado = prueba.combined ? previsionV2PorSeparado(prueba, today, redondea) : "";
  return `${fila}
    ${previsionV2OpcionesHtml(prueba)}
    ${elegido ? "" : sumar}
    <div class="prev-v2-impacto" role="status">
      <p class="prev-v2-impacto-frase${c.crossesFloor || cuentaNueva || cuentaPeor || rompeObjetivo ? " is-bad" : ""}">${escapeHtml(fraseFinal)}</p>
      <table class="e19-table prev-v2-impacto-tabla">
        <caption class="sr-only">El plan frente a la prueba: ${escapeHtml(cuando)}</caption>
        <thead><tr><th scope="col">Indicador</th><th scope="col">Plan</th><th scope="col">${escapeHtml(previsionV2Corto(prueba))}</th><th scope="col">Diferencia</th></tr></thead>
        <tbody>${filas.map((fila) => `<tr><th scope="row">${escapeHtml(fila[0])}</th>${fila.slice(1).map(celda).join("")}</tr>`).join("")}</tbody>
      </table>
      ${separado ? `<p class="e19-kpi-note prev-v2-separado">${escapeHtml(separado)}</p>` : ""}
      <p class="e19-kpi-note">${nota ? `${escapeHtml(nota)} ` : ""}${elegido ? "Verlo aquí no lo aplica" : "Es una prueba"}: no cambia el plan ni mueve dinero.${escapeHtml(notaColchon)}</p>
      ${previsionV2GuardarHtml(prueba)}
    </div>`;
}

/**
 * FX-20 · con dos pruebas, cuánto baja el punto más bajo cada una sola y las dos juntas, con las mismas cifras redondeadas que la
 * tabla. Juntas pueden quitar más que la suma: el traspaso al ahorro y el suelo de la cuenta no se suman, se encadenan.
 */
function previsionV2PorSeparado(prueba, today, redondea) {
  const ultimo = previsionV2Ultimo;
  const c = prueba.comparison;
  if (!ultimo?.rows || !c?.baseLow || !c?.low) return "";
  const to = ultimo.tramo.at(-1).date;
  const base = redondea(c.baseLow.value, c.baseLow.date);
  const bajada = (low) => Math.max(0, base - redondea(low.value, low.date));
  const solas = previsionV2Partes(prueba).map((parte) => {
    const sola = previsionV2Prueba(parte.preset.id, ultimo.rows, today, to, ultimo.floor);
    return sola?.applied && sola.comparison?.low ? { corto: previsionV2CortoParte(parte), baja: bajada(sola.comparison.low) } : null;
  });
  if (solas.some((sola) => !sola)) return "";
  const juntas = bajada(c.low);
  const suma = solas.reduce((total, sola) => total + sola.baja, 0);
  const cola = juntas > suma ? `: más que la suma de las dos (${money(suma)})` : "";
  return `Por separado, el punto más bajo baja ${solas.map((sola) => `${money(sola.baja)} con «${sola.corto}»`).join(" y ")}; juntas, ${money(juntas)}${cola}.`;
}

// ---- FX-21 · «Guardar como escenario» -----------------------------------------------------------------------------------
// La prueba pasa a Escenarios › Guardados con los tipos de fábrica (canonical-stress-scenarios.js toDecisions), en el mismo
// almacén que Deuda › Comparar y la pantalla de Escenarios, como «guardado»: no se aplica nada. Allí se carga en el simulador
// para seguir con ella (combinarla con otras decisiones, cambiar importes). Lo único que no pasa es el día: Escenarios cuenta
// por meses. Respeta los diez escenarios vivos de E-11b y no guarda dos veces la misma prueba.

function previsionV2Firma(decisions) {
  return JSON.stringify((decisions || []).map((decision) => ({ tipo: decision.tipo, params: decision.params })));
}

function previsionV2NombreEscenario(prueba) {
  return `Prueba · ${previsionV2Partes(prueba).map(previsionV2NombreParte).join(" + ")}`;
}

function previsionV2NombreParte(prueba) {
  const info = prueba.info || {};
  const mes = (key) => (typeof escenarioMotorMonthLabel === "function" ? escenarioMotorMonthLabel(key) : key);
  if (prueba.preset.id === "sueldo-menos") return `sin «${info.concept}» ${info.months} meses`;
  if (prueba.preset.id === "euribor") return `Euribor +${prueba.params?.points || 1}`;
  return `imprevisto de ${money(info.amount)} en ${mes(String(info.date || "").slice(0, 7))}`;
}

function previsionV2GuardarHtml(prueba) {
  // Un escenario guardado ya está en Escenarios: allí se edita, se combina o se aplica.
  if (prueba?.saved) return `<p class="prev-v2-guardar e19-kpi-note"><span>Para cambiarlo o aplicarlo, en Escenarios.</span> <button type="button" class="hoy-v2-link" data-prevision-v2-nav="escenario-guardados">Ver en Escenarios</button></p>`;
  const decisions = prueba?.decisions || [];
  if (!decisions.length || typeof loadEscenarioMotorSaved !== "function") return "";
  const firma = previsionV2Firma(decisions);
  const ver = `<button type="button" class="hoy-v2-link" data-prevision-v2-nav="escenario-guardados">Ver en Escenarios</button>`;
  if (loadEscenarioMotorSaved().some((entry) => !entry.archived && entry.firma === firma)) {
    return `<p class="prev-v2-guardar e19-kpi-note"><span>Guardada en Escenarios › Guardados, sin aplicar.</span> ${ver}</p>`;
  }
  const aviso = previsionV2GuardarAviso?.firma === firma ? `<span class="prev-v2-guardar-aviso">${escapeHtml(previsionV2GuardarAviso.text)}</span> ${ver}` : "";
  return `<p class="prev-v2-guardar e19-kpi-note"><button type="button" class="e19-btn e19-btn-secondary" data-prevision-v2-guardar>Guardar como escenario</button>${aviso}</p>`;
}

/** Guarda la prueba que se está viendo. Devuelve true si la ha guardado. */
function previsionV2GuardarEscenario() {
  const prueba = previsionV2Ultimo?.prueba;
  const decisions = prueba?.applied ? prueba.decisions || [] : [];
  if (!decisions.length || typeof loadEscenarioMotorSaved !== "function" || typeof saveEscenarioMotorSavedList !== "function" || typeof escenarioMotorNewDecisionId !== "function") return false;
  const firma = previsionV2Firma(decisions);
  const aviso = (text) => {
    previsionV2GuardarAviso = { firma, text };
    if (typeof announceStatus === "function") announceStatus(text);
    return false;
  };
  const saved = loadEscenarioMotorSaved();
  if (saved.some((entry) => !entry.archived && entry.firma === firma)) return false;
  if (saved.filter((entry) => !entry.archived).length >= 10) return aviso("Ya hay 10 escenarios en Escenarios › Guardados: archiva uno para hacer sitio. No se ha guardado nada.");
  const schema = globalThis.FinanceCanonicalScenarioSchema;
  if (!schema) return aviso("No se puede comprobar la prueba (falta el esquema de Escenarios). No se ha guardado nada.");
  const decisiones = decisions.map((item, orden) => ({ ...JSON.parse(JSON.stringify(item)), id: escenarioMotorNewDecisionId(), orden }));
  const issues = [];
  decisiones.forEach((decision) => schema.validateDecision(decision, "$", issues));
  if (issues.some((issue) => issue.severity === "error")) return aviso("Escenarios no admite esta prueba tal cual. No se ha guardado nada.");
  const nombre = previsionV2NombreEscenario(prueba);
  const nota = previsionV2Nota(prueba, ""); // con el año: el escenario se lee meses después
  if (typeof escenarioMotorSavedSeq === "number") escenarioMotorSavedSeq += 1;
  saved.unshift({
    id: `escenario-guardado-${Date.now()}-${typeof escenarioMotorSavedSeq === "number" ? escenarioMotorSavedSeq : 0}`,
    nombre,
    motivo: `Guardada desde Plan › Previsión, sin aplicar.${nota ? ` ${nota}` : ""}${previsionV2Partes(prueba).some((parte) => parte.preset.id === "imprevisto") ? " En Escenarios cuenta en su mes, no en su día." : ""}`,
    estado: "guardado",
    fecha: new Date().toISOString(),
    decisiones,
    guardrailValue: null,
    origen: "prevision-prueba",
    firma,
  });
  saveEscenarioMotorSavedList(saved);
  previsionV2GuardarAviso = null;
  if (typeof announceStatus === "function") announceStatus(`«${nombre}» guardada en Escenarios › Guardados. No se ha aplicado nada.`);
  return true;
}

// ---- FX-40 · Qué ha cambiado desde tu última visita ------------------------------------------------------------------------
// En cada visita la Previsión deja una foto ligera de su trayectoria (canonical-forecast-changes.js), una por día y en este
// dispositivo; la de hoy se rehace en cada pintado, así la de un día es lo último que se vio ese día. Bajo la cifra principal:
// cuánto se ha movido el punto más bajo frente a la visita anterior y, en su hoja, el puente con las cuatro causas.

function previsionV2FotosCargar() {
  try {
    return JSON.parse(storageGet(storageKey(PREVISION_V2_FOTOS), "[]"));
  } catch {
    return [];
  }
}

/** El puente con la visita anterior, o null; de paso deja (o rehace) la foto de hoy. Nunca rompe la Previsión. */
function previsionV2Cambios({ rows, tramo, today, horizonte }) {
  const E = globalThis.FinanceCanonicalForecastChanges;
  const contract = globalThis.FinanceCanonicalForecastContract;
  if (!E || !contract || typeof canonicalEngineInput !== "function" || !tramo.length) return null;
  try {
    const input = previsionV2Entrada();
    const hoy = E.snapshot({ today, rows, policy: input.policy, planMonths: input.months });
    if (!hoy) return null;
    const store = previsionV2FotosCargar();
    const anterior = E.previousVisit(store, today);
    const guardadaHoy = (Array.isArray(store) ? store : []).find((snap) => snap?.date === today);
    if (JSON.stringify(guardadaHoy) !== JSON.stringify(hoy)) storageSet(storageKey(PREVISION_V2_FOTOS), JSON.stringify(E.upsert(store, hoy)));
    if (!anterior) return null;
    const low = contract.lowPoint(tramo, {});
    if (!low) return null;
    let oldPolicyLow = null;
    let oldPolicyStart = null;
    const S = globalThis.FinanceCanonicalStressScenarios;
    if (E.policyChanges(anterior.policy, hoy.policy).length && S?.run) {
      const key = `fotos|${anterior.date}|${JSON.stringify(anterior.policy)}|${tramo.at(-1).date}`;
      const cached = previsionV2Cache.get(key);
      if (cached && cached.rows === rows) ({ oldPolicyLow, oldPolicyStart } = cached.result);
      else {
        const replay = S.run({ ...input, policy: { ...input.policy, ...anterior.policy } }, previsionV2Deps(), "qué ha cambiado: los supuestos de la visita anterior");
        oldPolicyLow = contract.lowPoint(replay.rows || [], { from: today, to: tramo.at(-1).date });
        oldPolicyStart = Number((replay.rows || []).find((row) => row.date === today)?.total);
        previsionV2Cache.set(key, { rows, result: { oldPolicyLow, oldPolicyStart } });
      }
    }
    return E.bridge({ previous: anterior, today, windowDays: horizonte.dias, current: { low, start: Number(tramo[0].total), end: rows.at(-1).date, policy: hoy.policy, plan: hoy.plan }, oldPolicyLow, oldPolicyStart: Number.isFinite(oldPolicyStart) ? oldPolicyStart : null, startEstimated: state?.balanceMode === "auto" });
  } catch {
    return null;
  }
}

/** «de ayer» o «del 2 nov». */
function previsionV2Visita(date, today) {
  const contract = globalThis.FinanceCanonicalForecastContract;
  return contract.daysBetween(date, today) === 1 ? "de ayer" : `del ${previsionV2Fecha(date, today)}`;
}

const PREVISION_V2_CAUSA = Object.freeze({ tiempo: "el paso del tiempo", datos: "los datos nuevos", supuestos: "los supuestos", plan: "los cambios del plan", otros: "otros motivos" });

/**
 * La línea bajo la cifra y su hoja. La cifra de la visita anterior ya no está a la vista, así que no se restan dos cifras redondeadas
 * (un mínimo que se acerca pasa de redondearse a la centena a la decena y parecería que cambia): se redondea la diferencia real, con
 * dos cifras significativas como las diferencias de la tabla de impacto (FX-04). Las barras van a la decena y lo que el redondeo deja
 * va a la última («Otros» o «Cambios del plan», cuya nota ya lo dice), para que sumen lo que dice la línea sin inventar una causa.
 */
function previsionV2CambioHtml(cambios, { today, horizonte }) {
  // Desde el 8/11 («sí, mueve el puente del 31/12 a «Por qué»»), la hoja trae también el puente de WP-43 (el fin de año, de cierre a
  // cierre), que en el tema nuevo deja de ser una tarjeta propia en Plan › Previsión. Lo pinta puente-ui.js en #prevV2Puente, con el
  // mismo motor; en el tema clásico y en «Ver todo el detalle» la tarjeta sigue como siempre.
  const puente = typeof puenteBodyHtml === "function" && Boolean(globalThis.FinanceCanonicalForecastBridge);
  const hayCambios = Boolean(cambios?.calculable);
  if (!hayCambios && !puente) return "";
  const abierta = previsionV2CambiosAbierta;
  const flecha = `<span class="prev-v2-confianza-flecha" aria-hidden="true">${abierta ? "▾" : "▸"}</span>`;
  const boton = (texto) => `<button type="button" class="hoy-v2-link prev-v2-cambio-boton" data-prevision-v2-cambios aria-expanded="${abierta}" aria-controls="prevV2Cambios">${escapeHtml(texto)} ${flecha}</button>`;
  const seccionPuente = puente
    ? `<div class="prev-v2-puente" role="group" aria-labelledby="prevV2PuenteTitulo">
        <p class="prev-v2-puente-titulo" id="prevV2PuenteTitulo" tabindex="-1"><strong>El fin de año, de cierre a cierre</strong></p>
        <p class="e19-kpi-note">En cada cierre la app congela cuánto preveía para el 31/12; al cerrar el mes siguiente, reparte la diferencia entre ingresos, gasto recurrente, extraordinarios, deuda y «otros».</p>
        <div id="prevV2Puente"></div>
      </div>`
    : "";
  const hoja = (contenido) => `<div class="prev-v2-cambios" id="prevV2Cambios"${abierta ? "" : " hidden"}>${contenido}${seccionPuente}</div>`;
  if (!hayCambios) return `<p class="prev-v2-cambio">${boton("Por qué cambia el fin de año")}</p>${hoja("")}`;
  const contract = globalThis.FinanceCanonicalForecastContract;
  const visto = contract.roundDifference(cambios.after.value - cambios.before.value);
  const cuando = previsionV2Visita(cambios.previousDate, today);
  const filas = cambios.rows.map((row) => ({ ...row, shown: Math.round(row.value / 10) * 10 }));
  const hueco = visto - filas.reduce((sum, row) => sum + row.shown, 0);
  if (hueco) filas[filas.length - 1].shown += hueco;
  const algo = filas.some((row) => row.shown);
  const signo = (value) => (value ? `${value < 0 ? "−" : "+"}${money(Math.abs(value))}` : "0 €");
  const linea = visto ? `<strong>${escapeHtml(signo(visto))}</strong> frente a tu visita ${escapeHtml(cuando)}` : `Igual que en tu visita ${escapeHtml(cuando)}`;
  if (!algo && !puente) return `<p class="prev-v2-cambio">${linea}.</p>`;
  if (!algo) return `<p class="prev-v2-cambio">${linea}. ${boton("Por qué cambia el fin de año")}</p>${hoja("")}`;
  const principal = previsionV2CausaPrincipal(cambios);
  const frase = visto
    ? `Desde tu visita ${cuando}, el punto más bajo ${horizonte.titulo} ${visto < 0 ? "baja" : "sube"} ${money(Math.abs(visto))}${principal ? `, sobre todo por ${principal.id === "datos" && principal.label !== "Datos nuevos" ? "el saldo de hoy (calculado)" : PREVISION_V2_CAUSA[principal.id]} (${signo(filas.find((row) => row.id === principal.id).shown)})` : ""}.`
    : `El punto más bajo ${horizonte.titulo} está igual que en tu visita ${cuando}, pero por dentro hay cambios que se compensan.`;
  const tabla = `<table class="e19-table prev-v2-cambios-tabla"><caption class="sr-only">Por qué ha cambiado el punto más bajo desde tu visita ${escapeHtml(cuando)}</caption>
    <thead><tr><th scope="col">Causa</th><th scope="col">Efecto</th></tr></thead>
    <tbody>${filas.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(signo(row.shown))}</td></tr>`).join("")}
    <tr class="prev-v2-cambios-total"><th scope="row">Total</th><td>${escapeHtml(signo(visto))}</td></tr></tbody></table>`;
  const flojo = cambios.weak ? `<p class="prev-v2-cambios-aviso" role="note">Buena parte del cambio la app no sabe separarla: mirad la tabla antes de fiaros de las causas.</p>` : "";
  return `<p class="prev-v2-cambio">${linea}. ${boton("Por qué")}</p>
    ${hoja(`<div class="prev-v2-visita">
      <p>${escapeHtml(frase)}</p>
      ${tabla}
      ${flojo}
      <ul class="prev-v2-cambios-notas">${cambios.notes.map((nota) => `<li>${escapeHtml(nota)}</li>`).join("")}</ul>
      <p class="e19-kpi-note">Compara con la foto que esta pantalla guardó en este dispositivo en tu visita ${escapeHtml(cuando)}. No cambia nada: solo lo explica.</p>
    </div>`)}`;
}

/** «Ver el puente completo» (aviso de Cierre, puente-ui.js) en el tema nuevo: la hoja abierta y el foco en el puente. */
function previsionV2AbrirPuente() {
  if (!qs("planPrevisionV2") || qs("planPrevisionV2").hidden) return false;
  previsionV2CambiosAbierta = true;
  previsionV2Render();
  const titulo = qs("prevV2PuenteTitulo");
  if (!titulo) return false;
  titulo.scrollIntoView({ block: "start" });
  titulo.focus({ preventScroll: true });
  return true;
}

function previsionV2CausaPrincipal(cambios) {
  return globalThis.FinanceCanonicalForecastChanges?.mainCause(cambios) || null;
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
// ---- FX-12 · Lo que viene: los hitos de los próximos 90 días ---------------------------------------------------------------
// Cobros y pagos desde el umbral elegido, por semanas, con su certeza y «¿sabes el día?» en los pagos de día estimado. Sin traspasos
// (no cambian el total) ni el gasto variable (no tiene día: se dice aparte cuánto suma). Son también los hitos del gráfico.

function previsionV2Umbral() {
  try {
    const guardado = Number(localStorage.getItem(PREVISION_V2_UMBRAL_KEY));
    return PREVISION_V2_UMBRALES.includes(guardado) ? guardado : PREVISION_V2_UMBRALES[0];
  } catch {
    return PREVISION_V2_UMBRALES[0];
  }
}

/** Los movimientos de los próximos 90 días que cuentan como hito, y lo que suma el gasto variable en ese tiempo. */
function previsionV2Hitos(tramo, today) {
  const fin = previsionV2AddDays(today, 90);
  const umbral = previsionV2Umbral();
  const dias = tramo.filter((row) => row.date >= today && row.date <= fin);
  const eventos = dias.flatMap((row) => (row.events || []).map((event) => ({ ...event, date: row.date })));
  const variable = eventos.filter((event) => event.field === "variableOperationalSpend").reduce((sum, event) => sum + Number(event.amount || 0), 0);
  const hitos = eventos.filter((event) => event.kind !== "transfer" && event.field !== "variableOperationalSpend" && Number(event.amount) >= umbral);
  return { hitos, umbral, variable, fin };
}

/** El lunes de la semana de un día (AAAA-MM-DD). */
function previsionV2Lunes(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function previsionV2Semana(lunes, today) {
  const esta = previsionV2Lunes(today);
  if (lunes === esta) return "Esta semana";
  if (lunes === previsionV2AddDays(esta, 7)) return "La semana que viene";
  return `Semana del ${previsionV2Fecha(lunes, today)}`;
}

function previsionV2Neto(eventos) {
  return eventos.reduce((sum, event) => sum + (event.kind === "income" ? 1 : -1) * Number(event.amount || 0), 0);
}

function previsionV2ConSigno(value) {
  return `${value < 0 ? "−" : "+"}${money(Math.abs(value))}`;
}

/** Los hitos como marcas del gráfico: una por punto pintado (en 12 y 24 meses, el primer punto desde su día), con lo que entra o sale. */
function previsionV2Marcadores(puntos, hitos, today) {
  const porPunto = new Map();
  hitos.forEach((hito) => {
    const index = puntos.findIndex((row) => row.date >= hito.date);
    if (index < 0) return;
    porPunto.set(index, [...(porPunto.get(index) || []), hito]);
  });
  return [...porPunto.entries()].map(([index, lista]) => {
    const neto = previsionV2Neto(lista);
    const detalle = lista.slice(0, 4).map((hito) => `${hito.label || "Sin nombre"} ${hito.kind === "income" ? "+" : "−"}${money(hito.amount)}`).join("; ");
    const mas = lista.length > 4 ? `; y ${lista.length - 4} más` : "";
    return { index, kind: neto < 0 ? "sale" : "entra", label: `${previsionV2Fecha(lista[0].date, today)}: ${detalle}${mas}` };
  });
}

function previsionV2HitoHtml(event, today, mismoDia = false) {
  const label = event.label || "Sin nombre";
  const ingreso = event.kind === "income";
  const estimado = !ingreso && (event.confidence === "estimated" || !PREVISION_V2_CERTEZA[event.confidence]);
  const certeza = estimado
    ? `día estimado · <button type="button" class="hoy-v2-link" data-prevision-v2-nav="planificacion-partidas" aria-label="¿Sabes el día de ${escapeHtml(label)}?">¿sabes el día?</button>`
    : escapeHtml(PREVISION_V2_CERTEZA[event.confidence] || "previsto");
  return `<li class="prev-v2-viene-item">
      <span class="prev-v2-viene-dia">${mismoDia ? "" : escapeHtml(previsionV2Fecha(event.date, today).replace(/ \d{4}$/, ""))}</span>
      <span class="prev-v2-viene-que">${escapeHtml(label)}<small>${certeza}</small></span>
      <strong class="prev-v2-viene-importe${ingreso ? " is-pos" : ""}">${ingreso ? "+" : "−"}${escapeHtml(money(event.amount))}</strong>
    </li>`;
}

function previsionV2LoQueVieneHtml({ hitos: datos, today }) {
  const { hitos, umbral, variable } = datos;
  const cobros = hitos.filter((event) => event.kind === "income").length;
  const pagos = hitos.length - cobros;
  const estimados = hitos.filter((event) => event.confidence === "estimated").length;
  const cuenta = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const resumen = hitos.length
    ? `${cuenta(cobros, "cobro", "cobros")} y ${cuenta(pagos, "pago", "pagos")} desde ${money(umbral)}${estimados ? ` · ${estimados} con el día estimado` : ""}`
    : `nada desde ${money(umbral)}`;
  const umbrales = `<div class="prev-v2-opcion prev-v2-viene-umbral"><span class="prev-v2-comparar-titulo" id="prevV2UmbralTitulo">Desde</span><div class="registrar-mes-filters" role="group" aria-labelledby="prevV2UmbralTitulo">${PREVISION_V2_UMBRALES
    .map((valor) => `<button type="button" class="registrar-mes-filter${valor === umbral ? " is-active" : ""}" data-prevision-v2-umbral="${valor}" aria-pressed="${valor === umbral}">${escapeHtml(money(valor))}</button>`)
    .join("")}</div></div>`;
  const semanas = new Map();
  hitos.forEach((event) => {
    const lunes = previsionV2Lunes(event.date);
    semanas.set(lunes, [...(semanas.get(lunes) || []), event]);
  });
  const MAX = 40;
  let pintados = 0;
  const bloques = [...semanas.entries()].map(([lunes, lista]) => {
    const visibles = lista.slice(0, Math.max(0, MAX - pintados));
    pintados += visibles.length;
    if (!visibles.length) return "";
    const titulo = previsionV2Semana(lunes, today);
    const neto = previsionV2Neto(lista);
    return `<div class="prev-v2-viene-semana">
      <p class="prev-v2-viene-semana-titulo"><span>${escapeHtml(titulo)}</span><strong class="prev-v2-viene-importe${neto >= 0 ? " is-pos" : ""}">${escapeHtml(previsionV2ConSigno(neto))}</strong></p>
      <ul class="prev-v2-viene-lista" aria-label="${escapeHtml(titulo)}">${visibles.map((event, at) => previsionV2HitoHtml(event, today, at > 0 && visibles[at - 1].date === event.date)).join("")}</ul>
    </div>`;
  }).join("");
  const resto = hitos.length - pintados;
  const notaVariable = variable >= 1 ? `<p class="e19-kpi-note">No incluye el gasto variable (unos ${escapeHtml(money(globalThis.FinanceCanonicalForecastContract?.roundDifference?.(variable) ?? variable))} en estos 90 días), que no tiene día fijo.</p>` : "";
  return `<details class="e19-card prev-v2-viene"${previsionV2VieneAbierto ? " open" : ""}>
    <summary>Lo que viene en 90 días · ${escapeHtml(resumen)}</summary>
    ${umbrales}
    ${bloques || `<p class="e19-kpi-note">Ningún cobro ni pago desde ${escapeHtml(money(umbral))} en los próximos 90 días.</p>`}
    ${resto > 0 ? `<p class="e19-kpi-note">Y ${resto} más. Todos, día a día, en la tabla del gráfico.</p>` : ""}
    ${notaVariable}
    ${estimados ? `<p class="e19-kpi-note">Los de día estimado mueven el punto más bajo: decir el día lo afina.</p>` : ""}
    <p class="e19-kpi-note">Son también las marcas bajo el gráfico, en azul lo que entra y en rojo lo que sale.</p>
  </details>`;
}

function previsionV2Html({ rows, today, floor, horizonte }) {
  const { tramo, puntos } = previsionV2Serie(rows, today, horizonte);
  if (!tramo.length) return `<p class="hoy-v2-pending">Sin previsión desde hoy: pon los saldos para que la app pueda prever.</p>`;
  const segmentado = `<div class="registrar-mes-filters prev-v2-horizontes" role="group" aria-label="Horizonte de la previsión">${PREVISION_V2_HORIZONTES
    .map((h) => `<button type="button" class="registrar-mes-filter${h.id === horizonte.id ? " is-active" : ""}" data-prevision-v2-horizonte="${h.id}" aria-pressed="${h.id === horizonte.id}">${escapeHtml(h.label)}</button>`)
    .join("")}</div>`;
  // Un escenario guardado que ya no está (archivado, aplicado o borrado en Escenarios) deja de compararse.
  if (previsionV2Escenario.startsWith(PREVISION_V2_GUARDADO) && !previsionV2Guardados().some((entry) => `${PREVISION_V2_GUARDADO}${entry.id}` === previsionV2Escenario)) previsionV2Escenario = "";
  const prueba = !previsionV2Escenario ? null
    : previsionV2Escenario.startsWith(PREVISION_V2_GUARDADO) ? previsionV2PruebaGuardada(previsionV2Escenario.slice(PREVISION_V2_GUARDADO.length), rows, today, tramo.at(-1).date, floor)
    : previsionV2Segunda ? previsionV2PruebaDoble([previsionV2Escenario, previsionV2Segunda], rows, today, tramo.at(-1).date, floor)
    : previsionV2Prueba(previsionV2Escenario, rows, today, tramo.at(-1).date, floor);
  const hitos = previsionV2Hitos(tramo, today);
  previsionV2Ultimo = { tramo, puntos, today, floor, horizonte, prueba, rows };
  const cambios = previsionV2Cambios({ rows, tramo, today, horizonte });
  return `${segmentado}
    <article class="e19-card prev-v2-card con-dia">
      ${previsionV2HeroHtml({ tramo, horizonte, floor, today, confianza: previsionV2Confianza(tramo, today), cambios })}
      ${previsionV2GraficoHtml({ puntos, floor, today, horizonte, prueba, hitos: hitos.hitos })}
      <div class="prev-v2-dia-hueco">${previsionV2DiaHtml(previsionV2Ultimo, previsionV2DiaElegido(previsionV2Ultimo))}</div>
      <div class="prev-v2-comparar-bloque">${previsionV2CompararHtml(prueba, today)}</div>
    </article>
    ${previsionV2ArregloHtml({ tramo, floor, today })}
    ${previsionV2LoQueVieneHtml({ hitos, today })}
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
    globalThis.renderPuentePrevision?.(globalThis.FinanceCanonicalForecastBridge); // vuelve la tarjeta del puente, con su contenido
    return false;
  }
  const horizonte = PREVISION_V2_HORIZONTES.find((h) => h.id === previsionV2HorizonteId());
  const floor = globalThis.FinanceCanonicalHomeMargin?.normalizeFloor(state?.liquidityFloor) ?? 0;
  box.innerHTML = previsionV2Html({ rows, today: isoLocalDate(new Date()), floor, horizonte });
  box.hidden = false;
  previsionV2CursorAlDia(box);
  panel.classList.add("prevision-v2-on");
  globalThis.renderPuentePrevision?.(globalThis.FinanceCanonicalForecastBridge); // el puente de WP-43, dentro de «Por qué»
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

/** FX-31 desde Hoy: a Plan › Previsión con la hoja de la insignia abierta y el foco en ella. */
function previsionV2AbrirConfianza() {
  previsionV2ConfianzaAbierta = true;
  if (document.getElementById("plan")?.classList.contains("view-section")) {
    history.pushState(null, "", "#plan");
    setActiveView("plan");
  }
  document.querySelector('[data-plan-tab="prevision"]')?.click();
  qs("planPrevisionV2")?.querySelector("[data-prevision-v2-confianza]")?.focus();
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
  // FX-20: un escenario guardado en «Comparar con»; sustituye a la prueba elegida (y a la segunda).
  // FX-12: recordar si «Lo que viene» está abierto, para que un repintado no lo cierre.
  box?.addEventListener("toggle", (event) => {
    if (event.target.classList?.contains("prev-v2-viene")) previsionV2VieneAbierto = event.target.open;
  }, true);
  box?.addEventListener("change", (event) => {
    const select = event.target.closest?.("[data-prevision-v2-guardado]");
    if (!select) return;
    previsionV2Escenario = select.value ? `${PREVISION_V2_GUARDADO}${select.value}` : "";
    previsionV2Segunda = "";
    globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
    previsionV2Render();
    qs("prevV2Guardado")?.focus();
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
    const umbral = event.target.closest("[data-prevision-v2-umbral]");
    if (umbral) {
      try { localStorage.setItem(PREVISION_V2_UMBRAL_KEY, umbral.dataset.previsionV2Umbral); } catch { /* sin guardar: vale para esta visita */ }
      previsionV2VieneAbierto = true;
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      previsionV2Render();
      qs("planPrevisionV2")?.querySelector(`[data-prevision-v2-umbral="${umbral.dataset.previsionV2Umbral}"]`)?.focus();
      return;
    }
    const segunda = event.target.closest("[data-prevision-v2-segunda]");
    if (segunda) {
      previsionV2Segunda = segunda.dataset.previsionV2Segunda;
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      previsionV2Render();
      qs("planPrevisionV2")?.querySelector(`[data-prevision-v2-segunda="${previsionV2Segunda}"]`)?.focus();
      return;
    }
    const prueba = event.target.closest("[data-prevision-v2-prueba]");
    if (prueba) {
      previsionV2Escenario = prueba.dataset.previsionV2Prueba;
      // La segunda no puede ser la misma que la primera, ni quedar sin primera.
      if (!previsionV2Escenario || previsionV2Segunda === previsionV2Escenario) previsionV2Segunda = "";
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
    const cambiosBoton = event.target.closest("[data-prevision-v2-cambios]");
    if (cambiosBoton) {
      previsionV2CambiosAbierta = previsionV2AbreHoja(cambiosBoton);
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      return;
    }
    const insignia = event.target.closest("[data-prevision-v2-confianza]");
    if (insignia) {
      previsionV2ConfianzaAbierta = previsionV2AbreHoja(insignia);
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      return;
    }
    if (event.target.closest("[data-prevision-v2-guardar]")) {
      const guardada = previsionV2GuardarEscenario();
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      previsionV2Render();
      const caja = qs("planPrevisionV2")?.querySelector(".prev-v2-guardar");
      (caja?.querySelector(guardada ? "[data-prevision-v2-nav]" : "[data-prevision-v2-guardar]") || caja?.querySelector("button"))?.focus();
      return;
    }
    if (event.target.closest("[data-prevision-v2-suelo]")) {
      globalThis.FinanceMedidor?.anotar("prevision-v2", "accion");
      history.pushState(null, "", "#ajustes");
      setActiveView("ajustes");
      const campo = qs("ajustesLiquidityFloor");
      campo?.scrollIntoView({ block: "center" });
      campo?.focus({ preventScroll: true });
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
