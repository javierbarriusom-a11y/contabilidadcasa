(function attachCanonicalCashBand(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalCashBand = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalCashBand() {
  "use strict";

  // WP-16 (NPV-01, docs/WP16_DISENO.md): la banda de caja de los próximos 30 días. En vez de una línea que finge saber el día de cada
  // cargo, simula cientos de trayectorias y dice tres cosas: la banda P10-P90 de la liquidez día a día, la PROBABILIDAD de cruzar el
  // suelo y el día más probable del mínimo. Probabilidad, no calendario.
  //
  // Qué es incierto aquí y qué no (se dice en la pantalla, no se esconde):
  //   · FECHA de los eventos «estimados» (la app, sin día de cargo conocido, los pone el día 8): se reparte uniforme en una ventana
  //     (por defecto, días 1-28 del mes; la aprendida cuando exista). Los eventos «observados», «por regla» o con día indicado por el
  //     hogar caen en su día.
  //   · Los gastos que llegan REPARTIDOS durante el mes (el súper, la gasolina: `spread: true`) no son un pago con fecha incierta: se reparten
  //     por igual entre los días que quedan del mes, sin azar. Tratarlos como un pago en un día al azar inventaría una varianza que no existe.
  //   · IMPORTE: solo si el evento trae `amountSd`. La app todavía no lo aporta: la banda es de fechas, no de importes.
  // Con las fechas casi todas estimadas la banda sale tan ancha que no informa: eso también se dice (`quality`).
  //
  // Es puro y determinista: las mismas entradas y la misma semilla dan la misma banda (un repintado no la mueve).
  // No ejecuta nada ni toca el plan: solo lee.

  const SCHEMA_ID = "finance-canonical-cash-band/v1";
  const DEFAULT_HORIZON_DAYS = 30;
  const DEFAULT_TRAJECTORIES = 500;
  const MAX_TRAJECTORIES = 5000;
  const DEFAULT_WINDOW = Object.freeze({ from: 1, to: 28 });
  // Mismo umbral que el medidor de calidad de la previsión (WP-10, decisión del hogar del 2/10): con ≥ 70 % por importe de eventos con
  // fecha estimada, la banda es de poca utilidad.
  const WIDE_ESTIMATED_SHARE = 0.7;
  const KNOWN_CONFIDENCE = ["observed", "rule", "declared", "estimated"]; // «declared»: día de cargo indicado por el hogar (WP-08), tan cierto como una regla

  const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const isFiniteNumber = (value) => value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value));

  // ---- Fechas (UTC, a mediodía, para que ningún huso desplace el día) ----
  function utc(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const isoOf = (date) => date.toISOString().slice(0, 10);
  const addDays = (iso, count) => { const date = utc(iso); date.setUTCDate(date.getUTCDate() + count); return isoOf(date); };
  const dayDiff = (fromIso, toIso) => Math.round((utc(toIso).getTime() - utc(fromIso).getTime()) / 86400000);
  const monthEndDay = (iso) => { const date = utc(iso); return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate(); };

  /** «8 de octubre» (sin año). */
  function dateLabel(iso) {
    const date = utc(iso);
    return date ? `${date.getUTCDate()} de ${MONTH_NAMES[date.getUTCMonth()]}` : "";
  }
  /** «el 8 de octubre», «entre el 8 y el 12 de octubre» o «entre el 28 de octubre y el 2 de noviembre». */
  function whenLabel(fromIso, toIso) {
    if (fromIso === toIso) return `el ${dateLabel(fromIso)}`;
    const from = utc(fromIso);
    const to = utc(toIso);
    if (from.getUTCMonth() === to.getUTCMonth()) return `entre el ${from.getUTCDate()} y el ${dateLabel(toIso)}`;
    return `entre el ${dateLabel(fromIso)} y el ${dateLabel(toIso)}`;
  }

  // ---- Azar determinista (mulberry32) ----
  function createRandom(seed) {
    let state = (Number(seed) >>> 0) || 1;
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const normal = () => {
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return { next, normal, int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
  }

  /** Percentil por interpolación lineal sobre valores ya ordenados. */
  function percentile(sorted, fraction) {
    if (!sorted.length) return null;
    if (sorted.length === 1) return sorted[0];
    const position = Math.max(0, Math.min(1, fraction)) * (sorted.length - 1);
    const low = Math.floor(position);
    const high = Math.ceil(position);
    return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
  }

  function normalizeEvents(events, asOf, endIso) {
    const list = [];
    (Array.isArray(events) ? events : []).forEach((event, index) => {
      const amount = Number(event?.amount);
      if (!Number.isFinite(amount) || amount === 0) return;
      const kind = event.kind === "income" ? "income" : event.kind === "transfer" ? "transfer" : "outflow";
      if (kind === "transfer") return; // entre cuentas propias: la liquidez total no se mueve
      const date = utc(event.date) ? isoOf(utc(event.date)) : "";
      if (!date) return;
      const confidence = KNOWN_CONFIDENCE.includes(event.confidence) ? event.confidence : "estimated";
      const sd = isFiniteNumber(event.amountSd) && Number(event.amountSd) > 0 ? Number(event.amountSd) : 0;
      const spread = event.spread === true && kind === "outflow";
      // Un evento con día cierto anterior al saldo declarado ya pasó (el saldo lo recoge); uno estimado sigue pendiente (su día es una suposición).
      if (confidence !== "estimated" && !spread && date < asOf) return;
      if (confidence !== "estimated" && !spread && date > endIso) return;
      if ((confidence === "estimated" || spread) && date > monthEndIso(endIso)) return;
      if (spread && monthEndIso(date) < asOf) return; // el mes ya pasó entero
      list.push({ id: String(event.id ?? `evento-${index + 1}`), label: String(event.label ?? ""), kind, amount: Math.abs(amount), signed: kind === "income" ? Math.abs(amount) : -Math.abs(amount), date, confidence, sd, spread });
    });
    return list;
  }
  const monthEndIso = (iso) => `${iso.slice(0, 8)}${String(monthEndDay(iso)).padStart(2, "0")}`;

  /** El tramo de días [desde, hasta] (ISO) donde puede caer un evento estimado de ese mes: la ventana del mes, sin lo anterior al saldo. */
  function estimatedWindow(eventDate, asOf, endIso, window) {
    const monthStart = `${eventDate.slice(0, 8)}01`;
    const lastDay = monthEndDay(eventDate);
    const from = addDays(monthStart, Math.max(1, Math.min(window.from, lastDay)) - 1);
    const to = addDays(monthStart, Math.max(1, Math.min(window.to, lastDay)) - 1);
    let start = from < asOf ? asOf : from;
    let end = to > endIso ? endIso : to;
    if (start > end) { // la ventana ya quedó atrás (o más allá del horizonte): pendiente hasta fin de mes, dentro de lo visible
      start = from < asOf ? asOf : from;
      end = monthEndIso(eventDate) > endIso ? endIso : monthEndIso(eventDate);
    }
    return start > end ? null : { from: start, to: end };
  }

  /** Los días (índices desde el saldo) entre los que se reparte un gasto de mes, y lo que toca a cada uno (el mes entero, desde el saldo). */
  function spreadShares(event, asOf, dayCount) {
    const monthStart = `${event.date.slice(0, 8)}01`;
    const first = monthStart < asOf ? asOf : monthStart;
    const last = monthEndIso(event.date);
    const length = dayDiff(first, last) + 1;
    if (length < 1) return [];
    const startIndex = dayDiff(asOf, first);
    const shares = [];
    for (let index = startIndex; index < startIndex + length && index < dayCount; index += 1) shares.push({ index, amount: event.amount / length });
    return shares;
  }

  /**
   * @param {{
   *   asOf?: string, openingTotal?: number|string, floor?: number|null, horizonDays?: number,
   *   events?: Array<{id?: string, label?: string, kind: string, amount: number, date: string, confidence?: string, amountSd?: number, spread?: boolean}>,
   *   window?: {from: number, to: number}, trajectories?: number, seed?: number
   * }} input
   */
  function simulate(input = {}) {
    const asOf = utc(input.asOf) ? isoOf(utc(input.asOf)) : "";
    const missing = [];
    if (!asOf) missing.push("la fecha de los saldos");
    if (!isFiniteNumber(input.openingTotal)) missing.push("el saldo de partida");
    if (missing.length) return { schemaId: SCHEMA_ID, status: "missing", missing, asOf: asOf || null, days: [], crossing: null, minimum: null, dateCertainty: null, quality: "none", sentence: "" };

    const horizonDays = Math.max(1, Math.min(120, Math.round(Number(input.horizonDays) || DEFAULT_HORIZON_DAYS)));
    const trajectories = Math.max(50, Math.min(MAX_TRAJECTORIES, Math.round(Number(input.trajectories) || DEFAULT_TRAJECTORIES)));
    const openingTotal = round2(Number(input.openingTotal));
    const floor = isFiniteNumber(input.floor) ? round2(Number(input.floor)) : null;
    const endIso = addDays(asOf, horizonDays);
    const window = input.window && Number.isFinite(input.window.from) && Number.isFinite(input.window.to) && input.window.from <= input.window.to ? input.window : DEFAULT_WINDOW;
    const events = normalizeEvents(input.events, asOf, endIso);
    const random = createRandom(input.seed ?? 1);
    const dayCount = horizonDays + 1; // asOf incluido

    // Trayectoria «central»: cada evento en su fecha tal como la supone el plan (los estimados, en la que ya traían, no antes del saldo).
    const centralDelta = new Array(dayCount).fill(0);
    events.forEach((event) => {
      if (event.spread) { spreadShares(event, asOf, dayCount).forEach((share) => { centralDelta[share.index] -= share.amount; }); return; }
      const at = Math.max(0, dayDiff(asOf, event.date < asOf ? asOf : event.date));
      if (at < dayCount) centralDelta[at] += event.signed;
    });

    const estimated = events.map((event) => event.confidence === "estimated" && !event.spread ? estimatedWindow(event.date, asOf, endIso, window) : null);
    const endOfDay = Array.from({ length: dayCount }, () => new Float64Array(trajectories));
    const minimumDay = new Array(trajectories);
    const minimumValue = new Float64Array(trajectories);
    let crossings = 0;
    const firstCrossing = [];

    for (let run = 0; run < trajectories; run += 1) {
      const outflowsOfDay = new Float64Array(dayCount);
      const incomesOfDay = new Float64Array(dayCount);
      events.forEach((event, index) => {
        if (event.spread) { spreadShares(event, asOf, dayCount).forEach((share) => { outflowsOfDay[share.index] += share.amount; }); return; }
        let at;
        if (event.confidence === "estimated") {
          const span = estimated[index];
          if (!span) return;
          at = dayDiff(asOf, span.from) + random.int(0, dayDiff(span.from, span.to));
        } else {
          at = dayDiff(asOf, event.date);
        }
        if (at < 0 || at >= dayCount) return;
        const amount = event.sd ? Math.max(0, event.amount + event.sd * random.normal()) : event.amount;
        if (event.kind === "income") incomesOfDay[at] += amount;
        else outflowsOfDay[at] += amount;
      });
      let balance = openingTotal;
      let lowest = openingTotal;
      let lowestDay = -1; // -1: ningún día baja del saldo de partida, el punto más bajo es el de hoy
      let crossedAt = -1;
      for (let day = 0; day < dayCount; day += 1) {
        // Prudente: dentro de un día, primero lo que sale; el mínimo se mide ahí, y la banda, a fin de día.
        const afterOutflows = balance - outflowsOfDay[day];
        if (afterOutflows < lowest) { lowest = afterOutflows; lowestDay = day; }
        if (floor !== null && crossedAt < 0 && afterOutflows < floor) crossedAt = day;
        balance = afterOutflows + incomesOfDay[day];
        endOfDay[day][run] = balance;
      }
      minimumDay[run] = lowestDay;
      minimumValue[run] = lowest;
      if (crossedAt >= 0) { crossings += 1; firstCrossing.push(crossedAt); }
    }

    const days = [];
    let running = openingTotal;
    for (let day = 0; day < dayCount; day += 1) {
      const sorted = Array.from(endOfDay[day]).sort((a, b) => a - b);
      running += centralDelta[day];
      days.push({ date: addDays(asOf, day), p10: round2(percentile(sorted, 0.1)), p50: round2(percentile(sorted, 0.5)), p90: round2(percentile(sorted, 0.9)), central: round2(running) });
    }

    // Día más probable del mínimo: la moda entre los días en que SÍ baja del saldo de partida, y el tramo que reúne el 80 % central. Si lo más
    // frecuente es que ningún día baje del saldo de hoy, el «mínimo» es hoy y no se inventa un día (`atStart`).
    const tally = new Array(dayCount).fill(0);
    let atStartRuns = 0;
    const lowDays = [];
    minimumDay.forEach((day) => { if (day < 0) atStartRuns += 1; else { tally[day] += 1; lowDays.push(day); } });
    let modeDay = -1;
    tally.forEach((count, day) => { if (modeDay < 0 || count > tally[modeDay]) modeDay = day; });
    lowDays.sort((a, b) => a - b);
    const sortedMinima = Array.from(minimumValue).sort((a, b) => a - b);
    const minimum = {
      atStart: round2(atStartRuns / trajectories),
      date: lowDays.length ? addDays(asOf, modeDay) : null,
      probability: lowDays.length ? round2(tally[modeDay] / trajectories) : 0,
      from: lowDays.length ? addDays(asOf, Math.round(percentile(lowDays, 0.1))) : null,
      to: lowDays.length ? addDays(asOf, Math.round(percentile(lowDays, 0.9))) : null,
      valueP50: round2(percentile(sortedMinima, 0.5)),
      valueP10: round2(percentile(sortedMinima, 0.1)), // WP-47: el mínimo al que llega la trayectoria en 9 de cada 10 casos (cuánto cabe sacar sin cruzar el suelo)
    };

    const crossing = floor === null
      ? { floor: null, probability: null, from: null, to: null }
      : {
        floor,
        probability: round2(crossings / trajectories),
        from: firstCrossing.length ? addDays(asOf, Math.round(percentile(firstCrossing.slice().sort((a, b) => a - b), 0.1))) : null,
        to: firstCrossing.length ? addDays(asOf, Math.round(percentile(firstCrossing.slice().sort((a, b) => a - b), 0.9))) : null,
      };

    // Cuánto de lo que se mueve tiene fecha cierta (por importe): lo que decide si la banda informa.
    const dated = events.filter((event) => !event.spread);
    const exactAmount = dated.filter((event) => event.confidence !== "estimated").reduce((sum, event) => sum + event.amount, 0);
    const estimatedAmount = dated.filter((event) => event.confidence === "estimated").reduce((sum, event) => sum + event.amount, 0);
    const spreadAmount = events.filter((event) => event.spread).reduce((sum, event) => sum + event.amount, 0);
    const totalAmount = exactAmount + estimatedAmount;
    const estimatedShare = totalAmount > 0 ? round2(estimatedAmount / totalAmount) : null;
    const dateCertainty = { events: events.length, exactAmount: round2(exactAmount), estimatedAmount: round2(estimatedAmount), spreadAmount: round2(spreadAmount), estimatedShare };

    const lastDay = days[days.length - 1];
    const spread = lastDay.p90 - lastDay.p10;
    let quality = "ok";
    if (!events.length) quality = "no-events";
    else if (estimatedShare !== null && estimatedShare >= WIDE_ESTIMATED_SHARE) quality = "wide";
    else if (estimatedAmount === 0) quality = "exact";

    const result = { schemaId: SCHEMA_ID, status: "ok", missing: [], asOf, horizonDays, openingTotal, floor, trajectories, days, crossing, minimum, dateCertainty, quality, spreadAtEnd: round2(spread), window: { ...window }, seed: input.seed ?? 1 };
    result.sentence = sentenceFor(result);
    return result;
  }

  /** «3 de cada 10 trayectorias» es más legible que «31 %»; con pocas, el porcentaje. */
  function outOfTen(probability) {
    const tenths = Math.round(probability * 10);
    if (probability > 0 && tenths === 0) return "menos de 1 de cada 10";
    if (probability < 1 && tenths === 10) return "casi todas las";
    return `${tenths} de cada 10`;
  }

  function sentenceFor(result) {
    if (result.status !== "ok") return "";
    const { crossing, minimum, quality } = result;
    const parts = [];
    const lowest = minimum.date && minimum.atStart < 0.5
      ? ` El día más probable del mínimo es el ${dateLabel(minimum.date)}.`
      : minimum.atStart >= 0.5 ? ` En ${outOfTen(minimum.atStart)} el punto más bajo es el saldo de hoy.` : "";
    if (crossing.floor === null) {
      parts.push(`Sin suelo de liquidez declarado no se puede decir si cruzas algún suelo.${lowest}`);
    } else if (crossing.probability === 0) {
      parts.push(`En ninguna de las ${result.trajectories} trayectorias simuladas la liquidez baja del suelo (${Math.round(crossing.floor).toLocaleString("es-ES")} €) en los próximos ${result.horizonDays} días.${lowest}`);
    } else {
      const where = crossing.from && crossing.to ? ` ${whenLabel(crossing.from, crossing.to)}` : "";
      parts.push(`En ${outOfTen(crossing.probability)} trayectorias la liquidez baja del suelo (${Math.round(crossing.floor).toLocaleString("es-ES")} €)${where}.${lowest}`);
    }
    if (quality === "wide") parts.push(`La banda es ancha: el ${Math.round(result.dateCertainty.estimatedShare * 100)} % de lo que se mueve tiene fecha estimada, así que dice cuánto puede variar la caja, pero poco en qué día.`);
    else if (quality === "no-events") parts.push("No hay movimientos previstos en este periodo: la banda es una línea.");
    return parts.join(" ");
  }

  return Object.freeze({ SCHEMA_ID, DEFAULT_HORIZON_DAYS, DEFAULT_TRAJECTORIES, DEFAULT_WINDOW, WIDE_ESTIMATED_SHARE, createRandom, percentile, simulate, sentenceFor, dateLabel, whenLabel });
});
