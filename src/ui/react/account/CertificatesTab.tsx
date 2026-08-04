import { ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { useState } from "react";
import { InventorySection } from "./InventorySection";

export function CertificatesTab() {
  const fullSnapshot = useZManagerSnapshot();
  const snapshot = fullSnapshot.account;
  const preferences = fullSnapshot.preferences;
  const actions = useZManagerActions();

  const [identityName, setIdentityName] = useState("TZAP Signing Identity");
  const [identityImportLabel, setIdentityImportLabel] = useState("");
  const [identityImportPassword, setIdentityImportPassword] = useState("");
  const [identityPendingRemoval, setIdentityPendingRemoval] = useState<string | null>(null);

  return (
    <div className="grid gap-5">
      <InventorySection
        title="Signing identities"
        icon={<ShieldCheck className="size-4" />}
        empty="No local certificates."
      >
        <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
          <div>
            <strong className="text-xs">Enroll device certificate</strong>
            <p className="mt-1 text-[11px] opacity-65">
              Generates a new device key and enrolls it with the server using your active session.
            </p>
          </div>
          <Button
            variant="secondary"
            className="w-fit"
            disabled={snapshot.busy || snapshot.authStatus !== "signedIn"}
            onClick={() => {
              actions.handleAccountIntent({ type: "enrollDeviceCertificate" } as any);
            }}
          >
            {snapshot.busy ? "Working…" : "Enroll Certificate"}
          </Button>
        </div>
        
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
              <div className="flex gap-2">
                <Button
                  variant={snapshot.defaultSigningIdentityId === certificate.identityId ? "secondary" : "ghost"}
                  className="mt-1 w-fit !px-2 !py-1 !text-[11px]"
                  disabled={snapshot.busy || certificate.state !== "active" || snapshot.defaultSigningIdentityId === certificate.identityId}
                  onClick={() => actions.handleAccountIntent({ type: "setDefaultSigningIdentity", id: certificate.identityId })}
                >
                  {snapshot.defaultSigningIdentityId === certificate.identityId ? "Default signing identity" : "Set as default"}
                </Button>
                {certificate.assuranceLevel !== "self_signed" && snapshot.authStatus === "signedIn" ? (
                  <>
                    <Button
                      variant="secondary"
                      className="mt-1 w-fit !px-2 !py-1 !text-[11px]"
                      disabled={snapshot.busy}
                      onClick={() => actions.handleAccountIntent({ type: "renewCertificate", id: certificate.identityId } as any)}
                    >
                      Renew
                    </Button>
                    <Button
                      variant="secondary"
                      className="mt-1 w-fit !px-2 !py-1 !text-[11px]"
                      disabled={snapshot.busy}
                      onClick={() => actions.handleAccountIntent({ type: "revokeCertificate", id: certificate.identityId } as any)}
                    >
                      Revoke
                    </Button>
                  </>
                ) : null}
              </div>
              
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
    </div>
  );
}
