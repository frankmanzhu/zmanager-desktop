import type {
  CommandErrorDto,
  DesktopJobSnapshotDto,
  StartExtractRequest,
  StartJobResponseDto,
  TestArchiveRequest,
} from "../../api/types";
import { isPasswordErrorCode } from "../jobs";
import { resolveDestinationCollisionStrategy } from "../collisionPolicy";

export type DisposableTaskRecoveryResult =
  | "started"
  | "acceptedWithoutPresentation"
  | "cancelled"
  | "unavailable"
  | "failed";

export type DisposableTaskRecoveryControllerOptions = Readonly<{
  promptForPassword(commandCode: string): string | null;
  startExtract(request: StartExtractRequest): Promise<StartJobResponseDto>;
  startTest(request: TestArchiveRequest): Promise<StartJobResponseDto>;
  handoffAcceptedJob(job: StartJobResponseDto): Promise<void>;
  toCommandError(error: unknown): CommandErrorDto | null;
  reportFailure(message: string): void;
}>;

export type DisposableTaskRecoveryController = Readonly<{
  retryWithPassword(
    snapshot: DesktopJobSnapshotDto,
  ): Promise<DisposableTaskRecoveryResult>;
}>;

export function createDisposableTaskRecoveryController(
  options: DisposableTaskRecoveryControllerOptions,
): DisposableTaskRecoveryController {
  return Object.freeze({
    async retryWithPassword(snapshot) {
      const descriptor = snapshot.retryDescriptor;
      const failureCode = snapshot.latestFailure?.code;
      if (!descriptor || !isPasswordErrorCode(failureCode)) {
        return "unavailable";
      }

      const password = options.promptForPassword(failureCode ?? "");
      if (!password) {
        return "cancelled";
      }

      let job: StartJobResponseDto;
      try {
        job = descriptor.retryKind === "testArchive"
          ? await options.startTest({
              archivePath: descriptor.archivePath,
              ...(descriptor.entryPaths.length
                ? { entryPaths: [...descriptor.entryPaths] }
                : {}),
              password,
            })
          : await options.startExtract({
              archivePath: descriptor.archivePath,
              destinationPath: descriptor.destinationPath,
              overwrite: descriptor.overwrite,
              destinationCollisionStrategy: resolveDestinationCollisionStrategy({
                isDisposableTask: true,
                overwrite: descriptor.overwrite,
                destinationCollisionStrategy: descriptor.destinationCollisionStrategy,
              }),
              ...(descriptor.entryPaths.length
                ? { entryPaths: [...descriptor.entryPaths] }
                : {}),
              stripComponents: descriptor.stripComponents,
              tzapRestorePolicy: descriptor.tzapRestorePolicy ?? "portable",
              tzapAllowDegraded: descriptor.tzapAllowDegraded ?? false,
              tzapAllowAbsoluteSymlinks: descriptor.tzapAllowAbsoluteSymlinks ?? false,
              ignoreSymlinks: descriptor.ignoreSymlinks ?? false,
              password,
            });
      } catch (error) {
        options.reportFailure(
          options.toCommandError(error)?.message
            ?? "Unable to retry this task.",
        );
        return "failed";
      }

      try {
        await options.handoffAcceptedJob(job);
        return "started";
      } catch (error) {
        options.reportFailure(
          options.toCommandError(error)?.message
            ?? "The replacement Job started, but its task window could not be opened.",
        );
        return "acceptedWithoutPresentation";
      }
    },
  });
}
