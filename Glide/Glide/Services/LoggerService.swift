//
//  LoggerService.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import os.log

/// Logger Service Protocol
///
/// SECURITY WARNING: NEVER log Personally Identifiable Information (PII)
/// - Do NOT log email addresses
/// - Do NOT log user IDs
/// - Do NOT log authentication tokens
/// - Do NOT log passwords or password reset tokens
/// - Do NOT log session IDs or cookies
/// - Do NOT log IP addresses
///
/// Logs may be sent to analytics/crash reporting services and stored indefinitely.
/// When in doubt, log a generic message without user-specific data.
///
/// Examples of SAFE logging:
/// - ✅ "User logged in successfully"
/// - ✅ "Login attempt failed due to invalid credentials"
/// - ✅ "Password reset initiated"
///
/// Examples of UNSAFE logging (NEVER do this):
/// - ❌ "User logged in: user@example.com"
/// - ❌ "Login failed for john@email.com"
/// - ❌ "Auth token: abc123xyz..."
///
protocol LoggerServiceProtocol {
    func verbose(_ message: String, file: String, function: String, line: Int)
    func debug(_ message: String, file: String, function: String, line: Int)
    func info(_ message: String, file: String, function: String, line: Int)
    func warning(_ message: String, file: String, function: String, line: Int)
    func error(_ message: String, file: String, function: String, line: Int)
}

/// Console Logger for development
class ConsoleLogger: LoggerServiceProtocol {

    private let subsystem = "com.glide.app"
    private let category = "GlideLogger"

    private let osLog: OSLog

    init() {
        self.osLog = OSLog(subsystem: subsystem, category: category)
    }

    func verbose(_ message: String, file: String, function: String, line: Int) {
        log(message, level: .verbose, file: file, function: function, line: line)
    }

    func debug(_ message: String, file: String, function: String, line: Int) {
        log(message, level: .debug, file: file, function: function, line: line)
    }

    func info(_ message: String, file: String, function: String, line: Int) {
        log(message, level: .info, file: file, function: function, line: line)
    }

    func warning(_ message: String, file: String, function: String, line: Int) {
        log(message, level: .warning, file: file, function: function, line: line)
    }

    func error(_ message: String, file: String, function: String, line: Int) {
        log(message, level: .error, file: file, function: function, line: line)
    }

    private func log(_ message: String, level: Config.LogLevel, file: String, function: String, line: Int) {
        guard level >= Config.logLevel else { return }

        let filename = (file as NSString).lastPathComponent
        let timestamp = ISO8601DateFormatter().string(from: Date())

        let logMessage = "[\(timestamp)] [\(level)] [\(filename):\(line)] \(function): \(message)"

        switch level {
        case .verbose:
            os_log("%{public}@", log: osLog, type: .debug, logMessage)
        case .debug:
            os_log("%{public}@", log: osLog, type: .debug, logMessage)
        case .info:
            os_log("%{public}@", log: osLog, type: .info, logMessage)
        case .warning:
            os_log("%{public}@", log: osLog, type: .default, logMessage)
        case .error:
            os_log("%{public}@", log: osLog, type: .error, logMessage)
        }

        // Also print to console for debugging
        print(logMessage)
    }
}

/// Production Logger that only logs errors
class ProductionLogger: LoggerServiceProtocol {

    func verbose(_ message: String, file: String, function: String, line: Int) {
        // No verbose logging in production
    }

    func debug(_ message: String, file: String, function: String, line: Int) {
        // No debug logging in production
    }

    func info(_ message: String, file: String, function: String, line: Int) {
        // No info logging in production
    }

    func warning(_ message: String, file: String, function: String, line: Int) {
        // No warning logging in production
    }

    func error(_ message: String, file: String, function: String, line: Int) {
        // Only log errors in production
        let filename = (file as NSString).lastPathComponent
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let logMessage = "[\(timestamp)] [ERROR] [\(filename):\(line)] \(function): \(message)"

        // Use os_log for production error logging
        os_log("%{public}@", log: OSLog.default, type: .error, logMessage)
    }
}
