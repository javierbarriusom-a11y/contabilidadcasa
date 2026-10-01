(function attachCanonicalHomeVerdict(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalHomeVerdict = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalHomeVerdict() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-home-verdict/v1";
  const CONFIDENCE_RANK = { observed: 0, rule: 1, estimated: 2 };
  const CHECKING = "checking";

  // Cada dato que puede faltar tiene un nombre propio: la pantalla dice «falta la fecha del próximo
  // ingreso», nunca un «—» sin explicación (H-10). `reason` distingue «no hay» de «no sirve».
  const MISSING = {
    asOfDate: { key: "asOfDate", label: "fecha de los saldos" },
    checkingBalance: { key: "checkingBalance", label: "saldo de CaixaBank" },
    reserveFloor: { key: "reserveFloor", label: "suelo de reserva" },
    nextIncomeDate: { key: "nextIncomeDate", label: "fecha del próximo ingreso" },
    plannedCalendar: { key: "plannedCalendar", label: "calendario de salidas previstas" },
  };

  function missing(item, reason) {
    return { ...item, reason };
  }

  // null, "" y undefined son «no hay dato», no un cero: Number(null) vale 0 y convertiría un saldo
  // ausente en una cifra inventada.
  function finite(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Aritmética en céntimos enteros: sumar 0,1 + 0,2 no debe dar 0,30000000000000004.
  function toCents(value) {
    const parsed = finite(value);
    return parsed === null ? null : Math.round((parsed + Number.EPSILON) * 100);
  }

  function fromCents(cents) {
    return cents === null ? null : cents / 100;
  }

  // Solo cadenas AAAA-MM-DD (como `state.balanceDate`): un `Date` depende de la zona horaria del
  // navegador y movería el día; aquí no se admite en silencio.
  function isoDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
    if (!match) return "";
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const check = new Date(Date.UTC(year, month - 1, day, 12));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return "";
    return match[0];
  }

  function daysBetween(from, to) {
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
  }

  function normalizeConfidence(value) {
    const confidence = String(value ?? "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(CONFIDENCE_RANK, confidence) ? confidence : "estimated";
  }

  // Misma convención que `canonical-daily-engine.js`: una cuenta sin indicar es CaixaBank y un
  // evento sin tipo reconocible es una salida.
  function normalizeEvents(events) {
    return (Array.isArray(events) ? events : [])
      .map((event, index) => ({
        id: String(event?.id ?? `event-${index + 1}`),
        label: String(event?.label ?? "Movimiento sin nombre"),
        date: isoDate(event?.date),
        kind: ["income", "outflow", "transfer"].includes(event?.kind) ? event.kind : "outflow",
        accountId: String(event?.accountId || CHECKING),
        fromAccountId: String(event?.fromAccountId || CHECKING),
        cents: toCents(event?.amount) ?? 0,
        confidence: normalizeConfidence(event?.confidence),
      }))
      .filter((event) => event.date)
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  function emptyResult(asOf, incomeDate, incomeSource, missingItems, calendar, savingsAside) {
    return {
      schema: SCHEMA_ID,
      status: "missing",
      asOfDate: asOf,
      nextIncomeDate: incomeDate,
      nextIncomeSource: incomeSource,
      days: null,
      lines: null,
      margin: null,
      shortfall: null,
      perDay: null,
      sameDayOutflows: null,
      marginIfSameDayAfterIncome: null,
      signDependsOnSameDay: null,
      plannedTransfers: null,
      breakdown: null,
      calendar,
      savingsAside,
      missing: missingItems,
    };
  }

  /**
   * Cuánto se puede gastar desde hoy hasta el próximo ingreso, sin tocar la reserva:
   *   saldo de CaixaBank − suelo de reserva − salidas previstas hasta el próximo ingreso.
   *
   * Es lo que responde «¿hasta el día Y cuánto podemos gastar?». Deliberadamente NO usa la «reserva
   * protegida» (`requiredReserve` de `canonical-decisions.js`: suelo + salidas de todo el mes
   * siguiente), que responde a otra pregunta —cuánto se puede traspasar a ahorro— y daría un margen
   * engañosamente bajo.
   *
   * Reglas que fijan el resultado (cada una tiene su prueba):
   * - Nunca recorta un negativo a 0: `status: "negative"` y `shortfall` lo dicen.
   * - Si falta un dato, `status: "missing"` y `missing` lo nombra; no hay cifra, ni siquiera un 0.
   * - Ventana de salidas: `asOf < fecha <= próximo ingreso` (igual que `date > asOf` del motor
   *   diario, que da por contado en el saldo lo fechado hoy). Las del propio día del ingreso se
   *   cuentan —criterio prudente: no se sabe si caen antes o después de que entre el dinero— y se
   *   devuelven aparte (`sameDayOutflows`, `marginIfSameDayAfterIncome`, `signDependsOnSameDay`)
   *   para decir cuánto depende el número de ese supuesto. Con fechas de relleno (`estimated`, día
   *   8 de `expenseTimingForRow`) depende por completo: es lo que pasa en una app sin histórico.
   * - Los traspasos a ahorro NO restan: los decide la propia política de ahorro a partir del
   *   sobrante. Se devuelven en `plannedTransfers` para quien quiera mostrarlos.
   * - Mediolanum no entra en el margen: `savingsAside` es solo informativo.
   *
   * @param {{asOfDate?: string, checkingBalance?: number, reserveFloor?: number, events?: Array,
   *   nextIncomeDate?: string, savingsBalance?: number}} [input] `nextIncomeDate` manda sobre el
   *   primer ingreso futuro de `events`; el llamante puede pasar el que ya resuelve
   *   `coverageUntilNextIncome` (que además aprende el día típico de ingreso del histórico).
   */
  function computeHomeVerdict({ asOfDate, checkingBalance, reserveFloor, events, nextIncomeDate, savingsBalance } = {}) {
    const asOf = isoDate(asOfDate);
    const balance = toCents(checkingBalance);
    const rawFloor = toCents(reserveFloor);
    const floor = rawFloor !== null && rawFloor >= 0 ? rawFloor : null;
    const calendarEvents = normalizeEvents(events);
    const savingsCents = toCents(savingsBalance);
    const savingsAside = fromCents(savingsCents);

    let incomeDate = isoDate(nextIncomeDate);
    let incomeSource = incomeDate ? "given" : "";
    if (!incomeDate && asOf) {
      const futureIncome = calendarEvents.find((event) => event.kind === "income" && event.accountId === CHECKING && event.date > asOf);
      if (futureIncome) {
        incomeDate = futureIncome.date;
        incomeSource = "events";
      }
    }

    const calendar = {
      events: calendarEvents.length,
      lastDate: calendarEvents.length ? calendarEvents[calendarEvents.length - 1].date : "",
      coversWindow: Boolean(calendarEvents.length && incomeDate && calendarEvents[calendarEvents.length - 1].date >= incomeDate),
    };

    const missingItems = [];
    if (!asOf) missingItems.push(missing(MISSING.asOfDate, "absent"));
    if (balance === null) missingItems.push(missing(MISSING.checkingBalance, "absent"));
    if (floor === null) missingItems.push(missing(MISSING.reserveFloor, rawFloor === null ? "absent" : "invalid"));
    if (!incomeDate) missingItems.push(missing(MISSING.nextIncomeDate, "absent"));
    else if (asOf && incomeDate < asOf) missingItems.push(missing(MISSING.nextIncomeDate, "past"));
    if (!calendarEvents.length) missingItems.push(missing(MISSING.plannedCalendar, "absent"));
    if (missingItems.length) return emptyResult(asOf, incomeDate, incomeSource, missingItems, calendar, savingsAside);

    const inWindow = (event) => event.date > asOf && event.date <= incomeDate;
    const outflows = calendarEvents.filter((event) => event.kind === "outflow" && event.accountId === CHECKING && inWindow(event));
    const transfers = calendarEvents.filter((event) => event.kind === "transfer" && event.fromAccountId === CHECKING && inWindow(event));
    const sum = (items) => items.reduce((total, event) => total + event.cents, 0);

    const outflowCents = sum(outflows);
    const sameDayCents = sum(outflows.filter((event) => event.date === incomeDate));
    const marginCents = balance - floor - outflowCents;
    const days = daysBetween(asOf, incomeDate);
    const byConfidence = { observed: 0, rule: 0, estimated: 0 };
    outflows.forEach((event) => { byConfidence[event.confidence] += event.cents; });
    const worst = outflows.reduce((rank, event) => Math.max(rank, CONFIDENCE_RANK[event.confidence]), 0);

    return {
      schema: SCHEMA_ID,
      status: marginCents < 0 ? "negative" : "ok",
      asOfDate: asOf,
      nextIncomeDate: incomeDate,
      nextIncomeSource: incomeSource,
      days,
      lines: {
        cash: fromCents(balance),
        floor: fromCents(floor),
        plannedOutflows: fromCents(outflowCents),
        margin: fromCents(marginCents),
      },
      margin: fromCents(marginCents),
      shortfall: marginCents < 0 ? fromCents(-marginCents) : 0,
      perDay: marginCents >= 0 && days > 0 ? Math.round(marginCents / days) / 100 : null,
      sameDayOutflows: fromCents(sameDayCents),
      marginIfSameDayAfterIncome: fromCents(marginCents + sameDayCents),
      // Verdadero cuando el signo del margen cambia según el supuesto anterior: ahí la pantalla no debe
      // dar el número como cierto, sino decir de qué depende.
      signDependsOnSameDay: (marginCents < 0) !== (marginCents + sameDayCents < 0),
      plannedTransfers: fromCents(sum(transfers)),
      breakdown: {
        items: outflows.map((event) => ({ id: event.id, label: event.label, date: event.date, amount: fromCents(event.cents), confidence: event.confidence })),
        byConfidence: {
          observed: fromCents(byConfidence.observed),
          rule: fromCents(byConfidence.rule),
          estimated: fromCents(byConfidence.estimated),
        },
        confidence: Object.keys(CONFIDENCE_RANK).find((key) => CONFIDENCE_RANK[key] === worst),
        estimatedShare: outflowCents ? Math.round((byConfidence.estimated / outflowCents) * 1000) / 1000 : null,
      },
      calendar,
      savingsAside,
      missing: [],
    };
  }

  return { SCHEMA_ID, MISSING, computeHomeVerdict };
});
