# Private Company AI

A security-first foundation for a multi-tenant employee-operations assistant. **Synthetic data only. Not approved for production or real employee information.**

Implemented foundations include a normalized PostgreSQL schema, forced row-level security, tenant-scoped composite constraints, opaque sessions, additive authorization, employee operations APIs, CSV/XLSX preview and commit, document upload/extraction/approval, authorized retrieval and citations, deadlines, notifications, audit viewing, a responsive browser UI, synthetic fixtures, and release-blocking isolation tests.

Start with [Architecture](docs/ARCHITECTURE.md), [Security](docs/SECURITY.md), [Authorization](docs/AUTHORIZATION.md), [API](docs/API.md), [Audit events](docs/AUDIT_EVENTS.md), and [Operations](docs/OPERATIONS.md).

```bash
cp .env.example .env
npm install
npm run db:migrate
npm test
npm run typecheck
npm run dev
```

For a containerized local database, run `docker compose up -d db`, then run migrations and the synthetic seed locally. Process one document job with `npm run worker -- <tenant-uuid>` and generate idempotent in-app reminders with `npm run reminders -- <tenant-uuid>`.
