import type { NativeInboundHostedAuthEvent } from "../../api/generated/nativeInboundEvents.generated";
import type {
  AccountContactCardPreviewDto,
  AccountHostedAuthLaunchDto,
  AccountInstallSigningCertificateRequest,
  AccountSnapshotDto,
} from "../../api/types";
import type { AccountWorkspace } from "../workspaces/accountWorkspace";

export type AccountControllerOptions = Readonly<{
  workspace: AccountWorkspace;
  fetchSnapshot(): Promise<AccountSnapshotDto>;
  beginHostedAuth(local: boolean): Promise<AccountHostedAuthLaunchDto>;
  applyHostedCallback(payload: NativeInboundHostedAuthEvent["payload"]): Promise<void>;
  forget(): Promise<AccountSnapshotDto>;
  generateRecipientKey(label?: string): Promise<AccountSnapshotDto>;
  generateSigningIdentity(commonName: string, label?: string): Promise<AccountSnapshotDto>;
  importSigningIdentity(identityPath: string, password: string, label?: string): Promise<AccountSnapshotDto>;
  installSigningCertificate(request: AccountInstallSigningCertificateRequest): Promise<AccountSnapshotDto>;
  createSelfSignedCertificateStore(commonName: string): Promise<AccountSnapshotDto>;
  removeSigningIdentity(id: string): Promise<AccountSnapshotDto>;
  removeRecipientKey(id: string): Promise<AccountSnapshotDto>;
  setDefaultSigningIdentity(id: string): Promise<AccountSnapshotDto>;
  removeContact(id: string): Promise<AccountSnapshotDto>;
  inspectContactCard(contactCard: Record<string, unknown>): Promise<AccountContactCardPreviewDto>;
  acceptContactCard(contactCard: Record<string, unknown>): Promise<AccountSnapshotDto>;
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
    refresh: () => run(options.fetchSnapshot),
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
      options.workspace.setNotice(
        payload.result === "completed"
          ? "Callback received. Hosted sign-in exchange is unavailable; you are not connected."
          : `Hosted sign-in ${payload.result}.`,
      );
      options.publish();
    },
    forget: () => run(options.forget),
    generateRecipientKey: (label?: string) => run(() => options.generateRecipientKey(label)),
    generateSigningIdentity: (commonName: string, label?: string) => run(() => options.generateSigningIdentity(commonName, label)),
    importSigningIdentity: (identityPath: string, password: string, label?: string) =>
      run(() => options.importSigningIdentity(identityPath, password, label)),
    installSigningCertificate: (request: AccountInstallSigningCertificateRequest) =>
      run(() => options.installSigningCertificate(request)),
    createSelfSignedCertificateStore: (commonName: string) =>
      run(() => options.createSelfSignedCertificateStore(commonName)),
    removeSigningIdentity: (id: string) => run(() => options.removeSigningIdentity(id)),
    removeRecipientKey: (id: string) => run(() => options.removeRecipientKey(id)),
    setDefaultSigningIdentity: (id: string) => run(() => options.setDefaultSigningIdentity(id)),
    removeContact: (id: string) => run(() => options.removeContact(id)),
    async inspectContactCard(contactCard: Record<string, unknown>) {
      options.workspace.setBusy(true); options.publish();
      try {
        options.workspace.setContactCardPreview(await options.inspectContactCard(contactCard));
        options.workspace.setNotice("Contact card verified. Review it before accepting.");
      } catch (error) {
        options.workspace.setContactCardPreview(null);
        options.workspace.setNotice(options.errorMessage(error));
      } finally { options.workspace.setBusy(false); options.publish(); }
    },
    async acceptContactCard(contactCard: Record<string, unknown>) {
      await run(options.acceptContactCard.bind(null, contactCard));
      options.workspace.setContactCardPreview(null);
      options.publish();
    },
  };
}
