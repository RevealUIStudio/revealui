use tauri::State;

use super::error::StudioError;
use crate::state::AppState;

#[tauri::command]
pub fn mount_devbox(state: State<AppState>) -> Result<String, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;
    platform.mount_devbox().map_err(|e| StudioError::Other(e))
}

#[tauri::command]
pub fn unmount_devbox(state: State<AppState>) -> Result<String, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;
    platform.unmount_devbox().map_err(|e| StudioError::Other(e))
}
