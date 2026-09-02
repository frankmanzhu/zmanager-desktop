import { runLocalSendCancelSend, runLocalSendDiscover, runLocalSendSendFile } from "../api/commands";
import type { LocalSendDeviceInfoDto } from "../api/types";

export type LocalSendShareDesktopAdapter = Readonly<{
  discover(alias: string): Promise<LocalSendDeviceInfoDto[]>;
  sendFile(request: Readonly<{ sendId: string; alias: string; target: LocalSendDeviceInfoDto; filePath: string }>): Promise<Readonly<{ sessionId: string }>>;
  cancelSend(sendId: string): Promise<void>;
}>;

export const localSendShareDesktopAdapter: LocalSendShareDesktopAdapter = {
  discover: (alias) => runLocalSendDiscover({ alias, https: true }),
  sendFile: (request) => runLocalSendSendFile({ ...request, https: true }),
  cancelSend: (sendId) => runLocalSendCancelSend({ sendId }),
};
