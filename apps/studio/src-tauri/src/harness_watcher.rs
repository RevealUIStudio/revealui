//! Background watcher that polls the harness daemon and emits Tauri events
//! when state changes. Replaces client-side polling with push-based updates.
//!
//! Events emitted:
//!   `harness:state`  — full state snapshot (sessions, tasks, reservations, connected)
//!   `harness:mail`   — inbox messages for a specific agent

use crate::commands::harness::{HarnessMessage, HarnessReservation, HarnessSession, HarnessTask};
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::time;

/// Full daemon state snapshot emitted on `harness:state`.
#[derive(Clone, Serialize)]
pub struct HarnessStateEvent {
    pub connected: bool,
    pub sessions: Vec<HarnessSession>,
    pub tasks: Vec<HarnessTask>,
    pub reservations: Vec<HarnessReservation>,
}

/// Inbox snapshot emitted on `harness:mail`.
#[derive(Clone, Serialize)]
pub struct HarnessMailEvent {
    pub messages: Vec<HarnessMessage>,
}

/// Poll interval — 2 seconds is responsive enough for a local daemon.
const POLL_INTERVAL: Duration = Duration::from_secs(2);

/// Retry delay when the daemon is unreachable.
const RETRY_DELAY: Duration = Duration::from_secs(5);

/// Start the background watcher. Call once during app setup.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last_state_hash: u64 = 0;
        let mut last_mail_hash: u64 = 0;
        let mut was_connected = false;

        loop {
            // Check daemon health
            let connected =
                crate::harness::rpc_call("ping", serde_json::json!({}))
                    .await
                    .is_ok();

            if !connected {
                // Emit disconnected state only on transition
                if was_connected {
                    let _ = app.emit(
                        "harness:state",
                        HarnessStateEvent {
                            connected: false,
                            sessions: vec![],
                            tasks: vec![],
                            reservations: vec![],
                        },
                    );
                    was_connected = false;
                    last_state_hash = 0;
                    last_mail_hash = 0;
                }
                time::sleep(RETRY_DELAY).await;
                continue;
            }

            was_connected = true;

            // Fetch state in parallel
            let (sessions_result, tasks_result, reservations_result) = tokio::join!(
                crate::harness::rpc_call("session.list", serde_json::json!({})),
                crate::harness::rpc_call("tasks.list", serde_json::json!({})),
                // List reservations for all agents — use a known sentinel to get all
                crate::harness::rpc_call("files.list", serde_json::json!({ "agentId": "__all__" })),
            );

            let sessions: Vec<HarnessSession> = sessions_result
                .ok()
                .and_then(|v| serde_json::from_value(v).ok())
                .unwrap_or_default();

            let tasks: Vec<HarnessTask> = tasks_result
                .ok()
                .and_then(|v| serde_json::from_value(v).ok())
                .unwrap_or_default();

            let reservations: Vec<HarnessReservation> = reservations_result
                .ok()
                .and_then(|v| serde_json::from_value(v).ok())
                .unwrap_or_default();

            // Hash current state to detect changes
            let state_json = serde_json::to_string(&(&sessions, &tasks, &reservations))
                .unwrap_or_default();
            let state_hash = hash_string(&state_json);

            if state_hash != last_state_hash {
                last_state_hash = state_hash;
                let _ = app.emit(
                    "harness:state",
                    HarnessStateEvent {
                        connected: true,
                        sessions,
                        tasks,
                        reservations,
                    },
                );
            }

            // Fetch inbox for studio agent (unread only)
            if let Ok(mail_result) = crate::harness::rpc_call(
                "mail.inbox",
                serde_json::json!({ "agentId": "studio", "unreadOnly": false }),
            )
            .await
            {
                let messages: Vec<HarnessMessage> =
                    serde_json::from_value(mail_result).unwrap_or_default();
                let mail_json = serde_json::to_string(&messages).unwrap_or_default();
                let mail_hash = hash_string(&mail_json);

                if mail_hash != last_mail_hash {
                    last_mail_hash = mail_hash;
                    let _ = app.emit("harness:mail", HarnessMailEvent { messages });
                }
            }

            time::sleep(POLL_INTERVAL).await;
        }
    });
}

fn hash_string(s: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}
