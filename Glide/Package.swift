// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "Glide",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    dependencies: [
        // GRDB.swift for SQLite database
        .package(url: "https://github.com/groue/GRDB.swift", from: "6.0.0"),

        // KeychainAccess for secure token storage
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "Glide",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift"),
                .product(name: "KeychainAccess", package: "KeychainAccess"),
            ]
        ),
    ]
)
