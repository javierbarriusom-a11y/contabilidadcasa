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

// DOC-1 (FASE 6): "FAQs y ayuda" (A12-4, commits #112/#113) tenía tres casos de uso (Actualizar,
// Predecir, Concluir) pero ninguno cubría Presupuesto del mes, la mayor pantalla nueva de las FASE
// 0-6 de este backlog — y el propio bloque de "FAQs y ayuda" no tenía ni un solo test, pese a llevar
// dos commits construido. Este fichero cubre lo nuevo (caso de uso 4, tres preguntas) y, de paso, el
// cableado genérico de pestañas/búsqueda que hasta ahora no tenía ninguna prueba.

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

function makeClassList() {
  const set = new Set();
  return { toggle: (cls, on) => (on ? set.add(cls) : set.delete(cls)), contains: (cls) => set.has(cls) };
}

function makeTab(faqsTab) {
  const listeners = {};
  return {
    dataset: { faqsTab },
    classList: makeClassList(),
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(event, fn) { listeners[event] = fn; },
    click() { listeners.click?.(); },
  };
}

function makePanel(faqsPanel) {
  return { dataset: { faqsPanel }, hidden: false };
}

function makeInput() {
  const listeners = {};
  return {
    value: "",
    addEventListener(event, fn) { listeners[event] = fn; },
    fire(event) { listeners[event]?.(); },
  };
}

function makeTextNode() {
  return { textContent: "" };
}

function makeDetail(text) {
  return { textContent: text, hidden: false };
}

const TAB_NAMES = ["actualizar", "predecir", "concluir", "presupuestar"];
const FAQ_TEXTS = [
  "¿Dónde se guardan mis datos?",
  "¿Qué significa exactamente «Usado»?",
  "¿Cómo decide Presupuesto del mes cuánto sugerir por categoría?",
  "¿Qué pasa con lo que me sobra de una categoría (la hucha)?",
  "¿Puedo exportar mis presupuestos?",
];

function sandbox() {
  const tabs = TAB_NAMES.map(makeTab);
  const panels = TAB_NAMES.map(makePanel);
  const details = FAQ_TEXTS.map(makeDetail);
  const search = makeInput();
  const empty = { hidden: false };
  const emptyTerm = makeTextNode();
  const elements = new Map([
    ["faqsSearch", search],
    ["faqsSearchEmpty", empty],
    ["faqsSearchEmptyTerm", emptyTerm],
  ]);
  const context = {
    document: {
      querySelectorAll: (selector) => {
        if (selector === "[data-faqs-tab]") return tabs;
        if (selector === "[data-faqs-panel]") return panels;
        if (selector === "#faqsAccordion details") return details;
        return [];
      },
      getElementById: (id) => elements.get(id) || null,
    },
  };
  vm.createContext(context);
  vm.runInContext(["normalizedText", "qs", "setupFaqsAyuda"].map(extractFunction).join("\n"), context, { filename: "app.js#doc1-faqs" });
  context.setupFaqsAyuda();
  return { tabs, panels, details, search, empty, emptyTerm };
}

test("DOC-1 · el caso de uso 4 (Presupuestar) existe con su pestaña, panel y enlaces a pantallas reales", () => {
  assert.match(html, /id="faqsTabPresupuestar"[^>]*data-faqs-tab="presupuestar"/);
  assert.match(html, /id="faqsPanelPresupuestar"[^>]*data-faqs-panel="presupuestar"/);
  assert.match(html, /aria-controls="faqsPanelPresupuestar"/);
  assert.match(html, /aria-labelledby="faqsTabPresupuestar"/);
  const panelStart = html.indexOf('id="faqsPanelPresupuestar"');
  const panelEnd = html.indexOf("</article>", panelStart);
  const panelHtml = html.slice(panelStart, panelEnd);
  assert.match(panelHtml, /data-home-nav="presupuesto-mes"/, "debe enlazar a la pantalla real de Presupuesto del mes");
  assert.match(panelHtml, /Sugerir presupuestos/i);
  assert.match(panelHtml, /[Hh]ucha/);
  assert.match(panelHtml, /Exportar CSV|Exportar JSON/);
});

test("DOC-1 · el icono de la pestaña Presupuestar tiene su propio acento de color", () => {
  assert.match(html, /faqs-tab-icon-presupuestar/);
  assert.match(tokens, /\.faqs-tab-icon-presupuestar\s*\{[^}]*var\(--e19-warning\)/);
});

test("DOC-1 · tres preguntas nuevas de presupuestos en el acordeón de FAQ", () => {
  assert.match(html, /Cómo decide Presupuesto del mes cuánto sugerir por categoría/);
  assert.match(html, /Qué pasa con lo que me sobra de una categoría \(la hucha\)/);
  assert.match(html, /Puedo exportar mis presupuestos/);
});

test("DOC-1 · el cableado de pestañas sigue siendo genérico: activar Presupuestar no requiere tocar setupFaqsAyuda", () => {
  const { tabs, panels } = sandbox();
  tabs[3].click(); // "presupuestar", la pestaña añadida en esta tarea
  tabs.forEach((tab, index) => {
    assert.equal(tab.classList.contains("is-active"), index === 3);
    assert.equal(tab.attrs["aria-selected"], index === 3 ? "true" : "false");
  });
  panels.forEach((panel, index) => {
    assert.equal(panel.hidden, index !== 3, `panel ${panel.dataset.faqsPanel}`);
  });
});

test("DOC-1 · el buscador de FAQ encuentra las preguntas nuevas de presupuestos", () => {
  const { search, details, empty } = sandbox();
  search.value = "hucha";
  search.fire("input");
  const visible = details.filter((detail) => !detail.hidden);
  assert.equal(visible.length, 1);
  assert.match(visible[0].textContent, /hucha/i);
  assert.equal(empty.hidden, true);

  search.value = "esto no existe en ninguna pregunta";
  search.fire("input");
  assert.equal(details.every((detail) => detail.hidden), true);
  assert.equal(empty.hidden, false);
});
