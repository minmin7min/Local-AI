import { randomBytes } from "node:crypto";
import { requirePermission, roles, type Principal, type Role } from "./authz.js";
import { hashOpaqueToken, hashPassword } from "./session.js";

export interface InvitationView {
  invitationId: string;
  tenantSlug: string;
  tenantName: string;
  email: string;
  displayName: string;
  roles: Role[];
  expiresAt: string;
}

export interface InvitationAcceptance {
  tenantSlug: string;
  email: string;
  membershipId: string;
}

export interface InvitationRepository {
  create(principal: Principal, input: { email: string; displayName: string; roles: Role[]; tokenHash: string; expiresAt: Date }, requestId: string): Promise<InvitationView>;
  resolve(tokenHash: string, now: Date): Promise<InvitationView | undefined>;
  accept(tokenHash: string, passwordHash: string, now: Date, requestId: string): Promise<InvitationAcceptance | undefined>;
}

export class InvitationError extends Error {
  constructor(message: string, readonly statusCode = 400) { super(message); }
}

function normalizedRoles(input: Role[]): Role[] {
  const result = [...new Set(input)];
  if (result.length === 0 || result.some((role) => !roles.includes(role))) throw new InvitationError("At least one valid role is required");
  return result;
}

function invitationHash(token: string): string {
  if (token.length < 32 || token.length > 200) throw new InvitationError("This invitation is invalid or has expired");
  return hashOpaqueToken(token);
}

export class InvitationService {
  constructor(private readonly repository: InvitationRepository, private readonly ttlMs = 48 * 60 * 60 * 1000) {}

  async create(principal: Principal, input: { email: string; displayName: string; roles: Role[] }, requestId: string, now = new Date()) {
    requirePermission(principal, "membership:manage");
    const email = input.email.trim().toLowerCase();
    if (!email.endsWith(".example.invalid")) throw new InvitationError("This preview accepts synthetic .example.invalid accounts only");
    const setupToken = randomBytes(32).toString("base64url");
    const invitation = await this.repository.create(principal, {
      email,
      displayName: input.displayName.trim(),
      roles: normalizedRoles(input.roles),
      tokenHash: hashOpaqueToken(setupToken),
      expiresAt: new Date(now.getTime() + this.ttlMs),
    }, requestId);
    return { ...invitation, setupToken };
  }

  async inspect(token: string, now = new Date()): Promise<InvitationView> {
    const invitation = await this.repository.resolve(invitationHash(token), now);
    if (!invitation) throw new InvitationError("This invitation is invalid or has expired");
    return invitation;
  }

  async accept(token: string, password: string, requestId: string, now = new Date()): Promise<InvitationAcceptance> {
    const passwordHash = await hashPassword(password);
    const result = await this.repository.accept(invitationHash(token), passwordHash, now, requestId);
    if (!result) throw new InvitationError("This invitation is invalid or has expired");
    return result;
  }
}
