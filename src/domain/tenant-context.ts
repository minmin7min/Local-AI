import type { PoolClient } from "pg";
import type { Principal } from "./authz.js";

// Transaction-local settings are consumed by PostgreSQL RLS. Never accept these values from request input.
export async function withTenantTransaction<T>(client: PoolClient, principal: Principal, fn: () => Promise<T>): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.membership_id', $3, true)",
      [principal.tenantId, principal.userId, principal.membershipId]);
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
