const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const Assets = require(path.join(root, "canonical-assets.js"));

// LPX3 (Oleada 2 Bloque 2): checklist de continuidad ante fallecimiento o incapacidad. Depende de
// A14-1 (activos con procedencia) y SP1 (inventario de pólizas) — dos puntos verificables con datos
// reales; los otros tres (testamento, beneficiarios, a quién avisar) no tienen ninguna fuente de
// datos en la app, así que quedan como casillas que confirma el propio hogar, nunca inferidas.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox() {
  const context = { window: { FinanceCanonicalAssets: Assets } };
  vm.createContext(context);
  vm.runInContext(`const LPX3_MANUAL_ITEMS = ${JSON.stringify([{ id: "will", label: "Testamento hecho y actualizado" }, { id: "beneficiaries", label: "Beneficiarios de las pólizas revisados y al día" }, { id: "documentsKnown", label: "Alguien de confianza sabe dónde están los documentos clave" }])};`, context);
  vm.runInContext(extractFunction("lpx3ContinuityChecklist"), context);
  return context;
}

const ASSET_WITH_PROVENANCE = { id: "a1", type: "cuenta", label: "Cuenta", value: 1000, asOf: "2026-09-01", provenance: "declared" };
const ASSET_UNKNOWN = { id: "a2", type: "inmueble", label: "Piso", value: 200000, asOf: "2026-09-01", provenance: "unknown" };
const POLICY = { id: "p1", name: "Seguro de vida", renewalDate: "2027-01-01" };

test("lpx3ContinuityChecklist · sin activos ni pólizas, ambos puntos automáticos fallan explícitamente", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([], [], {});
  const assetsCheck = result.checks.find((check) => check.id === "assets");
  const policiesCheck = result.checks.find((check) => check.id === "policies");
  assert.equal(assetsCheck.ok, false);
  assert.match(assetsCheck.detail, /Sin activos registrados/);
  assert.equal(policiesCheck.ok, false);
  assert.match(policiesCheck.detail, /Sin ninguna póliza registrada/);
});

test("lpx3ContinuityChecklist · con activos, todos con procedencia declarada, el punto pasa", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([ASSET_WITH_PROVENANCE], [POLICY], {});
  const assetsCheck = result.checks.find((check) => check.id === "assets");
  assert.equal(assetsCheck.ok, true);
});

test("lpx3ContinuityChecklist · un activo con procedencia desconocida hace fallar el punto, con el recuento real", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([ASSET_WITH_PROVENANCE, ASSET_UNKNOWN], [], {});
  const assetsCheck = result.checks.find((check) => check.id === "assets");
  assert.equal(assetsCheck.ok, false);
  assert.match(assetsCheck.detail, /1 activo\(s\) sin procedencia declarada/);
});

test("lpx3ContinuityChecklist · los tres puntos manuales empiezan sin confirmar, y nunca se infieren de otros datos", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([], [], {});
  ["will", "beneficiaries", "documentsKnown"].forEach((id) => {
    const check = result.checks.find((item) => item.id === id);
    assert.equal(check.ok, false);
    assert.match(check.detail, /Pendiente de confirmar/);
  });
});

test("lpx3ContinuityChecklist · un punto manual confirmado por el hogar pasa a ok, sin tocar los demás", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([], [], { will: true });
  assert.equal(result.checks.find((check) => check.id === "will").ok, true);
  assert.equal(result.checks.find((check) => check.id === "beneficiaries").ok, false);
});

test("lpx3ContinuityChecklist · ready es true solo cuando los cinco puntos están en verde", () => {
  const ctx = sandbox();
  const allManual = { will: true, beneficiaries: true, documentsKnown: true };
  const partial = ctx.lpx3ContinuityChecklist([ASSET_WITH_PROVENANCE], [POLICY], { will: true, beneficiaries: true });
  assert.equal(partial.ready, false);
  const complete = ctx.lpx3ContinuityChecklist([ASSET_WITH_PROVENANCE], [POLICY], allManual);
  assert.equal(complete.ready, true);
});

test("app.js: los checks manuales se persisten en scenarioSettings.lpx3ManualChecks, nunca en memoria efímera", () => {
  const block = app.slice(app.indexOf("function lpx3ManualChecks("), app.indexOf("function lpx3ManualChecks(") + 300);
  assert.match(block, /scenarioSettings\.lpx3ManualChecks/);
  const toggleBlock = app.slice(app.indexOf("function handleLpx3ManualCheckToggle("), app.indexOf("function handleLpx3ManualCheckToggle(") + 300);
  assert.match(toggleBlock, /saveScenarioSettings\(\);/);
});

test("app.js: el checklist se recalcula al añadir o quitar un activo o una póliza (A14-1/SP1), no solo en el render global", () => {
  const addAssetBlock = app.slice(app.indexOf("saveAssetsList(next);"), app.indexOf("saveAssetsList(next);") + 200);
  assert.match(addAssetBlock, /renderLpx3ContinuityChecklist\(\);/);
  assert.match(app, /removeInsurancePolicy\(removeButton\.dataset\.policyRemove\);\s*\n\s*renderInsurancePolicies\(\);\s*\n\s*renderLpx3ContinuityChecklist\(\);/);
});

test("app.js: el checkbox de cada punto manual está cableado a handleLpx3ManualCheckToggle", () => {
  assert.match(app, /qs\("lpx3ContinuityChecklist"\)\?\.addEventListener\("change"/);
  assert.match(app, /handleLpx3ManualCheckToggle\(checkbox\.dataset\.lpx3ManualCheck, checkbox\.checked\)/);
});

test("index.html: la tarjeta de continuidad está en Ajustes › Patrimonio, junto a A14-1", () => {
  assert.match(indexSource, /id="lpx3ContinuityChecklist"/);
});
