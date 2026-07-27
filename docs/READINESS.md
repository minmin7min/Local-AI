# Product and launch readiness

## Current stage

The repository is a functional, synthetic-data MVP and sales-demo foundation. It is suitable for customer discovery, recorded demos, and controlled design-partner evaluation using fictional data. It is **not** approved for real employee information or production deployment.

| Gate | Status | Evidence / remaining work |
|---|---|---|
| Secure application foundation | Implemented | Opaque sessions, CSRF, rate limits, strict validation, RLS design, redacted logs |
| Core employee-operations demo | Implemented | Employee scope, imports, training, certifications, equipment, reporting, deadlines |
| Policy knowledge workflow | Implemented | Upload, isolated extraction, review, approval, retrieval, citations, no-answer path |
| Tenant administration | Implemented | Synthetic users, role lifecycle, settings, session revocation, last-admin protection |
| Local reproducible deployment | Implemented and CI-verified | Compose splits migration and runtime roles, runs tenant-scoped workers, and uses the runner PostgreSQL service in CI |
| Automated application checks | Passing locally and in GitHub | Lint, strict type-check, 45 unit/security tests, and the production build passed in [CI run #32](https://github.com/minmin7min/Local-AI/actions/runs/30230050645) |
| PostgreSQL/RLS integration checks | Passing locally and in GitHub | Seven tests execute with a non-owner/no-`BYPASSRLS` role and passed in [CI run #32](https://github.com/minmin7min/Local-AI/actions/runs/30230050645) |
| Dependency security | Passing | npm reports zero known vulnerabilities; high-severity production findings fail CI while advisory-service outages remain visible warnings |
| End-to-end browser suite | Core journeys passing in GitHub | Four Chromium tests gate full-demo entry, grounded answers, employee records, administration, invitation activation, role visibility, and cross-tenant denial in [CI run #32](https://github.com/minmin7min/Local-AI/actions/runs/30230050645); destructive upload/import workflows remain to automate |
| Production identity | In progress; blocked for real use | Hashed 48-hour one-time invitations and password setup are implemented. Secure email delivery, address verification, MFA, recovery, breached-password checks, session-device controls, and reviewed SSO remain |
| Production file security | Blocked for real use | Malware/CDR scanning, hardened parser sandbox, encrypted private object storage |
| Production infrastructure | Blocked | Managed database/object storage/secrets, TLS ingress, monitoring, alerting, backups, restore test, IaC |
| Privacy/legal/security approval | Blocked | Privacy impact assessment, contracts/DPA, retention/deletion policy, legal review, threat-model review, penetration test |
| Useful production AI provider | Blocked | Provider selection, contract/privacy review, residency/retention controls, evals, budgets, timeouts, observability |

## What can happen now

- Demonstrate the product using only the supplied fictional tenants and sample files.
- Interview prospective small-business owners, managers, and HR operators about the workflows and quantify time spent finding policies and tracking expirations.
- Recruit a small number of design partners under an explicit synthetic-data/no-production-data constraint.
- Validate the initial niche, buyer, onboarding motion, required integrations, and willingness to pay before expanding the build.
- Prepare brand, sales materials, a waitlist, and a pilot agreement that clearly states the product's preview limitations.

## Mandatory gates before real customer data

1. Confirm every GitHub release-blocking check is green, including the real PostgreSQL/RLS suite.
2. Deploy to a private staging environment with separate migration, application, and worker identities.
3. Complete MFA, recovery, invitations, authentication audit capture, and secure email delivery.
4. Add malware scanning/CDR, parser isolation and resource limits, production object storage, and key rotation.
5. Implement and rehearse tenant export, deletion, backup restoration, incident response, and support-access approval.
6. Run accessibility, load/abuse, container/IaC, end-to-end, and penetration tests; resolve high-severity findings.
7. Obtain professional privacy, legal, employment-data, cloud-security, and AI-provider contract reviews.
8. Replace the deterministic demo provider only after authorized-provider data handling and grounded-answer evaluations pass.
9. Remove the synthetic-only restriction only through a reviewed release decision with documented evidence.

## Recommended next engineering sequence

1. Extend the full-stack browser suite to destructive import/upload/approval workflows.
2. Complete secure invitation email delivery, email verification, MFA, and recovery.
3. Build production staging infrastructure and observability.
4. Add malware/CDR scanning and sandboxed document parsing.
5. Implement export/deletion and backup-restore rehearsals.
6. Integrate and evaluate a privacy-reviewed AI provider.

Passing an automated test suite is necessary but does not make the business legally compliant, production-certified, or safe for real employee data.
