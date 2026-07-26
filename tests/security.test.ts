import { describe, expect, it } from "vitest";
import { authorizeDocumentRead, authorizeEmployeeRead, requireJobTenant, tenantCacheKey } from "../src/domain/scope.js";
import { AuthorizationError, type Principal } from "../src/domain/authz.js";
const employeeA: Principal = { userId:"u1",tenantId:"tenant-a",membershipId:"m1",employeeId:"e1",roles:["employee"] };
const managerA: Principal = { userId:"u2",tenantId:"tenant-a",membershipId:"m2",employeeId:"manager-a",roles:["manager"] };

describe("release-blocking tenant invariants", () => {
  it("denies cross-tenant employee reads even when identifiers are known", () => {
    expect(() => authorizeEmployeeRead(employeeA,{id:"same-id",tenantId:"tenant-b",membershipId:"m1"})).toThrow(AuthorizationError);
  });
  it("allows employees only their linked profile", () => {
    expect(() => authorizeEmployeeRead(employeeA,{id:"e1",tenantId:"tenant-a",membershipId:"m1"})).not.toThrow();
    expect(() => authorizeEmployeeRead(employeeA,{id:"e2",tenantId:"tenant-a",membershipId:"m2"})).toThrow();
  });
  it("allows managers only direct reports", () => {
    expect(() => authorizeEmployeeRead(managerA,{id:"e2",tenantId:"tenant-a",managerEmployeeIds:["manager-a"]})).not.toThrow();
    expect(() => authorizeEmployeeRead(managerA,{id:"e3",tenantId:"tenant-a",managerEmployeeIds:["other"]})).toThrow();
  });
  it("denies cross-tenant, unapproved, superseded and wrong-audience documents", () => {
    const base = {tenantId:"tenant-a",state:"approved" as const,isCurrent:true,audienceRoles:["employee"]};
    expect(() => authorizeDocumentRead(employeeA,base)).not.toThrow();
    expect(() => authorizeDocumentRead(employeeA,{...base,tenantId:"tenant-b"})).toThrow();
    expect(() => authorizeDocumentRead(employeeA,{...base,state:"review"})).toThrow();
    expect(() => authorizeDocumentRead(employeeA,{...base,isCurrent:false})).toThrow();
    expect(() => authorizeDocumentRead(employeeA,{...base,audienceRoles:["hr"]})).toThrow();
  });
  it("namespaces cache entries and requires tenant-aware jobs", () => {
    expect(tenantCacheKey("a","chat","same")).not.toBe(tenantCacheKey("b","chat","same"));
    expect(() => requireJobTenant({documentId:"d"})).toThrow();
    expect(requireJobTenant({tenantId:"a"})).toBe("a");
  });
});
