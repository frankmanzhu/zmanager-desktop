import { Laptop2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { InventorySection } from "./InventorySection";

export function DeviceTab() {
  const fullSnapshot = useZManagerSnapshot();
  const snapshot = fullSnapshot.account;
  const actions = useZManagerActions();

  return (
    <div className="grid gap-5">
      <InventorySection
        title="Retire Device"
        icon={<Laptop2 className="size-4" />}
        empty=""
      >
        <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
          <p className="text-[11px] opacity-65">
            Retire this device from the central administration server. This will revoke all certificates and clear local state.
          </p>
          <Button
            variant="destructive"
            className="w-fit"
            disabled={snapshot.busy}
            onClick={() => {
              if (window.confirm("Are you sure you want to retire this device? This action cannot be undone.")) {
                actions.handleAccountIntent({ type: "retireDevice" } as any);
              }
            }}
          >
            {snapshot.busy ? "Working…" : "Retire Device"}
          </Button>
        </div>
      </InventorySection>
    </div>
  );
}
