import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { ZManagerAppRuntimeProvider } from "../AppProviders";
import { createZManagerAppStore } from "../appStore";
import {
  createInitialZManagerReactSnapshot,
  noopZManagerReactActions,
} from "../appRuntime";
import { AccountWorkspace, type AccountWorkspaceProps } from "./AccountWorkspace";

describe("AccountWorkspace", () => {
  it("renders the React account surface from a secret-free snapshot", () => {
    const initial = createInitialZManagerReactSnapshot();
    const store = createZManagerAppStore(
      {
        ...initial,
        account: { ...initial.account, visible: true, notice: "Ready" },
      },
      noopZManagerReactActions,
    );
    const html = renderToStaticMarkup(
      createElement(
        ZManagerAppRuntimeProvider,
        { store },
        createElement<AccountWorkspaceProps>(AccountWorkspace, { defaultTab: "certificates" }),
      ),
    );
    expect(html).toContain("Identity &amp; Contacts");
    expect(html).toContain(
      "Local identities, recipient keys, verified contacts, and secure-store capabilities",
    );
    expect(html).not.toContain("Authentication: launch only");
    expect(html).toContain("Create local self-signed identity");
    expect(html).toContain("Import existing P12/PFX identity");
    expect(html).not.toContain("Export P12");
    expect(html).not.toContain("access_token");
  });

  it("separates retired recipient keys from active keys after retirement", () => {
    const initial = createInitialZManagerReactSnapshot();
    const store = createZManagerAppStore(
      {
        ...initial,
        account: {
          ...initial.account,
          visible: true,
          recipientKeys: [
            {
              keyId: "recipient-active",
              algorithm: "X25519",
              publicKeyFingerprint: "sha256:active",
              createdAtUnixSeconds: 1,
              label: "Active key",
              lifecycle: "active",
            },
            {
              keyId: "recipient-retired",
              algorithm: "X25519",
              publicKeyFingerprint: "sha256:retired",
              createdAtUnixSeconds: 2,
              label: "Retired key",
              lifecycle: "retired",
            },
          ],
        },
      },
      noopZManagerReactActions,
    );
    const html = renderToStaticMarkup(
      createElement(
        ZManagerAppRuntimeProvider,
        { store },
        createElement<AccountWorkspaceProps>(AccountWorkspace, { defaultTab: "contacts" }),
      ),
    );

    expect(html).toContain("Active key");
    expect(html).toContain("Retired recipient keys");
    expect(html).toContain("Retired key");
    expect(html).toContain("Retired");
    expect(html).not.toContain('aria-label="Retire Retired key"');
    expect(html).toContain('aria-label="Permanently delete Retired key"');
  });

  it("displays warning prompt when deleting a key configured in Global Options", () => {
    const initial = createInitialZManagerReactSnapshot();
    const store = createZManagerAppStore(
      {
        ...initial,
        account: {
          ...initial.account,
          visible: true,
          certificates: [
            {
              identityId: "identity-global-default",
              certificateId: "cert-global-default",
              label: "Global Default Cert",
              certificateSha256: "sha256:global",
              state: "active",
              assuranceLevel: "self_signed",
              notAfterUnixSeconds: 0,
            },
          ],
        },
        preferences: {
          ...initial.preferences,
          createFormatDefaults: {
            ...initial.preferences.createFormatDefaults,
            tzap: {
              ...initial.preferences.createFormatDefaults.tzap,
              tzapSigningDefault: "identity",
              tzapDefaultSigningIdentityId: "cert-global-default",
            },
          },
        },
      },
      noopZManagerReactActions,
    );
    const html = renderToStaticMarkup(
      createElement(
        ZManagerAppRuntimeProvider,
        { store },
        createElement<AccountWorkspaceProps>(AccountWorkspace, { defaultTab: "certificates" }),
      ),
    );

    expect(html).toContain("Global Default Cert");
    expect(html).toContain("Delete identity");
  });
});
