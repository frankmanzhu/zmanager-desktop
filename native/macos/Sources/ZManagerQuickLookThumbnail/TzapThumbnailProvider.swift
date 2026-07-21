import AppKit
import Foundation
import QuickLookThumbnailing

final class TzapThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(
        for request: QLFileThumbnailRequest,
        _ handler: @escaping (QLThumbnailReply?, Error?) -> Void
    ) {
        let size = CGSize(width: max(1, request.maximumSize.width), height: max(1, request.maximumSize.height))
        let icon = NSWorkspace.shared.icon(forFile: request.fileURL.path)
        let reply = QLThumbnailReply(contextSize: size, currentContextDrawing: {
            let iconSize = min(size.width, size.height) * 0.65
            let iconRect = CGRect(
                x: (size.width - iconSize) / 2,
                y: (size.height - iconSize) / 2,
                width: iconSize,
                height: iconSize
            )
            icon.draw(in: iconRect)
            return true
        })
        reply.extensionBadge = "TZAP"
        handler(reply, nil)
    }
}
