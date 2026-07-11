# Architecture decision records

This directory contains durable architectural decisions for ZManager Desktop.
Use an ADR when a decision changes ownership, process boundaries, security
posture, persistence, command contracts, window lifecycle, or another
cross-cutting constraint.

## Naming

Use a four-digit sequence and a concise kebab-case title:

```text
0001-example-decision.md
```

## Template

```markdown
# ADR-NNNN: Decision title

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD

## Context

What forces and constraints require a decision?

## Decision

What did we decide?

## Consequences

What becomes easier, harder, required, or intentionally unsupported?

## Verification

How can maintainers prove the decision remains enforced?
```

Do not manufacture historical ADRs after the fact. Record an existing decision
only when its current owner confirms it, and link a superseding ADR instead of
silently rewriting an accepted decision.
