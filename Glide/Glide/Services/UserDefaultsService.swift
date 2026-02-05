//
//  UserDefaultsService.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// User Defaults Service for persisting user preferences
class UserDefaultsService: UserDefaultsServiceProtocol {

    // MARK: - Properties

    private let userDefaults = UserDefaults.standard

    // MARK: - Methods

    func get<T>(_ key: String, defaultValue: T) -> T where T: Codable {
        // Check if value exists
        guard let data = userDefaults.data(forKey: key) else {
            return defaultValue
        }

        do {
            let decoded = try JSONDecoder().decode(T.self, from: data)
            return decoded
        } catch {
            print("Failed to decode value for key \(key): \(error)")
            return defaultValue
        }
    }

    func set<T>(_ key: String, value: T) where T: Codable {
        do {
            let encoded = try JSONEncoder().encode(value)
            userDefaults.set(encoded, forKey: key)
        } catch {
            print("Failed to encode value for key \(key): \(error)")
        }
    }

    func remove(_ key: String) {
        userDefaults.removeObject(forKey: key)
    }
}
