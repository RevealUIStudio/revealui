use std::io::Write;
use std::path::PathBuf;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::State;
use ts_rs::TS;

use super::error::StudioError;
use crate::ssh::{SshAuth, SshState};

// ── SSH Session Commands ─────────────────────────────────────────────────────

/// Connect to an SSH server. Returns a session ID.
#[tauri::command]
pub async fn ssh_connect(
    host: String,
    port: u16,
    username: String,
    auth: SshAuth,
    app_handle: tauri::AppHandle,
    state: State<'_, SshState>,
) -> Result<String, StudioError> {
    crate::ssh::connect(host, port, username, auth, app_handle, state.sessions.clone())
        .await
        .map_err(|e| StudioError::Ssh(e))
}

/// Disconnect an SSH session.
#[tauri::command]
pub async fn ssh_disconnect(
    session_id: String,
    state: State<'_, SshState>,
) -> Result<(), StudioError> {
    let mut sessions = state.sessions.lock().await;
    let session = sessions
        .remove(&session_id)
        .ok_or_else(|| StudioError::Other(format!("No session with id {session_id}")))?;

    session
        .handle
        .disconnect(russh::Disconnect::ByApplication, "user disconnect", "en")
        .await
        .map_err(|e| StudioError::Ssh(format!("Disconnect failed: {e}")))?;

    Ok(())
}

/// Send data (base64-encoded) to an SSH session.
#[tauri::command]
pub async fn ssh_send(
    session_id: String,
    data: String,
    state: State<'_, SshState>,
) -> Result<(), StudioError> {
    let bytes = BASE64
        .decode(&data)
        .map_err(|e| StudioError::Other(format!("Invalid base64: {e}")))?;

    let sessions = state.sessions.lock().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| StudioError::Other(format!("No session with id {session_id}")))?;

    let channel_guard = session.channel.lock().await;
    let channel = channel_guard
        .as_ref()
        .ok_or_else(|| StudioError::Ssh("Channel closed".into()))?;

    channel
        .data(&bytes[..])
        .await
        .map_err(|e| StudioError::Ssh(format!("Send failed: {e}")))?;

    Ok(())
}

/// Resize the PTY for an SSH session.
#[tauri::command]
pub async fn ssh_resize(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SshState>,
) -> Result<(), StudioError> {
    let sessions = state.sessions.lock().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| StudioError::Other(format!("No session with id {session_id}")))?;

    let channel_guard = session.channel.lock().await;
    let channel = channel_guard
        .as_ref()
        .ok_or_else(|| StudioError::Ssh("Channel closed".into()))?;

    channel
        .window_change(cols, rows, 0, 0)
        .await
        .map_err(|e| StudioError::Ssh(format!("Resize failed: {e}")))?;

    Ok(())
}

// ── Bookmarks ────────────────────────────────────────────────────────────────

/// A saved SSH connection profile. Never stores passwords — only key paths.
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SshBookmark {
    pub id: String,
    pub label: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    /// "password" or "key"
    pub auth_method: String,
    /// Path to SSH key file (only for auth_method = "key")
    pub key_path: Option<String>,
}

/// Persistent store: list of bookmarks serialized as JSON.
#[derive(Default, Serialize, Deserialize)]
struct BookmarkStore {
    bookmarks: Vec<SshBookmark>,
}

fn bookmarks_path() -> Result<PathBuf, StudioError> {
    let dir = dirs::config_dir()
        .ok_or(StudioError::Config(
            "Cannot determine config directory".into(),
        ))?
        .join("revealui-studio");
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("ssh-bookmarks.json"))
}

fn load_bookmarks() -> Result<BookmarkStore, StudioError> {
    let path = bookmarks_path()?;
    if !path.exists() {
        return Ok(BookmarkStore::default());
    }
    let data = std::fs::read_to_string(&path)?;
    serde_json::from_str(&data).map_err(Into::into)
}

fn save_bookmarks(store: &BookmarkStore) -> Result<(), StudioError> {
    let path = bookmarks_path()?;
    let data = serde_json::to_string_pretty(store)?;
    let mut file = std::fs::File::create(&path)?;
    file.write_all(data.as_bytes())?;
    Ok(())
}

#[tauri::command]
pub async fn ssh_bookmark_list() -> Result<Vec<SshBookmark>, StudioError> {
    let store = load_bookmarks()?;
    Ok(store.bookmarks)
}

#[tauri::command]
pub async fn ssh_bookmark_save(bookmark: SshBookmark) -> Result<(), StudioError> {
    let mut store = load_bookmarks()?;
    // Upsert by id
    if let Some(existing) = store.bookmarks.iter_mut().find(|b| b.id == bookmark.id) {
        *existing = bookmark;
    } else {
        store.bookmarks.push(bookmark);
    }
    save_bookmarks(&store)
}

#[tauri::command]
pub async fn ssh_bookmark_delete(id: String) -> Result<(), StudioError> {
    let mut store = load_bookmarks()?;
    store.bookmarks.retain(|b| b.id != id);
    save_bookmarks(&store)
}
