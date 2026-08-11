const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const uxSettings = read("ux-settings.js");
const experience = read("e17-experience.js");

// V6-2 · umbrales de aviso: colchón mínimo en meses (regla nueva del framework de alertas ya
// existente), ventana de duplicados y desviación por partida (ajustes propios en `#ajustes`, con
// el mismo patrón «vacío = sin configurar» que ya usaba la reserva operativa).

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
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
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

const FUNCTIONS = [
  "positiveIntegerFromField",
  "duplicateWindowDays",
  "handleDuplicateWindowChange",
  "syncDuplicateWindowControl",
  "partidaDeviationThreshold",
  "handlePartidaDeviationThresholdChange",
  "syncPartidaDeviationControl",
  "registrarMesDeviationPercent",
];

function field(value = "") {
  return { value, textContent: "" };
}

function sandbox({ state = {}, fields = {}, focus = null } = {}) {
  const elements = new Map(Object.entries(fields));
  const saves = [];
  const announcements = [];
  const context = {
    state,
    document: { activeElement: focus },
    qs: (id) => elements.get(id) || null,
    saveScenarioSettings: () => saves.push(true),
    announceStatus: (text) => announcements.push(text),
    renderAjustesPartidaNote: () => {},
    DATOS_IMPORTAR_DUPLICATE_WINDOW_DAYS: 7,
  };
  vm.createContext(context);
  vm.runInContext(FUNCTIONS.map(extractFunction).join("\n"), context, {
    filename: "app.js#v6-2-umbrales-aviso",
  });
  return { context, saves, announcements };
}

test("V6-2 · positiveIntegerFromField redondea, exige positivo y respeta el máximo", () => {
  const { context } = sandbox();
  assert.equal(context.positiveIntegerFromField("7"), 7);
  assert.equal(context.positiveIntegerFromField("7.6"), 8);
  assert.equal(context.positiveIntegerFromField(""), 0);
  assert.equal(context.positiveIntegerFromField("-3"), 0);
  assert.equal(context.positiveIntegerFromField("abc"), 0);
  assert.equal(context.positiveIntegerFromField("0"), 0);
  assert.equal(context.positiveIntegerFromField("500", { max: 60 }), 60, "se recorta al máximo declarado");
});

test("V6-2 · la ventana de duplicados cae a 7 días cuando no está configurada", () => {
  const sinConfigurar = sandbox({ state: {} });
  assert.equal(sinConfigurar.context.duplicateWindowDays(), 7);

  const configurada = sandbox({ state: { duplicateWindowDays: 21 } });
  assert.equal(configurada.context.duplicateWindowDays(), 21);
});

test("V6-2 · escribir una ventana de duplicados la guarda, vaciarla la deja sin configurar", () => {
  const input = field("15");
  const { context, saves, announcements } = sandbox({ fields: { ajustesDuplicateWindow: input } });
  context.handleDuplicateWindowChange({ target: input });
  assert.equal(context.state.duplicateWindowDays, 15);
  assert.equal(saves.length, 1);
  assert.match(announcements[0], /guardada en 15 día/);

  const vaciar = field("");
  const otra = sandbox({ state: { duplicateWindowDays: 15 }, fields: { ajustesDuplicateWindow: vaciar } });
  otra.context.handleDuplicateWindowChange({ target: vaciar });
  assert.equal(otra.context.state.duplicateWindowDays, 0);
  assert.match(otra.announcements[0], /usan 7 días por defecto/);
});

test("V6-2 · syncDuplicateWindowControl refleja lo guardado sin pisar lo que se está escribiendo", () => {
  const input = field("");
  const { context } = sandbox({ state: { duplicateWindowDays: 10 }, fields: { ajustesDuplicateWindow: input } });
  context.syncDuplicateWindowControl();
  assert.equal(input.value, "10");

  const escribiendo = field("3");
  const enFoco = sandbox({ state: { duplicateWindowDays: 10 }, fields: { ajustesDuplicateWindow: escribiendo }, focus: escribiendo });
  enFoco.context.syncDuplicateWindowControl();
  assert.equal(escribiendo.value, "3");
});

test("V6-2 · el umbral de desviación por partida es «sin configurar» hasta que se escribe uno", () => {
  const sinConfigurar = sandbox({ state: {} });
  assert.equal(sinConfigurar.context.partidaDeviationThreshold(), 0);

  const configurado = sandbox({ state: { partidaDeviationThreshold: 15 } });
  assert.equal(configurado.context.partidaDeviationThreshold(), 15);
});

test("V6-2 · escribir el umbral de desviación lo guarda y anuncia el cambio de comportamiento", () => {
  const input = field("20");
  const { context, saves, announcements } = sandbox({ fields: { ajustesPartidaThreshold: input } });
  context.handlePartidaDeviationThresholdChange({ target: input });
  assert.equal(context.state.partidaDeviationThreshold, 20);
  assert.equal(saves.length, 1);
  assert.match(announcements[0], /guardado en 20%/);

  const vaciar = field("");
  const otra = sandbox({ state: { partidaDeviationThreshold: 20 }, fields: { ajustesPartidaThreshold: vaciar } });
  otra.context.handlePartidaDeviationThresholdChange({ target: vaciar });
  assert.equal(otra.context.state.partidaDeviationThreshold, 0);
  assert.match(otra.announcements[0], /cualquier desviación/);
});

test("V6-2 · la desviación relativa por partida es un porcentaje, y un previsto de 0 € no revienta", () => {
  const { context } = sandbox();
  assert.equal(context.registrarMesDeviationPercent({ hasActual: false, planned: 100, variance: 0 }), null);
  assert.equal(context.registrarMesDeviationPercent({ hasActual: true, planned: 100, variance: 25 }), 25);
  assert.equal(context.registrarMesDeviationPercent({ hasActual: true, planned: 200, variance: -50 }), 25);
  assert.equal(context.registrarMesDeviationPercent({ hasActual: true, planned: 0, variance: 0 }), 0);
  assert.equal(context.registrarMesDeviationPercent({ hasActual: true, planned: 0, variance: 40 }), Infinity);
});

test("V6-2 · el colchón mínimo en meses es una regla más del framework de alertas ya existente", () => {
  assert.match(uxSettings, /ALERT_METRICS = \[.*"minimumCashMonths".*\]/);
  assert.match(app, /minimumCashMonths: \{ label: "Colchón mínimo \(meses\)"/);
  assert.match(app, /id: "alert-cushion-months"/);
  assert.match(app, /metric: "minimumCashMonths"/);
  assert.match(app, /minimumCashMonths: round2\(safeCoverageMonths\(minLiquidity, avgOutflow\) \?\? 0\)/);
});

test("V6-2 · los dos ajustes propios se guardan como datos del hogar, igual que la reserva", () => {
  const settings = app.slice(app.indexOf("function saveScenarioSettings()"));
  assert.match(settings, /duplicateWindowDays: state\.duplicateWindowDays/);
  assert.match(settings, /partidaDeviationThreshold: state\.partidaDeviationThreshold/);
  assert.ok(settings.indexOf("duplicateWindowDays") < settings.indexOf("queueRemoteSave"));
  assert.ok(settings.indexOf("partidaDeviationThreshold") < settings.indexOf("queueRemoteSave"));
});

test("V6-2 · los dos campos viven en Ajustes, con ayuda y sin romper el import de duplicados", () => {
  assert.match(html, /id="ajustesDuplicateWindow"/);
  assert.match(html, /id="ajustesPartidaThreshold"/);
  assert.match(html, /id="ajustesPartidaNote"/);
  assert.match(app, /qs\("ajustesDuplicateWindow"\)\?\.addEventListener\("change", handleDuplicateWindowChange\)/);
  assert.match(app, /qs\("ajustesPartidaThreshold"\)\?\.addEventListener\("change", handlePartidaDeviationThresholdChange\)/);
  assert.match(app, /addHelpToControl\(\s*"ajustesDuplicateWindow"/);
  assert.match(app, /addHelpToControl\(\s*"ajustesPartidaThreshold"/);
  // La ventana configurable se pasa de verdad a los dos sitios donde se detectan duplicados, no
  // solo se declara: si alguno volviera a depender del valor por defecto implícito, esta prueba
  // rompería en vez de pasar por casualidad.
  assert.equal(
    (app.match(/datosImportarDuplicateCandidates\([^)]*duplicateWindowDays\(\)\)/g) || []).length,
    2,
    "los dos import (borrador y sesión) deben pedir la ventana configurada",
  );
});

test("V6-2 · el lanzador y el menú avanzado no necesitan tocarse: los umbrales viven en Ajustes", () => {
  assert.match(experience, /target: "ajustes", label: "Ajustes"/);
});
