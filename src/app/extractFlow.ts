import type { StartExtractRequest } from "../api/types";

export type ExtractMode = "archive" | "selection";

export type BuildStartExtractRequestInput = {
  archivePath: string;
  destinationPath: string;
  overwrite: StartExtractRequest["overwrite"];
  destinationCollisionStrategy?: StartExtractRequest["destinationCollisionStrategy"];
  stripComponents: number;
  password?: string;
  entryPaths?: string[];
};

export function buildStartExtractRequest(input: BuildStartExtractRequestInput): StartExtractRequest {
  return {
    archivePath: input.archivePath,
    destinationPath: input.destinationPath,
    overwrite: input.overwrite,
    ...(input.destinationCollisionStrategy
      ? { destinationCollisionStrategy: input.destinationCollisionStrategy }
      : {}),
    ...(input.entryPaths ? { entryPaths: [...input.entryPaths] } : {}),
    stripComponents: input.stripComponents,
    ...(input.password ? { password: input.password } : {}),
  };
}
