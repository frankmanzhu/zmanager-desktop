#[cfg(target_os = "windows")]
mod windows;

#[cfg(not(target_os = "windows"))]
mod linux;

pub struct PlatformProfile {
    pub platform: &'static str,
    pub explorer_integration_enabled: bool,
    pub desktop_actions_enabled: bool,
    pub associated_extensions: &'static [&'static str],
}

#[cfg(target_os = "windows")]
pub use windows::register_platform_services;

#[cfg(not(target_os = "windows"))]
pub use linux::register_platform_services;

#[cfg(target_os = "windows")]
pub fn integration_profile() -> PlatformProfile {
    PlatformProfile {
        platform: windows::PLATFORM_NAME,
        explorer_integration_enabled: windows::is_explorer_integration_enabled(),
        desktop_actions_enabled: windows::is_desktop_actions_enabled(),
        associated_extensions: windows::associated_extensions(),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn integration_profile() -> PlatformProfile {
    PlatformProfile {
        platform: linux::PLATFORM_NAME,
        explorer_integration_enabled: linux::is_explorer_integration_enabled(),
        desktop_actions_enabled: linux::is_desktop_actions_enabled(),
        associated_extensions: linux::associated_extensions(),
    }
}
