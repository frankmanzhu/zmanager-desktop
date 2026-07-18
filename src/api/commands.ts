import { invoke, type Channel } from "@tauri-apps/api/core";

import type {
  AccountHostedAuthLaunchDto,
  AccountSnapshotDto,
  ArchiveListingDto,
  CancelJobRequest,
  CancelJobResponseDto,
  CommandErrorDto,
  CreatePlanResponse,
  DefaultHandlerSnapshotDto,
  DismissJobRequest,
  GenerateTzapIdentityRequest,
  GenerateTzapIdentityResponse,
  HealthcheckResponse,
  JobControlResponseDto,
  JobCatalogEnvelopeDto,
  JobSnapshotEnvelopeDto,
  ListArchiveRequest,
  NativeFileDragRequest,
  NativeFileDragResponse,
  PauseJobRequest,
  PlanCreateRequest,
  PreviewEntryRequest,
  PreviewEntryResponse,
  ProjectContract,
  QuickActionRequestDto,
  QuickActionStartupStateDto,
  ResumeJobRequest,
  ReplacementMigrationPrepareResponseDto,
  StartCreateRequest,
  StartExtractRequest,
  StartJobResponseDto,
  SystemFileIconRequest,
  SystemFileIconResponse,
  TestArchiveRequest,
  ValidateDirectoryRequest,
  ValidateDirectoryResponse,
  VerifyTzapCertificateRequest,
  VerifyTzapCertificateResponse,
} from "./types";

export async function fetchAccountSnapshot(): Promise<AccountSnapshotDto> {
  return invoke<AccountSnapshotDto>("account_snapshot");
}

export async function beginAccountHostedAuth(localService = false): Promise<AccountHostedAuthLaunchDto> {
  return invoke<AccountHostedAuthLaunchDto>("account_begin_hosted_auth", {
    request: { localService },
  });
}

export async function applyAccountHostedCallback(request: {
  state: string;
  result: "completed" | "cancelled" | "failed";
  errorCode?: string | null;
}): Promise<void> {
  return invoke<void>("account_apply_hosted_callback", { request });
}

export async function forgetAccount(): Promise<AccountSnapshotDto> {
  return invoke<AccountSnapshotDto>("account_forget");
}

export async function generateAccountRecipientKey(label?: string): Promise<AccountSnapshotDto> {
  return invoke<AccountSnapshotDto>("account_generate_recipient_key", {
    request: { label },
  });
}

export async function removeAccountRecipientKey(id: string): Promise<AccountSnapshotDto> {
  return invoke<AccountSnapshotDto>("account_remove_recipient_key", { request: { id } });
}

export async function removeAccountContact(id: string): Promise<AccountSnapshotDto> {
  return invoke<AccountSnapshotDto>("account_remove_contact", { request: { id } });
}

export async function fetchHealthcheck(): Promise<HealthcheckResponse> {
  return invoke<HealthcheckResponse>("healthcheck");
}

export async function fetchProjectContract(): Promise<ProjectContract> {
  return invoke<ProjectContract>("project_contract");
}

export async function fetchSystemFileIcons(
  request: SystemFileIconRequest,
): Promise<SystemFileIconResponse> {
  return invoke<SystemFileIconResponse>("system_file_icons", {
    request,
  });
}

export async function fetchDefaultHandlerStatus(): Promise<DefaultHandlerSnapshotDto> {
  return invoke<DefaultHandlerSnapshotDto>("default_handler_status");
}

export async function setDefaultHandlers(): Promise<DefaultHandlerSnapshotDto> {
  return invoke<DefaultHandlerSnapshotDto>("default_handler_set");
}

export async function restoreDefaultHandlers(): Promise<DefaultHandlerSnapshotDto> {
  return invoke<DefaultHandlerSnapshotDto>("default_handler_restore");
}

export async function prepareReplacementMigration(): Promise<ReplacementMigrationPrepareResponseDto> {
  return invoke<ReplacementMigrationPrepareResponseDto>("replacement_migration_prepare");
}

export async function completeReplacementMigration(
  schemaVersion: number,
  appliedPreferenceKeys: string[],
): Promise<void> {
  return invoke<void>("replacement_migration_complete", {
    request: { schemaVersion, appliedPreferenceKeys },
  });
}

export async function validateDirectory(
  request: ValidateDirectoryRequest,
): Promise<ValidateDirectoryResponse> {
  return invoke<ValidateDirectoryResponse>("validate_directory", {
    request,
  });
}

export async function fetchQuickActionStartupState(): Promise<QuickActionStartupStateDto> {
  return invoke<QuickActionStartupStateDto>("quick_action_startup_state");
}

export async function consumeShellActionRequest(
  requestToken: string,
): Promise<QuickActionRequestDto> {
  return invoke<QuickActionRequestDto>("consume_shell_action_request", { requestToken });
}

export async function nativeFrontendReady(windowLabel: string): Promise<number> {
  return invoke<number>("native_frontend_ready", { windowLabel });
}

export async function acknowledgeNativeEvent(
  windowLabel: string,
  eventId: string,
): Promise<void> {
  return invoke<void>("acknowledge_native_event", { windowLabel, eventId });
}

export async function listArchive(request: ListArchiveRequest): Promise<ArchiveListingDto> {
  return invoke<ArchiveListingDto>("list_archive", {
    request,
  });
}

export async function runPlanCreate(request: PlanCreateRequest): Promise<CreatePlanResponse> {
  return invoke<CreatePlanResponse>("plan_create", {
    request,
  });
}

export async function runStartCreate(request: StartCreateRequest): Promise<StartJobResponseDto> {
  return invoke<StartJobResponseDto>("start_create", {
    request,
  });
}

export async function runStartExtract(request: StartExtractRequest): Promise<StartJobResponseDto> {
  return invoke<StartJobResponseDto>("start_extract", {
    request,
  });
}

export async function verifyTzapCertificate(
  request: VerifyTzapCertificateRequest,
): Promise<VerifyTzapCertificateResponse> {
  return invoke<VerifyTzapCertificateResponse>("verify_tzap_certificate", { request });
}

export async function generateTzapIdentity(request: GenerateTzapIdentityRequest): Promise<GenerateTzapIdentityResponse> {
  return invoke<GenerateTzapIdentityResponse>("generate_tzap_identity", { request });
}

export async function runPreviewEntry(request: PreviewEntryRequest): Promise<PreviewEntryResponse> {
  return invoke<PreviewEntryResponse>("preview_entry", {
    request,
  });
}

export async function runStartNativeFileDrag(
  request: NativeFileDragRequest,
): Promise<NativeFileDragResponse> {
  return invoke<NativeFileDragResponse>("start_native_file_drag", {
    request,
  });
}

export async function cleanupPreviewRoots(): Promise<void> {
  return invoke<void>("cleanup_preview_roots");
}

export async function runTestArchive(request: TestArchiveRequest): Promise<StartJobResponseDto> {
  return invoke<StartJobResponseDto>("test_archive", {
    request,
  });
}

export function subscribeJob(request: { jobId: string }, onSnapshot: Channel<JobSnapshotEnvelopeDto>): Promise<string> {
  return invoke<string>("subscribe_job", { request, onSnapshot });
}
export function subscribeJobCatalog(onSnapshot: Channel<JobCatalogEnvelopeDto>): Promise<string> {
  return invoke<string>("subscribe_job_catalog", { onSnapshot });
}
export function ackSubscription(request: { subscriptionId: string; revision: string }): Promise<void> {
  return invoke<void>("ack_subscription", { request });
}
export function unsubscribeJob(request: { subscriptionId: string }): Promise<void> {
  return invoke<void>("unsubscribe_job", { request });
}

export async function cancelJob(request: CancelJobRequest): Promise<CancelJobResponseDto> {
  return invoke<CancelJobResponseDto>("cancel_job", {
    request,
  });
}

export async function pauseJob(request: PauseJobRequest): Promise<JobControlResponseDto> {
  return invoke<JobControlResponseDto>("pause_job", {
    request,
  });
}

export async function resumeJob(request: ResumeJobRequest): Promise<JobControlResponseDto> {
  return invoke<JobControlResponseDto>("resume_job", {
    request,
  });
}

export async function dismissJob(request: DismissJobRequest): Promise<void> {
  return invoke<void>("dismiss_job", {
    request,
  });
}

export function asCommandError(value: unknown): CommandErrorDto | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<CommandErrorDto>;
  if (typeof candidate.code !== "string" || typeof candidate.message !== "string") {
    return null;
  }

  return {
    code: candidate.code,
    message: candidate.message,
    hint: candidate.hint,
    severity: candidate.severity ?? "error",
    retryable: Boolean(candidate.retryable),
  };
}
