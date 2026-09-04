import { useState } from "react";
import { RefreshCw, X } from "lucide-react";

import { runLocalSendDiscover } from "../../../api/commands";
import type { LocalSendDeviceInfoDto, ShareRecordSnapshot } from "../../../api/types";
import { formatVolumeSize } from "../../../app/volumeSizePresets";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "./shellHelpers";

export function ShareQueuePanel() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const [devices, setDevices] = useState<LocalSendDeviceInfoDto[]>([]);
  const [discovering, setDiscovering] = useState(false);

  if (snapshot.shareQueue.items.length === 0) {
    return null;
  }

  async function discover() {
    setDiscovering(true);
    try {
      setDevices(await runLocalSendDiscover({ alias: snapshot.preferences.lanShareAlias.trim() || "ZManager Desktop", https: true }));
    } catch {
      setDevices([]);
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <section className="shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" aria-label="Share queue">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold">Share queue</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Queued work continues while this window is open.</p>
        </div>
        <button type="button" className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => void discover()} disabled={discovering} title="Refresh receivers" aria-label="Refresh receivers">
          <RefreshCw className={`size-4 ${discovering ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="max-h-52 overflow-auto">
        {snapshot.shareQueue.items.map((item) => (
          <ShareQueueRow key={item.shareId} item={item} devices={devices} i18n={i18n} onIntent={actions.handleDialogIntent} />
        ))}
      </div>
    </section>
  );
}

function ShareQueueRow({ item, devices, i18n, onIntent }: Readonly<{ item: ShareRecordSnapshot; devices: readonly LocalSendDeviceInfoDto[]; i18n: ReturnType<typeof translatorForSnapshot>; onIntent: (intent: any) => void }>) {
  const status = item.compressionState === "compressing" ? "Compressing" : item.transferState === "sending" ? "Sending" : item.transferState === "sent" ? "Shared" : item.compressionState === "failed" || item.transferState === "failed" ? "Failed" : item.sharingIntent === "skipped" ? "Compressed" : item.artifactPath && item.receiver ? "Ready to send" : item.artifactPath ? "Select receiver" : "Queued";
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
        <select aria-label="LAN receiver" value={selected ?? ""} onChange={(event) => { const receiver = devices.find((device) => device.fingerprint === event.currentTarget.value); if (receiver) onIntent({ type: "shareQueueSetReceiver", shareId: item.shareId, receiver }); }}>
          <option value="">{item.receiver?.alias ?? "Select receiver"}</option>
          {devices.map((device) => <option key={device.fingerprint} value={device.fingerprint}>{device.alias}</option>)}
        </select>
        {item.transferState === "sent" ? null : item.transferState === "sending" ? <button type="button" className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" title="Skip sharing" aria-label="Skip sharing" onClick={() => onIntent({ type: "shareQueueSkip", shareId: item.shareId })}><X className="size-4" /></button> : <button type="button" className="rounded-md border border-blue-600 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950" onClick={() => onIntent({ type: "shareQueueStart", shareId: item.shareId })}>{item.transferState === "failed" ? "Retry" : "Share"}</button>}
      </div>
      <button type="button" className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onIntent({ type: "shareQueueRemove", shareId: item.shareId })}>{i18n.t("common.close")}</button>
    </div>
  );
}
