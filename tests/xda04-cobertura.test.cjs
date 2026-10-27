const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cov = require("../canonical-ledger-coverage.js");
const expected = require("../canonical-expected-movements.js");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// XDA-04 · PR-1: cobertura del libro por cuenta (canonical-ledger-coverage.js), su registro al importar (cobertura-ui.js),
// las preguntas de «¿ha llegado…?» (WP-27) y el aviso del cierre.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const R = (account, from, to, source = "declarado") => ({ account, from, to, source });

test("rangos de una cuenta: se ordenan y se unen también los contiguos; las otras cuentas no cuentan", () => {
  const ranges = [R("CaixaBank", "2026-10-11", "2026-10-20"), R("CaixaBank", "2026-10-01", "2026-10-10"), R("Mediolanum", "2026-10-01", "2026-10-31"), R("CaixaBank", "2026-10-25", "2026-10-31")];
  assert.deepEqual(cov.merged(ranges, "CaixaBank").map(({ from, to }) => [from, to]), [["2026-10-01", "2026-10-20"], ["2026-10-25", "2026-10-31"]]);
  assert.equal(cov.covers(ranges, "CaixaBank", "2026-10-05", "2026-10-18"), true);
  assert.equal(cov.covers(ranges, "CaixaBank", "2026-10-19", "2026-10-26"), false, "un hueco en medio no es visto");
  assert.equal(cov.covers(ranges, "Mediolanum", "2026-10-21"), true);
  assert.equal(cov.covers(ranges, "Efectivo", "2026-10-21"), false);
});

test("huecos: los periodos sin cubrir dentro de una ventana", () => {
  const ranges = [R("CaixaBank", "2026-10-01", "2026-10-10"), R("CaixaBank", "2026-10-20", "2026-10-24")];
  assert.deepEqual(cov.gaps(ranges, "CaixaBank", "2026-10-01", "2026-10-31"), [{ from: "2026-10-11", to: "2026-10-19" }, { from: "2026-10-25", to: "2026-10-31" }]);
  assert.deepEqual(cov.gaps(ranges, "CaixaBank", "2026-10-02", "2026-10-09"), []);
  assert.deepEqual(cov.gaps([], "CaixaBank", "2026-10-01", "2026-10-03"), [{ from: "2026-10-01", to: "2026-10-03" }]);
});

test("un mes: entero, con huecos o sin nada; el mes en curso solo hasta hoy; febrero y diciembre bien", () => {
  const ranges = [R("CaixaBank", "2026-10-01", "2026-10-31"), R("Mediolanum", "2026-10-10", "2026-10-31")];
  assert.equal(cov.month(ranges, "CaixaBank", "2026-10", "2026-11-02").complete, true);
  const med = cov.month(ranges, "Mediolanum", "2026-10", "2026-11-02");
  assert.deepEqual(med.gaps, [{ from: "2026-10-01", to: "2026-10-09" }]);
  assert.equal(cov.month([], "Mediolanum", "2026-10", "2026-11-02").nothing, true);
  assert.equal(cov.month(ranges, "CaixaBank", "2026-11", "2026-11-05").to, "2026-11-05");
  assert.equal(cov.month([], "CaixaBank", "2027-02", "2027-06-01").to, "2027-02-28");
  assert.equal(cov.month([], "CaixaBank", "2026-12", "2027-06-01").to, "2026-12-31");
  assert.equal(cov.month([R("CaixaBank", "2026-09-01", "2026-12-31", "estimado")], "CaixaBank", "2026-10", "2026-11-02").estimado, true);
});

test("deducir de los movimientos y estimar lo anterior al registro (por cuenta)", () => {
  assert.deepEqual(cov.deduce([{ date: "2026-10-12" }, { date: "2026-10-03" }, { date: "x" }]), { from: "2026-10-03", to: "2026-10-12" });
  assert.equal(cov.deduce([]), null);
  const est = cov.estimateFromLedger([{ date: "2026-01-05", account: "Mediolanum" }, { date: "2026-03-01" }, { date: "2026-01-02" }], (row) => row.account || "CaixaBank");
  assert.deepEqual(est.map((r) => [r.account, r.from, r.to, r.source]), [["Mediolanum", "2026-01-05", "2026-01-05", "estimado"], ["CaixaBank", "2026-01-02", "2026-03-01", "estimado"]]);
});

test("el almacén: lectura tolerante, sin duplicados y sin importes ni conceptos", () => {
  assert.deepEqual(cov.normalizeStore("basura"), { version: 1, ranges: [] });
  assert.deepEqual(cov.normalizeStore({ ranges: [{ account: "", from: "2026-10-01", to: "2026-10-02" }, { account: "X", from: "2026-10-05", to: "2026-10-01" }] }).ranges, []);
  let s = cov.addRange({}, { ...R("CaixaBank", "2026-10-01", "2026-10-24"), amount: 99, concept: "NOMINA" });
  s = cov.addRange(s, R("CaixaBank", "2026-10-01", "2026-10-24"));
  assert.equal(s.ranges.length, 1);
  assert.deepEqual(Object.keys(s.ranges[0]).sort(), ["account", "from", "source", "to"]);
});

test("WP-27: un cargo solo se da por no llegado si se ha visto entero su periodo; un hueco lo calla", () => {
  const base = { today: "2026-10-26", expectations: [{ id: "luz|2026-10", kind: "expense", seriesKey: "luz", label: "Luz", month: "2026-10", expectedDate: "2026-10-12", certain: true, plannedAmount: 80 }] };
  // Antes: con la fecha global, el 24 «cubría» el día 12 aunque hubiera un hueco.
  assert.equal(expected.detect({ ...base, ledgerCoveredUntil: "2026-10-24" }).items.length, 1);
  // Ahora: del 1 al 10 y del 20 al 24 → el periodo del cargo cae en el hueco: no se pregunta.
  const conHueco = expected.detect({ ...base, ledgerCoveredUntil: "2026-10-24", coveredRanges: [{ from: "2026-10-01", to: "2026-10-10" }, { from: "2026-10-20", to: "2026-10-24" }] });
  assert.equal(conHueco.items.length, 0);
  assert.equal(conHueco.silent.unverifiable, 1);
  // Entero visto → se pregunta.
  assert.equal(expected.detect({ ...base, coveredRanges: [{ from: "2026-10-01", to: "2026-10-24" }] }).items.length, 1);
  // Sin rangos (null), como antes.
  assert.equal(expected.detect({ ...base, ledgerCoveredUntil: "2026-10-24", coveredRanges: null }).items.length, 1);
});

test("cableado: se guarda dentro del lote, viaja en la copia, se pregunta en la revisión y avisa en el cierre", () => {
  const app = codigoApp(); // el asistente de importar vive en importar-extracto-ui.js desde XGO-01 · PR-3
  const apply = app.slice(app.indexOf("const balance = applyDatosImportarBalanceOffer(session);"), app.indexOf("const afterState = appStatePayload({ includeCanonical: false });", app.indexOf("const balance = applyDatosImportarBalanceOffer(session);")));
  assert.match(apply, /globalThis\.FinanceCobertura\?\.registrar\(session, incoming\);/, "antes de la foto del lote: «Deshacer» lo devuelve");
  assert.match(app, /^ {2}"ledger-coverage", \/\/ XDA-04/m);
  const ui = read("cobertura-ui.js");
  assert.match(ui, /source: session\.fileMeta\?\.coberturaVista \? "declarado" : "deducido"/);
  assert.match(ui, /new Set\(\["manual-quick-capture"\]\)/, "una anotación a mano no cubre un día");
  assert.match(ui, /no puede empezar después/);
  assert.match(ui, /function coberturaAsegurar\(\) \{\n\s+if \(typeof storageGet !== "function" \|\| storageGet\(storageKey\(COBERTURA_STORE\), ""\) !== ""\) return;/, "el almacén existe antes del lote: «Deshacer» lo devuelve vacío");
  assert.match(app, /if \(!file\) return;\n\s+globalThis\.FinanceCobertura\?\.asegurar\(\);/, "se crea al cargar el fichero, no al mirar");
  assert.equal((ui.match(/coberturaAsegurar\(\)/g) || []).length, 1, "solo se define: leer no escribe");
  assert.match(ui, /no puede acabar antes/);
  assert.match(read("views/importar-v2.js"), /globalThis\.FinanceCobertura\?\.revisionHtml\?\.\(session\)/);
  assert.match(read("views/importar-v2.js"), /event\.target\.id === "importarV2CubreDesde" \|\| event\.target\.id === "importarV2CubreHasta"/);
  assert.match(read("esperados-ui.js"), /coveredRanges: expectedLedgerCoveredRanges\(\)/);
  const cierre = read("views/cierre.js");
  assert.match(cierre, /globalThis\.FinanceCobertura\?\.avisoCierreHtml\?\.\(currentMonthKey, window\.FinanceCanonicalLedgerCoverage\)/);
  assert.doesNotMatch(cierre.slice(cierre.indexOf("function cierreFirmChecks("), cierre.indexOf("function cierreFirmChecksHtml(")), /Cobertura|cobertura/, "no es una comprobación que bloquee la firma");
  const html = read("index.html");
  assert.ok(html.indexOf("canonical-ledger-coverage.js") < html.indexOf('src="app.js'));
  assert.ok(html.indexOf("cobertura-ui.js") < html.indexOf('src="app.js'));
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"canonical-ledger-coverage\.js",$/m);
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"cobertura-ui\.js",$/m);
  assert.match(read("service-worker.js"), /"\.\/cobertura-ui\.js",/);
});
