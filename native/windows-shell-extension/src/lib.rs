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
    core::{BOOL, Error, GUID, HRESULT, Interface, PCWSTR, PWSTR, Ref, Result as WindowsResult},
};
use windows_core::implement;
use zmanager_shell_contract::{
    base_name_without_archive_extension, ShellActionKind, ShellActionRequest,
};

mod generated;
use generated::*;

static LIVE_OBJECTS: AtomicU32 = AtomicU32::new(0);
static SERVER_LOCKS: AtomicU32 = AtomicU32::new(0);
static REQUEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct LiveObject;

impl LiveObject {
    fn new() -> Self {
        LIVE_OBJECTS.fetch_add(1, Ordering::Relaxed);
        Self
    }
}

impl Drop for LiveObject {
    fn drop(&mut self) {
        LIVE_OBJECTS.fetch_sub(1, Ordering::Relaxed);
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
    fn GetTitle(&self, selection: Ref<'_, IShellItemArray>) -> WindowsResult<PWSTR> {
        if self.action == ExplorerAction::ExtractToFolder
            && let Ok(selection_ref) = selection.ok()
            && let Ok(paths) = selected_file_system_paths(selection_ref)
            && paths.len() == 1
        {
            let folder_name = base_name_without_archive_extension(&paths[0]);
            let title = format!("Extract to \"{folder_name}\"\0");
            let wide: Vec<u16> = title.encode_utf16().collect();
            return unsafe { SHStrDupW(PCWSTR(wide.as_ptr())) };
        }

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
        for expected in ALL_EXPLORER_ACTIONS {
            let class_id = expected.clsid();
            let actual =
                ExplorerAction::from_clsid(&class_id).expect("class should be registered");
            assert_eq!(actual, *expected);
        }
    }

    #[test]
    fn exported_class_factory_creates_the_requested_explorer_command() {
        let mut factory_pointer = std::ptr::null_mut();
        let result = unsafe {
            DllGetClassObject(
                &ADD_TO_ZIP_CLSID,
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
            ADD_TO_ZIP_CLSID
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

    #[test]
    fn extract_to_folder_command_title_is_context_aware() {
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok() }
            .expect("COM apartment should initialize");
        let directory = std::env::temp_dir().join(format!(
            "zmanager-shell-title-test-{}-{}",
            std::process::id(),
            REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        let archive_file = directory.join("MPC-BE.1.9.1.x64-installer.zip");
        fs::create_dir_all(&directory).expect("dir should be created");
        fs::write(&archive_file, b"test").expect("archive file should be written");

        let wide = archive_file
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect::<Vec<_>>();
        let mut pidl = std::ptr::null_mut();
        unsafe {
            SHParseDisplayName(PCWSTR(wide.as_ptr()), None, &mut pidl, 0, None)
                .expect("filesystem path should become a shell item");
        }

        let borrowed_pidls = [pidl as *const ITEMIDLIST];
        let selection = unsafe { SHCreateShellItemArrayFromIDLists(&borrowed_pidls) }
            .expect("shell selection array should be created");
        unsafe { CoTaskMemFree(Some(pidl.cast())) };

        let command: IExplorerCommand =
            ZManagerExplorerCommand::new(ExplorerAction::ExtractToFolder).into();
        let title_pwstr = unsafe { command.GetTitle(&selection) }.expect("title should resolve");
        let title = unsafe { title_pwstr.to_string() }.expect("title to string");
        unsafe { CoTaskMemFree(Some(title_pwstr.0.cast())) };

        assert_eq!(title, "Extract to \"MPC-BE.1.9.1.x64-installer\"");

        drop(selection);
        let _ = fs::remove_dir_all(directory);
        unsafe { CoUninitialize() };
    }
}
