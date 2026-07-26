# Private Company AI

A security-first foundation for a multi-tenant employee-operations assistant. **Synthetic data only. Not approved for production or real employee information.**

Implemented foundations include a normalized PostgreSQL schema, forced row-level security, tenant-scoped composite constraints, opaque sessions, additive authorization, employee operations APIs, CSV/XLSX preview and commit, document upload/extraction/approval, authorized retrieval and citations, deadlines, notifications, audit viewing, a responsive browser UI, synthetic fixtures, and release-blocking isolation tests.

Start with [Architecture](docs/ARCHITECTURE.md), [Security](docs/SECURITY.md), [Authorization](docs/AUTHORIZATION.md), [API](docs/API.md), [Audit events](docs/AUDIT_EVENTS.md), and [Operations](docs/OPERATIONS.md).

```bash
cp .env.example .env
npm ci
npm run db:migrate
npm test
npm run typecheck
npm run dev
```

For the quickest synthetic-only demo, run `docker compose up --build`. Compose provisions a non-owner runtime database role, applies migrations with a separate administrative connection, starts tenant-scoped document workers, and starts the app at `http://127.0.0.1:3000`. Seed it once with `docker compose run --rm -e DATABASE_URL=postgresql://pcai_runtime:local-runtime-development-only@db:5432/private_company_ai app node dist/scripts/seed.js`.

CI has three explicit signals: release-blocking code quality, release-blocking PostgreSQL/RLS integration tests, and a visible non-blocking dependency advisory report. Dependabot opens grouped dependency and GitHub Actions updates. A temporary registry/advisory outage therefore cannot mark tested application code as broken, while security findings remain visible and must be triaged before release.

Process one document job with `npm run worker -- <tenant-uuid>` and generate idempotent in-app reminders with `npm run reminders -- <tenant-uuid>`.
