(function attachCanonicalYearEndTax(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalYearEndTax = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalYearEndTax() {
  "use strict";

  // WP-23 (FIS-01 + DAC-02 + FIS-02; docs/WP23_DISENO.md): la campaña fiscal de fin de año. Junta en una lista las decisiones de
  // diciembre que ahorran impuestos, cada una con su euro estimado, su fecha límite y lo que falta para calcularla. Motor puro, sin
  // DOM ni estado: recibe los datos fiscales del hogar y devuelve la lista ordenada; la pantalla vive en fiscal-campana-ui.js.
  //
  // Reglas de este motor, heredadas del estimador de IRPF (A15-2) y de las tablas fiscales (A15-5):
  //   · «sin dato = no calculable»: una acción a la que le falta un dato sale como `sin_dato` y dice cuál; nunca una cifra inventada.
  //   · Toda cifra es una ESTIMACIÓN. Los parámetros legales de abajo (límite de pensiones, tope de vivienda, tramos de donativos)
  //     vienen del plan (docs/PLAN_DESARROLLO_DEFINITIVO.md §4.2) y están marcados `verified: false` hasta que se compruebe su fuente
  //     oficial; la pantalla lo dice. Se pueden sustituir pasando `parameters`.
  //   · Nunca ejecuta ni propone ejecutar nada solo (A11-4): recomienda, el hogar actúa.
  //   · Cada declarante tributa por separado (tributación individual): cada uno con su propio tope y sus propios datos.

  const SCHEMA_ID = "finance-wp23-year-end-tax/v1";
  const PROFESSIONAL_WARNING = "Estimación orientativa: confirma cada acción con un asesor fiscal o con el simulador oficial de la Agencia Tributaria antes de actuar.";
  const CAMPAIGN_OPENS = "11-01";
  const DEADLINE = "12-31";

  // Parámetros legales por año. `verified: false` = tomado del plan, aún no contrastado con la fuente oficial (ni con la comunidad
  // autónoma del hogar, que en vivienda y donativos puede cambiar el reparto). Los valores no se usan en silencio: viajan en el resultado.
  const PARAMETERS = Object.freeze({
    2026: Object.freeze({
      year: 2026,
      pension: { individualLimit: 1500, reference: "Límite general de aportación individual deducible a planes de pensiones; con plan de empresa el límite combinado es mayor y este motor no lo calcula.", verified: false },
      housing: { ratePct: 15, annualCap: 9040, reference: "Deducción por vivienda habitual del régimen transitorio (compra anterior a 2013 con deducción aplicada): 15 % sobre un máximo de 9.040 € de cantidades pagadas al año por declarante. El reparto estatal/autonómico depende de la comunidad.", verified: false },
      donations: { firstTierAmount: 250, firstTierRatePct: 80, restRatePct: 40, restRecurringRatePct: 45, reference: "Donativos a entidades acogidas a la Ley 49/2002: 80 % de los primeros 250 € por declarante y 40 % del resto (45 % si hay recurrencia).", verified: false },
      compensation: { repurchaseMonths: 2, carryForwardYears: 4, reference: "Compensación de plusvalías con minusvalías del mismo año; en valores cotizados, recomprar los mismos valores en los dos meses anteriores o posteriores difiere la minusvalía.", verified: false },
      withholding: { reference: "El trabajador puede pedir a la empresa un tipo de retención superior al que le corresponde con el modelo 145; nunca uno inferior.", verified: false },
    }),
  });

  function number(value, fallback = null) {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function validIsoDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  function daysBetween(fromIso, toIso) {
    const parse = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
  }

  function parametersFor(year, overrides) {
    const known = Object.keys(PARAMETERS).map(Number).filter((candidate) => candidate <= Number(year)).sort((a, b) => a - b);
    const base = known.length ? PARAMETERS[known[known.length - 1]] : null;
    if (!base) return null;
    const merged = { ...base, year: Number(year) };
    ["pension", "housing", "donations", "compensation", "withholding"].forEach((key) => {
      merged[key] = { ...base[key], ...((overrides && overrides[key]) || {}) };
    });
    // Un año sin tabla propia hereda la del último año conocido, pero lo dice: nunca se cuela como si fuera del año en curso.
    merged.inheritedFromYear = base.year === Number(year) ? null : base.year;
    return merged;
  }

  function pct(value) {
    return Math.min(100, Math.max(0, number(value, 0))) / 100;
  }

  // ---------- Acciones por declarante ----------
  // Cada función devuelve { status, savingEur, ... } para UN declarante:
  //   status: "calculable" | "sin_dato" | "no_aplica"; missing: qué dato falta (solo en sin_dato).

  function pensionFor(holder, params) {
    const contributed = number(holder.pension?.contributedYear);
    const rate = number(holder.marginalRatePct);
    const employerPlan = holder.pension?.hasEmployerPlan;
    const missing = [];
    if (contributed === null) missing.push("lo aportado este año al plan de pensiones");
    if (rate === null || rate <= 0) missing.push("el tipo marginal de IRPF");
    if (employerPlan === null || employerPlan === undefined) missing.push("si hay plan de pensiones de empresa");
    if (missing.length) return { status: "sin_dato", missing };
    if (employerPlan === true) {
      return { status: "no_aplica", reason: "Con plan de empresa el límite combinado es mayor y esta herramienta no lo calcula: consulta a tu asesor." };
    }
    const limit = params.pension.individualLimit;
    const room = round2(Math.max(0, limit - Math.max(0, contributed)));
    const available = number(holder.pension?.availableToContribute);
    const amount = round2(available === null ? room : Math.min(room, Math.max(0, available)));
    const savingEur = round2(amount * pct(rate));
    return {
      status: "calculable",
      limit,
      contributedYear: round2(Math.max(0, contributed)),
      room,
      amount,
      ratePct: round2(rate),
      savingEur,
      netCostEur: round2(amount - savingEur),
      full: room === 0,
    };
  }

  function housingFor(holder, params) {
    const applies = holder.housing?.applies;
    if (applies === false) return { status: "no_aplica", reason: "No aplica el régimen transitorio de vivienda para este declarante." };
    if (applies === null || applies === undefined) return { status: "sin_dato", missing: ["si aplica la deducción por vivienda (¿compra anterior a 2013 con deducción?)"] };
    const paid = number(holder.housing?.paidYear);
    if (paid === null) return { status: "sin_dato", missing: ["lo pagado este año por la vivienda (cuotas y amortizaciones) por declarante"] };
    const { ratePct, annualCap } = params.housing;
    const paidSafe = round2(Math.max(0, paid));
    const deductibleBase = round2(Math.min(paidSafe, annualCap));
    const room = round2(Math.max(0, annualCap - paidSafe));
    return {
      status: "calculable",
      ratePct,
      annualCap,
      paidYear: paidSafe,
      deductibleBase,
      securedEur: round2(deductibleBase * pct(ratePct)),
      room,
      // Lo que rinde amortizar de más hasta llenar el tope: el 15 % de lo aportado dentro del tope; por encima no deduce.
      savingEur: round2(room * pct(ratePct)),
      amount: room,
      full: room === 0,
      overCap: round2(Math.max(0, paidSafe - annualCap)),
    };
  }

  function compensationFor(holder, params) {
    const net = number(holder.capital?.realizedNet);
    const latent = number(holder.capital?.latentLosses);
    const rate = number(holder.capital?.savingsRatePct);
    const missing = [];
    if (net === null) missing.push("el resultado neto de las ventas de este año (plusvalías menos minusvalías)");
    if (latent === null) missing.push("las minusvalías latentes que se podrían realizar");
    if (rate === null || rate <= 0) missing.push("el tipo de la base del ahorro");
    if (missing.length) return { status: "sin_dato", missing };
    if (net <= 0) {
      return { status: "no_aplica", reason: `Este año no hay plusvalía neta que compensar: la minusvalía se arrastra ${params.compensation.carryForwardYears} años.` };
    }
    if (latent <= 0) {
      return { status: "no_aplica", reason: "No hay minusvalías latentes que realizar para compensar la plusvalía de este año." };
    }
    const compensable = round2(Math.min(net, latent));
    return {
      status: "calculable",
      realizedNet: round2(net),
      latentLosses: round2(latent),
      amount: compensable,
      ratePct: round2(rate),
      savingEur: round2(compensable * pct(rate)),
      repurchaseMonths: params.compensation.repurchaseMonths,
    };
  }

  function donationFor(holder, params) {
    const amount = number(holder.donations?.amountYear);
    if (amount === null) return { status: "sin_dato", missing: ["los donativos de este año (hechos o previstos)"] };
    if (amount <= 0) return { status: "no_aplica", reason: "Sin donativos previstos este año." };
    const { firstTierAmount, firstTierRatePct, restRatePct, restRecurringRatePct } = params.donations;
    const recurring = holder.donations?.recurring === true;
    const first = Math.min(amount, firstTierAmount);
    const rest = Math.max(0, amount - firstTierAmount);
    const savingEur = round2(first * pct(firstTierRatePct) + rest * pct(recurring ? restRecurringRatePct : restRatePct));
    return {
      status: "calculable",
      amount: round2(amount),
      firstTierAmount,
      firstTierRatePct,
      restRatePct: recurring ? restRecurringRatePct : restRatePct,
      recurring,
      savingEur,
      netCostEur: round2(amount - savingEur),
    };
  }

  // FIS-02. La Renta de junio de 2027 cierra el IRPF de 2026: pedir a estas alturas un tipo superior solo alcanza a las nóminas que
  // quedan de 2026 (una o dos), así que el ajuste rinde de verdad en 2027. El motor calcula el tipo ADICIONAL que haría falta si el
  // resultado se repite y lo dice así; no lo presenta como un ahorro (es caja, no impuesto).
  function withholdingFor(holder) {
    const result = number(holder.estimatedResult);
    const gross = number(holder.annualGross);
    const current = number(holder.currentWithholdingPct);
    const missing = [];
    if (result === null) missing.push("el resultado estimado de la Renta (a pagar o a devolver)");
    if (gross === null || gross <= 0) missing.push("el bruto anual");
    if (missing.length) return { status: "sin_dato", missing };
    if (result <= 0) {
      return { status: "no_aplica", reason: "Se espera devolución: no se puede pedir una retención inferior a la que corresponde, solo superior." };
    }
    const extraPct = Math.ceil((result / gross) * 10000) / 100;
    return {
      status: "calculable",
      resultEur: round2(result),
      annualGross: round2(gross),
      currentPct: current === null ? null : round2(current),
      extraPct,
      suggestedPct: current === null ? null : round2(current + extraPct),
      savingEur: 0,
      cashEur: round2(result),
    };
  }

  const ACTIONS = Object.freeze([
    { id: "vivienda", title: "Llenar el tope de la deducción por vivienda", short: "Amortizar hasta el tope", compute: housingFor, param: "housing", hasSaving: true },
    { id: "pensiones", title: "Aportar al plan de pensiones", short: "Aportación deducible", compute: pensionFor, param: "pension", hasSaving: true },
    { id: "compensacion", title: "Compensar plusvalías con minusvalías", short: "Realizar minusvalías latentes", compute: compensationFor, param: "compensation", hasSaving: true },
    { id: "donativos", title: "Donativos deducibles", short: "Donar antes del 31/12", compute: donationFor, param: "donations", hasSaving: true },
    { id: "retencion", title: "Ajustar la retención para no pagar en junio", short: "Retención voluntaria (modelo 145)", compute: withholdingFor, param: "withholding", hasSaving: false },
  ]);

  function sumSavings(rows) {
    return round2(rows.reduce((sum, row) => sum + (row.result.status === "calculable" ? row.result.savingEur : 0), 0));
  }

  function buildAction(definition, holders, params) {
    const rows = holders.map((holder) => ({
      holderId: text(holder.id),
      label: text(holder.label) || text(holder.id),
      result: definition.compute(holder, params),
    }));
    const calculable = rows.filter((row) => row.result.status === "calculable");
    const missing = [...new Set(rows.filter((row) => row.result.status === "sin_dato").flatMap((row) => row.result.missing))];
    const applicable = rows.filter((row) => row.result.status !== "no_aplica");
    let status = "calculable";
    if (!applicable.length) status = "no_aplica";
    else if (!calculable.length) status = "sin_dato";
    const savingEur = status === "calculable" ? sumSavings(rows) : null;
    return {
      id: definition.id,
      title: definition.title,
      short: definition.short,
      status,
      // «parcial»: calculada para unos declarantes y sin dato para otros; la cifra solo cuenta los calculados y lo dice.
      partial: status === "calculable" && applicable.some((row) => row.result.status === "sin_dato"),
      savingEur,
      cashEur: definition.id === "retencion" && status === "calculable" ? round2(calculable.reduce((sum, row) => sum + row.result.cashEur, 0)) : null,
      missing,
      rows,
      deadline: definition.id === "retencion" ? null : `${params.year}-${DEADLINE}`,
      hasSaving: definition.hasSaving,
      verified: Boolean(params[definition.param].verified),
      reference: params[definition.param].reference || "",
    };
  }

  function order(actions) {
    const rank = (action) => (action.status === "calculable" ? 0 : action.status === "sin_dato" ? 1 : 2);
    return actions.slice().sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      // Entre las calculables: por euros ahorrados (las de caja, sin ahorro, detrás) y, a igualdad, el orden fijo de la lista.
      const diff = (b.savingEur || 0) - (a.savingEur || 0);
      return diff || ACTIONS.findIndex((item) => item.id === a.id) - ACTIONS.findIndex((item) => item.id === b.id);
    });
  }

  /**
   * @param {{year?: number, holders?: Array<Record<string, any>>, parameters?: Record<string, any>, example?: boolean}} [household]
   * @param {{today?: string}} [options]
   */
  function buildCampaign(household = {}, options = {}) {
    const year = Math.trunc(number(household.year, NaN));
    const today = validIsoDate(options.today) ? options.today : null;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-year" };
    }
    const params = parametersFor(year, household.parameters);
    if (!params) return { schemaId: SCHEMA_ID, calculable: false, reason: "no-parameters", year };
    const holders = (Array.isArray(household.holders) ? household.holders : []).filter((holder) => holder && text(holder.id));
    if (!holders.length) return { schemaId: SCHEMA_ID, calculable: false, reason: "no-holders", year };

    const actions = order(ACTIONS.map((definition) => buildAction(definition, holders, params)));
    const calculable = actions.filter((action) => action.status === "calculable");
    const opens = `${year}-${CAMPAIGN_OPENS}`;
    const deadline = `${year}-${DEADLINE}`;
    let phase = "abierta";
    let daysToOpen = null;
    let daysLeft = null;
    if (today) {
      daysLeft = daysBetween(today, deadline);
      daysToOpen = Math.max(0, daysBetween(today, opens));
      phase = daysLeft < 0 ? "cerrada" : daysToOpen > 0 ? "preparacion" : "abierta";
    }
    return {
      schemaId: SCHEMA_ID,
      calculable: true,
      year,
      example: household.example === true,
      holders: holders.map((holder) => ({ id: text(holder.id), label: text(holder.label) || text(holder.id) })),
      parameters: params,
      actions,
      totalSavingEur: round2(calculable.reduce((sum, action) => sum + (action.savingEur || 0), 0)),
      calculableCount: calculable.filter((action) => action.hasSaving && action.savingEur > 0).length,
      missingCount: actions.filter((action) => action.status === "sin_dato").length,
      opens,
      deadline,
      phase,
      daysToOpen,
      daysLeft,
      // La Renta que recoge estas acciones es la del año siguiente (campaña de renta de junio).
      rentaYear: year + 1,
      warning: PROFESSIONAL_WARNING,
    };
  }

  // Hogar de EJEMPLO con cifras ficticias, redondas a propósito: sirve para ver cómo queda la lista antes de tener los datos reales
  // del hogar (H-03). Nunca contiene ni se parece a datos reales; la pantalla lo marca siempre como «ejemplo».
  const EXAMPLE_HOUSEHOLD = Object.freeze({
    year: 2026,
    example: true,
    holders: Object.freeze([
      Object.freeze({
        id: "persona-a",
        label: "Persona A",
        annualGross: 42000,
        marginalRatePct: 30,
        estimatedResult: 900,
        currentWithholdingPct: 17,
        pension: Object.freeze({ contributedYear: 0, hasEmployerPlan: false }),
        housing: Object.freeze({ applies: true, paidYear: 6000 }),
        capital: Object.freeze({ realizedNet: 3000, latentLosses: 2000, savingsRatePct: 19 }),
        donations: Object.freeze({ amountYear: 0 }),
      }),
      Object.freeze({
        id: "persona-b",
        label: "Persona B",
        annualGross: 30000,
        marginalRatePct: 24,
        estimatedResult: -300,
        currentWithholdingPct: 14,
        pension: Object.freeze({ contributedYear: 500, hasEmployerPlan: false }),
        housing: Object.freeze({ applies: true, paidYear: 9040 }),
        capital: Object.freeze({ realizedNet: 0, latentLosses: 1000, savingsRatePct: 19 }),
        donations: Object.freeze({ amountYear: 300 }),
      }),
    ]),
  });

  return {
    SCHEMA_ID,
    PROFESSIONAL_WARNING,
    PARAMETERS,
    EXAMPLE_HOUSEHOLD,
    parametersFor,
    buildCampaign,
  };
});
