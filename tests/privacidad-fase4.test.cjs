// Privacidad, fase 4 (D-N26, «claves neutras con migración probada»; docs/PRIVACIDAD_NOMBRES.md): las claves internas de las dos
// personas pasan a «p1»/«p2». Lo guardado antes (datos, copias antiguas, la nube) lleva la clave de siempre de cada una: se tiene
// que leer igual y dar las mismas cifras. Esta prueba no escribe esas claves: las reconstruye de base64, como privacidad-nombres.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");
const miembros = require("./helpers/miembros.cjs");
const H = require("../canonical-household-split.js");
const M = require("../household-members.js");

const [K1, K2] = ["SmF2aQ==", "VGVyZQ=="].map((b) => Buffer.from(b, "base64").toString("utf8").toLowerCase());
const app = codigoApp();
const extract = (name) => {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return app.slice(start, app.indexOf("\n}\n", start) + 2);
};

test("fase 4 · las ayudas leen las dos formas: «p1»/«p2» y la clave de siempre (por su huella)", () => {
  assert.equal(M.valor({ [K1]: 3000, [K2]: 1000 }, "p1"), 3000);
  assert.equal(M.valor({ p2: 1200, [K2]: 1000 }, "p2"), 1200, "la nueva manda si están las dos");
  assert.equal(M.valorSufijo({ [`${K2}ConfirmedAt`]: "2026-11-01" }, "p2", "ConfirmedAt"), "2026-11-01");
  assert.equal(M.valorSufijo({ p1ConfirmedAt: "2026-11-02" }, "p1", "ConfirmedAt"), "2026-11-02");
  assert.equal(M.persona(K1), "p1");
  assert.equal(M.persona("household", "hogar"), "hogar");
});

// 4a · el reparto de gastos compartidos (A18) y la separación patrimonial (GOB19).
const legado = {
  settings: { incomes: { [K1]: 3000, [K2]: 1000 }, defaultRule: { mode: "income-proportional", payer: K1 }, categoryRules: { Ocio: { mode: "fixed", payer: K2, amount: 30 } } },
  entries: [
    { id: "a", amount: 100, paidBy: K1, category: "Casa" },
    { id: "b", amount: 80, paidBy: K2, category: "Ocio" },
    { id: "c", amount: 40, paidBy: K2, category: "" },
  ],
};
const neutro = {
  settings: { incomes: { p1: 3000, p2: 1000 }, defaultRule: { mode: "income-proportional", payer: "p1" }, categoryRules: { Ocio: { mode: "fixed", payer: "p2", amount: 30 } } },
  entries: legado.entries.map((entry) => ({ ...entry, paidBy: entry.paidBy === K1 ? "p1" : "p2" })),
};

test("fase 4a · ida y vuelta del reparto: lo guardado con la clave de siempre da el mismo saldo, la misma propuesta y la misma liquidación", () => {
  const antes = H.runningBalance(legado.entries, legado.settings);
  const ahora = H.runningBalance(neutro.entries, neutro.settings);
  assert.deepEqual(antes, ahora);
  assert.equal(ahora.owes, "p1");
  assert.equal(ahora.amount, 55); // la persona 2 debe 25 (¼ de 100); la persona 1, 50 (Ocio: la 2 aporta 30 de 80) y 30 (¾ de 40)
  assert.deepEqual(H.proposeSettlement(legado.entries, legado.settings), H.proposeSettlement(neutro.entries, neutro.settings));
  // Una confirmación a medias guardada antes, con la clave de siempre, cuenta; el resultado ya sale con «p1»/«p2».
  const propuesta = H.proposeSettlement(neutro.entries, neutro.settings);
  const confirmada = H.confirmSettlement(propuesta, { [K1]: true, p2: true }, { [`${K1}ConfirmedAt`]: "2026-11-01T10:00:00Z", p2ConfirmedAt: "2026-11-02T10:00:00Z", confirmedAt: "2026-11-02T10:00:00Z", id: "s1" });
  assert.equal(confirmada.status, "confirmed");
  assert.equal(confirmada.p1ConfirmedAt, "2026-11-01T10:00:00Z");
  assert.equal(confirmada.p2ConfirmedAt, "2026-11-02T10:00:00Z");
  assert.deepEqual(Object.keys(confirmada).filter((key) => M.clave(key.replace(/ConfirmedAt$/, "")) && !key.startsWith("p")), [], "no escribe la clave de siempre");
  assert.deepEqual(H.confirmSettlement(propuesta, { [K2]: true }).missing, ["p1"]);
});

test("fase 4a · la app: los ajustes guardados con la clave de siempre se leen igual (y se guardarán con «p1»/«p2»)", () => {
  const context = { ...miembros, window: { FinanceCanonicalHouseholdSplit: H }, scenarioSettings: { householdSplit: legado.settings } };
  vm.createContext(context);
  vm.runInContext(extract("householdSplitSettings"), context);
  const settings = context.householdSplitSettings();
  assert.deepEqual(JSON.parse(JSON.stringify(settings.incomes)), { p1: 3000, p2: 1000 });
  assert.equal(settings.defaultRule.payer, "p1");
  // Las mismas cifras que con los ajustes nuevos.
  assert.deepEqual(H.runningBalance(neutro.entries, settings), H.runningBalance(neutro.entries, neutro.settings));
});

test("fase 4a · la separación patrimonial agrupa por persona tanto la titularidad de siempre como la nueva", () => {
  for (const fn of ["gob19DebtsByOwner", "di5ProposalsByOwner"]) {
    const body = extract(fn);
    assert.match(body, /const grouped = \{ p1: \[\], p2: \[\], household: \[\] \};/, fn);
    assert.match(body, /memberKey\(ownerByContractId\.get\([a-z]+\.id\)\) \|\| "household"/, fn);
  }
  // Ninguna clave de siempre en el reparto ni en la separación (ni en el motor).
  const motor = require("node:fs").readFileSync(require.resolve("../canonical-household-split.js"), "utf8");
  const palabra = new RegExp(`\\b(${K1}|${K2})`, "i");
  assert.doesNotMatch(motor, palabra);
  ["householdSplitSettings", "saveA18Incomes", "saveA18Entry", "confirmA18Settlement", "renderA18SettlementCard", "gob19DebtsByOwner", "di5ProposalsByOwner"].forEach((fn) => assert.doesNotMatch(extract(fn), palabra, fn));
});
