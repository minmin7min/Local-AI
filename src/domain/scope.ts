import { AuthorizationError, can, type Principal } from "./authz.js";

export interface EmployeeRef { id: string; tenantId: string; membershipId?: string; managerEmployeeIds?: string[] }
export function authorizeEmployeeRead(principal: Principal, employee: EmployeeRef): void {
  if (employee.tenantId !== principal.tenantId) throw new AuthorizationError();
  if (can(principal, "employee:tenant:read")) return;
  if (can(principal, "employee:self:read") && employee.membershipId === principal.membershipId) return;
  if (can(principal, "employee:team:read") && principal.employeeId && employee.managerEmployeeIds?.includes(principal.employeeId)) return;
  throw new AuthorizationError();
}
export interface DocumentRef { tenantId: string; state: "processing"|"review"|"approved"|"rejected"|"archived"|"failed"; isCurrent: boolean; audienceRoles: string[]; departmentId?: string }
export function authorizeDocumentRead(principal: Principal, document: DocumentRef, departmentId?: string): void {
  if (document.tenantId !== principal.tenantId) throw new AuthorizationError();
  if (can(principal, "document:manage")) return;
  if (!can(principal, "document:read") || document.state !== "approved" || !document.isCurrent) throw new AuthorizationError();
  if (!principal.roles.some((role) => document.audienceRoles.includes(role))) throw new AuthorizationError();
  if (document.departmentId && document.departmentId !== departmentId) throw new AuthorizationError();
}
export function tenantCacheKey(tenantId: string, namespace: string, id: string): string {
  if (!tenantId || !namespace || !id) throw new Error("Tenant cache keys require all components");
  return `tenant:${tenantId}:${namespace}:${id}`;
}
export function requireJobTenant(payload: Record<string, unknown>): string {
  if (typeof payload.tenantId !== "string" || payload.tenantId.length < 1) throw new Error("Background job is missing tenant context");
  return payload.tenantId;
}
