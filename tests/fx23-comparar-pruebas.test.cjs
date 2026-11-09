// FX-23 PR-2 (9/11/2026, D-N10) · Escenarios › Comparar: las pruebas de estrés de la Previsión sin guardarlas y la liquidez a fin de
// mes de cada columna en un minigráfico con la misma escala. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const app = codigoApp("views/escenarios.js");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
    }
  }
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra`);
}

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? "").replace(/"/g, "&quot;"),
    money: (n) => `${String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    escenarioMotorMonthLabel: (key) => `mes ${key}`,
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const serie = (valores) => valores.map((totalLiquidity, index) => ({ detailMonthKey: `2027-0${index + 1}`, totalLiquidity }));

test("FX-23 · el minigráfico usa la escala que se le da y dice de cuánto a cuánto y el cierre más bajo", () => {
  const { escenarioMotorSparkHtml } = sandboxWith(["escenarioMotorSparkHtml"]);
  const html = escenarioMotorSparkHtml(serie([1000, 400, 2000]), { min: 0, max: 4000 });
  assert.match(html, /role="img" aria-label="Liquidez a fin de cada mes: de 1\.000 € a 2\.000 €; el cierre más bajo, 400 € en mes 2027-02"/);
  // Con la escala compartida (0-4.000), 2.000 queda a media altura: y = 28 - 0,5 × 28 = 14.
  assert.match(html, /points="0\.0,21\.0 48\.0,25\.2 96\.0,14\.0"/);
  assert.equal(escenarioMotorSparkHtml(serie([1000]), { min: 0, max: 1 }), "—", "con un solo mes no hay línea");
});

test("FX-23 · la tabla lleva la fila del minigráfico con una escala común a todas las columnas (y nada sin la serie del plan)", () => {
  const ctx = sandboxWith(["escenarioMotorSparkHtml", "escenarioMotorCompareTableHtml"]);
  const resumen = { liquidezFinal: 1, mesesColchon: 1, libreDeDeuda: "", ahorroAnual: 1, peorMesClave: "", capacidadLibre: 1 };
  ctx.money = (n) => `${Math.round(Number(n))} €`;
  const plan = serie([1000, 2000]);
  const prueba = serie([1000, 0]);
  const html = ctx.escenarioMotorCompareTableHtml(resumen, [{ nombre: "Prueba · INVENTADA", summary: resumen, series: prueba }], plan);
  const filas = html.match(/<tr class="escenario-motor-spark-fila"><td>Liquidez a fin de mes<\/td>/g) || [];
  assert.equal(filas.length, 1);
  // Escala 0-2.000 para las dos: el plan acaba arriba (y=0) y la prueba abajo (y=28).
  assert.match(html, /points="0\.0,14\.0 96\.0,0\.0"/);
  assert.match(html, /points="0\.0,14\.0 96\.0,28\.0"/);
  assert.doesNotMatch(ctx.escenarioMotorCompareTableHtml(resumen, [{ nombre: "x", summary: resumen }]), /escenario-motor-spark-fila/);
});

test("FX-23 · Comparar enseña las pruebas sin guardar en su grupo, la que falta desactivada con su motivo, y las compara con el plan", () => {
  const picker = { innerHTML: "" };
  const body = { innerHTML: "" };
  const empty = { hidden: false };
  const layout = { hidden: true };
  const els = { escenarioCompararPicker: picker, escenarioCompararBody: body, escenarioCompararEmpty: empty, escenarioCompararLayout: layout };
  const llamadas = [];
  const ctx = sandboxWith(["renderEscenarioComparar"], {
    qs: (id) => els[id] || null,
    renderScenarioDependencyNotice: () => {},
    escenarioMotorCompareCandidates: () => [],
    escenarioMotorComparePresets: () => [
      { id: "preset:sueldo-menos", nombre: "Prueba · sin «Nómina INVENTADA» 3 meses", decisiones: [{ id: "preset-sueldo-menos-0" }], motivo: "" },
      { id: "preset:euribor", nombre: "Prueba · Euribor +1 punto", decisiones: [], motivo: "falta una hipoteca" },
    ],
    escenarioMotorBaseInput: () => ({ months: [] }),
    runEscenarioMotor: (input, decisiones) => ({ decisiones, series: [] }),
    escenarioMotorSummaryFor: (result) => ({ n: result.decisiones.length }),
    escenarioMotorCompareTableHtml: (base, entries) => { llamadas.push(entries.map((entry) => entry.nombre)); return "<table></table>"; },
    escenarioCompararSelected: [],
    escenarioCompararSignature: "",
  });
  ctx.renderEscenarioComparar();
  assert.equal(empty.hidden, true, "sin escenarios guardados, las pruebas bastan para comparar");
  assert.equal(layout.hidden, false);
  assert.match(picker.innerHTML, /<p class="escenario-motor-compare-grupo">Pruebas de estrés, sin guardar<\/p>/);
  assert.match(picker.innerHTML, /<label class="is-off"><input type="checkbox" data-escenario-comparar-pick="preset:euribor"  disabled \/><span>Prueba · Euribor \+1 punto <small>\(falta una hipoteca\)<\/small>/);
  assert.match(body.innerHTML, /Marca al menos un escenario o una prueba/);
  ctx.escenarioCompararSelected = ["preset:sueldo-menos", "preset:euribor"];
  ctx.renderEscenarioComparar();
  assert.deepEqual(JSON.parse(JSON.stringify(llamadas)), [["Prueba · sin «Nómina INVENTADA» 3 meses"]], "la desactivada no entra aunque esté marcada");
});
