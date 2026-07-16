import Foundation

public enum AppGroupRequestInboxError: Error, Equatable {
    case invalidToken
    case invalidFile
    case oversized
    case stale
}

public struct AppGroupRequestInbox: Sendable {
    public static let maximumBytes = 1_048_576
    public static let maximumAge: TimeInterval = 300
    public let directory: URL

    public init(directory: URL) { self.directory = directory }

    public func writeFromExtension(data: Data, token: String) throws {
        try validate(token: token)
        guard data.count <= Self.maximumBytes else { throw AppGroupRequestInboxError.oversized }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let staging = directory.appending(path: ".\(token).\(UUID().uuidString).tmp")
        let destination = requestURL(token: token)
        try data.write(to: staging, options: .withoutOverwriting)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: staging.path)
        do { try FileManager.default.moveItem(at: staging, to: destination) }
        catch {
            try? FileManager.default.removeItem(at: staging)
            throw error
        }
    }

    public func consumeFromHost(token: String, now: Date = Date()) throws -> Data {
        try validate(token: token)
        let url = requestURL(token: token)
        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true else { throw AppGroupRequestInboxError.invalidFile }
        guard (values.fileSize ?? Self.maximumBytes + 1) <= Self.maximumBytes else { throw AppGroupRequestInboxError.oversized }
        guard let modified = values.contentModificationDate, now.timeIntervalSince(modified) <= Self.maximumAge else { throw AppGroupRequestInboxError.stale }
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        guard (attributes[.posixPermissions] as? NSNumber)?.uint16Value == 0o600 else { throw AppGroupRequestInboxError.invalidFile }
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        try FileManager.default.removeItem(at: url)
        return data
    }

    private func requestURL(token: String) -> URL { directory.appending(path: "\(token).json") }
    private func validate(token: String) throws {
        guard (22...128).contains(token.count), token.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-")).contains($0) }) else {
            throw AppGroupRequestInboxError.invalidToken
        }
    }
}
