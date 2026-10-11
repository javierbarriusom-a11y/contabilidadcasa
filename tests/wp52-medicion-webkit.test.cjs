// WP-52 (NTC-04) · medición de carga con WebKit (tools/measure-load-core.mjs + tools/measure-load.mjs). La parte pura se prueba aquí; el navegador, no: en este
// entorno solo hay Chromium, así que el camino de WebKit solo se ejercita de verdad en el CI (paso informativo de pages.yml).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const load = () => import("../tools/measure-load-core.mjs");
const row = (visita, hoy, extra = {}) => ({ visita, hoyConContenido: hoy, erroresPagina: 0, ...extra });

test("WP-52 · opciones: por defecto es la medición de siempre; el motor se elige por argumento o por entorno", async () => {
  const { parseOptions } = await load();
  assert.deepEqual(parseOptions([], {}), { engine: "chromium", budget: null, cpu: 4 });
  assert.deepEqual(parseOptions(["--budget=5000"], {}), { engine: "chromium", budget: 5000, cpu: 4 }, "la puerta del CI sigue igual");
  assert.equal(parseOptions(["--engine=webkit"], {}).engine, "webkit");
  assert.equal(parseOptions([], { MEASURE_ENGINE: "compare" }).engine, "compare");
  assert.equal(parseOptions(["--engine=chromium"], { MEASURE_ENGINE: "webkit" }).engine, "chromium", "el argumento gana al entorno");
  assert.equal(parseOptions([], { MEASURE_CPU: "6" }).cpu, 6);
  assert.equal(parseOptions(["--engine=compare"], {}).engine, "compare");
});

test("WP-52 · opciones: lo que no tiene sentido se rechaza con motivo", async () => {
  const { parseOptions } = await load();
  assert.throws(() => parseOptions(["--engine=firefox"], {}), /Motor desconocido «firefox»/);
  assert.throws(() => parseOptions(["--budget=abc"], {}), /no es un número de milisegundos/);
  assert.throws(() => parseOptions(["--budget=0"], {}), /mayor que cero/);
  assert.throws(() => parseOptions(["--engine=webkit", "--budget=5000"], {}), /WebKit y la comparación corren sin estrangular y no tienen presupuesto/);
  assert.throws(() => parseOptions(["--engine=compare", "--budget=5000"], {}), /no tienen presupuesto/);
  assert.throws(() => parseOptions([], { MEASURE_CPU: "0.5" }), /MEASURE_CPU/);
  assert.throws(() => parseOptions([], { MEASURE_CPU: "x" }), /MEASURE_CPU/);
});

test("WP-52 · WebKit no tiene CDP: no se puede frenar CPU ni red, y el plan lo dice en vez de fingirlo", async () => {
  const { throttlingPlan } = await load();
  const wk = throttlingPlan("webkit");
  assert.equal(wk.cdp, false);
  assert.equal(wk.network, false);
  assert.equal(wk.cpu, 1);
  assert.match(wk.label, /sin estrangular/);
  const slow = throttlingPlan("chromium", { cpu: 4 });
  assert.deepEqual([slow.cdp, slow.network, slow.cpu], [true, true, 4], "Chromium con presupuesto conserva el móvil lento emulado");
  const free = throttlingPlan("chromium", { unthrottled: true });
  assert.deepEqual([free.cdp, free.network, free.cpu], [false, false, 1]);
  assert.throws(() => throttlingPlan("firefox"), /Sin plan/);
});

test("WP-52 · la mediana y el resumen de visitas repetidas: una visita sin «Hoy» invalida la medida, no se promedia lo que falta", async () => {
  const { median, summarizeRepeats } = await load();
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 3, "en pares, el superior, como siempre en esta medición");
  assert.equal(median([]), null);
  assert.deepEqual(summarizeRepeats([row("r1", 900), row("r2", 1000), row("r3", 1100)]), { valid: true, median: 1000, values: [900, 1000, 1100] });
  const broken = summarizeRepeats([row("r1", 900), row("r2", null), row("r3", 1100)]);
  assert.equal(broken.valid, false);
  assert.equal(broken.median, null);
  assert.equal(summarizeRepeats([]).valid, false);
});

test("WP-52 · razón WebKit/Chromium: se calcula sobre medianas válidas de la misma máquina y se dice «no es un iPhone»; sin una de las dos, no se inventa", async () => {
  const { compareEngines } = await load();
  const chromium = [row("repetida 1", 1000), row("repetida 2", 1000), row("repetida 3", 1000)];
  const slower = compareEngines(chromium, [row("repetida 1", 1500), row("repetida 2", 1500), row("repetida 3", 1500)]);
  assert.equal(slower.ratio, 1.5);
  assert.match(slower.text, /Chromium 1000 ms, WebKit 1500 ms \(×1.5: más lenta en WebKit\)\. No es un iPhone\./);
  assert.match(compareEngines(chromium, [row("repetida 1", 700), row("repetida 2", 700), row("repetida 3", 700)]).text, /más rápida en WebKit/);
  assert.match(compareEngines(chromium, [row("repetida 1", 1020), row("repetida 2", 1020), row("repetida 3", 1020)]).text, /parecida en WebKit/);
  const missing = compareEngines(chromium, [row("repetida 1", null), row("repetida 2", 1500), row("repetida 3", 1500)]);
  assert.equal(missing.ratio, null);
  assert.match(missing.text, /Sin comparación: WebKit no llegó a pintar/);
  assert.equal(compareEngines([row("repetida 1", null)], [row("repetida 1", null)]).text.includes("Chromium y WebKit"), true);
  assert.match(compareEngines([row("repetida 1", 0), row("repetida 2", 0), row("repetida 3", 0)], chromium).text, /mediana de Chromium es 0/);
});

test("WP-52 · veredicto de Chromium con presupuesto: idéntico al de la puerta de antes (mensajes incluidos)", async () => {
  const { verdict } = await load();
  const ok = [row("visita repetida 1", 3800), row("visita repetida 2", 4000), row("visita repetida 3", 4100)];
  assert.equal(verdict("chromium", ok, { budget: 5000, cpu: 4 }), null);
  const over = [row("visita repetida 1", 5200), row("visita repetida 2", 5300), row("visita repetida 3", 5100)];
  assert.equal(verdict("chromium", over, { budget: 5000, cpu: 4 }), "Hoy tarda 5200 ms en tener contenido en visita repetida (CPU 4x), por encima del presupuesto de 5000 ms.");
  const invalid = [row("visita repetida 1", 3800), row("visita repetida 2", null), row("visita repetida 3", 4100)];
  assert.equal(verdict("chromium", invalid, { budget: 5000 }), "Hoy no llegó a pintar #homeKpis en alguna visita repetida: la medida no es válida.");
  assert.equal(verdict("chromium", over, { budget: null }), null, "sin presupuesto (modo informativo) no falla nunca");
});

test("WP-52 · veredicto de WebKit: falla por excepciones de página o por «Hoy» sin pintar, nunca por lentitud", async () => {
  const { verdict } = await load();
  const fine = [row("primera visita", 4000), row("visita repetida", 2500)];
  assert.equal(verdict("webkit", fine), null, "mucho tiempo no es un fallo: no hay presupuesto");
  const errors = [row("primera visita", 1000, { erroresPagina: 2 }), row("visita repetida", 900, { erroresPagina: 1 })];
  assert.match(verdict("webkit", errors), /WebKit: 3 error\(es\) de página sin capturar/);
  const blank = [row("primera visita", 1000), row("visita repetida", null)];
  assert.match(verdict("webkit", blank), /«Hoy» no llegó a pintar #homeKpis/);
});

test("WP-52 · cableado: la herramienta usa el núcleo, la puerta del CI no cambia, WebKit va en un paso informativo que no bloquea el despliegue", () => {
  const tool = read("tools/measure-load.mjs");
  assert.match(tool, /from "\.\/measure-load-core\.mjs"/);
  assert.match(tool, /import \{ chromium, webkit, devices \} from "@playwright\/test"/);
  assert.match(tool, /if \(plan\.cdp\)/, "el protocolo de Chromium solo se abre en Chromium");
  assert.match(tool, /npx playwright install --with-deps webkit/, "si WebKit falta, dice cómo instalarlo");
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["test:load-budget"], "node tools/measure-load.mjs --budget=5000", "la puerta no cambia");
  assert.equal(pkg.scripts["measure:load-webkit"], "node tools/measure-load.mjs --engine=compare");
  const workflow = read(".github/workflows/pages.yml");
  const at = workflow.indexOf("WebKit");
  assert.ok(at > workflow.indexOf("npm run test:load-budget"), "el paso de WebKit va después de la puerta de carga");
  assert.ok(at < workflow.indexOf("actions/configure-pages"), "y antes de preparar el despliegue");
  const step = workflow.slice(workflow.lastIndexOf("- name:", at), workflow.indexOf("- uses: actions/configure-pages"));
  assert.match(step, /continue-on-error: true/, "informativo: no puede bloquear la publicación");
  assert.match(step, /npx playwright install --with-deps webkit/);
  assert.match(step, /npm run measure:load-webkit/);
});

test("WP-52 · el núcleo es puro: sin navegador, red, ficheros, reloj ni azar", () => {
  const src = read("tools/measure-load-core.mjs");
  assert.doesNotMatch(src, /\b(import|require)\b[^\n]*(playwright|node:fs|node:http|node:path)/);
  assert.doesNotMatch(src, /Date\.now|new Date\(|Math\.random|process\./);
});
