# Domain documentation

ZManager Desktop uses a single-context documentation layout. Engineering
skills should use these files to learn the project's vocabulary, boundaries,
and durable decisions before proposing or changing architecture.

## Read before exploring

1. Read `/CONTEXT.md` for the domain glossary, ownership boundaries, invariants,
   and source map.
2. Read ADRs under `/docs/adr/` that touch the area being changed.
3. Consult `/docs/ARCHITECTURE.md`, `/docs/REQUIREMENTS.md`, and focused plans
   only when the task needs their additional detail.

If a referenced document does not exist, proceed without treating its absence
as a blocker.

## Use the established vocabulary

Use terms as defined in `CONTEXT.md` in issue titles, plans, tests, refactoring
proposals, and implementation notes. Do not introduce a synonym when the
glossary already names the concept.

If a required concept is missing, first determine whether existing language
already covers it. Record a genuine new concept in `CONTEXT.md` when the user
or an architectural decision establishes it.

## Respect architectural decisions

ADRs record decisions that should survive individual implementation tasks. If
proposed work contradicts an accepted ADR, identify the conflict explicitly
and explain why the decision should be revisited. Do not silently override it.

Create a new ADR when a decision materially changes ownership, process
boundaries, security posture, persistence, command contracts, window lifecycle,
or another cross-cutting architectural constraint. Do not create ADRs for
routine implementation details.

## Keep documentation current

Update `CONTEXT.md` when project vocabulary or domain ownership changes. Update
or supersede an ADR when a durable decision changes. Prefer linking focused
implementation plans from these documents instead of copying large plans into
the domain glossary.
