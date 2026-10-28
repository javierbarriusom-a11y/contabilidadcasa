// WP-17 · PR-1 (NIN-01) «Siguiente paso de la cartera»: arriba de Inversión › Cartera, la cartera en una línea y UNA acción elegida por
// reglas fijas, con su motivo y la regla que la origina; el resto, plegado. Las reglas viven en canonical-next-best-action.js (puro); aquí
// solo se reúnen los hechos con los motores de siempre: frescura (WP-15), política (WP-39), reparto (IV6), compensación (FC3),
// candidatas (INV6) y convicción (I12).
// Nace apagada en Funciones en prueba (XGO-03). No opera ni cambia ningún dato: dice qué toca y lleva a la pantalla donde se hace.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, money, iv1PositionsList, iv2Pct,
// iv2XirrLabel, iv6PortfolioTargets, fc3PriorLossesList, politicaLoad, politicaPortfolio, openValoracionHoja…). Sin llamadas al DOM al
// cargarse: views/inversion.js llama a `renderSiguientePaso` al pintar Inversión › Cartera, que engancha la escucha la primera vez.

function siguientePasoOn() {
  return globalThis.FinanceFuncionesEnPrueba?.encendida?.("siguiente-paso") === true;
}

function siguientePasoPolitica(policyEngine, portfolio, summary, today) {
  if (!policyEngine || typeof politicaLoad !== "function") return { policy: { state: "none" }, drift: null };
  const raw = politicaLoad();
  const state = policyEngine.signatureState(raw);
  const rules = policyEngine.rules(raw);
  const ruleN = (id) => rules.find((rule) => rule.id === id)?.n || null;
  const policy = { state, review: policyEngine.reviewStatus(raw, { today }), reviewN: ruleN("review"), breaches: [] };
  if (state !== "signed") return { policy, drift: null };
  const loanAmount = typeof politicaPortfolio === "function" ? politicaPortfolio().loanAmount : 0;
  const assessment = policyEngine.assessPortfolio({ policy: raw, totalsByType: summary.totalsByType, totalValue: summary.totalValue, loanAmount });
  policy.breaches = assessment.items.filter((item) => item.ruleId !== "allocation");
  const { targets, bandPct, rebalanceByContributions } = policyEngine.normalizePolicy(raw).allocation;
  const drift = Object.keys(targets).length
    ? { source: "politica", bandPct, byContributions: rebalanceByContributions, n: ruleN("allocation"), rows: portfolio.rebalanceSuggestions(summary.totalsByType, summary.totalValue, targets, bandPct) }
    : null;
  return { policy, drift };
}

// Los hechos que lee el motor, calculados con los motores de siempre. Sin posiciones, ninguno.
function siguientePasoFacts(today) {
  const portfolio = globalThis.FinanceCanonicalPortfolio;
  const valuation = globalThis.FinanceCanonicalPortfolioValuation;
  const rows = typeof iv1PositionsList === "function" ? iv1PositionsList() : [];
  if (!portfolio || !rows.length) return { facts: { positions: 0 }, summary: null };
  const { positions, summary } = portfolio.normalizePositions(rows);
  const { policy, drift: policyDrift } = siguientePasoPolitica(globalThis.FinanceCanonicalInvestmentPolicy, portfolio, summary, today);
  let drift = policyDrift;
  const targets = typeof iv6PortfolioTargets === "function" ? iv6PortfolioTargets() : {};
  if (!drift && Object.keys(targets).length) {
    drift = { source: "reparto", bandPct: 10, byContributions: false, rows: portfolio.rebalanceSuggestions(summary.totalsByType, summary.totalValue, targets) };
  }
  const compensation = portfolio.yearEndCompensation({ positions, year: today.slice(0, 4), priorLosses: typeof fc3PriorLossesList === "function" ? fc3PriorLossesList() : [] });
  const fiscal = compensation.calculable
    ? { year: compensation.year, marginalSaleBase: compensation.marginalSaleBase, candidates: portfolio.latentLossHarvestingCandidates(positions).candidates }
    : null;
  const convictions = positions
    .filter((position) => position.convictionScore !== null && position.convictionScore !== undefined)
    .map((position) => ({ position, status: portfolio.rebalanceCalendarReviewStatus({ lastReviewedAt: position.convictionReviewedAt || "", intervalMonths: 12 }) }))
    .filter(({ status }) => status?.due)
    .map(({ position, status }) => ({ label: position.label, neverReviewed: !status.reviewed, monthsSinceReview: status.monthsSinceReview }));
  const stale = valuation ? positions.filter((position) => valuation.freshness(position, today).stale).map((position) => position.label) : [];
  return {
    facts: { today, positions: positions.length, staleDays: valuation?.STALE_DAYS || 35, stale, policy, drift, fiscal, convictions },
    summary,
  };
}

function siguientePasoResumenHtml(summary) {
  const gain = Number(summary.gainLoss) || 0;
  const gainPct = Number.isFinite(Number(summary.gainLossPct)) ? Number(summary.gainLossPct) : null;
  const parts = [
    `<strong>${escapeHtml(money(summary.totalValue, true))}</strong> de valor`,
    `${escapeHtml(money(summary.totalCost, true))} aportados`,
    `<span class="${gain >= 0 ? "positive" : "negative"}">${escapeHtml(money(gain, true))}${gainPct === null ? "" : ` (${escapeHtml(iv2Pct(gainPct, true))})`}</span>`,
    escapeHtml(iv2XirrLabel(summary.xirr)),
  ];
  return `<p class="sp-resumen">${parts.join(" · ")}</p>`;
}

function siguientePasoCtaHtml(action) {
  const cta = action.cta || {};
  if (cta.kind === "valorar") return `<button type="button" class="e19-btn e19-btn-primary" data-siguiente-paso-accion="valorar">${escapeHtml(cta.label)}</button>`;
  return `<a class="e19-btn e19-btn-secondary" href="${escapeHtml(cta.href || "#inversion-cartera")}" data-siguiente-paso-accion="${escapeHtml(action.id)}">${escapeHtml(cta.label)}</a>`;
}

function siguientePasoHtml(result, summary) {
  const resumen = summary ? siguientePasoResumenHtml(summary) : "";
  if (!result.primary) {
    return `${resumen}<div class="sp-accion sp-nada"><p class="sp-titulo">Nada pendiente en la cartera</p><p class="e19-kpi-note">Se ha mirado: ${escapeHtml(result.checked.join(", "))}. No significa que la cartera esté bien, solo que ninguna de estas reglas pide nada hoy.</p></div>`;
  }
  const action = result.primary;
  const otras = result.others.length
    ? `<details class="sp-otras"><summary>${result.others.length === 1 ? "Otra cosa pendiente" : `Otras ${result.others.length} cosas pendientes`}</summary><ol>${result.others.map((item) => `<li><strong>${escapeHtml(item.title)}</strong> <span class="e19-kpi-note">${escapeHtml(item.reason)}</span> ${siguientePasoCtaHtml(item)}</li>`).join("")}</ol></details>`
    : "";
  return `${resumen}
    <div class="sp-accion">
      <p class="sp-eyebrow">Siguiente paso</p>
      <p class="sp-titulo">${escapeHtml(action.title)}</p>
      <p class="e19-kpi-note">${escapeHtml(action.reason)}</p>
      ${action.rule ? `<p class="sp-regla">${escapeHtml(action.rule)}</p>` : ""}
      <div class="data-actions">${siguientePasoCtaHtml(action)}</div>
    </div>
    ${otras}
    <p class="e19-kpi-note">El orden es fijo: valorar, lo que choca con la política, el reparto, la fiscalidad antes del 31/12, la política y la convicción. La app no compra ni vende nada.</p>`;
}

function renderSiguientePaso(engine = globalThis.FinanceCanonicalNextBestAction) {
  const card = qs("siguientePasoCard");
  if (!card) return;
  attachSiguientePaso(card);
  if (!engine || !siguientePasoOn()) {
    card.hidden = true;
    return;
  }
  try {
    const today = isoLocalDate(new Date());
    const { facts, summary } = siguientePasoFacts(today);
    const result = engine.nextBestActions(facts);
    if (!result.calculable) {
      card.hidden = true;
      return;
    }
    qs("siguientePasoCuerpo").innerHTML = siguientePasoHtml(result, summary);
    card.hidden = false;
    globalThis.FinanceMedidor?.anotar("siguiente-paso", "vista"); // XGO-02: un día visto cuenta una vez
  } catch (error) {
    console.error(`renderSiguientePaso: ${error.message}`);
    card.hidden = true;
  }
}

function attachSiguientePaso(card) {
  if (card.__siguientePasoAttached) return;
  card.__siguientePasoAttached = true;
  card.addEventListener("click", (event) => {
    const target = event.target.closest("[data-siguiente-paso-accion]");
    if (!target) return;
    globalThis.FinanceMedidor?.anotar("siguiente-paso", "accion"); // XGO-02: seguir la acción propuesta
    if (target.dataset.siguientePasoAccion === "valorar" && typeof openValoracionHoja === "function") openValoracionHoja();
  });
}
