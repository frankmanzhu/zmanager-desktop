import type { LocalSendDeviceInfoDto, LocalSendTransferFileDto } from "../../api/types";

export type LocalSendIncomingTransferSnapshot = Readonly<{
  requestId: string;
  sender: LocalSendDeviceInfoDto;
  files: readonly LocalSendTransferFileDto[];
}>;
