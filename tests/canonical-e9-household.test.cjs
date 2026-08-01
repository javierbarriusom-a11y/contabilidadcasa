const assert = require("node:assert/strict");
const test = require("node:test");
const household = require("../canonical-e9-household.js");

test("el propietario nace con control y las demás personas sin acceso", () => {
  const state = household.createHousehold({ ownerId: "javi", at: "2026-08-01T10:00:00Z" });
  assert.equal(household.can(state, "javi", "members:manage"), true);
  assert.equal(household.can(state, "tere", "household:read"), false);
});

test("invitar y aceptar comparte solo las áreas autorizadas", () => {
  const initial = household.createHousehold({ ownerId: "javi", at: "2026-08-01T10:00:00Z" });
  const invited = household.invite(initial, { actorId: "javi", expectedRevision: 1, invitationId: "invite-1", role: "member", areas: ["planning", "goals", "invalid"], expiresAt: "2026-08-02T10:00:00Z", at: "2026-08-01T11:00:00Z" });
  const accepted = household.acceptInvitation(invited, { userId: "tere", invitationId: "invite-1", expectedRevision: 2, at: "2026-08-01T12:00:00Z" });
  assert.equal(household.can(accepted, "tere", "household:write", "planning"), true);
  assert.equal(household.can(accepted, "tere", "household:write", "debts"), false);
});

test("una invitación caducada no concede acceso", () => {
  const initial = household.createHousehold({ ownerId: "javi" });
  const invited = household.invite(initial, { actorId: "javi", expectedRevision: 1, invitationId: "invite-1", role: "viewer", areas: ["planning"], expiresAt: "2026-08-01T10:00:00Z", at: "2026-08-01T09:00:00Z" });
  assert.throws(() => household.acceptInvitation(invited, { userId: "tere", invitationId: "invite-1", expectedRevision: 2, at: "2026-08-01T11:00:00Z" }), /caducada/);
});

test("revocar acceso es inmediato, auditable y no permite retirar al propietario", () => {
  let state = household.createHousehold({ ownerId: "javi", at: "2026-08-01T10:00:00Z" });
  state = household.invite(state, { actorId: "javi", expectedRevision: 1, invitationId: "invite-1", role: "member", areas: ["planning"], at: "2026-08-01T11:00:00Z" });
  state = household.acceptInvitation(state, { userId: "tere", invitationId: "invite-1", expectedRevision: 2, at: "2026-08-01T12:00:00Z" });
  state = household.revokeMember(state, { actorId: "javi", userId: "tere", expectedRevision: 3, reason: "Solicitud", at: "2026-08-01T13:00:00Z" });
  assert.equal(household.can(state, "tere", "household:read"), false);
  assert.equal(state.events.at(-1).type, "member-revoked");
  assert.throws(() => household.revokeMember(state, { actorId: "javi", userId: "javi", expectedRevision: 4 }), /No se puede retirar/);
});

test("el control de revisión bloquea una segunda sesión obsoleta", () => {
  const initial = household.createHousehold({ ownerId: "javi" });
  const changed = household.invite(initial, { actorId: "javi", expectedRevision: 1, invitationId: "invite-1", role: "viewer", areas: ["planning"] });
  assert.equal(changed.revision, 2);
  assert.throws(() => household.invite(changed, { actorId: "javi", expectedRevision: 1, invitationId: "invite-2", role: "viewer", areas: ["goals"] }), /Otra sesión/);
});
