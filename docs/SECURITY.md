# Security, privacy, and threat model

## Trust boundaries and threats

The browser, uploaded files, extracted text, spreadsheet values, filenames, model output, and model-provider responses are untrusted. Key threats are cross-tenant IDOR/query manipulation; horizontal/vertical privilege escalation; session theft, brute force, and enumeration; SQL/XSS/CSRF/SSRF; malicious archives, formulas, active content, oversized files, parser exploits, and decompression bombs; prompt injection and citation forgery; jobs/caches/exports losing tenant context; and sensitive content leaking to logs, support users, backups, or AI vendors.

Controls include forced RLS plus composite tenant foreign keys; object and field authorization before retrieval; generic 404 denials; parameterized queries; output encoding and CSP; secure SameSite/HttpOnly cookies and CSRF tokens; Argon2id; auth rate limits; actual MIME detection, safe generated storage keys, quarantine and bounded parsing; no macro/formula execution; approved/current document gating; evidence-ID validation; tenant-prefixed cache/idempotency keys; metadata-only audit logs; and explicit, disabled-by-default support access.

Platform operators do not receive tenant content access. A future support workflow must require tenant approval, reason, narrow scope, short expiry, immutable audit events, prominent UI indication, and immediate revocation.

## Privacy and lifecycle

Collect only operational fields listed in the product scope. Salary, benefits, leave balances, emergency contacts, performance, disciplinary, medical, banking, passport, government-ID, and immigration data are disabled. Records are archived before retention deletion. Tenant export/deletion must run as tenant-scoped, resumable jobs; deletion includes database rows, object versions, search records, caches, and provider artifacts, followed by backup expiry documentation. Backups need encryption, tested restoration, access audit, and defined retention.

AI answers may be incomplete and are not employment, legal, immigration, medical, disciplinary, compensation, hiring, termination, or leave-approval decisions. Human approval is required for employee-impacting action. Provider data residency, retention, abuse monitoring, training use, subprocessors, deletion, and contractual controls must be verified.

## Unresolved pre-production risks

- MFA, recovery, breached-password checks, session-device UI, and a reviewed SSO path.
- Malware/CDR pipeline and hardened parser sandbox.
- External penetration test, privacy impact assessment, legal review, and cloud architecture review.
- Exact retention/deletion policy by jurisdiction and customer contract.
- Managed email provider and notification consent/deliverability controls.
- Load/abuse testing, disaster recovery objectives, and incident response exercises.
- Dependency/static/container scanning in CI and a reviewed software bill of materials.

No claim of compliance or production certification is made. Real employee information must not be introduced.
