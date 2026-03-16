use tauri::State;

use super::error::StudioError;
use crate::platform::trait_defs::SyncResult;
use crate::state::AppState;

#[tauri::command]
pub fn sync_all_repos(state: State<AppState>) -> Result<Vec<SyncResult>, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;
    platform.sync_all_repos().map_err(|e| StudioError::Other(e))
}

#[tauri::command]
pub fn sync_repo(state: State<AppState>, name: String) -> Result<SyncResult, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|e| StudioError::LockPoisoned(e.to_string()))?;
    platform.sync_repo(&name).map_err(|e| StudioError::Other(e))
}
