mod commands;
mod platform;
mod state;

use commands::{apps, mount, setup, status, sync};
use state::AppState;

pub fn run() {
    let platform = platform::create_platform();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new(platform))
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running RevealUI Studio");
}
