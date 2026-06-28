use std::{
    ffi::OsStr,
    mem::{ManuallyDrop, size_of},
    os::windows::ffi::OsStrExt,
    ptr::null_mut,
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

use super::{
    NativeFileDragError, NativeFileDragItem, NativeFileDragOutcome, NativeFileDragStreamProvider,
    ShellActionProfile,
};
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
        label: "ZManager > Open archive",
        quick_action: "open",
    },
    ShellActionProfile {
        label: "ZManager > Extract Here",
        quick_action: "extractHere",
    },
    ShellActionProfile {
        label: "ZManager > Add to archive",
        quick_action: "compress",
    },
    ShellActionProfile {
        label: "ZManager > Add to .tzap",
        quick_action: "compressTzap",
    },
    ShellActionProfile {
        label: "ZManager > Add to .zip",
        quick_action: "compressZip",
    },
    ShellActionProfile {
        label: "ZManager > Add to .7z",
        quick_action: "compressSevenZ",
    },
    ShellActionProfile {
        label: "ZManager > Add to .tzst",
        quick_action: "compressTarZst",
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

pub fn start_native_file_drag(
    items: &[NativeFileDragItem],
    stream_provider: NativeFileDragStreamProvider,
) -> Result<NativeFileDragOutcome, NativeFileDragError> {
    if items.is_empty() {
        return Err(NativeFileDragError::new(
            "No archive files are available to drag.",
            None::<String>,
        ));
    }

    windows_file_drag::start_drag(items, stream_provider)
}

type HBRUSH__ = core::ffi::c_void;

mod windows_file_drag {
    use std::io::{self, Write};

    use super::*;

    use ::windows::{
        Win32::{
            Foundation::{
                DRAGDROP_S_CANCEL, DRAGDROP_S_DROP, DRAGDROP_S_USEDEFAULTCURSORS, DV_E_FORMATETC,
                DV_E_LINDEX, DV_E_TYMED, E_FAIL, E_NOTIMPL, FILETIME, OLE_E_ADVISENOTSUPPORTED,
                S_OK,
            },
            System::{
                Com::StructuredStorage::CreateStreamOnHGlobal,
                Com::{
                    DATADIR_GET, DVASPECT_CONTENT, FORMATETC, IAdviseSink, IDataObject,
                    IDataObject_Impl, IEnumFORMATETC, IEnumSTATDATA, IStream, STGMEDIUM,
                    STGMEDIUM_0, STREAM_SEEK_SET, TYMED_HGLOBAL, TYMED_ISTREAM,
                },
                Memory::{GMEM_MOVEABLE, GMEM_ZEROINIT, GlobalAlloc, GlobalLock, GlobalUnlock},
                Ole::{
                    DROPEFFECT, DROPEFFECT_COPY, DROPEFFECT_NONE, DoDragDrop, IDropSource,
                    IDropSource_Impl, OleInitialize, OleUninitialize,
                },
                SystemServices::{MK_LBUTTON, MODIFIERKEYS_FLAGS},
            },
            UI::Shell::{
                FD_ATTRIBUTES, FD_FILESIZE, FD_WRITESTIME, FILEDESCRIPTORW, SHCreateStdEnumFmtEtc,
            },
        },
        core::{BOOL, Error as WindowsError, HRESULT, Ref, Result as WindowsResult, implement},
    };
    use windows_sys::Win32::{
        System::DataExchange::RegisterClipboardFormatW,
        UI::Shell::{CFSTR_FILECONTENTS, CFSTR_FILEDESCRIPTORW},
    };

    const WINDOWS_TICK: u64 = 10_000_000;
    const UNIX_EPOCH_AS_WINDOWS_FILETIME_SECONDS: u64 = 11_644_473_600;

    pub fn start_drag(
        items: &[NativeFileDragItem],
        stream_provider: NativeFileDragStreamProvider,
    ) -> Result<NativeFileDragOutcome, NativeFileDragError> {
        let _ole = OleApartment::initialize()?;
        let data_object: IDataObject = VirtualFileDragDataObject {
            items: items.to_vec(),
            stream_provider,
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

        if result == DRAGDROP_S_CANCEL {
            return Ok(NativeFileDragOutcome::Cancelled);
        }
        if result.is_err() {
            return Err(NativeFileDragError::new(
                format!("Windows native drag failed: 0x{:08X}", result.0 as u32),
                Some("Try extracting normally while native drag-out is being checked."),
            ));
        }

        if result == DRAGDROP_S_DROP && effect != DROPEFFECT_NONE {
            Ok(NativeFileDragOutcome::Dropped)
        } else {
            Ok(NativeFileDragOutcome::NoDrop)
        }
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
    struct VirtualFileDragDataObject {
        items: Vec<NativeFileDragItem>,
        stream_provider: NativeFileDragStreamProvider,
    }

    impl IDataObject_Impl for VirtualFileDragDataObject_Impl {
        fn GetData(&self, pformatetcin: *const FORMATETC) -> WindowsResult<STGMEDIUM> {
            let format = unsafe { pformatetcin.as_ref() }
                .ok_or_else(|| WindowsError::from_hresult(DV_E_FORMATETC))?;

            if is_file_descriptor_format(format) {
                return file_group_descriptor_medium(&self.items);
            }
            if is_file_contents_format(format) {
                let index = item_index(format, self.items.len())?;
                return file_contents_medium(&self.items[index], &self.stream_provider);
            }

            Err(WindowsError::from_hresult(DV_E_FORMATETC))
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

            if is_file_descriptor_format(format) {
                return S_OK;
            }
            if format.cfFormat == file_contents_format() {
                if (format.tymed & TYMED_ISTREAM.0 as u32) == 0 {
                    return DV_E_TYMED;
                }
                if format.lindex == -1 {
                    return S_OK;
                }
                if format.lindex < 0 || format.lindex as usize >= self.items.len() {
                    return DV_E_LINDEX;
                }
                return S_OK;
            }

            DV_E_FORMATETC
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

            unsafe { SHCreateStdEnumFmtEtc(&[file_descriptor_format(), file_contents_formatetc()]) }
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

    fn file_descriptor_format() -> FORMATETC {
        FORMATETC {
            cfFormat: file_descriptor_clipboard_format(),
            ptd: null_mut(),
            dwAspect: DVASPECT_CONTENT.0,
            lindex: -1,
            tymed: TYMED_HGLOBAL.0 as u32,
        }
    }

    fn file_contents_formatetc() -> FORMATETC {
        FORMATETC {
            cfFormat: file_contents_format(),
            ptd: null_mut(),
            dwAspect: DVASPECT_CONTENT.0,
            lindex: -1,
            tymed: TYMED_ISTREAM.0 as u32,
        }
    }

    fn is_file_descriptor_format(format: &FORMATETC) -> bool {
        format.cfFormat == file_descriptor_clipboard_format()
            && format.dwAspect == DVASPECT_CONTENT.0
            && (format.tymed & TYMED_HGLOBAL.0 as u32) != 0
    }

    fn is_file_contents_format(format: &FORMATETC) -> bool {
        format.cfFormat == file_contents_format()
            && format.dwAspect == DVASPECT_CONTENT.0
            && (format.tymed & TYMED_ISTREAM.0 as u32) != 0
    }

    fn item_index(format: &FORMATETC, item_count: usize) -> WindowsResult<usize> {
        if format.lindex < 0 {
            return Err(WindowsError::from_hresult(DV_E_LINDEX));
        }
        let index = format.lindex as usize;
        if index >= item_count {
            return Err(WindowsError::from_hresult(DV_E_LINDEX));
        }
        Ok(index)
    }

    fn file_descriptor_clipboard_format() -> u16 {
        unsafe { RegisterClipboardFormatW(CFSTR_FILEDESCRIPTORW) as u16 }
    }

    fn file_contents_format() -> u16 {
        unsafe { RegisterClipboardFormatW(CFSTR_FILECONTENTS) as u16 }
    }

    fn file_group_descriptor_medium(items: &[NativeFileDragItem]) -> WindowsResult<STGMEDIUM> {
        let descriptor_size = size_of::<FILEDESCRIPTORW>();
        let header_size = size_of::<u32>();
        let allocation_size = header_size + descriptor_size * items.len();

        let hglobal = unsafe { GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, allocation_size)? };
        let locked = unsafe { GlobalLock(hglobal) };
        if locked.is_null() {
            return Err(WindowsError::from_win32());
        }

        unsafe {
            (locked as *mut u32).write(items.len() as u32);
            let descriptors = (locked as *mut u8).add(header_size) as *mut FILEDESCRIPTORW;
            for (index, item) in items.iter().enumerate() {
                descriptors.add(index).write(file_descriptor(item));
            }
            let _ = GlobalUnlock(hglobal);
        }

        Ok(STGMEDIUM {
            tymed: TYMED_HGLOBAL.0 as u32,
            u: STGMEDIUM_0 { hGlobal: hglobal },
            pUnkForRelease: ManuallyDrop::new(None),
        })
    }

    fn file_descriptor(item: &NativeFileDragItem) -> FILEDESCRIPTORW {
        let name = wide_drag_file_name(&item.display_path);
        let mut file_name = [0u16; 260];
        let copy_len = name.len().min(file_name.len().saturating_sub(1));
        file_name[..copy_len].copy_from_slice(&name[..copy_len]);

        let mut descriptor = FILEDESCRIPTORW {
            dwFlags: FD_ATTRIBUTES.0 as u32,
            dwFileAttributes: FILE_ATTRIBUTE_NORMAL,
            cFileName: file_name,
            ..FILEDESCRIPTORW::default()
        };

        if let Some(size) = item.size {
            descriptor.dwFlags |= FD_FILESIZE.0 as u32;
            descriptor.nFileSizeHigh = (size >> 32) as u32;
            descriptor.nFileSizeLow = (size & 0xFFFF_FFFF) as u32;
        }
        if let Some(modified) = item.modified_unix_seconds {
            descriptor.dwFlags |= FD_WRITESTIME.0 as u32;
            descriptor.ftLastWriteTime = filetime_from_unix_seconds(modified);
        }

        descriptor
    }

    fn filetime_from_unix_seconds(seconds: u64) -> FILETIME {
        let ticks = seconds
            .saturating_add(UNIX_EPOCH_AS_WINDOWS_FILETIME_SECONDS)
            .saturating_mul(WINDOWS_TICK);
        FILETIME {
            dwLowDateTime: ticks as u32,
            dwHighDateTime: (ticks >> 32) as u32,
        }
    }

    fn wide_drag_file_name(path: &str) -> Vec<u16> {
        path.encode_utf16().filter(|value| *value != 0).collect()
    }

    fn file_contents_medium(
        item: &NativeFileDragItem,
        stream_provider: &NativeFileDragStreamProvider,
    ) -> WindowsResult<STGMEDIUM> {
        let stream = unsafe { CreateStreamOnHGlobal(Default::default(), true)? };
        {
            let mut writer = ComStreamWriter {
                stream: stream.clone(),
            };
            (stream_provider)(&item.entry_path, &mut writer)
                .map_err(|_| WindowsError::from_hresult(E_FAIL))?;
            writer
                .flush()
                .map_err(|_| WindowsError::from_hresult(E_FAIL))?;
        }
        unsafe {
            stream
                .Seek(0, STREAM_SEEK_SET, None)
                .map_err(|_| WindowsError::from_hresult(E_FAIL))?;
        }

        Ok(STGMEDIUM {
            tymed: TYMED_ISTREAM.0 as u32,
            u: STGMEDIUM_0 {
                pstm: ManuallyDrop::new(Some(stream)),
            },
            pUnkForRelease: ManuallyDrop::new(None),
        })
    }

    struct ComStreamWriter {
        stream: IStream,
    }

    impl Write for ComStreamWriter {
        fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
            let chunk_len = buffer.len().min(u32::MAX as usize);
            if chunk_len == 0 {
                return Ok(0);
            }

            let mut written = 0u32;
            let result = unsafe {
                self.stream.Write(
                    buffer.as_ptr().cast(),
                    chunk_len as u32,
                    Some(&mut written as *mut u32),
                )
            };
            if result.is_err() {
                return Err(io::Error::other(format!(
                    "COM stream write failed: 0x{:08X}",
                    result.0 as u32
                )));
            }
            Ok(written as usize)
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    #[cfg(test)]
    mod tests {
        use std::{
            collections::HashMap,
            fs,
            path::{Path, PathBuf},
            sync::Arc,
            thread,
            time::{Duration, SystemTime, UNIX_EPOCH},
        };

        use super::*;
        use ::windows::{
            Win32::{
                Foundation::POINTL,
                System::{
                    Com::IBindCtx,
                    Ole::{DROPEFFECT, DROPEFFECT_COPY, DROPEFFECT_NONE, IDropTarget},
                    SystemServices::MODIFIERKEYS_FLAGS,
                },
                UI::Shell::{BHID_SFUIObject, IShellItem, SHCreateItemFromParsingName},
            },
            core::PCWSTR,
        };

        const KEEP_VIRTUAL_DROP_PROOF_DIR_ENV: &str = "ZMANAGER_KEEP_VIRTUAL_DROP_PROOF_DIR";

        #[test]
        fn shell_folder_accepts_virtual_file_drag_data_object() {
            let kept_drop_target =
                std::env::var_os(KEEP_VIRTUAL_DROP_PROOF_DIR_ENV).map(PathBuf::from);
            let drop_target = kept_drop_target
                .clone()
                .unwrap_or_else(|| unique_temp_dir("zmanager-virtual-drop-target"));
            fs::create_dir_all(&drop_target).expect("create shell drop target");

            let result = run_shell_virtual_file_drop(&drop_target);

            if kept_drop_target.is_none() {
                let _ = fs::remove_dir_all(&drop_target);
            }
            result.expect("shell folder should accept virtual file drag data object");
        }

        fn run_shell_virtual_file_drop(
            drop_target: &Path,
        ) -> Result<(), Box<dyn std::error::Error>> {
            let payloads = Arc::new(HashMap::from([
                (
                    "folder/alpha.txt".to_string(),
                    b"alpha from virtual drag".to_vec(),
                ),
                (
                    "folder/beta.txt".to_string(),
                    b"beta from virtual drag".to_vec(),
                ),
            ]));
            let provider_payloads = Arc::clone(&payloads);
            let stream_provider: NativeFileDragStreamProvider =
                Arc::new(move |entry_path, writer| {
                    let bytes = provider_payloads.get(entry_path).ok_or_else(|| {
                        NativeFileDragError::new(
                            format!("missing test payload for {entry_path}"),
                            None::<String>,
                        )
                    })?;
                    writer.write_all(bytes).map_err(|error| {
                        NativeFileDragError::new(
                            format!("failed to write test payload: {error}"),
                            None::<String>,
                        )
                    })?;
                    Ok(bytes.len() as u64)
                });

            let items = vec![
                NativeFileDragItem {
                    entry_path: "folder/alpha.txt".to_string(),
                    display_path: "folder\\alpha.txt".to_string(),
                    size: Some(payloads["folder/alpha.txt"].len() as u64),
                    modified_unix_seconds: None,
                },
                NativeFileDragItem {
                    entry_path: "folder/beta.txt".to_string(),
                    display_path: "folder\\beta.txt".to_string(),
                    size: Some(payloads["folder/beta.txt"].len() as u64),
                    modified_unix_seconds: None,
                },
            ];

            let _ole = OleApartment::initialize().map_err(|error| error.message)?;
            let data_object: IDataObject = VirtualFileDragDataObject {
                items,
                stream_provider,
            }
            .into();
            let shell_drop_target = shell_folder_drop_target(drop_target)?;
            let point = POINTL { x: 0, y: 0 };
            let mut effect = DROPEFFECT_COPY;

            unsafe {
                shell_drop_target.DragEnter(
                    &data_object,
                    MODIFIERKEYS_FLAGS(0),
                    point,
                    &mut effect as *mut DROPEFFECT,
                )?;
            }
            assert_ne!(
                effect, DROPEFFECT_NONE,
                "shell folder rejected the virtual-file data object on DragEnter"
            );

            effect = DROPEFFECT_COPY;
            unsafe {
                shell_drop_target.Drop(
                    &data_object,
                    MODIFIERKEYS_FLAGS(0),
                    point,
                    &mut effect as *mut DROPEFFECT,
                )?;
            }
            assert_ne!(
                effect, DROPEFFECT_NONE,
                "shell folder rejected the virtual-file data object on Drop"
            );

            wait_for_file_contents(
                &drop_target.join("folder").join("alpha.txt"),
                payloads["folder/alpha.txt"].as_slice(),
            )?;
            wait_for_file_contents(
                &drop_target.join("folder").join("beta.txt"),
                payloads["folder/beta.txt"].as_slice(),
            )?;

            Ok(())
        }

        fn shell_folder_drop_target(path: &Path) -> ::windows::core::Result<IDropTarget> {
            let wide_path = wide_null(&path.to_string_lossy());
            let folder: IShellItem = unsafe {
                SHCreateItemFromParsingName(PCWSTR(wide_path.as_ptr()), None::<&IBindCtx>)?
            };
            unsafe { folder.BindToHandler(None::<&IBindCtx>, &BHID_SFUIObject) }
        }

        fn wait_for_file_contents(
            path: &Path,
            expected: &[u8],
        ) -> Result<(), Box<dyn std::error::Error>> {
            for _ in 0..20 {
                if path.exists() && fs::read(path)? == expected {
                    return Ok(());
                }
                thread::sleep(Duration::from_millis(100));
            }

            Err(format!(
                "expected dropped file contents were not written to {}",
                path.display()
            )
            .into())
        }

        fn unique_temp_dir(prefix: &str) -> PathBuf {
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before unix epoch")
                .as_nanos();
            std::env::temp_dir().join(format!("{prefix}-{nanos}"))
        }
    }
}
