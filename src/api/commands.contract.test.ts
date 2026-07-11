import { beforeEach, describe, expect, it, vi } from "vitest";

import rustMainSource from "../../src-tauri/src/main.rs?raw";
import * as api from "./commands";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const COMMAND_WRAPPERS = [
  { command: "healthcheck", call: () => api.fetchHealthcheck() },
  { command: "project_contract", call: () => api.fetchProjectContract() },
  {
    command: "system_file_icons",
    request: { entries: [{ key: "root", path: "C:/demo/root.txt", isDirectory: false }] },
    call: () => api.fetchSystemFileIcons({ entries: [{ key: "root", path: "C:/demo/root.txt", isDirectory: false }] }),
  },
  {
    command: "validate_directory",
    request: { path: "C:/output" },
    call: () => api.validateDirectory({ path: "C:/output" }),
  },
  { command: "quick_action_startup_state", call: () => api.fetchQuickActionStartupState() },
  {
    command: "list_archive",
    request: { archivePath: "C:/archives/demo.zip", password: "secret" },
    call: () => api.listArchive({ archivePath: "C:/archives/demo.zip", password: "secret" }),
  },
  {
    command: "plan_create",
    request: {
      sources: ["C:/source"],
      cleanSource: false,
      respectGitignore: true,
      followSymlinks: false,
    },
    call: () => api.runPlanCreate({
      sources: ["C:/source"],
      cleanSource: false,
      respectGitignore: true,
      followSymlinks: false,
    }),
  },
  {
    command: "start_create",
    request: {
      sources: ["C:/source"],
      destinationPath: "C:/output/demo.zip",
      format: "zip",
      cleanSource: false,
      replaceExisting: false,
      preserveMetadata: true,
    },
    call: () => api.runStartCreate({
      sources: ["C:/source"],
      destinationPath: "C:/output/demo.zip",
      format: "zip",
      cleanSource: false,
      replaceExisting: false,
      preserveMetadata: true,
    }),
  },
  {
    command: "start_extract",
    request: {
      archivePath: "C:/archives/demo.zip",
      destinationPath: "C:/output",
      overwrite: "refuse",
      stripComponents: 0,
    },
    call: () => api.runStartExtract({
      archivePath: "C:/archives/demo.zip",
      destinationPath: "C:/output",
      overwrite: "refuse",
      stripComponents: 0,
    }),
  },
  {
    command: "verify_tzap_certificate",
    request: {
      archivePath: "C:/archives/demo.tzap",
      validateTrust: true,
      trustedCaCertificatePaths: ["C:/certs/root.pem"],
      trustedSystemRoots: false,
      includeOfficialTzapRoot: true,
    },
    call: () => api.verifyTzapCertificate({
      archivePath: "C:/archives/demo.tzap",
      validateTrust: true,
      trustedCaCertificatePaths: ["C:/certs/root.pem"],
      trustedSystemRoots: false,
      includeOfficialTzapRoot: true,
    }),
  },
  {
    command: "generate_tzap_identity",
    request: { identityPath: "C:/certs/signer.p12", certificatePath: "C:/certs/signer.crt", commonName: "Signer" },
    call: () => api.generateTzapIdentity({ identityPath: "C:/certs/signer.p12", certificatePath: "C:/certs/signer.crt", commonName: "Signer" }),
  },
  {
    command: "preview_entry",
    request: {
      archivePath: "C:/archives/demo.zip",
      entryPath: "root.txt",
      overwrite: "refuse",
      stripComponents: 0,
    },
    call: () => api.runPreviewEntry({
      archivePath: "C:/archives/demo.zip",
      entryPath: "root.txt",
      overwrite: "refuse",
      stripComponents: 0,
    }),
  },
  {
    command: "start_native_file_drag",
    request: {
      archivePath: "C:/archives/demo.zip",
      entryPaths: ["root.txt"],
      stripComponents: 0,
    },
    call: () => api.runStartNativeFileDrag({
      archivePath: "C:/archives/demo.zip",
      entryPaths: ["root.txt"],
      stripComponents: 0,
    }),
  },
  { command: "cleanup_preview_roots", call: () => api.cleanupPreviewRoots() },
  {
    command: "test_archive",
    request: { archivePath: "C:/archives/demo.zip" },
    call: () => api.runTestArchive({ archivePath: "C:/archives/demo.zip" }),
  },
  {
    command: "poll_job_events",
    request: { jobId: "job-1" },
    call: () => api.pollJobEvents({ jobId: "job-1" }),
  },
  {
    command: "cancel_job",
    request: { jobId: "job-1" },
    call: () => api.cancelJob({ jobId: "job-1" }),
  },
  {
    command: "pause_job",
    request: { jobId: "job-1" },
    call: () => api.pauseJob({ jobId: "job-1" }),
  },
  {
    command: "resume_job",
    request: { jobId: "job-1" },
    call: () => api.resumeJob({ jobId: "job-1" }),
  },
  {
    command: "dismiss_job",
    request: { jobId: "job-1" },
    call: () => api.dismissJob({ jobId: "job-1" }),
  },
] as const;

describe("Tauri command contracts", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({});
  });

  it("keeps TypeScript wrappers aligned with Rust invoke handler command names", () => {
    expect(COMMAND_WRAPPERS.map((wrapper) => wrapper.command)).toEqual(rustInvokeHandlerCommands());
  });

  it("invokes every command with the expected request envelope", async () => {
    for (const wrapper of COMMAND_WRAPPERS) {
      invokeMock.mockClear();

      await wrapper.call();

      if ("request" in wrapper) {
        expect(invokeMock).toHaveBeenCalledWith(wrapper.command, { request: wrapper.request });
      } else {
        expect(invokeMock).toHaveBeenCalledWith(wrapper.command);
      }
    }
  });
});

function rustInvokeHandlerCommands(): string[] {
  const handlerBlock = rustMainSource.match(/tauri::generate_handler!\[\s*([\s\S]*?)\s*\]/)?.[1] ?? "";
  return [...handlerBlock.matchAll(/commands::([a-zA-Z0-9_]+)/g)].map((match) => match[1]);
}
