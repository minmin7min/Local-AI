import {beforeAll,describe,expect,it} from "vitest";
import {buildApp} from "../src/app.js";
import {MemorySessionStore} from "../src/adapters/memory-session-store.js";
import {hashPassword} from "../src/domain/session.js";
const config={NODE_ENV:"test" as const,PORT:3000,DATABASE_URL:"postgresql://test:test@localhost/test",SESSION_SECRET:"test-session-secret-at-least-32-characters",STORAGE_ROOT:"./storage",AI_PROVIDER:"deterministic" as const,AI_MODEL:"deterministic-v1",MAX_UPLOAD_BYTES:1048576,SESSION_TTL_SECONDS:3600};
const store=new MemorySessionStore();
beforeAll(async()=>store.addLogin("northstar","avery@northstar.example.invalid",await hashPassword("Synthetic-Password-Only!"),{userId:"u1",tenantId:"t1",membershipId:"m1",employeeId:"e1",roles:["employee"]}));
describe("authentication",()=>{
 it("uses generic failure responses",async()=>{const app=await buildApp(config,store);const a=await app.inject({method:"POST",url:"/api/auth/login",payload:{tenantSlug:"northstar",email:"missing@example.invalid",password:"Wrong-Password!"}});expect(a.statusCode).toBe(401);expect(a.json().error).not.toMatch(/email|tenant/i);await app.close();});
 it("issues, authenticates, CSRF-protects, and revokes a session",async()=>{const app=await buildApp(config,store);const login=await app.inject({method:"POST",url:"/api/auth/login",payload:{tenantSlug:"northstar",email:"avery@northstar.example.invalid",password:"Synthetic-Password-Only!"}});expect(login.statusCode).toBe(200);const cookie=login.cookies[0]!.name+"="+login.cookies[0]!.value;expect((await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie}})).statusCode).toBe(200);expect((await app.inject({method:"POST",url:"/api/auth/logout",headers:{cookie}})).statusCode).toBe(403);expect((await app.inject({method:"POST",url:"/api/auth/logout",headers:{cookie,"x-csrf-token":login.json().csrfToken}})).statusCode).toBe(204);expect((await app.inject({method:"GET",url:"/api/auth/me",headers:{cookie}})).statusCode).toBe(401);await app.close();});
});
