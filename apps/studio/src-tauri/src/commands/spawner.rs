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

/// Write input data to a daemon PTY session (agent.input RPC).
#[tauri::command]
pub async fn agent_input(session_id: String, data: String) -> Result<(), StudioError> {
    crate::harness::rpc_call(
        "agent.input",
        serde_json::json!({ "sessionId": session_id, "data": data }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    Ok(())
}

/// Resize a daemon PTY session's terminal (agent.resize RPC).
#[tauri::command]
pub async fn agent_resize(
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), StudioError> {
    crate::harness::rpc_call(
        "agent.resize",
        serde_json::json!({ "sessionId": session_id, "cols": cols, "rows": rows }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    Ok(())
}
