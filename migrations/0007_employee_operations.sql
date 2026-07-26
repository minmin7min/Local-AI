BEGIN;

ALTER TABLE employee_training ADD CONSTRAINT employee_training_status_check CHECK(status IN('not_started','in_progress','completed','waived'));
ALTER TABLE employee_certifications ADD CONSTRAINT employee_certification_status_check CHECK(status IN('valid','expiring','expired','revoked'));
CREATE UNIQUE INDEX deadline_source_unique ON deadlines(tenant_id,source_type,source_id) WHERE source_id IS NOT NULL;

COMMIT;
