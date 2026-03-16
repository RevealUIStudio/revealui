use tauri::State;

use super::error::StudioError;
use crate::platform::trait_defs::TailscaleStatus;
use crate::state::AppState;

/// Get current Tailscale status including peers.
#[tauri::command]
pub fn get_tailscale_status(state: State<'_, AppState>) -> Result<TailscaleStatus, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|_| StudioError::LockPoisoned("platform lock poisoned".into()))?;
    platform
        .get_tailscale_status()
        .map_err(|e| StudioError::Network(e))
}

/// Bring Tailscale up (connect).
#[tauri::command]
pub fn tailscale_up(state: State<'_, AppState>) -> Result<String, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|_| StudioError::LockPoisoned("platform lock poisoned".into()))?;
    platform.tailscale_up().map_err(|e| StudioError::Network(e))
}

/// Bring Tailscale down (disconnect).
#[tauri::command]
pub fn tailscale_down(state: State<'_, AppState>) -> Result<String, StudioError> {
    let platform = state
        .platform
        .lock()
        .map_err(|_| StudioError::LockPoisoned("platform lock poisoned".into()))?;
    platform
        .tailscale_down()
        .map_err(|e| StudioError::Network(e))
}
