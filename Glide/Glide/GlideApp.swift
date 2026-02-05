//
//  GlideApp.swift
//  Glide
//
//  Created by Srikanth Nanduri on 2/4/26.
//

import SwiftUI
import BackgroundTasks

@main
struct GlideApp: App {
    // MARK: - State

    @StateObject private var appState = AppState.shared
    @StateObject private var navigationCoordinator = NavigationCoordinator.shared

    // Background task identifier for token refresh
    private let backgroundTaskIdentifier = "com.glide.tokenRefresh"

    // Security state
    @State private var showJailbreakAlert = false
    @State private var securityReport: SecurityReport?

    // MARK: - Body

    var body: some Scene {
        WindowGroup {
            ZStack {
                RootView()
                    .environmentObject(appState)
                    .environmentObject(navigationCoordinator)
                    .onAppear {
                        setupApp()
                    }
                    .onOpenURL { url in
                        handleDeepLink(url)
                    }
                    .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                        handleAppWillEnterForeground()
                    }
                    .alert("Security Alert", isPresented: $showJailbreakAlert) {
                        Button("OK", role: .cancel) {
                            // Exit app when jailbroken device detected
                            exit(0)
                        }
                    } message: {
                        Text(securityReport?.description ?? "This app cannot run on jailbroken devices for security reasons.")
                    }
            }
        }
    }

    // MARK: - Setup

    private func setupApp() {
        do {
            // Initialize database
            try DatabaseManager.shared.initialize()
            print("✅ Database initialized successfully")

            // Initialize dependency container and database repositories
            try DependencyContainer.shared.initializeDatabaseRepositories()
            print("✅ Database repositories initialized")

            // Initialize dependency container
            _ = DependencyContainer.shared

            // Register background task for token refresh
            registerBackgroundTasks()

            #if DEBUG
            print("✅ Glide App Started")
            print("📱 API Endpoint: \(Config.apiEndpoint)")
            print("🔧 Environment: \(Config.isLoggingEnabled ? "DEBUG" : "RELEASE")")
            #endif
        } catch {
            print("❌ Failed to initialize database: \(error.localizedDescription)")
            // In production, you might want to show an error to the user
        }
    }

    // MARK: - Background Tasks

    /// Register background task for proactive token refresh
    private func registerBackgroundTasks() {
        do {
            try BGTaskScheduler.shared.register(
                forTaskWithIdentifier: backgroundTaskIdentifier,
                using: nil
            ) { [weak self] task in
                self?.handleBackgroundTokenRefresh(task as! BGAppRefreshTask)
            }

            print("✅ Background token refresh task registered")
        } catch {
            print("❌ Failed to register background task: \(error.localizedDescription)")
        }
    }

    /// Handle background token refresh task
    private func handleBackgroundTokenRefresh(_ task: BGAppRefreshTask) {
        // Get the auth service from dependency container
        let authService = DependencyContainer.shared.makeAuthService()

        // Delegate to auth service to handle the refresh
        authService.handleBackgroundTokenRefresh(task: task)
    }

    /// Handle app entering foreground (refresh token if needed)
    private func handleAppWillEnterForeground() {
        Task {
            // When app returns to foreground, check if token needs refresh
            let authService = DependencyContainer.shared.makeAuthService()

            do {
                try await authService.refreshTokenIfNeeded()
                print("✅ Token refresh check on app resume")
            } catch {
                print("⚠️ Token refresh on resume failed: \(error.localizedDescription)")
            }
        }
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
                // Authentication flow - Login View
                LoginView(viewModel: DependencyContainer.shared.makeAuthViewModel())
            }
        }
        .preferredColorScheme(appState.currentTheme.colorScheme)
    }
}
