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
  //     salieron del plan (docs/PLAN_DESARROLLO_DEFINITIVO.md §4.2); cada uno dice si ya está contrastado (`verified`), con qué fuente
  //     (`source`) y qué le falta (`pending`), y la pantalla lo enseña. Se pueden sustituir pasando `parameters`.
  //   · Nunca ejecuta ni propone ejecutar nada solo (A11-4): recomienda, el hogar actúa.
  //   · Cada declarante tributa por separado (tributación individual): cada uno con su propio tope y sus propios datos.

  const SCHEMA_ID = "finance-wp23-year-end-tax/v1";
  const PROFESSIONAL_WARNING = "Estimación orientativa: confirma cada acción con un asesor fiscal o con el simulador oficial de la Agencia Tributaria antes de actuar.";
  const CAMPAIGN_OPENS = "11-01";
  const DEADLINE = "12-31";
  // PR-2 (16/10/2026): los datos fiscales los teclea el hogar en la app y viven en un almacén propio (en la copia y la nube). Nunca en el repositorio.
  const STORE_NAME = "fiscal-data";
  const STORE_SCHEMA_ID = "finance-wp23-fiscal-data/v1";
  const MAX_HOLDERS = 2;
  const MAX_LABEL = 40;
  // PR-3 (16/10/2026): «Hecho» por acción y declarante, con la fecha en que el hogar lo marcó. Almacén aparte del de los datos: quitar los datos no borra qué se hizo.
  const DONE_STORE_NAME = "fiscal-done";
  const DONE_SCHEMA_ID = "finance-wp23-fiscal-done/v1";
  const MAX_DONE_MARKS = 40;

  // Parámetros legales por año. `verified: true` = contrastado con la fuente que dice `source` en la fecha `checked`; `verified: false` =
  // tomado del plan y todavía sin contrastar (`pending` dice qué falta). Los valores no se usan en silencio: viajan en el resultado.
  // Contraste del 23/10/2026: la tabla del ejercicio 2026 se comparó con el Manual práctico de Renta 2025 de la Agencia Tributaria (el del
  // ejercicio 2025, el último publicado) y no se encontró ningún cambio aprobado para 2026. Las fuentes van como texto, sin enlace: el
  // código publicado no nombra servidores que no estén revisados (NTC-06).
  const PARAMETERS = Object.freeze({
    2026: Object.freeze({
      year: 2026,
      pension: {
        individualLimit: 1500,
        reference: "Reducción de la base imponible por aportaciones a planes de pensiones: hasta 1.500 € al año por declarante, y nunca más del 30 % de sus rendimientos netos del trabajo y de actividades (con nóminas normales manda el límite de 1.500 €). Con plan de empresa el límite sube hasta 8.500 € más y este motor no lo calcula. Lo que no se pueda reducir este año se puede aplicar en los cinco siguientes.",
        source: "Agencia Tributaria, Manual práctico de Renta 2025, capítulo 13: «Límites y exceso de aportaciones» (artículos 51 y 52 de la Ley del IRPF).",
        checked: "2026-10-23",
        verified: true,
      },
      housing: {
        ratePct: 15,
        annualCap: 9040,
        reference: "Deducción por vivienda habitual del régimen transitorio (compra anterior a 2013 con deducción aplicada): 15 % sobre un máximo de 9.040 € de cantidades pagadas al año por declarante, repartido entre el tramo estatal y el autonómico.",
        source: "Disposición transitoria decimoctava de la Ley del IRPF; Agencia Tributaria, Manual práctico de Renta 2025, capítulo 16, y Manual de ayuda de Renta 2025, anexo de la deducción por inversión en vivienda habitual: 7,5 % en el tramo estatal y, en el autonómico, el porcentaje que haya aprobado la comunidad (artículo 46 de la Ley 22/2009) o, si no aprobó ninguno, el 7,5 % (artículo 78 de la Ley del IRPF en su redacción a 31 de diciembre de 2012). Vuestra comunidad no tiene porcentaje propio entre sus deducciones autonómicas del Manual práctico de Renta 2025, parte 2: le corresponde el 7,5 %, y el total es el 15 %.",
        checked: "2026-10-27",
        verified: true,
      },
      donations: {
        firstTierAmount: 250,
        firstTierRatePct: 80,
        restRatePct: 40,
        restRecurringRatePct: 45,
        reference: "Donativos a entidades acogidas a la Ley 49/2002: 80 % de los primeros 250 € por declarante y 40 % del resto; 45 % si se donó a la misma entidad, al menos lo mismo, los dos años anteriores. La base de la deducción no puede pasar del 10 % de la base liquidable. Algunas comunidades suman una deducción propia (por ejemplo, la Comunidad de Madrid, un 15 % de lo donado a fundaciones inscritas en su registro) que este motor no calcula.",
        source: "Real Decreto-ley 6/2023, que reformó los artículos 19 y 20 de la Ley 49/2002 desde el 1/1/2024 (Agencia Tributaria, boletín de novedades); Agencia Tributaria, Manual práctico de Renta 2025, deducciones autonómicas.",
        checked: "2026-10-23",
        verified: true,
      },
      compensation: {
        repurchaseMonths: 2,
        carryForwardYears: 4,
        reference: "Las plusvalías y minusvalías del año se compensan entre sí; si queda saldo negativo, compensa hasta el 25 % de los rendimientos del capital mobiliario y el resto se arrastra 4 años. En valores cotizados, comprar valores homogéneos en los dos meses anteriores o posteriores a la venta impide computar la minusvalía hasta venderlos.",
        source: "Agencia Tributaria, Manual práctico de Renta 2025, capítulos 11 y 12 (artículos 33.5.f y 49 de la Ley del IRPF).",
        checked: "2026-10-23",
        verified: true,
      },
      withholding: {
        reference: "El trabajador puede pedir por escrito a su pagador un tipo de retención superior al que le corresponde, nunca uno inferior, con al menos cinco días de antelación a la nómina. El nuevo tipo se aplica como mínimo hasta fin de año y sigue en los años siguientes mientras no se renuncie por escrito o se pida otro.",
        source: "Artículo 88.5 del Reglamento del IRPF, según lo reproducen los modelos de solicitud de la Administración General del Estado.",
        checked: "2026-10-23",
        verified: true,
      },
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

  function buildAction(definition, holders, params, doneMarks = {}) {
    const rows = holders.map((holder) => {
      const result = definition.compute(holder, params);
      const holderId = text(holder.id);
      // «Accionable»: hay algo que hacer. Calculable y, si la acción ahorra, con ahorro > 0 (un tope ya lleno o un límite ya cubierto no es una tarea pendiente).
      const actionable = result.status === "calculable" && (!definition.hasSaving || result.savingEur > 0);
      const mark = actionable ? doneMarks[doneKey(definition.id, holderId)] : null;
      return { holderId, label: text(holder.label) || text(holder.id), result, actionable, done: mark ? { at: mark.at } : null };
    });
    const actionableRows = rows.filter((row) => row.actionable);
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
      doneCount: actionableRows.filter((row) => row.done).length,
      pendingCount: actionableRows.filter((row) => !row.done).length,
      deadline: definition.id === "retencion" ? null : `${params.year}-${DEADLINE}`,
      hasSaving: definition.hasSaving,
      verified: Boolean(params[definition.param].verified),
      reference: params[definition.param].reference || "",
      source: params[definition.param].source || "",
      checked: params[definition.param].checked || "",
      pending: params[definition.param].verified ? "" : params[definition.param].pending || "",
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

  // ---------- Datos fiscales del hogar (PR-2) ----------
  // Cada campo es un número, o `null` = «no lo sé». Vacío NO es cero: un campo vacío deja la acción en «sin calcular» y dice cuál falta; un 0 escrito es un cero de verdad.
  // Los límites son de sentido común (para cazar una coma mal puesta), no límites legales.
  /** @type {ReadonlyArray<{id: string, path: string[], label: string, kind: "eur" | "pct", min: number, max: number}>} */
  const FIELD_SPECS = Object.freeze([
    { id: "annualGross", path: ["annualGross"], label: "el bruto anual", kind: "eur", min: 0, max: 2000000 },
    { id: "marginalRatePct", path: ["marginalRatePct"], label: "el tipo marginal de IRPF", kind: "pct", min: 0, max: 60 },
    { id: "estimatedResult", path: ["estimatedResult"], label: "el resultado estimado de la Renta", kind: "eur", min: -1000000, max: 1000000 },
    { id: "currentWithholdingPct", path: ["currentWithholdingPct"], label: "la retención actual", kind: "pct", min: 0, max: 60 },
    { id: "pensionContributed", path: ["pension", "contributedYear"], label: "lo aportado este año al plan de pensiones", kind: "eur", min: 0, max: 100000 },
    { id: "pensionAvailable", path: ["pension", "availableToContribute"], label: "lo que podéis aportar todavía", kind: "eur", min: 0, max: 1000000 },
    { id: "housingPaid", path: ["housing", "paidYear"], label: "lo pagado este año por la vivienda", kind: "eur", min: 0, max: 1000000 },
    { id: "realizedNet", path: ["capital", "realizedNet"], label: "el resultado neto de las ventas del año", kind: "eur", min: -10000000, max: 10000000 },
    { id: "latentLosses", path: ["capital", "latentLosses"], label: "las minusvalías latentes", kind: "eur", min: 0, max: 10000000 },
    { id: "savingsRatePct", path: ["capital", "savingsRatePct"], label: "el tipo de la base del ahorro", kind: "pct", min: 0, max: 35 },
    { id: "donationsAmount", path: ["donations", "amountYear"], label: "los donativos del año", kind: "eur", min: 0, max: 1000000 },
  ]);
  // Sí / No / «no lo sé» (null): una respuesta que no se sabe no es un «no».
  const TRISTATE_SPECS = Object.freeze([
    { id: "hasEmployerPlan", path: ["pension", "hasEmployerPlan"], label: "si hay plan de pensiones de empresa" },
    { id: "housingApplies", path: ["housing", "applies"], label: "si aplica la deducción por vivienda" },
  ]);

  function setPath(target, path, value) {
    let node = target;
    path.slice(0, -1).forEach((key) => { node[key] = node[key] || {}; node = node[key]; });
    node[path[path.length - 1]] = value;
  }

  function getPath(source, path) {
    return path.reduce((node, key) => (node && typeof node === "object" ? node[key] : undefined), source);
  }

  function cleanLabel(value) {
    return text(value).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").slice(0, MAX_LABEL).trim();
  }

  // Un valor de entrada → { value, error }. Vacío (null, undefined, "") = sin dato; NaN o texto = no es un número; fuera de rango = error. Nunca se corrige en silencio a 0.
  function readField(spec, raw) {
    if (raw === null || raw === undefined || raw === "") return { value: null, error: null };
    const parsed = typeof raw === "number" ? raw : Number.NaN;
    if (!Number.isFinite(parsed)) return { value: null, error: `No entiendo ${spec.label}: escribe solo un número.` };
    if (parsed < spec.min || parsed > spec.max) {
      const unit = spec.kind === "pct" ? " %" : " €";
      const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return { value: null, error: `${spec.label[0].toUpperCase()}${spec.label.slice(1)} tiene que estar entre ${fmt(spec.min)}${unit} y ${fmt(spec.max)}${unit}.` };
    }
    return { value: round2(parsed), error: null };
  }

  /**
   * Un declarante a partir de lo tecleado. `values` lleva, por id de campo, un número, null/"" (sin dato) o NaN (texto que no es un número);
   * `choices` lleva, por id de respuesta, true / false / null; `recurring` es el «donativos recurrentes» (true / false).
   * Devuelve el declarante normalizado y los errores por campo; con algún error el llamador no debe guardar.
   * @param {{id?: string, label?: string, values?: Record<string, any>, choices?: Record<string, any>, recurring?: any}} input
   */
  function holderFromInput(input = {}) {
    const holder = { id: text(input.id), label: cleanLabel(input.label) };
    const errors = {};
    FIELD_SPECS.forEach((spec) => {
      const { value, error } = readField(spec, input.values ? input.values[spec.id] : null);
      if (error) errors[spec.id] = error;
      setPath(holder, spec.path, value);
    });
    TRISTATE_SPECS.forEach((spec) => {
      const raw = input.choices ? input.choices[spec.id] : null;
      setPath(holder, spec.path, raw === true || raw === false ? raw : null);
    });
    holder.donations = { ...(holder.donations || {}), recurring: input.recurring === true };
    return { holder, errors };
  }

  // ¿Ha escrito algo este declarante? Un 0 escrito cuenta (es un dato); el nombre solo y la casilla «recurrente» sin importe no: no hay nada que calcular.
  function holderHasData(holder) {
    if (!holder || typeof holder !== "object") return false;
    if (FIELD_SPECS.some((spec) => number(getPath(holder, spec.path)) !== null)) return true;
    return TRISTATE_SPECS.some((spec) => { const v = getPath(holder, spec.path); return v === true || v === false; });
  }

  function normalizeHolder(raw, fallbackId) {
    if (!raw || typeof raw !== "object") return null;
    const values = {};
    FIELD_SPECS.forEach((spec) => { values[spec.id] = getPath(raw, spec.path); });
    const choices = {};
    TRISTATE_SPECS.forEach((spec) => { choices[spec.id] = getPath(raw, spec.path); });
    // Al leer del almacén, un campo fuera de rango o dañado vuelve a «sin dato»: nunca se convierte en un cero ni en un máximo.
    const { holder } = holderFromInput({ id: text(raw.id) || fallbackId, label: raw.label, values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "number" ? value : value === null || value === undefined ? null : Number(value)])), choices, recurring: raw.donations?.recurring });
    FIELD_SPECS.forEach((spec) => { const { error } = readField(spec, getPath(holder, spec.path)); if (error) setPath(holder, spec.path, null); });
    return holder;
  }

  /** Lo que hay en el almacén, saneado. Siempre devuelve una forma válida (vacía si no hay nada o está dañado). */
  function normalizeStore(raw) {
    const empty = { schemaId: STORE_SCHEMA_ID, year: null, holders: [], updatedAt: null };
    if (!raw || typeof raw !== "object") return empty;
    const year = Math.trunc(number(raw.year, NaN));
    const holders = (Array.isArray(raw.holders) ? raw.holders : []).slice(0, MAX_HOLDERS)
      .map((holder, index) => normalizeHolder(holder, `persona-${index + 1}`))
      .filter(holderHasData);
    // Dos declarantes no pueden compartir identificador.
    const seen = new Set();
    holders.forEach((holder, index) => { if (!holder.id || seen.has(holder.id)) holder.id = `persona-${index + 1}`; seen.add(holder.id); });
    return {
      schemaId: STORE_SCHEMA_ID,
      year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
      holders,
      updatedAt: validIsoDate(raw.updatedAt) ? raw.updatedAt : null,
    };
  }

  /**
   * ¿Qué hogar usa la campaña? El de los datos tecleados si son del año de la campaña; si no, nada (la pantalla cae al ejemplo y lo dice).
   * @returns {{status: "real" | "empty" | "stale-year", household: any, storedYear: number | null, updatedAt: string | null}}
   */
  function resolveHousehold(store, year) {
    const normalized = normalizeStore(store);
    if (!normalized.holders.length) return { status: "empty", household: null, storedYear: normalized.year, updatedAt: normalized.updatedAt };
    if (normalized.year !== Number(year)) return { status: "stale-year", household: null, storedYear: normalized.year, updatedAt: normalized.updatedAt };
    return { status: "real", household: { year: Number(year), example: false, holders: normalized.holders }, storedYear: normalized.year, updatedAt: normalized.updatedAt };
  }

  // ---------- «Hecho» (PR-3) ----------
  // Lo marca el hogar: la app NO comprueba que se hiciera (no ve el banco ni el plan). La fecha es la del día en que se marcó, no la de la operación.
  // Una marca solo cuenta si es del año de la campaña y de una acción que sigue teniendo algo que hacer; las demás se ignoran, no se borran.
  const doneKey = (actionId, holderId) => `${actionId}|${holderId}`;

  /** Lo que hay en el almacén de «hecho», saneado: siempre una forma válida (vacía si no hay nada, está dañado o no dice de qué año es). */
  function normalizeDone(raw) {
    const empty = { schemaId: DONE_SCHEMA_ID, year: null, marks: {} };
    if (!raw || typeof raw !== "object") return empty;
    const year = Math.trunc(number(raw.year, NaN));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return empty;
    const ids = ACTIONS.map((action) => action.id);
    const marks = {};
    const source = raw.marks && typeof raw.marks === "object" && !Array.isArray(raw.marks) ? raw.marks : {};
    Object.entries(source).slice(0, MAX_DONE_MARKS).forEach(([key, value]) => {
      const [actionId, holderId, extra] = String(key).split("|");
      const at = text(value && value.at);
      if (extra !== undefined || !ids.includes(actionId) || !holderId || holderId.length > MAX_LABEL || !validIsoDate(at) || Number(at.slice(0, 4)) !== year) return;
      marks[doneKey(actionId, holderId)] = { at };
    });
    return { schemaId: DONE_SCHEMA_ID, year, marks };
  }

  /**
   * Marca una acción como hecha para un declarante. Devuelve el almacén nuevo o un error (nunca guarda una marca inventada).
   * @param {*} store
   * @param {{year: number, actionId: string, holderId: string, at: string}} mark
   */
  function markDone(store, mark) {
    const year = Math.trunc(number(mark && mark.year, NaN));
    const actionId = text(mark && mark.actionId);
    const holderId = text(mark && mark.holderId);
    const at = text(mark && mark.at);
    if (!Number.isInteger(year) || !ACTIONS.some((action) => action.id === actionId) || !holderId || holderId.length > MAX_LABEL) return { error: "invalid-mark", store: normalizeDone(store) };
    if (!validIsoDate(at) || Number(at.slice(0, 4)) !== year) return { error: "date-outside-year", store: normalizeDone(store) };
    const current = normalizeDone(store);
    // Un año nuevo empieza sin marcas: lo hecho en 2026 no cuenta para 2027.
    const base = current.year === year ? current : { schemaId: DONE_SCHEMA_ID, year, marks: {} };
    return { error: null, store: { ...base, marks: { ...base.marks, [doneKey(actionId, holderId)]: { at } } } };
  }

  /** Quita una marca (si no estaba, no hace nada). */
  function unmarkDone(store, mark) {
    const current = normalizeDone(store);
    const marks = { ...current.marks };
    delete marks[doneKey(text(mark && mark.actionId), text(mark && mark.holderId))];
    return { ...current, marks };
  }

  // M-FISCAL: de las tareas con fecha límite del 31/12 y algo que hacer, cuántas están marcadas. «Sin tareas» NO es «todo hecho»: el 100 % solo existe si había algo que hacer.
  function progressOf(actions) {
    const rows = actions.filter((action) => action.deadline).flatMap((action) => action.rows.filter((row) => row.actionable));
    const done = rows.filter((row) => row.done);
    const sum = (list) => round2(list.reduce((total, row) => total + row.result.savingEur, 0));
    return {
      total: rows.length,
      done: done.length,
      pending: rows.length - done.length,
      pct: rows.length ? Math.round((done.length / rows.length) * 100) : null,
      allDone: rows.length > 0 && done.length === rows.length,
      doneSavingEur: sum(done),
      pendingSavingEur: sum(rows.filter((row) => !row.done)),
    };
  }

  /**
   * @param {{year?: number, holders?: Array<Record<string, any>>, parameters?: Record<string, any>, example?: boolean}} [household]
   * @param {{today?: string, done?: any}} [options]
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

    const doneStore = normalizeDone(options.done);
    const doneMarks = doneStore.year === year ? doneStore.marks : {};
    const actions = order(ACTIONS.map((definition) => buildAction(definition, holders, params, doneMarks)));
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
      progress: progressOf(actions),
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
    STORE_NAME,
    STORE_SCHEMA_ID,
    MAX_HOLDERS,
    FIELD_SPECS,
    TRISTATE_SPECS,
    parametersFor,
    buildCampaign,
    holderFromInput,
    holderHasData,
    normalizeStore,
    resolveHousehold,
    DONE_STORE_NAME,
    DONE_SCHEMA_ID,
    doneKey,
    normalizeDone,
    markDone,
    unmarkDone,
  };
});
