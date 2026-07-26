import { requirePermission, roles, type Principal, type Role } from "./authz.js";
import { hashPassword } from "./session.js";

export interface MemberView {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string;
  roles: Role[];
  deactivatedAt?: string;
}

export interface TenantSettingsView {
  name: string;
  timezone: string;
  retentionDays: number;
  reminderDays: number[];
  inAppNotifications: boolean;
  emailNotifications: boolean;
  syntheticOnly: boolean;
  updatedAt?: string;
}

export interface AdminRepository {
  listMembers(principal: Principal): Promise<MemberView[]>;
  createMember(principal: Principal, input: { email: string; displayName: string; passwordHash: string; roles: Role[] }, requestId: string): Promise<MemberView>;
  replaceRoles(principal: Principal, membershipId: string, nextRoles: Role[], requestId: string): Promise<MemberView | undefined>;
  deactivateMember(principal: Principal, membershipId: string, requestId: string): Promise<boolean>;
  getSettings(principal: Principal): Promise<TenantSettingsView>;
  updateSettings(principal: Principal, input: { name?: string | undefined; timezone?: string | undefined; retentionDays?: number | undefined; reminderDays?: number[] | undefined; inAppNotifications?: boolean | undefined }, requestId: string): Promise<TenantSettingsView>;
}

export class AdminInputError extends Error {
  constructor(message: string, readonly statusCode = 400) { super(message); }
}

function normalizedRoles(input: Role[]): Role[] {
  const result = [...new Set(input)];
  if (result.length === 0 || result.some((role) => !roles.includes(role))) throw new AdminInputError("At least one valid role is required");
  return result;
}

export class AdministrationService {
  constructor(private readonly repository: AdminRepository) {}

  listMembers(principal: Principal) {
    requirePermission(principal, "membership:manage");
    return this.repository.listMembers(principal);
  }

  async createMember(principal: Principal, input: { email: string; displayName: string; password: string; roles: Role[] }, requestId: string) {
    requirePermission(principal, "membership:manage");
    const email = input.email.trim().toLowerCase();
    if (!email.endsWith(".example.invalid")) throw new AdminInputError("This preview accepts synthetic .example.invalid accounts only");
    const passwordHash = await hashPassword(input.password);
    return this.repository.createMember(principal, { email, displayName: input.displayName.trim(), passwordHash, roles: normalizedRoles(input.roles) }, requestId);
  }

  replaceRoles(principal: Principal, membershipId: string, nextRoles: Role[], requestId: string) {
    requirePermission(principal, "membership:manage");
    return this.repository.replaceRoles(principal, membershipId, normalizedRoles(nextRoles), requestId);
  }

  deactivateMember(principal: Principal, membershipId: string, requestId: string) {
    requirePermission(principal, "membership:manage");
    if (membershipId === principal.membershipId) throw new AdminInputError("You cannot deactivate your own active membership", 409);
    return this.repository.deactivateMember(principal, membershipId, requestId);
  }

  getSettings(principal: Principal) {
    requirePermission(principal, "membership:manage");
    return this.repository.getSettings(principal);
  }

  updateSettings(principal: Principal, input: { name?: string | undefined; timezone?: string | undefined; retentionDays?: number | undefined; reminderDays?: number[] | undefined; inAppNotifications?: boolean | undefined }, requestId: string) {
    requirePermission(principal, "membership:manage");
    const reminderDays = input.reminderDays ? [...new Set(input.reminderDays)].sort((a, b) => a - b) : undefined;
    return this.repository.updateSettings(principal, { ...input, ...(reminderDays ? { reminderDays } : {}) }, requestId);
  }
}
