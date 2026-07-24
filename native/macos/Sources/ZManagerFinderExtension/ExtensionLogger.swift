import Foundation
import ZManagerMacOSShared

struct ExtensionLogger {
    static let shared = ExtensionLogger()
    private let logURL: URL?

    init() {
        if let override = ProcessInfo.processInfo.environment["ZMANAGER_MACOS_APP_GROUP_REQUEST_DIR"] {
            logURL = URL(fileURLWithPath: override).appendingPathComponent("zmanager-extension.log")
        } else if let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: ZManagerConstants.appGroupIdentifier) {
            logURL = groupURL.appendingPathComponent("zmanager-extension.log")
        } else {
            logURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent("zmanager-extension.log")
        }
    }

    func log(_ message: String) {
        guard let logURL = logURL else { return }
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let line = "[\(timestamp)] \(message)\n"
        if let data = line.data(using: .utf8) {
            if FileManager.default.fileExists(atPath: logURL.path) {
                if let handle = try? FileHandle(forWritingTo: logURL) {
                    handle.seekToEndOfFile()
                    handle.write(data)
                    handle.closeFile()
                }
            } else {
                try? data.write(to: logURL)
            }
        }
    }
}
