#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WSL2 lacks full GPU passthrough for WebKitGTK — force software rendering
    // to avoid "Could not create default EGL display" abort.
    // Must be set before any GTK/WebKit initialization.
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WSL_DISTRO_NAME").is_ok() {
            // Disable DMA-BUF renderer (primary fix for WSL2 EGL crash)
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            // Force software compositing as fallback
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            // Disable GPU process to prevent sandbox EGL issues
            std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
        }
    }

    studio_lib::run();
}
