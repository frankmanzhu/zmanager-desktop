import Foundation
import Testing
@testable import ZManagerFinderExtensionSupport
import ZManagerGenerated
import ZManagerMacOSShared

private func item(_ path: String, directory: Bool = false) -> FinderSelectionItem {
    FinderSelectionItem(url: URL(filePath: path, directoryHint: directory ? .isDirectory : .notDirectory), isDirectory: directory)
}

@Test func finderMenusFollowGeneratedSelectionShapesAndOrdering() {
    #expect(FinderMenuBuilder.actions(for: [item("/tmp/demo.zip")], localize: { $0 }).map(\.id)
        == [.open, .extract, .extractHere, .extractToFolder])
    #expect(FinderMenuBuilder.actions(
        for: [item("/tmp/one.zip"), item("/tmp/two.tar.gz")], localize: { $0 }
    ).map(\.id) == [.extract, .extractHere])
    #expect(FinderMenuBuilder.actions(for: [item("/tmp/folder", directory: true)], localize: { $0 }).map(\.id)
        == [.compress, .compressZip, .compressTzap, .compressSevenZ, .compressTarZst, .compressCleanSource])
    #expect(FinderMenuBuilder.actions(
        for: [item("/tmp/folder", directory: true), item("/tmp/readme.txt")], localize: { $0 }
    ).map(\.id) == [.compress, .compressZip, .compressTzap, .compressSevenZ, .compressTarZst])
}

@Test func finderArchiveClassificationCoversCompoundSplitAndUnsupportedPaths() {
    #expect(FinderMenuBuilder.isSupportedArchive(URL(filePath: "/tmp/demo.tar.gz")))
    #expect(FinderMenuBuilder.isSupportedArchive(URL(filePath: "/tmp/demo.7z.001")))
    #expect(FinderMenuBuilder.isSupportedArchive(URL(filePath: "/tmp/demo.vol000.tzap")))
    #expect(!FinderMenuBuilder.isSupportedArchive(URL(filePath: "/tmp/demo.txt")))
}

@Test func finderTransportWritesOneVersionedRequestAndOnlyExposesOpaqueTokenInURL() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "zmanager-finder-transport-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: root) }
    final class State: @unchecked Sendable { var callback: URL? }
    let state = State()
    let inbox = AppGroupRequestInbox(directory: root)
    let transport = FinderRequestTransport(inbox: inbox) { state.callback = $0; return true }
    let token = try transport.send(
        action: .compressZip,
        urls: [URL(filePath: "/tmp/one"), URL(filePath: "/tmp/two")]
    )
    #expect(state.callback?.absoluteString == "zmanager://shell-request/\(token)")
    #expect(!state.callback!.absoluteString.contains("/tmp/"))
    let object = try #require(
        JSONSerialization.jsonObject(with: inbox.consumeFromHost(token: token)) as? [String: Any]
    )
    #expect(object["version"] as? Int == 1)
    #expect(object["action"] as? String == "compressZip")
    #expect(object["paths"] as? [String] == ["/tmp/one", "/tmp/two"])
}

@Test func finderTransportDeletesRequestWhenCallbackCannotOpen() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "zmanager-finder-failed-callback-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: root) }
    let transport = FinderRequestTransport(inbox: AppGroupRequestInbox(directory: root)) { _ in false }
    #expect(throws: (any Error).self) {
        try transport.send(action: .compress, urls: [URL(filePath: "/tmp/one")])
    }
    #expect((try? FileManager.default.contentsOfDirectory(atPath: root.path))?.isEmpty == true)
}
