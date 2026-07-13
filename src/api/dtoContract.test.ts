import { describe, expect, it } from "vitest";

import rustDtoSource from "../../src-tauri/src/dto.rs?raw";
import typeScriptApiTypesSource from "./types.ts?raw";

const REQUEST_DTO_TYPES = [
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
] as const;

describe("Rust and TypeScript request DTO contracts", () => {
  it("keeps request DTO field names aligned", () => {
    for (const typeName of REQUEST_DTO_TYPES) {
      expect(typeScriptTypeFields(typeScriptApiTypesSource, typeName), typeName).toEqual(
        rustStructFields(rustDtoSource, typeName),
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
