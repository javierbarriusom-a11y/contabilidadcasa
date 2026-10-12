(function attachCanonicalForecastLayers(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecastLayers = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalForecastLayersFactory() {
  "use strict";

  // WP-35 (PRV-02 + PRV-04, docs/WP35_DISENO.md): la previsión de un mes leída en capas, y los ingresos con su certeza. Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj. NO cambia ninguna cifra
  // de la previsión: solo lee las partidas de un mes (previsto, lo que cuenta, si es real) y las reparte.
  //   · SALIDAS en tres capas: comprometidas (cuotas, recibos, lo fijo), probables (variables recurrentes, con su banda medida) y discrecionales (lo que el hogar declara decidible);
  //   · INGRESOS con certeza: confirmado (como hasta ahora), probable o incierto (con la probabilidad que DECLARA el hogar). Se leen tres márgenes: con lo confirmado, con lo esperado y si llegara todo.
  //
  // Reglas de honestidad:
  //   · la capa de cada partida es una SUGERENCIA por el bloque en que está (fijos y financiaciones: comprometidas; variables y lo demás: probables) hasta que el hogar la declara; se cuenta cuántas son sugeridas;
  //   · la banda de lo probable sale de lo que de verdad se desvió en los meses cerrados, con ≥ 3 meses; sin ellos NO hay banda y se dice (no se inventa una incertidumbre ni una certeza);
  //   · la probabilidad de un ingreso la teclea el hogar; el motor no la estima. Sin declarar, un ingreso es «confirmado» (lo de siempre): activar esto no cambia nada hasta que se declara;
  //   · nada de esto alimenta Hoy ni la previsión de caja (WP-35 PR-2, tras la lectura de H-02).

  const SCHEMA_ID = "finance-forecast-layers/v1";
  const LAYERS = Object.freeze([
    { id: "comprometida", label: "Comprometido", hint: "cuotas, recibos y lo fijo: no tiene incertidumbre" },
    { id: "probable", label: "Probable", hint: "variables recurrentes: se sabe más o menos cuánto" },
    { id: "discrecional", label: "Discrecional", hint: "lo que decidís vosotros" },
  ]);
  const LEVELS = Object.freeze([
    { id: "confirmado", label: "Confirmado", defaultProbability: 100 },
    { id: "probable", label: "Probable", defaultProbability: 80 },
    { id: "incierto", label: "Incierto", defaultProbability: 50 },
  ]);
  const MIN_BAND_MONTHS = 3;
  const MAX_ENTRIES = 300;

  const text = (value) => String(value ?? "").trim();
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const num = (value, fallback = 0) => (known(value) ? Number(value) : fallback);
  const round2 = (value) => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const isMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(text(value));
  const isLayer = (value) => LAYERS.some((layer) => layer.id === value);
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const monthName = (monthKey) => (isMonth(monthKey) ? MONTHS[Number(monthKey.slice(5, 7)) - 1] : "el mes");

  function normalizedText(value) {
    return text(value).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /** Euros enteros a la española («1.250 €», espacio duro), siempre en positivo. */
  function euros(value) {
    return `${String(Math.round(Math.abs(num(value)))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;
  }

  /** La capa que se SUGIERE por el bloque de la partida. Lo que no se reconoce cae en «probable» (ni lo da por seguro ni por decidible). */
  function defaultLayer(section) {
    const name = normalizedText(section);
    if (name.includes("fij") || name.includes("financi") || name.includes("deuda")) return "comprometida";
    return "probable";
  }

  // ---- Lo que declara el hogar ----

  /** @param {any} raw */
  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const layers = {};
    const incomes = {};
    Object.entries(source.layers && typeof source.layers === "object" ? source.layers : {}).filter(([key, layer]) => text(key) && isLayer(layer)).slice(0, MAX_ENTRIES).forEach(([key, layer]) => { layers[key] = layer; });
    Object.entries(source.incomes && typeof source.incomes === "object" ? source.incomes : {}).filter(([key, entry]) => text(key) && entry && ["probable", "incierto"].includes(entry.level)).slice(0, MAX_ENTRIES).forEach(([key, entry]) => {
      const fallback = LEVELS.find((level) => level.id === entry.level).defaultProbability;
      incomes[key] = { level: entry.level, probability: known(entry.probability) ? Math.min(99, Math.max(1, Math.round(Number(entry.probability)))) : fallback };
    });
    return { schemaId: SCHEMA_ID, layers, incomes };
  }

  /** Declara la capa de una partida; «auto» (o una capa inválida) quita la declaración y vuelve a la sugerida. */
  function setLayer(store, key, layer) {
    const current = normalizeStore(store);
    if (!text(key)) return current;
    const { [key]: _removed, ...rest } = current.layers;
    return normalizeStore({ ...current, layers: isLayer(layer) ? { ...rest, [key]: layer } : rest });
  }

  /** Declara la certeza de un ingreso. «confirmado» (o nivel inválido) quita la declaración: es lo de siempre. */
  function setIncome(store, key, level, probability) {
    const current = normalizeStore(store);
    if (!text(key)) return current;
    const { [key]: _removed, ...rest } = current.incomes;
    return normalizeStore({ ...current, incomes: ["probable", "incierto"].includes(level) ? { ...rest, [key]: { level, probability } } : rest });
  }

  function certaintyOf(store, key) {
    const entry = normalizeStore(store).incomes[key];
    return entry ? { level: entry.level, probability: entry.probability, declared: true } : { level: "confirmado", probability: 100, declared: false };
  }

  /** «Confirmado», «Probable 80 %», «Incierto 50 %». */
  function chipText(certainty) {
    const level = LEVELS.find((item) => item.id === certainty.level) || LEVELS[0];
    return certainty.level === "confirmado" ? level.label : `${level.label} ${certainty.probability} %`;
  }

  // ---- La banda de lo probable ----

  /**
   * La banda sale de lo que de verdad pasó: la desviación (real − previsto) del total de las partidas probables en cada mes cerrado. Con ≥ 3 meses, ± la desviación absoluta media.
   * @param {number[]} gaps
   */
  function probableBand(gaps) {
    const values = (Array.isArray(gaps) ? gaps : []).filter(known).map(Number);
    if (values.length < MIN_BAND_MONTHS) return { calculable: false, months: values.length, need: MIN_BAND_MONTHS };
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const mad = values.reduce((sum, value) => sum + Math.abs(value - mean), 0) / values.length;
    return { calculable: true, months: values.length, spread: round2(mad), bias: round2(mean) };
  }

  // ---- La lectura de un mes ----

  /**
   * @param {{monthKey?: string, partidas?: Array<{key: string, kind: "income"|"expense", label?: string, section?: string, used: number, settled?: boolean}>, store?: any, gaps?: number[]}} input
   */
  function buildReading({ monthKey = "", partidas = [], store = null, gaps = [] } = {}) {
    if (!isMonth(monthKey)) return { calculable: false, reason: "Falta el mes." };
    const declared = normalizeStore(store);
    const list = (Array.isArray(partidas) ? partidas : []).filter((item) => item && text(item.key) && (item.kind === "income" || item.kind === "expense") && known(item.used) && Math.abs(Number(item.used)) >= 0.005);
    if (!list.length) return { calculable: false, reason: "El mes no tiene partidas con importe: no hay nada que repartir." };

    const layers = Object.fromEntries(LAYERS.map((layer) => [layer.id, { id: layer.id, label: layer.label, hint: layer.hint, amount: 0, items: [] }]));
    let suggested = 0;
    list.filter((item) => item.kind === "expense").forEach((item) => {
      const own = declared.layers[item.key];
      const id = own || defaultLayer(item.section);
      if (!own) suggested += 1;
      layers[id].amount = round2(layers[id].amount + Number(item.used));
      layers[id].items.push({ key: item.key, label: text(item.label) || "Sin nombre", section: text(item.section), amount: round2(item.used), declared: Boolean(own) });
    });
    Object.values(layers).forEach((layer) => layer.items.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || a.label.localeCompare(b.label, "es") || a.key.localeCompare(b.key)));
    const outflows = round2(Object.values(layers).reduce((sum, layer) => sum + layer.amount, 0));

    const incomeItems = list.filter((item) => item.kind === "income").map((item) => {
      const certainty = certaintyOf(declared, item.key);
      const amount = round2(item.used);
      return { key: item.key, label: text(item.label) || "Sin nombre", amount, level: certainty.level, probability: certainty.probability, declared: certainty.declared, expected: round2((amount * certainty.probability) / 100) };
    }).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || a.label.localeCompare(b.label, "es") || a.key.localeCompare(b.key));
    const sum = (items, field) => round2(items.reduce((total, item) => total + item[field], 0));
    const confirmed = sum(incomeItems.filter((item) => item.level === "confirmado"), "amount");
    const all = sum(incomeItems, "amount");
    const expected = sum(incomeItems, "expected");
    const band = layers.probable.items.length ? probableBand(gaps) : { calculable: false, months: 0, need: MIN_BAND_MONTHS };

    return {
      calculable: true, monthKey, layers: LAYERS.map((layer) => layers[layer.id]), outflows, suggested, count: list.length, withReal: list.filter((item) => item.settled).length, expenseCount: list.filter((item) => item.kind === "expense").length, band,
      incomes: { items: incomeItems, confirmed, expected, all, uncertain: round2(all - confirmed), hasUncertain: incomeItems.some((item) => item.level !== "confirmado") },
      margin: { confirmed: round2(confirmed - outflows), expected: round2(expected - outflows), all: round2(all - outflows) },
    };
  }

  function marginPhrase(value) {
    return Math.round(Math.abs(value)) === 0 ? "queda justo a cero" : value > 0 ? `queda un margen de ${euros(value)}` : `faltan ${euros(value)}`;
  }

  /** Lo que se lee de un vistazo, en frases. */
  function sentences(reading) {
    if (!reading || !reading.calculable) return [];
    const [committed, probable, discretionary] = reading.layers;
    const band = reading.band.calculable ? ` (± ${euros(reading.band.spread)} según los meses cerrados)` : "";
    const out = [`En ${monthName(reading.monthKey)}: comprometido ${euros(committed.amount)}; probable ${euros(probable.amount)}${band}; discrecional ${euros(discretionary.amount)}.`];
    out.push(`Con los ingresos confirmados (${euros(reading.incomes.confirmed)}) ${marginPhrase(reading.margin.confirmed)}.`);
    if (reading.incomes.hasUncertain) out.push(`Hay ${euros(reading.incomes.uncertain)} de ingresos que no son seguros: contando su probabilidad ${marginPhrase(reading.margin.expected)}, y si llegara todo, ${marginPhrase(reading.margin.all)}.`);
    return out;
  }

  return { SCHEMA_ID, LAYERS, LEVELS, MIN_BAND_MONTHS, MAX_ENTRIES, euros, monthName, defaultLayer, normalizeStore, setLayer, setIncome, certaintyOf, chipText, probableBand, buildReading, sentences };
});
