use std::fmt;

use serde::{Deserialize, Serialize};

pub const SHELL_ACTION_REQUEST_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ShellActionKind {
    Open,
    Compress,
    Extract,
    CompressZip,
    CompressTzap,
    CompressSevenZ,
    CompressTarZst,
    CompressCleanSource,
    ExtractHere,
    ExtractToFolder,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShellActionRequest {
    pub version: u32,
    pub action: ShellActionKind,
    pub paths: Vec<String>,
}

impl ShellActionRequest {
    pub fn new(action: ShellActionKind, paths: Vec<String>) -> Self {
        Self {
            version: SHELL_ACTION_REQUEST_VERSION,
            action,
            paths,
        }
    }

    pub fn from_json(json: &str) -> Result<Self, ShellActionContractError> {
        let request = serde_json::from_str::<Self>(json)
            .map_err(|error| ShellActionContractError::InvalidJson(error.to_string()))?;
        if request.version != SHELL_ACTION_REQUEST_VERSION {
            return Err(ShellActionContractError::UnsupportedVersion(
                request.version,
            ));
        }
        Ok(request)
    }

    pub fn to_json(&self) -> Result<String, ShellActionContractError> {
        serde_json::to_string(self)
            .map_err(|error| ShellActionContractError::InvalidJson(error.to_string()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShellActionContractError {
    InvalidJson(String),
    UnsupportedVersion(u32),
}

impl fmt::Display for ShellActionContractError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidJson(message) => {
                write!(formatter, "invalid shell-action request JSON: {message}")
            }
            Self::UnsupportedVersion(version) => {
                write!(
                    formatter,
                    "unsupported shell-action request version: {version}"
                )
            }
        }
    }
}

impl std::error::Error for ShellActionContractError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versioned_request_round_trips_all_selected_paths() {
        let request = ShellActionRequest::new(
            ShellActionKind::CompressZip,
            vec!["C:/work/folder1".to_string(), "C:/work/folder2".to_string()],
        );

        let json = request.to_json().expect("request should serialize");
        let parsed = ShellActionRequest::from_json(&json).expect("request should parse");

        assert_eq!(parsed, request);
    }

    #[test]
    fn unknown_contract_versions_are_rejected() {
        let error = ShellActionRequest::from_json(
            r#"{"version":2,"action":"compressZip","paths":["C:/work"]}"#,
        )
        .expect_err("unknown version should fail");

        assert_eq!(error, ShellActionContractError::UnsupportedVersion(2));
    }
}
