import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { roles } from "../domain/authz.js";
import { AdministrationService } from "../domain/administration.js";
import { SESSION_COOKIE, type SessionService } from "../domain/session.js";

const idSchema = z.uuid();
const roleSchema = z.enum(roles);
const createSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(14).max(1024),
  roles: z.array(roleSchema).min(1).max(5),
}).strict();
const roleUpdateSchema = z.object({ roles: z.array(roleSchema).min(1).max(5) }).strict();
const settingsSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  retentionDays: z.number().int().min(30).max(3650).optional(),
  reminderDays: z.array(z.number().int().min(1).max(365)).min(1).max(12).optional(),
  inAppNotifications: z.boolean().optional(),
}).strict();

export function registerAdministrationRoutes(app: FastifyInstance, sessions: SessionService, service: AdministrationService): void {
  const auth = async (request: any, reply: any) => {
    const record = await sessions.authenticate(request.cookies[SESSION_COOKIE]);
    if (!record) { await reply.code(401).send({ error: "Authentication required" }); return; }
    request.sessionRecord = record;
  };
  const csrf = (request: any, reply: any) => {
    if (!sessions.verifyCsrf(request.sessionRecord, request.headers["x-csrf-token"])) {
      reply.code(403).send({ error: "Invalid request verification token" });
      return false;
    }
    return true;
  };

  app.get("/api/admin/members", { preHandler: auth }, async (request: any) => ({ members: await service.listMembers(request.sessionRecord.principal) }));
  app.post("/api/admin/members", { preHandler: auth }, async (request: any, reply) => {
    if (!csrf(request, reply)) return;
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid synthetic user" });
    return reply.code(201).send(await service.createMember(request.sessionRecord.principal, body.data, request.id));
  });
  app.put("/api/admin/members/:id/roles", { preHandler: auth }, async (request: any, reply) => {
    if (!csrf(request, reply)) return;
    const id = idSchema.safeParse(request.params.id); const body = roleUpdateSchema.safeParse(request.body);
    if (!id.success || !body.success) return reply.code(400).send({ error: "Invalid role update" });
    return (await service.replaceRoles(request.sessionRecord.principal, id.data, body.data.roles, request.id)) ?? reply.code(404).send({ error: "Resource not found or access denied" });
  });
  app.post("/api/admin/members/:id/deactivate", { preHandler: auth }, async (request: any, reply) => {
    if (!csrf(request, reply)) return;
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) return reply.code(404).send({ error: "Resource not found or access denied" });
    return (await service.deactivateMember(request.sessionRecord.principal, id.data, request.id)) ? reply.code(204).send() : reply.code(404).send({ error: "Resource not found or access denied" });
  });
  app.get("/api/admin/settings", { preHandler: auth }, async (request: any) => service.getSettings(request.sessionRecord.principal));
  app.patch("/api/admin/settings", { preHandler: auth }, async (request: any, reply) => {
    if (!csrf(request, reply)) return;
    const body = settingsSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid tenant settings" });
    return service.updateSettings(request.sessionRecord.principal, body.data, request.id);
  });
}
