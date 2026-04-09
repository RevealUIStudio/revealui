use tauri::State;

use super::error::StudioError;
use crate::spawner::{AgentBackend, SpawnerState};

/// Spawn a new agent process using local inference (Snap or Ollama).
#[tauri::command]
pub fn agent_spawn(
    name: String,
    backend: AgentBackend,
    model: String,
    prompt: String,
    app_handle: tauri::AppHandle,
    state: State<'_, SpawnerState>,
) -> Result<String, StudioError> {
    crate::spawner::spawn(name, backend, model, prompt, app_handle, state.sessions.clone())
        .map_err(|e| StudioError::Process(e))
}

/// Stop a running agent process.
#[tauri::command]
pub fn agent_stop(
    session_id: String,
    state: State<'_, SpawnerState>,
) -> Result<(), StudioError> {
    crate::spawner::stop(&session_id, state.sessions.clone())
        .map_err(|e| StudioError::Process(e))
}

/// List all agent sessions.
#[tauri::command]
pub fn agent_list(
    state: State<'_, SpawnerState>,
) -> Result<Vec<crate::spawner::AgentSessionInfo>, StudioError> {
    crate::spawner::list(state.sessions.clone()).map_err(|e| StudioError::Process(e))
}

/// Remove a stopped/errored agent session.
#[tauri::command]
pub fn agent_remove(
    session_id: String,
    state: State<'_, SpawnerState>,
) -> Result<(), StudioError> {
    crate::spawner::remove(&session_id, state.sessions.clone())
        .map_err(|e| StudioError::Process(e))
}
