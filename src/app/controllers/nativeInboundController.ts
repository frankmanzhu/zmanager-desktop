import {
  NATIVE_INBOUND_EVENT_VERSION,
  type NativeInboundEvent,
  type NativeInboundHostedAuthEvent,
} from "../../api/generated/nativeInboundEvents.generated";
import type { QuickActionRequestDto } from "../../api/types";

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
}>;

export type NativeInboundController = Readonly<{
  initialize(): Promise<void>;
  process(event: NativeInboundEvent): Promise<void>;
}>;

export function createNativeInboundController(
  options: NativeInboundControllerOptions,
): NativeInboundController {
  const windowLabel = options.windowLabel ?? "main";
  let deliveryChain = Promise.resolve();

  async function process(event: NativeInboundEvent): Promise<void> {
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
  }

  async function initialize(): Promise<void> {
    if (!options.isDesktopRuntime()) {
      return;
    }

    await options.listen((envelope) => {
      deliveryChain = deliveryChain
        .then(() => process(envelope.payload))
        .catch((error) => options.reportFailure(error));
    });
    await options.markFrontendReady(windowLabel);
  }

  return { initialize, process };
}
