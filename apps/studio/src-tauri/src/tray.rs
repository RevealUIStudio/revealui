use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

use crate::state::AppState;

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app)?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("RevealUI Studio")
        .menu(&menu)
        // Right-click opens menu; left-click focuses the window.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu_event(app, event))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                    // Tell the frontend to navigate to the tile gallery
                    let _ = win.emit("navigate", "gallery");
                }
            }
        })
        .build(app)?;

    // Hide to tray when the user clicks the window's X button.
    // The only way to fully quit is via the tray "Quit" menu item.
    if let Some(win) = app.get_webview_window("main") {
        let win_clone = win.clone();
        win.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = win_clone.hide();
            }
        });
    }

    Ok(())
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let show = MenuItem::with_id(app, "show", "Show RevealUI Studio", true, None::<&str>)?;
    let launcher = MenuItem::with_id(
        app,
        "launcher",
        "Open Launcher",
        true,
        Some("CmdOrCtrl+Shift+L"),
    )?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let mount = MenuItem::with_id(app, "mount", "Mount Studio Drive", true, None::<&str>)?;
    let unmount =
        MenuItem::with_id(app, "unmount", "Unmount Studio Drive", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit RevealUI Studio", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[&show, &launcher, &sep1, &mount, &unmount, &sep2, &quit],
    )
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        "show" => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
        "mount" => {
            let app = app.clone();
            std::thread::spawn(move || {
                let state = app.state::<AppState>();
                let result = state
                    .platform
                    .lock()
                    .map_err(|e| e.to_string())
                    .and_then(|p| p.mount_devbox());
                match result {
                    Ok(msg) => eprintln!("[studio] mount: {msg}"),
                    Err(e) => eprintln!("[studio] mount error: {e}"),
                }
            });
        }
        "unmount" => {
            let app = app.clone();
            std::thread::spawn(move || {
                let state = app.state::<AppState>();
                let result = state
                    .platform
                    .lock()
                    .map_err(|e| e.to_string())
                    .and_then(|p| p.unmount_devbox());
                match result {
                    Ok(msg) => eprintln!("[studio] unmount: {msg}"),
                    Err(e) => eprintln!("[studio] unmount error: {e}"),
                }
            });
        }
        "launcher" => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
                let _ = win.emit("navigate", "gallery");
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}
