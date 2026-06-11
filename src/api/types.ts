export type HealthcheckResponse = {
  engine: string;
  version: string;
  ready: boolean;
  summary: string;
  shell: string;
  status: string;
};

export type ProjectContract = {
  commands: string[];
  platformStrategy: string;
  coreDependency: string;
};

export type CommandErrorDto = {
  code: string;
  message: string;
  hint?: string | null;
  severity: "info" | "warning" | "error";
  retryable: boolean;
};

export type ArchiveEntryKind = "file" | "directory" | "symlink" | "hardlink" | "special";

export type ArchiveEntryDto = {
  path: string;
  kind: ArchiveEntryKind;
  size?: number;
  compressedSize?: number;
  modified?: string;
};

export type ArchiveListingDto = {
  archivePath: string;
  entries: ArchiveEntryDto[];
  entryCount: number;
  totalSize?: number;
};

export type ListArchiveRequest = {
  archivePath: string;
  password?: string;
};

export type PlanCreateRequest = {
  sources: string[];
  cleanSource: boolean;
  respectGitignore: boolean;
  excludeNames?: string[];
  excludeArchivePaths?: string[];
  includeArchivePaths?: string[];
  followSymlinks: boolean;
};

export type CreatePlanResponse = {
  includedCount: number;
  excludedCount: number;
  totalBytes: number;
  excludedBytes: number;
  entries: string[];
  excludedEntries: string[];
  warnings: string[];
};

export type StartCreateRequest = {
  sources: string[];
  destinationPath: string;
  format: "zip" | "tarZst" | "tzap" | "sevenZ";
  cleanSource: boolean;
  replaceExisting: boolean;
  password?: string;
  compressionLevel?: number;
  volumeSize?: number;
  preserveMetadata: boolean;
};

export type StartExtractRequest = {
  archivePath: string;
  destinationPath: string;
  password?: string;
  overwrite: "refuse" | "replace" | "rename" | "ask";
  stripComponents: number;
};

export type ExtractEntryRequest = {
  archivePath: string;
  entryPath: string;
  destinationPath: string;
  password?: string;
  overwrite: "refuse" | "replace" | "rename" | "ask";
  stripComponents: number;
};

export type PreviewEntryRequest = {
  archivePath: string;
  entryPath: string;
  password?: string;
  overwrite: "refuse" | "replace" | "rename" | "ask";
  stripComponents: number;
};

export type PreviewEntryResponse = {
  cleanupRoot: string;
  previewPath: string;
  writtenBytes: number;
};

export type EntryExtractResponse = {
  destinationPath: string;
  writtenBytes: number;
};

export type TestArchiveRequest = {
  archivePath: string;
  password?: string;
};

export type PollJobEventsRequest = {
  jobId: string;
};

export type CancelJobRequest = {
  jobId: string;
};

export type DismissJobRequest = {
  jobId: string;
};

export type StartJobResponseDto = {
  jobId: string;
  kind: JobKind;
  status: JobStatus;
  createdAt: string;
};

export type PollJobEventsResponseDto = {
  jobId: string;
  kind: JobKind;
  status: JobStatus;
  createdAt: string;
  canDismiss: boolean;
  events: JobEventDto[];
  terminalSummary?: JobTerminalSummaryDto | null;
};

export type CancelJobResponseDto = {
  jobId: string;
  status: JobStatus;
};

export type JobEventDto = {
  eventType:
    | "started"
    | "entryStarted"
    | "bytesProcessed"
    | "entryFinished"
    | "warning"
    | "completed"
    | "failed"
    | "cancelled";
  jobKind?: JobKind;
  path?: string;
  bytes?: number;
  totalBytes?: number;
  totalBytesProcessed?: number;
  entries?: number;
  message?: string;
};

export type JobTerminalSummaryDto = {
  writtenEntries: number;
  skippedEntries?: number | null;
  writtenBytes: number;
  warnings: string[];
};

export type JobKind =
  | "zipCreate"
  | "zipExtract"
  | "sevenZCreate"
  | "sevenZExtract"
  | "rarExtract"
  | "tarZstdCreate"
  | "tarZstdExtract"
  | "tzapCreate"
  | "tzapExtract"
  | "archiveExtract"
  | "testArchive";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type BrowseState = "idle" | "loading" | "loaded" | "empty" | "error";
export type CreateState = "idle" | "loading" | "ready" | "error";

export type JobState = {
  snapshot: PollJobEventsResponseDto;
  events: JobEventDto[];
};
