pub mod trait_defs;

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "linux")]
pub mod linux;

use trait_defs::PlatformOps;

/// Create the appropriate platform implementation for the current OS.
pub fn create_platform() -> Box<dyn PlatformOps + Send> {
    #[cfg(target_os = "windows")]
    {
        Box::new(windows::WindowsPlatform::new())
    }

    #[cfg(target_os = "macos")]
    {
        Box::new(macos::MacPlatform::new())
    }

    #[cfg(target_os = "linux")]
    {
        Box::new(linux::LinuxPlatform::new())
    }
}
