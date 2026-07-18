import CoreGraphics
import Foundation

guard CommandLine.arguments.count == 2, let targetPID = Int(CommandLine.arguments[1]) else {
    fputs("usage: macos-window-inventory.swift PID\n", stderr)
    exit(2)
}

let rows = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID)
    as? [[String: Any]] ?? []
let matches = rows.filter { ($0[kCGWindowOwnerPID as String] as? Int) == targetPID }
for row in matches {
    let name = row[kCGWindowName as String] as? String ?? ""
    let layer = row[kCGWindowLayer as String] as? Int ?? -1
    let bounds = row[kCGWindowBounds as String] as? [String: Any] ?? [:]
    let onScreen = row[kCGWindowIsOnscreen as String] as? Bool ?? false
    print("layer=\(layer);onScreen=\(onScreen);name=\(name);bounds=\(bounds)")
}
print("windowCount=\(matches.count)")
