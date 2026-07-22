import {
  fetchDiagnosticLogInfo,
  recordDiagnosticEvent,
} from "../api/commands";
import type { DiagnosticLogInfoDto } from "../api/types";
import type { DiagnosticEvent, DiagnosticRecorder } from "../app/diagnostics";
import { isDesktopRuntime as defaultIsDesktopRuntime } from "./runtime";

export type DesktopDiagnosticRecorderOptions = Readonly<{
  isDesktopRuntime?: () => boolean;
  write?: (event: DiagnosticEvent) => Promise<void>;
}>;

export function createDesktopDiagnosticRecorder(
  options: DesktopDiagnosticRecorderOptions = {},
): DiagnosticRecorder {
  const isDesktopRuntime = options.isDesktopRuntime ?? defaultIsDesktopRuntime;
  const write = options.write ?? persistDiagnosticEvent;
  return Object.freeze({
    record(event) {
      if (!isDesktopRuntime()) return;
      void write(event).catch(() => {
        // Diagnostics must never disrupt the workflow being diagnosed.
      });
    },
  });
}

export async function persistDiagnosticEvent(event: DiagnosticEvent): Promise<void> {
  await recordDiagnosticEvent({
    scope: event.scope,
    name: event.name,
    fields: { ...event.fields },
  });
}

export async function readDiagnosticLogInfo(): Promise<DiagnosticLogInfoDto | null> {
  if (!defaultIsDesktopRuntime()) return null;
  return fetchDiagnosticLogInfo();
}
