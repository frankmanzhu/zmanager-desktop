import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";

import type { ShareRecordSnapshot } from "../../../app/controllers/shareQueueController";
import type { LocalSendDiscoverySnapshot } from "../../../app/controllers/localSendDiscoveryController";
import { presentShare } from "../../../app/shareQueuePresentation";
import { formatBytes } from "../../../app/formatting";
import { Button } from "../../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import type { ZManagerDialogIntent } from "../appRuntime";
import { translatorForSnapshot } from "./shellHelpers";

type RowProps = Readonly<{
  item: ShareRecordSnapshot;
  discovery: LocalSendDiscoverySnapshot;
  i18n: ReturnType<typeof translatorForSnapshot>;
  onIntent: (intent: ZManagerDialogIntent) => void;
  newest: boolean;
}>;

export function ShareQueuePanel() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const items = snapshot.shareQueue.items;
  if (!items.length) return null;

  return (
    <section className="max-h-[45vh] shrink-0 overflow-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" aria-label={i18n.t("shareQueue.title")}>
      <header className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <h2 className="text-sm font-semibold">{i18n.t("shareQueue.title")}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{i18n.t("shareQueue.description")}</p>
      </header>
      {items.map((item, index) => <ShareQueueRow key={item.shareId} item={item} newest={index === items.length - 1} discovery={snapshot.localSendDiscovery} i18n={i18n} onIntent={actions.handleDialogIntent} />)}
    </section>
  );
}

function ShareQueueRow({ item, discovery, i18n, onIntent, newest }: RowProps) {
  const view = presentShare(item);
  const row = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRetry, setConfirmRetry] = useState(false);
  // Scroll only on admission; progress snapshots never move the user's viewport or focus.
  useEffect(() => { if (newest) row.current?.scrollIntoView?.({ block: "nearest" }); }, [item.shareId]);
  const label = item.artifactPath?.split(/[\\/]/).pop() ?? item.sourcePaths[0]?.split(/[\\/]/).pop() ?? item.shareId;
  const devices = discovery.devices;
  const discovering = discovery.status === "loading";
  const status = i18n.t(`shareQueue.${view.status}`);
  const progressText = view.progress ? [
    view.progress.percent === null ? null : `${Math.floor(view.progress.percent)}%`,
    view.status === "shared" && view.progress.total === null ? null : [
      formatBytes(view.progress.processed, { locale: i18n.locale }),
      view.progress.total === null ? null : formatBytes(view.progress.total, { locale: i18n.locale }),
    ].filter(value => value !== null).join(" / "),
  ].filter(value => value !== null).join(" · ") : null;

  return (
    <div ref={row} data-share-id={item.shareId} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-3 py-3 text-sm last:border-b-0 dark:border-slate-900">
      <div className="min-w-0 flex-1 basis-52">
        <div className="truncate font-medium" title={item.artifactPath ?? label}>{label}</div>
        <div role="status" className="text-xs text-slate-600 dark:text-slate-400">{status}{item.receiver ? ` · ${item.receiver.alias}` : ""}</div>
        {view.progress ? <div className="mt-2 space-y-1">
          <progress className="h-2 w-full accent-blue-600" aria-label={`${label}: ${status}`} max={100} value={view.progress.percent ?? undefined} />
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {progressText}
          </div>
        </div> : null}
        {item.lastError ? <div role="alert" className="mt-1 break-words text-xs text-red-600 dark:text-red-300">{item.lastError.message}{item.lastError.hint ? ` ${item.lastError.hint}` : ""}</div> : null}
        {confirmRetry && view.canRetry ? <div className="mt-2 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <p>{i18n.t("shareQueue.deliveryUncertain")}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setConfirmRetry(false); onIntent({ type: "shareQueueStart", shareId: item.shareId, acknowledgeDeliveryUncertainty: true }); }}>{i18n.t("shareQueue.retryAnyway")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRetry(false)}>{i18n.t("common.cancel")}</Button>
          </div>
        </div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {view.canSelectReceiver ? <Popover open={pickerOpen} onOpenChange={(open) => { setPickerOpen(open); if (open) onIntent({ type: "shareQueueOpenReceivers" }); }}>
          <PopoverTrigger asChild><Button variant="secondary" size="sm" aria-label={i18n.t("shareQueue.receiver")}>
            {i18n.t("shareQueue.selectReceiver")}<ChevronDown className="ml-2 size-4" />
          </Button></PopoverTrigger>
          <PopoverContent align="end" className="max-h-80 w-80 overflow-auto p-2">
            <p className="px-2 py-1 text-xs text-slate-500">{i18n.t("shareQueue.selectHint")}</p>
            {discovering ? <p role="status" className="flex items-center gap-2 p-2 text-sm"><LoaderCircle className="size-4 animate-spin" />{i18n.t("shareOnLan.discovering")}</p> : null}
            {discovery.error ? <p role="alert" className="p-2 text-sm text-red-600 dark:text-red-300">{discovery.error}</p> : null}
            {!discovering && !devices.length ? <p className="p-2 text-sm">{i18n.t("shareOnLan.noDevices")}</p> : null}
            <div role="group" aria-label={i18n.t("shareOnLan.deviceListLabel")}>
              {devices.map(device => <Button key={device.fingerprint} variant="ghost" className="h-auto w-full justify-start py-2 text-left" onClick={() => { setPickerOpen(false); onIntent({ type: "shareQueueSetReceiver", shareId: item.shareId, receiver: device }); }}>
                <span className="min-w-0"><span className="block truncate">{device.alias}</span><span className="block truncate text-xs font-normal text-slate-500">{[device.deviceModel, device.ip ?? device.fingerprint.slice(0, 12)].filter(Boolean).join(" · ")}</span></span>
              </Button>)}
            </div>
            <Button variant="ghost" size="sm" disabled={discovering} onClick={() => onIntent({ type: "shareQueueRefreshReceivers" })}>{i18n.t("shareQueue.searchAgain")}</Button>
          </PopoverContent>
        </Popover> : item.receiver ? <span className="flex max-w-52 items-center gap-1 text-xs text-slate-600 dark:text-slate-400" title={[item.receiver.alias, item.receiver.ip].filter(Boolean).join(" · ")}>
          {item.transferState === "sent" ? <Check className="size-4 text-green-600" /> : null}<span className="truncate">{item.receiver.alias}</span>
        </span> : null}
        {view.canSkip ? <Button variant="ghost" size="sm" onClick={() => onIntent({ type: "shareQueueSkip", shareId: item.shareId })}>{i18n.t("shareQueue.skip")}</Button> : null}
        {view.canRetry && !confirmRetry ? <Button variant="secondary" size="sm" onClick={() => { if (item.deliveryUncertain) setConfirmRetry(true); else onIntent({ type: "shareQueueStart", shareId: item.shareId }); }}>{i18n.t("shareQueue.retry")}</Button> : null}
        {view.canCancel ? <Button variant="ghost" size="sm" onClick={() => onIntent({ type: "shareQueueCancel", shareId: item.shareId })}>{i18n.t(item.transferState === "sending" ? "shareQueue.cancelTransfer" : "shareQueue.cancel")}</Button> : null}
        {view.canDismiss ? <Button variant="ghost" size="sm" onClick={() => onIntent({ type: "shareQueueRemove", shareId: item.shareId })}>{i18n.t("shareQueue.dismiss")}</Button> : null}
      </div>
    </div>
  );
}
