// T14 (BACKLOG_CONTABILIDADCASA_2_0.md): código exclusivo de las vistas "escenario-simular",
// "escenario-aplicar", "escenario-guardados" y "escenario-comparar", extraído de app.js —
// primer incremento de reducir el monolito técnico (2,1MB/41.596 líneas), mismo patrón ya
// probado por Deuda (OPT-24, PERF-1) e Inversión (I1): <script> clásico cargado bajo demanda,
// no módulo ES — sus declaraciones de nivel superior aterrizan en el mismo scope global de
// siempre, así que llaman y son llamadas por app.js exactamente igual que si nunca se hubieran
// movido.
//
// Lo que NO se movió, a propósito: el "motor" de escenarios (escenarioMotorBaseInput,
// escenarioMotorDebtOptions/DebtLabel, el catálogo ESCENARIO_MOTOR_TYPES y sus helpers de campo,
// runEscenarioMotor, escenarioMotorSummaryFor, escenarioMotorMonthLabel, loadEscenarioMotorSaved…)
// se queda en app.js porque lo reutilizan otras tres pantallas que NO forman parte de este hub:
// el simulador "¿y si...?"/vista fantasma de escenarios de Planificación de partidas, la segunda
// opinión (CPX2) y el comparador de las 8 estrategias de deuda. Moverlo también habría exigido
// que esas tres pantallas cargasen este mismo fragmento antes de poder pintar nada — un cambio de
// comportamiento (una espera de red donde hoy no la hay) fuera del alcance de "reducir el
// monolito sin tocar nada más". Auditado función por función contra el archivo completo antes de
// mover una sola línea — el reparto exacto está documentado en el cierre de sesión de
// PROJECT_STATE.md.

function escenarioMotorSyncDraftValues() {
  const type = escenarioMotorTypeOrCustomById(escenarioMotorDraftTipo);
  const container = qs("escenarioMotorFields");
  if (!type || !container) return;
  type.campos.forEach((field) => {
    const element = qs(escenarioMotorFieldElementId(field.key));
    if (!element) return;
    escenarioMotorDraftValues[field.key] = escenarioMotorReadFieldValue(field, element);
  });
}

function escenarioMotorSyncFieldVisibility() {
  const type = escenarioMotorTypeOrCustomById(escenarioMotorDraftTipo);
  const container = qs("escenarioMotorFields");
  if (!type || !container) return;
  type.campos.forEach((field) => {
    if (typeof field.visibleSi !== "function") return;
    const wrap = container.querySelector(`[data-escenario-motor-field-wrap="${field.key}"]`);
    if (wrap) wrap.hidden = !field.visibleSi(escenarioMotorDraftValues);
  });
}

// Rebusca opciones (deudas y meses) en cada render para que no queden obsoletas, pero se abstiene
// si el usuario tiene el foco dentro del formulario: reconstruirlo bajo sus dedos le haría perder
// el cursor a media escritura.
function renderEscenarioMotorForm(baseInput) {
  const typeSelect = qs("escenarioMotorType");
  const container = qs("escenarioMotorFields");
  const hint = qs("escenarioMotorTypeHint");
  if (!typeSelect || !container) return;

  const allTypes = escenarioMotorAllTypeEntries();
  // E-1b: se reconstruye también cuando cambia el número de tipos propios guardados (crear uno
  // nuevo), no solo la primera vez — `childElementCount` por sí solo no lo detectaría.
  if (!typeSelect.childElementCount || typeSelect.dataset.typeCount !== String(allTypes.length)) {
    const grupos = [];
    allTypes.forEach((type) => {
      const grupo = grupos.find((item) => item.nombre === type.grupo);
      if (grupo) grupo.tipos.push(type);
      else grupos.push({ nombre: type.grupo, tipos: [type] });
    });
    typeSelect.innerHTML = grupos
      .map((grupo) => `<optgroup label="${escapeHtml(grupo.nombre)}">${grupo.tipos
        .map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>`)
        .join("")}</optgroup>`)
      .join("");
    typeSelect.dataset.typeCount = String(allTypes.length);
  }
  typeSelect.value = escenarioMotorDraftTipo;

  const type = escenarioMotorTypeOrCustomById(escenarioMotorDraftTipo);
  if (hint) hint.textContent = type?.ayuda || "";
  if (!type) return;

  if (container.contains(document.activeElement)) {
    escenarioMotorSyncFieldVisibility();
    return;
  }
  escenarioMotorSyncDraftValues();
  container.innerHTML = type.campos
    .map((field) => escenarioMotorFieldHtml(field, baseInput.months, escenarioMotorDraftValues))
    .join("");
  container.dataset.tipo = type.id;
  // Los desplegables no admiten «sin valor»: lo que muestran ya es el valor efectivo, así que se
  // vuelca al borrador para que `params()` vea lo mismo que el usuario.
  escenarioMotorSyncDraftValues();
  escenarioMotorSyncFieldVisibility();
}

function escenarioMotorShowFormErrors(messages) {
  const box = qs("escenarioMotorFormError");
  const list = qs("escenarioMotorFormErrorList");
  if (!box || !list) return;
  if (!messages.length) {
    box.hidden = true;
    list.innerHTML = "";
    return;
  }
  box.hidden = false;
  list.innerHTML = messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("");
}

// Traduce el `path` que devuelve el contrato ($.params.importe) al rótulo del campo, para que el
// mensaje señale el control que hay que rellenar en vez de un nombre técnico.
function escenarioMotorIssueMessage(issue, type) {
  const key = String(issue.path || "").split(".").pop();
  const field = type.campos.find((item) => item.key === key || (item.key === "mes" && key === "mesManual"));
  return field ? `${field.label}: ${issue.message}` : issue.message;
}


// `resultado: "rechazada"` viene siempre acompañado de un `motivo` del propio aplicador; sin él, el
// texto genérico sería inútil para decidir qué corregir.
function escenarioMotorRejectionInfo(resultado) {
  if (resultado?.resultado !== "rechazada") return null;
  const table = {
    "deuda-no-suspendida": "Rechazada: esa deuda no tiene los pagos suspendidos",
    "sin-objetivo": "Rechazada: falta indicar la deuda",
  };
  const text = table[resultado.motivo];
  return { text: text || `Rechazada: ${resultado.motivo || "sin motivo declarado"}`, badge: "e19-badge-danger" };
}

function escenarioMotorEfectoLabel(efecto) {
  const table = {
    "cierre-total": "Amortización total · deuda cerrada",
    "amortizacion-parcial": "Amortización parcial",
    "cierre-total-fraccionado": "Amortización a plazos · deuda cerrada",
    "amortizacion-fraccionada-parcial": "Amortización a plazos parcial",
    refinanciada: "Deuda refinanciada",
    "pagos-reanudados": "Pagos retomados",
    reunificada: "Deudas reunificadas",
    compra: "Compra añadida al plan",
    imprevisto: "Imprevisto añadido al plan",
    proyecto: "Proyecto añadido al plan",
    cambio_ingreso: "Ingreso mensual ajustado",
    cambio_gasto: "Gasto mensual ajustado",
  };
  return table[efecto] || efecto || "";
}



// E-5 (Escenarios.pdf): "Cuatro comprobaciones: origen de fondos, reserva protegida, umbral de
// capacidad y condiciones registradas. Cada una con su estado." Reutiliza señales que el resto de
// la pantalla ya calcula (E-3, el guardarraíl del formulario, el modo de saldo de Registrar) en
// vez de inventar una comprobación paralela. Cuando no hay nada que comprobar dice "sin dato"
// (`pending`), nunca "cumple" — regla transversal 04, dato ausente no es cero.
function escenarioMotorValidationChecks(result, scenarioSummary, guardrailValue) {
  const resultados = result?.resultados || [];
  const rejected = resultados.filter((item) => item.resultado !== "aplicada" && item.resultado !== "inactiva");
  const guardrailBroken = rejected.some((item) => item.resultado === "guardarril-incumplido");
  const otherRejected = rejected.filter((item) => item.resultado !== "guardarril-incumplido");
  const isManualBalance = state?.balanceMode === "manual";
  const hasGuardrail = Number.isFinite(guardrailValue) && guardrailValue > 0;
  const capacidad = scenarioSummary?.capacidadLibre;
  const hasCapacidad = capacidad !== null && capacidad !== undefined;

  return [
    {
      id: "origen",
      label: "Origen de los fondos",
      status: isManualBalance ? "ok" : "warn",
      detail: isManualBalance
        ? `Saldo real declarado a ${formatIsoDate(state.balanceDate || defaultBalanceDate())}.`
        : "Saldo estimado por el motor de fecha, no un saldo declarado a mano.",
    },
    {
      id: "reserva",
      label: "Reserva protegida",
      status: !hasGuardrail ? "pending" : guardrailBroken ? "fail" : "ok",
      detail: !hasGuardrail
        ? "Sin saldo mínimo indicado: no hay nada que comprobar."
        : guardrailBroken
          ? "Alguna decisión rompe el saldo mínimo indicado."
          : `Se mantiene por encima de ${money(guardrailValue, true)} en todo el horizonte.`,
    },
    {
      id: "capacidad",
      label: "Umbral de capacidad",
      status: !hasCapacidad ? "pending" : capacidad < 0 ? "fail" : "ok",
      detail: !hasCapacidad
        ? "Sin datos suficientes para calcular la capacidad libre."
        : capacidad < 0
          ? `Capacidad libre negativa: ${money(capacidad, true)}.`
          : `Capacidad libre real: ${money(capacidad, true)}.`,
    },
    {
      id: "condiciones",
      label: "Condiciones registradas",
      status: !resultados.length ? "pending" : otherRejected.length ? "fail" : "ok",
      detail: !resultados.length
        ? "Todavía no hay ninguna decisión que comprobar."
        : otherRejected.length
          ? `${otherRejected.length} decisión(es) no cumplen sus condiciones.`
          : "Todas las decisiones cumplen las condiciones del contrato.",
    },
  ];
}

function escenarioMotorValidationChecklistHtml(checks) {
  const statusClass = { ok: "is-ok", fail: "is-danger", warn: "is-warn", pending: "is-neutral" };
  return checks
    .map(
      (check) =>
        `<li class="deuda-ruta-check ${statusClass[check.status] || "is-neutral"}"><strong>${escapeHtml(check.label)}</strong><span>${escapeHtml(check.detail)}</span></li>`
    )
    .join("");
}


// Fila de la comparativa de seis indicadores: plan vigente frente a la simulación, coloreada según
// mejore o empeore (no según el signo bruto — una fecha «después» es peor aunque sea un número
// mayor). `higherIsBetter=null` deshabilita el color (no hay una dirección buena/mala clara).
function escenarioMotorCompareRowHtml(label, planValue, scenarioValue, formatValue, formatDelta, higherIsBetter = true) {
  const hasBoth = planValue !== null && planValue !== undefined && scenarioValue !== null && scenarioValue !== undefined;
  let toneClass = "";
  let deltaText = "—";
  if (hasBoth) {
    const delta = round2(scenarioValue - planValue);
    deltaText = formatDelta(delta);
    if (higherIsBetter !== null && delta !== 0) toneClass = (delta > 0) === higherIsBetter ? "is-up" : "is-down";
  }
  return `<tr>
    <td>${escapeHtml(label)}</td>
    <td>${hasBoth ? escapeHtml(formatValue(planValue)) : "—"}</td>
    <td><strong>${hasBoth ? escapeHtml(formatValue(scenarioValue)) : "—"}</strong></td>
    <td class="escenario-motor-compare-delta ${toneClass}">${escapeHtml(deltaText)}</td>
  </tr>`;
}

function escenarioMotorMonthCompareDelta(scenarioKey, baseKey) {
  const scenarioIsMonth = /^\d{4}-\d{2}/.test(scenarioKey || "");
  const baseIsMonth = /^\d{4}-\d{2}/.test(baseKey || "");
  if (!scenarioIsMonth || !baseIsMonth) return { text: "—", tone: "" };
  if (scenarioKey === baseKey) return { text: "sin cambio", tone: "" };
  return scenarioKey < baseKey ? { text: "antes", tone: "is-up" } : { text: "después", tone: "is-down" };
}

function escenarioMotorKpiCardsHtml(baseSummary, scenarioSummary) {
  const bajoReserva = Number.isFinite(escenarioMotorGuardrailValue) && (scenarioSummary.minimoLiquidez ?? 0) < escenarioMotorGuardrailValue;
  const libreDelta = escenarioMotorMonthCompareDelta(scenarioSummary.libreDeDeuda, baseSummary.libreDeDeuda);
  const peorMesLabel = (summary) =>
    summary.peorMesClave ? `${escenarioMotorMonthLabel(summary.peorMesClave)} · ${money(summary.peorMesValor ?? 0, true)}` : "—";

  const rows = [
    escenarioMotorCompareRowHtml(
      "Reserva protegida",
      baseSummary.liquidezFinal,
      scenarioSummary.liquidezFinal,
      (value) => money(value, true),
      (delta) => `${delta >= 0 ? "+" : ""}${money(delta, true)}`,
    ),
    escenarioMotorCompareRowHtml(
      "Meses de colchón",
      baseSummary.mesesColchon,
      scenarioSummary.mesesColchon,
      (value) => value.toFixed(1),
      (delta) => `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`,
    ),
    `<tr>
      <td>Fecha libre de deuda</td>
      <td>${escapeHtml(escenarioMotorMonthLabel(baseSummary.libreDeDeuda))}</td>
      <td><strong>${escapeHtml(escenarioMotorMonthLabel(scenarioSummary.libreDeDeuda))}</strong></td>
      <td class="escenario-motor-compare-delta ${libreDelta.tone}">${escapeHtml(libreDelta.text)}</td>
    </tr>`,
    escenarioMotorCompareRowHtml(
      "Ahorro anual",
      baseSummary.ahorroAnual,
      scenarioSummary.ahorroAnual,
      (value) => money(value, true),
      (delta) => `${delta >= 0 ? "+" : ""}${money(delta, true)}`,
    ),
    `<tr class="${bajoReserva ? "is-danger" : ""}">
      <td>Peor mes</td>
      <td>${escapeHtml(peorMesLabel(baseSummary))}</td>
      <td><strong>${escapeHtml(peorMesLabel(scenarioSummary))}</strong></td>
      <td class="escenario-motor-compare-delta ${
        baseSummary.peorMesValor !== null && scenarioSummary.peorMesValor !== null
          ? scenarioSummary.peorMesValor >= baseSummary.peorMesValor
            ? "is-up"
            : "is-down"
          : ""
      }">${
        baseSummary.peorMesValor !== null && scenarioSummary.peorMesValor !== null
          ? `${round2(scenarioSummary.peorMesValor - baseSummary.peorMesValor) >= 0 ? "+" : ""}${money(round2(scenarioSummary.peorMesValor - baseSummary.peorMesValor), true)}${bajoReserva ? " · bajo el saldo mínimo indicado" : ""}`
          : "—"
      }</td>
    </tr>`,
    escenarioMotorCompareRowHtml(
      "Capacidad libre real",
      baseSummary.capacidadLibre,
      scenarioSummary.capacidadLibre,
      (value) => money(value, true),
      (delta) => `${delta >= 0 ? "+" : ""}${money(delta, true)}`,
    ),
  ];

  return `<table class="e19-table escenario-motor-compare-table">
    <thead><tr><th>Indicador</th><th>Plan</th><th>Simulado</th><th>Diferencia</th></tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

// Gráfico plan actual vs. simulación (mockup 1e). Reutiliza projectChartTickIndexes (ya usado por
// el simulador de proyectos) para las etiquetas de mes — misma convención visual en toda la app.
function renderEscenarioMotorChart(baseSeries, scenarioSeries, months, guardrailValue) {
  const svg = qs("escenarioMotorChart");
  if (!svg || !baseSeries.length || !scenarioSeries.length) return;
  const width = svg.clientWidth || 640;
  const height = 170;
  const pad = { left: 50, right: 16, top: 16, bottom: 26 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const values = [...baseSeries.map((row) => row.totalLiquidity), ...scenarioSeries.map((row) => row.totalLiquidity)];
  if (Number.isFinite(guardrailValue)) values.push(guardrailValue);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = baseSeries.length;
  const x = (i) => pad.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (value) => pad.top + plotH - ((value - minV) / Math.max(1, maxV - minV)) * plotH;
  const pathFor = (series) => series.map((row, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(row.totalLiquidity).toFixed(2)}`).join(" ");

  let markup = `<path class="chart-line-base" d="${pathFor(baseSeries)}" />`;
  markup += `<path class="chart-line-scenario" d="${pathFor(scenarioSeries)}" />`;
  if (Number.isFinite(guardrailValue)) {
    const ry = y(guardrailValue).toFixed(2);
    markup += `<line class="chart-line-reserve" x1="${pad.left}" x2="${width - pad.right}" y1="${ry}" y2="${ry}" />`;
  }
  projectChartTickIndexes(months, width).forEach((idx) => {
    markup += `<text class="chart-label" x="${(x(idx) - 14).toFixed(2)}" y="${height - 6}">${escapeHtml(months[idx]?.month || "")}</text>`;
  });
  svg.insertAdjacentHTML("beforeend", markup);
}


// Los escenarios guardados antes de E20-3 no llevan `titulo` (solo existía amortización), igual que
// las rutas que llegan desde el comparador de estrategias. Se reconstruye con el mismo generador de
// título del catálogo, que solo lee claves presentes también en `params`.
function escenarioMotorDecisionTitle(decision, debts) {
  if (decision.titulo) return decision.titulo;
  const type = escenarioMotorResolveType(decision);
  if (!type) return decision.tipo || "Decisión";
  const debtLabel = (deudaId) => {
    const contract = debts?.get(deudaId);
    return contract ? escenarioMotorDebtLabel(contract) : escenarioMotorDebtLabelById(deudaId);
  };
  return escenarioMotorTrim(type.titulo(decision.params || {}, { debtLabel }) || type.label);
}

function escenarioMotorDecisionDetail(decision) {
  const type = escenarioMotorResolveType(decision);
  return type && typeof type.detalle === "function" ? type.detalle(decision) : "";
}


// El mes efectivo depende del tipo: la planificación lo lleva en los tipos de deuda y en compra,
// pero `imprevisto`, `retomar_pagos` y los cambios de ingreso/gasto lo llevan en sus propios params.
function escenarioMotorDecisionMonthKey(decision, resultado) {
  return resultado?.mesResuelto
    || decision.planificacion?.mesResuelto
    || decision.planificacion?.mesManual
    || decision.params?.mes
    || decision.params?.mesInicio
    || decision.params?.mesObjetivo
    || null;
}

function escenarioMotorDraftName() {
  const debts = new Map(canonicalDebtContractRows().map((contract) => [contract.id, contract]));
  const parts = escenarioMotorDecisions.map((decision) => escenarioMotorDecisionTitle(decision, debts));
  return parts.join(" + ") || "Escenario sin nombre";
}

// E-7 (Escenarios.pdf): "Además del diagnóstico, nombra qué parámetro habría que cambiar y qué
// dirección para que el escenario deje de romper la reserva." Reutiliza las mismas cuatro
// comprobaciones de E-5 — nunca vuelve a decidir por su cuenta si algo falla — y nombra la decisión
// concreta que rompe el guardarraíl cuando la hay, con una dirección genérica (importe o mes), no
// una cifra recalculada: dar un número exacto exigiría probar valores hasta encontrar uno viable,
// un buscador que esta pantalla no tiene (eso es lo que hace «Ajustar automáticamente» con el mes,
// no con el importe).
function escenarioMotorVerdictText(checks, decisions, rejected) {
  if (!decisions.length) return "";
  const reserva = checks.find((check) => check.id === "reserva");
  if (reserva?.status === "fail") {
    const culprit = rejected.find((item) => item.resultado === "guardarril-incumplido");
    const decision = culprit ? decisions.find((item) => item.id === culprit.id) : null;
    const debts = new Map(canonicalDebtContractRows().map((contract) => [contract.id, contract]));
    const nombre = decision ? escenarioMotorDecisionTitle(decision, debts) : "una de las decisiones";
    return `Esta simulación rompe la reserva mínima indicada. La palanca es «${nombre}»: reduce su importe o elígele un mes con más margen.`;
  }
  const capacidad = checks.find((check) => check.id === "capacidad");
  if (capacidad?.status === "fail") {
    return "La capacidad libre real queda en negativo: reduce el gasto comprometido en esta simulación o repártelo en más meses para que deje de romperla.";
  }
  const condiciones = checks.find((check) => check.id === "condiciones");
  if (condiciones?.status === "fail") {
    return "Alguna decisión no cumple sus propias condiciones (ver su motivo en la lista); el resto de la simulación no rompe ningún límite conocido.";
  }
  return "Esta simulación no rompe ningún límite conocido con las decisiones actuales.";
}

// E-8: "Liquidez apilada CaixaBank / Mediolanum mes a mes; los meses bajo el mínimo operativo se
// tiñen y se nombran." El motor de dos cuentas ya reparte cada mes en `checking` (CaixaBank) y
// `savings` (Mediolanum) — la banda es una lectura nueva de esa misma serie, no un cálculo nuevo.
// Sin una cifra de «mínimo operativo» configurada en la app, el umbral honesto es 0: CaixaBank en
// negativo ese mes (regla transversal 04, no inventar un umbral que no existe en Ajustes).
function escenarioMotorAccountBand(scenarioSeries, months) {
  const sample = scenarioSeries.slice(0, 12);
  return sample.map((row, index) => ({
    key: months[index]?.key || "",
    label: months[index]?.month || "",
    checking: round2(row.checking ?? 0),
    savings: round2(row.savings ?? 0),
    bajoMinimo: (row.checking ?? 0) < 0,
  }));
}

function escenarioMotorAccountBandHtml(band) {
  if (!band.length) return "";
  const max = Math.max(1, ...band.map((item) => Math.abs(item.checking) + Math.max(0, item.savings)));
  return band
    .map((item) => {
      const checkingHeight = round2((Math.abs(item.checking) / max) * 100);
      const savingsHeight = round2((Math.max(0, item.savings) / max) * 100);
      return `<div class="escenario-motor-account-col${item.bajoMinimo ? " is-bajo-minimo" : ""}">
        <div class="escenario-motor-account-bar">
          <span class="escenario-motor-account-seg is-savings" style="height:${savingsHeight}%"></span>
          <span class="escenario-motor-account-seg ${item.bajoMinimo ? "is-bajo" : "is-checking"}" style="height:${checkingHeight}%"></span>
        </div>
        <span class="escenario-motor-account-label">${escapeHtml(item.label)}</span>
      </div>`;
    })
    .join("");
}

function escenarioMotorAccountBandNote(band) {
  const bajo = band.filter((item) => item.bajoMinimo);
  if (!bajo.length) return "";
  return `${bajo.map((item) => item.label).join(", ")} queda${bajo.length > 1 ? "n" : ""} con CaixaBank en negativo.`;
}

// E-9: "El conmutador de la barra sustituye la vista entera: desaparecen la tabla de indicadores y
// la validación, y queda la explicación llana con las cuatro cifras que importan en casa." Las
// cuatro son un subconjunto de los seis indicadores de E-3 (los dos más operativos —peor mes,
// capacidad libre— se quedan en la vista técnica): mismas cifras, sin recalcular nada.
function escenarioMotorFamilyCardHtml(scenarioSummary) {
  const rows = [
    ["¿Cuánto nos queda?", scenarioSummary.liquidezFinal !== null ? money(scenarioSummary.liquidezFinal, true) : "—"],
    ["¿Cuántos meses aguantaríamos sin ingresos?", scenarioSummary.mesesColchon !== null ? `${scenarioSummary.mesesColchon.toFixed(1)} meses` : "—"],
    ["¿Cuándo dejamos de deber?", escenarioMotorMonthLabel(scenarioSummary.libreDeDeuda)],
    ["¿Cuánto ahorramos al año?", scenarioSummary.ahorroAnual !== null ? money(scenarioSummary.ahorroAnual, true) : "—"],
  ];
  return `<article class="e19-card escenario-motor-family-card">
    <h3 class="escenario-motor-panel-title">Explicado para casa</h3>
    <dl class="escenario-motor-family-list">${rows
      .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
      .join("")}</dl>
  </article>`;
}

// E-6b: "Un escenario rechazado se puede guardar como aviso: queda etiquetado «esto es lo que no
// aguantamos» y no se puede aplicar." Reutiliza el texto de rechazo ya calculado (E-5/E-6) — nunca
// inventa una explicación nueva — y comparte la lista de guardados con estado `"aviso"`, distinto
// de `"guardado"`/`"aplicado"`.
function escenarioMotorAvisoReason(rejected) {
  if (!rejected.length) return "Rechazado sin motivo declarado.";
  const info = escenarioMotorRejectionInfo(rejected[0]) || escenarioMotorResultInfo(rejected[0].resultado);
  return `${info?.text || "Rechazado"}.`;
}

function handleEscenarioMotorSaveAviso() {
  if (!escenarioMotorDecisions.length) return;
  const baseInput = escenarioMotorBaseInput();
  const result = runEscenarioMotor(baseInput, escenarioMotorDecisions, escenarioMotorGuardrailValue);
  const rejected = (result?.resultados || []).filter((item) => item.resultado !== "aplicada" && item.resultado !== "inactiva");
  if (!rejected.length) return;
  const saved = loadEscenarioMotorSaved();
  escenarioMotorSavedSeq += 1;
  saved.unshift({
    id: `escenario-guardado-${Date.now()}-${escenarioMotorSavedSeq}`,
    nombre: escenarioMotorDraftName(),
    motivo: escenarioMotorAvisoReason(rejected),
    estado: "aviso",
    fecha: new Date().toISOString(),
    decisiones: JSON.parse(JSON.stringify(escenarioMotorDecisions)),
    guardrailValue: escenarioMotorGuardrailValue,
  });
  saveEscenarioMotorSavedList(saved);
  escenarioMotorDecisions = [];
  renderEscenarioSimular();
}

function handleEscenarioMotorFamilyToggle() {
  escenarioMotorFamilyView = !escenarioMotorFamilyView;
  renderEscenarioSimular();
}

function renderEscenarioSimular() {
  renderScenarioDependencyNotice("escenario-simular");
  const baseInput = escenarioMotorBaseInput();
  renderEscenarioMotorForm(baseInput);

  const guardrailField = qs("escenarioMotorGuardrail");
  if (guardrailField && document.activeElement !== guardrailField) {
    guardrailField.value = escenarioMotorGuardrailValue ?? "";
  }

  const body = qs("escenarioMotorDecisionsList");
  const empty = qs("escenarioMotorEmpty");
  const kpis = qs("escenarioMotorKpis");
  const validationCard = qs("escenarioMotorValidationCard");
  const validationList = qs("escenarioMotorValidationList");
  const warning = qs("escenarioMotorWarning");
  const warningText = qs("escenarioMotorWarningText");
  const autoAdjustButton = qs("escenarioMotorAutoAdjust");
  const goApplyButton = qs("escenarioMotorGoApply");
  const saveAvisoButton = qs("escenarioMotorSaveAviso");
  const verdictEl = qs("escenarioMotorVerdict");
  const accountBandCard = qs("escenarioMotorAccountBandCard");
  const accountBandEl = qs("escenarioMotorAccountBand");
  const accountBandNoteEl = qs("escenarioMotorAccountBandNote");
  const familyToggle = qs("escenarioMotorFamilyToggle");
  const familyCard = qs("escenarioMotorFamilyCard");
  if (!body || !kpis) return;

  familyToggle?.classList.toggle("is-active", escenarioMotorFamilyView);
  if (familyToggle) familyToggle.textContent = escenarioMotorFamilyView ? "Vista técnica" : "Vista familiar";

  const baseResult = runEscenarioMotor(baseInput, [], null);

  if (!escenarioMotorDecisions.length) {
    body.innerHTML = "";
    if (empty) empty.hidden = false;
    kpis.innerHTML = "";
    if (validationCard) validationCard.hidden = true;
    if (validationList) validationList.innerHTML = "";
    if (warning) warning.hidden = true;
    if (goApplyButton) goApplyButton.disabled = true;
    if (verdictEl) verdictEl.hidden = true;
    if (familyCard) familyCard.hidden = true;
    if (accountBandCard) accountBandCard.hidden = true;
    renderEscenarioMotorChart(baseResult?.series || [], baseResult?.series || [], baseInput.months, escenarioMotorGuardrailValue);
    return;
  }
  if (empty) empty.hidden = true;

  const result = runEscenarioMotor(baseInput, escenarioMotorDecisions, escenarioMotorGuardrailValue);
  const debts = new Map(canonicalDebtContractRows().map((contract) => [contract.id, contract]));
  const resultadosById = new Map((result?.resultados || []).map((item) => [item.id, item]));
  const rejected = (result?.resultados || []).filter((item) => item.resultado !== "aplicada");
  if (saveAvisoButton) saveAvisoButton.hidden = !rejected.length;

  body.innerHTML = escenarioMotorDecisions
    .map((decision) => {
      const resultado = resultadosById.get(decision.id);
      const info = (resultado && escenarioMotorRejectionInfo(resultado))
        || (resultado ? escenarioMotorResultInfo(resultado.resultado) : { text: "Sin calcular", badge: "e19-badge-neutral" });
      const mesLabel = decision.planificacion.modo === "optimo"
        ? (resultado?.mesResuelto ? `Óptimo · ${escenarioMotorMonthLabel(resultado.mesResuelto)}` : "Buscando mes óptimo…")
        : escenarioMotorMonthLabel(escenarioMotorDecisionMonthKey(decision, resultado));
      const detalle = escenarioMotorDecisionDetail(decision);
      return `<li class="escenario-motor-decision-item">
        <div class="escenario-motor-decision-main">
          <strong>${escapeHtml(escenarioMotorDecisionTitle(decision, debts))}</strong>
          <span>${escapeHtml(detalle ? `${detalle} · ${mesLabel}` : mesLabel)}</span>
        </div>
        <div class="escenario-motor-decision-status">
          <span class="e19-badge ${info.badge}">${escapeHtml(info.text)}</span>
          <button type="button" class="escenario-motor-decision-remove" data-escenario-motor-remove="${escapeHtml(decision.id)}">Quitar</button>
        </div>
      </li>`;
    })
    .join("");

  renderEscenarioMotorChart(baseResult?.series || [], result?.series || baseResult?.series || [], baseInput.months, escenarioMotorGuardrailValue);

  if (!result || !result.valid) {
    kpis.innerHTML = "";
    if (validationCard) validationCard.hidden = true;
    if (validationList) validationList.innerHTML = "";
    if (warning) warning.hidden = true;
    if (goApplyButton) goApplyButton.disabled = true;
    if (verdictEl) verdictEl.hidden = true;
    if (familyCard) familyCard.hidden = true;
    if (accountBandCard) accountBandCard.hidden = true;
    return;
  }

  const baseSummary = escenarioMotorSummaryFor(baseResult, baseInput.months);
  const scenarioSummary = escenarioMotorSummaryFor(result, baseInput.months);
  const checks = escenarioMotorValidationChecks(result, scenarioSummary, escenarioMotorGuardrailValue);

  // E-9: el conmutador sustituye la comparativa técnica entera por la tarjeta llana — nunca se
  // muestran las dos a la vez.
  if (kpis) kpis.hidden = escenarioMotorFamilyView;
  if (validationCard) validationCard.hidden = escenarioMotorFamilyView;
  if (verdictEl) verdictEl.hidden = escenarioMotorFamilyView;
  if (familyCard) {
    familyCard.hidden = !escenarioMotorFamilyView;
    if (escenarioMotorFamilyView) familyCard.innerHTML = escenarioMotorFamilyCardHtml(scenarioSummary);
  }
  if (!escenarioMotorFamilyView) {
    kpis.innerHTML = escenarioMotorKpiCardsHtml(baseSummary, scenarioSummary);
    if (validationList) validationList.innerHTML = escenarioMotorValidationChecklistHtml(checks);
    if (verdictEl) verdictEl.textContent = escenarioMotorVerdictText(checks, escenarioMotorDecisions, result.resultados || []);
  }

  // E-8: banda de doce meses por cuenta — se ve en ambas vistas, técnica y familiar, porque no es
  // parte de «la tabla de indicadores» que E-9 retira.
  if (accountBandCard) accountBandCard.hidden = false;
  if (accountBandEl || accountBandNoteEl) {
    const band = escenarioMotorAccountBand(result.series || [], baseInput.months);
    if (accountBandEl) accountBandEl.innerHTML = escenarioMotorAccountBandHtml(band);
    if (accountBandNoteEl) accountBandNoteEl.textContent = escenarioMotorAccountBandNote(band);
  }

  if (rejected.length) {
    if (warning) warning.hidden = false;
    const info = escenarioMotorRejectionInfo(rejected[0]) || escenarioMotorResultInfo(rejected[0].resultado);
    if (warningText) {
      warningText.textContent = rejected.length > 1
        ? `${info.text} (y ${rejected.length - 1} decisión(es) más sin aplicar).`
        : `${info.text}.`;
    }
    if (autoAdjustButton) autoAdjustButton.hidden = !rejected.some((item) => item.resultado === "guardarril-incumplido");
    if (goApplyButton) goApplyButton.disabled = true;
  } else {
    if (warning) warning.hidden = true;
    if (goApplyButton) goApplyButton.disabled = false;
  }
}

// Construye la decisión desde el borrador y la valida con el contrato antes de aceptarla. Si el
// contrato la rechaza no se añade nada: se muestran sus propios mensajes, campo a campo, en vez de
// dejar entrar una decisión que el motor resolvería a medias o ignoraría.
function handleEscenarioMotorSubmit(event) {
  event.preventDefault();
  const type = escenarioMotorTypeOrCustomById(escenarioMotorDraftTipo);
  if (!type) return;
  escenarioMotorSyncDraftValues();
  const values = escenarioMotorEffectiveValues(type, escenarioMotorDraftValues);
  const mesManual = type.mes(values);

  const decision = {
    id: escenarioMotorNewDecisionId(),
    // E-1b: un tipo propio se identifica en el formulario por su clave de selección
    // (`propio_<definicionId>`), pero el motor y el esquema solo conocen el tipo real `"propio"`.
    tipo: type.engineTipo || type.id,
    titulo: escenarioMotorTrim(type.titulo(values, { debtLabel: escenarioMotorDebtLabelById }) || type.label),
    activa: true,
    orden: escenarioMotorDecisions.length,
    planificacion: mesManual ? { modo: "manual", mesManual } : { modo: "optimo" },
    params: type.params(values),
  };

  const issues = [];
  const schema = window.FinanceCanonicalScenarioSchema;
  // Sin esquema no se validaba nada y la decisión entraba igual: peor que no poder añadirla, porque
  // aceptaba en silencio un dato sin comprobar. Ahora se dice y no se añade.
  if (!schema) {
    escenarioMotorShowFormErrors([
      "No se puede comprobar esta decisión: no se ha cargado canonical-scenario-schema.js. No se añade nada, para no aceptar un dato sin validar.",
    ]);
    return;
  }
  schema.validateDecision(decision, "$", issues);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length) {
    escenarioMotorShowFormErrors(errors.map((issue) => escenarioMotorIssueMessage(issue, type)));
    return;
  }

  escenarioMotorShowFormErrors([]);
  escenarioMotorDecisions.push(decision);
  escenarioMotorResetDraft(type);
  renderEscenarioSimular();
  // P-2: la decisión ya está añadida (y su impacto, en la comparativa de siempre) — la vista previa
  // del borrador vacío no tiene nada que mostrar.
  renderEscenarioMotorLivePreview();
}


// Tras añadir una decisión se vacían los importes y textos, pero se conservan los desplegables
// (deuda, mes, titular…): encadenar dos decisiones sobre el mismo mes es el caso normal.
function escenarioMotorResetDraft(type) {
  type.campos.forEach((field) => {
    if (["money", "number", "int", "pct", "text", "date"].includes(field.kind)) delete escenarioMotorDraftValues[field.key];
    if (field.kind === "checkbox") escenarioMotorDraftValues[field.key] = false;
  });
}

function handleEscenarioMotorTypeChange(event) {
  escenarioMotorSyncDraftValues();
  escenarioMotorDraftTipo = event.target.value;
  escenarioMotorShowFormErrors([]);
  renderEscenarioMotorForm(escenarioMotorBaseInput());
  // P-2: la vista previa es del tipo anterior — se oculta al cambiar, en vez de dejar una cifra de
  // un campo que ya no se ve.
  renderEscenarioMotorLivePreview();
}

// E-1b: el constructor de tipos propios es un panel plegable independiente del formulario de
// decisión — abrirlo/cerrarlo no toca `escenarioMotorDraftTipo` ni el borrador en curso.
function handleEscenarioMotorCustomToggle() {
  escenarioMotorCustomBuilderOpen = !escenarioMotorCustomBuilderOpen;
  const builder = qs("escenarioMotorCustomBuilder");
  if (builder) builder.hidden = !escenarioMotorCustomBuilderOpen;
}

function escenarioMotorCustomFieldsFromForm() {
  const campos = [];
  if (qs("escenarioMotorCustomFieldImporte")?.checked) campos.push("importe");
  if (qs("escenarioMotorCustomFieldMensualidad")?.checked) campos.push("mensualidad");
  if (qs("escenarioMotorCustomFieldPlazo")?.checked) campos.push("plazo");
  return campos;
}

// Crea la definición y deja el simulador listo para su primera decisión: el tipo nuevo queda
// seleccionado, con su propio formulario (los campos elegidos + mes) ya pintado.
function handleEscenarioMotorCustomCreate() {
  const labelInput = qs("escenarioMotorCustomLabel");
  const familiaSelect = qs("escenarioMotorCustomFamilia");
  const errorEl = qs("escenarioMotorCustomError");
  const label = (labelInput?.value || "").trim();
  const campos = escenarioMotorCustomFieldsFromForm();
  const showError = (message) => {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = message;
    }
  };
  if (!label) {
    showError("Ponle un nombre al tipo.");
    return;
  }
  if (!campos.length) {
    showError("Elige al menos un campo, además del mes.");
    return;
  }
  if (errorEl) errorEl.hidden = true;

  const custom = {
    id: escenarioMotorNewCustomTypeId(),
    familia: familiaSelect?.value === "Deuda" ? "Deuda" : "Vida",
    label: escenarioMotorTrim(label, 60),
    campos,
  };
  const list = loadEscenarioMotorCustomTypes();
  list.push(custom);
  saveEscenarioMotorCustomTypesList(list);

  escenarioMotorCustomBuilderOpen = false;
  if (labelInput) labelInput.value = "";
  escenarioMotorDraftTipo = `propio_${custom.id}`;
  escenarioMotorDraftValues = {};
  renderEscenarioSimular();
}

// Solo reacciona a los campos que gobiernan la visibilidad de otros (la casilla «la financio», el
// selector de modalidad…); el resto se lee al enviar, para no reconstruir el formulario mientras se
// escribe en él. P-2 es la excepción puntual: un campo con deslizador (`field.range`) sincroniza su
// pareja número/rango y dispara la vista previa en vivo, sin tocar el resto del formulario.
function handleEscenarioMotorFieldChange(event) {
  const key = event.target?.dataset?.escenarioMotorField;
  if (!key) return;
  const type = escenarioMotorTypeOrCustomById(escenarioMotorDraftTipo);
  const field = type?.campos.find((item) => item.key === key);
  if (!field) return;
  escenarioMotorDraftValues[key] = escenarioMotorReadFieldValue(field, event.target);
  if (field.controla) escenarioMotorSyncFieldVisibility();
  if (field.range) {
    escenarioMotorSyncRangePairValue(field, event.target);
    clearTimeout(escenarioMotorPreviewDebounceTimer);
    escenarioMotorPreviewDebounceTimer = setTimeout(renderEscenarioMotorLivePreview, 120);
  }
}

// El número y el deslizador comparten `data-escenario-motor-field`, así que ambos disparan este
// mismo manejador — pero cada uno solo actualiza su propio valor visible, no el del otro. Sin este
// paso, arrastrar el deslizador no movería la cifra del campo numérico (y viceversa al escribir).
// `document.activeElement` evita pisar el control que el usuario tiene enfocado ahora mismo si
// llega un evento tardío.
function escenarioMotorSyncRangePairValue(field, changedElement) {
  const numberEl = qs(escenarioMotorFieldElementId(field.key));
  const rangeEl = qs(escenarioMotorRangeElementId(field.key));
  if (!numberEl || !rangeEl) return;
  const target = changedElement === numberEl ? rangeEl : numberEl;
  if (document.activeElement === target) return;
  if (target === rangeEl) {
    const parsed = Number(changedElement.value);
    target.value = Number.isFinite(parsed) ? String(parsed) : "0";
  } else {
    target.value = changedElement.value;
  }
}

function handleEscenarioMotorRemove(id) {
  escenarioMotorDecisions = escenarioMotorDecisions.filter((decision) => decision.id !== id);
  renderEscenarioSimular();
}

// P-2: construye la misma forma de decisión que `handleEscenarioMotorSubmit` (id/tipo/planificacion/
// params), pero sin pasar por el contrato ni escribir en `escenarioMotorDecisions` — es un borrador
// de usar y tirar solo para la vista previa. Sin delta (campo vacío o en 0, «sin cambio») no hay
// nada que previsualizar: null, no un impacto fabricado con un número que el usuario no ha puesto.
function escenarioMotorDraftPreviewDecision() {
  const type = escenarioMotorTypeOrCustomById(escenarioMotorDraftTipo);
  if (!type || (type.id !== "cambio_ingreso" && type.id !== "cambio_gasto")) return null;
  const values = escenarioMotorEffectiveValues(type, escenarioMotorDraftValues);
  const delta = type.id === "cambio_gasto" && values.modoCambio === "porcentaje" ? values.deltaPct : values.deltaMensual;
  if (!Number.isFinite(delta) || delta === 0) return null;
  const mesManual = type.mes(values);
  return {
    id: "escenario-motor-preview-draft",
    tipo: type.id,
    titulo: "Vista previa",
    activa: true,
    orden: escenarioMotorDecisions.length,
    planificacion: mesManual ? { modo: "manual", mesManual } : { modo: "optimo" },
    params: type.params(values),
  };
}

// Reutiliza tal cual `runEscenarioMotor`/`escenarioMotorSummaryFor` — el mismo motor y el mismo
// resumen que ya construyen la comparativa de seis KPI de `renderEscenarioSimular` — sobre un bloque
// propio (`#escenarioMotorLivePreview`), aparte de la tarjeta de comparación ya verificada: no la
// sustituye ni la reutiliza, así que no hay riesgo de dejarla en un estado a medias si la vista
// previa se oculta antes de terminar de cargar.
function renderEscenarioMotorLivePreview() {
  const container = qs("escenarioMotorLivePreview");
  if (!container) return;
  const draft = escenarioMotorDraftPreviewDecision();
  if (!draft) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  const baseInput = escenarioMotorBaseInput();
  const before = runEscenarioMotor(baseInput, escenarioMotorDecisions, escenarioMotorGuardrailValue);
  const after = runEscenarioMotor(baseInput, [...escenarioMotorDecisions, draft], escenarioMotorGuardrailValue);
  if (!before?.valid || !after?.valid) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  const beforeSummary = escenarioMotorSummaryFor(before, baseInput.months);
  const afterSummary = escenarioMotorSummaryFor(after, baseInput.months);
  const reserveDelta = Number.isFinite(beforeSummary.liquidezFinal) && Number.isFinite(afterSummary.liquidezFinal)
    ? round2(afterSummary.liquidezFinal - beforeSummary.liquidezFinal)
    : null;
  const cushionDelta = Number.isFinite(beforeSummary.mesesColchon) && Number.isFinite(afterSummary.mesesColchon)
    ? round2(afterSummary.mesesColchon - beforeSummary.mesesColchon)
    : null;
  container.hidden = false;
  container.innerHTML = `<strong>Vista previa en vivo · sin añadir todavía</strong>
    <p>Reserva protegida: ${money(beforeSummary.liquidezFinal ?? 0, true)} → ${money(afterSummary.liquidezFinal ?? 0, true)}
      (${reserveDelta === null ? "—" : `${reserveDelta >= 0 ? "+" : ""}${money(reserveDelta, true)}`})</p>
    <p>Meses de colchón: ${(beforeSummary.mesesColchon ?? 0).toFixed(1)} → ${(afterSummary.mesesColchon ?? 0).toFixed(1)}
      (${cushionDelta === null ? "—" : `${cushionDelta >= 0 ? "+" : ""}${cushionDelta.toFixed(1)}`})</p>`;
}

// E-2 (Escenarios.pdf): "el resultado se recalcula al editar, con 120 ms de debounce sobre el
// cálculo" — este campo es el único que recalcula la simulación completa mientras se escribe (los
// campos por tipo solo se leen al enviar, R-6/E-2 no aplican ahí). Se lee el valor al vuelo para
// que el propio `<input>` nunca pierda lo que se ha tecleado, pero el recálculo/render se retrasa.
function handleEscenarioMotorGuardrailInput(event) {
  const value = Number(event.target.value);
  escenarioMotorGuardrailValue = Number.isFinite(value) && value > 0 ? value : null;
  clearTimeout(escenarioMotorGuardrailDebounceTimer);
  escenarioMotorGuardrailDebounceTimer = setTimeout(renderEscenarioSimular, 120);
}

// «Ajustar automáticamente» reutiliza el buscador de mes óptimo real del motor (planificacion.modo
// "optimo", día 3 de E20-0): no calcula nada aquí, solo cambia cómo se planifica la decisión y deja
// que el motor busque el primer mes viable — o la rechace con «sin-mes-viable» si no existe.
function handleEscenarioMotorAutoAdjust() {
  const baseInput = escenarioMotorBaseInput();
  const result = runEscenarioMotor(baseInput, escenarioMotorDecisions, escenarioMotorGuardrailValue);
  const rejectedIds = new Set(
    (result?.resultados || []).filter((item) => item.resultado === "guardarril-incumplido").map((item) => item.id)
  );
  if (!rejectedIds.size) return;
  escenarioMotorDecisions = escenarioMotorDecisions.map((decision) =>
    rejectedIds.has(decision.id) ? { ...decision, planificacion: { modo: "optimo" } } : decision
  );
  renderEscenarioSimular();
}

function handleEscenarioMotorGoApply() {
  if (!escenarioMotorDecisions.length) return;
  escenarioMotorNavigate("escenario-aplicar");
}

// ---------------------------------------------------------------------------------------------
// Pantalla 2 · Aplicar escenario (mockup 2d): diferencia línea a línea antes de confirmar. No
// muta los contratos de deuda — «aplicar» aquí significa registrar el escenario como el aplicado
// en la lista de guardados (pantalla 3), con motivo y fecha, de verdad reversible porque no toca
// ningún dato real. La única puerta que sí toca el contrato es Deuda › Contratos (D-2), y vive
// aparte de este flujo de decisiones.
// ---------------------------------------------------------------------------------------------
function renderEscenarioAplicar() {
  renderScenarioDependencyNotice("escenario-aplicar");
  if (!escenarioMotorDecisions.length) {
    escenarioMotorNavigate("escenario-simular");
    return;
  }
  const baseInput = escenarioMotorBaseInput();
  const baseResult = runEscenarioMotor(baseInput, [], null);
  const result = runEscenarioMotor(baseInput, escenarioMotorDecisions, escenarioMotorGuardrailValue);
  const debts = new Map(canonicalDebtContractRows().map((contract) => [contract.id, contract]));
  const resultadosById = new Map((result?.resultados || []).map((item) => [item.id, item]));

  const titleEl = qs("escenarioAplicarTitle");
  if (titleEl) titleEl.textContent = escenarioMotorDraftName();
  const changesTitle = qs("escenarioAplicarChangesTitle");
  if (changesTitle) changesTitle.textContent = `${escenarioMotorDecisions.length} cambio(s) en el plan`;

  const baseSummary = escenarioMotorSummaryFor(baseResult, baseInput.months);
  const scenarioSummary = escenarioMotorSummaryFor(result, baseInput.months);
  const kpis = qs("escenarioAplicarKpis");
  if (kpis) kpis.innerHTML = escenarioMotorKpiCardsHtml(baseSummary, scenarioSummary);

  // CP6: el mismo plan (mismas decisiones, mismo guardarraíl), una vez bajo el escenario de
  // tensión. No sustituye la validación contra el contrato de arriba, la complementa: esa dice si
  // el plan es válido hoy, esta dice si seguiría siéndolo si ingresos y gastos van peor.
  const tensionResult = runEscenarioMotor(escenarioMotorTensionInput(baseInput), escenarioMotorDecisions, escenarioMotorGuardrailValue);
  const tensionSummary = escenarioMotorSummaryFor(tensionResult, baseInput.months);
  const tensionNote = qs("escenarioAplicarTensionNote");
  if (tensionNote) {
    const tensionResultados = tensionResult?.resultados || [];
    const tensionRejected = tensionResultados.filter((item) => item.resultado !== "aplicada").length;
    const minimoLiquidezText = tensionSummary.minimoLiquidez === null ? "sin datos" : money(tensionSummary.minimoLiquidez, true);
    if (!tensionResultados.length) {
      tensionNote.textContent = "No se pudo calcular el escenario de tensión para este plan.";
    } else if (!tensionRejected) {
      tensionNote.textContent = `Con ingresos un 10 % más bajos y gastos un 10 % más altos, el plan seguiría aplicándose entero. Caja mínima bajo tensión: ${minimoLiquidezText}.`;
    } else {
      tensionNote.textContent = `Con ingresos un 10 % más bajos y gastos un 10 % más altos, ${tensionRejected} de ${tensionResultados.length} decisión(es) dejarían de aplicarse. Caja mínima bajo tensión: ${minimoLiquidezText}. Revísalo antes de confirmar: esto no bloquea la confirmación, solo la informa.`;
    }
  }
  const validationList = qs("escenarioAplicarValidationList");
  if (validationList) {
    validationList.innerHTML = escenarioMotorValidationChecklistHtml(
      escenarioMotorValidationChecks(result, scenarioSummary, escenarioMotorGuardrailValue)
    );
  }

  const body = qs("escenarioAplicarDiffBody");
  if (body) {
    body.innerHTML = escenarioMotorDecisions
      .map((decision) => {
        const resultado = resultadosById.get(decision.id);
        const info = (resultado && escenarioMotorRejectionInfo(resultado))
          || (resultado ? escenarioMotorResultInfo(resultado.resultado) : { text: "Sin calcular", badge: "e19-badge-neutral" });
        const efecto = resultado?.efecto ? escenarioMotorEfectoLabel(resultado.efecto) : info.text;
        const mesLabel = escenarioMotorMonthLabel(escenarioMotorDecisionMonthKey(decision, resultado));
        return `<tr>
          <td>${escapeHtml(escenarioMotorDecisionTitle(decision, debts))}</td>
          <td>${escapeHtml(efecto)}</td>
          <td>${escapeHtml(escenarioMotorDecisionAmountText(decision))}</td>
          <td>${escapeHtml(mesLabel)}</td>
        </tr>`;
      })
      .join("");
  }

  const confirmButton = qs("escenarioAplicarConfirm");
  const allApplied = (result?.resultados || []).length > 0 && (result?.resultados || []).every((item) => item.resultado === "aplicada");
  if (confirmButton) confirmButton.disabled = !allApplied;
}

function handleEscenarioAplicarBack() {
  escenarioMotorNavigate("escenario-simular");
}



// E-11b: "diez planes vivos como máximo, sin cupos por familia" (decisión de arquitectura, 14 de
// agosto, docs/BACKLOG_NUEVE_PANTALLAS.md §2) — archivar no borra, solo saca de la cuenta y de la
// lista activa; el usuario archiva a mano para liberar sitio.
function escenarioMotorLiveSavedCount() {
  return loadEscenarioMotorSaved().filter((entry) => !entry.archived).length;
}

function escenarioMotorLimitReached() {
  return escenarioMotorLiveSavedCount() >= 10;
}

function showEscenarioMotorLimitDialog() {
  qs("escenarioMotorLimitDialog")?.showModal?.();
}

// E-11 · la fecha de revisión es opcional (a diferencia del motivo): sin ella no se crea ningún
// recordatorio, «misma barra que Deuda» — homeEscenarioReviewReminders() la lee igual que
// homeDebtReviewReminders() ya hace con decision.e14Application.reviewDate.
// E-11b: aplicar ya no sobrescribe nada — genera una copia marcada «propuesto» que convive con
// cuanto ya hubiera guardado, aplicado o propuesto. Confirmarla o descartarla vive en Cierre
// (handleCierrePropuestoConfirm/Discard), nunca aquí.
function handleEscenarioAplicarConfirm(event) {
  event.preventDefault();
  const motivoInput = qs("escenarioAplicarMotivo");
  const motivo = (motivoInput?.value || "").trim();
  if (!motivo) {
    motivoInput?.focus();
    return;
  }
  if (escenarioMotorLimitReached()) {
    showEscenarioMotorLimitDialog();
    return;
  }
  const reviewDateInput = qs("escenarioAplicarReviewDate");
  const reviewDate = reviewDateInput?.value || "";
  const saved = loadEscenarioMotorSaved();
  escenarioMotorSavedSeq += 1;
  saved.unshift({
    id: `escenario-guardado-${Date.now()}-${escenarioMotorSavedSeq}`,
    nombre: escenarioMotorDraftName(),
    motivo,
    estado: "propuesto",
    fecha: new Date().toISOString(),
    decisiones: JSON.parse(JSON.stringify(escenarioMotorDecisions)),
    guardrailValue: escenarioMotorGuardrailValue,
    reviewDate,
  });
  saveEscenarioMotorSavedList(saved);
  escenarioMotorDecisions = [];
  if (motivoInput) motivoInput.value = "";
  if (reviewDateInput) reviewDateInput.value = "";
  escenarioMotorNavigate("escenario-guardados");
}

// ---------------------------------------------------------------------------------------------
// Pantalla 3 · Escenarios guardados (mockup 2e). Los KPIs de cada tarjeta se recalculan al vuelo
// con el motor real sobre el estado actual de las deudas — nunca se leen cifras congeladas del
// momento en que se guardó, para que no diverjan en silencio de la realidad.
// E-11b: "Vigente" (antes "Aplicado") es lo que Cierre confirmó; "Propuesto" es lo que Aplicar
// acaba de crear y todavía no pasó por Cierre. Pueden convivir varios de cada uno — ya no hay «solo
// uno a la vez». "aplicado" se lee como alias legado de "vigente" para no perder tarjetas ya
// guardadas antes de esta sesión.
// ---------------------------------------------------------------------------------------------
function escenarioMotorSavedCardHtml(entry) {
  const baseInput = escenarioMotorBaseInput();
  const result = runEscenarioMotor(baseInput, entry.decisiones || [], entry.guardrailValue ?? null);
  const summary = escenarioMotorSummaryFor(result, baseInput.months);
  const esVigente = entry.estado === "aplicado" || entry.estado === "vigente";
  // E-6b: un cuarto estado, distinto de vigente/propuesto/guardado — el escenario no converge y se
  // guarda para no repetir el mismo intento sin darse cuenta.
  // E-13: un "guardado" o "propuesto" con oferta enlazada (D-13) que ya venció (D-10) se marca
  // "Caducado" en vez de su badge normal — solo aplica a lo que todavía no cambió el plan de
  // verdad: un escenario ya vigente no se deshace porque su oferta original caduque.
  const offerExpiry = (entry.estado === "guardado" || entry.estado === "propuesto") && entry.ofertaExpiresAt ? debtOfferExpiryStatus(entry.ofertaExpiresAt) : null;
  const caducado = Boolean(offerExpiry?.expired);
  const estadoInfo = esVigente
    ? { text: "Vigente", badge: "e19-badge-success" }
    : entry.estado === "aviso"
      ? { text: "Aviso", badge: "e19-badge-danger" }
      : caducado
        ? { text: "Caducado", badge: "e19-badge-danger" }
        : entry.estado === "propuesto"
          ? { text: "Propuesto", badge: "e19-badge-accent" }
          : { text: "Guardado", badge: "e19-badge-neutral" };
  const fecha = entry.fecha ? new Date(entry.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "";
  const cardClass = esVigente ? " is-aplicado" : entry.estado === "aviso" || caducado ? " is-aviso" : entry.estado === "propuesto" ? " is-propuesto" : "";
  const archiveAction = entry.archived
    ? `<button type="button" class="e19-btn e19-btn-secondary" data-escenario-guardado-restore="${escapeHtml(entry.id)}">Restaurar</button>`
    : `<button type="button" class="e19-btn e19-btn-secondary" data-escenario-guardado-archive="${escapeHtml(entry.id)}">Archivar</button>`;
  return `<article class="escenario-motor-saved-card${cardClass}">
      <div class="escenario-motor-saved-head">
        <span class="e19-badge ${estadoInfo.badge}">${estadoInfo.text}</span>
        <strong>${escapeHtml(entry.nombre || "Escenario")}</strong>
        <small>${escapeHtml(entry.motivo || "")}${fecha ? ` · ${escapeHtml(fecha)}` : ""}</small>
      </div>
      <div class="escenario-motor-saved-meta">
        <div><span>Libre de deuda</span><strong>${escapeHtml(escenarioMotorMonthLabel(summary.libreDeDeuda))}</strong></div>
        <div><span>Caja mínima</span><strong>${money(summary.minimoLiquidez ?? 0, true)}</strong></div>
        <div><span>Liquidez final</span><strong>${money(summary.liquidezFinal ?? 0, true)}</strong></div>
      </div>
      ${entry.estado === "propuesto" ? `<p class="escenario-motor-saved-note">Propuesto: se confirma o se descarta al cerrar el mes.</p>` : ""}
      ${entry.estado === "aviso" ? `<p class="escenario-motor-saved-limite">límite conocido</p>` : ""}
      ${caducado ? `<p class="escenario-motor-saved-limite">oferta caducada desde ${escapeHtml(escenarioMotorMonthLabel(entry.ofertaExpiresAt))}: revisa si sigue en pie antes de cargarlo</p>` : ""}
      ${!caducado && offerExpiry?.dueSoon ? `<p class="escenario-motor-saved-limite">oferta a punto de caducar: vence ${escapeHtml(escenarioMotorMonthLabel(entry.ofertaExpiresAt))}</p>` : ""}
      <div class="escenario-motor-saved-actions">
        <button type="button" class="e19-btn e19-btn-secondary" data-escenario-guardado-load="${escapeHtml(entry.id)}">Cargar en simulador</button>
        ${archiveAction}
        <button type="button" class="e19-btn e19-btn-secondary" data-escenario-guardado-delete="${escapeHtml(entry.id)}">Eliminar</button>
      </div>
    </article>`;
}

function renderEscenarioGuardados() {
  renderScenarioDependencyNotice("escenario-guardados");
  const list = loadEscenarioMotorSaved();
  const container = qs("escenarioGuardadosList");
  const empty = qs("escenarioGuardadosEmpty");
  if (!container) return;
  if (!list.length) {
    container.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const active = list.filter((entry) => !entry.archived);
  const archived = list.filter((entry) => entry.archived);
  // E-11b: archivar no borra (regla 07 del catálogo de Laboratorio) — solo saca de la cuenta de
  // "diez planes vivos" y de la vista principal; sigue accesible, con su propio botón de restaurar.
  const archivedHtml = archived.length
    ? `<details class="escenario-motor-saved-archived">
        <summary>Archivados · ${archived.length}</summary>
        ${archived.map(escenarioMotorSavedCardHtml).join("")}
      </details>`
    : "";
  container.innerHTML = active.map(escenarioMotorSavedCardHtml).join("") + archivedHtml;
}

function handleEscenarioGuardadosLoad(id) {
  const entry = loadEscenarioMotorSaved().find((item) => item.id === id);
  if (!entry) return;
  escenarioMotorDecisions = JSON.parse(JSON.stringify(entry.decisiones || []));
  escenarioMotorGuardrailValue = entry.guardrailValue ?? null;
  escenarioMotorNavigate("escenario-simular");
}

function handleEscenarioGuardadosDelete(id) {
  const list = loadEscenarioMotorSaved();
  const entry = list.find((item) => item.id === id);
  saveEscenarioMotorSavedList(list.filter((item) => item.id !== id));
  // Eliminar un plan vigente es posible desde aquí (sin confirmación propia, fuera del alcance de
  // este cambio) — si ocurre, sus reflejos en debtLiquidations/projects/customPlanningRows se
  // retractan con él en vez de quedar huérfanos, apuntando a un plan que ya no existe.
  if (entry && (entry.estado === "aplicado" || entry.estado === "vigente")) {
    if (retractDebtLiquidationsFromEscenario(id)) saveDebtLiquidations();
    if (retractProjectsFromEscenario(id)) saveProjects();
    if (retractPlanningRowsFromEscenario(id)) saveCustomPlanningRows();
  }
  renderEscenarioGuardados();
}

// E-11b: archivar retira del cupo de diez y de la vista principal, pero no borra nada — regla 07
// del catálogo de Laboratorio ("archivar no borra"), misma disciplina que ya siguen las heredadas.
function handleEscenarioGuardadosArchive(id) {
  const list = loadEscenarioMotorSaved().map((entry) => (entry.id === id ? { ...entry, archived: true, archivedAt: new Date().toISOString() } : entry));
  saveEscenarioMotorSavedList(list);
  renderEscenarioGuardados();
}

function handleEscenarioGuardadosRestore(id) {
  const list = loadEscenarioMotorSaved().map((entry) => {
    if (entry.id !== id) return entry;
    const { archived, archivedAt, ...rest } = entry;
    return rest;
  });
  saveEscenarioMotorSavedList(list);
  renderEscenarioGuardados();
}

function handleEscenarioGuardadosNew() {
  escenarioMotorDecisions = [];
  escenarioMotorGuardrailValue = null;
  escenarioMotorNavigate("escenario-simular");
}

// ---------------------------------------------------------------------------------------------
// E-12: "Tabla de N+1 columnas —plan, y un escenario guardado por cada uno marcado— con los mismos
// seis indicadores." Sin color de dirección (a diferencia de E-3): comparar A contra B no tiene un
// «mejor» universal sin saber cuál de los dos se está defendiendo, así que se deja la lectura al
// usuario. Los avisos (E-6b) no entran en la lista de candidatos — no son escenarios viables que
// comparar, es un límite conocido.
//
// #4 (Ola 3, plan de mejora post-E20 · 28/08/2026): la tabla estaba fija a exactamente dos
// escenarios (A/B) por los dos <select> de la pantalla, no por el motor — `runEscenarioMotor`/
// `escenarioMotorSummaryFor` ya eran genéricos por escenario. Se sustituyen los selects por una
// lista de checkboxes («qué escenarios comparar») y la tabla acepta cualquier número de columnas.
// ---------------------------------------------------------------------------------------------
function escenarioMotorCompareTableHtml(baseSummary, entries) {
  const rows = [
    ["Reserva protegida", (s) => (s.liquidezFinal !== null ? money(s.liquidezFinal, true) : "—")],
    ["Meses de colchón", (s) => (s.mesesColchon !== null ? s.mesesColchon.toFixed(1) : "—")],
    ["Fecha libre de deuda", (s) => escenarioMotorMonthLabel(s.libreDeDeuda)],
    ["Ahorro anual", (s) => (s.ahorroAnual !== null ? money(s.ahorroAnual, true) : "—")],
    ["Peor mes", (s) => (s.peorMesClave ? `${escenarioMotorMonthLabel(s.peorMesClave)} · ${money(s.peorMesValor ?? 0, true)}` : "—")],
    ["Capacidad libre real", (s) => (s.capacidadLibre !== null ? money(s.capacidadLibre, true) : "—")],
  ];
  const multiClass = entries.length > 2 ? " is-multi" : "";
  const headerCells = entries.map(({ nombre }) => `<th>${escapeHtml(nombre)}</th>`).join("");
  return `<table class="e19-table escenario-motor-compare-table${multiClass}">
    <thead><tr><th>Indicador</th><th>Plan</th>${headerCells}</tr></thead>
    <tbody>${rows
      .map(([label, format]) => {
        const cells = entries.map(({ summary }) => `<td><strong>${escapeHtml(format(summary))}</strong></td>`).join("");
        return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(format(baseSummary))}</td>${cells}</tr>`;
      })
      .join("")}</tbody>
  </table>`;
}

function escenarioMotorCompareCandidates() {
  return loadEscenarioMotorSaved().filter((entry) => entry.estado !== "aviso");
}

function renderEscenarioComparar() {
  renderScenarioDependencyNotice("escenario-comparar");
  const picker = qs("escenarioCompararPicker");
  const body = qs("escenarioCompararBody");
  const empty = qs("escenarioCompararEmpty");
  const layout = qs("escenarioCompararLayout");
  if (!picker || !body) return;

  const list = escenarioMotorCompareCandidates();
  if (list.length < 2) {
    if (empty) empty.hidden = false;
    if (layout) layout.hidden = true;
    picker.innerHTML = "";
    body.innerHTML = "";
    escenarioCompararSelected = [];
    escenarioCompararSignature = "";
    return;
  }
  if (empty) empty.hidden = true;
  if (layout) layout.hidden = false;

  // Un candidato nuevo (guardado/archivado/restaurado) cambia la firma: la selección vuelve a
  // «todos», igual que antes el segundo select saltaba por defecto al segundo candidato.
  const signature = list.map((entry) => entry.id).join(",");
  if (signature !== escenarioCompararSignature) {
    escenarioCompararSelected = list.map((entry) => entry.id);
    escenarioCompararSignature = signature;
  }

  picker.innerHTML = list
    .map(
      (entry) =>
        `<label><input type="checkbox" data-escenario-comparar-pick="${escapeHtml(entry.id)}" ${escenarioCompararSelected.includes(entry.id) ? "checked" : ""} /><span>${escapeHtml(entry.nombre || "Escenario")}</span></label>`,
    )
    .join("");

  const selected = list.filter((entry) => escenarioCompararSelected.includes(entry.id));
  if (!selected.length) {
    body.innerHTML = `<p class="e19-subtitle">Marca al menos un escenario de la lista de arriba para verlo comparado con el plan.</p>`;
    return;
  }
  const baseInput = escenarioMotorBaseInput();
  const baseSummary = escenarioMotorSummaryFor(runEscenarioMotor(baseInput, [], null), baseInput.months);
  const entries = selected.map((entry) => ({
    nombre: entry.nombre || "Escenario",
    summary: escenarioMotorSummaryFor(runEscenarioMotor(baseInput, entry.decisiones || [], entry.guardrailValue ?? null), baseInput.months),
  }));
  body.innerHTML = escenarioMotorCompareTableHtml(baseSummary, entries);
}

function handleEscenarioCompararPick(checkbox) {
  const id = checkbox.dataset.escenarioCompararPick;
  if (!id) return;
  escenarioCompararSelected = checkbox.checked
    ? [...escenarioCompararSelected, id].filter((value, index, arr) => arr.indexOf(value) === index)
    : escenarioCompararSelected.filter((existing) => existing !== id);
  renderEscenarioComparar();
}

