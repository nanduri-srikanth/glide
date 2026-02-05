//
//  Config.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// Environment-specific configuration for the Glide app
struct Config {

    // MARK: - API Configuration

    /// Base URL for the API backend
    /// Can be overridden via environment variable or command line argument
    static let apiBaseURL: String = {
        // Check for environment variable (for production/override)
        if let customURL = ProcessInfo.processInfo.environment["GLIDE_API_URL"] {
            return customURL
        }

        #if DEBUG
        // Development environment - use localhost
        return "http://localhost:8000"
        #else
        // Production environment - use production API
        return "https://api.glideapp.com"
        #endif
    }()

    /// API version
    static let apiVersion = "v1"

    /// Full API endpoint URL
    static var apiEndpoint: String {
        return "\(apiBaseURL)/api/\(apiVersion)"
    }

    // MARK: - App Configuration

    /// App version
    static let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"

    /// Build number
    static let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"

    /// Bundle identifier
    static let bundleIdentifier = Bundle.main.bundleIdentifier ?? "com.glide.app"

    // MARK: - Feature Flags

    struct FeatureFlags {
        static let enableOfflineMode = true
        static let enableBiometricAuth = true
        static let enableCrashReporting = true
        static let enableAnalytics = true
    }

    // MARK: - Timeouts

    struct Timeouts {
        static let defaultRequestTimeout: TimeInterval = 30.0
        static let uploadRequestTimeout: TimeInterval = 300.0
        static let downloadRequestTimeout: TimeInterval = 60.0
    }

    // MARK: - Storage

    struct Storage {
        static let maximumCacheSize: Int64 = 100 * 1024 * 1024 // 100 MB
        static let maximumOfflineStorageDays: Int = 30
    }

    // MARK: - Debug

    #if DEBUG
    static let isLoggingEnabled = true
    static let logLevel: LogLevel = .verbose
    #else
    static let isLoggingEnabled = false
    static let logLevel: LogLevel = .error
    #endif

    enum LogLevel: Int, Comparable {
        case verbose = 0
        case debug = 1
        case info = 2
        case warning = 3
        case error = 4

        static func < (lhs: LogLevel, rhs: LogLevel) -> Bool {
            return lhs.rawValue < rhs.rawValue
        }
    }
}
