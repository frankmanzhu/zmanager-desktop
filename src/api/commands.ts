import { invoke } from "@tauri-apps/api/core";

import type {
  ArchiveListingDto,
  CancelJobRequest,
  CancelJobResponseDto,
  CommandErrorDto,
  CreatePlanResponse,
  DismissJobRequest,
  HealthcheckResponse,
  JobControlResponseDto,
  ListArchiveRequest,
  NativeFileDragRequest,
  NativeFileDragResponse,
  PauseJobRequest,
  PollJobEventsRequest,
  PollJobEventsResponseDto,
  PlanCreateRequest,
  PreviewEntryRequest,
  PreviewEntryResponse,
  ProjectContract,
  QuickActionStartupStateDto,
  ResumeJobRequest,
  StartCreateRequest,
  StartExtractRequest,
  StartJobResponseDto,
  SystemFileIconRequest,
  SystemFileIconResponse,
  TestArchiveRequest,
} from "./types";

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

export async function fetchQuickActionStartupState(): Promise<QuickActionStartupStateDto> {
  return invoke<QuickActionStartupStateDto>("quick_action_startup_state");
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

export async function pollJobEvents(
  request: PollJobEventsRequest,
): Promise<PollJobEventsResponseDto> {
  return invoke<PollJobEventsResponseDto>("poll_job_events", {
    request,
  });
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
