const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// UX5 · Bloque 5: modo reunión para decidir en pareja. Enseña un bloque de Hoy cada vez con la
// utilidad .is-hidden (OPT-9), sin tocar el atributo `hidden` nativo que ya gobierna
// homeHealthScoreCard por su cuenta, y sin ningún dato ni motor nuevo.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
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

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name}`);
  const end = app.indexOf(";\n", start);
  return app.slice(start, end + 1);
}

function fakeElement(step) {
  const classes = new Set();
  return {
    dataset: { meetingStep: step },
    classList: {
      toggle(cls, condition) { if (condition) classes.add(cls); else classes.delete(cls); },
      remove(cls) { classes.delete(cls); },
      has(cls) { return classes.has(cls); },
    },
  };
}

function sandbox() {
  const els = { 1: fakeElement("1"), 2: fakeElement("2"), 3: fakeElement("3"), 4: fakeElement("4") };
  const toggle = { setAttribute() {}, textContent: "" };
  const bar = { hidden: true };
  const label = { textContent: "" };
  const prevButton = { disabled: false };
  const nextButton = { disabled: false };
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    document: { querySelectorAll: () => Object.values(els) },
    qs: (id) => ({
      home: { id: "home" },
      meetingModeBar: bar,
      homeMeetingModeToggle: toggle,
      meetingModeStepLabel: label,
      meetingModePrev: prevButton,
      meetingModeNext: nextButton,
    }[id] || null),
  };
  vm.createContext(context);
  [extractConst("MEETING_MODE_STEPS"), "let meetingModeActive = false;", "let meetingModeStepIndex = 0;"].forEach((src) => vm.runInContext(src, context));
  ["renderMeetingMode", "toggleMeetingMode", "meetingModeGo", "exitMeetingMode"].forEach((name) => vm.runInContext(extractFunction(name), context));
  return { context, els, bar, toggle, label, prevButton, nextButton };
}

test("toggleMeetingMode · al activar, muestra solo el paso 1 y la barra de control", () => {
  const { context, els, bar } = sandbox();
  context.toggleMeetingMode();
  assert.equal(bar.hidden, false);
  assert.equal(els[1].classList.has("is-hidden"), false);
  assert.equal(els[2].classList.has("is-hidden"), true);
  assert.equal(els[3].classList.has("is-hidden"), true);
  assert.equal(els[4].classList.has("is-hidden"), true);
});

test("meetingModeGo · avanza y retrocede sin salirse de los límites", () => {
  const { context, els } = sandbox();
  context.toggleMeetingMode();
  context.meetingModeGo(1);
  assert.equal(els[2].classList.has("is-hidden"), false);
  context.meetingModeGo(1);
  context.meetingModeGo(1);
  context.meetingModeGo(1); // más allá del último paso (4)
  assert.equal(els[4].classList.has("is-hidden"), false);
  context.meetingModeGo(-10); // más allá del primero
  assert.equal(els[1].classList.has("is-hidden"), false);
});

test("exitMeetingMode · quita is-hidden de todos los pasos, sin tocar el atributo hidden nativo", () => {
  const { context, els, bar } = sandbox();
  context.toggleMeetingMode();
  context.meetingModeGo(1);
  context.exitMeetingMode();
  assert.equal(bar.hidden, true);
  Object.values(els).forEach((el) => assert.equal(el.classList.has("is-hidden"), false));
});

test("renderMeetingMode nunca toca el atributo hidden nativo, solo classList", () => {
  const body = extractFunction("renderMeetingMode");
  assert.doesNotMatch(body, /\.hidden\s*=(?!\s*!meetingModeActive)/);
});

test("toggleMeetingMode actualiza la etiqueta del paso actual", () => {
  const { context, label } = sandbox();
  context.toggleMeetingMode();
  assert.match(label.textContent, /^1\/4/);
  assert.match(label.textContent, /Salud financiera/);
});

test("los cuatro bloques de Hoy llevan data-meeting-step, uno por paso declarado", () => {
  const openTag = /<section[^>]*id="home"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #home");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf('<section class="view-section widget-view"', start);
  const home = html.slice(start, end);
  ["1", "2", "3", "4"].forEach((step) => {
    assert.match(home, new RegExp(`data-meeting-step="${step}"`), `Falta un bloque con data-meeting-step="${step}"`);
  });
});

test("la tarjeta de salud financiera conserva su propio atributo hidden además del paso de reunión", () => {
  assert.match(html, /id="homeHealthScoreCard" hidden data-meeting-step="1"/);
});

test("los controles del modo reunión existen en Hoy y están cableados", () => {
  assert.match(html, /id="homeMeetingModeToggle"/);
  assert.match(html, /id="meetingModeBar"/);
  assert.match(html, /id="meetingModePrev"/);
  assert.match(html, /id="meetingModeNext"/);
  assert.match(html, /id="meetingModeExit"/);
  assert.match(app, /qs\("homeMeetingModeToggle"\)\?\.addEventListener\("click", toggleMeetingMode\)/);
  assert.match(app, /qs\("meetingModeExit"\)\?\.addEventListener\("click", exitMeetingMode\)/);
});
