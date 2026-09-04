import hashlib
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List
from urllib.parse import unquote, urlparse

import gi

def _require_nautilus_version() -> None:
    versions: list[str] = []
    try:
        repo = gi.Repository.get_default()
        versions = list(repo.enumerate_versions("Nautilus"))
    except Exception:
        pass

    def _parse_version(v: str) -> tuple[int, ...]:
        try:
            return tuple(int(part) for part in v.split("."))
        except Exception:
            return (0,)

    # Support Nautilus 4.0+ and 3.0+ APIs, preferring the highest available version
    candidate_versions = [v for v in versions if _parse_version(v) >= (3, 0)]
    candidate_versions.sort(key=_parse_version, reverse=True)

    for version in candidate_versions:
        try:
            gi.require_version("Nautilus", version)
            return
        except ValueError:
            continue

    for fallback in ("4.1", "4.0", "3.0"):
        try:
            gi.require_version("Nautilus", fallback)
            return
        except ValueError:
            continue


_require_nautilus_version()
from gi.repository import GObject, Nautilus
from zmanager_shell_actions_generated import (
    ARCHIVE_ACTIONS,
    ARCHIVE_SUFFIXES,
    CREATE_ACTIONS,
)


class ZManagerMenuProvider(GObject.GObject, Nautilus.MenuProvider):
    def get_file_items(self, *args) -> List[Nautilus.MenuItem]:
        files = args[-1]
        paths = local_paths(files)
        debug_log("get_file_items", paths)
        if not paths:
            return []

        all_archives = all(is_archive_path(path) for path in paths)
        return [build_zmanager_menu(paths, all_archives, "File")]

    def get_background_items(self, *args) -> List[Nautilus.MenuItem]:
        current_folder = args[-1]
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

    added_actions = set()

    if include_archive_actions:
        for action_name, label, quick_action, accepts_multiple in ARCHIVE_ACTIONS:
            if action_name in added_actions:
                continue
            item_label = label
            if action_name == "ExtractToFolder" and len(paths) == 1:
                stem = base_name_without_archive_extension(paths[0])
                item_label = f'Extract to "{stem}"'
            item = action_item(identity, action_name, item_label, quick_action, paths)
            if not accepts_multiple and len(paths) != 1:
                item.set_sensitive(False)
            submenu.append_item(item)
            added_actions.add(action_name)

    for action_name, label, quick_action, accepts_multiple in CREATE_ACTIONS:
        if action_name in added_actions:
            continue
        if action_name == "ShareOnLan" and (len(paths) != 1 or not Path(paths[0]).is_file()):
            continue
        item = action_item(identity, action_name, label, quick_action, paths)
        if not accepts_multiple and len(paths) != 1:
            item.set_sensitive(False)
        submenu.append_item(item)
        added_actions.add(action_name)

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


def base_name_without_archive_extension(path: str) -> str:
    name = Path(path).name
    lower = name.casefold()
    if is_tzap_volume_name(lower):
        stem = lower[: -len(".tzap")]
        marker_index = stem.rfind(".vol")
        if marker_index > 0:
            return name[:marker_index]
    for suffix in ARCHIVE_SUFFIXES:
        if lower.endswith(suffix) and len(name) > len(suffix):
            return name[: -len(suffix)]
    if "." in name and not name.startswith("."):
        return os.path.splitext(name)[0]
    return name


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
    try:
        with open(log_path, "a", encoding="utf-8") as log_file:
            log_file.write(f"{timestamp} {event}{action_text} path_count={len(paths)}\n")
    except OSError:
        pass
