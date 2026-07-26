import type {FastifyInstance} from "fastify";
import {z} from "zod";
import type {SessionService} from "../domain/session.js";
import {SESSION_COOKIE} from "../domain/session.js";
import {EmployeeService} from "../domain/employees.js";
const idSchema=z.uuid();
const updateSchema=z.object({departmentId:z.uuid().optional(),position:z.string().min(1).max(120).optional(),employmentStatus:z.enum(["active","leave","ended"]).optional(),employmentCategory:z.enum(["full_time","part_time","contract","temporary"]).optional(),contractExpirationDate:z.iso.date().nullable().optional(),onboardingStatus:z.string().min(1).max(40).optional(),offboardingStatus:z.string().min(1).max(40).optional(),expectedVersion:z.number().int().positive()}).strict();
export function registerEmployeeRoutes(app:FastifyInstance,sessions:SessionService,service:EmployeeService):void{
 const auth=async(request:any,reply:any)=>{const record=await sessions.authenticate(request.cookies[SESSION_COOKIE]);if(!record){await reply.code(401).send({error:"Authentication required"});return;}request.sessionRecord=record;};
 app.get("/api/employees",{preHandler:auth},async(request:any)=>({employees:await service.list(request.sessionRecord.principal)}));
 app.get("/api/employees/:id",{preHandler:auth},async(request:any,reply)=>{const id=idSchema.safeParse(request.params.id);if(!id.success)return reply.code(404).send({error:"Resource not found or access denied"});const result=await service.get(request.sessionRecord.principal,id.data);return result??reply.code(404).send({error:"Resource not found or access denied"});});
 app.patch("/api/employees/:id",{preHandler:auth},async(request:any,reply)=>{if(!sessions.verifyCsrf(request.sessionRecord,request.headers["x-csrf-token"]))return reply.code(403).send({error:"Invalid request verification token"});const id=idSchema.safeParse(request.params.id);const body=updateSchema.safeParse(request.body);if(!id.success||!body.success)return reply.code(400).send({error:"Invalid employee update"});const result=await service.update(request.sessionRecord.principal,id.data,body.data);return result??reply.code(409).send({error:"Record changed; refresh and retry"});});
}
