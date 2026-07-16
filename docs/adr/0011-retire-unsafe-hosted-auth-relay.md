# ADR 0011: Retire the legacy hosted-auth relay path

- Status: Accepted
- Date: 2026-07-16

## Context

The reference Swift account ViewModel can complete a hosted handoff only when a
relay JSON body containing session material is supplied separately to
`completeHostedAuthCallback`. Its application lifecycle calls that method with
only the callback URL and no relay body. Reference tests also prove that relay
bodies, access tokens, session tokens, ID tokens, and refresh tokens embedded in
the callback URL must be rejected. Consequently the released lifecycle path
cannot complete this operation without violating the migration security rule.

The pinned `zmanager-core` revision provides relay validation and session
creation, but does not provide an opaque relay-handle exchange API that the
desktop can call after receiving a non-secret callback.

## Decision

Do not recreate the unreachable secret-bearing relay transport. The replacement
supports core-generated hosted launch URLs, state/expiry tracking, and
non-secret completed/cancelled/failed callback results. It exposes core-owned
local identity inventory, certificates, recipient keys, and contacts without
serializing private material to the frontend.

Network-backed session creation, enrollment/renewal/revocation, contact-card
exchange, and account-backed sharing are retired from the replacement contract
until `zmanager-core` offers a reviewed opaque-handle exchange. Existing local
certificate creation, certificate verification, recipient-certificate archive
creation, and encrypted extraction remain supported by the shared Create and
Archive Workspaces.

## Consequences

- No token, relay JSON, private key, or session material enters a URL, frontend
  snapshot, persistence, log, or diagnostic.
- The Account workspace reports callback completion, not authenticated-session
  completion.
- Reintroducing hosted sessions requires a new core API and a new ADR/security
  review; it must not weaken this callback contract.
