import type { NativeInboundHostedAuthEvent } from "../../api/generated/nativeInboundEvents.generated";
import type { AccountHostedAuthLaunchDto, AccountSnapshotDto } from "../../api/types";
import type { AccountWorkspace } from "../workspaces/accountWorkspace";

export type AccountControllerOptions = Readonly<{
  workspace: AccountWorkspace;
  fetchSnapshot(): Promise<AccountSnapshotDto>;
  beginHostedAuth(local: boolean): Promise<AccountHostedAuthLaunchDto>;
  applyHostedCallback(payload: NativeInboundHostedAuthEvent["payload"]): Promise<void>;
  forget(): Promise<AccountSnapshotDto>;
  generateRecipientKey(label?: string): Promise<AccountSnapshotDto>;
  removeRecipientKey(id: string): Promise<AccountSnapshotDto>;
  removeContact(id: string): Promise<AccountSnapshotDto>;
  openUrl(url: string): Promise<void>;
  publish(): void;
  errorMessage(error: unknown): string;
}>;

export function createAccountController(options: AccountControllerOptions) {
  async function run(operation: () => Promise<AccountSnapshotDto>): Promise<void> {
    options.workspace.setBusy(true);
    options.publish();
    try {
      options.workspace.replace(await operation());
      options.workspace.setNotice("");
    } catch (error) {
      options.workspace.setNotice(options.errorMessage(error));
    } finally {
      options.workspace.setBusy(false);
      options.publish();
    }
  }

  return {
    async open() { options.workspace.open(); options.publish(); await run(options.fetchSnapshot); },
    close() { options.workspace.close(); options.publish(); },
    async beginHostedAuth(local = false) {
      options.workspace.setBusy(true); options.publish();
      try {
        const launch = await options.beginHostedAuth(local);
        await options.openUrl(launch.launchUrl);
        options.workspace.setNotice("Hosted sign-in is pending.");
        options.workspace.replace(await options.fetchSnapshot());
      } catch (error) {
        options.workspace.setNotice(options.errorMessage(error));
      } finally { options.workspace.setBusy(false); options.publish(); }
    },
    async handleHostedCallback(payload: NativeInboundHostedAuthEvent["payload"]) {
      await options.applyHostedCallback(payload);
      options.workspace.replace(await options.fetchSnapshot());
      options.workspace.setNotice(payload.result === "completed" ? "Hosted sign-in callback completed." : `Hosted sign-in ${payload.result}.`);
      options.publish();
    },
    forget: () => run(options.forget),
    generateRecipientKey: (label?: string) => run(() => options.generateRecipientKey(label)),
    removeRecipientKey: (id: string) => run(() => options.removeRecipientKey(id)),
    removeContact: (id: string) => run(() => options.removeContact(id)),
  };
}
