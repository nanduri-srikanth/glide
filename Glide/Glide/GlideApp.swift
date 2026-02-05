//
//  GlideApp.swift
//  Glide
//
//  Created by Srikanth Nanduri on 2/4/26.
//

import SwiftUI

@main
struct GlideApp: App {
    // MARK: - State

    @StateObject private var appState = AppState.shared
    @StateObject private var navigationCoordinator = NavigationCoordinator.shared

    // MARK: - Body

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(navigationCoordinator)
                .onAppear {
                    setupApp()
                }
                .onOpenURL { url in
                    handleDeepLink(url)
                }
        }
    }

    // MARK: - Setup

    private func setupApp() {
        // Initialize dependency container
        _ = DependencyContainer.shared

        #if DEBUG
        print("✅ Glide App Started")
        print("📱 API Endpoint: \(Config.apiEndpoint)")
        print("🔧 Environment: \(Config.isLoggingEnabled ? "DEBUG" : "RELEASE")")
        #endif
    }

    // MARK: - Deep Linking

    private func handleDeepLink(_ url: URL) {
        navigationCoordinator.handleDeepLink(url)
    }
}

// MARK: - Root View

struct RootView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if appState.isAuthenticated {
                // Authenticated flow
                NotesListView()
            } else {
                // Authentication flow
                ContentView()
            }
        }
        .preferredColorScheme(appState.currentTheme.colorScheme)
    }
}
