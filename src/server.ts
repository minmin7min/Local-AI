import pg from "pg";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { PostgresSessionStore } from "./adapters/postgres-session-store.js";
import {PostgresEmployeeRepository} from "./adapters/postgres-employees.js";

const config = loadConfig();
const pool=new pg.Pool({connectionString:config.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
const app=await buildApp(config,new PostgresSessionStore(pool),new PostgresEmployeeRepository(pool));
app.addHook("onClose",async()=>pool.end());
await app.listen({ port: config.PORT, host: "127.0.0.1" });
