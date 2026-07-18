const test = require("node:test");
const assert = require("node:assert/strict");
const workflow = require("../canonical-workflow.js");

function imported(status = "pending") {
  return workflow.importDecision(workflow.createWorkflowSnapshot(), {
    id: "project-1",
    source: "project",
    name: "Coche",
    amount: 25000,
    status,
  }).snapshot;
}

test("importar la misma decisión no crea duplicados", () => {
  const first = workflow.importDecision(workflow.createWorkflowSnapshot(), { id: "debt-1", source: "debt", name: "Wizink" });
  const second = workflow.importDecision(first.snapshot, { id: "debt-1", source: "debt", name: "Wizink actualizada" });
  assert.equal(second.snapshot.decisions.length, 1);
  assert.equal(second.decision.name, "Wizink actualizada");
  assert.equal(second.snapshot.events.length, 2);
  assert.equal(second.snapshot.events[1].before.name, "Wizink");
  assert.equal(second.snapshot.events[1].after.name, "Wizink actualizada");
});

test("reimportar el mismo contenido es idempotente y no ensucia el registro", () => {
  const first = workflow.importDecision(workflow.createWorkflowSnapshot(), { id: "debt-1", source: "debt", name: "Wizink" });
  const second = workflow.importDecision(first.snapshot, { id: "debt-1", source: "debt", name: "Wizink" });
  assert.equal(second.idempotent, true);
  assert.equal(second.decision.revision, 1);
  assert.equal(second.snapshot.events.length, 1);
  assert.equal(second.snapshot.events[0].type, "import");
  assert.equal(second.snapshot.events[0].before, null);
  assert.equal(second.snapshot.events[0].after.name, "Wizink");
});

test("la ruta aprobada, fija y ejecutada queda auditada", () => {
  let snapshot = imported("pending");
  for (const [index, toStatus] of ["approved", "fixed", "executed"].entries()) {
    const result = workflow.applyDecisionCommand(snapshot, {
      id: `command-${index}`,
      type: "transition",
      decisionId: "project-1",
      toStatus,
      at: `2026-07-1${index}T10:00:00.000Z`,
    });
    assert.equal(result.ok, true);
    snapshot = result.snapshot;
  }
  assert.equal(snapshot.decisions[0].status, "executed");
  assert.deepEqual(
    snapshot.events.filter((event) => event.type === "transition").map((event) => event.toStatus),
    ["approved", "fixed", "executed"]
  );
  assert.equal(workflow.decisionAffectsPlan("executed"), false);
});

test("no permite ejecutar una decisión sin fijarla", () => {
  const result = workflow.applyDecisionCommand(imported("approved"), {
    id: "invalid-execute",
    type: "transition",
    decisionId: "project-1",
    toStatus: "executed",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "invalid-transition");
});

test("un comando repetido es idempotente", () => {
  const command = { id: "approve-once", type: "transition", decisionId: "project-1", toStatus: "approved" };
  const first = workflow.applyDecisionCommand(imported("pending"), command);
  const second = workflow.applyDecisionCommand(first.snapshot, command);
  assert.equal(second.ok, true);
  assert.equal(second.idempotent, true);
  assert.equal(second.snapshot.events.filter((event) => event.type === "transition").length, 1);
});

test("cancelar conserva la decisión y permite devolverla a pendiente", () => {
  const cancelled = workflow.applyDecisionCommand(imported("approved"), {
    id: "cancel",
    type: "transition",
    decisionId: "project-1",
    toStatus: "cancelled",
  });
  const restored = workflow.applyDecisionCommand(cancelled.snapshot, {
    id: "restore",
    type: "transition",
    decisionId: "project-1",
    toStatus: "pending",
  });
  assert.equal(restored.ok, true);
  assert.equal(restored.decision.status, "pending");
  assert.equal(restored.snapshot.decisions.length, 1);
});

test("amend incrementa revisión sin alterar estado", () => {
  const result = workflow.applyDecisionCommand(imported("approved"), {
    id: "amend-1",
    type: "amend",
    decisionId: "project-1",
    changes: { amount: 18000, monthKey: "2026-12" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.decision.amount, 18000);
  assert.equal(result.decision.status, "approved");
  assert.equal(result.decision.revision, 2);
  assert.equal(result.event.before.amount, 25000);
  assert.equal(result.event.after.amount, 18000);
});

test("amend sin cambio es idempotente y conserva la revisión", () => {
  const result = workflow.applyDecisionCommand(imported("approved"), {
    id: "amend-noop",
    type: "amend",
    decisionId: "project-1",
    changes: { amount: 25000 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.idempotent, true);
  assert.equal(result.decision.revision, 1);
  assert.equal(result.snapshot.events.length, 1);
});

test("solo aprobado y fijo afectan al plan", () => {
  assert.equal(workflow.decisionAffectsPlan("approved"), true);
  assert.equal(workflow.decisionAffectsPlan("fixed"), true);
  assert.equal(workflow.decisionAffectsPlan("simulated"), false);
  assert.equal(workflow.decisionAffectsPlan("executed"), false);
  assert.equal(workflow.decisionAffectsPlan("cancelled"), false);
});
