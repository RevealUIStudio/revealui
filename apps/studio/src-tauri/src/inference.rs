use std::process::Command;

use serde::Serialize;
use ts_rs::TS;

// ── Types ───────────────────────────────────────────────────────────

/// Status of the Ollama server.
#[derive(Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct OllamaStatus {
    pub installed: bool,
    pub running: bool,
    pub version: Option<String>,
}

/// An Ollama model available locally.
#[derive(Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct OllamaModel {
    pub name: String,
    pub size: String,
    pub modified: String,
}

/// Result of pulling a model.
#[derive(Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct ModelPullResult {
    pub success: bool,
    pub message: String,
}

// ── Ollama ──────────────────────────────────────────────────────────

/// Check if Ollama is installed and running.
pub fn ollama_status() -> OllamaStatus {
    // Check if ollama binary exists
    let installed = Command::new("which")
        .arg("ollama")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !installed {
        return OllamaStatus {
            installed: false,
            running: false,
            version: None,
        };
    }

    // Get version
    let version = Command::new("ollama")
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout).ok().map(|s| s.trim().to_string())
            } else {
                None
            }
        });

    // Check if running by listing models (succeeds only when server is up)
    let running = Command::new("ollama")
        .arg("list")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    OllamaStatus {
        installed,
        running,
        version,
    }
}

/// List locally available Ollama models.
pub fn ollama_list_models() -> Result<Vec<OllamaModel>, String> {
    let output = Command::new("ollama")
        .arg("list")
        .output()
        .map_err(|e| format!("Failed to run ollama list: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ollama list failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let models: Vec<OllamaModel> = stdout
        .lines()
        .skip(1) // Skip header row
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                Some(OllamaModel {
                    name: parts[0].to_string(),
                    size: parts.get(2).unwrap_or(&"").to_string(),
                    modified: parts[3..].join(" "),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(models)
}

/// Pull (download) an Ollama model.
pub fn ollama_pull(model_name: &str) -> Result<ModelPullResult, String> {
    let output = Command::new("ollama")
        .arg("pull")
        .arg(model_name)
        .output()
        .map_err(|e| format!("Failed to run ollama pull: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(ModelPullResult {
            success: true,
            message: if stdout.is_empty() { stderr } else { stdout },
        })
    } else {
        Ok(ModelPullResult {
            success: false,
            message: stderr,
        })
    }
}

/// Delete a locally downloaded Ollama model.
pub fn ollama_delete(model_name: &str) -> Result<(), String> {
    let output = Command::new("ollama")
        .arg("rm")
        .arg(model_name)
        .output()
        .map_err(|e| format!("Failed to run ollama rm: {e}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("ollama rm failed: {stderr}"))
    }
}

/// Start the Ollama server in the background.
pub fn ollama_start() -> Result<(), String> {
    Command::new("ollama")
        .arg("serve")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start ollama serve: {e}"))?;

    Ok(())
}

/// Stop the Ollama server.
pub fn ollama_stop() -> Result<(), String> {
    // Ollama doesn't have a built-in stop command, use pkill
    let output = Command::new("pkill")
        .arg("-f")
        .arg("ollama serve")
        .output()
        .map_err(|e| format!("Failed to stop ollama: {e}"))?;

    if output.status.success() || output.status.code() == Some(1) {
        // code 1 = no processes matched, which is fine
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("pkill failed: {stderr}"))
    }
}

// ── Inference Snaps ─────────────────────────────────────────────────

/// Status of a Canonical inference snap.
#[derive(Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SnapStatus {
    pub installed: bool,
    pub running: bool,
    pub snap_name: String,
    pub endpoint: Option<String>,
    pub version: Option<String>,
}

/// An available inference snap model.
#[derive(Clone, Serialize, TS)]
#[ts(export, export_to = "bindings/")]
pub struct SnapModel {
    pub name: String,
    pub description: String,
    pub installed: bool,
}

/// Known inference snaps from Canonical.
const KNOWN_SNAPS: &[(&str, &str)] = &[
    ("nemotron-3-nano", "General (reasoning + non-reasoning) — free tier default"),
    ("gemma3", "General + vision — image understanding, multimodal"),
    ("deepseek-r1", "Reasoning — complex analysis, chain-of-thought"),
    ("qwen-vl", "Vision-language — document parsing, visual Q&A"),
];

/// Check if a specific inference snap is installed and running.
pub fn snap_status(snap_name: &str) -> SnapStatus {
    // Check if the snap is installed
    let installed = Command::new("snap")
        .args(["list", snap_name])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !installed {
        return SnapStatus {
            installed: false,
            running: false,
            snap_name: snap_name.to_string(),
            endpoint: None,
            version: None,
        };
    }

    // Get version from snap list output
    let version = Command::new("snap")
        .args(["list", snap_name])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let stdout = String::from_utf8_lossy(&o.stdout).to_string();
                // Second line, second column is the version
                stdout.lines().nth(1).and_then(|line| {
                    line.split_whitespace().nth(1).map(|v| v.to_string())
                })
            } else {
                None
            }
        });

    // Check if the snap's HTTP endpoint is responding
    let endpoint = format!("http://localhost:9090/v1");
    let running = Command::new(snap_name)
        .arg("status")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    SnapStatus {
        installed,
        running,
        snap_name: snap_name.to_string(),
        endpoint: if running { Some(endpoint) } else { None },
        version,
    }
}

/// List all known inference snaps with their install status.
pub fn snap_list_models() -> Vec<SnapModel> {
    KNOWN_SNAPS
        .iter()
        .map(|(name, desc)| {
            let installed = Command::new("snap")
                .args(["list", name])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);
            SnapModel {
                name: name.to_string(),
                description: desc.to_string(),
                installed,
            }
        })
        .collect()
}

/// Install an inference snap.
pub fn snap_install(snap_name: &str) -> Result<ModelPullResult, String> {
    // Validate the snap name is one of our known snaps
    if !KNOWN_SNAPS.iter().any(|(name, _)| *name == snap_name) {
        return Err(format!("Unknown inference snap: {snap_name}"));
    }

    let output = Command::new("sudo")
        .args(["snap", "install", snap_name])
        .output()
        .map_err(|e| format!("Failed to run snap install: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(ModelPullResult {
            success: true,
            message: if stdout.is_empty() { stderr } else { stdout },
        })
    } else {
        Ok(ModelPullResult {
            success: false,
            message: stderr,
        })
    }
}

/// Remove an inference snap.
pub fn snap_remove(snap_name: &str) -> Result<(), String> {
    let output = Command::new("sudo")
        .args(["snap", "remove", snap_name])
        .output()
        .map_err(|e| format!("Failed to run snap remove: {e}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("snap remove failed: {stderr}"))
    }
}

