// Rediseño C3 · Cierre nuevo (views/cierre-v2.js, 4/11/2026). Se carga el fichero entero en un vm con lo mínimo de la app.
// Cifras y cuentas INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const fuente = read("views/cierre-v2.js");

function el() {
  return { hidden: true, dataset: {}, innerHTML: "", textContent: "", addEventListener() {}, removeAttribute(name) { if (name === "data-modo") delete this.dataset.modo; } };
}

function cargar({ tema = "v2", modo = null, planEntries = [] } = {}) {
  const els = { cierreV2: el(), cierreTitle: el(), cierreSubtitle: el() };
  const anotado = [];
  const ctx = {
    console, Date, Math, Number, String, Object,
    document: { documentElement: { dataset: { tema } } },
    localStorage: { getItem: (key) => (key === "cierre-v2-modo" ? modo : null), removeItem() {} },
    qs: (id) => els[id] || null,
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    money: (value) => `${String(value).replace(".", ",")} €`,
    cuadroMandosAllMonths: () => [{ key: "2026-10" }],
    planMesCollect: () => ({ expense: planEntries, income: [] }),
    cierrePorClasificarAvisoHtml: () => "",
    cierrePorClasificarContados: () => 0,
    FinanceMedidor: { anotar: (...args) => anotado.push(args) },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fuente, ctx);
  return { ctx, els, anotado };
}

const CUADRA = [{ label: "CaixaBank", status: "cuadra", declared: 1000, calculated: 1000, diff: 0 }, { label: "Mediolanum", status: "cuadra", declared: 20, calculated: 20, diff: 0 }];
const base = (extra = {}) => ({
  monthKey: "2026-10", accountRows: CUADRA, tasks: [], unclassified: 0, monthMovementCount: 12,
  checks: [{ id: "cuentas", label: "Las cuentas cuadran", met: true }, { id: "diferencias", label: "Ninguna diferencia abierta", met: true }, { id: "extracto", label: "Extracto incorporado · 12 movimientos", met: true }],
  syncReady: true, extraSteps: false, ...extra,
});

test("todo cuadra: tres comprobaciones, confianza alta y «Firmar» activo", () => {
  const { ctx, els, anotado } = cargar();
  assert.equal(ctx.renderCierreV2(base()), true);
  const html = els.cierreV2.innerHTML;
  assert.equal(els.cierreV2.dataset.modo, "v2");
  assert.equal(els.cierreTitle.textContent, "Cerrar octubre");
  assert.equal((html.match(/class="cierre-v2-paso /g) || []).length, 3);
  assert.match(html, /Saldos a 31 oct/);
  assert.match(html, /CaixaBank y Mediolanum coinciden con el banco\./);
  assert.match(html, /<strong class="is-alta">alta<\/strong>/);
  assert.match(html, /Todo cuadra: puedes firmar\./);
  assert.match(html, /id="cierreSignButton">Firmar el cierre de octubre<\/button>/);
  assert.doesNotMatch(html, /aria-disabled/);
  assert.deepEqual(anotado, [["cierre-v2", "vista"]]);
});

test("una cuenta que descuadra: el paso 1 falta, dice las cifras y lleva a corregir; la confianza dice la tarea, no la meta", () => {
  const { ctx, els } = cargar();
  ctx.renderCierreV2(base({
    accountRows: [{ label: "CaixaBank", status: "descuadra", declared: 1000, calculated: 900, diff: 100 }, { label: "Mediolanum", status: "sin-conciliar", declared: 20, calculated: null, diff: null }],
    checks: [{ id: "cuentas", label: "Ninguna cuenta descuadra · 1 sin conciliar", met: false }, { id: "extracto", label: "Extracto incorporado · 12 movimientos", met: true }],
  }));
  const html = els.cierreV2.innerHTML;
  assert.match(html, /CaixaBank no cuadra: declarado 1000 €, extracto 900 € \(diferencia 100 €\)\./);
  assert.match(html, /Mediolanum: sin extracto con que comparar \(no bloquea\)\./);
  assert.match(html, /data-cierre-task-target="update-hub">Corregir el saldo<\/button>/);
  assert.match(html, /<strong class="is-baja">baja<\/strong>/);
  assert.match(html, /Todavía no se puede firmar: falta que cuadren los saldos de las cuentas\./);
  assert.doesNotMatch(html, /falta ninguna cuenta/);
  assert.match(html, /aria-disabled="true"[^>]*data-falta="Para firmar falta que cuadren los saldos de las cuentas\."/);
});

test("movimientos sin partida: el paso 2 los cuenta y ofrece Clasificar y «Por clasificar»; con otra diferencia, solo verla", () => {
  const sinPartida = cargar();
  sinPartida.ctx.renderCierreV2(base({ unclassified: 3, tasks: [{ cause: "unclassified" }, { cause: "unclassified" }, { cause: "unclassified" }], checks: [{ id: "diferencias", label: "Ninguna diferencia abierta", met: false }] }));
  const html = sinPartida.els.cierreV2.innerHTML;
  assert.match(html, /3 movimientos sin partida\./);
  assert.match(html, /data-cierre-v2-clasificar>Clasificar<\/button>/);
  assert.match(html, /data-cierre-por-clasificar="2026-10">Dejar 3 en «Por clasificar»<\/button>/);
  const conOtra = cargar();
  conOtra.ctx.renderCierreV2(base({ unclassified: 1, tasks: [{ cause: "unclassified" }, { cause: "bank-actual-difference" }], checks: [{ id: "diferencias", label: "Ninguna diferencia abierta", met: false }] }));
  assert.doesNotMatch(conOtra.els.cierreV2.innerHTML, /data-cierre-por-clasificar=/, "con otra diferencia abierta, «Por clasificar» no la taparía");
  assert.match(conOtra.els.cierreV2.innerHTML, /data-cierre-v2-diferencias>Ver la diferencia<\/button>/);
});

test("confianza media: se puede firmar con una cuenta sin comparar o con movimientos en «Por clasificar», y lo dice", () => {
  const { ctx, els } = cargar();
  ctx.cierrePorClasificarContados = () => 2;
  ctx.renderCierreV2(base({ accountRows: [CUADRA[0], { label: "Mediolanum", status: "sin-conciliar", declared: 20, calculated: null, diff: null }] }));
  assert.match(els.cierreV2.innerHTML, /<strong class="is-media">media<\/strong>/);
  assert.match(els.cierreV2.innerHTML, /Puedes firmar: una cuenta queda sin extracto con que comparar; 2 movimientos quedan en «Por clasificar»\./);
});

test("sin sesión no se firma: el botón lo dice", () => {
  const { ctx, els } = cargar();
  ctx.renderCierreV2(base({ syncReady: false }));
  assert.match(els.cierreV2.innerHTML, /data-falta="Inicia sesión y sincroniza una versión antes de firmar\."/);
});

test("lo previsto frente a lo real: las tres partidas de gasto que más se desviaron, con su signo", () => {
  const entries = [
    { label: "Súper", planned: 400, usado: 520, variance: 120, hasActual: true },
    { label: "Luz", planned: 80, usado: 60, variance: -20, hasActual: true },
    { label: "Ocio", planned: 100, usado: 140, variance: 40, hasActual: true },
    { label: "Seguro", planned: 50, usado: 50, variance: 0, hasActual: true },
    { label: "Colegio", planned: 300, usado: 300, variance: null, hasActual: false },
    { label: "Gimnasio", planned: 30, usado: 35, variance: 5, hasActual: true },
  ];
  const { ctx, els } = cargar({ planEntries: entries });
  ctx.renderCierreV2(base());
  const html = els.cierreV2.innerHTML;
  const filas = [...html.matchAll(/<tr><th scope="row">([^<]+)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(filas, ["Súper", "Ocio", "Luz"]);
  assert.match(html, /<span class="cierre-v2-pasa">\+120 €<\/span>/);
  assert.match(html, /<span class="cierre-v2-sobra">-20 €<\/span>/);
});

test("no se pinta con el tema clásico, con sobres o un plan propuesto, ni con el mes firmado; «paso a paso» deja una línea para volver", () => {
  assert.equal(cargar({ tema: "clasico" }).ctx.renderCierreV2(base()), false);
  const extra = cargar();
  assert.equal(extra.ctx.renderCierreV2(base({ extraSteps: true })), false);
  assert.equal(extra.els.cierreV2.hidden, true);
  assert.equal(cargar().ctx.renderCierreV2(null), false, "mes firmado");
  const clasico = cargar({ modo: "clasico" });
  assert.equal(clasico.ctx.renderCierreV2(base()), false);
  assert.equal(clasico.els.cierreV2.dataset.modo, "linea");
  assert.match(clasico.els.cierreV2.innerHTML, /data-cierre-v2-nuevo>Volver al cierre nuevo<\/button>/);
});

test("cableado: renderCierre lo llama antes del asistente y no pinta este si lo pinta; un solo «Firmar»; el de siempre se oculta solo con el nuevo pintado", () => {
  const cierre = read("views/cierre.js");
  assert.match(cierre, /const v2 = globalThis\.renderCierreV2\?\.\(\{/);
  assert.match(cierre, /if \(v2\) \{\n\s+if \(stepsEl\) stepsEl\.innerHTML = "";\n\s+if \(body\) body\.innerHTML = "";\n\s+return;\n\s+\}/);
  assert.match(cierre, /globalThis\.renderCierreV2\?\.\(null\); \/\/ rediseño C3/);
  assert.match(read("tema-v2.css"), /#cierre:has\(> #cierreV2\[data-modo="v2"\]\) > :is\(#cierreCounters, #cierreWizard, #cierreSobresNote\) \{\n\s+display: none;/);
  const html = read("index.html");
  assert.match(html, /<div id="cierreV2" hidden><\/div>/);
  const pos = (src) => html.search(new RegExp(`<script defer src="${src.replace(/[./]/g, (c) => `\\${c}`)}\\?`));
  assert.ok(pos("views/cierre-v2.js") !== -1 && pos("views/cierre-v2.js") < pos("app.js"));
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"views\/cierre-v2\.js",$/m);
  assert.match(read("service-worker.js"), /"\.\/views\/cierre-v2\.js",/);
  assert.match(read("funciones-en-prueba.js"), /id: "cierre-v2", nombre: "Cierre nuevo"/);
  assert.match(read("medidor-utilidad.js"), /id: "cierre-v2", nombre: "Cierre nuevo"/);
});
