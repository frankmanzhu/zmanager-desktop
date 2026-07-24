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
        == [.extractHere, .extractToFolder, .open, .compress, .compressTzap, .compressZip, .compressSevenZ, .compressTarZst, .compressTarGz])
    #expect(FinderMenuBuilder.actions(
        for: [item("/tmp/one.zip"), item("/tmp/two.tar.gz")], localize: { $0 }
    ).map(\.id) == [.extractHere, .compress, .compressTzap, .compressZip, .compressSevenZ, .compressTarZst, .compressTarGz])
    #expect(FinderMenuBuilder.actions(for: [item("/tmp/folder", directory: true)], localize: { $0 }).map(\.id)
        == [.compress, .compressTzap, .compressZip, .compressSevenZ, .compressTarZst, .compressTarGz])
    #expect(FinderMenuBuilder.actions(
        for: [item("/tmp/folder", directory: true), item("/tmp/readme.txt")], localize: { $0 }
    ).map(\.id) == [.compress, .compressTzap, .compressZip, .compressSevenZ, .compressTarZst, .compressTarGz])
    #expect(FinderMenuBuilder.actions(
        for: [item("/tmp/folder", directory: true)],
        context: .container,
        localize: { $0 }
    ).map(\.id) == [.compress, .compressTzap, .compressZip, .compressSevenZ, .compressTarZst, .compressTarGz])
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
    try transport.send(
        action: .compressZip,
        urls: [URL(filePath: "/tmp/one"), URL(filePath: "/tmp/two")]
    )
    let token = try #require(state.callback?.lastPathComponent)
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
    #expect(throws: FinderRequestTransportError.callbackOpenFailed) {
        try transport.send(action: .compress, urls: [URL(filePath: "/tmp/one")])
    }
    #expect((try? FileManager.default.contentsOfDirectory(atPath: root.path))?.isEmpty == true)
}

@Test func finderTransportReportsUnavailableApplicationGroup() {
    let state = FinderRequestTransport.applicationGroup(
        resolveInbox: { _ in throw AppGroupRequestInboxError.unavailableAppGroup }
    )
    switch state {
    case .available:
        Issue.record("invalid App Group must not create an actionable transport")
    case let .unavailable(error):
        #expect(error == .unavailableAppGroup)
        #expect(error.code == "appGroupUnavailable")
    }
}

@Test func finderTransportReportsRequestWriteFailure() throws {
    let root = FileManager.default.temporaryDirectory
        .appending(path: "zmanager-finder-write-failure-\(UUID().uuidString)")
    try Data("not-a-directory".utf8).write(to: root)
    defer { try? FileManager.default.removeItem(at: root) }
    let transport = FinderRequestTransport(inbox: AppGroupRequestInbox(directory: root)) { _ in
        true
    }
    #expect(throws: FinderRequestTransportError.requestWriteFailed) {
        try transport.send(action: .compress, urls: [URL(filePath: "/tmp/one")])
    }
}
