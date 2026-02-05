//
//  SecurityService.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Security service for detecting jailbroken/rooted devices
//

import Foundation
import Darwin

/// Security Service for device integrity checks
class SecurityService {

    // MARK: - Jailbreak Detection

    /// Detects if the current device is jailbroken
    /// - Returns: true if device is jailbroken, false otherwise
    static func isJailbroken() -> Bool {
        // Skip check in simulator (development)
        #if targetEnvironment(simulator)
        return false
        #endif

        // Check if jailbreak detection is disabled via config
        if Config.FeatureFlags.disableJailbreakDetection {
            return false
        }

        // Perform all checks
        var checkResults: [Bool] = []

        // Check 1: Common jailbreak files
        checkResults.append(checkJailbreakFiles())

        // Check 2: Sandbox escape
        checkResults.append(canEscapeSandbox())

        // Check 3: Fork capability
        checkResults.append(canFork())

        // Check 4: Suspicious dylibs
        checkResults.append(hasSuspiciousDylibs())

        // Device is considered jailbroken if ANY check passes
        return checkResults.contains(true)
    }

    // MARK: - Individual Checks

    /// Checks for existence of common jailbreak files and directories
    private static func checkJailbreakFiles() -> Bool {
        let jailbreakPaths = [
            "/Applications/Cydia.app",
            "/Applications/blackra1n.app",
            "/Applications/FakeCarrier.app",
            "/Applications/Icy.app",
            "/Applications/IntelliScreen.app",
            "/Applications/MxTube.app",
            "/Applications/RockApp.app",
            "/Applications/SBSettings.app",
            "/Applications/WinterBoard.app",
            "/private/var/lib/apt/",
            "/private/var/lib/cydia/",
            "/var/cache/apt/",
            "/var/lib/apt/",
            "/var/lib/cydia/",
            "/var/tmp/cydia.log",
            "/usr/bin/sshd",
            "/usr/libexec/sftp-server",
            "/usr/libexec/ssh-keysign",
            "/usr/sbin/sshd",
            "/bin/bash",
            "/bin/sh",
            "/etc/apt",
            "/etc/ssh",
            "/private/var/log/syslog",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/System/Library/LaunchDaemons/com.ikey.bbot.plist",
            "/System/Library/LaunchDaemons/com.saurik.Cydia.Startup.plist",
            "/var/cache/apt/",
            "/usr/libexec/cydia/",
            "/usr/sbin/frida-server",
            "/usr/bin/cycript",
            "/usr/local/bin/cycript",
            "/usr/lib/libcycript.dylib",
            "/frida",
            "/.installed_unc0ver",
            "/private/var/lib/apt/",
            "/Applications/FakeCarrier.app"
        ]

        for path in jailbreakPaths {
            if FileManager.default.fileExists(atPath: path) {
                return true
            }
        }

        return false
    }

    /// Checks if app can escape sandbox by writing to system directories
    private static func canEscapeSandbox() -> Bool {
        let testPaths = [
            "/private/test_jailbreak.txt",
            "/var/mobile/test_jailbreak.txt"
        ]

        for path in testPaths {
            do {
                try "test".write(toFile: path, atomically: true, encoding: .utf8)

                // If we successfully wrote the file, we're jailbroken
                // Clean up the test file
                try? FileManager.default.removeItem(atPath: path)
                return true
            } catch {
                // Expected to fail on non-jailbroken devices
                continue
            }
        }

        return false
    }

    /// Checks if app can fork (jailbroken devices can)
    private static func canFork() -> Bool {
        let pid = fork()

        if pid >= 0 {
            // Fork succeeded - we're on a jailbroken device
            // Kill the child process immediately
            if pid > 0 {
                _ = waitpid(pid, nil, 0)
            }
            return true
        }

        return false
    }

    /// Checks for suspicious dylibs loaded in process
    private static func hasSuspiciousDylibs() -> Bool {
        let suspiciousDylibs = [
            "FridaGadget",
            "frida",
            "cycript",
            "libcycript",
            "substrate",
            "SubstrateLoader",
            "SubstrateInserter",
            "libsubstitute",
            "libhooker",
            "SubstrateBootstrap",
            "Substrate",
            "SSLKillSwitch",
            "SSLKillSwitch2",
            "trustcache",
            "cynject",
            "libactivation"
        ]

        let imageCount = _dyld_image_count()

        for i in 0..<imageCount {
            if let imageName = _dyld_get_image_name(i) {
                let name = String(cString: imageName)

                for suspicious in suspiciousDylibs {
                    if name.contains(suspicious) {
                        return true
                    }
                }
            }
        }

        return false
    }

    // MARK: - Device Integrity Summary

    /// Returns a detailed security report
    static func securityReport() -> SecurityReport {
        #if targetEnvironment(simulator)
        return SecurityReport(
            isJailbroken: false,
            isSimulator: true,
            detectionDisabled: Config.FeatureFlags.disableJailbreakDetection,
            checksPerformed: []
        )
        #else
        var checks: [SecurityCheck] = []

        checks.append(SecurityCheck(
            name: "Jailbreak Files",
            passed: checkJailbreakFiles(),
            description: "Checks for common jailbreak file indicators"
        ))

        checks.append(SecurityCheck(
            name: "Sandbox Escape",
            passed: canEscapeSandbox(),
            description: "Attempts to write outside app sandbox"
        ))

        checks.append(SecurityCheck(
            name: "Fork Capability",
            passed: canFork(),
            description: "Checks if process can fork (jailbreak indicator)"
        ))

        checks.append(SecurityCheck(
            name: "Suspicious Dylibs",
            passed: hasSuspiciousDylibs(),
            description: "Scans loaded dynamic libraries"
        ))

        let jailbroken = checks.contains { $0.passed }

        return SecurityReport(
            isJailbroken: jailbroken,
            isSimulator: false,
            detectionDisabled: Config.FeatureFlags.disableJailbreakDetection,
            checksPerformed: checks
        )
        #endif
    }
}

// MARK: - Security Report Types

/// Detailed security check result
struct SecurityCheck {
    let name: String
    let passed: Bool
    let description: String
}

/// Complete security assessment report
struct SecurityReport {
    let isJailbroken: Bool
    let isSimulator: Bool
    let detectionDisabled: Bool
    let checksPerformed: [SecurityCheck]

    var description: String {
        if isSimulator {
            return "Running on iOS Simulator (security checks skipped)"
        }

        if detectionDisabled {
            return "Jailbreak detection is disabled (Config.FeatureFlags.disableJailbreakDetection)"
        }

        if isJailbroken {
            let failedChecks = checksPerformed.filter { $0.passed }
            let failedNames = failedChecks.map { $0.name }.joined(separator: ", ")
            return "⚠️ DEVICE APPEARS JAILBROKEN\nFailed checks: \(failedNames)"
        }

        return "✅ Device passed all security checks"
    }
}
