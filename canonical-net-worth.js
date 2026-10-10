(function attachCanonicalNetWorth(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalNetWorth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalNetWorthFactory() {
  "use strict";

  // WP-46 (NPV-10, docs/WP46_DISENO.md): el patrimonio neto, su serie mensual y una proyección con tres escenarios.
  //   · buildSnapshot: la foto del patrimonio en un cierre firmado, por componente (efectivo, cartera, vivienda y otros activos, deuda), con lo que falta dicho.
  //   · series / movement: la serie de fotos y de dónde viene el cambio entre dos de ellas.
  //   · project: la proyección mes a mes (liquidez de la previsión, cartera y activos con el crecimiento DECLARADO, deuda con su calendario) en tres escenarios, y sus hitos.
  // Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj. NO inventa ningún supuesto: un rendimiento o una revalorización sin declarar se mantiene en 0 %, y se dice.
  //
  // Reglas de honestidad:
  //   · el patrimonio solo se sabe completo si se conocen sus cuatro componentes; si falta uno, el neto no se calcula y se nombra lo que falta (dato ausente no es cero).
  //   · una serie con menos de 3 fotos no se presenta como serie: se enseñan las fotos que hay.
  //   · la proyección usa la liquidez de la previsión; en los tres escenarios solo cambian el rendimiento de la cartera y la revalorización de los activos. Se dice.
  //   · no hay aportaciones futuras a la cartera ni ahorros nuevos fuera de la previsión: sería sumar dinero que ya está en la liquidez.
  //   · el abanico de tres escenarios es de SUPUESTOS tecleados por el hogar, no un intervalo de probabilidad.

  const SCHEMA_ID = "finance-net-worth/v1";
  const MIN_SERIES = 3;
  const MAX_SNAPSHOTS = 120;
  const MAX_HORIZON_MONTHS = 240;

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const isMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(text(value));

  /** @param {string} monthKey @param {number} months */
  function addMonths(monthKey, months) {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + months, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  const COMPONENTS = Object.freeze([
    { id: "cash", label: "Efectivo en cuentas", sign: 1 },
    { id: "portfolio", label: "Cartera de inversión", sign: 1 },
    { id: "assets", label: "Vivienda, local y otros activos", sign: 1 },
    { id: "debt", label: "Deuda pendiente", sign: -1 },
  ]);

  /**
   * La foto del patrimonio. Cada componente es un número o null (no se sabe); `net` solo existe si se conocen los cuatro.
   * @param {{monthKey?: string, closedAt?: string, cash?: number|null, portfolio?: number|null, portfolioIlliquid?: number|null, assets?: number|null, debt?: number|null, excludedAssets?: Array<{label?: string, type?: string, value?: number}>}} [params]
   */
  function buildSnapshot({ monthKey = "", closedAt = "", cash = null, portfolio = null, portfolioIlliquid = null, assets = null, debt = null, excludedAssets = [] } = {}) {
    if (!isMonth(monthKey)) return { calculable: false, reason: "Falta el mes de la foto." };
    const parts = { cash: known(cash) ? round2(cash) : null, portfolio: known(portfolio) ? round2(portfolio) : null, assets: known(assets) ? round2(assets) : null, debt: known(debt) ? round2(Math.max(0, number(debt))) : null };
    const missing = COMPONENTS.filter((component) => parts[component.id] === null).map((component) => component.label.toLowerCase());
    const net = missing.length ? null : round2(parts.cash + parts.portfolio + parts.assets - parts.debt);
    return {
      calculable: true,
      snapshot: {
        schemaId: SCHEMA_ID, monthKey, closedAt: text(closedAt), ...parts, net, missing,
        portfolioIlliquid: known(portfolioIlliquid) ? round2(portfolioIlliquid) : null,
        excludedAssets: (Array.isArray(excludedAssets) ? excludedAssets : []).slice(0, 12).map((row) => ({ label: text(row && row.label).slice(0, 60), type: text(row && row.type), value: round2(row && row.value) })),
      },
    };
  }

  function normalizeStore(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    return list.filter((s) => s && s.schemaId === SCHEMA_ID && isMonth(s.monthKey))
      .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))
      .filter((s) => (seen.has(s.monthKey) ? false : (seen.add(s.monthKey), true)))
      .slice(0, MAX_SNAPSHOTS);
  }

  function upsert(store, snapshot) {
    return normalizeStore([snapshot, ...(Array.isArray(store) ? store.filter((s) => s && s.monthKey !== snapshot.monthKey) : [])]);
  }

  /** La serie de fotos, de la más antigua a la más reciente; solo es «serie» con ≥ 3 fotos completas. */
  function series(store) {
    const all = normalizeStore(store).slice().reverse();
    const complete = all.filter((s) => known(s.net));
    return { all, complete, enough: complete.length >= MIN_SERIES, need: MIN_SERIES, have: complete.length, incomplete: all.length - complete.length };
  }

  /** De dónde viene el cambio del patrimonio entre dos fotos: cada componente con su efecto (la deuda que baja suma). El resto, si algún componente no se conocía, queda aparte. */
  function movement(previous, current) {
    if (!previous || !current) return { calculable: false, reason: "Faltan dos fotos." };
    if (!known(previous.net) || !known(current.net)) return { calculable: false, reason: "Alguna de las dos fotos está incompleta: falta " + [...(previous.missing || []), ...(current.missing || [])].join(", ") + "." };
    const rows = COMPONENTS.map((component) => ({ id: component.id, label: component.label, value: round2(component.sign * (number(current[component.id]) - number(previous[component.id]))) }));
    const delta = round2(current.net - previous.net);
    const drift = round2(delta - rows.reduce((sum, row) => sum + row.value, 0));
    return { calculable: true, previousMonthKey: previous.monthKey, currentMonthKey: current.monthKey, delta, rows, drift, relativePct: Math.abs(previous.net) > 0 ? round2((delta / Math.abs(previous.net)) * 100) : null };
  }

  const SCENARIO_IDS = Object.freeze(["low", "base", "high"]);

  /**
   * La proyección a N meses en tres escenarios.
   * @param {{startMonthKey?: string, horizonMonths?: number, start?: {portfolio?: number, assets?: number}, liquidityPath?: Array<{monthKey: string, value: number}>, debtPath?: Array<{monthKey: string, balance: number}>, excludedDebt?: number,
   *   scenarios?: Array<{id: string, label?: string, portfolioReturnPct?: number|null, assetGrowthPct?: number|null}>, targetNet?: number|null, liquidityNow?: number}} [params]
   */
  function project({ startMonthKey = "", horizonMonths = 120, start = {}, liquidityPath = [], debtPath = [], excludedDebt = 0, scenarios = [], targetNet = null, liquidityNow = 0 } = {}) {
    if (!isMonth(startMonthKey)) return { calculable: false, reason: "Falta el mes de partida." };
    const horizon = Math.max(1, Math.min(MAX_HORIZON_MONTHS, Math.round(number(horizonMonths, 120))));
    const liquidity = new Map((Array.isArray(liquidityPath) ? liquidityPath : []).filter((row) => row && isMonth(row.monthKey)).map((row) => [row.monthKey, number(row.value)]));
    const debt = new Map((Array.isArray(debtPath) ? debtPath : []).filter((row) => row && isMonth(row.monthKey)).map((row) => [row.monthKey, number(row.balance)]));
    const lastLiquidityKey = [...liquidity.keys()].sort().at(-1);
    const lastDebtKey = [...debt.keys()].sort().at(-1);
    const portfolio0 = Math.max(0, number(start.portfolio));
    const assets0 = Math.max(0, number(start.assets));
    const keys = Array.from({ length: horizon }, (_, index) => addMonths(startMonthKey, index + 1));
    const liquidityAt = (key) => (liquidity.has(key) ? liquidity.get(key) : lastLiquidityKey && key > lastLiquidityKey ? liquidity.get(lastLiquidityKey) : number(liquidityNow));
    const debtSorted = [...debt.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const out = (Array.isArray(scenarios) ? scenarios : []).filter((scenario) => scenario && SCENARIO_IDS.includes(scenario.id)).map((scenario) => {
      const returnDeclared = known(scenario.portfolioReturnPct);
      const growthDeclared = known(scenario.assetGrowthPct);
      const r = returnDeclared ? number(scenario.portfolioReturnPct) / 100 : 0;
      const g = growthDeclared ? number(scenario.assetGrowthPct) / 100 : 0;
      let carry = debtSorted.length ? debtSorted[0][1] : 0; // antes del primer mes del calendario se mantiene el saldo inicial
      const path = keys.map((key, index) => {
        const t = (index + 1) / 12;
        if (debt.has(key)) carry = debt.get(key);
        else if (lastDebtKey && key > lastDebtKey) carry = 0; // pasado el calendario, la deuda con calendario está saldada
        const principal = carry + number(excludedDebt); // la deuda sin calendario (sin TAE o plazo) no amortiza en la proyección: se mantiene
        const portfolio = portfolio0 * (1 + r) ** t;
        const assets = assets0 * (1 + g) ** t;
        const net = liquidityAt(key) + portfolio + assets - principal;
        return { monthKey: key, net: round2(net), liquidity: round2(liquidityAt(key)), portfolio: round2(portfolio), assets: round2(assets), debt: round2(principal) };
      });
      const firstAt = (predicate) => (path.find(predicate) || {}).monthKey || null;
      return {
        id: scenario.id, label: text(scenario.label) || scenario.id, portfolioReturnPct: returnDeclared ? number(scenario.portfolioReturnPct) : null, assetGrowthPct: growthDeclared ? number(scenario.assetGrowthPct) : null,
        declared: { portfolio: returnDeclared, assets: growthDeclared }, path, endNet: path.length ? path[path.length - 1].net : null,
        milestones: {
          netPositiveMonth: path.length && path[0].net < 0 ? firstAt((row) => row.net >= 0) : null,
          targetMonth: known(targetNet) ? firstAt((row) => row.net >= number(targetNet)) : null,
        },
      };
    });
    const debtFree = [...debt.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).find(([, balance]) => balance <= 0.005);
    return {
      calculable: out.length > 0, schemaId: SCHEMA_ID, startMonthKey, months: keys, scenarios: out,
      debtFreeMonthKey: number(excludedDebt) > 0 ? null : (debtFree ? debtFree[0] : null), excludedDebt: round2(excludedDebt),
      anyUndeclared: out.some((scenario) => !scenario.declared.portfolio || !scenario.declared.assets),
      allSame: out.length > 1 && out.every((scenario) => scenario.path.every((row, index) => row.net === out[0].path[index].net)),
    };
  }

  /** Los puntos del abanico (bajo, central, alto) por mes, a partir de los escenarios: central = «base»; bajo y alto, el mínimo y el máximo de los tres. */
  function fan(projection) {
    if (!projection || !projection.calculable) return [];
    const base = projection.scenarios.find((scenario) => scenario.id === "base") || projection.scenarios[0];
    return projection.months.map((monthKey, index) => {
      const values = projection.scenarios.map((scenario) => scenario.path[index].net);
      return { monthKey, low: Math.min(...values), center: base.path[index].net, high: Math.max(...values) };
    });
  }

  return { SCHEMA_ID, MIN_SERIES, MAX_SNAPSHOTS, COMPONENTS, SCENARIO_IDS, addMonths, buildSnapshot, normalizeStore, upsert, series, movement, project, fan };
});
