import Foundation
import QuickLookUI
import UniformTypeIdentifiers
import ZManagerPublicMetadataSupport

@_silgen_name("zmanager_public_metadata_summary_json")
private func metadataSummaryJSON(_ path: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

@_silgen_name("zmanager_public_metadata_string_free")
private func metadataStringFree(_ value: UnsafeMutablePointer<CChar>?)

final class TzapPreviewProvider: QLPreviewProvider, QLPreviewingController {
    func providePreview(
        for request: QLFilePreviewRequest,
        completionHandler handler: @escaping (QLPreviewReply?, Error?) -> Void
    ) {
        let summary = loadPublicMetadata(fileURL: request.fileURL)
        let html = PublicMetadataHTML.render(summary)
        let reply = QLPreviewReply(
            dataOfContentType: .html,
            contentSize: PublicMetadataHTML.contentSize
        ) { _ in Data(html.utf8) }
        reply.title = request.fileURL.lastPathComponent
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
