// Registrar › Saldo de cuentas: «Pulso de saldos» (WP-26 · ND-01, canonical-balance-pulse.js). Script clásico cargado
// antes de app.js (comparte su ámbito global: qs, state, render, money…), fuera de app.js por su techo de líneas
// (ARQ-4). La lógica vive en el motor puro; aquí solo se pinta, se responde a «Coincide»/«Corregir» y se mide el tiempo.
//
// «Saldos al día» y la fecha de hoy llegan cuando las dos cuentas tienen respuesta. Un «Corregir» es el mismo campo de
// siempre: guarda al salir y, como desde R-3, ya fecha hoy los saldos (es el dato más reciente que hay); por eso el pulso
// dice qué cuenta falta por confirmar en vez de dar los saldos por mirados. No se cambia esa fecha a mano hacia atrás:
// la previsión colocaría el saldo recién escrito en un día pasado.

const BALANCE_PULSE_TIMES_KEY = "balance-pulse-times"; // solo este móvil, como el panel de uso: segundos, ni importes
let balancePulse = { answers: {}, startedAt: 0, status: "" };

// Tiempos del pulso, en este navegador: el «Hecho cuando» de WP-26 (actualizar las cuentas en ≤ 20 s).
function readBalancePulseTimes() {
  try {
    return window.FinanceCanonicalBalancePulse.normalizeTimings(JSON.parse(window.localStorage.getItem(BALANCE_PULSE_TIMES_KEY) || "null"));
  } catch {
    return { times: [] };
  }
}

function writeBalancePulseTimes(store) {
  try {
    window.localStorage.setItem(BALANCE_PULSE_TIMES_KEY, JSON.stringify(store));
  } catch {
    /* sin almacenamiento: no se mide, la app sigue igual */
  }
}

window.FinanceBalancePulseUi = { summary: () => window.FinanceCanonicalBalancePulse?.summarizeTimings(readBalancePulseTimes()) || null };

function balancePulseModel() {
  return window.FinanceCanonicalBalancePulse.buildModel({ accounts: balancePulseAccounts(), answers: balancePulse.answers, mode: state?.balanceMode, today: isoLocalDate(new Date()) });
}

function renderBalancePulse() {
  const engine = window.FinanceCanonicalBalancePulse;
  const target = qs("pulsoSaldos");
  // Solo con la pestaña a la vista: render() pasa por aquí muchas veces y el extracto puede tener miles de filas.
  if (!engine || !target || !state || target.closest("[hidden]")) return;
  const model = balancePulseModel();
  // El reloj arranca la primera vez que se ve el pulso con algo por responder en esta visita a Saldos, y se para al salir.
  if (registrarActiveTab !== "balances") balancePulse.startedAt = 0;
  else if (!balancePulse.startedAt && model.mode === "manual" && !model.complete) balancePulse.startedAt = performance.now();
  // Con separador de miles («5.610,00 €»), como el campo de importe de WP-11; money() no lo pone en 4 cifras.
  const html = engine.renderHtml(model, { money: (value) => `${formatAmountField(value)} €`, status: balancePulse.status });
  if (target.innerHTML !== html) target.innerHTML = html;
}

// Con las dos respuestas: «Coincide» toma lo último que se sabía (puede ser el saldo del extracto), los saldos pasan a
// fecha de hoy y se puede deshacer durante 8 s, como pide ND-01.
function completeBalancePulse(model) {
  const engine = window.FinanceCanonicalBalancePulse;
  const before = { balances: accountBalancesFromState(), date: state.balanceDate };
  const next = engine.resultingBalances(model, { caixa: before.balances.caixa, mediolanum: before.balances.mediolanum });
  const seconds = balancePulse.startedAt ? (performance.now() - balancePulse.startedAt) / 1000 : 0;
  const counts = { coincided: model.items.filter((item) => item.answer === "coincide").length, corrected: model.items.filter((item) => item.answer === "corregido").length };
  // Más de 10 minutos no es actualizar los saldos: es dejar la pantalla abierta. No se mide.
  if (seconds > 0 && seconds <= 600) writeBalancePulseTimes(engine.recordTiming(readBalancePulseTimes(), { date: isoLocalDate(new Date()), seconds, ...counts }));
  setBalancePulseState(next, isoLocalDate(new Date()));
  const time = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  balancePulse = { answers: {}, startedAt: 0, status: `Saldos al día · hoy ${time}.` };
  renderBalancePulse();
  showUndoToast("Saldos al día.", () => {
    setBalancePulseState({ caixa: before.balances.caixa, mediolanum: before.balances.mediolanum }, before.date);
    balancePulse.status = "Deshecho: los saldos vuelven a como estaban.";
    renderBalancePulse();
  }, 8000);
}

function setBalancePulseState(balances, date) {
  state.balanceMode = "manual";
  state.balanceDate = date;
  ["balanceDate", "registrarBalanceDate", "visualBalanceDate"].forEach((id) => { if (qs(id)) qs(id).value = date; });
  setStateAccountBalances(balances);
  renderAccountBalancePanels();
  saveBalanceSettings();
  render();
}

function answerBalancePulse(accountId, answer) {
  balancePulse.answers = { ...balancePulse.answers, [accountId]: answer };
  balancePulse.status = "";
  const model = balancePulseModel();
  if (model.complete) completeBalancePulse(model);
  else renderBalancePulse();
}

function handleBalancePulseClick(event) {
  const coincide = event.target.closest("[data-pulso-coincide]");
  const corregir = event.target.closest("[data-pulso-corregir]");
  if (coincide) answerBalancePulse(coincide.dataset.pulsoCoincide, "coincide");
  else if (corregir) {
    const account = window.FinanceCanonicalBalancePulse.ACCOUNTS.find((item) => item.id === corregir.dataset.pulsoCorregir);
    const input = account && qs(account.inputId);
    if (input) {
      input.focus();
      input.select?.();
    }
  } else if (event.target.closest("[data-pulso-manual]")) {
    qs("registrarBalanceMode").value = "manual";
    qs("registrarBalanceMode").dispatchEvent(new Event("change", { bubbles: true }));
    renderBalancePulse();
  }
}

// Escribir un saldo y salir del campo es «Corregir» (aunque no se pulsara el botón). Un texto que no es un importe no
// se guarda (WP-11) y tampoco cuenta como respuesta.
function handleBalancePulseCorrection(event) {
  const account = window.FinanceCanonicalBalancePulse?.ACCOUNTS.find((item) => item.inputId === event.target.id);
  if (!account || parseAmountField(event.target.value) === null) return;
  answerBalancePulse(account.id, "corregido");
}

// WP-26 · ND-02: el paso 4 de «Importar extracto» ofrece (marcado) usar el saldo final del extracto como saldo declarado
// de su cuenta y dice si al fichero le faltan movimientos. Se aplica dentro del mismo lote de la importación, así que
// «Deshacer último lote» también devuelve el saldo y su fecha.
function datosImportarBalanceOffer(session) {
  const declared = accountBalancesFromState();
  const account = window.FinanceCanonicalBalancePulse?.ACCOUNTS.find((item) => item.importLabel === session?.fileMeta?.bankAccount);
  return window.FinanceCanonicalBalancePulse?.statementOffer({
    rows: datosImportarIncludedTransactions(session?.rows || []),
    accountLabel: session?.fileMeta?.bankAccount || "",
    declared: { value: account ? declared[account.id] : null, date: state?.balanceMode === "manual" ? state.balanceDate : "" },
  }) || null;
}

function datosImportarBalanceOfferHtml(session) {
  const offer = datosImportarBalanceOffer(session);
  return offer ? window.FinanceCanonicalBalancePulse.renderOfferHtml(offer, { money: (value) => `${formatAmountField(value)} €`, checked: session.balanceOffer !== false }) : "";
}

function wireDatosImportarBalanceOffer(session) {
  qs("datosImportarSaldoOferta")?.addEventListener("change", (event) => {
    session.balanceOffer = event.target.checked;
    datosImportarPersistDraft();
  });
}

// Devuelve lo aplicado (para el resumen) o null. La fecha de los saldos es una para las dos cuentas: pasa a la del
// extracto, que nunca es más antigua que la declarada (si lo fuera, no se ofrece).
function applyDatosImportarBalanceOffer(session) {
  const offer = datosImportarBalanceOffer(session);
  if (offer?.status !== "ofrecer" || session.balanceOffer === false) return null;
  const balances = accountBalancesFromState();
  state.balanceMode = "manual";
  state.balanceDate = offer.date;
  ["balanceDate", "registrarBalanceDate", "visualBalanceDate"].forEach((id) => { if (qs(id)) qs(id).value = offer.date; });
  ["balanceMode", "registrarBalanceMode", "visualBalanceMode"].forEach((id) => { if (qs(id)) qs(id).value = "manual"; });
  setStateAccountBalances({ caixa: balances.caixa, mediolanum: balances.mediolanum, [offer.account]: offer.value });
  saveBalanceSettings();
  return { account: offer.accountLabel, value: offer.value, date: offer.date, gaps: offer.continuity.gaps.length };
}

// ---------------------------------------------------------------------------------------------------------------
// Desalojado de app.js (XGO-01 · PR-1, sesión 329, 20/10/2026), sin cambiar una coma: Registrar (saldos, reales del mes, «Registrar mes», datos manuales, carga por lotes y por Excel, recibos).
// Siguen siendo funciones globales del mismo ámbito que app.js; este fichero se carga antes que él, así que ya
// existen cuando app.js arranca. Solo declaraciones de función: nada se ejecuta al cargar.

function saveEfectivoBalance(value) {
  const amount = round2(Number(value) || 0);
  if (efectivoBalanceValue() === amount) return;
  balanceSettings = { ...balanceSettings, efectivoBalance: amount };
  storageSet(storageKey("balanceSettings"), JSON.stringify(balanceSettings));
  queueRemoteSave();
}

function handleRegistrarEfectivoBalanceInput() {
  const input = qs("registrarEfectivoBalance");
  if (!input) return;
  const amount = parseAmountField(input.value);
  if (amount === null && input.value.trim()) return; // texto que no es un importe: no se guarda (el campo lo marca)
  saveEfectivoBalance(amount ?? 0);
  renderAccountBalancePanels();
}

function registrarTabFromHash() {
  let id = (window.location.hash || "#home").replace("#", "").split("?")[0];
  if (id === "monthly-detail") id = "update-data";
  return REGISTRAR_LEGACY_HASH_TABS[id] || null;
}

function normalizeProjectMode(value) {
  const text = normalizedText(value);
  return text.includes("opt") ? "optimize" : "fixed";
}

function normalizeDebtPayoffMode(value, duration = 1) {
  const text = normalizedText(value);
  if (text.includes("retomar")) return "retomar";
  if (text.includes("refinanc") || text.includes("reunific")) return "refinance";
  if (text.includes("fraccion") || text.includes("repart") || text.includes("varios") || text.includes("mensual") || Number(duration) > 1) return "spread";
  return "fixed";
}

function workbookSheet(workbook, candidates) {
  const names = workbook.SheetNames || [];
  return names.find((name) => candidates.some((candidate) => normalizedText(name) === normalizedText(candidate))) || null;
}

function cellValue(sheet, address, fallback = null) {
  const cell = sheet?.[address];
  return cell ? (cell.v ?? fallback) : fallback;
}

function numberCell(sheet, address, fallback = 0) {
  const value = cellValue(sheet, address, fallback);
  const number = parseAmount(value);
  return number ?? fallback;
}

function dateCell(sheet, address) {
  return isoFromWorkbookValue(cellValue(sheet, address));
}

function monthKeyFromWorkbookValue(value) {
  const iso = isoFromWorkbookValue(value);
  return iso?.match(/^\d{4}-\d{2}/)?.[0] || null;
}

function loadMonthlyPlanningFromWorkbook(workbook) {
  const sheetName = workbookSheet(workbook, ["Contabilidad New Life", "Contabilidad New Life (2)"]);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("No encuentro la pestaña Contabilidad New Life.");
  const range = window.XLSX.utils.decode_range(sheet["!ref"]);
  const months = [];
  const columns = [];

  for (let col = 2; col <= range.e.c; col += 1) {
    const key = monthKeyFromWorkbookValue(cellByIndex(sheet, 4, col));
    if (!key) continue;
    months.push({ key, label: monthLabel(dateFromMonthKey(key)) });
    columns.push(col);
  }

  const sectionDefs = [
    ["Ingresos", "INGRESOS", "income"],
    ["Gastos fijos", "GASTOS FIJOS", "expense"],
    ["Suscripciones", "SUSCRIPCIONES", "expense"],
    ["Financiaciones", "FINANCIACIONES", "expense"],
    ["Imprevistos / otros", "IMPREVISTOS", "expense"],
  ];

  const sections = sectionDefs
    .map(([sectionName, marker, kind]) => {
      let startRow = -1;
      let endRow = -1;
      for (let row = 0; row <= range.e.r; row += 1) {
        const label = cellByIndex(sheet, row, 1);
        if (typeof label === "string" && label.toUpperCase().includes(marker)) {
          startRow = row + 1;
          break;
        }
      }
      if (startRow < 0) return null;
      for (let row = startRow; row <= range.e.r; row += 1) {
        const label = cellByIndex(sheet, row, 1);
        if (typeof label === "string" && label.trim().toUpperCase() === "TOTAL") {
          endRow = row - 1;
          break;
        }
      }
      if (endRow < startRow) return null;
      const totalRow = endRow + 1;
      const financingSubgroups = new Set(FINANCING_SUBGROUP_LABELS.map((item) => normalizedText(item)));
      const rows = [];
      let currentGroup = "";
      for (let row = startRow; row <= endRow; row += 1) {
        const label = cellByIndex(sheet, row, 1);
        if (label === null || label === undefined || label === "") continue;
        const labelText = String(label).trim().replace(/\s+/g, " ");
        const planned = columns.map((col) => Math.abs(parseAmount(cellByIndex(sheet, row, col)) ?? 0));
        const hasValue = planned.some(Boolean);
        if (sectionName === "Financiaciones" && financingSubgroups.has(normalizedText(labelText)) && !hasValue) {
          currentGroup = labelText;
          continue;
        }
        if (!hasValue && sectionName !== "Financiaciones") continue;
        const displayLabel = sectionName === "Financiaciones" && currentGroup ? `${currentGroup} · ${labelText}` : labelText;
        rows.push({
          id: `${sectionName.toLowerCase().replaceAll(" ", "-")}-${row + 1}`,
          label: displayLabel,
          row: row + 1,
          kind,
          group: currentGroup || null,
          planned,
        });
      }
      if (!rows.length) return null;
      return {
        name: sectionName,
        kind,
        rows,
        totals: columns.map((col, index) => {
          const totalValue = parseAmount(cellByIndex(sheet, totalRow, col));
          return round2(totalValue !== null ? Math.abs(totalValue) : rows.reduce((sum, row) => sum + Number(row.planned[index] || 0), 0));
        }),
      };
    })
    .filter(Boolean);

  return { months, sections };
}

function buildFinanceDataFromWorkbook(workbook, fileName) {
  const planSheet = workbook.Sheets[workbookSheet(workbook, ["Plan_Ahorro_821"])];
  const lifeSheet = workbook.Sheets[workbookSheet(workbook, ["Contabilidad New Life", "Contabilidad New Life (2)"])];
  const refundSheet = workbook.Sheets[workbookSheet(workbook, ["Importe devolucion recibos", "Importe devolución recibos"])];
  if (!planSheet || !lifeSheet) throw new Error("El libro no contiene Plan_Ahorro_821 y Contabilidad New Life.");

  const monthlyPlanning = loadMonthlyPlanningFromWorkbook(workbook);
  const sourcePlan = {
    baseHouseholdIncome: numberCell(planSheet, "B5"),
    incomeWithExtrasProrated: numberCell(planSheet, "F5"),
    extraApril: numberCell(planSheet, "B6"),
    extraDecember: numberCell(planSheet, "B7"),
    mortgagePayment: numberCell(planSheet, "B8"),
    bmwPayment: numberCell(planSheet, "B9"),
    unifiedCreditPayment: numberCell(planSheet, "B10"),
    otherFixedNonDebt: numberCell(planSheet, "B11"),
    variableSpendTarget: numberCell(planSheet, "B12"),
    initialEmergencyFund: numberCell(planSheet, "B13"),
    emergencyBufferMonths: numberCell(planSheet, "B14", 6),
    debtServiceMonthlyTotal: numberCell(planSheet, "F6"),
    debtToIncomeRatio: numberCell(planSheet, "F7"),
    totalSpendTarget: numberCell(planSheet, "F8"),
    monthlySavingPotential: numberCell(planSheet, "F9"),
    savingsRate: numberCell(planSheet, "F10"),
    emergencyFundTarget: numberCell(planSheet, "F11"),
    emergencyFundGap: numberCell(planSheet, "F12"),
    recommendedSaving: numberCell(planSheet, "F16", baseData.assumptions.recommendedSavings),
    suggestedAmortization: numberCell(planSheet, "F17"),
    bankinterOutsidePlanPayment: numberCell(planSheet, "B18"),
    cetelemOutsidePlanPayment: numberCell(planSheet, "B19"),
    carEndDate: dateCell(planSheet, "F18"),
    bankinterEndDate: dateCell(planSheet, "H18"),
    cetelemEndDate: dateCell(planSheet, "F19"),
    monthWithoutBmwCetelem: dateCell(planSheet, "H19"),
    oldDebtPrincipal: refundSheet ? numberCell(refundSheet, "K16") : 0,
    oldDebtMonthlyPayments: refundSheet ? numberCell(refundSheet, "L16") : 0,
  };
  const sourceBalances = {
    valuationDate: dateCell(lifeSheet, "C1") || defaultBalanceDate(),
    caixaBalance: numberCell(lifeSheet, "C3"),
    mediolanumBalance: numberCell(lifeSheet, "D3"),
    totalBalance: numberCell(lifeSheet, "E3"),
  };
  const transactions = loadTransactionsFromWorkbook(workbook);
  const rollups = buildRollupsFromTransactions(transactions);
  const baseSpendWithMortgage = sourcePlan.otherFixedNonDebt + sourcePlan.variableSpendTarget + sourcePlan.mortgagePayment;
  const assumptions = {
    ...baseData.assumptions,
    initialCash: round2(sourceBalances.totalBalance || sourceBalances.caixaBalance + sourceBalances.mediolanumBalance),
    caixaBalanceBeforeCar: round2(sourceBalances.caixaBalance),
    newAccountBalance: round2(sourceBalances.mediolanumBalance),
    currentCarAdjustment: 0,
    monthlyIncome: round2(sourcePlan.incomeWithExtrasProrated),
    baseHouseholdIncome: round2(sourcePlan.baseHouseholdIncome),
    coreSpend: round2(baseSpendWithMortgage),
    otherFixedNonDebt: round2(sourcePlan.otherFixedNonDebt),
    variableSpendTarget: round2(sourcePlan.variableSpendTarget),
    mortgagePayment: round2(sourcePlan.mortgagePayment),
    carPayment: round2(sourcePlan.bmwPayment),
    carEndDate: sourcePlan.carEndDate,
    refiFirstPayment: round2(sourcePlan.unifiedCreditPayment),
    remainingHighRefiPayments: 1,
    extraDebts: [
      { name: "Bankinter fuera del plan", payment: round2(sourcePlan.bankinterOutsidePlanPayment), endDate: sourcePlan.bankinterEndDate },
      { name: "Cetelem fuera del plan", payment: round2(sourcePlan.cetelemOutsidePlanPayment), endDate: sourcePlan.cetelemEndDate },
    ],
    recommendedSavings: round2(sourcePlan.recommendedSaving),
    emergencyBufferMonths: round2(sourcePlan.emergencyBufferMonths),
    annualInflation: 0,
    annualIncomeGrowth: 0,
  };
  const monthlySurplus = assumptions.monthlyIncome - assumptions.coreSpend - assumptions.carPayment - assumptions.refiFirstPayment - assumptions.extraDebts.reduce((sum, item) => sum + item.payment, 0);
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceWorkbook: fileName,
      sourceWorkbookStatus: "Leído desde la app",
      forecastStart: `${monthlyPlanning.months[0]?.key || "2026-05"}-01`,
      forecastMonths: 60,
      currency: "EUR",
    },
    assumptions,
    sourcePlan,
    sourceBalances,
    monthlyPlanning,
    derived: {
      coreMonthlyAverageJanMar2026: rollups.historicalCoreSpend,
      incomeMonthlyAverageJanMar2026: rollups.historicalIncome,
      monthlySurplusAfterRefiAndCar: round2(monthlySurplus),
      oldCreditMonthlyAverageJanMar2026: round2(sourcePlan.oldDebtMonthlyPayments),
      oldCreditPrincipal: round2(sourcePlan.oldDebtPrincipal),
      debtToIncomeRatio: round2(sourcePlan.debtToIncomeRatio),
      planSavingsRate: round2(sourcePlan.savingsRate),
      emergencyFundTarget: round2(sourcePlan.emergencyFundTarget),
      emergencyFundGap: round2(sourcePlan.emergencyFundGap),
    },
    categoryMonthly: rollups.categoryMonthly,
    topMerchants: rollups.topMerchants,
    transactions,
  };
}

function datosImportarTarget() {
  return activeViewId === "registrar" ? DATOS_IMPORTAR_TARGETS.registrar : DATOS_IMPORTAR_TARGETS.data;
}

function renderPlanningDetails({
  kind,
  monthSelectId,
  summaryId,
  rowsId,
  actuals,
  actualDataKey,
  saveActuals,
  renderAgain,
}) {
  const planning = baseData.monthlyPlanning;
  if (!planning?.months?.length) return;
  const monthIndex = Number(qs(monthSelectId).value || 0);
  const month = { ...planning.months[monthIndex], index: monthIndex };
  const monthClosed = isClosedMonthKey(month.key);
  let totalPlanned = 0;
  let capturedActual = 0;
  let capturedPlanned = 0;
  let capturedRows = 0;
  const html = [];

  planningSectionsForMonth(kind, month)
    .forEach((section, sectionIndex) => {
      const sectionKey = `${kind}:${section.name}`;
      const expanded = expandedPlanningSections[kind].has(sectionKey);
      let sectionActual = 0;
      let sectionCapturedPlanned = 0;
      let sectionCapturedRows = 0;
      const sectionPlanned = section.rows.reduce((sum, row) => {
        const info = actualAwareInfo(row, month);
        const planned = info.planned;
        if (info.hasActual) {
          sectionCapturedRows += 1;
          sectionActual += Number(info.actual || 0);
          sectionCapturedPlanned += planned;
        }
        return sum + planned;
      }, 0);
      totalPlanned += sectionPlanned;
      capturedRows += sectionCapturedRows;
      capturedActual += sectionActual;
      capturedPlanned += sectionCapturedPlanned;
      const sectionVariance = sectionCapturedRows ? sectionActual - sectionCapturedPlanned : "";
      const sectionUsed = section.rows.reduce((sum, row) => sum + actualAwareInfo(row, month).value, 0);
      const sectionVarianceClass = varianceClassForKind(kind, sectionVariance);
      html.push(
        `<tr class="section-row planning-section-row ${expanded ? "expanded" : ""}">
          <td colspan="2">
            <button class="planning-section-button" data-planning-section="${escapeHtml(sectionKey)}" aria-expanded="${expanded ? "true" : "false"}">
              <span class="planning-toggle">${expanded ? "-" : "+"}</span>${escapeHtml(section.name)} <small>${section.rows.length} líneas</small>
            </button>
          </td>
          <td>${money(sectionPlanned, true)}</td>
          <td>${sectionCapturedRows ? money(sectionActual, true) : ""}</td>
          <td><strong>${money(sectionUsed, true)}</strong></td>
          <td class="${sectionVarianceClass}">${sectionCapturedRows ? money(sectionVariance, true) : ""}</td>
          <td></td>
        </tr>`,
      );

      if (!expanded) return;

      section.rows.forEach((row) => {
        const info = actualAwareInfo(row, month);
        const planned = info.planned;
        const key = actualKeyForRow(row, month);
        const deleteKey = deleteKeyForRow(row, month);
        const actual = info.hasActual ? Number(info.actual || 0) : "";
        const used = Number(info.value || 0);
        const variance = info.hasActual ? Number(actual) - planned : "";
        const varianceClass = varianceClassForKind(kind, variance);
        html.push(`<tr class="planning-line-row ${row.custom ? "custom-line" : ""}" data-parent-section="${escapeHtml(sectionKey)}">
          <td>${escapeHtml(section.name)}</td>
          <td>${escapeHtml(displayLabelForRow(row))}${row.custom ? " <small>nuevo</small>" : ""}</td>
          <td>${money(planned, true)}</td>
          <td><input ${actualDataKey}="${key}" type="number" step="0.01" value="${info.hasActual ? actual : ""}" placeholder="Real" ${monthClosed ? "disabled" : ""} /></td>
          <td><strong>${money(used, true)}</strong><small class="detail-used-source">${info.hasActual ? "usa el real" : "usa el previsto"}</small></td>
          <td class="${varianceClass}">${info.hasActual ? money(variance, true) : ""}</td>
          <td><button type="button" class="row-delete-button" data-delete-planning-row="${escapeHtml(deleteKey)}" ${monthClosed ? "disabled" : ""}>Eliminar</button></td>
        </tr>`);
      });
    });

  const capturedVariance = capturedRows ? capturedActual - capturedPlanned : 0;
  const coverage = totalPlanned ? `${capturedRows} líneas` : "Sin datos";
  const summaryVarianceClass =
    kind === "income"
      ? capturedVariance >= 0
        ? "positive"
        : "negative"
      : capturedVariance > 0
        ? "negative"
        : "positive";
  qs(summaryId).innerHTML = [
    ["Previsto del mes", money(totalPlanned, true), ""],
    ["Real capturado", capturedRows ? money(capturedActual, true) : "Sin reales", ""],
    ["Desviación capturada", capturedRows ? money(capturedVariance, true) : "Pendiente", summaryVarianceClass],
    ["Cobertura", coverage, ""],
  ]
    .map(
      ([label, value, klass]) =>
        `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`,
    )
    .join("");
  qs(rowsId).innerHTML = html.join("");

  document.querySelectorAll(`#${rowsId} [data-planning-section]`).forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.planningSection;
      if (expandedPlanningSections[kind].has(key)) {
        expandedPlanningSections[kind].delete(key);
      } else {
        expandedPlanningSections[kind].add(key);
      }
      renderAgain();
    });
  });

  document.querySelectorAll(`[${actualDataKey}]`).forEach((input) => {
    input.addEventListener("change", () => {
      const removed = input.value === "";
      if (input.value === "") {
        delete actuals[input.getAttribute(actualDataKey)];
      } else {
        actuals[input.getAttribute(actualDataKey)] = Number(input.value);
      }
      saveActuals();
      renderAgain();
      const status = qs("detailAutoSaveStatus");
      if (status) {
        status.textContent = removed
          ? `Real eliminado en ${month.label}. La partida vuelve a usar el importe previsto.`
          : `Real guardado automáticamente en ${month.label}. No necesitas pulsar «Guardar cambios».`;
        status.className = "inline-feedback success";
      }
    });
  });

  document.querySelectorAll(`#${rowsId} [data-delete-planning-row]`).forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      deletePlanningRow(button.getAttribute("data-delete-planning-row"));
      renderAgain();
    });
  });
}

function selectedPlanningMonth() {
  const planning = baseData.monthlyPlanning;
  const monthIndex = Number(qs("detailMonth").value || 0);
  return { ...planning.months[monthIndex], index: monthIndex };
}

function populateDataEntryControls() {
  const monthSelect = qs("manualDataMonth");
  if (monthSelect) {
    const previous = monthSelect.value;
    const months = selectableMonths();
    const signature = months.map((month) => month.key).join("|");
    if (dataEntryMonthSignature !== signature) {
      monthSelect.innerHTML = months
        .map((month) => `<option value="${month.key}">${escapeHtml(month.label)}</option>`)
        .join("");
      dataEntryMonthSignature = signature;
    }
    if ([...monthSelect.options].some((option) => option.value === previous)) monthSelect.value = previous;
  }
  updateManualDataKindUi();
  populateSeriesEditor();
}

function updateManualDataKindUi() {
  const kind = qs("manualDataKind")?.value || "expense";
  const sectionSelect = qs("manualDataSection");
  if (sectionSelect) {
    const usesPlanningSection = kind === "income" || kind === "expense";
    sectionSelect.disabled = !usesPlanningSection;
    const sections = usesPlanningSection ? baseData.monthlyPlanning.sections.filter((section) => section.kind === kind) : [];
    sectionSelect.innerHTML = sections.length
      ? sections.map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`).join("")
      : '<option value="">No aplica</option>';
  }
  document.querySelectorAll(".manual-project-field").forEach((field) => {
    field.classList.toggle("is-hidden", kind !== "project" && kind !== "debt");
  });
  qs("manualDataPlanned")?.closest("label")?.classList.toggle("is-hidden", kind === "project" || kind === "debt");
}

function showImportLog(title, body, tone = "", targetId = "dataImportLog") {
  const log = qs(targetId);
  if (!log) return;
  log.classList.toggle("warning", tone === "warning");
  log.classList.toggle("danger", tone === "danger");
  log.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>`;
}

function findPlanningRow(kind, sectionName, label, month) {
  const targetSection = normalizedText(sectionName);
  const targetLabel = normalizedText(label);
  const sections = planningSectionsForMonth(kind, month);
  for (const section of sections) {
    if (normalizedText(section.name) !== targetSection) continue;
    const row = section.rows.find((item) => normalizedText(displayLabelForRow(item)) === targetLabel);
    if (row) return row;
  }
  return null;
}

function upsertPlanningRecord(record) {
  const kind = normalizeDataKind(record.kind);
  const month = monthFromInput(record.month);
  const label = String(record.label || "").trim();
  if (!month) return { ok: false, reason: `Mes no reconocido: ${record.month || ""}` };
  if (!label) return { ok: false, reason: "Concepto vacío" };

  const fallbackSection = kind === "income" ? "INGRESOS" : "GASTOS FIJOS";
  const sectionName = String(record.sectionName || fallbackSection).trim() || fallbackSection;
  const planned = parseAmount(record.planned);
  const actual = parseAmount(record.actual);
  let row = findPlanningRow(kind, sectionName, label, month);

  if (!row) {
    row = {
      id: `custom-${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      custom: true,
      kind,
      sectionName,
      label,
      monthKey: month.key,
      plannedValue: planned ?? 0,
    };
    customPlanningRows.push(row);
  } else if (row.custom && planned !== null) {
    const stored = customPlanningRows.find((item) => item.id === row.id && item.monthKey === month.key);
    if (stored) stored.plannedValue = planned;
  }

  if (actual !== null) {
    const actuals = actualsForKind(kind);
    actuals[actualKeyForRow(row, month)] = actual;
  }
  expandedPlanningSections[kind].add(`${kind}:${sectionName}`);
  return { ok: true, kind, label, month: month.label };
}

function upsertProjectRecord(record) {
  const month = monthFromInput(record.month) || selectableMonths()[0];
  const label = String(record.label || record.concept || "").trim();
  const amount = parseAmount(record.actual ?? record.planned);
  if (!label) return { ok: false, reason: "Proyecto sin nombre" };
  if (!amount || amount <= 0) return { ok: false, reason: `Proyecto sin importe: ${label}` };
  const duration = Math.max(1, Number(record.duration || 1));
  const mode = normalizeProjectMode(record.mode || "fixed");
  const monthIndex = forecastMonths().findIndex((item) => item.key === month.key);
  projects.push({
    id: `project-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: label,
    amount,
    duration,
    mode,
    monthIndex: Math.max(0, monthIndex),
    monthKey: month.key,
  });
  return { ok: true, kind: "project", label, month: month.label };
}

function upsertDebtRecord(record) {
  const month = monthFromInput(record.month) || selectableMonths()[0];
  const label = String(record.label || record.concept || "").trim() || "Liquidación deuda";
  const amount = parseAmount(record.actual ?? record.planned ?? record.amount);
  if (!amount || amount <= 0) return { ok: false, reason: `Liquidación sin importe: ${label}` };
  const duration = Math.max(1, Number(record.duration || 1));
  const payoffMode = normalizeDebtPayoffMode(record.mode || "fixed", duration);
  const monthIndex = forecastMonths().findIndex((item) => item.key === month.key);
  const target = debtPortfolioTargetForDecision({ name: label });
  debtLiquidations.push({
    id: `debt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: label,
    amount: round2(amount),
    targetId: target?.id || "",
    targetPrincipal: target ? Number(target.currentPrincipal || 0) : 0,
    originalPrincipal: target ? Number(target.currentPrincipal || 0) : 0,
    duration,
    mode: "fixed",
    payoffMode,
    monthIndex: Math.max(0, monthIndex),
    monthKey: month.key,
  });
  return { ok: true, kind: "debt", label, month: month.label };
}

function processDataRecords(records, sourceLabel = "datos", logId = "dataImportLog") {
  const beforeState = appStatePayload({ includeCanonical: false });
  let imported = 0;
  let projectRows = 0;
  let debtRows = 0;
  let planningRows = 0;
  const warnings = [];
  records.forEach((record, index) => {
    const kind = normalizeDataKind(record.kind);
    const result =
      kind === "project"
        ? upsertProjectRecord(record)
        : kind === "debt"
          ? upsertDebtRecord(record)
          : upsertPlanningRecord({ ...record, kind });
    if (result.ok) {
      imported += 1;
      if (result.kind === "project") projectRows += 1;
      else if (result.kind === "debt") debtRows += 1;
      else planningRows += 1;
    } else warnings.push(`Línea ${index + 1}: ${result.reason}`);
  });

  saveCustomPlanningRows();
  saveIncomeActuals();
  saveExpenseActuals();
  saveProjects();
  saveDebtLiquidations();
  refreshAllSectionsAfterDataChange();

  if (imported > 0 && sourceLabel !== "entrada manual") {
    const e5 = window.FinanceCanonicalE5;
    const batch = e5.createImportBatch(beforeState, appStatePayload({ includeCanonical: false }), {
      sourceLabel, reason: sourceLabel, recordCount: imported,
      afterFingerprint: window.FinanceCanonicalSupabaseStore?.fingerprintPayload(appStatePayload({ includeCanonical: false })),
    });
    importBatches.push(batch);
    saveLocalSnapshot();
    queueRemoteSave();
  }

  const warningText = warnings.length ? ` Avisos: ${warnings.slice(0, 4).join(" · ")}${warnings.length > 4 ? "..." : ""}` : "";
  showImportLog(
    `${imported} ${imported === 1 ? "registro importado" : "registros importados"}`,
    `Origen: ${sourceLabel}. ${planningRows} ${planningRows === 1 ? "concepto" : "conceptos"}, ${projectRows} ${projectRows === 1 ? "proyecto" : "proyectos"} y ${debtRows} ${debtRows === 1 ? "liquidación" : "liquidaciones"} de deuda procesados. ${fullRefreshMessage()}${warningText}`,
    warnings.length ? "warning" : "",
    logId,
  );
  return { imported, projectRows, debtRows, planningRows, warnings, batchId: importBatches.at(-1)?.id || "" };
}

function e11bAreaLabel(key) {
  return { balances: "Saldos", movements: "Movimientos", actuals: "Reales", forecast: "Previsión", debt: "Deuda" }[key] || key;
}

// DEX9: antes solo se veían las 4 últimas entradas por fecha de creación descendente, sin contar
// cuántas seguían abiertas de verdad. "Pendiente" es `ready` (lista para confirmar) o `blocked`
// (requiere revisión antes) — `applied`/`undone`/`discarded` ya están resueltas, no cuentan.
function dataInboxPendingSummary(items = []) {
  const pending = (items || [])
    .filter((item) => item.status === "ready" || item.status === "blocked")
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  return { pending, remaining: pending.length };
}

function renderE11bStatus() {
  if (!E11bInbox) return;
  const toggle = qs("toggleDataInbox");
  if (toggle) {
    const enabled = e11bSettings.enabled !== false;
    toggle.textContent = enabled ? "Bandeja activa" : "Compatibilidad clásica";
    toggle.setAttribute("aria-pressed", String(enabled));
  }
  const summary = qs("dataInboxSummary");
  if (summary) {
    const { pending, remaining } = dataInboxPendingSummary(dataInbox);
    // Con pendientes, se enseñan esas — la más antigua primero, para vaciar la cola por orden de
    // llegada — en vez de las últimas creadas, que taparían una entrada bloqueada desde hace días.
    const items = remaining ? pending.slice(0, 4) : dataInbox.slice(-4).reverse();
    const badgeClass = { ready: "e19-badge-accent", blocked: "e19-badge-warning", applied: "e19-badge-success", undone: "e19-badge-neutral", discarded: "e19-badge-neutral" };
    const progressHtml = !dataInbox.length
      ? ""
      : remaining
        ? `<p class="e19-kpi-note" id="dataInboxPendingCount"><strong>${remaining}</strong> pendiente${remaining === 1 ? "" : "s"} de confirmar — la más antigua primero.</p>`
        : `<p class="e19-kpi-note" id="dataInboxPendingCount">Sin pendientes: la bandeja está al día.</p>`;
    const itemsHtml = items.length ? items.map((item) => {
      const counts = item.comparison || {};
      const status = { ready: "Lista para confirmar", blocked: "Requiere revisión", applied: "Aplicada", undone: "Deshecha", discarded: "Descartada" }[item.status] || item.status;
      return `<article class="e19-inbox-item"><div class="e19-inbox-item-head"><strong>${escapeHtml(item.sourceLabel)}</strong><span class="e19-badge ${badgeClass[item.status] || "e19-badge-neutral"}">${escapeHtml(status)}</span></div><p>${item.rows?.length || 0} ${(item.rows?.length || 0) === 1 ? "fila" : "filas"} · ${counts.additions?.length || 0} altas · ${counts.changes?.length || 0} cambios · ${counts.duplicates?.length || 0} duplicados. El fichero original no se conserva.</p></article>`;
    }).join("") : `<article class="e19-inbox-item"><strong>Bandeja preparada</strong><p>Selecciona un CSV, Excel, tabla o extracto. Nada se incorporará antes de comparar y confirmar.</p></article>`;
    summary.innerHTML = progressHtml + itemsHtml;
  }
  const report = dataFreshnessReport();
  const freshness = qs("updateFreshness");
  if (freshness) freshness.innerHTML = Object.entries(report.areas).map(([key, area]) => {
    const pillClass = area.status === "current" ? "e19-pill-safe" : "e19-pill-warn";
    const pillLabel = area.status === "current" ? "al día" : area.status === "stale" ? "revisar frescura" : "incompleto";
    return `<article class="e19-freshness-item"><strong>${escapeHtml(e11bAreaLabel(key))}</strong><p>${area.through ? `Hasta ${escapeHtml(formatIsoDate(area.through))}` : `Falta ${escapeHtml(area.missing.join(", "))}`}</p><span class="e19-pill ${pillClass}">${pillLabel}</span></article>`;
  }).join("");
}

// ARQ-6: `logId` — el justificante se pinta donde se confirmó (antes, siempre en #data-entry, oculta).
function applyE11bReceipt(item, result = {}, logId = "dataImportLog") {
  if (!item || !E11bInbox) return;
  const latestBatch = result.batchId || importBatches.filter((batch) => batch.status === "applied").at(-1)?.id || "";
  const receiptId = `receipt-${Date.now()}`;
  const applied = E11bInbox.transition(item, "applied", { batchId: latestBatch, receiptId });
  dataInbox = dataInbox.map((entry) => entry.id === item.id ? applied : entry);
  const receipt = E11bInbox.buildReceipt(applied, { ...result, batchId: latestBatch, recalculated: ["cuadro de mandos", "conciliación", "previsión", "deuda y ahorro"] }, { id: receiptId });
  updateReceipts.push(receipt);
  saveLocalSnapshot();
  renderE11bStatus();
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const warningText = warnings.length ? ` Avisos: ${warnings.slice(0, 4).join(" · ")}${warnings.length > 4 ? "..." : ""}` : "";
  showImportLog("Actualización confirmada", `${receipt.changed.records} ${receipt.changed.records === 1 ? "registro incorporado" : "registros incorporados"}. Se recalcularon ${receipt.recalculated.join(", ")}. ${receipt.undoAvailable ? "Puedes deshacerlo con «Deshacer último lote», en Registrar." : "La revisión queda registrada."}${warningText}`, warnings.length ? "warning" : "success", logId);
}

async function runReceiptOcr(file) {
  const Tesseract = await loadReceiptOcrEngine();
  const result = await Tesseract.recognize(file, "spa");
  return result?.data?.text || "";
}

function receiptFieldsFromOcrText(text) {
  if (!ReceiptOcr) return { amount: { calculable: false }, date: { calculable: false }, merchant: { calculable: false } };
  return ReceiptOcr.extractReceiptFields(text, { today: isoLocalDate(new Date()) });
}

async function handleReceiptCameraCapture(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  const fileNameEl = qs("receiptCameraFileName");
  if (fileNameEl) fileNameEl.textContent = file.name || "Foto capturada";
  showImportLog("Reconociendo el ticket…", "El texto se está leyendo en tu propio navegador. Puede tardar unos segundos.", "", "receiptCameraStatus");
  const reviewEl = qs("receiptCameraReview");
  if (reviewEl) reviewEl.innerHTML = "";
  let text = "";
  try {
    text = await runReceiptOcr(file);
  } catch (error) {
    showImportLog("No se pudo leer el ticket automáticamente", `${error.message || "Inténtalo de nuevo."} Puedes rellenar los datos a mano.`, "warning", "receiptCameraStatus");
  }
  const fields = receiptFieldsFromOcrText(text);
  if (receiptCaptureDraft?.previewUrl) URL.revokeObjectURL(receiptCaptureDraft.previewUrl);
  receiptCaptureDraft = { file, previewUrl: URL.createObjectURL(file) };
  renderReceiptCaptureReview(fields);
}

function renderReceiptCaptureReview(fields) {
  const container = qs("receiptCameraReview");
  if (!container || !receiptCaptureDraft) return;
  const amountValue = fields.amount?.calculable ? Math.abs(fields.amount.value).toFixed(2) : "";
  const dateValue = fields.date?.calculable ? fields.date.value : isoLocalDate(new Date());
  const merchantValue = fields.merchant?.calculable ? fields.merchant.value : "";
  const allCalculable = fields.amount?.calculable && fields.date?.calculable && fields.merchant?.calculable;
  container.innerHTML = `
    <div class="receipt-capture-review">
      <img class="receipt-capture-thumb" src="${receiptCaptureDraft.previewUrl}" alt="Foto del ticket capturado" />
      <div class="receipt-capture-fields">
        <label><span>Importe (€)</span><input id="receiptCaptureAmount" type="number" step="0.01" min="0" value="${escapeHtml(amountValue)}" /></label>
        <label><span>Fecha</span><input id="receiptCaptureDate" type="date" value="${escapeHtml(dateValue)}" /></label>
        <label><span>Comercio</span><input id="receiptCaptureMerchant" type="text" value="${escapeHtml(merchantValue)}" placeholder="Nombre del comercio" /></label>
      </div>
      <p class="data-hint">${allCalculable ? "Reconocido automáticamente — revisa antes de confirmar." : "El reconocimiento no encontró todos los datos con certeza — complétalos antes de confirmar."} La categoría se propondrá igual que en cualquier movimiento importado, desde el detalle del movimiento. Nada se incorpora al libro sin tu confirmación.</p>
      <div class="data-actions">
        <button id="receiptCaptureConfirm" type="button">Confirmar y registrar</button>
        <button id="receiptCaptureCancel" class="secondary" type="button">Descartar</button>
      </div>
    </div>`;
  qs("receiptCaptureConfirm")?.addEventListener("click", confirmReceiptCapture);
  qs("receiptCaptureCancel")?.addEventListener("click", cancelReceiptCapture);
  wireGestureConfirm(qs("receiptCaptureConfirm"));
}

function cancelReceiptCapture() {
  if (receiptCaptureDraft?.previewUrl) URL.revokeObjectURL(receiptCaptureDraft.previewUrl);
  receiptCaptureDraft = null;
  const reviewEl = qs("receiptCameraReview");
  if (reviewEl) reviewEl.innerHTML = "";
  showImportLog("Captura descartada", "No se ha registrado ningún movimiento.", "", "receiptCameraStatus");
}

function confirmReceiptCapture() {
  if (!receiptCaptureDraft) return;
  const amount = parseAmount(qs("receiptCaptureAmount")?.value);
  const date = qs("receiptCaptureDate")?.value;
  const merchant = String(qs("receiptCaptureMerchant")?.value || "").trim();
  // DEX8: en vez de "faltan datos" genérico, decir cuál — el reconocimiento automático puede fallar
  // en un solo campo de los tres, y "faltan datos" obliga a repasarlos todos para averiguar cuál.
  const missing = [];
  if (!amount || amount <= 0) missing.push("el importe");
  if (!date) missing.push("la fecha");
  if (!merchant) missing.push("el comercio");
  if (missing.length) {
    const title = missing.length === 1 ? `Falta ${missing[0]}` : "Faltan datos";
    const detail = missing.join(", ").replace(/, ([^,]*)$/, " y $1");
    showImportLog(title, `Completa ${detail} antes de confirmar.`, "danger", "receiptCameraStatus");
    return;
  }
  const row = {
    date, valueDate: date, movement: merchant,
    details: "Ticket capturado por cámara (A17-3)",
    amount: -Math.abs(round2(amount)), balance: null, category: "",
    source: "receipt-photo", statementOrder: 0,
  };
  const imported = [row];
  const comparison = { valid: true, additions: imported, changes: [], duplicates: [], removals: [] };
  const inboxItem = addE11bInboxItem({ source: "receipt-photo", sourceLabel: merchant, rows: imported, comparison });
  pendingE11bApply = { imported, inboxItem };
  const draft = receiptCaptureDraft;
  applyStagedMovementImport();
  const store = typeof P2PrivateStore !== "undefined" ? P2PrivateStore : null;
  if (inboxItem && store) {
    store.saveAttachment(inboxItem.id, draft.file).then((meta) => {
      receiptAttachments[transactionIdentity(row)] = { inboxItemId: inboxItem.id, ...meta };
      saveLocalSnapshot();
      if (meta.storage === "cloud") showImportLog("Movimiento registrado", "El ticket se incorporó al libro y la foto se cifró y sincronizó con la nube.", "", "receiptCameraStatus");
    }).catch(() => {
      showImportLog("Movimiento registrado sin adjunto", "El ticket se incorporó al libro, pero la foto no se pudo guardar cifrada en este dispositivo.", "warning", "receiptCameraStatus");
    });
  }
  if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
  receiptCaptureDraft = null;
  const reviewEl = qs("receiptCameraReview");
  if (reviewEl) reviewEl.innerHTML = "";
  const fileNameEl = qs("receiptCameraFileName");
  if (fileNameEl) fileNameEl.textContent = "Ningún ticket capturado";
}

function handleManualData() {
  const kind = qs("manualDataKind").value;
  const record = {
    kind,
    month: qs("manualDataMonth").value,
    sectionName: qs("manualDataSection").value,
    label: qs("manualDataLabel").value,
    planned: parseAmountField(qs("manualDataPlanned").value) ?? "",
    actual: parseAmountField(qs("manualDataActual").value) ?? "",
    duration: qs("manualProjectDuration").value,
    mode: qs("manualProjectMode").value,
  };
  processDataRecords([record], "entrada manual");
  qs("manualDataLabel").value = "";
  qs("manualDataPlanned").value = "";
  qs("manualDataActual").value = "";
}

function handleBatchImport() {
  const records = parseTabularText(qs("batchDataInput").value);
  if (!records.length) {
    showImportLog("No hay datos importables", "Pega una tabla con cabeceras y al menos una línea.", "danger");
    return;
  }
  stageE7Import(records, "lote pegado");
}

function applyImportedWorkbookData(nextData, fileName, logId = "dataImportLog") {
  const beforeState = appStatePayload({ includeCanonical: false });
  baseData = nextData;
  ensureCompleteFinancingSection();
  ensureVariableOperationalSection();
  balanceSettings = {};
  scenarioSettings = {};
  currentScenario = "Base";
  selectedCashflowIndex = null;
  expandedCashflowYears = new Set();
  expandedPlanningSections = {
    income: new Set(),
    expense: new Set(),
  };
  saveWorkbookOverride();
  writeControls({ ...baseData.assumptions, autoCapSavings: true });
  updateSourceNote();
  qs("scenarioName").textContent = currentScenario;
  saveLocalSnapshot();
  queueRemoteSave();
  refreshAllSectionsAfterDataChange();

  const monthCount = baseData.monthlyPlanning?.months?.length || 0;
  const sectionCount = baseData.monthlyPlanning?.sections?.length || 0;
  const transactionCount = baseData.transactions?.length || 0;
  const batch = window.FinanceCanonicalE5?.createImportBatch(beforeState, appStatePayload({ includeCanonical: false }), {
    sourceLabel: fileName, reason: fileName, recordCount: transactionCount + sectionCount,
    afterFingerprint: window.FinanceCanonicalSupabaseStore?.fingerprintPayload(appStatePayload({ includeCanonical: false })),
  });
  if (batch) { importBatches.push(batch); saveLocalSnapshot(); queueRemoteSave(); }
  showImportLog(
    "Libro Excel cargado completo",
    `${fileName}: ${monthCount} meses, ${sectionCount} bloques de planificación y ${transactionCount} movimientos incorporados al modelo. ${fullRefreshMessage()}`,
    "success",
    logId,
  );
  return { batchId: batch?.id || "", recordCount: transactionCount + sectionCount, movementCount: transactionCount };
}

async function handleExcelImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (qs("excelFileName")) qs("excelFileName").textContent = file.name;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
    const records = parseTabularText(await file.text());
    if (!records.length) {
      showImportLog("Fichero vacío", "No se han encontrado filas importables.", "danger");
      return;
    }
    stageE7Import(records, file.name);
    event.target.value = "";
    return;
  }
  if (!(await window.xlsxReady())) {
    showImportLog("No se pudo cargar la librería de Excel", "Comprueba la conexión y vuelve a intentarlo, o importa el fichero como CSV.", "danger");
    return;
  }
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array" });
  try {
    stageE7Workbook(buildFinanceDataFromWorkbook(workbook, file.name), file.name);
  } catch (error) {
    showImportLog(
      "No se pudo cargar el libro completo",
      `${error.message}. Comprueba que el Excel mantiene las pestañas Plan_Ahorro_821, Contabilidad New Life, Importe devolucion recibos y Movimientos_cuenta.`,
      "danger",
    );
  }
  event.target.value = "";
}

// R-9 · pestaña «Lote y Excel» de Registrar: mismas funciones de bajo nivel que #data-entry
// (parseTabularText, stageE7Import/stageE7Workbook, processDataRecords/applyImportedWorkbookData
// vía la bandeja E11b) — solo cambia el elemento de origen y el destino visual (target
// "registrar"). Ninguna escritura nueva; #data-entry sigue intacto y funcionando igual.
function handleRegistrarBatchImport() {
  const input = qs("registrarBatchInput");
  const records = parseTabularText(input?.value);
  if (!records.length) {
    showImportLog("No hay datos importables", "Pega una tabla con cabeceras y al menos una línea.", "danger", "registrarBatchLog");
    return;
  }
  stageE7Import(records, "lote pegado", "registrar");
}

function handleRegistrarBatchClear() {
  const input = qs("registrarBatchInput");
  if (input) input.value = "";
  showImportLog("Lote limpio", "Puedes pegar una nueva tabla cuando quieras.", "", "registrarBatchLog");
}

async function processRegistrarExcelFile(file) {
  if (!file) return;
  if (qs("registrarExcelFileName")) qs("registrarExcelFileName").textContent = file.name;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
    const records = parseTabularText(await file.text());
    if (!records.length) {
      showImportLog("Fichero vacío", "No se han encontrado filas importables.", "danger", "registrarBatchLog");
      return;
    }
    stageE7Import(records, file.name, "registrar");
    return;
  }
  if (!(await window.xlsxReady())) {
    showImportLog("No se pudo cargar la librería de Excel", "Comprueba la conexión y vuelve a intentarlo, o importa el fichero como CSV.", "danger", "registrarBatchLog");
    return;
  }
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array" });
  try {
    stageE7Workbook(buildFinanceDataFromWorkbook(workbook, file.name), file.name, "registrar");
  } catch (error) {
    showImportLog(
      "No se pudo cargar el libro completo",
      `${error.message}. Comprueba que el Excel mantiene las pestañas Plan_Ahorro_821, Contabilidad New Life, Importe devolucion recibos y Movimientos_cuenta.`,
      "danger",
      "registrarBatchLog",
    );
  }
}

function renderMonthlySummary() {
  const planning = baseData.monthlyPlanning;
  if (!planning?.months?.length) return;
  const monthIndex = Number(qs("detailMonth").value || 0);
  const month = { ...planning.months[monthIndex], index: monthIndex };
  const simulationRow = openSimulationRows(lastSimulation).find((row) => row.detailMonthKey === month.key);
  const totals = {
    income: 0,
    expense: 0,
    actualRows: 0,
  };

  planningSectionsForMonth(null, month).forEach((section) => {
    section.rows.forEach((row) => {
      const info = actualAwareInfo(row, { ...month, index: monthIndex });
      if (section.kind === "income") totals.income += info.value;
      if (section.kind === "expense") totals.expense += info.value;
      if (info.hasActual) totals.actualRows += 1;
    });
  });

  const income = simulationRow ? Number(simulationRow.income || 0) : totals.income;
  const baseExpense = simulationRow
    ? Number(simulationRow.coreSpend || 0) + Number(simulationRow.car || 0) + Number(simulationRow.refi || 0)
    : totals.expense;
  const decisionImpact = simulationRow ? Number(simulationRow.projectOutflow || 0) : 0;
  const net = simulationRow ? Number(simulationRow.netBeforeSaving || 0) : totals.income - totals.expense;
  const saving = simulationRow ? Number(simulationRow.saving || 0) : 0;
  qs("monthlySummary").innerHTML = [
    ["Ingresos del mes", money(income, true), "positive"],
    ["Gastos base + deuda", money(baseExpense, true), "negative"],
    ["Decisiones/proyectos", money(decisionImpact, true), decisionImpact < 0 ? "positive" : decisionImpact > 0 ? "negative" : ""],
    ["Resultado del mes", money(net, true), net >= 0 ? "positive" : "negative"],
    ["Ahorro aplicado", money(saving, true), ""],
    ["Reales capturados", `${totals.actualRows} líneas`, ""],
  ]
    .map(
      ([label, value, klass]) =>
        `<div class="expense-summary-card"><span>${label}</span><strong class="${klass}">${value}</strong></div>`,
    )
    .join("");
}

function renderIncomeDetails() {
  renderPlanningDetails({
    kind: "income",
    monthSelectId: "detailMonth",
    summaryId: "incomeSummary",
    rowsId: "incomeDetailRows",
    actuals: incomeActuals,
    actualDataKey: "data-income-actual-key",
    saveActuals: saveIncomeActuals,
    renderAgain: render,
  });
}

function renderExpenseDetails() {
  renderPlanningDetails({
    kind: "expense",
    monthSelectId: "detailMonth",
    summaryId: "expenseSummary",
    rowsId: "expenseDetailRows",
    actuals: expenseActuals,
    actualDataKey: "data-expense-actual-key",
    saveActuals: saveExpenseActuals,
    renderAgain: render,
  });
}

function registrarMesSelectedMonth() {
  const months = baseData?.monthlyPlanning?.months;
  if (!months?.length) return null;
  const raw = Number(qs("registrarMesMonth")?.value || 0);
  const index = Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 0), months.length - 1);
  return { ...months[index], index };
}

function registrarMesMatchesFilter(entry, filter) {
  if (filter === "sin-real") return !entry.hasActual;
  if (filter === "desviacion") return registrarMesIsOff(entry);
  return true;
}

function registrarMesFilterCounts(list) {
  return {
    "sin-real": list.filter((entry) => registrarMesMatchesFilter(entry, "sin-real")).length,
    desviacion: list.filter((entry) => registrarMesMatchesFilter(entry, "desviacion")).length,
    todo: list.length,
  };
}

function registrarMesEmptyMessage(filter, total) {
  if (!total) return "Este mes no tiene partidas de este tipo.";
  if (filter === "sin-real") return "Todas las partidas tienen un real registrado. Pulsa «Todo» para verlas.";
  if (filter === "desviacion") return "Ninguna partida con real se aparta del previsto.";
  return "Este mes no tiene partidas de este tipo.";
}

function registrarMesRowHtml(entry, monthClosed, monthKey) {
  const locked = monthClosed || REGISTRAR_MES_LEGACY_READONLY;
  const classes = [
    entry.row.custom ? "registrar-mes-row-custom" : "",
    registrarMesIsBad(entry) ? "registrar-mes-row-off" : "",
  ].filter(Boolean);
  const annualMatch = locked ? null : registrarMesAnnualMatch(entry, baseData?.transactions, monthKey);
  const showAnnualBanner = Boolean(annualMatch) && !state?.registrarMesAnnualAck?.[entry.key];
  return `<tr data-registrar-mes-key="${escapeHtml(entry.key)}"${classes.length ? ` class="${classes.join(" ")}"` : ""}>
    <td class="registrar-mes-block">${escapeHtml(entry.sectionName)}</td>
    <td class="registrar-mes-concept">${escapeHtml(entry.label)}${entry.row.custom ? " <small>añadida aquí</small>" : ""}</td>
    <td data-registrar-mes-cell="planned">${money(entry.planned, true)}</td>
    <td><input type="number" step="0.01" inputmode="decimal" data-registrar-mes-actual="${escapeHtml(entry.key)}" data-registrar-mes-kind="${escapeHtml(entry.kind)}" aria-label="Real de ${escapeHtml(entry.label)}" value="${entry.hasActual ? entry.actual : ""}" placeholder="sin real"${locked ? " disabled" : ""} /></td>
    <td data-registrar-mes-cell="used"><strong>${money(entry.used, true)}</strong>${entry.inProgress ? " <small>en curso</small>" : ""}</td>
    <td data-registrar-mes-cell="variance" class="${varianceClassForKind(entry.kind, entry.hasActual ? entry.variance : "")}">${entry.hasActual ? registrarMesSignedMoney(entry.variance) : "—"}</td>
    <td class="registrar-mes-row-actions">${
      entry.row.custom && !locked
        ? `<button type="button" class="registrar-mes-row-remove" data-registrar-mes-delete="${escapeHtml(entry.deleteKey)}" aria-label="Quitar ${escapeHtml(entry.label)} de este mes">×</button>`
        : ""
    }</td>
  </tr>${showAnnualBanner ? registrarMesAnnualBannerHtml(entry, annualMatch, monthKey) : ""}`;
}

// V4-3 · el aviso que consume la detección de V4-5. No proyecta el previsto hacia años futuros
// —eso sigue sin existir, documentado en registrarMesAnnualMatch— solo pregunta y recuerda dónde
// anotarlo si la respuesta es que sí.
function registrarMesAnnualBannerHtml(entry, match, monthKey) {
  const monthName = registrarMesMonthName(monthKey);
  return `<tr class="registrar-mes-annual-row"><td colspan="7">
    <span class="registrar-mes-annual-note">Coincide con ${escapeHtml(money(Math.abs(Number(entry.actual || 0)), true))} de hace un año (${escapeHtml(formatIsoDate(match.date))}), sin nada parecido entre medias · ¿es una partida anual? Se repetirá cada ${escapeHtml(monthName)}.</span>
    <span class="registrar-mes-annual-actions">
      <button type="button" class="e19-btn e19-btn-primary" data-registrar-mes-annual-key="${escapeHtml(entry.key)}" data-registrar-mes-annual-choice="confirm">Sí, anual</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-registrar-mes-annual-key="${escapeHtml(entry.key)}" data-registrar-mes-annual-choice="dismiss">Solo este mes</button>
    </span>
  </td></tr>`;
}

function registrarMesAddFormHtml(kind, month) {
  if (!registrarMesAddOpen[kind]) return "";
  const options = baseData.monthlyPlanning.sections
    .filter((section) => section.kind === kind)
    .map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`)
    .join("");
  return `<form class="registrar-mes-add" data-registrar-mes-add-form="${kind}">
    <label><span>Bloque</span><select data-registrar-mes-add-field="section">${options}</select></label>
    <label><span>Concepto</span><input type="text" data-registrar-mes-add-field="label" placeholder="Ej.: Seguro del coche" /></label>
    <label><span>Previsto</span><input type="number" step="0.01" data-registrar-mes-add-field="planned" placeholder="0,00" /></label>
    <label><span>Real</span><input type="number" step="0.01" data-registrar-mes-add-field="actual" placeholder="Opcional" /></label>
    <div class="registrar-mes-add-actions">
      <button type="submit" class="e19-btn e19-btn-primary">Añadir a ${escapeHtml(month.label)}</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-registrar-mes-add-cancel="${kind}">Cancelar</button>
    </div>
  </form>`;
}

function registrarMesCopyHtml(kind, month) {
  const previous = registrarMesPreviousMonth(month);
  if (!previous) return `<span class="e19-kpi-meta">No hay un mes anterior en el plan.</span>`;
  if (!registrarMesCopyPending[kind]) {
    return `<button type="button" class="registrar-mes-link" data-registrar-mes-copy="${kind}">Copiar reales del mes anterior</button>`;
  }
  const candidates = registrarMesCopyCandidates(kind, month);
  return `<span class="registrar-mes-copy-confirm">
    <span>Se copiarán ${candidates.length} ${candidates.length === 1 ? "real" : "reales"} de ${escapeHtml(previous.label)} a las partidas que aún no tienen uno.</span>
    <button type="button" class="e19-btn e19-btn-primary" data-registrar-mes-copy-confirm="${kind}">Confirmar copia</button>
    <button type="button" class="e19-btn e19-btn-secondary" data-registrar-mes-copy-cancel="${kind}">Cancelar</button>
  </span>`;
}

function registrarMesCardHtml(meta, list, month, monthClosed) {
  const kind = meta.kind;
  const filter = registrarMesFilters[kind];
  const counts = registrarMesFilterCounts(list);
  const visible = list.filter((entry) => registrarMesMatchesFilter(entry, filter));
  const chips = ["sin-real", "desviacion", "todo"]
    .map(
      (value) =>
        `<button type="button" class="registrar-mes-filter${filter === value ? " is-active" : ""}" data-registrar-mes-filter="${kind}:${value}" aria-pressed="${filter === value ? "true" : "false"}">${REGISTRAR_MES_FILTER_LABELS[value]} (${counts[value]})</button>`,
    )
    .join("");
  const body = visible.length
    ? visible.map((entry) => registrarMesRowHtml(entry, monthClosed, month.key)).join("")
    : `<tr><td colspan="7" class="registrar-mes-empty">${escapeHtml(registrarMesEmptyMessage(filter, list.length))}</td></tr>`;
  const hasSections = baseData.monthlyPlanning.sections.some((section) => section.kind === kind);
  const footer = REGISTRAR_MES_LEGACY_READONLY
    ? `<p class="e19-kpi-note">Solo lectura (R-11): añade, copia o borra partidas desde <button type="button" class="registrar-actuals-plan-link" data-home-nav="registrar">Registrar › Reales del mes</button>.</p>`
    : monthClosed
      ? `<p class="e19-kpi-note">El mes está cerrado: los reales quedan congelados tal y como se cerraron.</p>`
      : `<div class="registrar-mes-card-foot">
        ${hasSections ? `<button type="button" class="e19-btn e19-btn-secondary" data-registrar-mes-add="${kind}">+ Añadir partida</button>` : ""}
        <p class="e19-kpi-note">Vaciar un real recupera el previsto. Escribir 0 significa «ocurrió por cero».</p>
        ${registrarMesCopyHtml(kind, month)}
      </div>
      ${registrarMesAddFormHtml(kind, month)}`;
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head">
      <h3 class="escenario-motor-panel-title">${escapeHtml(meta.label)}</h3>
      <div class="registrar-mes-filters" role="group" aria-label="Filtrar partidas de ${escapeHtml(meta.label.toLowerCase())}">${chips}</div>
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table">
        <thead>
          <tr>
            <th>Bloque</th>
            <th>Concepto</th>
            <th>Previsto</th>
            <th>Real</th>
            <th>Usado</th>
            <th>Desviación</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${footer}
  </article>`;
}

// Actualiza solo las celdas derivadas (previsto, usado, desviación) y los contadores de los
// filtros. Se usa cuando el foco sigue dentro de la tabla: reconstruirla entera ahí robaría el
// foco al tabular de una casilla a la siguiente.
function registrarMesRefreshCells(entries) {
  const container = qs("registrarMesTables");
  if (!container) return;
  const byKey = new Map();
  [...entries.income, ...entries.expense].forEach((entry) => byKey.set(entry.key, entry));
  container.querySelectorAll("tr[data-registrar-mes-key]").forEach((row) => {
    const entry = byKey.get(row.dataset.registrarMesKey);
    if (!entry) return;
    const planned = row.querySelector('[data-registrar-mes-cell="planned"]');
    if (planned) planned.textContent = money(entry.planned, true);
    const used = row.querySelector('[data-registrar-mes-cell="used"]');
    if (used) used.innerHTML = `<strong>${money(entry.used, true)}</strong>${entry.inProgress ? " <small>en curso</small>" : ""}`;
    const variance = row.querySelector('[data-registrar-mes-cell="variance"]');
    if (variance) {
      variance.textContent = entry.hasActual ? registrarMesSignedMoney(entry.variance) : "—";
      variance.className = varianceClassForKind(entry.kind, entry.hasActual ? entry.variance : "");
    }
    row.classList.toggle("registrar-mes-row-off", registrarMesIsBad(entry));
  });
  REGISTRAR_MES_KINDS.forEach((meta) => {
    const counts = registrarMesFilterCounts(entries[meta.kind]);
    container.querySelectorAll(`[data-registrar-mes-filter^="${meta.kind}:"]`).forEach((button) => {
      const value = String(button.dataset.registrarMesFilter).split(":")[1];
      button.textContent = `${REGISTRAR_MES_FILTER_LABELS[value]} (${counts[value]})`;
    });
  });
}

function renderRegistrarMes() {
  if (!qs("registrar-mes") || !baseData?.monthlyPlanning?.months?.length) return;
  const month = registrarMesSelectedMonth();
  if (!month) return;
  const monthClosed = isClosedMonthKey(month.key);
  const entries = registrarMesCollect(month);
  const totals = registrarMesTotals(entries);

  const eyebrow = qs("registrarMesEyebrow");
  if (eyebrow) eyebrow.textContent = `Actualizar · ${registrarMesLongMonth(month.key)}`;

  const netVariance = totals.expenseVariance - totals.incomeVariance;
  const title = qs("registrarMesTitle");
  if (title) {
    const name = registrarMesMonthName(month.key);
    title.textContent = !totals.captured
      ? `${name} todavía no tiene ningún real registrado`
      : Math.abs(netVariance) < 0.005
        ? `${name} va clavado a lo previsto`
        : `${name} va ${money(Math.abs(netVariance), true)} ${netVariance > 0 ? "por encima" : "por debajo"} de lo previsto`;
  }

  const pending = totals.lines - totals.captured;
  const subtitle = qs("registrarMesSubtitle");
  if (subtitle) {
    subtitle.textContent = monthClosed
      ? "El mes está cerrado: los importes quedan congelados y no se pueden editar aquí."
      : REGISTRAR_MES_LEGACY_READONLY
        ? `${pending ? `${pending === 1 ? "Queda" : "Quedan"} ${pending} ${pending === 1 ? "partida" : "partidas"} sin real.` : "Todas las partidas tienen real."} Esta pantalla es de solo lectura: edítalas desde Registrar › Reales del mes.`
        : `${pending ? `${pending === 1 ? "Queda" : "Quedan"} ${pending} ${pending === 1 ? "partida" : "partidas"} sin real.` : "Todas las partidas tienen real."} Todo lo que escribas se guarda al salir de la casilla.`;
  }

  const saved = qs("registrarMesSaved");
  if (saved) {
    saved.textContent = registrarMesLastSaveAt
      ? `Guardado a las ${registrarMesLastSaveAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
      : "Sin cambios en esta sesión";
    saved.className = registrarMesLastSaveAt ? "e19-badge e19-badge-success" : "e19-badge e19-badge-neutral";
  }

  const kpis = qs("registrarMesKpis");
  if (kpis) {
    const margin = totals.incomeUsed - totals.expenseUsed;
    const plannedMargin = totals.incomePlanned - totals.expensePlanned;
    const progress = totals.lines ? Math.round((totals.captured / totals.lines) * 100) : 0;
    const delta = (variance, goodWhenPositive) =>
      totals.captured
        ? `<span class="e19-kpi-delta ${(goodWhenPositive ? variance >= 0 : variance <= 0) ? "is-up" : "is-down"}">${registrarMesSignedMoney(variance)} frente al previsto</span>`
        : `<span class="e19-kpi-meta">Sin reales todavía</span>`;
    kpis.innerHTML = [
      `<div class="e19-kpi"><span class="e19-kpi-label">Ingresos · usado</span><span class="e19-kpi-value">${money(totals.incomeUsed, true)}</span>${delta(totals.incomeVariance, true)}</div>`,
      `<div class="e19-kpi"><span class="e19-kpi-label">Gastos · usado</span><span class="e19-kpi-value">${money(totals.expenseUsed, true)}</span>${delta(totals.expenseVariance, false)}</div>`,
      `<div class="e19-kpi${margin < 0 ? " is-danger" : ""}"><span class="e19-kpi-label">Margen del mes</span><span class="e19-kpi-value">${money(margin, true)}</span><span class="e19-kpi-meta">previsto ${money(plannedMargin, true)}</span></div>`,
      `<div class="e19-kpi"><span class="e19-kpi-label">Completado</span><span class="e19-kpi-value">${totals.captured}/${totals.lines}</span><span class="registrar-mes-progress" role="img" aria-label="${progress}% de las partidas tienen real"><span style="width:${progress}%"></span></span></div>`,
    ].join("");
  }

  const container = qs("registrarMesTables");
  if (!container) return;
  if (registrarMesCellsOnly && container.dataset.monthKey === month.key) {
    registrarMesRefreshCells(entries);
    return;
  }
  container.innerHTML = REGISTRAR_MES_KINDS.map((meta) => registrarMesCardHtml(meta, entries[meta.kind], month, monthClosed)).join("");
  container.dataset.monthKey = month.key;
}

function handleRegistrarMesAddToggle(kind, open) {
  if (REGISTRAR_MES_LEGACY_READONLY) return;
  if (!(kind in registrarMesAddOpen)) return;
  registrarMesAddOpen[kind] = open;
  renderRegistrarMes();
  if (open) qs("registrarMesTables")?.querySelector('[data-registrar-mes-add-field="label"]')?.focus();
}

function registrarBalanceStale() {
  if (!state) return false;
  return state.balanceMode === "manual" && (state.balanceDate || "") !== isoLocalDate(new Date());
}

// R-2 (auditoría del 15 de agosto, Prioridad 4): el criterio pide un recuento vivo en las cuatro
// pestañas; «import» y «batch» llevaban un marcador de «ausente» permanente, nunca un número.
// «import» sí tiene un recuento real que ofrecer — los movimientos de la sesión de importación en
// curso que piden decisión, el mismo `datosImportarCounters` que ya usa `homeImportSessionCandidate`
// (H-5) —; «batch» (pegar tabla/Excel) es una acción de un solo paso sin sesión que dejar a medias,
// así que no hay pendiente real que contar todavía: se deja vacío, igual que «balances» cuando no
// hay nada que avisar, en vez de fabricar un cero (regla transversal 04).
function registrarTabBadges() {
  const month = registrarActualsSelectedMonth();
  const pendingActuals = registrarActualsEntries(month).filter((entry) => !entry.hasActual).length;
  const importPending = datosImportarSession ? datosImportarCounters(datosImportarSession.rows).pidenDecision : 0;
  return {
    balances: registrarBalanceStale() ? "1 desactualizada" : "",
    actuals: !month ? HOME_MISSING_VALUE : pendingActuals ? `${pendingActuals} sin real` : "Al día",
    import: importPending ? `${importPending} por decidir` : "",
    batch: "",
  };
}

function registrarActualsSelectedMonth() {
  const months = baseData?.monthlyPlanning?.months || [];
  if (!months.length) return null;
  const key = qs("registrarActualsMonth")?.value || registrarActualsDefaultMonthKey();
  return months.find((month) => month.key === key) || months[0];
}

function registrarActualsBlocks(entries) {
  return [...new Set(entries.map((entry) => entry.sectionName))].sort((a, b) => a.localeCompare(b, "es"));
}

function registrarActualsStatus(entry) {
  if (!entry.hasActual) return { label: "Sin real", tone: "warn" };
  if (registrarMesIsBad(entry)) return { label: "Desviación", tone: "danger" };
  if (registrarMesIsOff(entry)) return { label: "A favor", tone: "good" };
  return { label: "Registrado", tone: "good" };
}

// DEX7: sugerencia de importe real por partida, tomada del último mes anterior en que esa misma
// partida (mismo `row.id`, la primera mitad de `entry.key`) tuvo un real capturado de verdad — nunca
// se rellena sola: aparece solo como `placeholder` (texto gris, nunca `value`), así que si el usuario
// no la teclea explícitamente, no se guarda nada (mismo principio que "ninguna escritura durante
// vistas previas" del resto del backlog). Sin real anterior, no hay sugerencia — hueco, no invención.
function lastActualForEntry(entry, month) {
  if (!month) return null;
  const rowId = String(entry.key || "").split("|")[0];
  if (!rowId) return null;
  const actuals = actualsForKind(entry.kind);
  const priorMonths = (baseData?.monthlyPlanning?.months || [])
    .filter((item) => item.key < month.key)
    .sort((a, b) => b.key.localeCompare(a.key));
  for (const priorMonth of priorMonths) {
    const stored = actuals[`${rowId}|${priorMonth.key}`];
    if (Number.isFinite(Number(stored))) return { amount: Number(stored), monthLabel: priorMonth.label };
  }
  return null;
}

// R-6b: el previsto de esta fila no se edita aquí (celda de solo lectura, ninguna escritura de
// `planned` en toda la pestaña) — el enlace lleva a Plan, la única pantalla donde se edita.
function registrarActualsRowHtml(entry, monthClosed, month) {
  const status = registrarActualsStatus(entry);
  const suggestion = entry.hasActual ? null : lastActualForEntry(entry, month);
  const placeholder = suggestion ? formatAmountField(suggestion.amount) : "sin real";
  const titleAttr = suggestion ? ` title="Sugerido: último real registrado, ${escapeHtml(money(suggestion.amount, true))} en ${escapeHtml(suggestion.monthLabel)}"` : "";
  return `<tr data-registrar-actuals-key="${escapeHtml(entry.key)}">
    <td>${!entry.hasActual && !monthClosed ? `<input type="checkbox" class="registrar-actuals-select" data-registrar-actuals-select="${escapeHtml(entry.key)}" data-registrar-actuals-kind="${escapeHtml(entry.kind)}" aria-label="Seleccionar ${escapeHtml(entry.label)}"${registrarActualsSelectedKeys.has(entry.key) ? " checked" : ""} />` : ""}${escapeHtml(entry.sectionName)}</td>
    <td>${escapeHtml(entry.label)}<button type="button" class="registrar-actuals-plan-link" data-home-nav="cuadro-mandos">Ver en Plan</button></td>
    <td data-label="Previsto">${money(entry.planned, true)}</td>
    <td><input type="text" inputmode="decimal" autocomplete="off" data-amount-input data-registrar-actuals-actual="${escapeHtml(entry.key)}" data-registrar-actuals-kind="${escapeHtml(entry.kind)}" aria-label="Real de ${escapeHtml(entry.label)}" value="${entry.hasActual ? formatAmountField(entry.actual) : ""}" placeholder="${escapeHtml(placeholder)}"${titleAttr}${monthClosed ? " disabled" : ""} />${!entry.hasActual && !monthClosed ? `<button type="button" class="e19-btn e19-btn-secondary registrar-actuals-confirm-btn" data-registrar-actuals-confirm="${escapeHtml(entry.key)}" data-registrar-actuals-kind="${escapeHtml(entry.kind)}" data-registrar-actuals-planned="${entry.planned}">Confirmar previsto (${escapeHtml(money(entry.planned, true))})</button>` : ""}</td>
    <td data-label="Usado"><strong>${money(entry.used, true)}</strong></td>
    <td data-label="Desviación" class="${varianceClassForKind(entry.kind, entry.hasActual ? entry.variance : "")}">${entry.hasActual ? registrarMesSignedMoney(entry.variance) : "—"}</td>
    <td><span class="status-pill ${status.tone}">${escapeHtml(status.label)}</span></td>
  </tr>`;
}

function renderRegistrarActuals() {
  const select = qs("registrarActualsMonth");
  if (!select) return;
  const months = registrarActualsMonths();
  const previous = select.value;
  select.innerHTML = months
    .map((month) => `<option value="${escapeHtml(month.key)}">${escapeHtml(month.label)}${month.closed ? " · cerrado" : ""}</option>`)
    .join("");
  select.value = months.some((month) => month.key === previous) ? previous : registrarActualsDefaultMonthKey();

  const month = registrarActualsSelectedMonth();
  const monthClosed = Boolean(month && isClosedMonthKey(month.key));
  if (qs("registrarActualsClosedNote")) qs("registrarActualsClosedNote").hidden = !monthClosed;

  const allEntries = registrarActualsEntries(month);
  const blocks = registrarActualsBlocks(allEntries);
  if (registrarActualsBlockFilter !== "todos" && !blocks.includes(registrarActualsBlockFilter)) {
    registrarActualsBlockFilter = "todos";
  }
  const filtersEl = qs("registrarActualsFilters");
  if (filtersEl) {
    filtersEl.innerHTML = ["todos", ...blocks]
      .map((value) => {
        const count = value === "todos" ? allEntries.length : allEntries.filter((entry) => entry.sectionName === value).length;
        const isActive = registrarActualsBlockFilter === value;
        return `<button type="button" class="registrar-actuals-filter${isActive ? " is-active" : ""}" data-registrar-actuals-block="${escapeHtml(value)}" aria-pressed="${isActive ? "true" : "false"}">${escapeHtml(value === "todos" ? "Todos" : value)} (${count})</button>`;
      })
      .join("");
  }

  const visible = registrarActualsBlockFilter === "todos" ? allEntries : allEntries.filter((entry) => entry.sectionName === registrarActualsBlockFilter);
  if (qs("registrarActualsBulk")) qs("registrarActualsBulk").innerHTML = RegistrarActualsConfirm?.bulkButtonHtml(visible.filter((entry) => !entry.hasActual).length, registrarActualsBlockFilter, { escapeHtml, disabled: monthClosed, selectedCount: visible.filter((entry) => !entry.hasActual && registrarActualsSelectedKeys.has(entry.key)).length }) || "";

  if (qs("registrarActualsBody")) {
    qs("registrarActualsBody").innerHTML = visible.length
      ? visible.map((entry) => registrarActualsRowHtml(entry, monthClosed, month)).join("")
      : `<tr><td colspan="7" class="registrar-mes-empty">Este bloque no tiene partidas este mes.</td></tr>`;
  }

  const totals = registrarActualsTotals(visible);
  if (qs("registrarActualsTotals")) {
    qs("registrarActualsTotals").innerHTML = `<tr class="registrar-actuals-totals-row">
      <td colspan="2">Total (${totals.captured}/${totals.lines} con real)</td>
      <td data-label="Previsto">${money(totals.planned, true)}</td>
      <td></td>
      <td data-label="Usado"><strong>${money(totals.used, true)}</strong></td>
      <td data-label="Desviación">${totals.captured ? registrarMesSignedMoney(totals.variance) : "—"}</td>
      <td></td>
    </tr>`;
  }
}

function renderRegistrarTabs() {
  const nav = qs("registrarTabs");
  if (!nav) return;
  const badges = registrarTabBadges();
  nav.querySelectorAll("[data-registrar-tab]").forEach((button) => {
    const isActive = button.dataset.registrarTab === registrarActiveTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  nav.querySelectorAll("[data-registrar-badge]").forEach((badge) => {
    badge.textContent = badges[badge.dataset.registrarBadge] || "";
  });
  document.querySelectorAll("[data-registrar-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.registrarPanel !== registrarActiveTab;
  });
  // ARQ-6: bloques que acompañan a más de una pestaña (bandeja común y «Deshacer último lote»).
  document.querySelectorAll("[data-registrar-panels]").forEach((panel) => {
    panel.hidden = !panel.dataset.registrarPanels.split(" ").includes(registrarActiveTab);
  });
  const activeTab = REGISTRAR_TABS.find((tab) => tab.id === registrarActiveTab);
  if (qs("registrarCrumb")) qs("registrarCrumb").textContent = `Registrar › ${activeTab?.label || ""}`;
  renderBalancePulse(); // WP-26: el reloj del pulso sabe en qué pestaña se está
}

function renderRegistrarHeaderMeta() {
  const meta = qs("registrarSourceNote");
  if (!meta) return;
  const source = state?.balanceMode === "manual" ? "saldos declarados a mano" : "libro canónico calculado";
  const savedAt = lastLocalSaveAt
    ? `guardado hace poco, a las ${new Date(lastLocalSaveAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
    : "sin guardar todavía en esta sesión";
  meta.innerHTML = `<span class="e19-registrar-meta-item">Fuente del libro: ${escapeHtml(source)} · ${escapeHtml(savedAt)}</span>
    <span class="e19-registrar-meta-item">Flujo: Saldo de cuentas → Reales del mes → Importar extracto → Lote y Excel</span>`;
}

function renderRegistrarRecalcCard() {
  const grid = qs("registrarRecalcGrid");
  if (!grid) return;
  grid.innerHTML = registrarRecalcFigures()
    .map((item) => `<div class="e19-registrar-recalc-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`)
    .join("");
}

function registrarDeltaText(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return "";
  const delta = round2(current - baseline);
  if (delta === 0) return "Sin cambios frente al guardado.";
  return `${delta > 0 ? "+" : ""}${money(delta, true)} frente al guardado.`;
}

function renderRegistrarBalanceDelta() {
  if (!registrarBalanceBaseline) return;
  const caixaEl = document.querySelector('[data-registrar-delta="caixa"]');
  const mediolanumEl = document.querySelector('[data-registrar-delta="mediolanum"]');
  if (caixaEl) caixaEl.textContent = registrarDeltaText(parseAmountField(qs("registrarCaixaBalance")?.value), registrarBalanceBaseline.caixa);
  if (mediolanumEl) {
    mediolanumEl.textContent = registrarDeltaText(parseAmountField(qs("registrarMediolanumBalance")?.value), registrarBalanceBaseline.mediolanum);
  }
}

// Cuatro cifras de la sesión completa (no de la última casilla tocada): cada una compara el valor
// actual contra la foto tomada antes del primer cambio sin consolidar.
function registrarImpactRows(baseline, current) {
  const reserveDelta = round2(current.reserveMargin - baseline.reserveMargin);
  const coverageDelta = current.coverageDays === null || baseline.coverageDays === null ? null : current.coverageDays - baseline.coverageDays;
  const worstDelta = current.worstMonthValue === null || baseline.worstMonthValue === null ? null : round2(current.worstMonthValue - baseline.worstMonthValue);
  return [
    {
      label: "Reserva sobre el mínimo",
      value: money(current.reserveMargin, true),
      note: reserveDelta === 0 ? "Sin cambios en la sesión" : `${reserveDelta > 0 ? "+" : ""}${money(reserveDelta, true)} en la sesión`,
      warn: current.reserveMargin < 0,
    },
    {
      label: "Cobertura hasta el siguiente ingreso",
      value: current.coverageDays === null ? HOME_MISSING_VALUE : `${current.coverageDays} ${current.coverageDays === 1 ? "día" : "días"}`,
      note: !coverageDelta ? "Sin cambios en la sesión" : `${coverageDelta > 0 ? "+" : ""}${coverageDelta} ${Math.abs(coverageDelta) === 1 ? "día" : "días"} en la sesión`,
    },
    {
      label: "Fecha libre de deuda",
      value: current.debtFreeDateLabel,
      note: current.debtFreeDateRank === baseline.debtFreeDateRank ? "Sin cambios en la sesión" : "Cambia frente al inicio de la sesión",
    },
    {
      label: "Peor mes del horizonte",
      value: current.worstMonthLabel,
      note: !worstDelta ? "Sin cambios en la sesión" : `${worstDelta > 0 ? "+" : ""}${money(worstDelta, true)} en la sesión`,
    },
  ];
}

function renderRegistrarImpactFooter() {
  const bar = qs("registrarImpactBar");
  if (!bar) return;
  if (registrarSessionConsolidatedNote) {
    bar.hidden = false;
    bar.classList.remove("is-warning");
    bar.innerHTML = `<p class="e19-registrar-impact-note">${escapeHtml(registrarSessionConsolidatedNote)}</p>`;
    return;
  }
  if (!registrarSessionChanges.length || !registrarSessionBaselineMetrics) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  const current = registrarSessionMetrics();
  const rows = registrarImpactRows(registrarSessionBaselineMetrics, current);
  const belowMinimum = current.reserveMargin < 0;
  bar.hidden = false;
  bar.classList.toggle("is-warning", belowMinimum);
  bar.innerHTML = `
    <div class="e19-registrar-impact-head">
      <p class="e19-eyebrow">Impacto de la sesión</p>
      <small>${registrarSessionChanges.length} ${registrarSessionChanges.length === 1 ? "cambio" : "cambios"} sin consolidar${belowMinimum ? " · reserva bajo el mínimo" : ""}</small>
    </div>
    ${rows
      .map(
        (row) => `<dl><dt>${escapeHtml(row.label)}</dt><dd${row.warn ? " class=\"is-warning\"" : ""}>${escapeHtml(row.value)}</dd><small>${escapeHtml(row.note)}</small></dl>`
      )
      .join("")}
    <div class="e19-registrar-impact-actions">
      <button type="button" class="e19-btn e19-btn-secondary" data-registrar-impact-discard>Descartar todo</button>
      <button type="button" class="e19-btn e19-btn-primary" data-registrar-impact-save>Guardar cambios</button>
    </div>`;
}

function renderRegistrar() {
  if (!qs("registrarBalancePanel")) return;
  renderRegistrarHeaderMeta();
  renderRegistrarActuals();
  renderRegistrarTabs();
  // ARQ-6: la bandeja común vive ahora aquí (el `case "data-entry"` nunca llega: redirige a Registrar).
  renderE11bStatus();
  // ARQ-6 (sesión 244): «Nuevo dato manual» vive ahora en la pestaña Lote y Excel. Su única llamada
  // anterior estaba igual de inalcanzable que el resto (`case "data-entry"` nunca llega) — los
  // selects de mes y bloque llevaban vacíos, sin poblar, desde el 15 de agosto.
  populateDataEntryControls();
  renderRegistrarRecalcCard();
  resetRegistrarBalanceBaseline();
  renderRegistrarImpactFooter();
  globalThis.renderDatosCola?.(globalThis.FinanceCanonicalDataQueue); // WP-45 (datos-ui.js)
}

function planMesUsadoTitle(entry, monthKey) {
  const monthLabel = ledgerMonthLabel(monthKey);
  if (!entry.hasActual) return `Previsto: sin movimientos registrados en ${monthLabel} todavía.`;
  const count = planMesUsadoMovementCount(entry, monthKey);
  return count
    ? `Real: ${count} movimiento${count === 1 ? "" : "s"} de ${monthLabel}.`
    : "Real: importe introducido a mano en Registrar › Reales del mes.";
}

// P-2 (auditoría del 15 de agosto, Prioridad 3): con la tabla agrupada por bloque (más abajo), el
// nombre de sección de cada fila ya lo dice la cabecera de bloque — repetirlo en una columna propia
// era ruido. Se retira la celda «Bloque»; `data-plan-mes-block` sigue en la fila para que el
// plegado (`handlePlanMesBlockToggle`) sepa a qué bloque pertenece.
// Plan.pdf (04 de 9): «Restante» sustituye a «Desviación» — presupuesto menos gastado, siempre
// visible (nunca «—», incluso sin real todavía: `planMesCollect` lo deja en 0 cuando gastado cae
// al previsto). Positivo es «sobra» (verde); negativo es «falta» (rojo).
function planMesRowHtml(entry, monthClosed, monthKey, collapsed = false, sobresBalance = null, showSobresColumn = false) {
  const rowKey = seriesKeyForRow(entry.row);
  const isFinancing = entry.sectionName === "Financiaciones";
  const plannedCell = isFinancing
    ? `<span class="plan-mes-financing-readonly">${money(entry.planned, true)}<small>se cambia en <button type="button" class="registrar-actuals-plan-link" data-home-nav="deuda-contratos">Deuda</button></small></span>`
    : `<input type="number" step="0.01" inputmode="decimal" data-plan-mes-planned="${escapeHtml(rowKey)}" data-plan-mes-month="${escapeHtml(monthKey)}" aria-label="Previsto de ${escapeHtml(entry.label)}" value="${entry.planned}"${monthClosed ? " disabled" : ""} />`;
  const restante = Number(entry.restante || 0);
  const restanteClass = restante > 0 ? "positive" : restante < 0 ? "negative" : "";
  // P-14: la columna «Arrastre» solo aparece con la bandera activa, y solo tiene valor real para
  // Gastos variables — el resto de bloques muestra «—» en vez de fingir un sobre que no existe.
  const sobresCell = showSobresColumn
    ? `<td data-plan-mes-cell="sobre" class="${sobresBalance === null ? "" : sobresBalance < 0 ? "negative" : "positive"}">${sobresBalance === null ? "—" : money(sobresBalance, true)}</td>`
    : "";
  return `<tr data-plan-mes-key="${escapeHtml(entry.key)}" data-plan-mes-block="${escapeHtml(entry.sectionName)}"${entry.plannedDraft ? ' class="plan-mes-row-draft"' : ""}${collapsed ? " hidden" : ""}>
    <td class="registrar-mes-concept">${escapeHtml(entry.label)}</td>
    <td>${plannedCell}</td>
    <td data-plan-mes-cell="usado"><strong>${money(entry.usado, true)}</strong> <small class="e19-kpi-meta" title="${escapeHtml(planMesUsadoTitle(entry, monthKey))}">${entry.hasActual ? "real" : "previsto"}</small></td>
    <td data-plan-mes-cell="restante" class="${restanteClass}">${registrarMesSignedMoney(restante)}</td>
    ${sobresCell}
  </tr>`;
}

function planMesGroupBySection(list) {
  const order = [];
  const bySection = new Map();
  list.forEach((entry) => {
    if (!bySection.has(entry.sectionName)) {
      bySection.set(entry.sectionName, []);
      order.push(entry.sectionName);
    }
    bySection.get(entry.sectionName).push(entry);
  });
  return order.map((sectionName) => {
    const sectionEntries = bySection.get(sectionName);
    return { sectionName, entries: sectionEntries, subtotal: round2(sectionEntries.reduce((sum, entry) => sum + Number(entry.planned || 0), 0)) };
  });
}

function planMesBlockRowHtml(block, showSobresColumn = false) {
  const collapsed = planMesCollapsedBlocks.has(block.sectionName);
  return `<tr class="plan-mes-block-row">
    <td colspan="3">
      <button type="button" class="plan-mes-block-toggle" data-plan-mes-block-toggle="${escapeHtml(block.sectionName)}" aria-expanded="${collapsed ? "false" : "true"}">
        <span class="plan-mes-block-caret" aria-hidden="true"></span>${escapeHtml(block.sectionName)}
      </button>
    </td>
    <td class="plan-mes-block-subtotal">${money(block.subtotal, true)}</td>
    ${showSobresColumn ? "<td></td>" : ""}
  </tr>`;
}

// Plan.pdf (04 de 9): «una sola tabla «Presupuesto de [mes]» con cabeceras de sección... y
// subtotal por bloque, plegable». Sustituye la tarjeta plana de Gastos; Ingresos se fusiona aquí
// como primer bloque (la propia lista de entrada ya lo trae en cabeza — ver renderPlanMes), tal
// como pide el inventario de la sección A del mockup («agrupada por bloques: ingresos, fijos,
// variables, deuda y ahorro»). Columnas renombradas a Presupuesto/Gastado/Restante (antes
// Previsto/Usado/Desviación) para que coincidan con el mockup; «Restante» ya viene calculado en
// `planMesCollect` (positivo = sobra, negativo = falta), no en esta función.
function planMesBudgetTableHtml(list, month, monthClosed, extraFootHtml = "") {
  const showSobres = sobresEnabled();
  const balanceByKey = new Map(showSobres ? sobresMonthBalances(month).map((item) => [item.rowKey, item.saldo]) : []);
  const blocks = planMesGroupBySection(list);
  const body = blocks.length
    ? blocks
        .map((block) => {
          const collapsed = planMesCollapsedBlocks.has(block.sectionName);
          const rows = block.entries
            .map((entry) => {
              const rowKey = seriesKeyForRow(entry.row);
              const sobresBalance = entry.sectionName === "Gastos variables" && balanceByKey.has(rowKey) ? balanceByKey.get(rowKey) : null;
              return planMesRowHtml(entry, monthClosed, month.key, collapsed, sobresBalance, showSobres);
            })
            .join("");
          return `${planMesBlockRowHtml(block, showSobres)}${rows}`;
        })
        .join("")
    : `<tr><td colspan="${showSobres ? 5 : 4}" class="registrar-mes-empty">Este mes no tiene partidas de este tipo.</td></tr>`;
  const pendingCount = list.filter((entry) => entry.plannedDraft).length;
  const savedBadge = pendingCount
    ? `<span class="e19-badge e19-badge-warning">${pendingCount} sin guardar</span>`
    : `<span class="e19-badge e19-badge-success">Todo guardado</span>`;
  const sobreCount = showSobres ? list.filter((entry) => entry.sectionName === "Gastos variables").length : 0;
  const footNote = `${list.length} partida${list.length === 1 ? "" : "s"} en ${blocks.length} bloque${blocks.length === 1 ? "" : "s"}${showSobres ? ` · ${sobreCount} declarada${sobreCount === 1 ? "" : "s"} como sobre` : ""}`;
  return `<article class="e19-card registrar-mes-card">
    <div class="registrar-mes-card-head plan-mes-budget-head">
      <div>
        <h3 class="escenario-motor-panel-title">Presupuesto de ${escapeHtml(month.label)}</h3>
        <p class="e19-subtitle">Presupuesto editable · gastado de solo lectura${showSobres ? " · dos columnas de sobre" : ""}</p>
      </div>
      ${savedBadge}
    </div>
    <div class="table-wrap">
      <table class="e19-table registrar-mes-table plan-mes-budget-table">
        <thead><tr><th>Partida</th><th>Presupuesto</th><th>Gastado</th><th>Restante</th>${showSobres ? "<th>Arrastre</th>" : ""}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="registrar-mes-card-foot plan-mes-table-foot">
      <p class="e19-kpi-note">${escapeHtml(footNote)}</p>
      <button type="button" class="registrar-actuals-plan-link" data-home-nav="registrar">Añadir partida</button>
    </div>
    ${extraFootHtml ? `<div class="registrar-mes-card-foot">${extraFootHtml}</div>` : ""}
  </article>`;
}
