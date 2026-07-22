use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

const LOG_DIRECTORY_NAME: &str = "logs";
const LOG_FILE_NAME: &str = "zmanager-diagnostics.log";
const PREVIOUS_LOG_FILE_NAME: &str = "zmanager-diagnostics.previous.log";
const MAX_LOG_BYTES: u64 = 4 * 1024 * 1024;
const MAX_PENDING_EVENTS: usize = 128;
const MAX_FIELDS: usize = 24;
const MAX_NAME_CHARS: usize = 64;
const MAX_STRING_CHARS: usize = 256;

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEventRequest {
    pub scope: String,
    pub name: String,
    #[serde(default)]
    pub fields: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticLogInfoDto {
    pub enabled: bool,
    pub path: Option<String>,
    pub session_id: String,
    pub location: String,
}

#[derive(Clone, Debug)]
pub struct DiagnosticLog {
    session_id: Arc<String>,
    process_id: u32,
    inner: Arc<Mutex<DiagnosticLogState>>,
}

#[derive(Debug, Default)]
struct DiagnosticLogState {
    path: Option<PathBuf>,
    location: Option<&'static str>,
    pending_lines: Vec<String>,
    sequence: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticLogEntry<'a> {
    timestamp_unix_ms: u64,
    session_id: &'a str,
    process_id: u32,
    sequence: u64,
    level: &'static str,
    scope: String,
    name: String,
    fields: BTreeMap<String, Value>,
}

impl DiagnosticLog {
    pub fn new() -> Self {
        let timestamp = unix_timestamp_ms();
        let process_id = std::process::id();
        Self {
            session_id: Arc::new(format!("{timestamp}-{process_id}")),
            process_id,
            inner: Arc::new(Mutex::new(DiagnosticLogState::default())),
        }
    }

    pub fn initialize(&self, user_log_directory: Option<PathBuf>) -> io::Result<()> {
        let install_log_directory = std::env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(|parent| parent.join(LOG_DIRECTORY_NAME)));

        self.initialize_with_directories(
            install_log_directory.as_deref(),
            user_log_directory.as_deref(),
        )
    }

    fn initialize_with_directories(
        &self,
        install_log_directory: Option<&Path>,
        user_log_directory: Option<&Path>,
    ) -> io::Result<()> {
        let primary_result = install_log_directory
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::NotFound,
                    "installation directory unavailable",
                )
            })
            .and_then(|directory| self.activate(directory, "installation"));

        if primary_result.is_ok() {
            self.record(
                "diagnostics",
                "initialized",
                fields([
                    ("location", Value::String("installation".to_string())),
                    ("primaryLocationAvailable", Value::Bool(true)),
                ]),
            )?;
            return Ok(());
        }

        let Some(user_log_directory) = user_log_directory else {
            return primary_result;
        };
        let primary_error_kind = primary_result
            .as_ref()
            .err()
            .map(|error| format!("{:?}", error.kind()))
            .unwrap_or_else(|| "Unknown".to_string());
        self.activate(user_log_directory, "userFallback")?;
        self.record(
            "diagnostics",
            "initialized",
            fields([
                ("location", Value::String("userFallback".to_string())),
                ("primaryLocationAvailable", Value::Bool(false)),
                ("primaryErrorKind", Value::String(primary_error_kind)),
            ]),
        )
    }

    pub fn record(
        &self,
        scope: impl Into<String>,
        name: impl Into<String>,
        fields: BTreeMap<String, Value>,
    ) -> io::Result<()> {
        let mut state = self.inner.lock().expect("diagnostic log lock poisoned");
        state.sequence = state.sequence.saturating_add(1);
        let entry = DiagnosticLogEntry {
            timestamp_unix_ms: unix_timestamp_ms(),
            session_id: &self.session_id,
            process_id: self.process_id,
            sequence: state.sequence,
            level: "info",
            scope: sanitize_name(scope.into()),
            name: sanitize_name(name.into()),
            fields: sanitize_fields(fields),
        };
        let line = serde_json::to_string(&entry).map_err(|error| {
            io::Error::other(format!("unable to serialize diagnostic event: {error}"))
        })?;

        if let Some(path) = state.path.as_deref() {
            append_line(path, &line)?;
        } else {
            if state.pending_lines.len() == MAX_PENDING_EVENTS {
                state.pending_lines.remove(0);
            }
            state.pending_lines.push(line);
        }
        Ok(())
    }

    pub fn info(&self) -> DiagnosticLogInfoDto {
        let state = self.inner.lock().expect("diagnostic log lock poisoned");
        DiagnosticLogInfoDto {
            enabled: state.path.is_some(),
            path: state
                .path
                .as_ref()
                .map(|path| path.to_string_lossy().to_string()),
            session_id: (*self.session_id).clone(),
            location: state.location.unwrap_or("unavailable").to_string(),
        }
    }

    fn activate(&self, directory: &Path, location: &'static str) -> io::Result<()> {
        fs::create_dir_all(directory)?;
        let path = directory.join(LOG_FILE_NAME);
        rotate_if_needed(&path, 0)?;
        OpenOptions::new().create(true).append(true).open(&path)?;

        let mut state = self.inner.lock().expect("diagnostic log lock poisoned");
        for line in &state.pending_lines {
            append_line(&path, line)?;
        }
        state.pending_lines.clear();
        state.path = Some(path);
        state.location = Some(location);
        Ok(())
    }
}

#[tauri::command]
pub fn record_diagnostic_event(
    request: DiagnosticEventRequest,
    state: State<'_, DiagnosticLog>,
) -> Result<(), crate::error::CommandErrorDto> {
    state
        .record(request.scope, request.name, request.fields)
        .map_err(|_| crate::error::CommandErrorDto::io_error("Unable to write diagnostics", true))
}

#[tauri::command]
pub fn diagnostic_log_info(state: State<'_, DiagnosticLog>) -> DiagnosticLogInfoDto {
    state.info()
}

pub fn fields<const N: usize>(entries: [(&str, Value); N]) -> BTreeMap<String, Value> {
    entries
        .into_iter()
        .map(|(key, value)| (key.to_string(), value))
        .collect()
}

fn append_line(path: &Path, line: &str) -> io::Result<()> {
    rotate_if_needed(path, line.len().saturating_add(1) as u64)?;
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    file.write_all(line.as_bytes())?;
    file.write_all(b"\n")?;
    file.flush()
}

fn rotate_if_needed(path: &Path, incoming_bytes: u64) -> io::Result<()> {
    let current_bytes = fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if current_bytes.saturating_add(incoming_bytes) <= MAX_LOG_BYTES {
        return Ok(());
    }

    let previous_path = path.with_file_name(PREVIOUS_LOG_FILE_NAME);
    if previous_path.exists() {
        fs::remove_file(&previous_path)?;
    }
    if path.exists() {
        fs::rename(path, previous_path)?;
    }
    Ok(())
}

fn sanitize_fields(input: BTreeMap<String, Value>) -> BTreeMap<String, Value> {
    input
        .into_iter()
        .take(MAX_FIELDS)
        .map(|(key, value)| {
            let safe_key = sanitize_name(key);
            let safe_value = if is_sensitive_key(&safe_key) {
                Value::String("[REDACTED]".to_string())
            } else if is_path_key(&safe_key) {
                Value::String("[REDACTED_PATH]".to_string())
            } else {
                sanitize_value(value)
            };
            (safe_key, safe_value)
        })
        .collect()
}

fn sanitize_value(value: Value) -> Value {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => value,
        Value::String(value) => Value::String(value.chars().take(MAX_STRING_CHARS).collect()),
        Value::Array(_) | Value::Object(_) => Value::String("[UNSUPPORTED]".to_string()),
    }
}

fn sanitize_name(value: String) -> String {
    value
        .chars()
        .take(MAX_NAME_CHARS)
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-') {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn is_sensitive_key(key: &str) -> bool {
    let normalized = normalized_key(key);
    [
        "password",
        "passphrase",
        "secret",
        "credential",
        "privatekey",
        "token",
    ]
    .iter()
    .any(|sensitive| normalized.contains(sensitive))
}

fn is_path_key(key: &str) -> bool {
    let normalized = normalized_key(key);
    normalized.contains("path") && !normalized.ends_with("pathcount")
}

fn normalized_key(key: &str) -> String {
    key.chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u128::from(u64::MAX)) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_temp_directory(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "zmanager-diagnostics-{name}-{}-{}",
            std::process::id(),
            unix_timestamp_ms()
        ))
    }

    #[test]
    fn buffers_startup_events_then_writes_json_lines() {
        let log = DiagnosticLog::new();
        log.record(
            "startup",
            "classified",
            fields([("action", Value::String("compressZip".to_string()))]),
        )
        .unwrap();

        let directory = unique_temp_directory("buffer");
        log.activate(&directory, "installation").unwrap();
        let content = fs::read_to_string(directory.join(LOG_FILE_NAME)).unwrap();
        let event: Value = serde_json::from_str(content.lines().next().unwrap()).unwrap();

        assert_eq!(event["scope"], "startup");
        assert_eq!(event["name"], "classified");
        assert_eq!(event["fields"]["action"], "compressZip");
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn redacts_sensitive_fields_and_rejects_nested_payloads() {
        let sanitized = sanitize_fields(fields([
            ("password", Value::String("do-not-write".to_string())),
            ("requestToken", Value::String("opaque-token".to_string())),
            (
                "archivePath",
                Value::String("C:/private/file.zip".to_string()),
            ),
            ("metadata", serde_json::json!({ "nested": true })),
        ]));

        assert_eq!(sanitized["password"], "[REDACTED]");
        assert_eq!(sanitized["requestToken"], "[REDACTED]");
        assert_eq!(sanitized["archivePath"], "[REDACTED_PATH]");
        assert_eq!(sanitized["metadata"], "[UNSUPPORTED]");
        assert!(
            !serde_json::to_string(&sanitized)
                .unwrap()
                .contains("do-not-write")
        );
        assert!(
            !serde_json::to_string(&sanitized)
                .unwrap()
                .contains("opaque-token")
        );
        assert!(
            !serde_json::to_string(&sanitized)
                .unwrap()
                .contains("C:/private/file.zip")
        );
    }

    #[test]
    fn uses_reported_user_fallback_when_install_directory_is_not_writable() {
        let root = unique_temp_directory("fallback");
        fs::create_dir_all(&root).unwrap();
        let blocked_install_directory = root.join("blocked-install-directory");
        fs::write(&blocked_install_directory, "not a directory").unwrap();
        let fallback_directory = root.join("user-logs");
        let log = DiagnosticLog::new();

        log.initialize_with_directories(
            Some(&blocked_install_directory),
            Some(&fallback_directory),
        )
        .unwrap();

        let info = log.info();
        assert!(info.enabled);
        assert_eq!(info.location, "userFallback");
        assert_eq!(
            info.path,
            Some(
                fallback_directory
                    .join(LOG_FILE_NAME)
                    .to_string_lossy()
                    .to_string()
            )
        );
        fs::remove_dir_all(root).unwrap();
    }
}
