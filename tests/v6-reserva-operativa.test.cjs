const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const tokens = read("design-tokens.css");
const worker = read("service-worker.js");

// `app.js` es un script de navegador, no un módulo: no se puede `require`. Para probar de verdad
// —y no solo por coincidencia de texto— el comportamiento de V6-1/V6-3, se extraen sus funciones
// por nombre balanceando llaves y se ejecutan en un contexto con los mínimos ayudantes que usan.
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let depth = 0;
  for (let index = app.indexOf("{", start); index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

const RESERVE_FUNCTIONS = [
  "cuadroMandosReserve",
  "operatingReserveFromField",
  "syncOperatingReserveControl",
  "renderCuadroMandosReserveNote",
  "renderAjustesReserveNote",
  "handleOperatingReserveChange",
  "renderDeudaCompararReserveNote",
];

function field(value = "") {
  return { value, textContent: "" };
}

function sandbox({ reserve, fields = {}, focus = null, debtStrategyReserveValue = null } = {}) {
  const elements = new Map(Object.entries(fields));
  const saves = [];
  const announcements = [];
  const renders = [];
  const context = {
    state: reserve === undefined ? {} : { operatingReserve: reserve },
    document: { activeElement: focus },
    debtStrategyReserveValue,
    qs: (id) => elements.get(id) || null,
    money: (value) => `${Math.round(Number(value) * 100) / 100} €`,
    round2: (value) => Math.round(Number(value) * 100) / 100,
    saveScenarioSettings: () => saves.push(true),
    announceStatus: (text) => announcements.push(text),
    render: () => renders.push(true),
  };
  vm.createContext(context);
  vm.runInContext(RESERVE_FUNCTIONS.map(extractFunction).join("\n"), context, {
    filename: "app.js#v6-reserva-operativa",
  });
  return { context, saves, announcements, renders };
}

test("V6-1 · escribir un importe lo guarda como reserva operativa del hogar", () => {
  const input = field("1200,50");
  const { context, saves, announcements, renders } = sandbox({ fields: { ajustesReserve: input } });

  context.handleOperatingReserveChange({ target: input });

  assert.equal(context.state.operatingReserve, 1200.5);
  assert.equal(input.value, "1200.5");
  assert.equal(saves.length, 1);
  assert.equal(renders.length, 1);
  assert.match(announcements[0], /Reserva operativa guardada/);
});

test("V6-1 · vaciar la casilla significa «sin reserva», no cero, y devuelve cada pantalla a su respaldo", () => {
  const input = field("");
  const { context, saves, announcements } = sandbox({ reserve: 1200, fields: { ajustesReserve: input } });

  context.handleOperatingReserveChange({ target: input });

  assert.equal(context.state.operatingReserve, 0);
  assert.equal(context.cuadroMandosReserve(), 0);
  assert.equal(saves.length, 1);
  assert.match(announcements[0], /respaldo declarado/);
});

test("V6-1 · un importe negativo o no interpretable nunca se guarda como reserva", () => {
  for (const raw of ["-50", "abc", "0", "   "]) {
    const input = field(raw);
    const { context } = sandbox({ reserve: 900, fields: { ajustesReserve: input } });
    context.handleOperatingReserveChange({ target: input });
    assert.equal(context.state.operatingReserve, 0, `«${raw}» no debe quedar como reserva`);
    assert.equal(input.value, "");
  }
});

test("V6-1 · reescribir el mismo importe no vuelve a guardar ni a recalcular", () => {
  const input = field("1500");
  const { context, saves, renders } = sandbox({ reserve: 1500, fields: { ajustesReserve: input } });

  context.handleOperatingReserveChange({ target: input });

  assert.equal(saves.length, 0);
  assert.equal(renders.length, 0);
  assert.equal(context.state.operatingReserve, 1500);
});

test("V6-3 · la casilla de Ajustes refleja lo guardado y respeta lo que se está escribiendo", () => {
  const input = field("");
  const { context } = sandbox({ reserve: 2000, fields: { ajustesReserve: input } });
  context.syncOperatingReserveControl();
  assert.equal(input.value, "2000");

  const vacia = field("");
  const sinReserva = sandbox({ fields: { ajustesReserve: vacia } });
  sinReserva.context.syncOperatingReserveControl();
  assert.equal(vacia.value, "");

  const escribiendo = field("34");
  const enFoco = sandbox({ reserve: 2000, fields: { ajustesReserve: escribiendo }, focus: escribiendo });
  enFoco.context.syncOperatingReserveControl();
  assert.equal(escribiendo.value, "34");
});

test("V6-3 · Ajustes declara qué suelo está en uso en las tres pantallas que lo consumen", () => {
  const note = field();
  const configurada = sandbox({ reserve: 1800, fields: { ajustesReserveNote: note } });
  configurada.context.renderAjustesReserveNote();
  assert.match(note.textContent, /Reserva operativa: 1800 €/);
  assert.match(note.textContent, /mapa de calor/);
  assert.match(note.textContent, /comparador de deuda/);

  const vacia = field();
  const sinConfigurar = sandbox({ fields: { ajustesReserveNote: vacia } });
  sinConfigurar.context.renderAjustesReserveNote();
  assert.match(vacia.textContent, /Sin reserva operativa configurada/);
  assert.match(vacia.textContent, /meses en negativo/);
  assert.match(vacia.textContent, /un mes de salidas/);
  assert.match(vacia.textContent, /suelo de 0 €/);
});

test("V6-3 · Cuadro de mandos pasa a ser un consumidor más, con nota de solo lectura", () => {
  const note = field();
  const configurada = sandbox({ reserve: 1800, fields: { cuadroMandosReserveNote: note } });
  configurada.context.renderCuadroMandosReserveNote();
  assert.match(note.textContent, /Reserva operativa: 1800 €/);
  assert.match(note.textContent, /Ajustes/);

  const vacia = field();
  const sinConfigurar = sandbox({ fields: { cuadroMandosReserveNote: vacia } });
  sinConfigurar.context.renderCuadroMandosReserveNote();
  assert.match(vacia.textContent, /Sin reserva operativa configurada/);
  assert.match(vacia.textContent, /Ajustes/);
});

test("V6-1 · el comparador de deuda dice de dónde sale la cifra de su casilla", () => {
  const heredada = field();
  const desdeElHogar = sandbox({
    reserve: 1800,
    debtStrategyReserveValue: 1800,
    fields: { deudaCompararReserveNote: heredada },
  });
  desdeElHogar.context.renderDeudaCompararReserveNote();
  assert.match(heredada.textContent, /Es tu reserva operativa \(1800 €\)/);

  const puntual = field();
  const soloAqui = sandbox({
    reserve: 1800,
    debtStrategyReserveValue: 500,
    fields: { deudaCompararReserveNote: puntual },
  });
  soloAqui.context.renderDeudaCompararReserveNote();
  assert.match(puntual.textContent, /Solo para esta comparación/);
  assert.match(puntual.textContent, /1800 €/);

  const sinNada = field();
  const sinReserva = sandbox({ fields: { deudaCompararReserveNote: sinNada } });
  sinReserva.context.renderDeudaCompararReserveNote();
  assert.match(sinNada.textContent, /suelo de 0 €/);
  assert.match(sinNada.textContent, /Ajustes/);
});

test("V6-1 · la reserva se persiste y se sincroniza como un dato más del hogar", () => {
  assert.match(app, /operatingReserve: round2\(Math\.max\(0, Number\(state\.operatingReserve \|\| 0\)\)\)/);
  const settings = app.slice(app.indexOf("function saveScenarioSettings()"));
  assert.ok(settings.indexOf("operatingReserve") < settings.indexOf("queueRemoteSave"));
});

test("V6-3 · el control vive en Ajustes, con ayuda y sin romper el shell offline", () => {
  assert.match(html, /id="ajustesReserve"/);
  assert.match(html, /id="ajustesReserveNote"/);
  assert.match(html, /id="cuadroMandosReserveNote"/);
  assert.match(html, /id="deudaCompararReserveNote"/);
  assert.match(app, /qs\("ajustesReserve"\)\?\.addEventListener\("change", handleOperatingReserveChange\)/);
  assert.match(app, /addHelpToControl\(\s*"ajustesReserve"/);
  assert.match(tokens, /\.cuadro-mandos-reserve-note\b/);
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
