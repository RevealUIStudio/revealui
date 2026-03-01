use tauri::State;

use crate::platform::trait_defs::SyncResult;
use crate::state::AppState;

#[tauri::command]
pub fn sync_all_repos(state: State<AppState>) -> Result<Vec<SyncResult>, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.sync_all_repos()
}

#[tauri::command]
pub fn sync_repo(state: State<AppState>, name: String) -> Result<SyncResult, String> {
    let platform = state.platform.lock().map_err(|e| e.to_string())?;
    platform.sync_repo(&name)
}
