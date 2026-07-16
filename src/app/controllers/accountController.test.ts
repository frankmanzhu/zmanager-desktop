import { describe, expect, it, vi } from "vitest";

import { createAccountWorkspace } from "../workspaces/accountWorkspace";
import { createAccountController } from "./accountController";

const empty = { authStatus: "signedOut" as const, pendingState: null, certificates: [], recipientKeys: [], contacts: [] };

describe("account controller", () => {
  it("loads through injected APIs and never persists callback material", async () => {
    const workspace = createAccountWorkspace();
    const publish = vi.fn();
    const applyHostedCallback = vi.fn(async () => {});
    const controller = createAccountController({
      workspace,
      fetchSnapshot: async () => empty,
      beginHostedAuth: async () => ({ launchUrl: "https://login.tzap.org/auth", state: "state-1234567890", expiresAtUnixSeconds: 2 }),
      applyHostedCallback,
      forget: async () => empty,
      generateRecipientKey: async () => empty,
      removeRecipientKey: async () => empty,
      removeContact: async () => empty,
      openUrl: async () => {},
      publish,
      errorMessage: String,
    });
    await controller.open();
    await controller.handleHostedCallback({ state: "state-1234567890", result: "completed" });
    expect(workspace.getSnapshot().authStatus).toBe("signedOut");
    expect(applyHostedCallback).toHaveBeenCalledWith({ state: "state-1234567890", result: "completed" });
    expect(JSON.stringify(workspace.getSnapshot())).not.toContain("token");
    expect(publish).toHaveBeenCalled();
  });

  it("normalizes failures into workspace notice state", async () => {
    const workspace = createAccountWorkspace();
    const controller = createAccountController({
      workspace,
      fetchSnapshot: async () => { throw new Error("offline"); },
      beginHostedAuth: async () => { throw new Error("offline"); },
      applyHostedCallback: async () => {},
      forget: async () => empty,
      generateRecipientKey: async () => empty,
      removeRecipientKey: async () => empty,
      removeContact: async () => empty,
      openUrl: async () => {},
      publish: () => {},
      errorMessage: (error) => error instanceof Error ? error.message : "unknown",
    });
    await controller.open();
    expect(workspace.getSnapshot().notice).toBe("offline");
    expect(workspace.getSnapshot().busy).toBe(false);
  });
});
