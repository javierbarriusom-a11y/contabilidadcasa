(function attachCanonicalReminders(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalReminders = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalReminders() {
  "use strict";

  // WP-32 (CAP-09 + ND-10, docs/WP32_DISENO.md): recordatorios en el momento de MÁXIMO VALOR, no a horas fijas. Pedir datos cuando no cambian
  // nada enseña a ignorar los avisos; pedirlos justo antes de decidir (dos días antes de cobrar), justo después de un cargo grande, el día de
  // cerrar el mes y en la campaña fiscal, no.
  //
  // Lo que produce es un fichero .ics para importar en el calendario del móvil. NO es un calendario «suscribible» y no puede serlo: el sitio es
  // estático (GitHub Pages, sin servidor) y el repositorio es PÚBLICO, así que una URL con la previsión del hogar sería publicar sus finanzas.
  // El fichero se genera en el dispositivo, se queda en el dispositivo y cubre los próximos meses; hay que regenerarlo cuando el plan cambia
  // (la pantalla lo avisa). Los eventos llevan identificador estable: importarlo otra vez ACTUALIZA los que siguen valiendo, pero no puede
  // borrar los que ya no valen (un .ics no puede borrar nada).
  //
  // Privacidad: el TÍTULO de cada evento es lo que sale en la pantalla de bloqueo, así que no lleva importes ni nombres de partidas; el detalle,
  // que solo se ve al abrir el evento, sí.
  //
  // Es puro: la fecha de hoy y los movimientos fechados del plan llegan por parámetro. No ejecuta nada.

  const SCHEMA_ID = "finance-canonical-reminders/v1";
  const KINDS = Object.freeze(["income", "bigCharge", "monthClose", "fiscal", "rateReview"]);
  const DEFAULTS = Object.freeze({ horizonMonths: 6, incomeLeadDays: 2, bigChargeMin: 500, kinds: Object.freeze({ income: true, bigCharge: true, monthClose: true, fiscal: true, rateReview: true }) });
  // Solo los días que el plan SABE: un ingreso con fecha «estimada» (el día 8 de relleno) generaría un aviso en un día cualquiera, que es
  // justo el ruido que este paquete quiere evitar.
  const CERTAIN = Object.freeze(["rule", "observed"]);
  const MAX_EVENTS = 150;
  // WP-20: avisos de la revisión del tipo variable, los mismos que la tarjeta y la bandeja de Hoy.
  const REVIEW_NOTICE_DAYS = Object.freeze([60, 30]);

  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  function utc(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const isoOf = (date) => date.toISOString().slice(0, 10);
  const addDays = (iso, count) => { const date = utc(iso); date.setUTCDate(date.getUTCDate() + count); return isoOf(date); };
  const longDate = (iso) => { const date = utc(iso); return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`; };
  // «1.200,00 €» con puntos de millar siempre (Intl no agrupa los de cuatro cifras en es-ES).
  const euros = (value) => {
    const [whole, cents] = Math.abs(round2(value)).toFixed(2).split(".");
    return `${value < 0 ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents} €`;
  };
  const slug = (text) => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "x";

  function normalizeOptions(options = {}) {
    const kinds = { ...DEFAULTS.kinds, ...(options.kinds || {}) };
    const lead = Math.round(Number(options.incomeLeadDays));
    const min = Number(options.bigChargeMin);
    const months = Math.round(Number(options.horizonMonths));
    return {
      kinds,
      incomeLeadDays: Number.isFinite(lead) && lead >= 0 && lead <= 10 ? lead : DEFAULTS.incomeLeadDays,
      bigChargeMin: Number.isFinite(min) && min >= 0 ? min : DEFAULTS.bigChargeMin,
      horizonMonths: Number.isFinite(months) && months >= 1 && months <= 12 ? months : DEFAULTS.horizonMonths,
    };
  }

  /**
   * @param {{
   *   today?: string,
   *   incomes?: Array<{date: string, label?: string, amount?: number, confidence?: string}>,
   *   outflows?: Array<{date: string, label?: string, amount: number, confidence?: string}>,
   *   reviews?: Array<{date: string, low?: number, high?: number}>,
   *   options?: {horizonMonths?: number, incomeLeadDays?: number, bigChargeMin?: number, kinds?: Partial<Record<string, boolean>>}
   * }} input
   */
  function build(input = {}) {
    const today = utc(input.today) ? isoOf(utc(input.today)) : "";
    if (!today) return { schemaId: SCHEMA_ID, status: "missing", missing: ["la fecha de hoy"], events: [], skipped: { uncertainIncomes: 0, uncertainCharges: 0 }, counts: {} };
    const options = normalizeOptions(input.options);
    const horizonEnd = isoOf(new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + options.horizonMonths, Number(today.slice(8, 10)), 12)));
    const within = (date) => date >= today && date <= horizonEnd;
    const events = new Map();
    const skipped = { uncertainIncomes: 0, uncertainCharges: 0 };
    const put = (event) => { if (within(event.date) && !events.has(event.uid)) events.set(event.uid, event); };

    // 1) Dos días antes de cobrar: «actualizad saldos antes de decidir cuánto se gasta».
    if (options.kinds.income) {
      const byDate = new Map();
      (Array.isArray(input.incomes) ? input.incomes : []).forEach((income) => {
        const date = utc(income?.date) ? isoOf(utc(income.date)) : "";
        if (!date || date < today || date > addDays(horizonEnd, options.incomeLeadDays)) return;
        if (!CERTAIN.includes(income.confidence)) { skipped.uncertainIncomes += 1; return; }
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date).push(income);
      });
      byDate.forEach((list, payDate) => {
        // Si el aviso caería antes de hoy (cobro en 1 día), se da hoy: mejor tarde que nunca.
        const date = addDays(payDate, -options.incomeLeadDays) < today ? today : addDays(payDate, -options.incomeLeadDays);
        const total = list.reduce((sum, income) => sum + (Number(income.amount) || 0), 0);
        const names = list.map((income) => income.label).filter(Boolean).join(", ");
        const days = Math.round((utc(payDate).getTime() - utc(date).getTime()) / 86400000);
        put({
          uid: `rec-cobro-${payDate}`, kind: "income", date,
          title: days === 0 ? "Cobro hoy: actualizad saldos" : `Cobro en ${days} día${days === 1 ? "" : "s"}: actualizad saldos`,
          description: `El ${longDate(payDate)} entra${list.length > 1 ? "n" : ""} ${names || "un ingreso"}${total > 0 ? ` (${euros(total)})` : ""}. Con los saldos al día, la app dice cuánto podéis gastar. Actualizad CaixaBank y Mediolanum antes de decidir.`,
        });
      });
    }

    // 2) El día siguiente a un cargo grande con fecha segura: «¿ha llegado? actualizad el saldo».
    if (options.kinds.bigCharge) {
      (Array.isArray(input.outflows) ? input.outflows : []).forEach((charge) => {
        const amount = Math.abs(Number(charge?.amount));
        const chargeDate = utc(charge?.date) ? isoOf(utc(charge.date)) : "";
        if (!chargeDate || !(amount >= options.bigChargeMin) || amount === 0) return;
        if (addDays(chargeDate, 1) < today || chargeDate > horizonEnd) return; // fuera del periodo del fichero: ni aviso ni «sin aviso»
        if (!CERTAIN.includes(charge.confidence)) { skipped.uncertainCharges += 1; return; }
        put({
          uid: `rec-cargo-${chargeDate}-${slug(charge.label)}`, kind: "bigCharge", date: addDays(chargeDate, 1),
          title: "Ayer tocaba un cargo grande: actualizad el saldo",
          description: `El ${longDate(chargeDate)} estaba previsto «${charge.label || "un cargo"}» (${euros(amount)}). Comprobad que ha llegado y actualizad el saldo.`,
        });
      });
    }

    // 3) El día 1: cerrar el mes que acaba (la ventana de cierre es del 1 al 3).
    if (options.kinds.monthClose) {
      for (let step = 0; step <= options.horizonMonths + 1; step += 1) {
        const first = isoOf(new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + step, 1, 12)));
        const closing = isoOf(new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 2, 1, 12))).slice(0, 7);
        put({
          uid: `rec-cierre-${first}`, kind: "monthClose", date: first,
          title: "Cerrad el mes: saldos y reales",
          description: `Del 1 al 3 se cierra ${MONTHS[Number(closing.slice(5, 7)) - 1]}: declarad los saldos reales de cada cuenta y los reales del mes en Cierre. Es lo que permite comparar la previsión con lo que pasó.`,
        });
      }
    }

    // 4) Campaña fiscal: 1/12 (la lista) y 20/12 (últimas decisiones).
    if (options.kinds.fiscal) {
      [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1].forEach((year) => {
        put({
          uid: `rec-fiscal-${year}-12-01`, kind: "fiscal", date: `${year}-12-01`,
          title: "Campaña fiscal: mirad la lista",
          description: "Quedan 30 días para las decisiones que ahorran impuestos de este año (pensiones, vivienda, compensación de pérdidas, donativos). La lista está en Herramientas avanzadas › Fiscal. Son estimaciones: confirmadlas con un asesor.",
        });
        put({
          uid: `rec-fiscal-${year}-12-20`, kind: "fiscal", date: `${year}-12-20`,
          title: "Últimos días para decisiones fiscales",
          description: "Las aportaciones y donativos que deban contar en este año tienen que estar hechos antes del 31/12. Repasad la lista de Herramientas avanzadas › Fiscal y decidid hoy lo que falte.",
        });
      });
    }

    // 5) Revisión del tipo variable de la hipoteca (WP-20): 60 y 30 días antes, solo los avisos que aún caen en el futuro. Si los dos ya pasaron
    // y la revisión sigue por delante, uno para hoy: mejor tarde que nunca. El título no lleva importes; la cuota estimada va en el detalle.
    if (options.kinds.rateReview) {
      (Array.isArray(input.reviews) ? input.reviews : []).forEach((review) => {
        const reviewDate = utc(review?.date) ? isoOf(utc(review.date)) : "";
        if (!reviewDate || reviewDate < today) return;
        const low = Number(review.low);
        const high = Number(review.high);
        const range = Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > 0 ? ` Cuota estimada de ${euros(low)} a ${euros(high)} (± 1 punto sobre el último Euribor tecleado).` : "";
        const description = (days) => `El ${longDate(reviewDate)} se revisa el tipo de la hipoteca (${days === 0 ? "es hoy" : `faltan ${days} días`}).${range} Es una estimación, no un pronóstico. El detalle está en Deuda › Contratos. Si queréis comparar ofertas o hablar con el banco, este es el momento; la app no ejecuta nada.`;
        const notices = REVIEW_NOTICE_DAYS.map((days) => ({ days, date: addDays(reviewDate, -days) }));
        const upcoming = notices.filter((notice) => notice.date >= today);
        upcoming.forEach((notice) => put({
          uid: `rec-revision-${reviewDate}-${notice.days}`, kind: "rateReview", date: notice.date,
          title: `Revisión del tipo de la hipoteca en ${notice.days} días`, description: description(notice.days),
        }));
        if (!upcoming.length) {
          const left = Math.round((utc(reviewDate).getTime() - utc(today).getTime()) / 86400000);
          put({
            uid: `rec-revision-${reviewDate}-aviso`, kind: "rateReview", date: today,
            title: left === 0 ? "Hoy se revisa el tipo de la hipoteca" : `Revisión del tipo de la hipoteca en ${left} día${left === 1 ? "" : "s"}`,
            description: description(left),
          });
        }
      });
    }

    const list = [...events.values()].sort((a, b) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid)).slice(0, MAX_EVENTS);
    const counts = Object.fromEntries(KINDS.map((kind) => [kind, list.filter((event) => event.kind === kind).length]));
    return { schemaId: SCHEMA_ID, status: "ok", missing: [], today, horizonEnd, events: list, counts, skipped, options };
  }

  // ---- .ics (RFC 5545) ----
  const escapeText = (value) => String(value ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

  /** Pliega una línea a 75 octetos UTF-8, como exige el RFC (los lectores estrictos descartan las largas). */
  function fold(line) {
    const out = [];
    let current = "";
    let bytes = 0;
    for (const char of line) {
      const size = utf8Size(char);
      if (bytes + size > (out.length === 0 ? 75 : 74)) { out.push(current); current = char; bytes = size; } else { current += char; bytes += size; }
    }
    out.push(current);
    return out.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
  }
  function utf8Size(char) {
    const code = char.codePointAt(0);
    return code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }

  const stamp = (now) => new Date(now).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateValue = (iso) => iso.replace(/-/g, "");

  /**
   * @param {Array<{uid: string, date: string, title: string, description?: string}>} events
   * @param {{now?: string|number|Date, alarmHour?: number}} [options]
   */
  function toIcs(events, options = {}) {
    const hour = Number.isInteger(options.alarmHour) && options.alarmHour >= 0 && options.alarmHour <= 23 ? options.alarmHour : 9;
    const dtstamp = stamp(options.now ?? new Date());
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Finanzas Casa//Recordatorios//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Finanzas Casa · recordatorios"];
    (Array.isArray(events) ? events : []).forEach((event) => {
      if (!utc(event?.date)) return;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.uid}@contabilidadcasa`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dateValue(event.date)}`,
        `DTEND;VALUE=DATE:${dateValue(addDays(event.date, 1))}`,
        `SUMMARY:${escapeText(event.title)}`,
        `DESCRIPTION:${escapeText(event.description || "")}`,
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(event.title)}`,
        `TRIGGER;RELATED=START:PT${hour}H`,
        "END:VALARM",
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");
    return `${lines.map(fold).join("\r\n")}\r\n`;
  }

  /** ¿Hay que regenerar el fichero? Sí si nunca se ha generado, si hace más de 30 días o si queda menos de un mes cubierto. */
  function staleness({ lastGeneratedAt, today, coveredUntil }) {
    if (!lastGeneratedAt || !utc(lastGeneratedAt)) return { stale: true, reason: "never", label: "Todavía no has generado el fichero." };
    const age = Math.round((utc(today).getTime() - utc(lastGeneratedAt).getTime()) / 86400000);
    if (age > 30) return { stale: true, reason: "old", ageDays: age, label: `El fichero tiene ${age} días: el plan puede haber cambiado. Genéralo de nuevo.` };
    if (coveredUntil && utc(coveredUntil) && Math.round((utc(coveredUntil).getTime() - utc(today).getTime()) / 86400000) < 30) return { stale: true, reason: "short", ageDays: age, label: "El fichero cubre menos de un mes por delante. Genéralo de nuevo." };
    return { stale: false, reason: "fresh", ageDays: age, label: age === 0 ? "Generado hoy." : `Generado hace ${age} día${age === 1 ? "" : "s"}.` };
  }

  return Object.freeze({ SCHEMA_ID, KINDS, DEFAULTS, CERTAIN, MAX_EVENTS, build, toIcs, fold, staleness, longDate });
});
