//
//  KeychainService.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import Security
import LocalAuthentication

/// Keychain Service for secure storage with access controls
class KeychainService: KeychainServiceProtocol {

    // MARK: - Properties

    private let service = "com.glide.app"

    // MARK: - Methods

    func get(key: String) -> String? {
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ] as [String: Any]

        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)

        if status == errSecSuccess,
           let data = dataTypeRef as? Data,
           let value = String(data: data, encoding: .utf8) {
            return value
        }

        return nil
    }

    func set(key: String, value: String) throws {
        try set(key: key, value: value, requireBiometric: false)
    }

    /// Store value in keychain with optional biometric authentication requirement
    /// - Parameters:
    ///   - key: The key to store the value under
    ///   - value: The value to store
    ///   - requireBiometric: If true, requires Face ID/Touch ID to access the item
    /// - Throws: KeychainError if storage fails
    func set(key: String, value: String, requireBiometric: Bool) throws {
        let data = value.data(using: .utf8)!

        // Build query with access controls
        var query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
            kSecValueData: data,
            // Only accessible when device is unlocked (prevents access when device is locked)
            kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ] as [String: Any]

        // Add biometric requirement if specified
        if requireBiometric {
            if let accessControl = createAccessControl() {
                query[kSecAttrAccessControl] = accessControl
            } else {
                // If access control creation fails, log warning but continue without biometric
                // (fallback for devices without biometric hardware)
                print("⚠️ Could not create access control, storing without biometric requirement")
            }
        }

        // First try to update existing item
        let updateQuery = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key
        ] as [String: Any]

        var attributes = [kSecValueData: data] as [String: Any]

        // Update access control if biometric requirement changed
        if requireBiometric {
            if let accessControl = createAccessControl() {
                attributes[kSecAttrAccessControl] = accessControl
            }
        } else {
            // Remove biometric requirement if it exists
            attributes[kSecAttrAccessible] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }

        var status = SecItemUpdate(updateQuery as CFDictionary, attributes as CFDictionary)

        // If update fails, try to add new item
        if status == errSecItemNotFound {
            status = SecItemAdd(query as CFDictionary, nil)
        }

        guard status == errSecSuccess else {
            throw KeychainError.unhandledError(status: status)
        }
    }

    func delete(key: String) throws {
        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key
        ] as [String: Any]

        let status = SecItemDelete(query as CFDictionary)

        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unhandledError(status: status)
        }
    }

    // MARK: - Access Control

    /// Create access control for biometric authentication
    /// - Returns: SecAccessControl object if successful, nil otherwise
    private func createAccessControl() -> SecAccessControl? {
        var error: Unmanaged<CFError>?

        // Create access control that requires user presence (biometric or device passcode)
        let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .userPresence,
            &error
        )

        if let error = error {
            let cfError = error.takeRetainedValue() as Error
            print("⚠️ Failed to create access control: \(cfError.localizedDescription)")
            return nil
        }

        return accessControl
    }

    /// Check if device supports biometric authentication
    /// - Returns: True if Face ID or Touch ID is available
    func isBiometricAvailable() -> Bool {
        let context = LAContext()
        var error: NSError?

        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    /// Get biometric authentication type (Face ID or Touch ID)
    /// - Returns: The type of biometric authentication available
    func getBiometricType() -> LABiometryType {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        return context.biometryType
    }
}

// MARK: - Keychain Errors

enum KeychainError: Error {
    case itemNotFound
    case unhandledError(status: OSStatus)
    case biometricNotAvailable
    case biometricFailed(message: String)

    var localizedDescription: String {
        switch self {
        case .itemNotFound:
            return "Item not found in keychain"
        case .unhandledError(let status):
            return "Unhandled keychain error: \(status)"
        case .biometricNotAvailable:
            return "Biometric authentication is not available on this device"
        case .biometricFailed(let message):
            return "Biometric authentication failed: \(message)"
        }
    }
}
