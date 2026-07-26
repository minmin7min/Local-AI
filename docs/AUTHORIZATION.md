# Authorization matrix

| Capability | Employee | Manager | HR | Owner | Tenant admin |
|---|---:|---:|---:|---:|---:|
| Own approved record/deadlines | Yes | Yes | If linked | If linked | No by default |
| Direct-report operational fields | No | Yes | Yes | Configurable summary | No by default |
| Tenant operational employee fields | No | No | Yes | Yes, approved fields | No by default |
| Approved/current policy documents | By audience | By audience | By audience | By audience | Yes |
| Employee import/corrections | No | No | Yes | No | Yes |
| Document/version administration | No | No | No | No | Yes |
| Deadline summaries | Own | Team | Tenant | Tenant | System health only |
| Membership/role administration | No | No | No | Yes | Yes |
| Tenant audit viewer | No | No | No | No by default | Yes |

Roles are additive, tenant-scoped, and never inferred from UI state. Owner is not a sensitive-field bypass. Manager scope is based on effective reporting relationships. Field projection occurs before serialization and before evidence reaches AI.
