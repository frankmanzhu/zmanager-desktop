import { describe, expect, it } from "vitest";

import fixture from "../../../fixtures/contracts/native-capabilities.conformance.json";
import {
  findNativeCapability,
  isNativeCapabilityAvailable,
  NATIVE_CAPABILITY_CATALOG,
  NATIVE_CAPABILITY_IDS,
  NATIVE_PACKAGE_KINDS,
  type NativeCapabilitySnapshot,
} from "./nativeCapabilities.generated";

describe("generated native capability contract", () => {
  it("uses the same identifiers and package kinds as the shared fixture", () => {
    expect(NATIVE_CAPABILITY_IDS).toEqual(
      NATIVE_CAPABILITY_CATALOG.map(({ id }) => id),
    );
    expect(NATIVE_PACKAGE_KINDS).toContain(fixture.packageKind);
    expect(Object.keys(fixture.platforms)).toEqual(["windows", "linux", "macos"]);
  });

  it("distinguishes source, package, installed, user, and runtime state", () => {
    const snapshots = fixture.platforms.macos as unknown as NativeCapabilitySnapshot[];
    const finder = findNativeCapability(snapshots, "finderTokenTransport");

    expect(finder).toMatchObject({
      sourceState: "supported",
      packageState: "notIncluded",
      installedState: "notInspected",
      userEnabledState: "notInspected",
      runtimeState: "notInspected",
      availability: "unavailable",
    });
    expect(isNativeCapabilityAvailable(snapshots, "nativeApplicationMenu")).toBe(true);
    expect(isNativeCapabilityAvailable(snapshots, "finderTokenTransport")).toBe(false);
  });

  it("fails loudly when a caller asks for an undeclared snapshot", () => {
    expect(() => findNativeCapability([], "nativeFileDrag")).toThrow(
      "Native capability snapshot is missing nativeFileDrag",
    );
  });
});
