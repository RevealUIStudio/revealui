//! Tauri commands for the RevDev Harness daemon.
//!
//! Each command delegates to [`crate::harness::rpc_call`] which speaks
//! JSON-RPC 2.0 over the daemon's Unix socket.

use super::error::StudioError;
use crate::harness;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

// ── Types mirroring the daemon's PGlite schema ─────────────────────────────

#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct HarnessSession {
    pub id: String,
    pub env: String,
    pub task: String,
    pub files: Option<String>,
    pub pid: Option<i64>,
    pub started_at: String,
    pub updated_at: String,
    pub ended_at: Option<String>,
    pub exit_summary: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct HarnessMessage {
    pub id: i64,
    pub from_agent: String,
    pub to_agent: String,
    pub subject: String,
    pub body: String,
    pub read: bool,
    pub created_at: String,
}

#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct HarnessTask {
    pub id: String,
    pub description: String,
    pub status: String,
    pub owner: Option<String>,
    pub claimed_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct HarnessReservation {
    pub file_path: String,
    pub agent_id: String,
    pub reserved_at: String,
    pub expires_at: String,
    pub reason: String,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct HarnessClaimResult {
    pub success: bool,
    pub owner: Option<String>,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct HarnessReserveResult {
    pub success: bool,
    pub holder: Option<String>,
}

// ── Daemon health ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn harness_ping() -> Result<bool, StudioError> {
    match harness::rpc_call("ping", serde_json::json!({})).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

// ── Sessions ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn harness_sessions() -> Result<Vec<HarnessSession>, StudioError> {
    let result = harness::rpc_call("session.list", serde_json::json!({}))
        .await
        .map_err(|e| StudioError::Other(e))?;
    serde_json::from_value(result).map_err(|e| StudioError::Other(e.to_string()))
}

// ── Messages ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn harness_inbox(
    agent_id: String,
    unread_only: bool,
) -> Result<Vec<HarnessMessage>, StudioError> {
    let result = harness::rpc_call(
        "mail.inbox",
        serde_json::json!({ "agentId": agent_id, "unreadOnly": unread_only }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    serde_json::from_value(result).map_err(|e| StudioError::Other(e.to_string()))
}

#[tauri::command]
pub async fn harness_send_message(
    from_agent: String,
    to_agent: String,
    subject: String,
    body: String,
) -> Result<HarnessMessage, StudioError> {
    let result = harness::rpc_call(
        "mail.send",
        serde_json::json!({
            "fromAgent": from_agent,
            "toAgent": to_agent,
            "subject": subject,
            "body": body,
        }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    serde_json::from_value(result).map_err(|e| StudioError::Other(e.to_string()))
}

#[tauri::command]
pub async fn harness_broadcast(
    from_agent: String,
    subject: String,
    body: String,
) -> Result<i64, StudioError> {
    let result = harness::rpc_call(
        "mail.broadcast",
        serde_json::json!({
            "fromAgent": from_agent,
            "subject": subject,
            "body": body,
        }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;

    // Returns { sent: number }
    let sent = result
        .get("sent")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    Ok(sent)
}

#[tauri::command]
pub async fn harness_mark_read(message_ids: Vec<i64>) -> Result<(), StudioError> {
    harness::rpc_call(
        "mail.markRead",
        serde_json::json!({ "messageIds": message_ids }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    Ok(())
}

// ── Tasks ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn harness_tasks(
    status: Option<String>,
    owner: Option<String>,
) -> Result<Vec<HarnessTask>, StudioError> {
    let mut params = serde_json::Map::new();
    if let Some(s) = status {
        params.insert("status".into(), serde_json::Value::String(s));
    }
    if let Some(o) = owner {
        params.insert("owner".into(), serde_json::Value::String(o));
    }
    let result = harness::rpc_call("tasks.list", serde_json::Value::Object(params))
        .await
        .map_err(|e| StudioError::Other(e))?;
    serde_json::from_value(result).map_err(|e| StudioError::Other(e.to_string()))
}

#[tauri::command]
pub async fn harness_create_task(
    task_id: String,
    description: String,
) -> Result<HarnessTask, StudioError> {
    let result = harness::rpc_call(
        "tasks.create",
        serde_json::json!({ "taskId": task_id, "description": description }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    serde_json::from_value(result).map_err(|e| StudioError::Other(e.to_string()))
}

#[tauri::command]
pub async fn harness_claim_task(
    task_id: String,
    agent_id: String,
) -> Result<HarnessClaimResult, StudioError> {
    let result = harness::rpc_call(
        "tasks.claim",
        serde_json::json!({ "taskId": task_id, "agentId": agent_id }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    serde_json::from_value(result).map_err(|e| StudioError::Other(e.to_string()))
}

#[tauri::command]
pub async fn harness_complete_task(
    task_id: String,
    agent_id: String,
) -> Result<bool, StudioError> {
    let result = harness::rpc_call(
        "tasks.complete",
        serde_json::json!({ "taskId": task_id, "agentId": agent_id }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    Ok(result.get("ok").and_then(|v| v.as_bool()).unwrap_or(false))
}

#[tauri::command]
pub async fn harness_release_task(
    task_id: String,
    agent_id: String,
) -> Result<bool, StudioError> {
    let result = harness::rpc_call(
        "tasks.release",
        serde_json::json!({ "taskId": task_id, "agentId": agent_id }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    Ok(result.get("ok").and_then(|v| v.as_bool()).unwrap_or(false))
}

// ── File Reservations ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn harness_reservations(
    agent_id: Option<String>,
) -> Result<Vec<HarnessReservation>, StudioError> {
    let params = match agent_id {
        Some(id) => serde_json::json!({ "agentId": id }),
        None => serde_json::json!({}),
    };
    // files.list requires agentId — if none given, list for all via session.list then merge
    let result = harness::rpc_call("files.list", params)
        .await
        .map_err(|e| StudioError::Other(e))?;
    serde_json::from_value(result).map_err(|e| StudioError::Other(e.to_string()))
}

#[tauri::command]
pub async fn harness_reserve_file(
    file_path: String,
    agent_id: String,
    ttl_seconds: u32,
    reason: String,
) -> Result<HarnessReserveResult, StudioError> {
    let result = harness::rpc_call(
        "files.reserve",
        serde_json::json!({
            "filePath": file_path,
            "agentId": agent_id,
            "ttlSeconds": ttl_seconds,
            "reason": reason,
        }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    serde_json::from_value(result).map_err(|e| StudioError::Other(e.to_string()))
}

#[tauri::command]
pub async fn harness_check_file(
    file_path: String,
) -> Result<Option<HarnessReservation>, StudioError> {
    let result = harness::rpc_call(
        "files.check",
        serde_json::json!({ "filePath": file_path }),
    )
    .await
    .map_err(|e| StudioError::Other(e))?;
    if result.is_null() {
        return Ok(None);
    }
    serde_json::from_value(result)
        .map(Some)
        .map_err(|e| StudioError::Other(e.to_string()))
}
