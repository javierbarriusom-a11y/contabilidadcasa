const test = require("node:test");
const assert = require("node:assert/strict");
const Assets = require("../canonical-assets.js");

test("un activo con procedencia declarada queda completo y de alta confianza", () => {
  const asset = Assets.normalizeAsset({
    id: "caixa-cuenta",
    type: "cuenta",
    label: "Cuenta corriente CaixaBank",
    value: 7200,
    asOf: "2026-08-30",
    provenance: "declared",
    owner: "household",
    source: "extracto bancario",
  });

  assert.equal(asset.type, "cuenta");
  assert.equal(asset.value, 7200);
  assert.equal(asset.provenance, "declared");
  assert.equal(asset.dataQuality.complete, true);
  assert.equal(asset.dataQuality.confidence, "high");
});

test("sin procedencia declarada el activo se marca desconocido, nunca se asume declarado", () => {
  const asset = Assets.normalizeAsset({
    id: "piso-valoracion",
    type: "inmueble",
    label: "Piso habitual",
    value: 240000,
    asOf: "2026-01",
  });

  assert.equal(asset.provenance, "unknown");
  assert.equal(asset.dataQuality.fields.provenance, false);
  assert.ok(asset.dataQuality.missing.includes("provenance"));
  assert.equal(asset.dataQuality.complete, false);
});

test("un valor null no se confunde con un cero declarado (mismo guardia que A16-1/SP4)", () => {
  const asset = Assets.normalizeAsset({
    id: "fondo-sin-valor",
    type: "inversion",
    value: null,
    provenance: "declared",
  });

  assert.equal(asset.value, 0);
  assert.equal(asset.dataQuality.fields.value, false);
  assert.ok(asset.dataQuality.missing.includes("value"));
});

test("un tipo no reconocido cae a 'otro' sin romper la normalización", () => {
  const asset = Assets.normalizeAsset({ id: "x", type: "criptomoneda", value: 500, provenance: "estimated" });
  assert.equal(asset.type, "otro");
});

test("normalizeAssets agrega el patrimonio por tipo y detecta procedencia desconocida", () => {
  const result = Assets.normalizeAssets([
    { id: "a1", type: "cuenta", value: 7200, asOf: "2026-08-30", provenance: "declared", owner: "household" },
    { id: "a2", type: "inmueble", value: 240000, asOf: "2026-01", provenance: "estimated", owner: "household" },
    { id: "a3", type: "cuenta", value: 1800, provenance: "unknown", owner: "household" },
  ]);

  assert.equal(result.summary.netWorth, 249000);
  assert.equal(result.summary.knownValue, 247200);
  assert.equal(result.summary.totalsByType.cuenta, 9000);
  assert.equal(result.summary.totalsByType.inmueble, 240000);
  assert.equal(result.quality.valid, true);
  assert.ok(result.quality.issues.some((issue) => issue.code === "unknown-provenance" && issue.assetId === "a3"));
});

test("un id duplicado se marca como error de validación", () => {
  const result = Assets.normalizeAssets([
    { id: "dup", type: "cuenta", value: 100, provenance: "declared" },
    { id: "dup", type: "cuenta", value: 200, provenance: "declared" },
  ]);
  assert.equal(result.quality.valid, false);
  assert.ok(result.quality.issues.some((issue) => issue.code === "duplicate-asset-id"));
});

test("A14-6: un hogar sin activos configurados obtiene un resultado neutro, sin romper nada", () => {
  const result = Assets.normalizeAssets([]);
  assert.deepEqual(result.assets, []);
  assert.equal(result.summary.netWorth, 0);
  assert.equal(result.summary.count, 0);
  assert.equal(result.quality.valid, true);
  Assets.ASSET_TYPES.forEach((type) => assert.equal(result.summary.totalsByType[type], 0));
});

test("normalizeAssets tolera entradas no-array sin lanzar", () => {
  const result = Assets.normalizeAssets(undefined);
  assert.equal(result.assets.length, 0);
});

test("el contrato viaja versionado (schemaId/schemaVersion)", () => {
  assert.equal(Assets.SCHEMA_ID, "finanzas-casa-assets");
  const asset = Assets.normalizeAsset({ id: "v1", type: "cuenta", value: 10, provenance: "declared" });
  assert.equal(asset.schemaId, Assets.SCHEMA_ID);
  assert.equal(asset.schemaVersion, Assets.SCHEMA_VERSION);
});
