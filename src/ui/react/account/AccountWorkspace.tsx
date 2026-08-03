import {
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";

export function AccountWorkspace() {
  const fullSnapshot = useZManagerSnapshot();
  const snapshot = fullSnapshot.account;
  const preferences = fullSnapshot.preferences;
  const actions = useZManagerActions();
  const [contactCardText, setContactCardText] = useState("");
  const [verifiedContactCardText, setVerifiedContactCardText] = useState("");
  const [identityName, setIdentityName] = useState("TZAP Signing Identity");
  const [identityImportLabel, setIdentityImportLabel] = useState("");
  const [identityImportPassword, setIdentityImportPassword] = useState("");
  const [identityPendingRemoval, setIdentityPendingRemoval] = useState<string | null>(null);
  if (!snapshot.visible) return null;
  const activeRecipientKeys = snapshot.recipientKeys.filter((key) => key.lifecycle === "active");
  const retiredRecipientKeys = snapshot.recipientKeys.filter((key) => key.lifecycle === "retired");
  const hostedAccountVisible = snapshot.capabilities.auth === "handoff_exchange"
    || snapshot.capabilities.enrollment === "available"
    || snapshot.capabilities.enrollment === "approval_required"
    || snapshot.capabilities.status === "online";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-6"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          actions.handleAccountIntent({ type: "close" });
        }
      }}
    >
      <section
        className="grid max-h-[calc(100vh-48px)] w-[min(920px,calc(100vw-48px))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        tabIndex={-1}
        autoFocus
      >
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <UserRound className="size-5" />
          <div className="min-w-0 flex-1">
            <h2 id="account-title" className="font-semibold">
              Identity &amp; Contacts
            </h2>
            <p className="text-xs opacity-65">
              Local identities, recipient keys, verified contacts, and secure-store capabilities
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close account"
            onClick={() => actions.handleAccountIntent({ type: "close" })}
          >
            <X className="size-4" />
          </Button>
        </header>
        <div className="grid gap-5 overflow-y-auto p-5">
          {hostedAccountVisible ? <section className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="mr-auto">
                Account · {accountStatus(snapshot.authStatus)}
              </strong>
              <Button
                disabled={snapshot.busy || snapshot.capabilities.auth !== "handoff_exchange"}
                title={snapshot.capabilities.auth !== "handoff_exchange" ? "Hosted authentication is disabled for the local-only flow" : undefined}
                onClick={() =>
                  actions.handleAccountIntent({ type: "beginHostedAuth" })
                }
              >
                {snapshot.capabilities.auth === "handoff_exchange" ? "Open Hosted Account" : "Hosted sign-in unavailable"}
              </Button>
              <Button
                variant="secondary"
                disabled={snapshot.busy}
                onClick={() => actions.handleAccountIntent({ type: "refresh" })}
              >
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
              <Button
                variant="secondary"
                disabled={snapshot.busy}
                onClick={() => actions.handleAccountIntent({ type: "forget" })}
              >
                Clear hosted session
              </Button>
            </div>
            <div className="grid gap-1 text-[11px] opacity-70 sm:grid-cols-2">
              <span>Authentication: {snapshot.capabilities.auth.replaceAll("_", " ")}</span>
              <span>Enrollment: {snapshot.capabilities.enrollment.replaceAll("_", " ")}</span>
              <span>Status: {snapshot.capabilities.status.replaceAll("_", " ")}</span>
              <span>Account management: {snapshot.capabilities.accountManagement.replaceAll("_", " ")}</span>
            </div>
          </section> : null}
          {snapshot.notice ? (
            <p
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-900"
              role="status"
            >
              {snapshot.notice}
            </p>
          ) : null}
          <InventorySection
            title="Signing identities"
            icon={<ShieldCheck className="size-4" />}
            empty="No local certificates."
          >
            <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
              <div>
                <strong className="text-xs">Create local self-signed identity</strong>
                <p className="mt-1 text-[11px] opacity-65">
                  The private key stays in the native secure store and the public certificate metadata stays in the local Account catalog. No .p12 file or password is created by this flow.
                </p>
              </div>
              <label className="grid min-w-[220px] flex-1 gap-1 text-xs font-semibold">
                Common name
                <Input
                  className="text-xs"
                  value={identityName}
                  onChange={(event) => setIdentityName(event.currentTarget.value)}
                />
              </label>
              <Button
                variant="secondary"
                className="w-fit"
                disabled={snapshot.busy || !identityName.trim()}
                onClick={() => {
                  actions.handleAccountIntent({
                    type: "createSelfSignedCertificateStore",
                    commonName: identityName,
                  });
                }}
              >
                {snapshot.busy ? "Working…" : "Create identity"}
              </Button>
            </div>
            <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
              <div>
                <strong className="text-xs">Import existing P12/PFX identity</strong>
                <p className="mt-1 text-[11px] opacity-65">
                  The bundle is validated, its private key moves into the native secure store, and its public certificate chain is added to Account. The original file is not copied into the inventory.
                </p>
              </div>
              <label className="grid gap-1 text-xs font-semibold">
                Account label (optional)
                <Input
                  className="text-xs font-normal"
                  value={identityImportLabel}
                  onChange={(event) => setIdentityImportLabel(event.currentTarget.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold">
                P12/PFX password (optional)
                <Input
                  className="text-xs font-normal"
                  type="password"
                  value={identityImportPassword}
                  onChange={(event) => setIdentityImportPassword(event.currentTarget.value)}
                  autoComplete="off"
                />
              </label>
              <Button
                variant="secondary"
                className="w-fit"
                disabled={snapshot.busy}
                onClick={() => {
                  actions.handleAccountIntent({
                    type: "importSigningIdentity",
                    password: identityImportPassword,
                    label: identityImportLabel || undefined,
                  });
                  setIdentityImportPassword("");
                }}
              >
                {snapshot.busy ? "Working…" : "Choose P12/PFX and import"}
              </Button>
            </div>
            {snapshot.certificates.map((certificate) => {
              const tzapDefaults = preferences.createFormatDefaults.tzap;
              const isDirectGlobalDefault = tzapDefaults.tzapSigningDefault === "identity" && tzapDefaults.tzapDefaultSigningIdentityId === certificate.identityId;
              const isAccountDefault = snapshot.defaultSigningIdentityId === certificate.identityId;
              const isUsedInGlobalDefaults = isDirectGlobalDefault || (tzapDefaults.tzapSigningDefault === "accountDefault" && isAccountDefault);

              return (
                <article
                  className="grid gap-1 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"
                  key={certificate.identityId}
                >
                  <strong>{certificate.label || certificate.identityId}</strong>
                  <span className="opacity-65">{certificate.certificateId}</span>
                  <code className="truncate opacity-70">
                    {certificate.certificateSha256}
                  </code>
                  <span>
                    {certificate.state} · {certificate.assuranceLevel}
                  </span>
                  <span className="opacity-65">Private key resolved only at archive handoff.</span>
                  <Button
                    variant={snapshot.defaultSigningIdentityId === certificate.identityId ? "secondary" : "ghost"}
                    className="mt-1 w-fit !px-2 !py-1 !text-[11px]"
                    disabled={snapshot.busy || certificate.state !== "active" || snapshot.defaultSigningIdentityId === certificate.identityId}
                    onClick={() => actions.handleAccountIntent({ type: "setDefaultSigningIdentity", id: certificate.identityId })}
                  >
                    {snapshot.defaultSigningIdentityId === certificate.identityId ? "Default signing identity" : "Set as default"}
                  </Button>
                  {identityPendingRemoval === certificate.identityId ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md bg-red-50 p-2 text-[11px] text-red-800 dark:bg-red-950/40 dark:text-red-200">
                      <span className="mr-auto">
                        {isDirectGlobalDefault
                          ? "This signing key is currently selected as your default in Global Options for TZAP archives. Deleting it will change your Global Options signing preference to 'No signature'."
                          : isUsedInGlobalDefaults
                            ? "This signing key is currently set as your Account Default, which is used by Global Options for TZAP archives. Deleting it will clear your Account Default and set Global Options to 'No signature'."
                            : "Deletes the Keychain private key and removes this identity from Account. Separately created Advanced signing files are untouched."}
                      </span>
                      <Button
                        variant="destructive"
                        className="!h-7 !px-2 !text-[11px]"
                        disabled={snapshot.busy}
                        onClick={() => {
                          actions.handleAccountIntent({ type: "removeSigningIdentity", id: certificate.identityId });
                          if (isUsedInGlobalDefaults) {
                            actions.handleDialogIntent({
                              type: "preferencesSaveDirectPatch",
                              patch: {
                                createFormatDefaults: {
                                  ...preferences.createFormatDefaults,
                                  tzap: {
                                    ...tzapDefaults,
                                    tzapSigningDefault: "none",
                                    tzapDefaultSigningIdentityId: null,
                                  },
                                },
                              },
                            });
                          }
                          setIdentityPendingRemoval(null);
                        }}
                      >
                        {isUsedInGlobalDefaults ? "Remove Key & Set to No Signature" : "Confirm delete"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="!h-7 !px-2 !text-[11px]"
                        onClick={() => setIdentityPendingRemoval(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="destructive"
                      className="mt-1 w-fit !px-2 !py-1 !text-[11px]"
                      disabled={snapshot.busy}
                      onClick={() => setIdentityPendingRemoval(certificate.identityId)}
                    >
                      Delete identity
                    </Button>
                  )}
                </article>
              );
            })}
          </InventorySection>
          <InventorySection
            title="Your recipient keys"
            icon={<KeyRound className="size-4" />}
            empty="No recipient keys."
          >
            <div className="mb-2">
              <Button
                disabled={snapshot.busy}
                onClick={() =>
                  actions.handleAccountIntent({
                    type: "generateRecipientKey",
                    label: "Personal share key",
                  })
                }
              >
                Generate key
              </Button>
            </div>
            {activeRecipientKeys.map((key) => (
              <article
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"
                key={key.keyId}
              >
                <div className="min-w-0 flex-1">
                  <strong>{key.label || key.keyId}</strong>
                  <code className="mt-1 block truncate opacity-70">
                    {key.publicKeyFingerprint}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Retire ${key.label || key.keyId}`}
                  disabled={snapshot.busy}
                  onClick={() =>
                    actions.handleAccountIntent({
                      type: "removeRecipientKey",
                      id: key.keyId,
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </article>
            ))}
            {!activeRecipientKeys.length ? (
              <p className="text-xs opacity-60">No active recipient keys.</p>
            ) : null}
            {retiredRecipientKeys.length ? (
              <div className="mt-2 grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-xs dark:border-slate-700">
                <strong>Retired recipient keys</strong>
                <p className="text-[11px] opacity-65">
                  Retired keys remain available for decrypting existing archives but are not offered for new archives.
                </p>
                {retiredRecipientKeys.map((key) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 opacity-80 dark:border-slate-800"
                    key={key.keyId}
                  >
                    <div className="min-w-0 flex-1">
                      <strong>{key.label || key.keyId}</strong>
                      <code className="mt-1 block truncate opacity-70">
                        {key.publicKeyFingerprint}
                      </code>
                    </div>
                    <span className="text-[11px] opacity-60">Retired</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Permanently delete ${key.label || key.keyId}`}
                      disabled={snapshot.busy}
                      onClick={() =>
                        actions.handleAccountIntent({
                          type: "removeRecipientKey",
                          id: key.keyId,
                        })
                      }
                    >
                      <Trash2 className="size-4 text-red-500 hover:text-red-600 dark:text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </InventorySection>
          <InventorySection
            title="Trusted contacts"
            icon={<UserRound className="size-4" />}
            empty="No trusted contacts."
          >
            {snapshot.contacts.map((contact) => (
              <article
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"
                key={contact.contactId}
              >
                <div className="min-w-0 flex-1">
                  <strong>{contact.displayName}</strong>
                  <code className="mt-1 block truncate opacity-70">
                    {contact.recipientPublicKeyFingerprint}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${contact.displayName}`}
                  onClick={() =>
                    actions.handleAccountIntent({
                      type: "removeContact",
                      id: contact.contactId,
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </article>
            ))}
            <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
              <label className="grid gap-1 text-xs font-semibold" htmlFor="contact-card-input">
                Import contact card for verification
                <Textarea
                  id="contact-card-input"
                  className="min-h-24 text-[11px] font-normal"
                  placeholder="Paste the signed contact-card JSON"
                  value={contactCardText}
                  onChange={(event) => {
                    setContactCardText(event.currentTarget.value);
                    setVerifiedContactCardText("");
                  }}
                />
              </label>
              <Button
                variant="secondary"
                disabled={snapshot.busy || !contactCardText.trim()}
                onClick={() => {
                  setVerifiedContactCardText(contactCardText);
                  actions.handleAccountIntent({ type: "inspectContactCard", contactCard: contactCardText });
                }}
              >
                <ShieldCheck className="mr-2 size-4" />
                Verify card
              </Button>
              {snapshot.contactCardPreview ? (
                <div className="grid gap-1 rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-900" role="status">
                  <strong>{snapshot.contactCardPreview.displayName}</strong>
                  <span>{snapshot.contactCardPreview.verificationState} · {snapshot.contactCardPreview.trustSource}</span>
                  <code className="truncate opacity-70">{snapshot.contactCardPreview.recipientPublicKeyFingerprint}</code>
                  {snapshot.contactCardPreview.missingStatusCaveat ? <span className="text-amber-700 dark:text-amber-300">Current online status was not confirmed.</span> : null}
                  <Button
                    disabled={snapshot.busy || verifiedContactCardText !== contactCardText}
                    onClick={() => actions.handleAccountIntent({ type: "acceptContactCard", contactCard: contactCardText })}
                  >
                    Accept as trusted contact
                  </Button>
                </div>
              ) : null}
            </div>
          </InventorySection>
        </div>
      </section>
    </div>
  );
}

function InventorySection({
  title,
  icon,
  empty,
  children,
}: Readonly<{
  title: string;
  icon: React.ReactNode;
  empty: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="grid gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <div className="grid gap-2">
        {children || <p className="text-xs opacity-60">{empty}</p>}
      </div>
    </section>
  );
}

function accountStatus(value: string): string {
  return (
    (
      {
        signedOut: "Signed out",
        pending: "Sign-in pending",
        launchOnlyCallbackCompleted: "Callback received; not connected",
        cancelled: "Cancelled",
        failed: "Failed",
      } as Record<string, string>
    )[value] ?? value
  );
}
