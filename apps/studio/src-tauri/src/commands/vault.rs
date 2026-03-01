use arboard::Clipboard;
use revvault_core::{PassageStore, SecretInfo};
use tauri::State;

use crate::state::AppState;

/// Initialize (or open) the vault. Stores the PassageStore in AppState.
#[tauri::command]
pub fn vault_init(state: State<'_, AppState>) -> Result<(), String> {
    let store = PassageStore::init().map_err(|e| e.to_string())?;
    let mut vault = state.vault.lock().map_err(|_| "vault lock poisoned".to_string())?;
    *vault = Some(store);
    Ok(())
}

/// Check whether the passage-store has been initialised (directory exists).
#[tauri::command]
pub fn vault_is_initialized() -> Result<bool, String> {
    Ok(PassageStore::is_initialized())
}

/// List secrets, optionally filtered by a path prefix.
#[tauri::command]
pub fn vault_list(state: State<'_, AppState>, prefix: Option<String>) -> Result<Vec<SecretInfo>, String> {
    let vault = state.vault.lock().map_err(|_| "vault lock poisoned".to_string())?;
    let store = vault.as_ref().ok_or("Vault not initialized — call vault_init first")?;
    store.list(prefix.as_deref()).map_err(|e| e.to_string())
}

/// Get the plaintext value of a secret by its full path.
#[tauri::command]
pub fn vault_get(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let vault = state.vault.lock().map_err(|_| "vault lock poisoned".to_string())?;
    let store = vault.as_ref().ok_or("Vault not initialized — call vault_init first")?;
    store.get(&path).map_err(|e| e.to_string())
}

/// Set (create or update) a secret.
#[tauri::command]
pub fn vault_set(
    state: State<'_, AppState>,
    path: String,
    value: String,
    force: bool,
) -> Result<(), String> {
    let mut vault = state.vault.lock().map_err(|_| "vault lock poisoned".to_string())?;
    let store = vault.as_mut().ok_or("Vault not initialized — call vault_init first")?;
    store.set(&path, &value, force).map_err(|e| e.to_string())
}

/// Delete a secret by its full path.
#[tauri::command]
pub fn vault_delete(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let mut vault = state.vault.lock().map_err(|_| "vault lock poisoned".to_string())?;
    let store = vault.as_mut().ok_or("Vault not initialized — call vault_init first")?;
    store.delete(&path).map_err(|e| e.to_string())
}

/// Search secrets by a query string (matches path/namespace).
#[tauri::command]
pub fn vault_search(state: State<'_, AppState>, query: String) -> Result<Vec<SecretInfo>, String> {
    let vault = state.vault.lock().map_err(|_| "vault lock poisoned".to_string())?;
    let store = vault.as_ref().ok_or("Vault not initialized — call vault_init first")?;
    store.search(&query).map_err(|e| e.to_string())
}

/// Copy a secret value to the system clipboard.
#[tauri::command]
pub fn vault_copy(value: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {e}"))?;
    clipboard.set_text(&value).map_err(|e| format!("Failed to copy: {e}"))
}
