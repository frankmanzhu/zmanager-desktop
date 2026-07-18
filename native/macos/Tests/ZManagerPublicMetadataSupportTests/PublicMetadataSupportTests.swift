import Testing
@testable import ZManagerPublicMetadataSupport

@Test
func parsesEncryptedMultiVolumeAndEscapesPreviewHTML() {
    let summary = PublicMetadataSummary.parse(fileName: "<project>.vol000.tzap", object: [
        "ok": true,
        "metadata": [
            "expected_volume_count": 4,
            "present_volume_count": 3,
            "missing_volume_indices": [2, -1],
            "total_size": 2_097_152,
            "format": [
                "format_version": 1,
                "volume_format_revision": 4,
                "compression_algorithm": "zstd",
                "encryption_algorithm": "aes-gcm-siv-256",
                "key_derivation": "argon2id",
                "password_required": true,
                "volume_loss_tolerance": 1,
            ],
        ],
        "signature": [
            "status": "verified",
            "root_auth": ["subject": "CN=<Signer>", "issuer": "CN=Root"],
        ],
    ])
    #expect(summary.signatureStatus == .verified)
    #expect(summary.missingVolumeIndices == [2])
    #expect(summary.passwordRequired == true)
    let html = PublicMetadataHTML.render(summary)
    #expect(html.contains("&lt;project&gt;"))
    #expect(html.contains("CN=&lt;Signer&gt;"))
    #expect(!html.contains("<project>"))
}

@Test
func rendersUnsignedAndUntrustedArchivesWithoutClaimingVerification() {
    let unsigned = PublicMetadataSummary.parse(fileName: "plain.tzap", object: [
        "ok": true,
        "metadata": ["format": ["encryption_algorithm": "none", "password_required": false]],
        "signature": ["status": "unavailable", "message": "No public signer certificate is available."],
    ])
    #expect(unsigned.signatureStatus == .unavailable)
    #expect(PublicMetadataHTML.render(unsigned).contains("No public signer certificate"))

    let inspected = PublicMetadataSummary.parse(fileName: "signed.tzap", object: [
        "ok": true,
        "metadata": ["format": [:]],
        "signature": ["status": "unverified", "root_auth": ["subject": "CN=Local Signer"]],
    ])
    #expect(PublicMetadataThumbnailCard.make(inspected).title == "Signature inspected")
}

@Test
func rejectsMalformedAndOversizedResponses() {
    #expect(PublicMetadataSummary.parse(fileName: "bad.tzap", json: "not json").errorMessage != nil)
    let oversized = String(repeating: "x", count: 1_048_577)
    #expect(PublicMetadataSummary.parse(fileName: "hostile.tzap", json: oversized).errorMessage != nil)
}
