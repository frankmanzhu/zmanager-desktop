import { getPathBasename } from "../../../app/formatting";
import { formatVolumeSize } from "../../../app/volumeSizePresets";
import type { LocalSendShareSnapshot } from "../../../app/controllers/localSendShareController";
import { Button } from "../../components/ui/button";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { translatorForSnapshot } from "../shell/shellHelpers";
import { DesktopDialog } from "./DesktopDialog";

export function ShareOnLanDialog({
  share,
}: Readonly<{ share: LocalSendShareSnapshot }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const sending = share.send === "sending";
  const selected = share.devices.find((device) => device.fingerprint === share.selectedFingerprint);

  return (
    <DesktopDialog
      titleId="share-on-lan-title"
      descriptionId="share-on-lan-description"
      widthClassName="w-[min(560px,calc(100vw-48px))]"
      header={
        <div className="flex items-start justify-between gap-5 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 id="share-on-lan-title">{i18n.t("shareOnLan.title")}</h2>
            <p id="share-on-lan-description" className="mt-1 text-sm text-slate-500 dark:text-slate-400" title={share.archivePath}>
              {i18n.t("shareOnLan.description", { name: getPathBasename(share.archivePath, share.archivePath) })}
            </p>
          </div>
        </div>
      }
      content={
        <div className="bg-slate-50/40 px-6 py-5 dark:bg-slate-950">
          {share.send === "sent" ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              {i18n.t("shareOnLan.sent", { device: selected?.alias ?? "" })}
            </p>
          ) : sending ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {i18n.t("shareOnLan.sendingTo", { device: selected?.alias ?? "" })}
              </p>
              <progress
                className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
                aria-label="Share on LAN progress"
                value={share.totalBytes > 0 ? Math.min(100, Math.round((share.bytesSent / share.totalBytes) * 100)) : undefined}
                max={100}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {share.totalBytes > 0
                  ? `${formatVolumeSize(share.bytesSent)} / ${formatVolumeSize(share.totalBytes)}`
                  : i18n.t("shareOnLan.starting")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {share.discovery === "loading" ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{i18n.t("shareOnLan.discovering")}</p>
              ) : share.discovery === "error" ? (
                <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {share.discoveryError}
                </p>
              ) : share.devices.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{i18n.t("shareOnLan.noDevices")}</p>
              ) : (
                <ul className="space-y-1.5" role="listbox" aria-label={i18n.t("shareOnLan.deviceListLabel")}>
                  {share.devices.map((device) => (
                    <li key={device.fingerprint}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={device.fingerprint === share.selectedFingerprint}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition-colors hover:bg-slate-50 aria-selected:border-blue-500 aria-selected:bg-blue-50 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-800 dark:aria-selected:border-blue-400 dark:aria-selected:bg-blue-950/40"
                        onClick={() =>
                          actions.handleDialogIntent({
                            type: "localSendShareSelectTarget",
                            fingerprint: device.fingerprint,
                          })
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{device.alias}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            {device.deviceModel ?? device.ip ?? device.fingerprint}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {share.send === "error" ? (
                <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {share.sendError}
                </p>
              ) : null}
            </div>
          )}
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
          {sending ? (
            <Button
              type="button"
              variant="dialog"
              size="unset"
              onClick={() => actions.handleDialogIntent({ type: "localSendShareCancelSend" })}
            >
              {i18n.t("common.cancel")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="dialog"
                size="unset"
                disabled={share.discovery === "loading"}
                onClick={() => actions.handleDialogIntent({ type: "localSendShareDiscover" })}
              >
                {i18n.t("common.refresh")}
              </Button>
              <Button
                id="share-on-lan-close"
                type="button"
                variant="dialog"
                size="unset"
                onClick={() => actions.handleDialogIntent({ type: "localSendShareClose" })}
              >
                {i18n.t(share.send === "sent" ? "common.close" : "common.cancel")}
              </Button>
              {share.send !== "sent" ? (
                <Button
                  id="share-on-lan-send"
                  type="button"
                  variant="dialogPrimary"
                  size="unset"
                  disabled={!share.selectedFingerprint}
                  onClick={() => actions.handleDialogIntent({ type: "localSendShareSend" })}
                >
                  {i18n.t("shareOnLan.send")}
                </Button>
              ) : null}
            </>
          )}
        </div>
      }
      onEscape={() => actions.handleDialogIntent({ type: "localSendShareClose" })}
    />
  );
}
