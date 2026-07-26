import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresSessionStore } from "../src/adapters/postgres-session-store.js";

const runtimeUrl = process.env.TEST_DATABASE_URL;
const suite = runtimeUrl ? describe : describe.skip;
const northstar = "10000000-0000-4000-8000-000000000001";
const cedar = "20000000-0000-4000-8000-000000000001";

suite("PostgreSQL tenant boundary", () => {
  const pool = new pg.Pool({ connectionString: runtimeUrl });

  beforeAll(async () => {
    const identity = await pool.query<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>(
      "SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user",
    );
    expect(identity.rows[0]).toMatchObject({ current_user: "pcai_runtime", rolsuper: false, rolbypassrls: false });
  });

  afterAll(async () => pool.end());

  it("returns no tenant rows without transaction-local context", async () => {
    const result = await pool.query("SELECT id FROM employees");
    expect(result.rowCount).toBe(0);
  });

  it("cannot read another tenant even with a forged predicate", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id',$1,true)", [northstar]);
      const own = await client.query<{ tenant_id: string }>("SELECT tenant_id FROM employees");
      const forged = await client.query("SELECT id FROM employees WHERE tenant_id=$1", [cedar]);
      expect(own.rows.length).toBeGreaterThan(0);
      expect(new Set(own.rows.map((row) => row.tenant_id))).toEqual(new Set([northstar]));
      expect(forged.rowCount).toBe(0);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  it("rejects cross-tenant writes at the RLS policy", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id',$1,true)", [northstar]);
      await expect(client.query("INSERT INTO departments(tenant_id,name) VALUES($1,$2)", [cedar, "Forbidden"])).rejects.toMatchObject({ code: "42501" });
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("supports login/session resolution only through narrow security-definer functions", async () => {
    await expect(pool.query("SELECT id_hash FROM sessions")).rejects.toMatchObject({ code: "42501" });
    const store = new PostgresSessionStore(pool);
    const login = await store.findLogin("northstar", "avery.morgan@northstar.example.invalid");
    expect(login?.principal.tenantId).toBe(northstar);
    expect(login?.principal.roles).toContain("employee");
    const expiresAt = new Date(Date.now() + 60_000);
    await store.create({ idHash: "integration-session-hash", csrfHash: "integration-csrf-hash", expiresAt, principal: login!.principal });
    const active = await store.findActive("integration-session-hash", new Date());
    expect(active?.principal.tenantId).toBe(northstar);
    await store.revoke("integration-session-hash", new Date());
    expect(await store.findActive("integration-session-hash", new Date())).toBeUndefined();
  });
});
