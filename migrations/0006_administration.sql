BEGIN;

CREATE TABLE tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
  reminder_days smallint[] NOT NULL DEFAULT ARRAY[30,60,90]::smallint[],
  in_app_notifications boolean NOT NULL DEFAULT true,
  email_notifications boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,updated_by) REFERENCES memberships(tenant_id,id),
  CHECK(cardinality(reminder_days) BETWEEN 1 AND 12)
);
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_settings
  USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE OR REPLACE FUNCTION tenant_revoke_membership_sessions(p_membership_id uuid,p_now timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp SET row_security=off AS $$
 UPDATE sessions SET revoked_at=p_now
 WHERE tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
   AND membership_id=p_membership_id AND revoked_at IS NULL
$$;
REVOKE ALL ON FUNCTION tenant_revoke_membership_sessions(uuid,timestamptz) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pcai_runtime') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON tenant_settings TO pcai_runtime;
    GRANT EXECUTE ON FUNCTION tenant_revoke_membership_sessions(uuid,timestamptz) TO pcai_runtime;
  END IF;
END $$;

COMMIT;
