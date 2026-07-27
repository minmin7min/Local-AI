import type { Pool, PoolClient } from "pg";
import { InvitationError, type InvitationAcceptance, type InvitationRepository, type InvitationView } from "../domain/invitations.js";
import type { Principal, Role } from "../domain/authz.js";
import { withTenantTransaction } from "../domain/tenant-context.js";

function mapInvitation(row: any): InvitationView {
  return {
    invitationId: row.invitation_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    email: row.email,
    displayName: row.display_name,
    roles: row.roles,
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

export class PostgresInvitationRepository implements InvitationRepository {
  constructor(private readonly pool: Pool) {}

  private async tx<T>(principal: Principal, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { return await withTenantTransaction(client, principal, () => fn(client)); }
    finally { client.release(); }
  }

  async create(principal: Principal, input: { email: string; displayName: string; roles: Role[]; tokenHash: string; expiresAt: Date }, requestId: string): Promise<InvitationView> {
    return this.tx(principal, async (client) => {
      await client.query(
        "UPDATE membership_invitations SET revoked_at=now() WHERE lower(email)=lower($1) AND accepted_at IS NULL AND revoked_at IS NULL",
        [input.email],
      );
      try {
        const result = await client.query(
          `INSERT INTO membership_invitations(tenant_id,email,display_name,roles,token_hash,expires_at,invited_by)
           VALUES($1,$2,$3,$4,$5,$6,$7)
           RETURNING id invitation_id,email,display_name,roles::text[] roles,expires_at`,
          [principal.tenantId, input.email, input.displayName, input.roles, input.tokenHash, input.expiresAt, principal.membershipId],
        );
        const tenant = await client.query<{ slug: string; name: string }>("SELECT slug,name FROM tenants WHERE id=$1", [principal.tenantId]);
        await client.query(
          `INSERT INTO audit_events(tenant_id,actor_id,actor_roles,action,resource_type,resource_id,request_id,outcome,metadata)
           VALUES($1,$2,$3,'invitation.create','invitation',$4,$5,'success',$6)`,
          [principal.tenantId, principal.membershipId, principal.roles, result.rows[0].invitation_id, requestId, { roles: input.roles, expiresAt: input.expiresAt.toISOString() }],
        );
        return mapInvitation({ ...result.rows[0], tenant_slug: tenant.rows[0]!.slug, tenant_name: tenant.rows[0]!.name });
      } catch (error: any) {
        if (error?.code === "23505") throw new InvitationError("An active invitation or account already exists for that synthetic email", 409);
        throw error;
      }
    });
  }

  async resolve(tokenHash: string, now: Date): Promise<InvitationView | undefined> {
    const result = await this.pool.query(
      "SELECT invitation_id,tenant_slug,tenant_name,email,display_name,roles::text[] roles,expires_at FROM auth_resolve_invitation($1,$2)",
      [tokenHash, now],
    );
    return result.rows[0] ? mapInvitation(result.rows[0]) : undefined;
  }

  async accept(tokenHash: string, passwordHash: string, now: Date, requestId: string): Promise<InvitationAcceptance | undefined> {
    try {
      const result = await this.pool.query<{ tenant_slug: string; email: string; membership_id: string }>(
        "SELECT * FROM auth_accept_invitation($1,$2,$3,$4)",
        [tokenHash, passwordHash, now, requestId],
      );
      const row = result.rows[0];
      return row ? { tenantSlug: row.tenant_slug, email: row.email, membershipId: row.membership_id } : undefined;
    } catch (error: any) {
      if (error?.code === "23505") throw new InvitationError("An account already exists for this invitation", 409);
      throw error;
    }
  }
}
