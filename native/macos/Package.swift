// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ZManagerMacOS",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "ZManagerGenerated", targets: ["ZManagerGenerated"]),
        .library(name: "ZManagerMacOSShared", targets: ["ZManagerMacOSShared"]),
        .library(name: "ZManagerMacOSHost", type: .static, targets: ["ZManagerMacOSHost"])
    ],
    targets: [
        .target(name: "ZManagerGenerated"),
        .target(name: "ZManagerMacOSShared", dependencies: ["ZManagerGenerated"]),
        .target(name: "ZManagerMacOSHost", dependencies: ["ZManagerGenerated", "ZManagerMacOSShared"]),
        .testTarget(name: "ZManagerGeneratedTests", dependencies: ["ZManagerGenerated"]),
        .testTarget(name: "ZManagerMacOSSharedTests", dependencies: ["ZManagerMacOSShared"]),
        .testTarget(name: "ZManagerMacOSHostTests", dependencies: ["ZManagerMacOSHost"])
    ]
)
