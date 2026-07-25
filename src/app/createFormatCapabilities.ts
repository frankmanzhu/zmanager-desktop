import type { CreateArchiveFormat } from "./createFlow";

export type CreateFormatCapabilities = Readonly<{
  password: boolean;
  splitVolumes: boolean;
  compressionLevel: boolean;
  zipCompression: boolean;
  tzapRecovery: boolean;
  tzapVolumeLossTolerance: boolean;
  sevenZAdvanced: boolean;
}>;

const CAPABILITIES: Record<CreateArchiveFormat, CreateFormatCapabilities> = {
  zip: Object.freeze({
    password: true,
    splitVolumes: true,
    compressionLevel: true,
    zipCompression: true,
    tzapRecovery: false,
    tzapVolumeLossTolerance: false,
    sevenZAdvanced: false,
  }),
  tarZst: Object.freeze({
    password: false,
    splitVolumes: false,
    compressionLevel: true,
    zipCompression: false,
    tzapRecovery: false,
    tzapVolumeLossTolerance: false,
    sevenZAdvanced: false,
  }),
  tzap: Object.freeze({
    password: true,
    splitVolumes: true,
    compressionLevel: true,
    zipCompression: false,
    tzapRecovery: true,
    tzapVolumeLossTolerance: true,
    sevenZAdvanced: false,
  }),
  sevenZ: Object.freeze({
    password: true,
    splitVolumes: true,
    compressionLevel: true,
    zipCompression: false,
    tzapRecovery: false,
    tzapVolumeLossTolerance: false,
    sevenZAdvanced: true,
  }),
  tarGz: Object.freeze({
    password: false,
    splitVolumes: false,
    compressionLevel: true,
    zipCompression: false,
    tzapRecovery: false,
    tzapVolumeLossTolerance: false,
    sevenZAdvanced: false,
  }),
  appleArchive: Object.freeze({
    password: true,
    splitVolumes: false,
    compressionLevel: true,
    zipCompression: false,
    tzapRecovery: false,
    tzapVolumeLossTolerance: false,
    sevenZAdvanced: false,
  }),
};

export function createFormatCapabilities(format: CreateArchiveFormat): CreateFormatCapabilities {
  return CAPABILITIES[format];
}

const ALL_CREATE_FORMATS: CreateArchiveFormat[] = ["zip", "tarZst", "tzap", "sevenZ", "tarGz", "appleArchive"];

export function supportedCreateFormats(appleArchiveAvailable: boolean): CreateArchiveFormat[] {
  if (appleArchiveAvailable) return ALL_CREATE_FORMATS;
  return ALL_CREATE_FORMATS.filter((f) => f !== "appleArchive");
}
