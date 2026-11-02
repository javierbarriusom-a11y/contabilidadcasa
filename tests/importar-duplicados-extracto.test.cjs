const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// 2/11/2026, con el extracto real del hogar (15 meses, con lo de hasta abril ya en la app): la revisión pedía 77 decisiones
// de «¿duplicado?» y bloqueaba la importación. Casi todas eran sobre filas idénticas a otras ya guardadas (se funden solas)
// o sobre un «parecido» que venía en el mismo extracto (si el banco lista los dos, son dos movimientos). Y los iguales del
// mismo día que perdió la importación anterior (lector de Excel viejo) se daban por duplicados seguros de su gemela y se
// volvían a perder. Movimientos INVENTADOS.
const src = fs.readFileSync(path.join(__dirname, "..", "importar-extracto-ui.js"), "utf8");
const body = src.slice(src.indexOf("function datosImportarDuplicateCandidates("), src.indexOf("// Estado de un movimiento antes de que el usuario decida nada"));
const context = {
  round2: (n) => Math.round(Number(n) * 100) / 100,
  transactionIdentity: (t) => [t.date, t.movement, t.amount, t.balance ?? ""].join("|"),
  daysBetweenIsoDates: (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000),
  DATOS_IMPORTAR_DUPLICATE_WINDOW_DAYS: 7,
};
vm.createContext(context);
vm.runInContext(body, context);
const candidatos = (tx, guardadas, fichero) => JSON.parse(JSON.stringify(context.datosImportarDuplicateCandidates(tx, guardadas, 7, {
  existingIdentities: new Set(guardadas.map(context.transactionIdentity)),
  fileIdentities: new Set(fichero.map(context.transactionIdentity)),
})));
const mov = (date, movement, amount, balance) => ({ date, movement, amount, balance });

test("una fila que ya está en la app no pregunta por otra parecida: se funde sola", () => {
  const a = mov("2026-03-05", "CAJERO FICTICIO", -40, 1000);
  const b = mov("2026-03-12", "CAJERO FICTICIO", -40, 960);
  assert.deepEqual(candidatos(b, [a, b], [a, b]), []);
});

test("un parecido que también viene en el extracto no es duplicado: el banco lista los dos", () => {
  const viejo = mov("2026-04-16", "CAJERO FICTICIO", -40, 900);
  const nuevo = mov("2026-04-22", "CAJERO FICTICIO", -40, 860);
  assert.deepEqual(candidatos(nuevo, [viejo], [viejo, nuevo]), []);
});

test("los iguales del mismo día que se perdieron antes vuelven: su gemela guardada está en el extracto", () => {
  const gemela = mov("2026-02-19", "PAGO FICTICIO", 50, 1050);
  const perdida = mov("2026-02-19", "PAGO FICTICIO", 50, 1100);
  assert.deepEqual(candidatos(perdida, [gemela], [gemela, perdida]), []);
});

test("se sigue preguntando por lo que está en la app y no en el extracto (algo anotado a mano)", () => {
  const aMano = mov("2026-04-20", "CENA FICTICIA", -45, null);
  const delBanco = mov("2026-04-21", "RESTAURANTE FICTICIO", -45, 700);
  assert.equal(candidatos(delBanco, [aMano], [delBanco]).length, 1);
});
