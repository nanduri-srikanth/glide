//
//  Constants.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import SwiftUI

// MARK: - Design Constants

struct DesignConstants {

    // Spacing
    static let spacingXS: CGFloat = 4
    static let spacingS: CGFloat = 8
    static let spacingM: CGFloat = 16
    static let spacingL: CGFloat = 24
    static let spacingXL: CGFloat = 32

    // Corner Radius
    static let cornerRadiusS: CGFloat = 4
    static let cornerRadiusM: CGFloat = 8
    static let cornerRadiusL: CGFloat = 12
    static let cornerRadiusXL: CGFloat = 16

    // Icon Sizes
    static let iconSizeS: CGFloat = 16
    static let iconSizeM: CGFloat = 24
    static let iconSizeL: CGFloat = 32
    static let iconSizeXL: CGFloat = 48

    // Font Sizes
    static let fontSizeCaption: CGFloat = 12
    static let fontSizeBody: CGFloat = 16
    static let fontSizeSubheadline: CGFloat = 14
    static let fontSizeHeadline: CGFloat = 18
    static let fontSizeTitle: CGFloat = 24
    static let fontSizeLargeTitle: CGFloat = 32

    // Layout
    static let cellHeight: CGFloat = 60
    static let headerHeight: CGFloat = 44
    static let tabBarHeight: CGFloat = 49
}

// MARK: - Animation Constants

struct AnimationConstants {

    static let defaultDuration: Double = 0.3
    static let fastDuration: Double = 0.15
    static let slowDuration: Double = 0.5

    static var defaultAnimation: Animation {
        .easeInOut(duration: defaultDuration)
    }

    static var fastAnimation: Animation {
        .easeInOut(duration: fastDuration)
    }

    static var springAnimation: Animation {
        .spring(response: 0.3, dampingFraction: 0.7)
    }
}

// MARK: - Keychain Constants

struct KeychainConstants {

    static let service = "com.glide.app"
    static let authTokenKey = "auth_token"
    static let userIdKey = "user_id"
    static let refreshTokenKey = "refresh_token"
}

// MARK: - UserDefaults Keys

struct UserDefaultsKeys {

    static let appTheme = "appTheme"
    static let notificationsEnabled = "notifications_enabled"
    static let biometricAuthEnabled = "biometric_auth_enabled"
    static let autoSyncEnabled = "auto_sync_enabled"
    static let preferredFontSize = "preferred_font_size"
    static let hasSeenOnboarding = "has_seen_onboarding"
    static let lastSyncDate = "last_sync_date"
}
