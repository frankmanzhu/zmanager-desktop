import { RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";

export function SessionStatus() {
  const fullSnapshot = useZManagerSnapshot();
  const snapshot = fullSnapshot.account;
  const actions = useZManagerActions();
  const hostedAccountVisible = snapshot.capabilities.auth === "handoff_exchange"
    || snapshot.capabilities.enrollment === "available"
    || snapshot.capabilities.enrollment === "approval_required"
    || snapshot.capabilities.status === "online";

  if (!hostedAccountVisible) return null;

  function accountStatus(status: string) {
    if (status === "signedOut") return "Signed out";
    if (status === "pending") return "Authenticating…";
    if (status === "signedIn") return "Signed in";
    return status;
  }

  return (
    <section className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="mr-auto">
          Account · {accountStatus(snapshot.authStatus)}
        </strong>
        {snapshot.authStatus === "signedIn" && snapshot.displayName ? (
          <span className="text-sm">{snapshot.displayName}</span>
        ) : null}
        <Button
          disabled={snapshot.busy || snapshot.capabilities.auth !== "handoff_exchange"}
          title={snapshot.capabilities.auth !== "handoff_exchange" ? "Hosted authentication is disabled for the local-only flow" : undefined}
          onClick={() =>
            actions.handleAccountIntent({ type: "beginHostedAuth", environment: "prod" })
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
    </section>
  );
}
