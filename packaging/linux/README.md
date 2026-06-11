# Linux Packaging Notes

Start with portable packaging and XDG integration.

Recommended order:

1. AppImage for broad manual testing.
2. `.desktop` launcher metadata.
3. MIME associations for supported archive extensions.
4. `.deb` and `.rpm` packages after the install layout stabilizes.
5. Flatpak if sandboxed distribution becomes important.
6. File-manager extensions only after the core app is stable.

Linux file-manager integration is fragmented. Keep the first release focused on open-with behavior, drag/drop, and app-driven file pickers.

