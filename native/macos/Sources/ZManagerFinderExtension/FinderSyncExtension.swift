import AppKit
import FinderSync
import ZManagerFinderExtensionSupport
import ZManagerGenerated
import ZManagerMacOSShared

@objc(ZManagerFinderSync)
public final class ZManagerFinderSync: FIFinderSync {
    private lazy var transport: FinderRequestTransport? = {
        guard let inbox = try? AppGroupRequestInbox.applicationGroup() else { return nil }
        return FinderRequestTransport(inbox: inbox) { NSWorkspace.shared.open($0) }
    }()

    public override init() {
        super.init()
        FIFinderSyncController.default().directoryURLs = [URL(filePath: "/", directoryHint: .isDirectory)]
    }

    public override func menu(for menuKind: FIMenuKind) -> NSMenu? {
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
        let actions = FinderMenuBuilder.actions(for: items) {
            NSLocalizedString($0, tableName: "FinderActions", bundle: .main, comment: "")
        }
        guard !actions.isEmpty else { return nil }
        let menu = NSMenu(title: "Z-Manager")
        for action in actions {
            let item = NSMenuItem(title: action.title, action: #selector(runAction(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = [
                "action": action.id.rawValue,
                "paths": urls.map(\.path),
            ]
            menu.addItem(item)
        }
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
        guard
              !urls.isEmpty
        else { return }
        _ = try? transport?.send(action: action, urls: urls)
    }
}
