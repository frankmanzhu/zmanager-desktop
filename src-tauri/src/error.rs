use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
#[derive(Default)]
pub enum ErrorSeverityDto {
    Info,
    Warning,
    #[default]
    Error,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandErrorDto {
    pub code: &'static str,
    pub message: String,
    pub hint: Option<String>,
    pub severity: ErrorSeverityDto,
    pub retryable: bool,
}

impl CommandErrorDto {
    pub fn new(
        code: &'static str,
        message: impl Into<String>,
        hint: Option<impl Into<String>>,
        severity: ErrorSeverityDto,
        retryable: bool,
    ) -> Self {
        Self {
            code,
            message: message.into(),
            hint: hint.map(Into::into),
            severity,
            retryable,
        }
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(
            crate::constants::COMMAND_ERROR_INVALID_REQUEST,
            message,
            None::<String>,
            ErrorSeverityDto::Warning,
            false,
        )
    }

    pub fn not_found(message: impl Into<String>, hint: Option<String>) -> Self {
        Self::new(
            crate::constants::COMMAND_ERROR_NOT_FOUND,
            message,
            hint,
            ErrorSeverityDto::Warning,
            false,
        )
    }

    pub fn password_required(message: impl Into<String>, hint: Option<String>) -> Self {
        Self::new(
            crate::constants::COMMAND_ERROR_PASSWORD_REQUIRED,
            message,
            hint,
            ErrorSeverityDto::Warning,
            true,
        )
    }

    pub fn invalid_password(message: impl Into<String>) -> Self {
        Self::new(
            crate::constants::COMMAND_ERROR_INVALID_PASSWORD,
            message,
            None::<String>,
            ErrorSeverityDto::Warning,
            true,
        )
    }

    pub fn unsafe_archive(message: impl Into<String>) -> Self {
        Self::new(
            crate::constants::COMMAND_ERROR_UNSAFE_ARCHIVE,
            message,
            None::<String>,
            ErrorSeverityDto::Warning,
            false,
        )
    }

    pub fn io_error(message: impl Into<String>, retryable: bool) -> Self {
        Self::new(
            crate::constants::COMMAND_ERROR_IO_ERROR,
            message,
            None::<String>,
            ErrorSeverityDto::Error,
            retryable,
        )
    }

    pub fn unsupported_format(message: impl Into<String>) -> Self {
        Self::new(
            crate::constants::COMMAND_ERROR_UNSUPPORTED_FORMAT,
            message,
            None::<String>,
            ErrorSeverityDto::Warning,
            false,
        )
    }

    pub fn cancelled(message: impl Into<String>) -> Self {
        Self::new(
            crate::constants::COMMAND_ERROR_CANCELLED,
            message,
            None::<String>,
            ErrorSeverityDto::Info,
            true,
        )
    }

    pub fn operation_failed(message: impl Into<String>) -> Self {
        Self::new(
            crate::constants::COMMAND_ERROR_OPERATION_FAILED,
            message,
            None::<String>,
            ErrorSeverityDto::Error,
            false,
        )
    }
}
