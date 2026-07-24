import Foundation
#if os(macOS)
import AppKit
#endif
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

public enum FinderMenuContext: Sendable {
    case selection
    case container
}

public enum FinderMenuBuilder {
    public static func actions(
        for items: [FinderSelectionItem],
        context: FinderMenuContext = .selection,
        localize: (String) -> String
    ) -> [FinderMenuAction] {
        guard !items.isEmpty, items.count <= 1_024 else { return [] }
        let shapes = selectionShapes(items)
        let menuContext = switch context {
        case .container: "container"
        case .selection:
            items.allSatisfy({ !$0.isDirectory && isSupportedArchive($0.url) })
                ? (items.count == 1 ? "archiveSingle" : "archiveMultiple")
                : "creation"
        }
        return ShellActionPolicy.all.compactMap { policy -> FinderMenuAction? in
            guard policy.nativeSurfaces.contains("macosFinder"),
                  policy.contextMenuContexts.contains(menuContext),
                  policy.contextMenuOrder != nil,
                  policy.selectionShapes.contains(where: shapes.contains),
                  policy.multiplicity != "exactly-one" || items.count == 1
            else { return nil }
            return FinderMenuAction(id: policy.id, title: localize(policy.displayKey))
        }.sorted { left, right in
            let leftOrder = ShellActionPolicy.all.first(where: { $0.id == left.id })?.contextMenuOrder
                ?? .max
            let rightOrder = ShellActionPolicy.all.first(where: { $0.id == right.id })?.contextMenuOrder
                ?? .max
            return leftOrder < rightOrder
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

public enum FinderRequestTransportError: Error, Equatable, Sendable {
    case unavailableAppGroup
    case invalidSelection
    case tokenGenerationFailed
    case requestEncodingFailed
    case requestWriteFailed
    case callbackConstructionFailed
    case callbackOpenFailed
    case requestCleanupFailed

    public var code: String {
        switch self {
        case .unavailableAppGroup: "appGroupUnavailable"
        case .invalidSelection: "invalidSelection"
        case .tokenGenerationFailed: "tokenGenerationFailed"
        case .requestEncodingFailed: "requestEncodingFailed"
        case .requestWriteFailed: "requestWriteFailed"
        case .callbackConstructionFailed: "callbackConstructionFailed"
        case .callbackOpenFailed: "callbackOpenFailed"
        case .requestCleanupFailed: "requestCleanupFailed"
        }
    }
}

public enum FinderRequestTransportState: Sendable {
    case available(FinderRequestTransport)
    case unavailable(FinderRequestTransportError)
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

    public static func applicationGroup(
        identifier: String = AppGroupRequestInbox.applicationGroupIdentifier,
        resolveInbox: @Sendable (String) throws -> AppGroupRequestInbox = {
            try AppGroupRequestInbox.applicationGroup(identifier: $0)
        }
    ) -> FinderRequestTransportState {
        do {
            let inbox = try resolveInbox(identifier)
            let openURL: OpenURL = { url in
                let config = NSWorkspace.OpenConfiguration()
                config.environment = ["ZMANAGER_MACOS_QUICK_ACTION": "1"]
                if let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.frankmanzhu.zmanager") {
                    NSWorkspace.shared.open(
                        [url],
                        withApplicationAt: appURL,
                        configuration: config,
                        completionHandler: nil
                    )
                    return true
                }
                return NSWorkspace.shared.open(url)
            }
            return .available(
                FinderRequestTransport(
                    inbox: inbox,
                    openURL: openURL
                )
            )
        } catch {
            return .unavailable(.unavailableAppGroup)
        }
    }

    public func send(action: ShellActionID, urls: [URL]) throws(FinderRequestTransportError) -> Void {
        guard !urls.isEmpty, urls.count <= 1_024,
              urls.allSatisfy({ $0.isFileURL && !$0.path.isEmpty && $0.path.utf8.count <= 4_096 })
        else { throw .invalidSelection }
        let token: String
        do {
            token = try AppGroupRequestInbox.generateToken()
        } catch {
            throw .tokenGenerationFailed
        }
        let request = ShellActionRequestPayload(action: action, paths: urls.map(\.path))
        let data: Data
        do {
            data = try JSONEncoder().encode(request)
        } catch {
            throw .requestEncodingFailed
        }
        do {
            try inbox.writeFromExtension(data: data, token: token)
        } catch {
            throw .requestWriteFailed
        }
        guard let callback = URL(string: "zmanager://shell-request/\(token)") else {
            do {
                try inbox.discard(token: token)
            } catch {
                throw .requestCleanupFailed
            }
            throw .callbackConstructionFailed
        }
        guard openURL(callback) else {
            do {
                try inbox.discard(token: token)
            } catch {
                throw .requestCleanupFailed
            }
            throw .callbackOpenFailed
        }
    }
}
