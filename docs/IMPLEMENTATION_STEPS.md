# Agent Implementation Steps

This document is the low-ambiguity build guide for future implementation agents. Use it together with `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`, and `docs/ROADMAP.md`.

## Integrity Snapshot

Verified on 2026-06-11 from `/Users/frankzhu/IdeaProjects/zmanager-desktop`:

- `git status --short` was clean before this document was added.
- `npm ls --depth=0` resolved the installed frontend dependencies.
- `npm run build` passed TypeScript and Vite production build.
- `cd src-tauri && cargo check` passed.
- `cd src-tauri && cargo test` passed, with 0 local tests currently defined.
- `src-tauri/Cargo.toml` successfully resolves `zmanager-core` from `../../ZManager/cli/crates/zmanager-core`.
- Rust dialog and opener plugins are registered, but the matching Tauri 2 JavaScript plugin packages are not installed yet. Add them in the slices that first use native file dialogs and opener behavior.

Verdict: this is a good scaffold. It has a viable Tauri 2 shell, a Vite/TypeScript workspace UI, a Rust command boundary, and a working dependency on the public Rust archive engine. The main missing work is implementation depth: real archive commands, job lifecycle, tests, and platform packaging.

## Non-Negotiable Rules

- Do not implement archive parsing, extraction, creation, password handling, safety policy, or format routing in TypeScript.
- Do not copy SwiftUI, Finder Sync, Quick Look, signing, notarization, or `.app` packaging code from the macOS app.
- Do not edit the macOS GUI repository for this desktop shell.
- Prefer adding missing archive-engine capabilities to `zmanager-core` over duplicating behavior in this repo.
- Keep frontend state limited to presentation, interaction, filtering, sorting, selected rows, dialogs, and job display.
- Keep passwords transient. Never persist them, log them, include them in command-line arguments, or render them in diagnostics.
- Add tests at the Rust command boundary before broad UI work.
- After every implementation slice, run `npm run build` and `cd src-tauri && cargo test`.

## Slice 0: Baseline Before Editing

1. Read `AGENTS.md`.
2. Read `docs/ARCHITECTURE.md`, `docs/REQUIREMENTS.md`, and this document.
3. Run:

```sh
npm install
npm run build
cd src-tauri
cargo check
cargo test
```

On ARM64 Windows/MSVC development machines, `cargo check` and `cargo test` may need the same native dependency environment as the Windows CI script. Use the ARM64 vcpkg triplet and put Strawberry Perl on `PATH` before running Cargo:

The helper script form is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-windows-arm64-static.ps1
```

The build script prefers an installed Node.js under `C:\Program Files\nodejs`, falls back to PATH/Codex runtime Node, and accepts `-NodePath C:\path\to\node.exe` if the shell exposes the wrong Node executable.

For other commands, use the environment helper with `-Run`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows-arm64-static-env.ps1 -Run "cargo test"
```

Or set it up manually:

```powershell
$triplet = "arm64-windows-static-md"
$env:VCPKG_INSTALLATION_ROOT = "C:\vcpkg"
$env:VCPKG_ROOT = "C:\vcpkg"
$env:CMAKE_TOOLCHAIN_FILE = "C:\vcpkg\scripts\buildsystems\vcpkg.cmake"
$env:VCPKG_DEFAULT_TRIPLET = $triplet
$env:VCPKG_TARGET_TRIPLET = $triplet
$env:LIB = "C:\vcpkg\installed\$triplet\debug\lib;C:\vcpkg\installed\$triplet\lib;" + $env:LIB
$env:INCLUDE = "C:\vcpkg\installed\$triplet\include;" + $env:INCLUDE
$env:PATH = "C:\Strawberry\perl\bin;C:\vcpkg\installed\$triplet\debug\bin;C:\vcpkg\installed\$triplet\bin;" + $env:PATH
cargo test
```

This matters because `zmanager-libarchive-sys` needs the vcpkg toolchain/dependency paths, and OpenSSL build fallback expects `perl` to be available.

4. If the `zmanager-core` path fails, fix `src-tauri/Cargo.toml` before touching UI code. The current local layout expects:

```text
/Users/frankzhu/IdeaProjects/ZManager/cli/crates/zmanager-core
/Users/frankzhu/IdeaProjects/zmanager-desktop/src-tauri
```

5. Confirm there are no unrelated worktree changes. If there are, do not revert them. Work around them or ask the user only if they block the task.

Done when the baseline commands pass or the failure is documented with a specific root cause.

## Slice 1: Rust Command Contract Foundation

Goal: make the command layer ready for real operations without growing one giant `commands.rs`.

Files to create or update:

- `src-tauri/src/main.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/error.rs`
- `src-tauri/src/dto.rs`
- `src-tauri/src/constants.rs`

Steps:

1. Move shared product strings and command names from random call sites into `constants.rs`.
2. Keep `healthcheck` and `project_contract` working.
3. Add an app-safe error DTO:

```rust
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandErrorDto {
    pub code: &'static str,
    pub message: String,
    pub hint: Option<String>,
    pub severity: ErrorSeverityDto,
    pub retryable: bool,
}
```

4. Use `Result<T, CommandErrorDto>` for new Tauri commands.
5. Add helpers that map core errors into stable codes. Start with:

```text
invalid_request
not_found
password_required
invalid_password
unsafe_archive
io_error
unsupported_format
cancelled
operation_failed
```

6. Redact secrets from every error path. It is acceptable to include a selected file path in a user-facing error only when the user supplied that path.
7. Register new modules in `main.rs`.

Tests:

- Add unit tests for error mapping.
- Test that password-required and invalid-password map to distinct codes.
- Test that arbitrary error text does not contain supplied password values.

Done when `healthcheck` and `project_contract` still work, new errors serialize in camelCase, and tests pass.

## Slice 2: Archive Listing Tracer Bullet

Goal: the user can pick an archive and see real entries in the Browse tab.

Core APIs to use:

- `zmanager_core::archive_browser::list_entries_with_options`
- `zmanager_core::archive_browser::BrowserListOptions`
- Match `ArchiveBrowserError` variants for password-required and invalid-password cases.

Rust command:

```text
list_archive(request: ListArchiveRequest) -> Result<ArchiveListingDto, CommandErrorDto>
```

Request DTO:

```text
archivePath: string
password?: string
```

Response DTO:

```text
archivePath: string
entries: ArchiveEntryDto[]
entryCount: number
totalSize?: number
```

Entry DTO:

```text
path: string
kind: "file" | "directory" | "symlink" | "hardlink" | "special"
size?: number
compressedSize?: number
modified?: string
```

Rust steps:

1. Validate that `archivePath` is non-empty.
2. Convert the string into a `PathBuf`.
3. Call `list_entries_with_options(path, BrowserListOptions { password: request.password.as_deref() })`.
4. Convert `BrowserEntryKind` into a stable string enum for the UI.
5. Compute `entryCount` and `totalSize` from listed entries.
6. Map password errors to `password_required` or `invalid_password`.
7. Add the command to `tauri::generate_handler!`.

Frontend steps:

1. Install `@tauri-apps/plugin-dialog` and import dialog helpers from that package.
2. Wire `Open Archive` to a native open-file dialog.
3. Store selected archive path in UI state.
4. Invoke `list_archive`.
5. Render loading, empty, loaded, password-required, invalid-password, and failure states.
6. Enable the search box only after entries load.
7. Implement path filtering in TypeScript only against already-returned DTO rows.
8. Implement sort by path, type, size, packed size, and modified time.

Tests:

- Rust command test lists a simple ZIP fixture.
- Rust command test rejects an empty archive path.
- Rust command test maps a missing file to `not_found` or `io_error`.
- Frontend state test covers empty -> loading -> loaded.
- Frontend state test covers password-required -> password prompt -> retry.

Verification:

```sh
npm run build
cd src-tauri && cargo test
npm run tauri dev
```

Manual acceptance:

- Open a ZIP archive.
- Entries appear in the Browse table.
- Filtering does not call the backend.
- Password-required archives ask for a password instead of showing a generic crash.

## Slice 3: Job Registry

Goal: all long-running work runs in Rust jobs that can be polled, cancelled, and dismissed.

Core APIs to use:

- `zmanager_core::jobs::CancellationToken`
- `zmanager_core::jobs::JobEvent`
- `zmanager_core::jobs::JobEventSink`

Files to create:

- `src-tauri/src/job_registry.rs`
- `src-tauri/src/job_dto.rs`

Commands to add:

```text
poll_job_events(request: PollJobEventsRequest) -> Result<JobEventsDto, CommandErrorDto>
cancel_job(request: CancelJobRequest) -> Result<JobStatusDto, CommandErrorDto>
dismiss_job(request: DismissJobRequest) -> Result<(), CommandErrorDto>
```

Registry design:

1. Store the registry in Tauri managed state.
2. Use a monotonically increasing `u64` job id. Serialize it as a string if JavaScript integer safety becomes a concern.
3. For each job, store:

```text
id
kind
createdAt
status: queued | running | completed | failed | cancelled
cancellationToken
events: VecDeque<JobEventDto>
terminalSummary?: JobTerminalSummaryDto
```

4. Spawn blocking archive work on a Rust thread or Tauri blocking task. Do not run archive jobs on the frontend thread.
5. Implement a sink that appends mapped `JobEventDto` values into the registry.
6. `poll_job_events` should drain events since the last poll for that job.
7. `cancel_job` should call `CancellationToken::cancel()`.
8. `dismiss_job` should remove only terminal jobs. Reject dismissing running jobs unless cancellation has completed.

Tests:

- Starting a fake job records `started`.
- Poll drains events exactly once.
- Cancel flips the token.
- Dismiss refuses non-terminal jobs.
- Dismiss removes completed jobs.

Done when a fake job can be started in a unit test and lifecycle events are stable.

## Slice 4: Whole-Archive Extraction

Goal: a user can extract a full archive to a selected destination with progress and cancellation.

Command:

```text
start_extract(request: StartExtractRequest) -> Result<StartJobResponseDto, CommandErrorDto>
```

Request DTO:

```text
archivePath: string
destinationPath: string
password?: string
overwrite: "refuse" | "replace" | "rename"
stripComponents: number
```

Core APIs available today:

- `jobs::run_zip_extract_job_with_password_and_policy`
- `jobs::run_tar_zst_extract_job_with_policy`
- `jobs::run_7z_extract_job_with_password_and_policy`
- `jobs::run_rar_extract_job_with_password_and_policy`
- `jobs::run_libarchive_extract_job_with_password_and_policy`
- `jobs::run_tzap_extract_job_with_password_and_policy`
- `safety::ExtractionPolicy`
- `safety::OverwritePolicy`

Important routing rule:

If `zmanager-core` does not expose a single extract dispatcher, add one to `zmanager-core` first or keep routing in a clearly owned Rust helper with tests. Do not route formats in TypeScript.

Rust steps:

1. Validate path fields and overwrite policy.
2. Convert request overwrite into `OverwritePolicy`.
3. Build `ExtractionPolicy` with default limits, default unsafe-file handling, request overwrite, and request `stripComponents`.
4. Start a job through the job registry.
5. In the job body, route to the correct core job helper.
6. Map terminal reports into a stable summary:

```text
writtenEntries
skippedEntries
writtenBytes
warnings
```

7. Map password-required and invalid-password to terminal error codes that the UI can retry from.

Frontend steps:

1. Enable Extract after an archive is loaded.
2. Use native directory picker for the destination.
3. Present overwrite policy as a select or segmented control.
4. Start extraction and navigate or focus the Jobs tab.
5. Poll `poll_job_events` while any job is running.
6. Display current entry, bytes processed, total bytes when known, warnings, and terminal state.
7. Provide a Cancel button for running jobs.
8. Keep terminal jobs visible until dismissed.

Tests:

- Rust command starts a ZIP extract job and returns a job id.
- Polling receives started and completed events for a small ZIP.
- Cancellation requests are observable.
- Unsafe path fixtures are rejected by core safety, not bypassed in this repo.
- Password-required archives produce `password_required`.

Done when a ZIP can be extracted from the UI with visible job lifecycle and cancellation controls.

## Slice 5: Selected Entry Extraction And Preview

Goal: a user can extract selected rows and preview one supported file.

Core APIs to use:

- `archive_browser::extract_entry_with_options`
- `archive_browser::preview_entry_with_options`
- `archive_browser::BrowserExtractOptions`

Commands:

```text
extract_entry(request: ExtractEntryRequest) -> Result<EntryExtractResultDto, CommandErrorDto>
preview_entry(request: PreviewEntryRequest) -> Result<PreviewEntryResultDto, CommandErrorDto>
```

Request fields:

```text
archivePath
entryPath
destinationPath
password?
overwrite
stripComponents
```

Preview response fields:

```text
cleanupRoot
previewPath
writtenBytes
```

Steps:

1. Add row selection to the Browse table.
2. Enable selected-entry Extract when one or more rows are selected.
3. For single-row preview, call `preview_entry`.
4. Install `@tauri-apps/plugin-opener` and use it to open preview output.
5. Track cleanup roots in Rust state and delete them when replaced or app exits.
6. Refuse preview for unsupported entry kinds with an actionable error.

Tests:

- Extracting one file writes under the destination.
- Path traversal entries are rejected by core safety.
- Preview returns a cleanup root and preview path.
- Unsupported entries return `unsupported_format` or `operation_failed` with a clear message.

Done when a selected file can be extracted and previewed without unsafe writes.

## Slice 6: Create Planning

Goal: the user can choose sources and see what will be included before archive creation.

Core APIs to use:

- `zmanager_core::manifest::plan_archives`
- `zmanager_core::manifest::PlanOptions`

Command:

```text
plan_create(request: PlanCreateRequest) -> Result<CreatePlanDto, CommandErrorDto>
```

Request DTO:

```text
sources: string[]
cleanSource: boolean
respectGitignore?: boolean
excludeNames?: string[]
excludeArchivePaths?: string[]
includeArchivePaths?: string[]
followSymlinks?: boolean
```

Response DTO:

```text
includedCount
excludedCount
totalBytes
excludedBytes
entries[]
excludedEntries[]
warnings[]
```

Steps:

1. Add source file and directory picker controls.
2. Support drag/drop for source paths after native picker works.
3. Call `plan_create` whenever sources or planning options change, using a debounce in the UI.
4. Use `PlanOptions::clean_source()` when `cleanSource` is true.
5. Render included count, excluded count, total bytes, excluded bytes, warnings, and the first useful rows from each list.
6. Do not compute clean-source exclusions in TypeScript.

Tests:

- Empty sources are rejected.
- Normal mode includes expected fixture files.
- Clean source mode excludes `.git`, dependency folders, caches, and build outputs through core planner behavior.
- Warnings serialize without crashing the UI.

Done when a user can select sources and see a real plan.

## Slice 7: Archive Creation Jobs

Goal: a user can create ZIP, TAR.ZST/TZST, TZAP, and 7z archives from selected sources.

Command:

```text
start_create(request: StartCreateRequest) -> Result<StartJobResponseDto, CommandErrorDto>
```

Request DTO:

```text
sources: string[]
destinationPath: string
format: "zip" | "tarZst" | "tzap" | "sevenZ"
cleanSource: boolean
replaceExisting: boolean
password?: string
compressionLevel?: number
volumeSize?: number
preserveMetadata: boolean
```

Core APIs to use:

- `jobs::run_zip_create_job_from_sources_with_plan_options`
- `jobs::run_tar_zst_create_job_from_sources_with_plan_options`
- `jobs::run_tzap_create_job_from_sources_with_plan_options`
- `jobs::run_7z_create_job_from_sources_with_plan_options`
- `zip_backend::ZipCreateOptions`
- `tar_zst_backend::TarZstdCreateOptions`
- `tzap_backend::TzapCreateOptions`
- `tzap_backend::TzapKeySource`
- `sevenz_backend::SevenZCreateOptions`
- `secrets::SecretString`
- `manifest::PlanOptions`

Steps:

1. Reuse the job registry.
2. Validate sources, destination, format, compression level, and volume size.
3. Convert password strings to `SecretString` only inside the Rust command.
4. Do not store password in the job registry. Store only whether encryption was requested.
5. For TZAP, use `TzapKeySource::Passphrase(SecretString)` when a password is supplied, otherwise `TzapKeySource::NoPassword`.
6. For 7z and ZIP, set password options only when a non-empty password is supplied.
7. Use `PlanOptions::clean_source()` when `cleanSource` is true.
8. Return a job id immediately.
9. Surface completion summary and warnings through job events.

Frontend steps:

1. Add create format selector.
2. Add destination save dialog.
3. Add clean-source toggle.
4. Add password field only for encrypted modes and keep it in component memory only.
5. Start create job and show it in Jobs.
6. Block duplicate starts while a create request is already being submitted.

Tests:

- ZIP create writes a readable archive.
- TAR.ZST create writes a readable archive.
- 7z create maps password and no-password options correctly.
- TZAP create maps password and no-password key sources correctly.
- Clean source create uses clean plan options.
- Password values are not retained in job records or serialized events.

Done when users can create at least ZIP and TAR.ZST from the UI, with TZAP and 7z following the same job path.

## Slice 8: Archive Integrity Test

Goal: users can test an archive without extracting it.

Command:

```text
test_archive(request: TestArchiveRequest) -> Result<StartJobResponseDto, CommandErrorDto>
```

Steps:

1. Check whether `zmanager-core` already exposes a unified test dispatcher.
2. If missing, add the dispatcher in `zmanager-core` rather than duplicating backend test behavior here.
3. Run tests as jobs because large archives can take time.
4. Emit job events and terminal summary.
5. Prompt for passwords when required.

Tests:

- Test succeeds for a valid ZIP.
- Test fails with a stable error for corrupt input.
- Password-required and invalid-password are distinct.

Done when Test can run from the Browse toolbar and report success or failure in Jobs.

## Slice 9: Frontend Structure Cleanup

Goal: keep the UI maintainable before the single `main.ts` file becomes a trap.

Suggested structure:

```text
src/
  api/
    commands.ts
    types.ts
  app/
    state.ts
    constants.ts
  ui/
    browse.ts
    create.ts
    jobs.ts
    settings.ts
  main.ts
  styles.css
```

Steps:

1. Move all command request/response types into `src/api/types.ts`.
2. Move `invoke` wrappers into `src/api/commands.ts`.
3. Move user-facing strings that repeat into `src/app/constants.ts`.
4. Keep DOM rendering deterministic and easy to test.
5. Add Vitest only when there is actual frontend state logic to test.

Rules:

- Do not add a global frontend store until ordinary module state becomes painful.
- Do not use browser local storage for passwords or archive entry contents.
- Do not make the first screen a marketing page.
- Keep controls dense and operational.

Done when UI behavior remains the same and `npm run build` passes.

## Slice 10: Platform Integration

Goal: isolate Windows and Linux shell behavior behind owned modules.

Files to create:

```text
src-tauri/src/platform/mod.rs
src-tauri/src/platform/windows.rs
src-tauri/src/platform/linux.rs
```

Windows steps:

1. Keep Explorer integration in `platform/windows.rs`.
2. Add file associations through Tauri bundle config or installer scripts.
3. Add Explorer actions only after open/browse/extract/create commands work.
4. Prefer NSIS first unless the user chooses MSIX.
5. Prepare signing as a release step, not as local dev hard-coding.

Linux steps:

1. Keep `.desktop`, MIME, and package metadata under Linux-owned files.
2. Start with AppImage plus one package target from existing Tauri config.
3. Treat file-manager-specific extensions as follow-up work.
4. Respect XDG behavior and avoid distro-specific assumptions in shared code.

Tests:

- Windows package smoke test on a clean Windows VM.
- Linux package smoke test on at least one clean Linux VM.
- Installed app launches.
- Supported archive files open with ZManager through file association.

Done when packaging smoke tests are documented with exact OS versions and results.

## Slice 11: Release Hardening

Goal: make MVP safe enough to hand to real users.

Tasks:

1. Add command-boundary tests for validation, password-required flow, list mapping, create/extract lifecycle, cancellation, and error normalization.
2. Add path tests covering Windows drive letters, reserved names, backslashes, long paths, case collisions, and Linux permissions.
3. Add fixture archives from the public core repository if available.
4. Add a license/dependency audit step for frontend and Rust dependencies.
5. Pin `zmanager-core` for releases. Use a Git tag dependency or vendored submodule instead of an unpinned sibling path.
6. Review Tauri security settings before release. Development can tolerate permissive settings, but release should not leave security policy unexamined.
7. Add crash-safe cleanup for preview directories and partial temporary outputs.

Verification:

```sh
npm run build
cd src-tauri && cargo test
npm run tauri build
```

Done when the app can be installed and smoke-tested on clean Windows and Linux machines.

## Minimum MVP Acceptance Checklist

- App launches on Windows and Linux.
- Healthcheck reports `zmanager-core` ready.
- User can open and browse a ZIP archive.
- User can extract a ZIP archive to a selected destination.
- User can create a TAR.ZST archive from a folder.
- User can cancel a long-running job where the backend supports cooperative cancellation.
- Password-required archives trigger a password prompt.
- Errors are actionable and do not leak secrets.
- No archive behavior is implemented in TypeScript.
- `npm run build` passes.
- `cd src-tauri && cargo test` passes.
