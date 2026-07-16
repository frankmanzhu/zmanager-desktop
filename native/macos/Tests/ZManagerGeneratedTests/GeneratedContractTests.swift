import Foundation
import Testing
@testable import ZManagerGenerated

private struct Fixture: Decodable {
    let actionOrder: [String]
    let inboundEventKinds: [String]
}

@Test func generatedSwiftContractsMatchSharedFixture() throws {
    let testFile = URL(fileURLWithPath: #filePath)
    let repositoryRoot = testFile
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
    let fixtureURL = repositoryRoot.appending(path: "fixtures/contracts/native-contracts.conformance.json")
    let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: fixtureURL))
    #expect(ShellActionPolicy.all.map(\.id.rawValue) == fixture.actionOrder)
    #expect(NativeInboundEventKind.allCases.map(\.rawValue) == fixture.inboundEventKinds)
    #expect(ArchiveFileTypes.compoundExtensions.contains("tar.gz"))
    #expect(ArchiveFileTypes.splitArchiveSuffixes == [".7z.001", ".vol000.tzap"])
}
