// T14 (octavo incremento, sesión 207): pantalla "Asesor · decisión abierta" (`#asesor-decision`),
// extraída de app.js con el mismo patrón `views/*.js`. Bloque contiguo y de una sola función, el
// más pequeño de los ocho incrementos.
//
// Lo que NO se movió, y por qué: `asesorDecisionOpenOffers()` y `asesorDecisionFundingHtml()` —
// aunque están definidas justo antes de `renderAsesorDecision` en app.js y a primera vista
// parecían parte del mismo bloque — se quedan en app.js porque tienen consumidores eager fuera de
// esta pantalla:
//   - `asesorDecisionOpenOffers()` la llama `renderHomeDashboard()` sin ninguna guarda de vista
//     (construye la lista de decisiones de Hoy con la primera oferta abierta, V1-2).
//   - Ambas las reutiliza `renderDeudaRuta()`, ya vive en `views/deuda.js` (primer incremento de
//     T14) — la tarjeta "oferta en curso" de Deuda · Ruta (V3-4) llama a las dos tal cual, sin
//     recalcular nada.
// Si cualquiera de las dos viviera aquí, la primera vez que se disparara desde Hoy o desde Deuda
// sin haber visitado antes `#asesor-decision` lanzaría un `ReferenceError` (la lección del séptimo
// incremento con `handleAddDebtLiquidation`).
//
// Lo que sí se movió: solo `renderAsesorDecision`, que no tiene ningún llamador fuera de su propio
// `case "asesor-decision"` en `renderActiveSection` — mismo patrón ya validado en los siete
// incrementos anteriores.
function renderAsesorDecision() {
  const offers = asesorDecisionOpenOffers();
  const emptyEl = qs("asesorDecisionEmpty");
  const contentEl = qs("asesorDecisionContent");
  if (!offers.length || !E14DebtOperations) {
    if (emptyEl) emptyEl.hidden = false;
    if (contentEl) contentEl.hidden = true;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;
  if (contentEl) contentEl.hidden = false;

  const offer = offers[0];
  const contract = debtTargetById(offer.contractId, { includePlanned: true });
  const forecast = e14bForecast();
  const strategy = e14bStrategyForOffer(offer);
  const simulation = forecast?.valid && strategy ? E14DebtOperations.simulateStrategy(strategy, forecast) : null;
  const reserve = agentCaixaFloor();

  const deadline = qs("asesorDecisionDeadline");
  if (deadline) {
    const expiry = debtOfferExpiryStatus(offer.expiresAt);
    deadline.textContent = !offer.expiresAt
      ? "Decisión abierta · sin vencimiento indicado"
      : expiry.expired
        ? `Decisión abierta · CADUCADA desde ${escenarioMotorMonthLabel(offer.expiresAt)}`
        : expiry.dueSoon
          ? `Decisión abierta · vence ${escenarioMotorMonthLabel(offer.expiresAt)}, a punto de caducar`
          : `Decisión abierta · vence ${escenarioMotorMonthLabel(offer.expiresAt)}`;
    deadline.className = `e19-badge ${expiry.status === "danger" ? "e19-badge-danger" : "e19-badge-neutral"}`;
  }
  const titleEl = qs("asesorDecisionTitle");
  if (titleEl) titleEl.textContent = `Pagar la oferta de ${offer.counterpart || "sin contraparte"}${contract ? ` · ${contract.entity}${contract.type ? ` ${contract.type}` : ""}` : ""}`;
  const amountEl = qs("asesorDecisionAmount");
  if (amountEl) amountEl.textContent = money(offer.amount, true);

  const statsEl = qs("asesorDecisionStats");
  if (statsEl) {
    statsEl.innerHTML = [
      ["Ahorras", money(offer.discount, true)],
      ["Cuota liberada", `${money(contract?.payment ?? 0, true)}/mes`],
      ["Caja mínima tras pagar", simulation ? money(simulation.minimumLiquidity, true) : "Sin forecast"],
    ]
      .map(([label, value]) => `<div class="asesor-decision-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
      .join("");
  }

  const fundingEl = qs("asesorDecisionFunding");
  if (fundingEl) fundingEl.innerHTML = asesorDecisionFundingHtml(offer.amount);

  const applyLink = qs("asesorDecisionApply");
  if (applyLink) {
    applyLink.onclick = () => {
      e14bWorkspace().selectedOfferId = offer.id;
      queueRemoteSave();
    };
  }

  const limitsEl = qs("asesorDecisionLimits");
  if (limitsEl) {
    const p2Input = window.FinanceP2Bridge?.e16Input?.() || {};
    const maxDebtRatio = Number(p2Input.riskBudget?.maximumDebtRatio || 0);
    const debtRatio = Number(p2Input.debtRatio || 0);
    const next12 = lastSimulation.slice(0, Math.min(12, lastSimulation.length));
    const monthlyOutflow = next12.length ? next12.reduce((sum, row) => sum + row.coreSpend + row.car + row.refi, 0) / next12.length : 0;
    const bufferMonths = safeCoverageMonths(state.initialCash, monthlyOutflow);
    const bufferTarget = Number(state.emergencyBufferMonths || 0);
    const cajaOk = simulation ? simulation.minimumLiquidity >= reserve : null;
    const items = [
      { ok: cajaOk, label: `Reserva CaixaBank ${money(reserve, true)} mín.${simulation ? ` · queda en ${money(simulation.minimumLiquidity, true)}` : ""}` },
      { ok: bufferMonths === null ? null : bufferMonths >= bufferTarget, label: `Colchón ${bufferTarget} mes(es) obj. · ahora ${coverageMonthsText(bufferMonths)}` },
      { ok: maxDebtRatio ? debtRatio <= maxDebtRatio : null, label: maxDebtRatio ? `Deuda/ingresos ${maxDebtRatio}% máx. · ahora ${debtRatio}%` : `Deuda/ingresos ahora ${debtRatio}% (sin límite configurado en Presupuesto de riesgo)` },
    ];
    limitsEl.innerHTML = items.map((item) => `<li class="deuda-ruta-check${item.ok === false ? " is-danger" : item.ok ? " is-ok" : ""}">${escapeHtml(item.label)}</li>`).join("");
  }

  const queueEl = qs("asesorDecisionQueue");
  if (queueEl) {
    const rest = offers.slice(1);
    queueEl.innerHTML = rest.length
      ? rest
          .map(
            (item) => `<div class="conciliar-history-row"><span>${escapeHtml(item.counterpart || "Sin contraparte")}</span><strong>${money(item.amount, true)}${item.expiresAt ? ` · vence ${escapeHtml(escenarioMotorMonthLabel(item.expiresAt))}` : ""}</strong></div>`
          )
          .join("")
      : `<p class="e19-kpi-note">Sin más ofertas abiertas ahora mismo.</p>`;
  }

  const dataEl = qs("asesorDecisionData");
  if (dataEl) {
    const snapshot = window.FinanceCanonicalLedger ? refreshCanonicalLedger("asesor-decision-view") : null;
    const coverage = snapshot?.quality?.coverage;
    const items = [
      "Saldos: hoy, cuenta corriente + ahorro",
      Number.isFinite(coverage) ? `Conciliación: ${coverage}% de movimientos clasificados` : "Conciliación: sin datos de extracto",
      `Forecast: ${forecast?.valid ? "disponible" : "no disponible todavía"}`,
    ];
    dataEl.innerHTML = items.map((text) => `<li class="deuda-ruta-check">${escapeHtml(text)}</li>`).join("");
  }
}
