import ZManagerGenerated
import AppKit
import CoreServices
import Darwin
import Foundation
import UniformTypeIdentifiers
import ZManagerMacOSShared

private let replacementMigrationMaximumBytes = MacOSFFILimits.maxRequestBytes
private let replacementMigrationSchemaVersion = 1
private let legacyPreferenceKeys: Set<String> = [
    "defaultArchiveFormat",
    "defaultCleanSourceEnabled",
    "defaultCreateProfile",
    "defaultOutputLocation",
    "customOutputFolderPath",
    "quickOpenExtractionEnabled",
    "quickExtractionLocation",
    "quickExtractionFolderPath",
    "previewCleanupPolicy",
]

struct LegacyReplacementMigrationRequest: Codable, Equatable {
    let schemaVersion: Int
    let legacyBundleID: String
    let currentApplicationPath: String
    let legacyAccountStateDirectory: String
    let temporaryDirectory: String
    let legacyApplicationCandidates: [String]

    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case legacyBundleID = "legacyBundleId"
        case currentApplicationPath
        case legacyAccountStateDirectory
        case temporaryDirectory
        case legacyApplicationCandidates
    }
}

struct LegacyReplacementPreferences: Codable, Equatable {
    var defaultArchiveFormat: String?
    var defaultCleanSourceEnabled: Bool?
    var legacyDefaultCreateProfile: String?
    var defaultOutputLocation: String?
    var customOutputFolderPath: String?
    var quickOpenExtractionEnabled: Bool?
    var quickExtractionLocation: String?
    var quickExtractionFolderPath: String?
    var previewCleanupPolicy: String?
}

struct ReplacementMigrationDiagnostic: Codable, Equatable {
    let key: String
    let code: String
}

struct LegacyReplacementMigrationSnapshot: Codable, Equatable {
    let schemaVersion: Int
    let preferences: LegacyReplacementPreferences
    let defaultHandlerRestore: [String: String]
    let legacyAccountStateDirectory: String?
    let stalePreviewRoots: [String]
    let legacyRegistrationPaths: [String]
    let registrationOwners: [String: String]
    let diagnostics: [ReplacementMigrationDiagnostic]
}

struct LegacyRegistrationReconcileRequest: Codable, Equatable {
    let schemaVersion: Int
    let legacyBundleID: String
    let currentApplicationPath: String
    let legacyApplicationPaths: [String]

    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case legacyBundleID = "legacyBundleId"
        case currentApplicationPath
        case legacyApplicationPaths
    }
}

struct LegacyRegistrationReconcileResult: Codable, Equatable {
    let diagnostics: [ReplacementMigrationDiagnostic]
}

struct RegistrationCommand: Equatable {
    let executable: String
    let arguments: [String]
    let diagnosticKey: String
}

enum LegacyReplacementMigrationReader {
    static func read(
        request: LegacyReplacementMigrationRequest,
        domain: [String: Any],
        fileManager: FileManager = .default,
        processIsRunning: (Int32) -> Bool = defaultProcessIsRunning
    ) -> LegacyReplacementMigrationSnapshot {
        var diagnostics: [ReplacementMigrationDiagnostic] = []
        let preferences = decodePreferences(domain: domain, diagnostics: &diagnostics)
        let restore = decodeDefaultHandlers(domain: domain, diagnostics: &diagnostics)
        let accountDirectory = existingDirectory(
            request.legacyAccountStateDirectory,
            fileManager: fileManager
        )
        let previewRoots = stalePreviewRoots(
            in: request.temporaryDirectory,
            fileManager: fileManager,
            processIsRunning: processIsRunning
        )
        let registrations = legacyRegistrationPaths(
            request: request,
            fileManager: fileManager
        )
        let registrationOwners = currentRegistrationOwners()

        if domain.keys.contains(where: { !legacyPreferenceKeys.contains($0) && $0 == "defaultOpenerSavedPreviousHandlers" }) {
            // The default-handler value is decoded separately and deliberately
            // excluded from the preference DTO.
        }

        return LegacyReplacementMigrationSnapshot(
            schemaVersion: replacementMigrationSchemaVersion,
            preferences: preferences,
            defaultHandlerRestore: restore,
            legacyAccountStateDirectory: accountDirectory,
            stalePreviewRoots: previewRoots,
            legacyRegistrationPaths: registrations,
            registrationOwners: registrationOwners,
            diagnostics: diagnostics
        )
    }

    static func decodePreferences(
        domain: [String: Any],
        diagnostics: inout [ReplacementMigrationDiagnostic]
    ) -> LegacyReplacementPreferences {
        func string(
            _ key: String,
            allowed: Set<String>? = nil,
            path: Bool = false
        ) -> String? {
            guard let raw = domain[key] else { return nil }
            guard let value = raw as? String, !value.isEmpty, value.utf8.count <= 4_096,
                  allowed?.contains(value) ?? true,
                  !path || value.hasPrefix("/")
            else {
                diagnostics.append(.init(key: key, code: "invalid_value"))
                return nil
            }
            return path ? URL(filePath: value).standardizedFileURL.path : value
        }

        func boolean(_ key: String) -> Bool? {
            guard let raw = domain[key] else { return nil }
            guard CFGetTypeID(raw as CFTypeRef) == CFBooleanGetTypeID(), let value = raw as? Bool else {
                diagnostics.append(.init(key: key, code: "invalid_value"))
                return nil
            }
            return value
        }

        return LegacyReplacementPreferences(
            defaultArchiveFormat: string(
                "defaultArchiveFormat",
                allowed: ["tarZst", "tarGz", "tzap", "sevenZ", "zip"]
            ),
            defaultCleanSourceEnabled: boolean("defaultCleanSourceEnabled"),
            legacyDefaultCreateProfile: string(
                "defaultCreateProfile",
                allowed: ["zip", "cleanSource"]
            ),
            defaultOutputLocation: string(
                "defaultOutputLocation",
                allowed: ["sourceFolder", "customFolder"]
            ),
            customOutputFolderPath: string("customOutputFolderPath", path: true),
            quickOpenExtractionEnabled: boolean("quickOpenExtractionEnabled"),
            quickExtractionLocation: string(
                "quickExtractionLocation",
                allowed: ["archiveFolder", "chosenFolder"]
            ),
            quickExtractionFolderPath: string("quickExtractionFolderPath", path: true),
            previewCleanupPolicy: string(
                "previewCleanupPolicy",
                allowed: ["beforeNextPreview", "whenAppCloses"]
            )
        )
    }

    static func decodeDefaultHandlers(
        domain: [String: Any],
        diagnostics: inout [ReplacementMigrationDiagnostic]
    ) -> [String: String] {
        guard let raw = domain["defaultOpenerSavedPreviousHandlers"] else { return [:] }
        guard let dictionary = raw as? [String: Any], dictionary.count <= 256 else {
            diagnostics.append(.init(key: "defaultOpenerSavedPreviousHandlers", code: "invalid_value"))
            return [:]
        }
        var result: [String: String] = [:]
        for (contentType, rawHandler) in dictionary {
            guard validIdentifier(contentType), let handler = rawHandler as? String,
                  validIdentifier(handler)
            else {
                diagnostics.append(.init(key: "defaultOpenerSavedPreviousHandlers", code: "invalid_entry"))
                continue
            }
            result[contentType] = handler
        }
        return result
    }

    static func stalePreviewRoots(
        in temporaryDirectory: String,
        fileManager: FileManager,
        processIsRunning: (Int32) -> Bool
    ) -> [String] {
        guard temporaryDirectory.hasPrefix("/") else { return [] }
        let directory = URL(filePath: temporaryDirectory, directoryHint: .isDirectory)
            .standardizedFileURL
        guard let children = try? fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        return children.compactMap { child in
            let name = child.lastPathComponent
            guard name.hasPrefix("zmanager-preview-"),
                  let values = try? child.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]),
                  values.isDirectory == true,
                  values.isSymbolicLink != true
            else { return nil }
            let suffix = name.dropFirst("zmanager-preview-".count)
            let fields = suffix.split(separator: "-", maxSplits: 1)
            if fields.count == 2, let owner = Int32(fields[0]), owner > 0,
               !fields[1].isEmpty, fields[1].allSatisfy(\.isNumber), processIsRunning(owner) {
                return nil
            }
            return child.standardizedFileURL.path
        }.sorted()
    }

    static func legacyRegistrationPaths(
        request: LegacyReplacementMigrationRequest,
        fileManager: FileManager
    ) -> [String] {
        let current = URL(filePath: request.currentApplicationPath).standardizedFileURL.path
        return request.legacyApplicationCandidates.prefix(8).compactMap { candidate in
            guard candidate.hasPrefix("/") else { return nil }
            let path = URL(filePath: candidate).standardizedFileURL.path
            guard path != current, path.hasSuffix(".app"), fileManager.fileExists(atPath: path),
                  Bundle(path: path)?.bundleIdentifier == request.legacyBundleID
            else { return nil }
            return path
        }.uniqued().sorted()
    }

    static func registrationCommands(
        request: LegacyRegistrationReconcileRequest,
        fileManager: FileManager = .default
    ) -> [RegistrationCommand] {
        let lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
        let current = URL(filePath: request.currentApplicationPath).standardizedFileURL.path
        guard current.hasSuffix(".app"), fileManager.fileExists(atPath: current),
              Bundle(path: current)?.bundleIdentifier == request.legacyBundleID
        else { return [] }
        var commands = [RegistrationCommand(
            executable: lsregister,
            arguments: ["-f", current],
            diagnosticKey: "registration.currentApplication"
        )]
        for legacyPath in request.legacyApplicationPaths.prefix(8) {
            let legacy = URL(filePath: legacyPath).standardizedFileURL.path
            guard legacy != current, legacy.hasSuffix(".app"), fileManager.fileExists(atPath: legacy),
                  Bundle(path: legacy)?.bundleIdentifier == request.legacyBundleID
            else { continue }
            let pluginRoot = URL(filePath: legacy, directoryHint: .isDirectory)
                .appending(path: "Contents/PlugIns")
            if let plugins = try? fileManager.contentsOfDirectory(
                at: pluginRoot,
                includingPropertiesForKeys: [.isDirectoryKey],
                options: [.skipsHiddenFiles]
            ) {
                for plugin in plugins where plugin.pathExtension == "appex" {
                    commands.append(.init(
                        executable: "/usr/bin/pluginkit",
                        arguments: ["-r", plugin.path],
                        diagnosticKey: "registration.legacyExtension"
                    ))
                }
            }
            commands.append(.init(
                executable: lsregister,
                arguments: ["-u", legacy],
                diagnosticKey: "registration.legacyApplication"
            ))
        }
        commands.append(.init(
            executable: "/usr/bin/pluginkit",
            arguments: ["-a", current],
            diagnosticKey: "registration.currentExtensions"
        ))
        return commands
    }

    private static func existingDirectory(_ path: String, fileManager: FileManager) -> String? {
        guard path.hasPrefix("/") else { return nil }
        let standardized = URL(filePath: path, directoryHint: .isDirectory).standardizedFileURL
        guard let values = try? standardized.resourceValues(
            forKeys: [.isDirectoryKey, .isSymbolicLinkKey]
        ), values.isDirectory == true, values.isSymbolicLink != true else { return nil }
        return standardized.path
    }

    private static func currentRegistrationOwners() -> [String: String] {
        var owners: [String: String] = [:]
        if let url = URL(string: "zmanager://"),
           let appURL = NSWorkspace.shared.urlForApplication(toOpen: url),
           let bundleID = Bundle(url: appURL)?.bundleIdentifier {
            owners["urlScheme.zmanager"] = bundleID
        }
        if let type = UTType(filenameExtension: "tzap"),
           let handler = LSCopyDefaultRoleHandlerForContentType(type.identifier as CFString, .all)?
            .takeRetainedValue() as String? {
            owners["contentType.tzap"] = handler
        }
        return owners
    }

    private static func validIdentifier(_ value: String) -> Bool {
        !value.isEmpty && value.utf8.count <= 255
            && value.split(separator: ".", omittingEmptySubsequences: false).allSatisfy { component in
                !component.isEmpty && component.allSatisfy {
                    $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_"
                }
            }
    }

    private static func defaultProcessIsRunning(_ processIdentifier: Int32) -> Bool {
        if kill(processIdentifier, 0) == 0 { return true }
        return errno == EPERM
    }
}

private extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

@_cdecl("zmanager_macos_read_replacement_migration")
public func zmanagerMacOSReadReplacementMigration(
    _ bytes: UnsafePointer<UInt8>?,
    _ count: Int,
    _ callback: ZManagerHostCallback?,
    _ context: UnsafeMutableRawPointer?
) -> Int32 {
    guard let bytes, count > 0, count <= replacementMigrationMaximumBytes, let callback,
          let request = try? JSONDecoder().decode(
              LegacyReplacementMigrationRequest.self,
              from: Data(bytes: bytes, count: count)
          ), request.schemaVersion == replacementMigrationSchemaVersion,
          request.legacyBundleID == "com.frankmanzhu.zmanager",
          request.legacyApplicationCandidates.count <= 8
    else { return MacOSFFIErrorMapping.invalidPayload }
    let domain = UserDefaults.standard.persistentDomain(forName: request.legacyBundleID) ?? [:]
    let snapshot = LegacyReplacementMigrationReader.read(request: request, domain: domain)
    guard let output = try? JSONEncoder().encode(snapshot) else { return MacOSFFIErrorMapping.systemError }
    output.withUnsafeBytes { buffer in
        callback(buffer.bindMemory(to: UInt8.self).baseAddress, buffer.count, context)
    }
    return 0
}

@_cdecl("zmanager_macos_reconcile_legacy_registrations")
public func zmanagerMacOSReconcileLegacyRegistrations(
    _ bytes: UnsafePointer<UInt8>?,
    _ count: Int,
    _ callback: ZManagerHostCallback?,
    _ context: UnsafeMutableRawPointer?
) -> Int32 {
    guard let bytes, count > 0, count <= replacementMigrationMaximumBytes, let callback,
          let request = try? JSONDecoder().decode(
              LegacyRegistrationReconcileRequest.self,
              from: Data(bytes: bytes, count: count)
          ), request.schemaVersion == replacementMigrationSchemaVersion,
          request.legacyBundleID == "com.frankmanzhu.zmanager",
          request.legacyApplicationPaths.count <= 8
    else { return MacOSFFIErrorMapping.invalidPayload }
    var diagnostics: [ReplacementMigrationDiagnostic] = []
    for command in LegacyReplacementMigrationReader.registrationCommands(request: request) {
        let process = Process()
        process.executableURL = URL(filePath: command.executable)
        process.arguments = command.arguments
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            process.waitUntilExit()
            let alreadyAbsentIsSuccess = command.diagnosticKey.hasPrefix("registration.legacy")
            if process.terminationStatus != 0 && !alreadyAbsentIsSuccess {
                diagnostics.append(.init(key: command.diagnosticKey, code: "operation_failed"))
            }
        } catch {
            diagnostics.append(.init(key: command.diagnosticKey, code: "operation_failed"))
        }
    }
    let result = LegacyRegistrationReconcileResult(diagnostics: diagnostics)
    guard let output = try? JSONEncoder().encode(result) else { return MacOSFFIErrorMapping.systemError }
    output.withUnsafeBytes { buffer in
        callback(buffer.bindMemory(to: UInt8.self).baseAddress, buffer.count, context)
    }
    return 0
}
