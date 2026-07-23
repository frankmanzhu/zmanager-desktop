import fixture from "../../fixtures/contracts/native-capabilities.conformance.json";
import type {
  NativeCapabilityAvailability,
  NativeCapabilityId,
  NativeCapabilitySnapshot,
} from "../api/generated/nativeCapabilities.generated";

export function nativeCapabilitySnapshots(
  platform: "windows" | "linux" | "macos" = "windows",
  availability: Partial<Record<NativeCapabilityId, NativeCapabilityAvailability>> = {},
): NativeCapabilitySnapshot[] {
  const snapshots = fixture.platforms[platform] as unknown as NativeCapabilitySnapshot[];
  return snapshots.map((snapshot) => {
    const override = availability[snapshot.id];
    return override === undefined ? snapshot : { ...snapshot, availability: override };
  });
}
