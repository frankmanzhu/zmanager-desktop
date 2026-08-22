import importlib.util
import sys
import types
import unittest
from pathlib import Path


class FakeMenu:
    def __init__(self) -> None:
        self.items = []

    def append_item(self, item) -> None:
        self.items.append(item)


class FakeMenuItem:
    def __init__(self, *, name: str, label: str, tip: str, icon: str) -> None:
        self.name = name
        self.label = label
        self.tip = tip
        self.icon = icon
        self.sensitive = True
        self.submenu = None

    def connect(self, *_args) -> None:
        pass

    def set_sensitive(self, sensitive: bool) -> None:
        self.sensitive = sensitive

    def set_submenu(self, submenu: FakeMenu) -> None:
        self.submenu = submenu


def load_nautilus_extension():
    class FakeGObject:
        pass

    class FakeMenuProvider:
        pass

    repository = types.ModuleType("gi.repository")
    repository.GObject = types.SimpleNamespace(GObject=FakeGObject)
    repository.Nautilus = types.SimpleNamespace(
        Menu=FakeMenu,
        MenuItem=FakeMenuItem,
        MenuProvider=FakeMenuProvider,
    )

    gi = types.ModuleType("gi")
    gi.Repository = types.SimpleNamespace(
        get_default=lambda: types.SimpleNamespace(enumerate_versions=lambda _name: [])
    )
    gi.require_version = lambda _name, _version: None

    sys.modules["gi"] = gi
    sys.modules["gi.repository"] = repository

    extension_dir = Path(__file__).resolve().parents[1] / "packaging" / "linux" / "nautilus"
    sys.path.insert(0, str(extension_dir))
    spec = importlib.util.spec_from_file_location(
        "zmanager_nautilus_under_test",
        extension_dir / "zmanager_nautilus.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load the Nautilus extension")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


NAUTILUS = load_nautilus_extension()


class NautilusExtensionTests(unittest.TestCase):
    def test_archive_stems_cover_simple_compound_and_split_extensions(self) -> None:
        cases = {
            "/tmp/archive.zip": "archive",
            "/tmp/MPC-BE.1.9.1.x64-installer.zip": "MPC-BE.1.9.1.x64-installer",
            "/tmp/archive.tar.gz": "archive",
            "/tmp/split.7z.001": "split",
            "/tmp/backup.vol000.tzap": "backup",
        }
        for path, expected in cases.items():
            with self.subTest(path=path):
                self.assertEqual(
                    NAUTILUS.base_name_without_archive_extension(path),
                    expected,
                )

    def test_single_archive_uses_context_aware_extract_title(self) -> None:
        menu = NAUTILUS.build_zmanager_menu(["/tmp/archive.tar.gz"], True, "File")
        extract = next(
            item for item in menu.submenu.items if item.name.endswith("_ExtractToFolder")
        )
        self.assertEqual(extract.label, 'Extract to "archive"')
        self.assertTrue(extract.sensitive)

    def test_multiple_archives_keep_the_canonical_extract_title(self) -> None:
        menu = NAUTILUS.build_zmanager_menu(
            ["/tmp/one.zip", "/tmp/two.tar.gz"],
            True,
            "File",
        )
        extract = next(
            item for item in menu.submenu.items if item.name.endswith("_ExtractToFolder")
        )
        self.assertEqual(extract.label, "Extract to Archive Folder")
        self.assertFalse(extract.sensitive)


if __name__ == "__main__":
    unittest.main()
