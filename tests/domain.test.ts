import { describe, expect, it } from "vitest";
import { can, type Principal } from "../src/domain/authz.js";
import { deadlineWindow, reminderKey } from "../src/domain/deadlines.js";
import { validateRows, neutralizeSpreadsheetFormula } from "../src/domain/imports.js";
import { DeterministicProvider, NO_ANSWER, validateAnswer } from "../src/domain/ai.js";
import { redactAuditMetadata } from "../src/domain/audit.js";
import { canTransitionDocument, safeFilename } from "../src/domain/documents.js";
const p = (roles: Principal["roles"]): Principal => ({userId:"u",tenantId:"t",membershipId:"m",roles});

describe("domain security", () => {
  it("evaluates additive roles without owner implying sensitive administration", () => {
    expect(can(p(["employee"]),"employee:tenant:read")).toBe(false);
    expect(can(p(["owner"]),"document:manage")).toBe(false);
    expect(can(p(["hr","tenant_admin"]),"employee:write")).toBe(true);
  });
  it("calculates deadline windows and idempotency", () => {
    const now = new Date("2030-01-01T00:00:00Z");
    expect(deadlineWindow(new Date("2029-12-31T00:00:00Z"),now)).toBe("overdue");
    expect(deadlineWindow(new Date("2030-01-31T00:00:00Z"),now)).toBe("30");
    expect(reminderKey("t","d","30")).toBe("t:deadline:d:30");
  });
  it("validates imports and rejects duplicates", () => {
    const row = {internalEmployeeId:"S-1",displayName:"Synthetic Person",workEmail:"person@example.invalid",department:"Ops",position:"Associate",employmentStatus:"active",employmentCategory:"full_time",startDate:"2030-01-01"};
    const result = validateRows([row,row]);
    expect(result[0]?.errors).toEqual([]); expect(result[1]?.errors[0]).toMatch(/Duplicate/);
    expect(neutralizeSpreadsheetFormula("=cmd()" )).toBe("'=cmd()");
  });
  it("never answers without evidence and validates citations", async () => {
    const provider = new DeterministicProvider();
    expect((await provider.answer("unknown",[])).answer).toBe(NO_ANSWER);
    expect(() => validateAnswer({answer:"x",factualStatement:"x",evidenceIds:["bad"]},[])).toThrow();
  });
  it("redacts sensitive audit metadata", () => expect(redactAuditMetadata({password:"bad",documentContent:"secret",safe:"ok"})).toEqual({safe:"ok"}));
  it("enforces document workflow and safe names", () => {
    expect(canTransitionDocument("review","approved")).toBe(true); expect(canTransitionDocument("processing","approved")).toBe(false);
    expect(safeFilename("../../policy<script>.pdf")).toBe("policy_script_.pdf");
  });
});
