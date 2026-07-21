// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ZManagerMacOS",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "ZManagerGenerated", targets: ["ZManagerGenerated"]),
        .library(name: "ZManagerMacOSShared", targets: ["ZManagerMacOSShared"]),
        .library(name: "ZManagerFinderExtensionSupport", targets: ["ZManagerFinderExtensionSupport"]),
        .library(name: "ZManagerFinderExtension", targets: ["ZManagerFinderExtension"]),
        .library(name: "ZManagerPublicMetadataSupport", targets: ["ZManagerPublicMetadataSupport"]),
        .library(name: "ZManagerQuickLookPreview", targets: ["ZManagerQuickLookPreview"]),
        .library(name: "ZManagerQuickLookThumbnail", targets: ["ZManagerQuickLookThumbnail"]),
        .library(name: "ZManagerMacOSHost", type: .static, targets: ["ZManagerMacOSHost"])
    ],
    targets: [
        .target(name: "ZManagerGenerated"),
        .target(name: "ZManagerMacOSShared", dependencies: ["ZManagerGenerated"]),
        .target(
            name: "ZManagerFinderExtensionSupport",
            dependencies: ["ZManagerGenerated", "ZManagerMacOSShared"]
        ),
        .target(
            name: "ZManagerFinderExtension",
            dependencies: ["ZManagerFinderExtensionSupport"]
        ),
        .target(name: "ZManagerPublicMetadataSupport"),
        .target(
            name: "ZManagerQuickLookPreview",
            dependencies: ["ZManagerPublicMetadataSupport"]
        ),
        .target(
            name: "ZManagerQuickLookThumbnail"
        ),
        .target(name: "ZManagerMacOSHost", dependencies: ["ZManagerGenerated", "ZManagerMacOSShared"]),
        .testTarget(name: "ZManagerGeneratedTests", dependencies: ["ZManagerGenerated"]),
        .testTarget(name: "ZManagerMacOSSharedTests", dependencies: ["ZManagerMacOSShared"]),
        .testTarget(
            name: "ZManagerFinderExtensionSupportTests",
            dependencies: ["ZManagerFinderExtensionSupport"]
        ),
        .testTarget(
            name: "ZManagerPublicMetadataSupportTests",
            dependencies: ["ZManagerPublicMetadataSupport"]
        ),
        .testTarget(name: "ZManagerMacOSHostTests", dependencies: ["ZManagerMacOSHost"])
    ]
)
