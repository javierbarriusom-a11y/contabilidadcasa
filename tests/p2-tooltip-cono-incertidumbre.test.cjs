const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// P2 (Horizonte 4 de BACKLOG_CONTABILIDADCASA_2_0.md): tooltip por mes sobre el cono de
// incertidumbre (PVC19), sin librería nueva ni motor nuevo. Cada marcador dice low/center/high
// (P10/P50/P90) del mes y, cuando hay historial suficiente, la categoría que más pesa en el
// margen — mismo `deviations` de learnFromHistory/E12b que ya usa el termómetro de desviación por
// partida, sin recalcular nada.

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

function sandboxWith(names) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    round2: (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100,
    PV4_CONFIDENCE_LABEL: { high: "alta", medium: "media", low: "baja" },
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function band(overrides = {}) {
  return { monthKey: "2026-09", label: "sep 26", center: 1000, low: 900, high: 1100, margin: 100, confidence: "high", sampleConcepts: 3, marginSource: "bias", measuredMae: null, ...overrides };
}

function deviation(overrides = {}) {
  return { conceptId: "ocio", label: "Ocio", sampleMonths: 6, averageDelta: 50, averagePlanned: 200, confidence: "high", ...overrides };
}

// --- pv4DominantDeviationCategory ---------------------------------------------------------------

test("pv4DominantDeviationCategory · elige la categoría con mayor |averageDelta|, no la primera de la lista", () => {
  const ctx = sandboxWith(["pv4DominantDeviationCategory"]);
  const result = ctx.pv4DominantDeviationCategory([
    deviation({ conceptId: "ocio", label: "Ocio", averageDelta: 30 }),
    deviation({ conceptId: "colegio", label: "Colegio", averageDelta: -120 }),
    deviation({ conceptId: "super", label: "Supermercado", averageDelta: 60 }),
  ]);
  assert.equal(result.conceptId, "colegio");
});

test("pv4DominantDeviationCategory · descarta categorías sin muestra (sampleMonths 0)", () => {
  const ctx = sandboxWith(["pv4DominantDeviationCategory"]);
  const result = ctx.pv4DominantDeviationCategory([
    deviation({ conceptId: "sin-muestra", averageDelta: 999, sampleMonths: 0 }),
    deviation({ conceptId: "ocio", averageDelta: 30, sampleMonths: 4 }),
  ]);
  assert.equal(result.conceptId, "ocio");
});

test("pv4DominantDeviationCategory · sin categorías con muestra, null en vez de fabricar una", () => {
  const ctx = sandboxWith(["pv4DominantDeviationCategory"]);
  assert.equal(ctx.pv4DominantDeviationCategory([]), null);
  assert.equal(ctx.pv4DominantDeviationCategory([deviation({ sampleMonths: 0 })]), null);
});

// --- pv4ConfidenceBandHtml (marcadores) ---------------------------------------------------------

test("pv4ConfidenceBandHtml · un marcador con tooltip por cada mes, con P10/P50/P90", () => {
  const ctx = sandboxWith(["pv4ConfidenceBandHtml"]);
  const output = ctx.pv4ConfidenceBandHtml([
    band({ monthKey: "2026-09", label: "sep 26", low: 900, center: 1000, high: 1100 }),
    band({ monthKey: "2026-10", label: "oct 26", low: 850, center: 950, high: 1050 }),
  ]);
  const markers = [...output.matchAll(/<button type="button" class="pv4-cone-marker"[^>]*>/g)];
  assert.equal(markers.length, 2);
  assert.match(output, /P10 900\.00 €/);
  assert.match(output, /P50 1000\.00 €/);
  assert.match(output, /P90 1100\.00 €/);
});

test("pv4ConfidenceBandHtml · cada marcador queda posicionado en el mismo x/y que ya usa el propio SVG", () => {
  const ctx = sandboxWith(["pv4ConfidenceBandHtml"]);
  const output = ctx.pv4ConfidenceBandHtml([band(), band({ monthKey: "2026-10", label: "oct 26" })]);
  assert.match(output, /style="left:0%;top:[\d.]+%"/);
  assert.match(output, /style="left:100%;top:[\d.]+%"/);
});

test("pv4ConfidenceBandHtml · sin categoría dominante, no fabrica una frase de «partida que más pesa»", () => {
  const ctx = sandboxWith(["pv4ConfidenceBandHtml"]);
  const output = ctx.pv4ConfidenceBandHtml([band()]);
  assert.doesNotMatch(output, /Partida que más pesa/);
});

test("pv4ConfidenceBandHtml · con categoría dominante, la incluye en el tooltip de cada marcador", () => {
  const ctx = sandboxWith(["pv4ConfidenceBandHtml"]);
  const output = ctx.pv4ConfidenceBandHtml(
    [band({ monthKey: "2026-09", label: "sep 26" }), band({ monthKey: "2026-10", label: "oct 26" })],
    deviation({ conceptId: "colegio", label: "Colegio", averageDelta: -120, sampleMonths: 8 }),
  );
  // Cada marcador repite el aviso en `title` y en `aria-label` (mismo texto en los dos, ver el
  // siguiente test) — dos meses × dos atributos = 4 apariciones.
  const occurrences = (output.match(/Partida que más pesa en el margen: "Colegio"/g) || []).length;
  assert.equal(occurrences, 4, "el aviso debe aparecer en title y aria-label de cada uno de los dos meses");
  assert.match(output, /-120\.00 €/);
});

test("pv4ConfidenceBandHtml · el aria-label del marcador coincide con su title (accesible sin ratón)", () => {
  const ctx = sandboxWith(["pv4ConfidenceBandHtml"]);
  const output = ctx.pv4ConfidenceBandHtml([band()]);
  const markerMatch = /<button type="button" class="pv4-cone-marker"[^>]*>/.exec(output);
  assert.ok(markerMatch, "debe existir el marcador");
  const titleMatch = /title="([^"]*)"/.exec(markerMatch[0]);
  const ariaMatch = /aria-label="([^"]*)"/.exec(markerMatch[0]);
  assert.ok(titleMatch && ariaMatch);
  assert.equal(titleMatch[1], ariaMatch[1]);
});

test("pv4ConfidenceBandHtml · la nota final invita a pasar el ratón o el foco por el cono", () => {
  const ctx = sandboxWith(["pv4ConfidenceBandHtml"]);
  const output = ctx.pv4ConfidenceBandHtml([band()]);
  assert.match(output, /Pasa el ratón o el foco por cada punto del cono/);
});

// --- wiring ----------------------------------------------------------------------------------

test("wiring: renderE13ScenarioLab calcula la categoría dominante desde learning.deviations y la pasa al cono", () => {
  const block = extractFunction("renderE13ScenarioLab");
  assert.match(block, /const confidenceBandsDominant = pv4DominantDeviationCategory\(learning\.deviations\);/);
  assert.match(block, /pv4ConfidenceBandHtml\(confidenceBands, confidenceBandsDominant\)/);
});
