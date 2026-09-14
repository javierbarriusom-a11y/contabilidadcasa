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
// A14-1 (activos con procedencia) y SP1 (inventario de pólizas) — puntos verificables con datos
// reales. LPX6 (sesión 192) convirtió el tercer punto (beneficiarios) de casilla manual global a
// comprobación automática sobre pólizas de vida declaradas. LPX5 (sesión 193) añade un cuarto: al
// menos un activo con destino declarado. Los otros dos (testamento, a quién avisar) siguen sin
// ninguna fuente de datos en la app, así que quedan como casillas que confirma el propio hogar,
// nunca inferidas.

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
  vm.runInContext(`const LPX3_MANUAL_ITEMS = ${JSON.stringify([{ id: "will", label: "Testamento hecho y actualizado" }, { id: "documentsKnown", label: "Alguien de confianza sabe dónde están los documentos clave" }])};`, context);
  vm.runInContext(extractFunction("lpx3ContinuityChecklist"), context);
  return context;
}

const ASSET_WITH_PROVENANCE = { id: "a1", type: "cuenta", label: "Cuenta", value: 1000, asOf: "2026-09-01", provenance: "declared" };
const ASSET_UNKNOWN = { id: "a2", type: "inmueble", label: "Piso", value: 200000, asOf: "2026-09-01", provenance: "unknown" };
const ASSET_WITH_DESTINATION = { id: "a3", type: "cuenta", label: "Cuenta ahorro", value: 5000, asOf: "2026-09-01", provenance: "declared", destination: "Hijo mayor" };
const POLICY = { id: "p1", name: "Seguro de hogar", renewalDate: "2027-01-01" };
const POLICY_LIFE_NO_BENEFICIARY = { id: "p2", name: "Seguro de vida", renewalDate: "2027-01-01", isLife: true };
const POLICY_LIFE_WITH_BENEFICIARY = { id: "p3", name: "Seguro de vida", renewalDate: "2027-01-01", isLife: true, beneficiary: "Cónyuge" };

test("lpx3ContinuityChecklist · sin activos ni pólizas, los cuatro puntos automáticos fallan explícitamente", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([], [], {});
  const assetsCheck = result.checks.find((check) => check.id === "assets");
  const policiesCheck = result.checks.find((check) => check.id === "policies");
  const beneficiaryCheck = result.checks.find((check) => check.id === "beneficiaries");
  const destinationCheck = result.checks.find((check) => check.id === "assetDestination");
  assert.equal(assetsCheck.ok, false);
  assert.match(assetsCheck.detail, /Sin activos registrados/);
  assert.equal(policiesCheck.ok, false);
  assert.match(policiesCheck.detail, /Sin ninguna póliza registrada/);
  assert.equal(beneficiaryCheck.ok, false);
  assert.match(beneficiaryCheck.detail, /Sin pólizas de vida registradas/);
  assert.equal(destinationCheck.ok, false);
  assert.match(destinationCheck.detail, /Sin activos registrados/);
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

// LPX5: el punto de destino por activo ya no es una casilla manual — depende del campo real.
test("lpx3ContinuityChecklist · activos registrados sin ninguno con destino declarado hace fallar el punto, con el recuento real", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([ASSET_WITH_PROVENANCE, ASSET_UNKNOWN], [], {});
  const destinationCheck = result.checks.find((check) => check.id === "assetDestination");
  assert.equal(destinationCheck.ok, false);
  assert.match(destinationCheck.detail, /2 activo\(s\) sin destino declarado/);
});

test("lpx3ContinuityChecklist · al menos un activo con destino declarado hace pasar el punto", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([ASSET_WITH_PROVENANCE, ASSET_WITH_DESTINATION], [], {});
  const destinationCheck = result.checks.find((check) => check.id === "assetDestination");
  assert.equal(destinationCheck.ok, true);
  assert.match(destinationCheck.detail, /1 de 2 activo\(s\) con destino declarado/);
});

test("lpx3ContinuityChecklist · LPX6: sin pólizas de vida, el punto de beneficiario falla explícitamente, distinto de sin beneficiario declarado", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([], [POLICY], {});
  const beneficiaryCheck = result.checks.find((check) => check.id === "beneficiaries");
  assert.equal(beneficiaryCheck.ok, false);
  assert.match(beneficiaryCheck.detail, /Sin pólizas de vida registradas/);
});

test("lpx3ContinuityChecklist · LPX6: una póliza de vida sin beneficiario declarado no basta", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([], [POLICY_LIFE_NO_BENEFICIARY], {});
  const beneficiaryCheck = result.checks.find((check) => check.id === "beneficiaries");
  assert.equal(beneficiaryCheck.ok, false);
  assert.match(beneficiaryCheck.detail, /1 póliza\(s\) de vida sin beneficiario declarado/);
});

test("lpx3ContinuityChecklist · LPX6: una póliza sin isLife nunca cuenta, aunque su nombre diga 'vida'", () => {
  const ctx = sandbox();
  const namedLikeLife = { id: "p4", name: "Seguro de vida", renewalDate: "2027-01-01", beneficiary: "Hijos" };
  const result = ctx.lpx3ContinuityChecklist([], [namedLikeLife], {});
  const beneficiaryCheck = result.checks.find((check) => check.id === "beneficiaries");
  assert.equal(beneficiaryCheck.ok, false);
  assert.match(beneficiaryCheck.detail, /Sin pólizas de vida registradas/);
});

test("lpx3ContinuityChecklist · LPX6: al menos una póliza de vida con beneficiario declarado pasa, con el recuento real", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([], [POLICY_LIFE_NO_BENEFICIARY, POLICY_LIFE_WITH_BENEFICIARY], {});
  const beneficiaryCheck = result.checks.find((check) => check.id === "beneficiaries");
  assert.equal(beneficiaryCheck.ok, true);
  assert.match(beneficiaryCheck.detail, /1 de 2 póliza\(s\) de vida con beneficiario declarado/);
});

test("lpx3ContinuityChecklist · los dos puntos manuales empiezan sin confirmar, y nunca se infieren de otros datos", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([], [], {});
  ["will", "documentsKnown"].forEach((id) => {
    const check = result.checks.find((item) => item.id === id);
    assert.equal(check.ok, false);
    assert.match(check.detail, /Pendiente de confirmar/);
  });
});

test("lpx3ContinuityChecklist · un punto manual confirmado por el hogar pasa a ok, sin tocar el otro", () => {
  const ctx = sandbox();
  const result = ctx.lpx3ContinuityChecklist([], [], { will: true });
  assert.equal(result.checks.find((check) => check.id === "will").ok, true);
  assert.equal(result.checks.find((check) => check.id === "documentsKnown").ok, false);
});

test("lpx3ContinuityChecklist · ready es true solo cuando los seis puntos están en verde", () => {
  const ctx = sandbox();
  const manual = { will: true, documentsKnown: true };
  const partial = ctx.lpx3ContinuityChecklist([ASSET_WITH_DESTINATION], [POLICY, POLICY_LIFE_WITH_BENEFICIARY], { will: true });
  assert.equal(partial.ready, false);
  const complete = ctx.lpx3ContinuityChecklist([ASSET_WITH_DESTINATION], [POLICY, POLICY_LIFE_WITH_BENEFICIARY], manual);
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

// LPX5: el campo de destino vive en el propio formulario de activos (A14-1) y saveA14Asset lo lee.
test("index.html: el formulario de activos tiene el campo de destino declarado", () => {
  assert.match(indexSource, /id="a14AssetDestination"/);
});

test("app.js: saveA14Asset lee y guarda el destino declarado por activo", () => {
  const block = app.slice(app.indexOf("function saveA14Asset("), app.indexOf("function saveA14Asset(") + 1700);
  assert.match(block, /a14AssetDestination/);
  assert.match(block, /destination/);
});
