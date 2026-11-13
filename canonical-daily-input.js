(function attachCanonicalDailyInput(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDailyInput = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalDailyInput() {
  "use strict";

  // S1 (docs/OLA2_SUELO_Y_DISPONIBLE.md §8): extraído sin cambios de comportamiento desde app.js
  // para liberar líneas bajo el techo ARQ-4. Convierte la entrada mensual del motor canónico en la
  // entrada de eventos del motor diario (canonical-daily-engine.js). Es puro: lo único que antes
  // leía del estado de la app, la reserva operativa, llega por `options.operatingReserve`.
  // Las fechas son locales (igual que en app.js), no UTC.

  function round2(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  function dateFromMonthKey(key) {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }

  function monthEndDate(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function dateInMonth(date, day) {
    const cappedDay = Math.min(Math.max(1, Number(day) || 1), monthEndDate(date).getDate());
    return new Date(date.getFullYear(), date.getMonth(), cappedDay);
  }

  function isoLocalDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dailyAuditFallbackDate(monthKeyValue, day = 8) {
    const monthDate = dateFromMonthKey(monthKeyValue);
    if (!(monthDate instanceof Date) || Number.isNaN(monthDate.getTime())) return "";
    return isoLocalDate(dateInMonth(monthDate, day));
  }

  function pushDailyAuditEvent(events, month, input = {}) {
    const amount = round2(Number(input.amount || 0));
    if (Math.abs(amount) < 0.005) return;
    const eventIndex = events.length + 1;
    events.push({
      id: `daily-${month.monthKey}-${input.field || input.kind || "event"}-${eventIndex}`,
      date: input.date || dailyAuditFallbackDate(month.monthKey, input.day || 8),
      kind: input.kind || "outflow",
      field: input.field || "fixedCoreSpend",
      label: input.label || "Movimiento estimado",
      amount,
      accountId: input.accountId || "checking",
      fromAccountId: input.fromAccountId || "checking",
      toAccountId: input.toAccountId || "savings",
      source: input.source || "motor mensual canónico",
      confidence: input.confidence || "estimated",
      role: input.role || "",
      priority: Number(input.priority ?? 50),
      sequence: eventIndex,
    });
  }

  function distributeDailyAuditEvents(events, month, items, target, defaults = {}) {
    const amountTarget = round2(Number(target || 0));
    if (Math.abs(amountTarget) < 0.005) return;
    const usable = (items || []).filter((item) => Math.abs(Number(item?.amount || 0)) >= 0.005);
    const sourceTotal = usable.reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
    if (!usable.length || sourceTotal < 0.005) {
      pushDailyAuditEvent(events, month, { ...defaults, amount: amountTarget });
      return;
    }
    let assigned = 0;
    usable.forEach((item, index) => {
      const amount = index === usable.length - 1
        ? round2(amountTarget - assigned)
        : round2(amountTarget * (Math.abs(Number(item.amount || 0)) / sourceTotal));
      assigned = round2(assigned + amount);
      pushDailyAuditEvent(events, month, {
        ...defaults,
        amount,
        date: item.date || defaults.date,
        label: item.concept || item.label || defaults.label,
        source: item.source || defaults.source,
        confidence: item.confidence || defaults.confidence,
        role: item.role || defaults.role,
      });
    });
  }

  // FX-03 (11/11/2026, el cambio de Hoy de la semana del 16/11): una sola forma de la trayectoria. El gasto variable (el súper, la
  // gasolina) no es un pago con fecha: llega repartido por el mes. Antes se cargaba entero el día estimado (el 8), así que cada mes tenía
  // un mínimo artificial ese día; la banda de caja (WP-16) ya lo repartía por igual entre los días. Ahora el motor diario hace lo mismo:
  // un trozo igual cada día del mes, en euros enteros. El total del mes no cambia (la invariante
  // `monthly-parity` del motor diario lo comprueba); cambia la forma dentro del mes. Con `options.spreadVariable === false`, lo de antes.
  function spreadDailyAuditEvents(events, month, items, target, defaults = {}) {
    const total = round2(Number(target || 0));
    if (!(total > 0)) {
      distributeDailyAuditEvents(events, month, items, target, defaults);
      return;
    }
    const first = dateFromMonthKey(month.monthKey);
    const days = monthEndDate(first).getDate();
    // En euros enteros, para no llenar los saldos de cada día de céntimos que nadie ha gastado: los primeros días llevan un euro de más
    // hasta cuadrar, y los céntimos del total (si los hay) van al último día.
    const whole = Math.floor(total);
    const cents = round2(total - whole);
    const base = Math.floor(whole / days);
    const extra = whole - base * days;
    const label = (items || []).find((item) => item?.concept || item?.label);
    for (let day = 1; day <= days; day += 1) {
      const amount = round2(base + (day <= extra ? 1 : 0) + (day === days ? cents : 0));
      if (!(amount > 0)) continue;
      pushDailyAuditEvent(events, month, {
        ...defaults,
        amount,
        date: isoLocalDate(dateInMonth(first, day)),
        label: label?.concept || label?.label || defaults.label,
        source: "gasto variable repartido por el mes",
      });
    }
  }

  // 8/11/2026 · el resto del redondeo al céntimo, mes a mes. Con inflación o subida de ingresos el motor mensual da importes con
  // fracciones de céntimo; redondear cada concepto por su lado acumulaba un desfase que a los dos o tres años superaba la tolerancia
  // de la paridad diaria-mensual (0,02 €) y cortaba el recálculo de la app. Ahora cada mes:
  //   · el gasto de los conceptos suma justo el «outflowsBeforeSaving» redondeado de la fila (la diferencia, al concepto mayor);
  //   · el traspaso al ahorro deja el ahorro en el cierre redondeado de la fila;
  //   · lo que aún separe la cuenta corriente de su cierre va primero al ingreso (hasta 1 céntimo) y el resto al gasto mayor.
  // Solo absorbe céntimos: si la diferencia pasa de MAX_CENTS, la fila no cuadra de verdad y no se toca (la auditoría lo marca).
  const MAX_CENTS = 0.05;
  const OUTFLOW_FIELDS = ["fixedCoreSpend", "variableOperationalSpend", "car", "refi", "projectOutflow"];

  function build(monthlyInput, rows, options = {}) {
    const events = [];
    let simChecking = Number(monthlyInput.openingBalances?.checking) || 0;
    let simSavings = Number(monthlyInput.openingBalances?.savings) || 0;
    const months = (monthlyInput.months || []).map((month, index) => {
      const row = rows[index] || {};
      const payrollDate = month.mainPayrollDate || dailyAuditFallbackDate(month.monthKey, monthEndDate(dateFromMonthKey(month.monthKey)).getDate());
      const outflow = {
        fixedCoreSpend: round2(Number(row.fixedCoreSpend ?? Math.max(0, Number(row.coreSpend || 0) - Number(row.variableOperationalSpend || 0)))),
        variableOperationalSpend: round2(Number(row.variableOperationalSpend || 0)),
        car: round2(Number(row.car || 0)),
        refi: round2(Number(row.refi || 0)),
        projectOutflow: round2(Number(row.projectOutflow || 0)),
      };
      const mayor = OUTFLOW_FIELDS.reduce((best, field) => (Math.abs(outflow[field]) > Math.abs(outflow[best]) ? field : best), OUTFLOW_FIELDS[0]);
      const sumOutflow = () => round2(OUTFLOW_FIELDS.reduce((sum, field) => sum + outflow[field], 0));
      if (Number.isFinite(Number(row.outflowsBeforeSaving))) {
        const gap = round2(round2(Number(row.outflowsBeforeSaving)) - sumOutflow());
        if (gap && Math.abs(gap) <= MAX_CENTS) outflow[mayor] = round2(outflow[mayor] + gap);
      }
      let income = round2(Number(row.income || 0));
      let saving = round2(Number(row.saving || 0));
      if (Number.isFinite(Number(row.savings))) {
        const needed = round2(round2(Number(row.savings)) - simSavings);
        if (Math.abs(needed - saving) <= MAX_CENTS) saving = needed;
      }
      if (Number.isFinite(Number(row.checking))) {
        const gap = round2(round2(Number(row.checking)) - (simChecking + income - sumOutflow() - saving));
        if (gap && Math.abs(gap) <= MAX_CENTS) {
          const toIncome = Math.max(-0.01, Math.min(0.01, gap));
          income = round2(income + toIncome);
          outflow[mayor] = round2(outflow[mayor] - round2(gap - toIncome));
        }
      }
      simChecking = simChecking + income - sumOutflow() - saving;
      simSavings = simSavings + saving;
      const { fixedCoreSpend, variableOperationalSpend, car, refi, projectOutflow } = outflow;
      const incomeEvents = month.incomeEvents || [];
      const expenseEvents = month.expenseEvents || [];

      distributeDailyAuditEvents(events, month, incomeEvents, income, {
        kind: "income",
        field: "income",
        accountId: "checking",
        label: "Ingresos del mes",
        date: dailyAuditFallbackDate(month.monthKey, 8),
        source: "planificación mensual",
        confidence: "estimated",
        priority: 20,
      });
      distributeDailyAuditEvents(events, month, expenseEvents.filter((event) => event.field === "fixedCoreSpend"), fixedCoreSpend, {
        kind: "outflow",
        field: "fixedCoreSpend",
        accountId: "checking",
        label: "Gastos fijos",
        date: dailyAuditFallbackDate(month.monthKey, 8),
        source: "planificación mensual",
        confidence: "estimated",
        priority: 40,
      });
      const variableDefaults = {
        kind: "outflow",
        field: "variableOperationalSpend",
        accountId: "checking",
        label: "Gastos variables",
        date: dailyAuditFallbackDate(month.monthKey, 8),
        source: "planificación mensual",
        confidence: "estimated",
        priority: 45,
      };
      const variableItems = expenseEvents.filter((event) => event.field === "variableOperationalSpend");
      if (options.spreadVariable === false) distributeDailyAuditEvents(events, month, variableItems, variableOperationalSpend, variableDefaults);
      else spreadDailyAuditEvents(events, month, variableItems, variableOperationalSpend, variableDefaults);
      distributeDailyAuditEvents(events, month, expenseEvents.filter((event) => event.field === "car"), car, {
        kind: "outflow",
        field: "car",
        accountId: "checking",
        label: "Coche",
        date: dailyAuditFallbackDate(month.monthKey, 8),
        source: "planificación mensual",
        confidence: "estimated",
        priority: 50,
      });
      distributeDailyAuditEvents(events, month, expenseEvents.filter((event) => event.field === "refi"), refi, {
        kind: "outflow",
        field: "refi",
        accountId: "checking",
        label: "Financiación",
        date: dailyAuditFallbackDate(month.monthKey, 8),
        source: "planificación mensual",
        confidence: "estimated",
        priority: 55,
      });
      // FX-20 (8/11/2026): `projectOutflowSplit[mes] = { amount, date, label }` saca parte del pago de golpe del mes a otro día (un
      // escenario guardado lo pone el día más bajo del mes, para no esconder el golpe tras la nómina). Sin la opción, nada cambia.
      const split = options.projectOutflowSplit?.[month.monthKey];
      const aparte = split?.date && Number(split.amount) > 0 && projectOutflow > 0 ? Math.min(round2(Number(split.amount)), projectOutflow) : 0;
      if (aparte) {
        pushDailyAuditEvent(events, month, {
          kind: "outflow",
          field: "projectOutflow",
          accountId: "checking",
          label: split.label || "Decisión del escenario",
          amount: aparte,
          date: split.date,
          source: "escenario guardado",
          confidence: "estimated",
          priority: 60,
        });
      }
      pushDailyAuditEvent(events, month, {
        kind: "outflow",
        field: "projectOutflow",
        accountId: "checking",
        label: "Proyecto o decisión",
        amount: round2(projectOutflow - aparte),
        date: payrollDate,
        source: "calendario de decisiones",
        confidence: "rule",
        priority: 60,
      });
      pushDailyAuditEvent(events, month, {
        kind: "transfer",
        field: "saving",
        fromAccountId: "checking",
        toAccountId: "savings",
        label: "Traspaso a Mediolanum",
        amount: saving,
        date: payrollDate,
        source: "política de ahorro",
        confidence: "rule",
        role: "main-payroll",
        priority: 90,
      });

      return {
        monthKey: month.monthKey,
        label: month.month,
        mainPayrollDate: payrollDate,
        expected: {
          income: round2(Number(row.income || 0)),
          outflowsBeforeSaving: round2(Number(row.outflowsBeforeSaving || 0)),
          saving: round2(Number(row.saving || 0)),
          closingChecking: round2(Number(row.checking || 0)),
          closingSavings: round2(Number(row.savings || 0)),
          closingLiquidity: round2(Number(row.totalLiquidity || 0)),
        },
      };
    });
    return {
      openingBalances: monthlyInput.openingBalances,
      policy: { operatingReserve: Number(options.operatingReserve || 0) },
      months,
      events,
      startDate: months.length ? `${months[0].monthKey}-01` : "",
      endDate: months.length ? isoLocalDate(monthEndDate(dateFromMonthKey(months.at(-1).monthKey))) : "",
    };
  }

  // PR-2 de WP-14/27: la huella del motor mensual recoge las fechas de los ingresos pero no las de los gastos, así que la ejecución diaria
  // guardada no se enteraba de que un cargo cambiaba de día (aplazado, o con el día de cargo indicado en WP-08). Esta firma cubre día, importe
  // y partida de cada gasto fechado; app.js la compara junto a la huella antes de reutilizar la ejecución anterior.
  function datesSignature(monthlyInput) {
    let hash = 5381;
    const text = (monthlyInput?.months || []).map((month) => (month.expenseEvents || []).map((event) => `${event.date}|${event.field}|${round2(event.amount)}|${event.confidence || ""}`).join(";")).join("/");
    for (let index = 0; index < text.length; index += 1) hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
    return hash.toString(36);
  }

  return { build, datesSignature };
});
