import pg from "pg";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { PostgresSessionStore } from "./adapters/postgres-session-store.js";
import {PostgresEmployeeRepository} from "./adapters/postgres-employees.js";
import {PostgresImportRepository} from "./adapters/postgres-imports.js";
import{PostgresDocumentRepository}from"./adapters/postgres-documents.js";import{LocalObjectStorage}from"./adapters/local-storage.js";
import{PostgresChatRepository}from"./adapters/postgres-chat.js";import{DeterministicProvider}from"./domain/ai.js";
import{PostgresOperationsRepository}from"./adapters/postgres-operations.js";
import { PostgresAdministrationRepository } from "./adapters/postgres-administration.js";
import { PostgresEmployeeOperationsRepository } from "./adapters/postgres-employee-operations.js";
import { PostgresInvitationRepository } from "./adapters/postgres-invitations.js";

const config = loadConfig();
const pool=new pg.Pool({connectionString:config.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
const app=await buildApp(config,new PostgresSessionStore(pool),new PostgresEmployeeRepository(pool),new PostgresImportRepository(pool),new PostgresDocumentRepository(pool),new LocalObjectStorage(config.STORAGE_ROOT),new PostgresChatRepository(pool),new DeterministicProvider(),new PostgresOperationsRepository(pool),new PostgresAdministrationRepository(pool),new PostgresEmployeeOperationsRepository(pool),new PostgresInvitationRepository(pool));
app.addHook("onClose",async()=>pool.end());
await app.listen({ port: config.PORT, host: config.HOST });
