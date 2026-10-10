// WP-46 (NPV-10, docs/WP46_DISENO.md): la tarjeta «Patrimonio neto: serie y proyección» de Inversión › Cartera. El cálculo vive en canonical-net-worth.js (puro); aquí se leen las cifras que ya
// existen (saldos, posiciones de la cartera, activos de A14, deuda y su calendario, previsión de liquidez), se congela la foto en cada cierre firmado (`net-worth-data`, en la copia, junto con los
// supuestos que teclea el hogar) y se pintan la serie, la proyección en tres escenarios y sus hitos con el kit de gráficos (WP-28). NO cambia ningún dato (A11-4). Tampoco va a Hoy (congelado hasta H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, storageSet, storageKey, queueRemoteSave, announceStatus, estadoHtml, isoLocalDate, parseAmount,
// iv1PositionsList, assetsList, totalDebtOutstanding, canonicalDebtContractRows, canonicalScenarioResults, accountBalancesFromState, ChartKit, registrarMesLongMonth…). Sin llamadas al DOM ni escuchas al
// cargarse: app.js llama a `recordPatrimonioSnapshot` al firmar un cierre y views/inversion.js a `renderPatrimonio` al pintar Inversión › Cartera.

const PATRIMONIO_STORE = "net-worth-data"; // en la copia (BACKUP_LOCAL_STORES): { snapshots: [...], assumptions: {...} }
const PATRIMONIO_HORIZON_MONTHS = 120;
const PATRIMONIO_EXCLUDED_TYPES = ["cuenta", "inversion", "pension"]; // ya están en los saldos y en la cartera: sumarlos aquí contaría el dinero dos veces
const PATRIMONIO_SCENARIOS = [{ id: "low", label: "Prudente" }, { id: "base", label: "Central" }, { id: "high", label: "Optimista" }];

function patrimonioEngine() {
  return globalThis.FinanceCanonicalNetWorth;
}

function patrimonioLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(PATRIMONIO_STORE), "{}")) || {}; } catch { saved = {}; }
  const num = (value) => (value === "" || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value));
  const assumptions = saved.assumptions && typeof saved.assumptions === "object" ? saved.assumptions : {};
  const clean = {};
  PATRIMONIO_SCENARIOS.forEach(({ id }) => { const item = assumptions[id] && typeof assumptions[id] === "object" ? assumptions[id] : {}; clean[id] = { portfolioReturnPct: num(item.portfolioReturnPct), assetGrowthPct: num(item.assetGrowthPct) }; });
  return { snapshots: patrimonioEngine().normalizeStore(saved.snapshots), assumptions: clean, targetNet: num(assumptions.targetNet) };
}

function patrimonioSave(data) {
  storageSet(storageKey(PATRIMONIO_STORE), JSON.stringify({ snapshots: data.snapshots, assumptions: { ...data.assumptions, targetNet: data.targetNet } }));
  queueRemoteSave();
}

function patrimonioEuros(value) {
  return money(value, true);
}

function patrimonioGuard(fn, fallback = null) {
  try { const value = fn(); return value === undefined ? fallback : value; } catch { return fallback; }
}

// Los componentes del patrimonio con lo que ya existe; lo que no se sabe va como null (dato ausente no es cero).
function patrimonioComponents(cashOverride = undefined) {
  const portfolioEngine = globalThis.FinanceCanonicalPortfolio;
  const assetsEngine = globalThis.FinanceCanonicalAssets;
  const positions = portfolioEngine ? patrimonioGuard(() => portfolioEngine.normalizePositions(iv1PositionsList()), null) : null;
  const assets = assetsEngine ? patrimonioGuard(() => assetsEngine.normalizeAssets(assetsList()), null) : null;
  const balances = patrimonioGuard(() => accountBalancesFromState(), null);
  const cash = cashOverride !== undefined ? cashOverride : (balances && Number.isFinite(Number(balances.total)) ? Number(balances.total) : null);
  const rows = assets ? assets.assets : [];
  const sumOf = (types) => rows.filter((row) => types.includes(row.type)).reduce((sum, row) => sum + Number(row.value || 0), 0);
  return {
    cash,
    portfolio: positions ? positions.summary.totalValue : null,
    portfolioIlliquid: positions ? Number(positions.summary.totalsByType["plan-pension"] || 0) : null,
    assets: assets ? sumOf(["inmueble", "vehiculo", "alternativo", "otro"]) : null,
    debt: patrimonioGuard(() => totalDebtOutstanding(), null),
    excludedAssets: rows.filter((row) => PATRIMONIO_EXCLUDED_TYPES.includes(row.type) && Number(row.value) > 0).map((row) => ({ label: row.label, type: row.type, value: Number(row.value) })),
  };
}

// Al firmar un cierre: congela el patrimonio con el efectivo REAL del cierre (los saldos guardados) y lo demás tal como está. Si algo falla, no rompe el cierre.
function recordPatrimonioSnapshot(monthKey, closedAt, closeBalances) {
  try {
    const engine = patrimonioEngine();
    if (!engine) return false;
    const cash = closeBalances && Number.isFinite(Number(closeBalances.total)) ? Number(closeBalances.total) : null;
    const result = engine.buildSnapshot({ monthKey, closedAt, ...patrimonioComponents(cash) });
    if (!result.calculable) return false;
    const data = patrimonioLoad();
    patrimonioSave({ ...data, snapshots: engine.upsert(data.snapshots, result.snapshot) });
    return true;
  } catch {
    return false;
  }
}

function patrimonioMonthLabel(key) {
  return patrimonioGuard(() => registrarMesLongMonth(key), key) || key;
}

function patrimonioShortMonth(key) {
  const date = typeof dateFromMonthKey === "function" ? dateFromMonthKey(key) : null;
  return date ? date.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }) : String(key || "");
}

function patrimonioTodayHtml(engine, now) {
  const snapshot = engine.buildSnapshot({ monthKey: isoLocalDate(new Date()).slice(0, 7), ...now });
  const s = snapshot.snapshot;
  const lines = engine.COMPONENTS.map((component) => {
    const value = s[component.id];
    return `<li>${escapeHtml(component.label)}: <strong>${value === null ? "no lo sé" : `${component.sign < 0 ? "−" : ""}${patrimonioEuros(value)}`}</strong>${component.id === "portfolio" && s.portfolioIlliquid > 0 ? ` (de la que ${patrimonioEuros(s.portfolioIlliquid)} en planes de pensiones, inmovilizados)` : ""}</li>`;
  }).join("");
  const head = s.net === null
    ? `<p class="pat-cifra"><strong>Todavía no puedo calcular el patrimonio neto:</strong> falta ${escapeHtml(s.missing.join(" y "))}.</p>`
    : `<p class="pat-cifra"><strong>Patrimonio neto hoy: ${patrimonioEuros(s.net)}</strong></p>`;
  const excluded = s.excludedAssets.length
    ? `<p class="e19-kpi-note"><strong>No sumo</strong> ${s.excludedAssets.map((row) => `«${escapeHtml(row.label)}» (${patrimonioEuros(row.value)})`).join(", ")}: están registrados como cuentas, inversiones o pensión en Activos, y el dinero ya entra por los saldos y la cartera. Si no estuviera en ninguno de los dos, falta en este total.</p>`
    : "";
  return `${head}<ul class="pat-lista">${lines}</ul>${excluded}`;
}

function patrimonioSeriesHtml(engine, data) {
  const series = engine.series(data.snapshots);
  if (!series.all.length) {
    return estadoHtml({ kind: "vacio", titulo: "Todavía no hay ninguna foto del patrimonio", texto: "Al firmar el cierre del mes, la app guarda el patrimonio de ese día. Con 3 cierres completos dibuja la serie." });
  }
  const rows = series.all.map((s) => `<li>${escapeHtml(patrimonioMonthLabel(s.monthKey))}: <strong>${s.net === null ? `incompleto (falta ${escapeHtml(s.missing.join(" y "))})` : patrimonioEuros(s.net)}</strong></li>`).join("");
  if (!series.enough) {
    return `${estadoHtml({ kind: "vacio", titulo: "Todavía no hay serie", texto: `Hacen falta ${series.need} cierres completos y llevas ${series.have}${series.incomplete ? ` (y ${series.incomplete} incompleto${series.incomplete === 1 ? "" : "s"})` : ""}.` })}<ul class="pat-lista">${rows}</ul>`;
  }
  const kit = globalThis.ChartKit;
  const points = series.complete;
  const plot = kit.bandPlotHtml({ points: points.map((s) => ({ low: s.net, center: s.net, high: s.net })), ariaLabel: `Patrimonio neto en los últimos ${points.length} cierres` });
  const sentence = kit.trendSentence({ subject: "Patrimonio neto", points: points.map((s) => ({ label: patrimonioShortMonth(s.monthKey), value: s.net })), format: (n) => patrimonioEuros(n) });
  const move = engine.movement(points[points.length - 2], points[points.length - 1]);
  const moveHtml = move.calculable
    ? `<p>Último cambio (${escapeHtml(patrimonioMonthLabel(move.previousMonthKey))} → ${escapeHtml(patrimonioMonthLabel(move.currentMonthKey))}): <strong>${move.delta >= 0 ? "+" : "−"}${patrimonioEuros(Math.abs(move.delta))}</strong>. ${move.rows.filter((row) => row.value !== 0).map((row) => `${escapeHtml(row.label)} ${row.value > 0 ? "+" : "−"}${patrimonioEuros(Math.abs(row.value))}`).join(" · ")}.</p>`
    : "";
  const figure = kit.figureHtml({
    id: "patrimonio-serie", plotHtml: plot.svg, plotClass: "ck-plot-media", readings: points.map((s) => `${patrimonioMonthLabel(s.monthKey)}: ${patrimonioEuros(s.net)} (efectivo ${patrimonioEuros(s.cash)}, cartera ${patrimonioEuros(s.portfolio)}, activos ${patrimonioEuros(s.assets)}, deuda ${patrimonioEuros(s.debt)}).`),
    xs: plot.xs, sliderLabel: "Recorrer el patrimonio neto cierre a cierre",
    table: { caption: "Patrimonio neto por cierre", columns: ["Cierre", "Neto", "Efectivo", "Cartera", "Activos", "Deuda"], rows: points.map((s) => [patrimonioMonthLabel(s.monthKey), patrimonioEuros(s.net), patrimonioEuros(s.cash), patrimonioEuros(s.portfolio), patrimonioEuros(s.assets), patrimonioEuros(s.debt)]) },
  });
  return `<p class="ck-frase">${escapeHtml(sentence)}</p>${figure}${moveHtml}`;
}

function patrimonioProjectionInput(data, now) {
  const forecast = canonicalScenarioResults?.base?.forecast?.series || [];
  if (!forecast.length) return null;
  const startMonthKey = forecast[0].monthKey;
  const payoffEngine = globalThis.FinanceCanonicalDebtPayoffPath;
  const payoff = payoffEngine ? patrimonioGuard(() => payoffEngine.project(canonicalDebtContractRows(), { startMonthKey }), null) : null;
  return {
    startMonthKey, horizonMonths: PATRIMONIO_HORIZON_MONTHS, start: { portfolio: now.portfolio || 0, assets: now.assets || 0 },
    liquidityPath: forecast.map((row) => ({ monthKey: row.monthKey, value: Number(row.totals.closingLiquidity) })),
    debtPath: payoff && payoff.ok ? payoff.series : [], excludedDebt: payoff && payoff.ok ? payoff.excludedPrincipal : 0,
    scenarios: PATRIMONIO_SCENARIOS.map(({ id, label }) => ({ id, label, ...data.assumptions[id] })), targetNet: data.targetNet,
    payoffOk: Boolean(payoff && payoff.ok),
  };
}

function patrimonioProjectionHtml(engine, data, now) {
  const input = patrimonioProjectionInput(data, now);
  if (!input) return `<p class="e19-kpi-note">No hay previsión de liquidez con la que proyectar.</p>`;
  const result = engine.project(input);
  if (!result.calculable) return `<p class="e19-kpi-note">No se puede proyectar con los datos actuales.</p>`;
  const kit = globalThis.ChartKit;
  const fan = engine.fan(result);
  const plot = kit.bandPlotHtml({ points: fan.map((point) => ({ low: point.low, center: point.center, high: point.high })), ariaLabel: "Patrimonio neto proyectado a diez años: escenario central y abanico entre el prudente y el optimista" });
  const yearly = fan.filter((point, index) => (index + 1) % 12 === 0);
  const end = fan[fan.length - 1];
  const sentence = result.allSame
    ? `Con los supuestos actuales, el patrimonio neto pasaría de ${patrimonioEuros(result.scenarios[1].path[0].net)} a ${patrimonioEuros(end.center)} en ${PATRIMONIO_HORIZON_MONTHS / 12} años, y los tres escenarios coinciden porque no hay rendimiento ni revalorización declarados.`
    : `A ${PATRIMONIO_HORIZON_MONTHS / 12} años, el patrimonio neto estaría entre ${patrimonioEuros(end.low)} y ${patrimonioEuros(end.high)}, con ${patrimonioEuros(end.center)} en el central.`;
  const milestones = [];
  if (result.debtFreeMonthKey) milestones.push(`<li>Deuda cero (con el calendario actual): <strong>${escapeHtml(patrimonioMonthLabel(result.debtFreeMonthKey))}</strong></li>`);
  else if (result.excludedDebt > 0) milestones.push(`<li>Deuda cero: <strong>no se puede decir</strong> — ${patrimonioEuros(result.excludedDebt)} de deuda no tienen calendario (sin TAE o plazo)</li>`);
  result.scenarios.forEach((scenario) => {
    if (scenario.milestones.netPositiveMonth) milestones.push(`<li>${escapeHtml(scenario.label)}: el patrimonio deja de ser negativo en <strong>${escapeHtml(patrimonioMonthLabel(scenario.milestones.netPositiveMonth))}</strong></li>`);
    if (data.targetNet !== null) milestones.push(`<li>${escapeHtml(scenario.label)}: llega a ${patrimonioEuros(data.targetNet)} ${scenario.milestones.targetMonth ? `en <strong>${escapeHtml(patrimonioMonthLabel(scenario.milestones.targetMonth))}</strong>` : "<strong>no en 10 años</strong>"}</li>`);
  });
  const undeclared = result.anyUndeclared ? `<p class="pat-aviso" role="note"><strong>Faltan supuestos:</strong> lo que no declaráis (rendimiento de la cartera, revalorización de la vivienda) se mantiene en 0 %, no se supone un valor de mercado.</p>` : "";
  const figure = kit.figureHtml({
    id: "patrimonio-proyeccion", plotHtml: plot.svg, plotClass: "ck-plot-media", readings: fan.map((point) => `${patrimonioMonthLabel(point.monthKey)}: prudente ${patrimonioEuros(point.low)} · central ${patrimonioEuros(point.center)} · optimista ${patrimonioEuros(point.high)}.`),
    xs: plot.xs, sliderLabel: "Recorrer la proyección del patrimonio mes a mes",
    noteHtml: `<p class="e19-kpi-note">En los tres escenarios solo cambian el rendimiento de la cartera y la revalorización de los activos: la liquidez es la de la previsión y la deuda sigue su calendario. No hay aportaciones nuevas a la cartera ni ahorro fuera de la previsión. <strong>El abanico es de supuestos tecleados, no un intervalo de probabilidad.</strong></p>`,
    table: { caption: "Patrimonio neto proyectado, al final de cada año", columns: ["Año", "Prudente", "Central", "Optimista"], rows: yearly.map((point) => [point.monthKey.slice(0, 4), patrimonioEuros(point.low), patrimonioEuros(point.center), patrimonioEuros(point.high)]) },
  });
  return `<p class="ck-frase">${escapeHtml(sentence)}</p>${undeclared}${figure}${milestones.length ? `<ul class="pat-lista">${milestones.join("")}</ul>` : ""}`;
}

function renderPatrimonio(engine) {
  const box = qs("patrimonioCuerpo");
  if (!box || !engine || !globalThis.ChartKit) return;
  attachPatrimonio(document); // idempotente: un envío temprano no puede perderse
  try {
    const data = patrimonioLoad();
    const now = patrimonioComponents();
    const set = (id, value) => { const field = qs(id); if (field && document.activeElement !== field) field.value = value === null || value === undefined ? "" : String(value); };
    PATRIMONIO_SCENARIOS.forEach(({ id }) => { set(`patrimonioRend-${id}`, data.assumptions[id].portfolioReturnPct); set(`patrimonioReval-${id}`, data.assumptions[id].assetGrowthPct); });
    set("patrimonioObjetivo", data.targetNet);
    const sections = { patrimonioHoy: patrimonioTodayHtml(engine, now), patrimonioSerie: patrimonioSeriesHtml(engine, data), patrimonioProyeccion: patrimonioProjectionHtml(engine, data, now) };
    Object.entries(sections).forEach(([id, html]) => {
      const target = qs(id);
      if (target && target.__patHtml !== html) { target.innerHTML = html; target.__patHtml = html; }
    });
  } catch (error) {
    console.error(`renderPatrimonio: ${error.message}`);
    box.insertAdjacentHTML("beforeend", "<p class=\"e19-kpi-note\">No se pudo calcular con los datos actuales.</p>");
  }
}

function patrimonioSubmit(event) {
  event.preventDefault();
  const read = (id) => { const raw = qs(id)?.value; return raw === undefined || raw === "" ? null : parseAmount(raw); };
  const error = qs("patrimonioError");
  const assumptions = {};
  let invalid = "";
  PATRIMONIO_SCENARIOS.forEach(({ id, label }) => {
    const portfolioReturnPct = read(`patrimonioRend-${id}`);
    const assetGrowthPct = read(`patrimonioReval-${id}`);
    [portfolioReturnPct, assetGrowthPct].forEach((value) => { if (value !== null && !(value >= -50 && value <= 50)) invalid = `Un porcentaje del escenario «${label}» no es creíble: tiene que estar entre −50 y 50.`; });
    assumptions[id] = { portfolioReturnPct, assetGrowthPct };
  });
  const target = read("patrimonioObjetivo");
  if (!invalid && target !== null && !(target > 0)) invalid = "El objetivo de patrimonio tiene que ser mayor que cero (o vacío).";
  if (invalid) {
    if (error) { error.textContent = invalid; error.hidden = false; }
    announceStatus(invalid);
    return;
  }
  if (error) error.hidden = true;
  patrimonioSave({ ...patrimonioLoad(), assumptions, targetNet: target });
  renderPatrimonio(patrimonioEngine());
  announceStatus("Supuestos guardados.");
}

// Una sola vez, por delegación.
function attachPatrimonio(doc) {
  if (!doc || doc.__patrimonioAttached) return false;
  doc.__patrimonioAttached = true;
  doc.addEventListener("submit", (event) => { if (event.target?.id === "patrimonioForm") patrimonioSubmit(event); });
  return true;
}
