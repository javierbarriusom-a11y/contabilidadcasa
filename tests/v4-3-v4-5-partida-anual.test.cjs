const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const worker = read("service-worker.js");

// Cierre del bloque V4 · Datos: V4-3 (aviso «¿es anual?» en Registrar el mes) y V4-5 (la
// detección que lo alimenta). Todo el cálculo es de solo lectura sobre baseData.transactions y
// entry.actual, ya existentes: no se toca el motor de clasificación/incorporación de
// #datos-importar. No proyecta el previsto hacia años futuros —eso seguiría exigiendo ampliar el
// motor de planificación, que es estrictamente mensual— solo detecta el patrón y pregunta.

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

// --- V4-5 · detección --------------------------------------------------------------------------

function sandboxMatch() {
  const context = {
    dateFromMonthKey: (key) => (key ? new Date(`${key}-01T00:00:00`) : null),
    mappingForMovement: (t) => (t.row ? { row: t.row } : null),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("registrarMesAnnualMatch"), context);
  return context;
}

function customRow() {
  return { custom: true };
}

test("V4-5 · un mismo importe hace ~12 meses, sin nada parecido entre medias, cuenta como coincidencia", () => {
  const { registrarMesAnnualMatch } = sandboxMatch();
  const row = customRow();
  const entry = { hasActual: true, actual: -120, row };
  const transactions = [{ date: "2025-08-10", amount: -120.2, row }];
  const match = registrarMesAnnualMatch(entry, transactions, "2026-08");
  assert.ok(match);
  assert.equal(match.date, "2025-08-10");
});

test("V4-5 · sin real registrado, no hay nada que comparar", () => {
  const { registrarMesAnnualMatch } = sandboxMatch();
  const row = customRow();
  const entry = { hasActual: false, actual: -120, row };
  const transactions = [{ date: "2025-08-20", amount: -120, row }];
  assert.equal(registrarMesAnnualMatch(entry, transactions, "2026-08"), null);
});

test("V4-5 · una partida ya establecida (no custom) no se pregunta: ya se sabe que es la de siempre", () => {
  const { registrarMesAnnualMatch } = sandboxMatch();
  const row = { custom: false };
  const entry = { hasActual: true, actual: -120, row };
  const transactions = [{ date: "2025-08-20", amount: -120, row }];
  assert.equal(registrarMesAnnualMatch(entry, transactions, "2026-08"), null);
});

test("V4-5 · un importe por debajo del umbral no dispara el aviso", () => {
  const { registrarMesAnnualMatch } = sandboxMatch();
  const row = customRow();
  const entry = { hasActual: true, actual: -0.2, row };
  const transactions = [{ date: "2025-08-20", amount: -0.2, row }];
  assert.equal(registrarMesAnnualMatch(entry, transactions, "2026-08"), null);
});

test("V4-5 · sin ningún movimiento hace un año, no hay coincidencia que ofrecer", () => {
  const { registrarMesAnnualMatch } = sandboxMatch();
  const row = customRow();
  const entry = { hasActual: true, actual: -120, row };
  const transactions = [{ date: "2026-02-20", amount: -120, row }];
  assert.equal(registrarMesAnnualMatch(entry, transactions, "2026-08"), null);
});

test("V4-5 · un importe distinto (fuera de la tolerancia de 0,50 €) no cuenta como coincidencia", () => {
  const { registrarMesAnnualMatch } = sandboxMatch();
  const row = customRow();
  const entry = { hasActual: true, actual: -120, row };
  const transactions = [{ date: "2025-08-20", amount: -110, row }];
  assert.equal(registrarMesAnnualMatch(entry, transactions, "2026-08"), null);
});

test("V4-5 · una fecha fuera de los ±15 días no cuenta como «hace un año»", () => {
  const { registrarMesAnnualMatch } = sandboxMatch();
  const row = customRow();
  const entry = { hasActual: true, actual: -120, row };
  const transactions = [{ date: "2025-07-01", amount: -120, row }];
  assert.equal(registrarMesAnnualMatch(entry, transactions, "2026-08"), null);
});

test("V4-5 · si hay un importe parecido entre medias, es mensual, no anual: no se ofrece", () => {
  const { registrarMesAnnualMatch } = sandboxMatch();
  const row = customRow();
  const entry = { hasActual: true, actual: -120, row };
  const transactions = [
    { date: "2025-08-10", amount: -120, row },
    { date: "2026-02-15", amount: -119.8, row },
  ];
  assert.equal(registrarMesAnnualMatch(entry, transactions, "2026-08"), null);
});

test("V4-5 · movimientos de otra partida no cuentan, aunque el importe coincida", () => {
  const { registrarMesAnnualMatch } = sandboxMatch();
  const entry = { hasActual: true, actual: -120, row: customRow() };
  const transactions = [{ date: "2025-08-20", amount: -120, row: customRow() }];
  assert.equal(registrarMesAnnualMatch(entry, transactions, "2026-08"), null);
});

// --- V4-3 · el aviso ---------------------------------------------------------------------------

function sandboxBanner() {
  const context = {
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => `${Number(value).toFixed(2)} €`,
    formatIsoDate: (value) => `fecha:${value}`,
    dateFromMonthKey: (key) => (key ? new Date(`${key}-01T00:00:00`) : null),
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("registrarMesMonthName"), extractFunction("registrarMesAnnualBannerHtml")].join("\n"),
    context,
  );
  return context;
}

test("V4-3 · el aviso nombra el importe, la fecha de hace un año y el mes en que se repetiría", () => {
  const { registrarMesAnnualBannerHtml } = sandboxBanner();
  const html2 = registrarMesAnnualBannerHtml({ key: "gasto|2026-08", actual: -120 }, { date: "2025-08-20" }, "2026-08");
  assert.match(html2, /120\.00 €/);
  assert.match(html2, /fecha:2025-08-20/);
  assert.match(html2, /¿es una partida anual\?/);
  assert.match(html2, /Agosto/);
});

test("V4-3 · trae los dos botones, cada uno con su elección en el dataset", () => {
  const { registrarMesAnnualBannerHtml } = sandboxBanner();
  const html2 = registrarMesAnnualBannerHtml({ key: "gasto|2026-08", actual: -120 }, { date: "2025-08-20" }, "2026-08");
  assert.match(html2, /data-registrar-mes-annual-key="gasto\|2026-08" data-registrar-mes-annual-choice="confirm"/);
  assert.match(html2, /data-registrar-mes-annual-key="gasto\|2026-08" data-registrar-mes-annual-choice="dismiss"/);
  assert.match(html2, /Sí, anual/);
  assert.match(html2, /Solo este mes/);
});

// --- V4-3 · la respuesta -----------------------------------------------------------------------

function sandboxChoice(readonly) {
  const calls = { save: 0, announced: [], rendered: 0 };
  const context = {
    REGISTRAR_MES_LEGACY_READONLY: readonly,
    state: { registrarMesAnnualAck: {} },
    saveScenarioSettings: () => { calls.save += 1; },
    announceStatus: (message) => calls.announced.push(message),
    renderRegistrarMes: () => { calls.rendered += 1; },
    calls,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("handleRegistrarMesAnnualChoice"), context);
  return context;
}

// R-11: `#registrar-mes` es ahora de solo lectura (REGISTRAR_MES_LEGACY_READONLY = true en
// app.js) — el banner «¿es anual?» ya ni se pinta (registrarMesRowHtml lo omite), pero el
// manejador se guarda además su propia guarda de defensa, igual que ya hacía con el mes cerrado.
test("V4-3 · con la heredada de solo lectura, «Sí, anual» no escribe nada", () => {
  const { handleRegistrarMesAnnualChoice, state, calls } = sandboxChoice(true);
  handleRegistrarMesAnnualChoice("gasto|2026-08", "confirm");
  assert.equal(state.registrarMesAnnualAck["gasto|2026-08"], undefined);
  assert.equal(calls.save, 0);
  assert.equal(calls.rendered, 0);
  assert.equal(calls.announced.length, 0);
});

test("V4-3 · sin la guarda de solo lectura, «Sí, anual» recuerda la partida, guarda, y sugiere anotarla en Partidas", () => {
  const { handleRegistrarMesAnnualChoice, state, calls } = sandboxChoice(false);
  handleRegistrarMesAnnualChoice("gasto|2026-08", "confirm");
  assert.equal(state.registrarMesAnnualAck["gasto|2026-08"], true);
  assert.equal(calls.save, 1);
  assert.equal(calls.rendered, 1);
  assert.match(calls.announced[0], /Partidas/);
});

test("V4-3 · sin la guarda de solo lectura, «Solo este mes» también deja de preguntar, sin sugerir Partidas", () => {
  const { handleRegistrarMesAnnualChoice, state, calls } = sandboxChoice(false);
  handleRegistrarMesAnnualChoice("gasto|2026-08", "dismiss");
  assert.equal(state.registrarMesAnnualAck["gasto|2026-08"], true);
  assert.doesNotMatch(calls.announced[0], /Partidas/);
});

test("V4-3 · sin estado o sin clave, no revienta", () => {
  const context = {
    REGISTRAR_MES_LEGACY_READONLY: false,
    state: null,
    saveScenarioSettings: () => { throw new Error("no debería llamarse"); },
    announceStatus: () => { throw new Error("no debería llamarse"); },
    renderRegistrarMes: () => { throw new Error("no debería llamarse"); },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("handleRegistrarMesAnnualChoice"), context);
  assert.doesNotThrow(() => context.handleRegistrarMesAnnualChoice("gasto|2026-08", "confirm"));
});

// --- Cableado ------------------------------------------------------------------------------

test("Registrar el mes · la fila calcula la coincidencia y sólo la pregunta si el mes está abierto y la pantalla no es de solo lectura (R-11)", () => {
  const row = extractFunction("registrarMesRowHtml");
  assert.match(row, /const locked = monthClosed \|\| REGISTRAR_MES_LEGACY_READONLY;/);
  assert.match(row, /locked \? null : registrarMesAnnualMatch\(entry, baseData\?\.transactions, monthKey\)/);
  assert.match(row, /showAnnualBanner \? registrarMesAnnualBannerHtml\(entry, annualMatch, monthKey\) : ""/);
});

test("Registrar el mes · una vez reconocida (registrarMesAnnualAck), la fila deja de mostrar el aviso", () => {
  const row = extractFunction("registrarMesRowHtml");
  assert.match(row, /!state\?\.registrarMesAnnualAck\?\.\[entry\.key\]/);
});

test("Registrar el mes · la tarjeta pasa el mes a cada fila para que la detección tenga con qué comparar", () => {
  assert.match(app, /registrarMesRowHtml\(entry, monthClosed, month\.key\)/);
});

test("Registrar el mes · los botones del aviso están delegados en el mismo listener de la tabla", () => {
  assert.match(
    app,
    /const annualButton = event\.target\.closest\("\[data-registrar-mes-annual-key\]"\);\s*\n\s*if \(annualButton\) handleRegistrarMesAnnualChoice\(annualButton\.dataset\.registrarMesAnnualKey, annualButton\.dataset\.registrarMesAnnualChoice\);/,
  );
});

test("La elección persiste: saveScenarioSettings incluye registrarMesAnnualAck en su lista blanca", () => {
  assert.match(app, /registrarMesAnnualAck: state\.registrarMesAnnualAck \|\| \{\},/);
});

test("Datos · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
  assert.match(html, /design-tokens\.css\?v=20260814f1a1/);
});
