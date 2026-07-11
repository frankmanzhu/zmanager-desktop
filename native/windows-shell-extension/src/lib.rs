#![cfg(windows)]
#![allow(non_snake_case)]

use std::{
    collections::HashSet,
    ffi::c_void,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicU32, AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use windows::{
    Win32::{
        Foundation::{
            CLASS_E_CLASSNOTAVAILABLE, CLASS_E_NOAGGREGATION, E_FAIL, E_INVALIDARG, E_NOTIMPL,
            HMODULE, S_FALSE, S_OK,
        },
        System::{
            Com::{CoTaskMemFree, IBindCtx, IClassFactory, IClassFactory_Impl},
            LibraryLoader::{
                GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
                GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT, GetModuleFileNameW,
                GetModuleHandleExW,
            },
        },
        UI::Shell::{
            ECF_DEFAULT, ECS_ENABLED, ECS_HIDDEN, IEnumExplorerCommand, IExplorerCommand,
            IExplorerCommand_Impl, IShellItemArray, SHStrDupW, SIGDN_FILESYSPATH,
        },
    },
    core::{BOOL, Error, GUID, HRESULT, Interface, PCWSTR, PWSTR, Ref, Result as WindowsResult, w},
};
use windows_core::implement;
use zmanager_shell_contract::{ShellActionKind, ShellActionRequest};

const OPEN_CLSID: GUID = GUID::from_u128(0x8ac91dd4_b918_4118_9635_9407a4731972);
const EXTRACT_HERE_CLSID: GUID = GUID::from_u128(0x5e7c0abe_ac4c_4d4b_bedd_a9133d7f80d4);
const EXTRACT_TO_FOLDER_CLSID: GUID = GUID::from_u128(0xae04555b_2c6b_42c1_870a_9b15e1e0b82b);
const COMPRESS_CLSID: GUID = GUID::from_u128(0x8bd7f398_a6c3_40a2_a4f8_725e0d671366);
const COMPRESS_TZAP_CLSID: GUID = GUID::from_u128(0xbeeb01f9_5243_4f96_9bb1_54fa4c250cde);
const COMPRESS_ZIP_CLSID: GUID = GUID::from_u128(0xaa751926_e80f_47a5_9e03_dfa87926f23a);
const COMPRESS_SEVEN_Z_CLSID: GUID = GUID::from_u128(0xc910bf28_3121_48f7_a8a1_2f4d8f587ce8);
const COMPRESS_TAR_ZST_CLSID: GUID = GUID::from_u128(0x9838e6cb_f43e_4fc9_96f1_7f0f4bdbb728);

static LIVE_OBJECTS: AtomicU32 = AtomicU32::new(0);
static SERVER_LOCKS: AtomicU32 = AtomicU32::new(0);
static REQUEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ExplorerAction {
    Open,
    ExtractHere,
    ExtractToFolder,
    Compress,
    CompressTzap,
    CompressZip,
    CompressSevenZ,
    CompressTarZst,
}

impl ExplorerAction {
    fn from_clsid(clsid: &GUID) -> Option<Self> {
        match *clsid {
            OPEN_CLSID => Some(Self::Open),
            EXTRACT_HERE_CLSID => Some(Self::ExtractHere),
            EXTRACT_TO_FOLDER_CLSID => Some(Self::ExtractToFolder),
            COMPRESS_CLSID => Some(Self::Compress),
            COMPRESS_TZAP_CLSID => Some(Self::CompressTzap),
            COMPRESS_ZIP_CLSID => Some(Self::CompressZip),
            COMPRESS_SEVEN_Z_CLSID => Some(Self::CompressSevenZ),
            COMPRESS_TAR_ZST_CLSID => Some(Self::CompressTarZst),
            _ => None,
        }
    }

    fn clsid(self) -> GUID {
        match self {
            Self::Open => OPEN_CLSID,
            Self::ExtractHere => EXTRACT_HERE_CLSID,
            Self::ExtractToFolder => EXTRACT_TO_FOLDER_CLSID,
            Self::Compress => COMPRESS_CLSID,
            Self::CompressTzap => COMPRESS_TZAP_CLSID,
            Self::CompressZip => COMPRESS_ZIP_CLSID,
            Self::CompressSevenZ => COMPRESS_SEVEN_Z_CLSID,
            Self::CompressTarZst => COMPRESS_TAR_ZST_CLSID,
        }
    }

    fn title(self) -> PCWSTR {
        match self {
            Self::Open => w!("Open archive"),
            Self::ExtractHere => w!("Extract Here"),
            Self::ExtractToFolder => w!("Extract to Archive Folder"),
            Self::Compress => w!("Add to archive..."),
            Self::CompressTzap => w!("Add to .tzap"),
            Self::CompressZip => w!("Add to .zip"),
            Self::CompressSevenZ => w!("Add to .7z"),
            Self::CompressTarZst => w!("Add to .tzst"),
        }
    }

    fn shell_action(self) -> ShellActionKind {
        match self {
            Self::Open => ShellActionKind::Open,
            Self::ExtractHere => ShellActionKind::ExtractHere,
            Self::ExtractToFolder => ShellActionKind::ExtractToFolder,
            Self::Compress => ShellActionKind::Compress,
            Self::CompressTzap => ShellActionKind::CompressTzap,
            Self::CompressZip => ShellActionKind::CompressZip,
            Self::CompressSevenZ => ShellActionKind::CompressSevenZ,
            Self::CompressTarZst => ShellActionKind::CompressTarZst,
        }
    }

    fn supports_count(self, count: u32) -> bool {
        if count == 0 {
            return false;
        }
        match self {
            Self::Open | Self::ExtractToFolder => count == 1,
            _ => true,
        }
    }
}

struct LiveObject;

impl LiveObject {
    fn new() -> Self {
        LIVE_OBJECTS.fetch_add(1, Ordering::Relaxed);
        Self
    }
}

impl Drop for LiveObject {
    fn drop(&mut self) {
        LIVE_OBJECTS.fetch_sub(1, Ordering::Release);
    }
}

#[implement(IExplorerCommand)]
struct ZManagerExplorerCommand {
    action: ExplorerAction,
    _live: LiveObject,
}

impl ZManagerExplorerCommand {
    fn new(action: ExplorerAction) -> Self {
        Self {
            action,
            _live: LiveObject::new(),
        }
    }
}

impl IExplorerCommand_Impl for ZManagerExplorerCommand_Impl {
    fn GetTitle(&self, _selection: Ref<'_, IShellItemArray>) -> WindowsResult<PWSTR> {
        unsafe { SHStrDupW(self.action.title()) }
    }

    fn GetIcon(&self, _selection: Ref<'_, IShellItemArray>) -> WindowsResult<PWSTR> {
        Err(Error::from_hresult(E_NOTIMPL))
    }

    fn GetToolTip(&self, _selection: Ref<'_, IShellItemArray>) -> WindowsResult<PWSTR> {
        Err(Error::from_hresult(E_NOTIMPL))
    }

    fn GetCanonicalName(&self) -> WindowsResult<GUID> {
        Ok(self.action.clsid())
    }

    fn GetState(
        &self,
        selection: Ref<'_, IShellItemArray>,
        _ok_to_be_slow: BOOL,
    ) -> WindowsResult<u32> {
        let count = unsafe { selection.ok()?.GetCount()? };
        Ok(if self.action.supports_count(count) {
            ECS_ENABLED.0 as u32
        } else {
            ECS_HIDDEN.0 as u32
        })
    }

    fn Invoke(
        &self,
        selection: Ref<'_, IShellItemArray>,
        _bind_context: Ref<'_, IBindCtx>,
    ) -> WindowsResult<()> {
        let paths = selected_file_system_paths(selection.ok()?)?;
        if paths.is_empty() || !self.action.supports_count(paths.len() as u32) {
            return Err(Error::from_hresult(E_INVALIDARG));
        }

        let action = self.action.shell_action();
        let worker_lifetime = LiveObject::new();
        std::thread::Builder::new()
            .name("zmanager-shell-handoff".to_string())
            .spawn(move || {
                let _worker_lifetime = worker_lifetime;
                let _ = handoff_to_zmanager(action, paths);
            })
            .map_err(|error| Error::new(E_FAIL, error.to_string()))?;
        Ok(())
    }

    fn GetFlags(&self) -> WindowsResult<u32> {
        Ok(ECF_DEFAULT.0 as u32)
    }

    fn EnumSubCommands(&self) -> WindowsResult<IEnumExplorerCommand> {
        Err(Error::from_hresult(E_NOTIMPL))
    }
}

#[implement(IClassFactory)]
struct ZManagerClassFactory {
    action: ExplorerAction,
    _live: LiveObject,
}

impl ZManagerClassFactory {
    fn new(action: ExplorerAction) -> Self {
        Self {
            action,
            _live: LiveObject::new(),
        }
    }
}

impl IClassFactory_Impl for ZManagerClassFactory_Impl {
    fn CreateInstance(
        &self,
        outer: Ref<'_, windows::core::IUnknown>,
        interface_id: *const GUID,
        object: *mut *mut c_void,
    ) -> WindowsResult<()> {
        if !outer.is_null() {
            return Err(Error::from_hresult(CLASS_E_NOAGGREGATION));
        }
        if interface_id.is_null() || object.is_null() {
            return Err(Error::from_hresult(E_INVALIDARG));
        }

        let command: IExplorerCommand = ZManagerExplorerCommand::new(self.action).into();
        unsafe { command.query(interface_id, object).ok() }
    }

    fn LockServer(&self, lock: BOOL) -> WindowsResult<()> {
        if lock.as_bool() {
            SERVER_LOCKS.fetch_add(1, Ordering::Relaxed);
        } else {
            let _ = SERVER_LOCKS.fetch_update(Ordering::Release, Ordering::Relaxed, |count| {
                count.checked_sub(1)
            });
        }
        Ok(())
    }
}

fn selected_file_system_paths(selection: &IShellItemArray) -> WindowsResult<Vec<String>> {
    let count = unsafe { selection.GetCount()? };
    let mut paths = Vec::with_capacity(count as usize);
    let mut seen = HashSet::with_capacity(count as usize);

    for index in 0..count {
        let item = unsafe { selection.GetItemAt(index)? };
        let display_name = unsafe { item.GetDisplayName(SIGDN_FILESYSPATH)? };
        let path = unsafe { display_name.to_string() };
        unsafe { CoTaskMemFree(Some(display_name.0.cast())) };
        let path = path?;
        let comparison_key = path.to_lowercase();
        if seen.insert(comparison_key) {
            paths.push(path);
        }
    }

    Ok(paths)
}

fn handoff_to_zmanager(action: ShellActionKind, paths: Vec<String>) -> io::Result<()> {
    let request = ShellActionRequest::new(action, paths);
    let request_json = request
        .to_json()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let request_path = write_request_file(&request_json, &std::env::temp_dir())?;
    let executable = zmanager_executable_path()?;

    match Command::new(executable)
        .arg("--shell-action-request")
        .arg(&request_path)
        .spawn()
    {
        Ok(_) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(request_path);
            Err(error)
        }
    }
}

fn write_request_file(contents: &str, directory: &Path) -> io::Result<PathBuf> {
    for _ in 0..32 {
        let sequence = REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = directory.join(format!(
            "zmanager-shell-action-{}-{timestamp}-{sequence}.json",
            std::process::id()
        ));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                file.write_all(contents.as_bytes())?;
                file.sync_all()?;
                return Ok(path);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }

    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "unable to allocate a unique shell-action request file",
    ))
}

fn zmanager_executable_path() -> io::Result<PathBuf> {
    let mut module = HMODULE::default();
    unsafe {
        GetModuleHandleExW(
            GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
            PCWSTR(DllGetClassObject as *const () as *const u16),
            &mut module,
        )
    }
    .map_err(|error| io::Error::other(error.to_string()))?;

    let mut buffer = vec![0u16; 32_768];
    let length = unsafe { GetModuleFileNameW(Some(module), &mut buffer) };
    if length == 0 || length as usize >= buffer.len() {
        return Err(io::Error::last_os_error());
    }
    let dll_path = PathBuf::from(String::from_utf16_lossy(&buffer[..length as usize]));
    let install_directory = dll_path
        .parent()
        .ok_or_else(|| io::Error::other("shell extension has no install directory"))?;
    Ok(install_directory.join("zmanager-desktop.exe"))
}

#[unsafe(no_mangle)]
unsafe extern "system" fn DllGetClassObject(
    class_id: *const GUID,
    interface_id: *const GUID,
    object: *mut *mut c_void,
) -> HRESULT {
    if class_id.is_null() || interface_id.is_null() || object.is_null() {
        return E_INVALIDARG;
    }
    unsafe { *object = std::ptr::null_mut() };

    let Some(action) = ExplorerAction::from_clsid(unsafe { &*class_id }) else {
        return CLASS_E_CLASSNOTAVAILABLE;
    };
    let factory: IClassFactory = ZManagerClassFactory::new(action).into();
    unsafe { factory.query(interface_id, object) }
}

#[unsafe(no_mangle)]
unsafe extern "system" fn DllCanUnloadNow() -> HRESULT {
    if LIVE_OBJECTS.load(Ordering::Acquire) == 0 && SERVER_LOCKS.load(Ordering::Acquire) == 0 {
        S_OK
    } else {
        S_FALSE
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::{
        System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx, CoUninitialize},
        UI::Shell::{Common::ITEMIDLIST, SHCreateShellItemArrayFromIDLists, SHParseDisplayName},
    };

    #[test]
    fn every_registered_class_maps_to_one_shell_action() {
        let cases = [
            (OPEN_CLSID, ShellActionKind::Open),
            (EXTRACT_HERE_CLSID, ShellActionKind::ExtractHere),
            (EXTRACT_TO_FOLDER_CLSID, ShellActionKind::ExtractToFolder),
            (COMPRESS_CLSID, ShellActionKind::Compress),
            (COMPRESS_TZAP_CLSID, ShellActionKind::CompressTzap),
            (COMPRESS_ZIP_CLSID, ShellActionKind::CompressZip),
            (COMPRESS_SEVEN_Z_CLSID, ShellActionKind::CompressSevenZ),
            (COMPRESS_TAR_ZST_CLSID, ShellActionKind::CompressTarZst),
        ];

        for (class_id, expected) in cases {
            let action = ExplorerAction::from_clsid(&class_id).expect("class should be registered");
            assert_eq!(action.shell_action(), expected);
        }
    }

    #[test]
    fn exported_class_factory_creates_the_requested_explorer_command() {
        let mut factory_pointer = std::ptr::null_mut();
        let result = unsafe {
            DllGetClassObject(
                &COMPRESS_ZIP_CLSID,
                &IClassFactory::IID,
                &mut factory_pointer,
            )
        };
        assert_eq!(result, S_OK);
        let factory = unsafe { IClassFactory::from_raw(factory_pointer) };

        let command: IExplorerCommand = unsafe {
            factory
                .CreateInstance(None::<&windows::core::IUnknown>)
                .expect("class factory should create IExplorerCommand")
        };

        assert_eq!(
            unsafe { command.GetCanonicalName() }.expect("command should expose its canonical ID"),
            COMPRESS_ZIP_CLSID
        );
    }

    #[test]
    fn request_file_contains_one_versioned_request_with_all_paths() {
        let directory = std::env::temp_dir().join(format!(
            "zmanager-shell-extension-test-{}-{}",
            std::process::id(),
            REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&directory).expect("test directory should be created");
        let request = ShellActionRequest::new(
            ShellActionKind::CompressZip,
            vec!["C:/work/folder1".to_string(), "C:/work/folder2".to_string()],
        );

        let path = write_request_file(&request.to_json().unwrap(), &directory)
            .expect("request file should be written");
        let parsed = ShellActionRequest::from_json(
            &fs::read_to_string(&path).expect("request file should be readable"),
        )
        .expect("request should parse");

        assert_eq!(parsed, request);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn windows_shell_item_array_preserves_the_complete_selection() {
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok() }
            .expect("COM apartment should initialize");
        let directory = std::env::temp_dir().join(format!(
            "zmanager-shell-selection-test-{}-{}",
            std::process::id(),
            REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        let folder1 = directory.join("folder1");
        let folder2 = directory.join("folder2");
        fs::create_dir_all(&folder1).expect("first folder should be created");
        fs::create_dir_all(&folder2).expect("second folder should be created");

        let mut owned_pidls = Vec::<*mut ITEMIDLIST>::new();
        for path in [&folder1, &folder2] {
            let wide = path
                .as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect::<Vec<_>>();
            let mut pidl = std::ptr::null_mut();
            unsafe {
                SHParseDisplayName(PCWSTR(wide.as_ptr()), None, &mut pidl, 0, None)
                    .expect("filesystem path should become a shell item");
            }
            owned_pidls.push(pidl);
        }

        let borrowed_pidls = owned_pidls
            .iter()
            .map(|pidl| *pidl as *const ITEMIDLIST)
            .collect::<Vec<_>>();
        let selection = unsafe { SHCreateShellItemArrayFromIDLists(&borrowed_pidls) }
            .expect("shell selection array should be created");
        for pidl in owned_pidls {
            unsafe { CoTaskMemFree(Some(pidl.cast())) };
        }

        let paths = selected_file_system_paths(&selection)
            .expect("complete filesystem selection should resolve");

        assert_eq!(paths.len(), 2);
        assert_eq!(PathBuf::from(&paths[0]), folder1);
        assert_eq!(PathBuf::from(&paths[1]), folder2);

        drop(selection);
        let _ = fs::remove_dir_all(directory);
        unsafe { CoUninitialize() };
    }
}
