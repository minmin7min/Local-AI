BEGIN;

CREATE TABLE membership_invitations (
  id uuid DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  email text NOT NULL,
  display_name text NOT NULL,
  roles tenant_role[] NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,invited_by) REFERENCES memberships(tenant_id,id),
  CHECK(cardinality(roles) BETWEEN 1 AND 5),
  CHECK(expires_at > created_at),
  CHECK(accepted_at IS NULL OR revoked_at IS NULL)
);
CREATE UNIQUE INDEX one_active_invitation_per_email ON membership_invitations(tenant_id,lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX invitation_expiry_idx ON membership_invitations(expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE membership_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON membership_invitations
  USING(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
  WITH CHECK(tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE OR REPLACE FUNCTION auth_resolve_invitation(p_token_hash text,p_now timestamptz)
RETURNS TABLE(invitation_id uuid,tenant_slug text,tenant_name text,email text,display_name text,roles tenant_role[],expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp SET row_security=off STABLE AS $$
  SELECT i.id,t.slug,t.name,i.email,i.display_name,i.roles,i.expires_at
  FROM membership_invitations i JOIN tenants t ON t.id=i.tenant_id
  WHERE i.token_hash=p_token_hash AND i.accepted_at IS NULL AND i.revoked_at IS NULL
    AND i.expires_at>p_now AND t.archived_at IS NULL
$$;

CREATE OR REPLACE FUNCTION auth_accept_invitation(p_token_hash text,p_password_hash text,p_now timestamptz,p_request_id text)
RETURNS TABLE(tenant_slug text,email text,membership_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET row_security=off AS $$
DECLARE
  invitation membership_invitations%ROWTYPE;
  new_user_id uuid;
  new_membership_id uuid;
BEGIN
  SELECT * INTO invitation FROM membership_invitations i
  WHERE i.token_hash=p_token_hash AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>p_now
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO users(email,password_hash,display_name)
  VALUES(invitation.email,p_password_hash,invitation.display_name) RETURNING id INTO new_user_id;
  INSERT INTO memberships(tenant_id,user_id)
  VALUES(invitation.tenant_id,new_user_id) RETURNING id INTO new_membership_id;
  INSERT INTO membership_roles(tenant_id,membership_id,role)
  SELECT invitation.tenant_id,new_membership_id,role FROM unnest(invitation.roles) AS role;
  UPDATE membership_invitations SET accepted_at=p_now WHERE tenant_id=invitation.tenant_id AND id=invitation.id;
  INSERT INTO audit_events(tenant_id,actor_id,actor_roles,action,resource_type,resource_id,request_id,outcome,metadata)
  VALUES(invitation.tenant_id,NULL,'{}','invitation.accept','membership',new_membership_id::text,p_request_id,'success',jsonb_build_object('invitationId',invitation.id));

  RETURN QUERY SELECT t.slug,invitation.email,new_membership_id FROM tenants t WHERE t.id=invitation.tenant_id;
END $$;

REVOKE ALL ON FUNCTION auth_resolve_invitation(text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_accept_invitation(text,text,timestamptz,text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pcai_runtime') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON membership_invitations TO pcai_runtime;
    GRANT EXECUTE ON FUNCTION auth_resolve_invitation(text,timestamptz) TO pcai_runtime;
    GRANT EXECUTE ON FUNCTION auth_accept_invitation(text,text,timestamptz,text) TO pcai_runtime;
  END IF;
END $$;

COMMIT;
