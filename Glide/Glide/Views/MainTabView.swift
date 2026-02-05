//
//  MainTabView.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import SwiftUI

/// Main Tab View - tab bar navigation matching React Native app layout
struct MainTabView: View {

    // MARK: - State

    @State private var selectedTab: Tab = .notes
    @StateObject private var navigationCoordinator = NavigationCoordinator.shared

    // MARK: - Tabs

    enum Tab: String, CaseIterable {
        case notes
        case settings

        var title: String {
            switch self {
            case .notes: return "Notes"
            case .settings: return "Settings"
            }
        }

        var iconName: String {
            switch self {
            case .notes: return "folder"
            case .settings: return "gearshape"
            }
        }
    }

    // MARK: - Body

    var body: some View {
        TabView(selection: $selectedTab) {
            // Notes Tab
            NotesListView()
                .tabItem {
                    Label(
                        Tab.notes.title,
                        systemImage: Tab.notes.iconName
                    )
                }
                .tag(Tab.notes)

            // Settings Tab
            SettingsPlaceholderView()
                .tabItem {
                    Label(
                        Tab.settings.title,
                        systemImage: Tab.settings.iconName
                    )
                }
                .tag(Tab.settings)
        }
        .tint(.blue)
    }
}

// MARK: - Settings Placeholder View

/// Placeholder Settings View (to be implemented)
struct SettingsPlaceholderView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: DesignConstants.spacingL) {
                Image(systemName: "gearshape")
                    .font(.system(size: DesignConstants.iconSizeXL))
                    .foregroundColor(.secondary)

                Text("Settings")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Settings functionality coming soon")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                // TODO: Implement settings view with:
                // - User profile section
                // - App preferences (theme, etc.)
                // - Logout button
            }
            .navigationTitle("Settings")
        }
    }
}

// MARK: - Preview

#Preview {
    MainTabView()
}
