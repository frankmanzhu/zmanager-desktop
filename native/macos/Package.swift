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
        .library(name: "ZManagerPreviewModel", targets: ["ZManagerPreviewModel"]),
        .library(name: "ZManagerUniFFI", targets: ["ZManagerUniFFI"]),
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
        // C target exposing the UniFFI-generated zmanagerFFI header as a module;
        // the implementation is linked statically from libzmanager_ffi.a by
        // build-macos-native-targets.sh (the header is synced from the sibling
        // zmanager checkout by scripts/sync-uniffi-swift-bindings.sh).
        .target(name: "zmanagerFFI"),
        // Generated UniFFI Swift scaffolding (zmanager.swift), synced the same way.
        .target(name: "ZManagerUniFFI", dependencies: ["zmanagerFFI"]),
        // Pure Swift model + HTML renderer for the bounded display summary.
        // Kept free of the UniFFI dependency so tests can link without the
        // Rust staticlib; the preview provider wires it to the FFI.
        .target(name: "ZManagerPreviewModel"),
        .target(
            name: "ZManagerQuickLookPreview",
            dependencies: ["ZManagerPreviewModel", "ZManagerUniFFI"]
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
            name: "ZManagerPreviewModelTests",
            dependencies: ["ZManagerPreviewModel"]
        ),
        .testTarget(name: "ZManagerMacOSHostTests", dependencies: ["ZManagerMacOSHost"])
    ]
)
