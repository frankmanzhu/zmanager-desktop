use serde::Serialize;

const DESKTOP_SHELL_NAME: &str = "zmanager-desktop";
const CORE_DEPENDENCY: &str = "zmanager-core";
const PLATFORM_STRATEGY: &str =
    "One shared Windows/Linux shell with isolated platform integration modules.";

const PLANNED_COMMANDS: &[&str] = &[
    "healthcheck",
    "list_archive",
    "test_archive",
    "plan_create",
    "start_create",
    "start_extract",
    "extract_entry",
    "preview_entry",
    "poll_job_events",
    "cancel_job",
    "dismiss_job",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthcheckResponse {
    engine: &'static str,
    version: &'static str,
    ready: bool,
    summary: String,
    shell: &'static str,
    status: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectContract {
    commands: &'static [&'static str],
    platform_strategy: &'static str,
    core_dependency: &'static str,
}

#[tauri::command]
pub fn healthcheck() -> HealthcheckResponse {
    let report = zmanager_core::healthcheck();
    HealthcheckResponse {
        engine: report.engine,
        version: report.version,
        ready: report.ready,
        summary: report.summary(),
        shell: DESKTOP_SHELL_NAME,
        status: if report.ready { "ready" } else { "not-ready" },
    }
}

#[tauri::command]
pub fn project_contract() -> ProjectContract {
    ProjectContract {
        commands: PLANNED_COMMANDS,
        platform_strategy: PLATFORM_STRATEGY,
        core_dependency: CORE_DEPENDENCY,
    }
}
