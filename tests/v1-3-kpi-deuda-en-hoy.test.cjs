const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const styles = read("styles.css");
const worker = read("service-worker.js");
const html = read("index.html");

// Mismo truco que en `tests/v6-reserva-operativa.test.cjs`: `app.js` es un script de navegador y no
// se puede `require`, así que se extraen las funciones por nombre balanceando llaves y se ejecutan
// contra dobles de las piezas que consultan.
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

const CONTRACTS = [
  { id: "a", currentPrincipal: 6000, paymentStatus: "active" },
  { id: "b", currentPrincipal: 3500, paymentStatus: "active" },
];

// Contexto mínimo: `homeDebtOutlook` solo necesita la firma del modelo, el catálogo de contratos
// del motor, la entrada base y el resumen de la estrategia. Los dobles cuentan sus llamadas para
// poder comprobar que la caché evita rehacer el trabajo.
function sandbox({ contracts = CONTRACTS, libreDeDeuda = "2029-04", signature = "firma-1" } = {}) {
  const calls = { summary: 0, options: 0 };
  const context = {
    simulationSignature: signature,
    homeDebtOutlookCache: { key: "", value: null },
    modelComputationSignature: () => signature,
    escenarioMotorDebtOptions: () => {
      calls.options += 1;
      return contracts;
    },
    escenarioMotorBaseInput: () => ({ months: 120 }),
    debtStrategyReserveDefault: () => 1500,
    debtStrategySummary: (id, baseInput, reserve) => {
      calls.summary += 1;
      calls.lastStrategy = id;
      calls.lastReserve = reserve;
      return { libreDeDeuda };
    },
    escenarioMotorMonthLabel: (value) => (value ? `etiqueta:${value}` : "—"),
    round2: (value) => Math.round(value * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("homeDebtOutlook"), context);
  return { context, calls };
}

test("V1-3 · «Deuda pendiente» suma el capital vivo de los contratos que el motor considera", () => {
  const { context } = sandbox();
  const outlook = context.homeDebtOutlook();
  assert.equal(outlook.pendingPrincipal, 9500);
  assert.equal(outlook.contracts, 2);
});

test("V1-3 · «Libre de deuda» usa «No tocar nada», no la estrategia recomendada", () => {
  // Hoy es de solo lectura: enseñar la fecha de la estrategia recomendada insinuaría una decisión
  // que el usuario no ha tomado. La fecha que se muestra es la de seguir el calendario actual.
  const { context, calls } = sandbox();
  context.homeDebtOutlook();
  assert.equal(calls.lastStrategy, "no-tocar");
});

test("V1-3 · la reserva que se pasa es la del hogar, no la casilla del comparador", () => {
  // `debtStrategyReserveValue` guarda lo que el usuario haya escrito en `#deuda-comparar` para esa
  // comparación. Si Hoy lo leyera, una pantalla movería el número de otra sin querer.
  const { context, calls } = sandbox();
  context.homeDebtOutlook();
  assert.equal(calls.lastReserve, 1500);
  assert.ok(
    !extractFunction("homeDebtOutlook").includes("debtStrategyReserveValue"),
    "homeDebtOutlook no debe leer el valor de la casilla del comparador",
  );
});

test("V1-3 · una fecha real se marca estimable y una no estimable no", () => {
  const conFecha = sandbox({ libreDeDeuda: "2029-04" }).context.homeDebtOutlook();
  assert.equal(conFecha.estimable, true);
  assert.equal(conFecha.settled, false);
  assert.equal(conFecha.libreDeDeudaLabel, "etiqueta:2029-04");

  const fuera = sandbox({ libreDeDeuda: "fuera de horizonte" }).context.homeDebtOutlook();
  assert.equal(fuera.estimable, false);
  assert.equal(fuera.settled, false);

  const sinCuota = sandbox({ libreDeDeuda: "sin fecha estimable · sin cuota activa" }).context.homeDebtOutlook();
  assert.equal(sinCuota.estimable, false);
  assert.equal(sinCuota.settled, false);
});

test("V1-3 · sin deuda viva se distingue de «no se puede estimar»", () => {
  const { context } = sandbox({ contracts: [], libreDeDeuda: "sin deuda pendiente" });
  const outlook = context.homeDebtOutlook();
  assert.equal(outlook.settled, true);
  assert.equal(outlook.pendingPrincipal, 0);
  assert.equal(outlook.contracts, 0);
});

test("V1-3 · el resultado se cachea por firma: Hoy no relanza el motor en cada render", () => {
  const { context, calls } = sandbox();
  context.homeDebtOutlook();
  context.homeDebtOutlook();
  context.homeDebtOutlook();
  assert.equal(calls.summary, 1, "el motor se ejecuta una sola vez mientras no cambie el modelo");

  // Al cambiar la firma del modelo, la cifra se recalcula: la caché no puede sobrevivir a un cambio
  // de datos.
  context.simulationSignature = "firma-2";
  context.homeDebtOutlook();
  assert.equal(calls.summary, 2);
});

test("V1-3 · la caché se limpia al recomputar el modelo, como las otras dos", () => {
  const recompute = extractFunction("recomputeModelIfNeeded");
  assert.match(recompute, /homeDebtOutlookCache = \{ key: "", value: null \}/);
  assert.match(app, /let homeDebtOutlookCache = \{ key: "", value: null \};/);
});

test("V1-3 · los dos KPI están en Hoy, con su nota y su salida hacia las vistas nuevas", () => {
  const render = extractFunction("renderHomeDashboard");
  assert.match(render, /label: "Deuda pendiente"/);
  assert.match(render, /label: "Libre de deuda"/);
  // Los dos KPI nuevos salen hacia las pantallas nuevas de la vista Deuda (`#deuda-ruta` y
  // `#deuda-comparar`), no hacia `#debt-control` ni `#debt-roadmap`, que son las heredadas.
  //
  // Nota deliberada de alcance: otras tarjetas de Hoy —«Ver saldos» y «Ver flujo»— siguen saliendo
  // hacia `#visual-detail` y `#cashflow`, que V2-8 relegó. No es un descuido ni algo que arregle
  // V1-3: hoy no existe pantalla nueva que enseñe lo que esas dos enseñan, y repuntarlas a
  // `#cuadro-mandos` mandaría al usuario a algo que no es lo que promete el botón. Relegar nunca
  // fue desconectar. Lo resuelve T-1, cuando la navegación de seis vistas decida qué enseña cada
  // sitio; mientras tanto conviene que quede escrito y no que se descubra por sorpresa.
  const nuevos = render.slice(render.indexOf('label: "Deuda pendiente"'), render.indexOf('label: "Capacidad libre real"'));
  assert.match(nuevos, /target: "deuda-ruta"/);
  assert.match(nuevos, /target: "deuda-comparar"/);
  assert.ok(!/target: "debt-(control|roadmap)"/.test(nuevos), "los KPI nuevos no envían a una heredada");
  // Y el orden es el del rediseño: liquidez, deuda pendiente y libre de deuda antes que el resto.
  assert.ok(
    render.indexOf('label: "Liquidez hoy"') <
      render.indexOf('label: "Deuda pendiente"') &&
      render.indexOf('label: "Deuda pendiente"') < render.indexOf('label: "Libre de deuda"') &&
      render.indexOf('label: "Libre de deuda"') < render.indexOf('label: "Capacidad libre real"'),
    "los tres KPI del rediseño abren la rejilla",
  );
});

test("V1-3 · la rejilla de Hoy pasa a tres columnas para que las seis tarjetas cuadren", () => {
  assert.match(styles, /\.home-kpi-grid \{\s*display: grid;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(html, /<div class="home-kpi-grid" id="homeKpis"><\/div>/);
});

test("V1-3 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
