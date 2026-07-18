import {
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { Button } from "../../components/ui/button";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";

export function AccountWorkspace() {
  const snapshot = useZManagerSnapshot().account;
  const actions = useZManagerActions();
  if (!snapshot.visible) return null;

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
              TZAP Account
            </h2>
            <p className="text-xs opacity-65">
              Identity, certificates, recipient keys, and trusted contacts
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
          <section className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="mr-auto">
                Account · {accountStatus(snapshot.authStatus)}
              </strong>
              <Button
                disabled={snapshot.busy}
                onClick={() =>
                  actions.handleAccountIntent({ type: "beginHostedAuth" })
                }
              >
                Sign in
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
                variant="destructive"
                disabled={snapshot.busy}
                onClick={() => actions.handleAccountIntent({ type: "forget" })}
              >
                Forget
              </Button>
            </div>
            {snapshot.notice ? (
              <p
                className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-900"
                role="status"
              >
                {snapshot.notice}
              </p>
            ) : null}
          </section>
          <InventorySection
            title="Certificates"
            icon={<ShieldCheck className="size-4" />}
            empty="No local certificates."
          >
            {snapshot.certificates.map((certificate) => (
              <article
                className="grid gap-1 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"
                key={certificate.certificateId}
              >
                <strong>{certificate.certificateId}</strong>
                <code className="truncate opacity-70">
                  {certificate.certificateSha256}
                </code>
                <span>
                  {certificate.state} · {certificate.assuranceLevel}
                </span>
              </article>
            ))}
          </InventorySection>
          <InventorySection
            title="Recipient keys"
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
            {snapshot.recipientKeys.map((key) => (
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
                  aria-label={`Remove ${key.label || key.keyId}`}
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
        callbackCompleted: "Callback completed",
        cancelled: "Cancelled",
        failed: "Failed",
      } as Record<string, string>
    )[value] ?? value
  );
}
