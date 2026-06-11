import { invoke } from "@tauri-apps/api/core";

import type {
  ArchiveListingDto,
  CancelJobRequest,
  CancelJobResponseDto,
  CommandErrorDto,
  CreatePlanResponse,
  DismissJobRequest,
  EntryExtractResponse,
  ExtractEntryRequest,
  HealthcheckResponse,
  ListArchiveRequest,
  PollJobEventsRequest,
  PollJobEventsResponseDto,
  PlanCreateRequest,
  PreviewEntryRequest,
  PreviewEntryResponse,
  ProjectContract,
  StartCreateRequest,
  StartExtractRequest,
  StartJobResponseDto,
  TestArchiveRequest,
} from "./types";

export async function fetchHealthcheck(): Promise<HealthcheckResponse> {
  return invoke<HealthcheckResponse>("healthcheck");
}

export async function fetchProjectContract(): Promise<ProjectContract> {
  return invoke<ProjectContract>("project_contract");
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

export async function runExtractEntry(request: ExtractEntryRequest): Promise<EntryExtractResponse> {
  return invoke<EntryExtractResponse>("extract_entry", {
    request,
  });
}

export async function runPreviewEntry(request: PreviewEntryRequest): Promise<PreviewEntryResponse> {
  return invoke<PreviewEntryResponse>("preview_entry", {
    request,
  });
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
