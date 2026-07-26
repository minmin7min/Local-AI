import pg from "pg";
import { loadConfig } from "../src/config.js";
import { LocalObjectStorage } from "../src/adapters/local-storage.js";
import { extractText } from "../src/domain/extraction.js";

const tenantId = process.argv[2];
if (!tenantId) throw new Error("Usage: npm run worker -- <tenant-uuid> [--loop]");
const loop = process.argv.includes("--loop");
const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 2 });
const storage = new LocalObjectStorage(config.STORAGE_ROOT);

async function claimJob() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
    const found = await client.query(`SELECT id,payload FROM background_jobs WHERE status='pending' AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`);
    const job = found.rows[0];
    if (!job) { await client.query("COMMIT"); return undefined; }
    if (job.payload.tenantId !== tenantId) throw new Error("Job tenant mismatch");
    await client.query("UPDATE background_jobs SET status='running',locked_at=now(),attempts=attempts+1 WHERE id=$1", [job.id]);
    await client.query("COMMIT");
    return job;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function processOne(): Promise<boolean> {
  const job = await claimJob();
  if (!job) return false;
  try {
    const read = await pool.connect(); let version: any;
    try {
      await read.query("BEGIN"); await read.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
      version = (await read.query("SELECT id,storage_key,media_type FROM document_versions WHERE id=$1 AND state='processing'", [job.payload.documentVersionId])).rows[0];
      await read.query("COMMIT");
    } catch (error) { await read.query("ROLLBACK"); throw error; }
    finally { read.release(); }
    if (!version) throw new Error("Document version is not processable");
    const sections = await extractText(await storage.get(version.storage_key), version.media_type);
    const write = await pool.connect();
    try {
      await write.query("BEGIN"); await write.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
      for (const section of sections) await write.query(`INSERT INTO document_sections(tenant_id,document_version_id,ordinal,heading,page_number,content) VALUES($1,$2,$3,$4,$5,$6)`, [tenantId, version.id, section.ordinal, section.heading ?? null, section.page ?? null, section.content]);
      await write.query("UPDATE document_versions SET state='review',updated_at=now() WHERE id=$1 AND state='processing'", [version.id]);
      await write.query("UPDATE background_jobs SET status='succeeded',completed_at=now() WHERE id=$1", [job.id]);
      await write.query("COMMIT");
    } catch (error) { await write.query("ROLLBACK"); throw error; }
    finally { write.release(); }
  } catch (error) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN"); await client.query("SELECT set_config('app.tenant_id',$1,true)", [tenantId]);
      const message = error instanceof Error ? error.message.slice(0, 500) : "Extraction failed";
      await client.query("UPDATE background_jobs SET status='failed',last_error=$2,completed_at=now() WHERE id=$1", [job.id, message]);
      await client.query("UPDATE document_versions SET state='failed',updated_at=now() WHERE id=$1", [job.payload.documentVersionId]);
      await client.query("COMMIT");
    } catch (writeError) { await client.query("ROLLBACK"); throw writeError; }
    finally { client.release(); }
    throw error;
  }
  return true;
}

try {
  do {
    try { if (!(await processOne()) && !loop) console.log("No pending jobs"); }
    catch (error) { console.error(error instanceof Error ? error.message : "Document worker failed"); if (!loop) throw error; }
    if (loop) await new Promise((resolve) => setTimeout(resolve, 2_000));
  } while (loop);
} finally { await pool.end(); }
