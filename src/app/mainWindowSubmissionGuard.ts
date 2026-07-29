export type MainWindowSubmissionGuard = Readonly<{
  isInFlight(): boolean;
  tryBegin(): boolean;
  end(): void;
}>;

/**
 * Owns the Main Window's one awaiting-acceptance permission.
 * Accepted Jobs never remain in this module.
 */
export function createMainWindowSubmissionGuard(): MainWindowSubmissionGuard {
  let inFlight = false;

  return Object.freeze({
    isInFlight: () => inFlight,
    tryBegin() {
      if (inFlight) {
        return false;
      }
      inFlight = true;
      return true;
    },
    end() {
      inFlight = false;
    },
  });
}
