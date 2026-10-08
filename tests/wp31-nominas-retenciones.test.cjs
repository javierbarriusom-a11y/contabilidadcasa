const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = require(path.join(root, "canonical-payroll.js"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const TODAY = "2026-10-08";
const slip = (overrides = {}) => ({
  holder: "persona-a", period: "2026-09", payer: "Empresa Ejemplo", kind: "ordinaria",
  gross: 2100, net: 1644.93, withholdingPct: 15.32, withholdingAmount: 321.72, ...overrides,
});
const add = (store, input) => engine.addEntry(store, input, TODAY);
const EMPTY = engine.normalizeStore({});

// WP-31 (CAP-05 + NPV-11), PR-1: las nóminas del hogar (tecleadas o leídas de su texto), las retenciones acumuladas del año para el estimador de Renta y el
// aviso de cambio del %. Todas las nóminas de estas pruebas son INVENTADAS; las reales las introduce el hogar y no van al repositorio.

test("WP-31 · parseAmount: formato español de importes y rechazo de lo que no es un importe", () => {
  assert.equal(engine.parseAmount("1.644,93"), 1644.93);
  assert.equal(engine.parseAmount("1644,93"), 1644.93);
  assert.equal(engine.parseAmount("1644.93"), 1644.93);
  assert.equal(engine.parseAmount("2.100"), 2100, "punto + tres cifras = miles");
  assert.equal(engine.parseAmount("15,32"), 15.32);
  assert.equal(engine.parseAmount(" 321,72 € "), 321.72);
  assert.equal(engine.parseAmount("−12,5"), -12.5);
  assert.equal(engine.parseAmount(1500.5), 1500.5);
  for (const bad of ["", "abc", "1,2,3", "12 34", "1.2.3", null, undefined, NaN]) assert.equal(engine.parseAmount(bad), null, String(bad));
});

test("WP-31 · una nómina válida entra, con su retención en euros leída o derivada del % (y marcada como derivada)", () => {
  const ok = add(EMPTY, slip());
  assert.equal(ok.ok, true);
  assert.equal(ok.store.entries.length, 1);
  assert.equal(ok.store.entries[0].derived, false);
  const derived = add(EMPTY, slip({ withholdingAmount: "" }));
  assert.equal(derived.ok, true);
  assert.equal(derived.store.entries[0].withholdingAmount, 321.72, "2.100 × 15,32 %");
  assert.equal(derived.store.entries[0].derived, true);
  const onlyAmount = add(EMPTY, slip({ withholdingPct: "" }));
  assert.equal(onlyAmount.ok, true);
  assert.equal(onlyAmount.store.entries[0].withholdingPct, 15.32);
  assert.equal(onlyAmount.store.entries[0].derived, true);
});

test("WP-31 · sin retención no hay nómina que valga (dato ausente no es cero); un 0 escrito sí se acepta", () => {
  const none = add(EMPTY, slip({ withholdingPct: "", withholdingAmount: "" }));
  assert.equal(none.ok, false);
  assert.match(none.errors.join(" "), /retenci[oó]n/i);
  const zero = add(EMPTY, slip({ withholdingPct: "0", withholdingAmount: "0" }));
  assert.equal(zero.ok, true, "una retención de 0 declarada es un dato");
});

test("WP-31 · validaciones: periodo, importes, líquido ≤ bruto, % razonable, futuro y titular", () => {
  const bad = (overrides, pattern) => {
    const result = add(EMPTY, slip(overrides));
    assert.equal(result.ok, false, JSON.stringify(overrides));
    assert.match(result.errors.join(" "), pattern);
    assert.equal(result.store.entries.length, 0);
  };
  bad({ period: "2026-13" }, /periodo/i);
  bad({ period: "septiembre" }, /periodo/i);
  bad({ period: "2026-12" }, /futur/i);
  bad({ gross: "" }, /bruto/i);
  bad({ gross: "0" }, /bruto/i);
  bad({ net: "" }, /l[ií]quido/i);
  bad({ net: 2500 }, /l[ií]quido.*bruto|bruto.*l[ií]quido/i);
  bad({ withholdingPct: 75, withholdingAmount: "" }, /%/);
  bad({ withholdingAmount: 5000, withholdingPct: "" }, /retenci[oó]n/i);
  bad({ holder: "" }, /titular/i);
  bad({ kind: "otra" }, /tipo/i);
  assert.equal(add(EMPTY, slip({ period: "2026-10" })).ok, true, "el mes en curso sí entra (se cobra a final de mes)");
  assert.equal(add(EMPTY, slip({ period: "2026-11" })).ok, false, "el mes que viene, no");
});

test("WP-31 · si la retención en euros no es el % sobre el bruto, entra pero avisa (puede haber conceptos exentos o en especie)", () => {
  const result = add(EMPTY, slip({ withholdingAmount: 250 }));
  assert.equal(result.ok, true);
  assert.match(result.warnings.join(" "), /no coincide|no es el/i);
  assert.equal(add(EMPTY, slip()).warnings.length, 0);
});

test("WP-31 · una nómina del mismo titular, pagador, mes y tipo sustituye a la anterior; una extra del mismo mes es otra", () => {
  let store = add(EMPTY, slip()).store;
  const replaced = add(store, slip({ gross: 2200, net: 1700, withholdingAmount: "" }));
  assert.equal(replaced.replaced, true);
  assert.equal(replaced.store.entries.length, 1);
  assert.equal(replaced.store.entries[0].gross, 2200);
  const extra = add(store, slip({ kind: "extra", gross: 2100, net: 1650, withholdingPct: 20, withholdingAmount: "" }));
  assert.equal(extra.replaced, false);
  assert.equal(extra.store.entries.length, 2);
  const other = add(store, slip({ holder: "persona-b" }));
  assert.equal(other.store.entries.length, 2);
  assert.equal(engine.removeEntry(extra.store, extra.store.entries[0].id).entries.length, 1);
});

test("WP-31 · el almacén se normaliza (descarta lo roto) y no muta lo recibido", () => {
  const raw = { entries: [slip({ id: "x" }), { holder: "", period: "2026-01" }, null, slip({ period: "mal" }), slip({ gross: -1 })] };
  const snapshot = JSON.stringify(raw);
  const clean = engine.normalizeStore(raw);
  assert.equal(clean.entries.length, 1);
  assert.equal(JSON.stringify(raw), snapshot);
  assert.deepEqual(engine.normalizeStore(undefined).entries, []);
});

function year(holder, months, overrides = {}) {
  let store = EMPTY;
  for (const month of months) {
    const result = engine.addEntry(store, slip({ holder, period: `2026-${String(month).padStart(2, "0")}`, ...overrides }), TODAY);
    assert.equal(result.ok, true, result.errors.join(" "));
    store = result.store;
  }
  return store;
}

test("WP-31 · las retenciones acumuladas del año salen de lo registrado, por titular, con el % efectivo", () => {
  const store = year("persona-a", [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const summary = engine.summarize(store, { year: 2026, today: TODAY });
  assert.equal(summary.holders.length, 1);
  const a = summary.holders[0];
  assert.equal(a.holder, "persona-a");
  assert.equal(a.entries, 9);
  assert.equal(a.gross, 18900);
  assert.equal(a.withheld, 2895.48, "9 × 321,72");
  assert.equal(a.effectivePct, 15.32);
  assert.equal(a.complete, true);
  assert.deepEqual(a.missingMonths, []);
  assert.equal(a.latestOrdinary.period, "2026-09");
});

test("WP-31 · los meses sin nómina se dicen: el acumulado de un año con huecos no se presenta como completo", () => {
  const gap = engine.summarize(year("persona-a", [1, 2, 4, 5]), { year: 2026, today: TODAY }).holders[0];
  assert.deepEqual(gap.missingMonths, ["2026-03"]);
  assert.equal(gap.complete, false);
  const late = engine.summarize(year("persona-a", [3, 4]), { year: 2026, today: TODAY }).holders[0];
  assert.deepEqual(late.missingMonths, ["2026-01", "2026-02"], "antes de la primera nómina del año también faltan");
  const pastYear = engine.summarize(year("persona-a", [1, 2, 3, 4, 5, 6, 7, 8, 9]), { year: 2026, today: "2027-02-01" }).holders[0];
  assert.deepEqual(pastYear.missingMonths, ["2026-10", "2026-11", "2026-12"], "un año ya cerrado se espera entero");
});

test("WP-31 · una paga extra suma retenciones pero no cuenta como mes cubierto ni como último % ordinario", () => {
  let store = year("persona-a", [1, 2, 3]);
  store = engine.addEntry(store, slip({ period: "2026-03", kind: "extra", gross: 2100, net: 1500, withholdingPct: 25, withholdingAmount: "" }), TODAY).store;
  const a = engine.summarize(store, { year: 2026, today: TODAY }).holders[0];
  assert.equal(a.entries, 4);
  assert.equal(a.withheld, 1490.16, "3 × 321,72 + 525 de la extra");
  assert.equal(a.latestOrdinary.withholdingPct, 15.32);
  assert.deepEqual(a.missingMonths, []);
});

test("WP-31 · dos titulares se resumen por separado y los años no se mezclan", () => {
  let store = year("persona-a", [1, 2]);
  store = engine.addEntry(store, slip({ holder: "persona-b", period: "2026-01", gross: 1500, net: 1200, withholdingPct: 10, withholdingAmount: "" }), TODAY).store;
  store = engine.addEntry(store, slip({ period: "2025-12" }), TODAY).store;
  const summary = engine.summarize(store, { year: 2026, today: TODAY });
  assert.deepEqual(summary.holders.map((h) => [h.holder, h.entries, h.withheld]), [["persona-a", 2, 643.44], ["persona-b", 1, 150]]);
  assert.deepEqual(engine.summarize(store, { year: 2025, today: TODAY }).holders.map((h) => [h.holder, h.entries]), [["persona-a", 1]]);
  assert.deepEqual(engine.yearsWithData(store), [2026, 2025]);
});

test("WP-31 · aviso si cambia el %: solo entre nóminas ordinarias seguidas del mismo pagador y a partir de medio punto", () => {
  const store = year("persona-a", [1, 2, 3]);
  assert.deepEqual(engine.changeAlerts(store), []);
  const dropped = engine.addEntry(store, slip({ period: "2026-04", gross: 2100, net: 1700, withholdingPct: 13.1, withholdingAmount: "" }), TODAY).store;
  const alerts = engine.changeAlerts(dropped);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].direction, "baja");
  assert.equal(alerts[0].from.pct, 15.32);
  assert.equal(alerts[0].to.pct, 13.1);
  assert.equal(alerts[0].to.period, "2026-04");
  assert.match(engine.alertText(alerts[0]), /baj[oó] del 15,32 % al 13,1 %/);
  const rose = engine.addEntry(store, slip({ period: "2026-04", withholdingPct: 17, withholdingAmount: "" }), TODAY).store;
  assert.equal(engine.changeAlerts(rose)[0].direction, "sube");
  const small = engine.addEntry(store, slip({ period: "2026-04", withholdingPct: 15.6, withholdingAmount: "" }), TODAY).store;
  assert.deepEqual(engine.changeAlerts(small), [], "0,28 puntos no es un cambio");
  const extraOnly = engine.addEntry(store, slip({ period: "2026-04", kind: "extra", withholdingPct: 30, withholdingAmount: "" }), TODAY).store;
  assert.deepEqual(engine.changeAlerts(extraOnly), [], "una paga extra tributa a otro tipo: no es un cambio");
  const otherPayer = engine.addEntry(store, slip({ period: "2026-04", payer: "Otra empresa", withholdingPct: 8, withholdingAmount: "" }), TODAY).store;
  assert.deepEqual(engine.changeAlerts(otherPayer), [], "otro pagador no se compara con el anterior");
  const crossYear = engine.addEntry(engine.addEntry(EMPTY, slip({ period: "2025-12" }), TODAY).store, slip({ period: "2026-01", withholdingPct: 12, withholdingAmount: "" }), TODAY).store;
  assert.equal(engine.changeAlerts(crossYear).length, 1, "el cambio de enero cuenta aunque venga de diciembre");
});

// ---- lectura del texto de una nómina (el PDF, cuando exista, solo aporta el texto) ----

const TEXT_A = `EMPRESA EJEMPLO S.L.
NÓMINA
Periodo: 01/09/2026 a 30/09/2026
Salario base            1.800,00
Plus convenio             300,00
TOTAL DEVENGADO         2.100,00
Contingencias comunes     98,70
Desempleo                 32,55
Formación profesional      2,10
IRPF 15,32 %             321,72
TOTAL A DEDUCIR          455,07
LÍQUIDO A PERCIBIR     1.644,93`;

const TEXT_B = `Mes de devengo: SEPTIEMBRE 2026
Total devengos
2.450,50
Base IRPF
2.450,50
Tipo IRPF
14,00 %
Retención IRPF
343,07
Total aportaciones del trabajador
155,60
Líquido total a percibir
1.951,83`;

const TEXT_C = `PAGA EXTRA DE JULIO
Mes: 07/2026
TOTAL DEVENGADO 2.100,00
IRPF 21,00 % 441,00
LÍQUIDO A PERCIBIR 1.600,00`;

test("WP-31 · lee una nómina en línea (etiqueta e importe juntos)", () => {
  const result = engine.extractFromText(TEXT_A);
  assert.deepEqual(result.fields, { period: "2026-09", gross: 2100, net: 1644.93, withholdingPct: 15.32, withholdingAmount: 321.72, socialSecurity: null, kind: "ordinaria" });
  assert.deepEqual(result.missing, ["socialSecurity"]);
});

test("WP-31 · lee una nómina en columnas (etiqueta arriba, importe debajo) y no confunde la base del IRPF con la retención", () => {
  const result = engine.extractFromText(TEXT_B);
  assert.deepEqual(result.fields, { period: "2026-09", gross: 2450.5, net: 1951.83, withholdingPct: 14, withholdingAmount: 343.07, socialSecurity: 155.6, kind: "ordinaria" });
  assert.deepEqual(result.missing, []);
});

test("WP-31 · reconoce una paga extra y su mes en formato MM/AAAA", () => {
  const result = engine.extractFromText(TEXT_C);
  assert.equal(result.fields.kind, "extra");
  assert.equal(result.fields.period, "2026-07");
  assert.equal(result.fields.withholdingPct, 21);
  assert.equal(result.fields.withholdingAmount, 441);
});

test("WP-31 · lo que no encuentra queda vacío y se dice; nunca 0 ni un dato inventado", () => {
  const result = engine.extractFromText("Periodo: 01/09/2026 a 30/09/2026\nTOTAL DEVENGADO 2.100,00");
  assert.equal(result.fields.gross, 2100);
  assert.equal(result.fields.net, null);
  assert.equal(result.fields.withholdingPct, null);
  assert.equal(result.fields.withholdingAmount, null);
  assert.ok(result.missing.includes("net") && result.missing.includes("withholdingPct"));
  const nothing = engine.extractFromText("hola, esto no es una nómina 12345678Z ES12 3456 7890 1234 5678 9012");
  assert.ok(Object.entries(nothing.fields).every(([key, value]) => value === null || key === "kind"), JSON.stringify(nothing.fields));
  assert.deepEqual(engine.extractFromText("").fields.gross, null);
  assert.deepEqual(engine.extractFromText(null).missing.length > 0, true);
});

test("WP-31 · lo leído no incluye nada personal: solo periodo e importes", () => {
  const text = `${TEXT_A}\nNIF 12345678Z  N.º afiliación SS 28/1234567/89\nIBAN ES91 2100 0418 4502 0005 1332`;
  const result = engine.extractFromText(text);
  assert.deepEqual(Object.keys(result.fields).sort(), ["gross", "kind", "net", "period", "socialSecurity", "withholdingAmount", "withholdingPct"]);
  assert.doesNotMatch(JSON.stringify(result), /12345678Z|28\/1234567|ES91|2100 0418/);
});

test("WP-31 · si lo leído no cuadra (líquido mayor que bruto, retención absurda) se descarta con un aviso", () => {
  const result = engine.extractFromText("Periodo: 01/09/2026 a 30/09/2026\nTOTAL DEVENGADO 1.000,00\nIRPF 15,00 % 150,00\nLÍQUIDO A PERCIBIR 9.000,00");
  assert.equal(result.fields.net, null);
  assert.match(result.warnings.join(" "), /l[ií]quido/i);
});

test("WP-31 · el motor es puro (sin red, sin DOM, sin almacenamiento) y no guarda ningún texto", () => {
  assert.doesNotMatch(read("canonical-payroll.js"), /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\/|document\.|window\.|localStorage/);
  const store = add(EMPTY, slip()).store;
  assert.doesNotMatch(JSON.stringify(store), /Periodo|DEVENGADO/i);
});

test("WP-31 · «prorrata de pagas extra» en una nómina mensual no la convierte en paga extra", () => {
  const text = `${TEXT_A}\nProrrata pagas extra   350,00`;
  assert.equal(engine.extractFromText(text).fields.kind, "ordinaria");
  assert.equal(engine.extractFromText("PAGA EXTRA DE NAVIDAD\nTOTAL DEVENGADO 2.100,00").fields.kind, "extra");
});
