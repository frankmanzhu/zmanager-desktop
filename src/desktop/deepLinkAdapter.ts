import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { type AccountController } from "../app/controllers/accountController";

export function initializeDeepLinkAdapter(accountController: AccountController): Promise<() => void> {
  return onOpenUrl((urls) => {
    for (const urlStr of urls) {
      try {
        const url = new URL(urlStr);
        if (url.protocol === "zmanager:") {
          if (url.hostname === "auth-callback") {
            const state = url.searchParams.get("state") || "";
            const relayBody = url.searchParams.get("relay_body") || "";
            if (state && relayBody) {
              accountController.handleHostedCallback({ state, result: "completed", relayBody, callbackUrl: urlStr }).catch((error: unknown) => {
                console.error("DeepLinkAdapter: Failed to handle auth callback", error);
              });
            }
          }
        }
      } catch (error) {
        console.error("DeepLinkAdapter: Invalid deep link URL", urlStr, error);
      }
    }
  });
}
