//
//  KeychainService.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import Security

/// Keychain Service for secure storage
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
        let data = value.data(using: .utf8)!

        let query = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
            kSecValueData: data
        ] as [String: Any]

        // First try to update existing item
        let updateQuery = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key
        ] as [String: Any]

        let attributes = [kSecValueData: data] as [String: Any]

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
}

// MARK: - Keychain Errors

enum KeychainError: Error {
    case itemNotFound
    case unhandledError(status: OSStatus)

    var localizedDescription: String {
        switch self {
        case .itemNotFound:
            return "Item not found in keychain"
        case .unhandledError(let status):
            return "Unhandled keychain error: \(status)"
        }
    }
}
