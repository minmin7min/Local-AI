BEGIN;
CREATE OR REPLACE FUNCTION auth_create_session(p_id_hash text,p_tenant_id uuid,p_membership_id uuid,p_user_id uuid,p_csrf_hash text,p_expires_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM memberships WHERE tenant_id=p_tenant_id AND id=p_membership_id AND user_id=p_user_id AND deactivated_at IS NULL) THEN RAISE EXCEPTION 'invalid membership'; END IF;
 INSERT INTO sessions(id_hash,tenant_id,membership_id,user_id,csrf_hash,expires_at) VALUES(p_id_hash,p_tenant_id,p_membership_id,p_user_id,p_csrf_hash,p_expires_at);
END $$;
CREATE OR REPLACE FUNCTION auth_resolve_session(p_id_hash text,p_now timestamptz) RETURNS TABLE(id_hash text,tenant_id uuid,membership_id uuid,user_id uuid,csrf_hash text,expires_at timestamptz,roles tenant_role[],employee_id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp STABLE AS $$
 SELECT s.id_hash,s.tenant_id,s.membership_id,s.user_id,s.csrf_hash,s.expires_at,coalesce(array_agg(mr.role)FILTER(WHERE mr.role IS NOT NULL),'{}'),e.id
 FROM sessions s JOIN memberships m ON m.tenant_id=s.tenant_id AND m.id=s.membership_id AND m.user_id=s.user_id AND m.deactivated_at IS NULL
 LEFT JOIN membership_roles mr ON mr.tenant_id=m.tenant_id AND mr.membership_id=m.id
 LEFT JOIN employees e ON e.tenant_id=m.tenant_id AND e.membership_id=m.id AND e.archived_at IS NULL
 WHERE s.id_hash=p_id_hash AND s.revoked_at IS NULL AND s.expires_at>p_now GROUP BY s.id_hash,s.tenant_id,s.membership_id,s.user_id,s.csrf_hash,s.expires_at,e.id
$$;
CREATE OR REPLACE FUNCTION auth_revoke_session(p_id_hash text,p_now timestamptz) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ UPDATE sessions SET revoked_at=p_now WHERE id_hash=p_id_hash AND revoked_at IS NULL $$;
REVOKE ALL ON FUNCTION auth_create_session(text,uuid,uuid,uuid,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_resolve_session(text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_revoke_session(text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_create_session(text,uuid,uuid,uuid,text,timestamptz) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION auth_resolve_session(text,timestamptz) TO CURRENT_USER;
GRANT EXECUTE ON FUNCTION auth_revoke_session(text,timestamptz) TO CURRENT_USER;
COMMIT;
