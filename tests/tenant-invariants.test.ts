import{describe,expect,it}from"vitest";import{AuthorizationError,type Principal}from"../src/domain/authz.js";import{authorizeDocumentRead,authorizeEmployeeRead,requireJobTenant,tenantCacheKey}from"../src/domain/scope.js";import{deadlineScope}from"../src/domain/operations.js";
const a:Principal={userId:"same-user",tenantId:"tenant-a",membershipId:"member-a",employeeId:"employee-a",roles:["employee"]};
describe("release blocking isolation matrix",()=>{
 it("blocks Tenant B employee reads",()=>expect(()=>authorizeEmployeeRead(a,{id:"same",tenantId:"tenant-b",membershipId:"member-a"})).toThrow(AuthorizationError));
 it("blocks another employee in the same tenant",()=>expect(()=>authorizeEmployeeRead(a,{id:"other",tenantId:"tenant-a",membershipId:"other"})).toThrow(AuthorizationError));
 it("blocks cross-tenant approved document identifiers",()=>expect(()=>authorizeDocumentRead(a,{tenantId:"tenant-b",state:"approved",isCurrent:true,audienceRoles:["employee"]})).toThrow(AuthorizationError));
 it("blocks superseded document versions",()=>expect(()=>authorizeDocumentRead(a,{tenantId:"tenant-a",state:"approved",isCurrent:false,audienceRoles:["employee"]})).toThrow(AuthorizationError));
 it("blocks unapproved retrieval chunks",()=>expect(()=>authorizeDocumentRead(a,{tenantId:"tenant-a",state:"review",isCurrent:false,audienceRoles:["employee"]})).toThrow(AuthorizationError));
 it("requires tenant-bearing worker payloads",()=>expect(()=>requireJobTenant({documentVersionId:"same"})).toThrow());
 it("prevents cache collisions for intentionally identical IDs",()=>expect(tenantCacheKey("tenant-a","chat","same")).not.toBe(tenantCacheKey("tenant-b","chat","same")));
 it("does not grant platform or tenant operators implicit employee content",()=>expect(deadlineScope({userId:"platform",tenantId:"tenant-a",membershipId:"operator",roles:["tenant_admin"]})).toBe("none"));
 it("does not treat owner as document administrator",()=>expect(()=>authorizeDocumentRead({...a,roles:["owner"]},{tenantId:"tenant-a",state:"review",isCurrent:false,audienceRoles:["owner"]})).toThrow());
 it("has no client tenant argument in employee authorization",()=>{expect(authorizeEmployeeRead.length).toBe(2);});
});
