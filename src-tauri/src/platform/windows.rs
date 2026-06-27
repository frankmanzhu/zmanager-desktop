use std::{
    ffi::OsStr,
    mem::{ManuallyDrop, size_of},
    os::windows::ffi::OsStrExt,
    path::PathBuf,
    ptr::{copy_nonoverlapping, null_mut},
    slice,
};

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

use super::{NativeFileDragError, ShellActionProfile};
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

pub fn start_native_file_drag(paths: &[PathBuf]) -> Result<(), NativeFileDragError> {
    if paths.is_empty() {
        return Err(NativeFileDragError::new(
            "No staged files are available to drag.",
            None::<String>,
        ));
    }

    for path in paths {
        if !path.exists() {
            return Err(NativeFileDragError::new(
                format!(
                    "staged drag path does not exist: {}",
                    path.to_string_lossy()
                ),
                Some("Try extracting the selection again."),
            ));
        }
    }

    windows_file_drag::start_drag(paths)
}

type HBRUSH__ = core::ffi::c_void;

mod windows_file_drag {
    use super::*;

    use ::windows::{
        Win32::{
            Foundation::{
                DRAGDROP_S_CANCEL, DRAGDROP_S_DROP, DRAGDROP_S_USEDEFAULTCURSORS, DV_E_FORMATETC,
                E_NOTIMPL, OLE_E_ADVISENOTSUPPORTED, S_OK,
            },
            System::{
                Com::{
                    DATADIR_GET, DVASPECT_CONTENT, FORMATETC, IAdviseSink, IDataObject,
                    IDataObject_Impl, IEnumFORMATETC, IEnumSTATDATA, STGMEDIUM, STGMEDIUM_0,
                    TYMED_HGLOBAL,
                },
                Memory::{GMEM_MOVEABLE, GMEM_ZEROINIT, GlobalAlloc, GlobalLock, GlobalUnlock},
                Ole::{
                    CF_HDROP, DROPEFFECT, DROPEFFECT_COPY, DoDragDrop, IDropSource,
                    IDropSource_Impl, OleInitialize, OleUninitialize,
                },
                SystemServices::{MK_LBUTTON, MODIFIERKEYS_FLAGS},
            },
            UI::Shell::{DROPFILES, SHCreateStdEnumFmtEtc},
        },
        core::{BOOL, Error as WindowsError, HRESULT, Ref, Result as WindowsResult, implement},
    };

    pub fn start_drag(paths: &[PathBuf]) -> Result<(), NativeFileDragError> {
        let _ole = OleApartment::initialize()?;
        let data_object: IDataObject = FileDragDataObject {
            paths: paths.to_vec(),
        }
        .into();
        let drop_source: IDropSource = FileDropSource.into();
        let mut effect = DROPEFFECT(0);
        let result = unsafe {
            DoDragDrop(
                &data_object,
                &drop_source,
                DROPEFFECT_COPY,
                &mut effect as *mut DROPEFFECT,
            )
        };

        if result.is_err() {
            return Err(NativeFileDragError::new(
                format!("Windows native drag failed: 0x{:08X}", result.0 as u32),
                Some("Try extracting normally while native drag-out is being checked."),
            ));
        }

        Ok(())
    }

    struct OleApartment;

    impl OleApartment {
        fn initialize() -> Result<Self, NativeFileDragError> {
            unsafe { OleInitialize(None) }.map_err(|error| {
                NativeFileDragError::new(
                    format!("Unable to initialize Windows OLE drag/drop: {error}"),
                    Some("Restart ZManager and try the drag again."),
                )
            })?;
            Ok(Self)
        }
    }

    impl Drop for OleApartment {
        fn drop(&mut self) {
            unsafe {
                OleUninitialize();
            }
        }
    }

    #[implement(IDataObject)]
    struct FileDragDataObject {
        paths: Vec<PathBuf>,
    }

    impl IDataObject_Impl for FileDragDataObject_Impl {
        fn GetData(&self, pformatetcin: *const FORMATETC) -> WindowsResult<STGMEDIUM> {
            let format = unsafe { pformatetcin.as_ref() }
                .ok_or_else(|| WindowsError::from_hresult(DV_E_FORMATETC))?;
            if !is_hdrop_format(format) {
                return Err(WindowsError::from_hresult(DV_E_FORMATETC));
            }

            hdrop_medium(&self.paths)
        }

        fn GetDataHere(
            &self,
            _pformatetc: *const FORMATETC,
            _pmedium: *mut STGMEDIUM,
        ) -> WindowsResult<()> {
            Err(WindowsError::from_hresult(E_NOTIMPL))
        }

        fn QueryGetData(&self, pformatetc: *const FORMATETC) -> HRESULT {
            let Some(format) = (unsafe { pformatetc.as_ref() }) else {
                return DV_E_FORMATETC;
            };

            if is_hdrop_format(format) {
                S_OK
            } else {
                DV_E_FORMATETC
            }
        }

        fn GetCanonicalFormatEtc(
            &self,
            _pformatectin: *const FORMATETC,
            pformatetcout: *mut FORMATETC,
        ) -> HRESULT {
            if let Some(output) = unsafe { pformatetcout.as_mut() } {
                output.ptd = null_mut();
            }
            E_NOTIMPL
        }

        fn SetData(
            &self,
            _pformatetc: *const FORMATETC,
            _pmedium: *const STGMEDIUM,
            _frelease: BOOL,
        ) -> WindowsResult<()> {
            Err(WindowsError::from_hresult(E_NOTIMPL))
        }

        fn EnumFormatEtc(&self, dwdirection: u32) -> WindowsResult<IEnumFORMATETC> {
            if dwdirection != DATADIR_GET.0 as u32 {
                return Err(WindowsError::from_hresult(E_NOTIMPL));
            }

            unsafe { SHCreateStdEnumFmtEtc(&[hdrop_format()]) }
        }

        fn DAdvise(
            &self,
            _pformatetc: *const FORMATETC,
            _advf: u32,
            _padvsink: Ref<'_, IAdviseSink>,
        ) -> WindowsResult<u32> {
            Err(WindowsError::from_hresult(OLE_E_ADVISENOTSUPPORTED))
        }

        fn DUnadvise(&self, _dwconnection: u32) -> WindowsResult<()> {
            Err(WindowsError::from_hresult(OLE_E_ADVISENOTSUPPORTED))
        }

        fn EnumDAdvise(&self) -> WindowsResult<IEnumSTATDATA> {
            Err(WindowsError::from_hresult(OLE_E_ADVISENOTSUPPORTED))
        }
    }

    #[implement(IDropSource)]
    struct FileDropSource;

    impl IDropSource_Impl for FileDropSource_Impl {
        fn QueryContinueDrag(
            &self,
            fescapepressed: BOOL,
            grfkeystate: MODIFIERKEYS_FLAGS,
        ) -> HRESULT {
            if fescapepressed.as_bool() {
                return DRAGDROP_S_CANCEL;
            }

            if (grfkeystate & MK_LBUTTON).0 == 0 {
                return DRAGDROP_S_DROP;
            }

            S_OK
        }

        fn GiveFeedback(&self, _dweffect: DROPEFFECT) -> HRESULT {
            DRAGDROP_S_USEDEFAULTCURSORS
        }
    }

    fn hdrop_format() -> FORMATETC {
        FORMATETC {
            cfFormat: CF_HDROP.0,
            ptd: null_mut(),
            dwAspect: DVASPECT_CONTENT.0,
            lindex: -1,
            tymed: TYMED_HGLOBAL.0 as u32,
        }
    }

    fn is_hdrop_format(format: &FORMATETC) -> bool {
        format.cfFormat == CF_HDROP.0
            && format.dwAspect == DVASPECT_CONTENT.0
            && (format.tymed & TYMED_HGLOBAL.0 as u32) != 0
    }

    fn hdrop_medium(paths: &[PathBuf]) -> WindowsResult<STGMEDIUM> {
        let wide_paths = encode_hdrop_paths(paths);
        let dropfiles_size = size_of::<DROPFILES>();
        let wide_paths_size = wide_paths.len() * size_of::<u16>();
        let allocation_size = dropfiles_size + wide_paths_size;

        let hglobal = unsafe { GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, allocation_size)? };
        let locked = unsafe { GlobalLock(hglobal) };
        if locked.is_null() {
            return Err(WindowsError::from_win32());
        }

        let dropfiles = DROPFILES {
            pFiles: dropfiles_size as u32,
            pt: Default::default(),
            fNC: false.into(),
            fWide: true.into(),
        };

        unsafe {
            copy_nonoverlapping(
                &dropfiles as *const DROPFILES as *const u8,
                locked as *mut u8,
                dropfiles_size,
            );
            copy_nonoverlapping(
                wide_paths.as_ptr() as *const u8,
                (locked as *mut u8).add(dropfiles_size),
                wide_paths_size,
            );
            let _ = GlobalUnlock(hglobal);
        }

        Ok(STGMEDIUM {
            tymed: TYMED_HGLOBAL.0 as u32,
            u: STGMEDIUM_0 { hGlobal: hglobal },
            pUnkForRelease: ManuallyDrop::new(None),
        })
    }

    fn encode_hdrop_paths(paths: &[PathBuf]) -> Vec<u16> {
        let mut encoded = Vec::new();
        for path in paths {
            encoded.extend(path.as_os_str().encode_wide());
            encoded.push(0);
        }
        encoded.push(0);
        encoded
    }
}
