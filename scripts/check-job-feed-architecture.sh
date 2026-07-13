#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

forbidden='poll_job_events|pollJobEvents|JobPollingController|zmanager-task-job-update|jobPollInterval|startPolling|stopPolling'
if rg -n "$forbidden" src src-tauri/src e2e; then
  echo "Legacy job polling or Main Window relay ownership is forbidden." >&2
  exit 1
fi

if rg -n 'revision: number|catalogRevision: number' src/api src/app/workspaces/jobsWorkspace.ts src/app/workspaces/disposableTask.ts src/desktop/jobFeed.ts; then
  echo "Job feed revisions must remain decimal strings." >&2
  exit 1
fi
