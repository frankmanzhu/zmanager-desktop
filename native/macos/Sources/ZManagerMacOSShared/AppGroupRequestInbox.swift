import Darwin
import Foundation
import Security

public enum AppGroupRequestInboxError: Error, Equatable {
    case invalidToken
    case invalidFile
    case wrongOwner
    case invalidPermissions
    case oversized
    case stale
    case unavailableAppGroup
    case randomFailure
}

public struct AppGroupRequestInbox: Sendable {
    public static let applicationGroupIdentifier = "group.com.frankmanzhu.zmanager"
    public static let maximumBytes = 1_048_576
    public static let maximumAge: TimeInterval = 300
    public static let maximumFutureSkew: TimeInterval = 60
    public let directory: URL

    public init(directory: URL) { self.directory = directory }

    public static func applicationGroup(
        identifier: String = applicationGroupIdentifier
    ) throws -> Self {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: identifier
        ) else { throw AppGroupRequestInboxError.unavailableAppGroup }
        return Self(directory: container.appending(path: "ShellActionRequests", directoryHint: .isDirectory))
    }

    public static func generateToken() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 24)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess
        else { throw AppGroupRequestInboxError.randomFailure }
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    public func writeFromExtension(data: Data, token: String) throws {
        try validate(token: token)
        guard data.count <= Self.maximumBytes else { throw AppGroupRequestInboxError.oversized }
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
        let staging = directory.appending(path: ".\(token).\(UUID().uuidString).tmp")
        let destination = requestURL(token: token)
        let descriptor = open(staging.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
        guard descriptor >= 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
        do {
            let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
            try handle.write(contentsOf: data)
            try handle.synchronize()
            try handle.close()
            try FileManager.default.moveItem(at: staging, to: destination)
        } catch {
            try? FileManager.default.removeItem(at: staging)
            throw error
        }
    }

    public func consumeFromHost(token: String, now: Date = Date()) throws -> Data {
        try validate(token: token)
        let url = requestURL(token: token)
        defer { try? FileManager.default.removeItem(at: url) }
        var before = stat()
        guard lstat(url.path, &before) == 0,
              (before.st_mode & S_IFMT) == S_IFREG,
              before.st_nlink == 1
        else { throw AppGroupRequestInboxError.invalidFile }
        guard before.st_uid == geteuid() else { throw AppGroupRequestInboxError.wrongOwner }
        guard before.st_mode & 0o777 == 0o600 else {
            throw AppGroupRequestInboxError.invalidPermissions
        }
        guard before.st_size >= 0, before.st_size <= Self.maximumBytes else {
            throw AppGroupRequestInboxError.oversized
        }
        let modified = Date(timeIntervalSince1970: TimeInterval(before.st_mtimespec.tv_sec))
        let age = now.timeIntervalSince(modified)
        guard age >= -Self.maximumFutureSkew, age <= Self.maximumAge else {
            throw AppGroupRequestInboxError.stale
        }

        let descriptor = open(url.path, O_RDONLY | O_NOFOLLOW)
        guard descriptor >= 0 else { throw AppGroupRequestInboxError.invalidFile }
        let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        var after = stat()
        guard fstat(descriptor, &after) == 0,
              after.st_dev == before.st_dev,
              after.st_ino == before.st_ino,
              after.st_uid == before.st_uid,
              after.st_mode == before.st_mode,
              after.st_size == before.st_size
        else { throw AppGroupRequestInboxError.invalidFile }
        let data = try handle.readToEnd() ?? Data()
        guard data.count <= Self.maximumBytes, data.count == Int(after.st_size) else {
            throw AppGroupRequestInboxError.oversized
        }
        return data
    }

    public func discard(token: String) throws {
        try validate(token: token)
        try? FileManager.default.removeItem(at: requestURL(token: token))
    }

    @discardableResult
    public func cleanupExpired(now: Date = Date(), limit: Int = 256) -> Int {
        guard limit > 0,
              let entries = try? FileManager.default.contentsOfDirectory(
                  at: directory,
                  includingPropertiesForKeys: [.contentModificationDateKey],
                  options: [.skipsHiddenFiles]
              )
        else { return 0 }
        var removed = 0
        for url in entries.prefix(limit) where url.pathExtension == "json" {
            guard let values = try? url.resourceValues(forKeys: [.contentModificationDateKey]),
                  let modified = values.contentModificationDate,
                  now.timeIntervalSince(modified) > Self.maximumAge
            else { continue }
            if (try? FileManager.default.removeItem(at: url)) != nil { removed += 1 }
        }
        return removed
    }

    private func requestURL(token: String) -> URL { directory.appending(path: "\(token).json") }

    private func validate(token: String) throws {
        guard (22 ... 128).contains(token.utf8.count), token.unicodeScalars.allSatisfy({
            CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-")).contains($0)
        }) else { throw AppGroupRequestInboxError.invalidToken }
    }
}
