const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const worker = read("service-worker.js");
const schema = require(path.join(root, "canonical-scenario-schema.js"));

// Mismo truco que en `tests/v1-3-kpi-deuda-en-hoy.test.cjs`: `app.js` es un script de navegador y
// no se puede `require`, así que se extraen las funciones por nombre balanceando llaves y se
// ejecutan contra dobles de las piezas que consultan.
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

// Las constantes se toman del propio `app.js` en vez de recopiarlas aquí: si alguien cambia el tope
// del TIN o la clave de almacenamiento, estas pruebas se enteran en vez de seguir comprobando un
// número que ya no existe en la aplicación.
function extractConst(name) {
  const match = app.match(new RegExp(`^const ${name} = .*$`, "m"));
  assert.ok(match, `No existe la constante ${name} en app.js`);
  return match[0];
}

const CONTRACTS = [
  { id: "cetelem", currentPrincipal: 6000, apr: 0.19, paymentStatus: "active" },
  { id: "coche", currentPrincipal: 3500, apr: 0.07, paymentStatus: "active" },
];

function sandbox({ contracts = CONTRACTS, stored = {} } = {}) {
  const storage = new Map();
  if (stored) storage.set("deuda-oferta-reunificacion:test", JSON.stringify(stored));
  const context = {
    Math,
    Number,
    JSON,
    storageKey: (name) => `${name}:test`,
    storageGet: (key, fallback = "") => storage.get(key) ?? fallback,
    storageSet: (key, value) => storage.set(key, value),
    escenarioMotorDebtOptions: () => contracts,
    round2: (value) => Math.round((value + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  [
    extractConst("DEBT_CONSOLIDATION_OFFER_KEY"),
    extractConst("DEBT_CONSOLIDATION_MAX_TIN"),
    extractConst("DEBT_CONSOLIDATION_MAX_PLAZO"),
    extractFunction("debtConsolidationOffer"),
    extractFunction("saveDebtConsolidationOffer"),
    extractFunction("debtConsolidationOfferComplete"),
    extractFunction("debtConsolidationMonthlyPayment"),
    extractFunction("debtConsolidationPlan"),
    extractFunction("debtStrategyDecisions"),
  ].forEach((source) => vm.runInContext(source, context));
  // `debtStrategyDecisions` también atiende a avalancha y bola de nieve, que aquí no se prueban.
  vm.runInContext("function debtStrategyOrderedContracts() { return []; }", context);
  return { context, storage };
}

const OFERTA = { tin: 6, plazo: 60, comision: 500 };

test("V3-3 · la cuota sale de la fórmula francesa, no de una regla de tres", () => {
  const { context } = sandbox();
  // 10.000 € al 6 % TIN en 60 meses: 193,33 €/mes en cualquier cuadro de amortización.
  assert.equal(context.debtConsolidationMonthlyPayment(10000, 6, 60), 193.33);
});

test("V3-3 · un TIN del 0 % no divide entre cero: la cuota es el principal entre el plazo", () => {
  const { context } = sandbox();
  assert.equal(context.debtConsolidationMonthlyPayment(12000, 0, 24), 500);
});

test("V3-3 · sin principal o sin plazo no se devuelve una cuota inventada", () => {
  const { context } = sandbox();
  assert.equal(context.debtConsolidationMonthlyPayment(0, 6, 60), null);
  assert.equal(context.debtConsolidationMonthlyPayment(10000, 6, 0), null);
});

test("V3-3 · el principal del préstamo nuevo suma los saldos y la comisión financiada", () => {
  const { context } = sandbox({ stored: OFERTA });
  const plan = context.debtConsolidationPlan();
  assert.equal(plan.available, true);
  assert.equal(plan.saldos, 9500);
  assert.equal(plan.comision, 500);
  assert.equal(plan.principal, 10000);
  assert.equal(plan.cuota, 193.33);
  assert.equal(plan.totalDevuelto, 11599.8);
  assert.equal(plan.intereses, 1599.8);
});

test("V3-3 · sin comisión el principal es exactamente lo que se debe", () => {
  const { context } = sandbox({ stored: { tin: 6, plazo: 60 } });
  const plan = context.debtConsolidationPlan();
  assert.equal(plan.comision, 0);
  assert.equal(plan.principal, 9500);
});

test("V3-3 · sin oferta no hay plan, y se dice que lo que falta es la oferta", () => {
  const { context } = sandbox({ stored: {} });
  const plan = context.debtConsolidationPlan();
  assert.equal(plan.available, false);
  assert.equal(plan.motivo, "sin-oferta");
  assert.equal(plan.principal, undefined, "un plan no disponible no trae cifras a medias");
});

test("V3-3 · con una sola deuda viva el motivo es la cartera, no la oferta", () => {
  // Reunificar una deuda consigo misma no es reunificar: el esquema exige dos identificadores como
  // mínimo. Decir «falta la oferta» aquí mandaría al usuario a teclear algo que no arreglaría nada.
  const { context } = sandbox({ contracts: [CONTRACTS[0]], stored: OFERTA });
  const plan = context.debtConsolidationPlan();
  assert.equal(plan.available, false);
  assert.equal(plan.motivo, "cartera");
});

test("V3-3 · una oferta a medias o fuera de los topes del esquema no se da por buena", () => {
  const casos = [
    // `{ plazo: 60 }` sin TIN es el caso que delató que `Number(null)` vale 0: sin el hueco
    // distinguido del cero, esto pasaría por una oferta al 0 % de interés que nadie ha ofrecido.
    { tin: 6 },
    { plazo: 60 },
    { tin: null, plazo: 60 },
    { tin: "", plazo: 60 },
    { tin: 61, plazo: 60 },
    { tin: -1, plazo: 60 },
    { tin: 6, plazo: 0 },
    { tin: 6, plazo: 481 },
    { tin: 6, plazo: 60.5 },
  ];
  casos.forEach((stored) => {
    const { context } = sandbox({ stored });
    assert.equal(context.debtConsolidationPlan().available, false, `${JSON.stringify(stored)} no debería valer`);
  });
});

test("V3-3 · la decisión que se manda al motor pasa el esquema canónico real", () => {
  const { context } = sandbox({ stored: OFERTA });
  const decisions = context.debtStrategyDecisions("consolidar");
  assert.equal(decisions.length, 1);
  const issues = [];
  // El esquema exige `titulo`, que las estrategias no ponen (el motor no lo necesita y la interfaz
  // lo reconstruye con `escenarioMotorDecisionTitle`). Se valida lo que sí es contrato del motor:
  // el tipo y sus params.
  schema.validateDecisionParams(decisions[0].tipo, decisions[0].params, "$.params", issues);
  assert.deepEqual(issues, [], JSON.stringify(issues));
});

test("V3-3 · el TIN viaja al motor en fracción, no en porcentaje", () => {
  // El esquema exige `nuevoTIN` entre 0 y 0,60. Mandar «6» en vez de «0,06» sería un 600 % anual
  // que el validador rechazaría, o peor, un cálculo cien veces mayor si algún día dejara de mirarlo.
  const { context } = sandbox({ stored: OFERTA });
  const { params } = context.debtStrategyDecisions("consolidar")[0];
  assert.equal(params.nuevoTIN, 0.06);
  assert.deepEqual(params.deudaIds, ["cetelem", "coche"]);
  assert.equal(params.nuevoPrincipal, 10000);
  assert.equal(params.nuevaCuota, 193.33);
  assert.equal(params.nuevoPlazo, 60);
  assert.equal(params.importe, undefined, "una reunificación no desembolsa un importe");
});

test("V3-3 · sin oferta la estrategia no propone decisiones en vez de proponer una a medias", () => {
  const { context } = sandbox({ stored: {} });
  assert.equal(context.debtStrategyDecisions("consolidar").length, 0);
});

test("V3-3 · la oferta se guarda en su propia clave y no toca el modelo del hogar", () => {
  // Una oferta de un tercero puede caducar o descartarse sin que la contabilidad se mueva: no es un
  // dato del hogar y no debe escribirse en `state`.
  const { context, storage } = sandbox({ stored: {} });
  context.saveDebtConsolidationOffer({ tin: 7.5, plazo: 96, comision: null });
  assert.equal(storage.get("deuda-oferta-reunificacion:test"), JSON.stringify({ tin: 7.5, plazo: 96, comision: null }));
  // Comparado campo a campo: el objeto nace dentro del `vm`, así que `deepEqual` estricto lo
  // rechazaría por venir de otro realm aunque su contenido fuese idéntico.
  assert.deepEqual({ ...context.debtConsolidationOffer() }, { tin: 7.5, plazo: 96, comision: null });
  assert.ok(
    !extractFunction("saveDebtConsolidationOffer").includes("state"),
    "guardar la oferta no puede escribir en el estado del hogar",
  );
});

test("V3-3 · una oferta corrupta en el almacén se lee como «sin oferta», no revienta la pantalla", () => {
  const { context, storage } = sandbox({ stored: {} });
  storage.set("deuda-oferta-reunificacion:test", "{no es json");
  assert.deepEqual({ ...context.debtConsolidationOffer() }, { tin: null, plazo: null, comision: null });
});

test("V3-3 · el coste que se compara son los intereses del préstamo nuevo, no cero", () => {
  // `params.importe` no existe en una reunificación: sumarlo daría 0 € y haría parecer que
  // consolidar es gratis, además de ganar cualquier empate por coste en la recomendación.
  const context = {
    Math,
    Number,
    Map,
    round2: (value) => Math.round((value + Number.EPSILON) * 100) / 100,
    escenarioMotorLibreDeDeuda: () => "2031-08",
    debtConsolidationPlan: () => ({ available: true, intereses: 1599.8 }),
    debtStrategyResult: () => ({
      decisions: [{ id: "deuda-estrategia-consolidar-0", tipo: "reunificacion", params: { nuevoPrincipal: 10000 } }],
      result: { valid: true, resultados: [{ id: "deuda-estrategia-consolidar-0", resultado: "aplicada" }], series: [{ totalLiquidity: 1200 }], debtStateFinal: [] },
    }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("debtStrategySummary"), context);
  const summary = context.debtStrategySummary("consolidar", { months: [] }, null);
  assert.equal(summary.costeTotal, 1599.8);
  assert.equal(summary.viable, true);
  assert.equal(summary.consolidacion.available, true);
});

test("V3-3 · si la reunificación no llega a aplicarse, no se le cuelga un coste", () => {
  const context = {
    Math,
    Number,
    Map,
    round2: (value) => Math.round((value + Number.EPSILON) * 100) / 100,
    escenarioMotorLibreDeDeuda: () => "2031-08",
    debtConsolidationPlan: () => ({ available: true, intereses: 1599.8 }),
    debtStrategyResult: () => ({
      decisions: [{ id: "deuda-estrategia-consolidar-0", tipo: "reunificacion", params: { nuevoPrincipal: 10000 } }],
      result: { valid: true, resultados: [{ id: "deuda-estrategia-consolidar-0", resultado: "guardarril-incumplido" }], series: [{ totalLiquidity: -200 }], debtStateFinal: [] },
    }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("debtStrategySummary"), context);
  const summary = context.debtStrategySummary("consolidar", { months: [] }, null);
  assert.equal(summary.costeTotal, 0);
  assert.equal(summary.viable, false);
});

test("V3-3 · la gráfica no enseña la deuda a cero el mes de la firma", () => {
  // Es la mentira que hace atractiva a una reunificación: cerrar cinco deudas parece saldarlas. El
  // préstamo nuevo tiene que entrar en la serie con su principal y quedarse hasta agotar el plazo.
  const context = { Math, Number, Map, Array, String, round2: (value) => Math.round((value + Number.EPSILON) * 100) / 100 };
  vm.createContext(context);
  vm.runInContext(extractFunction("buildDeudaVivaSeries"), context);

  const months = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"].map((monthKey) => ({ monthKey }));
  const decision = {
    id: "d1",
    tipo: "reunificacion",
    params: { deudaIds: ["cetelem", "coche"], nuevoPrincipal: 10000, nuevoPlazo: 3 },
  };
  const resultados = new Map([["d1", { resultado: "aplicada", mesResuelto: "2026-09" }]]);
  const serie = context.buildDeudaVivaSeries(months, CONTRACTS, [decision], resultados);

  assert.equal(serie[0].deudaViva, 9500, "antes de firmar, la deuda es la de siempre");
  assert.equal(serie[1].deudaViva, 10000, "el mes de la firma la deuda es la del préstamo nuevo, no cero");
  assert.equal(serie[3].deudaViva, 10000, "sigue viva mientras dure el plazo");
  assert.equal(serie[4].deudaViva, 0, "y se apaga cuando el plazo se agota");
});

test("V3-3 · la línea de tiempo no lee campos que una reunificación no tiene", () => {
  const render = extractFunction("renderDeudaRuta");
  assert.match(render, /const esReunificacion = decision\.tipo === "reunificacion";/);
  assert.match(render, /Reunificar \$\{\(decision\.params\.deudaIds \|\| \[\]\)\.length\} deudas/);
  const item = render.slice(render.indexOf("const esReunificacion"), render.indexOf("</li>`;"));
  assert.ok(
    !/debts\.get\(decision\.params\.deudaId\)(?!\s*;?\s*\n?\s*$)/.test(item.replace(/esReunificacion \? null : debts\.get\(decision\.params\.deudaId\)/, "")),
    "solo se busca el contrato cuando la decisión apunta a uno",
  );
});

test("V3-3 · «Consolidar» está en el catálogo, con su propia etiqueta de coste", () => {
  assert.match(app, /\{\s*id: "consolidar",\s*label: "Consolidar",/);
  assert.match(app, /costeLabel: "Intereses del nuevo préstamo",/);
  // Las otras tres conservan la etiqueta compartida: solo consolidar mide otra cosa.
  assert.match(app, /const DEBT_STRATEGY_COSTE_LABEL = "Coste total ejecutado";/);
  const catalogo = app.slice(app.indexOf("const DEBT_STRATEGY_DEFINITIONS"), app.indexOf("const DEBT_STRATEGY_COSTE_LABEL"));
  assert.ok(
    catalogo.indexOf('id: "bola-nieve"') < catalogo.indexOf('id: "consolidar"')
      && catalogo.indexOf('id: "consolidar"') < catalogo.indexOf('id: "no-tocar"'),
    "«No tocar nada» sigue cerrando la lista: es la referencia contra la que se comparan las demás",
  );
});

test("V3-3 · la pantalla pide la oferta y ya no dice que reunificar no se puede comparar", () => {
  assert.match(html, /id="deudaCompararOfferTin"/);
  assert.match(html, /id="deudaCompararOfferPlazo"/);
  assert.match(html, /id="deudaCompararOfferComision"/);
  assert.match(html, /id="deudaCompararOfferNote"/);
  assert.match(html, /<legend>Oferta de reunificación<\/legend>/);
  assert.ok(
    !html.includes("No se incluye «reunificación» como cuarta estrategia"),
    "la nota que declaraba imposible la comparación ya no es cierta",
  );
  // Y lo que la sustituye sigue diciendo qué NO está en la cifra, que es lo que hacía honesta a la
  // nota anterior.
  assert.match(html, /cancelación anticipada de las deudas viejas, notaría, seguros vinculados/);
});

test("V3-3 · las tres casillas están conectadas y se pueden borrar de una vez", () => {
  assert.match(app, /\["deudaCompararOfferTin", "deudaCompararOfferPlazo", "deudaCompararOfferComision"\]\.forEach\(\(id\) => \{\s*qs\(id\)\?\.addEventListener\("input", handleDeudaCompararOfferInput\);/);
  assert.match(app, /qs\("deudaCompararOfferClear"\)\?\.addEventListener\("click", handleDeudaCompararOfferClear\);/);
  assert.match(html, /id="deudaCompararOfferClear"/);
});

test("V3-3 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
