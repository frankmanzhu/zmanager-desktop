import Foundation
import ZManagerGenerated
import ZManagerMacOSShared

public struct FinderSelectionItem: Equatable, Sendable {
    public let url: URL
    public let isDirectory: Bool

    public init(url: URL, isDirectory: Bool) {
        self.url = url
        self.isDirectory = isDirectory
    }
}

public struct FinderMenuAction: Equatable, Sendable {
    public let id: ShellActionID
    public let title: String

    public init(id: ShellActionID, title: String) {
        self.id = id
        self.title = title
    }
}

public enum FinderMenuBuilder {
    public static func actions(
        for items: [FinderSelectionItem],
        localize: (String) -> String
    ) -> [FinderMenuAction] {
        guard !items.isEmpty, items.count <= 1_024 else { return [] }
        let shapes = selectionShapes(items)
        return ShellActionPolicy.all.compactMap { policy in
            guard policy.selectionShapes.contains(where: shapes.contains),
                  policy.multiplicity != "exactly-one" || items.count == 1
            else { return nil }
            return FinderMenuAction(id: policy.id, title: localize(policy.displayKey))
        }
    }

    public static func isSupportedArchive(_ url: URL) -> Bool {
        let name = url.lastPathComponent.lowercased()
        if ArchiveFileTypes.splitArchiveSuffixes.contains(where: name.hasSuffix) { return true }
        if ArchiveFileTypes.compoundExtensions.contains(where: { name.hasSuffix(".\($0)") }) {
            return true
        }
        return ArchiveFileTypes.singleExtensions.contains(url.pathExtension.lowercased())
    }

    private static func selectionShapes(_ items: [FinderSelectionItem]) -> [String] {
        if items.allSatisfy({ !$0.isDirectory && isSupportedArchive($0.url) }) {
            return [items.count == 1 ? "single-archive" : "multiple-archives"]
        }
        if items.count == 1, items[0].isDirectory { return ["folders", "single-folder"] }
        if items.allSatisfy(\.isDirectory) { return ["folders"] }
        if items.allSatisfy({ !$0.isDirectory }) { return ["files"] }
        return ["mixed"]
    }
}

private struct ShellActionRequestPayload: Encodable {
    let version = 1
    let action: ShellActionID
    let paths: [String]
}

public struct FinderRequestTransport: Sendable {
    public typealias OpenURL = @Sendable (URL) -> Bool
    private let inbox: AppGroupRequestInbox
    private let openURL: OpenURL

    public init(inbox: AppGroupRequestInbox, openURL: @escaping OpenURL) {
        self.inbox = inbox
        self.openURL = openURL
    }

    public func send(action: ShellActionID, urls: [URL]) throws -> String {
        guard !urls.isEmpty, urls.count <= 1_024,
              urls.allSatisfy({ $0.isFileURL && !$0.path.isEmpty && $0.path.utf8.count <= 4_096 })
        else { throw AppGroupRequestInboxError.invalidFile }
        let token = try AppGroupRequestInbox.generateToken()
        let request = ShellActionRequestPayload(action: action, paths: urls.map(\.path))
        let data = try JSONEncoder().encode(request)
        try inbox.writeFromExtension(data: data, token: token)
        guard let callback = URL(string: "zmanager://shell-request/\(token)"), openURL(callback)
        else {
            try? inbox.discard(token: token)
            throw AppGroupRequestInboxError.invalidFile
        }
        return token
    }
}
