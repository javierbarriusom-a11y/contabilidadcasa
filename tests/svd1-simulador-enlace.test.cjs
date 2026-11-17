// SVD-1 (17/11/2026, docs/SVD_DISENO.md): las cuentas fijas del simulador visual de deuda («Entidad A / gestor» = cb,
// «Entidad B» = bk) solo cuentan mientras exista un contrato con ese nombre. Contratos INVENTADOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E14 = require("../canonical-e14-debt-adapter.js");

const html = fs.readFileSync(path.join(__dirname, "..", "debt-roadmap.html"), "utf8");

test("fixedAccountStatus: enlazada con uno, sin contrato con ninguno, ambigua con varios", () => {
  assert.equal(E14.fixedAccountStatus([{ entity: "Entidad A" }], "Entidad A"), "enlazada");
  assert.equal(E14.fixedAccountStatus([{ entity: " entidad a " }], "Entidad A"), "enlazada", "sin distinguir mayúsculas ni espacios");
  assert.equal(E14.fixedAccountStatus([{ entity: "Banco FICTICIO" }], "Entidad A"), "sin-contrato");
  assert.equal(E14.fixedAccountStatus([], "Entidad A"), "sin-contrato");
  assert.equal(E14.fixedAccountStatus([{ entity: "Entidad A" }, { entity: "Entidad A" }], "Entidad A"), "ambigua");
});

test("con un contrato de ejemplo y deudas reales: A enlazada con su saldo, B a 0 y los reales como cuentas propias", () => {
  const modelo = E14.buildReadModel({
    contracts: [
      { id: "debt-1", entity: "Entidad A", currentPrincipal: 6000, paymentStatus: "active" },
      { id: "debt-custom-1", entity: "Banco FICTICIO", currentPrincipal: 2400, paymentStatus: "active" },
    ],
    forecast: null,
    generatedAt: "2026-11-17T00:00:00.000Z",
  });
  assert.deepEqual(modelo.fixedAccounts, { cb: "enlazada", bk: "sin-contrato" });
  assert.equal(modelo.canonicalValues.cb_amount, 6000);
  assert.equal(modelo.canonicalValues.bk_amount, 0);
  assert.ok(!modelo.ambiguous.includes("bk_amount"));
  assert.deepEqual(modelo.extraDebts.map((cuenta) => cuenta.id), ["debt-custom-1"]);
});

test("dos contratos con el mismo nombre de ejemplo siguen siendo ambiguos y sin saldo (no se elige uno a ciegas)", () => {
  const modelo = E14.buildReadModel({
    contracts: [{ id: "a1", entity: "Entidad A", currentPrincipal: 6000 }, { id: "a2", entity: "Entidad A", currentPrincipal: 1000 }],
    forecast: null,
  });
  assert.equal(modelo.fixedAccounts.cb, "ambigua");
  assert.ok(modelo.ambiguous.includes("cb_amount"));
  assert.equal(modelo.canonicalValues.cb_amount, undefined);
});

test("el simulador saca del cálculo las cuentas fijas sin contrato y pregunta una vez a qué contrato pasar lo simulado", () => {
  assert.match(html, /function fixedAccountActive\(prefix\)\{return canonicalReadModel\?\.fixedAccounts\?\.\[prefix\]!=='sin-contrato';\}/);
  assert.match(html, /<div id="svdMigracion"><\/div>\s*<div id="dynamicDebtBlocks"><\/div>/);
  // Solo pregunta si había algo simulado en esa cuenta, hay contratos reales y no se ha contestado ya.
  assert.match(html, /function svdMigrationPending\(prefix\)\{return !fixedAccountActive\(prefix\)&&dynamicDebtAccounts\.length>0&&!state\.migracion\?\.\[prefix\]&&/);
  // Copia los supuestos (nunca el saldo, que es de Contratos) y guarda lo que había para poder deshacer.
  assert.match(html, /const FIXED_ACCOUNT_FIELDS=\['strategy','discount','start','lump','apr','term','finance_pct','extra','extra_month'\];/);
  assert.doesNotMatch(html.match(/const FIXED_ACCOUNT_FIELDS=[^;]+;/)[0], /amount/);
  assert.match(html, /function svdDeshacer\(prefix\)/);
  // La respuesta viaja con el resto del estado a la app (copia de seguridad y nube).
  assert.match(html, /migracion:state\.migracion\|\|\{\}/);
});
