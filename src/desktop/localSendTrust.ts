import { runLocalSendListTrustedDevices, runLocalSendUntrustDevice } from "../api/commands";

export type LocalSendTrustDesktopAdapter = Readonly<{
  list(): Promise<string[]>;
  untrust(fingerprint: string): Promise<string[]>;
}>;

export const localSendTrustDesktopAdapter: LocalSendTrustDesktopAdapter = {
  list: runLocalSendListTrustedDevices,
  untrust: async (fingerprint) => {
    await runLocalSendUntrustDevice(fingerprint);
    return runLocalSendListTrustedDevices();
  },
};
