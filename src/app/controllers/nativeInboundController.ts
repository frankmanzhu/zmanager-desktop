import {
  NATIVE_INBOUND_EVENT_VERSION,
  type NativeInboundEvent,
  type NativeInboundHostedAuthEvent,
} from "../../api/generated/nativeInboundEvents.generated";
import type { QuickActionRequestDto } from "../../api/types";
import { NOOP_DIAGNOSTIC_RECORDER, type DiagnosticRecorder } from "../diagnostics";

export type NativeInboundControllerOptions = Readonly<{
  isDesktopRuntime(): boolean;
  listen(listener: (event: Readonly<{ payload: NativeInboundEvent }>) => void): Promise<unknown>;
  markFrontendReady(windowLabel: string): Promise<number>;
  acknowledge(windowLabel: string, eventId: string): Promise<void>;
  handleQuickAction(request: QuickActionRequestDto): Promise<void>;
  handleShellActionToken(requestToken: string): Promise<void>;
  handleHostedAuthCallback(payload: NativeInboundHostedAuthEvent["payload"]): Promise<void>;
  revealApplication(): Promise<void>;
  reportFailure(error: unknown): void;
  windowLabel?: string;
  diagnostics?: DiagnosticRecorder;
}>;

export type NativeInboundController = Readonly<{
  initialize(): Promise<void>;
  process(event: NativeInboundEvent): Promise<void>;
}>;

export function createNativeInboundController(
  options: NativeInboundControllerOptions,
): NativeInboundController {
  const windowLabel = options.windowLabel ?? "main";
  const diagnostics = options.diagnostics ?? NOOP_DIAGNOSTIC_RECORDER;
  let deliveryChain = Promise.resolve();

  async function process(event: NativeInboundEvent): Promise<void> {
    diagnostics.record({
      scope: "nativeInbound",
      name: "eventReceived",
      fields: nativeInboundDiagnosticFields(event),
    });
    if (event.version !== NATIVE_INBOUND_EVENT_VERSION) {
      throw new Error(`unsupported native inbound event version: ${event.version}`);
    }

    switch (event.kind) {
      case "openPaths":
        await options.handleQuickAction({ kind: "open", paths: event.payload.paths });
        break;
      case "shellActionRequest":
        if ("request" in event.payload) {
          await options.handleQuickAction(event.payload.request);
        } else {
          await options.handleShellActionToken(event.payload.requestToken);
        }
        break;
      case "hostedAuthCallback":
        await options.handleHostedAuthCallback(event.payload);
        break;
      case "reopenApplication":
        await options.revealApplication();
        break;
    }

    await options.acknowledge(windowLabel, event.eventId);
    diagnostics.record({
      scope: "nativeInbound",
      name: "eventAcknowledged",
      fields: { kind: event.kind },
    });
  }

  async function initialize(): Promise<void> {
    if (!options.isDesktopRuntime()) {
      return;
    }

    await options.listen((envelope) => {
      deliveryChain = deliveryChain
        .then(() => process(envelope.payload))
        .catch((error) => {
          diagnostics.record({
            scope: "nativeInbound",
            name: "deliveryFailed",
            fields: { errorType: error instanceof Error ? error.name : "unknown" },
          });
          options.reportFailure(error);
        });
    });
    const pendingCount = await options.markFrontendReady(windowLabel);
    diagnostics.record({
      scope: "nativeInbound",
      name: "frontendReady",
      fields: { pendingCount, windowClass: windowLabel === "main" ? "main" : "other" },
    });
  }

  return { initialize, process };
}

function nativeInboundDiagnosticFields(
  event: NativeInboundEvent,
): Record<string, string | number | boolean | null> {
  if (event.kind === "openPaths") {
    return { kind: event.kind, pathCount: event.payload.paths.length, transport: "paths" };
  }
  if (event.kind === "shellActionRequest") {
    if ("request" in event.payload) {
      return {
        kind: event.kind,
        action: event.payload.request.kind,
        pathCount: event.payload.request.paths.length,
        transport: "inlineRequest",
      };
    }
    return { kind: event.kind, transport: "opaqueToken" };
  }
  return { kind: event.kind };
}
