#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

forbidden='poll_job_events|pollJobEvents|JobPollingController|zmanager-task-job-update|jobPollInterval|startPolling|stopPolling|createJobsWorkspace|createJobSubscriptionSet|JobsDrawer|QuickActionProgress|focusedQuickActionJobIds|quickActionWindowMode|jobDrawerOpen'
if command -v rg >/dev/null 2>&1; then
  if rg -n "$forbidden" src src-tauri/src e2e; then
    echo "Legacy job polling or Main Window relay ownership is forbidden." >&2
    exit 1
  fi

  if rg -n 'revision: number|catalogRevision: number' src/api src/app/workspaces/disposableTask.ts src/desktop/jobFeed.ts; then
    echo "Job feed revisions must remain decimal strings." >&2
    exit 1
  fi
else
  if grep -rnE "$forbidden" src src-tauri/src e2e 2>/dev/null; then
    echo "Legacy job polling or Main Window relay ownership is forbidden." >&2
    exit 1
  fi

  if grep -rnE 'revision: number|catalogRevision: number' src/api src/app/workspaces/disposableTask.ts src/desktop/jobFeed.ts 2>/dev/null; then
    echo "Job feed revisions must remain decimal strings." >&2
    exit 1
  fi
fi

main_window_job_permissions='allow-subscribe-job"|allow-cancel-job"|allow-pause-job"|allow-resume-job"|allow-dismiss-job"'
if command -v rg >/dev/null 2>&1; then
  forbidden_main_permissions="$(rg -n "$main_window_job_permissions" src-tauri/capabilities/default.json || true)"
else
  forbidden_main_permissions="$(grep -nE "$main_window_job_permissions" src-tauri/capabilities/default.json || true)"
fi
if [[ -n "$forbidden_main_permissions" ]]; then
  printf '%s\n%s\n' \
    "The Main Window capability must not subscribe to or control individual Jobs." \
    "$forbidden_main_permissions" >&2
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  main_window_job_subscription="$(rg -n 'subscribeJob\(' src/runtime/zmanagerRuntimeAdapter.ts || true)"
else
  main_window_job_subscription="$(grep -nE 'subscribeJob\(' src/runtime/zmanagerRuntimeAdapter.ts || true)"
fi
if [[ -n "$main_window_job_subscription" ]]; then
  printf '%s\n%s\n' \
    "The Main Window must consume only the Job catalog; task windows own per-Job subscriptions." \
    "$main_window_job_subscription" >&2
  exit 1
fi
