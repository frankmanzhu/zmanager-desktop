import type { RuntimeDevApi } from "../src/runtime/runtimeDevTools";

/**
 * Browser globals the Playwright end-to-end specs read and stub.
 *
 * These live in one ambient file rather than a `declare global` block per spec.
 * Previously three specs each declared their own view of `window.__zmanagerDev`
 * and they had already drifted apart — one made `setSystemIconFixtures`
 * optional, another omitted `openSurface` entirely — which nothing caught,
 * because no tsconfig compiled the e2e directory. Declaring them once, and
 * sourcing the dev API from the application's own `RuntimeDevApi`, means a
 * change to that API breaks these specs at compile time instead of at runtime.
 */

/** One IPC call recorded by the e2e harness stub. */
export type IpcCall = {
  cmd: string;
  args: Record<string, unknown>;
};

declare global {
  interface Window {
    /** Installed by the app in local dev builds; see src/runtime/runtimeDevTools.ts. */
    __zmanagerDev?: RuntimeDevApi;
    /** Installed by the specs themselves to record IPC traffic. */
    __zmanagerE2E?: {
      ipcCalls: IpcCall[];
    };
    __TAURI_EVENT_PLUGIN_INTERNALS__?: {
      unregisterListener: (event: string, id: number) => void;
    };
    __TAURI_INTERNALS__?: {
      // Required rather than optional: the whole object is absent outside
      // Tauri, but wherever it exists — the real runtime, or the stub these
      // specs install — it delivers Channel messages back into the page.
      /** Delivers a Tauri Channel message back into the page. */
      runCallback: (callbackId: number, payload: unknown) => void;
      [key: string]: unknown;
    };
    isTauri?: boolean;
  }
}
