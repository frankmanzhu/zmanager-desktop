import AppKit
import Foundation
import UniformTypeIdentifiers
import ZManagerMacOSShared

public typealias ZManagerPromiseWriteCallback = @convention(c) (
    UnsafePointer<UInt8>?, Int, UnsafePointer<UInt8>?, Int, UnsafeMutableRawPointer?
) -> Int32
public typealias ZManagerPromiseOutcomeCallback = @convention(c) (Int32, UnsafeMutableRawPointer?) -> Void

private struct PromiseDragItem: Decodable {
    let entryPath: String
    let promisedName: String
    let fileType: String
}

@MainActor
private final class PromiseDragSource: NSObject, NSDraggingSource {
    let sessionID: String
    let writers: [FilePromiseStreamWriter]
    let outcome: ZManagerPromiseOutcomeCallback
    let context: UnsafeMutableRawPointer?

    init(
        sessionID: String,
        writers: [FilePromiseStreamWriter],
        outcome: @escaping ZManagerPromiseOutcomeCallback,
        context: UnsafeMutableRawPointer?
    ) {
        self.sessionID = sessionID
        self.writers = writers
        self.outcome = outcome
        self.context = context
    }

    func draggingSession(
        _: NSDraggingSession,
        sourceOperationMaskFor _: NSDraggingContext
    ) -> NSDragOperation { .copy }

    func draggingSession(_: NSDraggingSession, endedAt _: NSPoint, operation: NSDragOperation) {
        outcome(operation.isEmpty ? 1 : 0, context)
        ActivePromiseDrags.shared.remove(sessionID)
    }
}

@MainActor
private final class ActivePromiseDrags {
    static let shared = ActivePromiseDrags()
    private var sources: [String: PromiseDragSource] = [:]
    func retain(_ source: PromiseDragSource) { sources[source.sessionID] = source }
    func remove(_ id: String) { sources.removeValue(forKey: id) }
}

private final class PromiseStartInput: @unchecked Sendable {
    let view: NSView
    let sessionID: String
    let items: [PromiseDragItem]
    let write: ZManagerPromiseWriteCallback
    let outcome: ZManagerPromiseOutcomeCallback
    let context: UnsafeMutableRawPointer?
    var result: Int32 = 0

    init(
        view: NSView,
        sessionID: String,
        items: [PromiseDragItem],
        write: @escaping ZManagerPromiseWriteCallback,
        outcome: @escaping ZManagerPromiseOutcomeCallback,
        context: UnsafeMutableRawPointer?
    ) {
        self.view = view
        self.sessionID = sessionID
        self.items = items
        self.write = write
        self.outcome = outcome
        self.context = context
    }

    @MainActor func start() {
        guard let event = NSApplication.shared.currentEvent else { result = 4; return }
        var writers: [FilePromiseStreamWriter] = []
        var draggingItems: [NSDraggingItem] = []
        for (index, item) in items.enumerated() {
            let writer = FilePromiseStreamWriter(promisedName: item.promisedName) { [self] destination in
                let entry = Data(item.entryPath.utf8)
                let path = Data(destination.path.utf8)
                let status = entry.withUnsafeBytes { entryBytes in
                    path.withUnsafeBytes { pathBytes in
                        write(
                            entryBytes.bindMemory(to: UInt8.self).baseAddress,
                            entryBytes.count,
                            pathBytes.bindMemory(to: UInt8.self).baseAddress,
                            pathBytes.count,
                            context
                        )
                    }
                }
                if status != 0 {
                    throw NSError(domain: "ZManagerPromiseDrag", code: Int(status))
                }
            }
            let provider = NSFilePromiseProvider(fileType: item.fileType, delegate: writer)
            let draggingItem = NSDraggingItem(pasteboardWriter: provider)
            draggingItem.setDraggingFrame(
                NSRect(x: CGFloat(index * 8), y: 0, width: 32, height: 32),
                contents: NSWorkspace.shared.icon(forFileType: item.fileType)
            )
            writers.append(writer)
            draggingItems.append(draggingItem)
        }
        let source = PromiseDragSource(
            sessionID: sessionID,
            writers: writers,
            outcome: outcome,
            context: context
        )
        ActivePromiseDrags.shared.retain(source)
        view.beginDraggingSession(with: draggingItems, event: event, source: source)
    }
}

@_cdecl("zmanager_macos_start_promise_drag")
public func zmanagerMacOSStartPromiseDrag(
    _ viewPointer: UnsafeMutableRawPointer?,
    _ sessionBytes: UnsafePointer<UInt8>?,
    _ sessionLength: Int,
    _ itemBytes: UnsafePointer<UInt8>?,
    _ itemLength: Int,
    _ write: ZManagerPromiseWriteCallback?,
    _ outcome: ZManagerPromiseOutcomeCallback?,
    _ context: UnsafeMutableRawPointer?
) -> Int32 {
    guard let viewPointer, let sessionBytes, let itemBytes, let write, let outcome,
          sessionLength > 0, sessionLength <= 128, itemLength > 0, itemLength <= 1_048_576,
          let sessionID = String(data: Data(bytes: sessionBytes, count: sessionLength), encoding: .utf8),
          let items = try? JSONDecoder().decode(
              [PromiseDragItem].self,
              from: Data(bytes: itemBytes, count: itemLength)
          ), !items.isEmpty, items.count <= 1_024
    else { return 1 }
    let input = PromiseStartInput(
        view: Unmanaged<NSView>.fromOpaque(viewPointer).takeUnretainedValue(),
        sessionID: sessionID,
        items: items,
        write: write,
        outcome: outcome,
        context: context
    )
    if Thread.isMainThread { MainActor.assumeIsolated { input.start() } }
    else { DispatchQueue.main.sync { input.start() } }
    return input.result
}
