const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// PVC19 (Oleada 4, Bloque 3): confidenceBands() (PV4) ya calculaba un margen creciente con
// √(mes+1) — lo que no se veía era el propio ensanche: el render anterior pintaba una columna de
// barras sueltas, una por mes, sin conexión entre sí. Corrección de renderizado únicamente (mismo
// low/high/center de siempre): un polígono SVG continuo entre el límite bajo y el alto de cada mes
// es la forma de cono en sí — se ensancha visualmente cuanto más lejos está el mes, en vez de un
// conjunto de barras de anchura fija sin relación entre ellas.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = appSource.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parenDepth += 1;
    else if (appSource[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = appSource.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox() {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    round2: (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100,
    PV4_CONFIDENCE_LABEL: { high: "alta", medium: "media", low: "baja" },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("pv4ConfidenceBandHtml"), context);
  return context;
}

function band(overrides = {}) {
  return { monthKey: "2026-09", label: "sep 26", center: 1000, low: 900, high: 1100, margin: 100, confidence: "high", sampleConcepts: 3, marginSource: "bias", measuredMae: null, ...overrides };
}

function extractPolygonPoints(html) {
  const match = /<polygon class="pv4-cone-area" points="([^"]*)">/.exec(html);
  assert.ok(match, "No se encontró el polígono del cono");
  return match[1].split(" ").map((pair) => pair.split(",").map(Number));
}

test("pv4ConfidenceBandHtml · un único polígono continuo, no una columna por mes", () => {
  const ctx = sandbox();
  const output = ctx.pv4ConfidenceBandHtml([band(), band({ monthKey: "2026-10", label: "oct 26", margin: 150, low: 850, high: 1150 })]);
  assert.equal((output.match(/<polygon/g) || []).length, 1);
  assert.equal((output.match(/<polyline/g) || []).length, 1);
});

test("pv4ConfidenceBandHtml · el polígono conecta el envolvente alto (ida) con el bajo (vuelta), en ese orden", () => {
  const ctx = sandbox();
  const output = ctx.pv4ConfidenceBandHtml([
    band({ monthKey: "2026-09", label: "sep 26", low: 900, high: 1100 }),
    band({ monthKey: "2026-10", label: "oct 26", low: 800, high: 1200 }),
  ]);
  const points = extractPolygonPoints(output);
  assert.equal(points.length, 4); // 2 meses × (alto + bajo)
  // el primer tramo (ida) recorre los altos en orden; el segundo (vuelta) los bajos en orden inverso
  const [firstHighX] = points[0];
  const [secondHighX] = points[1];
  const [firstLowBackX] = points[2];
  const [secondLowBackX] = points[3];
  assert.ok(firstHighX < secondHighX, "los altos van de izquierda a derecha");
  assert.ok(firstLowBackX > secondLowBackX, "los bajos vuelven de derecha a izquierda, cerrando el polígono");
});

test("pv4ConfidenceBandHtml · el margen creciente se traduce en una separación vertical mayor en el mes final", () => {
  const ctx = sandbox();
  const output = ctx.pv4ConfidenceBandHtml([
    band({ monthKey: "2026-09", label: "sep 26", low: 950, high: 1050, margin: 50 }), // ancho 100
    band({ monthKey: "2027-08", label: "ago 27", low: 700, high: 1300, margin: 300 }), // ancho 600
  ]);
  const points = extractPolygonPoints(output);
  const [, firstHighY] = points[0];
  const [, secondHighY] = points[1];
  const [, secondLowY] = points[2]; // vuelta empieza por el bajo del último mes
  const [, firstLowY] = points[3];
  const firstGap = Math.abs(firstLowY - firstHighY);
  const secondGap = Math.abs(secondLowY - secondHighY);
  assert.ok(secondGap > firstGap, "el segundo mes, con más margen, debe verse más ancho verticalmente");
  assert.match(output, /El margen crece de/);
});

test("pv4ConfidenceBandHtml · margen constante (sin crecimiento), no afirma un ensanche que no existe", () => {
  const ctx = sandbox();
  const output = ctx.pv4ConfidenceBandHtml([
    band({ monthKey: "2026-09", label: "sep 26", margin: 100 }),
    band({ monthKey: "2026-10", label: "oct 26", margin: 100 }),
  ]);
  assert.doesNotMatch(output, /El margen crece de/);
  assert.match(output, /Se ensancha cuanto más lejos está el mes/);
});

test("pv4ConfidenceBandHtml · un solo mes no revienta (sin envolvente que dibujar)", () => {
  const ctx = sandbox();
  assert.doesNotThrow(() => ctx.pv4ConfidenceBandHtml([band()]));
});

test("pv4ConfidenceBandHtml · la línea central usa vector-effect para no deformarse al estirar el SVG", () => {
  const ctx = sandbox();
  const output = ctx.pv4ConfidenceBandHtml([band(), band({ monthKey: "2026-10", label: "oct 26" })]);
  assert.match(output, /vector-effect="non-scaling-stroke"/);
});

test("pv4ConfidenceBandHtml · el SVG lleva un aria-label descriptivo (accesible sin depender del color)", () => {
  const ctx = sandbox();
  const output = ctx.pv4ConfidenceBandHtml([band(), band({ monthKey: "2026-10", label: "oct 26", margin: 200 })]);
  assert.match(output, /role="img" aria-label="[^"]*Cono de incertidumbre[^"]*"/);
});
