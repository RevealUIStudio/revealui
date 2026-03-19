#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Search the Nix store for Mesa's EGL vendor JSON file.
/// Returns the path to `50_mesa.json` which tells libglvnd where to find
/// `libEGL_mesa.so.0`. This is needed because WebKitGTK's subprocess
/// RPATH doesn't include the Nix Mesa store path.
#[cfg(target_os = "linux")]
fn find_nix_mesa_egl_vendor() -> Result<String, ()> {
    let nix_store = std::path::Path::new("/nix/store");
    if !nix_store.exists() {
        return Err(());
    }
    if let Ok(entries) = std::fs::read_dir(nix_store) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.contains("mesa-") && !name_str.contains("-dev") {
                let vendor_json = entry
                    .path()
                    .join("share/glvnd/egl_vendor.d/50_mesa.json");
                if vendor_json.exists() {
                    return Ok(vendor_json.to_string_lossy().into_owned());
                }
            }
        }
    }
    Err(())
}

fn main() {
    // WSL2 lacks full GPU passthrough for WebKitGTK — force software rendering
    // to avoid "Could not create default EGL display" abort.
    // Must be set before any GTK/WebKit initialization.
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WSL_DISTRO_NAME").is_ok() {
            // WSLg advertises Wayland, but its EGL stack only works on the X11
            // platform. Without these overrides WebKitGTK's GPU process calls
            // eglGetDisplay(EGL_DEFAULT_DISPLAY) which resolves to GBM and aborts
            // with "Could not create default EGL display".
            //
            // Root cause: Nix-built WebKitWebProcess subprocess can't find
            // libEGL_mesa.so.0 because the Nix Mesa store path isn't in its
            // RPATH. We tell libglvnd's EGL dispatch where to find the Mesa
            // vendor library via __EGL_VENDOR_LIBRARY_FILENAMES.
            std::env::set_var("GDK_BACKEND", "x11");
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

            // Point libglvnd EGL dispatch to Nix Mesa's vendor JSON so the
            // WebKitWebProcess subprocess can resolve libEGL_mesa.so.0.
            // Without this, the subprocess searches RPATH (which lacks Mesa)
            // and aborts with "Could not create default EGL display".
            if let Ok(mesa_egl_json) = find_nix_mesa_egl_vendor() {
                std::env::set_var("__EGL_VENDOR_LIBRARY_FILENAMES", mesa_egl_json);
            }
        }
    }

    studio_lib::run();
}
