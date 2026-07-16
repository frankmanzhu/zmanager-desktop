import { describe, expect, it } from "vitest";

import { createAccountWorkspace } from "./accountWorkspace";

describe("account workspace", () => {
  it("publishes immutable secret-free inventory snapshots", () => {
    const workspace = createAccountWorkspace();
    workspace.open();
    const snapshot = workspace.replace({
      authStatus: "pending",
      pendingState: "state-1234567890",
      certificates: [],
      recipientKeys: [{
        keyId: "recipient-1",
        algorithm: "p256",
        publicKeyFingerprint: "ab".repeat(32),
        createdAtUnixSeconds: 1,
        label: "Personal",
      }],
      contacts: [],
    });
    expect(snapshot.visible).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.recipientKeys)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("privateKey");
  });

  it("keeps visibility, busy state, and notices workspace-owned", () => {
    const workspace = createAccountWorkspace();
    expect(workspace.open().visible).toBe(true);
    expect(workspace.setBusy(true).busy).toBe(true);
    expect(workspace.setNotice("Pending").notice).toBe("Pending");
    expect(workspace.close().visible).toBe(false);
  });
});
