use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use russh::keys::key;
use russh::{ChannelId, ChannelMsg, client};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::Mutex;

/// Authentication method for SSH connections.
#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "method")]
pub enum SshAuth {
    #[serde(rename = "password")]
    Password { password: String },
    #[serde(rename = "key")]
    Key {
        key_path: String,
        passphrase: Option<String>,
    },
}

/// Event payload sent from backend to frontend with terminal output.
#[derive(Clone, Serialize)]
pub struct SshOutputEvent {
    pub session_id: String,
    pub data: String, // base64-encoded bytes
}

/// Event payload for session disconnect notifications.
#[derive(Clone, Serialize)]
pub struct SshDisconnectEvent {
    pub session_id: String,
    pub reason: String,
}

/// Holds a single SSH session's handle and channel.
pub struct SshSession {
    pub handle: client::Handle<SshClientHandler>,
    pub channel: Arc<Mutex<Option<russh::Channel<client::Msg>>>>,
}

/// Managed Tauri state for SSH sessions.
pub struct SshState {
    pub sessions: Arc<Mutex<HashMap<String, SshSession>>>,
}

impl Default for SshState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

/// russh client handler — receives data from the SSH server and emits it to the frontend.
pub struct SshClientHandler {
    pub app_handle: tauri::AppHandle,
    pub session_id: String,
}

#[async_trait::async_trait]
impl client::Handler for SshClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Accept all host keys for now.
        // TODO: implement known_hosts verification UI
        Ok(true)
    }

    async fn data(
        &mut self,
        _channel: ChannelId,
        data: &[u8],
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        let encoded = BASE64.encode(data);
        let _ = self.app_handle.emit(
            "ssh_output",
            SshOutputEvent {
                session_id: self.session_id.clone(),
                data: encoded,
            },
        );
        Ok(())
    }
}

/// Connect to an SSH server, open a PTY and shell. Returns session ID.
pub async fn connect(
    host: String,
    port: u16,
    username: String,
    auth: SshAuth,
    app_handle: tauri::AppHandle,
    ssh_state: Arc<Mutex<HashMap<String, SshSession>>>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();

    let config = Arc::new(client::Config::default());

    let handler = SshClientHandler {
        app_handle: app_handle.clone(),
        session_id: session_id.clone(),
    };

    let mut handle = client::connect(config, (host.as_str(), port), handler)
        .await
        .map_err(|e| format!("SSH connection failed: {e}"))?;

    match &auth {
        SshAuth::Password { password } => {
            let auth_ok = handle
                .authenticate_password(&username, password)
                .await
                .map_err(|e| format!("SSH auth error: {e}"))?;
            if !auth_ok {
                return Err("Authentication failed: invalid credentials".to_string());
            }
        }
        SshAuth::Key {
            key_path,
            passphrase,
        } => {
            let path = Path::new(key_path);
            if !path.exists() {
                return Err(format!("Key file not found: {key_path}"));
            }
            let key_pair = russh_keys::load_secret_key(path, passphrase.as_deref())
                .map_err(|e| format!("Failed to load key: {e}"))?;
            let auth_ok = handle
                .authenticate_publickey(&username, Arc::new(key_pair))
                .await
                .map_err(|e| format!("SSH key auth error: {e}"))?;
            if !auth_ok {
                return Err("Authentication failed: key rejected by server".to_string());
            }
        }
    }

    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {e}"))?;

    channel
        .request_pty(false, "xterm-256color", 80, 24, 0, 0, &[])
        .await
        .map_err(|e| format!("PTY request failed: {e}"))?;

    channel
        .request_shell(false)
        .await
        .map_err(|e| format!("Shell request failed: {e}"))?;

    let channel = Arc::new(Mutex::new(Some(channel)));

    // Spawn a task to poll channel output and emit events.
    let sid = session_id.clone();
    let ah = app_handle.clone();
    let state_clone = ssh_state.clone();
    let channel_clone = channel.clone();
    tokio::spawn(async move {
        loop {
            // Lock briefly to call wait(), then release
            let msg = {
                let mut guard = channel_clone.lock().await;
                match guard.as_mut() {
                    Some(ch) => ch.wait().await,
                    None => break,
                }
            };

            match msg {
                Some(ChannelMsg::Data { data }) => {
                    let encoded = BASE64.encode(&*data);
                    let _ = ah.emit(
                        "ssh_output",
                        SshOutputEvent {
                            session_id: sid.clone(),
                            data: encoded,
                        },
                    );
                }
                Some(ChannelMsg::ExtendedData { data, .. }) => {
                    let encoded = BASE64.encode(&*data);
                    let _ = ah.emit(
                        "ssh_output",
                        SshOutputEvent {
                            session_id: sid.clone(),
                            data: encoded,
                        },
                    );
                }
                Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                    let _ = ah.emit(
                        "ssh_disconnect",
                        SshDisconnectEvent {
                            session_id: sid.clone(),
                            reason: "Connection closed by server".to_string(),
                        },
                    );
                    break;
                }
                _ => {}
            }
        }

        // Clean up session from state
        let mut sessions = state_clone.lock().await;
        sessions.remove(&sid);
    });

    // Store session
    let mut sessions = ssh_state.lock().await;
    sessions.insert(
        session_id.clone(),
        SshSession {
            handle,
            channel,
        },
    );

    Ok(session_id)
}
