import Foundation
import Testing
@testable import ZManagerMacOSHost

private final class CallbackState: @unchecked Sendable {
    var payload: Data?
}

private func callback(bytes: UnsafePointer<UInt8>?, count: Int, context: UnsafeMutableRawPointer?) {
    guard let context else { return }
    let state = Unmanaged<CallbackState>.fromOpaque(context).takeUnretainedValue()
    state.payload = bytes.map { Data(bytes: $0, count: count) }
}

@Test @MainActor func hostStartsRegistersOnceAndShutsDownWithoutSyntheticEvents() throws {
    let state = CallbackState()
    let context = Unmanaged.passUnretained(state).toOpaque()
    #expect(zmanagerMacOSHostStart(callback, context) == 0)
    #expect(zmanagerMacOSHostIsRunning())
    #expect(state.payload == nil)
    #expect(zmanagerMacOSHostStart(callback, context) == 2)
    zmanagerMacOSHostShutdown()
    #expect(!zmanagerMacOSHostIsRunning())
}

@Test func nativeEventsAreVersionedTypedAndBounded() throws {
    let data = try NativeHostEventEncoder.encode(
        kind: .openPaths,
        payload: ["paths": ["/tmp/demo.zip"]],
        eventID: "event-1234567890",
        timestampUnixMs: 42
    )
    let object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    #expect(object["version"] as? Int == 1)
    #expect(object["eventId"] as? String == "event-1234567890")
    #expect(object["kind"] as? String == "openPaths")
    #expect(object["timestampUnixMs"] as? Int == 42)
    let payload = try #require(object["payload"] as? [String: Any])
    #expect(payload["paths"] as? [String] == ["/tmp/demo.zip"])
    #expect(data.count < 1_048_576)
}

@Test func urlRoutingKeepsAuthenticationSecretsOutOfCallbacks() throws {
    let valid = try #require(URL(string:
        "zmanager://auth-callback?state=state-1234567890&result=completed"
    ))
    #expect(NativeHostEventEncoder.hostedAuthPayload(from: valid)?["state"] as? String
        == "state-1234567890")
    let secret = try #require(URL(string:
        "zmanager://auth-callback?state=state-1234567890&result=completed&code=secret"
    ))
    #expect(NativeHostEventEncoder.hostedAuthPayload(from: secret) == nil)

    let shell = try #require(URL(string:
        "zmanager://shell-action/abcdefghijklmnopqrstuv"
    ))
    #expect(NativeHostEventEncoder.shellActionToken(from: shell)
        == "abcdefghijklmnopqrstuv")
}

@Test @MainActor func lifecycleFiltersInvalidPathsAndEmitsExactlyOneEvent() throws {
    var delivered: [Data] = []
    let lifecycle = NativeHostLifecycle { delivered.append($0) }
    lifecycle.emitOpenPaths(["", "https://example.com/archive.zip", "/tmp/demo.zip"])
    #expect(delivered.count == 1)
    let object = try #require(JSONSerialization.jsonObject(with: delivered[0]) as? [String: Any])
    #expect(object["kind"] as? String == "openPaths")
    let payload = try #require(object["payload"] as? [String: Any])
    #expect(payload["paths"] as? [String] == ["/tmp/demo.zip"])
}

@Test @MainActor func nativeIconOperationReturnsBatchedPngDataURLs() throws {
    let requests = try JSONSerialization.data(withJSONObject: [[
        "key": "folder", "path": FileManager.default.temporaryDirectory.path, "isDirectory": true,
    ]])
    let state = CallbackState()
    let context = Unmanaged.passUnretained(state).toOpaque()
    let status = requests.withUnsafeBytes { bytes in
        zmanagerMacOSSystemFileIcons(
            bytes.bindMemory(to: UInt8.self).baseAddress,
            bytes.count,
            callback,
            context
        )
    }
    #expect(status == 0)
    let data = try #require(state.payload)
    let rows = try #require(JSONSerialization.jsonObject(with: data) as? [[String: Any]])
    #expect(rows.count == 1)
    #expect(rows[0]["key"] as? String == "folder")
    #expect((rows[0]["dataUrl"] as? String)?.hasPrefix("data:image/png;base64,") == true)
}
