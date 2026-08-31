// PERF-1 (FASE 6, escala #2): código exclusivo de las vistas "deuda-comparar", "deuda-ruta",
// "deuda-contratos" y "deuda-simulador", extraído de app.js. Se carga bajo demanda (ver
// loadViewChunk() en app.js) la primera vez que se visita cualquiera de las cuatro — es un solo
// fragmento porque comparten helpers entre sí (renderDeudaCompararModes/renderDeudaRuta/
// renderDeudaContratos), no cuatro. <script> clásico, no módulo ES: sus declaraciones de nivel
// superior aterrizan en el mismo scope global de siempre. Lo que otras vistas necesitan
// (debtAmortizationSchedule para Análisis; saveDebtCapitalSnapshotAtClose/debtCapitalCuadre para
// Cierre) se quedó en app.js.

function renderDeudaCompararModes() {
  const contractSelect = qs("deudaCompararModeContract");
  const modeSelect = qs("deudaCompararModeSelect");
  const fieldsBox = qs("deudaCompararModeFields");
  const resultBox = qs("deudaCompararModeResult");
  const compareBody = qs("deudaCompararModeCompareBody");
  const applyButton = qs("deudaCompararModeApply");
  if (!contractSelect || !modeSelect || !fieldsBox || !resultBox) return;

  const contracts = escenarioMotorDebtOptions();
  if (!contracts.length) {
    contractSelect.innerHTML = '<option value="">Sin deudas vivas</option>';
    modeSelect.innerHTML = "";
    fieldsBox.innerHTML = "";
    resultBox.innerHTML = '<p class="e19-kpi-note">Sin deudas vivas: no hay ningún contrato al que aplicar un modo.</p>';
    if (compareBody) compareBody.innerHTML = "";
    if (applyButton) applyButton.disabled = true;
    return;
  }
  if (!debtModeContractId || !contracts.some((contract) => contract.id === debtModeContractId)) {
    debtModeContractId = contracts[0].id;
  }
  const contract = debtModeSelectedContract();
  const def = debtModeDefById(debtModeId);

  if (document.activeElement !== contractSelect) contractSelect.innerHTML = debtModeContractOptionsHtml(contracts, debtModeContractId);
  if (!modeSelect.childElementCount) {
    modeSelect.innerHTML = DEBT_MODE_DEFINITIONS.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("");
  }
  if (document.activeElement !== modeSelect) modeSelect.value = debtModeId;

  const baseInput = escenarioMotorBaseInput();
  if (!fieldsBox.contains(document.activeElement)) {
    const campos = debtModeVisibleCampos(def);
    const values = debtModeEffectiveValues();
    fieldsBox.innerHTML = campos
      .map((field) =>
        escenarioMotorFieldHtml(field, baseInput.months, values, {
          idPrefix: "debtModeField",
          dataAttr: "data-debt-mode-field",
          wrapAttr: "data-debt-mode-field-wrap",
        })
      )
      .join("");
  }

  const reserveValue = debtStrategyReserveValue;
  const activeResult = debtModeResultForContract(contract, def, debtModeEffectiveValues(), baseInput, reserveValue);
  if (!activeResult.available) {
    resultBox.innerHTML = `<p class="e19-kpi-note is-warn">${escapeHtml(debtModeUnavailableNote(contract, activeResult))}</p>`;
    if (applyButton) applyButton.disabled = true;
  } else {
    const info = escenarioMotorResultInfo(activeResult.resultado?.resultado);
    resultBox.innerHTML = `
      <div><span>Mes resuelto</span><strong>${escapeHtml(activeResult.mesResuelto ? escenarioMotorMonthLabel(activeResult.mesResuelto) : "—")}</strong></div>
      <div><span>Coste</span><strong>${escapeHtml(escenarioMotorDecisionAmountText(activeResult.decision))}</strong></div>
      <div><span>Caja mínima</span><strong>${money(activeResult.cajaMinima ?? 0, true)}</strong></div>
      <div><span>Resultado</span><strong><span class="e19-badge ${info.badge}">${escapeHtml(info.text)}</span></strong></div>
    `;
    if (applyButton) applyButton.disabled = !activeResult.viable;
  }

  // D-6 · los ocho a la vez sobre el mismo contrato. El modo activo usa sus valores editados en el
  // formulario de arriba (para que la fila se mueva mientras se teclea); el resto usa sus propios
  // valores por defecto, nunca los del modo activo — mezclar importes de un modo en otro daría una
  // comparación que no es la que cada modo ofrecería por sí solo.
  if (compareBody) {
    const planBaseline = debtModePlanBaseline(baseInput, reserveValue);
    const rows = DEBT_MODE_DEFINITIONS.map((item) => {
      const itemValues = item.id === debtModeId ? debtModeEffectiveValues() : debtModeDefaultValues(contract, item);
      const itemResult = debtModeResultForContract(contract, item, itemValues, baseInput, reserveValue);
      return { item, itemResult };
    });
    compareBody.innerHTML = rows
      .map(({ item, itemResult }) => {
        const rowClass = item.id === debtModeId ? ' class="is-active"' : "";
        if (!itemResult.available) {
          return `<tr${rowClass} data-deuda-comparar-mode-row="${escapeHtml(item.id)}">
            <td>${escapeHtml(item.label)}</td>
            <td colspan="5">${escapeHtml(debtModeUnavailableNote(contract, itemResult))}</td>
            <td><button type="button" class="e19-btn e19-btn-secondary" data-deuda-comparar-mode-usar="${escapeHtml(item.id)}">Usar</button></td>
          </tr>`;
        }
        return `<tr${rowClass} data-deuda-comparar-mode-row="${escapeHtml(item.id)}">
          <td>${escapeHtml(item.label)}</td>
          ${debtModeIndicatorsHtml(item, itemResult, contract, planBaseline)}
          <td><button type="button" class="e19-btn e19-btn-secondary" data-deuda-comparar-mode-usar="${escapeHtml(item.id)}">Usar</button></td>
        </tr>`;
      })
      .join("");
    renderDeudaCompararModeInsight(rows, contract);
  }
}

// D-6: "el plan" es el escenario sin ninguna decisión de deuda — el mismo concepto que "no tocar
// nada" ya usa la comparativa de las cuatro estrategias, aplicado aquí a los ocho modos de un solo
// contrato. Caja mínima es la única cifra directamente comparable contra ese plan (coste y cuota
// del plan son cero/las declaradas por definición, así que se colorean contra el propio contrato:
// coste frente al principal pendiente, cuota resultante frente a la cuota actual).
function debtModePlanBaseline(baseInput, reserveValue) {
  const result = runEscenarioMotor(baseInput, [], debtStrategyEffectiveReserve(reserveValue));
  if (!result || !result.valid) return null;
  const cajaMinima = result.series?.length ? Math.min(...result.series.map((row) => row.totalLiquidity)) : null;
  return { cajaMinima };
}

// La cuota que queda tras cada modo depende del tipo: una amortización única salda del todo (cuota
// futura: 0), refinanciar y retomar pagos declaran su propia cuota nueva, y la fraccionada añade un
// extra mensual sin tocar la cuota declarada del contrato (por eso devuelve la misma, no null: sigue
// siendo una cifra real y comparable, solo que no cambia con este modo).
function debtModeResultingPayment(def, itemResult, contract) {
  const params = itemResult.decision?.params || {};
  if (def.tipoId === "amortizacion") return 0;
  if (def.tipoId === "refinanciacion") return Number.isFinite(Number(params.nuevaCuota)) ? Number(params.nuevaCuota) : null;
  if (def.tipoId === "retomar_pagos") return Number.isFinite(Number(params.cuota)) ? Number(params.cuota) : null;
  if (def.tipoId === "amortizacion_fraccionada") return round2(Number(contract?.currentPayment || 0));
  return null;
}

function debtModeCosteNumeric(def, itemResult) {
  const params = itemResult.decision?.params || {};
  if (def.tipoId === "amortizacion") return round2(Number(params.importe || 0));
  if (def.tipoId === "amortizacion_fraccionada") return round2(Number(params.importeMensual || 0) * Number(params.meses || 0));
  if (def.tipoId === "refinanciacion") return round2(Number(params.nuevoPrincipal || 0));
  if (def.tipoId === "retomar_pagos") return round2(Number(params.cuota || 0));
  return 0;
}

function debtCompareToneClass(comparison) {
  return comparison === "mejor" ? "positive" : comparison === "peor" ? "negative" : "";
}

// Cinco indicadores del criterio: mes resuelto, caja mínima (vs el plan sin decisión), coste (vs el
// principal pendiente: pagar menos que la deuda entera es la única forma honesta de "mejor" sin
// inventar un coste de referencia para el plan, que por definición es cero), cuota resultante (vs
// la cuota actual) y el resultado viable/no viable.
function debtModeIndicatorsHtml(item, itemResult, contract, planBaseline) {
  const info = escenarioMotorResultInfo(itemResult.resultado?.resultado);
  const cajaComparison = planBaseline?.cajaMinima === null || planBaseline?.cajaMinima === undefined
    ? ""
    : (itemResult.cajaMinima ?? 0) >= planBaseline.cajaMinima
      ? "mejor"
      : "peor";
  const principal = Number(contract?.currentPrincipal || 0);
  const coste = debtModeCosteNumeric(item, itemResult);
  const costeComparison = principal > 0 ? (coste < principal ? "mejor" : "peor") : "";
  const cuotaActual = Number(contract?.currentPayment || 0);
  const cuotaResultante = debtModeResultingPayment(item, itemResult, contract);
  const cuotaComparison = cuotaResultante === null ? "" : cuotaResultante < cuotaActual ? "mejor" : cuotaResultante > cuotaActual ? "peor" : "";
  return `
    <td>${escapeHtml(itemResult.mesResuelto ? escenarioMotorMonthLabel(itemResult.mesResuelto) : "—")}</td>
    <td class="${debtCompareToneClass(cajaComparison)}">${money(itemResult.cajaMinima ?? 0, true)}</td>
    <td class="${debtCompareToneClass(costeComparison)}">${money(coste, true)}</td>
    <td class="${debtCompareToneClass(cuotaComparison)}">${cuotaResultante === null ? "—" : money(cuotaResultante, true)}</td>
    <td><span class="e19-badge ${info.badge}">${escapeHtml(info.text)}</span></td>
  `;
}

// D-6: veredicto en prosa que nombra el supuesto principal — mismo patrón que deudaCompararInsight
// para las estrategias, aplicado al modo con mejor caja mínima entre los viables de este contrato.
function renderDeudaCompararModeInsight(rows, contract) {
  const insight = qs("deudaCompararModeInsight");
  if (!insight) return;
  const viable = rows.filter(({ itemResult }) => itemResult.available && itemResult.viable);
  if (!viable.length || !contract) {
    insight.hidden = true;
    return;
  }
  const best = viable.reduce((top, current) => ((current.itemResult.cajaMinima ?? -Infinity) > (top.itemResult.cajaMinima ?? -Infinity) ? current : top));
  insight.hidden = false;
  insight.innerHTML = `<strong>${escapeHtml(best.item.label)} deja la mejor caja mínima para ${escapeHtml(escenarioMotorDebtLabel(contract))}</strong>
    <p>Caja mínima de ${money(best.itemResult.cajaMinima ?? 0, true)}, resuelta en ${escapeHtml(best.itemResult.mesResuelto ? escenarioMotorMonthLabel(best.itemResult.mesResuelto) : "—")}. Supuesto principal: TIN, cuota y plazo son los declarados en el contrato o los que se hayan escrito arriba — cambiarlos cambia esta comparación.</p>`;
}

function handleDeudaCompararModeContractChange(event) {
  debtModeContractId = event.target.value;
  debtModeValues = {};
  renderDeudaCompararModes();
}

function handleDeudaCompararModeSelectChange(event) {
  debtModeId = event.target.value;
  debtModeValues = {};
  renderDeudaCompararModes();
}

function handleDeudaCompararModeFieldChange(event) {
  const key = event.target?.dataset?.debtModeField;
  if (!key) return;
  const def = debtModeDefById(debtModeId);
  const type = escenarioMotorTypeById(def.tipoId);
  const field = type?.campos.find((item) => item.key === key);
  if (!field) return;
  debtModeValues[key] = escenarioMotorReadFieldValue(field, event.target);
  renderDeudaCompararModes();
}

function handleDeudaCompararModeCompareClick(event) {
  const button = event.target.closest("[data-deuda-comparar-mode-usar]");
  if (!button) return;
  debtModeId = button.dataset.deudaCompararModeUsar;
  debtModeValues = {};
  renderDeudaCompararModes();
}

function handleDeudaCompararModeApply() {
  const contract = debtModeSelectedContract();
  const def = debtModeDefById(debtModeId);
  const result = debtModeResultForContract(contract, def, debtModeEffectiveValues(), escenarioMotorBaseInput(), debtStrategyReserveValue);
  if (!result.available || !result.viable) return;
  escenarioMotorDecisions = [{ ...result.decision, id: escenarioMotorNewDecisionId() }];
  escenarioMotorGuardrailValue = debtStrategyReserveValue;
  escenarioMotorNavigate("escenario-aplicar");
}

// La nota al pie de cada tarjeta. Es el único sitio donde se explica por qué una estrategia no
// tiene cifras, así que nunca se queda en blanco cuando falta algo: o dice qué falta, o dice qué
// hace la estrategia, o no dice nada porque no hay nada que advertir.
function debtStrategyStatusNote(entry) {
  if (entry.id === "consolidar") {
    const plan = entry.consolidacion;
    if (!plan || !plan.available) {
      if (plan?.motivo === "cartera") {
        return `Reunificar exige al menos dos deudas vivas; ahora mismo el motor ve ${plan.contracts.length}.`;
      }
      return "Falta la oferta: escribe arriba el TIN y el plazo que te ofrecen y esta estrategia se simula como las otras tres.";
    }
    if (!entry.viable) return "Con esta oferta no hay ningún mes del horizonte en que la reunificación respete la reserva mínima.";
    return `Sustituye ${plan.contracts.length} deudas por un préstamo de ${money(plan.principal, true)} a ${plan.plazo} meses: ${money(plan.cuota, true)} al mes. No exige desembolso.`;
  }
  if (entry.total === 0) return "Referencia: nada cambia.";
  if (entry.viable) return "";
  return `${entry.aplicadas}/${entry.total} decisiones viables en este horizonte.`;
}

function renderDeudaComparar() {
  renderDeudaScreenTabs("deuda-comparar");
  renderScenarioDependencyNotice("deuda-comparar");
  const capacityEl = qs("deudaCompararCapacity");
  if (capacityEl) capacityEl.innerHTML = debtCapacityHtml(debtCapacityStatus());
  const grid = qs("deudaCompararGrid");
  if (!grid) return;
  const reserveField = qs("deudaCompararReserve");
  if (debtStrategyReserveValue === null) debtStrategyReserveValue = debtStrategyReserveDefault();
  if (reserveField && document.activeElement !== reserveField) reserveField.value = debtStrategyReserveValue ?? "";
  renderDeudaCompararReserveNote();
  renderDeudaCompararOffer();
  renderDeudaCompararModes();

  const baseInput = escenarioMotorBaseInput();
  const summaries = DEBT_STRATEGY_DEFINITIONS.map((def) => ({ id: def.id, def, ...debtStrategySummary(def.id, baseInput, debtStrategyReserveValue) }));
  const recommendedId = debtStrategyRecommended(summaries);
  // T-5 · sin motor, `costeTotal` y `cajaMinima` valen 0 porque no se ha calculado nada, y «0,00 €»
  // se lee como una respuesta. Junto al aviso rojo sería además contradictorio: se escribe «—».
  const calculado = !missingScenarioDependencies().length;
  const cifra = (value) => (calculado ? money(value ?? 0, true) : "—");

  grid.innerHTML = summaries
    .map((entry) => {
      const isRecommended = entry.id === recommendedId;
      const statusNote = debtStrategyStatusNote(entry);
      // V3-3 · «Consolidar» sin oferta no es una estrategia sin cifras: es una estrategia que no se
      // ha podido simular. Sus KPI se escriben «—» por la misma razón que en modo degradado (T-5):
      // un «0,00 €» ahí se leería como un resultado calculado.
      const sinCalcular = entry.id === "consolidar" && entry.consolidacion && !entry.consolidacion.available;
      const kpi = (value) => (sinCalcular ? "—" : cifra(value));
      return `<article class="e19-card deuda-decidir-strategy-card${isRecommended ? " is-recommended" : ""}">
        ${isRecommended ? '<span class="e19-badge e19-badge-success deuda-decidir-strategy-flag">Recomendada</span>' : ""}
        <h3>${escapeHtml(entry.def.label)}</h3>
        <p class="e19-kpi-note">${escapeHtml(entry.def.desc)}</p>
        <div class="deuda-decidir-strategy-kpis">
          <div><span>Libre de deuda</span><strong>${escapeHtml(sinCalcular ? "—" : escenarioMotorMonthLabel(entry.libreDeDeuda))}</strong></div>
          <div><span>${escapeHtml(entry.def.costeLabel || DEBT_STRATEGY_COSTE_LABEL)}</span><strong>${kpi(entry.costeTotal)}</strong></div>
          <div><span>Caja mínima</span><strong>${kpi(entry.cajaMinima)}</strong></div>
        </div>
        ${statusNote ? `<p class="e19-kpi-note ${entry.viable && entry.total > 0 ? "" : "is-warn"}">${escapeHtml(statusNote)}</p>` : ""}
        <div class="deuda-decidir-strategy-actions">
          <button type="button" class="e19-btn e19-btn-secondary" data-deuda-comparar-ruta="${escapeHtml(entry.id)}">Ver ruta</button>
          ${entry.total > 0 && !sinCalcular ? `<button type="button" class="e19-btn e19-btn-secondary" data-deuda-comparar-guardar="${escapeHtml(entry.id)}">Guardar como escenario</button>` : ""}
          ${isRecommended ? `<button type="button" class="e19-btn e19-btn-primary" data-deuda-comparar-aplicar="${escapeHtml(entry.id)}">Aplicar la recomendada</button>` : ""}
        </div>
      </article>`;
    })
    .join("");

  const insight = qs("deudaCompararInsight");
  const noTouch = summaries.find((entry) => entry.id === "no-tocar");
  const recommended = summaries.find((entry) => entry.id === recommendedId);
  if (insight) {
    if (recommended && noTouch && recommended.id !== "no-tocar") {
      const costeDelta = round2(noTouch.costeTotal - recommended.costeTotal);
      // D-11: coste marginal por mes de demora — cuántos meses de más se tarda en quedar libre de
      // deuda por seguir en "no tocar nada" en vez de decidir ya, y cuánto sale de media cada uno de
      // esos meses. Mismo costeDelta ya calculado arriba, repartido entre los meses reales de
      // diferencia (debtStrategyMonthsBetween devuelve null sin dos fechas reales que restar).
      const monthsDelay = debtStrategyMonthsBetween(recommended.libreDeDeuda, noTouch.libreDeDeuda);
      const costeMarginalTexto = monthsDelay > 0 && costeDelta
        ? ` Cada mes que se tarda en decidir cuesta de media ${money(round2(Math.abs(costeDelta) / monthsDelay), true)}.`
        : "";
      insight.hidden = false;
      insight.innerHTML = `<strong>${escapeHtml(recommended.def.label)} sale mejor que no tocar nada</strong>
        <p>Libre de deuda con ${escapeHtml(recommended.def.label.toLowerCase())}: ${escapeHtml(escenarioMotorMonthLabel(recommended.libreDeDeuda))} (sin tocar nada: ${escapeHtml(escenarioMotorMonthLabel(noTouch.libreDeDeuda))})${costeDelta ? `, con ${money(Math.abs(costeDelta), true)} ${costeDelta >= 0 ? "menos" : "más"} de coste ejecutado` : ""}.${costeMarginalTexto}</p>`;
    } else {
      insight.hidden = true;
    }
  }
}

// V6-1 · de dónde sale la cifra que hay en la casilla: de la reserva operativa del hogar, de un
// valor escrito solo para esta comparación, o de nada. Se dice cuál de los tres, nunca se supone.
function renderDeudaCompararReserveNote() {
  const note = qs("deudaCompararReserveNote");
  if (!note) return;
  const household = cuadroMandosReserve();
  if (Number.isFinite(debtStrategyReserveValue) && household > 0 && round2(debtStrategyReserveValue) === round2(household)) {
    note.textContent = `Es tu reserva operativa (${money(household, true)}). Cámbiala aquí solo para esta comparación.`;
    return;
  }
  if (Number.isFinite(debtStrategyReserveValue)) {
    note.textContent = household > 0
      ? `Solo para esta comparación. Tu reserva operativa es ${money(household, true)}.`
      : "Solo para esta comparación: no se guarda como reserva del hogar.";
    return;
  }
  note.textContent = household > 0
    ? `Vacío usa un suelo de 0 €. Tu reserva operativa es ${money(household, true)}.`
    : "Sin reserva operativa configurada: se secuencia con un suelo de 0 €. Puedes fijarla en Ajustes.";
}

// V3-3 · las tres casillas de la oferta y la nota que dice qué se está comparando. La nota no
// repite lo que ya está escrito en las casillas: dice de qué se compone el principal —que es lo
// único que el usuario no teclea y podría malinterpretar— y qué pasa con la comisión.
function renderDeudaCompararOffer() {
  const offer = debtConsolidationOffer();
  const fields = [
    ["deudaCompararOfferTin", offer.tin],
    ["deudaCompararOfferPlazo", offer.plazo],
    ["deudaCompararOfferComision", offer.comision],
  ];
  fields.forEach(([id, value]) => {
    const field = qs(id);
    if (field && document.activeElement !== field) field.value = Number.isFinite(value) ? value : "";
  });
  const expiresAtField = qs("deudaCompararOfferExpiresAt");
  if (expiresAtField && document.activeElement !== expiresAtField) expiresAtField.value = offer.expiresAt || "";

  const note = qs("deudaCompararOfferNote");
  if (!note) return;
  const plan = debtConsolidationPlan();
  if (plan.motivo === "cartera") {
    note.textContent = `Con ${plan.contracts.length} deuda(s) viva(s) no hay nada que reunificar: hacen falta al menos dos.`;
    return;
  }
  if (!plan.available) {
    note.textContent = "Sin TIN y plazo no se puede calcular la cuota, así que «Consolidar» no se compara. La comisión es opcional.";
    return;
  }
  const comisionTexto = plan.comision > 0
    ? ` (${money(plan.saldos, true)} de saldos + ${money(plan.comision, true)} de comisión, financiada dentro del préstamo)`
    : "";
  // D-10/E-13: la vigencia es opcional, así que solo se avisa cuando existe.
  const expiry = offer.expiresAt ? debtOfferExpiryStatus(offer.expiresAt) : null;
  const vigenciaTexto = expiry
    ? expiry.expired
      ? ` Oferta CADUCADA desde ${escenarioMotorMonthLabel(offer.expiresAt)}.`
      : expiry.dueSoon
        ? ` Oferta a punto de caducar: vence ${escenarioMotorMonthLabel(offer.expiresAt)}.`
        : ` Vigente hasta ${escenarioMotorMonthLabel(offer.expiresAt)}.`
    : "";
  note.textContent = `Principal del préstamo nuevo: ${money(plan.principal, true)}${comisionTexto}. Devolverías ${money(plan.totalDevuelto, true)} en total, ${money(plan.intereses, true)} de intereses.${vigenciaTexto}`;
}

function handleDeudaCompararOfferInput() {
  const read = (id, { entero = false } = {}) => {
    const raw = (qs(id)?.value ?? "").trim();
    if (raw === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return null;
    return entero ? Math.round(value) : value;
  };
  saveDebtConsolidationOffer({
    tin: read("deudaCompararOfferTin"),
    plazo: read("deudaCompararOfferPlazo", { entero: true }),
    comision: read("deudaCompararOfferComision"),
    expiresAt: qs("deudaCompararOfferExpiresAt")?.value || "",
  });
  renderDeudaComparar();
}

function handleDeudaCompararOfferClear() {
  saveDebtConsolidationOffer({ tin: null, plazo: null, comision: null, expiresAt: "" });
  ["deudaCompararOfferTin", "deudaCompararOfferPlazo", "deudaCompararOfferComision", "deudaCompararOfferExpiresAt"].forEach((id) => {
    const field = qs(id);
    if (field) field.value = "";
  });
  renderDeudaComparar();
  announceStatus("Oferta de reunificación borrada. «Consolidar» vuelve a quedarse sin cifras.");
}

function handleDeudaCompararReserveInput(event) {
  const value = Number(event.target.value);
  debtStrategyReserveValue = Number.isFinite(value) && value > 0 ? value : null;
  renderDeudaComparar();
}

function handleDeudaCompararVerRuta(strategyId) {
  deudaRutaSelectedStrategy = strategyId;
  escenarioMotorNavigate("deuda-ruta");
}

function handleDeudaCompararAplicar(strategyId) {
  debtStrategyDecisionsToEscenario(strategyId);
  escenarioMotorNavigate("escenario-aplicar");
}

// D-13: "guardar sin comprometerse" — hasta ahora la única vía desde Deuda › Comparar era "Aplicar
// la recomendada" (D-8, exige motivo y toca el plan). Reutiliza el mismo puente a decisiones que ya
// usa esa vía (debtStrategyDecisionsToEscenario) pero persiste directamente como "guardado" en
// escenario-motor-saved (la misma persistencia reproducible de E-10), sin pasar por el formulario de
// aplicar ni tocar ningún contrato.
// E-13: si la estrategia es "Consolidar" y la oferta de reunificación declara vigencia (D-10), el
// escenario guardado queda enlazado a esa fecha (`ofertaExpiresAt`) para que #escenario-guardados
// pueda marcarlo caducado si la oferta vence antes de aplicarse. Las demás estrategias no dependen
// de ninguna oferta con vencimiento, así que no llevan esa marca.
function handleDeudaCompararGuardarComoEscenario(strategyId) {
  const def = DEBT_STRATEGY_DEFINITIONS.find((item) => item.id === strategyId);
  if (!def) return;
  debtStrategyDecisionsToEscenario(strategyId);
  if (!escenarioMotorDecisions.length) return;
  const offerExpiresAt = strategyId === "consolidar" ? debtConsolidationOffer().expiresAt || "" : "";
  const saved = loadEscenarioMotorSaved();
  escenarioMotorSavedSeq += 1;
  saved.unshift({
    id: `escenario-guardado-${Date.now()}-${escenarioMotorSavedSeq}`,
    nombre: `Comparar · ${def.label}`,
    motivo: "Guardado desde Deuda › Comparar, sin aplicar.",
    estado: "guardado",
    fecha: new Date().toISOString(),
    decisiones: JSON.parse(JSON.stringify(escenarioMotorDecisions)),
    guardrailValue: escenarioMotorGuardrailValue,
    ofertaExpiresAt: offerExpiresAt,
  });
  saveEscenarioMotorSavedList(saved);
  announceStatus(`«${def.label}» guardado como escenario en Escenarios › Guardados. No se ha aplicado nada.`);
}

// Deuda viva = principal pendiente de los contratos que la ruta todavía no ha resuelto en firme
// ("aplicada"). Como cada decisión es un pago total, es una función escalón exacta a partir de
// mesResuelto — no una aproximación de calendario de amortización mes a mes.
function buildDeudaVivaSeries(months, contracts, decisions, resultadosById) {
  const payoffMonthByDebt = new Map();
  // V3-3 · una reunificación no borra deuda: cierra varias y abre una. Si solo se descontaran las
  // cerradas, la gráfica enseñaría la deuda cayendo a cero el mes de la firma, que es exactamente
  // la mentira que hace atractiva a la reunificación. El préstamo nuevo entra en la serie con su
  // principal desde el mes en que se firma y sigue ahí hasta que se agota su plazo — la misma
  // función escalón que se usa para las demás, con la misma simplificación declarada.
  const prestamosNuevos = [];
  decisions.forEach((decision) => {
    const resultado = resultadosById.get(decision.id);
    if (resultado?.resultado !== "aplicada" || !resultado.mesResuelto) return;
    if (decision.tipo === "reunificacion") {
      (decision.params.deudaIds || []).forEach((deudaId) => payoffMonthByDebt.set(deudaId, resultado.mesResuelto));
      const startIndex = months.findIndex((month) => month.monthKey === resultado.mesResuelto);
      const lastIndex = startIndex < 0 ? -1 : startIndex + Math.max(1, Math.floor(Number(decision.params.nuevoPlazo) || 0)) - 1;
      prestamosNuevos.push({
        desde: resultado.mesResuelto,
        // Sin mes de cierre dentro del horizonte, el préstamo sigue vivo hasta el final del tramo
        // dibujado: se dice con `null`, no se inventa un cierre que no se ha calculado.
        hasta: lastIndex >= 0 && lastIndex < months.length ? months[lastIndex].monthKey : null,
        principal: Number(decision.params.nuevoPrincipal) || 0,
      });
      return;
    }
    payoffMonthByDebt.set(decision.params.deudaId, resultado.mesResuelto);
  });
  return months.map((month) => {
    const total = contracts.reduce((sum, contract) => {
      const payoffMonth = payoffMonthByDebt.get(contract.id);
      const alreadySettled = payoffMonth && payoffMonth <= month.monthKey;
      return alreadySettled ? sum : sum + Number(contract.currentPrincipal || 0);
    }, 0);
    const nuevos = prestamosNuevos.reduce((sum, prestamo) => {
      const vigente = prestamo.desde <= month.monthKey && (!prestamo.hasta || month.monthKey <= prestamo.hasta);
      return vigente ? sum + prestamo.principal : sum;
    }, 0);
    return { monthKey: month.monthKey, deudaViva: round2(total + nuevos) };
  });
}

// El horizonte completo del motor (hasta 10 años) hace que la liquidez proyectada crezca muy por
// encima del principal de deuda, que solo importa en los primeros años: en una escala compartida la
// deuda queda aplastada en un hilo casi invisible. Se recorta la ventana a los últimos 6 meses tras
// saldarse la última deuda (o 36 meses si nunca llega a saldarse del todo en este horizonte), igual
// que el mockup solo muestra ~3 años en vez de los 10 completos.
function deudaRutaChartWindow(deudaSeries, liquidezSeries, months) {
  const lastAliveIndex = deudaSeries.reduce((last, row, index) => (row.deudaViva > 0 ? index : last), -1);
  const end = lastAliveIndex === -1 ? Math.min(months.length, 36) : Math.min(months.length, lastAliveIndex + 7);
  return { deudaSeries: deudaSeries.slice(0, end), liquidezSeries: liquidezSeries.slice(0, end), months: months.slice(0, end) };
}

function renderDeudaRutaChart(deudaSeries, liquidezSeries, months) {
  const svg = qs("deudaRutaChart");
  if (!svg || !deudaSeries.length) return;
  const width = svg.clientWidth || 640;
  const height = 200;
  const pad = { left: 60, right: 16, top: 16, bottom: 26 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const values = [...deudaSeries.map((row) => row.deudaViva), ...liquidezSeries.map((row) => row.totalLiquidity)];
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = deudaSeries.length;
  const x = (i) => pad.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (value) => pad.top + plotH - ((value - minV) / Math.max(1, maxV - minV)) * plotH;

  const deudaLine = deudaSeries.map((row, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(row.deudaViva).toFixed(2)}`).join(" ");
  const deudaArea = `${deudaLine} L ${x(n - 1).toFixed(2)} ${(pad.top + plotH).toFixed(2)} L ${x(0).toFixed(2)} ${(pad.top + plotH).toFixed(2)} Z`;
  const liquidezLine = liquidezSeries.map((row, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(row.totalLiquidity).toFixed(2)}`).join(" ");

  let markup = `<path class="chart-area-deuda" d="${deudaArea}" />`;
  markup += `<path class="chart-line-deuda" d="${deudaLine}" />`;
  markup += `<path class="chart-line-liquidez" d="${liquidezLine}" />`;
  projectChartTickIndexes(months, width).forEach((idx) => {
    markup += `<text class="chart-label" x="${(x(idx) - 14).toFixed(2)}" y="${height - 6}">${escapeHtml(months[idx]?.month || "")}</text>`;
  });
  svg.insertAdjacentHTML("beforeend", markup);
}

// Una ruta vacía puede serlo por dos motivos muy distintos: porque la estrategia no propone nada
// («No tocar nada») o porque no se ha podido construir («Consolidar» sin oferta). Decir «sin
// decisiones» en los dos casos dejaría al usuario sin saber que le falta teclear algo.
function deudaRutaEmptyTimelineText(summary) {
  const plan = summary.consolidacion;
  if (plan && !plan.available) {
    return plan.motivo === "cartera"
      ? `Reunificar exige al menos dos deudas vivas; ahora mismo el motor ve ${plan.contracts.length}.`
      : "Sin la oferta de reunificación (TIN y plazo) no hay ruta que dibujar: se introduce en «Comparar estrategias».";
  }
  return "Sin decisiones: la deuda sigue su calendario actual.";
}

// D-9: los mismos cuatro requisitos que ya exige `E14DebtOperations.prepareApplication` antes de
// aceptar una aplicación — esta lista es solo su vista previa, no una segunda validación con
// criterio propio. El motivo no se comprueba aquí: lo exige el propio diálogo de confirmación al
// aplicar (`requestOperationConfirmation`), así que queda como nota informativa, no bloqueante.
function deudaRutaOfferChecklist(offer, simulation, reserve) {
  const requiredDocuments = E14DebtOperations?.REQUIRED_DOCUMENTS || [];
  const missingDocuments = requiredDocuments.filter((doc) => !(offer?.documents || []).includes(doc));
  const reserveSafe = simulation ? simulation.minimumLiquidity >= reserve : null;
  return [
    {
      ok: offer?.status === "accepted",
      label: offer?.status === "accepted" ? "Oferta registrada con sus condiciones" : "La oferta todavía no está marcada como aceptada",
    },
    {
      ok: requiredDocuments.length ? !missingDocuments.length : null,
      label: `Documentos: ${requiredDocuments.length - missingDocuments.length} de ${requiredDocuments.length || 3}`,
    },
    {
      ok: reserveSafe,
      label:
        reserveSafe === null
          ? "Reserva: sin poder calcular todavía"
          : reserveSafe
            ? "Reserva protegida tras aplicar"
            : "La reserva quedaría bajo el mínimo tras aplicar",
    },
    { ok: null, label: "Motivo de la decisión — se pide al confirmar" },
  ];
}

// D-13 (repaso pixel-perfect del 21 de agosto): edita la oferta ya registrada in situ, con la
// misma validación que usaba el alta en #debt-roadmap (`E14DebtOperations.normalizeOffer`) — no
// una segunda regla de negocio. El contrato de la oferta no se toca aquí (ya viene fijado al
// registrarla); solo sus condiciones.
function updateE14bOffer(offerId, patch) {
  if (!E14DebtOperations) return null;
  const workspace = e14bWorkspace();
  const index = workspace.offers.findIndex((item) => item.id === offerId);
  if (index === -1) return null;
  const existing = workspace.offers[index];
  const contract = debtTargetById(existing.contractId, { includePlanned: true }) || {};
  const normalized = E14DebtOperations.normalizeOffer({ ...existing, ...patch, id: existing.id, contractId: existing.contractId }, contract);
  if (!normalized.valid) return normalized;
  workspace.offers[index] = normalized;
  queueRemoteSave();
  return normalized;
}

function deudaRutaOfferEditFormHtml(offer) {
  const documents = offer.documents || [];
  return `<div class="deuda-ruta-offer-edit">
    <p class="e19-kpi-note">Corrige las condiciones de esta oferta sin salir de Deuda — misma validación que ya usaba el Plan de deuda heredado.</p>
    <div class="deuda-ruta-offer-edit-grid">
      <label>Contraparte<input type="text" id="deudaRutaOfferEditCounterpart" value="${escapeHtml(offer.counterpart || "")}" /></label>
      <label>Vigencia hasta<input type="month" id="deudaRutaOfferEditExpiresAt" value="${escapeHtml(offer.expiresAt || "")}" /></label>
      <label>Importe total pactado<input type="number" min="0" step="0.01" id="deudaRutaOfferEditAmount" value="${escapeHtml(String(offer.amount ?? 0))}" /></label>
      <label>Modalidad<select id="deudaRutaOfferEditPaymentType">
        <option value="single-payment"${offer.paymentType === "single-payment" ? " selected" : ""}>Pago único</option>
        <option value="refinancing"${offer.paymentType === "refinancing" ? " selected" : ""}>Refinanciación</option>
        <option value="resume-payments"${offer.paymentType === "resume-payments" ? " selected" : ""}>Retomar pagos</option>
      </select></label>
      <label>Cuota mensual<input type="number" min="0" step="0.01" id="deudaRutaOfferEditInstallment" value="${escapeHtml(String(offer.installment ?? 0))}" /></label>
      <label>Duración (meses)<input type="number" min="0" step="1" id="deudaRutaOfferEditTermMonths" value="${escapeHtml(String(offer.termMonths ?? 0))}" /></label>
    </div>
    <div class="deuda-ruta-offer-edit-documents">
      <label><input type="checkbox" id="deudaRutaOfferEditDocOffer"${documents.includes("offer") ? " checked" : ""} /> Oferta o acuerdo</label>
      <label><input type="checkbox" id="deudaRutaOfferEditDocAuthority"${documents.includes("identity-or-authority") ? " checked" : ""} /> Identidad o mandato</label>
      <label><input type="checkbox" id="deudaRutaOfferEditDocTerms"${documents.includes("payment-terms") ? " checked" : ""} /> Condiciones de pago</label>
      <label><input type="checkbox" id="deudaRutaOfferEditAccepted"${offer.status === "accepted" ? " checked" : ""} /> Oferta aceptada expresamente</label>
    </div>
    <div class="deuda-ruta-offer-edit-actions">
      <button type="button" class="e19-btn e19-btn-primary" id="deudaRutaOfferEditSave">Guardar cambios</button>
      <button type="button" class="e19-btn e19-btn-secondary" id="deudaRutaOfferEditCancel">Cancelar</button>
    </div>
  </div>`;
}

function handleDeudaRutaOfferEditSubmit(offerId) {
  const documents = [
    qs("deudaRutaOfferEditDocOffer")?.checked ? "offer" : "",
    qs("deudaRutaOfferEditDocAuthority")?.checked ? "identity-or-authority" : "",
    qs("deudaRutaOfferEditDocTerms")?.checked ? "payment-terms" : "",
  ].filter(Boolean);
  const patch = {
    counterpart: qs("deudaRutaOfferEditCounterpart")?.value,
    expiresAt: qs("deudaRutaOfferEditExpiresAt")?.value,
    amount: parseAmount(qs("deudaRutaOfferEditAmount")?.value),
    paymentType: qs("deudaRutaOfferEditPaymentType")?.value,
    installment: parseAmount(qs("deudaRutaOfferEditInstallment")?.value),
    termMonths: Number(qs("deudaRutaOfferEditTermMonths")?.value || 0),
    documents,
    status: qs("deudaRutaOfferEditAccepted")?.checked ? "accepted" : "received",
  };
  const result = updateE14bOffer(offerId, patch);
  if (!result) return;
  deudaRutaOfferStatusMessage = result.valid
    ? "Oferta actualizada."
    : `No se guardaron los cambios: ${result.issues.filter((issue) => issue !== "amount-unusual").join(", ")}.`;
  if (result.valid) deudaRutaOfferEditOpen = false;
  renderDeudaRutaOffer();
}

// V3-4 · la «oferta en curso» del mockup 4d vivía solo en #asesor-decision; esta tarjeta la trae a
// la propia vista de Deuda, reutilizando asesorDecisionOpenOffers() y asesorDecisionFundingHtml()
// tal cual — mismos datos, sin recalcular nada.
// D-8/D-9 (15 de agosto, sesión de seguimiento de la auditoría): la tarjeta dejó de enrutar a
// #debt-roadmap para "revisar y aplicar" — aplica in situ llamando a applyE14bOffer(), la misma
// puerta de escritura que ya usaba esa pantalla (regla transversal 01), tras seleccionar la oferta
// en el workspace de E14b (mismo gesto que ya hacía este botón).
// D-13 (repaso pixel-perfect del 21 de agosto de 2026, Deuda.pdf sección B): el enlace a
// #debt-roadmap para «editar oferta» se sustituye por un formulario plegable in situ
// (`deudaRutaOfferEditFormHtml`/`updateE14bOffer`), y la tarjeta pasa a fondo oscuro cuando hay una
// oferta real — `#deudaRutaOfferCard` es el mismo `<article>` de siempre, solo gana `.is-active`.
function renderDeudaRutaOffer() {
  const target = qs("deudaRutaOffer");
  if (!target) return;
  const card = qs("deudaRutaOfferCard");
  const offer = asesorDecisionOpenOffers()[0];
  if (!offer) {
    card?.classList.remove("is-active");
    deudaRutaOfferEditOpen = false;
    target.innerHTML = `<p class="e19-kpi-note">Sin ofertas de deuda abiertas ahora mismo.</p>`;
    return;
  }
  card?.classList.add("is-active");
  const contract = debtTargetById(offer.contractId, { includePlanned: true });
  const forecast = e14bForecast();
  const reserve = Math.max(0, Number(agentCaixaFloor?.() || 0));
  const simulation = forecast && E14DebtOperations ? E14DebtOperations.simulateStrategy(e14bStrategyForOffer(offer), forecast) : null;
  const checks = deudaRutaOfferChecklist(offer, simulation, reserve);
  // La deuda ya decidida no es uno de los cuatro requisitos del mockup — es un conflicto de estado
  // aparte, pero igual de bloqueante: sin esto el botón saldría habilitado y `applyE14bOffer()`
  // fallaría en silencio (su aviso vive en #e14bStatus, dentro de #debt-roadmap, invisible aquí).
  const alreadyDecided = debtLiquidations.some((item) => item.targetId === offer.contractId);
  const expiry = debtOfferExpiryStatus(offer.expiresAt);
  const blocked = alreadyDecided || checks.some((check) => check.ok === false);
  target.innerHTML = `
    <div class="deuda-ruta-offer-eyebrow">
      <span>Oferta en curso</span>
      ${expiry.expired ? `<span class="deuda-ruta-offer-expiry">Caducada</span>` : expiry.dueSoon ? `<span class="deuda-ruta-offer-expiry">Caduca pronto</span>` : ""}
    </div>
    <h3 class="escenario-motor-panel-title">${escapeHtml(offer.counterpart || "Sin contraparte")}</h3>
    <p class="asesor-decision-subtitle">${contract ? `${escapeHtml(contract.entity)}${contract.type ? ` ${escapeHtml(contract.type)}` : ""}` : ""}${offer.expiresAt ? ` · <span class="${expiry.status === "danger" ? "is-danger" : ""}">vence ${escapeHtml(escenarioMotorMonthLabel(offer.expiresAt))}</span>` : ""}</p>
    <div class="asesor-decision-stats">
      <div class="asesor-decision-stat"><span>Importe</span><strong>${money(offer.amount, true)}</strong></div>
      <div class="asesor-decision-stat"><span>Intereses ahorrados</span><strong>${money(offer.discount, true)}</strong></div>
      ${offer.installment > 0 ? `<div class="asesor-decision-stat"><span>Cuota resultante</span><strong>${money(offer.installment, true)}</strong></div>` : ""}
    </div>
    <div class="asesor-decision-funding">${asesorDecisionFundingHtml(offer.amount)}</div>
    <p class="panel-kicker">Requisitos para aplicar</p>
    <ul class="deuda-ruta-checklist" id="deudaRutaOfferChecklist">${checks
      .map((check) => `<li class="deuda-ruta-check${check.ok === false ? " is-danger" : check.ok === null ? " is-neutral" : " is-ok"}">${escapeHtml(check.label)}</li>`)
      .join("")}</ul>
    ${expiry.expired ? `<p class="e19-kpi-note is-danger" id="deudaRutaOfferExpiry">Oferta caducada desde ${escapeHtml(escenarioMotorMonthLabel(offer.expiresAt))}: comprueba con ${escapeHtml(offer.counterpart || "la contraparte")} si sigue en pie antes de aplicarla.</p>` : expiry.dueSoon ? `<p class="e19-kpi-note is-danger" id="deudaRutaOfferExpiry">Oferta a punto de caducar: vence ${escapeHtml(escenarioMotorMonthLabel(offer.expiresAt))}.</p>` : ""}
    ${alreadyDecided ? `<p class="e19-kpi-note is-danger">Esta deuda ya tiene una decisión aplicada — revísala o deshazla antes de aplicar otra.</p>` : ""}
    ${deudaRutaOfferStatusMessage ? `<p class="e19-kpi-note" id="deudaRutaOfferStatus">${escapeHtml(deudaRutaOfferStatusMessage)}</p>` : ""}
    <div class="deuda-ruta-offer-edit-actions">
      <button type="button" class="e19-btn e19-btn-primary" id="deudaRutaOfferApply"${blocked ? " disabled" : ""}>Aplicar al plan</button>
      <button type="button" class="e19-btn e19-btn-secondary" id="deudaRutaOfferEdit" aria-expanded="${deudaRutaOfferEditOpen ? "true" : "false"}">${deudaRutaOfferEditOpen ? "Cerrar edición" : "Ver documentos y editar oferta"}</button>
    </div>
    ${deudaRutaOfferEditOpen ? deudaRutaOfferEditFormHtml(offer) : ""}
  `;
  const applyButton = qs("deudaRutaOfferApply");
  if (applyButton) {
    applyButton.addEventListener("click", async () => {
      e14bWorkspace().selectedOfferId = offer.id;
      await applyE14bOffer();
      deudaRutaOfferStatusMessage = qs("e14bStatus")?.textContent || "";
      renderDeudaRutaOffer();
    });
  }
  const editLink = qs("deudaRutaOfferEdit");
  if (editLink) {
    editLink.addEventListener("click", () => {
      deudaRutaOfferEditOpen = !deudaRutaOfferEditOpen;
      renderDeudaRutaOffer();
    });
  }
  const saveButton = qs("deudaRutaOfferEditSave");
  if (saveButton) saveButton.addEventListener("click", () => handleDeudaRutaOfferEditSubmit(offer.id));
  const cancelButton = qs("deudaRutaOfferEditCancel");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      deudaRutaOfferEditOpen = false;
      renderDeudaRutaOffer();
    });
  }
}

// Deuda.pdf (05 de 9, sección B) · «Orden de ataque»: una tabla por contrato (Capital/TIN/Cuota/
// Peso y fin previsto) con fila Total, fusionando lo que antes eran tres piezas separadas — el
// selector de estrategia grande, la lista «Ruta propuesta» (decisiones ya resueltas) y la tarjeta
// «Cartera» (peso por contrato). Ningún cálculo nuevo: reutiliza `contract.currentPrincipal`/
// `apr`/`currentPayment` (ya usados por `debtAmortizationSchedule`) y `resultadosById` (ya
// calculado por `renderDeudaRuta` a partir de `runEscenarioMotor`) para el «fin previsto» de las
// decisiones de la estrategia activa; sin decisión (Consolidar reunifica en un solo préstamo, No
// tocar nada no acelera nada), la celda dice «según calendario» en vez de fingir una fecha.
function deudaRutaAttackRowHtml(index, contract, decisionByContractId, resultadosById, maxPrincipal) {
  const capital = Number(contract.currentPrincipal) || 0;
  const cuota = Number(contract.currentPayment) || 0;
  // `contract.apr` es `null` (no 0) cuando no se conoce el TIN — Number(null) da 0, así que hay
  // que descartar null/undefined explícitamente antes de convertir, o un TIN desconocido se vería
  // como un crédito al 0 % (mismo criterio que ya usaba el editor de Contratos, línea ~25799).
  const aprPct = contract.apr === null || contract.apr === undefined ? NaN : Number(contract.apr);
  const weightPct = maxPrincipal > 0 ? Math.round((capital / maxPrincipal) * 100) : 0;
  const decision = decisionByContractId.get(contract.id);
  const resultado = decision ? resultadosById.get(decision.id) : null;
  const finLabel = resultado?.mesResuelto ? escenarioMotorMonthLabel(resultado.mesResuelto) : "según calendario";
  return `<tr>
    <td>${index + 1}</td>
    <td>${escapeHtml(escenarioMotorDebtLabel(contract))}</td>
    <td>${money(capital, true)}</td>
    <td>${Number.isFinite(aprPct) ? `${aprPct.toFixed(1)}%` : "—"}</td>
    <td>${cuota > 0 ? money(cuota, true) : '<span title="Sin cuota declarada">—</span>'}</td>
    <td><div class="deuda-ruta-attack-weight"><div class="deuda-ruta-attack-weight-bar"><span style="width:${weightPct}%"></span></div><small>${escapeHtml(finLabel)}</small></div></td>
  </tr>`;
}

function renderDeudaRutaAttackTable(contracts, summary, resultadosById, def) {
  const body = qs("deudaRutaAttackBody");
  const foot = qs("deudaRutaAttackFoot");
  const note = qs("deudaRutaAttackNote");
  if (note) note.textContent = def?.desc || "";
  if (!body) return;
  if (!contracts.length) {
    body.innerHTML = `<tr><td colspan="6" class="registrar-mes-empty">${escapeHtml(deudaRutaEmptyTimelineText(summary))}</td></tr>`;
    if (foot) foot.innerHTML = "";
    return;
  }
  const decisionByContractId = new Map(
    summary.decisions.filter((decision) => decision.tipo === "amortizacion").map((decision) => [decision.params.deudaId, decision]),
  );
  const maxPrincipal = Math.max(1, ...contracts.map((contract) => Number(contract.currentPrincipal) || 0));
  body.innerHTML = contracts
    .map((contract, index) => deudaRutaAttackRowHtml(index, contract, decisionByContractId, resultadosById, maxPrincipal))
    .join("");
  const totalCapital = round2(contracts.reduce((sum, contract) => sum + (Number(contract.currentPrincipal) || 0), 0));
  const totalCuota = round2(contracts.reduce((sum, contract) => sum + (Number(contract.currentPayment) || 0), 0));
  // Media ponderada por capital, solo sobre los contratos con TIN conocido — uno sin TIN cuenta
  // como 0 % en la ponderación (infla a la baja la media), no como si no existiera.
  const knownApr = contracts.filter((contract) => contract.apr !== null && contract.apr !== undefined);
  const knownAprCapital = round2(knownApr.reduce((sum, contract) => sum + (Number(contract.currentPrincipal) || 0), 0));
  const avgApr = knownAprCapital > 0
    ? knownApr.reduce((sum, contract) => sum + Number(contract.apr) * (Number(contract.currentPrincipal) || 0), 0) / knownAprCapital
    : null;
  const avgAprLabel = avgApr === null ? "sin TIN declarado" : `media ${avgApr.toFixed(1)}%`;
  // `summary.libreDeDeuda` es una clave de mes real solo cuando la ruta de verdad termina de pagar
  // dentro del horizonte; si no, ya es una frase descriptiva («sin fecha estimable...») — el título
  // de la pantalla la muestra completa, así que aquí basta con la estrategia para no repetirla.
  const esFechaLibre = /^\d{4}-\d{2}/.test(String(summary.libreDeDeuda || ""));
  const libreLabel = esFechaLibre ? `Libre de deuda: ${escenarioMotorMonthLabel(summary.libreDeDeuda)}` : def?.label || "";
  if (foot) {
    foot.innerHTML = `<tr>
      <td></td>
      <td>Total</td>
      <td>${money(totalCapital, true)}</td>
      <td>${escapeHtml(avgAprLabel)}</td>
      <td>${money(totalCuota, true)}</td>
      <td>${escapeHtml(libreLabel)}</td>
    </tr>`;
  }
}

function renderDeudaRuta() {
  renderDeudaScreenTabs("deuda-ruta");
  renderScenarioDependencyNotice("deuda-ruta");
  const capacityEl = qs("deudaRutaCapacity");
  if (capacityEl) capacityEl.innerHTML = debtCapacityHtml(debtCapacityStatus());
  renderDeudaRutaOffer();
  if (debtStrategyReserveValue === null) debtStrategyReserveValue = debtStrategyReserveDefault();
  const tabs = qs("deudaRutaTabs");
  if (tabs) {
    tabs.innerHTML = DEBT_STRATEGY_DEFINITIONS.map(
      (def) => `<button type="button" class="deuda-decidir-tab${def.id === deudaRutaSelectedStrategy ? " is-active" : ""}" data-deuda-ruta-tab="${escapeHtml(def.id)}">${escapeHtml(def.label)}</button>`
    ).join("");
  }

  const baseInput = escenarioMotorBaseInput();
  const contracts = escenarioMotorDebtOptions();
  const summary = debtStrategySummary(deudaRutaSelectedStrategy, baseInput, debtStrategyReserveValue);
  const def = DEBT_STRATEGY_DEFINITIONS.find((item) => item.id === deudaRutaSelectedStrategy);
  const resultadosById = new Map((summary.result?.resultados || []).map((item) => [item.id, item]));

  const titleEl = qs("deudaRutaTitle");
  if (titleEl) {
    const esFecha = /^\d{4}-\d{2}/.test(String(summary.libreDeDeuda || ""));
    titleEl.textContent = esFecha
      ? `Sin deuda en ${escenarioMotorMonthLabel(summary.libreDeDeuda)}`
      : `Libre de deuda: ${escenarioMotorMonthLabel(summary.libreDeDeuda)}`;
  }
  const subtitleEl = qs("deudaRutaSubtitle");
  if (subtitleEl) {
    const costeLabel = (def?.costeLabel || DEBT_STRATEGY_COSTE_LABEL).toLowerCase();
    subtitleEl.textContent = `${def?.label || deudaRutaSelectedStrategy}: ${summary.total} decisión(es), ${money(summary.costeTotal, true)} de ${costeLabel}, caja mínima ${money(summary.cajaMinima ?? 0, true)}.`;
  }

  const deudaViva = buildDeudaVivaSeries(baseInput.months, contracts, summary.decisions, resultadosById);
  const chartWindow = deudaRutaChartWindow(deudaViva, summary.result?.series || [], baseInput.months);
  renderDeudaRutaChart(chartWindow.deudaSeries, chartWindow.liquidezSeries, chartWindow.months);

  // D-4 · en el mismo orden de ataque que la pestaña activa (avalancha/bola de nieve); consolidar y
  // no tocar no ordenan nada (`debtStrategyOrderedContracts` devuelve []), así que caen al orden
  // declarado de la cartera — el mismo orden que ya usaba el calendario de amortización de abajo.
  const orderedForCalendar = debtStrategyOrderedContracts(deudaRutaSelectedStrategy);
  const calendarContracts = orderedForCalendar.length ? orderedForCalendar : contracts;

  renderDeudaRutaAttackTable(calendarContracts, summary, resultadosById, def);

  const checklist = qs("deudaRutaChecklist");
  const applyButton = qs("deudaRutaApply");
  const reserveConfigured = Number.isFinite(debtStrategyReserveValue);
  const effectiveReserve = debtStrategyEffectiveReserve(debtStrategyReserveValue);
  const reserveOk = (summary.cajaMinima ?? 0) >= effectiveReserve;
  const checks = [
    {
      ok: reserveOk,
      label: reserveOk
        ? reserveConfigured
          ? "Reserva mínima protegida durante toda la ruta"
          : "No baja de 0 € en ningún mes (sin reserva mínima configurada)"
        : reserveConfigured
        ? "La ruta baja de la reserva mínima indicada"
        : "La ruta deja la caja en negativo en algún mes",
    },
    {
      ok: summary.total === 0 ? null : summary.viable,
      label: summary.total === 0
        ? deudaRutaEmptyTimelineText(summary)
        : summary.viable
        ? "Todas las decisiones tienen mes viable"
        : `${summary.total - summary.aplicadas} decisión(es) sin mes viable en este horizonte`,
    },
  ];
  if (checklist) {
    checklist.innerHTML = checks
      .map((check) => `<li class="deuda-ruta-check${check.ok === false ? " is-danger" : check.ok === null ? " is-neutral" : " is-ok"}">${escapeHtml(check.label)}</li>`)
      .join("");
  }
  if (applyButton) applyButton.disabled = summary.total === 0 || !summary.viable;

  // A16-5: siempre visible, no solo con Bola de nieve seleccionada — es contexto de decisión antes
  // de aplicar cualquiera de las dos, no una nota que solo aparece cuando ya se ha elegido.
  const motivationalGapNote = qs("deudaRutaMotivationalGapNote");
  if (motivationalGapNote) motivationalGapNote.textContent = deudaRutaMotivationalGapText(debtStrategyMotivationalGap(baseInput, debtStrategyReserveValue));

  // DI3: aviso aparte de las revolving detectadas, con su orden de prioridad por TAE — no
  // sustituye a la ruta activa, es contexto adicional visible siempre, igual que A16-5.
  const revolvingNote = qs("deudaRutaRevolvingNote");
  if (revolvingNote) revolvingNote.textContent = deudaRutaRevolvingText(DebtContracts?.prioritizeRevolving(contracts) || []);

  const aggregate = debtStrategyAggregateCalendar(summary.decisions, resultadosById, calendarContracts, baseInput.months);
  const baselineInterest = debtAmortizationTotalInterest(calendarContracts, baseInput.months.length);
  const amortChart = qs("deudaRutaAmortChart");
  if (amortChart) amortChart.innerHTML = debtRutaAmortChartHtml(aggregate.series);
  const amortStats = qs("deudaRutaAmortStats");
  if (amortStats) amortStats.innerHTML = debtRutaAmortStatsHtml(aggregate, baselineInterest);

  renderDeudaRutaCalendar(calendarContracts, baseInput.months);
}

// D-4 · qué mes liquida esta ruta cada contrato de golpe (y con qué préstamo nuevo, si es una
// reunificación) — el mismo escaneo de decisiones que ya hace `buildDeudaVivaSeries` para su
// escalón, pero devolviendo los datos que hacen falta para amortizar de verdad el préstamo nuevo
// (cuota y TAE), no solo su magnitud plana.
function debtStrategyPayoffPlan(months, decisions, resultadosById) {
  const payoffMonthByDebt = new Map();
  const nuevosPrestamos = [];
  decisions.forEach((decision) => {
    const resultado = resultadosById.get(decision.id);
    if (resultado?.resultado !== "aplicada" || !resultado.mesResuelto) return;
    if (decision.tipo === "reunificacion") {
      (decision.params.deudaIds || []).forEach((deudaId) => payoffMonthByDebt.set(deudaId, resultado.mesResuelto));
      nuevosPrestamos.push({
        id: `reunificada-${decision.id}`,
        label: "Préstamo de reunificación",
        currentPrincipal: Number(decision.params.nuevoPrincipal) || 0,
        currentPayment: Number(decision.params.nuevaCuota) || 0,
        apr: round2((Number(decision.params.nuevoTIN) || 0) * 100),
        desde: resultado.mesResuelto,
      });
      return;
    }
    payoffMonthByDebt.set(decision.params.deudaId, resultado.mesResuelto);
  });
  return { payoffMonthByDebt, nuevosPrestamos };
}

// El calendario francés natural de debtAmortizationSchedule, más el mes (índice absoluto en
// `months`) en el que la estrategia liquida el contrato de golpe, si lo hace antes de que terminara
// por su cuenta — sin recortar `rows` aquí: una deuda «stalled» (sin cuota que cubra ni el interés)
// solo trae una fila por diseño, no porque el saldo desaparezca el mes siguiente, así que el corte
// real de meses vive en quien agrega (`debtStrategyAggregateCalendar`), no aquí. Sin mes de
// liquidación, o si llega después de que el contrato ya hubiera terminado solo, no hay nada que
// truncar.
function debtAmortizationScheduleForPlan(contract, months, payoffMonthKey) {
  const schedule = debtAmortizationSchedule(contract, months.length);
  if (!payoffMonthKey) return { ...schedule, payoffIndex: null };
  const payoffIndex = months.findIndex((month) => month.monthKey === payoffMonthKey);
  if (payoffIndex < 0 || (schedule.complete && payoffIndex >= schedule.rows.length)) return { ...schedule, payoffIndex: null };
  return { ...schedule, payoffIndex };
}

// D-4 · el calendario agregado que faltaba: capital vivo mes a mes sumando todos los contratos bajo
// la estrategia activa (cada uno con su calendario declarado, truncado si esta ruta lo liquida antes
// de golpe) más el préstamo nuevo de una reunificación desde el mes en que se firma. Con 0
// decisiones (Mín./no-tocar) coincide exactamente con solo mínimos: no hay nada que adelantar.
function debtStrategyAggregateCalendar(decisions, resultadosById, contracts, months) {
  const { payoffMonthByDebt, nuevosPrestamos } = debtStrategyPayoffPlan(months, decisions, resultadosById);
  const entries = contracts.map((contract) => ({
    label: escenarioMotorDebtLabel(contract),
    offset: 0,
    schedule: debtAmortizationScheduleForPlan(contract, months, payoffMonthByDebt.get(contract.id) || null),
  }));
  nuevosPrestamos.forEach((prestamo) => {
    const offset = months.findIndex((month) => month.monthKey === prestamo.desde);
    if (offset < 0) return;
    const remaining = months.slice(offset);
    entries.push({ label: prestamo.label, offset, schedule: { ...debtAmortizationSchedule(prestamo, remaining.length), payoffIndex: null } });
  });

  const capital = months.map(() => 0);
  let totalInterest = 0;
  let firstPayoff = null;
  entries.forEach((entry) => {
    const rows = entry.schedule.rows;
    // Una deuda «stalled» (cuota que no cubre ni el interés, o sin cuota declarada) solo genera UNA
    // fila — `debtAmortizationSchedule` corta ahí a propósito para no fingir una amortización que no
    // ocurre — pero su saldo no desaparece los meses siguientes: sigue ahí, congelado, hasta que la
    // ruta la liquide de golpe (si lo hace) o se acabe el horizonte. Sin este relleno, el agregado la
    // haría desaparecer del total a partir del mes 2, como si se hubiera pagado sola.
    const flatBalance = entry.schedule.stalled && rows.length ? rows[rows.length - 1].balance : null;
    // El corte real de la ruta (si lo hay) manda incluso sobre el relleno congelado: a partir de ahí
    // no queda saldo, se haya llegado ahí amortizando de verdad o estancado.
    const cutoff = entry.schedule.payoffIndex ?? Infinity;
    for (let index = entry.offset; index < capital.length && index < cutoff; index += 1) {
      const localIndex = index - entry.offset;
      if (localIndex < rows.length) {
        capital[index] += rows[localIndex].balance;
        totalInterest += rows[localIndex].interest;
      } else if (flatBalance !== null) {
        capital[index] += flatBalance;
      }
    }
    const completionIndex =
      entry.schedule.payoffIndex !== null && entry.schedule.payoffIndex !== undefined
        ? entry.schedule.payoffIndex
        : entry.schedule.complete && entry.schedule.rows.length
        ? entry.offset + entry.schedule.rows.length - 1
        : null;
    if (completionIndex !== null && completionIndex >= 0 && completionIndex < months.length && (!firstPayoff || completionIndex < firstPayoff.index)) {
      firstPayoff = { index: completionIndex, label: entry.label };
    }
  });
  // Recorta la cola de meses ya saldados (capital 0): el mockup deja de dibujar barras en cuanto la
  // deuda llega a cero, no arrastra el resto del horizonte del motor (hasta 10 años) en blanco.
  let lastActive = capital.length - 1;
  while (lastActive > 0 && capital[lastActive] <= 0.01) lastActive -= 1;
  return {
    series: capital.slice(0, lastActive + 1).map((value, index) => ({ monthKey: months[index].monthKey, month: months[index].month, capital: round2(Math.max(0, value)) })),
    totalInterest: round2(totalInterest),
    firstPayoff: firstPayoff ? { label: firstPayoff.label, month: months[firstPayoff.index]?.month, monthKey: months[firstPayoff.index]?.monthKey } : null,
  };
}

// El total de intereses «solo mínimos»: la misma cuota francesa de cada contrato, nunca tocada por
// ninguna decisión — el mismo cálculo que ya pinta cada `<details>` del calendario por contrato, solo
// que sumado. Es el baseline con el que D-4 compara la estrategia activa.
function debtAmortizationTotalInterest(contracts, maxMonths) {
  return round2(contracts.reduce((sum, contract) => sum + debtAmortizationSchedule(contract, maxMonths).rows.reduce((s, row) => s + row.interest, 0), 0));
}

function debtRutaAmortChartHtml(series) {
  if (!series.length) return '<p class="e19-kpi-note">Sin deuda viva: no hay calendario que proyectar.</p>';
  const max = Math.max(1, ...series.map((row) => row.capital));
  const bars = series
    .map(
      (row) =>
        `<div class="deuda-ruta-amort-bar" style="height:${Math.max(2, Math.round((row.capital / max) * 100))}%" title="${escapeHtml(row.month)} · ${money(row.capital, true)}"></div>`
    )
    .join("");
  const mid = series[Math.floor((series.length - 1) / 2)];
  return `<div class="deuda-ruta-amort-chart">${bars}</div>
    <div class="deuda-ruta-amort-axis"><span>${escapeHtml(series[0]?.month || "")}</span><span>${escapeHtml(mid?.month || "")}</span><span>${escapeHtml(series.at(-1)?.month || "")}</span></div>`;
}

function debtRutaAmortStatsHtml(aggregate, baselineInterest) {
  const delta = round2(baselineInterest - aggregate.totalInterest);
  const deltaText =
    Math.abs(delta) < 0.01
      ? "Igual que solo mínimos: esta ruta no adelanta ningún pago."
      : delta > 0
      ? `${money(delta, true)} menos que solo mínimos`
      : `${money(Math.abs(delta), true)} más que solo mínimos`;
  return `
    <div class="deuda-ruta-amort-stat"><span>Primer contrato liquidado</span><strong>${
      aggregate.firstPayoff ? `${escapeHtml(aggregate.firstPayoff.month)} · ${escapeHtml(aggregate.firstPayoff.label)}` : "Ninguno dentro de este horizonte"
    }</strong></div>
    <div class="deuda-ruta-amort-stat"><span>Intereses totales</span><strong>${money(aggregate.totalInterest, true)}</strong></div>
    <div class="deuda-ruta-amort-stat"><span>Frente a solo mínimos</span><strong>${escapeHtml(deltaText)}</strong></div>
  `;
}

function renderDeudaRutaCalendar(contracts, months) {
  const container = qs("deudaRutaCalendar");
  if (!container) return;
  if (!contracts.length) {
    container.innerHTML = '<p class="e19-kpi-note">Sin deudas vivas: no hay calendario que mostrar.</p>';
    return;
  }
  container.innerHTML = contracts
    .map((contract) => {
      const schedule = debtAmortizationSchedule(contract, months.length);
      const totalInterest = round2(schedule.rows.reduce((sum, row) => sum + row.interest, 0));
      const label = escenarioMotorDebtLabel(contract);
      const summary = schedule.stalled
        ? !(Number(contract.currentPayment) > 0)
          ? `${label} · sin cuota declarada: no hay calendario que proyectar`
          : `${label} · la cuota declarada no cubre ni el interés: no amortiza`
        : !schedule.complete
        ? `${label} · no llega a saldo cero dentro de los ${months.length} meses del horizonte`
        : `${label} · saldada en ${months[schedule.rows.length - 1]?.month || "—"} · ${money(totalInterest, true)} de interés total`;
      const rowsHtml = schedule.rows
        .map(
          (row) => `<tr>
            <td>${escapeHtml(months[row.month - 1]?.month || `Mes ${row.month}`)}</td>
            <td>${money(row.payment, true)}</td>
            <td>${money(row.interest, true)}</td>
            <td>${money(row.principal, true)}</td>
            <td>${money(row.balance, true)}</td>
          </tr>`
        )
        .join("");
      return `<details class="deuda-ruta-calendar-item">
          <summary>${escapeHtml(summary)}</summary>
          <div class="table-wrap">
            <table class="e19-table">
              <thead><tr><th>Mes</th><th>Cuota</th><th>Interés</th><th>Capital</th><th>Saldo</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </details>`;
    })
    .join("");
}

function handleDeudaRutaTab(strategyId) {
  deudaRutaSelectedStrategy = strategyId;
  renderDeudaRuta();
}

function handleDeudaRutaApply() {
  debtStrategyDecisionsToEscenario(deudaRutaSelectedStrategy);
  escenarioMotorNavigate("escenario-aplicar");
}

// D-1 · Ruta, Comparar y Contratos comparten una misma barra de pestañas de pantalla (distinta de
// `deudaRutaTabs`, que son las cuatro estrategias dentro de Ruta). No se fusionan en una sola
// sección: Ruta y Comparar ya eran pantallas completas del epic V3, y Contratos es la única de las
// tres que se construye desde cero ahora — cada una sigue siendo su propio `view-section` con su
// propio hash, solo se enlazan visualmente como pestañas.
const DEUDA_SCREEN_TABS = [
  { id: "deuda-ruta", label: "Ruta" },
  { id: "deuda-comparar", label: "Comparar" },
  { id: "deuda-contratos", label: "Contratos" },
  { id: "deuda-simulador", label: "Simulador visual" },
];
const DEUDA_SCREEN_TAB_NAV_IDS = {
  "deuda-ruta": "deudaRutaScreenTabs",
  "deuda-comparar": "deudaCompararScreenTabs",
  "deuda-contratos": "deudaContratosScreenTabs",
  "deuda-simulador": "deudaSimuladorScreenTabs",
};

function deudaScreenTabsHtml(activeId) {
  // OPT-4 (axe: aria-allowed-attr, crítico): cada pestaña es un enlace real a otra ruta con su
  // propio hash (Ruta/Comparar/Contratos/Simulador son cuatro view-section independientes, no un
  // único panel que cambia de contenido), así que `aria-selected` no es válido aquí — ese atributo
  // solo lo admiten elementos con role="tab"/"option"/etc. `aria-current="page"` es el marcador
  // correcto para "enlace activo dentro de esta navegación", mismo patrón que ya usa setActiveView
  // para el menú lateral.
  return DEUDA_SCREEN_TABS.map(
    (tab) =>
      `<a class="e19-registrar-tab${tab.id === activeId ? " is-active" : ""}" href="#${tab.id}"${tab.id === activeId ? ' aria-current="page"' : ""}>${escapeHtml(tab.label)}</a>`
  ).join("");
}

function renderDeudaScreenTabs(activeId) {
  const nav = qs(DEUDA_SCREEN_TAB_NAV_IDS[activeId]);
  if (nav) nav.innerHTML = deudaScreenTabsHtml(activeId);
}

// D-2 · Contratos como dato canónico editable. DEBT_PORTFOLIO es la cartera de ejemplo; aquí se
// corrige capital pendiente, TAE o cuota cuando no coinciden con el contrato real. La corrección
// se guarda por contrato en `debtContractOverrides` y pasa por `debtContractBundle()` — la misma
// puerta que ya leen Ruta, Comparar, Hoy y el motor de escenarios, así que no hace falta avisar a
// nadie más: en cuanto se guarda, todo lo que lee la cartera ve el valor corregido la próxima vez
// que se renderiza.
function deudaContratosStatusBadge(paymentStatus) {
  const map = {
    active: { label: "Activa", tone: "e19-badge-neutral" },
    suspended: { label: "Pagos suspendidos", tone: "e19-badge-warning" },
    reunified: { label: "Reunificada", tone: "e19-badge-neutral" },
    settled: { label: "Liquidada", tone: "e19-badge-success" },
  };
  return map[paymentStatus] || { label: paymentStatus || "—", tone: "e19-badge-neutral" };
}

function deudaContratosQualityBadge(quality) {
  const missing = quality?.missing?.length || 0;
  if (!missing) return { label: "Dato completo", tone: "e19-badge-success" };
  if (quality?.confidence === "medium") return { label: `Falta ${missing} dato(s)`, tone: "e19-badge-warning" };
  return { label: `Faltan ${missing} dato(s)`, tone: "e19-badge-danger" };
}

function deudaContratosStatusOptionsHtml(current) {
  return DEBT_CONTRACT_ADD_STATUSES.map(
    (value) => `<option value="${value}"${value === current ? " selected" : ""}>${escapeHtml(deudaContratosStatusBadge(value).label)}</option>`
  ).join("");
}

function deudaContratosRowHtml(contract) {
  const edited = Boolean(debtContractOverrides[contract.id]);
  const isCustom = Boolean(contract.custom);
  const quality = deudaContratosQualityBadge(contract.dataQuality);
  const aprValue = contract.apr === null || contract.apr === undefined ? "" : contract.apr;
  const installments = Math.max(0, Math.floor(Number(contract.remainingInstallments) || 0));
  const id = escapeHtml(contract.id);
  const entityLabel = escapeHtml(contract.entity);
  return `<tr data-deuda-contrato-row="${id}"${isCustom ? ' class="deuda-contratos-row-custom"' : ""}>
      <td class="deuda-contratos-entity">
        <input type="text" class="deuda-contratos-entity-input" maxlength="80" data-deuda-contrato-id="${id}" data-deuda-contrato-field="entity" value="${entityLabel}" aria-label="Entidad de ${entityLabel}" />
        <span class="deuda-contratos-entity-meta">
          <input type="text" maxlength="40" placeholder="Tipo" data-deuda-contrato-id="${id}" data-deuda-contrato-field="type" value="${escapeHtml(contract.type)}" aria-label="Tipo de contrato de ${entityLabel}" />
          <input type="text" maxlength="60" placeholder="Número" data-deuda-contrato-id="${id}" data-deuda-contrato-field="number" value="${escapeHtml(contract.number || "")}" aria-label="Número de contrato de ${entityLabel}" />
        </span>
      </td>
      <td><input type="number" min="0" step="0.01" inputmode="decimal" data-deuda-contrato-id="${id}" data-deuda-contrato-field="currentPrincipal" value="${round2(contract.currentPrincipal)}" aria-label="Capital pendiente de ${entityLabel}" /></td>
      <td><input type="number" min="0" max="60" step="0.01" inputmode="decimal" data-deuda-contrato-id="${id}" data-deuda-contrato-field="apr" value="${aprValue}" placeholder="sin dato" aria-label="TAE de ${entityLabel}" /></td>
      <td><input type="number" min="0" step="0.01" inputmode="decimal" data-deuda-contrato-id="${id}" data-deuda-contrato-field="currentPayment" value="${round2(contract.currentPayment)}" aria-label="Cuota mensual de ${entityLabel}" /></td>
      <td><input type="number" min="0" step="1" inputmode="numeric" data-deuda-contrato-id="${id}" data-deuda-contrato-field="remainingInstallments" value="${installments}" aria-label="Plazos restantes de ${entityLabel}" /></td>
      <td><select data-deuda-contrato-id="${id}" data-deuda-contrato-field="paymentStatus" aria-label="Estado de ${entityLabel}">${deudaContratosStatusOptionsHtml(contract.paymentStatus)}</select></td>
      <td><span class="e19-badge ${quality.tone}">${escapeHtml(quality.label)}</span>${edited ? ' <span class="e19-badge e19-badge-neutral">Editado</span>' : ""}</td>
      <td><button type="button" class="deuda-contratos-row-remove" data-deuda-contrato-remove="${id}" aria-label="Eliminar el contrato de ${entityLabel}">×</button></td>
    </tr>`;
}

function renderDeudaContratos() {
  renderDeudaScreenTabs("deuda-contratos");
  const body = qs("deudaContratosTable");
  if (!body) return;
  const contracts = debtContractSourceRows();
  body.innerHTML = `<thead><tr>
        <th>Entidad</th><th>Capital pendiente</th><th>TAE</th><th>Cuota mensual</th><th>Plazos restantes</th><th>Estado</th><th>Calidad del dato</th><th><span class="sr-only">Acciones</span></th>
      </tr></thead>
      <tbody>${contracts.map(deudaContratosRowHtml).join("")}</tbody>`;
  const overriddenCount = contracts.filter((contract) => debtContractOverrides[contract.id]).length;
  const note = qs("deudaContratosNote");
  if (note) {
    note.textContent = overriddenCount
      ? `${overriddenCount} de ${contracts.length} contrato(s) con capital, TAE o cuota corregidos a mano. Se usan en Ruta, Comparar y en las cifras de deuda de Hoy.`
      : `Valores declarados de ejemplo (${contracts.length} contrato(s)). Corrige capital, TAE o cuota si no coinciden con el contrato real — se guardan en este navegador y no en ningún sitio más.`;
  }
  const cuadreEl = qs("deudaContratosCuadre");
  if (cuadreEl) cuadreEl.innerHTML = deudaContratosCuadreHtml(debtCapitalCuadre());
}

// D-15 · el simulador visual promovido desde «Herramientas avanzadas» a pestaña de Deuda: al
// entrar en la pestaña se reenvía el estado canónico al iframe por si los contratos cambiaron
// desde la última vez que se cargó (alta/edición en Contratos, nueva ruta en Ruta/Comparar).
function renderDeudaSimulador() {
  renderDeudaScreenTabs("deuda-simulador");
  sendDebtRoadmapState();
}

// Vacío = «sin corregir», nunca cero ni cadena vacía forzada: borra el override y vuelve al valor
// declarado en vez de clavar un dato que se leería como real. Un valor fuera de rango no se guarda
// ni se avisa aparte — el redibujado siguiente vuelve a enseñar el último valor válido, la misma
// disciplina que ya usan los demás campos numéricos de la app. Entidad/tipo/número son texto libre
// (D-2d): igual que el capital, vaciarlos borra el override en vez de guardar "".
function deudaContratosParseFieldValue(field, raw) {
  const trimmed = String(raw ?? "").trim();
  if (DEBT_CONTRACT_TEXT_FIELDS.includes(field)) {
    return trimmed === "" ? { clear: true } : { value: trimmed };
  }
  if (trimmed === "") return { clear: true };
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return { invalid: true };
  if (field === "apr" && value > 60) return { invalid: true };
  if (DEBT_CONTRACT_INTEGER_FIELDS.includes(field)) return { value: Math.floor(value) };
  return { value: round2(value) };
}

// D-2d · el estado no sigue la disciplina «vacío = sin corregir» del resto de campos porque es un
// <select>, siempre con un valor de los cuatro válidos — nunca en blanco. Además necesita escribir
// más de un campo a la vez: `reunified` y (para «Liquidada») `currentPrincipal` a 0, exactamente
// las mismas reglas de negocio que ya aplicaba el alta (`deudaContratosAddFormParse`), para que el
// normalizador (`canonical-debt-contracts.js`, que deriva paymentStatus de esos campos, no del
// texto) clasifique el contrato como se acaba de pedir.
function handleDeudaContratosStatusChange(id, rawValue) {
  if (!DEBT_CONTRACT_ADD_STATUSES.includes(rawValue)) {
    renderDeudaContratos();
    return;
  }
  const nextContract = { ...(debtContractOverrides[id] || {}) };
  nextContract.paymentStatus = rawValue;
  nextContract.reunified = rawValue === "reunified";
  if (rawValue === "settled") nextContract.currentPrincipal = 0;
  debtContractOverrides = { ...debtContractOverrides, [id]: nextContract };
  saveDebtContractOverrides();
  renderDeudaContratos();
}

function handleDeudaContratosFieldChange(input) {
  const id = input.dataset.deudaContratoId;
  const field = input.dataset.deudaContratoField;
  if (!id || !DEBT_CONTRACT_EDITABLE_FIELDS.includes(field)) return;
  if (field === "paymentStatus") {
    handleDeudaContratosStatusChange(id, input.value);
    return;
  }
  const parsed = deudaContratosParseFieldValue(field, input.value);
  if (parsed.invalid) {
    renderDeudaContratos();
    return;
  }
  const nextContract = { ...(debtContractOverrides[id] || {}) };
  if (parsed.clear) delete nextContract[field];
  else nextContract[field] = parsed.value;
  const nextOverrides = { ...debtContractOverrides };
  if (Object.keys(nextContract).length) nextOverrides[id] = nextContract;
  else delete nextOverrides[id];
  debtContractOverrides = nextOverrides;
  saveDebtContractOverrides();
  renderDeudaContratos();
}

// D-2c · dar de alta un contrato a mano, desde el propio formulario de Deuda › Contratos, en vez
// de inventar valores de ejemplo. Solo entidad y capital pendiente son obligatorios — el resto
// puede quedar «sin dato», igual que los contratos de ejemplo.
const DEBT_CONTRACT_ADD_STATUSES = ["active", "suspended", "reunified", "settled"];

function deudaContratosAddFormParse(values) {
  const entity = String(values.entity ?? "").trim();
  if (!entity) return { error: "Falta el nombre de la entidad." };
  const principalRaw = String(values.principal ?? "").trim();
  const principal = Number(principalRaw.replace(",", "."));
  if (principalRaw === "" || !Number.isFinite(principal) || principal < 0) {
    return { error: "El capital pendiente tiene que ser un número igual o mayor que 0." };
  }
  const aprRaw = String(values.apr ?? "").trim();
  const apr = aprRaw === "" ? null : Number(aprRaw.replace(",", "."));
  if (apr !== null && (!Number.isFinite(apr) || apr < 0 || apr > 60)) {
    return { error: "La TAE tiene que ser un número entre 0 y 60, o dejarla en blanco." };
  }
  const paymentRaw = String(values.payment ?? "").trim();
  const payment = paymentRaw === "" ? 0 : Number(paymentRaw.replace(",", "."));
  if (!Number.isFinite(payment) || payment < 0) {
    return { error: "La cuota mensual tiene que ser un número igual o mayor que 0." };
  }
  const installmentsRaw = String(values.installments ?? "").trim();
  const installments = installmentsRaw === "" ? 0 : Math.floor(Number(installmentsRaw.replace(",", ".")));
  if (!Number.isFinite(installments) || installments < 0) {
    return { error: "Los plazos restantes tienen que ser un número entero igual o mayor que 0." };
  }
  const status = DEBT_CONTRACT_ADD_STATUSES.includes(values.status) ? values.status : "active";
  // «Liquidada» solo es real con capital pendiente en 0 — así lo exige el normalizador
  // (canonical-debt-contracts.js): con capital pendiente > 0 no lo clasificaría como liquidado
  // aunque aquí se declare, así que se fuerza para no guardar un estado que luego no se vería.
  const currentPrincipal = status === "settled" ? 0 : round2(principal);
  return {
    entry: {
      entity,
      type: String(values.type || "Crédito").trim() || "Crédito",
      number: String(values.number ?? "").trim(),
      initialPrincipal: round2(principal),
      currentPrincipal,
      originalPayment: round2(payment),
      currentPayment: round2(payment),
      reunified: status === "reunified",
      paymentStatus: status,
      apr,
      remainingInstallments: Math.max(0, installments),
      maturity: "",
      custom: true,
    },
  };
}

function deudaContratosAddFormValues() {
  return {
    entity: qs("deudaContratosAddEntity")?.value,
    type: qs("deudaContratosAddType")?.value,
    number: qs("deudaContratosAddNumber")?.value,
    principal: qs("deudaContratosAddPrincipal")?.value,
    apr: qs("deudaContratosAddApr")?.value,
    payment: qs("deudaContratosAddPayment")?.value,
    status: qs("deudaContratosAddStatus")?.value,
    installments: qs("deudaContratosAddInstallments")?.value,
  };
}

function handleDeudaContratosAddSubmit(event) {
  event.preventDefault();
  const errorEl = qs("deudaContratosAddError");
  const result = deudaContratosAddFormParse(deudaContratosAddFormValues());
  if (result.error) {
    if (errorEl) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
    }
    return;
  }
  debtContractCustomEntries = [...debtContractCustomEntries, { id: nextDebtContractCustomId(), ...result.entry }];
  saveDebtContractCustomEntries();
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
  qs("deudaContratosAddForm")?.reset();
  renderDeudaContratos();
}

// D-2d · eliminar ya no está reservado a lo dado de alta a mano: un contrato de ejemplo también se
// puede quitar, aunque no exista en ningún array borrable (`DEBT_PORTFOLIO` es código). Se marca en
// `debtContractHiddenExampleIds` — la misma puerta única que ya filtra `debtPortfolioWithOverrides`
// — en vez de mutar la constante. Cualquier borrado pide confirmación primero, mismo patrón que
// `handleSavingsGoalAction`/objetivos: no hay deshacer.
function handleDeudaContratosRemove(id) {
  if (!id) return;
  const isCustom = debtContractCustomEntries.some((entry) => entry.id === id);
  const isExample = !isCustom && DEBT_PORTFOLIO.some((entry) => entry.id === id) && !debtContractHiddenExampleIds.includes(id);
  if (!isCustom && !isExample) return;
  const label = debtContractSourceRows().find((row) => row.id === id)?.entity || "este contrato";
  if (!window.confirm(`¿Eliminar el contrato de «${label}»?`)) return;
  if (isCustom) {
    debtContractCustomEntries = debtContractCustomEntries.filter((entry) => entry.id !== id);
    saveDebtContractCustomEntries();
  } else {
    debtContractHiddenExampleIds = [...debtContractHiddenExampleIds, id];
    saveDebtContractHiddenExampleIds();
  }
  if (debtContractOverrides[id]) {
    const nextOverrides = { ...debtContractOverrides };
    delete nextOverrides[id];
    debtContractOverrides = nextOverrides;
    saveDebtContractOverrides();
  }
  renderDeudaContratos();
}

function deudaContratosCuadreHtml(cuadre) {
  if (cuadre.status === "sin-cierre") {
    return `<p class="e19-kpi-note">Sin ningún cierre firmado todavía: no hay una foto de la deuda viva con la que comparar el capital editado.</p>`;
  }
  if (cuadre.status === "cuadra") {
    return `<p class="e19-kpi-note">Cuadra con la deuda viva del cierre de ${escapeHtml(ledgerMonthLabel(cuadre.monthKey))}: ${money(cuadre.atClose, true)}.</p>`;
  }
  return `<div>
    <p class="e19-kpi-note is-danger">No cuadra con la deuda viva del cierre de ${escapeHtml(ledgerMonthLabel(cuadre.monthKey))}: ${money(cuadre.atClose, true)} en el cierre, ${money(cuadre.current, true)} ahora — diferencia de ${money(Math.abs(cuadre.diff), true)}. Nunca se guarda un descuadre en silencio.</p>
    <div class="deuda-contratos-cuadre-actions">
      <button type="button" class="e19-btn e19-btn-secondary" id="deudaContratosCuadreAdjust">Ajustar aquí</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-home-nav="cierre">Ir a Cierre</button>
    </div>
  </div>`;
}
