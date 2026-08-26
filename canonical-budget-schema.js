/**
 * canonical-budget-schema.js
 *
 * Esquema y validación de presupuestos.
 * Define estructura, validación y persistencia de presupuestos por categoría/mes.
 *
 * Estructura en state: state.budgets = [ { id, categoryId, monthYear, amountCap, source, appliedAt } ]
 */

export class CanonicalBudgetSchema {
  /**
   * Valida y crea un presupuesto.
   *
   * @param {Object} budget - { categoryId, monthYear, amountCap, source, currency, appliedAt }
   * @returns {Object} Budget validado o null si inválido
   */
  static create(budget) {
    const validated = this.validate(budget);
    if (!validated) return null;

    return {
      id: this._generateId(),
      categoryId: validated.categoryId,
      monthYear: validated.monthYear, // "2026-08" format
      amountCap: validated.amountCap,
      source: validated.source, // "suggested" | "manual" | "carryover"
      currency: validated.currency || 'EUR',
      appliedAt: validated.appliedAt || new Date().toISOString(),
    };
  }

  /**
   * Valida un presupuesto contra el esquema.
   */
  static validate(budget) {
    if (!budget || typeof budget !== 'object') return null;

    const { categoryId, monthYear, amountCap, source, currency, appliedAt } = budget;

    // Validar categoryId
    if (!categoryId || typeof categoryId !== 'string') return null;

    // Validar monthYear (formato YYYY-MM)
    if (!monthYear || !/^\d{4}-\d{2}$/.test(monthYear)) return null;

    // Validar amountCap (número positivo)
    if (typeof amountCap !== 'number' || amountCap <= 0) return null;

    // Validar source
    const validSources = ['suggested', 'manual', 'carryover'];
    if (source && !validSources.includes(source)) return null;

    // Validar currency (ISO 4217)
    if (currency && (typeof currency !== 'string' || currency.length !== 3)) return null;

    // Validar appliedAt (ISO timestamp)
    if (appliedAt && isNaN(Date.parse(appliedAt))) return null;

    return {
      categoryId,
      monthYear,
      amountCap: Math.round(amountCap * 100) / 100,
      source: source || 'manual',
      currency: currency || 'EUR',
      appliedAt: appliedAt || new Date().toISOString(),
    };
  }

  /**
   * Busca presupuesto de una categoría en un mes específico.
   */
  static findForCategoryMonth(budgets = [], categoryId, monthYear) {
    return budgets.find(
      b => b.categoryId === categoryId && b.monthYear === monthYear
    );
  }

  /**
   * Busca todos los presupuestos de un mes.
   */
  static findForMonth(budgets = [], monthYear) {
    return budgets.filter(b => b.monthYear === monthYear);
  }

  /**
   * Reemplaza o actualiza presupuesto.
   * Si existe para categoría/mes, reemplaza; si no, añade.
   */
  static upsert(budgets = [], newBudget) {
    const validated = this.create(newBudget);
    if (!validated) return budgets;

    const index = budgets.findIndex(
      b => b.categoryId === validated.categoryId && b.monthYear === validated.monthYear
    );

    if (index >= 0) {
      return [...budgets.slice(0, index), validated, ...budgets.slice(index + 1)];
    }

    return [...budgets, validated];
  }

  /**
   * Elimina presupuesto.
   */
  static delete(budgets = [], categoryId, monthYear) {
    return budgets.filter(
      b => !(b.categoryId === categoryId && b.monthYear === monthYear)
    );
  }

  /**
   * Retorna presupuestos de un mes agrupados por categoría.
   */
  static byCategory(budgets = [], monthYear) {
    const result = {};
    this.findForMonth(budgets, monthYear).forEach(b => {
      result[b.categoryId] = b.amountCap;
    });
    return result;
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

export default CanonicalBudgetSchema;

// CommonJS support for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CanonicalBudgetSchema };
}
