const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// Rediseño · fase C1 (docs/rediseno/HANDOFF.md §5 «C1 · Plan › Mes»): Plan › Mes v2 detrás del tema v2.
// Comprueba que (1) se carga y solo pinta con la bandera, sin cálculo propio; (2) la edición es la de siempre (mismo
// data-plan-mes-planned, mismo pie de impacto) y lee importes en español; (3) las financiaciones se pliegan a una fila
// que lleva a Deuda; (4) nada se retira: con sobres o con «Ver la tabla de siempre» se pinta la tabla de siempre.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const plan = read("views/plan-v2.js");
const css = read("tema-v2.css");

function fakeElement(id) {
  return {
    id,
    hidden: true,
    innerHTML: "",
    classList: {
      set: new Set(),
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); },
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => false,
    addEventListener: () => {},
  };
}

function sandbox({ tema = "v2", sobres = false } = {}) {
  const elements = { plan: fakeElement("plan"), planV2Lado: fakeElement("planV2Lado"), planMesTables: fakeElement("planMesTables") };
  elements.plan.hidden = false;
  const medidas = [];
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    money: (value, precise) => {
      const n = Number(value || 0);
      const text = new Intl.NumberFormat("es-ES", { minimumFractionDigits: precise && !Number.isInteger(n) ? 2 : 0, maximumFractionDigits: precise ? 2 : 0, useGrouping: "always" }).format(n);
      return `${text} €`;
    },
    round2: (n) => Math.round(Number(n) * 100) / 100,
    qs: (id) => elements[id] || null,
    document: { documentElement: { dataset: tema ? { tema } : {} }, readyState: "complete" },
    isoLocalDate: () => "2026-10-30",
    isClosedMonthKey: () => false,
    sobresEnabled: () => sobres,
    seriesKeyForRow: (row) => row.key,
    planMesUsadoTitle: () => "Previsto: sin movimientos registrados.",
    planMesCollapsedBlocks: new Set(),
    savingsPlanCalculations: () => ({ currentSavingTarget: 800 }),
    FinanceMedidor: { anotar: (...args) => medidas.push(args) },
    Intl,
  };
  context.globalThis = context;
  // planMesGroupBySection es de registrar-ui.js: se usa la de verdad.
  const registrar = read("registrar-ui.js");
  const start = registrar.indexOf("function planMesGroupBySection(list)");
  const end = registrar.indexOf("function planMesBlockRowHtml(");
  vm.createContext(context);
  vm.runInContext(registrar.slice(start, end), context);
  vm.runInContext(plan, context);
  return { context, elements, medidas };
}

const entry = (kind, sectionName, label, planned, extra = {}) => ({ kind, row: { key: label.toLowerCase().replace(/\s+/g, "-") }, sectionName, label, planned, plannedDraft: false, hasActual: false, usado: planned, restante: 0, key: `${kind}:${label}`, ...extra });

function model() {
  const income = [entry("income", "Ingresos", "Ingreso Persona A", 3000), entry("income", "Ingresos", "Ingreso Persona B", 2000)];
  const expense = [
    entry("expense", "Gastos fijos", "Vivienda", 750),
    entry("expense", "Gastos fijos", "Servicios", 400, { hasActual: true, usado: 448 }),
    entry("expense", "Gastos variables", "Gasto variable estimado", 1750),
    entry("expense", "Financiaciones", "Coche", 300),
    entry("expense", "Financiaciones", "Tarjeta", 0),
  ];
  const months = [{ key: "2026-09", label: "sept 26" }, { key: "2026-10", label: "oct 26" }, { key: "2026-11", label: "nov 26" }];
  return { month: months[1], months, entries: { income, expense }, totals: { incomePlanned: 5000, expensePlanned: 3200, lines: 7 }, asignado: 3200, sinAsignar: 1800, editLocked: false, footHtml: '<button data-plan-mes-copy>Copiar previsto de sept 26</button>' };
}

test("se carga con defer antes de app.js y está en el sitio público y el service worker", () => {
  const html = read("index.html");
  const at = html.indexOf('<script defer src="views/plan-v2.js');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js'), "views/plan-v2.js con defer y antes de app.js");
  assert.ok(read("service-worker.js").includes('"./views/plan-v2.js"'));
  assert.match(read("tools/build-public-site.mjs"), /^ {2}"views\/plan-v2\.js",$/m);
  assert.ok(html.includes('<aside class="plan-v2-lado" id="planV2Lado" aria-label="Resumen del mes" hidden></aside>'));
});

test("app.js solo añade la llamada con lo que ya calcula renderPlanMes, y lee los importes en español", () => {
  const app = codigoApp();
  const body = app.slice(app.indexOf("function renderPlanMes()"), app.indexOf("function handlePlanMesPlannedChange("));
  assert.match(body, /if \(typeof planV2Render === "function" && planV2Render\(\{ month, months, entries, totals, asignado, sinAsignar, editLocked, footHtml: planMesClosedFootHtml\(month, monthClosed, overrideActive\) \}\)\) return renderPlanMesImpactBar\(\);/);
  // La llamada va antes de pintar las tarjetas de siempre: con la v2 pintada no se pinta la tabla vieja encima.
  assert.ok(body.indexOf("planV2Render(") < body.indexOf('const kpis = qs("planMesKpis")'));
  const change = app.slice(app.indexOf("function handlePlanMesPlannedChange("), app.indexOf("function handlePlanMesCopy()"));
  assert.match(change, /const parsed = parseAmountField\(input\.value\);/);
  assert.doesNotMatch(plan, /cuadroMandosStageCell|saveVisualChanges|localStorage/, "la v2 no escribe nada por su cuenta");
});

test("sin el tema v2 no pinta nada y renderPlanMes sigue con la de siempre", () => {
  const { context, elements } = sandbox({ tema: "" });
  assert.equal(context.planV2Render(model()), false);
  assert.equal(elements.planV2Lado.hidden, true);
  assert.equal(elements.planMesTables.innerHTML, "");
});

test("con sobres, o tras «Ver la tabla de siempre», se pinta la tabla de siempre entera", () => {
  const conSobres = sandbox({ sobres: true });
  assert.equal(conSobres.context.planV2Render(model()), false);
  assert.equal(conSobres.elements.plan.classList.contains("plan-v2-mes-on"), false);
  assert.match(plan, /if \(planV2Clasica \|\| sobresEnabled\(\)\) \{/);
  assert.match(plan, /data-plan-v2-clasica>Ver la tabla de siempre</);
  assert.match(plan, /planV2Clasica = true;\s+globalThis\.FinanceMedidor\?\.anotar\("plan-v2", "descarte"\);\s+renderPlanMes\(\);/);
});

test("pinta sin asignar, ritmo y ahorro, y las partidas con el mismo campo editable de siempre", () => {
  const { context, elements, medidas } = sandbox();
  assert.equal(context.planV2Render(model()), true);
  assert.equal(elements.plan.classList.contains("plan-v2-on"), true);
  assert.equal(elements.plan.classList.contains("plan-v2-mes-on"), true);
  const lado = elements.planV2Lado.innerHTML;
  assert.equal(elements.planV2Lado.hidden, false);
  assert.match(lado, /<p class="plan-v2-cifra">1\.800 €<\/p>/);
  assert.match(lado, /De 5\.000 € de ingreso previsto ya tienen destino 3\.200 €\./);
  assert.match(lado, /aria-label="Fijos 1\.150 €, Variables 1\.750 €, Financiaciones 300 €, Sin asignar 1\.800 €"/);
  assert.match(lado, /día 30 de 31/);
  assert.match(lado, /Gastado <strong>448 €<\/strong> de 3\.200 €/);
  assert.match(lado, /Irá a ahorro este mes<\/span><strong>800 €<\/strong>/);
  // No hay un «Asignar» inventado: lo que sobra lleva a la escalera del próximo euro, que ya existe.
  assert.match(lado, /data-plan-v2-nav="deuda-comparar">Ver adónde va el próximo euro</);
  const tabla = elements.planMesTables.innerHTML;
  assert.match(tabla, /<h3>Partidas de octubre 2026<\/h3>/);
  assert.match(tabla, /<input type="text" inputmode="decimal" autocomplete="off" data-plan-mes-planned="ingreso-persona-a" data-plan-mes-month="2026-10" aria-label="Previsto de Ingreso Persona A" value="3\.000"/);
  assert.match(tabla, /data-plan-mes-block-toggle="Gastos fijos"/);
  assert.match(tabla, /data-plan-mes-copy>Copiar previsto de sept 26/);
  // Servicios: real 448 de 400 → queda -48 en rojo (rompe lo asignado) y la barra llena.
  assert.match(tabla, /data-plan-v2-etiqueta="queda">-48 €<\/td>/);
  assert.match(tabla, /class="plan-v2-num is-over" data-plan-v2-etiqueta="queda">-48 €/);
  assert.match(tabla, /Una sola partida para todo lo variable: divídela para que la previsión aprenda\./);
  assert.deepEqual(JSON.parse(JSON.stringify(medidas)), [["plan-v2", "vista"]]);
});

test("las financiaciones se pliegan a una fila que dice cuántos contratos hay y lleva a Deuda", () => {
  const { context, elements } = sandbox();
  context.planV2Render(model());
  const tabla = elements.planMesTables.innerHTML;
  assert.match(tabla, /2 contratos · 1 a 0 € · se editan en Deuda/);
  assert.match(tabla, /data-home-nav="deuda-contratos" aria-label="Editar las cuotas en Deuda › Contratos"/);
  assert.doesNotMatch(tabla, /data-plan-mes-planned="coche"/, "las cuotas no son editables en Plan (P-3)");
});

test("un mes cerrado deja los campos bloqueados; el exceso de lo asignado sale en rojo y sin botón", () => {
  const { context, elements } = sandbox();
  context.planV2Render({ ...model(), editLocked: true, asignado: 5400, sinAsignar: -400 });
  assert.match(elements.planMesTables.innerHTML, /value="3\.000" disabled/);
  const lado = elements.planV2Lado.innerHTML;
  assert.match(lado, /plan-v2-sin-asignar is-negative/);
  assert.match(lado, /supera en 400 € el ingreso previsto/);
  assert.doesNotMatch(lado, /deuda-comparar/);
});

test("el campo enseña los céntimos (no redondea lo guardado) y el mes se elige con flechas", () => {
  const { context } = sandbox();
  assert.equal(context.planV2InputValue(1234.5), "1.234,50");
  assert.equal(context.planV2InputValue(750), "750");
  const nav = context.planV2MesNavHtml(model().months, model().months[0]);
  assert.match(nav, /aria-label="No hay mes anterior" disabled>‹/);
  assert.match(nav, /data-plan-v2-mes-paso="2026-10" aria-label="Mes siguiente: octubre 2026"/);
});

test("repintar con un campo enfocado no se pisa a sí mismo, y el foco vuelve a ese campo", () => {
  assert.match(plan, /if \(planV2Pintando\) return true;/);
  assert.match(plan, /planV2Pintando = true;\n {2}try \{[\s\S]*?\} finally \{\n {4}planV2Pintando = false;\n {2}\}/);
  assert.match(plan, /if \(foco\) \[\.\.\.tables\.querySelectorAll\("\[data-plan-mes-planned\]"\)\]\.find\(\(input\) => input\.dataset\.planMesPlanned === foco\)\?\.focus\(\);/);
});

test("estilos: todo bajo el tema v2, sin la tira de cifras en Plan y la tabla cabe en el móvil", () => {
  const bloque = css.slice(css.indexOf("Rediseño C1 · Plan › Mes"));
  const selectores = bloque.split("\n").filter((line) => /^\S.*[{,]\s*$/.test(line) && !line.startsWith("@media") && !line.startsWith("/*"));
  assert.ok(selectores.length > 20);
  selectores.forEach((line) => assert.match(line, /^:root\[data-tema="v2"\]/, line));
  assert.match(bloque, /:has\(#plan\.plan-v2-on:not\(\[hidden\]\)\) #topbarStatusStrip/);
  // La regla genérica `table { min-width: 1120px }` de styles.css desbordaba la tarjeta.
  assert.match(bloque, /\.plan-v2-tabla \{\n {2}width: 100%;\n {2}min-width: 0;/);
  assert.match(bloque, /@media \(max-width: 640px\)[\s\S]*\.plan-v2-tabla tr \{\n {4}display: grid;/);
});
