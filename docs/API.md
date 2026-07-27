# API overview

All protected endpoints use the opaque `pcai_session` cookie. Mutating endpoints additionally require the `x-csrf-token` returned by login. Identifiers never establish tenant authority; the active membership establishes tenant context. Inaccessible objects return a generic denial.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Resolve tenant membership and issue a revocable session |
| GET | `/api/auth/me` | Return the active tenant identity and roles |
| POST | `/api/auth/logout` | CSRF-protected session revocation |
| POST | `/api/auth/invitations/inspect` | Resolve an unexpired one-time invitation without exposing the token in the URL |
| POST | `/api/auth/invitations/accept` | Atomically activate an invited account and consume the token |
| GET/PATCH | `/api/employees[/:id]` | Scope-filtered employee operations read/update |
| GET | `/api/employees/:id/operations` | Scope-filtered training, certification, and equipment detail |
| POST | `/api/employees/:id/training` | HR-managed training record with deadline generation |
| POST | `/api/employees/:id/certifications` | HR-managed certification with renewal deadline generation |
| POST | `/api/employees/:id/equipment` | HR-managed equipment assignment |
| PUT | `/api/employees/:id/manager` | HR-managed effective reporting relationship |
| POST | `/api/imports/preview` | Validate and persist CSV/XLSX preview rows |
| GET | `/api/imports/:id` | Retrieve the tenant-scoped preview and errors |
| POST | `/api/imports/:id/commit` | Explicit, locked, idempotent import commit |
| GET/POST | `/api/documents` | Authorized library listing and secure upload |
| POST | `/api/documents/:id/approve` | Approve a reviewed version and make it current |
| GET | `/api/documents/:id/download` | Authorized private file download |
| POST | `/api/chat/ask` | Structured/document retrieval and grounded answer |
| GET | `/api/citations/:id/source` | Authorized citation source preview |
| GET | `/api/dashboard` | Role-scoped operational counts |
| GET | `/api/deadlines` | Scope-filtered deadlines and window classification |
| GET | `/api/notifications` | Current membership's in-app notifications |
| GET | `/api/audit` | Tenant-admin audit viewer feed |
| GET/POST | `/api/admin/members` | List or create synthetic tenant users |
| POST | `/api/admin/invitations` | Create a tenant-scoped, 48-hour, single-use synthetic account invitation |
| PUT | `/api/admin/members/:id/roles` | Replace a membership's additive role set with last-admin protection |
| POST | `/api/admin/members/:id/deactivate` | Deactivate a membership and revoke its sessions |
| GET/PATCH | `/api/admin/settings` | View or update tenant timezone, retention, and reminder settings |

Errors contain a request ID and omit existence details. API response schemas should be published as OpenAPI before an external integration is supported.
