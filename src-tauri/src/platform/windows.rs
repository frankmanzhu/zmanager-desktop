use std::{ffi::OsStr, mem::size_of, os::windows::ffi::OsStrExt, ptr::null_mut, slice};

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use tauri::{Builder, Wry};
use windows_sys::Win32::{
    Graphics::Gdi::{
        BI_RGB, BITMAPINFO, BITMAPINFOHEADER, CreateCompatibleDC, CreateDIBSection, DIB_RGB_COLORS,
        DeleteDC, DeleteObject, GetDC, HBRUSH, HGDIOBJ, ReleaseDC, SelectObject,
    },
    Storage::FileSystem::{FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_NORMAL},
    UI::{
        Shell::{
            SHFILEINFOW, SHGFI_ICON, SHGFI_SMALLICON, SHGFI_USEFILEATTRIBUTES, SHGetFileInfoW,
        },
        WindowsAndMessaging::{DI_NORMAL, DestroyIcon, DrawIconEx, HICON},
    },
};

use super::ShellActionProfile;
use crate::dto::{SystemFileIconDto, SystemFileIconRequestEntry};

/// Windows-specific shell integration profile values.
pub const PLATFORM_NAME: &str = "windows";
pub const EXPLORER_ACTIONS_ENABLED: bool = true;

/// Archive extensions that map to Windows shell associations when enabled.
pub const EXPLORER_ASSOCIATED_EXTENSIONS: &[&str] = &[
    "zip", "zipx", "7z", "rar", "tar", "tar.gz", "tgz", "gz", "tar.xz", "txz", "xz", "tar.zst",
    "tzst", "zst", "tzap",
];

pub const EXPLORER_SHELL_ACTIONS: &[ShellActionProfile] = &[
    ShellActionProfile {
        label: "Compress using ZManager",
        quick_action: "compress",
    },
    ShellActionProfile {
        label: "Extract using ZManager",
        quick_action: "extract",
    },
];

pub fn is_explorer_integration_enabled() -> bool {
    EXPLORER_ACTIONS_ENABLED
}

pub fn associated_extensions() -> &'static [&'static str] {
    EXPLORER_ASSOCIATED_EXTENSIONS
}

pub fn shell_actions() -> &'static [ShellActionProfile] {
    EXPLORER_SHELL_ACTIONS
}

pub fn is_desktop_actions_enabled() -> bool {
    // Windows integration profile currently reserves explorer actions only.
    false
}

pub fn register_platform_services(builder: Builder<Wry>) -> Builder<Wry> {
    if is_explorer_integration_enabled() {
        let _ = associated_extensions();
    }

    builder
}

pub fn system_file_icons(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto> {
    entries
        .iter()
        .map(|entry| SystemFileIconDto {
            key: entry.key.clone(),
            data_url: system_file_icon_data_url(entry),
        })
        .collect()
}

fn system_file_icon_data_url(entry: &SystemFileIconRequestEntry) -> Option<String> {
    let lookup_path = if entry.is_directory {
        "folder"
    } else {
        entry.path.trim()
    };
    let lookup_path = if lookup_path.is_empty() {
        "file"
    } else {
        lookup_path
    };

    let wide_path = wide_null(lookup_path);
    let attributes = if entry.is_directory {
        FILE_ATTRIBUTE_DIRECTORY
    } else {
        FILE_ATTRIBUTE_NORMAL
    };
    let mut file_info = SHFILEINFOW::default();
    let result = unsafe {
        SHGetFileInfoW(
            wide_path.as_ptr(),
            attributes,
            &mut file_info,
            size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_SMALLICON | SHGFI_USEFILEATTRIBUTES,
        )
    };

    if result == 0 || file_info.hIcon.is_null() {
        return None;
    }

    let data_url = unsafe { hicon_to_png_data_url(file_info.hIcon) };
    unsafe {
        DestroyIcon(file_info.hIcon);
    }
    data_url
}

unsafe fn hicon_to_png_data_url(icon: HICON) -> Option<String> {
    const ICON_SIZE: i32 = 16;
    const BYTES_PER_PIXEL: usize = 4;

    let screen_dc = unsafe { GetDC(null_mut()) };
    if screen_dc.is_null() {
        return None;
    }

    let memory_dc = unsafe { CreateCompatibleDC(screen_dc) };
    if memory_dc.is_null() {
        unsafe {
            ReleaseDC(null_mut(), screen_dc);
        }
        return None;
    }

    let mut bitmap_info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: ICON_SIZE,
            biHeight: -ICON_SIZE,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB,
            biSizeImage: (ICON_SIZE * ICON_SIZE * BYTES_PER_PIXEL as i32) as u32,
            ..BITMAPINFOHEADER::default()
        },
        ..BITMAPINFO::default()
    };
    let mut bits = null_mut();
    let bitmap = unsafe {
        CreateDIBSection(
            screen_dc,
            &mut bitmap_info,
            DIB_RGB_COLORS,
            &mut bits,
            null_mut(),
            0,
        )
    };

    if bitmap.is_null() || bits.is_null() {
        unsafe {
            DeleteDC(memory_dc);
            ReleaseDC(null_mut(), screen_dc);
        }
        return None;
    }

    let previous_object = unsafe { SelectObject(memory_dc, bitmap as HGDIOBJ) };
    let drawn = unsafe {
        DrawIconEx(
            memory_dc,
            0,
            0,
            icon,
            ICON_SIZE,
            ICON_SIZE,
            0,
            null_mut::<HBRUSH__>() as HBRUSH,
            DI_NORMAL,
        )
    } != 0;

    let data_url = if drawn {
        let bgra = unsafe {
            slice::from_raw_parts(
                bits as *const u8,
                ICON_SIZE as usize * ICON_SIZE as usize * BYTES_PER_PIXEL,
            )
        };
        encode_bgra_png_data_url(bgra, ICON_SIZE as u32, ICON_SIZE as u32)
    } else {
        None
    };

    if !previous_object.is_null() {
        unsafe {
            SelectObject(memory_dc, previous_object);
        }
    }
    unsafe {
        DeleteObject(bitmap as HGDIOBJ);
        DeleteDC(memory_dc);
        ReleaseDC(null_mut(), screen_dc);
    }

    data_url
}

fn encode_bgra_png_data_url(bgra: &[u8], width: u32, height: u32) -> Option<String> {
    let mut rgba = Vec::with_capacity(bgra.len());
    let mut has_alpha = false;

    for pixel in bgra.chunks_exact(4) {
        let alpha = pixel[3];
        has_alpha |= alpha != 0;
        rgba.extend_from_slice(&[pixel[2], pixel[1], pixel[0], alpha]);
    }

    if !has_alpha {
        for pixel in rgba.chunks_exact_mut(4) {
            if pixel[0] != 0 || pixel[1] != 0 || pixel[2] != 0 {
                pixel[3] = u8::MAX;
            }
        }
    }

    let mut png_bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_bytes, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(&rgba).ok()?;
    }

    Some(format!(
        "data:image/png;base64,{}",
        BASE64_STANDARD.encode(png_bytes)
    ))
}

fn wide_null(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(Some(0)).collect()
}

type HBRUSH__ = core::ffi::c_void;
