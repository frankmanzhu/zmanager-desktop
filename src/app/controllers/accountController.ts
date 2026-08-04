import type { NativeInboundHostedAuthEvent } from "../../api/generated/nativeInboundEvents.generated";
import type {
  AccountContactCardPreviewDto,
  AccountHostedAuthLaunchDto,
  AccountInstallSigningCertificateRequest,
  AccountSnapshotDto,
  AccountCurrentUserDto,
} from "../../api/types";
import type { AccountWorkspace } from "../workspaces/accountWorkspace";

export type AccountControllerOptions = Readonly<{
  workspace: AccountWorkspace;
  fetchSnapshot(): Promise<AccountSnapshotDto>;
  beginHostedAuth(environment: string): Promise<AccountHostedAuthLaunchDto>;
  applyHostedCallback(payload: NativeInboundHostedAuthEvent["payload"]): Promise<void>;
  completeHostedAuth(state: string, relayBody: string, callbackUrl?: string): Promise<AccountSnapshotDto>;
  fetchCurrentUser(): Promise<AccountCurrentUserDto>;
  enrollDeviceCertificate(): Promise<AccountSnapshotDto>;
  renewCertificate(certificateId: string): Promise<AccountSnapshotDto>;
  revokeCertificate(certificateId: string): Promise<AccountSnapshotDto>;
  signDocument(): Promise<void>;
  verifyDocument(): Promise<void>;
  exportContactCard(): Promise<void>;
  retireDevice(): Promise<AccountSnapshotDto>;
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

export type AccountController = ReturnType<typeof createAccountController>;

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
    async beginHostedAuth(environment = "prod") {
      options.workspace.setBusy(true); options.publish();
      try {
        const launch = await options.beginHostedAuth(environment);
        await options.openUrl(launch.launchUrl);
        options.workspace.setNotice("Hosted sign-in is pending.");
        options.workspace.replace(await options.fetchSnapshot());
      } catch (error) {
        options.workspace.setNotice(options.errorMessage(error));
      } finally { options.workspace.setBusy(false); options.publish(); }
    },
    async handleHostedCallback(payload: NativeInboundHostedAuthEvent["payload"]) {
      options.workspace.setBusy(true); options.publish();
      try {
        if (payload.result === "completed" && payload.relayBody) {
          options.workspace.replace(
            await options.completeHostedAuth(payload.state, payload.relayBody, payload.callbackUrl)
          );
          options.workspace.setNotice("Hosted sign-in completed.");
        } else {
          await options.applyHostedCallback(payload);
          options.workspace.replace(await options.fetchSnapshot());
          options.workspace.setNotice(`Hosted sign-in ${payload.result}.`);
        }
      } catch (error) {
        options.workspace.setNotice(options.errorMessage(error));
      } finally { options.workspace.setBusy(false); options.publish(); }
    },
    async handleFetchUser() {
      options.workspace.setBusy(true); options.publish();
      try {
        await options.fetchCurrentUser();
        options.workspace.replace(await options.fetchSnapshot());
      } catch (error: any) {
        if (error?.code === "unauthorized") {
          options.workspace.replace(await options.fetchSnapshot());
          options.workspace.setNotice("Session expired. Please sign in again.");
        } else {
          options.workspace.setNotice(options.errorMessage(error));
        }
      } finally { options.workspace.setBusy(false); options.publish(); }
    },
    handleEnroll: () => run(options.enrollDeviceCertificate),
    handleRenew: (certificateId: string) => run(() => options.renewCertificate(certificateId)),
    handleRevoke: (certificateId: string) => run(() => options.revokeCertificate(certificateId)),
    async handleSignDocument() {
      options.workspace.setBusy(true); options.publish();
      try { await options.signDocument(); } catch (error) { options.workspace.setNotice(options.errorMessage(error)); } finally { options.workspace.setBusy(false); options.publish(); }
    },
    async handleVerifyDocument() {
      options.workspace.setBusy(true); options.publish();
      try { await options.verifyDocument(); } catch (error) { options.workspace.setNotice(options.errorMessage(error)); } finally { options.workspace.setBusy(false); options.publish(); }
    },
    async handleExportContactCard() {
      options.workspace.setBusy(true); options.publish();
      try { await options.exportContactCard(); } catch (error) { options.workspace.setNotice(options.errorMessage(error)); } finally { options.workspace.setBusy(false); options.publish(); }
    },
    handleDeviceRetire: () => run(options.retireDevice),
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
