#[cfg(target_os = "windows")]
mod windows;

#[cfg(not(target_os = "windows"))]
mod linux;

#[cfg(target_os = "windows")]
pub use windows::register_platform_services;

#[cfg(not(target_os = "windows"))]
pub use linux::register_platform_services;
