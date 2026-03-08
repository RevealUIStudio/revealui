use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use tauri::State;

use crate::ssh::SshState;

/// Connect to an SSH server. Returns a session ID.
#[tauri::command]
pub async fn ssh_connect(
    host: String,
    port: u16,
    username: String,
    password: String,
    app_handle: tauri::AppHandle,
    state: State<'_, SshState>,
) -> Result<String, String> {
    crate::ssh::connect(host, port, username, password, app_handle, state.sessions.clone()).await
}

/// Disconnect an SSH session.
#[tauri::command]
pub async fn ssh_disconnect(session_id: String, state: State<'_, SshState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock().await;
    let session = sessions
        .remove(&session_id)
        .ok_or_else(|| format!("No session with id {session_id}"))?;

    session
        .handle
        .disconnect(russh::Disconnect::ByApplication, "user disconnect", "en")
        .await
        .map_err(|e| format!("Disconnect failed: {e}"))?;

    Ok(())
}

/// Send data (base64-encoded) to an SSH session.
#[tauri::command]
pub async fn ssh_send(
    session_id: String,
    data: String,
    state: State<'_, SshState>,
) -> Result<(), String> {
    let bytes = BASE64
        .decode(&data)
        .map_err(|e| format!("Invalid base64: {e}"))?;

    let sessions = state.sessions.lock().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("No session with id {session_id}"))?;

    let channel_guard = session.channel.lock().await;
    let channel = channel_guard
        .as_ref()
        .ok_or_else(|| "Channel closed".to_string())?;

    channel
        .data(&bytes[..])
        .await
        .map_err(|e| format!("Send failed: {e}"))?;

    Ok(())
}

/// Resize the PTY for an SSH session.
#[tauri::command]
pub async fn ssh_resize(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SshState>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("No session with id {session_id}"))?;

    let channel_guard = session.channel.lock().await;
    let channel = channel_guard
        .as_ref()
        .ok_or_else(|| "Channel closed".to_string())?;

    channel
        .window_change(cols, rows, 0, 0)
        .await
        .map_err(|e| format!("Resize failed: {e}"))?;

    Ok(())
}
