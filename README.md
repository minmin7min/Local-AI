# Private Company AI

A security-first foundation for a multi-tenant employee-operations assistant. **Synthetic data only. Not approved for production or real employee information.**

Implemented foundations include a normalized PostgreSQL schema, forced row-level security, tenant-scoped composite constraints, additive authorization policies, safe import validation, document lifecycle/upload validation, grounded AI provider abstraction, citation validation, deadline windows/idempotency, audit redaction, and release-blocking isolation unit tests.

Start with [Architecture](docs/ARCHITECTURE.md), [Security](docs/SECURITY.md), [Authorization](docs/AUTHORIZATION.md), and [Operations](docs/OPERATIONS.md).

```bash
cp .env.example .env
npm install
npm run db:migrate
npm test
npm run typecheck
npm run dev
```
