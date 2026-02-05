//
//  NotesListView.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import SwiftUI

/// Notes List View - displays all notes in a list
struct NotesListView: View {

    // MARK: - State

    @StateObject private var viewModel: NotesListViewModel
    @StateObject private var navigationCoordinator = NavigationCoordinator.shared
    @StateObject private var appState = AppState.shared

    @State private var isShowingSearch = false

    // MARK: - Initialization

    init(viewModel: NotesListViewModel? = nil) {
        _viewModel = StateObject(wrappedValue: viewModel ?? DependencyContainer.shared.makeNotesListViewModel())
    }

    // MARK: - Body

    var body: some View {
        NavigationStack(path: $navigationCoordinator.navigationPath) {
            Group {
                if viewModel.isLoading {
                    loadingView
                } else if let errorMessage = viewModel.errorMessage, viewModel.isEmpty {
                    errorView(errorMessage)
                } else if viewModel.isEmpty {
                    emptyView
                } else {
                    notesList
                }
            }
            .navigationTitle("Notes")
            .onAppear {
                // Fetch notes when view appears
                if viewModel.notes.isEmpty {
                    viewModel.refresh()
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        navigationCoordinator.presentSheet(.settings)
                    }) {
                        Image(systemName: "gearshape")
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        Button(action: {
                            isShowingSearch.toggle()
                        }) {
                            Image(systemName: "magnifyingglass")
                        }

                        Button(action: {
                            navigationCoordinator.presentSheet(.newNote)
                        }) {
                            Image(systemName: "plus")
                        }
                    }
                }
            }
            .searchable(text: $viewModel.searchText, isPresented: $isShowingSearch)
            .sheet(item: $navigationCoordinator.presentedSheet) { sheet in
                sheetContent(sheet)
            }
            .alert(item: Binding<NavigationCoordinator.Alert?>(
                get: { navigationCoordinator.presentedAlert },
                set: { _ in navigationCoordinator.dismissAlert() }
            )) { alert in
                alertContent(alert)
            }
            .alert("Error", isPresented: Binding<Bool>(
                get: { viewModel.errorMessage != nil && !viewModel.isEmpty },
                set: { _ in viewModel.errorMessage = nil }
            )) {
                Button("OK") {
                    viewModel.errorMessage = nil
                }
            } message: {
                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                }
            }
        }
    }

    // MARK: - Views

    private var loadingView: some View {
        VStack(spacing: DesignConstants.spacingM) {
            ProgressView()
            Text("Loading notes...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    private var emptyView: some View {
        VStack(spacing: DesignConstants.spacingL) {
            Image(systemName: "note.text")
                .font(.system(size: DesignConstants.iconSizeXL))
                .foregroundColor(.secondary)

            Text("No Notes Yet")
                .font(.headline)

            Text("Create your first note to get started")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: {
                navigationCoordinator.presentSheet(.newNote)
            }) {
                Text("Create Note")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, DesignConstants.spacingL)
                    .padding(.vertical, DesignConstants.spacingM)
                    .background(Color.blue)
                    .cornerRadius(DesignConstants.cornerRadiusM)
            }
        }
        .padding(DesignConstants.spacingXL)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: DesignConstants.spacingL) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: DesignConstants.iconSizeXL))
                .foregroundColor(.orange)

            Text("Couldn't Load Notes")
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: {
                viewModel.refresh()
            }) {
                Text("Retry")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, DesignConstants.spacingL)
                    .padding(.vertical, DesignConstants.spacingM)
                    .background(Color.blue)
                    .cornerRadius(DesignConstants.cornerRadiusM)
            }
        }
        .padding(DesignConstants.spacingXL)
    }

    private var notesList: some View {
        List {
            ForEach(viewModel.filteredNotes) { note in
                NotesListCell(note: note)
                    .onTapGesture {
                        navigationCoordinator.navigate(to: .noteDetail(noteId: note.id))
                    }
                    .contextMenu {
                        Button(action: {
                            Task {
                                await viewModel.togglePin(note)
                            }
                        }) {
                            Label(
                                note.isPinned ? "Unpin" : "Pin",
                                systemImage: note.isPinned ? "pin.slash" : "pin"
                            )
                        }

                        Button(role: .destructive, action: {
                            Task {
                                await viewModel.deleteNote(note)
                            }
                        }) {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.loadNotes()
        }
    }

    // MARK: - Sheet Content

    @ViewBuilder
    private func sheetContent(_ sheet: NavigationCoordinator.Sheet) -> some View {
        switch sheet {
        case .settings:
            Text("Settings View")
                // SettingsView(viewModel: DependencyContainer.shared.makeSettingsViewModel())

        case .profile:
            Text("Profile View")

        case .newNote:
            Text("New Note View")
                // NoteEditView(viewModel: DependencyContainer.shared.makeNoteEditViewModel())

        case .editNote(let noteId):
            Text("Edit Note: \(noteId)")
                // NoteEditView(viewModel: DependencyContainer.shared.makeNoteEditViewModel(noteId: noteId))

        case .shareNote(let noteId):
            Text("Share Note: \(noteId)")
        }
    }

    // MARK: - Alert Content

    @ViewBuilder
    private func alertContent(_ alert: NavigationCoordinator.Alert) -> some View {
        switch alert {
        case .error(let message):
            Alert(
                title: Text("Error"),
                message: Text(message),
                dismissButton: .default(Text("OK"))
            )

        case .success(let message):
            Alert(
                title: Text("Success"),
                message: Text(message),
                dismissButton: .default(Text("OK"))
            )

        case .confirmDelete(let itemType, let itemId):
            Alert(
                title: Text("Delete \(itemType)?"),
                message: Text("This action cannot be undone."),
                primaryButton: .cancel(),
                secondaryButton: .destructive(Text("Delete")) {
                    Task {
                        // Handle delete
                    }
                }
            )

        case .logout:
            Alert(
                title: Text("Log Out?"),
                message: Text("Are you sure you want to log out?"),
                primaryButton: .cancel(),
                secondaryButton: .destructive(Text("Log Out")) {
                    Task {
                        // Handle logout
                    }
                }
            )
        }
    }
}

// MARK: - Notes List Cell

struct NotesListCell: View {
    let note: Note

    var body: some View {
        HStack(spacing: DesignConstants.spacingM) {
            VStack(alignment: .leading, spacing: DesignConstants.spacingXS) {
                HStack {
                    Text(note.title.isEmpty ? "Untitled" : note.title)
                        .font(.headline)
                        .lineLimit(1)

                    if note.isPinned {
                        Image(systemName: "pin.fill")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Text(note.updatedAt.relativeFormatted())
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Text(note.excerpt)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                if !note.tags.isEmpty {
                    HStack {
                        ForEach(note.tags.prefix(3), id: \.self) { tag in
                            Text("#\(tag)")
                                .font(.caption)
                                .padding(.horizontal, DesignConstants.spacingS)
                                .padding(.vertical, DesignConstants.spacingXS)
                                .background(Color.blue.opacity(0.1))
                                .foregroundColor(.blue)
                                .cornerRadius(DesignConstants.cornerRadiusS)
                        }
                    }
                }
            }
        }
        .padding(.vertical, DesignConstants.spacingXS)
    }
}

// MARK: - Preview

#Preview {
    let viewModel = NotesListViewModel(
        notesRepository: DependencyContainer.shared.notesRepository,
        logger: DependencyContainer.shared.loggerService
    )

    return NotesListView(viewModel: viewModel)
}
