const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const superficie = require("./helpers/superficie.cjs");

// XGO-01 · «uno entra, uno sale» (GOV-02), la mitad que faltaba (la otra, el desalojo de app.js, se hizo el 20-21/10).
// La e2e de qa1 cuenta los titulares visibles por defecto ruta a ruta y exige que coincidan con
// docs/gobierno/superficie.json; esta prueba exige que el manifiesto no pase de su techo:
// - el total no puede superar base + lo que sumen las excepciones (cada una con fecha, cuánto, qué y por qué);
// - y la base baja cuando algo sale (trinquete), para que el sitio liberado no se reutilice sin que se vea.

const m = superficie.leerManifiesto();

test("el manifiesto está bien formado: base, excepciones con su porqué y un número por ruta", () => {
  assert.ok(Number.isInteger(m.base) && m.base > 0);
  assert.ok(Array.isArray(m.excepciones));
  for (const e of m.excepciones) {
    assert.match(String(e.fecha), /^\d{4}-\d{2}-\d{2}$/, JSON.stringify(e));
    assert.ok(Number.isInteger(e.mas) && e.mas > 0, `«mas» entero y positivo: ${JSON.stringify(e)}`);
    assert.ok(String(e.que || "").trim().length > 5 && String(e.porque || "").trim().length > 10, `qué entra y por qué: ${JSON.stringify(e)}`);
  }
  const rutas = Object.entries(m.rutas);
  assert.ok(rutas.length > 15, "el menú principal y sus pestañas");
  rutas.forEach(([ruta, n]) => {
    assert.match(ruta, /^#[a-z0-9-]+( › .+)?$/, ruta);
    assert.ok(Number.isInteger(n) && n >= 0, ruta);
  });
  assert.ok(["#home", "#movements", "#registrar", "#plan", "#cierre", "#ajustes"].every((r) => r in m.rutas));
});

test("uno entra, uno sale: lo que se ve no pasa del techo (base + excepciones)", () => {
  const total = superficie.total(m.rutas);
  const permitido = superficie.permitido(m);
  assert.ok(total <= permitido, `Entra sin salir: ${total} titulares a la vista y el techo es ${permitido}. Pliega o retira otra cosa (lo que se retire, con el visto bueno del hogar) o añade en «excepciones» {fecha, mas, que, porque}.`);
});

test("trinquete: si algo sale, la base baja, y el sitio liberado no se reutiliza sin que se vea", () => {
  const total = superficie.total(m.rutas);
  const permitido = superficie.permitido(m);
  assert.ok(total >= permitido, `Han salido ${permitido - total} titulares: baja «base» de ${m.base} a ${m.base - (permitido - total)} en docs/gobierno/superficie.json.`);
});

test("las cuentas del manifiesto y el diff de qué entra y qué sale", () => {
  const ejemplo = { base: 10, excepciones: [{ mas: 2 }, { mas: 1 }] };
  assert.equal(superficie.permitido(ejemplo), 13);
  assert.equal(superficie.total({ "#a": 3, "#b": 4 }), 7);
  assert.deepEqual(superficie.diferencias({ "#a": 3, "#b": 4 }, { "#a": 3, "#b": 5, "#c": 1 }), ["#b: 4 → 5", "#c: 0 → 1"]);
  assert.deepEqual(superficie.diferencias({ "#a": 3, "#x": 2 }, { "#a": 3 }), ["#x: 2 → 0"]);
});

test("la e2e que hace el inventario está en el CI (proyecto e2e) y usa la fecha fija", () => {
  const spec = fs.readFileSync(path.resolve(__dirname, "qa1-flujos-completos.spec.cjs"), "utf8");
  assert.match(spec, /test\.describe\("XGO-01 · Uno entra, uno sale"/);
  assert.match(spec, /const rutas = await superficie\.inventario\(page\);/);
  assert.match(spec, /expect\(cambios, [\s\S]*?\)\.toEqual\(\[\]\);/);
  assert.deepEqual(superficie.FECHA_FIJA, [2026, 9, 26, 10, 0, 0]);
  assert.match(fs.readFileSync(path.resolve(__dirname, "..", "playwright.config.cjs"), "utf8"), /name: "e2e", testMatch: "qa1-flujos-completos\.spec\.cjs"/);
});
