import { FileSignature, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { InventorySection } from "./InventorySection";

export function DocumentsTab() {
  const fullSnapshot = useZManagerSnapshot();
  const snapshot = fullSnapshot.account;
  const actions = useZManagerActions();

  return (
    <div className="grid gap-5">
      <InventorySection
        title="Sign Document"
        icon={<FileSignature className="size-4" />}
        empty=""
      >
        <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
          <p className="text-[11px] opacity-65">
            Select an input JSON file to sign with your default signing identity, generating a secure envelope.
          </p>
          <Button
            variant="secondary"
            className="w-fit"
            disabled={snapshot.busy}
            onClick={() => {
              actions.handleAccountIntent({ type: "signDocument" } as any);
            }}
          >
            {snapshot.busy ? "Working…" : "Choose File and Sign"}
          </Button>
        </div>
      </InventorySection>
      
      <InventorySection
        title="Verify Document"
        icon={<ShieldCheck className="size-4" />}
        empty=""
      >
        <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
          <p className="text-[11px] opacity-65">
            Select a signed envelope JSON file to verify its signature and trust chain.
          </p>
          <Button
            variant="secondary"
            className="w-fit"
            disabled={snapshot.busy}
            onClick={() => {
              actions.handleAccountIntent({ type: "verifyDocument" } as any);
            }}
          >
            {snapshot.busy ? "Working…" : "Choose File and Verify"}
          </Button>
        </div>
      </InventorySection>
    </div>
  );
}
