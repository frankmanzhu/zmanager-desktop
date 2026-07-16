import AppKit
import Foundation

public final class FilePromiseStreamWriter: NSObject, NSFilePromiseProviderDelegate, @unchecked Sendable {
    public typealias Stream = @Sendable (URL) throws -> Void
    private let promisedName: String
    private let stream: Stream

    public init(promisedName: String, stream: @escaping Stream) {
        self.promisedName = promisedName
        self.stream = stream
    }

    public func filePromiseProvider(_ filePromiseProvider: NSFilePromiseProvider, fileNameForType fileType: String) -> String {
        promisedName
    }

    public func filePromiseProvider(
        _ filePromiseProvider: NSFilePromiseProvider,
        writePromiseTo url: URL,
        completionHandler: @escaping (Error?) -> Void
    ) {
        do { try stream(url.appending(path: promisedName)); completionHandler(nil) }
        catch { completionHandler(error) }
    }

    public func operationQueue(for filePromiseProvider: NSFilePromiseProvider) -> OperationQueue {
        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1
        return queue
    }
}
