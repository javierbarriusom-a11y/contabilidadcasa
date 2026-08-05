(function attachCanonicalE14Operations(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalE14Operations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalE14OperationsFactory() {
  "use strict";

  const SCHEMA_ID = "finance-e14-debt-operations/v1";
  const OFFER_SCHEMA_ID = "finance-e14-debt-offer/v1";
  const APPLICATION_SCHEMA_ID = "finance-e14-debt-application/v1";
  const REQUIRED_DOCUMENTS = Object.freeze(["offer", "identity-or-authority", "payment-terms"]);
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

  function monthKey(value) {
    const found = text(value).match(/^(\d{4})-(\d{1,2})/);
    return found ? `${found[1]}-${String(Number(found[2])).padStart(2, "0")}` : "";
  }

  function addMonths(value, offset) {
    const key = monthKey(value);
    if (!key) return "";
    const [year, month] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1 + Math.max(0, Number(offset) || 0), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function strategyKind(strategy = {}) {
    const raw = text(strategy.type || strategy.paymentType || strategy.strategy || strategy.mode).toLocaleLowerCase("es");
    if (["settlement", "single-payment", "quita", "fixed", "optimize"].includes(raw)) return "single-payment";
    if (["refinancing", "refi", "hybrid"].includes(raw)) return "refinancing";
    if (["resume-payments", "resume", "retomar"].includes(raw)) return "resume-payments";
    return "hold";
  }

  function normalizeOffer(raw = {}, contract = {}) {
    const documents = Array.isArray(raw.documents) ? raw.documents.map((item) => text(item)).filter(Boolean) : [];
    const amount = Math.max(0, round2(raw.amount ?? raw.settlementAmount ?? raw.proposedAmount));
    const principal = Math.max(0, round2(raw.principal ?? contract.currentPrincipal));
    const status = text(raw.status || "draft").toLocaleLowerCase("es");
    const normalized = {
      schemaId: OFFER_SCHEMA_ID,
      version: 1,
      id: text(raw.id || `offer-${Date.now()}`),
      contractId: text(raw.contractId || contract.id),
      counterpart: text(raw.counterpart),
      receivedAt: monthKey(raw.receivedAt || raw.date),
      expiresAt: monthKey(raw.expiresAt || raw.validUntil),
      amount,
      principal,
      paymentType: strategyKind(raw),
      installment: Math.max(0, round2(raw.installment ?? raw.payment)),
      termMonths: Math.max(0, Math.floor(number(raw.termMonths ?? raw.duration))),
      apr: Math.max(0, round2(raw.apr ?? raw.tae)),
      status: ["draft", "received", "accepted", "rejected", "expired"].includes(status) ? status : "draft",
      documents,
      notes: text(raw.notes),
      source: text(raw.source || "manual"),
    };
    const issues = [];
    if (!normalized.contractId) issues.push("missing-contract");
    if (!normalized.counterpart) issues.push("missing-counterpart");
    if (!normalized.expiresAt) issues.push("missing-validity");
    if (normalized.amount <= 0) issues.push("missing-amount");
    if (normalized.principal > 0 && normalized.amount > normalized.principal * 1.5) issues.push("amount-unusual");
    if (normalized.paymentType === "refinancing" && (normalized.termMonths < 1 || normalized.installment <= 0)) issues.push("missing-installments");
    return { ...normalized, discount: Math.max(0, round2(normalized.principal - normalized.amount)), valid: !issues.some((item) => item !== "amount-unusual"), issues };
  }

  function paymentSchedule(strategy = {}, forecast = {}) {
    const kind = strategyKind(strategy);
    const series = Array.isArray(forecast.series) ? forecast.series : [];
    const start = monthKey(strategy.startMonth || strategy.monthKey || series[0]?.monthKey);
    const startIndex = Math.max(0, series.findIndex((row) => row.monthKey === start));
    const amount = Math.max(0, round2(strategy.settlementAmount ?? strategy.amount));
    const term = Math.max(1, Math.floor(number(strategy.termMonths ?? strategy.duration) || 1));
    const installment = Math.max(0, round2(strategy.installment ?? strategy.payment)) || round2(amount / term);
    const upfront = Math.max(0, round2(strategy.upfrontAmount ?? strategy.lumpSum));
    const payments = [];
    if (kind === "single-payment") payments.push({ monthKey: series[startIndex]?.monthKey || start, amount, kind });
    if (kind === "refinancing" || kind === "resume-payments") {
      for (let offset = 0; offset < term; offset += 1) {
        payments.push({ monthKey: series[startIndex + offset]?.monthKey || addMonths(start, offset), amount: round2(installment + (offset === 0 ? upfront : 0)), kind });
      }
    }
    return payments.filter((item) => item.monthKey && item.amount > 0);
  }

  function simulateStrategy(strategy = {}, forecast = {}) {
    const series = Array.isArray(forecast.series) ? forecast.series : [];
    const payments = paymentSchedule(strategy, forecast);
    const byMonth = new Map();
    payments.forEach((payment) => byMonth.set(payment.monthKey, round2((byMonth.get(payment.monthKey) || 0) + payment.amount)));
    const rows = series.map((month) => {
      const payment = byMonth.get(month.monthKey) || 0;
      const closingLiquidity = round2(number(month.totals?.closingLiquidity) - payment);
      return { monthKey: month.monthKey, payment, closingLiquidity };
    });
    const cost = round2(payments.reduce((sum, item) => sum + item.amount, 0));
    const minimumLiquidity = rows.length ? Math.min(...rows.map((row) => row.closingLiquidity)) : 0;
    const negativeMonths = rows.filter((row) => row.closingLiquidity < 0).length;
    return {
      schemaId: `${SCHEMA_ID}/simulation/v1`, readOnly: true, writesPlan: false,
      strategy: clone(strategy), payments, rows, totalCost: cost,
      minimumLiquidity: round2(minimumLiquidity), negativeMonths,
      durationMonths: payments.length, feasible: negativeMonths === 0,
    };
  }

  function simulatePortfolio(strategies = [], forecast = {}) {
    const series = Array.isArray(forecast.series) ? forecast.series : [];
    const payments = (Array.isArray(strategies) ? strategies : []).flatMap((strategy) => paymentSchedule(strategy, forecast));
    const byMonth = new Map();
    payments.forEach((payment) => byMonth.set(payment.monthKey, round2((byMonth.get(payment.monthKey) || 0) + payment.amount)));
    const rows = series.map((month) => ({ monthKey: month.monthKey, payment: byMonth.get(month.monthKey) || 0 }));
    const paidRows = rows.map((row, index) => row.payment > 0 ? index + 1 : 0);
    return {
      schemaId: `${SCHEMA_ID}/portfolio-simulation/v1`, readOnly: true, writesPlan: false,
      payments, rows, totalCost: round2(rows.reduce((sum, row) => sum + row.payment, 0)),
      peakPayment: round2(Math.max(0, ...rows.map((row) => row.payment))),
      durationMonths: Math.max(0, ...paidRows),
    };
  }

  function toScenarioEvents(strategy = {}, forecast = {}) {
    return paymentSchedule(strategy, forecast).map((payment, index) => ({
      id: `e14-${text(strategy.id || strategy.contractId || "strategy")}-${index + 1}`,
      type: "debt", label: `E14b · ${text(strategy.label || "estrategia de deuda")}`,
      monthKey: payment.monthKey, amount: payment.amount, duration: 1,
    }));
  }

  function pareto(candidates = []) {
    return candidates.filter((candidate) => !candidates.some((other) => other.id !== candidate.id
      && other.totalCost <= candidate.totalCost && other.minimumLiquidity >= candidate.minimumLiquidity
      && other.durationMonths <= candidate.durationMonths
      && (other.totalCost < candidate.totalCost || other.minimumLiquidity > candidate.minimumLiquidity || other.durationMonths < candidate.durationMonths)));
  }

  function constraintIssues(strategy = {}, simulation = {}) {
    const issues = [];
    const kind = strategyKind(strategy);
    const maturity = monthKey(strategy.maturityMonth);
    const lastPayment = simulation.payments?.at(-1)?.monthKey || "";
    if (maturity && kind !== "refinancing" && lastPayment && lastPayment > maturity) issues.push("maturity-exceeded");
    if (number(strategy.arrears) > 0 && kind === "hold") issues.push("arrears-unresolved");
    if (text(strategy.paymentStatus).toLocaleLowerCase("es") === "suspended" && kind === "hold") issues.push("suspended-debt-unresolved");
    return issues;
  }

  function optimize(input = {}) {
    const reserve = Math.max(0, round2(input.reserve));
    const strategies = Array.isArray(input.strategies) ? input.strategies : [];
    const candidates = strategies.map((strategy, index) => {
      const simulation = simulateStrategy(strategy, input.forecast);
      const reserveMargin = round2(simulation.minimumLiquidity - reserve);
      const constraints = constraintIssues(strategy, simulation);
      return { id: text(strategy.id || `strategy-${index + 1}`), strategy: clone(strategy), ...simulation,
        reserve, reserveMargin, reserveSafe: reserveMargin >= 0, constraintIssues: constraints,
        eligible: reserveMargin >= 0 && constraints.length === 0 };
    });
    const frontier = pareto(candidates.filter((item) => item.eligible));
    const recommended = frontier.slice().sort((left, right) => right.minimumLiquidity - left.minimumLiquidity || left.totalCost - right.totalCost || left.durationMonths - right.durationMonths)[0] || null;
    return { schemaId: `${SCHEMA_ID}/optimizer/v1`, reserve, candidates, frontierIds: frontier.map((item) => item.id), recommendedId: recommended?.id || "",
      reason: recommended ? "Alternativa no dominada que respeta colchón, vencimiento y estado de la deuda; la caja ya incluye proyectos del forecast." : "Ninguna alternativa respeta simultáneamente el colchón, vencimiento y estado de la deuda." };
  }

  function prepareApplication(input = {}) {
    const offer = normalizeOffer(input.offer, input.contract);
    const strategy = clone(input.strategy || {});
    const missingDocuments = REQUIRED_DOCUMENTS.filter((document) => !offer.documents.includes(document));
    // Una cifra inusual es una advertencia para revisar, no un bloqueo de una
    // operación que ya cuenta con documentación y confirmación explícita.
    const issues = offer.issues.filter((issue) => issue !== "amount-unusual");
    if (offer.status !== "accepted") issues.push("offer-not-accepted");
    if (missingDocuments.length) issues.push("missing-documents");
    if (!text(input.reason)) issues.push("missing-reason");
    if (input.simulation?.reserveSafe === false) issues.push("reserve-broken");
    return {
      schemaId: APPLICATION_SCHEMA_ID, version: 1, offer, strategy, reason: text(input.reason),
      missingDocuments, valid: issues.length === 0, issues: [...new Set(issues)],
    };
  }

  return { SCHEMA_ID, OFFER_SCHEMA_ID, APPLICATION_SCHEMA_ID, REQUIRED_DOCUMENTS, normalizeOffer, paymentSchedule, simulateStrategy, simulatePortfolio, toScenarioEvents, optimize, prepareApplication };
});
