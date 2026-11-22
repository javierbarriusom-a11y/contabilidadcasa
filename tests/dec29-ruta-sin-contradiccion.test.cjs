// DEC-29 (décima auditoría; 22/11/2026): el titular de Deuda › Plan nunca dice «sin deuda» ni «sin fecha estimable» encima de una
// fecha, y el subtítulo no habla de «0 € de coste total ejecutado». Funciones tal cual están en views/deuda.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const deuda = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");
function extract(name) {
  const start = deuda.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0;
  for (let i = deuda.indexOf("{", start); i < deuda.length; i += 1) {
    if (deuda[i] === "{") depth += 1;
    if (deuda[i] === "}") { depth -= 1; if (depth === 0) return deuda.slice(start, i + 1); }
  }
  throw new Error(name);
}
const sandbox = {
  escenarioMotorMonthLabel: (key) => ({ "2029-10": "oct 2029", "2027-03": "mar 2027" })[key] || key,
  money: (value) => `${value} €`,
  DEBT_STRATEGY_COSTE_LABEL: "Coste total ejecutado",
};
vm.runInNewContext(`${extract("deudaRutaTitulo")}\n${extract("deudaRutaSubtitulo")}\nthis.titulo = deudaRutaTitulo; this.subtitulo = deudaRutaSubtitulo;`, sandbox);

const activa = { currentPrincipal: 1000, paymentStatus: "active" };
const suspendida = { currentPrincipal: 500, paymentStatus: "suspended" };

test("DEC-29 · con deudas sin cuota, una frase: libre de las que tienen cuota y cuántas faltan", () => {
  assert.equal(sandbox.titulo("2029-10 · queda deuda sin cuota activa", [activa, suspendida]), "Libre de las deudas con cuota en oct 2029 · falta 1 sin cuota");
  assert.equal(sandbox.titulo("2029-10 · queda deuda sin cuota activa", [activa, suspendida, suspendida]), "Libre de las deudas con cuota en oct 2029 · faltan 2 sin cuota");
});

test("DEC-29 · nunca «sin deuda» ni «sin fecha estimable» encima de una fecha", () => {
  assert.equal(sandbox.titulo("2027-03", [activa]), "Sin deuda en mar 2027");
  assert.equal(sandbox.titulo("sin fecha estimable · sin cuota activa", [suspendida]), "Sin fecha: ninguna deuda tiene cuota activa (falta 1 sin cuota)");
  assert.equal(sandbox.titulo("sin deuda pendiente", []), "Sin deuda pendiente");
  assert.equal(sandbox.titulo("fuera de horizonte", [activa]), "Libre de deuda más allá del horizonte del plan");
  for (const caso of ["2029-10 · queda deuda sin cuota activa", "2027-03"]) assert.doesNotMatch(sandbox.titulo(caso, [activa, suspendida]), /sin fecha estimable|^Sin deuda en .* · /);
});

test("DEC-29 · el subtítulo no dice «0 € de coste»; con coste, sí", () => {
  const def = { label: "Avalancha" };
  assert.equal(sandbox.subtitulo(def, "avalancha", { total: 0, costeTotal: 0, cajaMinima: 900 }), "Avalancha: 0 decisiones, caja mínima 900 €.");
  assert.equal(sandbox.subtitulo(def, "avalancha", { total: 1, costeTotal: 1200, cajaMinima: 300 }), "Avalancha: 1 decisión, 1200 € de coste total ejecutado, caja mínima 300 €.");
  assert.equal(sandbox.subtitulo({ label: "Préstamo", costeLabel: "Intereses del nuevo préstamo" }, "p", { total: 2, costeTotal: 50, cajaMinima: 0 }), "Préstamo: 2 decisiones, 50 € de intereses del nuevo préstamo, caja mínima 0 €.");
});

test("DEC-29 · renderDeudaRuta usa las dos funciones", () => {
  assert.match(deuda, /titleEl\.textContent = deudaRutaTitulo\(summary\.libreDeDeuda, summary\.result\?\.debtStateFinal \|\| contracts\);/);
  assert.match(deuda, /subtitleEl\.textContent = deudaRutaSubtitulo\(def, deudaRutaSelectedStrategy, summary\);/);
});
