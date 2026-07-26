import { describe, expect, it } from "vitest";
import { AdministrationService, type AdminRepository, type MemberView, type TenantSettingsView } from "../src/domain/administration.js";
import type { Principal, Role } from "../src/domain/authz.js";

const settings: TenantSettingsView = { name: "Northstar Café Group", timezone: "America/Vancouver", retentionDays: 2555, reminderDays: [30, 60, 90], inAppNotifications: true, emailNotifications: false, syntheticOnly: true };
const members: MemberView[] = [{ membershipId: "admin", userId: "user", email: "admin@northstar.example.invalid", displayName: "Synthetic Admin", roles: ["tenant_admin"] }];
let lastReminderDays: number[] | undefined;
const repository: AdminRepository = {
  async listMembers() { return members; },
  async createMember(_principal, input) { return { membershipId: "new", userId: "new-user", email: input.email, displayName: input.displayName, roles: input.roles }; },
  async replaceRoles(_principal, membershipId, nextRoles) { return { ...members[0]!, membershipId, roles: nextRoles }; },
  async deactivateMember() { return true; },
  async getSettings() { return settings; },
  async updateSettings(_principal, input) { lastReminderDays = input.reminderDays; return { ...settings, name: input.name ?? settings.name, timezone: input.timezone ?? settings.timezone, retentionDays: input.retentionDays ?? settings.retentionDays, reminderDays: input.reminderDays ?? settings.reminderDays, inAppNotifications: input.inAppNotifications ?? settings.inAppNotifications }; },
};
const service = new AdministrationService(repository);
const admin: Principal = { userId: "user", tenantId: "tenant", membershipId: "admin", roles: ["tenant_admin"] };
const employee: Principal = { userId: "employee-user", tenantId: "tenant", membershipId: "employee", roles: ["employee"] };

describe("tenant administration", () => {
  it("denies membership administration without the server-side permission", async () => {
    expect(() => service.listMembers(employee)).toThrow("access denied");
  });

  it("enforces synthetic-only email addresses", async () => {
    await expect(service.createMember(admin, { email: "real@example.com", displayName: "Not Synthetic", password: "a-long-temporary-password", roles: ["employee"] }, "request")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("prevents self-deactivation", async () => {
    expect(() => service.deactivateMember(admin, "admin", "request")).toThrow("cannot deactivate");
  });

  it("deduplicates and orders reminder windows", async () => {
    await service.updateSettings(admin, { reminderDays: [90, 30, 60, 30] }, "request");
    expect(lastReminderDays).toEqual([30, 60, 90]);
  });

  it("requires at least one role", async () => {
    expect(() => service.replaceRoles(admin, "member", [] as Role[], "request")).toThrow("At least one valid role");
  });
});
