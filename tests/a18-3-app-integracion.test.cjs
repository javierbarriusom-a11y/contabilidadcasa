const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("A18-3: la tarjeta de liquidación con doble confirmación tiene sus campos", () => {
  ["a18SettlementProposal", "a18ConfirmJavi", "a18ConfirmTere", "a18SettlementHistory"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de liquidación`);
  });
  const cardStart = indexSource.indexOf("Liquidación con doble confirmación");
  assert.ok(cardStart >= 0, "Falta el título exacto de la tarjeta A18-3");
  const card = indexSource.slice(cardStart, cardStart + 700);
  assert.match(card, /exige que ambos confirmen por separado/);
  assert.match(card, /mismo ciclo de aprobación que el cierre y la reapertura de mes/);
});

test("A18-3: a18CurrentProposal delega en FinanceCanonicalHouseholdSplit.proposeSettlement, excluyendo lo ya liquidado", () => {
  const block = appSource.slice(appSource.indexOf("function a18CurrentProposal("), appSource.indexOf("function a18CurrentProposal(") + 400);
  assert.match(block, /engine\.proposeSettlement\(householdSplitEntriesList\(\), householdSplitSettings\(\), a18SettledEntryIds\(\)\)/);
});

test("A18-3: confirmA18Settlement nunca registra la liquidación con una sola confirmación", () => {
  const block = appSource.slice(appSource.indexOf("function confirmA18Settlement("), appSource.indexOf("function confirmA18Settlement(") + 1400);
  assert.match(block, /engine\.confirmSettlement\(/);
  assert.match(block, /result\.status === "confirmed"/);
  assert.match(block, /Falta la de/);
});

test("A18-3: una confirmación en curso se descarta si el saldo pendiente cambió mientras tanto (nunca liquida un importe obsoleto)", () => {
  const block = appSource.slice(appSource.indexOf("function a18SettlementConfirmationState("), appSource.indexOf("function a18SettlementConfirmationState(") + 600);
  assert.match(block, /sameEntries/);
  assert.match(block, /return sameEntries \? raw : null;/);
});

test("A18-3: sin saldo pendiente, la tarjeta lo dice explícitamente en vez de inventar una liquidación", () => {
  const block = appSource.slice(appSource.indexOf("function renderA18SettlementCard("), appSource.indexOf("function renderA18SettlementCard(") + 1200);
  assert.match(block, /Sin saldo pendiente que liquidar/);
});

test("A18-3: los botones de confirmación de Javi y Tere están cableados a confirmA18Settlement", () => {
  assert.match(appSource, /qs\("a18ConfirmJavi"\)\?\.addEventListener\("click", \(\) => confirmA18Settlement\("javi"\)\);/);
  assert.match(appSource, /qs\("a18ConfirmTere"\)\?\.addEventListener\("click", \(\) => confirmA18Settlement\("tere"\)\);/);
});

test("A18-3: registrar, quitar o cambiar un gasto/regla/ingreso también refresca la propuesta de liquidación", () => {
  ["saveA18Incomes", "saveA18Rule", "removeA18Rule", "saveA18Entry", "removeA18Entry"].forEach((fnName) => {
    const block = appSource.slice(appSource.indexOf(`function ${fnName}(`), appSource.indexOf(`function ${fnName}(`) + 700);
    assert.match(block, /renderA18SettlementCard\(\);/, `${fnName} no refresca renderA18SettlementCard()`);
  });
});

test("A18-3: la tarjeta se renderiza en el arranque de la app, justo después del saldo continuo", () => {
  assert.match(appSource, /renderA18BalanceCard\(\);\s*\n\s*renderA18SettlementCard\(\);/);
});

test("A18-3: una liquidación confirmada guarda exactamente los gastos que cubrió, para no volver a proponerlos", () => {
  const block = appSource.slice(appSource.indexOf("function a18SettledEntryIds("), appSource.indexOf("function a18SettledEntryIds(") + 300);
  assert.match(block, /flatMap/);
  assert.match(block, /entryIds/);
});
