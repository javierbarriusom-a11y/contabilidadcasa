/**
 * canonical-budget-schema.js
 *
 * Esquema y validación de presupuestos.
 * Define estructura, validación y persistencia de presupuestos por categoría/mes, categoría/semana
 * o categoría/año-trimestre.
 *
 * Estructura en state: state.budgets = [
 *   { id, categoryId, period, monthYear, weekKey, year, quarterKey, amountCap, source, appliedAt }
 * ]
 * `period` es "monthly" (por defecto, retrocompatible con presupuestos ya guardados sin el campo),
 * "weekly", "annual" o "quarterly". Un presupuesto mensual usa `monthYear` ("YYYY-MM") y el resto de
 * campos de periodo quedan a null; uno semanal usa `weekKey` (semana ISO-8601, "YYYY-Www") y
 * `monthYear` se deriva automáticamente (mes del jueves de esa semana, criterio ISO) para poder
 * agruparlo en vistas mensuales si hace falta; uno anual usa `year` ("YYYY"); uno trimestral usa
 * `quarterKey` ("YYYY-Qn", trimestre natural: Q1 ene-mar, Q2 abr-jun, Q3 jul-sep, Q4 oct-dic) — estos
 * dos últimos no derivan `monthYear` (a diferencia de una semana, no hay un único mes "al que
 * pertenezcan" con sentido).
 */

(function attachCanonicalBudgetSchema(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalBudgetSchema = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalBudgetSchemaFactory() {
  "use strict";

class CanonicalBudgetSchema {
  /**
   * Valida y crea un presupuesto.
   *
   * @param {Object} budget - { categoryId, period, monthYear, weekKey, amountCap, source, currency, appliedAt }
   * @returns {Object} Budget validado o null si inválido
   */
  static create(budget) {
    const validated = this.validate(budget);
    if (!validated) return null;

    return {
      id: this._generateId(),
      categoryId: validated.categoryId,
      period: validated.period, // "monthly" | "weekly" | "annual" | "quarterly"
      monthYear: validated.monthYear, // "2026-08" format, null si no es mensual/semanal
      weekKey: validated.weekKey, // "2026-W35" format, null si no es semanal
      year: validated.year, // "2026" format, null si no es anual
      quarterKey: validated.quarterKey, // "2026-Q1" format, null si no es trimestral
      amountCap: validated.amountCap,
      source: validated.source, // "suggested" | "manual" | "carryover" | "goal" | "repeated" | "imported"
      currency: validated.currency || 'EUR',
      appliedAt: validated.appliedAt || new Date().toISOString(),
    };
  }

  /**
   * Valida un presupuesto contra el esquema.
   */
  static validate(budget) {
    if (!budget || typeof budget !== 'object') return null;

    const { categoryId, monthYear, weekKey, year, quarterKey, amountCap, source, currency, appliedAt } = budget;
    const period =
      budget.period === 'weekly' ? 'weekly'
      : budget.period === 'annual' ? 'annual'
      : budget.period === 'quarterly' ? 'quarterly'
      : 'monthly';

    // Validar categoryId
    if (!categoryId || typeof categoryId !== 'string') return null;

    let resolvedMonthYear = null;
    let resolvedWeekKey = null;
    let resolvedYear = null;
    let resolvedQuarterKey = null;

    if (period === 'weekly') {
      // Validar weekKey (semana ISO-8601, formato YYYY-Www)
      if (!weekKey || !/^\d{4}-W\d{2}$/.test(weekKey) || !this.weekRange(weekKey)) return null;
      resolvedWeekKey = weekKey;
      // monthYear es opcional en la entrada para un presupuesto semanal: se deriva de la semana si
      // no se da explícitamente (agrupación por mes, criterio del jueves ISO).
      resolvedMonthYear = monthYear && /^\d{4}-\d{2}$/.test(monthYear) ? monthYear : this.monthYearForWeek(weekKey);
    } else if (period === 'annual') {
      // Validar year (formato YYYY)
      if (!year || !/^\d{4}$/.test(year)) return null;
      resolvedYear = year;
    } else if (period === 'quarterly') {
      // Validar quarterKey (trimestre natural, formato YYYY-Qn)
      if (!quarterKey || !/^\d{4}-Q[1-4]$/.test(quarterKey)) return null;
      resolvedQuarterKey = quarterKey;
    } else {
      // Validar monthYear (formato YYYY-MM)
      if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) return null;
      resolvedMonthYear = monthYear;
    }

    // Validar amountCap (número positivo)
    if (typeof amountCap !== 'number' || amountCap <= 0) return null;

    // Validar source
    const validSources = ['suggested', 'manual', 'carryover', 'goal', 'repeated', 'imported'];
    if (source && !validSources.includes(source)) return null;

    // Validar currency (ISO 4217)
    if (currency && (typeof currency !== 'string' || currency.length !== 3)) return null;

    // Validar appliedAt (ISO timestamp)
    if (appliedAt && isNaN(Date.parse(appliedAt))) return null;

    return {
      categoryId,
      period,
      monthYear: resolvedMonthYear,
      weekKey: resolvedWeekKey,
      year: resolvedYear,
      quarterKey: resolvedQuarterKey,
      amountCap: Math.round(amountCap * 100) / 100,
      source: source || 'manual',
      currency: currency || 'EUR',
      appliedAt: appliedAt || new Date().toISOString(),
    };
  }

  /**
   * Busca presupuesto de una categoría en un mes específico.
   * Solo presupuestos mensuales (o guardados antes de que existiera `period`, que se tratan como
   * mensuales) — un presupuesto semanal nunca aparece aquí aunque su `monthYear` derivado coincida.
   */
  static findForCategoryMonth(budgets = [], categoryId, monthYear) {
    return budgets.find(
      b => b.categoryId === categoryId && b.monthYear === monthYear && (b.period || 'monthly') === 'monthly'
    );
  }

  /**
   * Busca todos los presupuestos mensuales de un mes.
   */
  static findForMonth(budgets = [], monthYear) {
    return budgets.filter(b => b.monthYear === monthYear && (b.period || 'monthly') === 'monthly');
  }

  /**
   * Busca presupuesto de una categoría en una semana ISO específica ("YYYY-Www").
   */
  static findForCategoryWeek(budgets = [], categoryId, weekKey) {
    return budgets.find(b => b.categoryId === categoryId && b.weekKey === weekKey && b.period === 'weekly');
  }

  /**
   * Busca todos los presupuestos semanales de una semana ISO.
   */
  static findForWeek(budgets = [], weekKey) {
    return budgets.filter(b => b.weekKey === weekKey && b.period === 'weekly');
  }

  /**
   * Reemplaza o actualiza presupuesto.
   * Si existe para categoría/periodo (mes, semana, año o trimestre), reemplaza; si no, añade.
   */
  static upsert(budgets = [], newBudget) {
    const validated = this.create(newBudget);
    if (!validated) return budgets;

    const index =
      validated.period === 'weekly'
        ? budgets.findIndex(b => b.categoryId === validated.categoryId && b.weekKey === validated.weekKey && b.period === 'weekly')
        : validated.period === 'annual'
        ? budgets.findIndex(b => b.categoryId === validated.categoryId && b.year === validated.year && b.period === 'annual')
        : validated.period === 'quarterly'
        ? budgets.findIndex(b => b.categoryId === validated.categoryId && b.quarterKey === validated.quarterKey && b.period === 'quarterly')
        : budgets.findIndex(b => b.categoryId === validated.categoryId && b.monthYear === validated.monthYear && (b.period || 'monthly') === 'monthly');

    if (index >= 0) {
      return [...budgets.slice(0, index), validated, ...budgets.slice(index + 1)];
    }

    return [...budgets, validated];
  }

  /**
   * Elimina presupuesto. `period` por defecto "monthly" mantiene la firma anterior de tres
   * argumentos (categoryId, monthYear) funcionando sin cambios para todo el código existente.
   */
  static delete(budgets = [], categoryId, periodKey, period = 'monthly') {
    if (period === 'weekly') {
      return budgets.filter(b => !(b.categoryId === categoryId && b.weekKey === periodKey && b.period === 'weekly'));
    }
    if (period === 'annual') {
      return budgets.filter(b => !(b.categoryId === categoryId && b.year === periodKey && b.period === 'annual'));
    }
    if (period === 'quarterly') {
      return budgets.filter(b => !(b.categoryId === categoryId && b.quarterKey === periodKey && b.period === 'quarterly'));
    }
    return budgets.filter(
      b => !(b.categoryId === categoryId && b.monthYear === periodKey && (b.period || 'monthly') === 'monthly')
    );
  }

  /**
   * Retorna presupuestos mensuales de un mes agrupados por categoría.
   */
  static byCategory(budgets = [], monthYear) {
    const result = {};
    this.findForMonth(budgets, monthYear).forEach(b => {
      result[b.categoryId] = b.amountCap;
    });
    return result;
  }

  /**
   * Retorna presupuestos semanales de una semana ISO agrupados por categoría.
   */
  static byCategoryWeek(budgets = [], weekKey) {
    const result = {};
    this.findForWeek(budgets, weekKey).forEach(b => {
      result[b.categoryId] = b.amountCap;
    });
    return result;
  }

  /**
   * Busca presupuesto de una categoría en un año específico ("YYYY").
   */
  static findForCategoryYear(budgets = [], categoryId, year) {
    return budgets.find(b => b.categoryId === categoryId && b.year === year && b.period === 'annual');
  }

  /**
   * Busca todos los presupuestos anuales de un año.
   */
  static findForYear(budgets = [], year) {
    return budgets.filter(b => b.year === year && b.period === 'annual');
  }

  /**
   * Busca presupuesto de una categoría en un trimestre natural específico ("YYYY-Qn").
   */
  static findForCategoryQuarter(budgets = [], categoryId, quarterKey) {
    return budgets.find(b => b.categoryId === categoryId && b.quarterKey === quarterKey && b.period === 'quarterly');
  }

  /**
   * Busca todos los presupuestos trimestrales de un trimestre natural.
   */
  static findForQuarter(budgets = [], quarterKey) {
    return budgets.filter(b => b.quarterKey === quarterKey && b.period === 'quarterly');
  }

  /**
   * Retorna presupuestos anuales de un año agrupados por categoría.
   */
  static byCategoryYear(budgets = [], year) {
    const result = {};
    this.findForYear(budgets, year).forEach(b => {
      result[b.categoryId] = b.amountCap;
    });
    return result;
  }

  /**
   * Retorna presupuestos trimestrales de un trimestre natural agrupados por categoría.
   */
  static byCategoryQuarter(budgets = [], quarterKey) {
    const result = {};
    this.findForQuarter(budgets, quarterKey).forEach(b => {
      result[b.categoryId] = b.amountCap;
    });
    return result;
  }

  /**
   * "YYYY-MM-DD" en hora local — mismas convenciones de fecha que el resto del fichero (
   * `currentBudgetMonthKey`/`recentBudgetMonthKeys` en app.js usan Date local, nunca UTC).
   */
  static _isoDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * Lunes de la semana ISO-8601 a la que pertenece `date` (hora local, a medianoche).
   */
  static _isoWeekMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayNum = (d.getDay() + 6) % 7; // lunes=0 ... domingo=6
    d.setDate(d.getDate() - dayNum);
    return d;
  }

  /**
   * Año y número de semana ISO-8601 de `date` (la semana 1 es la que contiene el primer jueves
   * del año).
   */
  static _isoWeekNumber(date) {
    const monday = this._isoWeekMonday(date);
    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);
    const yearStart = new Date(thursday.getFullYear(), 0, 1);
    const weekNo = Math.ceil((Math.round((thursday - yearStart) / 86400000) + 1) / 7);
    return { isoYear: thursday.getFullYear(), weekNo };
  }

  /**
   * Clave de semana ISO-8601 ("YYYY-Www") a la que pertenece una fecha.
   */
  static weekKeyFromDate(date = new Date()) {
    const { isoYear, weekNo } = this._isoWeekNumber(date);
    return `${isoYear}-W${String(weekNo).padStart(2, '0')}`;
  }

  /**
   * Rango de fechas (lunes a domingo, ambos incluidos) de una semana ISO, como fechas
   * "YYYY-MM-DD" — mismo formato que `row.date` en los movimientos, para comparar con `>=`/`<=`
   * sin construir objetos Date en cada filtro. Devuelve null si `weekKey` no es válido.
   */
  static weekRange(weekKey) {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
    if (!match) return null;
    const isoYear = Number(match[1]);
    const weekNo = Number(match[2]);
    if (weekNo < 1 || weekNo > 53) return null;
    const jan4Monday = this._isoWeekMonday(new Date(isoYear, 0, 4));
    const start = new Date(jan4Monday);
    start.setDate(jan4Monday.getDate() + (weekNo - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    // Una semana 53 solo es válida si su clave normalizada coincide con la pedida — evita aceptar
    // "2026-W53" cuando 2026 solo tiene 52 semanas ISO.
    if (this.weekKeyFromDate(start) !== weekKey) return null;
    return { start: this._isoDateString(start), end: this._isoDateString(end) };
  }

  /**
   * Mes ("YYYY-MM") al que se agrupa una semana ISO — el del jueves de esa semana, mismo criterio
   * ISO que decide a qué año pertenece la semana.
   */
  static monthYearForWeek(weekKey) {
    const range = this.weekRange(weekKey);
    if (!range) return null;
    const [y, m, d] = range.start.split('-').map(Number);
    const thursday = new Date(y, m - 1, d + 3);
    return `${thursday.getFullYear()}-${String(thursday.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Año en curso ("YYYY"), hora local — BUD-3 (FASE 7): presupuestos anuales.
   */
  static currentYearKey(date = new Date()) {
    return `${date.getFullYear()}`;
  }

  /**
   * Rango de fechas (1 de enero a 31 de diciembre, ambos incluidos) de un año, como fechas
   * "YYYY-MM-DD". Devuelve null si `year` no tiene formato "YYYY".
   */
  static annualRange(year) {
    if (!/^\d{4}$/.test(year)) return null;
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }

  /**
   * Trimestre natural en curso ("YYYY-Qn", n=1..4), hora local.
   */
  static currentQuarterKey(date = new Date()) {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}-Q${quarter}`;
  }

  /**
   * Rango de fechas de un trimestre natural (Q1 ene-mar, Q2 abr-jun, Q3 jul-sep, Q4 oct-dic), como
   * fechas "YYYY-MM-DD". Devuelve null si `quarterKey` no tiene formato "YYYY-Qn".
   */
  static quarterRange(quarterKey) {
    const match = /^(\d{4})-Q([1-4])$/.exec(quarterKey);
    if (!match) return null;
    const year = Number(match[1]);
    const quarter = Number(match[2]);
    const startMonth = (quarter - 1) * 3; // 0-indexado
    const endMonth = startMonth + 2;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, endMonth + 1, 0); // último día del último mes del trimestre
    return { start: this._isoDateString(start), end: this._isoDateString(end) };
  }

  /**
   * Valida coherencia: presupuestos no deben ser NaN o negativos.
   */
  static validateBatch(budgets = []) {
    const errors = [];
    budgets.forEach((b, i) => {
      if (!this.validate(b)) {
        errors.push(`Budget at index ${i} is invalid`);
      }
    });
    return errors.length === 0 ? null : errors;
  }

  /**
   * Genera ID único para presupuesto.
   */
  static _generateId() {
    return `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

  return { CanonicalBudgetSchema };
});
