// Plan › Previsión: «Acierto de la caja a fin de mes» (WP-12 · NPV-02, canonical-liquidity-backtest.js). Script clásico
// cargado antes de app.js (comparte su ámbito global: qs, state, storageGet, money…), fuera de app.js por su techo de
// líneas (ARQ-4). La lógica vive en el motor puro; aquí solo se guarda la foto, se pinta y se vigila el día.
//
// Cuándo se congela: app.js llama a `freezeLiquidityForecast()` tras la nube (no se congela sobre un estado que va a
// cambiar, como WP-25), y esta capa lo repite al volver a ser visible la app, por si el móvil la deja abierta de un
// día a otro. La foto es de solo añadir: la primera de cada ventana gana (ver el motor).

const LIQUIDITY_BACKTEST_STORE = "liquidity-backtest";

function readLiquidityBacktestStore() {
  try {
    return window.FinanceCanonicalLiquidityBacktest.normalizeStore(JSON.parse(storageGet(storageKey(LIQUIDITY_BACKTEST_STORE), "null")));
  } catch {
    return { freezes: {} };
  }
}

// `result`: lo que devuelve `evaluate` (lo calcula app.js, que es quien tiene los cierres y la fecha de hoy).
function renderLiquidityBacktest(result) {
  const box = qs("previsionBacktest");
  const engine = window.FinanceCanonicalLiquidityBacktest;
  if (!box || !engine || !result) return;
  const options = { money: (value) => money(value, true) };
  box.innerHTML = engine.renderHtml(result, options);
  if (qs("previsionBacktestResumen")) qs("previsionBacktestResumen").textContent = engine.summaryText(result, options);
}

// La foto se hace tras la nube, normalmente DESPUÉS del primer pintado de Previsión: sin repintar, la tarjeta seguiría
// diciendo «hoy toca foto» con la foto ya hecha. Es la misma evaluación que hace app.js al pintar la pantalla.
function refreshLiquidityBacktest() {
  const engine = window.FinanceCanonicalLiquidityBacktest;
  if (engine) renderLiquidityBacktest(engine.evaluate({ store: readLiquidityBacktestStore(), closes: loadMonthCloseBalances(), today: isoLocalDate(new Date()) }));
}

// Devuelve la foto nueva o null (no era día de foto, ya estaba hecha, o la previsión aún no cubre el mes).
function freezeLiquidityForecast() {
  try {
    const engine = window.FinanceCanonicalLiquidityBacktest;
    if (!engine || !state) return null;
    const today = isoLocalDate(new Date());
    if (!engine.slotOn(today)) return null;
    const result = engine.freezeIfDue({
      store: readLiquidityBacktestStore(),
      today,
      rows: canonicalDailyEngineRuns.active?.rows,
      balanceMode: state.balanceMode,
      balanceDate: state.balanceDate,
      now: new Date().toISOString(),
    });
    if (!result.freeze) return null;
    storageSet(storageKey(LIQUIDITY_BACKTEST_STORE), JSON.stringify(result.store));
    refreshLiquidityBacktest();
    return result.freeze;
  } catch {
    return null; // sin foto ahora (o la app aún no ha cargado): se reintenta al abrir de nuevo dentro de la ventana
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) freezeLiquidityForecast();
});
