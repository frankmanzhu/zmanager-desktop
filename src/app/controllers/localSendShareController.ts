import type { LocalSendDeviceInfoDto, LocalSendEventDto } from "../../api/types";

export type LocalSendShareSnapshot = Readonly<{
  archivePath: string;
  alias: string;
  discovery: "idle" | "loading" | "ready" | "error";
  devices: readonly LocalSendDeviceInfoDto[];
  discoveryError: string | null;
  selectedFingerprint: string | null;
  send: "idle" | "sending" | "sent" | "error" | "cancelled";
  sendError: string | null;
  sendId: string | null;
  bytesSent: number;
  totalBytes: number;
}>;

export type LocalSendShareController = Readonly<{
  getSnapshot(): LocalSendShareSnapshot | null;
  open(archivePath: string, alias: string): void;
  close(): void;
  discover(): Promise<void>;
  selectTarget(fingerprint: string): void;
  send(): Promise<void>;
  cancelSend(): Promise<void>;
  handleEvent(event: LocalSendEventDto): void;
}>;

type Options = Readonly<{
  discover(alias: string): Promise<LocalSendDeviceInfoDto[]>;
  sendFile(request: Readonly<{ sendId: string; alias: string; target: LocalSendDeviceInfoDto; filePath: string }>): Promise<Readonly<{ sessionId: string }>>;
  cancelSend(sendId: string): Promise<void>;
  publish(snapshot: LocalSendShareSnapshot | null): void;
  errorMessage(error: unknown): string;
  createSendId(): string;
}>;

export function createLocalSendShareController(options: Options): LocalSendShareController {
  let snapshot: LocalSendShareSnapshot | null = null;
  let activeSessionId: string | null = null;

  function update(next: LocalSendShareSnapshot | null): void {
    snapshot = next
      ? Object.freeze({ ...next, devices: Object.freeze([...next.devices]) })
      : null;
    options.publish(snapshot);
  }

  function open(archivePath: string, alias: string): void {
    activeSessionId = null;
    update({
      archivePath,
      alias,
      discovery: "idle",
      devices: [],
      discoveryError: null,
      selectedFingerprint: null,
      send: "idle",
      sendError: null,
      sendId: null,
      bytesSent: 0,
      totalBytes: 0,
    });
  }

  function close(): void {
    activeSessionId = null;
    update(null);
  }

  async function discover(): Promise<void> {
    if (!snapshot) {
      return;
    }
    update({ ...snapshot, discovery: "loading", discoveryError: null });
    try {
      const devices = await options.discover(snapshot.alias);
      if (!snapshot) {
        return;
      }
      update({ ...snapshot, discovery: "ready", devices, discoveryError: null });
    } catch (error) {
      if (!snapshot) {
        return;
      }
      update({ ...snapshot, discovery: "error", discoveryError: options.errorMessage(error) });
    }
  }

  function selectTarget(fingerprint: string): void {
    if (!snapshot) {
      return;
    }
    update({ ...snapshot, selectedFingerprint: fingerprint });
  }

  async function send(): Promise<void> {
    if (!snapshot) {
      return;
    }
    const target = snapshot.devices.find((device) => device.fingerprint === snapshot?.selectedFingerprint);
    if (!target) {
      return;
    }
    const sendId = options.createSendId();
    update({ ...snapshot, send: "sending", sendError: null, sendId, bytesSent: 0, totalBytes: 0 });
    try {
      const result = await options.sendFile({ sendId, alias: snapshot.alias, target, filePath: snapshot.archivePath });
      activeSessionId = result.sessionId;
      // The desktop adapter calls a synchronous Rust command: its promise
      // resolves only after the upload has completed. The corresponding
      // sessionDone event may therefore have been delivered while the
      // command was still pending, before activeSessionId was available.
      // Treat a successful command result as authoritative completion, while
      // preserving a close/cancel/reopen that happened during the transfer.
      if (snapshot?.sendId === sendId && snapshot.send === "sending") {
        update({ ...snapshot, send: "sent" });
      }
    } catch (error) {
      if (!snapshot || snapshot.sendId !== sendId || snapshot.send !== "sending") {
        return;
      }
      update({ ...snapshot, send: "error", sendError: options.errorMessage(error) });
    }
  }

  async function cancelSend(): Promise<void> {
    if (!snapshot?.sendId || snapshot.send !== "sending") {
      return;
    }
    const sendId = snapshot.sendId;
    try {
      await options.cancelSend(sendId);
    } catch {
      // The send may have already finished; treat cancellation as best-effort.
    }
    if (!snapshot || snapshot.sendId !== sendId || snapshot.send !== "sending") {
      return;
    }
    update({ ...snapshot, send: "cancelled" });
  }

  function handleEvent(event: LocalSendEventDto): void {
    if (!snapshot || snapshot.send !== "sending") {
      return;
    }
    if (event.type === "fileSendProgress" && event.sendId === snapshot.sendId) {
      update({ ...snapshot, bytesSent: event.bytesSent, totalBytes: event.totalBytes });
      return;
    }
    if (event.type === "sessionDone" && activeSessionId && event.sessionId === activeSessionId) {
      update({ ...snapshot, send: "sent" });
    }
  }

  return {
    getSnapshot: () => snapshot,
    open,
    close,
    discover,
    selectTarget,
    send,
    cancelSend,
    handleEvent,
  };
}
