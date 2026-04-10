use super::error::StudioError;
use crate::inference;

/// Get Ollama server status (installed, running, version).
#[tauri::command]
pub fn inference_ollama_status() -> inference::OllamaStatus {
    inference::ollama_status()
}

/// List locally available Ollama models.
#[tauri::command]
pub fn inference_ollama_models() -> Result<Vec<inference::OllamaModel>, StudioError> {
    inference::ollama_list_models().map_err(|e| StudioError::Process(e))
}

/// Pull (download) an Ollama model.
#[tauri::command]
pub fn inference_ollama_pull(model_name: String) -> Result<inference::ModelPullResult, StudioError> {
    inference::ollama_pull(&model_name).map_err(|e| StudioError::Process(e))
}

/// Delete a locally downloaded Ollama model.
#[tauri::command]
pub fn inference_ollama_delete(model_name: String) -> Result<(), StudioError> {
    inference::ollama_delete(&model_name).map_err(|e| StudioError::Process(e))
}

/// Start the Ollama server.
#[tauri::command]
pub fn inference_ollama_start() -> Result<(), StudioError> {
    inference::ollama_start().map_err(|e| StudioError::Process(e))
}

/// Stop the Ollama server.
#[tauri::command]
pub fn inference_ollama_stop() -> Result<(), StudioError> {
    inference::ollama_stop().map_err(|e| StudioError::Process(e))
}

// ── Inference Snaps ─────────────────────────────────────────────────

/// Check status of a specific inference snap (installed, running, endpoint).
#[tauri::command]
pub fn inference_snap_status(snap_name: String) -> inference::SnapStatus {
    inference::snap_status(&snap_name)
}

/// List all known inference snaps with their install status.
#[tauri::command]
pub fn inference_snap_list() -> Vec<inference::SnapModel> {
    inference::snap_list_models()
}

/// Install an inference snap.
#[tauri::command]
pub fn inference_snap_install(snap_name: String) -> Result<inference::ModelPullResult, StudioError> {
    inference::snap_install(&snap_name).map_err(|e| StudioError::Process(e))
}

/// Remove an inference snap.
#[tauri::command]
pub fn inference_snap_remove(snap_name: String) -> Result<(), StudioError> {
    inference::snap_remove(&snap_name).map_err(|e| StudioError::Process(e))
}
