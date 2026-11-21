(function attachE14DebtAdapter(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalE14DebtAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function e14DebtAdapterFactory() {
  "use strict";

  // SVD-2 (17/11/2026): v2 añade, sin quitar nada de v1, los datos de cada contrato, la capacidad mes a mes y el suelo.
  const SCHEMA_ID = "finance-e14-debt-roadmap-read-model/v2";
  const STRATEGY_SCHEMA_ID = "finance-debt-strategy/v1";

  const FIELD_INVENTORY = Object.freeze({
    canonical: Object.freeze(["liquidity", "monthly", "cb_amount", "bk_amount", "baseMonth"]),
    operational: Object.freeze(["tasks", "scenario", "agreement", "wizink_hito_mes", "migracion", "cuotasEnPlan", "svdUltimaVisita"]),
    assumption: Object.freeze([
      "profile", "buffer", "preserveCash", "cb_strategy", "cb_discount", "cb_start", "cb_lump",
      "cb_apr", "cb_term", "cb_finance_pct", "bk_strategy", "bk_discount", "bk_start", "bk_lump",
      "bk_apr", "bk_term", "bk_finance_pct", "fc_months", "referenceAPR",
      // SVD-1 (17/11/2026): la aportación extra de D1 fase 1 se quedó fuera del inventario.
      "cb_extra", "cb_extra_month", "bk_extra", "bk_extra_month",
    ]),
    note: Object.freeze(["notes"]),
  });

  const STRATEGY_TYPES = Object.freeze(["settlement", "single-payment", "refinancing", "suspension", "arrears", "resume-payments", "hold"]);

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function monthKey(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{1,2})/);
    return match ? `${match[1]}-${String(Number(match[2])).padStart(2, "0")}` : "";
  }

  // SVD-1: los supuestos de cada cuenta adicional (D1 fase 2) se guardan como `acct_<id>_<campo>`.
  const DYNAMIC_ACCOUNT_FIELD = /^acct_[a-zA-Z0-9_-]+_(strategy|discount|start|lump|apr|term|finance_pct|extra|extra_month)$/;
  // SVD-2: lo que el contrato valía cuando el hogar simuló sobre él, para avisar si después cambia en Contratos.
  // SVD-4: además, cuándo se propuso el acuerdo a la entidad y antes de qué día dijo que contestaría.
  const DYNAMIC_ACCOUNT_BASE = /^acct_[a-zA-Z0-9_-]+_(base|propuesta|respuesta)$/;

  function classifyField(field) {
    const match = Object.entries(FIELD_INVENTORY).find(([, fields]) => fields.includes(field));
    if (match) return match[0];
    if (DYNAMIC_ACCOUNT_BASE.test(String(field))) return "operational";
    return DYNAMIC_ACCOUNT_FIELD.test(String(field)) ? "assumption" : "ambiguous";
  }

  function inventoryRoadmapState(state = {}) {
    return Object.keys(state).sort().map((field) => ({ field, classification: classifyField(field) }));
  }

  function contractsNamed(contracts, entity) {
    const normalized = String(entity).trim().toLocaleLowerCase("es");
    return contracts.filter((contract) => String(contract?.entity || "").trim().toLocaleLowerCase("es") === normalized);
  }

  function findUniqueContract(contracts, entity) {
    const matches = contractsNamed(contracts, entity);
    return matches.length === 1 ? matches[0] : null;
  }

  // SVD-1 (17/11/2026): las dos cuentas fijas del simulador (cb = «Entidad A», bk = «Entidad B») solo existen mientras
  // haya un contrato con ese nombre, que son los de ejemplo. «sin-contrato»: ninguno, así que la cuenta no se usa y su
  // saldo es 0 (antes se quedaba con el de ejemplo y sumaba deuda que no existe). «ambigua»: más de uno con ese nombre.
  function fixedAccountStatus(contracts, entity) {
    const count = contractsNamed(contracts, entity).length;
    if (count === 1) return "enlazada";
    return count === 0 ? "sin-contrato" : "ambigua";
  }

  // SVD-2: lo que el hogar puede dedicar a la deuda cada mes de los 12 primeros, con la misma cuenta que la media de v1
  // (lo que entra menos lo que sale antes de ahorrar; nunca negativo).
  function capacitySeries(series) {
    return series.slice(0, 12).map((month) => ({
      monthKey: monthKey(month?.monthKey),
      capacity: round2(Math.max(0, number(month?.totals?.income) - number(month?.totals?.outflowsBeforeSaving))),
    }));
  }

  function canonicalForecastSummary(forecast = {}) {
    const series = Array.isArray(forecast?.series) ? forecast.series : [];
    const first = series[0] || null;
    const minimumLiquidity = series.length
      ? Math.min(...series.map((month) => number(month?.totals?.closingLiquidity)))
      : null;
    const averageFreeCapacity = series.length
      ? round2(series.reduce((sum, month) => sum + Math.max(0, number(month?.totals?.income) - number(month?.totals?.outflowsBeforeSaving)), 0) / series.length)
      : null;
    return {
      schemaId: forecast?.schemaId || "",
      fingerprint: forecast?.fingerprint || "",
      valid: forecast?.valid === true,
      months: series.length,
      startMonth: monthKey(first?.monthKey),
      openingLiquidity: first ? round2(number(first?.totals?.closingLiquidity) - number(first?.totals?.income) + number(first?.totals?.outflowsBeforeSaving)) : null,
      minimumLiquidity: minimumLiquidity === null ? null : round2(minimumLiquidity),
      averageFreeCapacity,
      capacitySeries: capacitySeries(series),
    };
  }

  // D1 (Fase 2): cualquier contrato canónico real que no sea Entidad A/B, no esté ya liquidado y
  // no sea el plan reunificado sintético (`debt-reunified-cetelem`, una vista derivada de las
  // mismas deudas, no una deuda aparte) se expone como cuenta adicional simulable en el sandbox.
  // Entidad A/B siguen viajando tal cual (cb_amount/bk_amount) para no romper la paridad histórica
  // ya verificada (A9-8) — esto solo añade, nunca sustituye ese contrato.
  // SVD-2: lo que el simulador necesita saber de cada contrato, tal como está en Deuda › Contratos. Lo que no se sabe
  // queda en null (nunca 0 inventado): una TAE por confirmar no es una TAE del 0 %.
  function optionalNumber(value) {
    return value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : round2(value);
  }

  function contractFacts(contract) {
    return {
      apr: optionalNumber(contract.apr),
      currentPayment: optionalNumber(contract.currentPayment),
      remainingInstallments: optionalNumber(contract.remainingInstallments),
      paymentsSuspended: contract.paymentsSuspended === true,
      arrearsEstimated: optionalNumber(contract.arrearsEstimated),
      arrearsMonths: optionalNumber(contract.arrearsMonths),
      revolving: contract.revolving === true,
    };
  }

  // SVD-2b (17/11/2026): la cuota de hoy de cada contrato, con las MISMAS reglas con que «Camino a deuda cero» decide si lo
  // incluye (canonical-debt-payoff-path.js, classify): activo, con cuota, y con TAE declarada o deducible de cuota y plazo.
  // La deducción usa la función de Ruta (`payoffPath.impliedMonthlyRate`), que se pasa al adaptador en vez de copiarla.
  const DECLARED_TOLERANCE = 0.005;
  const IMPLIED_TOLERANCE = 0.5;

  function keepPaymentFacts(contract, payoffPath) {
    const principal = round2(number(contract.currentPrincipal));
    const payment = round2(number(contract.currentPayment));
    if (contract.paymentStatus !== "active" || !(payment > 0)) return { cuotaDeHoy: null, fueraDeRuta: "sin-cuota-activa" };
    const apr = optionalNumber(contract.apr);
    if (apr !== null && apr >= 0) return { cuotaDeHoy: { payment, monthlyRate: apr / 100 / 12, tolerance: DECLARED_TOLERANCE, source: "declared" }, fueraDeRuta: null };
    const installments = Math.max(0, Math.floor(number(contract.remainingInstallments)));
    if (!(installments > 0)) return { cuotaDeHoy: null, fueraDeRuta: "sin-tae-ni-plazo" };
    const rate = typeof payoffPath?.impliedMonthlyRate === "function" ? payoffPath.impliedMonthlyRate(principal, payment, installments) : null;
    if (rate === null) return { cuotaDeHoy: null, fueraDeRuta: typeof payoffPath?.impliedMonthlyRate === "function" ? "plazo-incoherente" : "sin-tae-ni-plazo" };
    return { cuotaDeHoy: { payment, monthlyRate: rate, tolerance: IMPLIED_TOLERANCE, source: "implied" }, fueraDeRuta: null };
  }

  // Huella estable de lo que importa para simular: si cambia, la simulación se montó sobre otros datos.
  function contractFingerprint(account) {
    return [account.currentPrincipal, account.apr, account.currentPayment, account.remainingInstallments, account.paymentStatus, account.arrearsEstimated]
      .map((value) => value === null || value === undefined ? "-" : String(value)).join("|");
  }

  // SVD-3 (17/11/2026): el acuerdo aceptado de un contrato, tal como lo guarda Contratos (canonical-debt-contracts.js), o null.
  function isAccepted(contract) {
    return String(contract?.agreement?.status || "").toLocaleLowerCase("es") === "accepted";
  }

  function withoutAcceptedAgreement(contract) {
    if (!isAccepted(contract)) return contract;
    const { agreement, ...rest } = contract;
    return rest;
  }

  function acceptedAgreementFacts(contract) {
    if (!isAccepted(contract)) return null;
    const agreement = contract.agreement;
    return {
      type: String(agreement.type || ""),
      startMonth: monthKey(agreement.startMonth),
      settlementAmount: round2(agreement.settlementAmount),
      payment: round2(agreement.payment),
      duration: Math.max(0, Math.floor(number(agreement.duration))),
      acceptedAt: String(agreement.acceptedAt || ""),
      documentName: String(agreement.documentName || ""),
      hasDocument: Boolean(agreement.documentId),
    };
  }

  function extraSourceContracts(contracts, entityA, entityB) {
    return contracts
      .filter((contract) => contract && contract !== entityA && contract !== entityB)
      .filter((contract) => contract.id !== "debt-reunified-cetelem")
      .filter((contract) => contract.paymentStatus !== "settled" && number(contract.currentPrincipal) > 0)
      .filter((contract) => String(contract.id || "").trim());
  }

  // SVD-2b: «Camino a deuda cero» sin extra, sobre los mismos contratos que simula el simulador y desde el mismo mes. El
  // simulador lo compara con su propio «todas en Esperar»: si no coinciden, lo dice.
  function rutaSummary(sources, payoffPath, startMonthKey) {
    if (typeof payoffPath?.project !== "function" || !sources.length || !/^\d{4}-\d{2}$/.test(String(startMonthKey || ""))) return null;
    // SVD-3: la comparación es con «todas en Esperar», así que Ruta se calcula aquí sin los acuerdos aceptados (que sí cuenta
    // en Deuda › Ruta): si no, una cuenta con acuerdo descuadraría la comparación sin que nada esté mal.
    const result = payoffPath.project(sources.map(withoutAcceptedAgreement), { startMonthKey, extraMonthly: 0 });
    if (!result?.ok) return null;
    return {
      startMonthKey,
      debtFreeMonthKey: result.debtFreeMonthKey,
      monthsToDebtFree: result.monthsToDebtFree,
      totalPaid: result.totalPaid,
      totalInterest: result.totalInterest,
      included: result.included.map((row) => row.id),
      excluded: result.excluded.map((row) => ({ id: row.id, reason: row.reason })),
      beyondHorizon: result.beyondHorizon === true,
    };
  }

  function extraDebtAccounts(contracts, entityA, entityB, payoffPath) {
    return extraSourceContracts(contracts, entityA, entityB)
      .map((contract) => {
        const account = {
          id: String(contract.id || "").trim(),
          entity: String(contract.entity || "Deuda sin nombre").trim(),
          type: String(contract.type || "").trim(),
          currentPrincipal: round2(contract.currentPrincipal),
          paymentStatus: String(contract.paymentStatus || "unknown"),
          ...contractFacts(contract),
          ...keepPaymentFacts(contract, payoffPath),
          acuerdo: acceptedAgreementFacts(contract),
        };
        return { ...account, fingerprint: contractFingerprint(account) };
      })
      .filter((account) => account.id);
  }

  // SVD-5: a cada acuerdo, lo que se sabe de él fuera del simulador (si su pago sigue en el plan, si ya se pagó).
  function withFollowUp(accounts, followUp) {
    const byId = new Map((Array.isArray(followUp) ? followUp : []).map((item) => [String(item?.id || ""), item]));
    return accounts.map((account) => {
      const item = account.acuerdo ? byId.get(account.id) : null;
      if (!item) return account;
      return { ...account, acuerdo: { ...account.acuerdo, seguimiento: { plan: item.plan, estado: item.estado, pagoFecha: item.pago?.date || "" } } };
    });
  }

  function planInstallmentsSummary(plan) {
    if (!plan || !Array.isArray(plan.items)) return null;
    const paying = plan.items.filter((item) => item.payment > 0);
    return {
      monthKey: monthKey(plan.monthKey),
      monthLabel: String(plan.monthLabel || ""),
      coverage: String(plan.coverage || ""),
      enPlan: paying.filter((item) => item.status === "en-plan" || item.status === "importe-distinto").length,
      conCuota: paying.length,
      fuera: round2(plan.totals?.missingPayment),
    };
  }

  // SVD-5 (18/11/2026, «Desde vuestra última visita»): lo que el simulador recuerda de cada contrato (capital, cuota, estado,
  // acuerdo y su seguimiento) y lo que ha cambiado fuera desde entonces. Se guarda en el estado del simulador (`svdUltimaVisita`),
  // sin clave nueva, y solo se renueva cuando el hogar dice «Entendido». Puro.
  function visitSnapshot(accounts, today) {
    const contratos = {};
    (Array.isArray(accounts) ? accounts : []).forEach((account) => {
      contratos[account.id] = {
        entity: account.entity,
        principal: round2(account.currentPrincipal),
        payment: account.currentPayment === null || account.currentPayment === undefined ? null : round2(account.currentPayment),
        status: account.paymentStatus,
        acuerdo: account.acuerdo ? (account.acuerdo.seguimiento?.plan === "sin-decision" ? "sin-plan" : account.acuerdo.seguimiento?.estado || "aplicado") : "",
      };
    });
    return { at: String(today || ""), contratos };
  }

  function sinceLastVisit(previous, current) {
    if (!previous || typeof previous !== "object" || !previous.contratos || typeof previous.contratos !== "object") return { since: "", items: [] };
    const items = [];
    const before = previous.contratos;
    const now = current?.contratos || {};
    // Como money() de la app: miles con punto siempre (Intl en es-ES no agrupa los de cuatro cifras) y céntimos solo si los hay.
    const euros = (value) => {
      const [whole, cents] = Math.abs(round2(value)).toFixed(2).split(".");
      return `${value < 0 ? "-" : ""}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}${cents === "00" ? "" : `,${cents}`} €`;
    };
    Object.entries(now).forEach(([id, item]) => {
      const old = before[id];
      if (!old) { items.push({ id, kind: "nuevo", text: `${item.entity}: contrato nuevo en Contratos.` }); return; }
      if (old.principal !== item.principal) items.push({ id, kind: "capital", text: `${item.entity}: el capital pendiente pasó de ${euros(old.principal)} a ${euros(item.principal)}.` });
      if (old.payment !== item.payment && item.payment !== null && old.payment !== null) items.push({ id, kind: "cuota", text: `${item.entity}: la cuota pasó de ${euros(old.payment)} a ${euros(item.payment)}.` });
      if (old.acuerdo !== item.acuerdo) {
        const texto = {
          "aplicado": "acuerdo aceptado y aplicado.",
          "pendiente": "acuerdo aceptado y aplicado.",
          "en-curso": "acuerdo aceptado y aplicado.",
          "cumplido": "el pago del acuerdo ya sale en el extracto.",
          "ya-liquidado": "acuerdo cumplido: contrato liquidado.",
          "sin-pago": "el mes del pago del acuerdo pasó y no se ve en los extractos.",
          "sin-plan": "el pago del acuerdo ya no está en el plan.",
          "": "ya no tiene acuerdo aceptado.",
        }[item.acuerdo] || "el acuerdo ha cambiado.";
        items.push({ id, kind: "acuerdo", text: `${item.entity}: ${texto}` });
      }
    });
    Object.entries(before).forEach(([id, old]) => {
      if (!now[id]) items.push({ id, kind: "fuera", text: `${old.entity}: ya no está entre las deudas por simular (liquidado o quitado de Contratos).` });
    });
    return { since: String(previous.at || ""), items };
  }

  function buildReadModel(input = {}) {
    const contracts = clone(Array.isArray(input.contracts) ? input.contracts : []);
    const priorState = clone(input.roadmapState && typeof input.roadmapState === "object" ? input.roadmapState : {});
    const forecast = canonicalForecastSummary(input.forecast);
    const entityA = findUniqueContract(contracts, "Entidad A");
    const entityB = findUniqueContract(contracts, "Entidad B");
    const fixedAccounts = { cb: fixedAccountStatus(contracts, "Entidad A"), bk: fixedAccountStatus(contracts, "Entidad B") };
    const ambiguous = [];
    if (fixedAccounts.cb === "ambigua") ambiguous.push("cb_amount");
    if (fixedAccounts.bk === "ambigua") ambiguous.push("bk_amount");
    if (!forecast.valid || forecast.openingLiquidity === null) ambiguous.push("liquidity", "monthly", "baseMonth");

    const canonicalValues = {};
    if (entityA) canonicalValues.cb_amount = round2(entityA.currentPrincipal);
    if (entityB) canonicalValues.bk_amount = round2(entityB.currentPrincipal);
    if (fixedAccounts.cb === "sin-contrato") canonicalValues.cb_amount = 0;
    if (fixedAccounts.bk === "sin-contrato") canonicalValues.bk_amount = 0;
    if (forecast.valid && forecast.openingLiquidity !== null) {
      canonicalValues.liquidity = forecast.openingLiquidity;
      canonicalValues.monthly = forecast.averageFreeCapacity;
      canonicalValues.baseMonth = forecast.startMonth;
    }

    const floor = optionalNumber(input.floor);
    const extraDebts = withFollowUp(extraDebtAccounts(contracts, entityA, entityB, input.payoffPath), input.agreementFollowUp);
    const visitaActual = visitSnapshot(extraDebts, input.today || "");
    return {
      // SVD-5: lo que ha cambiado fuera desde la última visita (lo que el simulador recuerda en `svdUltimaVisita`), y la foto de hoy
      // que guardará si el hogar dice «Entendido».
      visitaActual,
      desdeVisita: sinceLastVisit(priorState.svdUltimaVisita, visitaActual),
      schemaId: SCHEMA_ID,
      version: 2,
      floor,
      mode: "read-only",
      generatedAt: input.generatedAt || new Date().toISOString(),
      source: "canonical-debt-contracts+canonical-forecast",
      fieldInventory: FIELD_INVENTORY,
      canonicalValues,
      ambiguous: [...new Set(ambiguous)],
      contracts: { entityA, entityB, all: contracts },
      fixedAccounts,
      extraDebts,
      // El mismo «hoy» que Deuda › Ruta (camino-deuda-ui.js: el mes de hoy); si no llega, el primer mes de la previsión.
      // SVD-R1: cuántas de las cuotas que se pagan están en el plan (por el nombre de la entidad), y de qué mes.
      cuotasPlan: planInstallmentsSummary(input.planInstallments),
      ruta: rutaSummary(extraSourceContracts(contracts, entityA, entityB), input.payoffPath, input.startMonthKey || forecast.startMonth),
      forecast,
      roadmapState: priorState,
    };
  }

  // D1 (Fase 2/3): mismo saneado de clave que accountKey() en debt-roadmap.html — se duplica a
  // propósito en vez de compartir código entre un script de navegador sin módulos (el sandbox) y
  // esta librería, pero ambos deben producir siempre la misma clave para una cuenta dada.
  function dynamicAccountKey(id) {
    return `acct_${String(id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }

  // D1 (Fase 3): resuelve qué contrato real corresponde a una cuenta del sandbox (cb/bk/dinámica)
  // desde el propio modelo canónico ya calculado — nunca a partir de un contractId que llegue por
  // postMessage desde el iframe, para que el sandbox no pueda apuntar a un contrato arbitrario.
  function resolveAccountContract(accountKey, canonical) {
    if (accountKey === "cb") return canonical?.contracts?.entityA || null;
    if (accountKey === "bk") return canonical?.contracts?.entityB || null;
    return (canonical?.extraDebts || []).find((account) => dynamicAccountKey(account.id) === accountKey) || null;
  }

  // D1 (Fase 3): construye (o actualiza) la oferta borrador que el sandbox propone para una cuenta.
  // Función pura: no escribe nada, deja la mutación de estado y el aviso al llamador. Nunca inventa
  // una vigencia — si la oferta ya existía conserva la que el hogar hubiera puesto; si es nueva
  // queda en blanco a propósito, para que el hogar la complete antes de poder aplicarla.
  function buildDraftOffer(input = {}) {
    const key = String(input.accountKey || "");
    const account = input.account;
    const canonical = input.canonical;
    const existingOffers = input.existingOffers;
    const normalizeOffer = input.normalizeOffer;
    if (!key || !account || typeof normalizeOffer !== "function") return { ok: false, accountKey: key, message: "Datos incompletos." };
    const contract = resolveAccountContract(key, canonical);
    if (!contract) return { ok: false, accountKey: key, message: "Esta cuenta todavía no está vinculada a un contrato real único." };
    const amount = round2(number(account.lump) + number(account.financed));
    if (amount <= 0) return { ok: false, accountKey: key, message: "Esta estrategia no tiene ningún desembolso que proponer todavía — elige quita, refinanciación o híbrido." };
    const offers = Array.isArray(existingOffers) ? existingOffers : [];
    const replaceIndex = offers.findIndex((offer) => offer.source === "sandbox" && offer.contractId === contract.id && offer.status === "draft");
    const existing = replaceIndex >= 0 ? offers[replaceIndex] : null;
    const offer = normalizeOffer({
      id: existing?.id, contractId: contract.id, counterpart: contract.entity, expiresAt: existing?.expiresAt || "",
      amount, principal: contract.currentPrincipal, paymentType: account.strategy, installment: account.monthly,
      termMonths: account.term, apr: account.apr, documents: existing?.documents || [], status: "draft", source: "sandbox",
      notes: "Generada automáticamente desde el sandbox de deuda (D1 Fase 3). Completa la vigencia antes de poder aplicarla.",
    }, contract);
    return { ok: true, accountKey: key, offer, replaceIndex, message: "Oferta borrador guardada en Plan de deuda. Completa la vigencia allí antes de poder aplicarla." };
  }

  function strategyType(value) {
    const aliases = { settlement: "settlement", quita: "settlement", fixed: "single-payment", optimize: "single-payment", refi: "refinancing", refinancing: "refinancing", hybrid: "refinancing", suspended: "suspension", suspension: "suspension", arrears: "arrears", resume: "resume-payments", "resume-payment": "resume-payments", hold: "hold" };
    return aliases[String(value || "").trim().toLocaleLowerCase("es")] || "hold";
  }

  function normalizeStrategy(raw = {}, contract = {}) {
    const type = strategyType(raw.type || raw.strategy || raw.mode);
    const startMonth = monthKey(raw.startMonth || raw.monthKey);
    const normalized = {
      schemaId: STRATEGY_SCHEMA_ID,
      version: 1,
      id: String(raw.id || "").trim(),
      contractId: String(raw.contractId || raw.targetId || contract.id || "").trim(),
      type,
      principal: round2(raw.principal ?? contract.currentPrincipal),
      settlementAmount: round2(raw.settlementAmount ?? raw.lumpSum ?? raw.amount),
      discountPercent: round2(raw.discountPercent ?? raw.discount),
      apr: round2(raw.apr ?? raw.tae),
      installment: round2(raw.installment ?? raw.payment),
      termMonths: Math.max(0, Math.floor(number(raw.termMonths ?? raw.duration))),
      startMonth,
      maturityMonth: monthKey(raw.maturityMonth || contract.maturityMonth),
      arrears: round2(raw.arrears ?? contract.arrearsEstimated),
      paymentStatus: String(raw.paymentStatus || contract.paymentStatus || "unknown"),
      source: String(raw.source || "roadmap-assumption"),
    };
    const issues = [];
    if (!normalized.contractId) issues.push("missing-contract");
    if (normalized.principal < 0 || normalized.settlementAmount < 0 || normalized.arrears < 0) issues.push("negative-amount");
    if (normalized.discountPercent < 0 || normalized.discountPercent > 100) issues.push("invalid-discount");
    if (["refinancing", "resume-payments"].includes(type) && normalized.termMonths < 1) issues.push("missing-term");
    if (!["hold", "suspension", "arrears"].includes(type) && !startMonth) issues.push("missing-start-month");
    return { ...normalized, valid: issues.length === 0, issues };
  }

  function addMonthKeys(key, offset) {
    const [year, month] = key.split("-").map(Number);
    const index = year * 12 + (month - 1) + offset;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  }

  const AGREEMENT_TYPES = Object.freeze({ settlement: "settlement", refi: "refinancing", hybrid: "hybrid" });

  // SVD-3 (17/11/2026): lo que el hogar ha marcado como «La entidad lo ha aceptado» en una cuenta del simulador, convertido
  // en el acuerdo que guarda el contrato. Puro: no escribe nada. Igual que buildDraftOffer, el contrato sale del modelo
  // canónico ya calculado, nunca de un id que llegue del iframe. Se niega, con el motivo, si la cuenta no tiene contrato
  // único, si el contrato ya tiene un acuerdo aceptado, si la estrategia es «Esperar» o si el primer pago ya ha pasado.
  function buildAcceptedAgreement(input = {}) {
    const key = String(input.accountKey || "");
    const account = input.account || {};
    const fail = (message) => ({ ok: false, accountKey: key, message });
    const contract = resolveAccountContract(key, input.canonical);
    if (!contract) return fail("Esta cuenta todavía no está vinculada a un contrato real único.");
    const full = (input.canonical?.contracts?.all || []).find((row) => String(row?.id || "") === String(contract.id)) || contract;
    if (isAccepted(full) || contract.acuerdo) return fail("Este contrato ya tiene un acuerdo aceptado. Para cambiarlo, deshaz antes el que tiene.");
    const type = AGREEMENT_TYPES[String(account.strategy || "").trim().toLowerCase()];
    if (!type) return fail("«Esperar» no es un acuerdo: elige quita, refinanciación o híbrido con lo que ha aceptado la entidad.");
    const lump = round2(Math.max(0, number(account.lump)));
    const payment = type === "settlement" ? 0 : round2(Math.max(0, number(account.monthly)));
    const duration = type === "settlement" ? 0 : Math.max(0, Math.round(number(account.term)));
    if (type === "settlement" && !(lump > 0)) return fail("La quita no tiene importe: pon lo que habéis pactado pagar.");
    if (type !== "settlement" && !(payment > 0 && duration > 0)) return fail("La refinanciación no tiene cuota o plazo: revisa lo que se ha pactado.");
    const baseMonth = monthKey(input.baseMonthKey);
    if (!baseMonth) return fail("Falta el mes de partida del simulador.");
    const startMonth = addMonthKeys(baseMonth, Math.max(1, Math.round(number(account.start) || 1)) - 1);
    const todayKey = monthKey(input.todayKey);
    if (todayKey && startMonth < todayKey) return fail(`El primer pago del acuerdo (${startMonth}) ya ha pasado: ajusta el mes en el simulador.`);
    const principal = round2(full.currentPrincipal ?? contract.currentPrincipal);
    const totalAgreed = round2(lump + payment * duration);
    return {
      ok: true,
      accountKey: key,
      contractId: String(contract.id),
      contract: full,
      agreement: {
        status: "accepted",
        type,
        settlementAmount: lump,
        payment,
        duration,
        startMonth,
        source: "simulador-visual-de-deuda",
        principalAtAcceptance: principal,
      },
      totalAgreed,
      // Positivo: lo que se ahorra frente a la deuda de hoy (la quita). Negativo: lo que cuesta financiarla.
      saving: round2(principal - totalAgreed),
    };
  }

  // SVD-3: la decisión del plan que lleva el DINERO del acuerdo (el contrato guarda la deuda que queda; el plan, lo que sale).
  // Mismo formato que las de Plan › Decisiones (debtDecisionFromValues): pago único en su mes, cuotas pactadas desde ese mes y,
  // solo si el hogar dice que la cuota de hoy está en el plan, esa cuota deja de restarse.
  function agreementPlanDecision(input = {}) {
    const agreement = input.agreement || {};
    const contract = input.contract || {};
    const principal = round2(agreement.principalAtAcceptance ?? contract.currentPrincipal);
    // SVD-R1: si la app sabe qué partida del plan lleva esta cuota, se resta esa (`relief`); si no, la casilla del simulador.
    const relief = input.relief !== undefined && input.relief !== null
      ? round2(Math.max(0, number(input.relief)))
      : input.cuotasEnPlan && contract.paymentStatus === "active" ? round2(Math.max(0, number(contract.currentPayment))) : 0;
    const label = [contract.entity, contract.type].filter(Boolean).join(" ").trim() || "deuda";
    return {
      name: `Acuerdo aceptado · ${label}`,
      amount: round2(agreement.settlementAmount),
      targetId: String(contract.id || ""),
      targetPrincipal: principal,
      originalPrincipal: principal,
      discount: round2(Math.max(0, principal - number(agreement.settlementAmount) - number(agreement.payment) * number(agreement.duration))),
      monthlyRelief: relief,
      duration: 1,
      recurringAmount: round2(agreement.payment),
      recurringDuration: Math.max(0, Math.floor(number(agreement.duration))),
      recurringStartOffset: 0,
      mode: "fixed",
      payoffMode: "fixed",
      monthIndex: Math.max(0, Math.floor(number(input.monthIndex))),
      monthKey: monthKey(agreement.startMonth),
      svdAcuerdo: true,
    };
  }

  function lastDayOfMonth(key) {
    const [year, month] = key.split("-").map(Number);
    return `${key}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  }

  // SVD-4 (17/11/2026): «Guardar como escenario». La estrategia del simulador, cuenta a cuenta, en decisiones de Escenarios
  // (canonical-scenario-schema.js), con los tipos de siempre:
  //  - quita y pago único → «acuerdo_quita» (cierra la deuda ese mes con el pago pactado);
  //  - refinanciación o híbrido → «amortizacion» parcial por el pago único, si lo hay, y «refinanciacion» con lo financiado, la TAE,
  //    la cuota y el plazo del simulador, desde su mes;
  //  - «Esperar» → nada (es lo que ya hace el plan).
  // Solo cuentas con contrato real (el contrato sale del modelo canónico, nunca del iframe). Puro: sin id ni orden, que pone quien
  // guarda. Devuelve también lo que se ha dejado fuera y por qué.
  function scenarioDecisionsFromRoadmap(input = {}) {
    const baseMonth = monthKey(input.baseMonthKey);
    const decisions = [];
    const skipped = [];
    if (!baseMonth) return { decisions, skipped: [{ accountKey: "", reason: "sin-mes-base" }] };
    (Array.isArray(input.accounts) ? input.accounts : []).forEach((entry) => {
      const key = String(entry?.accountKey || "");
      const account = entry?.account || {};
      const strategy = String(account.strategy || "hold").toLowerCase();
      if (strategy === "hold") return;
      const contract = resolveAccountContract(key, input.canonical);
      if (!contract) { skipped.push({ accountKey: key, reason: "sin-contrato" }); return; }
      const mes = addMonthKeys(baseMonth, Math.max(1, Math.round(number(account.start) || 1)) - 1);
      const label = String(contract.entity || "deuda").trim();
      // D-N23: lo que sale del simulador sustituye a la cuota de hoy desde su mes, igual que en el simulador.
      const decision = (tipo, titulo, params) => ({ tipo, titulo: titulo.slice(0, 60), activa: true, planificacion: { modo: "manual", mesManual: mes, cuotaMesCambio: "sustituye" }, params });
      const lump = round2(Math.max(0, number(account.lump)));
      if (strategy === "settlement") {
        if (!(lump > 0)) { skipped.push({ accountKey: key, reason: "sin-importe" }); return; }
        decisions.push(decision("acuerdo_quita", `Quita · ${label}`, { deudaId: String(contract.id), importePactado: lump, modalidad: "pago-unico", vigenciaHasta: lastDayOfMonth(mes) }));
        return;
      }
      const financed = round2(Math.max(0, number(account.financed)));
      const monthly = round2(Math.max(0, number(account.monthly)));
      const term = Math.max(0, Math.round(number(account.term)));
      const apr = Math.max(0, number(account.apr));
      if (!(financed > 0 && monthly > 0 && term >= 1)) { skipped.push({ accountKey: key, reason: "sin-refinanciacion" }); return; }
      if (apr / 100 > 0.6 || term > 480) { skipped.push({ accountKey: key, reason: "fuera-de-rango" }); return; }
      if (lump > 0) decisions.push(decision("amortizacion", `Pago único · ${label}`, { deudaId: String(contract.id), importe: lump, parcial: true }));
      decisions.push(decision("refinanciacion", `${strategy === "hybrid" ? "Quita + refinanciación" : "Refinanciación"} · ${label}`, {
        deudaId: String(contract.id), nuevoPrincipal: financed, nuevoTIN: Math.round((apr / 100) * 1e6) / 1e6, nuevaCuota: monthly, nuevoPlazo: term,
      }));
    });
    return { decisions, skipped };
  }

  // SVD-4 (17/11/2026): «Lo hemos propuesto». Las propuestas hechas a una entidad que esperan respuesta (el simulador guarda la fecha
  // de la propuesta y el día antes del que la entidad dijo que contestaría: `acct_<id>_propuesta` y `acct_<id>_respuesta`). Solo las
  // de contratos reales que aún no tienen un acuerdo aceptado. `dias`: cuántos faltan para la respuesta (negativo: ya pasó). Puro.
  function isoDay(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  }

  function pendingProposals(input = {}) {
    const state = input.roadmapState && typeof input.roadmapState === "object" ? input.roadmapState : {};
    const today = isoDay(input.today);
    return (input.canonical?.extraDebts || [])
      .filter((account) => !account.acuerdo)
      .map((account) => {
        const key = dynamicAccountKey(account.id);
        const propuesta = String(state[`${key}_propuesta`] || "");
        const respuesta = String(state[`${key}_respuesta`] || "");
        if (isoDay(propuesta) === null) return null;
        const answer = isoDay(respuesta);
        return {
          accountKey: key,
          id: account.id,
          entity: account.entity,
          propuesta,
          respuesta: answer === null ? "" : respuesta,
          dias: answer === null || today === null ? null : Math.round((answer - today) / 86400000),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.dias ?? 9999) - (b.dias ?? 9999));
  }

  return {
    SCHEMA_ID,
    STRATEGY_SCHEMA_ID,
    FIELD_INVENTORY,
    STRATEGY_TYPES,
    classifyField,
    fixedAccountStatus,
    contractFingerprint,
    inventoryRoadmapState,
    buildReadModel,
    normalizeStrategy,
    dynamicAccountKey,
    resolveAccountContract,
    buildDraftOffer,
    buildAcceptedAgreement,
    agreementPlanDecision,
    acceptedAgreementFacts,
    scenarioDecisionsFromRoadmap,
    pendingProposals,
    visitSnapshot,
    sinceLastVisit,
  };
});
