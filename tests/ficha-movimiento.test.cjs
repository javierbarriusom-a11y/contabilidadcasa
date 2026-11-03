// Ficha de un movimiento (ficha-movimiento-ui.js, 3/11/2026). Petición del hogar con su primer cierre: las casillas
// «Recordar…» salían enormes y fuera de sitio, no quedaba claro qué guardaba cada botón ni si la partida y el tipo de
// acción dependían uno del otro, y faltaba confirmación y control de errores al guardar. Aquí se carga el fichero entero
// en un vm (con las funciones de «sin mes» reales de datos-ui.js) y se comprueba lo que el hogar ve y lo que se escribe.
// Conceptos, importes y partidas INVENTADOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const ficha = read("ficha-movimiento-ui.js");
const datos = read("datos-ui.js");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const bodyStart = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function el(extra = {}) {
  return { value: "", checked: false, hidden: false, disabled: false, textContent: "", dataset: {}, focus() { this.focused = true; }, addEventListener() {}, ...extra };
}

const OCT = { date: "2026-10-30", month: "2026-10", movement: "FINANCIE-OCTUBRE", details: "Recibo entidad ficticia", amount: -100, account: "CaixaBank" };
const SEP = { date: "2026-09-30", month: "2026-09", movement: "FINANCIE-SEPTIEMB", details: "Recibo entidad ficticia", amount: -100 };
const AGO = { date: "2026-08-29", month: "2026-08", movement: "FINANCIE-AGOSTO", details: "Recibo entidad ficticia", amount: -100 };
const MERCA = { date: "2026-10-12", month: "2026-10", movement: "SUPER FICTICIO", details: "", amount: -40 };
const ROWS = {
  vieja: { key: "expense|vieja", sectionName: "Financiaciones", label: "Tarjeta vieja" },
  nueva: { key: "expense|nueva", sectionName: "Financiaciones", label: "Préstamo nuevo" },
};

function cargar({ row = OCT, mapping = null, action = null, movementMappings = {}, movementActionTypes = {}, elementos = {}, transactions = [OCT, SEP, AGO, MERCA] } = {}) {
  const calls = [];
  const content = el({ innerHTML: "" });
  const els = { movementDetailContent: content, ...elementos };
  const ctx = {
    console, Date, Map, Set, Object, String, Number, Math, JSON,
    movementDetailTransaction: row,
    baseData: { transactions },
    movementMappings,
    movementActionTypes,
    pendingMovementMappings: [],
    ACTION_TYPE_LABELS: { pago_deuda: "Pago de deuda", ajuste: "Ajuste" },
    qs: (id) => els[id] || null,
    escapeHtml: (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    formatIsoDate: (v) => v || "—",
    money: (v) => `${v} €`,
    movementKindFromAmount: (amount) => (Number(amount) < 0 ? "expense" : "income"),
    movementMappingKey: (tx) => `${Number(tx.amount) < 0 ? "expense" : "income"}|${String(tx.movement).toLowerCase()}|${String(tx.details || "").toLowerCase()}`,
    transactionIdentity: (tx) => `${tx.date}|${tx.movement}|${tx.amount}`,
    movementDisplayName: (tx) => (tx.details ? `${tx.movement} · ${tx.details}` : tx.movement),
    mappingForMovement: () => mapping,
    actionTypeForMovement: () => action,
    seriesKeyForRow: (r) => r.key,
    displayLabelForRow: (r) => r.label,
    movementMappingOptions: (kind, selected) => `<option value="${selected}" selected></option>`,
    movementActionTypeOptions: (selected) => `<option value="${selected}" selected></option>`,
    movementDetailAttachmentHtml: () => "",
    isSignedClosedMonthKey: (mes) => mes === "2026-08",
    saveMovementMappings: () => calls.push("saveMovementMappings"),
    saveMovementActionTypes: () => calls.push("saveMovementActionTypes"),
    applyMovementMappingsToActuals: () => { calls.push("applyMovementMappingsToActuals"); return 2; },
    buildPendingMovementMappings: () => { calls.push("buildPendingMovementMappings"); return []; },
    datosImportarRefreshRowsForMappings: (keys) => calls.push(["datosImportarRefreshRowsForMappings", [...keys].sort()]),
    saveIncomeActuals: () => calls.push("saveIncomeActuals"),
    saveExpenseActuals: () => calls.push("saveExpenseActuals"),
    refreshAllSectionsAfterDataChange: () => calls.push("refreshAllSectionsAfterDataChange"),
    announceStatus: (message) => calls.push(["announceStatus", message]),
    renderDetailedMovements: () => calls.push("renderDetailedMovements"),
  };
  vm.createContext(ctx);
  vm.runInContext(
    `${extractFunction(datos, "movementMappingMonthlessKey")}\n${extractFunction(datos, "movementMappingGroupKey")}\n${ficha}\n` +
      "this.api = { renderMovementDetailDialog, handleMovementReclassify, handleMovementActionTypeSave, fichaMovSincroniza, fichaMovDeshacer, fichaMovTipoDeOtroMes, aviso: () => fichaMovAviso };",
    ctx,
  );
  return { ctx, api: ctx.api, calls, content, els };
}

// --- Lo que se ve ---------------------------------------------------------------------------------

test("los datos del movimiento siguen ahí, Cuenta incluida, con «—» cuando falta (M-6)", () => {
  const { api, content } = cargar();
  api.renderMovementDetailDialog();
  assert.match(content.innerHTML, /<dt>Cuenta<\/dt><dd>CaixaBank<\/dd>/);
  const sin = cargar({ row: SEP });
  sin.api.renderMovementDetailDialog();
  assert.match(sin.content.innerHTML, /<dt>Cuenta<\/dt><dd>—<\/dd>/);
});

test("ninguna casilla: «¿A cuáles?» son dos opciones en cada bloque, con su texto al lado", () => {
  const { api, content } = cargar();
  api.renderMovementDetailDialog();
  const html = content.innerHTML;
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.equal((html.match(/<legend>¿A cuáles\?<\/legend>/g) || []).length, 2);
  assert.match(html, /<label><input type="radio" name="movementDetailAlcance" value="uno" id="movementDetailSolo" checked \/><span>Solo a este movimiento<\/span><\/label>/);
  assert.match(html, /<input type="radio" name="movementDetailAlcance" value="todos" id="movementDetailRemember" \/>/);
  assert.match(html, /id="movementDetailActionTypeRemember"/);
  assert.doesNotMatch(html, /Recordar para los que empiecen igual|P-1: eje aditivo/);
});

test("«todos» dice cuántos movimientos son, de cuántos meses, que vale para cualquier mes y que lo firmado no cambia", () => {
  const { api, content } = cargar();
  api.renderMovementDetailDialog();
  assert.match(content.innerHTML, /A todos los «FINANCIE-OCTUBRE · Recibo entidad ficticia» de cualquier mes \(3 movimientos de 3 meses\) y a los que vengan<small>en los meses ya firmados no cambian los reales\.<\/small>/);
  const unico = cargar({ row: MERCA });
  unico.api.renderMovementDetailDialog();
  assert.match(unico.content.innerHTML, /A todos los «SUPER FICTICIO» \(por ahora solo está este\) y a los que vengan<\/span>/);
});

test("un movimiento con su excepción propia la cuenta aparte: «todos» no la pisa", () => {
  const { api, content } = cargar({ movementMappings: { [`${SEP.date}|${SEP.movement}|${SEP.amount}`]: { kind: "expense", rowKey: "expense|vieja" } } });
  api.renderMovementDetailDialog();
  assert.match(content.innerHTML, /<small>1 tiene la suya propia y no cambia · en los meses ya firmados no cambian los reales\.<\/small>/);
  assert.match(content.innerHTML, /id="movementDetailSave" data-inicial="" data-inicial-todos="false" data-total-todos="2"/);
});

test("cada bloque dice cómo está ahora; el tipo de acción va aparte, marcado como opcional", () => {
  const sin = cargar();
  sin.api.renderMovementDetailDialog();
  assert.match(sin.content.innerHTML, /Ahora: <strong>sin partida<\/strong>\. No cuenta en los reales de ninguna\./);
  assert.match(sin.content.innerHTML, /Tipo de acción <span class="ficha-mov-opcional">opcional<\/span>/);
  assert.match(sin.content.innerHTML, /Va aparte de la partida y no cambia ningún importe/);
  const regla = cargar({ mapping: { row: ROWS.vieja, source: "dictionary" }, action: { actionType: "pago_deuda", recurring: null, confirmed: false, source: "suggested" } });
  regla.api.renderMovementDetailDialog();
  assert.match(regla.content.innerHTML, /Ahora: <strong>Financiaciones · Tarjeta vieja<\/strong> · por la regla de este concepto\./);
  assert.match(regla.content.innerHTML, /Ahora: <strong>Pago de deuda<\/strong> · propuesto por la partida, sin confirmar\./);
  const solo = cargar({ mapping: { row: ROWS.vieja, source: "single" }, action: { actionType: "ajuste", recurring: true, confirmed: true, source: "single" } });
  solo.api.renderMovementDetailDialog();
  assert.match(solo.content.innerHTML, /Ahora: <strong>Financiaciones · Tarjeta vieja<\/strong> · solo este movimiento\./);
  assert.match(solo.content.innerHTML, /Ahora: <strong>Ajuste, se repite cada mes<\/strong> · solo este movimiento\./);
});

test("si el movimiento ya va por la regla, «todos» viene marcado: cambiar aquí cambia la regla, no crea una excepción callada", () => {
  const { api, content } = cargar({ mapping: { row: ROWS.vieja, source: "dictionary" }, action: { actionType: "pago_deuda", recurring: null, confirmed: true, source: "dictionary" } });
  api.renderMovementDetailDialog();
  assert.match(content.innerHTML, /value="uno" id="movementDetailSolo" \/>/);
  assert.match(content.innerHTML, /value="todos" id="movementDetailRemember" checked \/>/);
  assert.match(content.innerHTML, /value="todos" id="movementDetailActionTypeRemember" checked \/>/);
  assert.match(content.innerHTML, /id="movementDetailSave" data-inicial="expense\|vieja" data-inicial-todos="true"/);
});

test("el botón está apagado mientras no cambie nada y, al cambiar, dice a cuántos movimientos afecta", () => {
  const boton = el({ dataset: { inicial: "expense|vieja", inicialTodos: "false", totalTodos: "3" } });
  const select = el({ value: "expense|vieja" });
  const todos = el({ checked: false });
  const pista = el();
  const { api } = cargar({ elementos: { movementDetailSave: boton, movementDetailPartida: select, movementDetailRemember: todos, movementDetailPista: pista } });
  api.fichaMovSincroniza("partida");
  assert.equal(boton.disabled, true);
  assert.equal(boton.textContent, "Guardar partida");
  assert.equal(pista.hidden, false);
  select.value = "expense|nueva";
  api.fichaMovSincroniza("partida");
  assert.equal(boton.disabled, false);
  assert.equal(boton.textContent, "Guardar partida · 1 movimiento");
  assert.equal(pista.hidden, true);
  todos.checked = true;
  api.fichaMovSincroniza("partida");
  assert.equal(boton.textContent, "Guardar partida · 3 movimientos");
  select.value = "expense|vieja";
  api.fichaMovSincroniza("partida");
  assert.equal(boton.disabled, false, "pasar de este solo a todos también es un cambio");
});

test("tipo de acción: sin tipo ni propuesta, el botón está apagado; con una propuesta sin confirmar, encendido para confirmarla", () => {
  const prueba = (action, tipo) => {
    const boton = el();
    const elementos = { movementDetailActionTypeSave: boton, movementDetailActionType: el({ value: tipo }), movementDetailRecurring: el({ value: "" }), movementDetailActionTypeRemember: el() };
    const { api, content } = cargar({ action, elementos });
    api.renderMovementDetailDialog();
    const inicial = content.innerHTML.match(/id="movementDetailActionTypeSave" data-inicial="([^"]*)" data-inicial-todos="(\w+)"/);
    boton.dataset = { inicial: inicial[1], inicialTodos: inicial[2], totalTodos: "3" };
    api.fichaMovSincroniza("tipo");
    return boton;
  };
  assert.equal(prueba(null, "").disabled, true);
  const propuesta = prueba({ actionType: "pago_deuda", recurring: null, confirmed: false, source: "suggested" }, "pago_deuda");
  assert.equal(propuesta.disabled, false);
  assert.equal(propuesta.textContent, "Guardar tipo de acción · 1 movimiento");
  assert.equal(prueba({ actionType: "pago_deuda", recurring: null, confirmed: true, source: "single" }, "pago_deuda").disabled, true);
});

// --- Lo que se guarda -----------------------------------------------------------------------------

function elementosPartida(valor, todos) {
  return {
    movementDetailPartida: el({ value: valor, options: [{ textContent: "Financiaciones · Préstamo nuevo" }], selectedIndex: 0 }),
    movementDetailRemember: el({ checked: todos }),
    movementDetailError: el({ hidden: true }),
  };
}

test("«solo a este» guarda por su identidad, no toca la regla y lo confirma diciendo que los demás siguen donde estaban", () => {
  const regla = { kind: "expense", rowKey: "expense|vieja", label: "Financiaciones · Tarjeta vieja", updatedAt: "2026-10-01T00:00:00.000Z" };
  const movementMappings = { "expense|financie-octubre|recibo entidad ficticia": { ...regla } };
  const { api, calls } = cargar({ mapping: { row: ROWS.vieja, source: "dictionary" }, movementMappings, elementos: elementosPartida("expense|nueva", false) });
  api.handleMovementReclassify();
  assert.deepEqual(movementMappings["expense|financie-octubre|recibo entidad ficticia"], regla);
  assert.equal(movementMappings["2026-10-30|FINANCIE-OCTUBRE|-100"].rowKey, "expense|nueva");
  assert.ok(!calls.some((call) => Array.isArray(call) && call[0] === "datosImportarRefreshRowsForMappings"), "una excepción no refresca la importación a medias");
  assert.equal(api.aviso().texto, "Este movimiento va ahora a «Financiaciones · Préstamo nuevo». Los demás «FINANCIE-OCTUBRE · Recibo entidad ficticia» siguen en «Financiaciones · Tarjeta vieja».");
  assert.deepEqual(calls.slice(0, 6), ["saveMovementMappings", "applyMovementMappingsToActuals", "buildPendingMovementMappings", "saveIncomeActuals", "saveExpenseActuals", "refreshAllSectionsAfterDataChange"]);
  assert.equal(calls.at(-1), "renderDetailedMovements", "la lista se repinta con la partida nueva");
});

test("«todos» escribe la regla de su mes y la de los otros meses del concepto, quita su excepción y refresca la importación a medias (M-8b)", () => {
  const vieja = { kind: "expense", rowKey: "expense|vieja", label: "Financiaciones · Tarjeta vieja", updatedAt: "2026-10-01T00:00:00.000Z" };
  const movementMappings = {
    "expense|financie-septiemb|recibo entidad ficticia": { ...vieja },
    "2026-10-30|FINANCIE-OCTUBRE|-100": { ...vieja },
    "expense|super ficticio|": { ...vieja },
  };
  const { api, calls } = cargar({ mapping: { row: ROWS.vieja, source: "single" }, movementMappings, elementos: elementosPartida("expense|nueva", true) });
  api.handleMovementReclassify();
  assert.equal(movementMappings["expense|financie-octubre|recibo entidad ficticia"].rowKey, "expense|nueva");
  assert.equal(movementMappings["expense|financie-septiemb|recibo entidad ficticia"].rowKey, "expense|nueva", "la regla de septiembre ya no manda en su mes");
  assert.equal(movementMappings["2026-10-30|FINANCIE-OCTUBRE|-100"], undefined, "la excepción de este movimiento se quita");
  assert.equal(movementMappings["expense|super ficticio|"].rowKey, "expense|vieja", "otro concepto no se toca");
  assert.deepEqual(calls.find((call) => Array.isArray(call) && call[0] === "datosImportarRefreshRowsForMappings"), [
    "datosImportarRefreshRowsForMappings",
    ["expense|financie-octubre|recibo entidad ficticia", "expense|financie-septiemb|recibo entidad ficticia"],
  ]);
  assert.equal(api.aviso().texto, "3 movimientos de «FINANCIE-OCTUBRE · Recibo entidad ficticia» van ahora a «Financiaciones · Préstamo nuevo», también los que vengan. En los meses firmados no cambian los reales.");
  assert.ok(calls.some((call) => Array.isArray(call) && call[0] === "announceStatus" && call[1] === api.aviso().texto));
});

test("«Deshacer» deja el diccionario exactamente como estaba y vuelve a recalcular", () => {
  const vieja = { kind: "expense", rowKey: "expense|vieja", label: "Financiaciones · Tarjeta vieja", updatedAt: "2026-10-01T00:00:00.000Z" };
  const movementMappings = { "expense|financie-septiemb|recibo entidad ficticia": { ...vieja }, "2026-10-30|FINANCIE-OCTUBRE|-100": { ...vieja } };
  const antes = JSON.parse(JSON.stringify(movementMappings));
  const { api, calls } = cargar({ movementMappings, elementos: elementosPartida("expense|nueva", true) });
  api.handleMovementReclassify();
  const guardados = calls.filter((call) => call === "saveMovementMappings").length;
  api.fichaMovDeshacer();
  assert.deepEqual(JSON.parse(JSON.stringify(movementMappings)), antes);
  assert.equal(calls.filter((call) => call === "saveMovementMappings").length, guardados + 1);
  assert.equal(api.aviso(), null);
  assert.ok(calls.some((call) => Array.isArray(call) && call[1] === "Deshecho: todo vuelve a como estaba antes de guardar."));
});

test("sin partida elegida, el error sale junto al campo, se anuncia y no se escribe nada", () => {
  const movementMappings = {};
  const elementos = elementosPartida("", false);
  const { api, calls } = cargar({ movementMappings, elementos });
  api.handleMovementReclassify();
  assert.deepEqual(movementMappings, {});
  assert.equal(elementos.movementDetailError.hidden, false);
  assert.equal(elementos.movementDetailError.textContent, "Elige una partida antes de guardar.");
  assert.equal(elementos.movementDetailPartida.focused, true);
  assert.deepEqual(calls, [["announceStatus", "Elige una partida antes de guardar."]]);
});

// --- Tipo de acción (P-1) -------------------------------------------------------------------------

function elementosTipo(tipo, recurrente, todos) {
  return {
    movementDetailActionType: el({ value: tipo }),
    movementDetailRecurring: el({ value: recurrente }),
    movementDetailActionTypeRemember: el({ checked: todos }),
    movementDetailActionTypeError: el({ hidden: true }),
  };
}

test("tipo de acción «solo a este»: se guarda por su identidad, con «¿es recurrente?» sin marcar como null", () => {
  const movementActionTypes = {};
  const { api, calls } = cargar({ movementActionTypes, elementos: elementosTipo("pago_deuda", "", false) });
  api.handleMovementActionTypeSave();
  const saved = movementActionTypes["2026-10-30|FINANCIE-OCTUBRE|-100"];
  assert.equal(saved.actionType, "pago_deuda");
  assert.equal(saved.recurring, null);
  assert.equal(api.aviso().texto, "Este movimiento es ahora «Pago de deuda».");
  assert.equal(api.aviso().bloque, "tipo");
  assert.ok(!calls.includes("saveMovementMappings"), "no toca la partida");
});

test("tipo de acción «todos»: regla del concepto en todos sus meses, sin la excepción, y se deshace", () => {
  const movementActionTypes = { "expense|financie-agosto|recibo entidad ficticia": { actionType: "ajuste", recurring: null, updatedAt: "2026-09-01T00:00:00.000Z" } };
  const antes = JSON.parse(JSON.stringify(movementActionTypes));
  const { api } = cargar({ movementActionTypes, elementos: elementosTipo("pago_deuda", "true", true) });
  api.handleMovementActionTypeSave();
  assert.equal(movementActionTypes["expense|financie-octubre|recibo entidad ficticia"].actionType, "pago_deuda");
  assert.equal(movementActionTypes["expense|financie-octubre|recibo entidad ficticia"].recurring, true);
  assert.equal(movementActionTypes["expense|financie-agosto|recibo entidad ficticia"].actionType, "pago_deuda");
  assert.equal(api.aviso().texto, "3 movimientos de «FINANCIE-OCTUBRE · Recibo entidad ficticia» son ahora «Pago de deuda», también los que vengan.");
  api.fichaMovDeshacer();
  assert.deepEqual(JSON.parse(JSON.stringify(movementActionTypes)), antes);
});

test("tipo de acción sin elegir: error junto al campo y nada escrito", () => {
  const movementActionTypes = {};
  const elementos = elementosTipo("", "", false);
  const { api, calls } = cargar({ movementActionTypes, elementos });
  api.handleMovementActionTypeSave();
  assert.deepEqual(movementActionTypes, {});
  assert.equal(elementos.movementDetailActionTypeError.textContent, "Elige un tipo de acción antes de guardar.");
  assert.equal(elementos.movementDetailActionTypeError.hidden, false);
  assert.deepEqual(calls, [["announceStatus", "Elige un tipo de acción antes de guardar."]]);
});

test("la regla de tipo de acción vale para el concepto de cualquier mes (la más reciente), como la de partida", () => {
  const movementActionTypes = {
    "expense|financie-agosto|recibo entidad ficticia": { actionType: "ajuste", updatedAt: "2026-09-01T00:00:00.000Z" },
    "expense|financie-septiemb|recibo entidad ficticia": { actionType: "pago_deuda", updatedAt: "2026-10-01T00:00:00.000Z" },
  };
  const { api } = cargar({ movementActionTypes });
  assert.equal(api.fichaMovTipoDeOtroMes(OCT).actionType, "pago_deuda");
  assert.equal(api.fichaMovTipoDeOtroMes(MERCA), null, "un concepto sin mes no busca en otros");
});

// --- Cableado ------------------------------------------------------------------------------------

test("cableado: se carga con defer antes de app.js, va en la web pública y en el service worker, y app.js ya no la define", () => {
  const html = read("index.html");
  const pos = (src) => html.search(new RegExp(`<script defer src="${src.replace(/\./g, "\\.")}\\?`));
  assert.ok(pos("ficha-movimiento-ui.js") !== -1 && pos("ficha-movimiento-ui.js") < pos("app.js"));
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"ficha-movimiento-ui\.js",$/m);
  assert.match(read("service-worker.js"), /"\.\/ficha-movimiento-ui\.js",/);
  const app = read("app.js");
  ["renderMovementDetailDialog", "handleMovementReclassify", "handleMovementActionTypeSave"].forEach((name) => {
    assert.doesNotMatch(app, new RegExp(`^function ${name}\\(`, "m"), `${name} vive en ficha-movimiento-ui.js`);
  });
  assert.match(app, /fichaMovTipoDeOtroMes\(transaction\)/, "actionTypeEntryForMovement mira la regla de otro mes");
  assert.match(app, /fichaMovAviso = null;/, "cerrar la ficha olvida su «Deshacer»");
});

test("las opciones no heredan el 100 % de ancho ni los 40 px de alto de todo input", () => {
  const css = read("styles.css");
  assert.match(css, /\.ficha-mov-alcance input\[type="radio"\] \{[^}]*width: 18px;[^}]*height: 18px;[^}]*min-height: 0;/);
  assert.match(css, /\.ficha-mov-alcance label \{[^}]*display: flex;[^}]*align-items: flex-start;/);
});
