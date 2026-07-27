import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { roles } from "../domain/authz.js";
import { InvitationService } from "../domain/invitations.js";
import { SESSION_COOKIE, type SessionService } from "../domain/session.js";

const roleSchema = z.enum(roles);
const createSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().trim().min(2).max(120),
  roles: z.array(roleSchema).min(1).max(5),
}).strict();
const tokenSchema = z.string().min(32).max(200);
const inspectSchema = z.object({ token: tokenSchema }).strict();
const acceptSchema = z.object({ token: tokenSchema, password: z.string().min(14).max(1024) }).strict();

export function registerInvitationRoutes(app: FastifyInstance, sessions: SessionService, service: InvitationService): void {
  const auth = async (request: any, reply: any) => {
    const record = await sessions.authenticate(request.cookies[SESSION_COOKIE]);
    if (!record) { await reply.code(401).send({ error: "Authentication required" }); return; }
    request.sessionRecord = record;
  };

  app.post("/api/admin/invitations", { preHandler: auth }, async (request: any, reply) => {
    if (!sessions.verifyCsrf(request.sessionRecord, request.headers["x-csrf-token"])) return reply.code(403).send({ error: "Invalid request verification token" });
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid invitation" });
    return reply.code(201).send(await service.create(request.sessionRecord.principal, body.data, request.id));
  });

  app.post("/api/auth/invitations/inspect", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = inspectSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "This invitation is invalid or has expired" });
    return service.inspect(body.data.token);
  });

  app.post("/api/auth/invitations/accept", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = acceptSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid account setup request" });
    return reply.code(201).send(await service.accept(body.data.token, body.data.password, request.id));
  });
}
