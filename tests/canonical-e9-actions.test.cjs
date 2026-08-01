const assert = require("node:assert/strict");
const test = require("node:test");
const actions = require("../canonical-e9-actions.js");
const context = { sources: [{ id: "metric:cash" }, { id: "decision:debt-1" }] };
test("solo prepara acciones de un catálogo cerrado", () => {
  assert.throws(() => actions.prepareDraft({ action: "transfer-money", params: {}, citations: ["metric:cash"] }, context), /no permitida/);
  const draft = actions.prepareDraft({ action: "adjust-reserve", params: { amount: 2500, ignored: "x" }, citations: ["metric:cash"] }, context);
  assert.deepEqual(draft.params, { amount: 2500 }); assert.equal(draft.writesImmediately, false);
});
test("rechaza fuentes inventadas, campos ausentes y ejecución embebida", () => {
  assert.throws(() => actions.prepareDraft({ action: "adjust-reserve", params: { amount: 1 }, citations: ["metric:fake"] }, context), /fuentes internas/);
  assert.throws(() => actions.prepareDraft({ action: "prepare-project", params: { name: "Coche" }, citations: ["metric:cash"] }, context), /Faltan campos/);
  assert.throws(() => actions.prepareDraft({ action: "adjust-reserve", params: { amount: 1, execute: true }, citations: ["metric:cash"] }, context), /Campo prohibido/);
});
test("la vista previa muestra antes y después sin escribir", () => {
  const draft = actions.prepareDraft({ id: "draft-1", action: "adjust-reserve", params: { amount: 3000 }, citations: ["metric:cash"] }, context);
  const preview = actions.buildPreview(draft, { reserve: 2500 });
  assert.deepEqual(preview.before, { amount: 2500 }); assert.deepEqual(preview.after, { amount: 3000 }); assert.equal(preview.writesImmediately, false);
});
test("un importe de deuda superior al capital bloquea la confirmación", () => {
  const draft = actions.prepareDraft({ id: "draft-1", action: "prepare-debt-payment", params: { debtId: "debt-1", amount: 2000 }, citations: ["decision:debt-1"] }, context);
  const preview = actions.buildPreview(draft, { debt: { id: "debt-1", currentPrincipal: 1000 } });
  assert.equal(preview.valid, false); assert.throws(() => actions.confirmDraft(draft, preview, { userConfirmed: true, reason: "Revisado" }), /no es válida/);
});
test("confirmar exige gesto externo y motivo y todavía no ejecuta", () => {
  const draft = actions.prepareDraft({ id: "draft-1", action: "adjust-reserve", params: { amount: 3000 }, citations: ["metric:cash"] }, context);
  const preview = actions.buildPreview(draft, { reserve: 2500 });
  assert.throws(() => actions.confirmDraft(draft, preview, { reason: "Revisado" }), /fuera de la conversación/);
  assert.throws(() => actions.confirmDraft(draft, preview, { userConfirmed: true }), /motivo/);
  const result = actions.confirmDraft(draft, preview, { userConfirmed: true, reason: "Protección de caja", at: "2026-08-01T13:00:00Z" });
  assert.equal(result.draft.status, "confirmed"); assert.equal(result.handoff.requiresCanonicalHandler, true); assert.equal(result.handoff.executed, false);
});
test("cancelar conserva el borrador y su motivo", () => {
  const draft = actions.prepareDraft({ id: "draft-1", action: "adjust-reserve", params: { amount: 3000 }, citations: ["metric:cash"] }, context);
  const cancelled = actions.cancelDraft(draft, { reason: "No procede", at: "2026-08-01T13:00:00Z" });
  assert.equal(cancelled.status, "cancelled"); assert.equal(cancelled.cancellationReason, "No procede");
});
