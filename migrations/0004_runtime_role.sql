BEGIN;

-- The packaged local/CI runtime role is deliberately a non-owner without BYPASSRLS.
-- Production may use a differently named role and must apply equivalent grants via IaC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pcai_runtime') THEN
    GRANT USAGE ON SCHEMA public TO pcai_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pcai_runtime;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pcai_runtime;
    REVOKE ALL ON sessions FROM pcai_runtime;
    GRANT EXECUTE ON FUNCTION auth_create_session(text,uuid,uuid,uuid,text,timestamptz) TO pcai_runtime;
    GRANT EXECUTE ON FUNCTION auth_resolve_session(text,timestamptz) TO pcai_runtime;
    GRANT EXECUTE ON FUNCTION auth_revoke_session(text,timestamptz) TO pcai_runtime;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pcai_runtime;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pcai_runtime;
  END IF;
END $$;

COMMIT;
