# TZAP Server Workflow: Desktop GUI Parity with CLI

Bring the full tzap server login, authentication, certificate enrollment, document signing, verification, and multi-recipient sharing workflows from the CLI (`zm auth/cert/sign/verify/contact/share`) into the desktop GUI.

## Background

### CLI Capabilities (fully working against staging server)

| CLI Command | What it does |
|---|---|
| `zm auth login` | OAuth2+PKCE login via browser → relay handoff → session token storage |
| `zm auth callback` | Completes handoff with relay body, stores `TzapSessionRecord` |
| `zm auth status` | Shows current session (display name, assurance level, expiry) |
| `zm auth forget` | Clears stored session |
| `zm me` | Fetches current user profile from `sign.tzap.org/v1/me` |
| `zm cert enroll` | Generates P-256 device key+CSR → challenge-response enrollment → saves issued certificate |
| `zm cert renew` | Renews an active certificate before expiry |
| `zm cert revoke` | Server-side revocation of a certificate |
| `zm cert list` | Lists local and (with session) remote enrolled certificates |
| `zm sign <file>` | Signs a JSON document with an enrolled certificate → produces signed envelope |
| `zm verify <file>` | Verifies a signed envelope (offline or with online status check) |
| `zm contact keygen` | Generates a recipient encryption key pair |
| `zm contact export` | Exports a signed contact card (self-signed with enrolled cert) |
| `zm contact import` | Verifies and accepts a contact card |
| `zm contact list` | Lists accepted trusted contacts |
| `zm share <archive>` | Creates a TZAP archive encrypted to contact recipients + signed |
| `zm device retire` | Revokes all local device material server-side |

### Desktop Current State

The desktop already has significant foundational infrastructure:

- **Account UI**: [`AccountWorkspace.tsx`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src/ui/react/account/AccountWorkspace.tsx) — "Identity & Contacts" dialog with local-only signing identity management, recipient key generation, and contact card import/verification
- **Backend**: [`account.rs`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src-tauri/src/account.rs) — Full `TzapIdentityCatalog` management, self-signed cert generation, P12 import, contact card verification, hosted auth launch (browser redirect only)
- **Account Controller**: [`accountController.ts`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src/app/controllers/accountController.ts) — Orchestrates workspace + injected API adapters
- **Dependencies**: `tzap-core`, `tzap-plugin-keywrap`, `tzap-plugin-signing` already in `Cargo.toml`
- **Secure Store**: [`secure_store.rs`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src-tauri/src/secure_store.rs) — Native keychain-backed secret storage

### What's Missing (Gap Analysis)

| Capability | CLI | Desktop |
|---|---|---|
| **Full auth handoff** (relay body → session token) | ✅ `reqwest` + relay body parsing | ❌ Launch-only; callback sets status string but never obtains a session token |
| **Session persistence** | ✅ `TzapSessionStore` (file-backed) | ❌ No `TzapSessionStore` implementation; session is ephemeral status only |
| **HTTP transport** | ✅ `reqwest::blocking::Client` with `TzapAuthHttpTransport` | ❌ No `TzapAuthHttpTransport` implementation exists |
| **`/v1/me` current user** | ✅ `fetch_current_user()` | ❌ Never called |
| **Certificate enrollment** | ✅ `enroll_device_certificate()` | ❌ Only local self-signed; no CSR generation → server enrollment |
| **Certificate renewal** | ✅ `renew_certificate()` | ❌ Not implemented |
| **Certificate revocation** | ✅ `revoke_personal_certificate()` | ❌ Not implemented |
| **Document signing** | ✅ `sign_document()` | ❌ Not implemented (only archive-level signing at create time) |
| **Document verification** | ✅ Full envelope verification | ❌ Only archive-level `verify_tzap_certificate` |
| **Contact card export** | ✅ Self-signed contact card creation | ❌ Not implemented |
| **Multi-recipient share** | ✅ `share` command | ❌ Recipient selection exists in Create but no "Share to contacts" workflow |
| **Environment selection** | ✅ `--environment local/dev/staging/prod` | ❌ Hardcoded to `Prod`; no staging toggle |
| **Device retirement** | ✅ `device retire/revoke` | ❌ Not implemented |
| **Capabilities upgrade** | N/A | ❌ Hardcoded `launch_only`/`unavailable`; should become `handoff_exchange`/`available` when session is active |

## User Review Required

> [!IMPORTANT]
> **Environment selection**: The CLI supports `--environment local|dev|staging|prod`. For the desktop, should we:
> - Add a preference/setting to select the environment (default `prod`, `staging` available in preferences)?
> - Or always default to `prod` and let a hidden developer setting toggle staging?

> [!IMPORTANT]
> **Auth flow choice**: The CLI uses a handoff code exchange where the browser redirects to a local callback and passes a relay body. For the desktop, the natural flow is:
> 1. Open browser → user authenticates → browser redirects to `zmanager://auth-callback` deep link
> 2. Tauri intercepts the deep link and extracts the handoff code
> 3. Backend exchanges the handoff code for a session token via HTTP
>
> This requires the Tauri deep-link plugin and an HTTP client dependency (`reqwest`). Is this the expected flow, or is there a different mechanism already planned?

> [!WARNING]
> **Breaking visibility change**: The Account section currently shows a hosted account panel only when `capabilities.auth === "handoff_exchange"`, which is never true because capabilities are hardcoded to `launch_only`. Making the full auth/enrollment flow visible will be a significant UI surface area change. The "Identity & Contacts" dialog will need new sections for:
> - Session status (signed-in user, assurance level, org, session expiry)
> - Certificate enrollment actions
> - Contact card export
> - Document sign/verify

## Open Questions

> [!IMPORTANT]
> 1. **Document signing scope**: The CLI's `zm sign` signs arbitrary JSON payloads (not archives). Should the desktop also support signing arbitrary documents, or only the existing archive-level signing during TZAP creation?

> [!IMPORTANT]
> 2. **Share workflow**: The CLI's `zm share` is essentially `zm create` with `--contact` recipients and `--certificate-id` signing. The desktop's Create Workspace already supports recipient selection and signing selection. Is the "Share" workflow a new dedicated workspace/dialog, or should it be exposed as a mode within the existing Create Workspace?

> [!NOTE]
> 3. **Account visibility**: You mentioned the account login is "hidden". Is the intent to make it a first-class visible menu item (e.g., a toolbar user icon), or keep it in the existing "Identity & Contacts" dialog but with the hosted sections visible?

## Proposed Changes

### Phase 1: Backend Foundation — HTTP Transport + Session Store

---

#### Rust Backend (`src-tauri/`)

##### [NEW] `src-tauri/src/hosted_transport.rs`
- Implement `TzapAuthHttpTransport` trait using `reqwest` (async or blocking)
- Handles GET/POST with bearer token and JSON body
- 10s connect timeout, 30s request timeout, no redirects (matching CLI)

##### [MODIFY] [`Cargo.toml`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src-tauri/Cargo.toml)
- Add `reqwest` dependency with `blocking`, `json`, `rustls-tls` features

##### [MODIFY] [`account.rs`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src-tauri/src/account.rs)
- Implement `TzapSessionStore` on `NativeTzapSecretStore` (session tokens stored in native keychain, never in files or snapshots)
- Add `AccountRuntimeState` fields: `session: Option<TzapSessionRecord>`, loaded from secure store on startup
- Upgrade `AccountCapabilitiesDto` to be dynamic: when session is valid → `auth: "handoff_exchange"`, `enrollment: "available"`, `status: "online"`
- Add `account_snapshot` to include session-derived fields: `displayName`, `publicSignerId`, `assuranceLevel`, `sessionExpiresAt`

##### [NEW] Tauri commands in `account.rs`:
- `account_begin_hosted_auth` → **upgrade**: instead of launch-only, generate full PKCE state + relay handoff parameters. Add `environment` parameter (`local`/`dev`/`staging`/`prod`)
- `account_complete_hosted_auth` → **new**: receives relay body from deep link callback, exchanges for session token, stores in secure store, returns updated snapshot
- `account_fetch_current_user` → **new**: calls `fetch_current_user()` with session token, returns user profile
- `account_cert_enroll` → **new**: generates P-256 device key + CSR, calls `enroll_device_certificate()`, installs returned certificate into catalog
- `account_cert_renew` → **new**: calls `renew_certificate()`, updates catalog
- `account_cert_revoke` → **new**: calls `revoke_personal_certificate()`, updates catalog state
- `account_cert_list_remote` → **new**: calls `list_certificates()` with session, returns remote cert list
- `account_sign_document` → **new**: loads enrolled cert + private key from secure store, signs JSON payload, returns signed envelope
- `account_verify_document` → **new**: verifies a signed envelope JSON, returns verification result
- `account_export_contact_card` → **new**: creates a self-signed contact card using enrolled cert + recipient key
- `account_device_retire` → **new**: calls `retire_personal_devices()`, returns retirement report

##### [MODIFY] [`main.rs`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src-tauri/src/main.rs)
- Register new commands
- Set up deep-link handler for `zmanager://auth-callback` if using deep links

---

### Phase 2: Frontend API + Account Workspace State

---

#### API Layer (`src/api/`)

##### [MODIFY] [`types.ts`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src/api/types.ts)
- Extend `AccountSnapshotDto` with session-derived fields:
  ```typescript
  displayName: string | null;
  publicSignerId: string | null;
  assuranceLevel: string | null;
  sessionExpiresAtUnixSeconds: number | null;
  ```
- Add new DTOs: `AccountEnrollmentResultDto`, `AccountSignDocumentResultDto`, `AccountVerifyDocumentResultDto`, `AccountContactCardExportDto`, `AccountDeviceRetireResultDto`, `AccountRemoteCertificateDto`

##### [MODIFY] [`commands.ts`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src/api/commands.ts)
- Add invoke wrappers for all new Tauri commands

#### App Layer (`src/app/`)

##### [MODIFY] [`accountWorkspace.ts`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src/app/workspaces/accountWorkspace.ts)
- Extend snapshot type with session-awareness fields
- Add enrollment state tracking (pending enrollment, enrollment result)

##### [MODIFY] [`accountController.ts`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src/app/controllers/accountController.ts)
- Add new controller methods for each workflow:
  - `handleEnroll()`: orchestrates cert enrollment
  - `handleRenew(certificateId)`: orchestrates cert renewal
  - `handleRevoke(certificateId)`: orchestrates cert revocation
  - `handleSignDocument()`: file picker → sign → save output
  - `handleVerifyDocument()`: file picker → verify → display result
  - `handleExportContactCard()`: select cert + key → export card → save file
  - `handleDeviceRetire()`: retire all device material
  - `handleFetchUser()`: fetch and display `/v1/me` profile

---

### Phase 3: React UI — Account Workspace Enhancement

---

#### UI Components (`src/ui/react/account/`)

##### [MODIFY] [`AccountWorkspace.tsx`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src/ui/react/account/AccountWorkspace.tsx)

Restructure the dialog into tabbed or sectioned layout:

1. **Session Section** (new)
   - Signed-in state: display name, assurance level, organization, session expiry countdown
   - Sign-in button (opens browser for OAuth flow)
   - Sign-out / Forget session button
   - Environment selector (prod/staging, persisted in preferences)

2. **Certificates Section** (enhanced)
   - Existing local identity list (self-signed, imported P12)
   - **New**: "Enroll Certificate" button → generates device key + enrolls with server
   - **New**: Per-certificate "Renew" button (visible when near expiry and session active)
   - **New**: Per-certificate "Revoke" button (visible when session active)
   - **New**: Remote certificate list comparison (list from server vs local)

3. **Contacts Section** (enhanced)
   - Existing contact list and import flow
   - **New**: "Export Your Contact Card" flow:
     - Select signing certificate
     - Select recipient key
     - Enter display name
     - Export → save file dialog

4. **Documents Section** (new)
   - "Sign Document" → file picker for input JSON, select certificate, save signed envelope
   - "Verify Document" → file picker for envelope JSON, display verification result with trust chain details

5. **Device Section** (new, in settings or advanced)
   - "Retire Device" button with confirmation dialog
   - Shows retirement report after completion

##### [NEW] `src/ui/react/account/SessionStatus.tsx`
- Compact session status component showing auth state, user info, sign-in/out actions

##### [NEW] `src/ui/react/account/CertificateEnrollment.tsx`
- Enrollment flow UI with progress and result display

##### [NEW] `src/ui/react/account/DocumentSignVerify.tsx`
- Sign and verify document workflow components

##### [NEW] `src/ui/react/account/ContactCardExport.tsx`
- Contact card export flow with certificate + key selection

---

### Phase 4: Deep Link Handling + Auth Callback

---

##### [MODIFY] [`main.rs`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src-tauri/src/main.rs) or platform setup
- Register `zmanager://auth-callback` deep link handler
- On callback: extract state + relay body → call `account_complete_hosted_auth` → emit frontend event → Account workspace refreshes

##### [MODIFY] Desktop adapter
- Listen for Tauri deep-link events
- Route auth callback events to the account controller

---

### Phase 5: Preferences — Environment Selection

---

##### [MODIFY] [`PreferencesDialog.tsx`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src/ui/react/preferences/PreferencesDialog.tsx)
- Add "TZAP Server Environment" dropdown (prod/staging) in an advanced/developer section
- Persisted via existing preferences storage

##### [MODIFY] [`preferences.ts`](file:///Users/frankzhu/IdeaProjects/zmanager-desktop/src/app/preferences.ts)
- Add `tzapEnvironment: "prod" | "staging"` preference field

---

## Verification Plan

### Automated Tests

```bash
# Backend
cd src-tauri && cargo check
cd src-tauri && cargo test
cd src-tauri && cargo fmt

# Frontend
npm run build
npm run test:frontend
```

- Add Rust unit tests for:
  - `TzapAuthHttpTransport` implementation (mock server)
  - Session store save/load/clear through `NativeTzapSecretStore`
  - Enrollment command DTO validation
  - Sign/verify document round-trip
  - Dynamic capability computation from session state

- Add TypeScript tests for:
  - Account workspace extended snapshot shape
  - Account controller new workflows (enrollment, sign, verify, export)
  - DTO contract tests for all new commands

### Manual Verification

1. **Auth flow**: Sign in via staging server → verify session stored → verify `/v1/me` shows correct user
2. **Certificate enrollment**: Enroll new device certificate → verify it appears in local catalog → verify it appears on server cert list
3. **Document signing**: Sign a test JSON → verify envelope is valid → verify with `zm verify` on CLI
4. **Contact card export**: Export card → import on another device/CLI → verify accepted
5. **Multi-recipient share**: Create TZAP archive with contact recipients → extract on recipient device
6. **Session expiry**: Verify expired session shows appropriate UI state and re-auth prompt
7. **Cross-platform**: Verify deep link callback works on macOS, Windows, and Linux
