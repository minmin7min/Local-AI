import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type { Principal } from "./authz.js";

export const SESSION_COOKIE = "pcai_session";
export interface SessionRecord {
  idHash: string; csrfHash: string; principal: Principal; expiresAt: Date; revokedAt?: Date;
}
export interface SessionStore {
  findLogin(tenantSlug: string, email: string): Promise<{ passwordHash: string; principal: Principal } | undefined>;
  create(record: SessionRecord): Promise<void>;
  findActive(idHash: string, now: Date): Promise<SessionRecord | undefined>;
  revoke(idHash: string, now: Date): Promise<void>;
}
export interface SessionIssue { sessionToken: string; csrfToken: string; expiresAt: Date; principal: Principal }

export const hashOpaqueToken = (value: string): string => createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
}
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try { return await argon2.verify(hash, password); } catch { return false; }
}
export class SessionService {
  constructor(private readonly store: SessionStore, private readonly ttlSeconds: number) {}
  async login(tenantSlug: string, email: string, password: string, now = new Date()): Promise<SessionIssue | undefined> {
    const login = await this.store.findLogin(tenantSlug.trim().toLowerCase(), email.trim().toLowerCase());
    // Always run an expensive verification to reduce user-enumeration timing differences.
    const fallback = "$argon2id$v=19$m=19456,t=2,p=1$MDEyMzQ1Njc4OWFiY2RlZg$hcN3ZJyV3gEvlAxNU9gTsPaSFXPsqhVQC3d2Vmxpjm0";
    if (!(await verifyPassword(login?.passwordHash ?? fallback, password)) || !login) return undefined;
    const sessionToken = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    await this.store.create({ idHash: hashOpaqueToken(sessionToken), csrfHash: hashOpaqueToken(csrfToken), principal: login.principal, expiresAt });
    return { sessionToken, csrfToken, expiresAt, principal: login.principal };
  }
  async authenticate(sessionToken: string | undefined, now = new Date()): Promise<SessionRecord | undefined> {
    if (!sessionToken) return undefined;
    return this.store.findActive(hashOpaqueToken(sessionToken), now);
  }
  verifyCsrf(record: SessionRecord, token: string | undefined): boolean {
    if (!token) return false;
    const actual = Buffer.from(hashOpaqueToken(token));
    const expected = Buffer.from(record.csrfHash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  async logout(sessionToken: string | undefined, now = new Date()): Promise<void> {
    if (sessionToken) await this.store.revoke(hashOpaqueToken(sessionToken), now);
  }
}
