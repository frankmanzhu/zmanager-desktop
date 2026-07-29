import type { StartJobResponseDto } from "../../api/types";

export type JobHandoffControllerOptions = Readonly<{
  recordAccepted(job: StartJobResponseDto): void;
  presentTaskWindow(job: StartJobResponseDto): Promise<void>;
  reportPresentationFailure(job: StartJobResponseDto, error: unknown): void;
}>;

export type JobHandoffOptions = Readonly<{
  resetSubmittedState?: () => void;
}>;

export type JobHandoffController = Readonly<{
  handoffAcceptedJob(
    job: StartJobResponseDto,
    options?: JobHandoffOptions,
  ): Promise<void>;
}>;

/**
 * One-way ownership transfer after the backend has accepted a Job.
 * Presentation failure is reported, but never turns into another start request.
 */
export function createJobHandoffController(
  options: JobHandoffControllerOptions,
): JobHandoffController {
  return Object.freeze({
    async handoffAcceptedJob(job, handoffOptions = {}) {
      options.recordAccepted(job);
      handoffOptions.resetSubmittedState?.();

      try {
        await options.presentTaskWindow(job);
      } catch (error) {
        options.reportPresentationFailure(job, error);
      }
    },
  });
}
