BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE tenant_role AS ENUM ('employee','manager','hr','owner','tenant_admin');
CREATE TYPE document_state AS ENUM ('processing','review','approved','rejected','archived','failed');
CREATE TYPE deadline_state AS ENUM ('open','completed','waived');

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
  name text NOT NULL, timezone text NOT NULL DEFAULT 'UTC', retention_days integer NOT NULL DEFAULT 2555 CHECK (retention_days BETWEEN 30 AND 3650),
  synthetic_only boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, password_hash text NOT NULL,
  display_name text NOT NULL, is_platform_operator boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), deactivated_at timestamptz
);
CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), deactivated_at timestamptz, UNIQUE (tenant_id, user_id), UNIQUE (tenant_id, id)
);
CREATE TABLE membership_roles (
  tenant_id uuid NOT NULL, membership_id uuid NOT NULL, role tenant_role NOT NULL,
  PRIMARY KEY (tenant_id, membership_id, role), FOREIGN KEY (tenant_id, membership_id) REFERENCES memberships(tenant_id,id)
);
CREATE TABLE sessions (
  id_hash text PRIMARY KEY, tenant_id uuid NOT NULL, membership_id uuid NOT NULL, user_id uuid NOT NULL,
  csrf_hash text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,membership_id) REFERENCES memberships(tenant_id,id)
);
CREATE INDEX sessions_active_idx ON sessions(id_hash,expires_at) WHERE revoked_at IS NULL;

CREATE TABLE departments (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, archived_at timestamptz,
  PRIMARY KEY (tenant_id,id), UNIQUE(tenant_id,name)
);
CREATE TABLE employees (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), membership_id uuid,
  internal_employee_id text NOT NULL, display_name text NOT NULL, work_email text NOT NULL, department_id uuid NOT NULL,
  position text NOT NULL, employment_status text NOT NULL CHECK (employment_status IN ('active','leave','ended')),
  employment_category text NOT NULL CHECK (employment_category IN ('full_time','part_time','contract','temporary')),
  start_date date NOT NULL, contract_expires_on date, onboarding_status text NOT NULL DEFAULT 'not_started', offboarding_status text NOT NULL DEFAULT 'not_started',
  responsible_hr_membership_id uuid, source_import_batch_id uuid, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz,
  PRIMARY KEY (tenant_id,id), UNIQUE(tenant_id,internal_employee_id), UNIQUE(tenant_id,work_email),
  FOREIGN KEY (tenant_id,department_id) REFERENCES departments(tenant_id,id), FOREIGN KEY (tenant_id,membership_id) REFERENCES memberships(tenant_id,id),
  FOREIGN KEY (tenant_id,responsible_hr_membership_id) REFERENCES memberships(tenant_id,id)
);
CREATE TABLE reporting_relationships (
  tenant_id uuid NOT NULL, manager_employee_id uuid NOT NULL, report_employee_id uuid NOT NULL, starts_on date NOT NULL, ends_on date,
  PRIMARY KEY(tenant_id,manager_employee_id,report_employee_id,starts_on),
  FOREIGN KEY(tenant_id,manager_employee_id) REFERENCES employees(tenant_id,id), FOREIGN KEY(tenant_id,report_employee_id) REFERENCES employees(tenant_id,id),
  CHECK(manager_employee_id <> report_employee_id)
);
CREATE TABLE employee_training (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, employee_id uuid NOT NULL, title text NOT NULL, status text NOT NULL,
  due_at timestamptz, completed_at timestamptz, PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id)
);
CREATE TABLE employee_certifications (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, employee_id uuid NOT NULL, certification_type text NOT NULL,
  expires_at timestamptz, status text NOT NULL, PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id)
);
CREATE TABLE equipment_assignments (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, employee_id uuid NOT NULL, asset_tag text NOT NULL, description text NOT NULL,
  assigned_at timestamptz NOT NULL, returned_at timestamptz, PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,asset_tag), FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id)
);

CREATE TABLE import_batches (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), created_by uuid NOT NULL,
  original_filename text NOT NULL, sha256 text NOT NULL, status text NOT NULL CHECK(status IN ('preview','committing','committed','failed','cancelled')),
  mapping jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), committed_at timestamptz,
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,sha256), FOREIGN KEY(tenant_id,created_by) REFERENCES memberships(tenant_id,id)
);
ALTER TABLE employees ADD CONSTRAINT employees_source_batch_fk FOREIGN KEY(tenant_id,source_import_batch_id) REFERENCES import_batches(tenant_id,id);
CREATE TABLE import_rows (
  id bigint GENERATED ALWAYS AS IDENTITY, tenant_id uuid NOT NULL, batch_id uuid NOT NULL, row_number integer NOT NULL,
  normalized_data jsonb, errors jsonb NOT NULL DEFAULT '[]', committed_employee_id uuid,
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,batch_id,row_number), FOREIGN KEY(tenant_id,batch_id) REFERENCES import_batches(tenant_id,id)
);

CREATE TABLE documents (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), title text NOT NULL, audience_roles tenant_role[] NOT NULL DEFAULT ARRAY['employee']::tenant_role[],
  department_id uuid, created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz, PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,department_id) REFERENCES departments(tenant_id,id)
);
CREATE TABLE document_versions (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, document_id uuid NOT NULL, version integer NOT NULL,
  state document_state NOT NULL DEFAULT 'processing', is_current boolean NOT NULL DEFAULT false, original_filename text NOT NULL,
  storage_key text NOT NULL, media_type text NOT NULL, sha256 text NOT NULL, size_bytes bigint NOT NULL CHECK(size_bytes > 0),
  uploaded_by uuid NOT NULL, approved_by uuid, approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,document_id,version), UNIQUE(tenant_id,storage_key),
  FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id), FOREIGN KEY(tenant_id,uploaded_by) REFERENCES memberships(tenant_id,id),
  FOREIGN KEY(tenant_id,approved_by) REFERENCES memberships(tenant_id,id), CHECK((state='approved') = (approved_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_current_document_version ON document_versions(tenant_id,document_id) WHERE is_current;
CREATE TABLE document_sections (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, document_version_id uuid NOT NULL, ordinal integer NOT NULL,
  heading text, page_number integer, content text NOT NULL, content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english',content)) STORED,
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,document_version_id,ordinal), FOREIGN KEY(tenant_id,document_version_id) REFERENCES document_versions(tenant_id,id)
);
CREATE INDEX document_sections_search_idx ON document_sections USING gin(content_tsv);

CREATE TABLE deadlines (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, employee_id uuid NOT NULL, type text NOT NULL,
  title text NOT NULL, due_at timestamptz NOT NULL, state deadline_state NOT NULL DEFAULT 'open', source_type text NOT NULL, source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,employee_id) REFERENCES employees(tenant_id,id)
);
CREATE INDEX deadline_tenant_due_idx ON deadlines(tenant_id,due_at) WHERE state='open';
CREATE TABLE notifications (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, membership_id uuid NOT NULL, deadline_id uuid,
  idempotency_key text NOT NULL, title text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
  PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,idempotency_key), FOREIGN KEY(tenant_id,membership_id) REFERENCES memberships(tenant_id,id),
  FOREIGN KEY(tenant_id,deadline_id) REFERENCES deadlines(tenant_id,id)
);
CREATE TABLE chat_sessions (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, membership_id uuid NOT NULL, title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz, PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,membership_id) REFERENCES memberships(tenant_id,id)
);
CREATE TABLE chat_messages (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, chat_session_id uuid NOT NULL, role text NOT NULL CHECK(role IN('user','assistant')),
  content text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,chat_session_id) REFERENCES chat_sessions(tenant_id,id)
);
CREATE TABLE citations (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, chat_message_id uuid NOT NULL, source_type text NOT NULL CHECK(source_type IN('document','record')),
  source_id uuid NOT NULL, document_version integer, title text NOT NULL, section text, page_number integer, source_updated_at timestamptz NOT NULL,
  PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,chat_message_id) REFERENCES chat_messages(tenant_id,id)
);
CREATE TABLE audit_events (
  id uuid DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), actor_id uuid, actor_roles tenant_role[] NOT NULL DEFAULT '{}',
  action text NOT NULL, resource_type text NOT NULL, resource_id text, occurred_at timestamptz NOT NULL DEFAULT now(), request_id text NOT NULL,
  outcome text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', source_ip inet, user_agent text,
  PRIMARY KEY(tenant_id,id)
);
CREATE INDEX audit_tenant_time_idx ON audit_events(tenant_id,occurred_at DESC);

-- Defense in depth: application roles do not own tables and must provide transaction-local tenant context.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['memberships','membership_roles','sessions','departments','employees','reporting_relationships','employee_training','employee_certifications','equipment_assignments','import_batches','import_rows','documents','document_versions','document_sections','deadlines','notifications','chat_sessions','chat_messages','citations','audit_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',t);
  END LOOP;
END $$;
COMMIT;
