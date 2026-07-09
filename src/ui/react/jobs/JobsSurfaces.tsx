import { formatBytes, formatCompressionRatio, getPathBasename } from "../../../app/formatting";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import type { ZManagerReactSnapshot } from "../appRuntime";
import { translatorForSnapshot } from "../shell/shellHelpers";

type JobItem = ZManagerReactSnapshot["jobs"]["jobs"][number];
type JobStatus = JobItem["status"];
type JobKind = JobItem["kind"];
type QuickProgress = ZManagerReactSnapshot["quickActionProgress"];
type FocusedContext = Extract<QuickProgress, { state: "tracking" }>["latestContext"];

export function JobsDrawer() {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const open = snapshot.shell.jobDrawerOpen && snapshot.shell.quickActionWindow.mode !== "jobOnly";

  return (
    <aside id="job-drawer" className="job-drawer" aria-label={i18n.t("jobs.drawer.aria")} aria-hidden={open ? "false" : "true"}>
      <div className="job-drawer-header">
        <div>
          <h2>{i18n.t("jobs.title")}</h2>
          <p>{i18n.t("jobs.description")}</p>
        </div>
        <div className="job-drawer-actions">
          <button id="refresh-jobs" type="button" onClick={() => actions.handleJobsIntent({ type: "poll" })}>{i18n.t("common.refresh")}</button>
          <button id="job-drawer-close" type="button" onClick={() => actions.handleJobsIntent({ type: "closeDrawer" })}>{i18n.t("common.close")}</button>
        </div>
      </div>
      <div id="jobs-list" className="jobs-list" onFocus={() => actions.handleJobsIntent({ type: "poll" })}>
        {snapshot.jobs.jobs.length
          ? snapshot.jobs.jobs.map((job) => <JobCard job={job} key={job.jobId} />)
          : <div className="job-empty"><strong>{i18n.t("jobs.empty.title")}</strong><span>{i18n.t("jobs.empty.description")}</span></div>}
      </div>
    </aside>
  );
}

function JobCard({ job }: Readonly<{ job: JobItem }>) {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  return (
    <article className="job-card" data-job-status={job.status}>
      <div className="job-header">
        <div className="job-heading">
          <p className="job-title">{formatJobKind(job.kind, snapshot)}</p>
          <p className="job-subtitle">{job.jobId}</p>
        </div>
        <span className="job-status-pill">{i18n.t(jobStatusKey(job.status))}</span>
      </div>
      <JobBody job={job} />
    </article>
  );
}

function JobBody({ job }: Readonly<{ job: JobItem }>) {
  if (job.status === "failed") {
    return <FailedJobBody job={job} />;
  }
  if (job.status === "completed") {
    return <CompletedJobBody job={job} />;
  }
  if (job.status === "cancelled") {
    return <CancelledJobBody job={job} />;
  }
  return <LiveJobBody job={job} />;
}

function FailedJobBody({ job }: Readonly<{ job: JobItem }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const failedEvent = latestFailedEvent(job);
  const failedMessage = failedEvent?.message ?? job.progress.latestStatusMessage;
  const failedItem = failedEvent?.path ?? job.progress.currentFile;

  return (
    <>
      <div className="job-message job-message-error">
        <strong>{i18n.t("jobs.failed.title", { kind: formatJobKind(job.kind, snapshot) })}</strong>
        <span>{failedMessage}</span>
        {failedItem ? <small>{i18n.t("jobs.failed.item")} {failedItem}</small> : null}
      </div>
      <div className="job-actions">
        {job.canRetryPassword ? <button type="button" data-retry-password={job.jobId} onClick={() => actions.handleJobsIntent({ type: "retryPassword", jobId: job.jobId })}>{i18n.t("jobs.action.retryPassword")}</button> : null}
        {job.canDismiss ? <button type="button" data-dismiss={job.jobId} onClick={() => actions.handleJobsIntent({ type: "dismiss", jobId: job.jobId })}>{i18n.t("jobs.action.dismiss")}</button> : null}
      </div>
    </>
  );
}

function CompletedJobBody({ job }: Readonly<{ job: JobItem }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  return (
    <>
      <div className="job-completion">
        <strong>{i18n.t("jobs.completed.title")}</strong>
        <JobSummary job={job} />
      </div>
      <JobOutputActions job={job} />
      <div className="job-actions">
        {job.canDismiss ? <button type="button" data-dismiss={job.jobId} onClick={() => actions.handleJobsIntent({ type: "dismiss", jobId: job.jobId })}>{i18n.t("jobs.action.dismiss")}</button> : null}
      </div>
      <JobProgressBar job={job} />
    </>
  );
}

function CancelledJobBody({ job }: Readonly<{ job: JobItem }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const currentItem = job.progress.currentFile || i18n.t("jobs.current.none");
  return (
    <>
      <div className="job-message">
        <strong>{i18n.t("jobs.cancelled.title")}</strong>
        <span>{currentItem}</span>
      </div>
      <div className="job-actions">
        {job.canDismiss ? <button type="button" data-dismiss={job.jobId} onClick={() => actions.handleJobsIntent({ type: "dismiss", jobId: job.jobId })}>{i18n.t("jobs.action.dismiss")}</button> : null}
      </div>
      <JobProgressBar job={job} />
    </>
  );
}

function LiveJobBody({ job }: Readonly<{ job: JobItem }>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  const currentItem = job.progress.currentFile || i18n.t("jobs.current.none");
  return (
    <>
      <div className="job-current">
        <span>{i18n.t("jobs.current.label")}</span>
        <strong>{currentItem}</strong>
      </div>
      <JobProgressBar job={job} />
      <div className="job-facts" aria-label={i18n.t("jobs.metrics.aria")}>
        <span><strong>{filesText(job)}</strong> {i18n.t("jobs.metric.files")}</span>
        <span><strong>{speedText(job, snapshot)}</strong> {i18n.t("jobs.metric.speed")}</span>
        <span><strong>{formatDuration(job.progress.remainingMs) || i18n.t("jobs.metric.notAvailable")}</strong> {i18n.t("jobs.metric.remainingTime")}</span>
        <span><strong>{processedText(job, snapshot)}</strong> {i18n.t("jobs.metric.processed")}</span>
      </div>
      <div className="job-actions">
        {job.status === "running" ? <button type="button" data-pause={job.jobId} onClick={() => actions.handleJobsIntent({ type: "pause", jobId: job.jobId })}>{i18n.t("jobs.action.pause")}</button> : null}
        {job.status === "paused" ? <button type="button" data-resume={job.jobId} onClick={() => actions.handleJobsIntent({ type: "resume", jobId: job.jobId })}>{i18n.t("common.continue")}</button> : null}
        {job.status === "queued" || job.status === "running" || job.status === "paused"
          ? <button type="button" data-cancel={job.jobId} onClick={() => actions.handleJobsIntent({ type: "cancel", jobId: job.jobId })}>{i18n.t("jobs.action.cancel")}</button>
          : null}
      </div>
    </>
  );
}

function JobSummary({ job }: Readonly<{ job: JobItem }>) {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  const summary = job.terminalSummary;
  if (!summary) {
    return <p>{i18n.t("jobs.summary.empty")}</p>;
  }
  return (
    <>
      <p>{i18n.t("jobs.summary.entries", { count: summary.writtenEntries, size: formatBytes(summary.writtenBytes, { locale: snapshot.display.resolvedLocale }) })}</p>
      {typeof summary.skippedEntries === "number" ? <p>{i18n.t("jobs.summary.skippedCount", { count: summary.skippedEntries })}</p> : null}
      {summary.warnings.length ? <p>{i18n.t("jobs.summary.warningCount", { count: summary.warnings.length })}</p> : null}
      <p className="job-output-size">{i18n.t(job.completedSizeLabelKey)}</p>
    </>
  );
}

function JobOutputActions({ job }: Readonly<{ job: JobItem }>) {
  const actions = useZManagerActions();
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  if (!job.readyOutputActions.length) {
    return null;
  }
  return (
    <div className="job-output-actions">
      {job.readyOutputActions.map((action, index) => {
        const label = action.kind === "open" ? i18n.t("jobs.action.openOutput") : i18n.t("jobs.action.revealOutput");
        return (
          <button
            type="button"
            data-output-action={action.kind}
            data-output-job={job.jobId}
            data-output-index={index}
            onClick={() => actions.handleJobsIntent({ type: "runOutputAction", jobId: job.jobId, actionIndex: index, kind: action.kind })}
            key={`${action.kind}:${action.path}:${index}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function JobProgressBar({ job }: Readonly<{ job: JobItem }>) {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  const progressValue = job.progress.progressPercent ?? 0;
  const determinate = job.progress.progressPercent !== null || job.isTerminal;
  return determinate
    ? <progress aria-label={i18n.t("jobs.progress.aria")} value={progressValue.toFixed(0)} max="100" />
    : <progress aria-label={i18n.t("jobs.progress.aria")} />;
}

export function QuickActionProgress() {
  const snapshot = useZManagerSnapshot();
  const progress = snapshot.quickActionProgress;
  const visible = snapshot.shell.quickActionWindow.mode === "jobOnly";

  return progress.state === "tracking"
    ? <TrackingQuickActionProgress progress={progress} hidden={!visible} />
    : <EmptyQuickActionProgress hidden={!visible} />;
}

function EmptyQuickActionProgress({ hidden }: Readonly<{ hidden: boolean }>) {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  return (
    <section id="quick-progress" className="quick-progress" aria-label={i18n.t("quick.progress.aria")} hidden={hidden}>
      <QuickHeading title={i18n.t("quick.progress.title")} subtitle="" />
      <dl id="quick-context" className="quick-progress-context" hidden />
      <QuickMetrics
        elapsed="00:00:00"
        totalSize=""
        remaining="--:--:--"
        speed=""
        files="0"
        processed=""
        totalFiles=""
        compressedSize=""
        ratio=""
      />
      <div className="quick-progress-current">
        <p id="quick-operation">{i18n.t("quick.operation.starting")}</p>
        <p id="quick-current-path" />
      </div>
      <progress id="quick-progress-bar" aria-label={i18n.t("quick.progressBar.aria")} />
      <QuickActions backgroundDisabled continueDisabled cancelDisabled continueLabel={i18n.t("quick.pause")} />
    </section>
  );
}

function TrackingQuickActionProgress({
  progress,
  hidden,
}: Readonly<{
  progress: Extract<QuickProgress, { state: "tracking" }>;
  hidden: boolean;
}>) {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  const context = focusedJobProgressContextDisplay(progress.latestContext, snapshot);
  const operation = quickOperationLabel(progress, snapshot);
  const ratio = progress.compressedBytes === null || progress.totalBytes === null
    ? ""
    : formatCompressionRatio(progress.totalBytes, progress.compressedBytes, {
        emptyValue: "",
        fractionDigits: 0,
        locale: snapshot.display.resolvedLocale,
      });
  return (
    <section id="quick-progress" className="quick-progress" aria-label={i18n.t("quick.progress.aria")} hidden={hidden}>
      <QuickHeading
        title={progress.jobCount > 1 ? i18n.t("quick.progress.multipleJobs", { count: progress.jobCount }) : context?.title ?? formatJobKind(progress.latestJob.kind, snapshot)}
        subtitle={context?.subtitle ?? ""}
      />
      <dl id="quick-context" className="quick-progress-context" hidden={!context?.rows.length}>
        {context?.rows.map((row) => (
          <div key={`${row.label}:${row.value}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <QuickMetrics
        elapsed={formatDurationClock(progress.elapsedMs)}
        totalSize={progress.totalBytes === null ? "" : formatBytes(progress.totalBytes, { locale: snapshot.display.resolvedLocale })}
        remaining={formatDurationClock(progress.remainingMs)}
        speed={progress.speedBytesPerSecond === null ? "" : `${formatBytes(progress.speedBytesPerSecond, { locale: snapshot.display.resolvedLocale })}/s`}
        files={progress.totalFiles === null ? String(progress.processedFiles) : `${progress.processedFiles} / ${progress.totalFiles}`}
        processed={progress.processedBytes > 0 ? formatBytes(progress.processedBytes, { locale: snapshot.display.resolvedLocale }) : ""}
        totalFiles={progress.jobCount > 1 ? i18n.t("quick.progress.totalJobs", { count: progress.jobCount }) : ""}
        compressedSize={progress.compressedBytes === null ? "" : formatBytes(progress.compressedBytes, { locale: snapshot.display.resolvedLocale })}
        ratio={ratio}
      />
      <div className="quick-progress-current">
        <p id="quick-operation">{operation}</p>
        <p id="quick-current-path">{progress.currentFile}</p>
      </div>
      {progress.progressPercent === null
        ? <progress id="quick-progress-bar" aria-label={i18n.t("quick.progressBar.aria")} />
        : <progress id="quick-progress-bar" aria-label={i18n.t("quick.progressBar.aria")} value={progress.progressPercent} max="100" />}
      <QuickActions
        backgroundDisabled={progress.allTerminal || progress.anyPaused || snapshot.shell.quickActionWindow.mode === "background"}
        continueDisabled={!progress.anyActive}
        cancelDisabled={!progress.anyActive}
        continueLabel={progress.anyPaused ? i18n.t("common.continue") : i18n.t("quick.pause")}
      />
    </section>
  );
}

function QuickHeading({ title, subtitle }: Readonly<{ title: string; subtitle: string }>) {
  return (
    <div className="quick-progress-heading">
      <div>
        <h2 id="quick-title">{title}</h2>
        <p id="quick-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

function QuickMetrics({
  elapsed,
  totalSize,
  remaining,
  speed,
  files,
  processed,
  totalFiles,
  compressedSize,
  ratio,
}: Readonly<{
  elapsed: string;
  totalSize: string;
  remaining: string;
  speed: string;
  files: string;
  processed: string;
  totalFiles: string;
  compressedSize: string;
  ratio: string;
}>) {
  const snapshot = useZManagerSnapshot();
  const i18n = translatorForSnapshot(snapshot);
  return (
    <div className="quick-progress-grid">
      <div className="quick-progress-metric"><span>{i18n.t("quick.elapsedTime")}</span><strong id="quick-elapsed">{elapsed}</strong></div>
      <div className="quick-progress-metric"><span>{i18n.t("quick.totalSize")}</span><strong id="quick-total-size">{totalSize}</strong></div>
      <div className="quick-progress-metric"><span>{i18n.t("quick.remainingTime")}</span><strong id="quick-remaining">{remaining}</strong></div>
      <div className="quick-progress-metric"><span>{i18n.t("quick.speed")}</span><strong id="quick-speed">{speed}</strong></div>
      <div className="quick-progress-metric"><span>{i18n.t("quick.files")}</span><strong id="quick-files">{files}</strong></div>
      <div className="quick-progress-metric"><span>{i18n.t("quick.processed")}</span><strong id="quick-processed">{processed}</strong></div>
      <div className="quick-progress-metric"><span /><strong id="quick-total-files">{totalFiles}</strong></div>
      <div className="quick-progress-metric"><span>{i18n.t("quick.compressedSize")}</span><strong id="quick-compressed-size">{compressedSize}</strong></div>
      <div className="quick-progress-metric"><span /><strong /></div>
      <div className="quick-progress-metric"><span>{i18n.t("quick.compressionRatio")}</span><strong id="quick-ratio">{ratio}</strong></div>
    </div>
  );
}

function QuickActions({
  backgroundDisabled,
  continueDisabled,
  cancelDisabled,
  continueLabel,
}: Readonly<{
  backgroundDisabled: boolean;
  continueDisabled: boolean;
  cancelDisabled: boolean;
  continueLabel: string;
}>) {
  const snapshot = useZManagerSnapshot();
  const actions = useZManagerActions();
  const i18n = translatorForSnapshot(snapshot);
  return (
    <div className="quick-progress-actions">
      <button id="quick-background" type="button" disabled={backgroundDisabled} onClick={() => actions.handleJobsIntent({ type: "backgroundFocused" })}>{i18n.t("quick.background")}</button>
      <button id="quick-continue" type="button" disabled={continueDisabled} onClick={() => actions.handleJobsIntent({ type: "toggleQuickActionPause" })}>{continueLabel}</button>
      <button id="quick-cancel" type="button" disabled={cancelDisabled} onClick={() => actions.handleJobsIntent({ type: "cancelFocusedQuickActionJobs" })}>{i18n.t("common.cancel")}</button>
    </div>
  );
}

function latestFailedEvent(job: JobItem) {
  for (let index = job.events.length - 1; index >= 0; index -= 1) {
    const event = job.events[index];
    if (event.eventType === "failed") {
      return event;
    }
  }
  return null;
}

function filesText(job: JobItem): string {
  return job.progress.totalFiles === null
    ? String(job.progress.processedFiles)
    : `${job.progress.processedFiles} / ${job.progress.totalFiles}`;
}

function speedText(job: JobItem, snapshot: ZManagerReactSnapshot): string {
  const i18n = translatorForSnapshot(snapshot);
  return job.progress.speedBytesPerSecond === null
    ? i18n.t("jobs.metric.notAvailable")
    : `${formatBytes(job.progress.speedBytesPerSecond, { locale: snapshot.display.resolvedLocale })}/s`;
}

function processedText(job: JobItem, snapshot: ZManagerReactSnapshot): string {
  return job.progress.totalBytes === null
    ? formatBytes(job.progress.processedBytes, { locale: snapshot.display.resolvedLocale })
    : `${formatBytes(job.progress.processedBytes, { locale: snapshot.display.resolvedLocale })} / ${formatBytes(job.progress.totalBytes, { locale: snapshot.display.resolvedLocale })}`;
}

function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds)) {
    return "";
  }
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatDurationClock(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds)) {
    return "--:--:--";
  }
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatJobKind(kind: JobKind, snapshot: ZManagerReactSnapshot): string {
  const i18n = translatorForSnapshot(snapshot);
  const key = `jobs.kind.${kind}` as const;
  return i18n.t(key);
}

function jobStatusKey(status: JobStatus) {
  switch (status) {
    case "queued":
      return "jobs.status.queued";
    case "running":
      return "jobs.status.running";
    case "paused":
      return "jobs.status.paused";
    case "completed":
      return "jobs.status.completed";
    case "failed":
      return "jobs.status.failed";
    case "cancelled":
      return "jobs.status.cancelled";
  }
}

function quickOperationLabel(
  progress: Extract<QuickProgress, { state: "tracking" }>,
  snapshot: ZManagerReactSnapshot,
): string {
  const i18n = translatorForSnapshot(snapshot);
  if (progress.allTerminal) {
    if (progress.latestJob.status === "completed") {
      return i18n.t("quick.operation.completed");
    }
    return progress.latestJob.status === "cancelled"
      ? i18n.t("quick.operation.cancelled")
      : i18n.t("quick.operation.failed");
  }
  if (progress.anyPaused) {
    return i18n.t("quick.operation.paused");
  }
  switch (progress.latestJob.kind) {
    case "zipCreate":
    case "sevenZCreate":
    case "tarZstdCreate":
    case "tzapCreate":
    case "appleArchiveCreate":
      return i18n.t("quick.operation.adding");
    case "zipExtract":
    case "sevenZExtract":
    case "rarExtract":
    case "tarZstdExtract":
    case "tzapExtract":
    case "appleArchiveExtract":
    case "archiveExtract":
    case "rawStreamExtract":
      return i18n.t("quick.operation.extracting");
    case "testArchive":
      return i18n.t("quick.operation.testing");
    default:
      return i18n.t("quick.operation.starting");
  }
}

function focusedJobProgressContextDisplay(
  context: FocusedContext,
  snapshot: ZManagerReactSnapshot,
): Readonly<{ title: string; subtitle?: string; rows: readonly Readonly<{ label: string; value: string }>[] }> | undefined {
  if (!context) {
    return undefined;
  }
  if (context.kind === "create") {
    const sourcePreview = truncatedPathPreview(context.sources, 3, 180);
    const sourceLabel = context.sources.length === 1 ? "Source" : "Sources";
    return {
      title: "Create archive",
      subtitle: getPathBasename(context.destinationPath, context.destinationPath),
      rows: progressContextRows([
        { label: sourceLabel, value: sourcePreview },
        { label: "Destination", value: context.destinationPath },
        { label: "Format", value: context.format },
        { label: "Clean source", value: context.cleanSource ? "Yes" : "No" },
        { label: "Recovery", value: context.format === "tzap" && context.tzapRecoveryPercentage !== undefined ? `${context.tzapRecoveryPercentage}%` : null },
      ]),
    };
  }

  const i18n = translatorForSnapshot(snapshot);
  const entryCount = context.entryPaths?.length ?? 0;
  const entryPreview = context.entryPaths ? truncatedPathPreview(context.entryPaths, 3, 180) : null;
  return {
    title: context.title === "selection" ? i18n.t("extract.selectedProgressTitle") : "Extract archive",
    subtitle: getPathBasename(context.archivePath, context.archivePath),
    rows: progressContextRows([
      { label: "Archive", value: context.archivePath },
      { label: "Destination", value: context.destinationPath },
      { label: "Entries", value: entryCount > 0 ? `${entryCount} selected${entryPreview ? `: ${entryPreview}` : ""}` : "All entries" },
      { label: "Overwrite", value: context.overwrite },
    ]),
  };
}

function progressContextRows(rows: readonly Readonly<{ label: string; value?: string | null }>[]) {
  return rows
    .filter((row): row is Readonly<{ label: string; value: string }> => Boolean(row.value))
    .map((row) => ({ label: row.label, value: row.value }));
}

function truncatedPathPreview(paths: readonly string[], maxItems = 3, maxLength = 140): string | null {
  if (!paths.length) {
    return null;
  }
  const sortedUniquePaths = Array.from(new Set(paths)).sort();
  const shownPaths = sortedUniquePaths.slice(0, maxItems);
  const remaining = sortedUniquePaths.length - maxItems;
  let preview = shownPaths.join(", ");
  if (remaining > 0) {
    preview = `${preview} (+${remaining} more)`;
  }
  if (preview.length <= maxLength) {
    return preview;
  }
  const headLength = Math.max(8, Math.ceil((maxLength - 3) * 0.58));
  const tailLength = Math.max(8, maxLength - headLength - 3);
  return `${preview.slice(0, headLength)}...${preview.slice(-tailLength)}`;
}
