import { describe, expect, it } from "vitest";

import rustDtoSource from "../../src-tauri/src/dto.rs?raw";
import rustLocalsendSource from "../../src-tauri/src/localsend.rs?raw";
import typeScriptApiTypesSource from "./types.ts?raw";

const rustSource = `${rustDtoSource}\n${rustLocalsendSource}`;

// Most Rust request structs and their TypeScript counterparts share one
// name; a bare string checks that. `localsend.rs` DTOs are suffixed `Dto`
// on the Rust side (matching this codebase's other localsend_* commands)
// but not on the TypeScript side, so those use the two-name form instead.
const REQUEST_DTO_TYPES: readonly (string | Readonly<{ typeScriptName: string; rustName: string }>)[] = [
  "SystemFileIconRequest",
  "SystemFileIconRequestEntry",
  "ValidateDirectoryRequest",
  "QuickActionRequestDto",
  "ListArchiveRequest",
  "PlanCreateRequest",
  "StartCreateRequest",
  "StartExtractRequest",
  "VerifyTzapCertificateRequest",
  "PreviewEntryRequest",
  "NativeFileDragRequest",
  "TestArchiveRequest",
  "CancelJobRequest",
  "PauseJobRequest",
  "ResumeJobRequest",
  "DismissJobRequest",
  { typeScriptName: "LocalSendDiscoverRequest", rustName: "LocalSendDiscoverRequestDto" },
  { typeScriptName: "LocalSendStartReceiverRequest", rustName: "LocalSendStartReceiverRequestDto" },
  { typeScriptName: "LocalSendRespondToTransferRequest", rustName: "LocalSendRespondToTransferRequestDto" },
] as const;

describe("Rust and TypeScript request DTO contracts", () => {
  it("keeps request DTO field names aligned", () => {
    for (const entry of REQUEST_DTO_TYPES) {
      const typeScriptName = typeof entry === "string" ? entry : entry.typeScriptName;
      const rustName = typeof entry === "string" ? entry : entry.rustName;
      expect(typeScriptTypeFields(typeScriptApiTypesSource, typeScriptName), typeScriptName).toEqual(
        rustStructFields(rustSource, rustName),
      );
    }
  });
});

function typeScriptTypeFields(source: string, typeName: string): string[] {
  const body = source.match(new RegExp(`export type ${typeName} = \\{([\\s\\S]*?)\\n\\};`))?.[1];
  if (!body) {
    throw new Error(`Unable to find TypeScript type ${typeName}`);
  }

  return [...body.matchAll(/^\s*([A-Za-z0-9_]+)\??:/gm)].map((match) => match[1]);
}

function rustStructFields(source: string, typeName: string): string[] {
  const body = source.match(new RegExp(`pub struct ${typeName} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (!body) {
    throw new Error(`Unable to find Rust struct ${typeName}`);
  }

  return [...body.matchAll(/^\s*pub ([a-zA-Z0-9_]+):/gm)].map((match) => snakeToCamel(match[1]));
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}
