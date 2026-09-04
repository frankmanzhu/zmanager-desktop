import { runLocalSendDiscover } from "../api/commands";
import type { LocalSendDeviceInfoDto } from "../api/types";

export type LocalSendDiscoveryDesktopAdapter = Readonly<{
  discover(alias: string): Promise<LocalSendDeviceInfoDto[]>;
}>;

export const localSendDiscoveryDesktopAdapter: LocalSendDiscoveryDesktopAdapter = {
  discover: (alias) => runLocalSendDiscover({ alias, https: true }),
};
