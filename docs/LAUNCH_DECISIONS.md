# Launch decisions and execution queue

The fastest responsible path is to sell the problem and recruit design partners now, while keeping all product use fictional until the mandatory security, privacy, and infrastructure gates in `READINESS.md` are complete.

## Recommended initial wedge

- Buyer: owner, operations lead, or HR lead at a 20–100 person multi-location service business.
- Starting workflows: approved-policy questions, employee training/certification deadlines, and controlled employee imports.
- Initial verticals to interview: café/restaurant groups and property-service companies, matching the two synthetic demo tenants.
- Design-partner goal: three to five companies willing to complete workflow interviews and synthetic-data demos. Do not accept real employee files yet.
- Pricing discovery hypothesis: test a paid onboarding fee plus a monthly per-company subscription; do not publish a final price until at least ten buyer interviews reveal willingness to pay and the cost of the current problem.

## Founder decisions that unblock engineering

| Priority | Decision | Recommended default | What it unlocks |
|---|---|---|---|
| 1 | Primary customer jurisdiction | Choose one country and province/state for the first pilots | Counsel can define retention, deletion, employment-data, privacy, and contract requirements |
| 2 | Managed cloud and region | One provider, one nearby data region, separate staging and production accounts | Infrastructure as code, secrets, TLS, backups, monitoring, and restore testing |
| 3 | Transactional email provider and sending domain | Dedicated subdomain with SPF, DKIM, and DMARC; provider must support suppression and delivery events | Real invitation delivery, address verification, MFA/recovery messages, and audit evidence |
| 4 | Authentication direction | Passkeys/TOTP for the first release; evaluate SSO only when a design partner requires it | MFA, recovery, device/session management, and an identity threat-model review |
| 5 | AI provider and data controls | Select only after written review of residency, retention, training use, abuse monitoring, subprocessors, deletion, and DPA terms | Useful model-backed answers, evaluation runs, budgets, timeouts, and provider observability |
| 6 | File-security services | Private object storage plus malware scanning and parser isolation | Controlled staging with representative fictional uploads; later approval for real files |
| 7 | Legal/security reviewers | Privacy/employment counsel and an independent application-security tester | Pilot agreement, DPA/privacy materials, threat-model review, and penetration-test evidence |

## Work Codex can continue without those decisions

1. Extend browser tests to import preview/commit and document upload/worker/approval.
2. Add MFA and recovery domain models behind development-only delivery adapters.
3. Implement session/device listing and selective revocation.
4. Add tenant export/deletion jobs and audit evidence.
5. Add OpenAPI schemas, accessibility checks, abuse/load tests, and an SBOM.
6. Scaffold provider interfaces and infrastructure modules without selecting paid vendors.

## Business launch checklist

- Prepare a five-minute synthetic demo using `DEMO_RUNBOOK.md`.
- Interview ten target buyers; record current tools, minutes per task, error cost, security objections, required integrations, and purchase authority.
- Recruit three to five design partners under a written fictional-data/no-production-data limitation.
- Create a one-page problem statement and waitlist; avoid compliance, security-certification, or production-readiness claims.
- Define pilot success measures before building custom features: policy-answer accuracy, time to find an answer, overdue-record reduction, setup time, and weekly active operators.
- Convert a design partner to a real-data pilot only after every mandatory gate in `READINESS.md` has documented evidence and professional approval.

## Definition of “ready to sell”

- Ready now: discovery interviews, synthetic demonstrations, and carefully scoped design-partner agreements.
- Ready later for real customer data: green release checks, private staging, production identity, file security, managed infrastructure, backup/restore rehearsal, provider review, legal/privacy approval, and penetration testing.

Revenue urgency does not change the data boundary: real employee information remains prohibited until those gates are complete.
