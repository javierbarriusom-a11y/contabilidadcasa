// 25/11/2026: el cierre de siempre (views/cierre.js) y el nuevo (views/cierre-v2.js) pintan los dos #cierreSignButton y #cierreFirmaFalta.
// Al tocar «Firmar» con algo pendiente, «Para firmar falta…» tiene que salir junto al botón pulsado, no en el primero del documento (el de
// siempre, oculto con el cierre nuevo): así fallaba, según el orden de pintado, la e2e de «Rediseño C3 · Cierre nuevo» a 390 px.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const fuente = fs.readFileSync(path.join(__dirname, "..", "views/cierre.js"), "utf8");
const extraer = (nombre) => {
  const i = fuente.indexOf(`function ${nombre}(`);
  const inicio = fuente.lastIndexOf("\n", fuente.lastIndexOf("function", i) - 1) + 1;
  const fin = fuente.indexOf("\n}\n", i) + 2;
  return fuente.slice(inicio, fin);
};

function nodo(attrs = {}) {
  return { attrs, dataset: attrs.dataset || {}, hidden: true, textContent: "", classList: { contains: (c) => (attrs.clase || "").split(" ").includes(c) }, getAttribute(k) { return this.attrs[k] ?? null; }, focus() {}, scrollIntoView() {} };
}

test("Cierre · «Firmar» con algo pendiente escribe el aviso junto al botón pulsado, no en el primero del documento", async () => {
  // Dos pares botón + aviso, como en la página: el de siempre (primero) y el del cierre nuevo.
  const avisoSiempre = nodo({ clase: "cierre-firma-falta" });
  const botonSiempre = nodo({ "aria-disabled": "true" });
  botonSiempre.nextElementSibling = avisoSiempre;
  const avisoNuevo = nodo({ clase: "cierre-firma-falta" });
  const botonNuevo = nodo({ "aria-disabled": "true", dataset: { falta: "Para firmar falta: 2 movimientos sin partida." } });
  botonNuevo.nextElementSibling = avisoNuevo;
  const ctx = {
    qs: (id) => ({ cierreSignButton: botonSiempre, cierreFirmaFalta: avisoSiempre })[id] || null,
    document: { querySelector: () => null, querySelectorAll: () => [] },
    announceStatus() {},
    remoteUser: null,
    supabaseClient: null,
  };
  vm.createContext(ctx);
  vm.runInContext(`${extraer("cierreFirmaFaltaTexto")}\n${extraer("handleCierreSign")}`, ctx);
  await ctx.handleCierreSign(botonNuevo);
  assert.equal(avisoNuevo.hidden, false);
  assert.equal(avisoNuevo.textContent, "Para firmar falta: 2 movimientos sin partida.");
  assert.equal(avisoSiempre.textContent, "", "el aviso del de siempre (oculto) no se toca");
  assert.match(codigoApp(), /if \(event\.target\.id === "cierreSignButton"\) handleCierreSign\(event\.target\);/, "el clic pasa el botón pulsado");
});
