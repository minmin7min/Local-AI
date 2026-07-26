import type { Pool } from "pg";
import type { Role } from "../domain/authz.js";
import type { SessionRecord, SessionStore } from "../domain/session.js";

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly pool: Pool) {}
  async findLogin(tenantSlug:string,email:string) {
    const client=await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tenant=await client.query<{id:string}>("SELECT id FROM tenants WHERE slug=$1 AND archived_at IS NULL",[tenantSlug]);
      if(!tenant.rows[0]) { await client.query("ROLLBACK"); return undefined; }
      await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenant.rows[0].id]);
      const result=await client.query<{password_hash:string;user_id:string;membership_id:string;roles:Role[];employee_id:string|null}>(
        `SELECT u.password_hash,u.id user_id,m.id membership_id,
          coalesce(array_agg(mr.role) FILTER (WHERE mr.role IS NOT NULL),'{}'::tenant_role[])::text[] roles,e.id employee_id
         FROM users u JOIN memberships m ON m.user_id=u.id AND m.deactivated_at IS NULL
         LEFT JOIN membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
         LEFT JOIN employees e ON e.tenant_id=m.tenant_id AND e.membership_id=m.id AND e.archived_at IS NULL
         WHERE m.tenant_id=$1 AND lower(u.email)=lower($2) AND u.deactivated_at IS NULL
         GROUP BY u.password_hash,u.id,m.id,e.id`,[tenant.rows[0].id,email]);
      await client.query("COMMIT");
      const row=result.rows[0]; if(!row) return undefined;
      return {passwordHash:row.password_hash,principal:{userId:row.user_id,tenantId:tenant.rows[0].id,membershipId:row.membership_id,roles:row.roles,...(row.employee_id?{employeeId:row.employee_id}:{})}};
    } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async create(record:SessionRecord) {
    await this.pool.query(`SELECT auth_create_session($1,$2,$3,$4,$5,$6)`,
      [record.idHash,record.principal.tenantId,record.principal.membershipId,record.principal.userId,record.csrfHash,record.expiresAt]);
  }
  async findActive(idHash:string,now:Date) {
    const result=await this.pool.query<{id_hash:string;tenant_id:string;membership_id:string;user_id:string;csrf_hash:string;expires_at:Date;roles:Role[];employee_id:string|null}>(
      `SELECT id_hash,tenant_id,membership_id,user_id,csrf_hash,expires_at,roles::text[] roles,employee_id FROM auth_resolve_session($1,$2)`,[idHash,now]);
    const row=result.rows[0]; if(!row) return undefined;
    return {idHash:row.id_hash,csrfHash:row.csrf_hash,expiresAt:row.expires_at,principal:{userId:row.user_id,tenantId:row.tenant_id,membershipId:row.membership_id,roles:row.roles,...(row.employee_id?{employeeId:row.employee_id}:{})}};
  }
  async revoke(idHash:string,now:Date) { await this.pool.query("SELECT auth_revoke_session($1,$2)",[idHash,now]); }
}
