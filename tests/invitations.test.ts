import { describe, expect, it } from "vitest";
import { InvitationService, type InvitationRepository, type InvitationView } from "../src/domain/invitations.js";
import { hashOpaqueToken } from "../src/domain/session.js";
import type { Principal } from "../src/domain/authz.js";

const admin: Principal = { userId: "user", tenantId: "tenant", membershipId: "admin", roles: ["tenant_admin"] };
const employee: Principal = { userId: "employee", tenantId: "tenant", membershipId: "member", roles: ["employee"] };
const invitation: InvitationView = {
  invitationId: "invite",
  tenantSlug: "northstar",
  tenantName: "Northstar Café Group",
  email: "new.person@northstar.example.invalid",
  displayName: "New Person",
  roles: ["employee"],
  expiresAt: "2030-01-03T00:00:00.000Z",
};
let capturedHash = "";
const repository: InvitationRepository = {
  async create(_principal, input) { capturedHash = input.tokenHash; return { ...invitation, expiresAt: input.expiresAt.toISOString() }; },
  async resolve(tokenHash) { return tokenHash === capturedHash ? invitation : undefined; },
  async accept(tokenHash) { return tokenHash === capturedHash ? { tenantSlug: "northstar", email: invitation.email, membershipId: "membership" } : undefined; },
};

describe("membership invitations", () => {
  it("creates only a hashed, expiring one-time setup credential", async () => {
    const service = new InvitationService(repository, 60_000);
    const created = await service.create(admin, { email: " NEW.PERSON@NORTHSTAR.EXAMPLE.INVALID ", displayName: " New Person ", roles: ["employee", "employee"] }, "request", new Date("2030-01-01T00:00:00.000Z"));
    expect(created.email).toBe(invitation.email);
    expect(created.roles).toEqual(["employee"]);
    expect(created.expiresAt).toBe("2030-01-01T00:01:00.000Z");
    expect(created.setupToken).toHaveLength(43);
    expect(capturedHash).toBe(hashOpaqueToken(created.setupToken));
    expect(capturedHash).not.toBe(created.setupToken);
  });

  it("denies invitation creation without membership administration permission", async () => {
    const service = new InvitationService(repository);
    await expect(service.create(employee, { email: invitation.email, displayName: invitation.displayName, roles: ["employee"] }, "request")).rejects.toThrow("access denied");
  });

  it("uses a generic response for unknown, expired, or consumed tokens", async () => {
    const service = new InvitationService(repository);
    await expect(service.inspect("x".repeat(43))).rejects.toThrow("invalid or has expired");
    await expect(service.accept("x".repeat(43), "a-secure-synthetic-password", "request")).rejects.toThrow("invalid or has expired");
  });

  it("retains the synthetic-data gate for preview invitations", async () => {
    const service = new InvitationService(repository);
    await expect(service.create(admin, { email: "real@example.com", displayName: "Real Person", roles: ["employee"] }, "request")).rejects.toThrow("synthetic");
  });
});
