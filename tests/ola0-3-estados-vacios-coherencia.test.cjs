/**
 * tests/ola0-3-estados-vacios-coherencia.test.cjs
 *
 * Ola 0 (UX), entrega 3 — «lo que la pantalla dice tiene que ser verdad y decirse una vez»:
 * - un estado vacío («Sin presupuestos», «Sin datos») no es una alerta: sin color de aviso ni
 *   insignia «Cerca del umbral», que promete un umbral que nadie ha cruzado;
 * - «Libre de deuda» dice lo mismo en la franja superior y en la pantalla de Deuda cuando queda
 *   deuda sin cuota activa: sin fecha (la fecha de las cuotas activas baja a la línea secundaria);
 * - la tarjeta «Capacidad de endeudamiento» de la ruta de deuda ya no va dentro de otra tarjeta con
 *   el mismo título;
 * - Cierre: cuatro contadores en una fila, y las tarjetas que cuelgan de la pantalla con padding;
 * - la barra lateral no deja el formulario de acceso abierto.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const html = read("index.html");
const tokens = read("design-tokens.css");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `no se encontró ${name}`);
  const next = source.indexOf("\nfunction ", start + 10);
  return source.slice(start, next < 0 ? undefined : next);
}

test("renderHomeKpi: el estado «neutral» no lleva clase de aviso ni insignia de umbral", () => {
  const fn = extractFunction(app, "renderHomeKpi");
  assert.match(fn, /status === "neutral" \? ""/);
  // La insignia solo depende de danger y warn: neutral no cae en ninguna.
  assert.match(fn, /status === "danger"[\s\S]*?Fuera de umbral[\s\S]*?status === "warn"[\s\S]*?Cerca del umbral[\s\S]*?: ""/);
});

test("Hoy: los estados vacíos de presupuesto, objetivos y acierto de la previsión son neutrales", () => {
  const glance = extractFunction(app, "renderHomeBudgetGlance");
  assert.match(glance, /value: "Sin presupuestos",[\s\S]*?status: "neutral"/);
  assert.match(glance, /value: "Sin datos",[\s\S]*?status: "neutral"/);
  assert.match(app, /status: !accuracyScore\.calculable \? "neutral"/);
});

test("Franja superior: con deuda sin cuota activa, «Libre de deuda» dice «Sin fecha»", () => {
  const fn = extractFunction(app, "topbarStatusFigures");
  assert.match(fn, /const libreParcial = debtOutlook\.estimable && \/ · \/\.test\(debtOutlook\.libreDeDeudaLabel\)/);
  assert.match(fn, /libreParcial \? .*"Sin fecha"|: "Sin fecha"/);
  assert.match(fn, /en las cuotas activas/);
  assert.doesNotMatch(fn, /estimable \? debtOutlook\.libreDeDeudaLabel : "—"/);
});

test("Deuda · ruta: la capacidad de endeudamiento no se envuelve en otra tarjeta con el mismo título", () => {
  const ruta = html.slice(html.indexOf('id="deuda-ruta"'));
  const side = ruta.slice(ruta.indexOf("deuda-ruta-side"), ruta.indexOf("Antes de aplicar"));
  assert.match(side, /<div id="deudaRutaCapacity"><\/div>/);
  assert.doesNotMatch(side, /<h3[^>]*>Capacidad de endeudamiento<\/h3>/);
});

test("Cierre: cuatro contadores en una fila y tarjetas de pantalla con padding", () => {
  assert.match(tokens, /@media \(min-width: 861px\) \{\s*\.e19-cierre #cierreCounters \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(tokens, /\.e19-cierre #cierreCounters \.e19-kpi \{\s*min-height: 0;/);
  assert.match(tokens, /\.e19-cierre > article\.e19-card \{\s*padding: 18px;/);
});

test("Barra lateral: el formulario de acceso va plegado y conserva sus ids", () => {
  const form = html.slice(html.indexOf('id="syncForm"'), html.indexOf('id="syncSession"'));
  assert.match(form, /<details class="sync-details">\s*<summary>Entrar o crear cuenta<\/summary>/);
  for (const id of ["syncEmail", "syncPassword", "syncLogin", "syncSignup", "syncResend"]) {
    assert.match(form, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(form, /<details[^>]*\bopen\b/);
});
