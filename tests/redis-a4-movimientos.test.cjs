const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// Rediseño · fase A4, PR-1 (docs/rediseno/HANDOFF.md §5 «B3 · Movimientos»): Movimientos v2 detrás del tema v2.
// Comprueba que (1) solo se pinta con la bandera y la vista de siempre sigue entera tras «Ver todo el detalle»,
// (2) la tarjeta de anomalías (WP-36) no se esconde salvo sin movimientos, (3) la lista lee la partida del mismo
// diccionario de reglas y marca el hueco como «¿partida?», y (4) con 0 movimientos hay un solo bloque que lleva a
// Importar.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mov = read("views/movimientos-v2.js");
const css = read("tema-v2.css");

function sandbox({ transactions = [], mappings = {}, tema = "v2" } = {}) {
  const elements = {};
  const element = (id) => {
    if (!elements[id]) {
      const classes = new Set();
      elements[id] = {
        id,
        hidden: true,
        innerHTML: "",
        dataset: {},
        addEventListener() {},
        classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
      };
    }
    return elements[id];
  };
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    money: (value) => `${String(value).replace(".", ",")} €`,
    normalizedText: (value) => String(value ?? "").toLowerCase(),
    mappingForMovement: (row) => (mappings[row.movement] ? { row: { label: mappings[row.movement] } } : null),
    displayLabelForRow: (row) => row.label,
    movementMappingKey: (row) => String(row.movement).toLowerCase(),
    isoLocalDate: (date) => date.toISOString().slice(0, 10),
    closeTargetInfo: () => ({ monthKey: "2026-10" }),
    baseData: { transactions },
    document: { documentElement: { dataset: { tema } } },
    qs: (id) => element(id),
    Intl,
    globalThis: {},
  };
  vm.createContext(context);
  vm.runInContext(mov, context);
  return { context, elements, element };
}

const row = (date, movement, amount, account = "CaixaBank") => ({ date, movement, details: "", amount, account });

test("se carga con defer antes de app.js y está en el sitio público y el service worker", () => {
  const html = read("index.html");
  const at = html.indexOf('<script defer src="views/movimientos-v2.js');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js'), "views/movimientos-v2.js con defer y antes de app.js");
  assert.ok(read("service-worker.js").includes('"./views/movimientos-v2.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"views/movimientos-v2.js"'));
});

test("app.js solo añade la llamada al pintar Movimientos y el panel de detalle por fila, sin otra lógica", () => {
  const app = codigoApp();
  assert.match(app, /globalThis\.renderAnomalias\?\.\(globalThis\.FinanceCanonicalStatementAnomalies\);[^\n]*\n\s*globalThis\.movimientosV2Render\?\.\(\);/);
  assert.match(app, /function handleMovementDetailOpen\(index\) \{\s*openMovementDetailRow\(movementsFilteredList\(\)\[Number\(index\)\]\);\s*\}/);
  assert.match(app, /function openMovementDetailRow\(row\) \{\s*if \(!row\) return;\s*movementDetailTransaction = row;/);
  const html = read("index.html");
  const section = html.indexOf('id="movements"');
  assert.ok(html.indexOf('<div class="mov-v2" id="movimientosV2" hidden></div>') > section);
  assert.ok(html.indexOf('id="movimientosV2Lista" hidden></div>') > section);
  assert.ok(html.indexOf('id="movimientosV2Lista"') < html.indexOf('id="anomaliasCard"'), "los dos contenedores van al principio de la sección");
});

test("la vista de siempre solo se oculta cuando la v2 está pintada; anomalías siguen a la vista y el detalle lo devuelve todo", () => {
  assert.match(css, /#movements:has\(> #movimientosV2:not\(\[hidden\]\)\):not\(\.mov-v2-detalle\) > :not\(\.mov-v2\):not\(#anomaliasCard\),/);
  assert.match(css, /#movements\.mov-v2-vacia:has\(> #movimientosV2:not\(\[hidden\]\)\):not\(\.mov-v2-detalle\) > #anomaliasCard \{/);
  assert.match(css, /> #anomaliasCard \{\s*order: 2;/);
  assert.match(mov, /MOV_V2_DETAIL_CLASS = "mov-v2-detalle"/);
  // El svg de los iconos no hereda el min-height de 350 px de styles.css (ESTADO.md §5).
  assert.match(css, /\.mov-v2-ico \{[^}]*min-height: 0;/);
});

test("sin la bandera no pinta nada", () => {
  const { context, element } = sandbox({ tema: "", transactions: [row("2026-10-16", "Mercadona", -86.4)] });
  element("movimientosV2").hidden = false;
  context.movimientosV2Render();
  assert.equal(element("movimientosV2").hidden, true);
  assert.equal(element("movimientosV2Lista").innerHTML, "");
});

test("con 0 movimientos, un solo bloque que lleva a Importar y la tarjeta de anomalías tras el detalle", () => {
  const { context, element } = sandbox();
  context.movimientosV2Render();
  const top = element("movimientosV2").innerHTML;
  assert.equal(element("movimientosV2").hidden, false);
  assert.match(top, /Todavía no hay movimientos/);
  assert.equal((top.match(/data-mov-v2-nav="datos-importar"/g) || []).length, 2, "el + de la cabecera y el botón del bloque");
  assert.ok(!top.includes("Bandeja"), "sin bandeja vacía");
  assert.match(element("movimientosV2Lista").innerHTML, /data-mov-v2-detail/);
  assert.ok(element("movements").classList.contains("mov-v2-vacia"));
});

test("lista por día, del más reciente al más antiguo, con la partida del diccionario o «¿partida?»", () => {
  const transactions = [row("2026-10-15", "Iberdrola", -94.12), row("2026-10-16", "Mercadona", -86.4), row("2026-10-16", "Bizum 6123", -25), row("2026-10-15", "Nomina", 3000)];
  const { context, element } = sandbox({ transactions, mappings: { Mercadona: "Supermercado", Iberdrola: "Servicios", Nomina: "Ingreso" } });
  context.movimientosV2Render();
  const list = element("movimientosV2Lista").innerHTML;
  assert.ok(!element("movements").classList.contains("mov-v2-vacia"));
  assert.ok(list.indexOf("Mercadona") < list.indexOf("Iberdrola"), "el 16 antes que el 15");
  assert.equal((list.match(/class="mov-v2-dia"/g) || []).length, 2);
  assert.match(list, /<span class="mov-v2-tag">Supermercado<\/span>/);
  assert.match(list, /<span class="mov-v2-tag is-missing">¿partida\?<\/span>/);
  assert.match(list, /\+3000 €/, "los ingresos llevan signo +");
  assert.match(list, /mov-v2-importe is-pos/);
  assert.match(list, /data-mov-v2-nav="cierre"/, "acceso a Cierre al final");
  // Bandeja: un concepto sin partida (Bizum).
  assert.match(element("movimientosV2").innerHTML, /Un concepto sin partida/);
});

test("filtros por cuenta y «Sin partida», y la búsqueda por concepto o partida", () => {
  const transactions = [row("2026-10-16", "Mercadona", -86.4), row("2026-10-14", "Repsol", -58, "Mediolanum"), row("2026-10-13", "Bizum", -25)];
  const { context } = sandbox({ transactions, mappings: { Mercadona: "Supermercado", Repsol: "Coche" } });
  const all = context.movV2AllRows();
  assert.match(context.movV2Chips(all), /data-mov-v2-filtro="Mediolanum"/);
  vm.runInContext('movV2Filter = "Mediolanum"', context);
  assert.deepEqual(context.movV2Filtered(all).map((item) => item.row.movement), ["Repsol"]);
  vm.runInContext('movV2Filter = "sin-partida"', context);
  assert.deepEqual(context.movV2Filtered(all).map((item) => item.row.movement), ["Bizum"]);
  vm.runInContext('movV2Filter = "todas"; movV2Search = "supermercado"', context);
  assert.deepEqual(context.movV2Filtered(all).map((item) => item.row.movement), ["Mercadona"]);
});

test("enseña 40 y deja pedir más; tocar un movimiento abre el mismo panel de detalle con esa fila", () => {
  const transactions = Array.from({ length: 45 }, (_, index) => row(`2026-09-${String((index % 28) + 1).padStart(2, "0")}`, `Gasto ${index}`, -1 - index));
  const { context, element } = sandbox({ transactions });
  context.movimientosV2Render();
  const list = element("movimientosV2Lista").innerHTML;
  assert.equal((list.match(/data-mov-v2-index=/g) || []).length, 40);
  assert.match(list, /Ver 5 más \(quedan 5\)/);
  let opened = null;
  context.openMovementDetailRow = (rowArg) => { opened = rowArg; };
  context.movV2OpenDetail("0");
  assert.equal(opened, vm.runInContext("movV2Shown[0]", context));
  assert.match(mov, /if \(row && typeof openMovementDetailRow === "function"\) openMovementDetailRow\(row\)/);
});

test("lo que aún no existe va plegado en una línea, sin cifras inventadas", () => {
  const { context } = sandbox();
  const line = context.movV2Pending();
  assert.match(line, /Compartir/);
  assert.match(line, /cobertura de 90 días/);
  assert.ok(!/€/.test(line));
  assert.ok(!/cuadra al céntimo/.test(mov), "sin el cuadre de ejemplo de la referencia");
});
