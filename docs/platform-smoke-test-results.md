# Platform Smoke-Test Matrix Results

This file captures release verification outcomes for clean-install smoke tests.

## Matrix

| Date | Platform | OS | Artifact | Install Step | Launch | Open Archive | Extract | Dismiss Job | Result | Commit/Tag | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-11 | Windows 11 |  |  |  | Not Run | Not Run | Not Run | Not Run | Pending |  | Not yet executed |
| 2026-06-11 | Ubuntu 22.04 |  |  |  | Not Run | Not Run | Not Run | Not Run | Pending |  | Not yet executed |
| 2026-06-12 | Windows ARM64 | Windows | C:\Users\frankzhu\Projects\zmanager-desktop\src-tauri\target\release\bundle\nsis\ZManager_0.1.0_arm64-setup.exe | Silent installer install and launch | Pass | Pass | Pass | Command smoke covered terminal jobs | Pass | working-tree | Release gate passed. Log: C:\Users\frankzhu\Projects\zmanager-desktop\target\release-gate\release-gate-windows-arm64-20260612-000431.log |

| 2026-06-12 | Windows ARM64 | Windows | C:\Users\frankzhu\Projects\zmanager-desktop\src-tauri\target\release\bundle\nsis\ZManager_0.1.0_arm64-setup.exe | Silent installer install and launch | Pass | Pass | Pass | Command smoke covered terminal jobs | Pass | working-tree | Release gate passed. Log: C:\Users\frankzhu\Projects\zmanager-desktop\target\release-gate\release-gate-windows-arm64-20260612-004450.log |
| 2026-06-12 | Windows ARM64 | Windows | C:\Users\frankzhu\Projects\zmanager-desktop\src-tauri\target\release\bundle\nsis\ZManager_0.1.0_arm64-setup.exe | Packaged exe launch smoke | Pass | Pass | Pass | Command smoke covered terminal jobs | Pass | working-tree | Command smoke and app launch passed. Log: C:\Users\frankzhu\Projects\zmanager-desktop\target\release-gate\smoke-windows-arm64-20260612-004621.log |
| 2026-06-26 | Windows ARM64 | Windows | C:\Users\frankzhu\Projects\zmanager-desktop\src-tauri\target\release\zmanager-desktop.exe | Packaged exe launch smoke | Pass | Pass | Pass | Recovery smoke covered terminal jobs | Pass | working-tree | Windows Milestone 17 smoke passed. Log: C:\Users\frankzhu\Projects\zmanager-desktop\target\release-gate\smoke-windows-arm64-20260626-201342.log; exe SHA256 A4C834AF2006AA15F4D3E0C045E3FF2572DDE16512F133AC916A143DBADDC1BC |
## Required evidence per row

- Full install logs captured.
- Archive open command works for at least one supported format.
- Successful extract run and dismiss lifecycle action for a completed job.
- No crashes in extract/cleanup path.
