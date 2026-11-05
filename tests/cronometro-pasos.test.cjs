// tests/helpers/cronometro-pasos.cjs: dice cuánto tardó cada tramo de una prueba que se queda sin tiempo en el CI.
const test = require("node:test");
const assert = require("node:assert/strict");
const { cronometro, informarSiFalla } = require("./helpers/cronometro-pasos.cjs");

test("cada tramo con sus segundos y lo que llevaba, y el tramo que seguía en marcha", () => {
  let t = 1000;
  const reloj = cronometro(() => t);
  t = 3300;
  reloj.marca("primera carga");
  t = 4600;
  reloj.marca("recarga");
  t = 61000;
  assert.equal(reloj.informe(), ["Tramos de la prueba:", "  primera carga: 2,3 s (llevaba 2,3 s)", "  recarga: 1,3 s (llevaba 3,6 s)", "  en marcha tras «recarga»: 56,4 s (total 60,0 s)"].join("\n"));
});

test("solo escribe si la prueba no acaba como se esperaba (también por tiempo), y nunca espera ni reintenta", async () => {
  const adjuntos = [];
  const info = (status) => ({ title: "WP-18", status, expectedStatus: "passed", attach: async (nombre, opciones) => adjuntos.push([nombre, opciones.body]) });
  const reloj = cronometro(() => 0);
  const log = console.log;
  const escrito = [];
  console.log = (texto) => escrito.push(texto);
  try {
    await informarSiFalla(reloj, info("passed"));
    assert.equal(adjuntos.length, 0);
    await informarSiFalla(reloj, info("timedOut"));
    await informarSiFalla(null, info("failed"));
  } finally {
    console.log = log;
  }
  assert.equal(adjuntos.length, 1);
  assert.equal(adjuntos[0][0], "tramos");
  assert.match(escrito[0], /^\[cronometro\] WP-18\nTramos de la prueba:/);
});
