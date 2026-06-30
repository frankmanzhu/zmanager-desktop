import hashlib
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List
from urllib.parse import unquote, urlparse

import gi

gi.require_version("Nautilus", "4.0")
from gi.repository import GObject, Nautilus


ARCHIVE_SUFFIXES = (
    ".7z.001",
    ".vol000.tzap",
    ".tar.br",
    ".tar.bz2",
    ".tar.gz",
    ".tar.lz",
    ".tar.lz4",
    ".tar.lzma",
    ".tar.lzo",
    ".tar.lrz",
    ".tar.xz",
    ".tar.z",
    ".tar.zst",
    ".001",
    ".7z",
    ".apk",
    ".appx",
    ".br",
    ".bz2",
    ".cab",
    ".cbr",
    ".cpio",
    ".deb",
    ".gz",
    ".ipa",
    ".iso",
    ".jar",
    ".lrz",
    ".lz",
    ".lz4",
    ".lzma",
    ".lzo",
    ".rar",
    ".rpm",
    ".tar",
    ".tbz2",
    ".tgz",
    ".txz",
    ".tzap",
    ".tzst",
    ".war",
    ".xar",
    ".xpi",
    ".xz",
    ".z",
    ".zip",
    ".zipx",
    ".zst",
)

ARCHIVE_ACTIONS = (
    ("ExtractHere", "Extract Here", "extract-here", True),
    ("ExtractToFolder", "Extract to Archive Folder", "extract-to-folder", False),
    ("OpenArchive", "Open archive", "open", False),
)

CREATE_ACTIONS = (
    ("AddToArchive", "Add to archive...", "compress"),
    ("AddToTzap", "Add to .tzap", "compress-tzap"),
    ("AddToZip", "Add to .zip", "compress-zip"),
    ("AddToSevenZ", "Add to .7z", "compress-7z"),
    ("AddToTzst", "Add to .tzst", "compress-tzst"),
)


class ZManagerMenuProvider(GObject.GObject, Nautilus.MenuProvider):
    def get_file_items(self, files: List[Nautilus.FileInfo]) -> List[Nautilus.MenuItem]:
        paths = local_paths(files)
        debug_log("get_file_items", paths)
        if not paths:
            return []

        all_archives = all(is_archive_path(path) for path in paths)
        return [build_zmanager_menu(paths, all_archives, "File")]

    def get_background_items(
        self,
        current_folder: Nautilus.FileInfo,
    ) -> List[Nautilus.MenuItem]:
        path = local_path(current_folder)
        debug_log("get_background_items", [path] if path is not None else [])
        if path is None:
            return []

        return [build_zmanager_menu([path], False, "Background")]


def build_zmanager_menu(
    paths: List[str],
    include_archive_actions: bool,
    context: str,
) -> Nautilus.MenuItem:
    identity = menu_identity(context, paths)
    menu_item = Nautilus.MenuItem(
        name=f"ZManager::{identity}_Menu",
        label="ZManager",
        tip="ZManager archive actions",
        icon="zmanager-desktop",
    )
    submenu = Nautilus.Menu()
    menu_item.set_submenu(submenu)

    if include_archive_actions:
        for action_name, label, quick_action, accepts_multiple in ARCHIVE_ACTIONS:
            item = action_item(identity, action_name, label, quick_action, paths)
            if not accepts_multiple and len(paths) != 1:
                item.set_sensitive(False)
            submenu.append_item(item)

    for action_name, label, quick_action in CREATE_ACTIONS:
        submenu.append_item(action_item(identity, action_name, label, quick_action, paths))

    return menu_item


def action_item(
    identity: str,
    action_name: str,
    label: str,
    quick_action: str,
    paths: List[str],
) -> Nautilus.MenuItem:
    item = Nautilus.MenuItem(
        name=f"ZManager::{identity}_{action_name}",
        label=label,
        tip="Run ZManager",
        icon="zmanager-desktop",
    )
    item.connect("activate", run_quick_action, quick_action, tuple(paths))
    return item


def run_quick_action(
    _item: Nautilus.MenuItem,
    quick_action: str,
    paths: Iterable[str],
) -> None:
    command = ["zmanager-desktop", "--quick-action", quick_action, "--path", *paths]
    debug_log("run_quick_action", list(paths), quick_action)
    subprocess.Popen(command, start_new_session=True)


def local_paths(files: Iterable[Nautilus.FileInfo]) -> List[str]:
    paths = []
    for file_info in files:
        path = local_path(file_info)
        if path is None:
            return []
        paths.append(path)

    return paths


def local_path(file_info: Nautilus.FileInfo) -> str | None:
    if file_info.get_uri_scheme() != "file":
        return None

    uri = urlparse(file_info.get_uri())
    path = unquote(uri.path)
    return path or None


def is_archive_path(path: str) -> bool:
    name = Path(path).name.casefold()
    if is_tzap_volume_name(name):
        return True

    return any(name.endswith(suffix) for suffix in ARCHIVE_SUFFIXES)


def is_tzap_volume_name(name: str) -> bool:
    if not name.endswith(".tzap"):
        return False

    stem = name[: -len(".tzap")]
    marker_index = stem.rfind(".vol")
    if marker_index < 0:
        return False

    base_name = stem[:marker_index]
    digits = stem[marker_index + len(".vol") :]
    return bool(base_name and digits and digits.isascii() and digits.isdigit())


def menu_identity(context: str, paths: List[str]) -> str:
    digest_source = "\0".join(paths).encode("utf-8", errors="surrogateescape")
    digest = hashlib.sha1(digest_source).hexdigest()[:12]
    return f"{context}_{digest}"


def debug_log(event: str, paths: List[str], quick_action: str | None = None) -> None:
    log_path = os.environ.get("ZMANAGER_NAUTILUS_DEBUG_LOG")
    if not log_path:
        return

    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    action_text = f" quick_action={quick_action}" if quick_action else ""
    paths_text = " ".join(repr(path) for path in paths)
    try:
        with open(log_path, "a", encoding="utf-8") as log_file:
            log_file.write(f"{timestamp} {event}{action_text} paths=[{paths_text}]\n")
    except OSError:
        pass
