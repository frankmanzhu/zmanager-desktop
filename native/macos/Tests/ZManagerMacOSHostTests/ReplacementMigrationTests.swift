import Foundation
import Testing
@testable import ZManagerMacOSHost

@Test
func migrationReaderAllowListsValuesAndReportsKeysWithoutValues() throws {
    let root = URL(filePath: NSTemporaryDirectory(), directoryHint: .isDirectory)
        .appending(path: "zmanager-migration-reader-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let account = root.appending(path: "account", directoryHint: .isDirectory)
    let live = root.appending(path: "zmanager-preview-42-1", directoryHint: .isDirectory)
    let stale = root.appending(path: "zmanager-preview-99-2", directoryHint: .isDirectory)
    let hostile = root.appending(path: "zmanager-preview-99-bad", directoryHint: .isDirectory)
    for directory in [account, live, stale, hostile] {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }
    let request = LegacyReplacementMigrationRequest(
        schemaVersion: 1,
        legacyBundleID: "com.frankmanzhu.zmanager",
        currentApplicationPath: root.appending(path: "ZManager.app").path,
        legacyAccountStateDirectory: account.path,
        temporaryDirectory: root.path,
        legacyApplicationCandidates: []
    )
    let snapshot = LegacyReplacementMigrationReader.read(
        request: request,
        domain: [
            "defaultArchiveFormat": "tzap",
            "defaultCleanSourceEnabled": true,
            "defaultOutputLocation": "invalid-secret-value",
            "customOutputFolderPath": "/Users/example/Archives",
            "defaultOpenerSavedPreviousHandlers": [
                "public.zip-archive": "com.apple.ArchiveUtility",
                "invalid key": "should-not-leak",
            ],
            "accessToken": "must-not-be-read",
        ],
        processIsRunning: { $0 == 42 }
    )
    #expect(snapshot.preferences.defaultArchiveFormat == "tzap")
    #expect(snapshot.preferences.defaultCleanSourceEnabled == true)
    #expect(snapshot.preferences.defaultOutputLocation == nil)
    #expect(snapshot.defaultHandlerRestore == [
        "public.zip-archive": "com.apple.ArchiveUtility",
    ])
    #expect(snapshot.legacyAccountStateDirectory == account.path)
    #expect(snapshot.stalePreviewRoots == [hostile.path, stale.path].sorted())
    #expect(snapshot.diagnostics.contains(.init(key: "defaultOutputLocation", code: "invalid_value")))
    let encoded = String(data: try JSONEncoder().encode(snapshot.diagnostics), encoding: .utf8)!
    #expect(!encoded.contains("invalid-secret-value"))
    #expect(!encoded.contains("should-not-leak"))
    #expect(!encoded.contains("must-not-be-read"))
}

@Test
func missingDirectoriesAndMalformedLegacyDataProduceANonBlockingSnapshot() {
    let missing = URL(filePath: NSTemporaryDirectory()).appending(path: UUID().uuidString)
    let request = LegacyReplacementMigrationRequest(
        schemaVersion: 1,
        legacyBundleID: "com.frankmanzhu.zmanager",
        currentApplicationPath: missing.appending(path: "current.app").path,
        legacyAccountStateDirectory: missing.appending(path: "account").path,
        temporaryDirectory: missing.appending(path: "tmp").path,
        legacyApplicationCandidates: ["relative.app"]
    )
    let snapshot = LegacyReplacementMigrationReader.read(
        request: request,
        domain: [
            "defaultArchiveFormat": 123,
            "defaultOpenerSavedPreviousHandlers": "corrupt",
        ]
    )
    #expect(snapshot.legacyAccountStateDirectory == nil)
    #expect(snapshot.stalePreviewRoots.isEmpty)
    #expect(snapshot.legacyRegistrationPaths.isEmpty)
    #expect(snapshot.diagnostics.map(\.key).contains("defaultArchiveFormat"))
    #expect(snapshot.diagnostics.map(\.key).contains("defaultOpenerSavedPreviousHandlers"))
}

@Test
func registrationPlanAlwaysRegistersCurrentBeforeRemovingExactLegacyPaths() throws {
    let root = URL(filePath: NSTemporaryDirectory(), directoryHint: .isDirectory)
        .appending(path: "zmanager-registration-plan-\(UUID().uuidString)")
    let current = root.appending(path: "ZManager.app", directoryHint: .isDirectory)
    let legacy = root.appending(path: "ZManager.app", directoryHint: .isDirectory)
    try makeApp(at: current, bundleID: "com.frankmanzhu.zmanager")
    try makeApp(at: legacy, bundleID: "com.frankmanzhu.zmanager")
    defer { try? FileManager.default.removeItem(at: root) }
    let commands = LegacyReplacementMigrationReader.registrationCommands(request: .init(
        schemaVersion: 1,
        legacyBundleID: "com.frankmanzhu.zmanager",
        currentApplicationPath: current.path,
        legacyApplicationPaths: [legacy.path, current.path, "/Applications/Unrelated.app"]
    ))
    #expect(commands.first?.arguments == ["-f", current.path])
    #expect(commands.contains { $0.arguments == ["-u", legacy.path] })
    #expect(!commands.contains { $0.arguments == ["-u", current.path] })
    #expect(commands.last?.arguments == ["-a", current.path])
}

private func makeApp(at url: URL, bundleID: String) throws {
    let contents = url.appending(path: "Contents", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: contents, withIntermediateDirectories: true)
    let plist: [String: Any] = [
        "CFBundleIdentifier": bundleID,
        "CFBundleExecutable": "stub",
        "CFBundlePackageType": "APPL",
    ]
    let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
    try data.write(to: contents.appending(path: "Info.plist"))
}
