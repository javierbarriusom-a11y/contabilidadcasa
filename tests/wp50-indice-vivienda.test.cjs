const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const V = require("../canonical-index-valuation.js");

// WP-50 (CAR-04): la vivienda y el local revalorizados por un índice. Pruebas de oro con cifras calculadas a mano. Lo que importa: que sin el índice del trimestre de la declaración NO se invente nada,
// que lo declarado nunca se modifique, y que la estimación solo sustituya al valor declarado donde el hogar lo active.

const deepFreeze = (value) => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; };
const series = (points) => ({ label: "IPV vivienda", points });
// Índice (invención de la prueba, no del INE): 2024-T1 150, 2025-T2 165, 2026-T2 180.
const IPV = () => series([{ quarter: "2024-T1", value: 150 }, { quarter: "2025-T2", value: 165 }, { quarter: "2026-T2", value: 180 }]);

test("WP-50 · los trimestres: de fecha a «AAAA-Tn», etiqueta en español, distancia entre trimestres y fechas inválidas", () => {
  assert.equal(V.quarterOf("2026-01-15"), "2026-T1");
  assert.equal(V.quarterOf("2026-03-31"), "2026-T1");
  assert.equal(V.quarterOf("2026-04-01"), "2026-T2");
  assert.equal(V.quarterOf("2026-12"), "2026-T4");
  assert.equal(V.quarterOf("2026-13-01"), "");
  assert.equal(V.quarterOf("hoy"), "");
  assert.equal(V.quarterLabel("2026-T2"), "T2 2026");
  assert.equal(V.quartersBetween("2025-T4", "2026-T2"), 2);
  assert.equal(V.quartersBetween("2026-T2", "2025-T4"), -2);
  assert.equal(V.validQuarter("2026-T5"), false);
});

test("WP-50 · caso de oro: 300.000 € declarados en T2 2025 con el índice 165 → 327.272,73 € con el 180 de T2 2026", () => {
  const result = V.estimate({ declaredValue: 300000, declaredDate: "2025-05-10", series: IPV(), todayQuarter: "2026-T3" });
  assert.equal(result.status, "estimated");
  assert.equal(result.value, 327272.73, "300.000 × 180 ÷ 165");
  assert.equal(result.delta, 27272.73);
  assert.equal(result.changePct, 9.09, "180 ÷ 165 − 1 = 9,0909 %");
  assert.deepEqual([result.baseQuarter, result.baseIndex, result.latestQuarter, result.latestIndex], ["2025-T2", 165, "2026-T2", 180]);
  assert.equal(result.chip, "estimado por índice · T2 2026");
  assert.equal(result.declaredValue, 300000, "el valor declarado no se toca");
  assert.equal(result.stale, false);
  const local = V.estimate({ declaredValue: 200000, declaredDate: "2024-02-01", series: IPV() });
  assert.equal(local.value, 240000, "200.000 × 180 ÷ 150 (+20 %)");
  assert.equal(local.changePct, 20);
  const fall = V.estimate({ declaredValue: 100000, declaredDate: "2025-06-30", series: series([{ quarter: "2025-T2", value: 200 }, { quarter: "2026-T1", value: 190 }]) });
  assert.deepEqual([fall.value, fall.changePct, fall.delta], [95000, -5, -5000], "el índice también baja");
});

test("WP-50 · sin el índice del trimestre de la declaración, o sin trimestre posterior, NO se inventa nada: se queda el valor declarado", () => {
  const noBase = V.estimate({ declaredValue: 300000, declaredDate: "2025-11-20", series: IPV() });
  assert.deepEqual([noBase.status, noBase.estimated, noBase.value, noBase.baseQuarter], ["no-index-base", false, 300000, "2025-T4"], "no se interpola entre 2025-T2 y 2026-T2 ni se usa el trimestre más cercano");
  const same = V.estimate({ declaredValue: 300000, declaredDate: "2026-05-02", series: IPV() });
  assert.deepEqual([same.status, same.value], ["declared-current", 300000], "declarado en el último trimestre con índice: no hay nada que mover");
  const older = V.estimate({ declaredValue: 300000, declaredDate: "2026-05-02", series: series([{ quarter: "2025-T2", value: 165 }]) });
  assert.equal(older.status, "no-index-base");
  assert.equal(V.estimate({ declaredValue: 300000, declaredDate: "2025-05-10", series: null }).status, "no-series");
  assert.equal(V.estimate({ declaredValue: 300000, declaredDate: "2025-05-10", series: series([]) }).status, "no-index-base", "serie vacía");
  assert.equal(V.estimate({ declaredValue: null, declaredDate: "2025-05-10", series: IPV() }).status, "no-value");
  assert.equal(V.estimate({ declaredValue: 0, declaredDate: "2025-05-10", series: IPV() }).status, "no-value", "cero no se revaloriza");
  assert.equal(V.estimate({ declaredValue: "", declaredDate: "2025-05-10", series: IPV() }).value, null, "un valor ausente sigue ausente (no es cero)");
  assert.equal(V.estimate({ declaredValue: 300000, declaredDate: "", series: IPV() }).status, "no-date");
});

test("WP-50 · la estimación envejece: se avisa si el último índice tecleado queda a más de dos trimestres", () => {
  const at = (todayQuarter) => V.estimate({ declaredValue: 300000, declaredDate: "2025-05-10", series: IPV(), todayQuarter });
  assert.deepEqual([at("2026-T2").stale, at("2026-T2").quartersBehind], [false, 0]);
  assert.deepEqual([at("2026-T4").stale, at("2026-T4").quartersBehind], [false, 2], "dos trimestres de retraso todavía es normal: el INE publica con retraso");
  assert.deepEqual([at("2027-T1").stale, at("2027-T1").quartersBehind], [true, 3]);
  assert.equal(at("").stale, false, "sin «hoy» no se juzga");
});

test("WP-50 · el almacén: descarta lo inválido sin romper, deja un punto por trimestre (gana el último), ordena, y limita a 6 series", () => {
  const store = V.normalizeStore({
    series: [
      { id: "a", label: "  IPV  ", points: [{ quarter: "2026-T2", value: 180 }, { quarter: "2025-T2", value: 165 }, { quarter: "2025-T2", value: 166 }, { quarter: "2026-T9", value: 5 }, { quarter: "2026-T1", value: 0 }, { quarter: "2026-T3", value: "x" }, { quarter: "2026-T4", value: -3 }] },
      { id: "a", label: "repetida", points: [] },
    ],
    links: { casa: { seriesId: "a", useEstimate: true }, local: { seriesId: "no-existe", useEstimate: true }, "": { seriesId: "a" } },
  });
  assert.deepEqual(store.series, [{ id: "a", label: "IPV", points: [{ quarter: "2025-T2", value: 166 }, { quarter: "2026-T2", value: 180 }] }]);
  assert.deepEqual(store.links, { casa: { seriesId: "a", useEstimate: true } });
  assert.deepEqual(V.normalizeStore(null), { series: [], links: {} });
  assert.deepEqual(V.normalizeStore("basura"), { series: [], links: {} });
  assert.equal(V.normalizeStore({ series: Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, label: `S${i}`, points: [] })) }).series.length, 6);
  assert.equal(V.normalizeStore({ links: { casa: { seriesId: "a", useEstimate: "sí" } }, series: [{ id: "a", label: "A" }] }).links.casa.useEstimate, false, "solo `true` activa");
});

test("WP-50 · alta, edición y baja de series y puntos; quitar una serie desvincula los inmuebles que la usaban", () => {
  let store = V.normalizeStore(null);
  assert.equal(V.addSeries(store, "  ").ok, false);
  const added = V.addSeries(store, "IPV vivienda · Cataluña");
  assert.equal(added.ok, true);
  store = added.store;
  assert.equal(V.addSeries(store, "ipv VIVIENDA · cataluña").ok, false, "mismo nombre aunque cambien mayúsculas");
  const id = added.id;
  assert.equal(V.setPoint(store, id, "2025-T2", 165).ok, true);
  assert.equal(V.setPoint(store, "nada", "2025-T2", 165).ok, false);
  assert.equal(V.setPoint(store, id, "2025-T7", 165).ok, false);
  assert.equal(V.setPoint(store, id, "2025-T2", 0).ok, false);
  assert.equal(V.setPoint(store, id, "2025-T2", "").ok, false, "vacío no es cero");
  store = V.setPoint(store, id, "2025-T2", 165).store;
  store = V.setPoint(store, id, "2026-T2", 180).store;
  store = V.setPoint(store, id, "2025-T2", 166).store;
  assert.deepEqual(store.series[0].points, [{ quarter: "2025-T2", value: 166 }, { quarter: "2026-T2", value: 180 }], "corregir sustituye");
  store = V.setLink(store, "casa", { seriesId: id, useEstimate: true });
  assert.deepEqual(store.links.casa, { seriesId: id, useEstimate: true });
  assert.deepEqual(V.setLink(store, "casa", { seriesId: "" }).links, {}, "desvincular");
  assert.deepEqual(V.setLink(store, "casa", { seriesId: "nada" }).links, {}, "una serie que no existe no vincula");
  assert.deepEqual(V.removePoint(store, id, "2025-T2").series[0].points, [{ quarter: "2026-T2", value: 180 }]);
  const gone = V.removeSeries(store, id);
  assert.deepEqual([gone.series, gone.links], [[], {}], "sin serie no hay vínculo");
  for (let i = 0; i < 5; i += 1) store = V.addSeries(store, `Otra ${i}`).store;
  assert.equal(V.addSeries(store, "Una más").ok, false, "máximo 6");
});

test("WP-50 · los activos para el patrimonio: solo el inmueble con la estimación activada y calculable lleva el valor estimado; lo demás, intacto y sin tocar la entrada", () => {
  const assets = deepFreeze([
    { id: "casa", type: "inmueble", label: "Vivienda", value: 300000, asOf: "2025-05-10", provenance: "declared" },
    { id: "local", type: "inmueble", label: "Local", value: 200000, asOf: "2024-02-01", provenance: "declared" },
    { id: "piso2", type: "inmueble", label: "Otro piso", value: 100000, asOf: "2025-11-20", provenance: "declared" },
    { id: "coche", type: "vehiculo", label: "Coche", value: 15000, asOf: "2025-05-10", provenance: "declared" },
  ]);
  const store = deepFreeze(V.normalizeStore({
    series: [{ id: "s1", label: "IPV", points: IPV().points }],
    links: { casa: { seriesId: "s1", useEstimate: true }, local: { seriesId: "s1", useEstimate: false }, piso2: { seriesId: "s1", useEstimate: true }, coche: { seriesId: "s1", useEstimate: true } },
  }));
  const result = V.effectiveAssets(assets, store, "2026-T3");
  const byId = Object.fromEntries(result.assets.map((asset) => [asset.id, asset]));
  assert.deepEqual([byId.casa.value, byId.casa.provenance], [327272.73, "estimated"]);
  assert.deepEqual([byId.local.value, byId.local.provenance], [200000, "declared"], "el interruptor está apagado");
  assert.equal(byId.piso2.value, 100000, "falta el índice de su trimestre: se queda el declarado");
  assert.equal(byId.coche.value, 15000, "solo los inmuebles");
  assert.deepEqual(result.applied.map((item) => [item.assetId, item.declared, item.estimated, item.delta]), [["casa", 300000, 327272.73, 27272.73]]);
  assert.equal(assets[0].value, 300000, "la entrada no se modifica");
  assert.equal(V.effectiveAssets(assets, { series: [], links: {} }).applied.length, 0);
  assert.deepEqual(V.effectiveAssets(null, store).assets, []);
});

test("WP-50 · LTV: deuda hipotecaria sobre el valor; sin deuda conocida o sin valor, no se calcula", () => {
  assert.equal(V.ltvPct(150000, 300000), 50);
  assert.equal(V.ltvPct(150000, 327272.73), 45.83, "con la estimación el LTV baja");
  assert.equal(V.ltvPct(0, 300000), 0, "una hipoteca pagada es un 0 % real");
  assert.equal(V.ltvPct(null, 300000), null, "deuda desconocida no es cero");
  assert.equal(V.ltvPct("", 300000), null);
  assert.equal(V.ltvPct(150000, 0), null);
  assert.equal(V.ltvPct(150000, null), null);
});

test("WP-50 · las frases dicen lo que se sabe y lo que no", () => {
  const opts = { euros: (v) => `${v} €`, labelOf: V.quarterLabel };
  const estimated = V.estimate({ declaredValue: 300000, declaredDate: "2025-05-10", series: IPV(), todayQuarter: "2027-T1" });
  const sentence = V.describe(estimated, opts);
  assert.match(sentence, /sube un 9,09 % desde T2 2025: de 300000 € a 327272.73 € \(T2 2026\)/);
  assert.match(sentence, /3 trimestres atrás: la estimación envejece/);
  assert.match(V.describe(V.estimate({ declaredValue: 100000, declaredDate: "2025-06-30", series: series([{ quarter: "2025-T2", value: 200 }, { quarter: "2026-T1", value: 190 }]) }), opts), /baja un 5 %/);
  assert.match(V.describe(V.estimate({ declaredValue: 300000, declaredDate: "2025-11-20", series: IPV() }), opts), /Falta el índice de T4 2025.*se queda el valor declarado/);
  assert.match(V.describe(V.estimate({ declaredValue: 300000, declaredDate: "2026-05-02", series: IPV() }), opts), /no es posterior/);
  assert.match(V.describe(V.estimate({ declaredValue: 300000, declaredDate: "", series: IPV() }), opts), /no tiene fecha/);
  assert.match(V.describe(V.estimate({ declaredValue: 300000, declaredDate: "2025-05-10", series: null }), opts), /Sin serie de índice elegida/);
  assert.equal(V.describe({}, opts), "");
});

test("WP-50 · propiedad (300 casos al azar): con el mismo índice no cambia nada, escala con el cociente y la estimación es monótona", () => {
  let seed = 50;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let run = 0; run < 300; run += 1) {
    const declared = Math.round((10000 + rand() * 900000) * 100) / 100;
    const base = Math.round((50 + rand() * 250) * 100) / 100;
    const k = 0.5 + rand() * 1.5;
    const later = Math.round(base * k * 100) / 100;
    const s = series([{ quarter: "2025-T1", value: base }, { quarter: "2026-T1", value: later }]);
    const input = deepFreeze({ declaredValue: declared, declaredDate: "2025-02-15", series: s, todayQuarter: "2026-T2" });
    const result = V.estimate(input);
    assert.equal(result.status, "estimated");
    assert.ok(Math.abs(result.value - declared * (later / base)) <= 0.01, "escala con el cociente de índices");
    assert.equal(result.delta, Math.round((result.value - declared) * 100) / 100);
    assert.equal(V.estimate(input).value, result.value, "determinista");
    const higher = V.estimate({ ...input, series: series([{ quarter: "2025-T1", value: base }, { quarter: "2026-T1", value: later + 10 }]) });
    assert.ok(higher.value >= result.value, "un índice mayor nunca da un valor menor");
    const flat = V.estimate({ ...input, series: series([{ quarter: "2025-T1", value: base }, { quarter: "2026-T1", value: base }]) });
    assert.equal(flat.value, declared, "mismo índice, mismo valor");
  }
});

test("WP-50 · el motor es puro (sin DOM, red, almacenamiento ni reloj)", () => {
  const source = read("canonical-index-valuation.js");
  ["document", "window", "fetch(", "localStorage", "sessionStorage", "XMLHttpRequest", "Date.now", "new Date", "Math.random"].forEach((banned) => {
    assert.equal(source.includes(banned), false, `el motor no debe usar ${banned}`);
  });
});

test("WP-50 · lo cableado: tarjeta en Inversión › Cartera, hojas y scripts en las listas, almacén en la copia y consumidores del valor efectivo", () => {
  const html = read("index.html");
  assert.match(html, /id="indiceViviendaCard"/);
  assert.match(html, /id="indiceViviendaCuerpo"/);
  assert.match(html, /canonical-index-valuation\.js\?v=/);
  assert.match(html, /indice-vivienda-ui\.js\?v=/);
  assert.match(html, /indice-vivienda\.css\?v=/);
  ["canonical-index-valuation.js", "indice-vivienda-ui.js", "indice-vivienda.css"].forEach((file) => {
    assert.match(read("service-worker.js"), new RegExp(`"\\./${file.replace(".", "\\.")}"`));
    assert.match(read("tools/build-public-site.mjs"), new RegExp(`"${file.replace(".", "\\.")}"`));
  });
  assert.match(codigoApp(), /"housing-index-data"/, "el almacén va en la copia de seguridad");
  assert.match(read("views/inversion.js"), /renderIndiceVivienda\?\.\(globalThis\.FinanceCanonicalIndexValuation\)/);
  const ui = read("indice-vivienda-ui.js");
  assert.match(ui, /FinanceCanonicalIndexValuation/);
  assert.match(ui, /function assetsEffectiveList/);
});
