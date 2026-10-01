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

  function build(monthlyInput, rows, options = {}) {
    const events = [];
    const months = (monthlyInput.months || []).map((month, index) => {
      const row = rows[index] || {};
      const payrollDate = month.mainPayrollDate || dailyAuditFallbackDate(month.monthKey, monthEndDate(dateFromMonthKey(month.monthKey)).getDate());
      const fixedCoreSpend = round2(Number(row.fixedCoreSpend ?? Math.max(0, Number(row.coreSpend || 0) - Number(row.variableOperationalSpend || 0))));
      const variableOperationalSpend = round2(Number(row.variableOperationalSpend || 0));
      const car = round2(Number(row.car || 0));
      const refi = round2(Number(row.refi || 0));
      const projectOutflow = round2(Number(row.projectOutflow || 0));
      const incomeEvents = month.incomeEvents || [];
      const expenseEvents = month.expenseEvents || [];

      distributeDailyAuditEvents(events, month, incomeEvents, row.income, {
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
      distributeDailyAuditEvents(events, month, expenseEvents.filter((event) => event.field === "variableOperationalSpend"), variableOperationalSpend, {
        kind: "outflow",
        field: "variableOperationalSpend",
        accountId: "checking",
        label: "Gastos variables",
        date: dailyAuditFallbackDate(month.monthKey, 8),
        source: "planificación mensual",
        confidence: "estimated",
        priority: 45,
      });
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
      pushDailyAuditEvent(events, month, {
        kind: "outflow",
        field: "projectOutflow",
        accountId: "checking",
        label: "Proyecto o decisión",
        amount: projectOutflow,
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
        amount: Number(row.saving || 0),
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

  return { build };
});
