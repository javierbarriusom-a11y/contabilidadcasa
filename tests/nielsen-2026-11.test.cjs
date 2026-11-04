// Revisión de Nielsen del 4/11/2026 (docs/OPT21_CHECKLIST_NIELSEN.md), lo corregido en la misma sesión.
// Heurísticos 3 y 5: en los diálogos `<form method="dialog">` de index.html el primer
// botón de enviar es «Cancelar», y el navegador usa el primero para Intro. ux-shell.js hace que Intro en un campo de
// texto pulse el que confirma. La e2e «Intro en los diálogos confirma, nunca cancela» lo recorre en el navegador.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const shell = require("../ux-shell.js");

const root = path.resolve(__dirname, "..");

function boton(value, { type = "submit", disabled = false, hidden = false } = {}) {
  return { tagName: "BUTTON", value, disabled, hidden, getAttribute: (n) => (n === "type" ? type : null) };
}
function formulario(method, botones) {
  return { getAttribute: (n) => (n === "method" ? method : null), querySelectorAll: () => botones };
}
function campo(form, { tagName = "INPUT", type = "text" } = {}) {
  return { form, tagName, getAttribute: (n) => (n === "type" ? type : null) };
}

test("con «Cancelar» delante, Intro en un campo de texto va al botón que confirma", () => {
  const confirmar = boton("confirm");
  const form = formulario("dialog", [boton("cancel"), confirmar]);
  assert.equal(shell.dialogEnterTarget(campo(form)), confirmar);
  assert.equal(shell.dialogEnterTarget(campo(form, { type: "date" })), confirmar);
});

test("no toca nada fuera de ese caso: otro método, el confirmar delante, un área de texto, una casilla o sin confirmar usable", () => {
  assert.equal(shell.dialogEnterTarget(campo(formulario("post", [boton("cancel"), boton("confirm")]))), null);
  assert.equal(shell.dialogEnterTarget(campo(formulario("dialog", [boton("confirm"), boton("cancel")]))), null);
  assert.equal(shell.dialogEnterTarget(campo(formulario("dialog", [boton("cancel"), boton("confirm")]), { tagName: "TEXTAREA", type: null })), null);
  assert.equal(shell.dialogEnterTarget(campo(formulario("dialog", [boton("cancel"), boton("confirm")]), { type: "checkbox" })), null);
  assert.equal(shell.dialogEnterTarget(campo(formulario("dialog", [boton("cancel"), boton("confirm", { disabled: true })]))), null);
  // Un botón normal delante no cuenta: el primero «de enviar» sigue siendo «Cancelar».
  assert.equal(shell.dialogEnterTarget(campo(formulario("dialog", [boton("x", { type: "button" }), boton("cancel"), boton("confirm")])))?.value, "confirm");
  assert.equal(shell.dialogEnterTarget({ form: null, tagName: "INPUT", getAttribute: () => "text" }), null);
});

test("los dos diálogos afectados siguen con «Cancelar» delante y ux-shell.js monta el arreglo al cargar", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const id of ["operationConfirmDialog", "homeQuickExpenseDialog"]) {
    const bloque = html.slice(html.indexOf(`id="${id}"`), html.indexOf("</dialog>", html.indexOf(`id="${id}"`)));
    assert.match(bloque, /<form method="dialog"/);
    assert.ok(bloque.indexOf('value="cancel"') < bloque.indexOf('value="confirm"'), `${id}: «Cancelar» va delante`);
  }
  const ux = fs.readFileSync(path.join(root, "ux-shell.js"), "utf8");
  assert.match(ux, /api\.mountDialogEnter\(document\);/);
  // Esc deja «cancel»: WebKit conservaba el «confirm» del cierre anterior (la e2e lo comprueba en Safari).
  assert.match(ux, /doc\.addEventListener\(\s*"cancel",[\s\S]{0,260}dialog\.returnValue = "cancel"/);
  assert.ok(html.includes('src="ux-shell.js?v=20261104intro2"'));
});

// Misma revisión (heurísticos 1 y 2): Registrar › «Frescura de tus datos» decía «Todo al día» sin ningún dato, con las
// fichas en «sin dato» y tres tareas «Sin estimar» justo debajo.
test("«Todo al día» solo cuando no queda ninguna tarea sin estimar; si falta el dato, lo dice", () => {
  const datos = fs.readFileSync(path.join(root, "datos-ui.js"), "utf8");
  const rama = datos.slice(datos.indexOf("} else if (queue.allClear && !anyStale) {"), datos.indexOf('} else plan = "";'));
  assert.match(rama, /const sinEstimar = queue\.unestimated\.some\(\(task\) => task\.id !== "pending"\);/);
  assert.match(rama, /sinEstimar\s*\?\s*`<p class="dat-plan"><strong>Aún no se puede ordenar por euros\.<\/strong>/);
  assert.ok(rama.indexOf("Aún no se puede ordenar") < rama.lastIndexOf("<strong>Todo al día.</strong>"), "con tareas sin estimar, nunca «Todo al día»");
  assert.ok(fs.readFileSync(path.join(root, "index.html"), "utf8").includes('src="datos-ui.js?v=20261104nielsen1"'));
});
