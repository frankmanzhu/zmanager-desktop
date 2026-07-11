# Triage labels

The engineering skills use five canonical triage roles. This table maps each
role to the actual GitHub label used by this repository.

| Canonical role | GitHub label | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | A maintainer still needs to evaluate the issue. |
| `needs-info` | `needs-info` | Progress is waiting for information from the reporter. |
| `ready-for-agent` | `ready-for-agent` | The issue is fully specified and can be completed without additional human context. |
| `ready-for-human` | `ready-for-human` | The issue requires human implementation, access, judgment, or coordination. |
| `wontfix` | `wontfix` | The issue will not be actioned. |

## State rules

- Treat these labels as workflow states. An issue should have no more than one
  of them at a time.
- Remove the previous workflow label when moving an issue to a new state.
- Classification labels such as `bug`, `enhancement`, and `documentation` may
  coexist with one workflow label.
- `ready-for-agent` means the issue contains acceptance criteria, relevant
  context, test expectations, and no unresolved product decision.
- Do not use `ready-for-human` merely because a task is difficult. Use it when
  the remaining work genuinely requires a person.

When a skill refers to a canonical role, use the corresponding GitHub label
from this table rather than creating a synonym.
