import AppKit
import FinderSync
import OSLog
import ZManagerFinderExtensionSupport
import ZManagerGenerated
import ZManagerMacOSShared

@objc(ZManagerFinderSync)
public final class ZManagerFinderSync: FIFinderSync {
    private let logger = Logger(
        subsystem: "org.tzap-org.zmanager.finder-extension",
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
        return FinderRequestTransport.applicationGroup()
    }()

    public override init() {
        super.init()
        FIFinderSyncController.default().directoryURLs = [URL(filePath: "/", directoryHint: .isDirectory)]
    }

    public override func menu(for menuKind: FIMenuKind) -> NSMenu? {
        ExtensionLogger.shared.log("menu(for: \(menuKind.rawValue)) invoked")
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
            if let index = ShellActionPolicy.all.firstIndex(where: { $0.id == action.id }) {
                item.tag = index
            }
            item.representedObject = ["paths": urls.map(\.path)]
            submenu.addItem(item)
        }
        let menu = NSMenu(title: "")
        let containerItem = NSMenuItem(title: "ZManager", action: nil, keyEquivalent: "")
        containerItem.submenu = submenu
        menu.addItem(containerItem)
        return menu
    }

    @objc private func runAction(_ sender: NSMenuItem) {
        ExtensionLogger.shared.log("runAction invoked")
        let index = sender.tag
        guard index >= 0 && index < ShellActionPolicy.all.count else {
            ExtensionLogger.shared.log("early return: invalid tag \(index)")
            return
        }
        let action = ShellActionPolicy.all[index].id
        
        let controller = FIFinderSyncController.default()
        var urls = controller.selectedItemURLs() ?? []
        if urls.isEmpty, let target = controller.targetedURL() {
            urls = [target]
        }
        
        guard !urls.isEmpty else {
            ExtensionLogger.shared.log("early return: urls empty in runAction")
            return
        }
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
            if case .available(_) = transportState, let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: ZManagerConstants.appGroupIdentifier) {
                try? "\(error)\n".write(to: groupURL.appendingPathComponent("debug_zmanager.txt"), atomically: true, encoding: .utf8)
            }

        }
    }

    private func record(
        stage: String,
        action: String?,
        selectionCount: Int,
        errorCode: String? = nil
    ) {
        let msg: String
        if let errorCode {
            msg = "stage=\(stage) action=\(action ?? "none") selectionCount=\(selectionCount) errorCode=\(errorCode)"
            logger.error(
                "stage=\(stage, privacy: .public) action=\(action ?? "none", privacy: .public) selectionCount=\(selectionCount, privacy: .public) errorCode=\(errorCode, privacy: .public)"
            )
        } else {
            msg = "stage=\(stage) action=\(action ?? "none") selectionCount=\(selectionCount) errorCode=none"
            logger.notice(
                "stage=\(stage, privacy: .public) action=\(action ?? "none", privacy: .public) selectionCount=\(selectionCount, privacy: .public) errorCode=none"
            )
        }
        ExtensionLogger.shared.log(msg)
    }
}
