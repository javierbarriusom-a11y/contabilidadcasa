const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-12 · NPV-02: backtest de liquidez a fin de mes. Los días 1-3 y 15-17 se congela la liquidez que la previsión
// diaria espera tener; al firmar el cierre se compara con los saldos reales en SU fecha. La foto es de solo añadir
// (si se pudiera rehacer sabiendo el resultado, el backtest no mediría nada) y con menos de 3 cierres no hay error:
// «datos insuficientes», nunca precisión inventada.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const engine = require("../canonical-liquidity-backtest.js");
const dailyEngine = require("../canonical-daily-engine.js");
const plain = (value) => JSON.parse(JSON.stringify(value));

// Liquidez de 1.000 € el 1/10/2026 que sube 10 € cada día: la previsión es una recta fácil de verificar a mano.
function line(startIso = "2026-10-01", endIso = "2026-12-31", base = 1000, step = 10) {
  const rows = [];
  const end = Date.UTC(Number(endIso.slice(0, 4)), Number(endIso.slice(5, 7)) - 1, Number(endIso.slice(8, 10)));
  let index = 0;
  for (let time = Date.UTC(Number(startIso.slice(0, 4)), Number(startIso.slice(5, 7)) - 1, Number(startIso.slice(8, 10))); time <= end; time += 86400000) {
    rows.push({ date: new Date(time).toISOString().slice(0, 10), total: base + index * step });
    index += 1;
  }
  return rows;
}

const manual = { balanceMode: "manual", balanceDate: "2026-10-14" };

function close(monthKey, date, caixabank, mediolanum, mode = "manual") {
  return { monthKey, date, mode, accounts: { caixabank, mediolanum, efectivo: 50 } };
}

test("ventanas de foto: días 1-3 y 15-17; el resto del mes no se congela", () => {
  assert.equal(engine.slotOn("2026-10-01").id, "d01");
  assert.equal(engine.slotOn("2026-10-03").id, "d01");
  assert.equal(engine.slotOn("2026-10-04"), null);
  assert.equal(engine.slotOn("2026-10-14"), null);
  assert.equal(engine.slotOn("2026-10-15").id, "d15");
  assert.equal(engine.slotOn("2026-10-17").id, "d15");
  assert.equal(engine.slotOn("2026-10-18"), null);
  assert.equal(engine.slotOn("2026-10-31"), null);
  assert.equal(engine.slotOn("no-es-fecha"), null);
  assert.equal(engine.slotOn("2026-02-30"), null, "una fecha imposible no abre ventana");
});

test("la foto guarda la liquidez de cada día hasta fin de mes y unos días más, con su fecha y el origen de los saldos", () => {
  const freeze = engine.buildFreeze({ today: "2026-10-15", rows: line(), ...manual, frozenAt: "2026-10-15T08:00:00.000Z" });
  assert.equal(freeze.key, "2026-10:d15");
  assert.equal(freeze.slot, "d15");
  assert.equal(freeze.date, "2026-10-15");
  // del 15 al 31 de octubre son 17 días, más 10 de cola: hasta el 10/11.
  assert.equal(freeze.totals.length, 17 + engine.TAIL_DAYS);
  assert.equal(freeze.totals[0], 1140, "el 15/10 es el día 14 de la serie: 1.000 + 14·10");
  assert.equal(freeze.closing, 1300, "el 31/10 es el día 30");
  assert.equal(engine.predictedAt(freeze, "2026-10-31"), 1300);
  assert.equal(engine.predictedAt(freeze, "2026-11-02"), 1320, "una fecha de la cola, por si el cierre se firma con saldos de después");
  assert.equal(engine.predictedAt(freeze, "2026-10-14"), null, "antes de la foto no hay previsión congelada");
  assert.equal(engine.predictedAt(freeze, "2026-11-30"), null, "más allá de la cola tampoco");
  assert.equal(freeze.balanceMode, "manual");
  assert.equal(freeze.balanceDate, "2026-10-14");
  assert.equal(freeze.frozenAt, "2026-10-15T08:00:00.000Z");
});

test("sin saldos manuales la foto se guarda igual pero marcada: el reloj no espera, la comparación ya decidirá", () => {
  const freeze = engine.buildFreeze({ today: "2026-10-15", rows: line(), balanceMode: "auto", balanceDate: "no-fecha" });
  assert.equal(freeze.balanceMode, "auto");
  assert.equal(freeze.balanceDate, "");
});

test("media foto no se guarda: si la previsión no cubre hoy y el fin de mes, no hay foto", () => {
  assert.equal(engine.buildFreeze({ today: "2026-10-04", rows: line(), ...manual }), null, "hoy no es día de foto");
  assert.equal(engine.buildFreeze({ today: "2026-10-15", rows: line("2026-10-01", "2026-10-20"), ...manual }), null, "la previsión se queda corta antes del fin de mes");
  assert.equal(engine.buildFreeze({ today: "2026-10-15", rows: line("2026-10-16", "2026-12-31"), ...manual }), null, "no hay fila de hoy");
  assert.equal(engine.buildFreeze({ today: "2026-10-15", rows: [], ...manual }), null);
  assert.equal(engine.buildFreeze({ today: "2026-10-15", rows: undefined, ...manual }), null);
  const withHole = line().filter((row) => row.date !== "2026-10-20");
  assert.equal(engine.buildFreeze({ today: "2026-10-15", rows: withHole, ...manual }), null, "un día que falta antes del fin de mes deja la serie incompleta");
  const noisy = [{ date: "2026-10-15", total: "x" }, ...line("2026-10-16", "2026-12-31")];
  assert.equal(engine.buildFreeze({ today: "2026-10-15", rows: noisy, ...manual }), null, "un total que no es número no se acepta");
});

test("la foto es de SOLO AÑADIR: la primera de la ventana gana y nada la reescribe", () => {
  const first = engine.freezeIfDue({ store: null, today: "2026-10-15", rows: line(), ...manual, now: "A" });
  assert.equal(first.freeze.key, "2026-10:d15");
  const worse = line().map((row) => ({ ...row, total: 0 }));
  const again = engine.freezeIfDue({ store: first.store, today: "2026-10-16", rows: worse, ...manual, now: "B" });
  assert.equal(again.freeze, null, "el 16 la ventana del día 15 sigue abierta, pero ya tiene su foto");
  assert.equal(again.store.freezes["2026-10:d15"].frozenAt, "A");
  assert.equal(again.store.freezes["2026-10:d15"].closing, 1300);
  const direct = engine.recordFreeze(first.store, { ...first.freeze, closing: 1 });
  assert.equal(direct.added, false);
  assert.equal(direct.store.freezes["2026-10:d15"].closing, 1300, "ni recordFreeze directo la sustituye");
  // otra ventana u otro mes sí tienen la suya
  const other = engine.freezeIfDue({ store: first.store, today: "2026-11-01", rows: line(), ...manual, now: "C" });
  assert.equal(other.freeze.key, "2026-11:d01");
  assert.deepEqual(Object.keys(other.store.freezes).sort(), ["2026-10:d15", "2026-11:d01"]);
});

test("fuera de ventana, o con la previsión aún incompleta, no se congela nada y se puede reintentar", () => {
  const store = { freezes: {} };
  assert.equal(engine.freezeIfDue({ store, today: "2026-10-10", rows: line(), ...manual }).freeze, null);
  const incomplete = engine.freezeIfDue({ store, today: "2026-10-15", rows: [], ...manual });
  assert.equal(incomplete.freeze, null);
  assert.deepEqual(incomplete.store.freezes, {}, "sin foto no se guarda ningún hueco: al abrir otra vez dentro de la ventana se reintenta");
  assert.equal(engine.freezeIfDue({ store, today: "2026-10-16", rows: line(), ...manual }).freeze.key, "2026-10:d15");
});

test("una copia o una nube corrupta no puede colar una foto que no sea una serie de números", () => {
  const good = engine.buildFreeze({ today: "2026-10-15", rows: line(), ...manual });
  const store = engine.normalizeStore({
    freezes: {
      a: good,
      b: { ...good, slot: "d99" },
      c: { ...good, monthKey: "2026-13" },
      d: { ...good, totals: [1, "2", 3] },
      e: { ...good, totals: [] },
      f: { ...good, closing: "mucho" },
      g: { ...good, date: "2026-09-15" },
      h: null,
      i: "texto",
    },
  });
  assert.deepEqual(Object.keys(store.freezes), ["2026-10:d15"]);
  assert.deepEqual(plain(engine.normalizeStore(null)), { freezes: {} });
  assert.deepEqual(plain(engine.normalizeStore([1, 2])), { freezes: {} });
  assert.deepEqual(plain(engine.normalizeStore({ freezes: [1] })), { freezes: {} });
});

test("el almacén no crece sin límite: se queda con las fotos más recientes", () => {
  let store = { freezes: {} };
  for (let year = 2020; year < 2040; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const rows = line(`${monthKey}-01`, `${monthKey}-28`);
      store = engine.recordFreeze(store, { key: `${monthKey}:d15`, monthKey, slot: "d15", date: `${monthKey}-15`, totals: [1, 2], closing: 1, balanceMode: "manual", balanceDate: "", frozenAt: "", rows: rows.length }).store;
    }
  }
  assert.equal(Object.keys(store.freezes).length, 96);
  assert.ok(store.freezes["2039-12:d15"], "la más reciente se conserva");
  assert.equal(store.freezes["2020-01:d15"], undefined, "la más antigua se descarta");
});

test("error = previsto − real, en la FECHA de los saldos del cierre, con CaixaBank + Mediolanum y sin el efectivo", () => {
  const { store } = engine.freezeIfDue({ store: null, today: "2026-10-15", rows: line(), ...manual });
  // Cierre con saldos del 31/10: previsto 1.300, real 400 + 700 = 1.100 → optimista en 200 (el efectivo de 50 no cuenta).
  let result = engine.compare({ store, closes: { months: { "2026-10": close("2026-10", "2026-10-31", 400, 700) } } });
  assert.equal(result.rows.length, 1);
  assert.deepEqual(plain(result.rows[0]), {
    key: "2026-10:d15", monthKey: "2026-10", slot: "d15", frozenOn: "2026-10-15", closeDate: "2026-10-31", staleDays: 1,
    status: "comparable", predicted: 1300, actual: 1100, error: 200,
  });
  // El mismo cierre firmado con saldos del 2/11 se compara con lo previsto PARA EL 2/11 (1.320), no con el fin de mes.
  result = engine.compare({ store, closes: { months: { "2026-10": close("2026-10", "2026-11-02", 400, 700) } } });
  assert.equal(result.rows[0].predicted, 1320);
  assert.equal(result.rows[0].error, 220);
  // La previsión se quedó corta: error negativo.
  result = engine.compare({ store, closes: { months: { "2026-10": close("2026-10", "2026-10-31", 900, 700) } } });
  assert.equal(result.rows[0].error, -300);
  assert.equal(result.rows[0].status, "comparable");
});

test("cada fila que no cuenta dice por qué; solo «comparable» entra en las medias", () => {
  const { store } = engine.freezeIfDue({ store: null, today: "2026-10-15", rows: line(), ...manual });
  const status = (closeEntry, storeOverride = store) => engine.compare({ store: storeOverride, closes: { months: { "2026-10": closeEntry } } }).rows[0].status;
  assert.equal(status(close("2026-10", "2026-10-31", 400, 700, "auto")), "calculado", "saldos del cierre calculados por la app: no son del banco");
  assert.equal(status({ date: "2026-10-31", mode: "manual", accounts: { caixabank: 400 } }), "sin-cuentas", "falta una cuenta: no se puede sumar la liquidez");
  assert.equal(status({ date: "2026-10-31", mode: "manual", accounts: { caixabank: 400, mediolanum: "700" } }), "sin-cuentas", "un saldo que no es número tampoco");
  assert.equal(status(close("2026-10", "2026-12-20", 400, 700)), "fuera-de-serie", "fecha más allá de lo congelado");
  assert.equal(status(close("2026-10", "2026-10-10", 400, 700)), "fuera-de-serie", "fecha anterior a la foto");
  const auto = engine.freezeIfDue({ store: null, today: "2026-10-15", rows: line(), balanceMode: "auto" }).store;
  assert.equal(status(close("2026-10", "2026-10-31", 400, 700), auto), "partida-calculada", "la foto partía de saldos calculados");
  const excluded = engine.compare({ store, closes: { months: { "2026-10": close("2026-10", "2026-10-31", 400, 700, "auto") } } }).rows[0];
  assert.equal(excluded.error, null);
  assert.equal(excluded.predicted, null);
  assert.equal(excluded.actual, null);
});

test("una foto sin su cierre queda pendiente, con lo previsto, y no cuenta como error", () => {
  const { store } = engine.freezeIfDue({ store: null, today: "2026-10-15", rows: line(), ...manual });
  const result = engine.compare({ store, closes: { months: {} } });
  assert.deepEqual(plain(result.pending), [{ key: "2026-10:d15", monthKey: "2026-10", slot: "d15", frozenOn: "2026-10-15", closing: 1300 }]);
  assert.deepEqual(result.rows, []);
  assert.deepEqual(plain(engine.compare({ store, closes: null }).pending.map((item) => item.key)), ["2026-10:d15"]);
  assert.deepEqual(plain(engine.compare({ store, closes: { months: { "2026-10": { date: "no", accounts: {} } } } }).pending.map((item) => item.key)), ["2026-10:d15"], "un cierre sin fecha válida no sirve");
});

// Cierres de varios meses con error conocido: previsto = liquidez del 31 de cada mes de una recta de 10 €/día.
function months(errors, { slot = "d15", startMonth = 1, year = 2027 } = {}) {
  let store = { freezes: {} };
  const closes = { months: {} };
  errors.forEach((error, index) => {
    const month = startMonth + index;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const rows = line(`${monthKey}-01`, `${monthKey}-28`, 5000, 0).concat(line(`${monthKey}-29`, `${year + 1}-06-30`, 5000, 0));
    const day = slot === "d15" ? "15" : "01";
    store = engine.freezeIfDue({ store, today: `${monthKey}-${day}`, rows, ...manual }).store;
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    closes.months[monthKey] = close(monthKey, end, 5000 - error - 100, 100);
  });
  return { store, closes };
}

test("con menos de 3 cierres comparables NO hay error ni sesgo ni porcentaje: datos insuficientes", () => {
  [0, 1, 2].forEach((count) => {
    const { store, closes } = months(Array.from({ length: count }, () => 40));
    const result = engine.evaluate({ store, closes, today: "2027-06-20" });
    const d15 = result.slots.find((slot) => slot.slot === "d15");
    assert.equal(d15.n, count);
    assert.equal(d15.enough, false);
    assert.equal(d15.missing, 3 - count);
    assert.equal(d15.mae, null);
    assert.equal(d15.bias, null);
    assert.equal(d15.pct, null);
    assert.match(engine.summaryText(result), new RegExp(`datos insuficientes \\(${count} de 3 cierres\\)`));
    const html = engine.renderHtml(result);
    assert.match(html, /Datos insuficientes/);
    assert.doesNotMatch(html, /Error medio/, "ni una cifra de error con tan pocos cierres");
    assert.match(html, /precisión inventada/);
  });
});

test("con 3 cierres comparables sí hay error medio, sesgo y porcentaje (y se dice si la previsión es optimista)", () => {
  const { store, closes } = months([100, 200, 300]); // previsto 5.000 cada mes; real = 5.000 − error
  const result = engine.evaluate({ store, closes, today: "2027-06-20" });
  const d15 = result.slots.find((slot) => slot.slot === "d15");
  assert.equal(d15.n, 3);
  assert.equal(d15.enough, true);
  assert.equal(d15.mae, 200);
  assert.equal(d15.bias, 200);
  assert.equal(d15.biasLabel, "optimista", "siempre esperó más de lo que hubo");
  assert.equal(d15.pct, 4.2, "200 € de error medio sobre una liquidez media real de 4.800 € (4,17 %)");
  assert.equal(d15.trend, "", "con 3 cierres todavía no hay tendencia");
  const summary = engine.summaryText(result, { money: (value) => `${value} €` });
  assert.equal(summary, "Acierto de la caja a fin de mes: error medio 200 € (4,2 %) con la foto del día 15");
  const html = engine.renderHtml(result, { money: (value) => `${value} €` });
  assert.match(html, /Error medio/);
  assert.match(html, /esperaba más dinero del que hubo \(200 € de media\)/);
  const d01 = result.slots.find((slot) => slot.slot === "d01");
  assert.equal(d01.enough, false, "la foto del día 1 no tiene cierres: cada ventana cuenta los suyos");
});

test("el sesgo se llama sin sesgo cuando los errores se compensan, y pesimista cuando la previsión se queda corta", () => {
  const balanced = engine.evaluate({ ...months([300, -300, 300, -300, 300, -300]), today: "2027-09-20" }).slots.find((slot) => slot.slot === "d15");
  assert.equal(balanced.biasLabel, "sin-sesgo");
  assert.equal(balanced.mae, 300);
  const pessimistic = engine.evaluate({ ...months([-100, -200, -300]), today: "2027-06-20" }).slots.find((slot) => slot.slot === "d15");
  assert.equal(pessimistic.biasLabel, "pesimista");
  assert.equal(pessimistic.bias, -200);
  assert.match(engine.renderHtml(engine.evaluate({ ...months([-100, -200, -300]), today: "2027-06-20" }), { money: (v) => `${v} €` }), /esperaba menos dinero del que hubo/);
});

test("la tendencia del error solo aparece con 6 cierres: baja, sube o estable (M-CALIB: error de caja decreciente)", () => {
  const trendOf = (errors) => engine.evaluate({ ...months(errors), today: "2027-12-20" }).slots.find((slot) => slot.slot === "d15");
  assert.equal(trendOf([100, 100, 100, 100, 100]).trend, "", "con 5 no hay tendencia");
  assert.equal(trendOf([400, 300, 300, 100, 100, 50]).trend, "baja");
  assert.equal(trendOf([50, 100, 100, 300, 300, 400]).trend, "sube");
  assert.equal(trendOf([200, 200, 210, 200, 190, 200]).trend, "estable");
});

test("una ventana cuenta cierres distintos: los dos días de un mismo mes no inflan el recuento", () => {
  // Octubre, noviembre y diciembre con foto del día 1 Y del 15, pero solo octubre y noviembre cerrados.
  let store = { freezes: {} };
  const closes = { months: {} };
  ["2026-10", "2026-11"].forEach((monthKey) => {
    ["01", "15"].forEach((day) => {
      store = engine.freezeIfDue({ store, today: `${monthKey}-${day}`, rows: line("2026-10-01", "2027-03-31", 1000, 0), ...manual }).store;
    });
    closes.months[monthKey] = close(monthKey, `${monthKey}-30`, 900, 100);
  });
  const result = engine.evaluate({ store, closes, today: "2026-12-05" });
  assert.deepEqual(result.slots.map((slot) => [slot.slot, slot.n]), [["d01", 2], ["d15", 2]]);
  assert.equal(result.slots.every((slot) => !slot.enough), true, "dos cierres, aunque haya cuatro fotos: sigue sin bastar");
  assert.match(engine.summaryText(result), /\(2 de 3 cierres\)/);
});

test("el titular del resumen usa la foto del día 15 si ya tiene datos, si no la del día 1, y nunca finge", () => {
  const onlyD01 = engine.evaluate({ ...months([100, 200, 300], { slot: "d01" }), today: "2027-06-20" });
  assert.match(engine.summaryText(onlyD01, { money: (v) => `${v} €` }), /con la foto del día 1$/);
  const both = engine.evaluate({ ...months([10, 10, 10]), today: "2027-06-20" });
  assert.match(engine.summaryText(both, { money: (v) => `${v} €` }), /con la foto del día 15$/);
});

test("próxima foto: la ventana abierta sin foto (hoy) o la siguiente; las ya hechas se saltan", () => {
  assert.deepEqual(plain(engine.nextFreeze({ freezes: {} }, "2026-10-05")), { date: "2026-10-15", slot: "d15", isToday: false });
  assert.deepEqual(plain(engine.nextFreeze({ freezes: {} }, "2026-10-16")), { date: "2026-10-16", slot: "d15", isToday: true });
  const { store } = engine.freezeIfDue({ store: null, today: "2026-10-15", rows: line(), ...manual });
  assert.deepEqual(plain(engine.nextFreeze(store, "2026-10-16")), { date: "2026-11-01", slot: "d01", isToday: false }, "el 16/10 la ventana del 15 ya tiene su foto");
  assert.equal(engine.nextFreeze(store, "no"), null);
});

test("lo que se congela es lo que el motor diario real llama closingLiquidity (sin inventar otra definición de liquidez)", () => {
  const input = {
    openingBalances: { checking: 2000, savings: 3000 },
    months: [{ monthKey: "2026-10" }, { monthKey: "2026-11" }],
    startDate: "2026-10-01",
    events: [
      { id: "nomina", date: "2026-10-05", kind: "income", amount: 1800, accountId: "checking", field: "income", label: "Nómina" },
      { id: "alquiler", date: "2026-10-03", kind: "outflow", amount: 700, accountId: "checking", field: "fixedCoreSpend", label: "Alquiler" },
      { id: "ahorro", date: "2026-10-26", kind: "transfer", amount: 500, fromAccountId: "checking", toAccountId: "savings", field: "saving", label: "Ahorro" },
      { id: "seguro", date: "2026-10-28", kind: "outflow", amount: 120, accountId: "savings", field: "fixedCoreSpend", label: "Seguro" },
      { id: "nov", date: "2026-11-02", kind: "outflow", amount: 250, accountId: "checking", field: "variableOperationalSpend", label: "Gasto" },
    ],
  };
  const rows = dailyEngine.buildRows(input);
  const october = dailyEngine.aggregateMonths(rows, input).find((month) => month.monthKey === "2026-10");
  const freeze = engine.buildFreeze({ today: "2026-10-15", rows, ...manual });
  assert.equal(freeze.closing, october.closingLiquidity, "el previsto a fin de mes es el cierre de liquidez del motor");
  assert.equal(freeze.closing, 5000 + 1800 - 700 - 120);
  assert.equal(engine.predictedAt(freeze, "2026-11-02"), 5000 + 1800 - 700 - 120 - 250, "y la cola cubre los primeros días del mes siguiente");
});

test("la pantalla: lo que espera su cierre, lo que no cuenta con su motivo y la próxima foto; nada de HTML ajeno", () => {
  const { store } = engine.freezeIfDue({ store: null, today: "2026-10-15", rows: line(), ...manual });
  const pending = engine.evaluate({ store, closes: { months: {} }, today: "2026-10-20" });
  const html = engine.renderHtml(pending, { money: (value) => `${value} €` });
  assert.match(html, /Esperan su cierre: foto del 15\/10\/2026, 1300 € previstos para fin de octubre/);
  assert.match(html, /Próxima foto: 01\/11\/2026\./);
  assert.doesNotMatch(html, /No cuentan:/);
  const skipped = engine.evaluate({ store, closes: { months: { "2026-10": close("2026-10", "2026-10-31", 400, 700, "auto") } }, today: "2026-11-02" });
  const skippedHtml = engine.renderHtml(skipped, { money: (value) => `${value} €` });
  assert.match(skippedHtml, /No cuentan: octubre \(foto del 15\/10\/2026\): el cierre se firmó con saldos calculados por la app, no del banco/);
  assert.doesNotMatch(skippedHtml, /<script|onerror=/i);
  assert.match(engine.renderHtml(engine.evaluate({ store: { freezes: {} }, closes: {}, today: "2026-10-16" })), /Hoy toca foto: se hace al abrir la app\./);
  // sin dinero ajeno: la pantalla solo habla de caja del hogar, con los dos bancos
  assert.match(html, /CaixaBank y Mediolanum/);
});

// ---- La capa de pantalla (liquidity-backtest-ui.js) en un vm ----
function uiSandbox({ today = "2026-10-15", stateValue = { balanceMode: "manual", balanceDate: "2026-10-14" }, rows = line(), closes = { months: {} } } = {}) {
  const storage = {};
  const elements = { previsionBacktest: { innerHTML: "" }, previsionBacktestResumen: { textContent: "" } };
  const listeners = {};
  const sandbox = {
    window: { FinanceCanonicalLiquidityBacktest: engine },
    document: { hidden: false, addEventListener: (name, handler) => { listeners[name] = handler; } },
    state: stateValue,
    canonicalDailyEngineRuns: { active: { rows } },
    isoLocalDate: () => today,
    storageKey: (name) => `${name}:demo`,
    storageGet: (key, fallback = "") => storage[key] ?? fallback,
    storageSet: (key, value) => { storage[key] = value; },
    qs: (id) => elements[id] || null,
    money: (value) => `${value} €`,
    loadMonthCloseBalances: () => closes,
    Date,
    JSON,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${read("liquidity-backtest-ui.js")}\nthis.api = { freezeLiquidityForecast, readLiquidityBacktestStore, renderLiquidityBacktest };`, sandbox);
  return { sandbox, storage, elements, listeners, api: sandbox.api };
}

test("UI: congela al abrir en día de foto, guarda en su clave y no vuelve a guardar en la misma ventana", () => {
  const { api, storage, elements } = uiSandbox();
  const freeze = api.freezeLiquidityForecast();
  assert.equal(freeze.key, "2026-10:d15");
  assert.deepEqual(Object.keys(JSON.parse(storage["liquidity-backtest:demo"]).freezes), ["2026-10:d15"]);
  assert.match(elements.previsionBacktest.innerHTML, /Esperan su cierre: foto del 15\/10\/2026/, "la tarjeta se repinta con la foto recién hecha (se hace tras el primer pintado de Previsión)");
  assert.doesNotMatch(elements.previsionBacktest.innerHTML, /Hoy toca foto/);
  const before = storage["liquidity-backtest:demo"];
  assert.equal(api.freezeLiquidityForecast(), null);
  assert.equal(storage["liquidity-backtest:demo"], before, "la segunda apertura no toca lo guardado");
});

test("UI: fuera de ventana, sin estado cargado o con la previsión incompleta no guarda nada y no lanza", () => {
  assert.equal(uiSandbox({ today: "2026-10-10" }).api.freezeLiquidityForecast(), null);
  const noState = uiSandbox({ stateValue: null });
  assert.equal(noState.api.freezeLiquidityForecast(), null);
  assert.deepEqual(Object.keys(noState.storage), []);
  const noRows = uiSandbox({ rows: null }); // null, no undefined: undefined activaría el valor por defecto del ayudante
  assert.equal(noRows.api.freezeLiquidityForecast(), null);
  assert.deepEqual(Object.keys(noRows.storage), [], "sin previsión no hay foto, y se reintenta");
  const broken = uiSandbox();
  broken.sandbox.storageSet = () => { throw new Error("almacenamiento roto"); };
  assert.equal(broken.api.freezeLiquidityForecast(), null, "un fallo de almacenamiento no tumba la app");
});

test("UI: una copia corrupta en el almacén se lee como vacía", () => {
  const { api, storage } = uiSandbox();
  storage["liquidity-backtest:demo"] = "{esto no es json";
  assert.deepEqual(plain(api.readLiquidityBacktestStore()), { freezes: {} });
  storage["liquidity-backtest:demo"] = JSON.stringify({ freezes: { x: { slot: "d15" } } });
  assert.deepEqual(plain(api.readLiquidityBacktestStore()), { freezes: {} });
});

test("UI: al volver a ser visible la app congela (el móvil que se queda abierto de un día a otro) y oculta no hace nada", () => {
  const { sandbox, storage, listeners } = uiSandbox();
  assert.equal(typeof listeners.visibilitychange, "function");
  sandbox.document.hidden = true;
  listeners.visibilitychange();
  assert.deepEqual(Object.keys(storage), []);
  sandbox.document.hidden = false;
  listeners.visibilitychange();
  assert.ok(storage["liquidity-backtest:demo"]);
});

test("UI: pinta el resultado en la tarjeta y su resumen; sin resultado o sin tarjeta no hace nada", () => {
  const { api, elements, sandbox } = uiSandbox();
  const result = engine.evaluate({ store: { freezes: {} }, closes: {}, today: "2026-10-05" });
  api.renderLiquidityBacktest(result);
  assert.match(elements.previsionBacktest.innerHTML, /Datos insuficientes/);
  assert.match(elements.previsionBacktestResumen.textContent, /datos insuficientes \(0 de 3 cierres\)/);
  elements.previsionBacktest.innerHTML = "intacto";
  api.renderLiquidityBacktest(undefined);
  assert.equal(elements.previsionBacktest.innerHTML, "intacto");
  sandbox.qs = () => null;
  assert.doesNotThrow(() => api.renderLiquidityBacktest(result));
});

// ---- Cableado ----
test("cableado: se congela tras la nube, se evalúa en Plan › Previsión, y el almacén viaja con la copia y la nube", () => {
  const app = read("app.js");
  const html = read("index.html");
  const init = app.slice(app.indexOf("async function init() {"));
  const afterCloud = init.indexOf("await setupSupabaseSync();");
  assert.ok(afterCloud > 0);
  const freezeCall = init.indexOf("freezeLiquidityForecast();", afterCloud);
  assert.ok(freezeCall > afterCloud, "tras la nube (no se congela sobre un estado que va a cambiar), como WP-25");
  assert.ok(freezeCall > init.indexOf("openCaptureLinkFromHash()", afterCloud), "después del bloque de WP-25, cuya prueba fija su posición exacta tras la nube");
  assert.match(init.slice(freezeCall), /^freezeLiquidityForecast\(\);[^\n]*\n\}\n/, "es la última sentencia de init()");
  assert.match(app, /renderLiquidityBacktest\(window\.FinanceCanonicalLiquidityBacktest\?\.evaluate\(\{ store: readLiquidityBacktestStore\(\), closes: loadMonthCloseBalances\(\), today: isoLocalDate\(new Date\(\)\) \}\)\)/);
  const stores = app.slice(app.indexOf("const BACKUP_LOCAL_STORES = ["), app.indexOf("];", app.indexOf("const BACKUP_LOCAL_STORES = [")));
  assert.match(stores, /"liquidity-backtest", \/\/ WP-12/);
  assert.match(html, /<details class="e19-card prevision-calidad-card" id="previsionBacktestCard">\s*<summary id="previsionBacktestResumen">/);
  assert.match(html, /<div id="previsionBacktest"><\/div>/);
});

test("cableado: motor y pantalla cargan antes que app.js, en la caché offline y en el sitio publicado", () => {
  const html = read("index.html");
  const at = (file) => html.indexOf(`<script defer src="${file}?v=`);
  assert.ok(at("canonical-liquidity-backtest.js") > 0);
  assert.ok(at("canonical-liquidity-backtest.js") < at("liquidity-backtest-ui.js"), "el motor, antes que la pantalla");
  assert.ok(at("liquidity-backtest-ui.js") < at("app.js"), "la pantalla, antes que app.js");
  for (const name of ["canonical-liquidity-backtest.js", "liquidity-backtest-ui.js"]) {
    assert.match(read("service-worker.js"), new RegExp(`"\\./${name.replace(".", "\\.")}",`));
    assert.match(read("tools/build-public-site.mjs"), new RegExp(`"${name.replace(".", "\\.")}",`));
  }
});

test("la foto no cambia la previsión: el motor puro no escribe nada en el estado ni en la copia que recibe", () => {
  const rows = line();
  const frozen = JSON.stringify(rows);
  const store = { freezes: {} };
  const storeFrozen = JSON.stringify(store);
  engine.freezeIfDue({ store, today: "2026-10-15", rows, ...manual });
  assert.equal(JSON.stringify(rows), frozen);
  assert.equal(JSON.stringify(store), storeFrozen, "no muta el almacén recibido: devuelve uno nuevo");
});
