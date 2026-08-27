/**
 * canonical-budget-schema.js
 *
 * Esquema y validación de presupuestos.
 * Define estructura, validación y persistencia de presupuestos por categoría/mes o categoría/semana.
 *
 * Estructura en state: state.budgets = [
 *   { id, categoryId, period, monthYear, weekKey, amountCap, source, appliedAt }
 * ]
 * `period` es "monthly" (por defecto, retrocompatible con presupuestos ya guardados sin el campo)
 * o "weekly". Un presupuesto mensual usa `monthYear` ("YYYY-MM") y `weekKey` es null; uno semanal
 * usa `weekKey` (semana ISO-8601, "YYYY-Www") y `monthYear` se deriva automáticamente (mes del
 * jueves de esa semana, criterio ISO) para poder agruparlo en vistas mensuales si hace falta.
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
      period: validated.period, // "monthly" | "weekly"
      monthYear: validated.monthYear, // "2026-08" format
      weekKey: validated.weekKey, // "2026-W35" format, null si es mensual
      amountCap: validated.amountCap,
      source: validated.source, // "suggested" | "manual" | "carryover" | "goal"
      currency: validated.currency || 'EUR',
      appliedAt: validated.appliedAt || new Date().toISOString(),
    };
  }

  /**
   * Valida un presupuesto contra el esquema.
   */
  static validate(budget) {
    if (!budget || typeof budget !== 'object') return null;

    const { categoryId, monthYear, weekKey, amountCap, source, currency, appliedAt } = budget;
    const period = budget.period === 'weekly' ? 'weekly' : 'monthly';

    // Validar categoryId
    if (!categoryId || typeof categoryId !== 'string') return null;

    let resolvedMonthYear;
    let resolvedWeekKey = null;

    if (period === 'weekly') {
      // Validar weekKey (semana ISO-8601, formato YYYY-Www)
      if (!weekKey || !/^\d{4}-W\d{2}$/.test(weekKey) || !this.weekRange(weekKey)) return null;
      resolvedWeekKey = weekKey;
      // monthYear es opcional en la entrada para un presupuesto semanal: se deriva de la semana si
      // no se da explícitamente (agrupación por mes, criterio del jueves ISO).
      resolvedMonthYear = monthYear && /^\d{4}-\d{2}$/.test(monthYear) ? monthYear : this.monthYearForWeek(weekKey);
    } else {
      // Validar monthYear (formato YYYY-MM)
      if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) return null;
      resolvedMonthYear = monthYear;
    }

    // Validar amountCap (número positivo)
    if (typeof amountCap !== 'number' || amountCap <= 0) return null;

    // Validar source
    const validSources = ['suggested', 'manual', 'carryover', 'goal'];
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
   * Si existe para categoría/periodo (mes o semana), reemplaza; si no, añade.
   */
  static upsert(budgets = [], newBudget) {
    const validated = this.create(newBudget);
    if (!validated) return budgets;

    const index = validated.period === 'weekly'
      ? budgets.findIndex(b => b.categoryId === validated.categoryId && b.weekKey === validated.weekKey && b.period === 'weekly')
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
