const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// I9 (Contabilidadcasa 2.0, sesión 216): gráfico de cartera con zoom y tooltip. Decisión de
// arquitectura del hogar (session en curso): mantener "cero dependencias externas de UI", igual
// que el resto de gráficos de la app (SVG a mano, sin librería). Sin posiciones reales, se muestra
// con datos de ejemplo y una nota visible — nunca en silencio.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const inversionViewSource = fs.readFileSync(path.join(__dirname, "..", "views", "inversion.js"), "utf8");

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

function sandboxWith(names) {
  const context = {
    escapeHtml: (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    round2: (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100,
    IV1_POSITION_TYPE_LABELS: { fondo: "Fondo", accion: "Acción", etf: "ETF", cripto: "Cripto", "plan-pension": "Plan de pensiones", otro: "Otro" },
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function position(overrides = {}) {
  return { id: "p1", label: "Posición", type: "fondo", costBasis: 1000, currentValue: 1000, gainLoss: 0, gainLossPct: 0, ...overrides };
}

// --- iv1PositionChartRowsHtml (parte pura) ------------------------------------------------------

test("iv1PositionChartRowsHtml · sin posiciones, el mismo mensaje vacío que ya usa la lista", () => {
  const ctx = sandboxWith(["iv1PositionChartRowsHtml"]);
  const output = ctx.iv1PositionChartRowsHtml([], "120px");
  assert.match(output, /Sin posiciones registradas todavía\./);
});

test("iv1PositionChartRowsHtml · una fila por posición, ordenadas de mayor a menor valor actual", () => {
  const ctx = sandboxWith(["iv1PositionChartRowsHtml"]);
  const output = ctx.iv1PositionChartRowsHtml([
    position({ id: "a", label: "Pequeña", currentValue: 500 }),
    position({ id: "b", label: "Grande", currentValue: 5000 }),
  ], "120px");
  const rows = [...output.matchAll(/<div class="iv1-chart-row"/g)];
  assert.equal(rows.length, 2);
  assert.ok(output.indexOf("Grande") < output.indexOf("Pequeña"), "la posición de mayor valor debe ir primero");
});

test("iv1PositionChartRowsHtml · la barra de valor es proporcional al máximo del conjunto, nunca fabricada", () => {
  const ctx = sandboxWith(["iv1PositionChartRowsHtml"]);
  const output = ctx.iv1PositionChartRowsHtml([
    position({ id: "a", label: "Mitad", currentValue: 500, costBasis: 500 }),
    position({ id: "b", label: "Completa", currentValue: 1000, costBasis: 1000 }),
  ], "120px");
  assert.match(output, /class="iv1-chart-row-bar " x="0" y="0" width="50"/);
  assert.match(output, /class="iv1-chart-row-bar " x="0" y="0" width="100"/);
});

test("iv1PositionChartRowsHtml · colorea la barra según ganancia o pérdida, sin tocar el neutro", () => {
  const ctx = sandboxWith(["iv1PositionChartRowsHtml"]);
  const output = ctx.iv1PositionChartRowsHtml([
    position({ id: "g", label: "Con ganancia", currentValue: 1100, costBasis: 1000, gainLoss: 100, gainLossPct: 10 }),
    position({ id: "p", label: "Con pérdida", currentValue: 900, costBasis: 1000, gainLoss: -100, gainLossPct: -10 }),
    position({ id: "n", label: "Sin cambio", currentValue: 1000, costBasis: 1000, gainLoss: 0, gainLossPct: 0 }),
  ], "120px");
  function barClassFor(label) {
    const labelIndex = output.indexOf(`>${label}</span>`);
    assert.ok(labelIndex >= 0, `no se encontró la fila de "${label}"`);
    const match = output.slice(labelIndex).match(/class="iv1-chart-row-bar ([a-z]*)"/);
    assert.ok(match, `no se encontró la barra de "${label}"`);
    return match[1];
  }
  assert.equal(barClassFor("Con ganancia"), "positive");
  assert.equal(barClassFor("Con pérdida"), "negative");
  assert.equal(barClassFor("Sin cambio"), "");
});

test("iv1PositionChartRowsHtml · marca el coste con un tick independiente del color de la barra", () => {
  const ctx = sandboxWith(["iv1PositionChartRowsHtml"]);
  const output = ctx.iv1PositionChartRowsHtml([position({ currentValue: 1000, costBasis: 800 })], "120px");
  assert.match(output, /class="iv1-chart-row-cost" x="80" y="0" width="0\.6"/);
});

test("iv1PositionChartRowsHtml · el tooltip nativo (title) lleva coste, valor y plusvalía/minusvalía, mismo patrón que P2", () => {
  const ctx = sandboxWith(["iv1PositionChartRowsHtml"]);
  const output = ctx.iv1PositionChartRowsHtml([position({ label: "Fondo X", costBasis: 1000, currentValue: 1200, gainLoss: 200, gainLossPct: 20 })], "120px");
  assert.match(output, /title="Fondo X · Fondo · coste 1000\.00 € · valor 1200\.00 € · 200\.00 € \(20%\)"/);
});

test("iv1PositionChartRowsHtml · el ancho de columna del zoom viaja en la variable CSS, no en el viewBox", () => {
  const ctx = sandboxWith(["iv1PositionChartRowsHtml"]);
  const output = ctx.iv1PositionChartRowsHtml([position()], "360px");
  assert.match(output, /style="--iv1-chart-track-width: 360px"/);
  assert.match(output, /viewBox="0 0 100 10"/); // el viewBox no cambia con el zoom
});

test("iv1PositionChartRowsHtml · el SVG decorativo queda oculto a los lectores de pantalla (el title de la fila ya lo cubre)", () => {
  const ctx = sandboxWith(["iv1PositionChartRowsHtml"]);
  const output = ctx.iv1PositionChartRowsHtml([position()], "120px");
  assert.match(output, /<svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">/);
});

// --- Datos de ejemplo, indicados en la app --------------------------------------------------

test("renderIv1PositionChart · sin posiciones reales usa el dataset de ejemplo, nunca en silencio", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1PositionChart"), appSource.indexOf("function renderIv1PositionChart") + 900);
  assert.match(block, /usingSample = !engine \|\| !rows\.length/);
  assert.match(block, /demoNote\.hidden = !usingSample/);
  assert.match(block, /IV1_CHART_SAMPLE_POSITIONS/);
});

test("IV1_CHART_SAMPLE_POSITIONS · cada posición de ejemplo se declara como tal en su propia etiqueta", () => {
  const block = appSource.slice(appSource.indexOf("const IV1_CHART_SAMPLE_POSITIONS"), appSource.indexOf("const IV1_CHART_SAMPLE_POSITIONS") + 800);
  const labels = [...block.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(labels.length >= 4, "debe haber varias posiciones de ejemplo, cubriendo distintos tipos");
  labels.forEach((label) => assert.match(label, /\(ejemplo\)$/));
});

test("index.html · la nota de datos de ejemplo existe y empieza oculta", () => {
  assert.match(indexSource, /id="iv1ChartDemoNote" hidden>Datos de ejemplo/);
});

// --- Zoom (tres anchos fijos, sin gesto de arrastre/pellizco) -----------------------------------

test("index.html · los tres botones de zoom existen con sus niveles", () => {
  assert.match(indexSource, /id="iv1ChartZoom"/);
  assert.match(indexSource, /data-iv1-chart-zoom="1"[^>]*>Normal</);
  assert.match(indexSource, /data-iv1-chart-zoom="2"[^>]*>Zoom \+</);
  assert.match(indexSource, /data-iv1-chart-zoom="3"[^>]*>Zoom \+\+</);
});

test("iv1ChartSetZoom · ignora niveles que no existen, sin romper el estado actual", () => {
  const block = appSource.slice(appSource.indexOf("function iv1ChartSetZoom"), appSource.indexOf("function iv1ChartSetZoom") + 500);
  assert.match(block, /if \(!IV1_CHART_ZOOM_TRACK_WIDTH\[parsed\]\) return;/);
});

test("wiring: el grupo de zoom está delegado con data-iv1-chart-zoom, mismo patrón que el resto de botones de filtro", () => {
  assert.match(appSource, /qs\("iv1ChartZoom"\)\?\.addEventListener\("click", \(event\) => \{[\s\S]{0,200}data-iv1-chart-zoom/);
});

// --- El gráfico se mantiene sincronizado con cada mutación de la cartera ------------------------

test("wiring: renderIv1PositionChart se llama junto a renderIv1PositionList en cada mutación de posiciones", () => {
  // saveIv1Position lee muchos campos opcionales (IVX4/IVX6/INV1/INV14/INV15/INV20, cada uno con su
  // propio comentario) antes de llegar al bloque de renders — la ventana más generosa cubre ese
  // caso; el resto de mutaciones (contribución, venta, traspaso, borrado) son mucho más cortas.
  ["saveIv1Position(", "saveIv1Contribution(", "saveIv1Disposal(", "saveIv1Transfer(", "removeIv1Position("].forEach((fnStart) => {
    const start = appSource.indexOf(`function ${fnStart}`);
    assert.ok(start >= 0, `No existe function ${fnStart}`);
    const block = appSource.slice(start, start + 4200);
    assert.match(block, /renderIv1PositionList\(\);\s*\n\s*renderIv1PositionChart\(\);/, `${fnStart} debe refrescar el gráfico justo después de la lista`);
  });
});

test("wiring: renderInversionCartera (views/inversion.js) llama a renderIv1PositionChart al abrir la pantalla", () => {
  assert.match(inversionViewSource, /renderIv1PositionList\(\);\s*\n\s*renderIv1PositionChart\(\);/);
});
