import pg from "pg";

const connectionString = process.env.TEST_DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("TEST_DATABASE_ADMIN_URL is required");

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pcai_runtime') THEN
      CREATE ROLE pcai_runtime LOGIN PASSWORD 'runtime-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
    ELSE
      ALTER ROLE pcai_runtime WITH LOGIN PASSWORD 'runtime-test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
    END IF;
  END $$`);
} finally {
  await client.end();
}
