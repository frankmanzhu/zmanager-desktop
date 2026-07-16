import AppKit
import Foundation
import Testing
@testable import ZManagerMacOSShared

@Test func appGroupRequestIsAtomicConsumedOnceAndDeleted() throws {
    let root = FileManager.default.temporaryDirectory.appending(path: "zmanager-app-group-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: root) }
    let inbox = AppGroupRequestInbox(directory: root)
    let token = "abcdefghijklmnopqrstuv"
    let request = Data("{\"version\":1}".utf8)
    try inbox.writeFromExtension(data: request, token: token)
    #expect(try inbox.consumeFromHost(token: token) == request)
    #expect(!FileManager.default.fileExists(atPath: root.appending(path: "\(token).json").path))
    #expect(throws: (any Error).self) { try inbox.consumeFromHost(token: token) }
}

@Test func appGroupRequestRejectsInvalidAndOversizedInput() throws {
    let root = FileManager.default.temporaryDirectory.appending(path: "zmanager-app-group-\(UUID().uuidString)")
    defer { try? FileManager.default.removeItem(at: root) }
    let inbox = AppGroupRequestInbox(directory: root)
    #expect(throws: AppGroupRequestInboxError.invalidToken) { try inbox.writeFromExtension(data: Data(), token: "../bad") }
    #expect(throws: AppGroupRequestInboxError.oversized) {
        try inbox.writeFromExtension(data: Data(count: AppGroupRequestInbox.maximumBytes + 1), token: "abcdefghijklmnopqrstuv")
    }
}

@Test @MainActor func filePromiseDefersFakeRustStreamUntilDestination() throws {
    let destination = FileManager.default.temporaryDirectory.appending(path: "zmanager-promise-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: destination) }
    final class State: @unchecked Sendable { var started = false }
    let state = State()
    let writer = FilePromiseStreamWriter(promisedName: "entry.txt") { url in
        state.started = true
        try Data("streamed".utf8).write(to: url)
    }
    let provider = NSFilePromiseProvider(fileType: "public.data", delegate: writer)
    #expect(!state.started)
    var completionError: Error?
    writer.filePromiseProvider(provider, writePromiseTo: destination) { completionError = $0 }
    #expect(completionError == nil)
    #expect(state.started)
    #expect(try String(contentsOf: destination.appending(path: "entry.txt"), encoding: .utf8) == "streamed")
}
