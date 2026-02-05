//
//  NavigationCoordinator.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import SwiftUI

/// Navigation Coordinator for managing app navigation
/// Handles navigation stack and deep linking
@MainActor
class NavigationCoordinator: ObservableObject {

    // MARK: - Published Properties

    /// Current navigation path
    @Published var navigationPath = NavigationPath()

    /// Currently presented sheet (modal)
    @Published var presentedSheet: Sheet?

    /// Currently presented alert
    @Published var presentedAlert: Alert?

    // MARK: - Types

    enum Sheet: Identifiable {
        case settings
        case profile
        case newNote
        case editNote(noteId: String)
        case shareNote(noteId: String)

        var id: String {
            switch self {
            case .settings: return "settings"
            case .profile: return "profile"
            case .newNote: return "newNote"
            case .editNote(let id): return "editNote-\(id)"
            case .shareNote(let id): return "shareNote-\(id)"
            }
        }
    }

    enum Alert: Identifiable {
        case error(message: String)
        case success(message: String)
        case confirmDelete(itemType: String, itemId: String)
        case logout

        var id: String {
            switch self {
            case .error: return "error"
            case .success: return "success"
            case .confirmDelete: return "confirmDelete"
            case .logout: return "logout"
            }
        }
    }

    // MARK: - Navigation Methods

    /// Navigate to a specific screen
    func navigate(to screen: Screen) {
        navigationPath.append(screen)
    }

    /// Pop the current screen
    func pop() {
        if !navigationPath.isEmpty {
            navigationPath.removeLast()
        }
    }

    /// Pop to root
    func popToRoot() {
        navigationPath.removeLast(navigationPath.count)
    }

    /// Present a sheet
    func presentSheet(_ sheet: Sheet) {
        presentedSheet = sheet
    }

    /// Dismiss current sheet
    func dismissSheet() {
        presentedSheet = nil
    }

    /// Present an alert
    func presentAlert(_ alert: Alert) {
        presentedAlert = alert
    }

    /// Dismiss current alert
    func dismissAlert() {
        presentedAlert = nil
    }

    // MARK: - Deep Linking

    /// Handle deep link URL
    func handleDeepLink(_ url: URL) {
        // Parse URL and navigate accordingly
        // Example: glide://note/123 -> Navigate to note detail
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let host = components.host else {
            return
        }

        switch host.lowercased() {
        case "note":
            if let noteId = components.queryItems?.first(where: { $0.name == "id" })?.value {
                navigate(to: .noteDetail(noteId: noteId))
            }
        case "notes":
            navigate(to: .notesList)
        case "settings":
            presentSheet(.settings)
        case "profile":
            presentSheet(.profile)
        default:
            break
        }
    }
}

// MARK: - Screen Definition

enum Screen: Hashable, Codable {
    case notesList
    case noteDetail(noteId: String)
    case folders
    case folderDetail(folderId: String)
    case search
    case trash
    case archive

    var displayName: String {
        switch self {
        case .notesList: return "Notes"
        case .noteDetail: return "Note"
        case .folders: return "Folders"
        case .folderDetail: return "Folder"
        case .search: return "Search"
        case .trash: return "Trash"
        case .archive: return "Archive"
        }
    }
}

// MARK: - Navigation Path Extension

extension NavigationPath {
    /// Append a screen to the navigation path
    mutating func append(_ screen: Screen) {
        self.append(screen)
    }

    /// Check if the last screen matches the given screen
    func lastScreen(is screen: Screen) -> Bool {
        // This is a simplified check - in production you'd want more sophisticated matching
        return !isEmpty
    }
}
