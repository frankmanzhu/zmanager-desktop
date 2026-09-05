import type { ShareRecordSnapshot } from "../api/types";

/** Display facts only. Rust remains authoritative for admission and transitions. */
export function presentShare(item: ShareRecordSnapshot) {
  const compressing = item.compressionState === "compressing";
  const cancelling = item.compressionState === "cancelling" || item.transferState === "cancelling";
  const sending = item.transferState === "sending";
  const sent = item.transferState === "sent";
  const cancelled = item.lifecycle === "cancelled" || item.compressionState === "cancelled" || item.transferState === "cancelled";
  const skipped = item.sharingIntent === "skipped";
  const failed = item.compressionState === "failed" || item.transferState === "failed";
  const progress = compressing ? item.compressionProgress : null;
  const total = compressing ? progress?.totalBytes ?? null : item.totalBytes;
  const processed = compressing ? progress?.processedBytes ?? 0 : sent && total !== null ? total : item.bytesSent;
  const percent = sent ? 100 : total && total > 0 ? Math.max(0, Math.min(100, processed / total * 100)) : null;
  const finishing = sending && total !== null && processed >= total;
  const status = cancelling ? "cancelling" : sent ? "shared" : compressing ? "compressing"
    : cancelled ? "cancelled" : failed ? "failed" : skipped ? "compressed"
      : finishing ? "finishing" : sending ? "sending" : item.receiver ? "queuedForReceiver" : "selectReceiverStatus";
  const active = compressing || sending || cancelling;
  return {
    status,
    progress: compressing || sending || sent ? { processed, total, percent } : null,
    canSelectReceiver: !item.receiver && !cancelled && !skipped && !failed && !sent && !cancelling,
    canRetry: item.transferState === "failed" && !!item.receiver && !!item.artifactPath && !cancelled && !skipped,
    canSkip: item.mode === "compressAndShare" && !item.receiver && !skipped && !cancelled && !failed && !cancelling,
    canCancel: !sent && !cancelled && !cancelling && (!skipped || compressing) && !failed,
    canDismiss: !active && !(item.lifecycle === "active" && !skipped && !!item.receiver && !!item.artifactPath && (item.transferState === "waiting" || item.transferState === "notStarted")),
  } as const;
}
