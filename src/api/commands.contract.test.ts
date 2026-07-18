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
  { command: "default_handler_status", call: () => api.fetchDefaultHandlerStatus() },
  { command: "default_handler_set", call: () => api.setDefaultHandlers() },
  { command: "default_handler_restore", call: () => api.restoreDefaultHandlers() },
  { command: "replacement_migration_prepare", call: () => api.prepareReplacementMigration() },
  {
    command: "replacement_migration_complete",
    request: { schemaVersion: 1, appliedPreferenceKeys: ["defaultArchiveFormat"] },
    call: () => api.completeReplacementMigration(1, ["defaultArchiveFormat"]),
  },
  {
    command: "validate_directory",
    request: { path: "C:/output" },
    call: () => api.validateDirectory({ path: "C:/output" }),
  },
  { command: "quick_action_startup_state", call: () => api.fetchQuickActionStartupState() },
  {
    command: "consume_shell_action_request",
    args: { requestToken: "abcdefghijklmnopqrstuv" },
    call: () => api.consumeShellActionRequest("abcdefghijklmnopqrstuv"),
  },
  {
    command: "native_frontend_ready",
    args: { windowLabel: "main" },
    call: () => api.nativeFrontendReady("main"),
  },
  {
    command: "acknowledge_native_event",
    args: { windowLabel: "main", eventId: "event-1234567890" },
    call: () => api.acknowledgeNativeEvent("main", "event-1234567890"),
  },
  { command: "account_snapshot", call: () => api.fetchAccountSnapshot() },
  {
    command: "account_begin_hosted_auth",
    request: { localService: false },
    call: () => api.beginAccountHostedAuth(false),
  },
  {
    command: "account_apply_hosted_callback",
    request: { state: "state-1234567890", result: "completed" },
    call: () => api.applyAccountHostedCallback({ state: "state-1234567890", result: "completed" }),
  },
  { command: "account_forget", call: () => api.forgetAccount() },
  {
    command: "account_generate_recipient_key",
    request: { label: "Personal" },
    call: () => api.generateAccountRecipientKey("Personal"),
  },
  {
    command: "account_remove_recipient_key",
    request: { id: "recipient-1" },
    call: () => api.removeAccountRecipientKey("recipient-1"),
  },
  {
    command: "account_remove_contact",
    request: { id: "contact-1" },
    call: () => api.removeAccountContact("contact-1"),
  },
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
      tzapRestorePolicy: "portable",
      tzapAllowDegraded: false,
    },
    call: () => api.runStartExtract({
      archivePath: "C:/archives/demo.zip",
      destinationPath: "C:/output",
      overwrite: "refuse",
      stripComponents: 0,
      tzapRestorePolicy: "portable",
      tzapAllowDegraded: false,
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
  { command: "subscribe_job", args: { request: { jobId: "job-1" }, onSnapshot: null }, call: () => api.subscribeJob({ jobId: "job-1" }, null as never) },
  { command: "subscribe_job_catalog", args: { onSnapshot: null }, call: () => api.subscribeJobCatalog(null as never) },
  { command: "ack_subscription", request: { subscriptionId: "subscription-1", revision: "1" }, call: () => api.ackSubscription({ subscriptionId: "subscription-1", revision: "1" }) },
  { command: "unsubscribe_job", request: { subscriptionId: "subscription-1" }, call: () => api.unsubscribeJob({ subscriptionId: "subscription-1" }) },
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

      if ("args" in wrapper) {
        expect(invokeMock).toHaveBeenCalledWith(wrapper.command, wrapper.args);
      } else if ("request" in wrapper) {
        expect(invokeMock).toHaveBeenCalledWith(wrapper.command, { request: wrapper.request });
      } else {
        expect(invokeMock).toHaveBeenCalledWith(wrapper.command);
      }
    }
  });
});

function rustInvokeHandlerCommands(): string[] {
  const handlerBlock = rustMainSource.match(/tauri::generate_handler!\[\s*([\s\S]*?)\s*\]/)?.[1] ?? "";
  return [...handlerBlock.matchAll(/(?:commands|account|default_handlers|replacement_migration)::([a-zA-Z0-9_]+)/g)].map((match) => match[1]);
}
