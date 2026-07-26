BEGIN;
CREATE TABLE background_jobs(
 id uuid DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),type text NOT NULL,payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','running','succeeded','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 10),available_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 PRIMARY KEY(tenant_id,id),CHECK(payload ? 'tenantId')
);
CREATE INDEX background_jobs_ready_idx ON background_jobs(available_at,created_at) WHERE status='pending';
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;ALTER TABLE background_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON background_jobs USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid) WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
COMMIT;
