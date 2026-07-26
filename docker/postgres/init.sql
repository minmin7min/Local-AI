-- Local development only. Production roles and passwords must be provisioned by a secret manager/IaC.
CREATE ROLE pcai_runtime LOGIN PASSWORD 'local-runtime-development-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
