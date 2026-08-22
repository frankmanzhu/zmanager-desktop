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
            let title: String
            if policy.id == .extractToFolder, items.count == 1 {
                let stem = baseNameWithoutArchiveExtension(items[0].url)
                let template = localize("shellAction.extractToFolderNamed")
                if template != "shellAction.extractToFolderNamed" && template.contains("%@") {
                    title = String(format: template, stem)
                } else {
                    title = "Extract to \"\(stem)\""
                }
            } else {
                title = localize(policy.displayKey)
            }
            return FinderMenuAction(id: policy.id, title: title)
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

    public static func baseNameWithoutArchiveExtension(_ url: URL) -> String {
        let name = url.lastPathComponent
        let lower = name.lowercased()
        for suffix in ArchiveFileTypes.splitArchiveSuffixes {
            if lower.hasSuffix(suffix) && name.count > suffix.count {
                return String(name.dropLast(suffix.count))
            }
        }
        for compound in ArchiveFileTypes.compoundExtensions {
            let suffix = ".\(compound)"
            if lower.hasSuffix(suffix) && name.count > suffix.count {
                return String(name.dropLast(suffix.count))
            }
        }
        for ext in ArchiveFileTypes.singleExtensions {
            let suffix = ".\(ext)"
            if lower.hasSuffix(suffix) && name.count > suffix.count {
                return String(name.dropLast(suffix.count))
            }
        }
        return url.deletingPathExtension().lastPathComponent
    }

    /// Determine whether a URL is likely a directory using only path properties.
    ///
    /// This MUST NOT access the filesystem. FIFinderSync-selected URLs are not
    /// treated as user-selected by the sandbox (rdar://42874694), so any I/O
    /// operation — even `resourceValues(forKeys: [.isDirectoryKey])` — triggers
    /// a TCC permission prompt on every right-click.
    ///
    /// Heuristic (ordered, first match wins):
    /// 1. Known archive extension (`.zip`, `.tzap`, `.7z`, …) → regular file
    /// 2. Has a path extension (e.g. `.txt`, `.app`, `.png`) → regular file
    /// 3. No path extension → directory
    ///
    /// Edge cases:
    /// - `.app` / `.bundle` / `.xcplugin` → classified as files (they have
    ///   extensions). These are rare targets for archive operations; the main
    ///   app handles any mismatch gracefully.
    /// - Extensionless files (`README`, `Makefile`) → classified as directories.
    ///   The main app shows a descriptive error if an action is inapplicable.
    public static func isDirectoryByPath(_ url: URL) -> Bool {
        if isSupportedArchive(url) { return false }
        if !url.pathExtension.isEmpty { return false }
        return true
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
                NSWorkspace.shared.open(url)
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
