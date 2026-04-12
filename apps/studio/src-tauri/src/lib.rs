mod commands;
mod config;
mod harness;
mod harness_watcher;
mod inference;
mod local_shell;
mod platform;
mod spawner;
mod ssh;
mod state;
mod tray;

use commands::{
    agent as agent_cmds, apps, config as config_cmds, deploy, git as git_cmds,
    harness as harness_cmds, inference as inference_cmds, launcher, local_shell as shell_cmds,
    mount, setup, spawner as spawner_cmds, ssh as ssh_cmds, status, sync, terminal, tunnel, vault,
};
use config::ConfigState;
use local_shell::LocalShellState;
use spawner::SpawnerState;
use ssh::SshState;
use state::AppState;
use tauri::{Emitter, Manager};

pub fn run() {
    let platform = platform::create_platform();

    // Global hotkey: Ctrl+Shift+L opens the tile gallery from anywhere.
    let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcut("CmdOrCtrl+Shift+L")
        .expect("failed to parse global shortcut")
        .with_handler(|app, _shortcut, _event| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
                let _ = win.emit("navigate", "gallery");
            }
        })
        .build();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(shortcut_plugin)
        .manage(AppState::new(platform))
        .manage(SshState::default())
        .manage(LocalShellState::default())
        .manage(SpawnerState::default())
        .manage(ConfigState::new())
        .setup(|app| {
            tray::setup_tray(&app.handle())?;
            harness_watcher::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            status::get_system_status,
            status::get_mount_status,
            mount::mount_devbox,
            mount::unmount_devbox,
            sync::sync_all_repos,
            sync::sync_repo,
            apps::list_apps,
            apps::start_app,
            apps::stop_app,
            apps::read_app_log,
            setup::check_setup,
            setup::set_git_identity,
            vault::vault_init,
            vault::vault_is_initialized,
            vault::vault_list,
            vault::vault_get,
            vault::vault_set,
            vault::vault_delete,
            vault::vault_search,
            vault::vault_copy,
            tunnel::get_tailscale_status,
            tunnel::tailscale_up,
            tunnel::tailscale_down,
            shell_cmds::shell_open,
            shell_cmds::shell_close,
            shell_cmds::shell_send,
            shell_cmds::shell_resize,
            ssh_cmds::ssh_connect,
            ssh_cmds::ssh_disconnect,
            ssh_cmds::ssh_send,
            ssh_cmds::ssh_resize,
            ssh_cmds::ssh_bookmark_list,
            ssh_cmds::ssh_bookmark_save,
            ssh_cmds::ssh_bookmark_delete,
            config_cmds::get_config,
            config_cmds::set_config,
            config_cmds::reset_config,
            deploy::secrets::generate_secret,
            deploy::secrets::generate_kek,
            deploy::secrets::generate_rsa_keypair,
            deploy::vercel::vercel_create_project,
            deploy::vercel::vercel_validate_token,
            deploy::vercel::vercel_validate_blob_token,
            deploy::vercel::vercel_set_env,
            deploy::vercel::vercel_deploy,
            deploy::vercel::vercel_get_deployment,
            deploy::database::neon_test_connection,
            deploy::database::run_db_migrate,
            deploy::database::run_db_seed,
            deploy::stripe::stripe_validate_keys,
            deploy::stripe::stripe_run_seed,
            deploy::stripe::stripe_run_keys,
            deploy::stripe::stripe_catalog_sync,
            deploy::email::gmail_send_test,
            deploy::email::resend_send_test,
            deploy::email::smtp_send_test,
            deploy::health::health_check,
            git_cmds::git_status,
            git_cmds::git_diff_file,
            git_cmds::git_stage_file,
            git_cmds::git_unstage_file,
            git_cmds::git_discard_file,
            git_cmds::git_commit,
            git_cmds::git_list_branches,
            git_cmds::git_create_branch,
            git_cmds::git_switch_branch,
            git_cmds::git_delete_branch,
            git_cmds::git_push,
            git_cmds::git_pull,
            git_cmds::git_log,
            git_cmds::git_read_file,
            git_cmds::git_write_file,
            git_cmds::git_diff_content,
            agent_cmds::agent_read_workboard,
            harness_cmds::harness_ping,
            harness_cmds::harness_sessions,
            harness_cmds::harness_inbox,
            harness_cmds::harness_send_message,
            harness_cmds::harness_broadcast,
            harness_cmds::harness_mark_read,
            harness_cmds::harness_tasks,
            harness_cmds::harness_create_task,
            harness_cmds::harness_claim_task,
            harness_cmds::harness_complete_task,
            harness_cmds::harness_release_task,
            harness_cmds::harness_reservations,
            harness_cmds::harness_reserve_file,
            harness_cmds::harness_check_file,
            spawner_cmds::agent_spawn,
            spawner_cmds::agent_stop,
            spawner_cmds::agent_list,
            spawner_cmds::agent_remove,
            spawner_cmds::agent_input,
            spawner_cmds::agent_resize,
            inference_cmds::inference_ollama_status,
            inference_cmds::inference_ollama_models,
            inference_cmds::inference_ollama_pull,
            inference_cmds::inference_ollama_delete,
            inference_cmds::inference_ollama_start,
            inference_cmds::inference_ollama_stop,
            inference_cmds::inference_snap_status,
            inference_cmds::inference_snap_list,
            inference_cmds::inference_snap_install,
            inference_cmds::inference_snap_remove,
            terminal::terminal_detect,
            terminal::terminal_install,
            launcher::focus_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RevealUI Studio");
}
