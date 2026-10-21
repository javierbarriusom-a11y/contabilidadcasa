// Motor de escenarios de la app: catálogo de tipos (incluidos los propios del hogar), campos, cálculo de cada
// escenario y escenarios guardados. Script clásico cargado antes de app.js (comparte su ámbito global: qs, state,
// money…). No confundir con views/escenarios.js, que es la pantalla de Escenarios y se carga al visitarla: el motor
// vive aquí, y no allí, porque lo usan también pantallas que no la cargan (Plan › Partidas, la segunda opinión y el
// comparador de estrategias de deuda), y tiene que estar disponible sin esperar a la red.
//
// Desalojado de app.js (XGO-01 · PR-2, sesión 334, 21/10/2026), sin cambiar una coma: el motor de escenarios.
// Siguen siendo funciones globales del mismo ámbito que app.js; este fichero se carga antes que él, así que ya
// existen cuando app.js arranca. Solo declaraciones de función: nada se ejecuta al cargar.

function escenarioMotorBaseInput() {
  return canonicalEngineInput(projectPlan.outflows || []);
}

function escenarioMotorTensionInput(baseInput) {
  return {
    ...baseInput,
    months: (baseInput.months || []).map((month) => ({
      ...month,
      income: round2(Number(month.income || 0) * CP6_TENSION_INCOME_FACTOR),
      coreSpend: round2(Number(month.coreSpend || 0) * CP6_TENSION_EXPENSE_FACTOR),
      variableOperationalSpend: round2(Number(month.variableOperationalSpend || 0) * CP6_TENSION_EXPENSE_FACTOR),
      endOfMonthOutflows: round2(Number(month.endOfMonthOutflows || 0) * CP6_TENSION_EXPENSE_FACTOR),
    })),
  };
}

// Incluye el plan reunificado sintético (canonicalDebtContractRows añade «reunified-plan-current»
// cuando existe) además de los contratos con nombre propio, para que amortizar el plan combinado
// sea un objetivo válido igual que cualquier otra deuda activa.
function escenarioMotorDebtOptions() {
  return canonicalDebtContractRows().filter(
    (contract) => contract.paymentStatus !== "settled" && contract.paymentStatus !== "reunified" && Number(contract.currentPrincipal) > 0
  );
}

function escenarioMotorDebtLabel(contract) {
  return contract.entity ? `${contract.entity} ${contract.type || ""}`.trim() : contract.label || contract.id;
}

function escenarioMotorNewDecisionId() {
  let out = "";
  for (let index = 0; index < 26; index += 1) {
    out += ESCENARIO_MOTOR_ID_ALPHABET[Math.floor(Math.random() * ESCENARIO_MOTOR_ID_ALPHABET.length)];
  }
  return `dec_${out}`;
}

// E-1b: identificador de una definición de tipo propio — no es un id de decisión (no tiene por qué
// cumplir el patrón `dec_…` del esquema, solo aparece como `params.definicionId`, una cadena libre).
function escenarioMotorNewCustomTypeId() {
  let out = "";
  for (let index = 0; index < 16; index += 1) {
    out += ESCENARIO_MOTOR_ID_ALPHABET[Math.floor(Math.random() * ESCENARIO_MOTOR_ID_ALPHABET.length)];
  }
  return `propio-${out}`;
}

function escenarioMotorTrim(value, max = 60) {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escenarioMotorInt(value) {
  return Number.isFinite(value) ? Math.round(value) : undefined;
}

// El TIN se pide en % (más legible) y el esquema lo quiere en fracción 0-0,60.
function escenarioMotorPct(value) {
  return Number.isFinite(value) ? round2(value * 100) / 10000 : undefined;
}

function loadEscenarioMotorCustomTypes() {
  try {
    const parsed = JSON.parse(storageGet(storageKey("escenario-motor-custom-types"), "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEscenarioMotorCustomTypesList(list) {
  storageSet(storageKey("escenario-motor-custom-types"), JSON.stringify(list));
}

// Convierte una definición guardada en un objeto con la misma forma que un tipo de fábrica —
// `campos`/`mes`/`params`/`titulo`/`detalle`/`importeTexto` — para que el resto del formulario
// (`escenarioMotorFieldHtml`, `escenarioMotorEffectiveValues`…) no distinga entre ambos. `id` es la
// clave de selección en el formulario (`propio_<definicionId>`, única por definición); `engineTipo`
// es el tipo real que se manda al motor y al esquema (siempre `"propio"`).
function escenarioMotorCustomTypeEntry(custom) {
  const campos = (custom.campos || [])
    .map((key) => ESCENARIO_MOTOR_CUSTOM_FIELD_DEFS[key])
    .filter(Boolean)
    .concat([{ key: "mes", kind: "month", label: "Mes" }]);
  return {
    id: `propio_${custom.id}`,
    engineTipo: "propio",
    definicionId: custom.id,
    // Mockup: los tipos propios se listan aparte («Propios · lo que no encaja arriba»), no
    // mezclados en Deuda/Vida — `familia` queda en la definición solo como metadato informativo.
    grupo: "Propios",
    familia: custom.familia,
    label: custom.label,
    ayuda: "Tipo propio: se resuelve como golpe único (importe) y/o cuota recurrente (mensualidad durante el plazo) desde el mes elegido — la misma comprobación de contrato que los once de fábrica.",
    campos,
    mes: (v) => v.mes,
    params: (v) => {
      const params = { definicionId: custom.id, nombre: custom.label, mes: v.mes };
      if ((custom.campos || []).includes("importe") && v.importe !== undefined) params.importe = v.importe;
      if ((custom.campos || []).includes("mensualidad") && v.mensualidad !== undefined) params.mensualidad = v.mensualidad;
      if ((custom.campos || []).includes("plazo") && v.plazo !== undefined) params.plazo = escenarioMotorInt(v.plazo);
      return params;
    },
    titulo: () => escenarioMotorTrim(custom.label),
    detalle: (d) => {
      const parts = [];
      if (d.params?.importe !== undefined) parts.push(money(d.params.importe, true));
      if (d.params?.mensualidad !== undefined) parts.push(`${money(d.params.mensualidad, true)}/mes${d.params.plazo ? ` · ${d.params.plazo} meses` : ""}`);
      return parts.join(" · ") || "—";
    },
    importeTexto: (d) => (d.params?.importe !== undefined
      ? money(d.params.importe, true)
      : d.params?.mensualidad !== undefined
        ? `${money(d.params.mensualidad, true)}/mes`
        : "—"),
  };
}

function escenarioMotorCustomTypeEntries() {
  return loadEscenarioMotorCustomTypes().map(escenarioMotorCustomTypeEntry);
}

function escenarioMotorAllTypeEntries() {
  return ESCENARIO_MOTOR_TYPES.concat(escenarioMotorCustomTypeEntries());
}

function escenarioMotorTypeById(tipo) {
  return ESCENARIO_MOTOR_TYPES.find((item) => item.id === tipo) || null;
}

// A diferencia de `escenarioMotorTypeById` (solo catálogo de fábrica, el que ya reutilizaba Deuda ›
// Comparar), esta también busca entre los tipos propios — hace falta donde `escenarioMotorDraftTipo`
// puede llevar una clave `propio_<id>` (el formulario de decisión), no donde siempre es uno de
// fábrica (D-5).
function escenarioMotorTypeOrCustomById(tipo) {
  return escenarioMotorAllTypeEntries().find((item) => item.id === tipo) || null;
}

// Las decisiones guardadas (o ya añadidas a la simulación) de un tipo propio llevan `tipo: "propio"`
// — no basta con `escenarioMotorTypeById` para reconstruir cuál definición era, hace falta
// `params.definicionId`. Si la definición se hubiera borrado (no hay manera de borrarlas todavía,
// pero el código no lo da por hecho) se degrada a un texto honesto en vez de romper el render.
function escenarioMotorResolveType(decision) {
  if (decision?.tipo !== "propio") return escenarioMotorTypeById(decision?.tipo);
  const custom = loadEscenarioMotorCustomTypes().find((item) => item.id === decision.params?.definicionId);
  if (custom) return escenarioMotorCustomTypeEntry(custom);
  return {
    id: "propio",
    grupo: "Propios",
    label: "Tipo propio eliminado",
    titulo: () => decision.titulo || "Tipo propio eliminado",
    detalle: () => "",
    importeTexto: () => "—",
  };
}

function escenarioMotorVisibleFields(type, values) {
  if (!type) return [];
  return type.campos.filter((field) => (typeof field.visibleSi === "function" ? field.visibleSi(values) : true));
}

// Los campos ocultos por `visibleSi` no cuentan: si la compra no está financiada, sus cuatro
// campos de financiación no entran en los params aunque el usuario los hubiera rellenado antes.
function escenarioMotorEffectiveValues(type, values) {
  const visible = new Set(escenarioMotorVisibleFields(type, values).map((field) => field.key));
  const effective = {};
  Object.keys(values).forEach((key) => {
    if (visible.has(key)) effective[key] = values[key];
  });
  return effective;
}

function escenarioMotorFieldElementId(key, idPrefix = "escenarioMotorField") {
  return `${idPrefix}_${key}`;
}

// P-2: id propio del deslizador, distinto del campo numérico que ya existía — ambos comparten el
// mismo `data-escenario-motor-field` para que el listener delegado ya cableado (M-3/E-2) los trate
// como el mismo campo sin necesitar una segunda escucha.
function escenarioMotorRangeElementId(key, idPrefix = "escenarioMotorField") {
  return `${idPrefix}_${key}_range`;
}

function escenarioMotorMonthOptionsHtml(months, selected, placeholder) {
  const head = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "";
  return head + months
    .map((month) => `<option value="${escapeHtml(month.monthKey)}"${month.monthKey === selected ? " selected" : ""}>${escapeHtml(month.month)}</option>`)
    .join("");
}

// D-5 · `idPrefix`/`dataAttr` dejan reutilizar el mismo dibujado de campo (y su `params()`/`mes()`
// del catálogo) desde el selector de modo de Deuda › Comparar sin generar los mismos `id` que el
// formulario real de «Escenario · simular» — ambas pantallas conviven en el DOM a la vez.
function escenarioMotorFieldControlHtml(field, months, values, { idPrefix = "escenarioMotorField", dataAttr = "data-escenario-motor-field" } = {}) {
  const id = escenarioMotorFieldElementId(field.key, idPrefix);
  const attrs = `id="${id}" ${dataAttr}="${escapeHtml(field.key)}"`;
  const value = values[field.key];
  const numberAttrs = `${field.min !== undefined ? ` min="${field.min}"` : ""}${field.max !== undefined ? ` max="${field.max}"` : ""}`;
  switch (field.kind) {
    case "debt":
    case "debtMulti": {
      const debts = escenarioMotorDebtOptions().filter(field.filtro || (() => true));
      if (!debts.length) return `<select ${attrs}${field.kind === "debtMulti" ? " multiple size=\"4\"" : ""}><option value="">${escapeHtml(field.vacio || "Sin deudas vivas")}</option></select>`;
      const selected = field.kind === "debtMulti" ? new Set(Array.isArray(value) ? value : []) : new Set(value ? [value] : []);
      const options = debts
        .map((contract) => `<option value="${escapeHtml(contract.id)}"${selected.has(contract.id) ? " selected" : ""}>${escapeHtml(escenarioMotorDebtLabel(contract))} · ${money(contract.currentPrincipal, true)}</option>`)
        .join("");
      return `<select ${attrs}${field.kind === "debtMulti" ? ` multiple size="${Math.min(6, Math.max(3, debts.length))}"` : ""}>${options}</select>`;
    }
    case "month":
      return `<select ${attrs}>${escenarioMotorMonthOptionsHtml(months, value, null)}</select>`;
    case "monthOptional":
      return `<select ${attrs}>${escenarioMotorMonthOptionsHtml(months, value, "Hasta el final del horizonte")}</select>`;
    case "select":
      return `<select ${attrs}>${(field.opciones || [])
        .map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}"${optionValue === value ? " selected" : ""}>${escapeHtml(optionLabel)}</option>`)
        .join("")}</select>`;
    case "checkbox":
      return `<input ${attrs} type="checkbox"${value === true ? " checked" : ""} />`;
    case "money":
      return `<input ${attrs} type="number" min="0.01" step="0.01" placeholder="€" value="${value === undefined ? "" : escapeHtml(String(value))}" />`;
    case "pct":
      return `<input ${attrs} type="number" step="0.01" placeholder="%" value="${value === undefined ? "" : escapeHtml(String(value))}"${numberAttrs} />`;
    case "int":
      return `<input ${attrs} type="number" step="1"${numberAttrs} value="${value === undefined ? "" : escapeHtml(String(value))}" />`;
    case "number": {
      const numberInput = `<input ${attrs} type="number" step="0.01" placeholder="€" value="${value === undefined ? "" : escapeHtml(String(value))}" />`;
      if (!field.range) return numberInput;
      // P-2: el <input type="range"> no admite "vacío" — sin valor todavía se posiciona en 0 (sin
      // cambio), una posición real y no fabricada, mientras el número de al lado sigue en blanco
      // hasta que el usuario escriba o arrastre.
      const rangeId = escenarioMotorRangeElementId(field.key, idPrefix);
      const rangeValue = Number.isFinite(value) ? value : 0;
      const rangeInput = `<input id="${rangeId}" ${dataAttr}="${escapeHtml(field.key)}" type="range" class="escenario-motor-field-range" min="${field.range.min}" max="${field.range.max}" step="${field.range.step}" value="${rangeValue}" aria-label="${escapeHtml(field.label)} (deslizador)" />`;
      return `${numberInput}${rangeInput}`;
    }
    case "date":
      return `<input ${attrs} type="date" value="${value === undefined ? "" : escapeHtml(String(value))}" />`;
    default:
      return `<input ${attrs} type="text" maxlength="60" value="${value === undefined ? "" : escapeHtml(String(value))}" />`;
  }
}

function escenarioMotorFieldHtml(field, months, values, options = {}) {
  const { idPrefix = "escenarioMotorField", dataAttr = "data-escenario-motor-field", wrapAttr = "data-escenario-motor-field-wrap" } = options;
  const control = escenarioMotorFieldControlHtml(field, months, values, { idPrefix, dataAttr });
  const hint = field.ayuda ? `<small class="e19-kpi-note">${escapeHtml(field.ayuda)}</small>` : "";
  const classes = ["escenario-motor-field"];
  // Los selectores de deuda llevan entidad, tipo e importe: a media columna se recortan justo en la
  // parte que distingue una deuda de otra, así que ocupan la fila entera.
  if (field.ancho || field.kind === "debt" || field.kind === "debtMulti") classes.push("escenario-motor-field-wide");
  if (field.kind === "checkbox") classes.push("escenario-motor-field-check");
  const hidden = typeof field.visibleSi === "function" && !field.visibleSi(values) ? " hidden" : "";
  const body = field.kind === "checkbox"
    ? `${control}<span>${escapeHtml(field.label)}</span>${hint}`
    : `<span>${escapeHtml(field.label)}</span>${control}${hint}`;
  return `<label class="${classes.join(" ")}" ${wrapAttr}="${escapeHtml(field.key)}"${hidden}>${body}</label>`;
}

function escenarioMotorReadFieldValue(field, element) {
  if (!element) return undefined;
  if (field.kind === "checkbox") return element.checked;
  if (field.kind === "debtMulti") return Array.from(element.selectedOptions || []).map((option) => option.value).filter(Boolean);
  const raw = String(element.value ?? "").trim();
  if (raw === "") return undefined;
  if (["money", "number", "int", "pct"].includes(field.kind)) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return raw;
}

function runEscenarioMotor(baseInput, decisions, guardrailValue) {
  const engine = window.FinanceCanonicalScenarioEngine;
  if (!engine) return null;
  const context = {
    baseInput,
    debtContracts: canonicalDebtContractRows(),
    meta: { reason: "escenario-motor-ui" },
  };
  if (Number.isFinite(guardrailValue) && guardrailValue > 0) {
    context.guardarrailes = { saldoMinimoAbsoluto: guardrailValue };
  }
  return engine.resolveEscenario(decisions || [], context);
}

// El mes en que una deuda queda a cero, a partir de su propio estado (cuota + plazo restante),
// nunca de una cifra inventada: si la deuda sigue activa se proyecta cuota fija durante
// remainingInstallments meses desde su último cambio real (o desde el inicio del horizonte si
// nadie la ha tocado); si el resultado cae fuera del horizonte modelado se dice explícitamente.
function escenarioMotorContractPayoffMonth(contract, months) {
  if (!months.length) return null;
  if (!(Number(contract.currentPrincipal) > 0) || Number(contract.remainingInstallments) <= 0) {
    return contract.scheduleEffectiveFrom || months[0].monthKey;
  }
  const startIndex = contract.scheduleEffectiveFrom
    ? Math.max(0, months.findIndex((month) => month.monthKey === contract.scheduleEffectiveFrom))
    : 0;
  const payoffIndex = startIndex + Math.max(0, Math.floor(contract.remainingInstallments) - 1);
  return payoffIndex < months.length ? months[payoffIndex].monthKey : null;
}

function escenarioMotorLibreDeDeuda(debtStateFinal, months) {
  const withPrincipal = (debtStateFinal || []).filter((contract) => Number(contract.currentPrincipal) > 0);
  if (!withPrincipal.length) return "sin deuda pendiente";
  const active = withPrincipal.filter((contract) => contract.paymentStatus === "active");
  // Una deuda sin cuota activa (suspendida, o reunificada sin que el plan combinado esté en los
  // datos) no tiene calendario de pago del que proyectar cierre: se dice explícitamente en vez de
  // inventar una fecha a partir de una cuota que hoy no se está pagando.
  if (!active.length) return "sin fecha estimable · sin cuota activa";
  const payoffs = active.map((contract) => escenarioMotorContractPayoffMonth(contract, months));
  if (payoffs.some((value) => value === null)) return "fuera de horizonte";
  const latest = payoffs.sort().at(-1);
  return active.length < withPrincipal.length ? `${latest} · queda deuda sin cuota activa` : latest;
}

function escenarioMotorMonthLabel(value) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4}-\d{2})(.*)$/);
  if (!match) return value;
  const date = dateFromMonthKey(match[1]);
  return date ? `${monthLabel(date)}${match[2]}` : value;
}

// E-3 (Escenarios.pdf) · «reserva, colchón, fecha libre, ahorro anual, peor mes y capacidad» — los
// tres últimos no tenían cifra propia en el motor E20 (solo daba liquidez final y mínima). Se
// definen aquí sin inventar un dato nuevo: ahorro anual suma `row.saving` (el mismo campo que ya
// usa Plan · Previsión) de los primeros 12 meses del horizonte; meses de colchón divide la liquidez
// final entre el gasto corriente medio de esos mismos 12 meses (`coreSpend`, motor canónico);
// capacidad libre real reutiliza `monthlyFreeCapacity`, la misma función que ya usa Hoy — no una
// fórmula paralela que pudiera divergir.
function escenarioMotorAverageCoreSpend(series) {
  const sample = series.slice(0, 12);
  if (!sample.length) return 0;
  return sumRows(sample, (row) => Number(row.coreSpend || 0)) / sample.length;
}

function escenarioMotorAhorroAnual(series) {
  return round2(sumRows(series.slice(0, 12), (row) => Number(row.saving || 0)));
}

function escenarioMotorSummaryFor(result, months) {
  if (!result || !result.valid) {
    return {
      minimoLiquidez: null,
      liquidezFinal: null,
      libreDeDeuda: null,
      mesesColchon: null,
      ahorroAnual: null,
      peorMesClave: null,
      peorMesValor: null,
      capacidadLibre: null,
    };
  }
  const series = result.series;
  const worst = series.length
    ? FinanceCanonicalCushion.worstMonthOf(
        months.map((month, index) => ({ key: month.key, totalLiquidity: series[index]?.totalLiquidity ?? 0 })),
        { monthKeyField: "key" },
      )
    : null;
  const liquidezFinal = series.length ? series.at(-1).totalLiquidity : null;
  const avgCoreSpend = series.length ? escenarioMotorAverageCoreSpend(series) : 0;
  return {
    minimoLiquidez: series.length ? Math.min(...series.map((row) => row.totalLiquidity)) : null,
    liquidezFinal,
    libreDeDeuda: escenarioMotorLibreDeDeuda(result.debtStateFinal, months),
    mesesColchon: avgCoreSpend > 0 && liquidezFinal !== null ? round2(liquidezFinal / avgCoreSpend) : null,
    ahorroAnual: series.length ? escenarioMotorAhorroAnual(series) : null,
    peorMesClave: worst?.key || null,
    peorMesValor: worst ? Number(worst.totalLiquidity ?? 0) : null,
    capacidadLibre: series.length ? monthlyFreeCapacity(series) : null,
  };
}

// T14 (segundo incremento, sesión 207): estas cinco, igual que el bloque de dependencias de arriba,
// habían aterrizado en views/escenarios.js en el primer incremento sin verificar que views/deuda.js
// (y, en el caso de saveEscenarioMotorSavedList, también views/cierre.js) las necesita en caliente.
// Detectado en la verificación en navegador real de este segundo incremento.
//
// Traduce los códigos de rechazo reales del motor (canonical-scenario-engine.js) a texto legible.
// Ningún resultado se inventa aquí: solo se etiqueta lo que el motor ya ha decidido.
function escenarioMotorResultInfo(resultado) {
  const table = {
    aplicada: { text: "Aplicada", badge: "e19-badge-success" },
    "guardarril-incumplido": { text: "Rechazada: rompe el saldo mínimo indicado", badge: "e19-badge-danger" },
    "conflicto-bloqueante": { text: "Rechazada: la deuda ya la afecta otra decisión de este escenario", badge: "e19-badge-danger" },
    "deuda-ya-cerrada": { text: "Rechazada: la deuda ya está cerrada", badge: "e19-badge-danger" },
    "deuda-desconocida": { text: "Rechazada: deuda no encontrada", badge: "e19-badge-danger" },
    "sin-objetivo": { text: "Rechazada: falta indicar la deuda", badge: "e19-badge-danger" },
    "sin-mes-viable": { text: "Rechazada: ningún mes del horizonte la sostiene", badge: "e19-badge-danger" },
    "tipo-no-soportado-aun": { text: "Rechazada: el motor no resuelve este tipo todavía", badge: "e19-badge-danger" },
    inactiva: { text: "Desactivada", badge: "e19-badge-neutral" },
  };
  return table[resultado] || { text: resultado, badge: "e19-badge-neutral" };
}

function escenarioMotorNavigate(viewId) {
  history.pushState(null, "", `#${viewId}`);
  setActiveView(viewId);
}

function escenarioMotorDecisionAmountText(decision) {
  const type = escenarioMotorResolveType(decision);
  return type && typeof type.importeTexto === "function" ? type.importeTexto(decision) : "—";
}

function escenarioMotorDebtLabelById(deudaId) {
  const contract = canonicalDebtContractRows().find((item) => item.id === deudaId);
  return contract ? escenarioMotorDebtLabel(contract) : deudaId || "deuda sin identificar";
}

function saveEscenarioMotorSavedList(list) {
  storageSet(storageKey("escenario-motor-saved"), JSON.stringify(list));
}

function loadEscenarioMotorSaved() {
  try {
    const parsed = JSON.parse(storageGet(storageKey("escenario-motor-saved"), "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// El plan vigente anterior (degradado a «guardado») deja de estar en efecto — su reflejo en
// `debtLiquidations` se retira con él. No borra nada de Escenarios (E-11b: «ninguna de las dos
// acciones borra nada»), solo retracta la lectura derivada de un plan que ya no es el vigente.
function retractDebtLiquidationsFromEscenario(savedId) {
  const before = debtLiquidations.length;
  debtLiquidations = debtLiquidations.filter((item) => !(item.source === "escenario" && item.escenarioSavedId === savedId));
  return debtLiquidations.length !== before;
}

function retractProjectsFromEscenario(savedId) {
  const before = projects.length;
  projects = projects.filter((item) => !(item.source === "escenario" && item.escenarioSavedId === savedId));
  return projects.length !== before;
}

function retractPlanningRowsFromEscenario(savedId) {
  const before = customPlanningRows.length;
  customPlanningRows = customPlanningRows.filter((row) => !(row.source === "escenario" && row.escenarioSavedId === savedId));
  return customPlanningRows.length !== before;
}
