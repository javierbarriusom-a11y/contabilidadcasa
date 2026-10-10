// WP-45 (ND-09 + CAP-07, docs/WP45_DISENO.md): la tarjeta «Frescura de tus datos y qué hacer primero» de Registrar › Saldos (el hash antiguo #update-hub redirige ahí). El cálculo vive en canonical-data-queue.js (puro); aquí se
// leen las fuentes que ya existen (saldos, extracto, cartera, índices, cierre, cobros y cargos esperados, tiempos medidos) y se pintan las fichas y la cola. NO hace ninguna tarea ni
// cambia un dato (A11-4): cada tarea lleva a la pantalla donde se hace. No guarda nada. Tampoco va a Hoy (congelado hasta H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, isoLocalDate, estadoHtml, state, canonicalLedgerTransactions, iv1PositionsList,
// loadPortfolioValuations, loadMonthCloseBalances, indicesLoad, expectedMovementsResult, readBalancePulseTimes, canonicalScenarioResults…). Sin llamadas al DOM ni escuchas al cargarse:
// app.js llama a `renderDatosCola` al pintar Registrar.

const DATOS_TONE_TEXT = { current: "Al día", recent: "Reciente", stale: "Antiguo", unknown: "Sin dato" };

function datosEngine() {
  return globalThis.FinanceCanonicalDataQueue;
}

function datosGuard(fn, fallback = null) {
  try { const value = fn(); return value === undefined ? fallback : value; } catch { return fallback; }
}

function datosEuros(value) {
  return money(value, true);
}

// Todo lo que ya sabe la app, tal cual; lo que no hay se pasa como null (dato ausente no es cero).
function datosSources(today) {
  const series = canonicalScenarioResults?.base?.forecast?.series || [];
  const outflows = series.slice(0, 12).map((row) => Number(row.totals?.outflowsBeforeSaving)).filter(Number.isFinite);
  const dailyOutflow = outflows.length ? outflows.reduce((sum, value) => sum + value, 0) / outflows.length / 30 : null;
  const balanceDate = state?.balanceDate || "";
  const balanceMode = state?.balanceMode === "auto" ? "auto" : "manual";
  const transactions = datosGuard(() => canonicalLedgerTransactions(), []) || [];
  const lastMovement = transactions.map((row) => String(row.date || "").slice(0, 10)).filter(Boolean).sort().at(-1) || null;
  const positions = datosGuard(() => iv1PositionsList(), []) || [];
  const valuedDates = positions.map((position) => String(position.asOf || "").slice(0, 10)).filter(Boolean);
  const lastValuation = valuedDates.length ? valuedDates.sort().at(-1) : null;
  const valuations = datosGuard(() => loadPortfolioValuations(), { timings: [] });
  const indicesEngine = globalThis.FinanceCanonicalRateIndices;
  let indices = null;
  if (indicesEngine) {
    const store = datosGuard(() => indicesLoad(), null);
    const statuses = indicesEngine.INDEX_IDS.map((id) => indicesEngine.status(store, id, today));
    const dates = statuses.map((item) => item.point && item.point.date).filter(Boolean).sort();
    indices = { lastDate: statuses.some((item) => item.state === "missing") ? null : dates[0] || null, expired: statuses.some((item) => item.state === "stale"), missing: statuses.filter((item) => item.state === "missing").length, total: statuses.length, staleAfter: Math.min(...indicesEngine.INDEX_IDS.map((id) => indicesEngine.INDICES[id].staleAfterDays)) };
  }
  const closes = datosGuard(() => loadMonthCloseBalances().months, {}) || {};
  const closeKeys = Object.keys(closes).sort();
  const lastClose = closeKeys.length ? closeKeys[closeKeys.length - 1] : null;
  const expected = datosGuard(() => expectedMovementsResult(), null);
  const pending = expected && expected.status === "ok" ? expected.items : [];
  return {
    dailyOutflow, balanceDate, balanceMode, lastMovement, lastValuation, positionsCount: positions.length, valuationSeconds: (valuations.timings || []).map((item) => Number(item.seconds)),
    pulseSeconds: datosGuard(() => readBalancePulseTimes().times.map((item) => Number(item.seconds)), []) || [],
    indices, lastClose, lastCloseKey: lastClose, pendingCount: pending.length + (expected && expected.overflow ? expected.overflow : 0), pendingAmount: pending.reduce((sum, item) => sum + Math.abs(Number(item.plannedAmount) || 0), 0),
  };
}

// El mes que se puede cerrar hoy (los días 1 a 3, el mes que acaba) y si ya está cerrado.
function datosCloseDeadline(today, lastCloseKey) {
  const day = Number(today.slice(8, 10));
  if (!(day >= 1 && day <= 3)) return null;
  const [year, month] = today.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  const key = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
  return lastCloseKey && lastCloseKey >= key ? null : { key, text: `Hasta el día 3: cerrar ${key}` };
}

function datosCards(engine, source, today) {
  const dataAge = globalThis.FinanceCanonicalDataAge;
  const staleBalances = dataAge ? dataAge.STALE_AFTER_DAYS : 4;
  const cards = [];
  cards.push(source.balanceMode === "auto"
    ? { ...engine.freshnessCard({ id: "balances", label: "Saldos", lastDate: null, today, unknownText: "Calculados por calendario, sin foto del banco" }), action: { label: "Actualizar saldos", href: "#visual-detail" } }
    : engine.freshnessCard({ id: "balances", label: "Saldos", lastDate: source.balanceDate, today, staleAfterDays: staleBalances, unknownText: "Sin fecha de saldos", action: { label: "Actualizar saldos", href: "#visual-detail" } }));
  cards.push(engine.freshnessCard({ id: "statement", label: "Último movimiento importado", lastDate: source.lastMovement, today, staleAfterDays: staleBalances, unknownText: "Ningún extracto importado", action: { label: "Importar el extracto", href: "#movements" } }));
  cards.push(engine.freshnessCard({ id: "valuation", label: "Valoración de la cartera", lastDate: source.positionsCount ? source.lastValuation : null, today, staleAfterDays: 35, unknownText: source.positionsCount ? "Ninguna posición con fecha de valoración" : "Sin cartera registrada", action: source.positionsCount ? { label: "Actualizar valoración", href: "#inversion-cartera" } : null }));
  cards.push(source.indices
    ? engine.freshnessCard({ id: "indices", label: "Índices de referencia (Euribor, €STR, IPC)", lastDate: source.indices.lastDate, today, staleAfterDays: source.indices.staleAfter, expired: source.indices.expired, unknownText: source.indices.missing ? `Faltan ${source.indices.missing} de ${source.indices.total}` : "Sin dato", action: { label: "Teclear índices", href: "#deuda-contratos" } })
    : engine.freshnessCard({ id: "indices", label: "Índices de referencia", lastDate: null, today }));
  // El cierre no envejece por días: está al día si ya se cerró el mes que acaba de terminar; si no, falta uno (y los días 1 a 3 es una tarea con plazo).
  const [ty, tm] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(ty, tm - 2, 1));
  const prevKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  const closed = Boolean(source.lastClose);
  const upToDate = closed && source.lastClose >= prevKey;
  const monthName = (key) => (datosGuard(() => registrarMesLongMonth(key), key) || key);
  cards.push({
    id: "close", label: "Último cierre de mes", tone: !closed ? "unknown" : upToDate ? "current" : "stale", icon: !closed ? "?" : upToDate ? "✓" : "⚠", ageDays: null,
    ageText: closed ? `último: ${monthName(source.lastClose)}` : "sin cierres", status: !closed ? "Ningún mes cerrado con saldos" : upToDate ? "Al día" : `Falta cerrar ${monthName(prevKey)}`,
    action: { label: "Ir a Conciliar y cerrar", href: "#reconciliation" },
  });
  cards.push({ id: "pending", label: "Cobros y cargos esperados sin responder", tone: source.pendingCount ? "stale" : "current", icon: source.pendingCount ? "⚠" : "✓", ageDays: null, ageText: source.pendingCount ? `${source.pendingCount} por responder` : "ninguno", status: source.pendingCount ? "Pendiente" : "Al día", action: source.pendingCount ? { label: "Responderlos", href: "#registrar" } : null });
  return cards;
}

function datosTasks(engine, source, today) {
  const balanceAge = source.balanceMode === "auto" || !source.balanceDate ? null : engine.daysBetween(source.balanceDate.slice(0, 10), today);
  const statementAge = source.lastMovement ? engine.daysBetween(source.lastMovement, today) : null;
  const balanceEstimate = engine.unloggedEstimate({ dailyOutflow: source.dailyOutflow, ageDays: balanceAge === null ? null : Math.max(0, balanceAge) });
  const statementEstimate = engine.unloggedEstimate({ dailyOutflow: source.dailyOutflow, ageDays: statementAge === null ? null : Math.max(0, statementAge) });
  const tasks = [];
  tasks.push({
    id: "balances", label: "Actualizar saldos", family: "cuentas", uncertainty: balanceEstimate.value,
    basis: balanceEstimate.value === null ? "" : `gasto diario medio de la previsión × ${balanceEstimate.days} días desde la fecha de los saldos${balanceEstimate.capped ? " (tope de 30)" : ""}`,
    reasonUnknown: source.balanceMode === "auto" ? "Los saldos se calculan por calendario: sin una foto del banco no sé cuánto se han movido." : "Sin fecha de saldos o sin gasto medio de la previsión.",
    minutes: engine.taskMinutes({ measuredSeconds: source.pulseSeconds, assumedMinutes: 20 / 60 }), action: { label: "Actualizar saldos", href: "#visual-detail" },
  });
  tasks.push({
    id: "statement", label: "Importar el extracto", family: "cuentas", absorbs: ["balances"], uncertainty: statementEstimate.value,
    basis: statementEstimate.value === null ? "" : `gasto diario medio de la previsión × ${statementEstimate.days} días desde el último movimiento (importar también pone al día el saldo)`,
    reasonUnknown: "Ningún extracto importado o sin gasto medio de la previsión.", minutes: engine.taskMinutes({ measuredSeconds: [], assumedMinutes: 2 }), action: { label: "Importar el extracto", href: "#movements" },
  });
  tasks.push({
    id: "pending", label: `Responder ${source.pendingCount} ${source.pendingCount === 1 ? "cobro o cargo esperado" : "cobros y cargos esperados"}`, uncertainty: source.pendingCount ? Math.round(source.pendingAmount * 100) / 100 : null,
    basis: source.pendingCount ? "suma de los importes previstos que aún no tienen respuesta" : "", reasonUnknown: "No hay cobros ni cargos esperados sin responder.",
    minutes: engine.taskMinutes({ measuredSeconds: [], assumedMinutes: Math.max(0.17, (source.pendingCount * 10) / 60) }), action: { label: "Responderlos", href: "#registrar" },
  });
  if (source.positionsCount) {
    tasks.push({
      id: "valuation", label: "Actualizar la valoración de la cartera", uncertainty: null,
      reasonUnknown: "No sé cuánto se ha movido: la volatilidad de vuestra cartera no está medida (hacen falta ≥ 3 valoraciones, y aún no se estima).",
      minutes: engine.taskMinutes({ measuredSeconds: source.valuationSeconds, assumedMinutes: 1 }), action: { label: "Actualizar valoración", href: "#inversion-cartera" },
    });
  }
  if (source.indices && (source.indices.expired || source.indices.missing)) {
    tasks.push({
      id: "indices", label: "Teclear los índices de referencia", uncertainty: null,
      reasonUnknown: "No sé cuánto cambia una cifra: hace falta el contrato de la hipoteca con su índice para estimar la cuota (H-07).",
      minutes: engine.taskMinutes({ measuredSeconds: [], assumedMinutes: 1 }), action: { label: "Teclear índices", href: "#deuda-contratos" },
    });
  }
  const deadline = datosCloseDeadline(today, source.lastCloseKey);
  if (deadline) tasks.push({ id: "close", label: `Cerrar ${deadline.key}`, deadline: deadline.text, uncertainty: null, minutes: engine.taskMinutes({ measuredSeconds: [], assumedMinutes: 3 }), action: { label: "Ir a Conciliar y cerrar", href: "#reconciliation" } });
  return tasks;
}

function datosCardHtml(card) {
  const action = card.action ? `<a class="e19-btn e19-btn-secondary dat-ir" href="${escapeHtml(card.action.href)}" aria-label="${escapeHtml(card.action.label)}: ${escapeHtml(card.label)}">${escapeHtml(card.action.label)}</a>` : "";
  return `<li class="dat-ficha" data-dat-ficha="${escapeHtml(card.id)}" data-dat-tono="${escapeHtml(card.tone)}">
      <p class="dat-cabecera"><span class="dat-icono" aria-hidden="true">${escapeHtml(card.icon)}</span> <strong>${escapeHtml(card.label)}</strong></p>
      <p><span class="dat-estado">${escapeHtml(card.status || DATOS_TONE_TEXT[card.tone])}</span> · ${escapeHtml(card.ageText)}</p>${action}</li>`;
}

function datosMinutesText(minutes) {
  const seconds = Math.round(minutes.value * 60);
  const label = seconds < 90 ? `${seconds} s` : `${String(Math.round(minutes.value * 10) / 10).replace(".", ",")} min`;
  return `${label} (${minutes.measured ? `medido, ${minutes.samples} usos` : "sin medir: supuesto"})`;
}

function datosTaskHtml(task) {
  const link = task.action ? `<a class="e19-btn e19-btn-primary dat-ir" href="${escapeHtml(task.action.href)}">${escapeHtml(task.action.label)}</a>` : "";
  if (task.uncertainty === null || task.uncertainty === undefined) {
    return `<li class="dat-tarea" data-dat-tarea="${escapeHtml(task.id)}"><p class="dat-cabecera"><strong>${escapeHtml(task.label)}</strong> <span class="dat-estado">${task.deadline ? escapeHtml(task.deadline) : "Sin estimar"}</span></p>
      ${task.deadline ? "" : `<p>${escapeHtml(task.reason || "")}</p>`}<p class="e19-kpi-note">Tiempo: ${escapeHtml(datosMinutesText(task.minutes))}.</p>${link}</li>`;
  }
  return `<li class="dat-tarea" data-dat-tarea="${escapeHtml(task.id)}"><p class="dat-cabecera"><span class="dat-num" aria-hidden="true">${task.rank}</span> <strong>${escapeHtml(task.label)}</strong></p>
      <p>Puede moverse hasta <strong>${datosEuros(task.uncertainty)}</strong> · <strong>${datosEuros(task.valuePerMinute)}</strong> por minuto${task.absorbed ? " · <em>queda resuelta al importar el extracto</em>" : ""}</p>
      <p class="e19-kpi-note">Tiempo: ${escapeHtml(datosMinutesText(task.minutes))}. Cálculo: ${escapeHtml(task.basis)}.</p>${link}</li>`;
}

function datosBodyHtml(engine) {
  const today = isoLocalDate(new Date());
  const source = datosSources(today);
  const cards = datosCards(engine, source, today);
  const queue = engine.buildQueue({ tasks: datosTasks(engine, source, today), budgetMinutes: engine.DEFAULT_BUDGET_MINUTES });
  const fichas = `<ul class="dat-fichas" aria-label="Frescura por fuente">${cards.map(datosCardHtml).join("")}</ul>`;
  const anyStale = cards.some((card) => card.tone === "stale");
  let plan;
  if (queue.plan.ids.length) {
    const names = queue.plan.ids.map((id) => queue.ranked.find((task) => task.id === id).label.toLowerCase());
    plan = `<p class="dat-plan"><strong>Con ${engine.DEFAULT_BUDGET_MINUTES} minutos hoy:</strong> ${names.join(" y ")} (≈ ${String(queue.plan.minutes).replace(".", ",")} min) quitan hasta <strong>${datosEuros(queue.plan.resolved)}</strong> de los ${datosEuros(queue.plan.total)} de incertidumbre estimada.${queue.plan.anyUnmeasured ? " Parte del tiempo es un supuesto, no una medida." : ""}</p>`;
  } else if (queue.allClear && !anyStale) {
    plan = `<p class="dat-plan"><strong>Todo al día.</strong> No hay ninguna tarea de datos con efecto estimable.</p>`;
  } else plan = "";
  const deadlines = queue.deadlines.length ? `<ul class="dat-lista">${queue.deadlines.map(datosTaskHtml).join("")}</ul>` : "";
  const ranked = queue.ranked.length ? `<ol class="dat-lista" aria-label="Tareas de datos, de más a menos incertidumbre por minuto">${queue.ranked.map(datosTaskHtml).join("")}</ol>` : "";
  const notEstimable = queue.unestimated.filter((task) => task.id !== "pending"); // «nada pendiente» no es una tarea sin estimar
  const unestimated = notEstimable.length ? `<h4>Sin estimar</h4><ul class="dat-lista">${notEstimable.map(datosTaskHtml).join("")}</ul>` : "";
  return `${fichas}${plan}${deadlines}${ranked}${unestimated}<p class="e19-kpi-note">«Puede moverse hasta» es una estimación mía (gasto diario medio de la previsión × días sin actualizar, con tope de 30), no un dato: dice cuánto puede haber cambiado la cifra, no cuánto ha cambiado. No hago ninguna tarea por vosotros.</p>`;
}

function renderDatosCola(engine) {
  const box = qs("datosCuerpo");
  if (!box || !engine) return;
  try {
    const html = datosBodyHtml(engine);
    if (box.__datosHtml !== html) {
      box.innerHTML = html;
      box.__datosHtml = html;
    }
  } catch {
    box.textContent = "No se pudo calcular la frescura con los datos actuales.";
  }
}
