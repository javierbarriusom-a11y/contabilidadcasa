(function attachCanonicalTaxReport(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalTaxReport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalTaxReport() {
  "use strict";

  // WP-21 · PR-1 (docs/WP21_DISENO.md §1, §2 y §4): el informe de la base del ahorro para la Renta, por ejercicio y
  // declarante. Motor puro, sin DOM ni estado global: recibe las posiciones ya normalizadas (FC1, canonical-portfolio.js),
  // los cobros de dividendos e intereses (PR-0b), las pérdidas arrastradas por bloque (FC3 + PR-0b), la parte de cada
  // venta que difiere la norma de recompra (XIN-02, canonical-portfolio-ledger.js) y, si el hogar la registró, su escala
  // del ahorro. No es el modelo 100 ni una recomendación: dice el concepto y la cifra, y lo que le falta para darla.
  //
  // Reglas (contrastadas el 5/11/2026, §2 y §9 del diseño):
  // - Integración y compensación, art. 49 LIRPF. Cada bloque se compensa dentro de sí sin límite. El saldo negativo de un
  //   bloque se compensa con el positivo del otro hasta el 25 % de este, y ese cupo del 25 % lo comparten las pérdidas
  //   del año y las arrastradas («no podrá superar conjuntamente el límite del 25 %», manual de la AEAT, 8.1.4). Primero
  //   las del año y luego las arrastradas, de la más antigua a la más nueva, que es como las aplica el manual. Lo que no
  //   cabe se arrastra 4 años.
  // - Escala del ahorro desde el 1/1/2025 (Ley 7/2024): 19/21/23/27/30 % con cortes en 6.000, 50.000, 200.000 y 300.000 €.
  // - Doble imposición internacional, art. 80 LIRPF: lo retenido fuera, como mucho lo que esa renta paga aquí (tipo medio
  //   del ahorro por la renta extranjera). No comprueba el tope de cada convenio.
  // - Modelo 720: aviso si los valores depositados fuera de España pasan de 50.000 € (bloque de valores, a 31/12).

  const SCHEMA_ID = "finance-canonical-tax-report/v1";
  const HOLDERS = ["javi", "tere"];
  const CARRYFORWARD_YEARS = 4;
  const CROSS_LIMIT = 0.25;
  const MODEL_720_THRESHOLD = 50000;

  // La escala de la ley, para cuando el hogar no ha registrado la suya. Se dice siempre de dónde sale.
  const REFERENCE_SAVINGS_SCALE = Object.freeze({
    id: "ahorro-ley-7-2024",
    fromYear: 2025,
    brackets: Object.freeze([
      Object.freeze({ limit: 6000, rate: 19 }),
      Object.freeze({ limit: 50000, rate: 21 }),
      Object.freeze({ limit: 200000, rate: 23 }),
      Object.freeze({ limit: 300000, rate: 27 }),
      Object.freeze({ limit: null, rate: 30 }),
    ]),
    source: "Ley 7/2024, disposición final séptima (arts. 66 y 76 LIRPF), con efectos desde el 1/1/2025",
  });

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  // Qué parte de una posición (o de un cobro) es de este declarante: la suya entera, la mitad si es conjunta, nada si es
  // del otro. Sin titular declarado, `null`: no se adivina.
  function holderShare(titular, holder) {
    if (titular === holder) return 1;
    if (titular === "household") return 0.5;
    if (HOLDERS.includes(titular)) return 0;
    return null;
  }

  function progressiveTax(base, brackets) {
    let tax = 0;
    let previous = 0;
    for (const bracket of brackets) {
      const upper = bracket.limit === null ? Infinity : number(bracket.limit);
      if (base <= previous) break;
      tax += (Math.min(base, upper) - previous) * (number(bracket.rate) / 100);
      previous = upper;
    }
    return round2(tax);
  }

  function validScale(scale) {
    const brackets = Array.isArray(scale?.brackets) ? scale.brackets : [];
    if (!brackets.length || brackets[brackets.length - 1].limit !== null) return false;
    return brackets.every((b, i) => Number.isFinite(Number(b.rate)) && (i === brackets.length - 1 || Number(b.limit) > (i ? Number(brackets[i - 1].limit) : 0)));
  }

  // La escala que se usa y de dónde sale: la del hogar si la registró (y es válida), la de la ley si el ejercicio está en
  // su vigencia, o ninguna (y entonces no hay cuota que dar).
  function pickScale(householdScale, year) {
    if (validScale(householdScale)) return { origin: "hogar", brackets: householdScale.brackets, source: householdScale.source || null };
    if (Number(year) >= REFERENCE_SAVINGS_SCALE.fromYear) return { origin: "referencia", brackets: REFERENCE_SAVINGS_SCALE.brackets, source: REFERENCE_SAVINGS_SCALE.source };
    return null;
  }

  // Compensa un saldo negativo contra uno positivo, hasta `cap` (Infinity si es del mismo bloque). Devuelve lo aplicado.
  function offset(negative, positive, cap) {
    if (!(negative < 0) || !(positive > 0) || !(cap > 0)) return 0;
    return round2(Math.min(-negative, positive, cap));
  }

  /**
   * Integración y compensación de la base del ahorro (art. 49 LIRPF), para un declarante y un ejercicio.
   * @param {{gp: number, rcm: number, priorLosses?: Array<{year: string, amount: number, bloque?: string}>, year: string}} input
   */
  function compensate({ gp, rcm, priorLosses = [], year }) {
    let g = round2(gp);
    let r = round2(rcm);
    // El cupo del 25 % se mide sobre el saldo positivo de cada bloque ANTES de compensar, y lo comparten el año y lo arrastrado.
    let cupoSobreRcm = r > 0 ? round2(r * CROSS_LIMIT) : 0;
    let cupoSobreGp = g > 0 ? round2(g * CROSS_LIMIT) : 0;
    const steps = [];

    // 1. Las del año: un bloque negativo contra el otro positivo, hasta el 25 %.
    const crossGp = offset(g, r, cupoSobreRcm);
    if (crossGp) {
      g = round2(g + crossGp); r = round2(r - crossGp); cupoSobreRcm = round2(cupoSobreRcm - crossGp);
      steps.push({ kind: "year-cross", from: "ganancias", against: "rendimientos", amount: crossGp });
    }
    const crossRcm = offset(r, g, cupoSobreGp);
    if (crossRcm) {
      r = round2(r + crossRcm); g = round2(g - crossRcm); cupoSobreGp = round2(cupoSobreGp - crossRcm);
      steps.push({ kind: "year-cross", from: "rendimientos", against: "ganancias", amount: crossRcm });
    }

    // 2. Las arrastradas, de la más antigua a la más nueva: primero contra su bloque, sin límite; lo que quede, contra el
    //    otro bloque dentro de lo que reste del cupo del 25 %.
    const targetYear = Number(year);
    const eligible = (Array.isArray(priorLosses) ? priorLosses : [])
      .map((entry, index) => ({ index, year: String(entry?.year || ""), amount: round2(Math.max(0, number(entry?.amount))), bloque: entry?.bloque === "rendimientos" ? "rendimientos" : "ganancias" }))
      .filter((entry) => /^\d{4}$/.test(entry.year) && Number(entry.year) < targetYear && Number(entry.year) >= targetYear - CARRYFORWARD_YEARS && entry.amount > 0)
      .sort((a, b) => Number(a.year) - Number(b.year) || a.index - b.index);
    const remaining = [];
    eligible.forEach((entry) => {
      let left = entry.amount;
      const own = entry.bloque === "ganancias" ? offset(-left, g, Infinity) : offset(-left, r, Infinity);
      if (own) {
        left = round2(left - own);
        if (entry.bloque === "ganancias") g = round2(g - own); else r = round2(r - own);
        steps.push({ kind: "prior-own", year: entry.year, bloque: entry.bloque, amount: own });
      }
      const cross = entry.bloque === "ganancias" ? offset(-left, r, cupoSobreRcm) : offset(-left, g, cupoSobreGp);
      if (cross) {
        left = round2(left - cross);
        if (entry.bloque === "ganancias") { r = round2(r - cross); cupoSobreRcm = round2(cupoSobreRcm - cross); } else { g = round2(g - cross); cupoSobreGp = round2(cupoSobreGp - cross); }
        steps.push({ kind: "prior-cross", year: entry.year, bloque: entry.bloque, amount: cross });
      }
      if (left > 0) remaining.push({ year: entry.year, bloque: entry.bloque, amount: left, expires: Number(entry.year) + CARRYFORWARD_YEARS === targetYear });
    });

    const carryForward = [];
    if (g < 0) carryForward.push({ year: String(year), bloque: "ganancias", amount: round2(-g) });
    if (r < 0) carryForward.push({ year: String(year), bloque: "rendimientos", amount: round2(-r) });
    return {
      gpAfter: g,
      rcmAfter: r,
      base: round2(Math.max(0, g) + Math.max(0, r)),
      steps,
      // Lo arrastrado que sigue vivo después de este ejercicio, y lo que caduca en él (el de hace 4 años que no cupo).
      remainingPriorLosses: remaining.filter((entry) => !entry.expires).map(({ year: y, bloque, amount }) => ({ year: y, bloque, amount })),
      expiredPriorLosses: remaining.filter((entry) => entry.expires).map(({ year: y, bloque, amount }) => ({ year: y, bloque, amount })),
      carryForward,
    };
  }

  /**
   * El informe de un declarante y un ejercicio.
   * @param {{year?: string|number, holder?: string, positions?: any[], deferredBySale?: Record<string, number>, rendimientos?: any[], priorLosses?: any[], savingsScale?: any}} [params]
   *   `positions`: normalizadas (con `titular`, `depositario`, `currentValue` y `disposals` con su plusvalía FIFO).
   *   `deferredBySale`: id de venta → pérdida diferida por recompra (negativa), de XIN-02.
   */
  function taxReport({ year, holder, positions = [], deferredBySale = {}, rendimientos = [], priorLosses = [], savingsScale = null } = {}) {
    const targetYear = String(year || "");
    if (!/^\d{4}$/.test(targetYear)) return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-year" };
    if (!HOLDERS.includes(holder)) return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-holder" };
    const missing = [];
    const list = Array.isArray(positions) ? positions : [];

    // Transmisiones del año. Una venta de una posición sin titular, o sin plusvalía calculable, deja el ejercicio sin
    // cuota: un resultado a medias con aspecto de completo es peor que ninguno (mismo criterio que FC3).
    const transmissions = [];
    list.forEach((position) => {
      const sales = (Array.isArray(position?.disposals) ? position.disposals : []).filter((sale) => String(sale?.date || "").startsWith(`${targetYear}-`));
      if (!sales.length) return;
      const share = holderShare(position.titular, holder);
      if (share === null) {
        missing.push({ code: "position-without-holder", blocking: true, positionId: position.id, label: position.label, sales: sales.length });
        return;
      }
      if (!share) return;
      sales.forEach((sale) => {
        if (sale.realizedGain === null || sale.realizedGain === undefined) {
          missing.push({ code: sale.shortfall > 0 ? "sale-without-lots" : "sale-without-proceeds", blocking: true, positionId: position.id, label: position.label, date: sale.date });
          return;
        }
        const deferred = Math.min(0, number(deferredBySale[sale.id]));
        transmissions.push({
          positionId: position.id,
          label: position.label,
          date: sale.date,
          share,
          transmissionValue: round2(number(sale.saleProceeds) * share),
          acquisitionValue: round2(number(sale.consumedCost) * share),
          gain: round2(number(sale.realizedGain) * share),
          deferredLoss: round2(deferred * share),
          integrable: round2((number(sale.realizedGain) - deferred) * share),
        });
      });
    });
    transmissions.sort((a, b) => a.date.localeCompare(b.date));

    // Rendimientos del capital mobiliario del año (dividendos e intereses). Sin titular: bloquea, igual que una venta.
    const income = [];
    (Array.isArray(rendimientos) ? rendimientos : []).forEach((record) => {
      if (!String(record?.fecha || "").startsWith(`${targetYear}-`)) return;
      const position = record.posicionId ? list.find((p) => String(p?.id) === String(record.posicionId)) : null;
      const titular = record.posicionId ? position?.titular || "" : record.titular || "";
      const share = holderShare(titular, holder);
      if (share === null) {
        missing.push({ code: "income-without-holder", blocking: true, id: record.id, date: record.fecha });
        return;
      }
      if (!share) return;
      const spanish = record.retencionEspana === null || record.retencionEspana === undefined ? null : round2(number(record.retencionEspana) * share);
      const foreign = record.retencionOrigen === null || record.retencionOrigen === undefined ? null : round2(number(record.retencionOrigen) * share);
      if (spanish === null) missing.push({ code: "income-without-spanish-withholding", blocking: false, id: record.id, date: record.fecha });
      if (foreign > 0 && !record.paisOrigen) missing.push({ code: "foreign-withholding-without-country", blocking: false, id: record.id, date: record.fecha });
      income.push({
        id: record.id,
        date: record.fecha,
        kind: record.tipo === "interes" ? "interes" : "dividendo",
        label: position ? position.label : record.concepto || "",
        share,
        gross: round2(number(record.integro) * share),
        spanishWithholding: spanish,
        foreignWithholding: foreign,
        country: record.paisOrigen || "",
      });
    });
    income.sort((a, b) => a.date.localeCompare(b.date));

    const holderLosses = (Array.isArray(priorLosses) ? priorLosses : []).filter((entry) => entry?.titular === holder);
    // Una pérdida arrastrada sin titular solo bloquea si aún puede aplicarse este ejercicio (dentro de los 4 años).
    const unassignedLosses = (Array.isArray(priorLosses) ? priorLosses : []).filter((entry) => !HOLDERS.includes(entry?.titular)
      && Number(entry?.year) < Number(targetYear) && Number(entry?.year) >= Number(targetYear) - CARRYFORWARD_YEARS && number(entry?.amount) > 0);
    if (unassignedLosses.length) missing.push({ code: "prior-loss-without-holder", blocking: true, count: unassignedLosses.length });

    const gpBalance = round2(transmissions.reduce((sum, t) => sum + t.integrable, 0));
    const rcmBalance = round2(income.reduce((sum, i) => sum + i.gross, 0));
    const compensation = compensate({ gp: gpBalance, rcm: rcmBalance, priorLosses: holderLosses, year: targetYear });
    const blocking = missing.some((m) => m.blocking);

    // Cuota estimada y deducción por doble imposición: solo con el ejercicio completo y una escala que aplicar.
    const scale = pickScale(savingsScale, targetYear);
    if (!scale) missing.push({ code: "missing-scale", blocking: true });
    let quota = null;
    let doubleTaxDeduction = null;
    if (!blocking && scale) {
      const gross = progressiveTax(compensation.base, scale.brackets);
      const averageRate = compensation.base > 0 ? gross / compensation.base : 0;
      const foreignIncome = income.filter((i) => i.foreignWithholding > 0);
      const foreignPaid = round2(foreignIncome.reduce((sum, i) => sum + i.foreignWithholding, 0));
      const limit = round2(foreignIncome.reduce((sum, i) => sum + i.gross, 0) * averageRate);
      doubleTaxDeduction = { foreignPaid, limit, deductible: round2(Math.min(foreignPaid, limit)), notRecoverable: round2(Math.max(0, foreignPaid - limit)) };
      quota = { gross, averageRatePct: round2(averageRate * 100), net: round2(gross - doubleTaxDeduction.deductible), scaleOrigin: scale.origin, scaleSource: scale.source };
    }

    const spanishWithholding = round2(income.reduce((sum, i) => sum + (i.spanishWithholding || 0), 0));
    const withholdingComplete = income.every((i) => i.spanishWithholding !== null);

    return {
      schemaId: SCHEMA_ID,
      calculable: !blocking && Boolean(scale),
      year: targetYear,
      holder,
      transmissions,
      income,
      totals: {
        gains: round2(transmissions.reduce((sum, t) => sum + Math.max(0, t.integrable), 0)),
        losses: round2(transmissions.reduce((sum, t) => sum + Math.min(0, t.integrable), 0)),
        deferredLosses: round2(transmissions.reduce((sum, t) => sum + t.deferredLoss, 0)),
        gpBalance,
        rcmBalance,
        spanishWithholding,
        withholdingComplete,
      },
      compensation,
      quota,
      doubleTaxDeduction,
      model720: model720Notice(list, holder),
      missing,
    };
  }

  // Aviso del modelo 720 (bloque de valores). Con criterio prudente, la posición conjunta cuenta entera para el umbral: un
  // cotitular declara el valor total del bien. Una posición sin depositario declarado hace que el aviso diga «sin saber».
  function model720Notice(positions, holder) {
    const mine = (Array.isArray(positions) ? positions : []).filter((p) => {
      const share = holderShare(p?.titular, holder);
      return share !== null && share > 0 && number(p?.currentValue) > 0;
    });
    const abroad = mine.filter((p) => p.depositario === "extranjero");
    const unknown = mine.filter((p) => p.depositario !== "extranjero" && p.depositario !== "espana");
    const value = round2(abroad.reduce((sum, p) => sum + number(p.currentValue), 0));
    const state = value > MODEL_720_THRESHOLD ? "above" : unknown.length ? "unknown" : "below";
    return { state, valueAbroad: value, threshold: MODEL_720_THRESHOLD, positionsAbroad: abroad.length, positionsUnknown: unknown.length };
  }

  return { SCHEMA_ID, REFERENCE_SAVINGS_SCALE, HOLDERS, holderShare, pickScale, compensate, taxReport, model720Notice };
});
