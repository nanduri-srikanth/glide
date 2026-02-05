//
//  GlideTests.swift
//  GlideTests
//
//  Created by Srikanth Nanduri on 2/4/26.
//

import Testing
import Foundation
@testable import Glide

struct GlideTests {

    @Test func example() async throws {
        // Write your test here and use APIs like `#expect(...)` to check expected conditions.
    }

}

// MARK: - Feature #34: Strong Password Requirements Tests

struct PasswordValidationTests {

    // Helper to create an AuthViewModel for testing
    private func makeAuthViewModel() -> AuthViewModel {
        let container = DependencyContainer.shared
        return container.makeAuthViewModel()
    }

    // MARK: - Weak Password Tests (Should Fail)

    @Test("Reject password less than 8 characters") func testShortPassword() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "Pass1"  // Only 5 characters

        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Reject password with only lowercase letters") func testOnlyLowercase() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "password"  // 8 chars, all lowercase

        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Reject password with only uppercase letters") func testOnlyUppercase() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "PASSWORD"  // 8 chars, all uppercase

        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Reject password with only letters and numbers") func testNoUppercase() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "password123"  // Lowercase + number, no uppercase

        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Reject password with uppercase and lowercase but no number/special") func testNoNumberOrSpecial() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "Password"  // Upper + lower, no number or special

        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Reject weak password: aaaaaaaa") func testWeakPassword1() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "aaaaaaaa"  // All same character, no upper/number/special

        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Reject weak password: password") func testWeakPassword2() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "password"  // Common word, all lowercase

        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Reject password with number but no uppercase") func testNoUppercase2() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "password1"  // Lowercase + number, no uppercase

        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Reject password with special but no uppercase") func testNoUppercase3() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "password!"  // Lowercase + special, no uppercase

        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Reject password with uppercase but no lowercase") func testNoLowercase() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "PASSWORD1"  // Uppercase + number, no lowercase

        #expect(viewModel.isPasswordValid == false)
    }

    // MARK: - Strong Password Tests (Should Pass)

    @Test("Accept password: MyP@ssw0rd") func testStrongPassword1() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "MyP@ssw0rd"  // Upper, lower, number, special, 8+ chars

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    @Test("Accept password with uppercase, lowercase, and number") func testStrongPassword2() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "Password123"  // Upper, lower, number, 8+ chars

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    @Test("Accept password with uppercase, lowercase, and special") func testStrongPassword3() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "Password!"  // Upper, lower, special, 8+ chars

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    @Test("Accept strong password: SecureP@ss") func testStrongPassword4() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "SecureP@ss"  // Upper, lower, special, 8+ chars

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    @Test("Accept strong password: MyPass123") func testStrongPassword5() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "MyPass123"  // Upper, lower, number, 8+ chars

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    @Test("Accept strong password: Test#1234") func testStrongPassword6() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "Test#1234"  // Upper, lower, number, special, 8+ chars

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    @Test("Accept strong password: Hello@World1") func testStrongPassword7() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "Hello@World1"  // Upper, lower, number, special, 8+ chars

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    @Test("Accept strong password: P@ssw0rd") func testStrongPassword8() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "P@ssw0rd"  // Upper, lower, number, special, exactly 8 chars

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    // MARK: - Edge Cases

    @Test("Accept password exactly 8 characters meeting requirements") func testExactly8Characters() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "Pass123@"  // Exactly 8 chars, meets all requirements

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    @Test("Reject password exactly 7 characters even with all other requirements") func test7Characters() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "Pass12@"  // 7 chars, has upper, lower, number, special

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == false)
    }

    @Test("Accept very long password meeting requirements") func testVeryLongPassword() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "ThisIsAVeryStrongPassword123!@#"  // Long but meets requirements

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == true)
    }

    @Test("Reject empty password") func testEmptyPassword() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = ""

        viewModel.validatePassword()
        #expect(viewModel.isPasswordValid == false)
    }

    // MARK: - Special Characters Test

    @Test("Accept password with various special characters") func testVariousSpecialChars() async throws {
        let viewModel = makeAuthViewModel()

        // Test each type of special character
        let specialCharPasswords = [
            "Password!123",  // !
            "Password@123",  // @
            "Password#123",  // #
            "Password$123",  // $
            "Password%123",  // %
            "Password^123",  // ^
            "Password&123",  // &
            "Password*123",  // *
            "Password(123",  // (
            "Password)123",  // )
            "Password_123",  // _
            "Password+123",  // +
            "Password-123",  // -
            "Password=123",  // =
            "Password[123",  // [
            "Password]123",  // ]
            "Password{123",  // {
            "Password}123",  // }
            "Password|123",  // |
            "Password;123",  // ;
            "Password:123",  // :
            "Password,123",  // ,
            "Password.123",  // .
            "Password<123",  // <
            "Password>123",  // >
            "Password?123"   // ?
        ]

        for password in specialCharPasswords {
            viewModel.password = password
            viewModel.validatePassword()
            #expect(viewModel.isPasswordValid == true, "Password '\(password)' should be valid")
        }
    }

    // MARK: - Registration Form Validation Tests

    @Test("Valid registration form with strong password") func testValidRegistrationForm() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.email = "test@example.com"
        viewModel.name = "Test User"
        viewModel.password = "MyP@ssw0rd"
        viewModel.confirmPassword = "MyP@ssw0rd"
        viewModel.validateEmail()
        viewModel.validatePassword()

        #expect(viewModel.isValidRegistrationForm == true)
    }

    @Test("Invalid registration form with weak password") func testInvalidRegistrationForm() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.email = "test@example.com"
        viewModel.name = "Test User"
        viewModel.password = "password"  // Weak: all lowercase
        viewModel.confirmPassword = "password"
        viewModel.validateEmail()
        viewModel.validatePassword()

        #expect(viewModel.isValidRegistrationForm == false)
    }

    @Test("Invalid registration form when passwords don't match") func testPasswordsDontMatch() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.email = "test@example.com"
        viewModel.name = "Test User"
        viewModel.password = "MyP@ssw0rd"
        viewModel.confirmPassword = "DifferentP@ssw0rd"
        viewModel.validateEmail()
        viewModel.validatePassword()

        #expect(viewModel.isValidRegistrationForm == false)
    }

    // MARK: - Password Requirements Message Tests

    @Test("Password requirements message shows correct status for weak password") func testRequirementsMessageWeak() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "pass"  // Short, lowercase only

        let message = viewModel.passwordRequirementsMessage

        #expect(message.contains("• 8+ characters"))
        #expect(message.contains("• Uppercase"))
        #expect(message.contains("✓ Lowercase"))
        #expect(message.contains("• Number or special"))
    }

    @Test("Password requirements message shows correct status for strong password") func testRequirementsMessageStrong() async throws {
        let viewModel = makeAuthViewModel()
        viewModel.password = "MyP@ssw0rd"

        let message = viewModel.passwordRequirementsMessage

        #expect(message.contains("✓ 8+ characters"))
        #expect(message.contains("✓ Uppercase"))
        #expect(message.contains("✓ Lowercase"))
        #expect(message.contains("✓ Number or special"))
    }

    @Test("Password requirements message updates as user types") func testRequirementsMessageProgress() async throws {
        let viewModel = makeAuthViewModel()

        // Start with empty password
        viewModel.password = ""
        var message = viewModel.passwordRequirementsMessage
        #expect(message.contains("• 8+ characters"))

        // Add lowercase
        viewModel.password = "pass"
        message = viewModel.passwordRequirementsMessage
        #expect(message.contains("• 8+ characters"))
        #expect(message.contains("✓ Lowercase"))

        // Add uppercase
        viewModel.password = "Pass"
        message = viewModel.passwordRequirementsMessage
        #expect(message.contains("✓ Lowercase"))
        #expect(message.contains("✓ Uppercase"))

        // Add number
        viewModel.password = "Pass123"
        message = viewModel.passwordRequirementsMessage
        #expect(message.contains("• 8+ characters"))
        #expect(message.contains("✓ Number or special"))

        // Complete strong password
        viewModel.password = "Pass123@"
        message = viewModel.passwordRequirementsMessage
        #expect(message.contains("✓ 8+ characters"))
        #expect(message.contains("✓ Lowercase"))
        #expect(message.contains("✓ Uppercase"))
        #expect(message.contains("✓ Number or special"))
    }
}
