const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

test("IV6: sin objetivos declarados, no hay sugerencia de rebalanceo", () => {
  const suggestions = Portfolio.rebalanceSuggestions({ fondo: 1000, accion: 500 }, 1500, {});
  assert.deepEqual(suggestions, []);
});

test("IV6: una desviación por debajo del umbral no sugiere acción", () => {
  const suggestions = Portfolio.rebalanceSuggestions({ fondo: 550, accion: 450 }, 1000, { fondo: 50, accion: 50 });
  const fondo = suggestions.find((row) => row.type === "fondo");
  assert.equal(fondo.action, "ok");
});

test("IV6: una desviación por encima del umbral sugiere vender el tipo sobreponderado", () => {
  const suggestions = Portfolio.rebalanceSuggestions({ fondo: 800, accion: 200 }, 1000, { fondo: 50, accion: 50 });
  const fondo = suggestions.find((row) => row.type === "fondo");
  assert.equal(fondo.currentPct, 80);
  assert.equal(fondo.deviation, 30);
  assert.equal(fondo.action, "vender");
  assert.equal(fondo.amount, -300);
});

test("IV6: un tipo infraponderado sugiere comprar la cantidad exacta para llegar al objetivo", () => {
  const suggestions = Portfolio.rebalanceSuggestions({ fondo: 800, accion: 200 }, 1000, { fondo: 50, accion: 50 });
  const accion = suggestions.find((row) => row.type === "accion");
  assert.equal(accion.action, "comprar");
  assert.equal(accion.amount, 300);
});

test("IV6: sin cartera (totalValue 0), no hay sugerencia aunque haya objetivos", () => {
  const suggestions = Portfolio.rebalanceSuggestions({}, 0, { fondo: 50, accion: 50 });
  assert.deepEqual(suggestions, []);
});
