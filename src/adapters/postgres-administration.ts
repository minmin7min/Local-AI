import type { Pool, PoolClient } from "pg";
import { AdminInputError, type AdminRepository, type MemberView, type TenantSettingsView } from "../domain/administration.js";
import type { Principal, Role } from "../domain/authz.js";
import { withTenantTransaction } from "../domain/tenant-context.js";

function mapMember(row: any): MemberView {
  return {
    membershipId: row.membership_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    roles: row.roles,
    ...(row.deactivated_at ? { deactivatedAt: row.deactivated_at } : {}),
  };
}

export class PostgresAdministrationRepository implements AdminRepository {
  constructor(private readonly pool: Pool) {}

  private async tx<T>(principal: Principal, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { return await withTenantTransaction(client, principal, () => fn(client)); }
    finally { client.release(); }
  }

  private async audit(client: PoolClient, principal: Principal, requestId: string, action: string, resourceType: string, resourceId: string, metadata: object = {}) {
    await client.query(
      `INSERT INTO audit_events(tenant_id,actor_id,actor_roles,action,resource_type,resource_id,request_id,outcome,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,'success',$8)`,
      [principal.tenantId, principal.membershipId, principal.roles, action, resourceType, resourceId, requestId, metadata],
    );
  }

  async listMembers(principal: Principal): Promise<MemberView[]> {
    return this.tx(principal, async (client) => {
      const result = await client.query(
        `SELECT m.id membership_id,u.id user_id,u.email,u.display_name,m.deactivated_at::text,
                coalesce(array_agg(mr.role) FILTER(WHERE mr.role IS NOT NULL),'{}'::tenant_role[])::text[] roles
         FROM memberships m JOIN users u ON u.id=m.user_id
         LEFT JOIN membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
         GROUP BY m.id,m.tenant_id,u.id ORDER BY (m.deactivated_at IS NOT NULL),u.display_name`,
      );
      return result.rows.map(mapMember);
    });
  }

  async createMember(principal: Principal, input: { email: string; displayName: string; passwordHash: string; roles: Role[] }, requestId: string): Promise<MemberView> {
    return this.tx(principal, async (client) => {
      try {
        const user = await client.query<{ id: string }>(
          "INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id",
          [input.email, input.passwordHash, input.displayName],
        );
        const member = await client.query<{ id: string }>(
          "INSERT INTO memberships(tenant_id,user_id) VALUES($1,$2) RETURNING id",
          [principal.tenantId, user.rows[0]!.id],
        );
        for (const role of input.roles) {
          await client.query("INSERT INTO membership_roles(tenant_id,membership_id,role) VALUES($1,$2,$3)", [principal.tenantId, member.rows[0]!.id, role]);
        }
        await this.audit(client, principal, requestId, "membership.create", "membership", member.rows[0]!.id, { roles: input.roles });
        return { membershipId: member.rows[0]!.id, userId: user.rows[0]!.id, email: input.email, displayName: input.displayName, roles: input.roles };
      } catch (error: any) {
        if (error?.code === "23505") throw new AdminInputError("A user with that synthetic email already exists", 409);
        throw error;
      }
    });
  }

  async replaceRoles(principal: Principal, membershipId: string, nextRoles: Role[], requestId: string): Promise<MemberView | undefined> {
    return this.tx(principal, async (client) => {
      const current = await client.query<{ roles: Role[]; deactivated_at: string | null }>(
        `SELECT m.deactivated_at,coalesce(array_agg(mr.role) FILTER(WHERE mr.role IS NOT NULL),'{}'::tenant_role[])::text[] roles
         FROM memberships m LEFT JOIN membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
         WHERE m.id=$1 GROUP BY m.id,m.tenant_id`, [membershipId],
      );
      if (!current.rows[0] || current.rows[0].deactivated_at) return undefined;
      const removesAdministration = !nextRoles.some((role) => role === "owner" || role === "tenant_admin");
      if (removesAdministration && current.rows[0].roles.some((role) => role === "owner" || role === "tenant_admin")) {
        const others = await client.query(
          `SELECT 1 FROM memberships m JOIN membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
           WHERE m.id<>$1 AND m.deactivated_at IS NULL AND mr.role IN('owner','tenant_admin') LIMIT 1`, [membershipId],
        );
        if (!others.rows[0]) throw new AdminInputError("The tenant must retain at least one active owner or administrator", 409);
      }
      await client.query("DELETE FROM membership_roles WHERE membership_id=$1", [membershipId]);
      for (const role of nextRoles) await client.query("INSERT INTO membership_roles(tenant_id,membership_id,role) VALUES($1,$2,$3)", [principal.tenantId, membershipId, role]);
      await this.audit(client, principal, requestId, "membership.role_change", "membership", membershipId, { previousRoles: current.rows[0].roles, roles: nextRoles });
      const result = await client.query(
        `SELECT m.id membership_id,u.id user_id,u.email,u.display_name,m.deactivated_at::text,
                coalesce(array_agg(mr.role) FILTER(WHERE mr.role IS NOT NULL),'{}'::tenant_role[])::text[] roles
         FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
         WHERE m.id=$1 GROUP BY m.id,m.tenant_id,u.id`, [membershipId],
      );
      return result.rows[0] ? mapMember(result.rows[0]) : undefined;
    });
  }

  async deactivateMember(principal: Principal, membershipId: string, requestId: string): Promise<boolean> {
    return this.tx(principal, async (client) => {
      const target = await client.query<{ administrative: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM membership_roles mr WHERE mr.tenant_id=m.tenant_id AND mr.membership_id=m.id AND mr.role IN('owner','tenant_admin')) administrative
         FROM memberships m WHERE m.id=$1 AND m.deactivated_at IS NULL`, [membershipId],
      );
      if (!target.rows[0]) return false;
      if (target.rows[0].administrative) {
        const others = await client.query(
          `SELECT 1 FROM memberships m JOIN membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
           WHERE m.id<>$1 AND m.deactivated_at IS NULL AND mr.role IN('owner','tenant_admin') LIMIT 1`, [membershipId],
        );
        if (!others.rows[0]) throw new AdminInputError("The tenant must retain at least one active owner or administrator", 409);
      }
      await client.query("UPDATE memberships SET deactivated_at=now() WHERE id=$1", [membershipId]);
      await client.query("SELECT tenant_revoke_membership_sessions($1,now())", [membershipId]);
      await this.audit(client, principal, requestId, "membership.deactivate", "membership", membershipId);
      return true;
    });
  }

  async getSettings(principal: Principal): Promise<TenantSettingsView> {
    return this.tx(principal, async (client) => {
      const result = await client.query(
        `SELECT t.name,t.timezone,t.retention_days,t.synthetic_only,s.reminder_days,
                coalesce(s.in_app_notifications,true) in_app_notifications,coalesce(s.email_notifications,false) email_notifications,s.updated_at::text
         FROM tenants t LEFT JOIN tenant_settings s ON s.tenant_id=t.id WHERE t.id=$1`, [principal.tenantId],
      );
      const row = result.rows[0];
      return { name: row.name, timezone: row.timezone, retentionDays: row.retention_days, reminderDays: row.reminder_days ?? [30, 60, 90], inAppNotifications: row.in_app_notifications, emailNotifications: row.email_notifications, syntheticOnly: row.synthetic_only, ...(row.updated_at ? { updatedAt: row.updated_at } : {}) };
    });
  }

  async updateSettings(principal: Principal, input: { name?: string | undefined; timezone?: string | undefined; retentionDays?: number | undefined; reminderDays?: number[] | undefined; inAppNotifications?: boolean | undefined }, requestId: string): Promise<TenantSettingsView> {
    return this.tx(principal, async (client) => {
      if (input.timezone) {
        const timezone = await client.query("SELECT 1 FROM pg_timezone_names WHERE name=$1", [input.timezone]);
        if (!timezone.rows[0]) throw new AdminInputError("Unknown IANA timezone");
      }
      await client.query(
        `UPDATE tenants SET name=coalesce($2,name),timezone=coalesce($3,timezone),retention_days=coalesce($4,retention_days) WHERE id=$1`,
        [principal.tenantId, input.name ?? null, input.timezone ?? null, input.retentionDays ?? null],
      );
      await client.query(
        `INSERT INTO tenant_settings(tenant_id,reminder_days,in_app_notifications,updated_by)
         VALUES($1,coalesce($2,ARRAY[30,60,90]::smallint[]),coalesce($3,true),$4)
         ON CONFLICT(tenant_id) DO UPDATE SET reminder_days=coalesce($2,tenant_settings.reminder_days),in_app_notifications=coalesce($3,tenant_settings.in_app_notifications),updated_by=$4,updated_at=now()`,
        [principal.tenantId, input.reminderDays ?? null, input.inAppNotifications ?? null, principal.membershipId],
      );
      await this.audit(client, principal, requestId, "tenant.settings_update", "tenant", principal.tenantId, { fields: Object.keys(input) });
      const result = await client.query(
        `SELECT t.name,t.timezone,t.retention_days,t.synthetic_only,s.reminder_days,s.in_app_notifications,s.email_notifications,s.updated_at::text
         FROM tenants t JOIN tenant_settings s ON s.tenant_id=t.id WHERE t.id=$1`, [principal.tenantId],
      );
      const row = result.rows[0];
      return { name: row.name, timezone: row.timezone, retentionDays: row.retention_days, reminderDays: row.reminder_days, inAppNotifications: row.in_app_notifications, emailNotifications: row.email_notifications, syntheticOnly: row.synthetic_only, updatedAt: row.updated_at };
    });
  }
}
