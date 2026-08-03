# TZAP Local Identity Inventory and GUI Consolidation Plan

## Status

- **Document type:** cross-repository implementation plan and compatibility contract
- **Primary goal:** make the local TZAP inventory secure and give the desktop application one coherent identity, contact, signing, and recipient-selection flow
- **Server status:** certificate-service and hosted-account work is incomplete; server-dependent behavior is explicitly capability-gated
- **Current delivery scope:** local-only inventory and archive workflows are the release target; hosted authentication, enrollment, renewal, revocation, and online status remain optional disabled capabilities
- **Current desktop security boundary:** [ADR 0011](adr/0011-retire-unsafe-hosted-auth-relay.md) remains in force until the replacement handoff exchange passes the readiness gate in this plan
- **Last specification review:** 2026-08-03

This replaces the earlier UI-first plan. Consolidation is not a matter of putting the current file pickers behind an Account screen. It requires a split between public inventory metadata and private material, ID-based archive commands, verified contact-card import, safe migration, and explicit alignment with the certificate-service contracts.

---

## 1. Outcome

When this plan is complete:

1. The desktop has one local **Identity & Contacts** workspace for enrolled signing identities, the user's recipient keys, trusted contacts, lifecycle state, and local display aliases.
2. The Create workspace selects inventory records by opaque local ID. It does not persist private-key paths or receive private-key bytes.
3. Rust resolves selected IDs at job handoff, revalidates them, obtains private material through a secure-store interface, and passes it to `zmanager-core` without command-line arguments or plaintext temporary files.
4. Private keys and session material are stored in native OS secure storage. Public certificates, contact cards, fingerprints, status cache entries, labels, and references are stored in a versioned public catalog.
5. Recipient contacts can only become trusted contacts through signed contact-card verification and explicit acceptance. An arbitrary certificate may be used once as an advanced recipient input, but it is not silently promoted to a trusted contact.
6. The old Preferences signing-path defaults are removed. The inventory contains one `default_signing_identity_id` reference; certificates do not each carry an independent default boolean.
7. Server-independent inventory, contact, archive-signing, and recipient-encryption work can ship before the hosted server is ready.
8. Hosted sign-in, session bootstrap, enrollment, renewal, revocation, and online status are enabled only when their exact normative contracts are implemented and tested. The desktop never restores the retired secret-bearing hosted-auth relay.

The local inventory is the source of truth for local capabilities. The hosted Account site remains the source of truth for cross-device account management and server-side revocation. These are related views, not interchangeable stores.

---

## 2. Normative specification baseline

The user-provided path used `spec/`; the current certificate-service checkout stores these documents under `specs/`:

`/Users/frankzhu/Documents/cert-root-server/specs/`

The plan was checked against certificate-service commit:

`089536f2ef7454fe8f53f362837f4b578448669d`

Normative documents, in precedence order:

1. `specs/shared-trust-model.md` — shared identifiers, algorithms, certificate profile, status semantics, official-root pinning, custom trust, and rollover.
2. `specs/zmanager-obligations.md` — native-client authentication, device key and CSR ownership, enrollment, local signing, recipient keys, contact cards, multi-recipient wrapping, and verification behavior.
3. `specs/login-tzap-org-obligations.md` — hosted authentication, one-time handoff exchange, sessions, organization policy, and hosted Account responsibilities.
4. `specs/sign-tzap-org-obligations.md` — certificate challenge, enrollment, renewal, revocation, denial, and public status APIs.
5. `specs/signup-tzap-org-registration-service.md` — hosted signup, provider availability, callback constraints, and the login-to-enrollment start point.
6. `specs/operations-and-recovery.md` — root rollover, emergency blocklist, operational recovery, and release integrity.
7. `specs/README.md` — service-boundary map and document ownership.

`specs/cert-root-server-spec.md` was also checked, but it is a deprecated index and is not a source of new requirements. It directs consumers to the split documents above.

### 2.1 Specification provenance in CI

CI must not depend on the absolute path above. Before implementation begins, add a checked-in specification-baseline manifest to each consuming repository. The manifest must record:

- source repository and commit;
- each normative file path and SHA-256;
- the client contract version implemented by the repository;
- the date and owner of the last compatibility review.

Contract fixtures and schemas used by tests must be checked into the consuming repository with that provenance. They must not be independently invented examples that can drift from the prose. Updating the baseline requires a review of the drift ledger in section 9.

### 2.2 Precedence rule

If the current code, this plan, a fixture, or an older test conflicts with the normative documents, the normative documents win unless a deliberate exception is recorded in a new ADR and coordinated with the certificate-service owners. Tolerant readers may support a documented legacy response for migration, but writers must emit the current normative shape. There must be no silent protocol auto-detection.

### 2.3 Normative client wire anchors

The conformance fixtures must preserve at least these exact anchors so a renamed “spec” profile cannot continue testing an older protocol:

- Native auth exchange is `POST /auth/session/exchange`. Its request fields are `client_id`, `redirect_uri`, `state`, `handoff_code`, `code_verifier`, and `required_audience`. Its success fields include `user_id`, `session_id`, `session_token`, `caller_type`, `identity_assurance_level`, and RFC 3339 `expires_at`.
- Enrollment challenge is `POST /v1/certificates/enrollment-challenges`. The request binds `operation`, `csr_sha256`, `device_public_key_fingerprint`, optional `org_id`, `requested_validity_days`, and `renewal_of_certificate_sha256`.
- New issuance uses `POST /v1/certificates/enroll` with `operation = enroll`; renewal uses `POST /v1/certificates/:certificate_id/renew` with `operation = renew`. Both send `challenge_id`, P1363 `challenge_signature`, `csr_pem`, `device_name`, public-key fingerprint, organization scope, and validity days. Renewal also follows the normative old-certificate proof and renewal-key policy.
- Enrollment success returns public `certificate_id`, `sign_device_id`, leaf/chain, issuer identifiers, canonical fingerprint/serial, and RFC 3339 validity. It does not return a login-internal organization-device linkage ID. The pinned root is omitted from `chain_pem`.
- Generic issuance denials are non-success responses with stable `error`, `denial_reason`, `retryable`, and optional safe `message`. Approval-required responses additionally carry the approval identifiers, but the issuance attempt must restart with a fresh challenge after approval.
- Bulk status is `POST /v1/status/bulk` with `lookups`. The response key is `responses`; each ordered item contains caller `lookup_id`, sibling `queried`, and `status_response`. Identifiers are canonical fingerprints or issuer-plus-serial, not internal IDs, and freshness fields are UTC RFC 3339.

---

## 3. Canonical terminology and ownership

The implementation and UI must use these terms consistently:

| Term | Meaning | Owner |
|---|---|---|
| **Local Identity Inventory** | Public catalog plus secure references to material available on this installation | Native desktop/core boundary |
| **Identity & Contacts workspace** | GUI management view over the local inventory | React UI + app workspace/controller |
| **Hosted Account** | Browser-hosted cross-device account/device listing and revocation | `login.tzap.org` |
| **Enrolled signing identity** | Device-generated signing key plus a currently known certificate chain issued under TZAP policy | Local inventory; status authority is server |
| **Imported P12 signing identity** | User-provided P12/PFX whose private key matches its leaf certificate | Local inventory after explicit validation; not an official enrollment |
| **Local alias** | User-editable display label that never changes signed certificate identity | Public catalog |
| **Recipient key** | User-owned private encryption key used to unwrap archive keys; separate from signing keys | Local secure store |
| **Trusted contact** | Explicitly accepted, verified signed contact card and its recipient public keys | Public catalog |
| **One-time recipient certificate** | Advanced archive input that is validated for this operation but is not a trusted contact | Create workflow only |
| **Default signing identity** | A single optional catalog reference to an enrolled signing identity | Public catalog |
| **Retired recipient key** | A key no longer offered for new archives but retained for old-archive decryption | Local inventory |

An arbitrary certificate-only file is not an Account identity because it cannot sign without a matching private key. An explicitly imported P12/PFX may become a persistent local imported identity after validation, but it is not shown as an officially enrolled identity. Existing file-based signing remains an explicit **one-time P12/PFX advanced signing input** during migration and is not persisted in the inventory.

The Account workspace may explicitly create a persistent local self-signed identity or import a validated P12/PFX identity. In both cases, the private key is stored only in native OS secure storage, while public certificate metadata and the secure-store reference are stored in the local public catalog. Create can select the identity by ID and sign without asking for a password. The Account flow does not export P12 or CRT files.

The canonical terms and the service boundary must be added to `CONTEXT.md` during phase 0. Any intentionally changed authentication boundary must update or supersede ADR 0011 before code enables it.

---

## 4. Non-negotiable security and trust invariants

### 4.1 Secret handling

- Private keys, PKCE verifiers, handoff codes, session tokens, archive passwords, and key passwords never enter React snapshots, local storage, diagnostics, URLs, command-line arguments, crash reports, or analytics.
- Native callbacks contain only `state` and an opaque, one-time `handoff_code`, plus a non-secret error code when applicable. Bearer material is returned only in the HTTPS exchange response body.
- Secret DTO fields that must cross Tauri IPC for a one-time operation are short-lived input only, redacted by construction, and never echoed in snapshots or errors.
- Persistent private material is addressed through a typed `SecretRef`; public records never embed base64/DER private keys.
- Secret buffers are zeroized where the Rust type permits it. Debug output for secret-bearing types is redacted.
- Secure-store unavailable, locked, denied, or corrupt are distinct typed failures. There is no plaintext fallback.
- Private signing and recipient keys are never exported unencrypted by default. Recipient-key export, backup, or pairing is a separate explicit flow with user confirmation and an encrypted output format.

### 4.2 Cryptographic and certificate policy

- Signing keys and CSRs are generated on the client using the algorithm and profile defined by `shared-trust-model.md` and `zmanager-obligations.md`.
- Challenge canonicalization uses JCS/RFC 8785. Challenge signatures use ECDSA P-256/SHA-256 in IEEE P1363 form with low-S enforcement.
- Archive signing is rejected when the certificate is inactive, outside its validity interval, locally known revoked/suspended, issued by a locally blocklisted issuer/root, uses a disallowed algorithm, or has no matching private key.
- The official TZAP root pin set and custom trust roots are separate stores and separate UI states. A custom chain never receives an official badge.
- The public root is not redundantly embedded where the archive format or trust model requires pinned-root resolution. Intermediate-chain construction must be contract-tested.
- Claimed signing time is display evidence only. It cannot turn an invalid certificate into a valid one.

### 4.3 Recipient and contact policy

- Signing keys and recipient encryption keys are different key records with different purposes and lifecycles.
- Each archive uses a fresh random archive key. That key is wrapped independently to every selected recipient public key.
- Archive wrapper identifiers use certificate/key fingerprints, never internal account, organization, device, or database IDs.
- Trusted contacts come from a signed contact card. Import verifies the card signature, certificate chain, profile/metadata, official or explicitly selected custom trust, and current status when online, then requires explicit user acceptance.
- Offline import shows the required caveat and records that current online status was not confirmed.
- Removing a contact removes a future-recipient choice; it does not imply that old archives can be recalled.
- A recipient key is retired before deletion. Retired keys remain available for old archive decryption. Destructive deletion requires an explicit recovery/export warning because loss can make archives permanently unrecoverable.

### 4.4 Server authority

- The client never trusts a client-supplied organization or policy decision. Server responses are authoritative for membership, device approval, issuance, renewal, revocation, and status.
- Challenge material is single-use. A challenge obtained before an approval step is not reused after approval; the client requests a fresh challenge.
- Public client records do not depend on internal server linkage IDs that the public enrollment response does not expose.
- Local contacts are not a server-hosted buddy graph. Hosted Account manages the user's account/devices; contact cards manage recipient relationships.

---

## 5. Shipping and readiness gates

The work is intentionally split so the incomplete server does not force unsafe placeholders into the client.

### Gate A — local inventory (may ship independently)

Required before enabling the consolidated local inventory:

- public/secret storage split complete;
- native secure-store adapters pass real-platform smoke tests;
- legacy inventory migration is idempotent and recoverable;
- contact-card verification and explicit acceptance are used;
- archive create/extract use ID/fingerprint-based resolution;
- no server session is implied by the UI.

This gate does not require hosted sign-in or certificate enrollment. Users can manage existing valid enrolled material, generate recipient keys, import contact cards, and use one-time advanced inputs while server capabilities are unavailable.

### Gate B — hosted authentication and session bootstrap (optional)

Required before the desktop can claim the user is signed in:

- `zmanager-core` exposes a reviewed one-time `handoff_code` + state + PKCE exchange API matching the normative request and response;
- callback processing and exchange stay in native Rust, not React;
- session tokens use a dedicated secure session store;
- state, redirect URI, audience, client ID, expiration, replay, and cancellation tests pass;
- the server advertises or is configured for the exact contract;
- ADR 0011 is superseded or amended after security review.

Until Gate B passes, the desktop keeps hosted authentication disabled in the GUI. It may expose an explicitly labelled launch-only external Account action when useful, but it must not parse relay JSON, accept tokens from a URL, or display callback completion as an authenticated session. Gate B is not a prerequisite for the local-only release.

### Gate C — enrollment, renewal, revocation, and online status (optional)

Required before each capability is enabled:

- normative wire fixtures pass in both the client and server repositories;
- non-2xx denial responses are parsed into stable typed errors;
- RFC 3339 timestamps and bulk status response shapes are contract-tested;
- organization/device approval and fresh-challenge behavior are exercised;
- failure and offline semantics are represented accurately in the GUI.

Capabilities are explicit, for example:

```text
auth: unavailable | launch_only | handoff_exchange
enrollment: unavailable | available | approval_required
status: offline_cache_only | online
account_management: external_browser
```

No UI control appears enabled merely because a URL or partially implemented endpoint exists. Gate C is not a prerequisite for the local-only release; local identities and cached/offline trust remain usable under the local policy.

---

## 6. Target architecture

```text
React Identity & Contacts       React Create workspace
          | typed intents                 | IDs + one-time inputs
          v                               v
Account workspace/controller    Create workspace/controller
          | public snapshots              | request readiness
          +---------------+---------------+
                          v
               Tauri command boundary
                          |
              re-resolve + revalidate IDs
                 /                    \
                v                      v
       Public identity catalog   Secret material resolver
       (atomic versioned file)   (OS secure storage)
                 \                    /
                  v                  v
                 zmanager-core TZAP APIs
          (sign, wrap, unwrap, verify, status policy)
```

Ownership rules:

- `src/app` owns selections, state transitions, request readiness, and render-ready snapshots.
- `src/ui` renders snapshots and emits typed intents. It does not join Account and Create state or decide trust.
- `src/api` owns serializable DTOs and invoke wrappers only.
- `src/desktop` owns concrete desktop effects. Tauri and native secure-storage access do not leak into controllers.
- `src-tauri` maps ID-based commands, invokes the secure resolver, and hands validated material to `zmanager-core`.
- `zmanager-core` continues to own archive semantics, signing/verification policy, contact-card verification, key wrapping/unwrapping, and certificate-service clients.
- `src/main.ts` and `src/runtime/zmanagerRuntimeAdapter.ts` remain composition seams. They do not gain durable inventory, selection, lifecycle, or auth state.

The Create workspace receives a render-ready list of usable signing and recipient options from an application query/controller seam. It does not read the entire Account snapshot, and component-local state does not become the durable selection model.

At archive job handoff, Rust resolves every selected ID again. If a certificate expired, a key was retired, status became revoked, or secure storage is locked after rendering, the command fails safely with a typed, actionable error rather than using stale UI state.

---

## 7. Storage and domain model

### 7.1 Public catalog

Replace the current all-in-one serialized `TzapLocalIdentityInventory` with a versioned public catalog whose records contain no private bytes:

```text
TzapIdentityCatalog
  schema_version
  catalog_id
  revision
  default_signing_identity_id?: SigningIdentityId
  signing_identities[]
    id
    local_alias?
    certificate_chain_der/public metadata
    signing_key_ref
    issuance/status/routing metadata
    lifecycle: pending | active | renewal_due | expired | revoked | suspended
  recipient_keys[]
    id
    local_label
    public_key_der
    fingerprint
    private_key_ref
    lifecycle: active | retired | deletion_pending
    created_at/retired_at?
  contacts[]
    contact_id
    accepted contact card
    verified signer/chain summary
    recipient public keys and fingerprints
    trust_source: official_pinned_root | explicit_custom_root
    acceptance and last-status metadata
  status_cache
  emergency_blocklist metadata
  pending_mutations/tombstones
```

Important rules:

- `default_signing_identity_id` is one optional reference. Do not add `is_default` booleans to every certificate.
- A local alias is presentation metadata and is never copied into a signed certificate or server identity claim.
- Internal server IDs may be retained only when the public contract explicitly returns them and the client needs them. They must never appear as archive recipient identifiers.
- Public catalog writes use an atomic write-to-sibling, fsync where supported, and rename strategy plus a revision check/lock to prevent lost updates.
- Unix mode `0600` is applied and verified on Unix. Windows uses an owner-only ACL or an application data facility with equivalent access control; a Unix mode literal is not treated as Windows protection.

### 7.2 Secret material interfaces

`zmanager-core` should define purpose-specific interfaces rather than a store that hydrates every private key whenever the GUI asks for a snapshot:

```text
TzapSecretMaterialStore
  put(SigningKey | RecipientKey, metadata) -> SecretRef
  resolve_signing_key(SecretRef) -> SecretSigningKey
  resolve_recipient_key(SecretRef) -> SecretRecipientKey
  delete(SecretRef)

TzapSessionStore
  put_session(account_scope, SecretSession)
  resolve_session(account_scope)
  clear_session(account_scope)
```

The desktop provides the native implementation. If both desktop and CLI need it, place the implementation in a small feature-gated platform-secrets crate rather than adding unconditional OS integration to the archive-semantic core. For `keyring` v3, declare target backends explicitly; do not assume its default features provide a production store:

- macOS: Keychain;
- Windows: Credential Manager/native credential store;
- Linux: Secret Service with a documented unavailable/locked UX.

Unit tests use an in-memory fake. Platform tests must also exercise the real adapter because a mock cannot prove entitlements, credential size limits, prompts, locked-store behavior, or Linux session availability.

### 7.3 Consistency across two stores

OS secure storage and a public catalog cannot be committed atomically together. Use a recoverable mutation protocol:

1. Write a mutation intent with a random operation ID.
2. Create the secret under a new, non-discoverable `SecretRef`.
3. Atomically commit the public record referencing it.
4. Mark the intent complete.
5. Reconcile incomplete intents on startup without exposing or deleting a still-referenced secret.

Deletion reverses the order safely: mark/tombstone the public record so it is no longer selectable, confirm revocation/retention policy, delete secret material, then finalize catalog removal. Recipient-key deletion is never folded into ordinary “remove” or “forget” without the recovery warning in section 11.

### 7.4 Legacy migration

The current file store serializes private DER in a JSON inventory. Migration must be one-time, idempotent, crash-recoverable, and independently tested:

1. Obtain an exclusive migration lock.
2. Parse and validate the legacy inventory without rendering secrets or logging paths/content.
3. Verify every private key matches its public key/certificate and classify its purpose.
4. Insert secrets into native secure storage under new random references.
5. Write and reread the new public catalog; prove every reference resolves and every key matches.
6. Migrate the old default to one `default_signing_identity_id` only if the record is usable.
7. Remove persisted signing paths from typed Preferences storage.
8. Rename the legacy file to a migration backup with owner-only access; delete it only after a defined successful-start/rollback window and explicit release policy.
9. On any failure, keep the original intact, clean only provably orphaned new entries, and report a redacted recovery error.

Migration tests cover empty, partial, corrupt, duplicate, interrupted, already-migrated, missing-key, mismatched-key, and secure-store-locked cases. There is no automatic regeneration that could destroy access to old archives.

---

## 8. Archive command and application-state contracts

### 8.1 Create-workspace state

Replace durable path fields with explicit modes and typed selections:

```text
signing_mode: none | enrolled_identity | one_time_advanced
selected_signing_identity_id?: SigningIdentityId

encryption_mode: none | password | recipients
selected_own_recipient_key_ids: RecipientKeyId[]
selected_contact_recipient_ids: ContactRecipientId[]
one_time_recipient_certificate_paths: Path[]
```

Rules:

- Password and public-recipient encryption are separate modes; hidden stale values from one mode cannot affect the other.
- The configured default signing identity is selected only when currently usable. If it is missing or unusable, signing becomes `none` with an explicit warning; do not silently pick a different identity.
- For recipient encryption, include at least one active self recipient key by default when available so the creator can recover the archive. The user may opt out only after a clear warning.
- Contacts with revoked/invalid current status cannot be selected. Offline, a previously accepted contact may be selected only with the mandated stale/offline caveat and the recorded last-known status.
- One-time recipient certificates are validated and visibly marked custom/untrusted as appropriate. They do not enter the trusted contact catalog.
- One-time advanced signing retains legacy P12 or certificate/key inputs for compatibility, but those paths are operation-scoped, never global preferences, and never represented as an enrolled Account identity.

### 8.2 IPC and backend DTOs

Replace the current path-only persistent identity contract with IDs:

```text
TzapSigningSelectionDto
  None
  EnrolledIdentity { signing_identity_id }
  OneTimePkcs12 { path, password }
  OneTimeCertificateAndKey { certificate_path, private_key_path, chain_paths, password? }

TzapRecipientSelectionDto
  recipient_key_ids[]
  contact_recipient_ids[]
  one_time_certificate_paths[]
```

The one-time password remains write-only and short-lived. Backend mapping must redact all error/debug representations.

Before starting a job, Rust:

1. resolves IDs against the current catalog revision;
2. enforces lifecycle, validity, status, trust, and blocklist policy;
3. resolves only the private keys required for the operation;
4. validates one-time file input and key/certificate matching;
5. passes public recipient keys to `TzapKeySource::RecipientPublicKeys`;
6. passes signing material through a new in-memory/opaque signer core seam rather than writing a temporary private-key file;
7. records only non-secret IDs/fingerprints in diagnostics.

Open/extract resolves archive wrapper fingerprints to active or retired recipient keys in Rust. React does not choose or receive a private decryption key.

### 8.3 Core API work required

The current core archive create path supports recipient public-key bytes, but signing is path-oriented. Add an archive signing input that accepts a validated in-memory key/certificate chain or an injected signer/key resolver. Preserve all existing `zmanager-core` signing gates. Do not reproduce certificate or archive policy in TypeScript or the Tauri mapper.

---

## 9. Current client/specification drift ledger

These differences were found during the 2026-08-03 review. They are prerequisites, not optional cleanup.

| Area | Current client/core behavior | Normative behavior | Required action and gate |
|---|---|---|---|
| Hosted auth callback | Core still contains `native_app_relay`/`relay_body` parsing; desktop disables secret exchange under ADR 0011 | Callback carries `state` + opaque one-time `handoff_code`; exchange uses PKCE and returns bearer material only in HTTPS body | Replace the core contract; remove/retire relay parsing; add replay/state/PKCE tests; Gate B + ADR review |
| Session response | Core model uses older `access_token`/Unix-expiry assumptions | Current exchange returns the specified session token/session/user fields with RFC 3339 expiry | Add a strict normative mapper and dedicated secure session store; Gate B |
| Enrollment wire profile | The profile named `Spec` uses older `csr_der`, seconds, and older signature fields; `LocalStagingServer` is closer to current specs | Current challenge/enroll contract uses the normative CSR hash/PEM, validity-day, signature, device-name, canonicalization, and RFC 3339 fields | Make the current contract the normative profile; rename/deprecate legacy; never silently auto-detect; Gate C |
| Denials | Non-2xx commonly collapses to an HTTP status plus string body; some legacy paths expect a nested 2xx denial | Stable typed denial body includes `error`, `denial_reason`, `retryable`, and related fields | Parse typed non-2xx denial responses and preserve safe user-facing reasons; Gate C |
| Internal device linkage | Enrollment record currently expects `login_organization_device_id` | Public enrollment response deliberately does not expose internal login linkage IDs | Remove the client dependency. Use public `org_id`/`sign_device_id`; resolve authorized server-internal linkage only in the relevant retirement API |
| Bulk status | Current client/harness expects top-level `results` and query echo in the status object | Spec uses top-level `responses`; each item has `lookup_id`, sibling `queried`, and `status_response` | Correct parser and fixtures; Gate C |
| Time encoding | Some core fixtures and readers use Unix timestamps | Public service contracts use RFC 3339 timestamps | Writers/tests use RFC 3339. A documented tolerant legacy reader may remain temporarily |
| Obligation harness | Existing harness asserts older relay and status shapes, so it can pass while the normative contract drifts | Harness must prove the current documents | Replace divergent fixtures with provenance-pinned normative fixtures; keep the useful end-to-end crypto lifecycle coverage |
| Public/private inventory | Loading a GUI snapshot can hydrate an inventory containing private keys; file store serializes them | Secrets remain client-side but must be securely held and minimally resolved | Split catalog and secret resolver; Gate A |
| Account add/import | Proposed direct contact/certificate add commands accept arbitrary material | Contacts use signed contact cards, full verification, and explicit acceptance | Expose contact-card inspect/accept commands; keep arbitrary certificates operation-scoped only; Gate A |
| Signing command | Persistent Create selection is path-based | Inventory-backed signing must use a local identity reference and safe resolver | Add ID-based DTO and in-memory/opaque signer seam; Gate A |

The core obligation harness already covers useful cryptographic scenarios—enrollment, local signing and verification, contact-card acceptance, multi-recipient wrapping/unwrapping, and negative status/blocklist paths. Extend and correct it rather than duplicating those semantics in desktop tests.

---

## 10. GUI design and consolidated flow

### 10.1 Identity & Contacts workspace

The existing Account window becomes a local **Identity & Contacts** workspace with four clearly separated sections:

1. **Account connection**
   - Shows `Not connected`, `Hosted sign-in available`, `Connected`, `Session expired`, or `Server unavailable` from real capability/session state.
   - “Manage Account on the web” opens Hosted Account for cross-device listing/revocation.
   - Callback completion is never labeled “Connected” until Gate B exchange succeeds.

2. **Signing identities**
   - Shows local alias, public identity, certificate fingerprint, issuer/trust class, validity, last-known status/freshness, secure-key availability, and default marker.
   - “Set as default” writes the single catalog reference.
   - Enrollment/renew/revoke controls appear only when their capabilities pass Gate C.
   - Import P12/PFX is explicit and validates the private-key/certificate match; certificate-only import remains unavailable.

3. **Your recipient keys**
   - Generate with a local label, display fingerprint, export a signed contact card, retire, and use an explicit encrypted backup/export flow.
   - Active and retired keys are visually separate. Retired keys remain available for decryption but not new archive creation.
   - Destructive deletion is buried behind recovery checks, not presented as ordinary removal.

4. **Trusted contacts**
   - “Import contact card” first shows a verification preview: signer, fingerprint, official/custom trust, status freshness, recipient keys, and warnings.
   - A second explicit acceptance action persists it.
   - Remove contact affects future choices only. Refresh status is available when online.

“Keychain protected” is shown only when the actual platform adapter confirms secure storage. Linux must not display that claim when Secret Service is unavailable or the store is locked.

### 10.2 Create workspace

The TZAP portion of Create is a single progressive flow:

1. **Encryption:** None, Password, or Recipients.
2. **Recipients:** selected own keys, trusted contact recipients, plus an Advanced one-time certificate action.
3. **Signing:** None, local/enrolled/imported identity selector, plus Advanced one-time P12/PFX signing. Local identities in Account use the same selector and secure handoff; archive creation does not prompt for their P12 password.
4. **Review:** display recipient fingerprints/count, self-recovery inclusion, signing identity/trust/status, and offline caveats before creation.

The UI uses React, existing shadcn/ui primitives, and Tailwind CSS 4 utilities. It emits typed intents only. Selection, validation, and request construction live in the Create workspace/controller; no durable state or command switch is added to `main.ts` or the runtime adapter.

### 10.3 Preferences cleanup

Remove persisted/default fields for:

- signing identity path;
- signing certificate path;
- signing private-key path;
- signing chain paths;
- any duplicated default flag.

Preferences may contain a navigation link to Identity & Contacts and non-secret presentation preferences. It does not mirror the inventory or own archive identity defaults.

---

## 11. Lifecycle and destructive operations

These commands must remain distinct:

| User action | Local session | Signing keys/certs | Recipient private keys | Contacts | Server effect |
|---|---|---|---|---|---|
| **Sign out** | Clear secure session | Keep | Keep | Keep | End/revoke session when supported |
| **Disconnect this device** | Clear session after result | Mark/revoke device identity as confirmed | Keep unless separately retired/exported | Keep | Device retirement/revocation when available |
| **Retire recipient key** | Keep | Keep | Keep for decrypt, hide for new archives | Keep | None by default |
| **Remove contact** | Keep | Keep | Keep | Remove future-recipient record | None |
| **Forget local account metadata** | Clear session | Remove public account association only after confirmation | Preserve by default | User choice | Must not claim server revocation unless confirmed |
| **Wipe local secrets** | Clear | Delete selected signing secrets | Delete only after unrecoverability warning/export decision | Optional | Separate server work; may remain pending offline |

Do not implement one broad `clear_inventory` button as the GUI behavior. A low-level recovery/test primitive may exist, but product commands must express the user's intent and retention consequences. If server retirement is pending or unavailable, show that state and retry safely; do not report success as if remote revocation occurred.

---

## 12. Phased implementation plan

Each phase should be a focused change with characterization tests before moving existing behavior. Cross-repository phases land behind inactive capabilities until all consumers are ready.

Known implementation seams to change or protect:

| Repository area | Current seams | Planned responsibility |
|---|---|---|
| `zmanager-core` identity/trust | `local_identity_store.rs`, `device_identity.rs`, `contact_card.rs`, `document_signing.rs`, `document_verification.rs` | Split catalog/secrets, preserve core trust and crypto policy, add migration and purpose-specific resolution |
| `zmanager-core` service clients | `auth_client.rs`, `enrollment_client.rs`, `status_client.rs` | Replace divergent relay/profile/status contracts with provenance-pinned normative contracts |
| `zmanager-core` archive bridge | `tzap_backend.rs` | Accept resolved/in-memory signing material and existing recipient public-key input without secret temp files |
| Desktop Rust/API | `src-tauri/src/account.rs`, `commands.rs`, `dto.rs`, `src/api/types.ts`, `src/api/commands.ts` | Public snapshots, lifecycle commands, ID-based create DTOs, backend revalidation, secret redaction |
| Desktop application | `src/app/workspaces/accountWorkspace.ts`, `createWorkspace.ts`, controllers, typed Preferences | Own durable state, selections, capability/error states, request readiness, and preference migration |
| Desktop React | `src/ui/react/account/AccountWorkspace.tsx`, `create/CreateWorkspace.tsx`, `preferences/PreferencesDialog.tsx` | Render the consolidated flow and emit typed intents only |
| Composition/runtime | `src/main.ts`, `src/runtime/zmanagerRuntimeAdapter.ts` | Wire controllers/adapters only; do not absorb inventory, auth, selection, or lifecycle ownership |

### Phase 0 — freeze the contract and architecture boundary

**Repositories:** certificate-service specs, `zmanager`, `zmanager-desktop`, `tzap` as applicable.

Tasks:

1. Check in specification-baseline manifests and normative wire fixtures with commit/hash provenance.
2. Add the terms in section 3 to `CONTEXT.md` and record the local-inventory/hosted-account ownership boundary.
3. Write an ADR for the public-catalog/secure-secret split and ID-based job handoff if the team accepts it.
4. Keep ADR 0011 in force. Draft its successor criteria, but do not enable authentication yet.
5. Add contract tests that fail for the drift items in section 9 before changing implementations.
6. Define explicit feature/capability configuration; prohibit URL-presence heuristics and protocol auto-detection.

Exit criteria:

- current normative fixtures fail against known divergent clients for the expected reasons;
- ownership and terminology are reviewed;
- no production behavior changes yet.

### Phase 1 — split public inventory from secret material

**Primary repository:** `zmanager` core/interfaces plus a platform-secrets adapter used by desktop.

Tasks:

1. Characterize the current `TzapLocalIdentityInventory` read/write, signing, decryption, contact, and blocklist behavior.
2. Introduce the public catalog and purpose-specific secret/session interfaces from section 7.
3. Refactor core APIs so listing/snapshots load only public metadata.
4. Add the native secure-store adapter with explicit platform features and redacted errors.
5. Implement the recoverable two-store mutation protocol, locking, revision checks, and reconciliation.
6. Implement and test legacy JSON migration; do not delete the old store in the first successful write.
7. Preserve core-owned contact-card, signing, verification, and archive safety logic.

Exit criteria:

- no normal inventory snapshot hydrates private bytes;
- no new private bytes are written to the public catalog;
- fake-store unit tests and real-platform adapter smoke tests pass;
- interrupted migration is recoverable and idempotent.

### Phase 2 — local identity, recipient-key, and contact lifecycle

**Repositories:** `zmanager` and `zmanager-desktop` Rust command layer.

Tasks:

1. Add typed commands for public inventory snapshot, alias update, default selection, recipient-key generation, retirement, encrypted export, and lifecycle actions.
2. Replace `account_add_contact` with two steps: inspect/verify contact card, then explicitly accept the verified result using a short-lived verification handle or re-verification.
3. Do not add a generic `account_import_certificate` command; use an explicit validated P12/PFX identity import instead.
4. Map official/custom/offline/stale/revoked states without collapsing them to a boolean “trusted”.
5. Separate sign-out, disconnect, forget metadata, retire key, and wipe actions.
6. Ensure snapshots, diagnostics, and command errors contain no secret fields.

Exit criteria:

- API contract tests prove exact serialization and redaction;
- contacts cannot enter the catalog without verification and acceptance;
- recipient retirement preserves decryption capability;
- server-unavailable operation remains honest and useful.

### Phase 3 — ID-based archive create and extract

**Repositories:** `zmanager` core and `zmanager-desktop`.

Tasks:

1. Add the in-memory/opaque signing seam to core while retaining all signing policy gates.
2. Change TypeScript/Tauri create contracts to the selection DTOs in section 8.
3. Resolve IDs, trust, status, and secret refs immediately before job start.
4. Feed selected public keys to the existing multi-recipient core path; ensure fresh archive keys and fingerprint wrapper IDs.
5. Resolve wrapper fingerprints against active and retired local recipient keys for extract.
6. Keep one-time advanced signing/recipient paths operation-scoped and clearly separate.
7. Add race tests for delete/retire/revoke/expire/lock between render and command execution.

Exit criteria:

- persistent identities require no private-key path DTO;
- no temporary plaintext key file is created;
- multi-recipient archives decrypt for every intended recipient and fail for non-recipients;
- old archives remain decryptable by retired keys.

### Phase 4 — application workspaces and controllers

**Primary repository:** `zmanager-desktop` TypeScript application layer.

Tasks:

1. Deepen `accountWorkspace.ts` and `accountController.ts` around typed intents and immutable public snapshots.
2. Put signing/encryption modes and selected IDs in `createWorkspace.ts`; update its request builder and tests.
3. Add an injected inventory query/controller seam that derives render-ready Create options without coupling React components to the Account snapshot.
4. Route workspace actions through the command/controller seams, not direct switches added to `zmanagerRuntimeAdapter.ts`.
5. Represent secure-store locked/unavailable, server unavailable, stale status, approval required, and destructive pending states explicitly.
6. Remove duplicate preferences ownership and storage keys through typed normalization/migration.

Exit criteria:

- state-machine tests cover defaults, mode switching, stale hidden fields, offline behavior, destructive confirmation, and async races;
- `src/main.ts` and the runtime adapter do not gain durable workflow logic;
- snapshots remain serializable, immutable, public data.

### Phase 5 — React GUI consolidation

**Primary repository:** `zmanager-desktop` React UI.

Tasks:

1. Build the Identity & Contacts sections in section 10 using React, shadcn/ui, and Tailwind CSS 4.
2. Replace Create's persistent identity file pickers with inventory selectors and review state; retain Advanced one-time actions.
3. Remove duplicate Preferences file pickers and link to Identity & Contacts.
4. Add accessible confirmation dialogs and explicit trust/status wording.
5. Add component tests and Playwright flows for local-only, offline, secure-store-locked, migration, contact acceptance, default selection, and multi-recipient creation.
6. Add screenshots/visual baselines for the changed flow.

Exit criteria:

- there is one durable owner for every selection/default;
- no UI surface can bypass contact verification or backend revalidation;
- the local-only flow is complete without pretending the server is ready.

### Phase 6 — optional normative hosted auth and session bootstrap (Gate B)

**Disabled from the local-only GUI until Gate B prerequisites are available.**

Tasks:

1. Remove/retire the old relay request/response model in `zmanager-core`.
2. Implement launch state and PKCE generation, native callback validation, one-time handoff exchange, replay prevention, expiration, and cancellation.
3. Keep handoff codes and session tokens inside Rust and native secure storage.
4. Map the exact normative session response; do not retain an older token schema under the new name.
5. Add a local conformance server/test harness that implements the same contract as production.
6. Complete security review and update/supersede ADR 0011 before enabling the capability.

Exit criteria:

- callback URLs contain no bearer credentials;
- React observes only sanitized connection state;
- normative happy-path and negative/replay fixtures pass;
- a server capability/config mismatch disables sign-in safely.

### Phase 7 — optional enrollment and lifecycle services (Gate C)

**Disabled per capability until the matching server contract is ready.**

Tasks:

1. Correct the enrollment client profile, typed denials, RFC 3339 fields, and public-ID model.
2. Generate device key/CSR locally; implement challenge JCS/P1363/low-S proof.
3. Implement approval-required behavior with a fresh post-approval challenge.
4. Implement renewal, revocation/retirement, single and bulk status using normative response shapes.
5. Refresh contact and signing-certificate status when online while preserving honest offline-cache semantics.
6. Implement official root pin updates, successor-root rollover, and emergency blocklist behavior from operations specs.
7. Never make local archive decryption depend on server availability.

Exit criteria:

- cross-repository conformance fixtures pass;
- typed denials drive actionable, non-secret UI states;
- no public client flow depends on an internal login organization-device ID;
- online/offline verification labels match the three normative states.

### Phase 8 — migration rollout and release proof

Tasks:

1. Roll out behind separate local-inventory and server-capability flags.
2. Exercise upgrades from every supported legacy catalog/preference shape.
3. Verify downgrade/rollback behavior before deleting legacy secret files.
4. Test macOS Keychain, Windows credential storage, and Linux Secret Service on supported release environments.
5. Run the full verification matrix in section 13 and attach results to the PR/release record.
6. Update user documentation for backup, retirement, offline trust, hosted Account responsibilities, and irreversible key loss.

Exit criteria:

- no known plaintext legacy secret remains after the documented safe-cleanup point;
- recovery and rollback procedures are tested;
- server-dependent controls remain disabled on incompatible deployments;
- release evidence names automated proof and manual platform checks separately.

---

## 13. Verification matrix

### 13.1 Contract and core tests

- Normative auth launch/callback/exchange requests and responses.
- State mismatch, PKCE mismatch, replay, expiry, cancellation, network failure, and malformed denial.
- Challenge canonicalization, P1363 encoding, low-S enforcement, CSR hash/profile, approval, and fresh challenge.
- Enrollment, renewal, revocation, single status, and bulk `responses` parsing with RFC 3339 time.
- Official pinned root, explicit custom root, unknown root, rollover successor, and emergency blocklist.
- Signing gate negatives: inactive, expired/not-yet-valid, revoked/suspended, missing/mismatched key, blocklisted issuer/root, disallowed algorithm.
- Contact-card valid/invalid signature, chain/profile, online status, offline caveat, explicit acceptance, replacement/update, and removal.
- Fresh archive key per archive, multi-recipient wrapping, fingerprint IDs, every-recipient decrypt, non-recipient failure, and lost-key failure.

### 13.2 Storage and migration tests

- Public snapshot never contains secret material.
- Locked/unavailable/denied/corrupt native secure store, with no fallback.
- Atomic catalog update, concurrent revision conflict, crash at every mutation step, orphan reconciliation, and tombstone recovery.
- Legacy empty/valid/corrupt/partial/duplicate/mismatch/interrupted/already-migrated cases.
- Default reference validity and no silent fallback.
- Recipient retire versus destructive delete; retired-key decryption.
- Session clear does not unintentionally delete archive recipient keys.
- Platform permissions: Unix mode and Windows owner-only ACL behavior.

### 13.3 Desktop state, UI, and end-to-end tests

- Account connection capability labels do not overstate authentication.
- Inventory default selection, unusable default, mode switching, and stale hidden input cleanup.
- Contact verification preview and explicit acceptance.
- Local-only/offline workflow with honest status caveats.
- Create with password, self recipient, contact recipients, multiple recipients, enrolled signing, and one-time advanced input.
- Backend revalidation when a selected record changes between render and execution.
- Preferences migration/removal and navigation to Identity & Contacts.
- Sign out, disconnect, forget metadata, retire, remove, wipe, server-pending, and cancellation flows.

### 13.4 Required repository commands

For `zmanager-core`/related Rust changes:

```text
cargo fmt
cargo check --all-targets
cargo test --all-targets
```

For `tzap` compatibility work, run its configured format/check/test suite and CLI interoperability tests.

For `zmanager-desktop`, before claiming an implementation phase complete:

```text
npm run test:frontend
npm run build
npm run test:e2e
cd src-tauri && cargo fmt
cd src-tauri && cargo check
cd src-tauri && cargo test
cd native/macos && swift build
```

Also run the Windows ARM64 release gate when the changed phase affects storage, IPC, packaging, or native behavior:

```text
powershell -ExecutionPolicy Bypass -File scripts/release-gate-windows-arm64.ps1
```

Real secure-store smoke tests and hosted-browser callback tests must be reported as platform/manual or automated integration evidence; unit tests using a mock keyring are not sufficient proof.

---

## 14. Completion definition

This initiative is complete only when all of the following are true:

- public inventory and private material are structurally separated;
- supported platforms use verified native secure storage without plaintext fallback;
- legacy secret migration is recoverable and the cleanup point is documented;
- Create and extract use ID/fingerprint resolution and backend revalidation;
- Preferences no longer own persistent TZAP signing paths;
- contacts enter the inventory only through verified, explicitly accepted contact cards;
- recipient retirement preserves old-archive recovery and destructive loss is explicit;
- official and custom trust are never conflated;
- local-only behavior is usable while server capabilities are incomplete;
- hosted auth uses only one-time handoff code + PKCE exchange and has passed ADR/security review (optional capability);
- enrollment/status clients match the pinned normative fixtures, including denial, ID, timestamp, and bulk response contracts (optional capabilities);
- all required local-flow automated tests and named platform smoke checks pass.

The local-only release is complete when it provides a secure consolidated inventory and full local archive flow with unavailable server capabilities clearly shown—not a simulated Account session or a fallback to the retired relay model. Server-dependent gates can be implemented and enabled later without changing the local ownership model.
