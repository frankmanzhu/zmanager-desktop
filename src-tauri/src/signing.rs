use crate::account::AccountRuntime;
use crate::error::CommandErrorDto;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountSignDocumentRequest {
    pub certificate_id: String,
    pub payload_path: String,
    pub output_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountSignDocumentResultDto {
    pub envelope_path: String,
    pub size: u64,
}

#[tauri::command]
pub fn account_sign_document(
    _request: AccountSignDocumentRequest,
    _runtime: State<'_, AccountRuntime>,
) -> Result<AccountSignDocumentResultDto, CommandErrorDto> {
    Err(CommandErrorDto::operation_failed("Document signing is not fully implemented yet."))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountVerifyDocumentRequest {
    pub envelope_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountVerifyDocumentResultDto {
    pub is_valid: bool,
    pub subject: String,
    pub certificate_sha256: String,
}

#[tauri::command]
pub fn account_verify_document(
    _request: AccountVerifyDocumentRequest,
    _runtime: State<'_, AccountRuntime>,
) -> Result<AccountVerifyDocumentResultDto, CommandErrorDto> {
    Err(CommandErrorDto::operation_failed("Document verification is not fully implemented yet."))
}
