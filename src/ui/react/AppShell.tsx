import { useEffect, useState } from "react";

type LegacyState = "loading" | "ready" | "failed";

export function AppShell() {
  const [legacyState, setLegacyState] = useState<LegacyState>("loading");

  useEffect(() => {
    let cancelled = false;

    import("../../legacyMain")
      .then(() => {
        if (!cancelled) {
          setLegacyState("ready");
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to start ZManager legacy shell", error);
        if (!cancelled) {
          setLegacyState("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="zmanager-react-shell" data-legacy-state={legacyState}>
      {legacyState === "failed" ? (
        <div className="startup-failure" role="alert">
          ZManager failed to start.
        </div>
      ) : null}
      <div id="zmanager-legacy-root" />
    </div>
  );
}
