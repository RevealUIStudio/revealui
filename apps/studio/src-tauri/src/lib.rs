mod commands;
mod platform;
mod ssh;
mod state;
mod tray;

use commands::{apps, mount, setup, ssh as ssh_cmds, status, sync, tunnel, vault};
use ssh::SshState;
use state::AppState;

pub fn run() {
    let platform = platform::create_platform();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new(platform))
        .manage(SshState::default())
        .setup(|app| {
            tray::setup_tray(&app.handle())?;
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
            ssh_cmds::ssh_connect,
            ssh_cmds::ssh_disconnect,
            ssh_cmds::ssh_send,
            ssh_cmds::ssh_resize,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RevealUI Studio");
}
