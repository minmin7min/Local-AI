import type { Pool, PoolClient } from "pg";
import { can, type Principal } from "../domain/authz.js";
import type { CertificationStatus, CertificationView, EmployeeOperationsRepository, EmployeeOperationsView, EquipmentView, TrainingStatus, TrainingView } from "../domain/employee-operations.js";
import { withTenantTransaction } from "../domain/tenant-context.js";

function authorizedScope(principal: Principal, values: unknown[]): string {
  if (can(principal, "employee:tenant:read")) return "true";
  if (can(principal, "employee:team:read") && principal.employeeId) {
    values.push(principal.membershipId, principal.employeeId);
    return `(e.membership_id=$2 OR EXISTS(SELECT 1 FROM reporting_relationships rr WHERE rr.tenant_id=e.tenant_id AND rr.report_employee_id=e.id AND rr.manager_employee_id=$3 AND (rr.ends_on IS NULL OR rr.ends_on>=current_date)))`;
  }
  if (can(principal, "employee:self:read")) { values.push(principal.membershipId); return "e.membership_id=$2"; }
  return "false";
}

export class PostgresEmployeeOperationsRepository implements EmployeeOperationsRepository {
  constructor(private readonly pool: Pool) {}
  private async tx<T>(principal: Principal, fn: (client: PoolClient) => Promise<T>): Promise<T> { const client = await this.pool.connect(); try { return await withTenantTransaction(client, principal, () => fn(client)); } finally { client.release(); } }
  private async audit(client: PoolClient, principal: Principal, requestId: string, action: string, resourceType: string, resourceId: string, metadata: object = {}) {
    await client.query(`INSERT INTO audit_events(tenant_id,actor_id,actor_roles,action,resource_type,resource_id,request_id,outcome,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,'success',$8)`, [principal.tenantId, principal.membershipId, principal.roles, action, resourceType, resourceId, requestId, metadata]);
  }
  private async employeeExists(client: PoolClient, employeeId: string): Promise<boolean> { return Boolean((await client.query("SELECT 1 FROM employees WHERE id=$1 AND archived_at IS NULL", [employeeId])).rows[0]); }

  async get(principal: Principal, employeeId: string): Promise<EmployeeOperationsView | undefined> {
    return this.tx(principal, async (client) => {
      const values: unknown[] = [employeeId]; const scope = authorizedScope(principal, values);
      const employee = await client.query(`SELECT 1 FROM employees e WHERE e.id=$1 AND e.archived_at IS NULL AND ${scope}`, values);
      if (!employee.rows[0]) return undefined;
      // A pg PoolClient executes one query at a time. Keep these tenant-scoped reads
      // sequential so the transaction boundary remains explicit and pg 9 compatible.
      const training = await client.query("SELECT id,title,status,due_at::text,completed_at::text FROM employee_training WHERE employee_id=$1 ORDER BY due_at NULLS LAST,title", [employeeId]);
      const certifications = await client.query("SELECT id,certification_type,status,expires_at::text FROM employee_certifications WHERE employee_id=$1 ORDER BY expires_at NULLS LAST,certification_type", [employeeId]);
      const equipment = await client.query("SELECT id,asset_tag,description,assigned_at::text,returned_at::text FROM equipment_assignments WHERE employee_id=$1 ORDER BY assigned_at DESC", [employeeId]);
      return {
        employeeId,
        training: training.rows.map((row): TrainingView => ({ id: row.id, title: row.title, status: row.status, ...(row.due_at ? { dueAt: row.due_at } : {}), ...(row.completed_at ? { completedAt: row.completed_at } : {}) })),
        certifications: certifications.rows.map((row): CertificationView => ({ id: row.id, certificationType: row.certification_type, status: row.status, ...(row.expires_at ? { expiresAt: row.expires_at } : {}) })),
        equipment: equipment.rows.map((row): EquipmentView => ({ id: row.id, assetTag: row.asset_tag, description: row.description, assignedAt: row.assigned_at, ...(row.returned_at ? { returnedAt: row.returned_at } : {}) })),
      };
    });
  }

  async addTraining(principal: Principal, employeeId: string, input: { title: string; status: TrainingStatus; dueAt?: string | undefined }, requestId: string): Promise<TrainingView | undefined> {
    return this.tx(principal, async (client) => {
      if (!(await this.employeeExists(client, employeeId))) return undefined;
      const result = await client.query(`INSERT INTO employee_training(tenant_id,employee_id,title,status,due_at,completed_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $4='completed' THEN now() END) RETURNING id,title,status,due_at::text,completed_at::text`, [principal.tenantId, employeeId, input.title, input.status, input.dueAt ?? null]);
      const row = result.rows[0];
      if (input.dueAt && input.status !== "completed" && input.status !== "waived") await client.query(`INSERT INTO deadlines(tenant_id,employee_id,type,title,due_at,state,source_type,source_id) VALUES($1,$2,'training',$3,$4,'open','employee_training',$5) ON CONFLICT(tenant_id,source_type,source_id) WHERE source_id IS NOT NULL DO UPDATE SET title=excluded.title,due_at=excluded.due_at,state='open',updated_at=now()`, [principal.tenantId, employeeId, input.title, input.dueAt, row.id]);
      await this.audit(client, principal, requestId, "training.create", "employee_training", row.id, { employeeId, status: input.status });
      return { id: row.id, title: row.title, status: row.status, ...(row.due_at ? { dueAt: row.due_at } : {}), ...(row.completed_at ? { completedAt: row.completed_at } : {}) };
    });
  }

  async addCertification(principal: Principal, employeeId: string, input: { certificationType: string; status: CertificationStatus; expiresAt?: string | undefined }, requestId: string): Promise<CertificationView | undefined> {
    return this.tx(principal, async (client) => {
      if (!(await this.employeeExists(client, employeeId))) return undefined;
      const result = await client.query("INSERT INTO employee_certifications(tenant_id,employee_id,certification_type,status,expires_at) VALUES($1,$2,$3,$4,$5) RETURNING id,certification_type,status,expires_at::text", [principal.tenantId, employeeId, input.certificationType, input.status, input.expiresAt ?? null]);
      const row = result.rows[0];
      if (input.expiresAt && input.status !== "revoked") await client.query(`INSERT INTO deadlines(tenant_id,employee_id,type,title,due_at,state,source_type,source_id) VALUES($1,$2,'certification',$3,$4,'open','employee_certification',$5) ON CONFLICT(tenant_id,source_type,source_id) WHERE source_id IS NOT NULL DO UPDATE SET title=excluded.title,due_at=excluded.due_at,state='open',updated_at=now()`, [principal.tenantId, employeeId, `${input.certificationType} renewal`, input.expiresAt, row.id]);
      await this.audit(client, principal, requestId, "certification.create", "employee_certification", row.id, { employeeId, status: input.status });
      return { id: row.id, certificationType: row.certification_type, status: row.status, ...(row.expires_at ? { expiresAt: row.expires_at } : {}) };
    });
  }

  async assignEquipment(principal: Principal, employeeId: string, input: { assetTag: string; description: string; assignedAt: string }, requestId: string): Promise<EquipmentView | undefined> {
    return this.tx(principal, async (client) => {
      if (!(await this.employeeExists(client, employeeId))) return undefined;
      const row = (await client.query("INSERT INTO equipment_assignments(tenant_id,employee_id,asset_tag,description,assigned_at) VALUES($1,$2,$3,$4,$5) RETURNING id,asset_tag,description,assigned_at::text", [principal.tenantId, employeeId, input.assetTag, input.description, input.assignedAt])).rows[0];
      await this.audit(client, principal, requestId, "equipment.assign", "equipment_assignment", row.id, { employeeId, assetTag: input.assetTag });
      return { id: row.id, assetTag: row.asset_tag, description: row.description, assignedAt: row.assigned_at };
    });
  }

  async setManager(principal: Principal, employeeId: string, managerEmployeeId: string, startsOn: string, requestId: string): Promise<boolean> {
    return this.tx(principal, async (client) => {
      if (employeeId === managerEmployeeId || !(await this.employeeExists(client, employeeId)) || !(await this.employeeExists(client, managerEmployeeId))) return false;
      await client.query("UPDATE reporting_relationships SET ends_on=$3::date-1 WHERE report_employee_id=$1 AND ends_on IS NULL AND manager_employee_id<>$2", [employeeId, managerEmployeeId, startsOn]);
      await client.query("INSERT INTO reporting_relationships(tenant_id,manager_employee_id,report_employee_id,starts_on) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [principal.tenantId, managerEmployeeId, employeeId, startsOn]);
      await this.audit(client, principal, requestId, "reporting_relationship.change", "employee", employeeId, { managerEmployeeId, startsOn });
      return true;
    });
  }
}
