const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// UX1 · Bloque 4: deshacer de 10 segundos en vez de confirmaciones modales. Auditoría de los tres
// `confirm()` de toda la app (28-29/08/2026): dos eran "¿eliminar X?" antes de un splice reversible
// (alerta, objetivo de ahorro) — se convierten aquí a deshacer-de-10-segundos. El tercero
// (registrarConsolidateSessionChanges) es un aviso de riesgo, no un "¿seguro que borro?" — se queda
// como confirm() a propósito, y un test de este archivo lo comprueba explícitamente.
//
// DEX4 (Oleada 2, Bloque 1): `undoToastCallback`/`undoToastTimer` eran una única casilla — una
// segunda `showUndoToast` mientras la primera seguía viva pisaba su callback sin avisar, perdiendo
// en silencio la posibilidad de deshacer la primera acción. Pasa a una pila real (`undoStack`); los
// tests de abajo se actualizaron para probar la coexistencia en vez de la pérdida silenciosa.

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

function fakeEl() {
  return { hidden: true, textContent: "" };
}

function toastSandbox() {
  const elements = { undoToast: fakeEl(), undoToastMessage: fakeEl(), undoToastCount: fakeEl() };
  const context = {
    qs: (id) => elements[id] || null,
    window: { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
    undoStack: [],
  };
  vm.createContext(context);
  const maxDeclaration = app.match(/const UNDO_STACK_MAX = \d+;/);
  assert.ok(maxDeclaration, "No existe UNDO_STACK_MAX en app.js");
  vm.runInContext(maxDeclaration[0], context);
  ["renderUndoToast", "dismissUndoEntry", "showUndoToast", "hideUndoToast", "handleUndoToastClick"].forEach((name) => vm.runInContext(extractFunction(name), context));
  return { ctx: context, elements };
}

test("showUndoToast · muestra el aviso con el mensaje, oculto por defecto, sin contador de más pendientes", () => {
  const { ctx, elements } = toastSandbox();
  ctx.showUndoToast("Alerta «Reserva baja» eliminada.", () => {}, 50);
  assert.equal(elements.undoToast.hidden, false);
  assert.equal(elements.undoToastMessage.textContent, "Alerta «Reserva baja» eliminada.");
  assert.equal(elements.undoToastCount.hidden, true);
});

test("handleUndoToastClick · llama al deshacer y oculta el aviso, no espera al temporizador", () => {
  const { ctx, elements } = toastSandbox();
  let undone = false;
  ctx.showUndoToast("Objetivo eliminado.", () => { undone = true; }, 10000);
  ctx.handleUndoToastClick();
  assert.equal(undone, true);
  assert.equal(elements.undoToast.hidden, true);
});

test("showUndoToast · pasado el tiempo sin pulsar Deshacer, el aviso se oculta solo y no llama al deshacer", async () => {
  const { ctx, elements } = toastSandbox();
  let undone = false;
  ctx.showUndoToast("Alerta eliminada.", () => { undone = true; }, 20);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(elements.undoToast.hidden, true);
  assert.equal(undone, false);
});

// DEX4: antes, un segundo aviso mientras el primero seguía vivo pisaba su callback en silencio —
// ahora ambos coexisten en la pila, cada uno con su propio temporizador y su propia posibilidad real
// de deshacerse, y el aviso enseña un contador de cuántos más siguen pendientes debajo del visible.
test("showUndoToast · un segundo aviso antes de que expire el primero NO pisa su callback: ambos coexisten en la pila", () => {
  const { ctx, elements } = toastSandbox();
  let firstUndone = false;
  let secondUndone = false;
  ctx.showUndoToast("Primero", () => { firstUndone = true; }, 20000);
  ctx.showUndoToast("Segundo", () => { secondUndone = true; }, 20000);
  // El aviso visible muestra siempre la más reciente, con un contador de las que quedan debajo.
  assert.equal(elements.undoToastMessage.textContent, "Segundo");
  assert.equal(elements.undoToastCount.hidden, false);
  assert.equal(elements.undoToastCount.textContent, "+1 más");
  // Deshacer la visible (Segundo) no toca la más antigua (Primero): sigue en la pila, deshacible.
  ctx.handleUndoToastClick();
  assert.equal(secondUndone, true);
  assert.equal(firstUndone, false);
  assert.equal(elements.undoToast.hidden, false);
  assert.equal(elements.undoToastMessage.textContent, "Primero");
  assert.equal(elements.undoToastCount.hidden, true);
  ctx.handleUndoToastClick();
  assert.equal(firstUndone, true);
  assert.equal(elements.undoToast.hidden, true);
});

test("showUndoToast · pasado el tiempo sin pulsar Deshacer, ambos avisos pendientes expiran solos y ninguno llama al deshacer", async () => {
  const { ctx, elements } = toastSandbox();
  let firstUndone = false;
  let secondUndone = false;
  ctx.showUndoToast("Primero", () => { firstUndone = true; }, 20);
  ctx.showUndoToast("Segundo", () => { secondUndone = true; }, 20);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(firstUndone, false);
  assert.equal(secondUndone, false); // ninguno se llama solo por expirar: eso es lo esperado, ambos "final"
  assert.equal(elements.undoToast.hidden, true);
});

test("showUndoToast · un sexto aviso mientras cinco siguen vivos retira el más antiguo en silencio (tope defensivo)", () => {
  const { ctx } = toastSandbox();
  const order = [];
  for (let index = 1; index <= 5; index += 1) {
    ctx.showUndoToast(`Aviso ${index}`, () => order.push(index), 20000);
  }
  assert.equal(ctx.undoStack.length, 5);
  ctx.showUndoToast("Aviso 6", () => order.push(6), 20000);
  assert.equal(ctx.undoStack.length, 5);
  assert.equal(ctx.undoStack.map((entry) => entry.message).includes("Aviso 1"), false); // el más antiguo, retirado
  assert.equal(ctx.undoStack.map((entry) => entry.message).includes("Aviso 6"), true);
});

test("handleAlertRuleAction · borrar una alerta ya no usa confirm(): borra ya y ofrece deshacer", () => {
  const source = extractFunction("handleAlertRuleAction");
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /scenarioSettings\.alerts\.splice\(index, 1\)/);
  assert.match(source, /showUndoToast\(/);
  assert.match(source, /scenarioSettings\.alerts\.splice\(index, 0, removed\)/); // el deshacer reinserta en su sitio
});

test("handleSavingsGoalAction · borrar un objetivo ya no usa confirm(): borra ya y ofrece deshacer", () => {
  const source = extractFunction("handleSavingsGoalAction");
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /goals\.splice\(index, 1\)/);
  assert.match(source, /showUndoToast\(/);
  assert.match(source, /restored\.splice\(index, 0, removed\)/); // el deshacer reinserta en su sitio
});

test("registrarConsolidateSessionChanges · el aviso de riesgo (reserva bajo mínimo) sigue como confirm(), a propósito", () => {
  const source = extractFunction("registrarConsolidateSessionChanges");
  assert.match(source, /window\.confirm\(/);
});

test("solo queda un confirm() en toda la app.js — el de registrarConsolidateSessionChanges", () => {
  const matches = app.match(/window\.confirm\(/g) || [];
  assert.equal(matches.length, 1);
});

test("el botón de deshacer está cableado", () => {
  assert.match(app, /qs\("undoToastButton"\)\?\.addEventListener\("click", handleUndoToastClick\)/);
});

test("el aviso de deshacer vive fuera de #mainContent, para sobrevivir al cambio de vista", () => {
  const mainStart = html.indexOf('<main id="mainContent"');
  const toastStart = html.indexOf('id="undoToast"');
  assert.ok(toastStart >= 0 && toastStart < mainStart, "El aviso debe declararse antes de <main>");
  assert.match(html, /id="undoToastMessage"/);
  assert.match(html, /id="undoToastCount"/);
  assert.match(html, /id="undoToastButton"/);
});
