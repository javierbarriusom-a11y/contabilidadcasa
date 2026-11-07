// E-11b · diez escenarios vivos como máximo, en todos los caminos que guardan en Escenarios › Guardados (7/11/2026).
// Antes, «Guardar como escenario» de Deuda › Comparar y «guardar con aviso» del simulador guardaban aunque ya hubiera diez.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const leer = (fichero) => fs.readFileSync(path.join(__dirname, "..", fichero), "utf8");
const cuerpo = (fuente, nombre) => {
  const inicio = fuente.indexOf(`function ${nombre}(`);
  assert.ok(inicio >= 0, `${nombre} existe`);
  return fuente.slice(inicio, fuente.indexOf("\nfunction ", inicio + 10));
};

test("E-11b · Deuda › Comparar comprueba los diez vivos antes de tocar el borrador y de guardar", () => {
  const f = cuerpo(leer("views/deuda.js"), "handleDeudaCompararGuardarComoEscenario");
  const limite = f.indexOf("filter((entry) => !entry.archived).length >= 10");
  assert.ok(limite > 0, "cuenta los no archivados");
  assert.ok(limite < f.indexOf("debtStrategyDecisionsToEscenario("), "antes de sobrescribir el borrador del simulador");
  assert.ok(limite < f.indexOf("saved.unshift("), "antes de guardar");
  assert.match(f, /qs\("escenarioMotorLimitDialog"\)\?\.showModal\?\.\(\)/, "el mismo diálogo que Escenarios");
  assert.match(f, /announceStatus\(/);
});

test("E-11b · el aviso del simulador también cuenta entre los diez", () => {
  const f = cuerpo(leer("views/escenarios.js"), "handleEscenarioMotorSaveAviso");
  const limite = f.indexOf("escenarioMotorLimitReached()");
  assert.ok(limite > 0);
  assert.ok(limite < f.indexOf("saved.unshift("));
  assert.match(f, /showEscenarioMotorLimitDialog\(\)/);
});

test("E-11b · todos los que añaden un escenario guardado comprueban el límite", () => {
  // Cada `saved.unshift(` de las pantallas va precedido de su comprobación en la misma función.
  for (const fichero of ["views/deuda.js", "views/escenarios.js", "views/prevision-v2.js"]) {
    const fuente = leer(fichero);
    let at = fuente.indexOf("saved.unshift(");
    assert.ok(at > 0, `${fichero} guarda escenarios`);
    while (at > 0) {
      const inicio = fuente.lastIndexOf("\nfunction ", at);
      const tramo = fuente.slice(inicio, at);
      assert.match(tramo, /escenarioMotorLimitReached\(\)|filter\(\(entry\) => !entry\.archived\)\.length >= 10/, `${fichero}: ${tramo.slice(1, 60)}`);
      at = fuente.indexOf("saved.unshift(", at + 1);
    }
  }
});
