import AppKit
import Foundation
import QuickLookThumbnailing

final class TzapThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(
        for request: QLFileThumbnailRequest,
        _ handler: @escaping (QLThumbnailReply?, Error?) -> Void
    ) {
        let size = CGSize(width: max(1, request.maximumSize.width), height: max(1, request.maximumSize.height))
        // Use the app icon directly, not the generic document icon. NSWorkspace.icon(forFile:)
        // on a .tzap file returns a white page with a tiny app-logo overlay — the real logo
        // ends up at ~25% of the thumbnail area. The app icon fills the entire canvas.
        let icon: NSImage
        if let appURL = NSWorkspace.shared.urlForApplication(toOpen: request.fileURL) {
            icon = NSWorkspace.shared.icon(forFile: appURL.path)
        } else {
            icon = NSWorkspace.shared.icon(forFile: request.fileURL.path)
        }
        let iconSize = min(size.width, size.height)
        icon.size = CGSize(width: iconSize, height: iconSize)
        let reply = QLThumbnailReply(contextSize: size, currentContextDrawing: {
            icon.draw(in: CGRect(x: 0, y: 0, width: iconSize, height: iconSize))
            return true
        })
        reply.extensionBadge = "TZAP"
        handler(reply, nil)
    }
}
