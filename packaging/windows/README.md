# Windows Packaging Notes

Start with one installer target, then expand.

Recommended order:

1. NSIS installer for fast iteration.
2. File associations for supported archive extensions.
3. Explorer context menu actions for compress and extract.
4. Code signing.
5. WinGet metadata after public release artifacts are stable.
6. MSIX only if the app needs Store-style install semantics.

Context menu actions should launch the GUI with an explicit operation request. Direct background shell operations can come later after notification and error-reporting behavior is designed.

