// SVD-0 (17/11/2026, bloque «Simulador visual de deuda conectado», docs/SVD_DISENO.md): pruebas que DESCRIBEN cómo se
// conecta hoy el simulador (debt-roadmap.html, en un iframe) con el resto de la app, antes de cambiarlo en SVD-1 a SVD-3.
// Cuando una de estas pruebas falle por un PR del bloque, es la señal buscada: se actualiza con lo nuevo, a propósito.
// Contratos INVENTADOS, nunca los del hogar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E14 = require("../canonical-e14-debt-adapter.js");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "debt-roadmap.html"), "utf8");
const app = codigoApp();

function forecast(months) {
  return {
    schemaId: "finance-canonical-forecast/v1",
    fingerprint: "svd0",
    valid: true,
    series: months.map(([monthKey, income, outflows, closing]) => ({ monthKey, totals: { income, outflowsBeforeSaving: outflows, closingLiquidity: closing } })),
  };
}

// Los campos que collect() guarda: los fijos de su lista y, por cada cuenta adicional, los de su bloque.
function camposQueGuardaElSimulador() {
  const fijos = JSON.parse(html.match(/function collect\(\)\{const ids=(\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const operativos = html.match(/const d=\{([^}]+)\}/)[1].split(",").map((par) => par.split(":")[0].trim());
  const porCuenta = JSON.parse(html.match(/dynamicDebtAccounts\.forEach\(\(account\)=>\{const key=accountKey\(account\.id\);(\[[^\]]+\])/)[1].replace(/'/g, '"'));
  return { fijos, operativos, porCuenta };
}

test("SVD-0 · las dos cuentas principales se enlazan por el NOMBRE de los contratos de ejemplo", () => {
  const contratos = [
    { id: "c1", entity: "Banco FICTICIO", type: "Tarjeta", currentPrincipal: 2400, apr: 21.9, currentPayment: 90, paymentStatus: "active" },
    { id: "c2", entity: "Caja FICTICIA", type: "Préstamo", currentPrincipal: 5100, apr: 9.5, currentPayment: 160, paymentStatus: "suspended" },
  ];
  const modelo = E14.buildReadModel({ contracts: contratos, forecast: forecast([["2026-12", 3000, 2500, 8000]]), generatedAt: "2026-11-17T00:00:00.000Z" });
  assert.equal(modelo.contracts.entityA, null, "sin un contrato llamado «Entidad A», la cuenta A del simulador no se enlaza");
  assert.equal(modelo.contracts.entityB, null);
  assert.ok(modelo.ambiguous.includes("cb_amount") && modelo.ambiguous.includes("bk_amount"));
  assert.equal(modelo.canonicalValues.cb_amount, undefined);
  // Los contratos reales entran como cuentas adicionales…
  assert.deepEqual(modelo.extraDebts.map((cuenta) => cuenta.entity), ["Banco FICTICIO", "Caja FICTICIA"]);
  // …pero solo con su capital: sin TAE, cuota, plazo ni atrasos (SVD-2 los añade).
  assert.deepEqual(Object.keys(modelo.extraDebts[0]).sort(), ["currentPrincipal", "entity", "id", "paymentStatus", "type"]);
});

test("SVD-0 · de la previsión solo llega una media de capacidad, no los meses", () => {
  const modelo = E14.buildReadModel({
    contracts: [],
    forecast: forecast([["2026-12", 3000, 3400, 7000], ["2027-01", 3000, 2000, 8000]]),
    generatedAt: "2026-11-17T00:00:00.000Z",
  });
  // Diciembre no deja capacidad (0) y enero deja 1.000: llega 500 para todos los meses, y ninguna serie.
  assert.equal(modelo.canonicalValues.monthly, 500);
  assert.equal(modelo.forecast.series, undefined);
  assert.equal(modelo.schemaId, "finance-e14-debt-roadmap-read-model/v1");
});

test("SVD-0 · inventario: qué guarda el simulador y qué no sabe clasificar su propio inventario", () => {
  const { fijos, operativos, porCuenta } = camposQueGuardaElSimulador();
  assert.deepEqual(operativos, ["tasks", "scenario", "agreement", "profile"]);
  assert.deepEqual(porCuenta, ["strategy", "discount", "start", "lump", "apr", "term", "finance_pct", "extra", "extra_month"]);
  const guardados = [...operativos, ...fijos, ...porCuenta.map((campo) => `acct_c1_${campo}`)];
  const sinClasificar = guardados.filter((campo) => E14.classifyField(campo) === "ambiguous");
  // La aportación extra (D1 fase 1) y todos los campos de las cuentas adicionales (D1 fase 2) quedaron fuera del
  // inventario: SVD-1 los clasifica. «profile» está en «assumption», por eso no sale.
  assert.deepEqual(sinClasificar, [
    "cb_extra", "cb_extra_month", "bk_extra", "bk_extra_month",
    ...porCuenta.map((campo) => `acct_c1_${campo}`),
  ]);
  // La TAE es un supuesto del simulador aunque su dueño sea Contratos (principio 1 de SVD): SVD-2 la lee de allí.
  assert.equal(E14.classifyField("cb_apr"), "assumption");
  // El importe no se guarda desde el simulador: es canónico y llega de la app.
  assert.equal(guardados.includes("cb_amount"), false);
});

test("SVD-0 · el simulador guarda además su propia copia en el localStorage del iframe", () => {
  assert.match(html, /function autoSave\(\)\{try\{localStorage\.setItem\('planDeudaV5SinEntidad C'/);
  assert.doesNotMatch(html.match(/function autoSave\(\)\{[^}]*\}/)[0], /window\.parent/, "hoy no distingue si está dentro de la app (SVD-1 deja una sola copia)");
});

test("SVD-0 · la app hidrata el simulador al cargar y en cada recálculo, con el estado y el modelo canónico", () => {
  assert.match(app, /type: "finance-debt-roadmap-hydrate",\s*payload: \{ state: debtRoadmapState, canonical: debtRoadmapCanonicalReadModel\(\) \}/);
  const llamadas = app.match(/sendDebtRoadmapState\(\);/g) || [];
  assert.ok(llamadas.length >= 3, "al cargar el iframe, cuando avisa que está listo y tras recalcular");
});

test("SVD-0 · aplicar una oferta del simulador crea una decisión en el plan pero no toca el contrato", () => {
  const cuerpo = app.slice(app.indexOf("async function applyE14bOffer()"), app.indexOf("function refreshCanonicalSnapshot("));
  assert.match(cuerpo, /applyDebtDecision\(decision\)/);
  assert.match(cuerpo, /requestOperationConfirmation\(/, "pasa por confirmación");
  for (const almacen of ["debtContractOverrides", "debtContractCustomEntries"]) {
    assert.doesNotMatch(cuerpo, new RegExp(almacen), `no escribe en ${almacen}: Contratos sigue igual tras pactar (SVD-3 lo cambia)`);
  }
});
