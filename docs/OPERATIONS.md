# Operations and readiness

## Local setup

1. Install Node.js 22+ and PostgreSQL 16+.
2. Copy `.env.example` to `.env` and replace every placeholder locally.
3. Create a database and ensure the runtime user does not own tables or have `BYPASSRLS`.
4. Run `npm install`, `npm run db:migrate`, `npm test`, `npm run typecheck`, then `npm run dev`.
5. Open `http://127.0.0.1:3000`. Use synthetic data only.

## Backup and recovery

Take encrypted database backups and versioned object-store backups on compatible schedules. Record recovery point and recovery time objectives, regularly restore into an isolated environment, verify database/object consistency and RLS policies, and document backup expiry after tenant deletion. Restrict and audit restore access. Never use production data in development restores.

## Security checklist

- Runtime DB roles cannot own tables or bypass RLS; RLS regression tests are release blocking.
- TLS, secure cookies, CSRF, CSP, rate limits, secret rotation, outbound allowlists, and encrypted storage are configured.
- Upload quarantine, MIME/size/page/archive limits, malware scanning, sandboxing, and storage authorization are verified.
- Dependency, static, container, IaC, accessibility, performance, and penetration tests pass.
- Provider privacy terms and no-training/retention settings are contractually verified.
- Export, deletion, backup restore, incident response, and support-access workflows are exercised.
- Synthetic-only warning is visible; legal/privacy/cloud-security approvals are recorded before real data.

## Known MVP limitations

The current MVP does not make the platform production-ready. MFA, account recovery, email delivery, OCR, malware/CDR scanning, vector retrieval, a production AI provider, time-limited support access, membership-management UI, tenant export/deletion execution, automated authentication audit capture, full end-to-end browser testing, and production infrastructure are intentionally restricted or pending. The deterministic AI provider is safe for tests and demonstrations, not a useful production model.
