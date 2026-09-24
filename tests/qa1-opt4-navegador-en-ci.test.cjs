const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

// QA-1 y OPT-4 son las dos suites de navegador que prueban la app de verdad (flujos completos y
// accesibilidad con axe). Durante semanas solo se ejecutaban a mano y las dos estaban en rojo sin que
// nadie lo supiera: editar un presupuesto congelaba la pantalla ~14 s y Hoy saltaba un nivel de
// encabezado. Desde el 24 de septiembre de 2026 corren en el CI; esta prueba, que sí va en `npm test`,
// impide desengancharlas sin darse cuenta (mismo patrón que tests/t9-recorte-pantalla.test.cjs).

test("QA-1 y OPT-4 corren en el CI, después de instalar Chromium", () => {
  const scripts = JSON.parse(read("package.json")).scripts;
  assert.equal(scripts["test:e2e"], "playwright test --project=e2e");
  assert.equal(scripts["test:a11y-axe"], "playwright test --project=a11y");
  const workflow = read(".github/workflows/pages.yml");
  const install = workflow.indexOf("npx playwright install --with-deps chromium");
  assert.ok(install >= 0, "pages.yml debería instalar Chromium");
  for (const script of ["test:e2e", "test:a11y-axe"]) {
    const run = workflow.indexOf(`npm run ${script}`);
    assert.ok(run > install, `pages.yml debería ejecutar ${script} después de instalar Chromium`);
  }
});

test("el flujo de Presupuesto del mes mide cuánto tarda en responder la edición de un importe", () => {
  const spec = read("tests/qa1-flujos-completos.spec.cjs");
  assert.match(spec, /const changeMs = await input\.evaluate\(/);
  assert.match(spec, /\.toBeLessThan\(2000\);/);
});

test("el recorrido de QA-1 cubre las seis pantallas de las capturas de E18", () => {
  const qa1 = read("tests/qa1-flujos-completos.spec.cjs");
  const e18 = read("tests/e18-visual-regression.spec.cjs");
  const hashes = [...e18.matchAll(/hash: "(#[^"]+)"/g)].map((match) => match[1]);
  assert.equal(hashes.length, 6);
  for (const hash of hashes) assert.ok(qa1.includes(`hash: "${hash}"`), `QA-1 debería visitar ${hash}`);
});

test("el recorrido de QA-1 falla si una pantalla bloquea la página demasiado tiempo al abrirse", () => {
  const spec = read("tests/qa1-flujos-completos.spec.cjs");
  assert.match(spec, /observe\(\{ type: "longtask" \}\)/);
  assert.match(spec, /expect\(worst\.ms, [^\n]*\)\.toBeLessThan\(8000\);/);
});

test("la fecha corta está memorizada por día (sin ella, abrir Control de deuda bloqueaba la página ~12 s)", () => {
  const source = read("app.js");
  const start = source.indexOf("function shortDate(value) {");
  assert.ok(start >= 0);
  const body = source.slice(start, source.indexOf("\n}\n", start));
  assert.match(body, /shortDate\.cache/);
  const vm = require("node:vm");
  const context = { localDateFromIso: () => null };
  vm.runInNewContext(`${body}\n}\nresult = [shortDate(new Date(2026, 8, 3, 9)), shortDate(new Date(2026, 8, 3, 22)), shortDate(new Date(2026, 8, 4)), shortDate("no es fecha")];`, context);
  const expected = (date) => date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }).replace(/\./g, "");
  assert.deepEqual([...context.result], [expected(new Date(2026, 8, 3)), expected(new Date(2026, 8, 3)), expected(new Date(2026, 8, 4)), ""]);
});

test("la etiqueta de mes está memorizada (sin ella, editar un presupuesto congelaba la pantalla ~14 s)", () => {
  const source = read("app.js");
  const start = source.indexOf("function monthLabel(date) {");
  assert.ok(start >= 0);
  const body = source.slice(start, source.indexOf("\n}\n", start));
  assert.match(body, /monthLabel\.cache/);
  const vm = require("node:vm");
  const context = {};
  vm.runInNewContext(`${body}\n}\nresult = [monthLabel(new Date(2026, 8, 3)), monthLabel(new Date(2026, 8, 28)), monthLabel(new Date(2026, 9, 1))];`, context);
  const expected = (date) => date.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
  assert.deepEqual([...context.result], [expected(new Date(2026, 8, 1)), expected(new Date(2026, 8, 1)), expected(new Date(2026, 9, 1))]);
});
