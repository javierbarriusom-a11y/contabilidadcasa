// WP-52 (NTC-04): la parte pura de `tools/measure-load.mjs` —opciones, plan de estrangulamiento por motor, resumen de visitas y comparación Chromium/WebKit—
// separada del navegador para poder probarla sin uno (tests/wp52-medicion-webkit.test.cjs). Nada aquí abre un navegador, un servidor ni un fichero.
//
// Lo que cada motor puede hacer (y por eso lo que las cifras significan):
//   · chromium  Emulación de móvil lento por CDP: CPU 4× y 1,6 Mbps con 150 ms. Es la medida con presupuesto (5000 ms) y la que pasa por la puerta del CI.
//   · webkit    WebKit de Playwright NO tiene CDP: no se puede frenar la CPU ni la red. Sus cifras son SIN estrangular, en la máquina que mida, y no son las de un iPhone
//               (ni es el WebKit de iOS ni la CPU de un teléfono). Sirven para dos cosas: que la app arranca y pinta «Hoy» sin errores en un motor que no es Chromium, y,
//               comparadas con Chromium sin estrangular en la MISMA máquina, cuánto más lenta o rápida sale en WebKit.
//   · compare   Los dos, sin estrangular, uno tras otro; imprime la razón WebKit/Chromium. No tiene presupuesto.

export const ENGINES = Object.freeze(["chromium", "webkit", "compare"]);
export const DEFAULT_CPU = 4;

/**
 * @param {string[]} argv argumentos sin `node` ni el script (los de la línea de órdenes)
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ engine: string, budget: number | null, cpu: number }}
 */
export function parseOptions(argv, env = {}) {
  const arg = (name) => {
    const hit = argv.find((item) => item.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };
  const engine = arg("engine") ?? env.MEASURE_ENGINE ?? "chromium";
  if (!ENGINES.includes(engine)) throw new Error(`Motor desconocido «${engine}»: usa ${ENGINES.join(", ")}.`);
  const budgetText = arg("budget");
  let budget = null;
  if (budgetText !== null) {
    budget = Number(budgetText);
    if (!Number.isFinite(budget) || budget <= 0) throw new Error(`El presupuesto «${budgetText}» no es un número de milisegundos mayor que cero.`);
  }
  if (budget !== null && engine !== "chromium") {
    throw new Error("El presupuesto de carga es de Chromium con la CPU frenada (4×). WebKit y la comparación corren sin estrangular y no tienen presupuesto: harían falta cifras de varias semanas para fijar uno.");
  }
  const cpu = env.MEASURE_CPU === undefined || env.MEASURE_CPU === "" ? DEFAULT_CPU : Number(env.MEASURE_CPU);
  if (!Number.isFinite(cpu) || cpu < 1) throw new Error(`MEASURE_CPU «${env.MEASURE_CPU}» no es un factor de frenado válido (1 o más).`);
  return { engine, budget, cpu };
}

/**
 * Qué se le aplica a la página en cada motor. `cdp` = abrir una sesión del protocolo de Chromium (solo existe en Chromium).
 * @returns {{ cdp: boolean, cpu: number, network: boolean, label: string }}
 */
export function throttlingPlan(engine, { cpu = DEFAULT_CPU, unthrottled = false } = {}) {
  if (engine === "webkit") return { cdp: false, cpu: 1, network: false, label: "WebKit, sin estrangular (no admite frenar CPU ni red)" };
  if (engine !== "chromium") throw new Error(`Sin plan de estrangulamiento para «${engine}».`);
  if (unthrottled) return { cdp: false, cpu: 1, network: false, label: "Chromium, sin estrangular" };
  return { cdp: true, cpu, network: true, label: `Chromium, móvil emulado (CPU ${cpu}×, 1,6 Mbps, 150 ms)` };
}

/** Mediana de la lista (el elemento central de la ordenada; en pares, el superior, como siempre en esta medición). */
export function median(values) {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

/**
 * Mediana de «Hoy con contenido» de las visitas repetidas. Si alguna visita no llegó a pintar Hoy, la medida no es válida: no se promedia lo que falta.
 * @returns {{ valid: boolean, median: number | null, values: Array<number | null> }}
 */
export function summarizeRepeats(rows) {
  const values = rows.map((row) => (Number.isFinite(row.hoyConContenido) ? row.hoyConContenido : null));
  if (!values.length || values.some((value) => value === null)) return { valid: false, median: null, values };
  return { valid: true, median: median(values), values };
}

/**
 * Razón WebKit / Chromium sobre la misma máquina y sin estrangular. Sin una de las dos medidas válidas no hay razón (no se inventa).
 * @returns {{ ratio: number | null, chromiumMs: number | null, webkitMs: number | null, text: string }}
 */
export function compareEngines(chromiumRows, webkitRows) {
  const chromium = summarizeRepeats(chromiumRows);
  const webkit = summarizeRepeats(webkitRows);
  if (!chromium.valid || !webkit.valid) {
    const missing = [!chromium.valid ? "Chromium" : null, !webkit.valid ? "WebKit" : null].filter(Boolean).join(" y ");
    return { ratio: null, chromiumMs: chromium.median, webkitMs: webkit.median, text: `Sin comparación: ${missing} no llegó a pintar «Hoy» en alguna visita repetida.` };
  }
  if (!(chromium.median > 0)) return { ratio: null, chromiumMs: chromium.median, webkitMs: webkit.median, text: "Sin comparación: la mediana de Chromium es 0 ms." };
  const ratio = Math.round((webkit.median / chromium.median) * 100) / 100;
  const how = ratio > 1.05 ? "más lenta" : ratio < 0.95 ? "más rápida" : "parecida";
  return {
    ratio, chromiumMs: chromium.median, webkitMs: webkit.median,
    text: `«Hoy con contenido» en visita repetida, sin estrangular y en esta misma máquina: Chromium ${chromium.median} ms, WebKit ${webkit.median} ms (×${ratio}: ${how} en WebKit). No es un iPhone.`,
  };
}

/**
 * Lo que hace fallar una medición. Chromium con presupuesto: la mediana de las visitas repetidas por encima del presupuesto. WebKit: errores de página sin capturar
 * (la app tiene que arrancar sin excepciones) o «Hoy» sin pintar. Devuelve el mensaje, o null si todo va bien.
 * @param {string} engine
 * @param {Array<Record<string, any>>} rows visitas (cada una con `hoyConContenido` y `erroresPagina`)
 * @param {{ budget?: number | null, cpu?: number }} [options]
 */
export function verdict(engine, rows, { budget = null, cpu = DEFAULT_CPU } = {}) {
  const repeats = summarizeRepeats(rows.filter((row) => /repetida/.test(row.visita)));
  if (engine === "webkit") {
    const errors = rows.reduce((sum, row) => sum + (row.erroresPagina || 0), 0);
    if (errors > 0) return `WebKit: ${errors} error(es) de página sin capturar durante la carga (excepciones de JavaScript que Chromium no da).`;
    if (!repeats.valid) return "WebKit: «Hoy» no llegó a pintar #homeKpis en alguna visita repetida: la medida no es válida.";
    return null;
  }
  if (budget === null) return null;
  if (!repeats.valid) return "Hoy no llegó a pintar #homeKpis en alguna visita repetida: la medida no es válida.";
  if (repeats.median > budget) return `Hoy tarda ${repeats.median} ms en tener contenido en visita repetida (CPU ${cpu}x), por encima del presupuesto de ${budget} ms.`;
  return null;
}
