export type DiagnosticFieldValue = string | number | boolean | null;

export type DiagnosticEvent = Readonly<{
  scope: string;
  name: string;
  fields?: Readonly<Record<string, DiagnosticFieldValue>>;
}>;

export type DiagnosticRecorder = Readonly<{
  record(event: DiagnosticEvent): void;
}>;

export const NOOP_DIAGNOSTIC_RECORDER: DiagnosticRecorder = Object.freeze({
  record: () => {},
});
