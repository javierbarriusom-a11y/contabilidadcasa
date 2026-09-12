const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Portfolio = require("../canonical-portfolio.js");

// INV16 (Oleada 4, Bloque 4): correlación cualitativa DECLARADA por el hogar entre clases de
// activo — nunca calculada (sin histórico de valoraciones, mismo hueco de datos ya documentado en
// INV1/IVX6). Alcance confirmado por el hogar (sesión 171): declarada y editable, nunca una tabla
// fija con valores por defecto. Solo avisa de concentración cuando dos clases con correlación
// "alta" declarada pesan de verdad en la cartera real — nunca decide ni bloquea nada.

test("assetClassCorrelationPairs · genera los 6 pares únicos de las 4 clases declarables, sin repetir", () => {
  const pairs = Portfolio.assetClassCorrelationPairs();
  assert.equal(pairs.length, 6);
  const keys = pairs.map((pair) => pair.key);
  assert.equal(new Set(keys).size, 6);
});

test("assetClassCorrelationPairKey · la clave es independiente del orden de los dos argumentos", () => {
  assert.equal(
    Portfolio.assetClassCorrelationPairKey("renta-variable", "renta-fija"),
    Portfolio.assetClassCorrelationPairKey("renta-fija", "renta-variable"),
  );
});

test("qualitativeConcentrationWarnings · sin posiciones con valor, no calculable", () => {
  const result = Portfolio.qualitativeConcentrationWarnings({ positions: [], correlationDeclarations: {} });
  assert.equal(result.calculable, false);
});

test("qualitativeConcentrationWarnings · sin ningún par declarado, calculable pero sin avisos", () => {
  const positions = [
    { currentValue: 6000, assetClass: "renta-variable" },
    { currentValue: 4000, assetClass: "alternativo" },
  ];
  const result = Portfolio.qualitativeConcentrationWarnings({ positions, correlationDeclarations: {} });
  assert.equal(result.calculable, true);
  assert.equal(result.declaredPairs, 0);
  assert.equal(result.totalPairs, 6);
  assert.deepEqual(result.warnings, []);
});

test("qualitativeConcentrationWarnings · nunca asume un nivel por defecto para un par sin declarar", () => {
  const positions = [
    { currentValue: 6000, assetClass: "renta-variable" },
    { currentValue: 4000, assetClass: "alternativo" },
  ];
  // Declaración con un valor inválido/desconocido — se trata igual que "sin declarar".
  const result = Portfolio.qualitativeConcentrationWarnings({
    positions,
    correlationDeclarations: { "alternativo|renta-variable": "muy-alta-inventada" },
  });
  assert.equal(result.declaredPairs, 0);
  assert.deepEqual(result.warnings, []);
});

test("qualitativeConcentrationWarnings · correlación media/baja/negativa nunca genera aviso, solo alta", () => {
  const positions = [
    { currentValue: 6000, assetClass: "renta-variable" },
    { currentValue: 4000, assetClass: "alternativo" },
  ];
  ["media", "baja", "negativa"].forEach((level) => {
    const result = Portfolio.qualitativeConcentrationWarnings({
      positions,
      correlationDeclarations: { "alternativo|renta-variable": level },
    });
    assert.equal(result.declaredPairs, 1);
    assert.deepEqual(result.warnings, []);
  });
});

test("qualitativeConcentrationWarnings · correlación alta entre dos clases con peso real genera aviso, con el % combinado", () => {
  const positions = [
    { currentValue: 6000, assetClass: "renta-variable" },
    { currentValue: 4000, assetClass: "alternativo" },
    { currentValue: 3000, assetClass: "renta-fija" },
  ];
  const result = Portfolio.qualitativeConcentrationWarnings({
    positions,
    correlationDeclarations: { "alternativo|renta-variable": "alta" },
  });
  assert.equal(result.warnings.length, 1);
  const warning = result.warnings[0];
  assert.equal(warning.classAPct, 46); // 6000/13000
  assert.equal(warning.classBPct, 31); // 4000/13000
  assert.equal(warning.combinedPct, 77); // 10000/13000
  assert.equal(warning.dominant, true); // >= 50%
});

test("qualitativeConcentrationWarnings · sin peso real en una de las dos clases, no avisa aunque esté declarada alta", () => {
  const positions = [{ currentValue: 6000, assetClass: "renta-variable" }];
  const result = Portfolio.qualitativeConcentrationWarnings({
    positions,
    correlationDeclarations: { "alternativo|renta-variable": "alta" },
  });
  assert.deepEqual(result.warnings, []);
});

test("qualitativeConcentrationWarnings · posiciones sin clase de activo declarada quedan fuera, nunca se les asume un reparto", () => {
  const positions = [
    { currentValue: 6000, assetClass: "renta-variable" },
    { currentValue: 4000 }, // sin assetClass
  ];
  const result = Portfolio.qualitativeConcentrationWarnings({
    positions,
    correlationDeclarations: { "alternativo|renta-variable": "alta" },
  });
  // Sin la clase "alternativo" clasificada, el par no tiene ambos lados con peso > 0.
  assert.deepEqual(result.warnings, []);
});

test("qualitativeConcentrationWarnings · varios avisos se ordenan de mayor a menor % combinado", () => {
  const positions = [
    { currentValue: 5000, assetClass: "renta-variable" },
    { currentValue: 5000, assetClass: "alternativo" },
    { currentValue: 1000, assetClass: "renta-fija" },
    { currentValue: 1000, assetClass: "monetario" },
  ];
  const result = Portfolio.qualitativeConcentrationWarnings({
    positions,
    correlationDeclarations: {
      "alternativo|renta-variable": "alta",
      "monetario|renta-fija": "alta",
    },
  });
  assert.equal(result.warnings.length, 2);
  assert.ok(result.warnings[0].combinedPct >= result.warnings[1].combinedPct);
  assert.equal(result.warnings[0].classA === "renta-variable" || result.warnings[0].classB === "renta-variable", true);
});

// --- Wiring: app.js declara los 6 selects y los persiste sin inventar defaults; index.html expone
// la tarjeta con las 6 opciones de par, cada una con "Sin declarar" como opción inicial. ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const INV16_FIELD_IDS = [
  "inv16CorrRentaVariableRentaFija",
  "inv16CorrRentaVariableMonetario",
  "inv16CorrRentaVariableAlternativo",
  "inv16CorrRentaFijaMonetario",
  "inv16CorrRentaFijaAlternativo",
  "inv16CorrMonetarioAlternativo",
];

test("wiring: la tarjeta INV16 en index.html tiene los 6 selects de par y el contenedor de avisos", () => {
  [...INV16_FIELD_IDS, "inv16CorrelationNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de INV16`);
  });
});

test("wiring: cada select de INV16 arranca en «Sin declarar», nunca con un nivel preseleccionado", () => {
  INV16_FIELD_IDS.forEach((id) => {
    const start = indexSource.indexOf(`id="${id}"`);
    assert.ok(start >= 0, `Falta #${id}`);
    const block = indexSource.slice(start, indexSource.indexOf("</select>", start));
    assert.match(block, /<option value="">Sin declarar<\/option>/);
  });
});

test("wiring: saveInv16CorrelationDeclarations solo guarda niveles con valor, nunca un default por par sin tocar", () => {
  const start = appSource.indexOf("function saveInv16CorrelationDeclarations(");
  assert.ok(start >= 0);
  const block = appSource.slice(start, start + 600);
  assert.match(block, /if \(value\) declared\[key\] = value;/);
  assert.match(block, /scenarioSettings\.inv16AssetClassCorrelation = declared;/);
});

test("wiring: renderInv16ConcentrationWarnings reutiliza tal cual qualitativeConcentrationWarnings, sin motor propio", () => {
  const start = appSource.indexOf("function renderInv16ConcentrationWarnings(");
  assert.ok(start >= 0);
  const block = appSource.slice(start, start + 1400);
  assert.match(block, /engine\.qualitativeConcentrationWarnings\(/);
  assert.match(block, /correlationDeclarations: inv16CorrelationDeclarations\(\)/);
});

test("wiring: los 6 selects de INV16 guardan al cambiar (change), igual patrón que las declaraciones de APX3/LEV12", () => {
  assert.match(
    appSource,
    /Object\.values\(INV16_CORRELATION_FIELDS\)\.forEach\(\(fieldId\) => \{\s*qs\(fieldId\)\?\.addEventListener\("change", saveInv16CorrelationDeclarations\);\s*\}\);/,
  );
});
