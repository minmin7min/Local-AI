import {describe,expect,it} from "vitest";
import {EmployeeService,type EmployeeRepository,type EmployeeView} from "../src/domain/employees.js";
import type {Principal} from "../src/domain/authz.js";
const employees:EmployeeView[]=[
 {id:"same",tenantId:"a",membershipId:"ma",internalEmployeeId:"A-1",displayName:"Avery Morgan",workEmail:"a@a.invalid",departmentId:"da",departmentName:"Ops",position:"Associate",employmentStatus:"active",employmentCategory:"full_time",startDate:"2030-01-01",onboardingStatus:"complete",offboardingStatus:"not_started",updatedAt:"2030-01-01T00:00:00Z",managerEmployeeIds:["manager-a"]},
 {id:"same",tenantId:"b",membershipId:"mb",internalEmployeeId:"B-1",displayName:"Avery Morgan",workEmail:"a@b.invalid",departmentId:"db",departmentName:"Ops",position:"Associate",employmentStatus:"active",employmentCategory:"full_time",startDate:"2030-01-01",onboardingStatus:"complete",offboardingStatus:"not_started",updatedAt:"2030-01-01T00:00:00Z",managerEmployeeIds:["manager-b"]}
];
const repo:EmployeeRepository={async listAuthorized(p){return employees.filter(e=>e.tenantId===p.tenantId);},async findById(p,id){return employees.find(e=>e.tenantId===p.tenantId&&e.id===id);},async update(){return undefined;}};
const service=new EmployeeService(repo); const employee:Principal={userId:"ua",tenantId:"a",membershipId:"ma",employeeId:"same",roles:["employee"]};
describe("employee service",()=>{
 it("returns only the tenant-scoped linked employee and strips authorization metadata",async()=>{const result=await service.get(employee,"same");expect(result?.workEmail).toBe("a@a.invalid");expect(result).not.toHaveProperty("tenantId");expect(result).not.toHaveProperty("managerEmployeeIds");});
 it("does not allow employees to update records",async()=>{await expect(service.update(employee,"same",{position:"Manager",expectedVersion:1})).rejects.toThrow();});
});
