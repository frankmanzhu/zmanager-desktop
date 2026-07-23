import AppKit
import FinderSync
import OSLog
import ZManagerFinderExtensionSupport
import ZManagerGenerated
import ZManagerMacOSShared

@objc(ZManagerFinderSync)
public final class ZManagerFinderSync: FIFinderSync {
    private let logger = Logger(
        subsystem: "com.frankmanzhu.zmanager.finder-extension",
        category: "shellAction"
    )
    private lazy var transportState: FinderRequestTransportState = {
        if let override = ProcessInfo.processInfo.environment["ZMANAGER_MACOS_APP_GROUP_REQUEST_DIR"] {
            return .available(
                FinderRequestTransport(
                    inbox: AppGroupRequestInbox(
                        directory: URL(filePath: override, directoryHint: .isDirectory)
                    )
                ) { NSWorkspace.shared.open($0) }
            )
        }
        return FinderRequestTransport.applicationGroup { NSWorkspace.shared.open($0) }
    }()

    public override init() {
        super.init()
        FIFinderSyncController.default().directoryURLs = [URL(filePath: "/", directoryHint: .isDirectory)]
    }

    public override func menu(for menuKind: FIMenuKind) -> NSMenu? {
        guard case .available = transportState else {
            record(stage: "menuUnavailable", action: nil, selectionCount: 0, errorCode: "appGroupUnavailable")
            return nil
        }
        let controller = FIFinderSyncController.default()
        var urls = controller.selectedItemURLs() ?? []
        if urls.isEmpty, let target = controller.targetedURL(), menuKind == .contextualMenuForContainer {
            urls = [target]
        }
        let items = urls.compactMap { url -> FinderSelectionItem? in
            guard url.isFileURL,
                  let values = try? url.resourceValues(forKeys: [.isDirectoryKey])
            else { return nil }
            return FinderSelectionItem(url: url, isDirectory: values.isDirectory == true)
        }
        let context: FinderMenuContext = menuKind == .contextualMenuForContainer
            ? .container
            : .selection
        let actions = FinderMenuBuilder.actions(for: items, context: context) {
            NSLocalizedString($0, tableName: "FinderActions", bundle: .main, comment: "")
        }
        guard !actions.isEmpty else { return nil }
        let submenu = NSMenu(title: "ZManager")
        for action in actions {
            let item = NSMenuItem(title: action.title, action: #selector(runAction(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = [
                "action": action.id.rawValue,
                "paths": urls.map(\.path),
            ]
            submenu.addItem(item)
        }
        let menu = NSMenu(title: "")
        let containerItem = NSMenuItem(title: "ZManager", action: nil, keyEquivalent: "")
        containerItem.submenu = submenu
        menu.addItem(containerItem)
        return menu
    }

    @objc private func runAction(_ sender: NSMenuItem) {
        guard let payload = sender.representedObject as? [String: Any],
              let raw = payload["action"] as? String,
              let action = ShellActionID(rawValue: raw),
              let paths = payload["paths"] as? [String],
              !paths.isEmpty
        else { return }
        let urls = paths.map { URL(filePath: $0) }
        guard !urls.isEmpty else { return }
        guard case let .available(transport) = transportState else {
            record(
                stage: "transportUnavailable",
                action: action.rawValue,
                selectionCount: urls.count,
                errorCode: "appGroupUnavailable"
            )
            return
        }
        record(stage: "invoked", action: action.rawValue, selectionCount: urls.count)
        do {
            try transport.send(action: action, urls: urls)
            record(stage: "callbackOpened", action: action.rawValue, selectionCount: urls.count)
        } catch {
            record(
                stage: "deliveryFailed",
                action: action.rawValue,
                selectionCount: urls.count,
                errorCode: error.code
            )
        }
    }

    private func record(
        stage: String,
        action: String?,
        selectionCount: Int,
        errorCode: String? = nil
    ) {
        logger.info(
            "stage=\(stage, privacy: .public) action=\(action ?? "none", privacy: .public) selectionCount=\(selectionCount, privacy: .public) errorCode=\(errorCode ?? "none", privacy: .public)"
        )
    }
}
