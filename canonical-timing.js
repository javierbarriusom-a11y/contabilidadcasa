(function attachCanonicalTiming(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalTiming = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalTiming() {
  "use strict";

  // WP-07 (NTC-01, docs/PLAN_IMPLEMENTACION_2026-10-03.md): el motor que decide QUÉ DÍA del mes cae cada
  // ingreso y cada gasto del plan, extraído de app.js SIN CAMBIO DE COMPORTAMIENTO (equivalencia campo a
  // campo en tests/ntc1-motor-fechas.test.cjs). WP-08 añade aquí el día de cargo indicado por el hogar.
  //
  // Orden de las reglas, que no se cambia sin decisión del hogar (tests/nomina-javi-ultimo-dia-natural.test.cjs):
  // - Ingresos: local (día 1) → Tere (día 25, a propósito más tarde de lo real) → nómina de Javi (último día
  //   NATURAL, antes que la regla de diciembre) → bonus/diciembre (día 15 en diciembre, último hábil el resto)
  //   → movimiento real casado → estimación alisada (día 8).
  // - Gastos: regla de fin de mes (trastero, parking, psicólogo) → movimiento real casado → estimación (día 8).
  // - Gastos con día de cargo indicado (WP-08, `chargeDay(row)`): movimiento real casado en ese mes (es lo que
  //   pasó) → día indicado, que gana a la regla de fin de mes y a la estimación. Sin día indicado, lo de arriba
  //   sin cambios (oro de 493 casos de WP-07). Solo gastos: los ingresos con fecha ya tienen su regla.
  //
  // WP-14/WP-27 PR-2: una partida aplazada con «Aún no» / «Llegará tarde» (`deferral(row, month)`, vigente solo mientras dura el aplazamiento)
  // mueve su FECHA al día en que se vuelve a preguntar, para que el motor diario cuente ese cobro o cargo todavía pendiente en vez de darlo por
  // ocurrido. Solo mueve `date`, `label` y `source`: `day` (que ordena el mes y decide qué va antes de la nómina) y `confidence` no cambian, y solo
  // afecta a fechas ciertas (regla o declarada) ya vencidas: lo observado ya llegó y lo estimado no se pregunta. Sin `deferral`, el motor es el de
  // WP-07 (los 493 casos oro). `options.ignoreDeferral` da la fecha original: el detector de WP-14/27 pregunta por ella, no por la movida.
  //
  // Las utilidades de fecha y texto de app.js (que usan muchos otros sitios) entran por inyección, igual que
  // los movimientos importados (`transactions()`, leídos en cada llamada porque cambian al importar).

  /**
   * @param {{
   *   displayLabelForRow: (row: any) => string,
   *   normalizedText: (value: any) => string,
   *   dateFromMonthKey: (key: string) => Date,
   *   monthEndDate: (date: Date) => Date,
   *   lastBusinessDayOfMonth: (date: Date) => Date,
   *   isoLocalDate: (value: any) => string,
   *   localDateFromIso: (value: any) => Date | null,
   *   shortDate: (value: any) => string,
   *   dateWithMonthLabel: (date: Date, day: number) => string,
   *   transactions: () => Array<any>,
   *   chargeDay?: (row: any) => ({ day: number | "eom", source?: string } | null),
   *   deferral?: (row: any, month: any) => ({ date: string } | null),
   * }} deps
   */
  function createTimingEngine(deps) {
    const { displayLabelForRow, normalizedText, dateFromMonthKey, monthEndDate, lastBusinessDayOfMonth, isoLocalDate, localDateFromIso, shortDate, dateWithMonthLabel } = deps;
    const transactions = () => deps.transactions() || [];

    function isMainPayrollIncomeRow(row) {
      const label = normalizedText(displayLabelForRow(row));
      return /(^|\b)(nomina|salario)\s+javi(\b|$)|\bjavi\b.*\b(nomina|salario)\b/.test(label);
    }

    function incomeTimingFromMovements(row, month, amount) {
      const label = normalizedText(displayLabelForRow(row));
      const monthKeyValue = month?.key || "";
      if (!label || !monthKeyValue || !amount) return null;
      const candidates = transactions()
        .filter((transaction) => transaction.month === monthKeyValue && Number(transaction.amount || 0) > 0)
        .map((transaction) => {
          const text = normalizedText(`${transaction.movement || ""} ${transaction.details || ""} ${transaction.category || ""}`);
          const amountDistance = Math.abs(Number(transaction.amount || 0) - Number(amount || 0));
          let score = 0;
          if (label.includes("local") && (text.includes("ingreso recurrente 800") || text.includes("transfer inmediata"))) score += 5;
          if ((label.includes("nomina") || label.includes("salario")) && text.includes("nomina")) score += 4;
          if (label.includes("hacienda") && (text.includes("hacienda") || text.includes("tributaria") || text.includes("devoluciones tributaria"))) score += 4;
          if (label.includes("wash") && text.includes("wash")) score += 4;
          if (label.includes("bonus") && (text.includes("bonus") || text.includes("nomina"))) score += 2;
          if (amountDistance <= 1) score += 3;
          else if (amountDistance <= Math.max(10, Math.abs(amount) * 0.05)) score += 1;
          return { transaction, score, amountDistance };
        })
        .filter((item) => item.score >= 5)
        .sort((a, b) => b.score - a.score || a.amountDistance - b.amountDistance);
      const best = candidates[0]?.transaction;
      if (!best?.date) return null;
      const date = localDateFromIso(best.date) || new Date(best.date);
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
      return {
        day: date.getDate(),
        date: isoLocalDate(date),
        source: "movimiento real identificado",
        label: shortDate(date),
        confidence: "observed",
        role: "",
      };
    }

    // Aplaza una fecha cierta ya vencida hasta `deferral.date`. Cualquier otra cosa (estimada, observada, aún no vencida) queda como estaba.
    function deferred(timing, row, month, options) {
      if (options?.ignoreDeferral || !deps.deferral || !["rule", "declared"].includes(timing.confidence)) return timing;
      const entry = deps.deferral(row, month);
      const target = localDateFromIso(entry?.date);
      if (!entry || !target || entry.date <= timing.date) return timing;
      return { ...timing, date: isoLocalDate(new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12)), label: shortDate(target), source: `${timing.source}, aplazado hasta el ${shortDate(target)}`, deferredFrom: timing.date };
    }

    function incomeTimingForRow(row, month, amount, options) {
      return deferred(incomeTimingBase(row, month, amount), row, month, options);
    }

    function incomeTimingBase(row, month, amount) {
      const label = normalizedText(displayLabelForRow(row));
      const date = dateFromMonthKey(month.key);
      if (label.includes("local")) {
        return { day: 1, date: isoLocalDate(new Date(date.getFullYear(), date.getMonth(), 1, 12)), source: "regla local", label: dateWithMonthLabel(date, 1), confidence: "rule", role: "" };
      }
      if (/(\bnomina\b|\bsalario\b).*\btere\b|\btere\b.*(\bnomina\b|\bsalario\b)/.test(label)) {
        return { day: 25, date: isoLocalDate(new Date(date.getFullYear(), date.getMonth(), 25, 12)), source: "regla salario Tere", label: dateWithMonthLabel(date, 25), confidence: "rule", role: "" };
      }
      if (isMainPayrollIncomeRow(row)) {
        const day = monthEndDate(date).getDate(); // último día natural, decisión del hogar 1/10/2026 (más prudente)
        return { day, date: isoLocalDate(new Date(date.getFullYear(), date.getMonth(), day, 12)), source: "regla nómina Javi", label: dateWithMonthLabel(date, day), confidence: "rule", role: "main-payroll" };
      }
      if (
        label.includes("bonus") ||
        label.includes("bono") ||
        (date.getMonth() === 11 && (label.includes("hacienda") || label.includes("extra") || Number(amount || 0) >= 2500))
      ) {
        const day = date.getMonth() === 11 ? 15 : lastBusinessDayOfMonth(date).getDate();
        return { day, date: isoLocalDate(new Date(date.getFullYear(), date.getMonth(), day, 12)), source: date.getMonth() === 11 ? "regla bono diciembre" : "regla bonus Javi", label: dateWithMonthLabel(date, day), confidence: "rule", role: "" };
      }
      const movementTiming = incomeTimingFromMovements(row, month, amount);
      if (movementTiming) return movementTiming;
      return { day: 8, date: isoLocalDate(new Date(date.getFullYear(), date.getMonth(), 8, 12)), source: "estimación alisada 1-15", label: dateWithMonthLabel(date, 8), confidence: "estimated", role: "" };
    }

    function isEndOfMonthExpenseRow(row) {
      const label = normalizedText(displayLabelForRow(row));
      return (
        label.includes("trastero") ||
        label.includes("parking") ||
        label.includes("psicologo") ||
        /psicologo.*sergio|sergio.*psicologo/.test(label) ||
        /pag[ao].*sergio|sergio.*pag[ao]/.test(label)
      );
    }

    function expenseTimingFromMovements(row, month, amount) {
      const label = normalizedText(displayLabelForRow(row));
      const tokens = label.split(/\s+/).filter((token) => token.length >= 4 && !["gasto", "cuota", "pago", "tarjeta"].includes(token));
      if (!month?.key || !tokens.length || !Number(amount || 0)) return null;
      const candidates = transactions()
        .filter((transaction) => transaction.month === month.key && Number(transaction.amount || 0) < 0)
        .map((transaction) => {
          const text = normalizedText(`${transaction.movement || ""} ${transaction.details || ""} ${transaction.category || ""}`);
          const tokenHits = tokens.filter((token) => text.includes(token)).length;
          const amountDistance = Math.abs(Math.abs(Number(transaction.amount || 0)) - Math.abs(Number(amount || 0)));
          let score = tokenHits * 3;
          if (amountDistance <= 0.02) score += 4;
          else if (amountDistance <= Math.max(2, Math.abs(amount) * 0.03)) score += 2;
          return { transaction, score, amountDistance };
        })
        .filter((item) => item.score >= 5)
        .sort((a, b) => b.score - a.score || a.amountDistance - b.amountDistance);
      const best = candidates[0]?.transaction;
      const date = localDateFromIso(best?.date) || (best?.date ? new Date(best.date) : null);
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
      return { day: date.getDate(), date: isoLocalDate(date), source: "movimiento real identificado", label: shortDate(date), confidence: "observed", role: "" };
    }

    // «Fin de mes» es el último día natural; un 31 en un mes corto cae en su último día. Si coincide con el
    // último día, cuenta como gasto de fin de mes (después de la nómina), igual que la regla.
    function declaredExpenseTiming(row, date) {
      const entry = deps.chargeDay ? deps.chargeDay(row) : null;
      const lastDay = monthEndDate(date).getDate();
      const value = entry?.day;
      const day = value === "eom" ? lastDay : Number.isInteger(value) && value >= 1 && value <= 31 ? Math.min(value, lastDay) : null;
      if (!day) return null;
      const timing = { day, date: isoLocalDate(new Date(date.getFullYear(), date.getMonth(), day, 12)), source: entry.source === "sugerido" ? "día de cargo propuesto y aceptado" : "día de cargo indicado", label: dateWithMonthLabel(date, day), confidence: "declared", role: "" };
      return day === lastDay ? { ...timing, endOfMonth: true } : timing;
    }

    function expenseTimingForRow(row, month, amount, options) {
      return deferred(expenseTimingBase(row, month, amount), row, month, options);
    }

    function expenseTimingBase(row, month, amount) {
      const date = dateFromMonthKey(month.key);
      const declared = declaredExpenseTiming(row, date);
      if (declared) return expenseTimingFromMovements(row, month, amount) || declared;
      if (isEndOfMonthExpenseRow(row)) {
        const day = monthEndDate(date).getDate();
        return { day, date: isoLocalDate(new Date(date.getFullYear(), date.getMonth(), day, 12)), source: "regla gasto fin de mes", label: dateWithMonthLabel(date, day), confidence: "rule", role: "", endOfMonth: true };
      }
      const movementTiming = expenseTimingFromMovements(row, month, amount);
      if (movementTiming) return movementTiming;
      return { day: 8, date: isoLocalDate(new Date(date.getFullYear(), date.getMonth(), 8, 12)), source: "estimación alisada 1-15", label: dateWithMonthLabel(date, 8), confidence: "estimated", role: "" };
    }

    return { isMainPayrollIncomeRow, incomeTimingFromMovements, incomeTimingForRow, isEndOfMonthExpenseRow, expenseTimingFromMovements, declaredExpenseTiming, expenseTimingForRow };
  }

  return { createTimingEngine };
});
