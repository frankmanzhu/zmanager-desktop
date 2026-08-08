import Foundation
import QuickLookUI
import UniformTypeIdentifiers
import ZManagerPreviewModel
import ZManagerUniFFI

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
    let json = tzapPublicMetadataDisplaySummary(archivePath: fileURL.path)
    return .parse(fileName: fileURL.lastPathComponent, json: json)
}
