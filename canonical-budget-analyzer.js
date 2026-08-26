/**
 * canonical-budget-analyzer.js
 *
 * Motor de análisis histórico para presupuestos.
 * Analiza movimientos de los últimos 6-12 meses, detecta patrones,
 * calcula estadísticas (media, mediana, p75, desv. estándar) y genera
 * sugerencias de presupuesto con confianza.
 *
 * Entrada: movimientos históricos por categoría
 * Salida: { categoryId, average, median, p75, stdDev, seasonality, confidence }
 */

export class CanonicalBudgetAnalyzer {
  /**
   * Analiza una categoría de gasto y retorna estadísticas e índice de confianza.
   *
   * @param {Array} movements - Movimientos filtrados por categoría, últimos 6-12 meses
   * @param {number} months - Número de meses a analizar (default: 6)
   * @returns {Object|null} { categoryId, months, entries, average, median, p75, p25, stdDev, seasonality, confidence, flaggedOutliers }
   */
  static analyzeCategory(movements, { months = 6 } = {}) {
    if (!movements || movements.length < 3) {
      return null; // Datos insuficientes
    }

    // Agrupar por mes y sumar gastos
    const monthlySpends = this._aggregateByMonth(movements, months);
    if (monthlySpends.length < 3) {
      return null; // Menos de 3 meses de datos
    }

    const amounts = monthlySpends.map(m => m.total);
    amounts.sort((a, b) => a - b);

    // Estadísticas básicas
    const avg = amounts.reduce((s, x) => s + x, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((s, x) => s + Math.pow(x - avg, 2), 0) / amounts.length
    );

    const median = this._percentile(amounts, 0.5);
    const p75 = this._percentile(amounts, 0.75);
    const p25 = this._percentile(amounts, 0.25);

    // Detectar anomalías (outliers > 3σ)
    const flaggedOutliers = monthlySpends.filter(
      m => Math.abs(m.total - avg) > 3 * stdDev
    ).map(m => ({ month: m.month, amount: m.total, zScore: (m.total - avg) / stdDev }));

    // Detectar estacionalidad (variance entre meses)
    const seasonality = this._detectSeasonality(monthlySpends, months);

    // Confianza: baja si stdDev alto o hay outliers, alta si datos estables
    let confidence = 'high';
    if (stdDev > avg * 0.3 || flaggedOutliers.length > 0) {
      confidence = 'medium';
    }
    if (stdDev > avg * 0.5 || flaggedOutliers.length > 2) {
      confidence = 'low';
    }

    return {
      months: amounts.length,
      entries: movements.length,
      average: Math.round(avg * 100) / 100,
      median: Math.round(median * 100) / 100,
      p75: Math.round(p75 * 100) / 100,
      p25: Math.round(p25 * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      seasonality,
      confidence,
      flaggedOutliers,
      recommendation: Math.round(p75 * 100) / 100, // p75 como presupuesto sugerido
    };
  }

  /**
   * Analiza varias categorías en lote.
   * @param {Object} movementsByCategory - { categoryId: [...movements], ... }
   * @param {Object} options - { months, minEntries }
   * @returns {Object} { categoryId: analysis, ... }
   */
  static analyzeBatch(movementsByCategory, options = {}) {
    const { months = 6, minEntries = 3 } = options;
    const results = {};

    for (const [categoryId, movements] of Object.entries(movementsByCategory)) {
      if (movements.length >= minEntries) {
        results[categoryId] = this.analyzeCategory(movements, { months });
      }
    }

    return results;
  }

  /**
   * Agrupa movimientos por mes y suma totales.
   */
  static _aggregateByMonth(movements, months) {
    const now = new Date();
    const monthMap = new Map();

    movements.forEach(m => {
      const date = new Date(m.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const current = monthMap.get(key) || { month: key, total: 0, count: 0 };
      current.total += Math.abs(m.amount); // Tomar valor absoluto de gasto
      current.count += 1;
      monthMap.set(key, current);
    });

    return Array.from(monthMap.values()).slice(-months);
  }

  /**
   * Calcula percentil manualmente.
   */
  static _percentile(sorted, p) {
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  /**
   * Detecta patrones estacionales (meses con variación significativa).
   */
  static _detectSeasonality(monthlySpends, months) {
    const overall = monthlySpends.map(m => m.total);
    const avg = overall.reduce((s, x) => s + x, 0) / overall.length;
    const stdDev = Math.sqrt(
      overall.reduce((s, x) => s + Math.pow(x - avg, 2), 0) / overall.length
    );

    const seasonal = monthlySpends
      .filter(m => Math.abs(m.total - avg) > stdDev * 0.5)
      .map(m => ({
        month: m.month,
        total: m.total,
        variance: Math.round(((m.total - avg) / avg) * 100),
      }));

    return seasonal.length > 0 ? seasonal : null;
  }
}

export default CanonicalBudgetAnalyzer;

// CommonJS support for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CanonicalBudgetAnalyzer };
}
