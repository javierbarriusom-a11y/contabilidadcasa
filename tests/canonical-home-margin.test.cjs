const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const HomeMargin = require("../canonical-home-margin.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");

// app.js es un script de navegador: se extraen sus funciones por nombre y se ejecutan con lo mínimo.
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let depth = 0;
  for (let index = app.indexOf("{", start); index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

// S3′ (docs/OLA2_RECALIBRACION.md §3, sesión 288). Todas las cifras son inventadas: el repositorio es público.

const rows = [
  { detailMonthKey: "2026-09", month: "sep 26", totalLiquidity: 7400 },
  { detailMonthKey: "2026-10", month: "oct 26", totalLiquidity: 8100.5 },
  { detailMonthKey: "2026-11", month: "nov 26", totalLiquidity: 6000 },
];
const base = { balances: { caixa: 5000, mediolanum: 2000 }, liquidityFloor: 1500, caixaMinimum: 1500, rows, today: "2026-10-02" };

test("disponible hoy = saldo total − suelo; disponible a fin de mes = liquidez prevista del mes de hoy − suelo", () => {
  const margin = HomeMargin.build(base);
  assert.equal(margin.status, "ok");
  assert.deepEqual(margin.today, { total: 7000, floor: 1500, margin: 5500 });
  assert.deepEqual(margin.endOfMonth, { available: true, monthKey: "2026-10", monthLabel: "octubre", projected: 8100.5, margin: 6600.5 });
});

test("la fila es la del mes de HOY, no la del mes de los saldos ni la primera", () => {
  // Saldos del 27/9 y hoy 2/10: la primera fila del motor es septiembre, pero «a fin de mes» es octubre.
  assert.equal(HomeMargin.build({ ...base, today: "2026-10-02" }).endOfMonth.monthKey, "2026-10");
  assert.equal(HomeMargin.build({ ...base, today: "2026-09-27" }).endOfMonth.projected, 7400);
  assert.equal(HomeMargin.build({ ...base, today: "2026-11-30" }).endOfMonth.margin, 4500);
});

test("un margen negativo se dice con su signo y nunca se recorta a 0", () => {
  const margin = HomeMargin.build({ ...base, balances: { caixa: 800, mediolanum: 200 }, rows: [{ detailMonthKey: "2026-10", month: "oct 26", totalLiquidity: 300 }] });
  assert.equal(margin.today.margin, -500);
  assert.equal(margin.endOfMonth.margin, -1200);
});

test("el titular es el menor de los dos márgenes: gastar X baja las dos cifras en X", () => {
  // Fin de mes por encima de hoy (entran más ingresos de los que salen): manda hoy.
  const above = HomeMargin.build(base);
  assert.deepEqual(above.spendable, { value: 5500, basis: "today" });
  // Fin de mes por debajo de hoy (queda por pagar más de lo que queda por cobrar): manda el fin de mes.
  const below = HomeMargin.build({ ...base, rows: [{ detailMonthKey: "2026-10", month: "oct 26", totalLiquidity: 4000 }] });
  assert.deepEqual(below.spendable, { value: 2500, basis: "endOfMonth" });
  // Comprobación de la propiedad: tras gastar el titular, ninguno de los dos márgenes queda por debajo de 0.
  const spent = below.spendable.value;
  assert.equal(below.today.margin - spent >= 0, true);
  assert.equal(below.endOfMonth.margin - spent, 0);
  // Empate: la base es hoy. Sin previsión: la base es hoy.
  assert.equal(HomeMargin.build({ ...base, rows: [{ detailMonthKey: "2026-10", month: "oct 26", totalLiquidity: 7000 }] }).spendable.basis, "today");
  assert.deepEqual(HomeMargin.build({ ...base, rows: [] }).spendable, { value: 5500, basis: "today" });
  // Negativo: se dice con su signo, y puede mandar cualquiera de los dos.
  const negative = HomeMargin.build({ ...base, balances: { caixa: 800, mediolanum: 200 }, rows: [{ detailMonthKey: "2026-10", month: "oct 26", totalLiquidity: 300 }] });
  assert.deepEqual(negative.spendable, { value: -1200, basis: "endOfMonth" });
  // Sin saldo no hay titular.
  assert.equal(HomeMargin.build({ ...base, balances: { caixa: null, mediolanum: 1 } }).spendable, null);
});

test("el nombre del mes sale de la clave, en español y sin año: «oct 26» se leería como «26 de octubre»", () => {
  for (const [today, name] of [["2026-01-15", "enero"], ["2026-09-30", "septiembre"], ["2026-10-02", "octubre"], ["2026-12-31", "diciembre"]]) {
    const margin = HomeMargin.build({ ...base, today, rows: [{ detailMonthKey: today.slice(0, 7), month: "etiqueta cualquiera", totalLiquidity: 1 }] });
    assert.equal(margin.endOfMonth.monthLabel, name);
  }
});

test("sin fila para el mes de hoy no hay cifra de fin de mes, pero sí la de hoy", () => {
  for (const noRows of [[], null, undefined, [{ detailMonthKey: "2026-12", month: "dic 26", totalLiquidity: 1 }]]) {
    const margin = HomeMargin.build({ ...base, rows: noRows });
    assert.equal(margin.status, "ok");
    assert.equal(margin.today.margin, 5500);
    assert.equal(margin.endOfMonth.available, false);
    assert.equal(margin.endOfMonth.projected, null);
    assert.equal(margin.endOfMonth.margin, null);
  }
  // Una fila sin liquidez no es 0: es un dato que falta.
  assert.equal(HomeMargin.build({ ...base, rows: [{ detailMonthKey: "2026-10", month: "oct 26", totalLiquidity: null }] }).endOfMonth.available, false);
  assert.equal(HomeMargin.build({ ...base, today: "" }).endOfMonth.available, false);
});

test("sin saldo no hay cifra y se dice cuál falta; null, vacío y texto no valen 0", () => {
  for (const [balances, missing] of [
    [{ caixa: null, mediolanum: 2000 }, ["saldo de CaixaBank"]],
    [{ caixa: 5000, mediolanum: "" }, ["saldo de Mediolanum"]],
    [{ caixa: "abc", mediolanum: undefined }, ["saldo de CaixaBank", "saldo de Mediolanum"]],
    [undefined, ["saldo de CaixaBank", "saldo de Mediolanum"]],
  ]) {
    const margin = HomeMargin.build({ ...base, balances });
    assert.equal(margin.status, "missing");
    assert.deepEqual(margin.missing, missing);
    assert.equal(margin.today, null);
    assert.equal(margin.endOfMonth, null);
  }
  // Un saldo a 0 sí es un dato.
  assert.equal(HomeMargin.build({ ...base, balances: { caixa: 0, mediolanum: 0 } }).today.margin, -1500);
});

test("el suelo: valor inicial 1.500; el 0 explícito vale; vacío, texto y negativo vuelven al inicial", () => {
  assert.equal(HomeMargin.DEFAULT_LIQUIDITY_FLOOR, 1500);
  assert.equal(HomeMargin.normalizeFloor(undefined), 1500);
  assert.equal(HomeMargin.normalizeFloor(null), 1500);
  assert.equal(HomeMargin.normalizeFloor(""), 1500);
  assert.equal(HomeMargin.normalizeFloor("x"), 1500);
  assert.equal(HomeMargin.normalizeFloor(-5), 1500);
  assert.equal(HomeMargin.normalizeFloor(0), 0);
  assert.equal(HomeMargin.normalizeFloor("2000.456"), 2000.46);
  assert.equal(HomeMargin.build({ ...base, liquidityFloor: 0 }).today.margin, 7000);
  assert.equal(HomeMargin.build({ ...base, liquidityFloor: undefined }).floor, 1500);
});

test("céntimos exactos y sin mutar las entradas", () => {
  const input = { ...base, balances: { caixa: 0.1, mediolanum: 0.2 }, liquidityFloor: 0, rows: [{ detailMonthKey: "2026-10", month: "oct 26", totalLiquidity: 1000.1 }] };
  const copy = JSON.parse(JSON.stringify(input));
  const margin = HomeMargin.build(input);
  assert.equal(margin.today.total, 0.3);
  assert.equal(margin.endOfMonth.margin, 1000.1);
  assert.deepEqual(input, copy);
});

test("S-2: CaixaBank por debajo de su mínimo operativo se dice aparte y no cambia ninguna cifra", () => {
  const margin = HomeMargin.build({ ...base, balances: { caixa: 1000, mediolanum: 6000 }, caixaMinimum: 1500 });
  assert.equal(margin.caixaShortfall, 500);
  assert.equal(margin.moveFromMediolanum, 500);
  assert.equal(margin.today.margin, 5500);
  // Si Mediolanum no alcanza, se mueve lo que haya.
  const short = HomeMargin.build({ ...base, balances: { caixa: 1000, mediolanum: 200 }, caixaMinimum: 1500 });
  assert.equal(short.caixaShortfall, 500);
  assert.equal(short.moveFromMediolanum, 200);
  // Sin mínimo configurado o con CaixaBank por encima, no hay aviso.
  assert.equal(HomeMargin.build({ ...base, caixaMinimum: 0 }).caixaShortfall, 0);
  assert.equal(HomeMargin.build({ ...base, caixaMinimum: null }).caixaShortfall, 0);
  assert.equal(HomeMargin.build(base).caixaShortfall, 0);
});

test("la salida tiene siempre los mismos campos, falte lo que falte", () => {
  const keys = Object.keys(HomeMargin.build(base)).sort();
  assert.deepEqual(Object.keys(HomeMargin.build({})).sort(), keys);
  assert.deepEqual(Object.keys(HomeMargin.build()).sort(), keys);
  assert.deepEqual(Object.keys(HomeMargin.build({ ...base, rows: [] })).sort(), keys);
});

function floorSandbox({ stored, value, focus = null } = {}) {
  const saves = [];
  const announcements = [];
  const renders = [];
  const field = { value: "" };
  const context = {
    state: stored === undefined ? {} : { liquidityFloor: stored },
    document: { activeElement: focus },
    qs: (id) => (id === "ajustesLiquidityFloor" ? field : null),
    money: (amount) => `${amount} €`,
    round2: (amount) => Math.round(Number(amount) * 100) / 100,
    saveScenarioSettings: () => saves.push(true),
    announceStatus: (text) => announcements.push(text),
    render: () => renders.push(true),
  };
  vm.createContext(context);
  vm.runInContext(["handleLiquidityFloorChange", "syncLiquidityFloorControl"].map(extractFunction).join("\n"), context, { filename: "app.js#s3-floor" });
  return { context, field, saves, announcements, renders };
}

test("Ajustes · el suelo de liquidez: lo escrito se guarda; vacío o no interpretable es «sin configurar»; el 0 vale", () => {
  for (const [typed, expected] of [["1200,5", 1200.5], ["2000", 2000], ["0", 0], ["", null], ["  ", null], ["abc", null], ["-3", null]]) {
    const { context, field, saves, renders } = floorSandbox({ stored: 1500 });
    context.handleLiquidityFloorChange({ target: Object.assign(field, { value: typed }) });
    assert.equal(context.state.liquidityFloor, expected, `escrito «${typed}»`);
    assert.equal(field.value, expected === null ? "" : String(expected), `el campo se normaliza con «${typed}»`);
    assert.equal(saves.length, 1);
    assert.equal(renders.length, 1);
  }
});

test("Ajustes · si el valor no cambia no se guarda ni se repinta, y sin nada guardado «vacío» sigue siendo sin configurar", () => {
  const same = floorSandbox({ stored: 1500 });
  same.context.handleLiquidityFloorChange({ target: Object.assign(same.field, { value: "1500" }) });
  assert.equal(same.saves.length, 0);
  assert.equal(same.renders.length, 0);
  const untouched = floorSandbox({});
  untouched.context.handleLiquidityFloorChange({ target: Object.assign(untouched.field, { value: "" }) });
  assert.equal(untouched.saves.length, 0);
});

test("Ajustes · el control se rellena con lo guardado, vacío si no hay nada, y no pisa lo que se está escribiendo", () => {
  const set = floorSandbox({ stored: 1750 });
  set.context.syncLiquidityFloorControl();
  assert.equal(set.field.value, 1750);
  const none = floorSandbox({});
  none.context.syncLiquidityFloorControl();
  assert.equal(none.field.value, "");
  const focused = floorSandbox({ stored: 1750 });
  focused.context.document.activeElement = focused.field;
  focused.field.value = "escribiendo";
  focused.context.syncLiquidityFloorControl();
  assert.equal(focused.field.value, "escribiendo");
});

test("app.js: la ficha de margen sustituye a «Caja disponible» y a «Liquidez hoy», y el suelo se persiste", () => {
  const glance = extractFunction("renderHomeBudgetGlance");
  assert.match(glance, /homeMarginTile\(balances\)/);
  // Va la primera de la rejilla: en móvil, detrás del presupuesto, la cifra quedaba bajo el pliegue.
  assert.ok(glance.indexOf("homeMarginTile(balances)") < glance.indexOf('label: "Presupuesto del mes"'), "la ficha de margen es la primera de la rejilla");
  assert.ok(!glance.includes('label: "Caja disponible"'), "«Caja disponible» ya no se pinta: la ficha de margen ocupa su sitio");
  const dashboard = extractFunction("renderHomeDashboard");
  assert.ok(!dashboard.includes('label: "Liquidez hoy"'), "«Liquidez hoy» ya no se pinta en la rejilla de KPIs: repetía el mismo total");
  const tile = extractFunction("homeMarginTile");
  assert.match(tile, /window\.FinanceCanonicalHomeMargin\?\.build\(/);
  assert.match(tile, /liquidityFloor: state\?\.liquidityFloor/);
  assert.match(tile, /openSimulationRows\(lastSimulation\)/);
  assert.ok(!/canonicalDailyEngineRuns|FinanceCanonicalDailyEngine/.test(tile), "no pasa por el motor diario (fechas de salida estimadas)");
  assert.match(extractFunction("saveScenarioSettings"), /liquidityFloor: state\.liquidityFloor \?\? null/);
  assert.match(app, /qs\("ajustesLiquidityFloor"\)\?\.addEventListener\("change", handleLiquidityFloorChange\)/);
  assert.match(app, /syncLiquidityFloorControl\(\);\n\s+renderAjustesReserveNote\(\);/);
});

test("el módulo y el control están registrados: index.html (antes de app.js), service worker, build y Ajustes", () => {
  const html = read("index.html");
  const moduleAt = html.indexOf('src="canonical-home-margin.js');
  assert.ok(moduleAt > 0 && moduleAt < html.indexOf('src="app.js'), "el módulo se carga antes que app.js");
  assert.match(read("service-worker.js"), /"\.\/canonical-home-margin\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-home-margin\.js"/);
  assert.match(html, /<input id="ajustesLiquidityFloor" type="number" min="0"/);
  // El suelo de liquidez no se confunde con la reserva operativa: cada uno tiene su propio campo.
  assert.match(html, /id="ajustesReserve"/);
});

test("S5 · el titular de la ficha es «Disponible para gastar» (el menor de los dos márgenes) y las dos cifras van de apoyo", () => {
  const tile = extractFunction("homeMarginTile");
  assert.match(tile, /label: "Disponible para gastar"/);
  assert.match(tile, /value: money\(spendable\.value, true\)/);
  assert.match(tile, /Hoy: \$\{money\(today\.margin, true\)\} · A fin de \$\{eom\.monthLabel\} \(previsión\): \$\{money\(eom\.margin, true\)\}/);
  assert.match(tile, /spendable\.value < 0 \? "danger"/);
  // El nombre «Disponible» lo aprobó el hogar (S-4) con el suelo al lado: la nota lo dice.
  assert.match(tile, /Sin bajar del suelo de \$\{money\(today\.floor, true\)\}/);
});

test("S5 · en móvil el subtítulo de Hoy se oculta (41 px antes de la cifra), y la versión de la hoja de estilos cambia con ello", () => {
  const css = read("design-tokens.css");
  assert.match(css, /@media \(max-width: 640px\) \{\s*#home \.e19-subtitle \{ display: none; \}\s*\}/);
  // Solo en móvil: la regla base del subtítulo no oculta nada en escritorio.
  assert.ok(!/\.e19-subtitle \{[^}]*display: none/.test(css.replace(/@media[^{]*\{[^}]*\{[^}]*\}[^}]*\}/g, "")));
  assert.match(read("index.html"), /design-tokens\.css\?v=20261002s5a1/);
});
