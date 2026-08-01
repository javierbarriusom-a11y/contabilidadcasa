(function attachCanonicalDailyEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDailyEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalDailyEngine() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-daily-engine/v1";
  const TOLERANCE = 0.02;
  const CONFIDENCE_LEVELS = ["observed", "rule", "estimated"];

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function text(value, fallback = "") {
    const normalized = String(value ?? "").trim();
    return normalized || fallback;
  }

  function hash(value) {
    const source = typeof value === "string" ? value : JSON.stringify(value);
    let result = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      result ^= source.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(16).padStart(8, "0");
  }

  function utcDate(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isoDate(value) {
    const date = utcDate(value);
    return date ? date.toISOString().slice(0, 10) : "";
  }

  function monthKey(value) {
    return isoDate(value).slice(0, 7);
  }

  function addDays(value, count) {
    const date = utcDate(value);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() + count);
    return date;
  }

  function monthEnd(monthKeyValue) {
    const [year, month] = String(monthKeyValue).split("-").map(Number);
    if (!year || !month) return "";
    return new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10);
  }

  function normalizeConfidence(value) {
    const confidence = text(value).toLowerCase();
    return CONFIDENCE_LEVELS.includes(confidence) ? confidence : "estimated";
  }

  function median(values = []) {
    const sorted = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  function learnCashflowPatterns(movements = []) {
    const reconciled = movements
      .filter((item) => item?.reconciled === true)
      .map((item) => ({ ...item, date: isoDate(item.date), amount: round(item.amount) }))
      .filter((item) => item.date && item.amount !== 0);
    const income = reconciled.filter((item) => item.kind === "income" || item.amount > 0);
    const outflows = reconciled.filter((item) => item.kind === "outflow" || item.amount < 0);
    const incomeDays = income.map((item) => Number(item.date.slice(8, 10)));
    const observedMonths = new Set(reconciled.map((item) => item.date.slice(0, 7))).size;
    const confidence = observedMonths >= 6 && income.length >= 6
      ? "observed"
      : observedMonths >= 3 && income.length >= 3 ? "rule" : "estimated";
    return {
      source: "reconciled-ledger",
      observedMonths,
      reconciledMovementCount: reconciled.length,
      incomeCount: income.length,
      outflowCount: outflows.length,
      typicalIncomeDay: median(incomeDays),
      typicalIncomeAmount: median(income.map((item) => Math.abs(item.amount))),
      typicalDailyOutflow: outflows.length
        ? round(outflows.reduce((sum, item) => sum + Math.abs(item.amount), 0) / Math.max(1, observedMonths * 30))
        : null,
      confidence,
      editable: true,
    };
  }

  function coverageUntilNextIncome({ asOfDate, checkingBalance = 0, events = [], movements = [], override = {} } = {}) {
    const asOf = isoDate(asOfDate);
    const learned = learnCashflowPatterns(movements);
    const futureIncome = events
      .map(normalizeEvent)
      .filter((item) => item.date > asOf && item.kind === "income")
      .sort((left, right) => left.date.localeCompare(right.date))[0];
    let nextIncomeDate = isoDate(override.nextIncomeDate) || futureIncome?.date || "";
    if (!nextIncomeDate && learned.typicalIncomeDay) {
      const base = utcDate(asOf);
      if (base) {
        const candidate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), learned.typicalIncomeDay, 12));
        if (isoDate(candidate) <= asOf) candidate.setUTCMonth(candidate.getUTCMonth() + 1);
        nextIncomeDate = isoDate(candidate);
      }
    }
    const dailyOutflow = number(override.dailyOutflow, learned.typicalDailyOutflow);
    const days = nextIncomeDate && asOf
      ? Math.max(0, Math.round((utcDate(nextIncomeDate) - utcDate(asOf)) / 86400000))
      : null;
    const required = days === null || !Number.isFinite(dailyOutflow) ? null : round(days * dailyOutflow);
    const balance = round(checkingBalance);
    return {
      asOfDate: asOf,
      nextIncomeDate,
      days,
      dailyOutflow: Number.isFinite(dailyOutflow) ? round(dailyOutflow) : null,
      required,
      balance,
      margin: required === null ? null : round(balance - required),
      covered: required === null ? null : balance >= required,
      source: override.nextIncomeDate || override.dailyOutflow !== undefined ? "manual-override" : futureIncome ? "canonical-events" : learned.source,
      confidence: override.nextIncomeDate || override.dailyOutflow !== undefined ? "observed" : futureIncome?.confidence || learned.confidence,
      learned,
      editable: true,
    };
  }

  function normalizeEvent(event, index) {
    const kind = ["income", "outflow", "transfer"].includes(event?.kind) ? event.kind : "outflow";
    const date = isoDate(event?.date);
    const field = text(event?.field, kind === "income" ? "income" : kind === "transfer" ? "saving" : "coreSpend");
    return {
      id: text(event?.id, `daily-event-${index + 1}`),
      date,
      monthKey: date.slice(0, 7),
      kind,
      field,
      label: text(event?.label, "Movimiento sin nombre"),
      amount: round(event?.amount),
      accountId: text(event?.accountId, "checking"),
      fromAccountId: text(event?.fromAccountId, "checking"),
      toAccountId: text(event?.toAccountId, "savings"),
      source: text(event?.source, "estimación"),
      confidence: normalizeConfidence(event?.confidence),
      role: text(event?.role),
      priority: number(event?.priority, 50),
      sequence: number(event?.sequence, index),
    };
  }

  function normalizeInput(rawInput = {}) {
    const months = (rawInput.months || [])
      .map((month, index) => {
        const key = text(month?.monthKey);
        return {
          index,
          monthKey: key,
          label: text(month?.label || month?.month, key),
          mainPayrollDate: isoDate(month?.mainPayrollDate || `${key}-25`),
          expected: { ...(month?.expected || {}) },
        };
      })
      .filter((month) => /^\d{4}-\d{2}$/.test(month.monthKey));
    const events = (rawInput.events || [])
      .map(normalizeEvent)
      .filter((event) => event.date)
      .sort((left, right) => left.date.localeCompare(right.date) || left.priority - right.priority || left.sequence - right.sequence);
    const startDate = isoDate(rawInput.startDate || (months[0] ? `${months[0].monthKey}-01` : events[0]?.date));
    const endDate = isoDate(rawInput.endDate || (months.at(-1) ? monthEnd(months.at(-1).monthKey) : events.at(-1)?.date));
    return {
      openingBalances: {
        checking: round(rawInput.openingBalances?.checking),
        savings: round(rawInput.openingBalances?.savings),
      },
      policy: {
        operatingReserve: round(rawInput.policy?.operatingReserve),
      },
      months,
      events,
      startDate,
      endDate,
    };
  }

  function applyEvent(balances, event) {
    const beforeChecking = balances.checking;
    const beforeSavings = balances.savings;
    const amount = round(event.amount);
    if (event.kind === "transfer") {
      balances[event.fromAccountId] = round(number(balances[event.fromAccountId]) - amount);
      balances[event.toAccountId] = round(number(balances[event.toAccountId]) + amount);
    } else {
      const direction = event.kind === "income" ? 1 : -1;
      balances[event.accountId] = round(number(balances[event.accountId]) + direction * amount);
    }
    return {
      eventId: event.id,
      label: event.label,
      kind: event.kind,
      field: event.field,
      confidence: event.confidence,
      source: event.source,
      role: event.role,
      beforeChecking,
      beforeSavings,
      beforeTotal: round(beforeChecking + beforeSavings),
      checking: balances.checking,
      savings: balances.savings,
      total: round(balances.checking + balances.savings),
    };
  }

  function buildRows(rawInput = {}) {
    const input = normalizeInput(rawInput);
    if (!input.startDate || !input.endDate || input.startDate > input.endDate) return [];
    const eventsByDate = input.events.reduce((map, event) => {
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date).push(event);
      return map;
    }, new Map());
    const balances = { ...input.openingBalances };
    const rows = [];
    for (let cursor = utcDate(input.startDate); cursor && isoDate(cursor) <= input.endDate; cursor = addDays(cursor, 1)) {
      const date = isoDate(cursor);
      const openingChecking = balances.checking;
      const openingSavings = balances.savings;
      const dayEvents = eventsByDate.get(date) || [];
      const points = [{
        eventId: "opening",
        label: "Apertura del día",
        kind: "opening",
        field: "opening",
        confidence: "observed",
        source: "continuidad diaria",
        role: "",
        beforeChecking: openingChecking,
        beforeSavings: openingSavings,
        beforeTotal: round(openingChecking + openingSavings),
        checking: openingChecking,
        savings: openingSavings,
        total: round(openingChecking + openingSavings),
      }];
      const fieldTotals = {};
      let income = 0;
      let outflows = 0;
      let transfers = 0;
      dayEvents.forEach((event) => {
        fieldTotals[event.field] = round(number(fieldTotals[event.field]) + event.amount);
        if (event.kind === "income") income = round(income + event.amount);
        if (event.kind === "outflow") outflows = round(outflows + event.amount);
        if (event.kind === "transfer") transfers = round(transfers + event.amount);
        points.push(applyEvent(balances, event));
      });
      rows.push({
        date,
        monthKey: date.slice(0, 7),
        openingChecking,
        openingSavings,
        openingTotal: round(openingChecking + openingSavings),
        income,
        outflows,
        transfers,
        fieldTotals,
        events: dayEvents,
        points,
        checking: balances.checking,
        savings: balances.savings,
        total: round(balances.checking + balances.savings),
      });
    }
    return rows;
  }

  function extremePoint(days, field, direction) {
    const points = days.flatMap((day) => day.points.map((point) => ({ ...point, date: day.date })));
    return points.reduce((selected, point) => {
      if (!selected) return point;
      return direction === "min"
        ? (number(point[field]) < number(selected[field]) ? point : selected)
        : (number(point[field]) > number(selected[field]) ? point : selected);
    }, null);
  }

  function aggregateMonths(rows, rawInput = {}) {
    const input = normalizeInput(rawInput);
    return input.months.map((month) => {
      const days = rows.filter((row) => row.monthKey === month.monthKey);
      const first = days[0];
      const last = days.at(-1);
      const fieldTotals = {};
      const confidence = { observed: 0, rule: 0, estimated: 0 };
      days.forEach((day) => {
        Object.entries(day.fieldTotals || {}).forEach(([field, amount]) => {
          fieldTotals[field] = round(number(fieldTotals[field]) + amount);
        });
        day.events.forEach((event) => { confidence[event.confidence] += 1; });
      });
      const minTotalPoint = extremePoint(days, "total", "min");
      const minCheckingPoint = extremePoint(days, "checking", "min");
      const maxTotalPoint = extremePoint(days, "total", "max");
      const payrollPoint = days
        .flatMap((day) => day.points.map((point) => ({ ...point, date: day.date })))
        .find((point) => point.role === "main-payroll");
      const expected = month.expected || {};
      const actual = {
        income: round(fieldTotals.income),
        outflowsBeforeSaving: round(
          number(fieldTotals.fixedCoreSpend) +
          number(fieldTotals.variableOperationalSpend) +
          number(fieldTotals.car) +
          number(fieldTotals.refi) +
          number(fieldTotals.projectOutflow),
        ),
        saving: round(fieldTotals.saving),
        closingChecking: round(last?.checking),
        closingSavings: round(last?.savings),
        closingLiquidity: round(last?.total),
      };
      const deltas = Object.fromEntries(Object.keys(actual).map((field) => [field, round(actual[field] - number(expected[field]))]));
      const matched = Object.values(deltas).every((delta) => Math.abs(delta) <= TOLERANCE);
      return {
        monthKey: month.monthKey,
        label: month.label,
        dayCount: days.length,
        openingChecking: round(first?.openingChecking),
        openingSavings: round(first?.openingSavings),
        openingLiquidity: round(first?.openingTotal),
        ...actual,
        fieldTotals,
        confidence,
        expected,
        deltas,
        matched,
        minTotal: round(minTotalPoint?.total),
        minTotalDate: minTotalPoint?.date || "",
        minTotalEvent: minTotalPoint?.label || "",
        minChecking: round(minCheckingPoint?.checking),
        minCheckingDate: minCheckingPoint?.date || "",
        minCheckingEvent: minCheckingPoint?.label || "",
        maxTotal: round(maxTotalPoint?.total),
        maxTotalDate: maxTotalPoint?.date || "",
        adjustedMin: round(payrollPoint?.beforeTotal ?? minTotalPoint?.total),
        adjustedMinDate: payrollPoint?.date || minTotalPoint?.date || "",
        adjustedMinEvent: payrollPoint ? "Antes de nómina Javi" : minTotalPoint?.label || "",
        estimatedEventCount: confidence.estimated,
      };
    });
  }

  function validateRows(rows, rawInput = {}, tolerance = TOLERANCE) {
    const issues = [];
    const checks = {
      finite: true,
      accountConservation: true,
      dailyConservation: true,
      continuity: true,
      monthlyParity: true,
      transferConservation: true,
    };
    rows.forEach((row, index) => {
      const finiteFields = ["openingChecking", "openingSavings", "openingTotal", "income", "outflows", "transfers", "checking", "savings", "total"];
      if (finiteFields.some((field) => !Number.isFinite(Number(row[field])))) {
        checks.finite = false;
        issues.push({ type: "finite", date: row.date });
      }
      if (Math.abs(round(row.checking + row.savings - row.total)) > tolerance) {
        checks.accountConservation = false;
        issues.push({ type: "account-conservation", date: row.date });
      }
      if (Math.abs(round(row.openingTotal + row.income - row.outflows - row.total)) > tolerance) {
        checks.dailyConservation = false;
        issues.push({ type: "daily-conservation", date: row.date });
      }
      if (index > 0) {
        const previous = rows[index - 1];
        if (Math.abs(round(previous.checking - row.openingChecking)) > tolerance || Math.abs(round(previous.savings - row.openingSavings)) > tolerance) {
          checks.continuity = false;
          issues.push({ type: "continuity", date: row.date });
        }
      }
      row.events.filter((event) => event.kind === "transfer").forEach((event) => {
        const point = row.points.find((candidate) => candidate.eventId === event.id);
        if (!point || Math.abs(round(point.beforeTotal - point.total)) > tolerance) {
          checks.transferConservation = false;
          issues.push({ type: "transfer-conservation", date: row.date, eventId: event.id });
        }
      });
    });
    const monthly = aggregateMonths(rows, rawInput);
    monthly.filter((month) => !month.matched).forEach((month) => {
      checks.monthlyParity = false;
      issues.push({ type: "monthly-parity", monthKey: month.monthKey, deltas: month.deltas });
    });
    return { valid: Object.values(checks).every(Boolean), checks, issues, checkedRows: rows.length, checkedMonths: monthly.length };
  }

  function buildSnapshot(rawInput = {}, previousSnapshot = null, meta = {}) {
    const normalized = normalizeInput(rawInput);
    const rows = buildRows(normalized);
    const monthly = aggregateMonths(rows, normalized);
    const invariants = validateRows(rows, normalized);
    const confidence = normalized.events.reduce((summary, event) => {
      summary[event.confidence] += 1;
      return summary;
    }, { observed: 0, rule: 0, estimated: 0 });
    const fingerprint = hash({ rows, monthly });
    const auditTrail = Array.isArray(previousSnapshot?.auditTrail) ? [...previousSnapshot.auditTrail] : [];
    if (!previousSnapshot || previousSnapshot.fingerprint !== fingerprint) {
      auditTrail.push({
        fingerprint,
        reason: text(meta.reason, previousSnapshot ? "daily-change" : "daily-initial"),
        generatedAt: text(meta.generatedAt, new Date().toISOString()),
      });
    }
    return {
      schema: SCHEMA_ID,
      fingerprint,
      generatedAt: text(meta.generatedAt, new Date().toISOString()),
      rowCount: rows.length,
      eventCount: normalized.events.length,
      policy: normalized.policy,
      rows,
      monthly,
      confidence,
      invariants,
      auditTrail,
    };
  }

  return {
    SCHEMA_ID,
    TOLERANCE,
    normalizeInput,
    learnCashflowPatterns,
    coverageUntilNextIncome,
    buildRows,
    aggregateMonths,
    validateRows,
    buildSnapshot,
  };
});
