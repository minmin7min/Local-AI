export const roles = ["employee", "manager", "hr", "owner", "tenant_admin"] as const;
export type Role = (typeof roles)[number];
export type Action =
  | "employee:self:read" | "employee:team:read" | "employee:tenant:read" | "employee:write"
  | "document:read" | "document:manage" | "import:manage" | "deadline:self:read"
  | "deadline:team:read" | "deadline:tenant:read" | "audit:read" | "membership:manage";

const grants: Record<Role, ReadonlySet<Action>> = {
  employee: new Set(["employee:self:read", "document:read", "deadline:self:read"]),
  manager: new Set(["employee:self:read", "employee:team:read", "document:read", "deadline:self:read", "deadline:team:read"]),
  hr: new Set(["employee:self:read", "employee:tenant:read", "employee:write", "document:read", "import:manage", "deadline:tenant:read"]),
  owner: new Set(["employee:self:read", "employee:tenant:read", "document:read", "deadline:tenant:read", "membership:manage"]),
  tenant_admin: new Set(["document:read", "document:manage", "import:manage", "audit:read", "membership:manage"]),
};

export interface Principal { userId: string; tenantId: string; membershipId: string; roles: Role[]; employeeId?: string }
export function can(principal: Principal, action: Action): boolean {
  return principal.roles.some((role) => grants[role].has(action));
}
export function requirePermission(principal: Principal, action: Action): void {
  if (!can(principal, action)) throw new AuthorizationError();
}
export class AuthorizationError extends Error {
  readonly statusCode = 404;
  constructor() { super("Resource not found or access denied"); }
}
