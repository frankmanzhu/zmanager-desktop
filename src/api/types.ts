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
  platformIntegration: {
    platform: string;
    explorerIntegrationEnabled: boolean;
    desktopActionsEnabled: boolean;
    associatedExtensions: string[];
    shellActions: {
      label: string;
      quickAction: string;
    }[];
  };
};

export type SystemFileIconRequestEntry = {
  key: string;
  path: string;
  isDirectory: boolean;
};

export type SystemFileIconRequest = {
  entries: SystemFileIconRequestEntry[];
};

export type SystemFileIconDto = {
  key: string;
  dataUrl?: string | null;
};

export type SystemFileIconResponse = {
  icons: SystemFileIconDto[];
};

export type ValidateDirectoryRequest = {
  path: string;
};

export type ValidateDirectoryResponse = {
  exists: boolean;
  isDirectory: boolean;
  accessible: boolean;
};

export type QuickActionKind =
  | "open"
  | "compress"
  | "extract"
  | "compressZip"
  | "compressTzap"
  | "compressSevenZ"
  | "compressTarZst"
  | "compressCleanSource"
  | "extractHere"
  | "extractToFolder";

export type QuickActionRequestDto = {
  kind: QuickActionKind;
  paths: string[];
};

export type QuickActionStartupErrorDto = {
  code: string;
  message: string;
  hint?: string | null;
};

export type QuickActionStartupStateDto = {
  launchedForQuickAction: boolean;
  quickAction?: QuickActionRequestDto | null;
  quickActionJobs?: StartJobResponseDto[] | null;
  error?: QuickActionStartupErrorDto | null;
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
  created?: string;
  accessed?: string;
  attributes?: string;
  encrypted?: boolean;
  method?: string;
  crc?: string;
  block?: number;
  comment?: string;
  solid?: boolean;
  linkTarget?: string;
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
  planEntries: CreatePlanEntryDto[];
  excludedEntries: string[];
  warnings: string[];
};

export type CreatePlanEntryDto = {
  path: string;
  kind: ArchiveEntryKind;
  size?: number;
  modified?: string;
  sourcePath: string;
};

export type StartCreateRequest = {
  sources: string[];
  destinationPath: string;
  format: "zip" | "tarZst" | "tzap" | "sevenZ";
  cleanSource: boolean;
  excludeNames?: string[];
  excludeArchivePaths?: string[];
  includeArchivePaths?: string[];
  respectGitignore?: boolean;
  followSymlinks?: boolean;
  replaceExisting: boolean;
  destinationCollisionStrategy?: "refuse" | "rename";
  password?: string;
  compressionLevel?: number;
  volumeSize?: number;
  tzapRecoveryPercentage?: number;
  tzapVolumeLossTolerance?: number;
  zipCompression?: "store" | "deflate";
  sevenZSolid?: boolean;
  sevenZThreads?: number;
  sevenZChunkSize?: number;
  sevenZEncryptFileNames?: boolean;
  tzapCertificates?: TzapCertificateOptions;
  preserveMetadata: boolean;
};

export type TzapCertificateOptions = {
  recipientCertificatePaths?: string[];
  signingCertificatePath?: string;
  signingPrivateKeyPath?: string;
  signingChainPaths?: string[];
};

export type StartExtractRequest = {
  archivePath: string;
  destinationPath: string;
  password?: string;
  overwrite: "refuse" | "replace" | "rename" | "ask";
  destinationCollisionStrategy?: "refuse" | "rename";
  entryPaths?: string[];
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

export type NativeFileDragRequest = {
  archivePath: string;
  entryPaths: string[];
  password?: string;
  stripComponents: number;
};

export type NativeFileDragResponse = {
  outcome: "dropped" | "cancelled" | "noDrop";
  draggedEntries: string[];
};

export type TestArchiveRequest = {
  archivePath: string;
  entryPaths?: string[];
  password?: string;
};

export type PollJobEventsRequest = {
  jobId: string;
};

export type CancelJobRequest = {
  jobId: string;
};

export type PauseJobRequest = {
  jobId: string;
};

export type ResumeJobRequest = {
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

export type JobControlResponseDto = {
  jobId: string;
  status: JobStatus;
};

export type JobEventDto = {
  eventType:
    | "started"
    | "entryStarted"
    | "bytesProcessed"
    | "entryFinished"
    | "paused"
    | "resumed"
    | "warning"
    | "completed"
    | "failed"
    | "cancelled";
  jobKind?: JobKind;
  code?: string;
  hint?: string | null;
  severity?: "info" | "warning" | "error";
  retryable?: boolean | null;
  path?: string;
  bytes?: number;
  totalBytes?: number;
  totalBytesProcessed?: number;
  entries?: number;
  totalEntries?: number;
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
  | "appleArchiveCreate"
  | "appleArchiveExtract"
  | "archiveExtract"
  | "rawStreamExtract"
  | "testArchive";

export type JobStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export type BrowseState = "idle" | "loading" | "loaded" | "empty" | "error";
export type CreateState = "idle" | "loading" | "ready" | "error";

export type JobState = {
  snapshot: PollJobEventsResponseDto;
  events: JobEventDto[];
};
