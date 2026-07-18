import AppKit
import Foundation
import QuickLookThumbnailing
import ZManagerPublicMetadataSupport

@_silgen_name("zmanager_public_metadata_summary_json")
private func metadataSummaryJSON(_ path: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

@_silgen_name("zmanager_public_metadata_string_free")
private func metadataStringFree(_ value: UnsafeMutablePointer<CChar>?)

final class TzapThumbnailProvider: QLThumbnailProvider {
    override func provideThumbnail(
        for request: QLFileThumbnailRequest,
        _ handler: @escaping (QLThumbnailReply?, Error?) -> Void
    ) {
        let summary = loadPublicMetadata(fileURL: request.fileURL)
        let size = CGSize(width: max(1, request.maximumSize.width), height: max(1, request.maximumSize.height))
        let reply = QLThumbnailReply(contextSize: size, currentContextDrawing: {
            drawCard(PublicMetadataThumbnailCard.make(summary), size: size)
            return true
        })
        reply.extensionBadge = "TZAP"
        handler(reply, nil)
    }
}

private func loadPublicMetadata(fileURL: URL) -> PublicMetadataSummary {
    let raw = fileURL.path.withCString(metadataSummaryJSON)
    guard let raw else {
        return .parse(fileName: fileURL.lastPathComponent, json: #"{"ok":false,"message":"Metadata inspection failed."}"#)
    }
    defer { metadataStringFree(raw) }
    return .parse(fileName: fileURL.lastPathComponent, json: String(cString: raw))
}

private func drawCard(_ card: PublicMetadataThumbnailCard, size: CGSize) {
    let bounds = CGRect(origin: .zero, size: size)
    NSColor.clear.setFill()
    bounds.fill()
    let padding = min(size.width, size.height) * 0.07
    let panel = bounds.insetBy(dx: padding, dy: padding)
    NSColor.windowBackgroundColor.setFill()
    NSBezierPath(roundedRect: panel, xRadius: 12, yRadius: 12).fill()
    let content = panel.insetBy(dx: padding, dy: padding)
    draw("TZAP", in: CGRect(x: content.minX, y: content.maxY - 42, width: content.width, height: 36), size: 24, weight: .bold, color: .controlAccentColor)
    draw(card.title, in: CGRect(x: content.minX, y: content.midY, width: content.width, height: 34), size: 20, weight: .semibold, color: .labelColor)
    draw(card.subtitle, in: CGRect(x: content.minX, y: content.midY - 34, width: content.width, height: 28), size: 14, weight: .regular, color: .secondaryLabelColor)
    draw(card.detail, in: CGRect(x: content.minX, y: content.minY, width: content.width, height: 26), size: 13, weight: .medium, color: .tertiaryLabelColor)
}

private func draw(_ value: String, in rect: CGRect, size: CGFloat, weight: NSFont.Weight, color: NSColor) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineBreakMode = .byTruncatingTail
    NSString(string: value).draw(in: rect, withAttributes: [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color,
        .paragraphStyle: paragraph,
    ])
}
