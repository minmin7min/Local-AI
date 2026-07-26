import type { SessionRecord, SessionStore } from "../domain/session.js";
import type { Principal } from "../domain/authz.js";
export class MemorySessionStore implements SessionStore {
  readonly sessions = new Map<string, SessionRecord>();
  readonly logins = new Map<string,{passwordHash:string;principal:Principal}>();
  addLogin(tenantSlug:string,email:string,passwordHash:string,principal:Principal): void { this.logins.set(`${tenantSlug}:${email}`,{passwordHash,principal}); }
  async findLogin(tenantSlug:string,email:string) { return this.logins.get(`${tenantSlug}:${email}`); }
  async create(record:SessionRecord) { this.sessions.set(record.idHash,record); }
  async findActive(idHash:string,now:Date) { const row=this.sessions.get(idHash); return row && !row.revokedAt && row.expiresAt>now ? row : undefined; }
  async revoke(idHash:string,now:Date) { const row=this.sessions.get(idHash); if(row) this.sessions.set(idHash,{...row,revokedAt:now}); }
}
