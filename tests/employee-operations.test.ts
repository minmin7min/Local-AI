import { describe, expect, it } from "vitest";
import type { Principal } from "../src/domain/authz.js";
import { EmployeeOperationsService, type EmployeeOperationsRepository } from "../src/domain/employee-operations.js";

const empty = { employeeId: "employee-a", training: [], certifications: [], equipment: [] };
const repository: EmployeeOperationsRepository = {
  async get(principal, employeeId) { return principal.tenantId === "tenant-a" && employeeId === "employee-a" ? empty : undefined; },
  async addTraining(_principal, employeeId, input) { return employeeId === "employee-a" ? { id: "training", title: input.title, status: input.status, ...(input.dueAt ? { dueAt: input.dueAt } : {}) } : undefined; },
  async addCertification() { return undefined; },
  async assignEquipment() { return undefined; },
  async setManager() { return false; },
};
const service = new EmployeeOperationsService(repository);
const employee: Principal = { userId: "user-a", tenantId: "tenant-a", membershipId: "member-a", employeeId: "employee-a", roles: ["employee"] };
const hr: Principal = { userId: "hr-a", tenantId: "tenant-a", membershipId: "hr-member-a", employeeId: "hr-employee-a", roles: ["hr"] };

describe("employee operational records", () => {
  it("does not expose another tenant's employee operations", async () => {
    expect(await service.get(employee, "employee-b")).toBeUndefined();
  });
  it("does not allow an employee to create training records", () => {
    expect(() => service.addTraining(employee, "employee-a", { title: "Safety", status: "not_started" }, "request")).toThrow("access denied");
  });
  it("allows HR to create a normalized training record", async () => {
    const result = await service.addTraining(hr, "employee-a", { title: "Safety", status: "in_progress", dueAt: "2030-04-01T00:00:00.000Z" }, "request");
    expect(result).toMatchObject({ title: "Safety", status: "in_progress" });
  });
});
