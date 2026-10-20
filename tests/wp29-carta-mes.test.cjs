const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const root = path.resolve(__dirname, "..");
const letter = require("../canonical-month-letter.js");

// WP-29 (NHG-05, docs/WP29_DISENO.md): la carta del mes. Un motor puro de plantillas y selectores (sin IA) y su pantalla en Cierre. Los datos de aquí son inventados.

const item = (id, kind, planned, used, settled = true, extra = {}) => ({ id, label: extra.label || id, section: extra.section || "Sección", kind, planned, used, settled });

const SEPTEMBER = [
  item("income:nomina", "income", 3200, 3200, true, { label: "Nómina", section: "Trabajo" }),
  item("expense:hipoteca", "expense", 900, 900, true, { label: "Hipoteca", section: "Vivienda" }),
  item("expense:super", "expense", 600, 742.4, true, { label: "Supermercado", section: "Alimentación" }),
  item("expense:ocio", "expense", 200, 200, false, { label: "Ocio", section: "Ocio" }),
];

// ---- El motor --------------------------------------------------------------------------------------------------------------------------

test("la carta de un mes con una desviación: cinco huecos, en orden, con las cifras del mes", () => {
  const result = letter.compose({
    monthKey: "2026-09",
    items: SEPTEMBER,
    netWorth: { previousMonthKey: "2026-08", net: 152300, delta: 1800, debtDelta: 600, isMax: true, seriesCount: 4 },
    previousAdverse: { "expense:super": true },
  });
  assert.equal(result.calculable, true);
  assert.deepEqual(result.slots.map((slot) => slot.id), ["result", "deviation", "milestone", "action", "quality"]);
  assert.equal(result.slots[0].text, "Septiembre cierra con 1.358 € de margen, 142 € peor de lo previsto.");
  assert.match(result.slots[1].text, /La mayor desviación está en Supermercado \(Alimentación\): gasto de 742 € frente a 600 € previstos, toda la diferencia\./);
  assert.match(result.slots[2].text, /El patrimonio neto llega a 152\.300 €, su máximo desde que se registra\./);
  assert.match(result.slots[3].text, /Revisa el previsto de Supermercado: se ha desviado en contra dos cierres seguidos\./);
  assert.match(result.slots[4].text, /Se basa en 3 de 4 partidas con real \(el 96 % del importe\); el resto cuenta como previsto\./);
  assert.equal(result.text, result.slots.map((slot) => slot.text).join(" "));
  assert.equal(result.words, letter.countWords(result.text));
  assert.ok(result.words <= 120);
  assert.deepEqual(result.summary, { plannedNet: 1500, realNet: 1357.6, diffNet: -142.4, total: 4, withReal: 3, realSharePct: 96 });
});

test("es determinista: la misma entrada, el mismo texto, sin depender del orden de las partidas", () => {
  const facts = { monthKey: "2026-09", items: SEPTEMBER };
  const first = letter.compose(facts);
  assert.equal(letter.compose(facts).text, first.text);
  assert.equal(letter.compose({ ...facts, items: [...SEPTEMBER].reverse() }).text, first.text);
  // Empate exacto entre dos partidas: manda el nombre, no el orden.
  const tied = [item("a", "expense", 100, 160, true, { label: "Zeta" }), item("b", "expense", 100, 160, true, { label: "Alfa" }), item("c", "income", 1000, 1000, true, { label: "Nómina" })];
  const text = letter.compose({ monthKey: "2026-09", items: tied }).text;
  assert.match(text, /La mayor desviación está en Alfa/);
  assert.equal(letter.compose({ monthKey: "2026-09", items: [...tied].reverse() }).text, text);
});

test("sin ningún real no hay «resultado»: real y previsto serían el mismo número, y la carta lo dice", () => {
  const result = letter.compose({ monthKey: "2026-10", items: [item("i", "income", 3000, 3000, false), item("e", "expense", 2730, 2730, false)] });
  assert.match(result.slots[0].text, /^Octubre no tiene ningún real anotado: el margen que sale, 270 €, es solo el previsto\.$/);
  assert.doesNotMatch(result.text, /tal como se preveía|mejor de lo previsto|peor de lo previsto/);
  assert.equal(result.slots.some((slot) => slot.id === "deviation"), false, "sin reales no hay desviación que contar");
  assert.match(result.slots.find((slot) => slot.id === "action").text, /Quedaron 2 partidas sin real \(5\.730 € previstos\)/);
  assert.match(result.slots.at(-1).text, /Se basa en 0 de 2 partidas con real \(el 0 % del importe\).*Tómala con cautela\./);
  const deficit = letter.compose({ monthKey: "2026-10", items: [item("i", "income", 1000, 1000, false), item("e", "expense", 1500, 1500, false)] });
  assert.match(deficit.slots[0].text, /el déficit que sale, 500 €, es solo el previsto/);
});

test("el resultado frente a lo previsto: tal como se preveía, mejor, peor, déficit y sin margen", () => {
  const month = (items) => letter.compose({ monthKey: "2026-03", items }).slots[0].text;
  assert.equal(month([item("i", "income", 2000, 2000), item("e", "expense", 1500, 1500)]), "Marzo cierra con 500 € de margen, tal como se preveía.");
  assert.equal(month([item("i", "income", 2000, 2000), item("e", "expense", 1500, 1500.6)]), "Marzo cierra con 499 € de margen, tal como se preveía.", "menos de 1 € de diferencia es lo previsto");
  assert.equal(month([item("i", "income", 2000, 2000), item("e", "expense", 1500, 1300)]), "Marzo cierra con 700 € de margen, 200 € mejor de lo previsto.");
  assert.equal(month([item("i", "income", 2000, 2000), item("e", "expense", 1500, 2300)]), "Marzo cierra con 300 € de déficit, 800 € peor de lo previsto.");
  assert.equal(month([item("i", "income", 2000, 2000), item("e", "expense", 1500, 2000)]), "Marzo cierra sin margen ni déficit, 500 € peor de lo previsto.");
  // Un ingreso que no llega cuenta en contra, igual que un gasto que se pasa.
  assert.equal(month([item("i", "income", 2000, 1700), item("e", "expense", 1500, 1500)]), "Marzo cierra con 200 € de margen, 300 € peor de lo previsto.");
});

test("la mayor desviación: solo si es relevante (25 € y 5 % de la partida) y atribuida, no explicada", () => {
  const month = (items) => letter.compose({ monthKey: "2026-03", items });
  const calm = month([item("i", "income", 2000, 2000), item("e", "expense", 1500, 1524.9)]);
  assert.equal(calm.slots[1].text, "Ninguna partida se aparta de lo previsto de forma relevante.");
  const exactly = month([item("i", "income", 2000, 2000), item("e", "expense", 500, 525, true, { label: "Gasolina" })]);
  assert.match(exactly.slots[1].text, /Gasolina/, "25 € sobre 500 € es el 5 %: cuenta");
  const smallShare = month([item("i", "income", 2000, 2000), item("e", "expense", 1500, 1525, true, { label: "Piso" })]);
  assert.match(smallShare.slots[1].text, /^Ninguna partida/, "25 € sobre 1.500 € es el 1,7 %: no cuenta");
  // El ingreso que cae es la mayor desviación aunque haya un gasto menor; si explica MÁS que toda la diferencia (otra partida la compensa), no se le pone un porcentaje.
  const mixed = month([item("i", "income", 2000, 1500, true, { label: "Extra" }), item("e", "expense", 1000, 900, true, { label: "Ocio" })]);
  assert.equal(mixed.slots[1].text, "La mayor desviación está en Extra (Sección): ingreso de 1.500\u00a0€ frente a 2.000\u00a0€ previstos.");
  const partial = month([item("i", "income", 2000, 2000), item("e", "expense", 1000, 1300, true, { label: "Súper" }), item("o", "expense", 1000, 1100, true, { label: "Otro" })]);
  assert.match(partial.slots[1].text, /Súper \(Sección\): gasto de 1\.300\u00a0€ frente a 1\.000\u00a0€ previstos, el 75 % de la diferencia\./);
  // Una partida sin real no es una desviación aunque su previsto sea grande.
  assert.match(month([item("i", "income", 2000, 2000), item("e", "expense", 1500, 1500, true), item("x", "expense", 900, 900, false)]).slots[1].text, /^Ninguna partida/);
});

test("el hito: racha, máximo del patrimonio, deuda que baja y patrimonio que sube, en ese orden; que baje no es un hito", () => {
  const base = { monthKey: "2026-09", items: [item("i", "income", 2000, 2000), item("e", "expense", 1500, 1500)] };
  const milestone = (extra) => letter.compose({ ...base, ...extra }).slots.find((slot) => slot.id === "milestone")?.text;
  const worth = { previousMonthKey: "2026-08", net: 100000, delta: 2000, debtDelta: 300, isMax: true, seriesCount: 5 };
  const streak = [{ monthKey: "2026-08", diffNet: 0 }, { monthKey: "2026-07", diffNet: 15 }];
  assert.equal(milestone({ netWorth: worth, previousLetters: streak }), "Son 3 cierres seguidos igual o mejor que lo previsto.");
  assert.equal(milestone({ netWorth: worth }), "El patrimonio neto llega a 100.000 €, su máximo desde que se registra.");
  assert.equal(milestone({ netWorth: { ...worth, isMax: false } }), "La deuda pendiente baja 300 € desde el cierre de agosto.");
  assert.equal(milestone({ netWorth: { ...worth, isMax: false, debtDelta: 49 } }), "El patrimonio neto sube 2.000 € desde el cierre de agosto.");
  assert.equal(milestone({ netWorth: { ...worth, isMax: false, debtDelta: 0, delta: -500 } }), undefined, "que el patrimonio baje no es un hito");
  assert.equal(milestone({ netWorth: { ...worth, isMax: true, seriesCount: 2 }, previousLetters: [] }), "La deuda pendiente baja 300 € desde el cierre de agosto.", "con menos de 3 fotos no hay «máximo»");
  assert.equal(milestone({}), undefined);
});

test("la racha cuenta meses seguidos, sin huecos, y se rompe con un mes peor de lo previsto", () => {
  const prev = (list) => list.map(([monthKey, diffNet]) => ({ monthKey, diffNet }));
  assert.equal(letter.streakLength(prev([["2026-08", 0], ["2026-07", 20]]), "2026-09", 5), 3);
  assert.equal(letter.streakLength(prev([["2026-08", 0], ["2026-06", 20]]), "2026-09", 5), 2, "falta julio: hueco");
  assert.equal(letter.streakLength(prev([["2026-08", -1.01], ["2026-07", 20]]), "2026-09", 5), 1, "agosto fue peor");
  assert.equal(letter.streakLength(prev([["2026-08", -1], ["2026-07", 20]]), "2026-09", 5), 3, "hasta 1 € de diferencia es lo previsto");
  assert.equal(letter.streakLength(prev([["2026-08", 10]]), "2026-09", -50), 0, "este mes fue peor: no hay racha");
  assert.equal(letter.streakLength(prev([["2025-12", 10], ["2025-11", 3]]), "2026-01", 0), 3, "cruza de año");
});

test("la acción: la misma partida en contra dos cierres, partidas sin real, déficit; o ninguna", () => {
  const action = (facts) => letter.compose({ monthKey: "2026-09", ...facts }).slots.find((slot) => slot.id === "action")?.text;
  const adverse = [item("i", "income", 3000, 3000), item("e", "expense", 1000, 1300, true, { label: "Súper" })];
  assert.equal(action({ items: adverse, previousAdverse: { e: true } }), "Revisa el previsto de Súper: se ha desviado en contra dos cierres seguidos.");
  assert.equal(action({ items: adverse, previousAdverse: {} }), undefined, "una sola vez no es un patrón");
  // La partida a favor dos meses seguidos no pide revisión en contra.
  assert.equal(action({ items: [item("i", "income", 3000, 3000), item("e", "expense", 1000, 700, true)], previousAdverse: { e: true } }), undefined);
  assert.match(action({ items: [...adverse, item("x", "expense", 50, 50, false)] }), /^Quedó 1 partida sin real \(50 € previstos\): anótalas o cancélalas/);
  assert.match(action({ items: [...adverse, item("x", "expense", 50, 50, false), item("y", "expense", 70, 70, false)] }), /^Quedaron 2 partidas sin real \(120 € previstos\)/);
  assert.equal(action({ items: [item("i", "income", 1000, 1000), item("e", "expense", 1500, 1500)] }), "El mes cierra en déficit: revisa en Plan qué partidas se pueden ajustar antes del próximo cierre.", "déficit con todo real");
  assert.equal(action({ items: [item("i", "income", 3000, 3000), item("e", "expense", 1000, 1000)] }), undefined);
});

test("la calidad del dato siempre está, y avisa cuando hay poco real", () => {
  const quality = (items) => letter.compose({ monthKey: "2026-09", items }).slots.at(-1);
  assert.equal(quality([item("i", "income", 3000, 3000), item("e", "expense", 1000, 1000)]).text, "Se basa en las 2 partidas, todas con real.");
  assert.match(quality([item("i", "income", 3000, 3000), item("e", "expense", 1000, 1000, false)]).text, /^Se basa en 1 de 2 partidas con real \(el 75 % del importe\); el resto cuenta como previsto\.$/);
  assert.match(quality([item("i", "income", 1000, 1000), item("e", "expense", 4000, 4000, false)]).text, /\(el 20 % del importe\).*Tómala con cautela\./);
  for (const items of [SEPTEMBER, [item("i", "income", 10, 10, false)], [item("e", "expense", 5, 5)]]) {
    assert.equal(letter.compose({ monthKey: "2026-09", items }).slots.at(-1).id, "quality");
  }
});

test("las partidas a cero no cuentan como partidas; sin ninguna con importe no hay carta", () => {
  const withZeros = letter.compose({ monthKey: "2026-09", items: [...SEPTEMBER, item("z", "expense", 0, 0, false), item("z2", "income", 0, 0, true)] });
  assert.equal(withZeros.summary.total, 4);
  for (const bad of [{ monthKey: "2026-13", items: SEPTEMBER }, { monthKey: "", items: SEPTEMBER }, {}]) {
    assert.equal(letter.compose(bad).calculable, false);
    assert.match(letter.compose(bad).reason, /Falta el mes/);
  }
  const empty = letter.compose({ monthKey: "2026-09", items: [item("z", "expense", 0, 0)] });
  assert.equal(empty.calculable, false);
  assert.match(empty.reason, /no hay nada que contar/);
  assert.equal(letter.compose({ monthKey: "2026-09", items: "no es una lista" }).calculable, false);
});

test("nunca pasa de 120 palabras: se sacrifica primero el hito, luego la acción, luego el detalle; el resultado y la calidad se quedan", () => {
  const long = "Gasto muy largo con un nombre que no cabe en ninguna parte de verdad";
  const facts = {
    monthKey: "2026-09",
    items: [item("i", "income", 3000, 3000, true), item("e", "expense", 1000, 1500, true, { label: long, section: long }), item("x", "expense", 50, 50, false)],
    netWorth: { previousMonthKey: "2026-08", net: 100000, delta: 5000, debtDelta: 900, isMax: true, seriesCount: 6 },
    previousAdverse: { e: true },
  };
  const full = letter.compose(facts);
  assert.ok(full.words <= 120);
  const steps = [];
  for (let limit = 110; limit >= 12; limit -= 2) {
    const result = letter.compose(facts, { maxWords: limit });
    assert.equal(result.slots[0].id, "result");
    assert.equal(result.slots.at(-1).id, "quality");
    steps.push({ limit, ids: result.slots.map((slot) => slot.id).join(",") });
  }
  const sequence = [...new Set(steps.map((step) => step.ids))];
  assert.deepEqual(sequence.map((ids) => ids.split(",").filter((id) => ["milestone", "action"].includes(id)).join(",")).filter((value, index, list) => list.indexOf(value) === index), ["milestone,action", "action", ""], "primero cae el hito, luego la acción");
  const dropped = letter.compose(facts, { maxWords: 50 });
  assert.ok(dropped.omitted.some((entry) => entry.id === "milestone" && /límite de palabras/.test(entry.reason)));
});

test("el límite se cumple con cualquier combinación de entradas (300 casos con semilla fija)", () => {
  let seed = 29;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const labels = ["Hipoteca", "Supermercado y limpieza del hogar de toda la familia", "A", "Colegio y actividades extraescolares de los niños pequeños", "Seguro del coche"];
  for (let run = 0; run < 300; run += 1) {
    const items = Array.from({ length: 1 + Math.floor(random() * 12) }, (_, index) => {
      const planned = Math.round(random() * 4000 * 100) / 100;
      const settled = random() > 0.3;
      return item(`p${index}`, random() > 0.7 ? "income" : "expense", planned, settled ? Math.round(planned * (0.5 + random()) * 100) / 100 : planned, settled, { label: labels[Math.floor(random() * labels.length)], section: labels[Math.floor(random() * labels.length)] });
    });
    const result = letter.compose({
      monthKey: `2026-${String(1 + Math.floor(random() * 12)).padStart(2, "0")}`,
      items,
      netWorth: random() > 0.5 ? { previousMonthKey: "2026-01", net: Math.round(random() * 1e6), delta: Math.round(random() * 1e4), debtDelta: Math.round(random() * 1e3), isMax: random() > 0.5, seriesCount: 5 } : null,
      previousAdverse: Object.fromEntries(items.filter(() => random() > 0.5).map((entry) => [entry.id, true])),
    });
    if (!result.calculable) continue;
    assert.ok(result.words <= 120, `${result.words} palabras: ${result.text}`);
    assert.equal(result.slots[0].id, "result");
    assert.equal(result.slots.at(-1).id, "quality");
  }
});

test("ninguna cifra del texto sale de la nada: todas están en la entrada o se derivan de ella", () => {
  const facts = {
    monthKey: "2026-09",
    items: SEPTEMBER,
    netWorth: { previousMonthKey: "2026-08", net: 152300, delta: 1800, debtDelta: 600, isMax: false, seriesCount: 4 },
  };
  const summary = letter.summarize(facts.items);
  const allowed = new Set([summary.realNet, summary.plannedNet, summary.diffNet, summary.unsettledPlanned, summary.total, summary.withReal, summary.realSharePct, 100, facts.netWorth.net, facts.netWorth.delta, facts.netWorth.debtDelta, 1, 2]
    .map((value) => letter.euros(value).replace(/ €/, "")));
  facts.items.forEach((entry) => { allowed.add(letter.euros(entry.planned).replace(/ €/, "")); allowed.add(letter.euros(entry.used).replace(/ €/, "")); });
  const text = letter.compose(facts).text.replace(/\b(2026)\b/g, "");
  const numbers = text.match(/\d[\d.]*/g) || [];
  assert.ok(numbers.length >= 6);
  for (const value of numbers) assert.ok(allowed.has(value), `la cifra «${value}» no sale de la entrada`);
});

test("el dinero se escribe a la española, en euros enteros y siempre en positivo (el signo se dice con palabras)", () => {
  assert.equal(letter.euros(1250.4), "1.250 €");
  assert.equal(letter.euros(999.5), "1.000 €");
  assert.equal(letter.euros(0), "0 €");
  assert.equal(letter.euros(-1234567), "1.234.567 €");
  assert.equal(letter.euros("no"), "0 €");
  assert.equal(letter.euros(null), "0 €");
});

test("las cartas guardadas: se ordenan, no se repiten, no pasan de 36 y se descarta lo que no es una carta", () => {
  const record = (monthKey, text = "Una carta.") => letter.toRecord({ calculable: true, monthKey, text, words: 2, summary: { plannedNet: 1, realNet: 2, diffNet: 1, total: 3, withReal: 3 } }, { closedAt: `${monthKey}-28T10:00:00Z` });
  let store = [];
  ["2026-03", "2026-01", "2026-02"].forEach((month) => { store = letter.upsert(store, record(month)); });
  assert.deepEqual(store.map((entry) => entry.monthKey), ["2026-03", "2026-02", "2026-01"]);
  store = letter.upsert(store, record("2026-02", "Reescrita."));
  assert.equal(store.length, 3);
  assert.equal(store.find((entry) => entry.monthKey === "2026-02").text, "Reescrita.");
  const many = Array.from({ length: 50 }, (_, index) => record(`${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`));
  assert.equal(letter.normalizeStore(many).length, letter.MAX_LETTERS);
  assert.equal(letter.normalizeStore(many)[0].monthKey, "2024-02");
  assert.deepEqual(letter.normalizeStore([{ monthKey: "2026-01", text: "sin esquema" }, null, "x", { schemaId: letter.SCHEMA_ID, monthKey: "2026-13", text: "mes malo" }, { schemaId: letter.SCHEMA_ID, monthKey: "2026-01", text: "" }]), []);
  assert.deepEqual(letter.normalizeStore({ letters: [record("2026-04")] }).map((entry) => entry.monthKey), ["2026-04"]);
  assert.equal(letter.normalizeStore("basura").length, 0);
  assert.equal(letter.toRecord({ calculable: false }), null);
  assert.equal(letter.upsert(store, null).length, 3);
  assert.equal(record("2026-05").reconstructed, false);
  assert.equal(letter.toRecord({ calculable: true, monthKey: "2026-05", text: "x", words: 1, summary: {} }, { reconstructed: true }).reconstructed, true);
});

test("el motor es puro: sin DOM, sin red, sin almacenamiento y sin reloj", () => {
  const source = fs.readFileSync(path.join(root, "canonical-month-letter.js"), "utf8");
  for (const forbidden of [/\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bnavigator\b/, /Date\.now\s*\(/, /new Date\s*\(\s*\)/, /Math\.random\s*\(/]) {
    assert.doesNotMatch(source, forbidden, `el motor no debe usar ${forbidden}`);
  }
});

// ---- La pantalla (carta-mes-ui.js), en un entorno aislado ------------------------------------------------------------------------------------

const uiSource = fs.readFileSync(path.join(root, "carta-mes-ui.js"), "utf8");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function uiSandbox({ monthItems = {}, status = {}, stored = null, netWorth = null, copy = null, noCard = false, signed = null } = {}) {
  const storage = stored ? { "month-letters:demo": JSON.stringify(stored) } : {};
  const announced = [];
  const card = { hidden: true, innerHTML: "", attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, listener: null, querySelector(selector) { return selector === "[data-carta-mes-copy]" ? { addEventListener: (_name, fn) => { card.listener = fn; } } : null; } };
  const months = Object.keys(monthItems).map((key) => ({ key, rows: monthItems[key] }));
  const context = {
    Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, console, Boolean,
    globalThis: null,
    FinanceCanonicalMonthLetter: letter,
    FinanceCanonicalNetWorth: netWorth ? { buildSnapshot: () => ({ calculable: false }), movement: netWorth.movement } : undefined,
    patrimonioLoad: () => ({ snapshots: netWorth ? netWorth.snapshots : [] }),
    patrimonioComponents: () => ({}),
    storageKey: (name) => `${name}:demo`,
    storageGet: (key, fallback) => (key in storage ? storage[key] : fallback),
    storageSet: (key, value) => { storage[key] = value; },
    queueRemoteSave: () => { context.saved = (context.saved || 0) + 1; },
    cuadroMandosAllMonths: () => months,
    planMesCollect: (month) => ({ income: month.rows.filter((row) => row.kind === "income"), expense: month.rows.filter((row) => row.kind === "expense") }),
    actualAwareInfo: (row) => ({ status: status[row.id] || "pending" }),
    registrarMesLongMonth: (key) => `mes ${key}`,
    formatIsoDate: (iso) => iso.split("-").reverse().join("/"),
    announceStatus: (message) => announced.push(message),
    escapeHtml,
    ...(signed ? { isSignedClosedMonthKey: (key) => signed.includes(key) } : {}),
    qs: (id) => (id === "cartaMes" && !noCard ? card : null),
    navigator: { clipboard: { writeText: async (value) => { if (copy === "fail") throw new Error("no"); copied.push(value); } } },
  };
  const copied = [];
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(uiSource, context);
  return { context, storage, card, announced, copied };
}

const plain = (value) => JSON.parse(JSON.stringify(value)); // los objetos de un vm.Context no comparan con deepEqual por prototipo

// Una partida como la devuelve planMesCollect.
const entry = (id, kind, planned, usado, hasActual, label = id) => ({ key: `${kind}:${id}`, row: { id }, label, sectionName: "Sección", kind, planned, usado, hasActual });

const OCTOBER = [
  entry("nomina", "income", 3000, 3000, true, "Nómina"),
  entry("hipoteca", "expense", 900, 900, true, "Hipoteca"),
  entry("super", "expense", 600, 760, true, "Súper <b>"),
  entry("ocio", "expense", 200, 200, false, "Ocio"),
  entry("viaje", "expense", 300, 300, false, "Viaje"),
];

test("pantalla: cargar el script no toca el DOM ni la red y no deja nada en marcha", () => {
  assert.doesNotThrow(() => uiSandbox());
  assert.doesNotMatch(uiSource, /document\.|addEventListener\(["']load|fetch\(|XMLHttpRequest/);
});

test("pantalla: las partidas se leen con su previsto y su real; una cancelada cuenta 0 y está resuelta", () => {
  const { context } = uiSandbox({ monthItems: { "2026-10": OCTOBER }, status: { viaje: "cancelled" } });
  const items = context.cartaMesItems({ key: "2026-10", rows: OCTOBER });
  assert.equal(items.length, 5);
  assert.deepEqual(plain(items.find((item) => item.id === "expense:viaje")), { id: "expense:viaje", label: "Viaje", section: "Sección", kind: "expense", planned: 300, used: 0, settled: true });
  assert.deepEqual(plain(items.find((item) => item.id === "expense:ocio")), { id: "expense:ocio", label: "Ocio", section: "Sección", kind: "expense", planned: 200, used: 200, settled: false });
  assert.equal(items.find((item) => item.id === "income:nomina").settled, true);
});

test("pantalla: al firmar se guarda la carta con los datos de ese momento y se pide guardar en la nube", () => {
  const { context, storage } = uiSandbox({ monthItems: { "2026-10": OCTOBER } });
  assert.equal(context.recordCartaMes("2026-10", "2026-11-02T09:00:00.000Z", null), true);
  const saved = JSON.parse(storage["month-letters:demo"]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].monthKey, "2026-10");
  assert.equal(saved[0].closedAt, "2026-11-02T09:00:00.000Z");
  assert.equal(saved[0].reconstructed, false);
  assert.match(saved[0].text, /^Octubre cierra con 840 € de margen, 160 € peor de lo previsto\./);
  assert.equal(context.saved, 1);
  // Firmar otra vez el mismo mes (reabrir y volver a firmar) reescribe, no duplica.
  context.recordCartaMes("2026-10", "2026-11-05T09:00:00.000Z", null);
  assert.equal(JSON.parse(storage["month-letters:demo"]).length, 1);
  // Un mes que no existe, o sin partidas con importe, no escribe nada y no rompe el cierre.
  assert.equal(context.recordCartaMes("2026-12", "x", null), false);
  assert.equal(uiSandbox({ monthItems: { "2026-10": [] } }).context.recordCartaMes("2026-10", "x", null), false);
});

test("pantalla: la racha y la partida que se repite salen de las cartas y del mes anterior", () => {
  const september = [entry("nomina", "income", 3000, 3000, true), entry("super", "expense", 600, 800, true, "Súper <b>")];
  const stored = [{ schemaId: letter.SCHEMA_ID, monthKey: "2026-09", closedAt: "x", text: "Una.", words: 1, plannedNet: 2400, realNet: 2200, diffNet: -200, total: 2, withReal: 2, reconstructed: false }];
  const { context } = uiSandbox({ monthItems: { "2026-09": september, "2026-10": OCTOBER }, stored });
  const composed = context.cartaMesCompose("2026-10", null);
  assert.match(composed.slots.find((slot) => slot.id === "action").text, /^Revisa el previsto de Súper <b>: se ha desviado en contra dos cierres seguidos\.$/, "el motor devuelve texto, la pantalla lo escapa");
  assert.equal(composed.slots.some((slot) => slot.id === "milestone"), false, "septiembre fue peor que lo previsto: no hay racha");
});

test("pantalla: el patrimonio de este cierre frente al anterior; sin dos fotos completas no se cuenta nada", () => {
  const snap = (monthKey, net, debt) => ({ monthKey, net, debt });
  const movement = (previous, current) => ({ calculable: true, delta: current.net - previous.net, rows: [{ id: "debt", value: previous.debt - current.debt }] });
  const worth = (snapshots) => plain(uiSandbox({ monthItems: { "2026-10": OCTOBER }, netWorth: { snapshots, movement } }).context.cartaMesNetWorth("2026-10", null));
  assert.deepEqual(worth([snap("2026-10", 120000, 80000), snap("2026-09", 118000, 80600), snap("2026-08", 110000, 81000)]), { previousMonthKey: "2026-09", net: 120000, delta: 2000, debtDelta: 600, isMax: true, seriesCount: 3 });
  assert.equal(worth([snap("2026-10", 100000, 80000), snap("2026-09", 118000, 80000)]).isMax, false);
  assert.equal(worth([snap("2026-10", 120000, 80000)]), null, "sin cierre anterior");
  assert.equal(worth([snap("2026-10", null, 80000), snap("2026-09", 1, 1)]), null, "la foto de este cierre está incompleta");
  assert.equal(uiSandbox({ monthItems: { "2026-10": OCTOBER } }).context.cartaMesNetWorth("2026-10", null), null, "sin el motor de patrimonio");
});

test("pantalla: con el mes abierto es un borrador; firmado, la carta guardada; firmado antes de la carta, una reconstruida y se dice", () => {
  const { context, card } = uiSandbox({ monthItems: { "2026-10": OCTOBER } });
  context.renderCartaMes(letter, "2026-10", false);
  assert.equal(card.hidden, false);
  assert.match(card.innerHTML, /Carta de mes 2026-10 · borrador/);
  assert.match(card.innerHTML, /Borrador con los datos de hoy\. Se escribe y se guarda al firmar el cierre/);
  assert.match(card.innerHTML, /sin IA, y cada cifra sale de vuestros datos/);
  assert.doesNotMatch(card.innerHTML, /<b>/, "el nombre de la partida se escapa");
  assert.match(card.innerHTML, /Súper &lt;b&gt;/);

  context.recordCartaMes("2026-10", "2026-11-02T09:00:00.000Z", null);
  context.renderCartaMes(letter, "2026-10", true);
  assert.doesNotMatch(card.innerHTML, /borrador/);
  assert.match(card.innerHTML, /Escrita al firmar el cierre, el 02\/11\/2026, con los datos de entonces\./);

  const old = uiSandbox({ monthItems: { "2026-10": OCTOBER } });
  old.context.renderCartaMes(letter, "2026-10", true);
  assert.match(old.card.innerHTML, /Reconstruida hoy con los datos actuales: este cierre se firmó antes de que existiera la carta/);
  assert.equal(old.storage["month-letters:demo"], undefined, "pintar no escribe nada");
});

test("pantalla: las cartas anteriores se listan (sin la del mes) y la tarjeta se oculta si no hay nada que contar", () => {
  const record = (monthKey, text) => ({ schemaId: letter.SCHEMA_ID, monthKey, closedAt: `${monthKey}-28T10:00:00Z`, text, words: 3, plannedNet: 1, realNet: 1, diffNet: 0, total: 1, withReal: 1, reconstructed: false });
  const stored = [record("2026-10", "Carta de octubre."), record("2026-09", "Carta <i>de</i> septiembre."), record("2026-08", "Carta de agosto.")];
  const { context, card } = uiSandbox({ monthItems: { "2026-10": OCTOBER }, stored });
  context.renderCartaMes(letter, "2026-10", true);
  assert.match(card.innerHTML, /Cartas anteriores \(2\)/);
  assert.match(card.innerHTML, /Carta &lt;i&gt;de&lt;\/i&gt; septiembre\./);
  assert.match(card.innerHTML, /Carta de agosto\./);
  assert.match(card.innerHTML, /data-carta-mes-texto>Carta de octubre\.<\/p>/, "la carta guardada es la que se enseña, no una recalculada");

  const empty = uiSandbox({ monthItems: { "2026-10": [] } });
  empty.card.hidden = false;
  empty.context.renderCartaMes(letter, "2026-10", false);
  assert.equal(empty.card.hidden, true);
  const noEngine = uiSandbox({ monthItems: { "2026-10": OCTOBER } });
  noEngine.card.hidden = false;
  noEngine.context.renderCartaMes(null, "2026-10", false);
  assert.equal(noEngine.card.hidden, true);
  assert.doesNotThrow(() => uiSandbox({ noCard: true }).context.renderCartaMes(letter, "2026-10", false));
});

test("pantalla: «Copiar la carta» copia el texto tal cual y avisa; si el navegador no deja, lo dice", async () => {
  const ok = uiSandbox({ monthItems: { "2026-10": OCTOBER } });
  ok.context.renderCartaMes(letter, "2026-10", false);
  await ok.card.listener();
  assert.equal(ok.copied.length, 1);
  assert.match(ok.copied[0], /^Octubre cierra con 840 € de margen/);
  assert.doesNotMatch(ok.copied[0], /&lt;|<b>.*<\/b>.*<\/b>/);
  assert.deepEqual(ok.announced, ["Carta copiada."]);
  const bad = uiSandbox({ monthItems: { "2026-10": OCTOBER }, copy: "fail" });
  bad.context.renderCartaMes(letter, "2026-10", false);
  await bad.card.listener();
  assert.match(bad.announced[0], /No se pudo copiar la carta/);
});

test("pantalla: una carta cuyo mes se reabrió no cuenta para la racha ni se lista como anterior hasta volver a firmarse", () => {
  const record = (monthKey, diffNet) => ({ schemaId: letter.SCHEMA_ID, monthKey, closedAt: `${monthKey}-28T10:00:00Z`, text: `Carta de ${monthKey}.`, words: 3, plannedNet: 1, realNet: 1, diffNet, total: 1, withReal: 1, reconstructed: false });
  const stored = [record("2026-09", 0), record("2026-08", 10)];
  const octoberOk = [entry("nomina", "income", 3000, 3000, true), entry("hipoteca", "expense", 900, 900, true)];
  const open = uiSandbox({ monthItems: { "2026-10": octoberOk }, stored, signed: ["2026-10", "2026-09", "2026-08"] });
  assert.match(open.context.cartaMesCompose("2026-10", null).text, /Son 3 cierres seguidos igual o mejor que lo previsto\./);
  const reopened = uiSandbox({ monthItems: { "2026-10": octoberOk }, stored, signed: ["2026-10", "2026-08"] });
  assert.doesNotMatch(reopened.context.cartaMesCompose("2026-10", null).text, /cierres seguidos/, "septiembre está reabierto: su carta vieja no cuenta");
  reopened.context.renderCartaMes(letter, "2026-10", true);
  assert.match(reopened.card.innerHTML, /Cartas anteriores \(1\)/);
  assert.doesNotMatch(reopened.card.innerHTML, /Carta de 2026-09\./);
  // Sin partidas en septiembre en este entorno, volver a firmar no escribe nada: la vieja se conserva tal cual (no se pierde ni se duplica).
  reopened.context.recordCartaMes("2026-09", "2026-11-10T09:00:00.000Z", null);
  assert.deepEqual(JSON.parse(reopened.storage["month-letters:demo"] ?? JSON.stringify(stored)).filter((item) => item.monthKey === "2026-09").map((item) => item.text), ["Carta de 2026-09."]);
});

// ---- El cableado -----------------------------------------------------------------------------------------------------------------------

test("cableado: se firma después de la foto del patrimonio, se guarda en la copia, se pinta en Cierre y se registra en la app y en el sitio publicado", () => {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const app = codigoApp();
  assert.ok(app.indexOf("recordPatrimonioSnapshot?.(month, closedAt, closeBalances)") < app.indexOf("recordCartaMes?.(month, closedAt, closeBalances)"), "la carta lee la foto del patrimonio: va después");
  assert.ok(app.indexOf("recordCartaMes?.(month, closedAt, closeBalances)") < app.indexOf("saveLocalSnapshot();\n    refreshReconciliationView();"), "y antes de guardar el estado local");
  assert.match(app.slice(app.indexOf("const BACKUP_LOCAL_STORES"), app.indexOf("];", app.indexOf("const BACKUP_LOCAL_STORES"))), /"month-letters"/);
  assert.match(read("views/cierre.js"), /renderCartaMes\?\.\(window\.FinanceCanonicalMonthLetter, currentMonthKey, Boolean\(currentClosure\)\)/);
  const html = read("index.html");
  assert.ok(html.indexOf("canonical-month-letter.js") < html.indexOf("carta-mes-ui.js"), "el motor antes que la pantalla");
  assert.match(html, /<link rel="stylesheet" href="carta-mes\.css\?v=/);
  assert.match(html, /<article class="e19-card carta-mes" id="cartaMes" hidden><\/article>/);
  for (const file of ["service-worker.js", "tools/build-public-site.mjs"]) {
    const source = read(file);
    for (const name of ["canonical-month-letter.js", "carta-mes-ui.js", "carta-mes.css"]) assert.ok(source.includes(`"${name}"`) || source.includes(`"./${name}"`), `${file} registra ${name}`);
  }
  assert.match(read("novedades.js"), /2026-10-12-wp29/);
});
