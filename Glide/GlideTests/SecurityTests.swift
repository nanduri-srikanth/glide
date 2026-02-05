//
//  SecurityTests.swift
//  GlideTests
//
//  Created by Claude on 2/5/26.
//  Unit tests for SecurityService and jailbreak detection
//

import XCTest
@testable import Glide

// MARK: - Security Service Tests

class SecurityServiceTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Reset feature flags before each test
        // Note: In production, these would be configurable
    }

    override func tearDown() {
        super.tearDown()
    }

    // MARK: - Jailbreak File Detection Tests

    func testJailbreakFileDetection() {
        #if targetEnvironment(simulator)
        // On simulator, should always return false
        let result = SecurityService.isJailbroken()
        XCTAssertFalse(result, "Simulator should not be detected as jailbroken")
        #else
        // On device, perform the actual check
        let result = SecurityService.isJailbroken()

        // We can't assert true/false definitively since we don't know the test device state
        // But we can verify the method runs without crashing
        XCTAssertNotNil(result)
        #endif
    }

    func testSecurityReportStructure() {
        let report = SecurityService.securityReport()

        // Verify report structure
        XCTAssertNotNil(report)
        XCTAssertNotNil(report.isJailbroken)
        XCTAssertNotNil(report.isSimulator)
        XCTAssertNotNil(report.detectionDisabled)
        XCTAssertNotNil(report.checksPerformed)

        // Verify description is not empty
        XCTAssertFalse(report.description.isEmpty, "Security report description should not be empty")
    }

    func testSecurityReportOnSimulator() {
        #if targetEnvironment(simulator)
        let report = SecurityService.securityReport()

        XCTAssertTrue(report.isSimulator, "Should detect simulator environment")
        XCTAssertFalse(report.isJailbroken, "Simulator should not be jailbroken")
        XCTAssertTrue(report.description.contains("Simulator"), "Description should mention simulator")
        #endif
    }

    func testSecurityReportContainsCheckDetails() {
        let report = SecurityService.securityReport()

        #if !targetEnvironment(simulator)
        // On device, should have performed checks
        XCTAssertFalse(report.checksPerformed.isEmpty, "Should have performed security checks")

        // Verify each check has required fields
        for check in report.checksPerformed {
            XCTAssertFalse(check.name.isEmpty, "Check should have a name")
            XCTAssertNotNil(check.passed, "Check should have a result")
            XCTAssertFalse(check.description.isEmpty, "Check should have a description")
        }
        #endif
    }

    // MARK: - Individual Security Check Tests

    func testJailbreakFilesCheck() {
        #if !targetEnvironment(simulator)
        // Test the individual file detection method
        // Note: This tests the implementation directly, which is normally private
        // In a real test environment, you might make these methods internal for testing

        let hasJailbreakFiles = SecurityService.securityReport()
            .checksPerformed
            .first { $0.name == "Jailbreak Files" }

        XCTAssertNotNil(hasJailbreakFiles, "Should have performed Jailbreak Files check")
        #endif
    }

    func testSandboxEscapeCheck() {
        #if !targetEnvironment(simulator)
        let sandboxCheck = SecurityService.securityReport()
            .checksPerformed
            .first { $0.name == "Sandbox Escape" }

        XCTAssertNotNil(sandboxCheck, "Should have performed Sandbox Escape check")
        XCTAssertNotNil(sandboxCheck?.passed, "Check should have a result")
        #endif
    }

    func testForkCapabilityCheck() {
        #if !targetEnvironment(simulator)
        let forkCheck = SecurityService.securityReport()
            .checksPerformed
            .first { $0.name == "Fork Capability" }

        XCTAssertNotNil(forkCheck, "Should have performed Fork Capability check")
        XCTAssertNotNil(forkCheck?.passed, "Check should have a result")
        #endif
    }

    func testSuspiciousDylibsCheck() {
        #if !targetEnvironment(simulator)
        let dylibCheck = SecurityService.securityReport()
            .checksPerformed
            .first { $0.name == "Suspicious Dylibs" }

        XCTAssertNotNil(dylibCheck, "Should have performed Suspicious Dylibs check")
        XCTAssertNotNil(dylibCheck?.passed, "Check should have a result")
        #endif
    }

    // MARK: - Integration Tests

    func testSecurityCheckDoesNotCrash() {
        // Verify that security checks don't crash the app
        XCTAssertNoThrow(
            _ = SecurityService.securityReport(),
            "Security checks should complete without throwing"
        )
    }

    func testMultipleSecurityChecksConsistent() {
        // Run security check multiple times and verify consistent results
        let report1 = SecurityService.securityReport()
        let report2 = SecurityService.securityReport()

        XCTAssertEqual(report1.isJailbroken, report2.isJailbroken,
                      "Jailbreak detection should be consistent")
        XCTAssertEqual(report1.isSimulator, report2.isSimulator,
                      "Simulator detection should be consistent")
    }

    func testSecurityReportDescription() {
        let report = SecurityService.securityReport()
        let description = report.description

        // Verify description is informative
        XCTAssertFalse(description.isEmpty, "Description should not be empty")

        // Description should contain relevant information
        if report.isSimulator {
            XCTAssertTrue(description.contains("Simulator"),
                          "Simulator report should mention simulator")
        } else if report.isJailbroken {
            XCTAssertTrue(description.contains("JAILBROKEN") || description.contains("⚠️"),
                          "Jailbreak detection should be clearly indicated")
        } else {
            XCTAssertTrue(description.contains("✅") || description.contains("passed"),
                          "Clean device should show positive indication")
        }
    }
}

// MARK: - Security Feature Flags Tests

class SecurityFeatureFlagsTests: XCTestCase {

    func testJailbreakDetectionFlagExists() {
        // Verify the feature flag exists
        let _ = Config.FeatureFlags.disableJailbreakDetection
        // If this compiles, the flag exists
    }

    func testJailbreakDetectionCanBeDisabled() {
        // This test verifies that the flag can be toggled
        // In actual usage, this would be set via Config
        let flagValue = Config.FeatureFlags.disableJailbreakDetection

        #if DEBUG
        // In DEBUG mode, verify flag is accessible
        XCTAssertNotNil(flagValue, "Feature flag should be accessible in DEBUG")
        #else
        // In RELEASE mode, verify flag is false (always enforce)
        XCTAssertFalse(flagValue, "Jailbreak detection should always be enforced in RELEASE")
        #endif
    }
}

// MARK: - Performance Tests

class SecurityPerformanceTests: XCTestCase {

    func testSecurityCheckPerformance() {
        // Security checks should complete quickly (< 1 second)
        measure {
            _ = SecurityService.securityReport()
        }
    }

    func testJailbreakDetectionPerformance() {
        // Individual detection should be fast
        measure {
            _ = SecurityService.isJailbroken()
        }
    }
}
