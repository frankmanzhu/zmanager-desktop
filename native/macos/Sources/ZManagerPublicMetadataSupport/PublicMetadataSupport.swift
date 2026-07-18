import Foundation

public struct PublicMetadataSummary: Equatable, Sendable {
    public enum SignatureStatus: Equatable, Sendable {
        case verified
        case inspected
        case unavailable
    }

    public let fileName: String
    public let errorMessage: String?
    public let signatureStatus: SignatureStatus
    public let signatureMessage: String?
    public let signer: String?
    public let issuer: String?
    public let serialNumber: String?
    public let certificateSHA256: String?
    public let expectedVolumeCount: UInt64?
    public let presentVolumeCount: UInt64?
    public let missingVolumeIndices: [UInt64]
    public let totalSize: UInt64?
    public let expectedVolumeSize: UInt64?
    public let formatVersion: UInt64?
    public let volumeFormatRevision: UInt64?
    public let compressionAlgorithm: String?
    public let encryptionAlgorithm: String?
    public let recoveryAlgorithm: String?
    public let keyDerivation: String?
    public let passwordRequired: Bool?
    public let bitRotBufferPercentage: UInt64?
    public let volumeLossTolerance: UInt64?
    public let dataShardCount: UInt64?
    public let parityShardCount: UInt64?
    public let archiveUUID: String?

    public static func parse(fileName: String, json: String) -> Self {
        guard json.utf8.count <= 1_048_576,
              let data = json.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return failure(fileName: fileName, message: "The metadata response is invalid.")
        }
        return parse(fileName: fileName, object: object)
    }

    public static func parse(fileName: String, object: [String: Any]) -> Self {
        guard object["ok"] as? Bool == true else {
            return failure(
                fileName: fileName,
                message: string(object["message"]) ?? "This does not look like a valid TZAP archive."
            )
        }
        let metadata = dictionary(object["metadata"])
        let format = dictionary(metadata["format"])
        let signature = dictionary(object["signature"])
        let rootAuth = dictionary(signature["root_auth"])
        let signatureStatus: SignatureStatus = switch string(signature["status"]) {
        case "verified": .verified
        case "unverified": .inspected
        default: .unavailable
        }
        return Self(
            fileName: fileName,
            errorMessage: nil,
            signatureStatus: signatureStatus,
            signatureMessage: string(signature["message"]),
            signer: string(rootAuth["subject"]),
            issuer: string(rootAuth["issuer"]),
            serialNumber: string(rootAuth["serial_number"]),
            certificateSHA256: string(rootAuth["certificate_sha256"]),
            expectedVolumeCount: uint(metadata["expected_volume_count"]),
            presentVolumeCount: uint(metadata["present_volume_count"]),
            missingVolumeIndices: uintArray(metadata["missing_volume_indices"]),
            totalSize: uint(metadata["total_size"]),
            expectedVolumeSize: uint(metadata["expected_volume_size"]),
            formatVersion: uint(format["format_version"]),
            volumeFormatRevision: uint(format["volume_format_revision"]),
            compressionAlgorithm: string(format["compression_algorithm"]),
            encryptionAlgorithm: string(format["encryption_algorithm"]),
            recoveryAlgorithm: string(format["recovery_algorithm"]),
            keyDerivation: string(format["key_derivation"]),
            passwordRequired: format["password_required"] as? Bool,
            bitRotBufferPercentage: uint(format["bit_rot_buffer_percentage"]),
            volumeLossTolerance: uint(format["volume_loss_tolerance"]),
            dataShardCount: uint(format["data_shard_count"]),
            parityShardCount: uint(format["parity_shard_count"]),
            archiveUUID: string(format["archive_uuid"])
        )
    }

    private static func failure(fileName: String, message: String) -> Self {
        Self(
            fileName: fileName,
            errorMessage: message,
            signatureStatus: .unavailable,
            signatureMessage: nil,
            signer: nil,
            issuer: nil,
            serialNumber: nil,
            certificateSHA256: nil,
            expectedVolumeCount: nil,
            presentVolumeCount: nil,
            missingVolumeIndices: [],
            totalSize: nil,
            expectedVolumeSize: nil,
            formatVersion: nil,
            volumeFormatRevision: nil,
            compressionAlgorithm: nil,
            encryptionAlgorithm: nil,
            recoveryAlgorithm: nil,
            keyDerivation: nil,
            passwordRequired: nil,
            bitRotBufferPercentage: nil,
            volumeLossTolerance: nil,
            dataShardCount: nil,
            parityShardCount: nil,
            archiveUUID: nil
        )
    }

    private static func dictionary(_ value: Any?) -> [String: Any] {
        value as? [String: Any] ?? [:]
    }

    private static func string(_ value: Any?) -> String? {
        guard let value = value as? String, !value.isEmpty, value.utf8.count <= 4_096 else { return nil }
        return value
    }

    private static func uint(_ value: Any?) -> UInt64? {
        guard let number = value as? NSNumber, number.doubleValue >= 0 else { return nil }
        return number.uint64Value
    }

    private static func uintArray(_ value: Any?) -> [UInt64] {
        guard let values = value as? [Any], values.count <= 4_096 else { return [] }
        return values.compactMap(uint)
    }
}

public enum PublicMetadataHTML {
    public static let contentSize = CGSize(width: 920, height: 720)

    public static func render(_ summary: PublicMetadataSummary) -> String {
        let status: (String, String)
        if let error = summary.errorMessage {
            status = ("Preview unavailable", error)
        } else {
            status = switch summary.signatureStatus {
            case .verified: ("Signature verified", summary.signer ?? "The signing certificate is trusted.")
            case .inspected: ("Signature inspected", summary.signer ?? summary.signatureMessage ?? "System trust was not established.")
            case .unavailable: ("Public metadata", summary.signatureMessage ?? "No public signer certificate is available.")
            }
        }
        let format = [summary.compressionAlgorithm, summary.encryptionAlgorithm]
            .compactMap { $0 }.joined(separator: " · ")
        let volumes = volumeText(summary)
        let rows: [(String, String?)] = [
            ("Format", format.isEmpty ? nil : format),
            ("Volumes", volumes),
            ("Total size", summary.totalSize.map(byteText)),
            ("Password", summary.passwordRequired.map { $0 ? "Required" : "Not required" }),
            ("Recovery", recoveryText(summary)),
            ("Key derivation", summary.keyDerivation),
            ("Signer", summary.signer),
            ("Issuer", summary.issuer),
            ("Certificate serial", summary.serialNumber),
            ("Certificate SHA-256", summary.certificateSHA256),
            ("Archive UUID", summary.archiveUUID),
        ]
        let body = rows.compactMap { label, value in
            value.map { "<dt>\(escape(label))</dt><dd>\(escape($0))</dd>" }
        }.joined()
        return """
        <!doctype html><html><head><meta charset="utf-8"><style>
        :root{color-scheme:light dark}body{margin:0;background:#f4f5f6;color:#202428;font:15px -apple-system-body}
        @media(prefers-color-scheme:dark){body{background:#17191b;color:#f2f4f5}.card{background:#23272a!important;border-color:#3b4247!important}}
        main{box-sizing:border-box;max-width:920px;margin:auto;padding:28px}h1{overflow-wrap:anywhere;margin:0 0 6px}
        .kind{color:#69747b;margin-bottom:18px}.card{background:white;border:1px solid #d8dde0;border-radius:12px;padding:18px;margin-bottom:16px}
        .card h2{margin:0 0 6px}dl{display:grid;grid-template-columns:180px minmax(0,1fr);gap:10px 18px;margin:0}
        dt{color:#69747b}dd{margin:0;overflow-wrap:anywhere}
        </style></head><body><main><h1>\(escape(summary.fileName))</h1><div class="kind">TZAP archive</div>
        <section class="card"><h2>\(escape(status.0))</h2><div>\(escape(status.1))</div></section>
        <section class="card"><dl>\(body)</dl></section></main></body></html>
        """
    }

    private static func volumeText(_ summary: PublicMetadataSummary) -> String? {
        guard let present = summary.presentVolumeCount, let expected = summary.expectedVolumeCount else { return nil }
        let missing = summary.missingVolumeIndices.map(String.init).joined(separator: ", ")
        return missing.isEmpty ? "\(present) of \(expected) present" : "\(present) of \(expected) present; missing \(missing)"
    }

    private static func recoveryText(_ summary: PublicMetadataSummary) -> String? {
        let loss = summary.volumeLossTolerance ?? 0
        let damage = summary.bitRotBufferPercentage ?? 0
        guard loss > 0 || damage > 0 else { return "No recovery buffer declared" }
        return "\(loss) missing volume tolerance · \(damage)% damage buffer"
    }

    private static func byteText(_ value: UInt64) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(clamping: value), countStyle: .file)
    }

    private static func escape(_ value: String) -> String {
        value.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
    }
}

public struct PublicMetadataThumbnailCard: Equatable, Sendable {
    public let title: String
    public let subtitle: String
    public let detail: String

    public static func make(_ summary: PublicMetadataSummary) -> Self {
        if let error = summary.errorMessage {
            return Self(title: "Preview unavailable", subtitle: error, detail: "TZAP")
        }
        let title: String = switch summary.signatureStatus {
        case .verified: "Signature verified"
        case .inspected: "Signature inspected"
        case .unavailable: "TZAP archive"
        }
        let subtitle = summary.signer ?? summary.encryptionAlgorithm ?? "Public metadata"
        let detail = summary.totalSize.map { ByteCountFormatter.string(fromByteCount: Int64(clamping: $0), countStyle: .file) } ?? "TZAP"
        return Self(title: title, subtitle: subtitle, detail: detail)
    }
}
