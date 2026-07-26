import { requirePermission, type Principal } from "./authz.js";

export type TrainingStatus = "not_started" | "in_progress" | "completed" | "waived";
export type CertificationStatus = "valid" | "expiring" | "expired" | "revoked";
export interface TrainingView { id: string; title: string; status: TrainingStatus; dueAt?: string; completedAt?: string }
export interface CertificationView { id: string; certificationType: string; status: CertificationStatus; expiresAt?: string }
export interface EquipmentView { id: string; assetTag: string; description: string; assignedAt: string; returnedAt?: string }
export interface EmployeeOperationsView { employeeId: string; training: TrainingView[]; certifications: CertificationView[]; equipment: EquipmentView[] }

export interface EmployeeOperationsRepository {
  get(principal: Principal, employeeId: string): Promise<EmployeeOperationsView | undefined>;
  addTraining(principal: Principal, employeeId: string, input: { title: string; status: TrainingStatus; dueAt?: string | undefined }, requestId: string): Promise<TrainingView | undefined>;
  addCertification(principal: Principal, employeeId: string, input: { certificationType: string; status: CertificationStatus; expiresAt?: string | undefined }, requestId: string): Promise<CertificationView | undefined>;
  assignEquipment(principal: Principal, employeeId: string, input: { assetTag: string; description: string; assignedAt: string }, requestId: string): Promise<EquipmentView | undefined>;
  setManager(principal: Principal, employeeId: string, managerEmployeeId: string, startsOn: string, requestId: string): Promise<boolean>;
}

export class EmployeeOperationsService {
  constructor(private readonly repository: EmployeeOperationsRepository) {}
  get(principal: Principal, employeeId: string) { return this.repository.get(principal, employeeId); }
  addTraining(principal: Principal, employeeId: string, input: { title: string; status: TrainingStatus; dueAt?: string | undefined }, requestId: string) {
    requirePermission(principal, "employee:write"); return this.repository.addTraining(principal, employeeId, input, requestId);
  }
  addCertification(principal: Principal, employeeId: string, input: { certificationType: string; status: CertificationStatus; expiresAt?: string | undefined }, requestId: string) {
    requirePermission(principal, "employee:write"); return this.repository.addCertification(principal, employeeId, input, requestId);
  }
  assignEquipment(principal: Principal, employeeId: string, input: { assetTag: string; description: string; assignedAt: string }, requestId: string) {
    requirePermission(principal, "employee:write"); return this.repository.assignEquipment(principal, employeeId, input, requestId);
  }
  setManager(principal: Principal, employeeId: string, managerEmployeeId: string, startsOn: string, requestId: string) {
    requirePermission(principal, "employee:write"); return this.repository.setManager(principal, employeeId, managerEmployeeId, startsOn, requestId);
  }
}
