import pg from "pg";
import { readFile } from "node:fs/promises";
import { loadConfig } from "../src/config.js";
const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
try { await pool.query(await readFile(new URL("../migrations/0001_foundation.sql", import.meta.url), "utf8")); }
finally { await pool.end(); }
