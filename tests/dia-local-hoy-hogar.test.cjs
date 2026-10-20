const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// «Hoy» es el día del calendario del hogar (hora local), no el de UTC (decisión del hogar, 20/10/2026; sesión 325 para
// monthsSinceDate, sesión 326 para el resto). Con `new Date().toISOString().slice(0, 10)`, de 0 a 1-2 h en Madrid se registraba la
// víspera: la fecha por defecto de la captura rápida, el contador de visitas, los nombres de los ficheros exportados, la frescura
// de la bandeja previa… El CI corre en UTC, donde el fallo no se ve, así que estas pruebas se ejecutan en un proceso hijo con la
// hora de Madrid y el reloj parado a las 00:30 del 1/11/2026 (en UTC aún es el 31/10, 23:30).

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = codigoApp();
const analisis = read("views/analisis.js");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = source.indexOf("(", start); index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = source.indexOf("{", index);
        break;
      }
    }
  }
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

// Ejecuta `body` en un proceso con TZ=Europe/Madrid y el reloj parado a las 00:30 del 1/11/2026; `body` deja su resultado en
// `result`. `sources` son funciones de app.js / views/*.js que se cargan en un sandbox cuyo `Date` es el reloj parado.
function inMadridAtHalfPastMidnight(body, sources = "") {
  const script = `
    const vm = require("node:vm");
    const RealDate = Date;
    const FIXED = new RealDate(2026, 10, 1, 0, 30).getTime();
    class FrozenDate extends RealDate {
      constructor(...args) { if (args.length) super(...args); else super(FIXED); }
      static now() { return FIXED; }
    }
    globalThis.Date = FrozenDate;
    const sandbox = vm.createContext({ Date: FrozenDate, JSON });
    vm.runInContext(${JSON.stringify(sources)}, sandbox);
    let result;
    ${body}
    console.log(JSON.stringify({ utc: new Date().toISOString(), result }));`;
  return JSON.parse(execFileSync(process.execPath, ["-e", script], { cwd: root, env: { ...process.env, TZ: "Europe/Madrid" } }).toString());
}

function extractConst(source, name) {
  const start = source.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name}`);
  return source.slice(start, source.indexOf(";\n", start) + 1);
}

const DATE_HELPERS = ["localDateFromIso", "isoLocalDate"].map((name) => extractFunction(app, name)).join("\n");

test("día del hogar · la prueba de verdad cae en otro día en UTC", () => {
  const { utc } = inMadridAtHalfPastMidnight("result = null;");
  assert.equal(utc.slice(0, 10), "2026-10-31");
});

test("día del hogar · la captura rápida (E17) entiende «hoy» y «ayer» desde el 1/11", () => {
  const sources = [DATE_HELPERS, "function round2(value) { return Math.round(Number(value) * 100) / 100; }",
    ...["E17_CAPTURE_EXPENSE_KEYWORDS", "E17_CAPTURE_INCOME_KEYWORDS", "E17_CAPTURE_MONTHS", "E17_CAPTURE_RELATIVE_DAYS"].map((name) => extractConst(app, name)),
    ...["normalizedText", "e17ExtractNaturalDate", "e17ParseQuickCaptureQuery"].map((name) => extractFunction(app, name))].join("\n");
  const { result } = inMadridAtHalfPastMidnight('result = vm.runInContext("[\\"gasto 20 mercadona\\", \\"ayer gasto 20 mercadona\\"].map((query) => e17ParseQuickCaptureQuery(query).date)", sandbox);', sources);
  assert.deepEqual(result, ["2026-11-01", "2026-10-31"]);
});

test("día del hogar · el contador de visitas guarda el 1/11, no el 31/10", () => {
  const sources = [DATE_HELPERS, 'const VISIT_COUNTS_KEY = "visit-counts"; const backing = {};',
    "function storageKey(name) { return name; } function storageGet(key, fallback) { return backing[key] ?? fallback; }",
    "function storageSet(key, value) { backing[key] = value; }",
    extractFunction(app, "loadVisitCounts"), extractFunction(app, "recordViewVisit")].join("\n");
  const { result } = inMadridAtHalfPastMidnight('vm.runInContext("recordViewVisit(\\"hoy\\")", sandbox); result = JSON.parse(vm.runInContext("backing[\\"visit-counts\\"]", sandbox)).hoy.last;', sources);
  assert.equal(result, "2026-11-01");
});

test("día del hogar · la captura rápida (E17) y «repetir suscripción» apuntan el movimiento el 1/11", () => {
  const sources = [DATE_HELPERS,
    "const calls = []; let pendingE11bApply = null;",
    "function round2(value) { return Math.round(Number(value) * 100) / 100; } function qs() { return null; } function applyStagedMovementImport() {}",
    "function addE11bInboxItem(input) { calls.push(input); return { id: 'inbox-1' }; }",
    extractFunction(app, "handleE17QuickCapture"), extractFunction(analisis, "handleAnalisisRepeatSubscription")].join("\n");
  const { result } = inMadridAtHalfPastMidnight(`
    vm.runInContext('handleE17QuickCapture({ e17CreateAmount: "20", e17CreateConcept: "gasolina", e17CreateKind: "expense" })', sandbox);
    vm.runInContext('handleAnalisisRepeatSubscription("NETFLIX.COM", "12.99", "Suscripciones")', sandbox);
    result = vm.runInContext("calls.map((call) => call.rows[0].date)", sandbox);`, sources);
  assert.deepEqual(result, ["2026-11-01", "2026-11-01"]);
});

test("día del hogar · la fecha de saldo por defecto y los plazos «dentro de N días» cuentan desde el 1/11", () => {
  const sources = [DATE_HELPERS, "const baseData = {};", extractFunction(app, "defaultBalanceDate"), extractFunction(app, "uxDateAfterDays")].join("\n");
  const { result } = inMadridAtHalfPastMidnight('result = vm.runInContext("[defaultBalanceDate(), uxDateAfterDays(0), uxDateAfterDays(30)]", sandbox);', sources);
  assert.deepEqual(result, ["2026-11-01", "2026-11-01", "2026-12-01"]);
});

test("día del hogar · la frescura de la bandeja previa (E11b) sin `asOf` toma el 1/11", () => {
  const { result } = inMadridAtHalfPastMidnight(`
    const E11b = require("./canonical-e11b-inbox.js");
    const report = E11b.freshness({ balanceDate: "2026-10-31" });
    result = [report.asOf, report.areas.balances.status];`);
  assert.deepEqual(result, ["2026-11-01", "stale"], "un saldo del 31/10 ya no es de hoy a las 00:30 del 1/11");
});

test("día del hogar · un silencio de notificaciones «hasta el 31/10» ya no calla nada a las 00:30 del 1/11", () => {
  const { result } = inMadridAtHalfPastMidnight(`
    const notifications = require("./canonical-e9-notifications.js");
    const preferences = { enabled: true, frequency: "daily", quietStart: "22:00", quietEnd: "08:00", subscriptionId: "s-1" };
    const decide = (mutedUntil) => notifications.deliveryDecision({ preferences: { ...preferences, mutedUntil }, consentActive: true, localTime: "12:00", alert: { id: "a-1" } }).reason || "send";
    result = [decide("2026-10-31"), decide("2026-11-01")];`);
  assert.deepEqual(result, ["send", "muted"]);
});

// Guarda: ningún fichero de la app vuelve a sacar «hoy» de UTC con este patrón. Una marca de tiempo técnica usa toISOString()
// entero (con la hora); un día del hogar usa isoLocalDate(new Date()) o recibe `today` como parámetro.
test("día del hogar · ningún fichero de la app toma «hoy» con new Date().toISOString().slice(0, 10)", () => {
  const files = [
    ...fs.readdirSync(root).filter((file) => file.endsWith(".js")),
    ...fs.readdirSync(path.join(root, "views")).filter((file) => file.endsWith(".js")).map((file) => `views/${file}`),
  ];
  const offenders = files.filter((file) => read(file).includes("new Date().toISOString().slice(0, 10)"));
  assert.deepEqual(offenders, []);
});
