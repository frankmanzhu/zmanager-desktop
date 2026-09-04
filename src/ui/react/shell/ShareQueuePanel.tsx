import { RefreshCw, X } from "lucide-react";

import type { LocalSendDeviceInfoDto, ShareRecordSnapshot } from "../../../app/controllers/shareQueueController";
import { formatVolumeSize } from "../../../app/volumeSizePresets";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import type { ZManagerDialogIntent } from "../appRuntime";
import { translatorForSnapshot } from "./shellHelpers";

export function ShareQueuePanel() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const devices = snapshot.localSendDiscovery.devices;
  const discovering = snapshot.localSendDiscovery.status === "loading";

  if (snapshot.shareQueue.items.length === 0) {
    return null;
  }

  return (
    <section className="shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" aria-label={i18n.t("shareQueue.title")}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold">{i18n.t("shareQueue.title")}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{i18n.t("shareQueue.description")}</p>
        </div>
        <Button type="button" variant="secondary" size="icon" onClick={() => actions.handleDialogIntent({ type: "shareQueueRefreshReceivers" })} disabled={discovering} title={i18n.t("shareQueue.refreshReceivers")} aria-label={i18n.t("shareQueue.refreshReceivers")}>
          <RefreshCw className={`size-4 ${discovering ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="max-h-52 overflow-auto">
        {snapshot.shareQueue.items.map((item) => (
          <ShareQueueRow key={item.shareId} item={item} devices={devices} i18n={i18n} onIntent={actions.handleDialogIntent} />
        ))}
      </div>
    </section>
  );
}

function ShareQueueRow({ item, devices, i18n, onIntent }: Readonly<{ item: ShareRecordSnapshot; devices: readonly LocalSendDeviceInfoDto[]; i18n: ReturnType<typeof translatorForSnapshot>; onIntent: (intent: ZManagerDialogIntent) => void }>) {
  const status = item.compressionState === "compressing" ? i18n.t("shareQueue.compressing") : item.transferState === "sending" ? i18n.t("shareQueue.sending") : item.transferState === "waiting" ? i18n.t("shareQueue.ready") : item.transferState === "sent" ? i18n.t("shareQueue.shared") : item.compressionState === "failed" || item.transferState === "failed" ? i18n.t("shareQueue.failed") : item.sharingIntent === "skipped" ? i18n.t("shareQueue.compressed") : item.artifactPath && item.receiver ? i18n.t("shareQueue.ready") : item.artifactPath ? i18n.t("shareQueue.selectReceiverStatus") : i18n.t("shareQueue.queued");
  const progress = item.compressionProgress;
  const progressText = progress?.totalBytes ? `${formatVolumeSize(progress.processedBytes)} / ${formatVolumeSize(progress.totalBytes)}` : item.totalBytes ? `${formatVolumeSize(item.bytesSent)} / ${formatVolumeSize(item.totalBytes)}` : "";
  const label = item.artifactPath?.split(/[\\/]/).pop() ?? item.sourcePaths[0]?.split(/[\\/]/).pop() ?? item.shareId;
  const selected = item.receiver?.fingerprint;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 dark:border-slate-900">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2"><span className="truncate font-medium" title={item.artifactPath ?? label}>{label}</span><span className="shrink-0 text-xs text-slate-500">{status}</span></div>
        {progressText ? <div className="text-xs text-slate-500 dark:text-slate-400">{progressText}</div> : null}
        {item.lastError ? <div className="truncate text-xs text-red-600 dark:text-red-300" title={item.lastError.message}>{item.lastError.message}</div> : null}
      </div>
      <div className="flex items-center gap-1">
        <Select
          value={selected}
          onValueChange={(fingerprint) => {
            const receiver = devices.find((device) => device.fingerprint === fingerprint);
            if (receiver) onIntent({ type: "shareQueueSetReceiver", shareId: item.shareId, receiver });
          }}
          disabled={item.transferState === "sending"}
        >
          <SelectTrigger className="w-36" aria-label={i18n.t("shareQueue.receiver")}>
            <SelectValue placeholder={i18n.t("shareQueue.selectReceiver")} />
          </SelectTrigger>
          <SelectContent>
            {item.receiver && !devices.some((device) => device.fingerprint === item.receiver?.fingerprint) ? <SelectItem value={item.receiver.fingerprint}>{item.receiver.alias}</SelectItem> : null}
            {devices.map((device) => <SelectItem key={device.fingerprint} value={device.fingerprint}>{device.alias}</SelectItem>)}
          </SelectContent>
        </Select>
        {item.transferState === "sent" || item.sharingIntent === "skipped" ? null : <Button type="button" variant="secondary" size={item.transferState === "sending" ? "icon" : "sm"} title={i18n.t("shareQueue.skip")} aria-label={i18n.t("shareQueue.skip")} onClick={() => onIntent({ type: "shareQueueSkip", shareId: item.shareId })}>{item.transferState === "sending" ? <X className="size-4" /> : i18n.t("shareQueue.skip")}</Button>}
        {item.transferState !== "sent" && item.transferState !== "sending" && item.artifactPath && item.receiver ? <Button type="button" variant="dialogPrimary" size="sm" onClick={() => onIntent({ type: "shareQueueStart", shareId: item.shareId })}>{item.transferState === "failed" ? i18n.t("shareQueue.retry") : i18n.t("shareQueue.share")}</Button> : null}
        {item.transferState === "sent" ? null : <Button type="button" variant="ghost" size="sm" onClick={() => onIntent({ type: "shareQueueCancel", shareId: item.shareId })}>{i18n.t("shareQueue.cancel")}</Button>}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => onIntent({ type: "shareQueueRemove", shareId: item.shareId })}>{i18n.t("common.close")}</Button>
    </div>
  );
}
