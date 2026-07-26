# Synthetic demo runbook

This runbook is for fictional data only. Do not enter real employee, customer, policy, contract, medical, financial, government-ID, or authentication information.

## Start the complete local demo

```bash
docker compose up --build
docker compose run --rm -e DATABASE_URL=postgresql://pcai_runtime:local-runtime-development-only@db:5432/private_company_ai app node dist/scripts/seed.js
```

Open `http://127.0.0.1:3000`. All seeded accounts use the development-only password `Synthetic-Demo-Only-Change-Me!`.

Useful fictional accounts:

| Workspace | User | Role |
|---|---|---|
| `northstar` | `avery.morgan@northstar.example.invalid` | Employee |
| `northstar` | `jordan.lee@northstar.example.invalid` | Manager |
| `northstar` | `riley.chen@northstar.example.invalid` | HR |
| `northstar` | `casey.bennett@northstar.example.invalid` | Owner + tenant administrator |
| `cedar` | `avery.morgan@cedar.example.invalid` | Employee |
| `cedar` | `jordan.lee@cedar.example.invalid` | Manager |
| `cedar` | `riley.chen@cedar.example.invalid` | HR + tenant administrator |

If an older local Compose database volume predates the split migration/runtime roles, create a fresh synthetic demo volume. `docker compose down --volumes` permanently removes that local database and object-storage volume; use it only when no data needs to be retained.

## Representative walkthrough

1. Sign in as Northstar HR and import `samples/synthetic-employees.xlsx`. Confirm the preview before committing.
2. Sign in as the Northstar tenant administrator and upload `samples/synthetic-sick-leave-policy.docx`. The tenant-scoped worker moves it from processing to review; refresh Policies and approve it.
3. Sign in as Northstar employee Avery and ask, “I am sick and cannot work today. What should I do?” Verify the answer is grounded in the approved policy.
4. Open People and inspect Avery's own training, certification, and equipment record.
5. Sign in as manager Jordan and verify the direct report is visible while unrelated employees are absent.
6. Sign in as the tenant administrator and review users, roles, tenant settings, and recent audit events.
7. Sign in to Cedar and verify that Northstar records, policies, imports, citations, and audit events are unavailable.

## Expected safety behavior

- A changed cross-tenant identifier returns a generic denial.
- Unapproved documents never support ordinary answers.
- A question without approved evidence returns the fixed escalation response.
- Uploads reject unsupported content, formulas, oversized input, and unsafe filenames.
- User creation rejects addresses outside the synthetic `.example.invalid` namespace.
