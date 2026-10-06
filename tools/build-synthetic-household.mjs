// WP-33 (NTC-02): generador de un hogar FICTICIO con la verdad conocida. El repositorio es público y los datos reales no pueden entrar en él;
// aun así hay cosas que solo se pueden comprobar con una verdad conocida: ¿la inferencia del día de cargo (WP-04 / WP-08) acierta el día
// cuando el cargo es regular y se abstiene cuando no lo es?, ¿una banda P10-P90 contiene la realidad el ~80 % de las veces? Con datos reales
// esa calibración tardaría dos años; con un hogar sintético se mide hoy.
//
// Determinista: la misma semilla produce siempre el mismo hogar (PRNG mulberry32, sin Math.random ni la hora). Nada se escribe en disco:
// se importa desde las pruebas (tests/wp33-hogar-sintetico.test.cjs) o se mira desde la línea de órdenes:
//   node tools/build-synthetic-household.mjs --seed 7 --months 18
//
// Lo que produce no es un dato del hogar ni se parece a uno: partidas de nombre genérico («Alquiler ficticio», «Partida errática 1»).

import { fileURLToPath } from "node:url";

// Cuánto vale ±1 día en cada tipo de partida: la verdad que la inferencia debe reconocer.
//   fijo       el mismo día todos los meses (alquiler, cuota de hipoteca)       → debe salir «fiable» con ese día
//   casi-fijo  el día cae a ±1 del día base (festivos y fines de semana)        → debe salir «fiable» con ese día ±1
//   erratico   el día cambia cada mes, repartido por todo el mes                → NUNCA «fiable» (debe quedar «variable»)
//   a-medias   el cargo solo se encuentra en parte de los meses                 → NUNCA «fiable» (un mes sin cargo casado cuenta como fallo)
//   regla      la fija una regla del extracto, no el histórico                  → debe salir «regla»
export const KINDS = Object.freeze(["fijo", "casi-fijo", "erratico", "a-medias", "regla"]);

// La cartera de partidas por defecto: pesos y formas parecidos a los de un hogar, con nombres genéricos.
const DEFAULT_PARTIDAS = Object.freeze([
  { key: "sint-alquiler", label: "Alquiler ficticio", kind: "fijo", day: 1, mean: 900, sd: 0 },
  { key: "sint-hipoteca", label: "Cuota ficticia", kind: "fijo", day: 5, mean: 750, sd: 0 },
  { key: "sint-luz", label: "Suministro ficticio A", kind: "casi-fijo", day: 12, mean: 80, sd: 22 },
  { key: "sint-seguro", label: "Seguro ficticio", kind: "casi-fijo", day: 20, mean: 45, sd: 0 },
  { key: "sint-internet", label: "Suscripción ficticia", kind: "casi-fijo", day: 25, mean: 35, sd: 0 },
  { key: "sint-colegio", label: "Cuota ficticia B", kind: "fijo", day: 3, mean: 220, sd: 0 },
  { key: "sint-errat-1", label: "Partida errática 1", kind: "erratico", day: null, mean: 150, sd: 40 },
  { key: "sint-errat-2", label: "Partida errática 2", kind: "erratico", day: null, mean: 60, sd: 18 },
  { key: "sint-medias-1", label: "Partida a medias 1", kind: "a-medias", day: 15, mean: 90, sd: 15 },
  { key: "sint-regla-1", label: "Partida con regla 1", kind: "regla", day: null, mean: 120, sd: 10 },
]);

// PRNG pequeño y de calidad suficiente para pruebas (mulberry32).
export function createRandom(seed) {
  let state = (Number(seed) >>> 0) || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    // Box-Muller; 1 - u evita log(0).
    const u = 1 - next();
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return { next, normal, int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
}

export function monthKeys(start, count) {
  const [year, month] = String(start).split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const MAX_DAY = 28; // un día que existe en todos los meses

/**
 * @param {{ seed?: number, months?: number, start?: string, partidas?: Array<{key: string, label: string, kind: string, day: number|null, mean: number, sd: number}>, shockMonths?: number[] }} [options]
 *   `shockMonths`: índices de mes (0-based) en los que cada importe se multiplica por 3 (un sobresalto conocido).
 */
export function generateHousehold({ seed = 1, months = 12, start = "2025-10", partidas = DEFAULT_PARTIDAS, shockMonths = [] } = {}) {
  if (!Number.isInteger(months) || months < 1 || months > 120) throw new Error("months debe ser un entero entre 1 y 120");
  const random = createRandom(seed);
  const keys = monthKeys(start, months);
  const truth = {};
  const observations = [];
  for (const partida of partidas) {
    if (!KINDS.includes(partida.kind)) throw new Error(`tipo de partida desconocido: ${partida.kind}`);
    truth[partida.key] = { key: partida.key, label: partida.label, kind: partida.kind, day: partida.day, mean: partida.mean, sd: partida.sd, reliable: partida.kind === "fijo" || partida.kind === "casi-fijo", rule: partida.kind === "regla" };
    keys.forEach((month, monthIndex) => {
      let day;
      if (partida.kind === "fijo") day = partida.day;
      else if (partida.kind === "casi-fijo") day = Math.min(MAX_DAY, Math.max(1, partida.day + random.int(-1, 1)));
      else if (partida.kind === "erratico") day = random.int(1, MAX_DAY);
      else if (partida.kind === "a-medias") day = random.next() < 0.5 ? partida.day : null;
      else day = null;
      const shock = shockMonths.includes(monthIndex) ? 3 : 1;
      const amount = round2(Math.max(1, (partida.mean + partida.sd * random.normal()) * shock));
      observations.push({ key: partida.key, label: partida.label, month, amount, day, ...(partida.kind === "regla" ? { rule: true } : {}) });
    });
  }
  return { seed, start, months: keys, partidas: partidas.map((partida) => ({ ...partida })), truth, observations, shockMonths: [...shockMonths] };
}

// ---- Calibración de bandas ----
// Una banda P10-P90 bien calibrada contiene la realidad ~80 % de las veces. `coverage` mide la proporción real; la usan las pruebas de
// este generador y las de la banda de caja de WP-16.

/** @param {Array<{low: number, high: number}>} bands @param {number[]} realities */
export function coverage(bands, realities) {
  if (!Array.isArray(bands) || bands.length !== realities.length || !bands.length) throw new Error("bands y realities deben tener la misma longitud (> 0)");
  const inside = bands.filter((band, index) => realities[index] >= band.low && realities[index] <= band.high).length;
  return inside / bands.length;
}

// Z de la normal para los percentiles 10 y 90.
export const Z_P90 = 1.2815515655446004;

/** La banda P10-P90 analítica de una partida (normal), la que una previsión perfecta conocería. */
export function trueBand(partida) {
  return { low: partida.mean - Z_P90 * partida.sd, high: partida.mean + Z_P90 * partida.sd };
}

/** Realidades de un mes de una partida, muestreadas con la misma semilla/forma que el generador (para medir cobertura). */
export function sampleAmounts({ seed = 1, mean, sd, count }) {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => mean + sd * random.normal());
}

export { DEFAULT_PARTIDAS };

// ---- Línea de órdenes ----
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] !== undefined ? Number(process.argv[at + 1]) : fallback;
  };
  const household = generateHousehold({ seed: arg("seed", 1), months: arg("months", 12) });
  console.log(JSON.stringify({ seed: household.seed, months: household.months.length, partidas: household.partidas.length, observations: household.observations.length, truth: household.truth }, null, 2));
}
