pub const DESKTOP_SHELL_NAME: &str = "zmanager-desktop";
pub const CORE_DEPENDENCY: &str = "zmanager-core";
pub const PLATFORM_STRATEGY: &str =
    "One shared Windows/Linux shell with isolated platform integration modules.";

pub const COMMAND_HEALTHCHECK: &str = "healthcheck";
pub const COMMAND_PROJECT_CONTRACT: &str = "project_contract";
pub const COMMAND_LIST_ARCHIVE: &str = "list_archive";
pub const COMMAND_TEST_ARCHIVE: &str = "test_archive";
pub const COMMAND_PLAN_CREATE: &str = "plan_create";
pub const COMMAND_START_CREATE: &str = "start_create";
pub const COMMAND_START_EXTRACT: &str = "start_extract";
pub const COMMAND_EXTRACT_ENTRY: &str = "extract_entry";
pub const COMMAND_PREVIEW_ENTRY: &str = "preview_entry";
pub const COMMAND_POLL_JOB_EVENTS: &str = "poll_job_events";
pub const COMMAND_CANCEL_JOB: &str = "cancel_job";
pub const COMMAND_DISMISS_JOB: &str = "dismiss_job";

pub const COMMAND_ERROR_INVALID_REQUEST: &str = "invalid_request";
pub const COMMAND_ERROR_NOT_FOUND: &str = "not_found";
pub const COMMAND_ERROR_PASSWORD_REQUIRED: &str = "password_required";
pub const COMMAND_ERROR_INVALID_PASSWORD: &str = "invalid_password";
pub const COMMAND_ERROR_UNSAFE_ARCHIVE: &str = "unsafe_archive";
pub const COMMAND_ERROR_IO_ERROR: &str = "io_error";
pub const COMMAND_ERROR_UNSUPPORTED_FORMAT: &str = "unsupported_format";
pub const COMMAND_ERROR_CANCELLED: &str = "cancelled";
pub const COMMAND_ERROR_OPERATION_FAILED: &str = "operation_failed";

pub const PLANNED_COMMANDS: &[&str] = &[
    COMMAND_HEALTHCHECK,
    COMMAND_PROJECT_CONTRACT,
    COMMAND_LIST_ARCHIVE,
    COMMAND_TEST_ARCHIVE,
    COMMAND_PLAN_CREATE,
    COMMAND_START_CREATE,
    COMMAND_START_EXTRACT,
    COMMAND_EXTRACT_ENTRY,
    COMMAND_PREVIEW_ENTRY,
    COMMAND_POLL_JOB_EVENTS,
    COMMAND_CANCEL_JOB,
    COMMAND_DISMISS_JOB,
];
