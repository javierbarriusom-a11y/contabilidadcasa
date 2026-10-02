const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const DataAge = require("../canonical-data-age.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// S4 (docs/OLA2_RECALIBRACION.md §3, sesión 288): la edad de los saldos, dicha junto a la cifra.
// El caso que lo motivó: la medición del 2/10/2026 calculó sobre saldos del 27/9 sin decirlo.

test("saldos de hace cinco días: se dice la fecha, la edad y se avisa", () => {
  const age = DataAge.describe({ asOfDate: "2026-09-27", today: "2026-10-02", mode: "manual" });
  assert.equal(age.ageDays, 5);
  assert.equal(age.label, "Saldos del 27/9 · hace 5 días");
  assert.equal(age.ageLabel, "hace 5 días");
  assert.equal(age.stale, true);
  assert.equal(age.tone, "stale");
  assert.match(age.warning, /faltar movimientos/);
});

test("hoy y ayer se dicen con palabras y no avisan", () => {
  const today = DataAge.describe({ asOfDate: "2026-10-02", today: "2026-10-02", mode: "manual" });
  assert.equal(today.label, "Saldos del 2/10 · hoy");
  assert.equal(today.stale, false);
  assert.equal(today.tone, "current");
  assert.equal(today.warning, "");
  const yesterday = DataAge.describe({ asOfDate: "2026-10-01", today: "2026-10-02", mode: "manual" });
  assert.equal(yesterday.ageLabel, "ayer");
  assert.equal(yesterday.tone, "current");
});

test("el umbral es de cuatro días: tres es normal (importación tres veces por semana), cuatro avisa", () => {
  assert.equal(DataAge.STALE_AFTER_DAYS, 4);
  const three = DataAge.describe({ asOfDate: "2026-09-29", today: "2026-10-02", mode: "manual" });
  assert.equal(three.ageDays, 3);
  assert.equal(three.stale, false);
  assert.equal(three.tone, "recent");
  const four = DataAge.describe({ asOfDate: "2026-09-28", today: "2026-10-02", mode: "manual" });
  assert.equal(four.ageDays, 4);
  assert.equal(four.stale, true);
  // El umbral es parametrizable.
  assert.equal(DataAge.describe({ asOfDate: "2026-09-29", today: "2026-10-02", mode: "manual", staleAfterDays: 3 }).stale, true);
});

test("la edad se cuenta en días naturales a través de cambio de mes, de año y de horario", () => {
  assert.equal(DataAge.describe({ asOfDate: "2026-12-30", today: "2027-01-02" }).ageDays, 3);
  // Cambio de hora de marzo (23 horas locales): sigue siendo un solo día.
  assert.equal(DataAge.describe({ asOfDate: "2026-03-28", today: "2026-03-29" }).ageDays, 1);
  assert.equal(DataAge.describe({ asOfDate: "2026-02-27", today: "2026-03-01" }).ageDays, 2);
});

test("de otro año, la fecha lleva el año", () => {
  assert.equal(DataAge.describe({ asOfDate: "2026-12-20", today: "2027-01-05" }).label, "Saldos del 20/12/2026 · hace 16 días");
});

test("en modo automático no hay aviso de antigüedad: el saldo se calcula por calendario", () => {
  const age = DataAge.describe({ asOfDate: "2026-09-27", today: "2026-10-02", mode: "auto" });
  assert.equal(age.stale, false);
  assert.equal(age.label, "Saldos calculados por calendario a 27/9");
  assert.equal(age.warning, "");
});

test("una fecha posterior a hoy se dice tal cual, sin «hace -N días»", () => {
  const age = DataAge.describe({ asOfDate: "2026-10-05", today: "2026-10-02", mode: "manual" });
  assert.equal(age.tone, "future");
  assert.equal(age.stale, false);
  assert.equal(age.label, "Saldos con fecha del 5/10 (posterior a hoy)");
  assert.ok(!/-\d/.test(age.label));
});

test("sin fecha válida no se inventa edad: «Saldos sin fecha»", () => {
  for (const asOfDate of ["", null, undefined, "no-fecha", "2026-02-31", "2026-13-01"]) {
    const age = DataAge.describe({ asOfDate, today: "2026-10-02", mode: "manual" });
    assert.equal(age.known, false, String(asOfDate));
    assert.equal(age.label, "Saldos sin fecha");
    assert.equal(age.ageDays, null);
    assert.equal(age.stale, false);
  }
  assert.equal(DataAge.describe({ asOfDate: "2026-09-27", today: "", mode: "manual" }).known, false);
  assert.equal(DataAge.describe().known, false);
});

test("acepta fechas con hora (ISO completo) quedándose con el día", () => {
  assert.equal(DataAge.describe({ asOfDate: "2026-09-27T10:15:00.000Z", today: "2026-10-02" }).ageDays, 5);
});

test("app.js usa el módulo en la tira superior, la cabecera de Hoy y la ficha de margen", () => {
  const app = read("app.js");
  assert.match(app, /function homeDataAge\(\)/);
  assert.match(app, /window\.FinanceCanonicalDataAge\?\.describe\(/);
  // Tira superior (visible en todas las pantallas salvo Hoy): edad junto a la fecha.
  assert.match(app, /homeDataAge\(\)\?\.ageLabel/);
  // Cabecera de Hoy: píldora de aviso si es antiguo; la etiqueta sustituye al «Analizado a» crudo.
  assert.match(app, /age\?\.stale \? `<span class="status-pill warn">/);
  // Ficha de margen de Hoy (S3′ absorbió la antigua «Liquidez hoy»): etiqueta con edad, aviso y acción de actualizar.
  assert.match(app, /\$\{age \? `\$\{age\.label\}\.` : ""\}\$\{age\?\.stale \? ` \$\{age\.warning\}` : ""\}/);
  assert.match(app, /cta: age\?\.stale \? "Actualizar saldos" : "Ver saldos"/);

  const html = read("index.html");
  const moduleAt = html.indexOf('src="canonical-data-age.js');
  const appAt = html.indexOf('src="app.js');
  assert.ok(moduleAt > 0 && moduleAt < appAt, "el módulo se carga antes que app.js");
  assert.match(read("service-worker.js"), /"\.\/canonical-data-age\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-data-age\.js"/);
});

test("P9 · un saldo declarado de 4 o más días baja a «media» la confianza de la liquidez que leen informes y asistente", () => {
  const app = read("app.js");
  // Mismo umbral que el aviso de la ficha de Hoy: homeDataAge().stale (4 días, STALE_AFTER_DAYS).
  assert.match(app, /confidence: state\?\.balanceMode === "manual" && !homeDataAge\(\)\?\.stale \? "high" : "medium"/);
  assert.equal(DataAge.STALE_AFTER_DAYS, 4);
});
