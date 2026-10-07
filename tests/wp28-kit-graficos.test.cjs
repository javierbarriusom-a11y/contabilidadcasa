const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// WP-28 (NPV-07, docs/WP28_DISENO.md): kit de gráficos táctil y accesible. La mitad pura (frase automática, geometría, tabla, figura) se
// prueba sin DOM; la de eventos, con un documento falso que registra los manejadores y un deslizador falso con atributos.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const kit = require("../chart-kit.js");
const eur = (n) => `${Math.round(n)} €`;
const pts = (...values) => values.map((value, index) => ({ label: `m${index + 1}`, value }));

// ---- trendSentence ----
test("trendSentence · sube o baja, de dónde a dónde", () => {
  assert.equal(kit.trendSentence({ subject: "La caja", points: pts(100, 150, 400), format: eur }), "La caja sube de 100 € en m1 a 400 € en m3.");
  assert.equal(kit.trendSentence({ subject: "La caja", points: pts(400, 300, 100), format: eur }), "La caja baja de 400 € en m1 a 100 € en m3.");
});

test("trendSentence · dice el mínimo y el máximo solo cuando no son los extremos", () => {
  const text = kit.trendSentence({ subject: "La caja", points: pts(500, 100, 300, 450), format: eur });
  assert.match(text, /Mínimo: 100 € en m2\./);
  assert.doesNotMatch(text, /Máximo/); // el máximo es el primer punto: ya está dicho
  const both = kit.trendSentence({ subject: "S", points: pts(300, 100, 900, 400), format: eur });
  assert.match(both, /Mínimo: 100 € en m2\./);
  assert.match(both, /Máximo: 900 € en m3\./);
});

test("trendSentence · serie plana, y serie que acaba donde empezó (sin inventar tendencia)", () => {
  assert.equal(kit.trendSentence({ subject: "La caja", points: pts(200, 200, 200), format: eur }), "La caja se mantiene en 200 € de m1 a m3.");
  const loop = kit.trendSentence({ subject: "La caja", points: pts(200, 500, 210), format: eur });
  assert.match(loop, /acaba donde empezó: 200 € en m1 y 210 € en m3/);
  assert.match(loop, /Máximo: 500 € en m2/);
});

test("trendSentence · sin datos y con un solo punto, lo dice (nada de inventar una tendencia)", () => {
  assert.equal(kit.trendSentence({ subject: "La caja", points: [], format: eur }), "La caja: sin datos.");
  assert.equal(kit.trendSentence({ subject: "La caja", points: [{ label: "m1", value: NaN }], format: eur }), "La caja: sin datos.");
  assert.equal(kit.trendSentence({ subject: "La caja", points: pts(120), format: eur }), "La caja: 120 € en m1.");
});

test("trendSentence · umbral: dice cuándo lo cruza o que no lo cruza", () => {
  const down = kit.trendSentence({ subject: "La caja", points: pts(900, 400, -50, 200), format: eur, threshold: { value: 0, label: "cero" } });
  assert.match(down, /Pasa por debajo de cero \(0 €\) en m3\./);
  const safe = kit.trendSentence({ subject: "La caja", points: pts(900, 700, 800), format: eur, threshold: { value: 500, label: "el suelo" } });
  assert.match(safe, /No baja de el suelo \(500 €\) en todo el periodo\./);
  // Justo en el umbral no es «por debajo».
  assert.match(kit.trendSentence({ subject: "S", points: pts(10, 0, 10), format: eur, threshold: { value: 0, label: "cero" } }), /No baja de/);
});

// ---- nearestIndex / stepIndex ----
test("nearestIndex · el punto más cercano a la posición del dedo, con límites", () => {
  const xs = [0, 25, 50, 75, 100];
  assert.equal(nearest(xs, 0), 0);
  assert.equal(nearest(xs, 0.3), 1);
  assert.equal(nearest(xs, 0.62), 2);
  assert.equal(nearest(xs, 0.7), 3);
  assert.equal(nearest(xs, 1), 4);
  assert.equal(nearest(xs, -3), 0); // fuera por la izquierda
  assert.equal(nearest(xs, 7), 4); // fuera por la derecha
  assert.equal(nearest([], 0.5), 0);
  assert.equal(nearest([50], 0.9), 0); // un solo punto
});
function nearest(xs, fraction) { return kit.nearestIndex(xs, fraction); }

test("stepIndex · flechas, inicio, fin y saltos; nunca sale del rango; otras teclas no se tocan", () => {
  assert.equal(kit.stepIndex("ArrowRight", 3, 12), 4);
  assert.equal(kit.stepIndex("ArrowLeft", 3, 12), 2);
  assert.equal(kit.stepIndex("ArrowRight", 11, 12), 11);
  assert.equal(kit.stepIndex("ArrowLeft", 0, 12), 0);
  assert.equal(kit.stepIndex("Home", 7, 12), 0);
  assert.equal(kit.stepIndex("End", 7, 12), 11);
  assert.equal(kit.stepIndex("PageDown", 0, 12), 3); // un cuarto de 12
  assert.equal(kit.stepIndex("PageUp", 1, 12), 0);
  assert.equal(kit.stepIndex("Tab", 3, 12), null);
  assert.equal(kit.stepIndex("a", 3, 12), null);
  assert.equal(kit.stepIndex("ArrowRight", 0, 0), null); // sin puntos
});

// ---- bandPlotHtml ----
test("bandPlotHtml · polígono continuo, línea central y posiciones; un punto va al centro", () => {
  const plot = kit.bandPlotHtml({ points: [{ low: 90, center: 100, high: 110 }, { low: 80, center: 100, high: 120 }], ariaLabel: "Cono de prueba" });
  assert.match(plot.svg, /role="img" aria-label="Cono de prueba"/);
  assert.match(plot.svg, /<polygon class="ck-banda" points="[^"]+">/);
  assert.match(plot.svg, /<polyline class="ck-centro"[^>]*vector-effect="non-scaling-stroke">/);
  assert.deepEqual(plot.xs, [0, 100]);
  assert.deepEqual(kit.bandPlotHtml({ points: [{ low: 1, center: 2, high: 3 }], ariaLabel: "x" }).xs, [50]);
});

test("bandPlotHtml · las clases se pueden sustituir (así el cono conserva su aspecto) y el texto se escapa", () => {
  const plot = kit.bandPlotHtml({ points: [{ low: 1, center: 2, high: 3 }], ariaLabel: 'a "b" <c>', classes: { svg: "mi-svg", area: "mi-area", center: "mi-centro" } });
  assert.match(plot.svg, /class="mi-svg"/);
  assert.match(plot.svg, /class="mi-area"/);
  assert.match(plot.svg, /class="mi-centro"/);
  assert.match(plot.svg, /aria-label="a &quot;b&quot; &lt;c&gt;"/);
});

test("bandPlotHtml · el umbral (el suelo) entra en la escala y se dibuja como línea discontinua", () => {
  const withIt = kit.bandPlotHtml({ points: [{ low: 900, center: 1000, high: 1100 }, { low: 900, center: 1000, high: 1100 }], ariaLabel: "x", threshold: { value: 100 } });
  assert.match(withIt.svg, /<line class="ck-umbral" x1="0" x2="100" y1="[\d.]+" y2="[\d.]+" vector-effect="non-scaling-stroke">/);
  const y = Number(/class="ck-umbral" x1="0" x2="100" y1="([\d.]+)"/.exec(withIt.svg)[1]);
  assert.ok(y > 0 && y <= 100, `el umbral por debajo de la banda tiene que quedar dentro del dibujo (y = ${y})`);
  assert.doesNotMatch(kit.bandPlotHtml({ points: [{ low: 1, center: 2, high: 3 }], ariaLabel: "x" }).svg, /ck-umbral/);
  assert.doesNotMatch(kit.bandPlotHtml({ points: [{ low: 1, center: 2, high: 3 }], ariaLabel: "x", threshold: { value: "no" } }).svg, /ck-umbral/);
});

// ---- tableHtml ----
test("tableHtml · tabla de verdad plegada: leyenda, cabeceras de columna y de fila, y todo escapado", () => {
  const html = kit.tableHtml({ caption: "Tabla <x>", columns: ["Mes", "Valor"], rows: [["ene", "10 €"], ["feb <b>", "20 €"]] });
  assert.match(html, /^<details class="ck-tabla"><summary>Ver como tabla<\/summary>/);
  assert.match(html, /<caption class="sr-only">Tabla &lt;x&gt;<\/caption>/);
  assert.match(html, /<th scope="col">Mes<\/th><th scope="col">Valor<\/th>/);
  assert.match(html, /<th scope="row">ene<\/th><td>10 €<\/td>/);
  assert.match(html, /<th scope="row">feb &lt;b&gt;<\/th>/);
  assert.doesNotMatch(html, /<b>/);
});

// ---- figureHtml ----
const figure = (over = {}) => kit.figureHtml({ id: "t", plotHtml: "<svg></svg>", readings: ["uno", 'dos "2"'], xs: [0, 100], sliderLabel: "Recorrer", ...over });

test("figureHtml · deslizador con rol, rango, valor legible y lecturas; lectura fija con la pista", () => {
  const html = figure();
  assert.match(html, /role="slider" tabindex="0" aria-orientation="horizontal" aria-label="Recorrer" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0" aria-valuetext="uno"/);
  assert.match(html, /<p class="ck-lectura" data-ck-readout>Toca o desliza por el gráfico/);
  assert.match(html, /<span class="ck-cursor" hidden><\/span>/);
  const readings = JSON.parse(/data-ck-readings="([^"]*)"/.exec(html)[1].replace(/&quot;/g, '"'));
  assert.deepEqual(readings, ["uno", 'dos "2"']);
});

test("figureHtml · sin puntos no hay deslizador ni lectura (nada que recorrer), pero la nota y el dibujo siguen", () => {
  const html = figure({ readings: [], xs: [], noteHtml: "<p>nota</p>" });
  assert.doesNotMatch(html, /ck-scrub|ck-lectura/);
  assert.match(html, /<p>nota<\/p>/);
});

test("figureHtml · la tabla solo aparece si se da", () => {
  assert.doesNotMatch(figure(), /ck-tabla/);
  assert.match(figure({ table: { caption: "c", columns: ["a", "b"], rows: [["x", "y"]] } }), /Ver como tabla/);
});

// ---- attach y recorrido (documento falso) ----
function fakeSlider(readings, xs) {
  const attrs = { "aria-valuenow": "0" };
  const cursor = { hidden: true, style: {} };
  const readout = { textContent: "" };
  const slider = {
    dataset: { ckReadings: JSON.stringify(readings), ckX: JSON.stringify(xs) },
    getAttribute: (name) => attrs[name],
    setAttribute: (name, value) => { attrs[name] = value; },
    querySelector: (selector) => (selector === ".ck-cursor" ? cursor : null),
    closest: (selector) => (selector === ".ck-figure" ? { querySelector: (inner) => (inner === "[data-ck-readout]" ? readout : null) } : selector === ".ck-scrub" ? slider : null),
    getBoundingClientRect: () => ({ left: 100, width: 200 }),
    setPointerCapture: () => {},
  };
  return { slider, attrs, cursor, readout };
}

function fakeDocument() {
  const handlers = {};
  return { handlers, addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); }, fire: (type, event) => (handlers[type] || []).forEach((fn) => fn(event)) };
}

test("attach · es idempotente: la segunda vez no engancha nada más", () => {
  const doc = fakeDocument();
  assert.equal(kit.attach(doc), true);
  const count = Object.values(doc.handlers).flat().length;
  assert.equal(kit.attach(doc), false);
  assert.equal(Object.values(doc.handlers).flat().length, count);
  assert.equal(kit.attach(null), false);
});

test("recorrido con el dedo: lee mientras está apoyado, no al pasar; el ratón lee con solo pasar", () => {
  const doc = fakeDocument();
  kit.attach(doc);
  const { slider, attrs, cursor, readout } = fakeSlider(["a", "b", "c"], [0, 50, 100]);
  const at = (clientX, extra = {}) => ({ target: slider, clientX, pointerId: 1, pointerType: "touch", ...extra });
  doc.fire("pointermove", at(300)); // dedo sin apoyar: es desplazar la página
  assert.equal(attrs["aria-valuenow"], "0");
  doc.fire("pointerdown", at(200)); // mitad del gráfico
  assert.equal(attrs["aria-valuenow"], "1");
  assert.equal(attrs["aria-valuetext"], "b");
  assert.equal(readout.textContent, "b");
  assert.equal(cursor.style.left, "50%");
  assert.equal(cursor.hidden, false);
  doc.fire("pointermove", at(300)); // arrastra al final
  assert.equal(attrs["aria-valuenow"], "2");
  doc.fire("pointerup", at(300));
  doc.fire("pointermove", at(100)); // soltó: ya no lee
  assert.equal(attrs["aria-valuenow"], "2");
  doc.fire("pointermove", at(100, { pointerType: "mouse" })); // el ratón sí
  assert.equal(attrs["aria-valuenow"], "0");
});

test("recorrido con teclado: flechas, inicio y fin mueven; preventDefault solo en teclas del gráfico", () => {
  const doc = fakeDocument();
  kit.attach(doc);
  const { slider, attrs, readout } = fakeSlider(["a", "b", "c"], [0, 50, 100]);
  const press = (key) => { const event = { target: slider, key, prevented: false, preventDefault() { this.prevented = true; } }; doc.fire("keydown", event); return event; };
  assert.equal(press("ArrowRight").prevented, true);
  assert.equal(attrs["aria-valuenow"], "1");
  press("End");
  assert.equal(attrs["aria-valuenow"], "2");
  assert.equal(readout.textContent, "c");
  press("ArrowRight"); // en el tope no pasa nada
  assert.equal(attrs["aria-valuenow"], "2");
  press("Home");
  assert.equal(attrs["aria-valuenow"], "0");
  assert.equal(press("Tab").prevented, false); // el tabulador sigue saliendo del gráfico
});

test("al enfocar con teclado se enseña el cursor donde el lector de pantalla dice que está", () => {
  const doc = fakeDocument();
  kit.attach(doc);
  const { slider, cursor } = fakeSlider(["a", "b"], [0, 100]);
  doc.fire("focusin", { target: slider });
  assert.equal(cursor.hidden, false);
  assert.equal(cursor.style.left, "0%");
});

test("eventos de fuera de un gráfico se ignoran sin error", () => {
  const doc = fakeDocument();
  kit.attach(doc);
  const outside = { target: { closest: () => null } };
  ["pointerdown", "pointermove", "pointerup", "keydown", "focusin"].forEach((type) => assert.doesNotThrow(() => doc.fire(type, { ...outside, key: "ArrowRight" })));
});

// ---- el cono migrado y el cableado ----
test("cableado: index.html, service worker y build público llevan el kit; app.js lo engancha una vez en init", () => {
  const html = read("index.html");
  assert.match(html, /<link rel="stylesheet" href="chart-kit\.css\?v=[^"]+"/);
  assert.match(html, /<script defer src="chart-kit\.js\?v=[^"]+"><\/script>/);
  // El kit se carga ANTES que app.js (los scripts defer se ejecutan en orden): app.js lo usa desde el primer pintado.
  assert.ok(html.indexOf("chart-kit.js") < html.indexOf('src="app.js'), "chart-kit.js debe ir antes que app.js");
  assert.match(read("service-worker.js"), /"\.\/chart-kit\.css"[\s\S]*"\.\/chart-kit\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"chart-kit\.css"[\s\S]*"chart-kit\.js"/);
  const app = read("app.js");
  assert.equal((app.match(/ChartKit\?\.attach\(document\)/g) || []).length, 1);
  assert.match(app, /function pv4ConfidenceBandHtml[\s\S]*?globalThis\.ChartKit/);
});

test("el módulo no toca el DOM al cargarse: solo attach(document) lo engancha, y lo llama app.js", () => {
  const source = read("chart-kit.js");
  const topLevel = source.split("function attach")[0];
  assert.doesNotMatch(topLevel, /document\./);
  assert.doesNotMatch(source, /Math\.random|Date\.now|fetch\(|localStorage/);
});

test("diseño: el CSS del kit solo usa tokens --e19-*, recorrido con pan-y, movimiento reducido y contraste", () => {
  const css = read("chart-kit.css");
  const outsideForced = css.split("@media (forced-colors")[0];
  assert.doesNotMatch(outsideForced.replace(/\/\*[\s\S]*?\*\//g, ""), /#[0-9a-fA-F]{3,8}\b/);
  assert.match(css, /touch-action:\s*pan-y/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/); // el movimiento es la excepción, no la regla
  assert.match(css, /@media \(prefers-contrast: more\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  // La cebra y el hover de las tablas salen de tokens: styles.css fija #fafbfc a toda fila par sin tema (ilegible en oscuro).
  assert.match(css, /\.ck-tabla tbody tr:nth-child\(even\)\s*\{\s*background:\s*var\(--e19-surface-soft\)/);
  assert.match(css, /\.ck-tabla tbody tr:hover\s*\{\s*background:\s*var\(--e19-accent-soft\)/);
  const vars = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
  assert.ok(vars.length > 5);
  vars.forEach((name) => assert.match(name, /^--e19-/, `${name} no es un token --e19-*`));
});
