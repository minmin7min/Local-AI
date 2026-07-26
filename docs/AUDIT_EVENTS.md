# Audit event catalog

| Action | Trigger | Metadata policy |
|---|---|---|
| `auth.success` / `auth.failure` | Login attempt | Tenant/workspace and outcome; never password or session token |
| `auth.logout` | Session revocation | Session event only; never token hash |
| `employee.create/update/archive` | Operational record mutation | Changed field names and version, not full before/after sensitive values |
| `import.preview` | Preview persisted | Valid/invalid row counts, file hash, batch ID |
| `import.commit` | Confirmed commit | Created/skipped counts and batch ID |
| `document.upload` | Original quarantined/stored | MIME, byte count, hash, version ID; no contents |
| `document.approved/rejected/archived` | State transition | Previous/new state and version ID |
| `document.download` | Authorized original access | Version ID and outcome |
| `policy.question` | Q&A request | Non-reversible short question fingerprint and evidence count, not raw prompt |
| `citation.preview` | Source preview access | Citation ID and outcome |
| `deadline.update` | Deadline mutation | Type, due-date field change, and resource ID |
| `membership.role_change` | Role administration | Role identifiers and target membership |

Audit metadata is recursively redacted for keys resembling credentials, secrets, content, government IDs, banking, medical, and other prohibited data. Authentication events that occur before membership resolution need a separate operational security log or controlled database function in the next hardening slice.
