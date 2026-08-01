(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinanceCanonicalE9Household = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_ID = "finance-e9-household/v1";
  const ROLES = Object.freeze({
    owner: ["household:read", "household:write", "members:invite", "members:manage", "household:delete"],
    admin: ["household:read", "household:write", "members:invite"],
    member: ["household:read", "household:write"],
    viewer: ["household:read"],
  });
  const SHARED_AREAS = ["planning", "movements", "debts", "goals", "documents", "scenarios"];
  const text = (value) => String(value ?? "").trim();
  const list = (value) => (Array.isArray(value) ? value : []);
  const nowIso = (value) => text(value) || new Date().toISOString();

  function createHousehold(input = {}) {
    const ownerId = text(input.ownerId);
    if (!ownerId) throw new Error("El hogar requiere una persona propietaria.");
    const at = nowIso(input.at);
    return {
      schemaId: SCHEMA_ID,
      id: text(input.id) || `household:${ownerId}`,
      name: text(input.name) || "Hogar",
      revision: 1,
      members: [{ userId: ownerId, role: "owner", status: "active", areas: [...SHARED_AREAS], joinedAt: at, revokedAt: "" }],
      invitations: [],
      events: [{ type: "household-created", actorId: ownerId, at }],
      updatedAt: at,
    };
  }

  function normalize(state) {
    if (state?.schemaId !== SCHEMA_ID) throw new Error("Estado de hogar no compatible.");
    return { ...state, members: list(state.members).map((row) => ({ ...row, areas: [...list(row.areas)] })), invitations: list(state.invitations).map((row) => ({ ...row })), events: list(state.events).map((row) => ({ ...row })) };
  }

  function activeMember(state, userId) {
    return list(state?.members).find((row) => row.userId === text(userId) && row.status === "active") || null;
  }

  function can(state, userId, permission, area) {
    const member = activeMember(state, userId);
    if (!member || !list(ROLES[member.role]).includes(text(permission))) return false;
    return !area || list(member.areas).includes(text(area));
  }

  function event(next, type, actorId, at, details = {}) {
    next.events = [...next.events, { type, actorId, at, details }].slice(-500);
    next.updatedAt = at;
    next.revision += 1;
    return next;
  }

  function assertRevision(state, expectedRevision) {
    if (Number(expectedRevision) !== Number(state.revision)) throw new Error("Otra sesión modificó el hogar; recarga antes de continuar.");
  }

  function invite(state, command = {}) {
    const next = normalize(state);
    assertRevision(next, command.expectedRevision);
    if (!can(next, command.actorId, "members:invite")) throw new Error("No tienes permiso para invitar.");
    const invitationId = text(command.invitationId);
    if (!invitationId) throw new Error("La invitación requiere un identificador generado por el backend.");
    const role = text(command.role) || "member";
    if (!ROLES[role] || role === "owner") throw new Error("Rol de invitación no permitido.");
    const areas = [...new Set(list(command.areas).filter((area) => SHARED_AREAS.includes(area)))];
    if (!areas.length) throw new Error("La invitación requiere al menos un área compartida.");
    const at = nowIso(command.at);
    next.invitations.push({ id: invitationId, role, areas, status: "pending", createdAt: at, expiresAt: text(command.expiresAt), acceptedAt: "" });
    return event(next, "member-invited", text(command.actorId), at, { invitationId, role, areas });
  }

  function acceptInvitation(state, command = {}) {
    const next = normalize(state);
    assertRevision(next, command.expectedRevision);
    const userId = text(command.userId);
    const invitation = next.invitations.find((row) => row.id === text(command.invitationId));
    const at = nowIso(command.at);
    if (!userId || !invitation || invitation.status !== "pending" || (invitation.expiresAt && invitation.expiresAt <= at)) throw new Error("Invitación no válida o caducada.");
    invitation.status = "accepted";
    invitation.acceptedAt = at;
    next.members = [...next.members.filter((row) => row.userId !== userId), { userId, role: invitation.role, status: "active", areas: [...invitation.areas], joinedAt: at, revokedAt: "" }];
    return event(next, "member-joined", userId, at, { invitationId: invitation.id, role: invitation.role, areas: invitation.areas });
  }

  function revokeMember(state, command = {}) {
    const next = normalize(state);
    assertRevision(next, command.expectedRevision);
    if (!can(next, command.actorId, "members:manage")) throw new Error("No tienes permiso para retirar miembros.");
    const targetId = text(command.userId);
    const target = activeMember(next, targetId);
    if (!target || target.role === "owner") throw new Error("No se puede retirar a esa persona.");
    const at = nowIso(command.at);
    target.status = "revoked";
    target.revokedAt = at;
    return event(next, "member-revoked", text(command.actorId), at, { userId: targetId, reason: text(command.reason) });
  }

  return { SCHEMA_ID, ROLES, SHARED_AREAS, acceptInvitation, activeMember, can, createHousehold, invite, revokeMember };
});
