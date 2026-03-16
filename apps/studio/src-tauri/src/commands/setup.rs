use tauri::State;

use super::error::StudioError;
use crate::platform::trait_defs::SetupStatus;
use crate::state::AppState;

#[tauri::command]
pub fn check_setup(state: State<AppState>) -> Result<SetupStatus, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;
    platform.check_setup().map_err(|e| StudioError::Other(e))
}

#[tauri::command]
pub fn set_git_identity(
    state: State<AppState>,
    name: String,
    email: String,
) -> Result<(), StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;
    platform
        .set_git_identity(&name, &email)
        .map_err(|e| StudioError::Other(e))
}
