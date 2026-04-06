use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use ts_rs::TS;

// ── Event payloads ──────────────────────────────────────────────────

/// Streamed output from an agent process (stdout or stderr).
#[derive(Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct AgentOutputEvent {
    pub session_id: String,
    pub stream: String, // "stdout" | "stderr"
    pub line: String,
}

/// Emitted when an agent process exits.
#[derive(Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct AgentExitEvent {
    pub session_id: String,
    pub code: Option<i32>,
}

/// Backend for the agent — which inference engine to use.
#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
pub enum AgentBackend {
    /// Ubuntu Inference Snap (recommended — one command install)
    Snap,
    /// BitNet 1-bit inference (local CPU, no GPU required)
    BitNet,
    /// Ollama local inference (any supported model)
    Ollama,
}

/// Serializable snapshot of one agent session.
#[derive(Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct AgentSessionInfo {
    pub id: String,
    pub name: String,
    pub model: String,
    pub backend: AgentBackend,
    pub prompt: String,
    pub status: String, // "running" | "stopped" | "errored"
    pub pid: Option<u32>,
}

// ── State ───────────────────────────────────────────────────────────

pub struct AgentProcess {
    pub name: String,
    pub model: String,
    pub backend: AgentBackend,
    pub prompt: String,
    pub child: Child,
    pub status: String,
}

/// Managed Tauri state for spawned agent sessions.
pub struct SpawnerState {
    pub sessions: Arc<Mutex<HashMap<String, AgentProcess>>>,
}

impl Default for SpawnerState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// ── Core logic ──────────────────────────────────────────────────────

/// Spawn an agent process using local inference (BitNet or Ollama).
/// Returns the session ID.
pub fn spawn(
    name: String,
    backend: AgentBackend,
    model: String,
    prompt: String,
    app_handle: tauri::AppHandle,
    state: Arc<Mutex<HashMap<String, AgentProcess>>>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();

    let mut cmd = match &backend {
        AgentBackend::Snap => {
            // Inference snaps expose an OpenAI-compatible API at localhost:9090
            // Use curl to send a chat completion request
            let mut c = Command::new("curl");
            c.arg("-s");
            c.arg("-X");
            c.arg("POST");
            c.arg("http://localhost:9090/v1/chat/completions");
            c.arg("-H");
            c.arg("Content-Type: application/json");
            c.arg("-d");
            c.arg(format!(
                r#"{{"model":"{}","messages":[{{"role":"user","content":"{}"}}],"stream":false}}"#,
                model,
                prompt.replace('"', "\\\""),
            ));
            c
        }
        AgentBackend::Ollama => {
            let mut c = Command::new("ollama");
            c.arg("run");
            c.arg(&model);
            c.arg(&prompt);
            c
        }
        AgentBackend::BitNet => {
            let mut c = Command::new("bitnet");
            c.arg("run");
            c.arg("--model");
            c.arg(&model);
            c.arg("--prompt");
            c.arg(&prompt);
            c
        }
    };

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd.stdin(Stdio::null());

    let binary_name = match &backend {
        AgentBackend::Snap => "snap-inference",
        AgentBackend::Ollama => "ollama",
        AgentBackend::BitNet => "bitnet",
    };

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn {binary_name}: {e}"))?;

    // Take stdout and stderr handles before storing child
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    // Store session
    {
        let mut sessions = state.lock().map_err(|e| format!("Lock poisoned: {e}"))?;
        sessions.insert(
            session_id.clone(),
            AgentProcess {
                name: name.clone(),
                model: model.clone(),
                backend: backend.clone(),
                prompt: prompt.clone(),
                child,
                status: "running".to_string(),
            },
        );
    }

    // Spawn stdout reader thread
    let sid_out = session_id.clone();
    let handle_out = app_handle.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    let _ = handle_out.emit(
                        "agent_output",
                        AgentOutputEvent {
                            session_id: sid_out.clone(),
                            stream: "stdout".to_string(),
                            line: text,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Spawn stderr reader thread
    let sid_err = session_id.clone();
    let handle_err = app_handle.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    let _ = handle_err.emit(
                        "agent_output",
                        AgentOutputEvent {
                            session_id: sid_err.clone(),
                            stream: "stderr".to_string(),
                            line: text,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    // Spawn wait thread — detects process exit and updates state
    let sid_wait = session_id.clone();
    let state_wait = state.clone();
    std::thread::spawn(move || {
        // Wait for the child process to exit
        let exit_code = if let Ok(mut sessions) = state_wait.lock() {
            if let Some(proc) = sessions.get_mut(&sid_wait) {
                match proc.child.wait() {
                    Ok(status) => {
                        proc.status = if status.success() {
                            "stopped".to_string()
                        } else {
                            "errored".to_string()
                        };
                        status.code()
                    }
                    Err(_) => {
                        proc.status = "errored".to_string();
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        };

        let _ = app_handle.emit(
            "agent_exit",
            AgentExitEvent {
                session_id: sid_wait,
                code: exit_code,
            },
        );
    });

    Ok(session_id)
}

/// Stop a running agent process.
pub fn stop(
    session_id: &str,
    state: Arc<Mutex<HashMap<String, AgentProcess>>>,
) -> Result<(), String> {
    let mut sessions = state.lock().map_err(|e| format!("Lock poisoned: {e}"))?;
    if let Some(proc) = sessions.get_mut(session_id) {
        proc.child
            .kill()
            .map_err(|e| format!("Failed to kill agent: {e}"))?;
        proc.status = "stopped".to_string();
        Ok(())
    } else {
        Err(format!("No agent session with id {session_id}"))
    }
}

/// List all agent sessions with their current status.
pub fn list(
    state: Arc<Mutex<HashMap<String, AgentProcess>>>,
) -> Result<Vec<AgentSessionInfo>, String> {
    let sessions = state.lock().map_err(|e| format!("Lock poisoned: {e}"))?;
    let list: Vec<AgentSessionInfo> = sessions
        .iter()
        .map(|(id, proc)| AgentSessionInfo {
            id: id.clone(),
            name: proc.name.clone(),
            model: proc.model.clone(),
            backend: proc.backend.clone(),
            prompt: proc.prompt.clone(),
            status: proc.status.clone(),
            pid: None,
        })
        .collect();
    Ok(list)
}

/// Remove a stopped/errored session from the session map.
pub fn remove(
    session_id: &str,
    state: Arc<Mutex<HashMap<String, AgentProcess>>>,
) -> Result<(), String> {
    let mut sessions = state.lock().map_err(|e| format!("Lock poisoned: {e}"))?;
    if let Some(proc) = sessions.get(session_id) {
        if proc.status == "running" {
            return Err("Cannot remove a running agent — stop it first".to_string());
        }
    }
    sessions
        .remove(session_id)
        .ok_or_else(|| format!("No agent session with id {session_id}"))?;
    Ok(())
}
