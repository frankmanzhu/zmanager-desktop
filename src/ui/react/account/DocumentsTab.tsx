import { FileSignature, ShieldCheck, FileCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { InventorySection } from "./InventorySection";

export function DocumentsTab() {
  const fullSnapshot = useZManagerSnapshot();
  const snapshot = fullSnapshot.account;
  const actions = useZManagerActions();

  return (
    <div className="grid gap-6">
      <InventorySection
        title="Document Signing & Verification"
        icon={<FileSignature className="size-4 text-blue-600 dark:text-blue-400" />}
        empty=""
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Sign Document Card */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <FileSignature className="size-4" />
                </div>
                <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Sign Document Envelope
                </strong>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Select a JSON document file to sign using your default signing identity, creating a verifiable cryptographic signature.
              </p>
            </div>

            <Button
              className="mt-4 w-full bg-blue-600 text-xs text-white shadow hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
              disabled={snapshot.busy}
              onClick={() => {
                actions.handleAccountIntent({ type: "signDocument" } as any);
              }}
            >
              <FileSignature className="mr-1.5 size-3.5" />
              {snapshot.busy ? "Signing…" : "Choose File & Sign"}
            </Button>
          </div>

          {/* Verify Document Card */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <ShieldCheck className="size-4" />
                </div>
                <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Verify Envelope Signature
                </strong>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Select a signed JSON envelope to verify its cryptographic signature integrity and public certificate chain.
              </p>
            </div>

            <Button
              variant="secondary"
              className="mt-4 w-full border-slate-300 bg-white text-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              disabled={snapshot.busy}
              onClick={() => {
                actions.handleAccountIntent({ type: "verifyDocument" } as any);
              }}
            >
              <FileCheck className="mr-1.5 size-3.5 text-emerald-600 dark:text-emerald-400" />
              {snapshot.busy ? "Verifying…" : "Choose File & Verify"}
            </Button>
          </div>
        </div>
      </InventorySection>
    </div>
  );
}
