const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const FinanceStateContract = require(path.join(root, "state-contract.js"));

// ARQ-6 (paso 3, 24 de septiembre de 2026): la copia de emergencia (A0-9, «Descargar copia completa»)
// solo llevaba el estado que recoge appStatePayload(). Quince almacenes que la app guarda cada uno en
// su propia clave del navegador se perdían al descargar una copia, borrar el navegador y restaurarla
// (reproducido en navegador real): historia que solo se acumula al firmar cada cierre y datos que el
// hogar escribe a mano. Nada lo vigilaba porque cada almacén nuevo se añadía sin mirar la copia.
//
// Esta prueba cierra esa puerta: toda clave que la app escribe en el navegador tiene que estar en el
// estado principal (saveLocalSnapshot), en BACKUP_LOCAL_STORES (app.js) o aquí abajo como excluida
// con su motivo. Una clave nueva sin clasificar, o una exclusión que ya no existe, la ponen en rojo.
// El viaje completo (descargar → borrar → restaurar) se comprueba en navegador en
// tests/qa1-flujos-completos.spec.cjs.

const EXCLUDED = {
  // Derivados o copias de algo que ya viaja en la copia.
  "debt-capital-snapshot-at-close":
    "aviso de cuadre derivado del último cierre, no un dato primario (su propio comentario en app.js); se regenera en el siguiente cierre",
  e13SavedScenarios: "copia espejo de scenarioSettings.e13SavedScenarios, que ya viaja en la copia",
  "financeDashboard:workbookOverride:v1": "el libro; la copia lo lleva como workbookData",
  // Preferencias y marcas de este dispositivo, no datos del hogar.
  "migration:variable-operational-1750-from-2026-06-v2": "marca de migración ya aplicada",
  "dex5-first-use-at": "fecha de primer uso de este navegador (guía de primeros pasos)",
  "dex5-onboarding-dismissed": "preferencia de este navegador",
  "e17-navigation-preferences": "preferencias de navegación de este dispositivo",
  "period-selector-preference": "preferencia de cadencia por pantalla de este dispositivo",
  "visit-counts": "contador de uso de este dispositivo (ARQ-0), no un dato financiero",
  "theme-preference": "tema claro/oscuro de este dispositivo",
  "finance-e18-local-health": "métricas técnicas locales (E18)",
  // Trabajo a medias y ayudas de este dispositivo.
  "datos-importar-borrador": "bandeja de importación a medio revisar; se rehace subiendo el fichero",
  "datos-importar-historial-huellas": "aviso de «ya subiste este fichero» durante 7 días en este dispositivo",
  "laboratorio-rejected-writes": "registro de diagnóstico de escrituras rechazadas en Laboratorio",
};

const SOURCES = [
  ...fs.readdirSync(root).filter((name) => name.endsWith(".js") && name !== "eslint.config.js"),
  ...fs.readdirSync(path.join(root, "views")).filter((name) => name.endsWith(".js")).map((name) => `views/${name}`),
];
const corpus = SOURCES.map(read).join("\n");

function constValue(name) {
  const match = corpus.match(new RegExp(`const ${name} = "([^"]+)"`));
  assert.ok(match, `no se encontró el valor de la constante ${name}`);
  return match[1];
}

// Todas las claves que la app escribe en localStorage.
function writtenKeys() {
  const keys = new Set();
  for (const match of corpus.matchAll(/storageKey\("([^"]+)"\)/g)) keys.add(match[1]);
  for (const match of corpus.matchAll(/storageKey\(([A-Z][A-Z0-9_]+)\)/g)) keys.add(constValue(match[1]));
  for (const match of corpus.matchAll(/storageSet\(([A-Z][A-Z0-9_]+)\s*,/g)) keys.add(constValue(match[1]));
  for (const match of corpus.matchAll(/localStorage\.setItem\(([A-Z][A-Z0-9_]+)\s*,/g)) keys.add(constValue(match[1]));
  for (const match of corpus.matchAll(/storage\.setItem\(([A-Z][A-Z0-9_]+)\s*,/g)) keys.add(constValue(match[1]));
  return keys;
}

function mainStateKeys() {
  const source = read("app.js");
  const start = source.indexOf("function saveLocalSnapshot() {");
  const body = source.slice(start, source.indexOf("\n}\n", start));
  const keys = new Set();
  for (const match of body.matchAll(/storageKey\("([^"]+)"\)/g)) keys.add(match[1]);
  for (const match of body.matchAll(/storageKey\(([A-Z][A-Z0-9_]+)\)/g)) keys.add(constValue(match[1]));
  return keys;
}

function backupLocalStores() {
  const match = read("app.js").match(/const BACKUP_LOCAL_STORES = \[([\s\S]*?)\n\];/);
  assert.ok(match, "app.js debería declarar BACKUP_LOCAL_STORES");
  return [...match[1].matchAll(/^\s*"([^"]+)",/gm)].map((entry) => entry[1]);
}

test("toda clave que la app guarda en el navegador está en la copia o excluida con motivo", () => {
  const main = mainStateKeys();
  const local = new Set(backupLocalStores());
  const unclassified = [...writtenKeys()].filter((key) => !main.has(key) && !local.has(key) && !(key in EXCLUDED));
  assert.deepEqual(unclassified, [], `claves sin clasificar (añádelas a BACKUP_LOCAL_STORES en app.js o a EXCLUDED aquí, con motivo): ${unclassified.join(", ")}`);
});

test("las exclusiones y los almacenes de la copia existen de verdad (fallan si sobran)", () => {
  const written = writtenKeys();
  for (const key of Object.keys(EXCLUDED)) assert.ok(written.has(key), `EXCLUDED lista «${key}», que ya no se escribe en ningún sitio`);
  for (const key of backupLocalStores()) assert.ok(written.has(key), `BACKUP_LOCAL_STORES lista «${key}», que ya no se escribe en ningún sitio`);
  for (const key of backupLocalStores()) assert.ok(!(key in EXCLUDED), `«${key}» no puede estar a la vez en la copia y excluida`);
});

test("los almacenes propios viajan en el estado (copia y nube), se restauran y escribirlos sincroniza", () => {
  const source = read("app.js");
  const payloadBuilder = source.slice(source.indexOf("function appStatePayload("), source.indexOf("function stateBackupSummaryMarkup("));
  assert.match(payloadBuilder, /localStores: backupLocalStoresPayload\(\),/);
  const apply = source.slice(source.indexOf("function applyPersistedPayload("), source.indexOf("function saveLocalSnapshot() {"));
  assert.match(apply, /restoreBackupLocalStores\(payload\.localStores\);/);
  // Cada pantalla escribe su almacén por su cuenta: storageSet() tiene que avisar a la sincronización,
  // y restaurar no puede provocar un reenvío a la nube de lo que acaba de llegar de ella.
  const storageSet = source.slice(source.indexOf("function storageSet(key, value) {"), source.indexOf("\n}\n", source.indexOf("function storageSet(key, value) {")));
  assert.match(storageSet, /if \(isBackupLocalStoreKey\(key\)\) scheduleLocalStoreSync\(\);/);
  const schedule = source.slice(source.indexOf("function scheduleLocalStoreSync() {"), source.indexOf("function backupLocalStoresPayload() {"));
  assert.match(schedule, /if \(applyingLocalStores\) return;/);
  assert.match(schedule, /queueRemoteSave\(\)/);
  // La lista se declara antes que storageSet(): una escritura temprana no puede toparse con ella sin inicializar.
  assert.ok(source.indexOf("const BACKUP_LOCAL_STORES = [") < source.indexOf("function storageSet(key, value) {"));
});

test("restaurar no borra almacenes ausentes y conserva una vez el valor local que sustituye", () => {
  const vm = require("node:vm");
  const source = read("app.js");
  const pick = (signature) => {
    const start = source.indexOf(signature);
    assert.ok(start >= 0, signature);
    return source.slice(start, source.indexOf("\n}\n", start) + 2);
  };
  const constBlock = source.slice(source.indexOf("const BACKUP_LOCAL_STORES = ["), source.indexOf("let applyingLocalStores"));
  const store = { "iv1-valuation-snapshots:x": "local-iv1", "pv5-diary:x": "local-pv5" };
  const context = {
    storageKey: (name) => `${name}:x`,
    storageGet: (key, fallback) => (key in store ? store[key] : fallback),
    storageSet: (key, value) => { store[key] = value; },
  };
  vm.runInNewContext(`${constBlock}\nlet applyingLocalStores = false;\n${pick("function restoreBackupLocalStores(stores) {")}\nthis.restore = restoreBackupLocalStores;`, context);
  context.restore({ "iv1-valuation-snapshots": "nube-iv1" });
  assert.equal(store["iv1-valuation-snapshots:x"], "nube-iv1");
  assert.equal(store["iv1-valuation-snapshots:x:antes-de-sincronizar"], "local-iv1");
  assert.equal(store["pv5-diary:x"], "local-pv5", "un almacén que no trae el estado entrante no se toca");
  context.restore({ "iv1-valuation-snapshots": "nube-iv1-v2" });
  assert.equal(store["iv1-valuation-snapshots:x:antes-de-sincronizar"], "local-iv1", "la copia previa se guarda una sola vez");
});

test("el contrato conserva localStores en el viaje completo de la copia y descarta una forma inválida", () => {
  const payload = {
    version: 1, projects: [], debtLiquidations: [], decisionEvents: [], customPlanningRows: [],
    incomeActuals: {}, expenseActuals: {}, balanceSettings: {}, scenarioSettings: {}, deletedPlanningRows: {},
    seriesOverrides: {}, rowLabelOverrides: {}, movementMappings: {}, workbookData: null,
    localStores: { "iv1-valuation-snapshots": '[{"monthKey":"2026-08"}]' },
  };
  const envelope = FinanceStateContract.buildBackupEnvelope(payload);
  assert.equal(envelope.summary.localStores, 1);
  const restored = FinanceStateContract.migrateBackupEnvelope(JSON.parse(JSON.stringify(envelope)));
  assert.equal(FinanceStateContract.validateBackupEnvelope(restored).valid, true);
  assert.deepEqual(restored.payload.localStores, payload.localStores);
  const invalid = FinanceStateContract.migratePayload({ ...payload, localStores: "no es un objeto" });
  assert.equal(invalid.localStores, undefined);
});
