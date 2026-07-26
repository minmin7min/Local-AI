import pg from "pg";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { loadConfig } from "../src/config.js";
const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
try {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("SELECT pg_advisory_lock(hashtext('private-company-ai:migrations'))");
  const directory=new URL("../migrations/",import.meta.url);
  for(const name of (await readdir(directory)).filter(x=>x.endsWith(".sql")).sort()){
    const done=await pool.query("SELECT 1 FROM schema_migrations WHERE name=$1",[name]);if(done.rows[0])continue;
    await pool.query(await readFile(new URL(name,directory),"utf8"));await pool.query("INSERT INTO schema_migrations(name) VALUES($1)",[name]);console.log(`Applied ${name}`);
  }
}
finally { try{await pool.query("SELECT pg_advisory_unlock(hashtext('private-company-ai:migrations'))");}finally{await pool.end();} }
