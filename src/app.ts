import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Config } from "./config.js";
import { AuthorizationError } from "./domain/authz.js";
import { SESSION_COOKIE, SessionService, type SessionStore } from "./domain/session.js";
import type {EmployeeRepository} from "./domain/employees.js";
import {EmployeeService} from "./domain/employees.js";
import {registerEmployeeRoutes} from "./routes/employees.js";

const loginSchema=z.object({tenantSlug:z.string().min(2).max(80),email:z.string().email().max(254),password:z.string().min(10).max(1024)});
export async function buildApp(config:Config,store:SessionStore,employeeRepository?:EmployeeRepository):Promise<FastifyInstance>{
 const app=Fastify({logger:{redact:["req.headers.authorization","req.headers.cookie","body.password"]},requestIdHeader:"x-request-id",genReqId:()=>randomUUID(),bodyLimit:config.MAX_UPLOAD_BYTES});
 const sessions=new SessionService(store,config.SESSION_TTL_SECONDS);
 await app.register(helmet,{contentSecurityPolicy:true}); await app.register(cookie,{secret:config.SESSION_SECRET,hook:"onRequest"});
 await app.register(rateLimit,{global:false});
 app.setErrorHandler((error,request,reply)=>{request.log.warn({err:error,requestId:request.id},"request failed");if(error instanceof AuthorizationError)return reply.code(404).send({error:error.message,requestId:request.id});const status=error&&typeof error==="object"&&"statusCode" in error&&typeof error.statusCode==="number"&&error.statusCode<500?error.statusCode:500;return reply.code(status).send({error:status===500?"An unexpected error occurred":error instanceof Error?error.message:"Request failed",requestId:request.id});});
 app.get("/health",async()=>({status:"ok"}));
 app.post("/api/auth/login",{config:{rateLimit:{max:5,timeWindow:"1 minute"}}},async(request,reply)=>{
   const parsed=loginSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:"Invalid login request"});
   const issued=await sessions.login(parsed.data.tenantSlug,parsed.data.email,parsed.data.password);
   if(!issued)return reply.code(401).send({error:"Invalid credentials or inactive account"});
   reply.setCookie(SESSION_COOKIE,issued.sessionToken,{httpOnly:true,secure:config.NODE_ENV==="production",sameSite:"strict",path:"/",expires:issued.expiresAt});
   return {csrfToken:issued.csrfToken,expiresAt:issued.expiresAt.toISOString(),user:{id:issued.principal.userId,roles:issued.principal.roles}};
 });
 app.get("/api/auth/me",async(request,reply)=>{const record=await sessions.authenticate(request.cookies[SESSION_COOKIE]);if(!record)return reply.code(401).send({error:"Authentication required"});return {userId:record.principal.userId,tenantId:record.principal.tenantId,roles:record.principal.roles,expiresAt:record.expiresAt.toISOString()};});
 app.post("/api/auth/logout",async(request,reply)=>{const token=request.cookies[SESSION_COOKIE];const record=await sessions.authenticate(token);if(record&&!sessions.verifyCsrf(record,request.headers["x-csrf-token"] as string|undefined))return reply.code(403).send({error:"Invalid request verification token"});await sessions.logout(token);reply.clearCookie(SESSION_COOKIE,{path:"/"});return reply.code(204).send();});
 if(employeeRepository)registerEmployeeRoutes(app,sessions,new EmployeeService(employeeRepository));
 return app;
}
