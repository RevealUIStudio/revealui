use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use portable_pty::PtySize;
use tauri::State;

use super::error::StudioError;
use crate::local_shell::LocalShellState;

/// Open a local PTY shell. Returns session ID.
#[tauri::command]
pub fn shell_open(
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    app_handle: tauri::AppHandle,
    state: State<'_, LocalShellState>,
) -> Result<String, StudioError> {
    crate::local_shell::open(cols, rows, cwd, app_handle, state.sessions.clone())
        .map_err(|e| StudioError::Process(e))
}

/// Close a local shell session.
#[tauri::command]
pub fn shell_close(
    session_id: String,
    state: State<'_, LocalShellState>,
) -> Result<(), StudioError> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;

    let mut session = sessions
        .remove(&session_id)
        .ok_or_else(|| StudioError::Other(format!("No session with id {session_id}")))?;

    // Kill the child process
    session
        .child
        .kill()
        .map_err(|e| StudioError::Process(format!("Failed to kill shell: {e}")))?;

    Ok(())
}

/// Send data (base64-encoded) to a local shell session.
#[tauri::command]
pub fn shell_send(
    session_id: String,
    data: String,
    state: State<'_, LocalShellState>,
) -> Result<(), StudioError> {
    let bytes = BASE64
        .decode(&data)
        .map_err(|e| StudioError::Other(format!("Invalid base64: {e}")))?;

    let mut sessions = state
        .sessions
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;

    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| StudioError::Other(format!("No session with id {session_id}")))?;

    session
        .writer
        .write_all(&bytes)
        .map_err(|e| StudioError::Io(format!("Write failed: {e}")))?;

    Ok(())
}

/// Resize the PTY for a local shell session.
#[tauri::command]
pub fn shell_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, LocalShellState>,
) -> Result<(), StudioError> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;

    let session = sessions
        .get(&session_id)
        .ok_or_else(|| StudioError::Other(format!("No session with id {session_id}")))?;

    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| StudioError::Process(format!("Resize failed: {e}")))?;

    Ok(())
}
