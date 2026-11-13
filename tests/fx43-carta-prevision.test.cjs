// FX-43 (backlog de noviembre, primera carta con el cierre de noviembre del 1-3/12) · la carta del mes cuenta la previsión: cómo acabó la
// caja frente a lo que se preveía el día 1 y el 15 (las fotos de WP-12) y qué espera del mes siguiente. Dos huecos más, recortables antes
// que el resultado y la calidad del dato. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");

const letter = require("../canonical-month-letter.js");

const item = (id, kind, planned, used, settled = true, extra = {}) => ({ id, label: extra.label || id, section: extra.section || "Sección", kind, planned, used, settled });
const NOVIEMBRE = [
  item("income:nomina", "income", 3200, 3200, true, { label: "Nómina INVENTADA", section: "Trabajo" }),
  item("expense:hipoteca", "expense", 900, 900, true, { label: "Hipoteca INVENTADA", section: "Vivienda" }),
  item("expense:super", "expense", 600, 742.4, true, { label: "Supermercado", section: "Alimentación" }),
];
const plano = (value) => String(value).replace(/\u00a0/g, " ");
const caja = { actual: 8700, slots: [{ label: "día 1", predicted: 9200 }, { label: "día 15", predicted: 8650 }] };
const diciembre = { monthKey: "2026-12", lowValue: 6600, lowDay: 14, endValue: 13000, floor: 1500 };

test("FX-43 · la caja frente a la previsión del día 1 y el 15, justo después del resultado; y el mes siguiente antes de la calidad", () => {
  const r = letter.compose({ monthKey: "2026-11", items: NOVIEMBRE, forecastCheck: caja, nextMonth: diciembre });
  assert.equal(r.calculable, true);
  assert.deepEqual(r.slots.map((slot) => slot.id), ["result", "forecast", "deviation", "next", "quality"]);
  assert.equal(plano(r.slots[1].text), "En caja hubo 8.700 € al cierre. La previsión del día 1 esperaba 9.200 € y la del día 15, 8.650 € (50 € de menos).");
  assert.equal(plano(r.slots[3].text), "Para diciembre, la previsión espera lo más bajo el día 14 (6.600 €, 5.100 € sobre el suelo) y cerrar con 13.000 €.");
  assert.ok(r.words <= 120);
});

test("FX-43 · optimista, acertada, solo una foto y bajo el suelo; sin datos, el hueco no sale (no se inventa)", () => {
  const optimista = letter.compose({ monthKey: "2026-11", items: NOVIEMBRE, forecastCheck: { actual: 8000, slots: [{ label: "día 15", predicted: 8650 }] } });
  assert.equal(plano(optimista.slots.find((slot) => slot.id === "forecast").text), "En caja hubo 8.000 € al cierre. La previsión del día 15 esperaba 8.650 € (650 € de más).");
  const acierto = letter.compose({ monthKey: "2026-11", items: NOVIEMBRE, forecastCheck: { actual: 8650.4, slots: [{ label: "día 15", predicted: 8650 }] } });
  assert.match(acierto.slots.find((slot) => slot.id === "forecast").text, /\(acertó\)\.$/);
  const bajo = letter.compose({ monthKey: "2026-11", items: NOVIEMBRE, nextMonth: { ...diciembre, lowValue: 1200, endValue: undefined } });
  assert.equal(plano(bajo.slots.find((slot) => slot.id === "next").text), "Para diciembre, la previsión espera lo más bajo el día 14 (1.200 €, 300 € por debajo del suelo).");
  const sin = letter.compose({ monthKey: "2026-11", items: NOVIEMBRE, forecastCheck: { actual: 8700, slots: [] }, nextMonth: { monthKey: "2026-12" } });
  assert.deepEqual(sin.slots.map((slot) => slot.id), ["result", "deviation", "quality"]);
});

test("FX-43 · si no cabe en las palabras, primero se acortan y después salen, antes que el resultado y la calidad", () => {
  const corta = letter.compose({ monthKey: "2026-11", items: NOVIEMBRE, forecastCheck: caja, nextMonth: diciembre }, { maxWords: 60 });
  assert.ok(corta.words <= 60, `${corta.words} palabras`);
  assert.equal(corta.slots[0].id, "result");
  assert.equal(corta.slots.at(-1).id, "quality");
  const forecast = corta.slots.find((slot) => slot.id === "forecast");
  if (forecast) assert.equal(plano(forecast.text), "En caja hubo 8.700 € al cierre; la previsión del día 15 esperaba 8.650 € (50 € de menos).");
  const minima = letter.compose({ monthKey: "2026-11", items: NOVIEMBRE, forecastCheck: caja, nextMonth: diciembre }, { maxWords: 30 });
  assert.deepEqual(minima.slots.map((slot) => slot.id).filter((id) => ["forecast", "next"].includes(id)), [], "a 30 palabras salen las dos");
  assert.ok(minima.omitted.some((item) => item.id === "next") && minima.omitted.some((item) => item.id === "forecast"));
});
