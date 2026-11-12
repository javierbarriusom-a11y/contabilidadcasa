/**
 * canonical-rental-tax.js
 *
 * WP-21 · PR-3 (FIS-03; docs/WP21_DISENO.md §11): el local alquilado en la Renta. Los rendimientos del capital inmobiliario de un
 * inmueble que no es vivienda, por ejercicio y declarante, a la base GENERAL (no a la del ahorro), con lo ya retenido por el inquilino.
 * Y la próxima actualización de la renta según la cláusula del contrato.
 *
 *   · Ingresos íntegros: la renta sin IVA de cada mes alquilado y lo que el inquilino pague por cuenta del propietario.
 *   · Intereses y reparación y conservación: juntos, como mucho los ingresos íntegros; el exceso se deduce en los 4 años siguientes
 *     con el mismo límite. Se aplica primero lo pendiente más antiguo (que no caduque) y después lo del año.
 *   · Los demás gastos, sin límite: el rendimiento puede ser negativo.
 *   · Amortización: 3 % del mayor entre el coste de la construcción (sin suelo) y su valor catastral, por los meses alquilados, sin
 *     pasar del tope (la amortización acumulada no supera el valor de adquisición; TEAC 653/2025).
 *   · Sin la reducción del 60 %: es solo para vivienda (art. 23.2 LIRPF).
 *   · Retención: la del certificado si se teclea; si no, el 19 % de la renta si el inquilino es empresa o profesional.
 *   · Los meses sin alquilar imputan renta (el 2 % del valor catastral, o el 1,1 % si se revisó), si hay datos para calcularla.
 *
 * Vacío es «sin declarar», nunca 0: lo que falta se dice en `falta`, con su código. Motor puro: sin DOM, red ni almacenamiento.
 */

(function attachCanonicalRentalTax(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalRentalTax = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalRentalTaxFactory() {
  "use strict";

  const SCHEMA_ID = "finance-rental-tax/v1";
  const AMORTIZATION_RATE = 0.03;
  const WITHHOLDING_RATE = 0.19;
  const CARRY_YEARS = 4;
  const IMPUTATION_RATES = Object.freeze([2, 1.1]);
  const OTHER_EXPENSES = Object.freeze(["ibi", "comunidad", "seguro", "tasas", "suministros", "gestion", "otros"]);

  const known = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const amount = (value) => (known(value) ? Math.max(0, Number(value)) : null);
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  /** La parte de un declarante: 1 si es suyo, 0,5 si es de los dos, 0 si no. */
  function holderShare(titular, holder) {
    if (titular === "household") return 0.5;
    return titular && titular === holder ? 1 : 0;
  }

  /**
   * Lo del inmueble entero en un ejercicio (antes de repartirlo entre los declarantes).
   * @param {{ year: number|string, property?: any, yearData?: any }} input
   */
  function propertyYear(input) {
    const year = Number(input?.year);
    const property = input?.property || {};
    const data = input?.yearData || {};
    const falta = [];
    const rent = amount(property.rentaMensual);
    const months = known(data.mesesAlquilado) ? Math.min(12, Math.max(0, Math.round(Number(data.mesesAlquilado)))) : null;
    if (rent === null) falta.push({ code: "rent-missing", blocking: true });
    if (months === null) falta.push({ code: "months-missing", blocking: true });
    if (!property.titular) falta.push({ code: "holder-missing", blocking: true });
    const share = (months ?? 0) / 12;
    const ingresos = round2((rent ?? 0) * (months ?? 0) + (amount(data.otrosIngresos) ?? 0));

    // Intereses y reparación: lo pendiente de los 4 años anteriores primero (el más antiguo), después lo del año; tope = ingresos.
    const pendientes = (Array.isArray(data.pendientes) ? data.pendientes : [])
      .filter((item) => known(item?.year) && Number(item.year) < year && Number(item.year) >= year - CARRY_YEARS && amount(item.amount) > 0)
      .map((item) => ({ year: Number(item.year), amount: round2(Number(item.amount)) }))
      .sort((a, b) => a.year - b.year);
    const caducados = (Array.isArray(data.pendientes) ? data.pendientes : []).filter((item) => known(item?.year) && Number(item.year) < year - CARRY_YEARS && amount(item.amount) > 0);
    if (caducados.length) falta.push({ code: "carry-expired", blocking: false, count: caducados.length });
    const delAno = round2((amount(data.intereses) ?? 0) + (amount(data.reparacion) ?? 0));
    let hueco = ingresos;
    const aplicados = [];
    const arrastre = [];
    pendientes.forEach((item) => {
      const usa = round2(Math.min(hueco, item.amount));
      hueco = round2(hueco - usa);
      if (usa > 0) aplicados.push({ year: item.year, amount: usa });
      if (item.amount - usa > 0.004) arrastre.push({ year: item.year, amount: round2(item.amount - usa) });
    });
    const usaAno = round2(Math.min(hueco, delAno));
    if (delAno - usaAno > 0.004) arrastre.push({ year, amount: round2(delAno - usaAno) });
    const limitados = round2(aplicados.reduce((sum, item) => sum + item.amount, 0) + usaAno);
    // Lo pendiente que ya no se podrá usar el año que viene (el de hace 4 años que no cupo).
    const pierde = arrastre.filter((item) => item.year <= year - CARRY_YEARS);
    const siguen = arrastre.filter((item) => item.year > year - CARRY_YEARS);

    const otros = round2(OTHER_EXPENSES.reduce((sum, key) => sum + (amount(data[key]) ?? 0), 0));

    // Amortización: 3 % del mayor entre el coste de la construcción y su valor catastral, por los meses alquilados, hasta el tope.
    const coste = amount(property.costeAdquisicion);
    const pct = known(property.pctConstruccion) ? Math.min(100, Math.max(0, Number(property.pctConstruccion))) : null;
    const costeConstruccion = coste !== null && pct !== null ? round2(coste * pct / 100) : null;
    const catastralConstruccion = amount(property.valorCatastralConstruccion);
    const bases = [costeConstruccion, catastralConstruccion].filter((value) => value !== null && value > 0);
    let amortizacion = 0;
    let baseAmortizacion = null;
    let topeAlcanzado = false;
    if (!bases.length) {
      falta.push({ code: "amortization-base-missing", blocking: false });
    } else {
      baseAmortizacion = Math.max(...bases);
      const anual = round2(baseAmortizacion * AMORTIZATION_RATE * share);
      const tope = costeConstruccion ?? baseAmortizacion;
      const previa = amount(property.amortizacionAcumulada) ?? 0;
      if (!known(property.amortizacionAcumulada)) falta.push({ code: "accumulated-amortization-missing", blocking: false });
      amortizacion = round2(Math.max(0, Math.min(anual, tope - previa)));
      topeAlcanzado = amortizacion < anual;
    }

    // Meses sin alquilar: imputación de renta, si hay valor catastral y porcentaje (no hay rendimiento del capital esos meses).
    const vacios = months === null ? 0 : 12 - months;
    let imputacion = 0;
    if (vacios > 0) {
      const catastral = amount(property.valorCatastralTotal);
      const tipo = IMPUTATION_RATES.includes(Number(property.pctImputacion)) ? Number(property.pctImputacion) : null;
      if (catastral && tipo) imputacion = round2(catastral * tipo / 100 * vacios / 12);
      else falta.push({ code: "imputation-data-missing", blocking: false, months: vacios });
    }

    const retencionDeclarada = amount(data.retencion);
    const retencion = retencionDeclarada !== null
      ? round2(retencionDeclarada)
      : property.inquilinoRetiene === true ? round2((rent ?? 0) * (months ?? 0) * WITHHOLDING_RATE) : 0;
    if (property.inquilinoRetiene === undefined || property.inquilinoRetiene === null || property.inquilinoRetiene === "") falta.push({ code: "withholding-unknown", blocking: false });

    const neto = round2(ingresos - limitados - otros - amortizacion);
    return {
      year, ingresos, months, gastos: { limitados, aplicadosPendientes: aplicados, delAnoAplicado: usaAno, delAno, otros, amortizacion, baseAmortizacion, topeAlcanzado },
      neto, imputacion, retencion, retencionCalculada: retencionDeclarada === null && property.inquilinoRetiene === true,
      arrastre: siguen, pierde, falta, reduccion: 0,
    };
  }

  /**
   * Lo de un declarante: su parte de cada cifra (la mitad si el local es de los dos). `blocking`: si falta algo para dar la cifra.
   * @param {{ year: number|string, holder: string, property?: any, yearData?: any }} input
   */
  function rentalReport(input) {
    const all = propertyYear(input);
    const share = holderShare(input?.property?.titular, input?.holder);
    const part = (value) => round2(value * share);
    return {
      schemaId: SCHEMA_ID,
      year: all.year,
      holder: input?.holder || "",
      share,
      ingresos: part(all.ingresos),
      gastos: { limitados: part(all.gastos.limitados), otros: part(all.gastos.otros), amortizacion: part(all.gastos.amortizacion), topeAlcanzado: all.gastos.topeAlcanzado },
      neto: part(all.neto),
      imputacion: part(all.imputacion),
      baseGeneral: part(all.neto + all.imputacion),
      retencion: part(all.retencion),
      retencionCalculada: all.retencionCalculada,
      months: all.months,
      arrastre: all.arrastre,
      pierde: all.pierde,
      falta: all.falta,
      blocking: all.falta.some((item) => item.blocking),
      inmueble: all,
    };
  }

  /**
   * La próxima actualización de la renta según la cláusula: `{ tipo: "ipc"|"fijo"|"ninguna", mes (1-12), porcentaje }`. Devuelve
   * la fecha (el día 1 del mes de la cláusula, este año o el siguiente), los días que faltan y, con un porcentaje fijo, la renta nueva.
   * Con el IPC no se calcula: el dato del mes anterior se publica a mitad de mes y se teclea en Deuda › Contratos (WP-13).
   * @param {{ rentaMensual?: number|null, actualizacion?: any }} property
   * @param {string} today AAAA-MM-DD
   */
  function nextRentUpdate(property, today) {
    const clause = property?.actualizacion || {};
    const tipo = ["ipc", "fijo", "ninguna"].includes(clause.tipo) ? clause.tipo : "";
    if (!tipo) return { status: "sin-clausula" };
    if (tipo === "ninguna") return { status: "ninguna" };
    const mes = Math.round(Number(clause.mes));
    if (!(mes >= 1 && mes <= 12) || !/^\d{4}-\d{2}-\d{2}$/.test(String(today))) return { status: "sin-mes", tipo };
    const year = Number(String(today).slice(0, 4));
    const thisYear = `${year}-${String(mes).padStart(2, "0")}-01`;
    const date = thisYear >= String(today) ? thisYear : `${year + 1}-${String(mes).padStart(2, "0")}-01`;
    const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    const rent = amount(property?.rentaMensual);
    const pct = known(clause.porcentaje) ? Number(clause.porcentaje) : null;
    const nueva = tipo === "fijo" && rent !== null && pct !== null ? round2(rent * (1 + pct / 100)) : null;
    return { status: "ok", tipo, date, days, soon: days <= 60, porcentaje: pct, nueva };
  }

  return Object.freeze({ SCHEMA_ID, AMORTIZATION_RATE, WITHHOLDING_RATE, CARRY_YEARS, IMPUTATION_RATES, OTHER_EXPENSES, holderShare, propertyYear, rentalReport, nextRentUpdate });
});
