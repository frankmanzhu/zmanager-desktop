import { UserRound, Trash2, ShieldCheck, KeyRound } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { useState } from "react";
import { InventorySection } from "./InventorySection";

export function ContactsTab() {
  const fullSnapshot = useZManagerSnapshot();
  const snapshot = fullSnapshot.account;
  const actions = useZManagerActions();

  const [contactCardText, setContactCardText] = useState("");
  const [verifiedContactCardText, setVerifiedContactCardText] = useState("");
  
  const [exportName, setExportName] = useState("");

  const activeRecipientKeys = snapshot.recipientKeys.filter((key) => key.lifecycle === "active");
  const retiredRecipientKeys = snapshot.recipientKeys.filter((key) => key.lifecycle === "retired");

  return (
    <div className="grid gap-5">
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
      
      <InventorySection
        title="Export Your Contact Card"
        icon={<UserRound className="size-4" />}
        empty=""
      >
        <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
          <label className="grid min-w-[220px] flex-1 gap-1 text-xs font-semibold">
            Display name
            <Input
              className="text-xs"
              value={exportName}
              onChange={(event) => setExportName(event.currentTarget.value)}
            />
          </label>
          <Button
            variant="secondary"
            className="w-fit"
            disabled={snapshot.busy || !exportName.trim()}
            onClick={() => {
              actions.handleAccountIntent({
                type: "exportContactCard"
              } as any);
            }}
          >
            {snapshot.busy ? "Working…" : "Export Contact Card"}
          </Button>
        </div>
      </InventorySection>
    </div>
  );
}
